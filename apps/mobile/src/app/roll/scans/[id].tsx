// Pair a film roll's scans with its frames. The scans are the ones just added (`ids`, in the
// order picked) or, with none given, the roll's scans that have no frame yet. Frames held by the
// roll's other scans are not offered. Save pairs queues the pairs after the scans' uploads.

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { useRollScans, useSaveScans, useWaitingPhotos } from '../../../data/photos';
import { useRoll } from '../../../data/shoot';
import { pairScans, swapTo } from '../../../lib/pair-scans';
import { Notice, PrimaryButton, Screen, TextLink } from '../../../ui/form';
import { ScanPairing } from '../../../ui/photos/ScanPairing';
import { Empty, ErrorState, isOffline, Loading, OfflineBanner } from '../../../ui/states';

export default function ScansScreen() {
  const params = useLocalSearchParams<{ id: string; ids?: string }>();
  const rollId = params.id;
  const rollView = useRoll(rollId);
  const scans = useRollScans(rollId);
  const waiting = useWaitingPhotos();
  const save = useSaveScans(rollId);
  const [swaps, setSwaps] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const files = useMemo(
    () => new Map(waiting.filter((w) => w.body.source === 'scan' && w.body.rollId === rollId).map((w) => [w.body.id, w.body.file])),
    [waiting, rollId],
  );
  const ready = useMemo(() => scans.data?.scans ?? [], [scans.data]);
  const scanIds = useMemo(
    () => (params.ids ? params.ids.split(',').filter(Boolean) : [...ready.filter((s) => !s.frameId).map((s) => s.id), ...files.keys()]),
    [params.ids, ready, files],
  );
  const logged = useMemo(() => rollView.frames.map((f) => f.frameNo), [rollView.frames]);
  const taken = useMemo(() => {
    const noById = new Map(rollView.frames.map((f) => [f.id, f.frameNo]));
    return ready.flatMap((s) => (s.frameId && !scanIds.includes(s.id) && noById.has(s.frameId) ? [noById.get(s.frameId)!] : []));
  }, [ready, rollView.frames, scanIds]);
  const pairs = useMemo(() => pairScans(logged, taken, scanIds, swaps), [logged, taken, scanIds, swaps]);

  if (!rollView.roll || (scans.isPending && !scans.data)) {
    return (
      <Screen title="Pair scans">
        <TextLink title="Back" onPress={() => router.back()} />
        {rollView.isPending || scans.isPending ? <Loading label="Loading the roll…" /> : <ErrorState error={rollView.error} onRetry={() => void rollView.refetch()} />}
      </Screen>
    );
  }

  const used = new Set([...taken, ...pairs.flatMap((p) => (p.frameNo === null ? [] : [p.frameNo]))]);
  const freeFrames = [...logged].sort((a, b) => a - b).filter((no) => !used.has(no));
  const last = Math.max(0, ...logged);
  const addFrameNos = new Map(pairs.filter((p) => p.frameNo === null).map((p, k) => [p.photoId, last + 1 + k]));

  const pickFrame = (frameNo: number) => {
    if (!selected) return;
    setSwaps(swapTo(pairs, selected, frameNo));
    setSelected(null);
  };

  const onSave = async () => {
    setProblem(null);
    setBusy(true);
    try {
      await save(pairs);
      router.back();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'The pairs could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Pair scans">
      <TextLink title="Back" onPress={() => router.back()} />
      {scans.error && isOffline(scans.error) ? <OfflineBanner onRetry={() => void scans.refetch()} /> : null}
      {scans.error && !isOffline(scans.error) ? <ErrorState error={scans.error} onRetry={() => void scans.refetch()} /> : null}
      {pairs.length === 0 ? (
        <Empty title="No scans to pair" hint="Add scans from the roll screen." />
      ) : (
        <>
          <ScanPairing
            pairs={pairs}
            files={files}
            freeFrames={freeFrames}
            addFrameNos={addFrameNos}
            selected={selected}
            onSelectScan={(id) => setSelected((now) => (now === id ? null : id))}
            onPickFrame={pickFrame}
            onAddFrame={(no) => router.push(`/roll/${rollId}?frameNo=${no}&returnTo=scans`)}
          />
          {problem ? <Notice tone="error" text={problem} /> : null}
          <PrimaryButton title="Save pairs" onPress={() => void onSave()} busy={busy} />
        </>
      )}
    </Screen>
  );
}
