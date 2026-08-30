export const finiteNonNegative = (value: number) => Number.isFinite(value) && value >= 0;
export const requiredText = (value: string, maximum = 200) => {
  const text = value.trim();
  return text.length > 0 && text.length <= maximum;
};
