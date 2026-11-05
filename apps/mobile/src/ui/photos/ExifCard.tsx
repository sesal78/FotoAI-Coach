// The camera data of a photo: camera, lens, focal length, aperture, shutter (as 1/250 s), ISO and
// the time it was taken, in the photo's own offset. "No camera data" when it has none.

import type { PhotoDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { shutterText } from '../shoot/StepCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** "Canon EOS R5", not "Canon Canon EOS R5": many cameras put the make in the model. */
export function cameraText(make: string | null, model: string | null): string | null {
  if (make && model) return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
  return model ?? make;
}

/** "4 Nov 2026, 18:30 (UTC+11:00)": the clock where the photo was taken, when its offset is known. */
export function takenText(takenAt: string | null, takenOffset: string | null): string | null {
  const ms = takenAt ? Date.parse(takenAt) : NaN;
  if (!Number.isFinite(ms)) return null;
  const m = takenOffset ? /^([+-])(\d{2}):(\d{2})$/.exec(takenOffset) : null;
  const minutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -new Date(ms).getTimezoneOffset();
  const local = new Date(ms + minutes * 60_000);
  const abs = Math.abs(minutes);
  const offset = `UTC${minutes < 0 ? '-' : '+'}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}, ${two(local.getUTCHours())}:${two(local.getUTCMinutes())} (${offset})`;
}

export function settingsLine(p: Pick<PhotoDto, 'focalMm' | 'aperture' | 'shutterSeconds' | 'iso'>): string | null {
  const parts = [
    p.focalMm ? `${p.focalMm} mm` : null,
    p.aperture ? `f/${p.aperture}` : null,
    p.shutterSeconds ? shutterText(p.shutterSeconds) : null,
    p.iso ? `ISO ${p.iso}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function ExifCard({ photo }: { photo: PhotoDto }) {
  const lines = [cameraText(photo.cameraMake, photo.cameraModel), photo.lensModel, settingsLine(photo), takenText(photo.takenAt, photo.takenOffset)].filter(
    (l): l is string => Boolean(l),
  );
  return (
    <View className="gap-1 rounded-lg bg-surface p-4">
      {lines.length ? lines.map((l, i) => <Text key={`${i}-${l}`} className={i === 0 ? 'font-semibold text-text' : 'text-text'}>{l}</Text>) : <Text className="text-text-muted">No camera data</Text>}
    </View>
  );
}
