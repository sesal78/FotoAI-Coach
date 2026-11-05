// Turns a picked photo's EXIF tags (as the image picker gives them) into the fields the server
// takes. The photo is made smaller and saved again before upload, which drops its EXIF, so the
// fields are read first and sent with the create call. A value the contract would refuse is left
// out, never sent: one odd camera tag must not stop the import.

import { ExifInput } from '@fotoai/contracts';

type Raw = Record<string, unknown>;
type Field = keyof ExifInput;

/** A number, or a number written as text, or the first item of a list (iOS gives ISO as [200]). */
function num(value: unknown): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

const two = (n: number) => String(n).padStart(2, '0');

/** The phone's offset (+HH:MM) at that local date and time: right for the date, summer time too. */
function phoneOffset(local: Date): string {
  const minutes = -local.getTimezoneOffset();
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
}

/** "2026:11:04 18:30:00" → the parts, or null for a missing or impossible time. */
function localTime(value: unknown): { iso: string; date: Date } | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text(value) ?? '');
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (y < 1900 || date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, date };
}

/** A GPS tag in signed degrees. Android already signs it; iOS gives a positive number and a ref. */
function coordinate(value: unknown, ref: unknown, negative: 'S' | 'W'): number | undefined {
  const n = num(value);
  if (n === undefined) return undefined;
  const r = text(ref)?.trim().toUpperCase();
  return r === negative ? -Math.abs(n) : r ? Math.abs(n) : n;
}

export function exifToInput(raw: Raw, gps?: { latitude: number; longitude: number } | null): ExifInput {
  const candidate: Partial<Record<Field, unknown>> = {
    cameraMake: text(raw.Make)?.trim(),
    cameraModel: text(raw.Model)?.trim(),
    lensModel: text(raw.LensModel)?.trim(),
    focalMm: num(raw.FocalLength),
    aperture: num(raw.FNumber),
    shutterSeconds: num(raw.ExposureTime),
    iso: num(raw.ISOSpeedRatings) ?? num(raw.PhotographicSensitivity),
  };

  const time = localTime(raw.DateTimeOriginal);
  if (time) {
    const offset = text(raw.OffsetTimeOriginal)?.trim();
    if (offset && ExifInput.shape.takenOffset.safeParse(offset).success) {
      candidate.takenOffset = offset;
      candidate.takenAt = `${time.iso}${offset}`;
    } else {
      candidate.takenAt = `${time.iso}${phoneOffset(time.date)}`;
    }
  }

  const lat = gps ? gps.latitude : coordinate(raw.GPSLatitude, raw.GPSLatitudeRef, 'S');
  const lng = gps ? gps.longitude : coordinate(raw.GPSLongitude, raw.GPSLongitudeRef, 'W');
  // A place needs both halves, each in range.
  if (ExifInput.shape.lat.safeParse(lat).success && ExifInput.shape.lng.safeParse(lng).success && lat !== undefined && lng !== undefined) {
    candidate.lat = lat;
    candidate.lng = lng;
  }

  const input: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(candidate) as Array<[Field, unknown]>) {
    if (value === undefined) continue;
    const parsed = ExifInput.shape[field].safeParse(value);
    if (parsed.success) input[field] = parsed.data;
  }
  return input as ExifInput;
}
