export const pageSize = (value: number, maximum = 100) => Math.min(maximum, Math.max(1, Math.trunc(value)));
export const pageNumber = (value: number) => Math.max(1, Math.trunc(value));
export const pageOffset = (page: number, size: number) => (pageNumber(page) - 1) * pageSize(size);
