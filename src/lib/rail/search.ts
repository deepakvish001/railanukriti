export const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase();

export const containsSearch = (candidate: string, query: string) => {
  const normalized = normalizeSearch(query);
  return normalized.length === 0 || normalizeSearch(candidate).includes(normalized);
};
