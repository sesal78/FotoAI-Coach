// One chat message: mine on the right, the coach's on the left with its proposal under it.

import type { CoachMessageDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { ProposalCard } from './ProposalCard';

export function Message({ message, onOpen }: { message: CoachMessageDto; onOpen: () => void }) {
  const mine = message.role === 'user';
  return (
    <View className={`max-w-[85%] gap-2 ${mine ? 'self-end' : 'self-start'}`}>
      <View className={`rounded-lg px-4 py-3 ${mine ? 'bg-primary' : 'bg-surface'}`}>
        <Text className={mine ? 'text-on-primary' : 'text-text'}>{message.content}</Text>
      </View>
      {!mine && message.proposal ? <ProposalCard proposal={message.proposal} onOpen={onOpen} /> : null}
    </View>
  );
}
