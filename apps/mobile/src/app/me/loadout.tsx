// The loadout: the camera (and lens, and film) Seun is carrying. Only gear with capability data
// can be picked. A misfit from the server shows under the picker, and nothing is saved.

import type { BodyDto, LoadoutInput } from '@fotoai/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useLoadout, useMyGear, usePutLoadout } from '../../data/hooks';
import { Choice } from '../../ui/Choice';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { LastUpdated } from '../../ui/LastUpdated';
import { Empty, ErrorState, errorText, Loading } from '../../ui/states';

export default function Loadout() {
  const gear = useMyGear();
  const current = useLoadout();
  const save = usePutLoadout();
  const [bodyId, setBodyId] = useState<string | null>(null);
  const [lensId, setLensId] = useState<string | null>(null);
  const [stock, setStock] = useState('');
  const [boxIso, setBoxIso] = useState('');
  const [ratedIso, setRatedIso] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // Start from the saved loadout, once.
  const saved = current.data?.loadout;
  useEffect(() => {
    if (!saved || bodyId) return;
    setBodyId(saved.body.id);
    setLensId(saved.lensGearId);
    if (saved.film) {
      setStock(saved.film.stock);
      setBoxIso(String(saved.film.boxIso));
      setRatedIso(saved.film.ratedIso ? String(saved.film.ratedIso) : '');
    }
  }, [saved, bodyId]);

  const items = gear.data?.items ?? [];
  const bodies = items.filter((g) => g.kind === 'body' && g.capability);
  const lenses = items.filter((g) => g.kind === 'lens' && g.capability);
  const body = bodies.find((b) => b.id === bodyId)?.capability as BodyDto | undefined;
  const fixedLens = Boolean(body?.fixedLensId);
  const film = body?.type === 'film';

  const onSave = () => {
    setProblem(null);
    if (!bodyId) return setProblem('Choose a camera');
    if (!fixedLens && !lensId) return setProblem('Choose a lens');
    if (film && (!stock.trim() || !(Number(boxIso) > 0))) return setProblem('Enter the film stock and its box ISO');
    const input: LoadoutInput = {
      bodyGearId: bodyId,
      ...(fixedLens ? {} : { lensGearId: lensId! }),
      ...(film ? { film: { stock: stock.trim(), boxIso: Number(boxIso), ...(Number(ratedIso) > 0 ? { ratedIso: Number(ratedIso) } : {}) } } : {}),
    };
    save.mutate(input);
  };

  return (
    <Screen title="Loadout">
      <TextLink title="Back" onPress={() => router.back()} />
      {gear.isPending ? <Loading label="Loading your gear…" /> : null}
      {gear.isError && !gear.data ? <ErrorState error={gear.error} onRetry={() => void gear.refetch()} /> : null}
      {gear.data && bodies.length === 0 ? (
        <>
          <Empty title="No camera to pick" hint="Add a camera from the catalog, or as custom gear with its settings." />
          <TextLink title="Add gear" onPress={() => router.push('/me/gear/add')} />
        </>
      ) : null}
      {bodies.length > 0 ? (
        <View className="gap-4 rounded-lg bg-surface p-4">
          <Text className="font-semibold text-text">Camera</Text>
          <Choice label="Camera" options={bodies.map((b) => ({ value: b.id, label: b.name }))} selected={bodyId} onSelect={(v) => { setBodyId(v); setProblem(null); save.reset(); }} />
          {body && !fixedLens ? (
            <>
              <Text className="font-semibold text-text">Lens</Text>
              {lenses.length === 0 ? <Text className="text-text-muted">Add a lens to your gear first.</Text> : null}
              <Choice label="Lens" options={lenses.map((l) => ({ value: l.id, label: l.name }))} selected={lensId} onSelect={(v) => { setLensId(v); setProblem(null); save.reset(); }} />
            </>
          ) : null}
          {body && fixedLens ? <Text className="text-text-muted">This camera has a built-in lens.</Text> : null}
          {film ? (
            <>
              <Field label="Film stock" value={stock} onChangeText={setStock} placeholder="Portra 400" />
              <Field label="Box ISO" value={boxIso} onChangeText={setBoxIso} keyboardType="number-pad" />
              <Field label="Rated ISO (if you push or pull)" value={ratedIso} onChangeText={setRatedIso} keyboardType="number-pad" />
            </>
          ) : null}
          {problem ? <Notice tone="error" text={problem} /> : null}
          {save.isError ? <Notice tone="error" text={errorText(save.error)} /> : null}
          {save.isSuccess ? <Notice tone="success" text="Loadout saved" /> : null}
          <PrimaryButton title="Save loadout" busy={save.isPending} onPress={onSave} />
        </View>
      ) : null}
      <LastUpdated at={current.dataUpdatedAt} />
    </Screen>
  );
}
