import { expect, test } from 'vitest';

import { CATALOG, findBody, findLens } from '../src/index.ts';

const all = [...CATALOG.bodies, ...CATALOG.lenses];

test('every catalog item has at least one https source', () => {
  for (const item of all) {
    expect(item.sources.length, item.id).toBeGreaterThan(0);
    for (const url of item.sources) expect(url, item.id).toMatch(/^https:\/\//);
  }
});

test('ids are unique slugs', () => {
  const ids = all.map((item) => item.id);
  for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  expect(new Set(ids).size).toBe(ids.length);
});

test('the facts the spec pins hold', () => {
  expect(findBody('nikon-fe2')!.shutter.fastestSeconds).toBe(1 / 4000);
  expect(findBody('pentax-me-super')!.shutter.fastestSeconds).toBe(1 / 2000);
  const gl = findBody('yashica-electro-35-gl')!;
  expect(gl.modes).toEqual(['A']);
  expect(findLens(gl.fixedLensId!)).toMatchObject({ focalMm: { min: 40, max: 40 }, maxAperture: { wide: 1.7, tele: 1.7 } });
  expect(findLens('nikon-ai-s-28mm-f2-8')!.maxAperture.wide).toBe(2.8);
});

test("Seun's lens and body pairs share a mount; fixed-lens bodies point at a lens with no mount", () => {
  const pairs: Array<[string, string[]]> = [
    ['fujifilm-x-t5', ['fujifilm-xf-23mm-f2-8', 'fujifilm-xf-70-300mm-f4-5-6', 'sigma-18-50mm-f2-8-dc-dn-x']],
    ['nikon-fe2', ['nikon-ai-s-28mm-f2-8', 'nikon-ai-s-50mm-f1-4']],
    ['pentax-me-super', ['pentax-m-28mm-f2-8', 'pentax-m-50mm-f1-7']],
  ];
  for (const [bodyId, lensIds] of pairs) {
    const body = findBody(bodyId)!;
    expect(body.mount, bodyId).not.toBeNull();
    expect(body.fixedLensId, bodyId).toBeNull();
    for (const lensId of lensIds) expect(findLens(lensId)!.mount, lensId).toBe(body.mount);
  }
  for (const bodyId of ['ricoh-gr-iiix', 'yashica-electro-35-gl']) {
    const body = findBody(bodyId)!;
    expect(body.mount, bodyId).toBeNull();
    expect(findLens(body.fixedLensId!)!.mount, bodyId).toBeNull();
  }
});

test('ranges are well-formed', () => {
  for (const body of CATALOG.bodies) {
    if (body.shutter.slowestSeconds !== null) expect(body.shutter.slowestSeconds, body.id).toBeGreaterThan(body.shutter.fastestSeconds);
    if (body.iso) expect(body.iso.min, body.id).toBeLessThanOrEqual(body.iso.max);
    for (const limit of body.shutter.apertureLimits ?? []) expect(limit.fastestSeconds, body.id).toBeGreaterThan(body.shutter.fastestSeconds);
    expect(body.modes.length, body.id).toBeGreaterThan(0);
  }
  for (const lens of CATALOG.lenses) {
    expect(lens.focalMm.min, lens.id).toBeLessThanOrEqual(lens.focalMm.max);
    expect(lens.maxAperture.wide, lens.id).toBeLessThanOrEqual(lens.maxAperture.tele);
    expect(lens.minAperture, lens.id).toBeGreaterThan(lens.maxAperture.tele);
  }
});

test('unsourced values are null, never guessed: the Electro 35 GL shutter floor and ISO dial', () => {
  const gl = findBody('yashica-electro-35-gl')!;
  expect(gl.shutter.slowestSeconds).toBeNull();
  expect(gl.iso).toBeNull();
  expect(gl.shutter.fastestSeconds).toBe(1 / 500);
});

test('the GR IIIx leaf shutter is limited to 1/2500 wider than f/5.6', () => {
  expect(findBody('ricoh-gr-iiix')!.shutter.apertureLimits).toEqual([{ belowAperture: 5.6, fastestSeconds: 1 / 2500 }]);
});

test('the catalog has 5 bodies and 9 lenses', () => {
  expect(CATALOG.bodies).toHaveLength(5);
  expect(CATALOG.lenses).toHaveLength(9);
});
