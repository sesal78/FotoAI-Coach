// Log one frame on the roll: its number (after the highest one logged, or typed), the exposure
// (from the plan's step, typed, or from Sunny 16), a note, and where it was taken when location is
// already allowed. The camera, its lens and the roll's film decide what is possible: the form starts
// from settings the camera can do, the ISO is the roll's, and a frame is checked on the phone the
// way the server checks it, so a logged frame is never refused later. Works with no signal.

import type { BodyDto, FrameDto, FrameInput, LensDto, RollDto, SettingsDto } from '@fotoai/contracts';
import { clampSettings, validateSettings, type Body, type Lens, type Loadout, type Settings } from '@fotoai/core';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { phoneLocation } from '../../lib/where';
import { Field, Notice, PrimaryButton } from '../form';
import { errorText } from '../states';
import { Chip } from './Chip';
import { Sunny16 } from './Sunny16';

/** The server takes up to 2 frames past the roll's length (a roll often gives a frame or two more). */
export const SPARE_FRAMES = 2;

export interface FrameDefaults {
  stepId?: string;
  mode?: SettingsDto['mode'];
  aperture?: number;
  shutterSeconds?: number;
}

/** The roll's camera: its capability, the lens on it, and the lens's gear id (none for a built-in lens). */
export interface FrameGear {
  body: BodyDto;
  lens: LensDto;
  lensGearId: string | null;
}

export const shutterField = (seconds: number) => (seconds < 1 ? `1/${Math.round(1 / seconds)}` : String(seconds));

/** "1/250" → 0.004; "2" → 2; anything else → undefined. */
export function parseShutter(text: string): number | undefined {
  const t = text.trim().replace(/\s*s$/, '');
  const fraction = /^1\/(\d+(?:\.\d+)?)$/.exec(t);
  const value = fraction ? 1 / Number(fraction[1]) : Number(t);
  return t && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** The next frame: after the highest number logged (a typed number can skip ahead). */
export const nextFrameNo = (roll: Pick<RollDto, 'framesLogged'>, frames: Pick<FrameDto, 'frameNo'>[]) =>
  frames.length > 0 ? Math.max(...frames.map((f) => f.frameNo)) + 1 : roll.framesLogged + 1;

const positive = (text: string) => (text.trim() && Number(text) > 0 ? Number(text) : undefined);

export function FrameLogger({
  roll,
  frames,
  gear,
  defaults,
  onSave,
}: {
  roll: RollDto;
  frames: FrameDto[];
  gear: FrameGear;
  defaults: FrameDefaults;
  onSave: (frame: Omit<FrameInput, 'id' | 'shotAt'>) => Promise<unknown>;
}) {
  const loadout: Loadout = useMemo(
    () => ({ body: gear.body as Body, lens: gear.lens as Lens, film: { stock: roll.stockName, boxIso: roll.boxIso, ratedIso: roll.ratedIso } }),
    [gear, roll.stockName, roll.boxIso, roll.ratedIso],
  );
  // Start from what the camera can really do: the step's mode, aperture and shutter, fitted.
  const start = useMemo(
    () =>
      clampSettings(loadout, {
        mode: defaults.mode ?? gear.body.modes[0]!,
        ...(defaults.aperture ? { aperture: defaults.aperture } : {}),
        ...(defaults.shutterSeconds ? { shutterSeconds: defaults.shutterSeconds } : {}),
        iso: roll.ratedIso,
      }).settings,
    [loadout, defaults, gear.body.modes, roll.ratedIso],
  );
  const [mode, setMode] = useState<Settings['mode']>(start.mode);
  const [frameNo, setFrameNo] = useState('');
  const [aperture, setAperture] = useState(start.aperture ? String(start.aperture) : '');
  const [shutter, setShutter] = useState(start.shutterSeconds ? shutterField(start.shutterSeconds) : '');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = nextFrameNo(roll, frames);
  // The shutter field shows only when the camera lets you set it in this mode.
  const canSetShutter = clampSettings(loadout, { mode, shutterSeconds: 1 / 125, iso: roll.ratedIso }).settings.shutterSeconds !== undefined;
  const canSetAperture = clampSettings(loadout, { mode, aperture: 8, iso: roll.ratedIso }).settings.aperture !== undefined;

  const save = async () => {
    const number = frameNo.trim() ? Number(frameNo) : next;
    if (!Number.isInteger(number) || number < 1) return setProblem('The frame number is a whole number from 1.');
    if (number > roll.exposures + SPARE_FRAMES) return setProblem(`Frame ${number} is past the end of this ${roll.exposures}-exposure roll.`);
    if (frames.some((f) => f.frameNo === number)) return setProblem(`Frame ${number} is already logged.`);
    const shutterSeconds = canSetShutter ? parseShutter(shutter) : undefined;
    const settings: SettingsDto = {
      mode,
      ...(canSetAperture && positive(aperture) ? { aperture: positive(aperture) } : {}),
      ...(shutterSeconds ? { shutterSeconds } : {}),
      iso: roll.ratedIso,
    };
    const check = validateSettings(loadout, settings);
    if (!check.ok) return setProblem(check.issues.map((i) => i.message).join('. '));
    setProblem(null);
    setBusy(true);
    try {
      // Only when location is already allowed: logging a frame never asks for it.
      const at = await phoneLocation({ ask: false });
      await onSave({
        frameNo: number,
        settings,
        ...(gear.lensGearId ? { lensGearId: gear.lensGearId } : {}),
        ...(defaults.stepId ? { stepId: defaults.stepId } : {}),
        ...(at ? { lat: at.lat, lng: at.lng } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setFrameNo('');
      setNote('');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View accessibilityLabel="Log a frame" className="gap-3 rounded-lg bg-surface p-4">
      <Field label="Frame number" value={frameNo} onChangeText={setFrameNo} placeholder={String(next)} keyboardType="number-pad" maxLength={2} />
      {gear.body.modes.length > 1 ? (
        <View className="flex-row gap-2">
          {gear.body.modes.map((m) => (
            <Chip key={m} label={m} on={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
      ) : null}
      <View className="flex-row gap-3">
        {canSetAperture ? (
          <View className="flex-1">
            <Field label="Aperture (f/)" value={aperture} onChangeText={setAperture} placeholder="8" keyboardType="decimal-pad" maxLength={5} />
          </View>
        ) : null}
        {canSetShutter ? (
          <View className="flex-1">
            <Field label="Shutter" value={shutter} onChangeText={setShutter} placeholder="1/250" maxLength={8} />
          </View>
        ) : null}
      </View>
      <Text className="text-text-muted">{`ISO ${roll.ratedIso} (this roll)`}</Text>
      <Sunny16
        iso={roll.ratedIso}
        onPick={(exposure) => {
          // Fitted to the camera: an aperture-priority body keeps only the aperture.
          const fitted = clampSettings(loadout, { mode, ...exposure, iso: roll.ratedIso }).settings;
          setAperture(fitted.aperture ? String(fitted.aperture) : '');
          setShutter(fitted.shutterSeconds ? shutterField(fitted.shutterSeconds) : '');
        }}
      />
      <Field label="Frame note" value={note} onChangeText={setNote} maxLength={500} placeholder="What you shot" />
      {problem ? <Notice tone="error" text={problem} /> : null}
      <PrimaryButton title="Save frame" busy={busy} onPress={() => void save()} />
    </View>
  );
}
