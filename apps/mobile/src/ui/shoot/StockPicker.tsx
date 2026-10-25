// Pick the film: a stock from the list (with its box ISO), or my own film by name and box ISO.

import { FILM_STOCKS, pushPullStops, type FilmStock } from '@fotoai/core';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field, TextLink } from '../form';

export type StockChoice = { kind: 'catalog'; stockId: string } | { kind: 'own'; name: string; boxIso: string };

/** "+1 stop push", "−2/3 stop pull", "At box speed". */
export function pushPullText(boxIso: number, ratedIso: number): string {
  const stops = pushPullStops(boxIso, ratedIso);
  if (stops === 0) return 'At box speed';
  const size = Math.abs(stops);
  const whole = Math.floor(size + 1e-9);
  const thirds = Math.round((size - whole) * 3);
  const amount = [whole ? String(whole) : '', thirds ? `${thirds}/3` : ''].filter(Boolean).join(' ');
  return `${stops > 0 ? '+' : '−'}${amount} stop${size > 1 ? 's' : ''} ${stops > 0 ? 'push' : 'pull'}`;
}

export const stockLabel = (s: FilmStock) => `${s.names[0]} (ISO ${s.boxIso})`;

/** The stock whose name matches the loadout's film, if any. */
export const stockForName = (name: string | undefined) =>
  name ? FILM_STOCKS.find((s) => s.names.some((n) => n.toLowerCase() === name.trim().toLowerCase())) : undefined;

export function StockPicker({ value, onChange }: { value: StockChoice | null; onChange: (choice: StockChoice) => void }) {
  const [find, setFind] = useState('');
  const chosen = value?.kind === 'catalog' ? FILM_STOCKS.find((s) => s.id === value.stockId) : undefined;
  const q = find.trim().toLowerCase();
  const matches = q ? FILM_STOCKS.filter((s) => s.names.some((n) => n.toLowerCase().includes(q))).slice(0, 6) : [];

  if (value?.kind === 'own') {
    return (
      <View className="gap-3">
        <Field label="Film name" value={value.name} onChangeText={(name) => onChange({ ...value, name })} maxLength={60} placeholder="Such as Lomo Metropolis" />
        <Field label="Box ISO" value={value.boxIso} onChangeText={(boxIso) => onChange({ ...value, boxIso })} keyboardType="number-pad" maxLength={5} />
        <TextLink title="Pick from the list" onPress={() => onChange({ kind: 'catalog', stockId: FILM_STOCKS[0]!.id })} />
      </View>
    );
  }
  return (
    <View className="gap-2">
      {chosen ? <Text className="text-lg font-semibold text-text">{stockLabel(chosen)}</Text> : <Text className="text-text-muted">No film chosen yet.</Text>}
      <Field label="Find a film" value={find} onChangeText={setFind} placeholder="Portra, HP5, Ektar…" maxLength={40} />
      {matches.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          onPress={() => {
            onChange({ kind: 'catalog', stockId: s.id });
            setFind('');
          }}
          className="min-h-11 justify-center rounded-md bg-surface-alt px-3"
        >
          <Text className="text-text">{stockLabel(s)}</Text>
        </Pressable>
      ))}
      <TextLink title="My own film" onPress={() => onChange({ kind: 'own', name: '', boxIso: '' })} />
    </View>
  );
}
