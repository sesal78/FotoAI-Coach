import { distanceM, distanceText } from '../distance';

test('known pairs match to within 1%', () => {
  const melbourne = { lat: -37.8136, lng: 144.9631 };
  const sydney = { lat: -33.8688, lng: 151.2093 };
  expect(Math.abs(distanceM(melbourne, sydney) - 713_400) / 713_400).toBeLessThan(0.01);
  expect(Math.abs(distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111_195) / 111_195).toBeLessThan(0.01);
  expect(distanceM(melbourne, melbourne)).toBe(0);
});

test('distances read as metres up to 1 km, then km', () => {
  expect(distanceText(340.4)).toBe('340 m');
  expect(distanceText(1234)).toBe('1.2 km');
  expect(distanceText(25_600)).toBe('26 km');
});
