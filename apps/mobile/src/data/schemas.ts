// The response wrappers of the v2 endpoints 3C reads, built from the shared contracts.

import { BodyDto, ChallengeDto, GearItem, LensDto, LightTimesDto, LoadoutDto, SpotDto, WeatherDto } from '@fotoai/contracts';
import { z } from 'zod';

export const CatalogResponse = z.object({ bodies: z.array(BodyDto), lenses: z.array(LensDto) });
export const MyGearResponse = z.object({ items: z.array(GearItem) });
export const GearItemResponse = z.object({ item: GearItem });
export const LoadoutResponse = z.object({ loadout: LoadoutDto.nullable() });
export const SpotsResponse = z.object({ spots: z.array(SpotDto) });
export const ConditionsResponse = z.object({ light: LightTimesDto, weather: WeatherDto.nullable() });
export const ChallengeChangeResponse = z.object({ challenge: ChallengeDto, changed: z.boolean() });
export const ChallengeResponse = z.object({ challenge: ChallengeDto });
export const OkResponse = z.object({ success: z.literal(true) });

export type ConditionsResponse = z.infer<typeof ConditionsResponse>;
