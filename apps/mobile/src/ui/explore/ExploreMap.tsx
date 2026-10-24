// The Google map on Explore: the centre, nearby places and My spots, each drawn only from what
// the API or the user's spots gave. A long press reports the point (to drop a pin).

import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { ExploreItem } from './PlaceRow';

export function ExploreMap({
  center,
  showUser,
  items,
  onOpen,
  onLongPress,
}: {
  center: { lat: number; lng: number };
  showUser: boolean;
  items: ExploreItem[];
  onOpen: (item: ExploreItem) => void;
  onLongPress?: (at: { lat: number; lng: number }) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View className="h-72 overflow-hidden rounded-lg">
      {/* initialRegion is read once: a new key re-centres the map when Explore's centre moves. */}
      <MapView
        key={`${center.lat},${center.lng}`}
        testID="map"
        accessibilityLabel="Map of nearby places and your spots"
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation={showUser}
        toolbarEnabled={false}
        onLongPress={(e) => onLongPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      >
        {items.filter((item) => item.location !== null).map((item) => (
          <Marker
            key={`${item.kind}:${item.id}`}
            coordinate={{ latitude: item.location!.lat, longitude: item.location!.lng }}
            title={item.name}
            description={item.kind === 'spot' ? 'My spot' : undefined}
            pinColor={item.kind === 'spot' ? tokens.colors.accent : tokens.colors.primary}
            onCalloutPress={() => onOpen(item)}
          />
        ))}
      </MapView>
    </View>
  );
}
