// Film stocks the app knows, each value from the maker's page or datasheet (checked 19 Oct 2026;
// research folder phase2e2-sources-2026-10-19.md). A stock whose values could not be sourced well
// enough is left out (Kodak ColorPlus 200, Harman Phoenix). Every colour negative film here is C-41
// by definition. A roll of an unknown stock is still possible: the user types its name and ISO.

export type FilmProcess = 'C-41' | 'B&W' | 'E-6';
export type FilmFormat = '135-24' | '135-36' | '120';

export interface FilmStock {
  id: string;
  make: string;
  /** First name is the one shown; later names are other names the same film is sold under. */
  names: string[];
  boxIso: number;
  /** The speed it is usually shot at, when that differs from the box (Delta 3200). */
  ratedIso?: number;
  process: FilmProcess;
  formats: FilmFormat[];
  sources: string[];
}

const KODAK = 'https://www.kodak.com/en/still-film/product';
const ALARIS_COLOR = 'https://kodakprofessional.com/photographers/film/color';
const ALARIS_BW = 'https://kodakprofessional.com/photographers/film/black-white';
const PORTRA_RENAME = 'https://petapixel.com/2026/03/24/kodaks-ektacolor-pro-film-is-the-new-name-of-the-beloved-portra';
const ILFORD = 'https://www.ilfordphoto.com';

const portra = (iso: 160 | 400 | 800): FilmStock => ({
  id: `kodak-portra-${iso}`,
  make: 'Kodak',
  names: [`Kodak Portra ${iso}`, `Kodak Ektacolor Pro ${iso}`],
  boxIso: iso,
  process: 'C-41',
  formats: ['135-36', '120'],
  sources: [ALARIS_COLOR, `${KODAK}/professional/ektacolor/ektacolor-pro-${iso}-film/`, PORTRA_RENAME],
});

const tmax = (iso: 100 | 400): FilmStock => ({
  id: `kodak-t-max-${iso}`,
  make: 'Kodak',
  names: [`Kodak T-MAX ${iso}`, `Kodak Ektapan ${iso}`],
  boxIso: iso,
  process: 'B&W',
  formats: ['135-24', '135-36', '120'],
  sources: [ALARIS_BW, `${KODAK}/professional/ektapan/ektapan-${iso}-film/`],
});

const ilford = (id: string, name: string, iso: number, page: string, formats: FilmFormat[] = ['135-24', '135-36', '120']): FilmStock => ({
  id: `ilford-${id}`,
  make: 'Ilford',
  names: [`Ilford ${name}`],
  boxIso: iso,
  process: 'B&W',
  formats,
  sources: [`${ILFORD}/${page}`],
});

export const FILM_STOCKS: readonly FilmStock[] = [
  portra(160),
  portra(400),
  portra(800),
  { id: 'kodak-ektar-100', make: 'Kodak', names: ['Kodak Ektar 100'], boxIso: 100, process: 'C-41', formats: ['135-36', '120'], sources: [`${KODAK}/professional/ektar-100-film/`] },
  { id: 'kodak-gold-200', make: 'Kodak', names: ['Kodak Gold 200'], boxIso: 200, process: 'C-41', formats: ['135-24', '135-36', '120'], sources: [`${KODAK}/consumer/gold-200-film/`] },
  { id: 'kodak-ultramax-400', make: 'Kodak', names: ['Kodak UltraMax 400'], boxIso: 400, process: 'C-41', formats: ['135-24', '135-36'], sources: [`${KODAK}/consumer/ultramax-400-film/`] },
  { id: 'kodak-tri-x-400', make: 'Kodak', names: ['Kodak Tri-X 400'], boxIso: 400, process: 'B&W', formats: ['135-24', '135-36', '120'], sources: [`${KODAK}/professional/tri-x-400-film/`] },
  tmax(100),
  tmax(400),
  ilford('hp5-plus', 'HP5 Plus', 400, 'hp5-plus-35mm'),
  ilford('fp4-plus', 'FP4 Plus', 125, 'fp4-plus-35mm'),
  ilford('delta-100', 'Delta 100', 100, 'delta-100-professional-35mm'),
  ilford('delta-400', 'Delta 400', 400, 'delta-400-professional-35mm'),
  { ...ilford('delta-3200', 'Delta 3200', 1000, 'delta-3200-professional-35mm', ['135-36', '120']), ratedIso: 3200 },
  { ...ilford('xp2-super', 'XP2 Super', 400, 'xp2-super-35mm'), process: 'C-41' },
  { id: 'fujifilm-200', make: 'Fujifilm', names: ['Fujifilm 200'], boxIso: 200, process: 'C-41', formats: ['135-36'], sources: ['https://www.fujifilm.com/us/en/consumer/films/consumer-film/fujifilm-200/specifications'] },
  { id: 'fujifilm-400', make: 'Fujifilm', names: ['Fujifilm 400'], boxIso: 400, process: 'C-41', formats: ['135-36'], sources: ['https://www.fujifilm.com/us/en/consumer/films/consumer-film/fujifilm-400/specifications'] },
  { id: 'cinestill-800t', make: 'CineStill', names: ['CineStill 800T'], boxIso: 800, process: 'C-41', formats: ['135-36', '120'], sources: ['https://cinestillfilm.com/collections/film/products/800tungsten-c41-36exp-35mm-high-speed-color-negative-135'] },
  { id: 'cinestill-400d', make: 'CineStill', names: ['CineStill 400D'], boxIso: 400, process: 'C-41', formats: ['135-36', '120'], sources: ['https://cinestillfilm.com/products/400dynamic-35mm'] },
  { id: 'lomography-cn-400', make: 'Lomography', names: ['Lomography Color Negative 400'], boxIso: 400, process: 'C-41', formats: ['135-36', '120'], sources: ['https://shop.lomography.com/us/connoisseurs/lomography-color-negative-35-mm-iso-400'] },
];

const BY_ID = new Map(FILM_STOCKS.map((s) => [s.id, s]));

export function findStock(id: string): FilmStock | undefined {
  return BY_ID.get(id);
}
