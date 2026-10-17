// Weather comes from Open-Meteo (no API key). These tests stub fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getWeather } from '../../lib/weather.ts';

type Call = string;

function stubFetch(geo: unknown, forecast: unknown, calls: Call[] = []) {
  return async (url: string) => {
    calls.push(url);
    if (url.startsWith('https://geocoding-api.open-meteo.com/')) return new Response(JSON.stringify(geo));
    if (url.startsWith('https://api.open-meteo.com/')) return new Response(JSON.stringify(forecast));
    return new Response('not found', { status: 404 });
  };
}

const MELBOURNE_AU = { name: 'Melbourne', latitude: -37.814, longitude: 144.96332, country: 'Australia', country_code: 'AU', admin1: 'Victoria' };
const MELBOURNE_US = { name: 'Melbourne', latitude: 28.0836, longitude: -80.6081, country: 'United States', country_code: 'US', admin1: 'Florida' };
const FORECAST = {
  current: {
    temperature_2m: 64.4, apparent_temperature: 61.9, relative_humidity_2m: 71, wind_speed_10m: 9.6,
    cloud_cover: 62, weather_code: 3, visibility: 24140,
  },
  daily: { sunrise: [1760643600], sunset: [1760691000] },
};

test('weather: geocodes "City, Country" to the matching country and maps the forecast', async () => {
  const calls: Call[] = [];
  const w = await getWeather('Melbourne, Australia', stubFetch({ results: [MELBOURNE_US, MELBOURNE_AU] }, FORECAST, calls));
  assert.ok(w);
  assert.ok(calls[0].includes('name=Melbourne'), 'only the place name goes to the geocoder');
  assert.ok(calls[1].includes('latitude=-37.814') && calls[1].includes('longitude=144.96332'), 'the Australian Melbourne was chosen');
  assert.ok(calls.every((u) => !/appid=|api_key|apikey/i.test(u)), 'no API key is sent');
  assert.equal(w!.condition, 'Clouds');
  assert.equal(w!.temperature, 64);
  assert.equal(w!.feelsLike, 62);
  assert.equal(w!.humidity, 71);
  assert.equal(w!.windSpeed, 10);
  assert.equal(w!.clouds, 62);
  assert.equal(w!.visibility, 24140);
  assert.equal(w!.sunrise, 1760643600);
  assert.equal(w!.sunset, 1760691000);
  assert.equal(w!.description, 'overcast');
});

test('weather: WMO codes map to the condition names the photo analysis expects', async () => {
  const cases: Array<[number, string]> = [[0, 'Clear'], [45, 'Fog'], [53, 'Drizzle'], [63, 'Rain'], [81, 'Rain'], [73, 'Snow'], [95, 'Thunderstorm']];
  for (const [code, condition] of cases) {
    const forecast = { ...FORECAST, current: { ...FORECAST.current, weather_code: code } };
    const w = await getWeather('Melbourne', stubFetch({ results: [MELBOURNE_AU] }, forecast));
    assert.equal(w!.condition, condition, `code ${code}`);
  }
});

test('weather: unknown place or a failing service returns null (callers carry on without weather)', async () => {
  assert.equal(await getWeather('Nowhere-ville', stubFetch({ results: [] }, FORECAST)), null);
  assert.equal(await getWeather('Melbourne', async () => new Response('down', { status: 503 })), null);
  assert.equal(await getWeather('   ', stubFetch({ results: [MELBOURNE_AU] }, FORECAST)), null);
});
