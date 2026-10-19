// Photo shapes shared by the API, web and mobile (refactor 2E-2a). The phone reads EXIF itself
// and sends the fields; every one is optional, because cameras differ (the GR IIIx may not write
// a lens or a time offset). The bytes go straight to Storage through a one-time upload link.

import { z } from 'zod';

export const PHOTO_SOURCES = ['gallery', 'scan', 'camera'] as const;

/** Image types the bucket accepts, with the file extension each is stored under. */
export const PHOTO_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/x-canon-cr2': 'cr2',
  'image/x-canon-cr3': 'cr3',
  'image/x-nikon-nef': 'nef',
  'image/x-sony-arw': 'arw',
  'image/x-adobe-dng': 'dng',
  'image/x-fuji-raf': 'raf',
  'image/x-olympus-orf': 'orf',
  'image/x-panasonic-rw2': 'rw2',
  'image/x-pentax-pef': 'pef',
  'image/x-samsung-srw': 'srw',
  'image/x-dcraw': 'raw',
} as const;
export type PhotoMime = keyof typeof PHOTO_MIME_EXTENSIONS;
const MIMES = Object.keys(PHOTO_MIME_EXTENSIONS) as [PhotoMime, ...PhotoMime[]];

export const MAX_PHOTO_BYTES = 52_428_800;

const text80 = z.string().trim().min(1).max(80);
const positive = z.number().positive();

export const ExifInput = z
  .object({
    cameraMake: text80.optional(),
    cameraModel: text80.optional(),
    lensModel: text80.optional(),
    focalMm: positive.optional(),
    aperture: positive.optional(),
    shutterSeconds: positive.optional(),
    iso: z.number().int().positive().optional(),
    takenAt: z.string().datetime({ offset: true }).optional(),
    takenOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .strict();
export type ExifInput = z.infer<typeof ExifInput>;

/** Client-sent ids are stored lowercase (Postgres prints uuids lowercase; some phones send uppercase). */
const inId = z.string().uuid().transform((s) => s.toLowerCase());

export const PhotoCreateInput = z
  .object({
    id: inId,
    source: z.enum(PHOTO_SOURCES),
    mime: z.enum(MIMES),
    bytes: z.number().int().min(1).max(MAX_PHOTO_BYTES),
    exif: ExifInput.optional(),
    stepId: inId.optional(),
    rollId: inId.optional(),
  })
  .strict();
export type PhotoCreateInput = z.infer<typeof PhotoCreateInput>;

export const PhotoDto = z.object({
  id: z.string().uuid(),
  source: z.enum(PHOTO_SOURCES),
  status: z.enum(['pending', 'ready']),
  mime: z.string(),
  bytes: z.number().int(),
  takenAt: z.string().nullable(),
  takenOffset: z.string().nullable(),
  cameraMake: z.string().nullable(),
  cameraModel: z.string().nullable(),
  lensModel: z.string().nullable(),
  focalMm: z.number().nullable(),
  aperture: z.number().nullable(),
  shutterSeconds: z.number().nullable(),
  iso: z.number().int().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  stepId: z.string().uuid().nullable(),
  frameId: z.string().uuid().nullable(),
  rollId: z.string().uuid().nullable(),
  /** The AI check on the stored bytes; null until a check has run. */
  check: z
    .object({
      safe: z.boolean(),
      matchesBrief: z.enum(['yes', 'no', 'unclear']).nullable(),
      genre: z.string().nullable(),
      checkedAt: z.string(),
    })
    .nullable(),
  createdAt: z.string(),
});
export type PhotoDto = z.infer<typeof PhotoDto>;
