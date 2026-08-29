import {
  FASHN_DEFAULT_PROMPT,
  FASHN_TRYON_MAX_FORBIDDEN_INPUT_KEYS,
  FASHN_TRYON_MAX_MODEL_NAME,
  buildFashnTryOnMaxRequest,
  parseFashnGenerationMode,
  parseFashnResolution,
  resolveFashnPrompt,
} from '../lib/fashnTryonMax';

describe('buildFashnTryOnMaxRequest', () => {
  const request = buildFashnTryOnMaxRequest(
    'data:image/jpeg;base64,aaa',
    'https://cdn.example.com/garment.jpg',
  );

  it('Try-On Max 1k fast gövdesini default prompt ile üretir', () => {
    expect(request.model_name).toBe(FASHN_TRYON_MAX_MODEL_NAME);
    expect(request.inputs.model_image).toBe('data:image/jpeg;base64,aaa');
    expect(request.inputs.product_image).toBe(
      'https://cdn.example.com/garment.jpg',
    );
    expect(request.inputs.resolution).toBe('1k');
    expect(request.inputs.generation_mode).toBe('fast');
    expect(request.inputs.num_images).toBe(1);
    expect(request.inputs.output_format).toBe('png');
    expect(request.inputs.return_base64).toBe(true);
    expect(request.inputs.prompt).toBe(FASHN_DEFAULT_PROMPT);
    expect(request.inputs).not.toHaveProperty('seed');
  });

  it('boş prompt gönderilmez; seed ve v1.6 alanları yoktur', () => {
    const withoutPrompt = buildFashnTryOnMaxRequest(
      'data:image/jpeg;base64,aaa',
      'https://cdn.example.com/garment.jpg',
      { prompt: '' },
    );
    expect(withoutPrompt.inputs).not.toHaveProperty('prompt');
    expect(withoutPrompt.inputs).not.toHaveProperty('seed');
    for (const key of FASHN_TRYON_MAX_FORBIDDEN_INPUT_KEYS) {
      expect(withoutPrompt.inputs).not.toHaveProperty(key);
    }
    expect(Object.keys(withoutPrompt.inputs).sort()).toEqual(
      [
        'generation_mode',
        'model_image',
        'num_images',
        'output_format',
        'product_image',
        'resolution',
        'return_base64',
      ].sort(),
    );
  });

  it('env parse default 1k/fast kalır', () => {
    expect(parseFashnResolution(undefined)).toBe('1k');
    expect(parseFashnResolution('balanced')).toBe('1k');
    expect(parseFashnGenerationMode(undefined)).toBe('fast');
    expect(parseFashnGenerationMode('1k')).toBe('fast');
    expect(resolveFashnPrompt(undefined)).toBe(FASHN_DEFAULT_PROMPT);
    expect(resolveFashnPrompt('')).toBeNull();
  });
});
