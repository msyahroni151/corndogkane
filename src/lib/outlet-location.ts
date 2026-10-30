export function readOutletLocation(latitude: string, longitude: string, address: string) {
  const lat = latitude.trim().replace(",", "."),
    lng = longitude.trim().replace(",", ".");
  if (address.trim().length > 500) throw new Error("Alamat outlet maksimal 500 karakter.");
  if (!lat && !lng) return { latitude: null, longitude: null, address: address.trim() || null };
  if (!lat || !lng)
    throw new Error("Isi latitude dan longitude secara berpasangan, atau kosongkan keduanya.");
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (
    !decimal.test(lat) ||
    !decimal.test(lng) ||
    !Number.isFinite(Number(lat)) ||
    !Number.isFinite(Number(lng))
  )
    throw new Error("Koordinat harus berupa angka desimal yang valid.");
  if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180)
    throw new Error("Latitude harus -90 sampai 90 dan longitude -180 sampai 180.");
  return { latitude: Number(lat), longitude: Number(lng), address: address.trim() || null };
}
