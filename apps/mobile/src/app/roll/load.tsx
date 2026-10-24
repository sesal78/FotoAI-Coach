// Load a film roll into the loadout's film camera: the stock (the loadout's film is chosen first),
// the rated ISO with the push or pull it means, and the number of exposures. One roll at a time.
// Works with no signal: the roll waits in the outbox, with an id made on the phone.

import { FILM_STOCKS } from '@fotoai/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useLoadout } from '../../data/hooks';
import { useLoadRoll, useRolls } from '../../data/shoot';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { Chip } from '../../ui/shoot/Chip';
import { pushPullText, StockPicker, stockForName, type StockChoice } from '../../ui/shoot/StockPicker';
import { ErrorState, Loading } from '../../ui/states';

const STANDARD = [12, 24, 36] as const;

const positiveInt = (text: string) => (/^\d+$/.test(text.trim()) && Number(text) > 0 ? Number(text) : undefined);

export default function LoadRoll() {
  const loadout = useLoadout();
  const loaded = useRolls().rolls.find((r) => r.status === 'loaded');
  const load = useLoadRoll();
  const [picked, setPicked] = useState<StockChoice | null>(null);
  const [rated, setRated] = useState('');
  const [exposures, setExposures] = useState('36');
  const [problem, setProblem] = useState<string | null>(null);

  const current = loadout.data?.loadout;
  const film = current?.film ?? undefined;
  const preset = stockForName(film?.stock);
  const choice: StockChoice | null =
    picked ?? (preset ? { kind: 'catalog', stockId: preset.id } : film ? { kind: 'own', name: film.stock, boxIso: String(film.boxIso) } : null);
  const boxIso = choice?.kind === 'catalog' ? FILM_STOCKS.find((s) => s.id === choice.stockId)?.boxIso : choice ? positiveInt(choice.boxIso) : undefined;
  const ratedIso = positiveInt(rated) ?? (picked ? undefined : film?.ratedIso) ?? boxIso;

  if (loadout.isPending) return <Screen title="Load a roll"><Loading /></Screen>;
  if (loadout.isError && !loadout.data) return <Screen title="Load a roll"><ErrorState error={loadout.error} onRetry={() => void loadout.refetch()} /></Screen>;

  const blocked = !current
    ? 'Set your loadout first.'
    : current.body.capability && 'type' in current.body.capability && current.body.capability.type !== 'film'
      ? 'Film rolls need a film camera in your loadout.'
      : loaded
        ? 'Finish the roll in the camera first.'
        : null;
  if (blocked) {
    return (
      <Screen title="Load a roll">
        <TextLink title="Back" onPress={() => router.back()} />
        <Notice text={blocked} />
        {loaded ? <TextLink title="Open the roll" onPress={() => router.replace(`/roll/${loaded.id}`)} /> : <TextLink title="Open the loadout" onPress={() => router.push('/me/loadout')} />}
      </Screen>
    );
  }

  const save = async () => {
    const count = positiveInt(exposures);
    if (!choice || !boxIso || (choice.kind === 'own' && !choice.name.trim())) return setProblem('Choose a film, or give your own film its name and box ISO.');
    if (!count || count > 72) return setProblem('Exposures is a number from 1 to 72.');
    if (!ratedIso) return setProblem('Rated ISO is a whole number.');
    setProblem(null);
    const stock = choice.kind === 'catalog' ? { stockId: choice.stockId } : { stockName: choice.name.trim(), boxIso };
    const id = await load({ ...stock, ratedIso, exposures: count, bodyGearId: current!.body.id });
    router.replace(`/roll/${id}`);
  };

  return (
    <Screen title="Load a roll">
      <TextLink title="Back" onPress={() => router.back()} />
      <Text className="text-text-muted">{`Camera: ${current!.body.name}`}</Text>
      <StockPicker value={choice} onChange={setPicked} />
      <View className="gap-1">
        <Field label="Rated ISO" value={rated} onChangeText={setRated} placeholder={boxIso ? String(boxIso) : '400'} keyboardType="number-pad" maxLength={5} />
        {boxIso && ratedIso ? <Text className="text-text-muted">{pushPullText(boxIso, ratedIso)}</Text> : null}
      </View>
      <View className="gap-2">
        <Text className="font-semibold text-text">Exposures</Text>
        <View className="flex-row gap-2">
          {STANDARD.map((n) => (
            <Chip key={n} label={String(n)} on={exposures === String(n)} onPress={() => setExposures(String(n))} />
          ))}
        </View>
        <Field label="Or another number" value={STANDARD.some((n) => String(n) === exposures) ? '' : exposures} onChangeText={setExposures} keyboardType="number-pad" maxLength={2} />
      </View>
      {problem ? <Notice tone="error" text={problem} /> : null}
      <PrimaryButton title="Load the roll" onPress={() => void save()} />
    </Screen>
  );
}
