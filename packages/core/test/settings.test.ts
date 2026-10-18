import { expect, test } from 'vitest';

import { clampSettings, findBody, findLens, maxApertureAt, validateSettings, type Loadout, type Settings } from '../src/index.ts';

const loadout = (bodyId: string, lensId: string | null, film?: Loadout['film']): Loadout => {
  const body = findBody(bodyId)!;
  const lens = findLens(lensId ?? body.fixedLensId!)!;
  return film ? { body, lens, film } : { body, lens };
};

const fields = (result: ReturnType<typeof validateSettings>) => (result.ok ? [] : result.issues.map((i) => i.field));

const portra400 = { stock: 'Kodak Portra 400', boxIso: 400 };

test('1/4000 is rejected on the ME Super and clamped to 1/2000', () => {
  const l = loadout('pentax-me-super', 'pentax-m-50mm-f1-7', portra400);
  const s: Settings = { mode: 'M', aperture: 2, shutterSeconds: 1 / 4000, iso: 400, focalMm: 50 };
  expect(fields(validateSettings(l, s))).toEqual(['shutterSeconds']);
  expect(clampSettings(l, s).settings.shutterSeconds).toBe(1 / 2000);
});

test('a manual shutter on the Electro 35 GL is rejected; mode M becomes A', () => {
  const l = loadout('yashica-electro-35-gl', null, portra400);
  const s: Settings = { mode: 'M', aperture: 4, shutterSeconds: 1 / 250, iso: 400, focalMm: 40 };
  const result = validateSettings(l, s);
  expect(fields(result)).toEqual(expect.arrayContaining(['mode', 'shutterSeconds']));
  const clamped = clampSettings(l, s).settings;
  expect(clamped.mode).toBe('A');
  expect(clamped.shutterSeconds).toBeUndefined();
  expect(validateSettings(l, clamped).ok).toBe(true);
});

test('f/1.4 on a 28mm f/2.8 is rejected and clamped to f/2.8', () => {
  const l = loadout('nikon-fe2', 'nikon-ai-s-28mm-f2-8', portra400);
  const s: Settings = { mode: 'A', aperture: 1.4, iso: 400, focalMm: 28 };
  expect(fields(validateSettings(l, s))).toEqual(['aperture']);
  expect(clampSettings(l, s).settings.aperture).toBe(2.8);
});

test('film ISO is locked to box speed unless the roll is pushed or pulled', () => {
  const base: Settings = { mode: 'A', aperture: 8, iso: 800, focalMm: 50 };
  expect(fields(validateSettings(loadout('nikon-fe2', 'nikon-ai-s-50mm-f1-4', portra400), base))).toEqual(['iso']);
  const pushed = loadout('nikon-fe2', 'nikon-ai-s-50mm-f1-4', { ...portra400, ratedIso: 1600 });
  expect(validateSettings(pushed, { ...base, iso: 1600 }).ok).toBe(true);
  expect(fields(validateSettings(pushed, { ...base, iso: 400 }))).toEqual(['iso']);
  expect(fields(validateSettings(loadout('nikon-fe2', 'nikon-ai-s-50mm-f1-4'), { ...base, iso: 400 }))).toEqual(['film']);
});

test('focal length outside the lens range is rejected and clamped', () => {
  const l = loadout('fujifilm-x-t5', 'sigma-18-50mm-f2-8-dc-dn-x');
  const s: Settings = { mode: 'A', aperture: 8, iso: 125, focalMm: 70 };
  expect(fields(validateSettings(l, s))).toEqual(['focalMm']);
  expect(clampSettings(l, s).settings.focalMm).toBe(50);
});

test('the 70-300 zoom allows f/4 at 70mm but not at 300mm', () => {
  const zoom = findLens('fujifilm-xf-70-300mm-f4-5-6')!;
  expect(maxApertureAt(zoom, 70)).toBe(4);
  expect(maxApertureAt(zoom, 300)).toBe(5.6);
  const l = loadout('fujifilm-x-t5', 'fujifilm-xf-70-300mm-f4-5-6');
  expect(validateSettings(l, { mode: 'A', aperture: 4, iso: 125, focalMm: 70 }).ok).toBe(true);
  expect(fields(validateSettings(l, { mode: 'A', aperture: 4, iso: 125, focalMm: 300 }))).toEqual(['aperture']);
});

test('a Nikon lens on the Pentax body is a lens issue that clamping cannot fix', () => {
  const l = loadout('pentax-me-super', 'nikon-ai-s-50mm-f1-4', portra400);
  const s: Settings = { mode: 'A', aperture: 8, iso: 400, focalMm: 50 };
  expect(fields(validateSettings(l, s))).toEqual(['lens']);
  expect(clampSettings(l, s).changes.map((c) => c.field)).toContain('lens');
});

