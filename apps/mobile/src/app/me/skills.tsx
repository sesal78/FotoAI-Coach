// The skill tree by category, with each skill's status and the XP to its next status.

import type { SkillDto } from '@fotoai/contracts';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useProgress } from '../../data/hooks';
import { Screen, TextLink } from '../../ui/form';
import { LastUpdated } from '../../ui/LastUpdated';
import { Empty, ErrorState, Loading } from '../../ui/states';

const CATEGORIES: Array<[string, string]> = [
  ['technical', 'Technical'],
  ['composition', 'Composition'],
  ['post_processing', 'Post-processing'],
];

export function skillStatus(s: SkillDto): string {
  const left = (target: number) => Math.max(0, target - s.currentXP);
  switch (s.status) {
    case 'available':
      return `Available · ${left(s.xpToLearn)} XP to learned`;
    case 'learned':
      return `Learned · ${left(s.xpToPractice)} XP to practised`;
    case 'practiced':
      return `Practised · ${left(s.xpToMaster)} XP to mastered`;
    case 'mastered':
      return 'Mastered';
    default:
      return 'Locked';
  }
}

export default function Skills() {
  const progress = useProgress();
  return (
    <Screen title="Skills">
      <TextLink title="Back" onPress={() => router.back()} />
      {progress.isPending ? <Loading label="Loading your skills…" /> : null}
      {progress.isError && !progress.data ? <ErrorState error={progress.error} onRetry={() => void progress.refetch()} /> : null}
      {progress.data && progress.data.skills.length === 0 ? <Empty title="No skills yet" /> : null}
      {progress.data
        ? CATEGORIES.map(([id, title]) => {
            const items = progress.data.skills.filter((s) => s.category === id);
            if (items.length === 0) return null;
            return (
              <View key={id} className="gap-2">
                <Text accessibilityRole="header" className="text-lg font-semibold text-text">{title}</Text>
                {items.map((s) => (
                  <View key={s.id} className="gap-1 rounded-md bg-surface p-3">
                    <Text className="font-semibold text-text">{s.name}</Text>
                    <Text className={s.status === 'locked' ? 'text-text-muted' : 'text-text'}>{skillStatus(s)}</Text>
                  </View>
                ))}
              </View>
            );
          })
        : null}
      <LastUpdated at={progress.dataUpdatedAt} />
    </Screen>
  );
}
