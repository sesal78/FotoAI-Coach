import { mockFiles } from '../../../test/photo-mocks';
import { preparePhoto } from '../prepare-photo';

jest.mock('expo-image-manipulator', () => jest.requireActual('../../../test/photo-mocks').manipulatorModule);
jest.mock('expo-file-system', () => jest.requireActual('../../../test/photo-mocks').fileSystemModule);

const PHOTO = '11111111-0000-4000-8000-000000000001';
const asset = (over: Record<string, unknown> = {}) => ({ uri: 'file:///picker/IMG_1.heic', width: 6000, height: 4000, mimeType: 'image/heic', fileSize: 9_000_000, exif: { Make: 'RICOH', FNumber: 2.8 }, ...over });

beforeEach(() => mockFiles.reset());

test('a HEIC photo is sent as image/jpeg with the size of the new file', async () => {
  mockFiles.rendered = { width: 6000, height: 4000 };
  const out = await preparePhoto(asset(), PHOTO);
  expect(out).toEqual({ file: `file:///doc/uploads/${PHOTO}.jpg`, mime: 'image/jpeg', bytes: 2_345_678, exif: { cameraMake: 'RICOH', aperture: 2.8 } });
  expect(mockFiles.saved).toEqual([{ format: 'jpeg', compress: 0.9 }]);
  // The copy in the app's own folder is the one that is sent; the tool's temporary file is gone.
  expect(mockFiles.sizes.has(`file:///doc/uploads/${PHOTO}.jpg`)).toBe(true);
  expect([...mockFiles.sizes.keys()].filter((k) => k.includes('/cache/'))).toEqual([]);
});

test('a resized photo keeps its EXIF: the long side becomes 3000 px', async () => {
  mockFiles.rendered = { width: 6000, height: 4000 };
  const wide = await preparePhoto(asset(), PHOTO);
  expect(mockFiles.resized).toEqual([{ width: 3000 }]);
  expect(wide.exif).toEqual({ cameraMake: 'RICOH', aperture: 2.8 });

  mockFiles.resized = [];
  mockFiles.rendered = { width: 3000, height: 6000 };
  await preparePhoto(asset({ width: 3000, height: 6000 }), PHOTO);
  expect(mockFiles.resized).toEqual([{ height: 3000 }]);
});

test('a small photo is never made larger', async () => {
  mockFiles.rendered = { width: 1200, height: 800 };
  await preparePhoto(asset({ width: 1200, height: 800 }), PHOTO);
  expect(mockFiles.resized).toEqual([]);
  expect(mockFiles.saved).toHaveLength(1);
});

test('the media-library location goes into the EXIF fields', async () => {
  const out = await preparePhoto(asset({ exif: null }), PHOTO, { latitude: -37.81, longitude: 144.96 });
  expect(out.exif).toEqual({ lat: -37.81, lng: 144.96 });
});
