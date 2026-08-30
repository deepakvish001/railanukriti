export const stableSort = <T>(items: T[], compare: (a: T, b: T) => number) =>
  items.map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
