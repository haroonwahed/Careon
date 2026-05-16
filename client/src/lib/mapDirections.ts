export function buildGoogleMapsDirectionsUrl(params: {
  latitude: number;
  longitude: number;
  label?: string;
}): string {
  const { latitude, longitude, label } = params;
  const destination = label
    ? `${encodeURIComponent(label)}@${latitude},${longitude}`
    : `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
