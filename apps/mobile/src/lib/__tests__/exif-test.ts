import { ExifInput } from '@fotoai/contracts';

import { exifToInput } from '../exif';

const RICOH = { Make: 'RICOH', Model: 'GR IIIx', FNumber: 2.8, ExposureTime: 0.004, ISOSpeedRatings: 200, FocalLength: 26.1, DateTimeOriginal: '2026:11:04 18:30:00', OffsetTimeOriginal: '+11:00' };

/** The phone's own offset on that local date and time, as +HH:MM. */
function phoneOffset(local: Date): string {
  const minutes = -local.getTimezoneOffset();
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

test('EXIF and the media-library location become the create fields', () => {
  const input = exifToInput(RICOH, { latitude: -37.81, longitude: 144.96 });
  expect(input).toEqual({
    cameraMake: 'RICOH',
    cameraModel: 'GR IIIx',
    aperture: 2.8,
    shutterSeconds: 0.004,
    iso: 200,
    focalMm: 26.1,
    takenAt: '2026-11-04T18:30:00+11:00',
    takenOffset: '+11:00',
    lat: -37.81,
    lng: 144.96,
  });
  expect(ExifInput.safeParse(input).success).toBe(true);
});

test('without the media-library location, the EXIF GPS tags are used with their N/S/E/W refs', () => {
  // iOS gives positive degrees and a ref; Android gives signed degrees and a ref. Both are south-east.
  expect(exifToInput({ GPSLatitude: 37.81, GPSLatitudeRef: 'S', GPSLongitude: 144.96, GPSLongitudeRef: 'E' })).toMatchObject({ lat: -37.81, lng: 144.96 });
  expect(exifToInput({ GPSLatitude: -37.81, GPSLatitudeRef: 'S', GPSLongitude: 144.96, GPSLongitudeRef: 'E' })).toMatchObject({ lat: -37.81, lng: 144.96 });
  expect(exifToInput({ GPSLatitude: 51.5, GPSLatitudeRef: 'N', GPSLongitude: 0.12, GPSLongitudeRef: 'W' })).toMatchObject({ lat: 51.5, lng: -0.12 });
  // The media-library location wins over the tags.
  expect(exifToInput({ GPSLatitude: 1, GPSLongitude: 2 }, { latitude: -37.81, longitude: 144.96 })).toMatchObject({ lat: -37.81, lng: 144.96 });
});

test('a photo with no EXIF gives an empty input', () => {
  expect(exifToInput({})).toEqual({});
  expect(exifToInput({}, null)).toEqual({});
});

test('a time with no offset uses the phone offset for that date, and sends no takenOffset', () => {
  const input = exifToInput({ DateTimeOriginal: '2026:07:01 09:15:30' });
  expect(input.takenAt).toBe(`2026-07-01T09:15:30${phoneOffset(new Date(2026, 6, 1, 9, 15, 30))}`);
  expect(input.takenOffset).toBeUndefined();
  expect(ExifInput.safeParse(input).success).toBe(true);
});

test('values the contract would refuse are left out, not sent', () => {
  const input = exifToInput({
    Make: '   ',
    Model: 'x'.repeat(81),
    FNumber: 0,
    ExposureTime: -1,
    ISOSpeedRatings: 12.5,
    FocalLength: 'abc',
    DateTimeOriginal: '0000:00:00 00:00:00',
    OffsetTimeOriginal: '11:00',
    GPSLatitude: 120,
    GPSLongitude: 10,
  });
  expect(input).toEqual({});
});

test('numbers sent as text, an ISO list and PhotographicSensitivity are read', () => {
  expect(exifToInput({ FNumber: '4', ExposureTime: '0.5', ISOSpeedRatings: [400] })).toEqual({ aperture: 4, shutterSeconds: 0.5, iso: 400 });
  expect(exifToInput({ PhotographicSensitivity: 800, LensModel: 'GR LENS 26.1mm F2.8' })).toEqual({ iso: 800, lensModel: 'GR LENS 26.1mm F2.8' });
});

test('a bad offset is dropped, and the time then uses the phone offset', () => {
  const input = exifToInput({ DateTimeOriginal: '2026:11:04 18:30:00', OffsetTimeOriginal: 'bad' });
  expect(input.takenOffset).toBeUndefined();
  expect(input.takenAt).toBe(`2026-11-04T18:30:00${phoneOffset(new Date(2026, 10, 4, 18, 30, 0))}`);
});
