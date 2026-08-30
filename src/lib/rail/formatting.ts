export const formatMinutes = (total: number) => {
  const minutes = Math.max(0, Math.round(total));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
};
