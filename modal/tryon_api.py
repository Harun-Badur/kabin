"""Kabin serverless Virtual Try-On API on Modal (CatVTON)."""

from __future__ import annotations

import base64
import hmac
import io
import logging
import os
import sys
from typing import Any

import modal
from pydantic import BaseModel, HttpUrl, model_validator

APP_NAME = "kabin-vton"
CATVTON_ROOT = "/opt/CatVTON"
HF_CACHE_DIR = "/root/.cache/huggingface"
INFERENCE_STEPS = 30
IMAGE_SIZE = (768, 1024)
REQUEST_TIMEOUT_SEC = 120
IDLE_TIMEOUT_SEC = 300
SECRET_HEADER = "X-Kabin-Secret"
SECRET_ENV_VAR = "KABIN_VTON_SECRET"
PUBLIC_PATHS = frozenset({"/health"})

logger = logging.getLogger("kabin-vton")
logging.basicConfig(level=logging.INFO)

app = modal.App(APP_NAME)

hf_cache_volume = modal.Volume.from_name("kabin-vton-hf-cache", create_if_missing=True)

# modal secret create kabin-vton-secret KABIN_VTON_SECRET=<rastgele-uzun-dize>
vton_secret = modal.Secret.from_name("kabin-vton-secret")

vton_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "wget", "ffmpeg")
    .pip_install(
        "torch==2.4.1",
        "torchvision==0.19.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "diffusers==0.29.2",
        "transformers==4.44.2",
        "accelerate==0.34.2",
        "huggingface_hub==0.25.2",
        "safetensors",
        "einops",
        "opencv-python-headless",
        "pillow",
        "fastapi",
        "pydantic",
        "requests",
        "scipy",
        "scikit-image",
        "matplotlib",
        "tqdm",
        "numpy",
    )
    .run_commands(
        f"git clone --depth 1 https://github.com/Zheng-Chong/CatVTON.git {CATVTON_ROOT}"
    )
    .env({"PYTHONPATH": CATVTON_ROOT, "HF_HOME": HF_CACHE_DIR})
)


class TryOnRequest(BaseModel):
    person_image_url: HttpUrl | None = None
    person_image_base64: str | None = None
    garment_image_url: HttpUrl
    cloth_type: str = "upper"
    category: str | None = None
    garment_description: str | None = None

    @model_validator(mode="after")
    def require_person_source(self) -> TryOnRequest:
        has_base64 = bool(
            self.person_image_base64 and self.person_image_base64.strip()
        )
        if not has_base64 and self.person_image_url is None:
            raise ValueError("person_image_url veya person_image_base64 gerekli.")
        return self


class TryOnResponse(BaseModel):
    image_base64: str
    content_type: str = "image/png"
    image_data_uri: str


class ErrorResponse(BaseModel):
    detail: str


CATEGORY_TO_CLOTH_TYPE = {
    "upper_body": "upper",
    "lower_body": "lower",
    "dresses": "overall",
}


def _resolve_cloth_type(cloth_type: str, category: str | None) -> str:
    if category is None or not category.strip():
        return cloth_type

    mapped = CATEGORY_TO_CLOTH_TYPE.get(category)
    if mapped is None:
        raise ValueError(
            f"category geçersiz: {category}. "
            f"Kullanılabilenler: {sorted(CATEGORY_TO_CLOTH_TYPE)}"
        )
    return mapped


