// One film roll: the stock and its rated ISO, the counter, the frame logger (from a plan's step,
// its settings come filled in), the frames logged, and Finish roll. All of it works offline.
// Scans (3F): Add scans imports scans of this roll and opens the pairing; the roll's scans show
// with their frame. From the pairing, Add frame N opens the logger at N (on a finished roll too)
// and comes back.

import { EXPOSURE_MODES, type SettingsDto } from '@fotoai/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useLoadout } from '../../data/hooks';
import { useImport, useRollScans, useWaitingPhotos } from '../../data/photos';
import { useFinishRoll, useLogFrame, useRoll } from '../../data/shoot';
import { Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { FrameLogger, nextFrameNo, type FrameDefaults, type FrameGear } from '../../ui/shoot/FrameLogger';
import { settingsText } from '../../ui/shoot/StepCard';
import { pushPullText } from '../../ui/shoot/StockPicker';
import { ScanThumb } from '../../ui/photos/ScanPairing';
import { ErrorState, Loading } from '../../ui/states';

type Params = { id: string; stepId?: string; mode?: string; aperture?: string; shutterSeconds?: string; frameNo?: string; returnTo?: string };

const num = (text: string | undefined) => (text && Number(text) > 0 ? Number(text) : undefined);

function defaultsFrom(p: Params): FrameDefaults {
  const mode = EXPOSURE_MODES.find((m) => m === p.mode) as SettingsDto['mode'] | undefined;
  return {
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(mode ? { mode } : {}),
    ...(num(p.aperture) ? { aperture: num(p.aperture) } : {}),
    ...(num(p.shutterSeconds) ? { shutterSeconds: num(p.shutterSeconds) } : {}),
    ...(num(p.frameNo) ? { frameNo: num(p.frameNo) } : {}),
  };
}

export default function RollScreen() {
  const params = useLocalSearchParams<Params>();
  const { roll, frames, isPending, error, refetch } = useRoll(params.id);
  const logFrame = useLogFrame(params.id);
  const finish = useFinishRoll(params.id);
  const loadout = useLoadout().data?.loadout;
  const [problem, setProblem] = useState<string | null>(null);
  const scans = useRollScans(params.id);
  const waitingScans = useWaitingPhotos().filter((w) => w.body.source === 'scan' && w.body.rollId === params.id);
  const { importPhotos, busy: importing } = useImport();
  const [scanNote, setScanNote] = useState<string | null>(null);

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
  // A missed frame can be added from the pairing of scans, on a finished roll too.
  const addingFrame = !loaded && num(params.frameNo) !== undefined;
  const saveFrame = async (input: Parameters<typeof logFrame>[0]) => {
    await logFrame(input);
    if (params.returnTo === 'scans') router.back();
  };
  const addScans = () => {
    setScanNote(null);
    importPhotos({ source: 'scan', rollId: roll.id })
      .then((r) => (r.ids.length ? router.push(`/roll/scans/${roll.id}?ids=${r.ids.join(',')}`) : setScanNote(r.message)))
      .catch((err: unknown) => setScanNote(err instanceof Error ? err.message : 'The scans could not be added.'));
  };
  const frameNoById = new Map(frames.map((f) => [f.id, f.frameNo]));
  // Frames are checked against the roll's camera: logging needs it to be the loadout's camera.
  const capability = loadout?.body.capability;
  const gear: FrameGear | null =
    loadout && loadout.body.id === roll.bodyGearId && capability && 'modes' in capability ? { body: capability, lens: loadout.lens, lensGearId: loadout.lensGearId } : null;
  return (
    <Screen title={roll.stockName}>
      <TextLink title="Back" onPress={() => router.back()} />
      <Text className="text-text-muted">{`Rated ISO ${roll.ratedIso} · ${pushPullText(roll.boxIso, roll.ratedIso)}`}</Text>
      {loaded && left > 0 ? <Text className="text-lg font-semibold text-text">{`Next frame ${nextFrameNo(roll, frames)} of ${roll.exposures} · ${left} left`}</Text> : null}
      {loaded && left > 0 && left <= 2 ? <Notice text={`${left} frame${left === 1 ? '' : 's'} left on this roll.`} /> : null}
      {loaded && left === 0 ? <Notice text="Roll full: finish it." /> : null}
      {addingFrame ? (
        gear ? (
          <FrameLogger roll={roll} frames={frames} gear={gear} defaults={defaultsFrom(params)} onSave={saveFrame} />
        ) : (
          <Notice text="Set your loadout to this roll's camera to log frames." />
        )
      ) : null}
      {loaded ? (
        <>
          {gear ? (
            <FrameLogger roll={roll} frames={frames} gear={gear} defaults={defaultsFrom(params)} onSave={saveFrame} />
          ) : (
            <>
              <Notice text="Set your loadout to this roll's camera to log frames." />
              <TextLink title="Open the loadout" onPress={() => router.push('/me/loadout')} />
            </>
          )}
          <TextLink
            title="Finish roll"
            onPress={() => {
              setProblem(null);
              finish().catch((err: unknown) => setProblem(err instanceof Error ? err.message : 'This change could not be saved.'));
            }}
          />
          {problem ? <Notice tone="error" text={problem} /> : null}
        </>
      ) : (
        <Text className="text-text-muted">{roll.status === 'finished' ? 'This roll is finished.' : `This roll is ${roll.status}.`}</Text>
      )}
      <Text accessibilityRole="header" className="text-xl font-semibold text-text">
        Scans
      </Text>
      <PrimaryButton title="Add scans" onPress={addScans} busy={importing} />
      {scanNote ? <Notice text={scanNote} /> : null}
      {scans.error && !scans.data ? <ErrorState error={scans.error} onRetry={() => void scans.refetch()} /> : null}
      {waitingScans.map(({ body }) => (
        <View key={body.id} className="flex-row items-center gap-3">
          <ScanThumb id={body.id} file={body.file} />
          <Text className="text-text-muted">Waiting to upload</Text>
        </View>
      ))}
      {(scans.data?.scans ?? []).map((s) => (
        <View key={s.id} className="flex-row items-center gap-3">
          <ScanThumb id={s.id} file={null} />
          <Text className="text-text">{s.frameId && frameNoById.has(s.frameId) ? `Frame ${frameNoById.get(s.frameId)}` : 'No frame yet'}</Text>
        </View>
      ))}
      {waitingScans.length + (scans.data?.scans.length ?? 0) > 0 ? <TextLink title="Pair scans with frames" onPress={() => router.push(`/roll/scans/${roll.id}`)} /> : null}
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
