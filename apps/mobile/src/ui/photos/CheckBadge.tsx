// What the AI check on a photo found. The check runs on the server when the photo is confirmed.

import type { PhotoDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

export function checkText(check: PhotoDto['check']): string {
  if (!check) return 'Not checked yet';
  if (!check.safe) return 'This photo cannot be analysed';
  if (check.matchesBrief === 'yes') return 'Matches the brief';
  if (check.matchesBrief === 'no') return 'Does not match the brief';
  if (check.matchesBrief === 'unclear') return 'Not sure it matches the brief';
  return check.genre ? `Checked: ${check.genre}` : 'Checked';
}

export function CheckBadge({ check }: { check: PhotoDto['check'] }) {
  const good = check?.safe && check.matchesBrief === 'yes';
  return (
    <View className={`self-start rounded-pill px-3 py-1 ${good ? 'bg-primary' : 'bg-surface-alt'}`}>
      <Text className={`text-sm font-semibold ${good ? 'text-on-primary' : 'text-text'}`}>{checkText(check)}</Text>
    </View>
  );
}
