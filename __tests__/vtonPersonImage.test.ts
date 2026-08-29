import { buildVtonClientRequest } from '../lib/vtonEdgeContract';
import {
  detectImageMime,
  inspectPersonImageBytes,
  isLowResolutionPersonPhoto,
  preparePersonDataUriFromBase64,
  scaleLongEdge,
  toPersonDataUri,
  validateFashnInputLimits,
} from '../lib/vtonPersonImage';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const bytesToBase64 = (bytes: number[]): string =>
  Buffer.from(Uint8Array.from(bytes)).toString('base64');

const patchPngSize = (base64: string, width: number, height: number): string => {
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const patched = Uint8Array.from(bytes);
  patched[16] = (width >>> 24) & 0xff;
  patched[17] = (width >>> 16) & 0xff;
  patched[18] = (width >>> 8) & 0xff;
  patched[19] = width & 0xff;
  patched[20] = (height >>> 24) & 0xff;
  patched[21] = (height >>> 16) & 0xff;
  patched[22] = (height >>> 8) & 0xff;
  patched[23] = height & 0xff;
  return Buffer.from(patched).toString('base64');
};

const JPEG_32X32_HEADER = [
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00,
  0x20, 0x00, 0x20, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
];

describe('vtonPersonImage', () => {
  it('PNG MIME ve boyutunu korur', () => {
    const payload = patchPngSize(PNG_1X1_BASE64, 32, 48);
    const prepared = preparePersonDataUriFromBase64(payload);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    expect(prepared.mimeType).toBe('image/png');
    expect(prepared.width).toBe(32);
    expect(prepared.height).toBe(48);
    expect(prepared.dataUri.startsWith('data:image/png;base64,')).toBe(true);
    expect(prepared.dataUri.endsWith(payload)).toBe(true);
  });

  it('JPEG MIME eşleşmesini korur', () => {
    const payload = bytesToBase64(JPEG_32X32_HEADER);
    const prepared = preparePersonDataUriFromBase64(payload);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    expect(prepared.mimeType).toBe('image/jpeg');
    expect(prepared.dataUri.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('tanınmayan formatı reddeder', () => {
    const prepared = preparePersonDataUriFromBase64(bytesToBase64([0x00, 0x01, 0x02]));
    expect(prepared.ok).toBe(false);
  });

  it('15px altı ve 16:1 dışı en-boy oranını reddeder', () => {
    const tiny = preparePersonDataUriFromBase64(PNG_1X1_BASE64);
    expect(tiny.ok).toBe(false);
    const okWide = inspectPersonImageBytes(
      Uint8Array.from(Buffer.from(patchPngSize(PNG_1X1_BASE64, 256, 16), 'base64')),
    );
    expect(okWide).not.toBeNull();
    if (!okWide) {
      return;
    }
    expect(validateFashnInputLimits(okWide)).toBeNull();
    const tooWide = inspectPersonImageBytes(
      Uint8Array.from(Buffer.from(patchPngSize(PNG_1X1_BASE64, 257, 16), 'base64')),
    );
    expect(tooWide).not.toBeNull();
    if (!tooWide) {
      return;
    }
    expect(validateFashnInputLimits(tooWide)?.ok).toBe(false);
  });

  it('gereksiz resize yapmadan en-boy oranını korur', () => {
    expect(scaleLongEdge(800, 1200, 2000)).toEqual({ width: 800, height: 1200 });
    expect(scaleLongEdge(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(scaleLongEdge(2000, 3000, 1536)).toEqual({ width: 1024, height: 1536 });
  });

  it('1000px altı long-edge düşük çözünürlük sayılır', () => {
    expect(isLowResolutionPersonPhoto(768, 960)).toBe(true);
    expect(isLowResolutionPersonPhoto(768, 1024)).toBe(false);
    expect(isLowResolutionPersonPhoto(1000, 1500)).toBe(false);
  });

  it('client contract yalnızca model_image ve product_image içerir', () => {
    const body = buildVtonClientRequest(
      toPersonDataUri(PNG_1X1_BASE64, 'image/png'),
      'https://cdn.example.com/p.jpg',
    );
    expect(Object.keys(body).sort()).toEqual(['model_image', 'product_image']);
    expect(body.model_image.startsWith('data:image/png;base64,')).toBe(true);
    expect(detectImageMime(Uint8Array.from(Buffer.from(PNG_1X1_BASE64, 'base64')))).toBe(
      'image/png',
    );
  });
});
