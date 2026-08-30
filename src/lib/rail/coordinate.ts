export type Coordinate = { latitude: number; longitude: number };

export const isValidCoordinate = ({ latitude, longitude }: Coordinate) =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
