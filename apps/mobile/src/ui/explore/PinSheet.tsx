// Drop a pin: a name (required) and notes for a spot of the user's own. Coordinates are kept to
// 5 decimals (about 1 m): a spot is a real place Seun stands at.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { useAddSpot } from '../../data/hooks';
import { Field, Notice, PrimaryButton, TextLink } from '../form';
import { errorText } from '../states';

const five = (n: number) => Math.round(n * 1e5) / 1e5;

export function PinSheet({ at, onDone }: { at: { lat: number; lng: number }; onDone: () => void }) {
  const add = useAddSpot();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => AccessibilityInfo.announceForAccessibility('New pin. Enter a name for it.'), []);
  const lat = five(at.lat);
  const lng = five(at.lng);

  const save = () => {
    if (!name.trim()) return setProblem('A pin needs a name');
    setProblem(null);
    add.mutate({ pin: { name: name.trim(), lat, lng }, ...(notes.trim() ? { notes: notes.trim() } : {}) }, { onSuccess: onDone });
  };

  return (
    <View accessibilityLabel="New pin" className="gap-3 rounded-lg border border-primary bg-surface p-4">
      <Text className="font-semibold text-text">{`New pin at ${lat.toFixed(5)}, ${lng.toFixed(5)}`}</Text>
      <Field label="Pin name" value={name} onChangeText={setName} maxLength={80} placeholder="Such as Laneway mural" autoFocus />
      <Field label="Pin notes" value={notes} onChangeText={setNotes} multiline maxLength={2000} placeholder="When to go, where to stand" />
      {problem ? <Notice tone="error" text={problem} /> : null}
      {add.isError ? <Notice tone="error" text={errorText(add.error)} /> : null}
      <PrimaryButton title="Save pin" busy={add.isPending} onPress={save} />
      <TextLink title="Cancel" onPress={onDone} />
    </View>
  );
}
