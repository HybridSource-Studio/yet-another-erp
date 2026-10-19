// Ids are made on the device, so records can be created offline and merged later without clashes.

/** A UUIDv7: random, but its first 48 bits are the creation time, so ids sort by age. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The creation time encoded in a UUIDv7. */
export function uuidv7Time(id: string): number {
  return parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}

const DEVICE_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** A short random id for this browser. It goes into every clock stamp written here. */
export function randomDeviceId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => DEVICE_ID_ALPHABET[b % 36]).join("");
}
