// Level, XP bar, streak and challenge count from GET /api/v2/me/progress.

import { Text, View } from 'react-native';

import { useProgress } from '../../data/hooks';
import { LastUpdated } from '../LastUpdated';
import { ErrorState, Loading } from '../states';

export function ProgressCard() {
  const progress = useProgress();
  if (progress.isPending) return <Loading label="Loading your progress…" />;
  if (progress.isError && !progress.data) return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  const { xp, streak, challenges } = progress.data;
  const span = Math.max(0, xp.nextLevelAt - xp.levelStart);
  const into = Math.min(span, Math.max(0, xp.total - xp.levelStart));
  const toNext = `${into} of ${span} XP to level ${xp.level + 1}`;
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text className="text-2xl font-bold text-text">{`Level ${xp.level}`}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Level ${xp.level}: ${toNext}`}
        accessibilityValue={{ min: 0, max: span, now: into }}
        className="h-3 overflow-hidden rounded-pill bg-surface-alt"
      >
        <View className="h-3 rounded-pill bg-primary" style={{ width: `${span ? (into / span) * 100 : 0}%` }} />
      </View>
      <Text className="text-text-muted">{toNext}</Text>
      <Text className="text-text">{streak.current > 0 ? `${streak.current}-day streak · best ${streak.longest}` : 'No streak yet'}</Text>
      <Text className="text-text">{`${challenges.completed} of ${challenges.issued} challenges done`}</Text>
      <LastUpdated at={progress.dataUpdatedAt} />
    </View>
  );
}
