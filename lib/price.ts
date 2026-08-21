const isNumericToken = (value: string): boolean =>
  value.length > 0 && value !== '-' && value !== '.' && value !== '-.';

export const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const normalized = value.trim().replace(',', '.').replace(/[^\d.-]/g, '');
    if (!isNumericToken(normalized)) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const parseOptionalNumeric = (value: unknown): number | undefined => {
  const parsed = parseNumeric(value);
  return parsed === null ? undefined : parsed;
};
