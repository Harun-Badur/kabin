export const FASHN_MAX_INPUT_BYTES = 30 * 1024 * 1024;
export const FASHN_MIN_DIMENSION_PX = 15;
export const FASHN_MIN_ASPECT = 1 / 16;
export const FASHN_MAX_ASPECT = 16;
export const PERSON_PHOTO_MAX_LONG_EDGE = 1536;
export const PERSON_PHOTO_JPEG_QUALITY = 0.92;
export const PERSON_PHOTO_LOW_RES_LONG_EDGE = 1000;
export const LOW_RES_MODEL_PHOTO_HINT =
  'Daha iyi deneme sonucu için model fotoğrafını yenile.';

export type SupportedPersonMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface PersonImageInspection {
  mimeType: SupportedPersonMime;
  width: number;
  height: number;
  byteLength: number;
}

export interface PersonImageReady {
  ok: true;
  dataUri: string;
  mimeType: SupportedPersonMime;
  width: number;
  height: number;
  byteLength: number;
}

export interface PersonImageRejected {
  ok: false;
  detail: string;
}

export type PersonImagePrepareResult = PersonImageReady | PersonImageRejected;

const DATA_URI_PREFIX = /^data:(image\/[a-z0-9+.-]+);base64,/i;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const stripBase64Payload = (value: string): string => {
  const trimmed = value.trim();
  const match = DATA_URI_PREFIX.exec(trimmed);
  const payload = match ? trimmed.slice(match[0].length) : trimmed;
  return payload.replace(/\s/g, '');
};

export const decodeBase64ToBytes = (value: string): Uint8Array => {
  const payload = stripBase64Payload(value);
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(payload, 'base64'));
  }
  const binary = globalThis.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const estimateDecodedBase64Bytes = (value: string): number => {
  const payload = stripBase64Payload(value);
  const padding =
    payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
};

const readU32be = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 4 > bytes.length) {
    return null;
  }
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
};

const readU16be = (bytes: Uint8Array, offset: number): number | null => {
  if (offset + 2 > bytes.length) {
    return null;
  }
  return (bytes[offset] << 8) | bytes[offset + 1];
};

const hasPrefix = (bytes: Uint8Array, prefix: number[]): boolean => {
  if (bytes.length < prefix.length) {
    return false;
  }
  return prefix.every((value, index) => bytes[index] === value);
};

export const detectImageMime = (
  bytes: Uint8Array,
): SupportedPersonMime | null => {
  if (hasPrefix(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
};

const readPngSize = (
  bytes: Uint8Array,
): { width: number; height: number } | null => {
  const width = readU32be(bytes, 16);
  const height = readU32be(bytes, 20);
  if (width === null || height === null || width === 0 || height === 0) {
    return null;
  }
  return { width, height };
};

const readJpegSize = (
  bytes: Uint8Array,
): { width: number; height: number } | null => {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = readU16be(bytes, offset + 2);
    if (length === null || length < 2) {
      return null;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      const height = readU16be(bytes, offset + 5);
      const width = readU16be(bytes, offset + 7);
      if (width === null || height === null || width === 0 || height === 0) {
        return null;
      }
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
};

const readWebpSize = (
  bytes: Uint8Array,
): { width: number; height: number } | null => {
  if (bytes.length < 30) {
    return null;
  }
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk === 'VP8X') {
    const width =
      1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height =
      1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    if (width === 0 || height === 0) {
      return null;
    }
    return { width, height };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    const width = readU16be(bytes, 26);
    const height = readU16be(bytes, 28);
    if (width === null || height === null) {
      return null;
    }
    return { width: width & 0x3fff, height: height & 0x3fff };
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
};

export const readImageDimensions = (
  bytes: Uint8Array,
  mimeType: SupportedPersonMime,
): { width: number; height: number } | null => {
  if (mimeType === 'image/png') {
    return readPngSize(bytes);
  }
  if (mimeType === 'image/jpeg') {
    return readJpegSize(bytes);
  }
  return readWebpSize(bytes);
};

export const inspectPersonImageBytes = (
  bytes: Uint8Array,
): PersonImageInspection | null => {
  const mimeType = detectImageMime(bytes);
  if (!mimeType) {
    return null;
  }
  const size = readImageDimensions(bytes, mimeType);
  if (!size) {
    return null;
  }
  return {
    mimeType,
    width: size.width,
    height: size.height,
    byteLength: bytes.byteLength,
  };
};

export const validateFashnInputLimits = (
  inspection: PersonImageInspection,
): PersonImageRejected | null => {
  if (inspection.byteLength > FASHN_MAX_INPUT_BYTES) {
    return {
      ok: false,
      detail: 'Fotoğraf çok büyük. Daha küçük bir görsel dene.',
    };
  }
  if (
    inspection.width < FASHN_MIN_DIMENSION_PX ||
    inspection.height < FASHN_MIN_DIMENSION_PX
  ) {
    return {
      ok: false,
      detail: 'Fotoğraf çok küçük. En az 15×15 piksel olmalı.',
    };
  }
  const aspect = inspection.width / inspection.height;
  if (aspect < FASHN_MIN_ASPECT || aspect > FASHN_MAX_ASPECT) {
    return {
      ok: false,
      detail: 'Fotoğraf en-boy oranı desteklenmiyor.',
    };
  }
  return null;
};

export const toPersonDataUri = (
  payloadBase64: string,
  mimeType: SupportedPersonMime,
): string => `data:${mimeType};base64,${stripBase64Payload(payloadBase64)}`;

export const preparePersonDataUriFromBase64 = (
  payloadBase64: string,
): PersonImagePrepareResult => {
  const bytes = decodeBase64ToBytes(payloadBase64);
  const inspection = inspectPersonImageBytes(bytes);
  if (!inspection) {
    return {
      ok: false,
      detail: 'Fotoğraf formatı tanınmadı. PNG, JPEG veya WEBP dene.',
    };
  }
  const limitError = validateFashnInputLimits(inspection);
  if (limitError) {
    return limitError;
  }
  return {
    ok: true,
    dataUri: toPersonDataUri(payloadBase64, inspection.mimeType),
    mimeType: inspection.mimeType,
    width: inspection.width,
    height: inspection.height,
    byteLength: inspection.byteLength,
  };
};

export const isLowResolutionPersonPhoto = (
  width: number,
  height: number,
): boolean => Math.max(width, height) < PERSON_PHOTO_LOW_RES_LONG_EDGE;

export const inspectDataUriMeta = (
  dataUri: string,
): PersonImageInspection | null =>
  inspectPersonImageBytes(decodeBase64ToBytes(dataUri));

export const estimateDataUriBytes = (dataUri: string): number =>
  estimateDecodedBase64Bytes(dataUri);

export const scaleLongEdge = (
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } => {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }
  const ratio = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

export const saveFormatForMime = (
  mimeType: SupportedPersonMime,
): 'png' | 'jpeg' | 'webp' => {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  return 'jpeg';
};

export const isHttpsProductImageUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
