import { coachContext } from '../coach-context';

const PLAN = '22222222-aaaa-4bbb-8ccc-000000000001';
const ROLL = '33333333-aaaa-4bbb-8ccc-000000000001';
const SPOT = '66666666-aaaa-4bbb-8ccc-000000000001';
const PLACE = 'ChIJ3S-JXmauEmsRUcIaWtf4MzE';

test('the context names the screen and the open plan', () => {
  expect(coachContext('/today', {})).toEqual({ screen: 'today' });
  expect(coachContext('/challenge/abc', { id: 'abc' })).toEqual({ screen: 'today' });
  expect(coachContext(`/plan/${PLAN}`, { id: PLAN })).toEqual({ screen: 'shoot', planId: PLAN });
  expect(coachContext(`/roll/${ROLL}`, { id: ROLL })).toEqual({ screen: 'shoot', rollId: ROLL });
  expect(coachContext(`/roll/scans/${ROLL}`, { id: ROLL })).toEqual({ screen: 'shoot', rollId: ROLL });
  expect(coachContext('/photos', {})).toEqual({ screen: 'photos' });
  expect(coachContext('/photo/x', { id: 'x' })).toEqual({ screen: 'photos' });
  expect(coachContext('/me', {})).toEqual({ screen: 'me' });
  expect(coachContext('/me/gear', {})).toEqual({ screen: 'me' });
});

test('on the Shoot tab the context has the roll in the camera', () => {
  expect(coachContext('/shoot', {}, ROLL)).toEqual({ screen: 'shoot', rollId: ROLL });
  expect(coachContext('/shoot', {})).toEqual({ screen: 'shoot' });
  // Only the Shoot tab: a plan screen names its plan, not the roll.
  expect(coachContext(`/plan/${PLAN}`, { id: PLAN }, ROLL)).toEqual({ screen: 'shoot', planId: PLAN });
});

test('on a place screen the context has its placeId', () => {
  expect(coachContext(`/place/${PLACE}`, { placeId: PLACE })).toEqual({ screen: 'explore', placeId: PLACE });
  expect(coachContext(`/spot/${SPOT}`, { id: SPOT })).toEqual({ screen: 'explore', spotId: SPOT });
  expect(coachContext('/explore', {})).toEqual({ screen: 'explore' });
});

test('an id the server would refuse is left out', () => {
  expect(coachContext('/plan/not-a-uuid', { id: 'not-a-uuid' })).toEqual({ screen: 'shoot' });
  expect(coachContext('/place/bad id!', { placeId: 'bad id!' })).toEqual({ screen: 'explore' });
  expect(coachContext('/somewhere', {})).toEqual({ screen: 'today' });
});
