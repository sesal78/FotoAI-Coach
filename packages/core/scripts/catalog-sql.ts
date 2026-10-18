// Prints the SQL that seeds fotoai_gear_lenses and fotoai_gear_bodies from CATALOG.
// The gear-catalog migration holds this output between its BEGIN/END CATALOG SEED markers;
// a test keeps the two identical. Usage: node scripts/catalog-sql.ts

import { fileURLToPath } from 'node:url';

import { CATALOG } from '../src/gear/catalog.ts';

const text = (v: string | null): string => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const num = (v: number | null): string => (v === null ? 'null' : String(v));
const bool = (v: boolean | null): string => (v === null ? 'null' : String(v));
const textArray = (values: readonly string[]): string => `array[${values.map(text).join(', ')}]::text[]`;

export function catalogSql(): string {
  const lensRows = CATALOG.lenses.map((l) =>
    [
      text(l.id), text(l.make), text(l.model), text(l.mount),
      num(l.focalMm.min), num(l.focalMm.max), num(l.maxAperture.wide), num(l.maxAperture.tele), num(l.minAperture),
      textArray(l.sources),
    ].join(', '),
  );
  const bodyRows = CATALOG.bodies.map((b) =>
    [
      text(b.id), text(b.make), text(b.model), text(b.type), text(b.mount), textArray(b.modes),
      num(b.shutter.slowestSeconds), num(b.shutter.fastestSeconds), bool(b.shutter.bulb),
      b.shutter.apertureLimits ? `'${JSON.stringify(b.shutter.apertureLimits)}'::jsonb` : 'null',
      num(b.flashSyncSeconds), num(b.iso?.min ?? null), num(b.iso?.max ?? null), text(b.metering), text(b.fixedLensId),
      textArray(b.sources),
    ].join(', '),
  );
  return [
    'insert into public.fotoai_gear_lenses',
    '  (id, make, model, mount, focal_min_mm, focal_max_mm, max_aperture_wide, max_aperture_tele, min_aperture, sources)',
    'values',
    lensRows.map((r) => `  (${r})`).join(',\n') + ';',
    '',
    'insert into public.fotoai_gear_bodies',
    '  (id, make, model, type, mount, modes, shutter_slowest_s, shutter_fastest_s, bulb, shutter_aperture_limits,',
    '   flash_sync_s, iso_min, iso_max, metering, fixed_lens_id, sources)',
    'values',
    bodyRows.map((r) => `  (${r})`).join(',\n') + ';',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(catalogSql() + '\n');
}
