import type { BodyDto, GearItem, LensDto } from '@fotoai/contracts';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { fakeApi, renderScreen } from '../../test/harness';
import MyGear from '../app/me/gear';
import AddGear from '../app/me/gear/add';
import CustomGear from '../app/me/gear/custom';
import Loadout from '../app/me/loadout';
import { ApiClientError } from '../lib/api';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const body = (over: Partial<BodyDto>): BodyDto => ({
  id: 'fujifilm-x-t5',
  make: 'Fujifilm',
  model: 'X-T5',
  type: 'digital',
  mount: 'fujifilm-x',
  modes: ['P', 'A', 'S', 'M'],
  shutter: { slowestSeconds: 900, fastestSeconds: 1 / 8000, bulb: true },
  flashSyncSeconds: 1 / 250,
  iso: { min: 125, max: 12800 },
  metering: 'multi',
  fixedLensId: null,
  sources: [],
  ...over,
});
const XF23: LensDto = { id: 'fujifilm-xf-23mm-f2-8', make: 'Fujifilm', model: 'XF 23mm F2.8', mount: 'fujifilm-x', focalMm: { min: 23, max: 23 }, maxAperture: { wide: 2.8, tele: 2.8 }, minAperture: 16, sources: [] };
const XT5 = body({});
const GR = body({ id: 'ricoh-gr-iiix', make: 'Ricoh', model: 'GR IIIx', mount: null, fixedLensId: 'ricoh-gr-iiix-26-1mm-f2-8' });
const FE2 = body({ id: 'nikon-fe2', make: 'Nikon', model: 'FE2', type: 'film', mount: 'nikon-f' });

const item = (id: string, cap: BodyDto | LensDto): GearItem => ({ id, kind: 'type' in cap ? 'body' : 'lens', catalogId: cap.id, name: `${cap.make} ${cap.model}`, capability: cap });
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

test('one tap adds a catalog item and marks it owned', async () => {
  let mine: GearItem[] = [];
  mockApi.current = fakeApi({
    'GET /api/v2/gear/catalog': { bodies: [XT5, GR], lenses: [XF23] },
    'GET /api/v2/me/gear': () => ({ items: mine }),
    'POST /api/v2/me/gear': (b: unknown) => {
      expect(b).toEqual({ catalogId: 'fujifilm-x-t5' });
      mine = [item(U(1), XT5)];
      return { item: mine[0] };
    },
  });
  await renderScreen(<AddGear />);
  await act(async () => await fireEvent.press(await screen.findByLabelText('Add Fujifilm X-T5')));
  expect(await screen.findByLabelText('Fujifilm X-T5 is in your gear')).toBeTruthy();
  expect(screen.getByLabelText('Add Ricoh GR IIIx')).toBeTruthy();
});

test('search filters the catalog by make or model', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/gear/catalog': { bodies: [XT5, GR], lenses: [XF23] }, 'GET /api/v2/me/gear': { items: [] } });
  await renderScreen(<AddGear />);
  await screen.findByLabelText('Add Ricoh GR IIIx');
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Search the catalog'), 'ricoh'));
  expect(screen.getByLabelText('Add Ricoh GR IIIx')).toBeTruthy();
  expect(screen.queryByLabelText('Add Fujifilm X-T5')).toBeNull();
});

test('remove asks first, then deletes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockApi.current = fakeApi({ 'GET /api/v2/me/gear': { items: [item(U(1), XT5)] }, [`DELETE /api/v2/me/gear/${U(1)}`]: { success: true } });
  await renderScreen(<MyGear />);
  await act(async () => await fireEvent.press(await screen.findByLabelText('Remove Fujifilm X-T5')));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(mockApi.current.calls.some((c) => c.method === 'DELETE')).toBe(false);
  const buttons = alert.mock.calls[0]![2]!;
  await act(async () => buttons.find((b) => b.style === 'destructive')!.onPress!());
  await waitFor(() => expect(mockApi.current!.calls.some((c) => c.method === 'DELETE')).toBe(true));
  alert.mockRestore();
});

