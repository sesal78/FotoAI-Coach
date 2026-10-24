// One film roll: the stock and its rated ISO, the counter, the frame logger (from a plan's step,
// its settings come filled in), the frames logged, and Finish roll. All of it works offline.

import { EXPOSURE_MODES, type SettingsDto } from '@fotoai/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useFinishRoll, useLogFrame, useRoll } from '../../data/shoot';
import { Notice, Screen, TextLink } from '../../ui/form';
import { FrameLogger, type FrameDefaults } from '../../ui/shoot/FrameLogger';
import { settingsText } from '../../ui/shoot/StepCard';
import { pushPullText } from '../../ui/shoot/StockPicker';
import { ErrorState, Loading } from '../../ui/states';

type Params = { id: string; stepId?: string; mode?: string; aperture?: string; shutterSeconds?: string; iso?: string };

const num = (text: string | undefined) => (text && Number(text) > 0 ? Number(text) : undefined);

function defaultsFrom(p: Params): FrameDefaults {
  const mode = EXPOSURE_MODES.find((m) => m === p.mode) as SettingsDto['mode'] | undefined;
  return {
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(mode ? { mode } : {}),
    ...(num(p.aperture) ? { aperture: num(p.aperture) } : {}),
    ...(num(p.shutterSeconds) ? { shutterSeconds: num(p.shutterSeconds) } : {}),
    ...(num(p.iso) ? { iso: num(p.iso) } : {}),
  };
}

export default function RollScreen() {
  const params = useLocalSearchParams<Params>();
  const { roll, frames, isPending, error, refetch } = useRoll(params.id);
  const logFrame = useLogFrame(params.id);
  const finish = useFinishRoll(params.id);

  if (!roll) {
    return (
      <Screen title="Film roll">
        <TextLink title="Back" onPress={() => router.back()} />
        {isPending ? <Loading label="Loading the roll…" /> : <ErrorState error={error} onRetry={() => void refetch()} />}
      </Screen>
    );
  }

  const left = roll.framesLeft;
  const loaded = roll.status === 'loaded';
  return (
    <Screen title={roll.stockName}>
      <TextLink title="Back" onPress={() => router.back()} />
      <Text className="text-text-muted">{`Rated ISO ${roll.ratedIso} · ${pushPullText(roll.boxIso, roll.ratedIso)}`}</Text>
      {loaded && left > 0 ? <Text className="text-lg font-semibold text-text">{`Next frame ${roll.framesLogged + 1} of ${roll.exposures} · ${left} left`}</Text> : null}
      {loaded && left > 0 && left <= 2 ? <Notice text={`${left} frame${left === 1 ? '' : 's'} left on this roll.`} /> : null}
      {loaded && left === 0 ? <Notice text="Roll full: finish it." /> : null}
      {loaded ? (
        <>
          <FrameLogger roll={roll} defaults={defaultsFrom(params)} onSave={logFrame} />
          <TextLink title="Finish roll" onPress={() => void finish()} />
        </>
      ) : (
        <Text className="text-text-muted">{roll.status === 'finished' ? 'This roll is finished.' : `This roll is ${roll.status}.`}</Text>
      )}
      {frames.length > 0 ? <Text accessibilityRole="header" className="text-xl font-semibold text-text">Frames</Text> : null}
      {[...frames].reverse().map((f) => (
        <View key={f.id} className="gap-1 rounded-md bg-surface p-3">
          <Text className="text-text">{`#${f.frameNo} · ${settingsText(f.settings)}`}</Text>
          {f.note ? <Text className="text-text-muted">{f.note}</Text> : null}
        </View>
      ))}
    </Screen>
  );
}
