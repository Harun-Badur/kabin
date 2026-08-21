export const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const parseOptionalNumeric = (value: unknown): number | undefined => {
  const parsed = parseNumeric(value);
  return parsed === null ? undefined : parsed;
};
