// One plan in the Shoot list: its title, date and whether it is done.

import type { PlanSummaryDto } from '@fotoai/contracts';
import { Pressable, Text, View } from 'react-native';

export function PlanRow({ plan, onPress }: { plan: PlanSummaryDto; onPress: () => void }) {
  return (
    <Pressable testID="plan-row" accessibilityRole="button" accessibilityLabel={plan.title} onPress={onPress} className="min-h-12 flex-row items-center justify-between rounded-md bg-surface p-3">
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-text">{plan.title}</Text>
        <Text className="text-sm text-text-muted">{plan.date}</Text>
      </View>
      {plan.status === 'done' ? <Text className="font-semibold text-success">Done</Text> : null}
    </Pressable>
  );
}
