import { expect, test } from 'vitest';

import { FILM_STOCKS, findStock } from '../src/index.ts';

test('every stock has a source and a unique slug id', () => {
  const ids = FILM_STOCKS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const stock of FILM_STOCKS) {
    expect(stock.id, stock.id).toMatch(/^[a-z0-9-]+$/);
    expect(stock.sources.length, stock.id).toBeGreaterThan(0);
    for (const url of stock.sources) expect(url, stock.id).toMatch(/^https:\/\//);
    expect(stock.names.length, stock.id).toBeGreaterThan(0);
    expect(stock.formats.length, stock.id).toBeGreaterThan(0);
    expect(stock.boxIso, stock.id).toBeGreaterThan(0);
  }
});

test('Portra 400 is ISO 400 and also named Ektacolor Pro 400', () => {
  const portra = findStock('kodak-portra-400')!;
  expect(portra).toMatchObject({ boxIso: 400, process: 'C-41' });
  expect(portra.names).toEqual(expect.arrayContaining(['Kodak Portra 400', 'Kodak Ektacolor Pro 400']));
});

test('Tri-X 400 is a B&W ISO 400 stock in 135-36 and 120', () => {
  expect(findStock('kodak-tri-x-400')).toMatchObject({ boxIso: 400, process: 'B&W', formats: expect.arrayContaining(['135-36', '120']) });
});

test('Delta 3200 is box ISO 1000, rated 3200', () => {
  expect(findStock('ilford-delta-3200')).toMatchObject({ boxIso: 1000, ratedIso: 3200, process: 'B&W' });
});

test('stocks that could not be sourced are left out', () => {
  expect(findStock('kodak-colorplus-200')).toBeUndefined();
  expect(findStock('harman-phoenix-200')).toBeUndefined();
});
