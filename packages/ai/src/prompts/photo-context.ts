// The data an Analyse prompt gets about the photographer and one of their photos. It is rendered
// into the user message only; the photo itself goes as an image part.

export interface PhotoExif {
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalMm: number | null;
  aperture: number | null;
  shutterS: number | null;
  iso: number | null;
  takenAt: string | null;
}

export interface AnalyseInput {
  skillLevel: string;
  /** The saved loadout's names, or null when none is set. */
  loadout: string | null;
  exif: PhotoExif | null;
  /** The linked plan step's title and instruction, or null. */
  brief: { title: string; instruction: string } | null;
}

/** The tone rules shared by the Analyse prompts; the level itself is in the user message. */
export const TONE_RULES = [
  'Tone by skill level:',
  '- beginner: encouraging and plain; celebrate small wins; avoid jargon or explain it.',
  '- intermediate or advanced: constructive and specific; explain technical terms briefly.',
  '- professional: direct and technical; focus on subtle refinements.',
].join('\n');

const shutter = (s: number) => (s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`);

function renderExif(exif: PhotoExif | null): string {
  if (!exif) return 'EXIF: none.';
  const parts = [
    exif.cameraMake || exif.cameraModel ? `camera ${[exif.cameraMake, exif.cameraModel].filter(Boolean).join(' ').slice(0, 160)}` : null,
    exif.lensModel ? `lens ${exif.lensModel.slice(0, 80)}` : null,
    exif.focalMm ? `${exif.focalMm}mm` : null,
    exif.aperture ? `f/${exif.aperture}` : null,
    exif.shutterS ? shutter(exif.shutterS) : null,
    exif.iso ? `ISO ${exif.iso}` : null,
    exif.takenAt ? `taken ${exif.takenAt}` : null,
  ].filter(Boolean);
  return parts.length ? `EXIF: ${parts.join(', ')}.` : 'EXIF: none.';
}

export function renderPhotoContext(input: AnalyseInput): string {
  return [
    `Skill level: ${input.skillLevel.slice(0, 40)}.`,
    `Gear: ${input.loadout ? input.loadout.slice(0, 300) : 'No loadout set'}.`,
    renderExif(input.exif),
    input.brief ? `Brief: ${input.brief.title.slice(0, 200)}. ${input.brief.instruction.slice(0, 1000)}` : 'Brief: none.',
  ].join('\n');
}
