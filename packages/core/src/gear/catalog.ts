// Seun's cameras and lenses with sourced capability data (researched 18 Oct 2026).
// The single source of truth: the seed migration is generated from this file, and tests keep
// the two (and the live database) identical. Unsourced values are null, never guessed.
// Weakest values (re-check against the scanned manuals when possible): every Electro 35 GL
// value; Pentax-M lens minimum apertures; FE2 and ME Super figures (secondary sources).

import type { Body, Lens } from './types.ts';

const lenses: Lens[] = [
  {
    id: 'fujifilm-xf-23mm-f2-8',
    make: 'Fujifilm',
    model: 'XF 23mm F2.8 R WR',
    mount: 'Fujifilm X',
    focalMm: { min: 23, max: 23 },
    maxAperture: { wide: 2.8, tele: 2.8 },
    minAperture: 16,
    sources: ['https://www.fujifilm-x.com/zh-cn/products/lenses/xf23mmf28-r-wr/specifications/'],
  },
  {
    id: 'fujifilm-xf-70-300mm-f4-5-6',
    make: 'Fujifilm',
    model: 'XF 70-300mm F4-5.6 R LM OIS WR',
    mount: 'Fujifilm X',
    focalMm: { min: 70, max: 300 },
    maxAperture: { wide: 4, tele: 5.6 },
    minAperture: 22,
    sources: ['https://www.fujifilm-x.com/en-us/products/lenses/xf70-300mmf4-5.6-r-lm-ois-wr/specifications/'],
  },
  {
    id: 'sigma-18-50mm-f2-8-dc-dn-x',
    make: 'Sigma',
    model: '18-50mm F2.8 DC DN Contemporary (Fujifilm X)',
    mount: 'Fujifilm X',
    focalMm: { min: 18, max: 50 },
    maxAperture: { wide: 2.8, tele: 2.8 },
    minAperture: 22,
    sources: ['https://www.sigma-global.com/en/lenses/c021_18_50_28/specification.html'],
  },
  {
    id: 'nikon-ai-s-28mm-f2-8',
    make: 'Nikon',
    model: 'AI-S Nikkor 28mm f/2.8',
    mount: 'Nikon F',
    focalMm: { min: 28, max: 28 },
    maxAperture: { wide: 2.8, tele: 2.8 },
    minAperture: 22,
    sources: [
      'https://imaging-resource.com/lenses/nikon/28mm-f2.8-ais-nikkor/specifications',
      'https://kenrockwell.com/nikon/28f28ais.htm',
    ],
  },
  {
    id: 'nikon-ai-s-50mm-f1-4',
    make: 'Nikon',
    model: 'AI-S Nikkor 50mm f/1.4',
    mount: 'Nikon F',
    focalMm: { min: 50, max: 50 },
    maxAperture: { wide: 1.4, tele: 1.4 },
    minAperture: 16,
    sources: ['https://imaging-resource.com/lenses/nikon/50mm-f1.4-ais-nikkor/specifications'],
  },
  {
    id: 'pentax-m-28mm-f2-8',
    make: 'Pentax',
    model: 'SMC Pentax-M 28mm f/2.8',
    mount: 'Pentax K',
    focalMm: { min: 28, max: 28 },
    maxAperture: { wide: 2.8, tele: 2.8 },
    minAperture: 22,
    sources: ['https://cinelenswiki.com/lens:pen-msmc28mmf2.8ver1'],
  },
  {
    id: 'pentax-m-50mm-f1-7',
    make: 'Pentax',
    model: 'SMC Pentax-M 50mm f/1.7',
    mount: 'Pentax K',
    focalMm: { min: 50, max: 50 },
    maxAperture: { wide: 1.7, tele: 1.7 },
    minAperture: 22,
    sources: [
      'https://cinelenswiki.com/lens:pen-msmc50mmf1.7',
      'https://kenrockwell.com/pentax/35mm/lenses/50mm-f17-smc-m.htm',
    ],
  },
  {
    id: 'ricoh-gr-iiix-26-1mm-f2-8',
    make: 'Ricoh',
    model: 'GR IIIx built-in 26.1mm f/2.8',
    mount: null,
    focalMm: { min: 26.1, max: 26.1 },
    maxAperture: { wide: 2.8, tele: 2.8 },
    minAperture: 16,
    sources: ['https://us.ricoh-imaging.com/product/gr-iiix/'],
  },
  {
    // f/16 is stated for the Electro 35 family and the GX (same 40mm lens), not the GL itself.
    id: 'yashica-electro-35-gl-40mm-f1-7',
    make: 'Yashica',
    model: 'Electro 35 GL built-in Color-Yashinon DX 40mm f/1.7',
    mount: null,
    focalMm: { min: 40, max: 40 },
    maxAperture: { wide: 1.7, tele: 1.7 },
    minAperture: 16,
    sources: [
      'https://camera-wiki.org/wiki/Yashica_Electro_35',
      'https://photoethnography.com/ClassicCameras/YashicaElectro35GX.html',
    ],
  },
];

