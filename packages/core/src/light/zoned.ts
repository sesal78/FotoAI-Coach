// Time zones from coordinates, and instants written in a zone's own clock. Pure code with no
// network, so the phone can use it offline. Offsets come from Intl, so DST is applied per instant.

import tzLookup from '@photostructure/tz-lookup';

/** IANA zone for a point, such as `Australia/Melbourne`. */
export function timezoneAt(lat: number, lng: number): string {
  return tzLookup(lat, lng);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsAt(instant: Date, timeZone: string): Record<string, string> {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    });
    formatters.set(timeZone, format);
  }
  return Object.fromEntries(format.formatToParts(instant).map((p) => [p.type, p.value]));
}

/** `GMT+11:00` → `+11:00`; `GMT` (zero offset) → `+00:00`. */
const offsetText = (name: string) => (name === 'GMT' ? '+00:00' : name.replace('GMT', '').replace('−', '-'));

/** Minutes east of UTC in that zone at that instant. */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const text = offsetText(partsAt(instant, timeZone).timeZoneName ?? 'GMT');
  const sign = text.startsWith('-') ? -1 : 1;
  const [hours, minutes] = text.slice(1).split(':').map(Number);
  return sign * ((hours ?? 0) * 60 + (minutes ?? 0));
}

/** ISO 8601 in the zone's clock with its offset, to the second: `2026-10-18T19:41:10+11:00`. */
export function toZonedIso(instant: Date, timeZone: string): string {
  const p = partsAt(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetText(p.timeZoneName ?? 'GMT')}`;
}

/** The calendar date (`YYYY-MM-DD`) of an instant in that zone. */
export function localDate(instant: Date, timeZone: string): string {
  const p = partsAt(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
