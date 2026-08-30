export const normalizeTrainNumber = (value: string) => value.replace(/\s+/g, "").toUpperCase();
export const normalizeSectionCode = (value: string) => value.trim().replace(/\s+/g, "-").toUpperCase();
export const isValidTrainNumber = (value: string) => /^[A-Z0-9-]{3,12}$/.test(normalizeTrainNumber(value));
