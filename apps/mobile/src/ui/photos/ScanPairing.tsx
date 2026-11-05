// Scans beside frames: scan n beside the frame it is paired with. Tap a scan, then a frame (in
// another row, or a free one), to move it there; the scan that had that frame takes its place.
// A scan with no frame says "No frame logged", with Add frame N.

import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ScanPair } from '../../lib/pair-scans';
import { TextLink } from '../form';
import { PhotoImage } from './PhotoImage';

const THUMB = 64;

/** A scan's picture: from FotoAI when it is uploaded, from the phone while it waits. */
export function ScanThumb({ id, file }: { id: string; file: string | null }): ReactNode {
  const style = { width: THUMB, height: THUMB, borderRadius: 6 };
  return file ? <Image source={{ uri: file }} style={style} contentFit="cover" cachePolicy="none" /> : <PhotoImage id={id} label="A scan" style={style} />;
}

export function ScanPairing({
  pairs,
  files,
  freeFrames,
  addFrameNos,
  selected,
  onSelectScan,
  onPickFrame,
  onAddFrame,
}: {
  pairs: ScanPair[];
  /** The phone file of each scan still waiting to upload. */
  files: Map<string, string>;
  freeFrames: number[];
  /** For each scan with no frame, the number Add frame offers. */
  addFrameNos: Map<string, number>;
  selected: string | null;
  onSelectScan: (photoId: string) => void;
  onPickFrame: (frameNo: number) => void;
  onAddFrame: (frameNo: number) => void;
}) {
  const selectedNo = pairs.findIndex((p) => p.photoId === selected) + 1;
  return (
    <View className="gap-3">
      <Text className="text-text-muted">{selected ? `Now tap a frame for scan ${selectedNo}.` : 'Tap a scan, then a frame, to swap them.'}</Text>
      {pairs.map((pair, i) => {
        const isSelected = pair.photoId === selected;
        return (
          <View key={pair.photoId} className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Scan ${i + 1}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectScan(pair.photoId)}
              className={`flex-row items-center gap-2 rounded-lg p-1 ${isSelected ? 'bg-primary' : 'bg-surface'}`}
            >
              <ScanThumb id={pair.photoId} file={files.get(pair.photoId) ?? null} />
              <Text className={isSelected ? 'font-semibold text-on-primary' : 'text-text'}>{`Scan ${i + 1}`}</Text>
            </Pressable>
            {pair.frameNo !== null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Frame ${pair.frameNo} for scan ${i + 1}`}
                onPress={() => onPickFrame(pair.frameNo!)}
                className="flex-1 rounded-lg border border-border px-3 py-3"
              >
                <Text className="font-semibold text-text">{`Frame ${pair.frameNo}`}</Text>
              </Pressable>
            ) : (
              <View className="flex-1 gap-1">
                <Text className="text-text-muted">No frame logged</Text>
                <TextLink title={`Add frame ${addFrameNos.get(pair.photoId)}`} onPress={() => onAddFrame(addFrameNos.get(pair.photoId)!)} />
              </View>
            )}
          </View>
        );
      })}
      {freeFrames.length > 0 ? (
        <View className="gap-2">
          <Text className="font-semibold text-text">Free frames</Text>
          <View className="flex-row flex-wrap gap-2">
            {freeFrames.map((no) => (
              <Pressable key={no} accessibilityRole="button" accessibilityLabel={`Free frame ${no}`} onPress={() => onPickFrame(no)} className="rounded-pill border border-border px-3 py-2">
                <Text className="text-text">{`Frame ${no}`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
