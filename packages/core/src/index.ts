export { CATALOG, findBody, findLens } from './gear/catalog.ts';
export {
  clampSettings,
  maxApertureAt,
  validateSettings,
  type FilmLoad,
  type Loadout,
  type SettingIssue,
  type Settings,
} from './gear/settings.ts';
export type { Body, BodyType, ExposureMode, Lens } from './gear/types.ts';
export { framesLeft, nearestShutter, pushPullStops, STANDARD_SHUTTER_SECONDS, sunny16, type Scene } from './film/exposure.ts';