def _download_image(url: str) -> "Image.Image":
    import requests
    from PIL import Image

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ValueError(f"Görsel indirilemedi: {url}") from exc

    try:
        image = Image.open(io.BytesIO(response.content)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Görsel açılamadı: {url}") from exc

    if image.width < 32 or image.height < 32:
        raise ValueError("Görsel boyutu çok küçük.")

    return image


def _decode_base64_image(payload: str) -> "Image.Image":
    from PIL import Image

    raw = payload.strip()
    if raw.lower().startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    raw = "".join(raw.split())

    try:
        image_bytes = base64.b64decode(raw, validate=False)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("person_image_base64 çözümlenemedi.") from exc

    if image.width < 32 or image.height < 32:
        raise ValueError("Görsel boyutu çok küçük.")

    return image


def _encode_png_base64(image: "Image.Image") -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


@app.cls(
    image=vton_image,
    gpu="A10G",
    timeout=REQUEST_TIMEOUT_SEC,
    startup_timeout=900,
    scaledown_window=IDLE_TIMEOUT_SEC,
    min_containers=0,
    volumes={HF_CACHE_DIR: hf_cache_volume},
    secrets=[vton_secret],
)
class TryOnService:
    """Loads CatVTON once per container, then serves FastAPI /tryon."""

    @modal.enter()
    def load_model(self) -> None:
        import torch
        from diffusers.image_processor import VaeImageProcessor
        from huggingface_hub import snapshot_download
        from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

        sys.path.insert(0, CATVTON_ROOT)

        from model.pipeline import CatVTONPipeline
        from utils import init_weight_dtype

        os.makedirs(HF_CACHE_DIR, exist_ok=True)

        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU bulunamadı; CatVTON GPU gerektirir.")

        logger.info("Downloading CatVTON checkpoints from Hugging Face")
        repo_path = snapshot_download(repo_id="zhengchong/CatVTON")

        # runwayml inpaint is gated; community mirror works without extra tokens.
        base_ckpt = os.environ.get(
            "CATVTON_BASE_CKPT",
            "booksforcharlie/stable-diffusion-inpainting",
        )

        logger.info("Loading CatVTON pipeline on GPU")
        self.pipeline = CatVTONPipeline(
            base_ckpt=base_ckpt,
            attn_ckpt=repo_path,
            attn_ckpt_version="mix",
            weight_dtype=init_weight_dtype("fp16"),
            use_tf32=True,
            device="cuda",
            skip_safety_check=True,
        )
        self.mask_processor = VaeImageProcessor(
            vae_scale_factor=8,
            do_normalize=False,
            do_binarize=True,
            do_convert_grayscale=True,
        )
        # DensePose/detectron2 compile is unreliable on Modal slim images.
        # Segformer clothes parsing produces the inpaint mask instead.
        logger.info("Loading clothes segmentation model")
        self.seg_processor = AutoImageProcessor.from_pretrained(
            "mattmdjaga/segformer_b2_clothes"
        )
        self.seg_model = SegformerForSemanticSegmentation.from_pretrained(
            "mattmdjaga/segformer_b2_clothes"
        ).to("cuda")
        self.seg_model.eval()
        hf_cache_volume.commit()
        logger.info("CatVTON ready")

    def _clothes_mask(self, person_image: "Image.Image", cloth_type: str) -> "Image.Image":
        import numpy as np
        import torch
        from PIL import Image

        class_ids = {
            "upper": {4, 7, 8, 14, 15},
            "lower": {5, 6, 12, 13},
            "overall": {4, 5, 6, 7, 8, 12, 13, 14, 15},
        }[cloth_type]

        inputs = self.seg_processor(images=person_image, return_tensors="pt")
        inputs = {key: value.to("cuda") for key, value in inputs.items()}
        with torch.no_grad():
            logits = self.seg_model(**inputs).logits

        upsampled = torch.nn.functional.interpolate(
            logits,
            size=person_image.size[::-1],
            mode="bilinear",
            align_corners=False,
        )
        pred = upsampled.argmax(dim=1)[0].detach().cpu().numpy()
        mask_np = np.isin(pred, list(class_ids)).astype(np.uint8) * 255
        if int(mask_np.max()) == 0:
            raise ValueError("Kıyafet maskesi üretilemedi; kişi görselini kontrol edin.")
        return Image.fromarray(mask_np).convert("L")

    def run_inference(
        self,
        garment_url: str,
        cloth_type: str,
        person_url: str | None = None,
        person_image_base64: str | None = None,
    ) -> TryOnResponse:
        import torch
        from utils import resize_and_crop, resize_and_padding

        allowed_types = {"upper", "lower", "overall"}
        if cloth_type not in allowed_types:
            raise ValueError(
                f"cloth_type geçersiz: {cloth_type}. Kullanılabilenler: {sorted(allowed_types)}"
            )

        if person_image_base64 and person_image_base64.strip():
            person_image = _decode_base64_image(person_image_base64)
        elif person_url:
            person_image = _download_image(person_url)
        else:
            raise ValueError("person_image_url veya person_image_base64 gerekli.")

        garment_image = _download_image(garment_url)
        person_image = resize_and_crop(person_image, IMAGE_SIZE)
        garment_image = resize_and_padding(garment_image, IMAGE_SIZE)

        mask = self._clothes_mask(person_image, cloth_type)
        mask = self.mask_processor.blur(mask, blur_factor=9)

        generator = torch.Generator(device="cuda").manual_seed(42)
        result = self.pipeline(
            image=person_image,
            condition_image=garment_image,
            mask=mask,
            num_inference_steps=INFERENCE_STEPS,
            guidance_scale=2.5,
            generator=generator,
        )[0]

        image_base64 = _encode_png_base64(result)
        return TryOnResponse(
            image_base64=image_base64,
            image_data_uri=f"data:image/png;base64,{image_base64}",
        )

    @modal.asgi_app()
    def fastapi_app(self) -> Any:
        from fastapi import FastAPI, HTTPException, Request
        from fastapi.responses import JSONResponse

        web = FastAPI(title="Kabin VTON", version="1.0.0")
        service = self

        @web.middleware("http")
        async def require_shared_secret(request: Request, call_next: Any) -> Any:
            """Sağlık kontrolü dışındaki tüm yollarda paylaşılan sırrı doğrula.

            Endpoint herkese açık bir URL'de yayınlandığı için tek koruma
            katmanı bu başlıktır; Edge Function proxy'si dışındaki çağrılar
            401 alır.
            """
            if request.url.path in PUBLIC_PATHS:
                return await call_next(request)

            expected = os.environ.get(SECRET_ENV_VAR, "")
            if not expected:
                logger.error("%s tanımlı değil; istek reddedildi.", SECRET_ENV_VAR)
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Servis yapılandırılmamış."},
                )

            provided = request.headers.get(SECRET_HEADER, "")
            if not hmac.compare_digest(provided, expected):
                logger.warning("Geçersiz %s başlığı reddedildi.", SECRET_HEADER)
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Yetkisiz istek."},
                )

            return await call_next(request)

        @web.post(
            "/tryon",
            response_model=TryOnResponse,
            responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
        )
        def tryon(payload: TryOnRequest) -> TryOnResponse:
            try:
                cloth_type = _resolve_cloth_type(payload.cloth_type, payload.category)
                logger.info(
                    "Try-on request cloth_type=%s category=%s garment=%s",
                    cloth_type,
                    payload.category,
                    payload.garment_description,
                )
                return service.run_inference(
                    person_url=(
                        str(payload.person_image_url)
                        if payload.person_image_url is not None
                        else None
                    ),
                    person_image_base64=payload.person_image_base64,
                    garment_url=str(payload.garment_image_url),
                    cloth_type=cloth_type,
                )
            except ValueError as exc:
                logger.exception("Invalid try-on request")
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                logger.exception("Try-on inference failed")
                raise HTTPException(
                    status_code=500,
                    detail="Sanal deneme başarısız. Loglara bakın veya tekrar deneyin.",
                ) from exc

        @web.get("/health")
        def health() -> dict[str, str]:
            return {"status": "ok", "app": APP_NAME}

        return web
