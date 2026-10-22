// Add gear from the catalog: search by make or model; one tap adds an item. Owned items are marked.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAddGear, useGearCatalog, useMyGear } from '../../../data/hooks';
import { Field, Notice, Screen, TextLink } from '../../../ui/form';
import { ErrorState, errorText, Loading } from '../../../ui/states';

export default function AddGear() {
  const catalog = useGearCatalog();
  const mine = useMyGear();
  const add = useAddGear();
  const [search, setSearch] = useState('');

  const owned = useMemo(() => new Set((mine.data?.items ?? []).map((g) => g.catalogId).filter(Boolean)), [mine.data]);
  const rows = useMemo(() => {
    if (!catalog.data) return [];
    const all = [
      ...catalog.data.bodies.map((b) => ({ id: b.id, name: `${b.make} ${b.model}`, kind: b.type === 'film' ? 'Film camera' : 'Camera' })),
      ...catalog.data.lenses.map((l) => ({ id: l.id, name: `${l.make} ${l.model}`, kind: 'Lens' })),
    ];
    const q = search.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [catalog.data, search]);

  return (
    <Screen title="Add gear">
      <TextLink title="Back" onPress={() => router.back()} />
      <Field label="Search the catalog" value={search} onChangeText={setSearch} placeholder="Make or model" autoCapitalize="none" />
      {catalog.isPending ? <Loading label="Loading the catalog…" /> : null}
      {catalog.isError && !catalog.data ? <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} /> : null}
      {add.isError ? <Notice tone="error" text={errorText(add.error)} /> : null}
      {catalog.data && rows.length === 0 ? <Text className="text-text-muted">Nothing matches. Add it as custom gear.</Text> : null}
      {rows.map((r) => (
        <View key={r.id} className="flex-row items-center justify-between rounded-md bg-surface p-3">
          <View className="flex-1">
            <Text className="font-semibold text-text">{r.name}</Text>
            <Text className="text-text-muted">{r.kind}</Text>
          </View>
          {owned.has(r.id) ? (
            <Text accessibilityLabel={`${r.name} is in your gear`} className="px-3 text-success">Owned</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${r.name}`}
              disabled={add.isPending}
              onPress={() => add.mutate({ catalogId: r.id })}
              className="min-h-11 justify-center rounded-pill bg-primary px-4"
            >
              <Text className="font-semibold text-on-primary">Add</Text>
            </Pressable>
          )}
        </View>
      ))}
      <TextLink title="Add custom gear" onPress={() => router.push('/me/gear/custom')} />
    </Screen>
  );
}
