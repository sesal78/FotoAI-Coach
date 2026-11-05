// What the coach proposes under a reply: a challenge ("Open challenge") or a plan at a place or a
// spot ("Plan this shoot" opens New plan with that place and day filled in).

import type { CoachProposal } from '@fotoai/contracts';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { PrimaryButton } from '../form';

/** The Shoot tab's New plan for the proposed place or spot, with its day when there is one. */
export function planHref(p: Extract<CoachProposal, { kind: 'plan' }>): string {
  const where = 'placeId' in p ? `placeId=${encodeURIComponent(p.placeId)}` : `spotId=${encodeURIComponent(p.spotId)}`;
  return `/shoot?${where}${p.date ? `&date=${encodeURIComponent(p.date)}` : ''}`;
}

export function ProposalCard({ proposal, onOpen }: { proposal: CoachProposal; onOpen: () => void }) {
  if (proposal.kind === 'challenge') {
    return (
      <View className="gap-2 rounded-lg border border-primary bg-surface p-3">
        <Text className="text-sm font-semibold uppercase text-text-muted">Challenge</Text>
        <Text className="text-text">{proposal.challenge.challengeText}</Text>
        <PrimaryButton
          small
          title="Open challenge"
          onPress={() => {
            onOpen();
            router.push(`/challenge/${proposal.challenge.id}`);
          }}
        />
      </View>
    );
  }
  return (
    <View className="gap-2 rounded-lg border border-primary bg-surface p-3">
      <Text className="text-text">{proposal.date ? `Plan a shoot on ${proposal.date}` : 'Plan a shoot'}</Text>
      <PrimaryButton
        small
        title="Plan this shoot"
        onPress={() => {
          onOpen();
          router.navigate(planHref(proposal));
        }}
      />
    </View>
  );
}
