// Analyse on the photo screen: 3 buttons (Critique, Editing tips, How to recreate) that each ask
// the AI only on a tap, then the saved results, newest first. With no signal the buttons say
// "Needs a signal" and the saved results still show. The server's own message shows when it
// refuses (an unsafe photo, too many requests, AI not set up).

import type { AnalysisDto, AnalysisMode } from '@fotoai/contracts';
import { Pressable, Text, View } from 'react-native';

import { useAnalyse, useAnalyses } from '../../data/photos';
import { Notice } from '../form';
import { useIsOnline } from '../LastUpdated';
import { Empty, errorText, isOffline, Loading } from '../states';
import { CritiqueCard } from './CritiqueCard';
import { EditingCard } from './EditingCard';
import { RecreateCard } from './RecreateCard';

export const MODE_TITLE: Record<AnalysisMode, string> = { critique: 'Critique', editing: 'Editing tips', recreate: 'How to recreate' };
const MODES: AnalysisMode[] = ['critique', 'editing', 'recreate'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** "5 Nov 2026, 14:00" on the phone's clock. */
export function resultTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function ModeButton({ title, onPress, working, disabled }: { title: string; onPress: () => void; working: boolean; disabled: boolean }) {
  const dim = disabled && !working;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: working, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-pill px-5 py-3 ${dim ? 'bg-surface-alt' : 'bg-primary'}`}
    >
      <Text className={`font-semibold ${dim ? 'text-text-muted' : 'text-on-primary'}`}>{working ? 'Working…' : title}</Text>
    </Pressable>
  );
}

function ResultCard({ analysis }: { analysis: AnalysisDto }) {
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text accessibilityRole="header" className="font-semibold text-text">{`${MODE_TITLE[analysis.mode]} · ${resultTime(analysis.createdAt)}`}</Text>
      {analysis.mode === 'critique' ? <CritiqueCard critique={analysis.critique} /> : null}
      {analysis.mode === 'editing' ? <EditingCard editing={analysis.editing} /> : null}
      {analysis.mode === 'recreate' ? <RecreateCard recreate={analysis.recreate} /> : null}
    </View>
  );
}

export function Analyse({ photoId, unsafe }: { photoId: string; unsafe: boolean }) {
  const online = useIsOnline();
  const saved = useAnalyses(photoId);
  const analyse = useAnalyse(photoId);
  const analyses = saved.data?.analyses ?? [];
  const running = analyse.isPending ? analyse.variables : null;

  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="text-xl font-bold text-text">
        Ask the AI
      </Text>
      {unsafe ? (
        <Notice text="This photo did not pass the AI check." />
      ) : (
        <View className="gap-2">
          {MODES.map((mode) =>
            online ? (
              <ModeButton key={mode} title={MODE_TITLE[mode]} working={running === mode} disabled={running !== null} onPress={() => analyse.mutate(mode)} />
            ) : (
              <ModeButton key={mode} title="Needs a signal" working={false} disabled onPress={() => undefined} />
            ),
          )}
        </View>
      )}
      {analyse.isError ? <Notice tone="error" text={errorText(analyse.error)} /> : null}
      {saved.isPending ? <Loading label="Loading the results…" /> : null}
      {saved.isError && !saved.data && !isOffline(saved.error) ? <Notice tone="error" text={errorText(saved.error)} /> : null}
      {saved.data && analyses.length === 0 && !running ? <Empty title="No results yet" hint="Tap a button to ask the AI about this photo." /> : null}
      {analyses.map((a) => (
        <ResultCard key={a.id} analysis={a} />
      ))}
    </View>
  );
}