const bodies: Body[] = [
  {
    // Mechanical shutter. Slowest 900 s applies in S/M (P/A stop at 30 s, where the camera picks the speed).
    id: 'fujifilm-x-t5',
    make: 'Fujifilm',
    model: 'X-T5',
    type: 'digital',
    mount: 'Fujifilm X',
    modes: ['P', 'A', 'S', 'M'],
    shutter: { slowestSeconds: 900, fastestSeconds: 1 / 8000, bulb: true },
    flashSyncSeconds: 1 / 250,
    iso: { min: 125, max: 12800 },
    metering: 'multi (256-zone), spot, average, centre-weighted',
    fixedLensId: null,
    sources: ['https://www.fujifilm-x.com/en-us/products/cameras/x-t5/specifications/'],
  },
  {
    // Leaf shutter: 1/4000 only at f/5.6 or smaller; 1/2500 at wider apertures. Flash sync not published.
    id: 'ricoh-gr-iiix',
    make: 'Ricoh',
    model: 'GR IIIx',
    type: 'digital',
    mount: null,
    modes: ['P', 'A', 'S', 'M'],
    shutter: { slowestSeconds: 30, fastestSeconds: 1 / 4000, bulb: true, apertureLimits: [{ belowAperture: 5.6, fastestSeconds: 1 / 2500 }] },
    flashSyncSeconds: null,
    iso: { min: 100, max: 102400 },
    metering: 'multi-segment, centre-weighted, spot, highlight-weighted',
    fixedLensId: 'ricoh-gr-iiix-26-1mm-f2-8',
    sources: [
      'https://us.ricoh-imaging.com/product/gr-iiix/',
      'https://www.imaging-resource.com/PRODS/ricoh-gr-iiix/ricoh-gr-iiixDAT.HTM',
    ],
  },
  {
    id: 'nikon-fe2',
    make: 'Nikon',
    model: 'FE2',
    type: 'film',
    mount: 'Nikon F',
    modes: ['A', 'M'],
    shutter: { slowestSeconds: 8, fastestSeconds: 1 / 4000, bulb: true },
    flashSyncSeconds: 1 / 250,
    iso: { min: 12, max: 4000 },
    metering: 'centre-weighted (60/40)',
    fixedLensId: null,
    sources: [
      'https://en.wikipedia.org/wiki/Nikon_FE2',
      'https://www.eecs.yorku.ca/~oz/nikon/bodylens/FE-2.htm',
      'https://butkus.org/chinon/nikon/nikon_fe2/nikon_fe2.htm',
    ],
  },
  {
    id: 'pentax-me-super',
    make: 'Pentax',
    model: 'ME Super',
    type: 'film',
    mount: 'Pentax K',
    modes: ['A', 'M'],
    shutter: { slowestSeconds: 4, fastestSeconds: 1 / 2000, bulb: true },
    flashSyncSeconds: 1 / 125,
    iso: { min: 12, max: 1600 },
    metering: 'centre-weighted, open aperture',
    fixedLensId: null,
    sources: [
      'https://en.wikipedia.org/wiki/Pentax_ME_Super',
      'https://vintagecameradigest.com/pentax-me-super/',
    ],
  },
  {
    // Sources disagree on the slowest speed (8 s vs about 30 s) and the ASA dial (to 800/1000/1600),
    // and are silent on bulb and flash sync, so those stay null. 1/500 fastest is consistent.
    id: 'yashica-electro-35-gl',
    make: 'Yashica',
    model: 'Electro 35 GL',
    type: 'film',
    mount: null,
    modes: ['A'],
    shutter: { slowestSeconds: null, fastestSeconds: 1 / 500, bulb: null },
    flashSyncSeconds: null,
    iso: null,
    metering: null,
    fixedLensId: 'yashica-electro-35-gl-40mm-f1-7',
    sources: [
      'https://skrasnov.com/yashica-electro-35-gl/',
      'https://camera-wiki.org/wiki/Yashica_Electro_35',
    ],
  },
];

export const CATALOG: { bodies: readonly Body[]; lenses: readonly Lens[] } = { bodies, lenses };

export function findBody(id: string): Body | undefined {
  return bodies.find((body) => body.id === id);
}

export function findLens(id: string): Lens | undefined {
  return lenses.find((lens) => lens.id === id);
}
