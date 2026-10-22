// Add gear from the catalog: search by make or model; one tap adds an item. Owned items are marked.

import { router } from 'expo-router';

import { Screen, TextLink } from '../../../ui/form';
import { CatalogList } from '../../../ui/gear/CatalogList';

export default function AddGear() {
  return (
    <Screen title="Add gear">
      <TextLink title="Back" onPress={() => router.back()} />
      <CatalogList />
      <TextLink title="Add custom gear" onPress={() => router.push('/me/gear/custom')} />
    </Screen>
  );
}
