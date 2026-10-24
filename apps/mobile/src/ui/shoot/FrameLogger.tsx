// Log one frame on the roll: its number (the next one, or typed), the exposure (from the plan's
// step, typed, or from Sunny 16), a note, and where it was taken when location is already allowed.
// Works with no signal: the frame waits in the outbox.

import type { FrameInput, RollDto, SettingsDto } from '@fotoai/contracts';
import { useState } from 'react';
import { View } from 'react-native';

import { phoneLocation } from '../../lib/where';
import { Field, Notice, PrimaryButton } from '../form';
import { Sunny16 } from './Sunny16';

/** The server takes up to 2 frames past the roll's length (a roll often gives a frame or two more). */
export const SPARE_FRAMES = 2;

export interface FrameDefaults {
  stepId?: string;
  mode?: SettingsDto['mode'];
  aperture?: number;
  shutterSeconds?: number;
  iso?: number;
}

export const shutterField = (seconds: number) => (seconds < 1 ? `1/${Math.round(1 / seconds)}` : String(seconds));

/** "1/250" → 0.004; "2" → 2; anything else → undefined. */
export function parseShutter(text: string): number | undefined {
  const t = text.trim().replace(/\s*s$/, '');
  const fraction = /^1\/(\d+(?:\.\d+)?)$/.exec(t);
  const value = fraction ? 1 / Number(fraction[1]) : Number(t);
  return t && Number.isFinite(value) && value > 0 ? value : undefined;
}

const positive = (text: string) => (text.trim() && Number(text) > 0 ? Number(text) : undefined);

export function FrameLogger({ roll, defaults, onSave }: { roll: RollDto; defaults: FrameDefaults; onSave: (frame: Omit<FrameInput, 'id' | 'shotAt'>) => Promise<unknown> }) {
  const [frameNo, setFrameNo] = useState('');
  const [aperture, setAperture] = useState(defaults.aperture ? String(defaults.aperture) : '');
  const [shutter, setShutter] = useState(defaults.shutterSeconds ? shutterField(defaults.shutterSeconds) : '');
  const [iso, setIso] = useState(String(defaults.iso ?? roll.ratedIso));
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = roll.framesLogged + 1;

  const save = async () => {
    const number = frameNo.trim() ? Number(frameNo) : next;
    if (!Number.isInteger(number) || number < 1) return setProblem('The frame number is a whole number from 1.');
    if (number > roll.exposures + SPARE_FRAMES) return setProblem(`Frame ${number} is past the end of this ${roll.exposures}-exposure roll.`);
    setProblem(null);
    setBusy(true);
    try {
      const shutterSeconds = parseShutter(shutter);
      const settings: SettingsDto = {
        mode: defaults.mode ?? 'M',
        ...(positive(aperture) ? { aperture: positive(aperture) } : {}),
        ...(shutterSeconds ? { shutterSeconds } : {}),
        ...(positive(iso) ? { iso: Math.round(positive(iso)!) } : {}),
      };
      // Only when location is already allowed: logging a frame never asks for it.
      const at = await phoneLocation({ ask: false });
      await onSave({
        frameNo: number,
        settings,
        ...(defaults.stepId ? { stepId: defaults.stepId } : {}),
        ...(at ? { lat: at.lat, lng: at.lng } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setFrameNo('');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View accessibilityLabel="Log a frame" className="gap-3 rounded-lg bg-surface p-4">
      <Field label="Frame number" value={frameNo} onChangeText={setFrameNo} placeholder={String(next)} keyboardType="number-pad" maxLength={2} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Aperture (f/)" value={aperture} onChangeText={setAperture} placeholder="8" keyboardType="decimal-pad" maxLength={5} />
        </View>
        <View className="flex-1">
          <Field label="Shutter" value={shutter} onChangeText={setShutter} placeholder="1/250" maxLength={8} />
        </View>
        <View className="flex-1">
          <Field label="ISO" value={iso} onChangeText={setIso} keyboardType="number-pad" maxLength={5} />
        </View>
      </View>
      <Sunny16
        iso={positive(iso) ?? roll.ratedIso}
        onPick={(exposure) => {
          setAperture(String(exposure.aperture));
          setShutter(shutterField(exposure.shutterSeconds));
        }}
      />
      <Field label="Frame note" value={note} onChangeText={setNote} maxLength={500} placeholder="What you shot" />
      {problem ? <Notice tone="error" text={problem} /> : null}
      <PrimaryButton title="Save frame" busy={busy} onPress={() => void save()} />
    </View>
  );
}