test('bulb exposures longer than the slowest timed speed are allowed only on bulb bodies', () => {
  const fe2 = loadout('nikon-fe2', 'nikon-ai-s-28mm-f2-8', portra400);
  const long: Settings = { mode: 'M', aperture: 8, shutterSeconds: 30, iso: 400, focalMm: 28 };
  expect(validateSettings(fe2, long).ok).toBe(findBody('nikon-fe2')!.shutter.bulb);
});

test('film simulation is only for Fujifilm digital bodies', () => {
  const xt5 = loadout('fujifilm-x-t5', 'fujifilm-xf-23mm-f2-8');
  expect(validateSettings(xt5, { mode: 'A', aperture: 8, iso: 125, focalMm: 23, filmSimulation: 'Classic Chrome' }).ok).toBe(true);
  const fe2 = loadout('nikon-fe2', 'nikon-ai-s-50mm-f1-4', portra400);
  const s: Settings = { mode: 'A', aperture: 8, iso: 400, focalMm: 50, filmSimulation: 'Classic Chrome' };
  expect(fields(validateSettings(fe2, s))).toEqual(['filmSimulation']);
  expect(clampSettings(fe2, s).settings.filmSimulation).toBeUndefined();
});

test('valid settings pass unchanged', () => {
  const l = loadout('fujifilm-x-t5', 'sigma-18-50mm-f2-8-dc-dn-x');
  const s: Settings = { mode: 'A', aperture: 8, iso: 125, focalMm: 24 };
  expect(validateSettings(l, s)).toEqual({ ok: true, settings: s });
  expect(clampSettings(l, s)).toEqual({ settings: s, changes: [] });
});

test('the GR IIIx tops out at 1/2500 wider than f/5.6 and reaches 1/4000 from f/5.6', () => {
  const gr = loadout('ricoh-gr-iiix', null);
  const fast: Settings = { mode: 'S', shutterSeconds: 1 / 4000, iso: 400, focalMm: 26.1, aperture: 2.8 };
  expect(fields(validateSettings(gr, { ...fast, mode: 'M' }))).toEqual(['shutterSeconds']);
  expect(clampSettings(gr, { ...fast, mode: 'M' }).settings.shutterSeconds).toBe(1 / 2500);
  expect(validateSettings(gr, { ...fast, mode: 'M', aperture: 5.6 }).ok).toBe(true);
});

test('unknown limits are not enforced: the Electro 35 GL accepts any rated film ISO', () => {
  const gl = loadout('yashica-electro-35-gl', null, { stock: 'Ilford HP5 Plus', boxIso: 400, ratedIso: 1600 });
  expect(validateSettings(gl, { mode: 'A', aperture: 8, iso: 1600, focalMm: 40 }).ok).toBe(true);
});

test('the 70-300 is held to f/5.6 past 70mm, since its aperture steps are not recorded', () => {
  const zoom = findLens('fujifilm-xf-70-300mm-f4-5-6')!;
  expect(maxApertureAt(zoom, 200)).toBe(5.6);
  const l = loadout('fujifilm-x-t5', 'fujifilm-xf-70-300mm-f4-5-6');
  expect(fields(validateSettings(l, { mode: 'A', aperture: 5, iso: 125, focalMm: 220 }))).toEqual(['aperture']);
  expect(validateSettings(loadout('fujifilm-x-t5', 'sigma-18-50mm-f2-8-dc-dn-x'), { mode: 'A', aperture: 2.8, iso: 125, focalMm: 35 }).ok).toBe(true);
});

test('a zoom aperture with no focal length is checked at the long end', () => {
  const l = loadout('fujifilm-x-t5', 'fujifilm-xf-70-300mm-f4-5-6');
  const s: Settings = { mode: 'A', aperture: 4, iso: 125 };
  expect(fields(validateSettings(l, s))).toEqual(['aperture']);
  expect(clampSettings(l, s).settings.aperture).toBe(5.6);
});

test('mount names match without regard to case or spacing', () => {
  const fe2 = findBody('nikon-fe2')!;
  const custom = { ...findLens('nikon-ai-s-50mm-f1-4')!, id: 'custom', mount: ' nikon  f ' };
  expect(validateSettings({ body: fe2, lens: custom, film: portra400 }, { mode: 'A', aperture: 8, iso: 400, focalMm: 50 }).ok).toBe(true);
});

test('a GR IIIx shutter with no aperture is held to the leaf-shutter limit', () => {
  const gr = loadout('ricoh-gr-iiix', null);
  const s: Settings = { mode: 'M', shutterSeconds: 1 / 4000, iso: 400 };
  expect(fields(validateSettings(gr, s))).toEqual(['shutterSeconds']);
  expect(clampSettings(gr, s).settings.shutterSeconds).toBe(1 / 2500);
});