test('My gear: empty, error and offline states', async () => {
  mockApi.current = fakeApi({ 'GET /api/v2/me/gear': { items: [] } });
  const first = await renderScreen(<MyGear />);
  expect(await screen.findByText('No gear yet')).toBeTruthy();
  await first.unmount();
  mockApi.current = fakeApi({ 'GET /api/v2/me/gear': new ApiClientError('upstream', 502, 'Could not load your gear') });
  const second = await renderScreen(<MyGear />);
  expect(await screen.findByText('Could not load your gear')).toBeTruthy();
  await second.unmount();
  mockApi.current = fakeApi({ 'GET /api/v2/me/gear': new ApiClientError('offline', 0, 'No connection') });
  await renderScreen(<MyGear />);
  expect(await screen.findByTestId('offline-banner')).toBeTruthy();
});

test('a custom lens with an impossible aperture range shows the error and sends nothing', async () => {
  mockApi.current = fakeApi({ 'POST /api/v2/me/gear': { item: item(U(2), XF23) } });
  await renderScreen(<CustomGear />);
  await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'Lens' })));
  for (const [label, value] of [['Make', 'Acme'], ['Model', '35mm'], ['Mount', 'fujifilm-x'], ['Shortest focal length (mm)', '35'], ['Longest focal length (mm)', '35'], ['Widest aperture at the short end (f/)', '2.8'], ['Widest aperture at the long end (f/)', '2.8'], ['Smallest aperture (f/)', '2']] as const) {
    await act(async () => await fireEvent.changeText(screen.getByLabelText(label), value));
  }
  await act(async () => await fireEvent.press(screen.getByText('Save gear')));
  expect(await screen.findByText('aperture range is not possible')).toBeTruthy();
  expect(mockApi.current.calls).toHaveLength(0);
});

test('a custom body with a missing field shows the error at the field', async () => {
  mockApi.current = fakeApi({});
  await renderScreen(<CustomGear />);
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Make'), 'Acme'));
  await act(async () => await fireEvent.press(screen.getByText('Save gear')));
  expect(await screen.findByText('Model is required')).toBeTruthy();
  expect(mockApi.current.calls).toHaveLength(0);
});

const loadoutRoutes = (over: Record<string, unknown> = {}) => ({
  'GET /api/v2/me/gear': { items: [item(U(1), XT5), item(U(2), GR), item(U(3), FE2), item(U(4), XF23), { id: U(5), kind: 'body', catalogId: null, name: 'Old Kodak', capability: null }] },
  'GET /api/v2/me/loadout': { loadout: null },
  ...over,
});

test('the loadout lists only bodies with capability data; a fixed-lens body hides the lens picker', async () => {
  mockApi.current = fakeApi(loadoutRoutes());
  await renderScreen(<Loadout />);
  expect(await screen.findByRole('radio', { name: 'Fujifilm X-T5' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Old Kodak' })).toBeNull();
  await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'Fujifilm X-T5' })));
  expect(screen.getByText('Lens')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'Ricoh GR IIIx' })));
  expect(screen.queryByText('Lens')).toBeNull();
});

test('a film body shows the film fields and saves them', async () => {
  mockApi.current = fakeApi(loadoutRoutes({ 'PUT /api/v2/me/loadout': (b: unknown) => ({ loadout: { body: item(U(3), FE2), lensGearId: U(4), lens: XF23, film: (b as { film: unknown }).film } }) }));
  await renderScreen(<Loadout />);
  await act(async () => await fireEvent.press(await screen.findByRole('radio', { name: 'Nikon FE2' })));
  await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'Fujifilm XF 23mm F2.8' })));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Film stock'), 'Portra 400'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Box ISO'), '400'));
  await act(async () => await fireEvent.press(screen.getByText('Save loadout')));
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PUT')?.body).toEqual({ bodyGearId: U(3), lensGearId: U(4), film: { stock: 'Portra 400', boxIso: 400 } }));
});

test("a misfit shows the server's message under the picker", async () => {
  mockApi.current = fakeApi(loadoutRoutes({ 'PUT /api/v2/me/loadout': new ApiClientError('validation', 400, 'The XF 23mm F2.8 does not fit the Nikon F mount') }));
  await renderScreen(<Loadout />);
  await act(async () => await fireEvent.press(await screen.findByRole('radio', { name: 'Nikon FE2' })));
  await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'Fujifilm XF 23mm F2.8' })));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Film stock'), 'Portra 400'));
  await act(async () => await fireEvent.changeText(screen.getByLabelText('Box ISO'), '400'));
  await act(async () => await fireEvent.press(screen.getByText('Save loadout')));
  expect(await screen.findByText('The XF 23mm F2.8 does not fit the Nikon F mount')).toBeTruthy();
});
