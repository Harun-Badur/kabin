import { logger, sanitizeLogContext } from '../lib/logger';

describe('sanitizeLogContext', () => {
  it('PII anahtarlarını maskeler', () => {
    const sanitized = sanitizeLogContext({
      userId: 'user-123',
      email: 'ada@example.com',
      token: 'secret-token',
      productId: 'p-1',
    });

    expect(sanitized).toEqual({
      userId: '[gizlendi]',
      email: '[gizlendi]',
      token: '[gizlendi]',
      productId: 'p-1',
    });
  });

  it('iç içe nesnelerde de PII maskeler', () => {
    const sanitized = sanitizeLogContext({
      meta: {
        user_id: 'abc',
        authorization: 'Bearer xyz',
      },
    });

    expect(sanitized).toEqual({
      meta: {
        user_id: '[gizlendi]',
        authorization: '[gizlendi]',
      },
    });
  });
});

describe('logger', () => {
  it('error bağlamındaki PII’yi console’a yazmaz', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('Beğeni kaydı başarısız', {
      userId: 'user-123',
      email: 'ada@example.com',
      productId: 'p-9',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe('Beğeni kaydı başarısız');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      userId: '[gizlendi]',
      email: '[gizlendi]',
      productId: 'p-9',
    });

    spy.mockRestore();
  });
});
