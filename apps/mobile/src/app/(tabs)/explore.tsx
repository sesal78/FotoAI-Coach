// Explore: real places near the home area or the user, and the user's own spots, on a map (when
// this build has a maps key) and in a list, nearest first. Only places from the Places endpoints
// and the user's spots are ever drawn.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { isNotSetUp, useNearby, useSearch, useSpots } from '../../data/hooks';
import { distanceM, distanceText } from '../../lib/distance';
import { mapsConfigured } from '../../lib/maps';
import { useWhere } from '../../lib/where';
import { ExploreMap } from '../../ui/explore/ExploreMap';
import { PlaceRow, type ExploreItem } from '../../ui/explore/PlaceRow';
import { TypeChips } from '../../ui/explore/TypeChips';
import { Field, Notice, PrimaryButton, Screen } from '../../ui/form';
import { Empty, ErrorState, Loading } from '../../ui/states';

const open = (item: ExploreItem) => router.push(item.kind === 'place' ? `/place/${item.id}` : `/spot/${item.id}`);

export default function Explore() {
  const { where, ask } = useWhere();
  const at = where.state === 'ready' ? where.at : null;
  const [type, setType] = useState<string | null>(null);
  const [text, setText] = useState('');
  const searching = text.trim().length >= 2;
  const nearby = useNearby(at, type);
  const search = useSearch(text, at);
  const spots = useSpots();
  const places = searching ? search : nearby;

  const items = useMemo(() => {
    const away = (loc: { lat: number; lng: number }) => (at ? distanceM(at, loc) : null);
    const list: Array<Omit<ExploreItem, 'distance'> & { m: number | null }> = [
      ...(places.data?.places ?? []).map((p) => ({ kind: 'place' as const, id: p.placeId, name: p.name, location: p.location, type: p.primaryType, m: away(p.location) })),
      ...(spots.data?.spots ?? [])
        .filter((s) => s.location && s.name && !s.unavailable)
        .map((s) => ({ kind: 'spot' as const, id: s.id, name: s.name!, location: s.location!, type: null, m: away(s.location!) })),
    ];
    return list
      .sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity))
      .map(({ m, ...item }) => ({ ...item, distance: m === null ? null : distanceText(m) }));
  }, [places.data, spots.data, at]);

  const placesUnavailable = places.isError && isNotSetUp(places.error);
  const showMap = mapsConfigured() && at !== null;

  return (
    <Screen title="Explore">
      <Text className="text-text-muted">Real places on a map, and your own spots.</Text>
      {where.state === 'loading' ? <Loading label="Finding where you are…" /> : null}
      {where.state === 'none' ? (
        <View className="gap-3 rounded-lg bg-surface p-4">
          <Text className="text-text-muted">Explore shows places near your home area, or near you when you allow location.</Text>
          <PrimaryButton title="Use my location" onPress={ask} />
        </View>
      ) : null}
      {at ? (
        <>
          <Field label="Search places" value={text} onChangeText={setText} placeholder="Beach, lookout, a place name…" />
          {!searching ? <TypeChips selected={type} onChange={setType} /> : null}
          {showMap ? (
            <ExploreMap center={at} showUser={where.state === 'ready' && where.source === 'phone'} items={items} onOpen={open} />
          ) : (
            <Notice text="Map unavailable. The list below still works." />
          )}
        </>
      ) : null}

      {at && places.isLoading ? <Loading label="Finding places…" /> : null}
      {placesUnavailable ? <Notice text="Places unavailable right now. Your spots still show." /> : null}
      {places.isError && !placesUnavailable && !places.data ? <ErrorState error={places.error} onRetry={() => void places.refetch()} /> : null}
      {at && places.isSuccess && places.data.places.length === 0 ? <Empty title="No places found here" hint="Try another type, a search, or drop a pin of your own." /> : null}
      {items.map((item) => (
        <PlaceRow key={`${item.kind}:${item.id}`} item={item} onPress={() => open(item)} />
      ))}
      {spots.isError && !spots.data ? <ErrorState error={spots.error} onRetry={() => void spots.refetch()} /> : null}
    </Screen>
  );
}
