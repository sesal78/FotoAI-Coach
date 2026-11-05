// The coach chat: the history (oldest first), a message field (at most 2000 characters) and Send.
// Each message carries the screen it was sent from (see coach-context.ts). With no signal, Send
// says "Needs a signal" and the history loaded before still shows. Clear history (in the menu)
// asks first.

import { MoreHorizontal, X } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClearCoach, useCoachHistory, useSendCoach } from '../../data/coach';
import { useRolls } from '../../data/shoot';
import { coachContext } from '../../lib/coach-context';
import { Notice } from '../form';
import { useIsOnline } from '../LastUpdated';
import { Empty, ErrorState, errorText, Loading } from '../states';
import { useTheme } from '../ThemeProvider';
import { Message } from './Message';

export const MAX_MESSAGE = 2000;

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} className="h-11 w-11 items-center justify-center">
      {children}
    </Pressable>
  );
}

export function CoachSheet({ pathname, params, onClose }: { pathname: string; params: Record<string, string | undefined>; onClose: () => void }) {
  const { tokens } = useTheme();
  const online = useIsOnline();
  const history = useCoachHistory();
  const send = useSendCoach();
  const clear = useClearCoach();
  const activeRollId = useRolls().rolls.find((r) => r.status === 'loaded')?.id;
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const message = text.trim();
  const tooLong = message.length > MAX_MESSAGE;
  const canSend = online && !send.isPending && message.length > 0 && !tooLong;
  const messages = history.data?.messages ?? [];

  const onSend = () => {
    if (!canSend) return;
    send.mutate({ message, context: coachContext(pathname, params, activeRollId) }, { onSuccess: () => setText('') });
  };

  const askClear = () => {
    setMenu(false);
    Alert.alert('Clear the coach history?', 'The coach forgets this chat. You cannot undo this.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear.mutate() },
    ]);
  };

  const sendTitle = !online ? 'Needs a signal' : send.isPending ? 'Sending…' : 'Send';
  const problem = send.error ?? clear.error;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text accessibilityRole="header" className="text-2xl font-bold text-text">
            Coach
          </Text>
          <View className="flex-row">
            <IconButton label="Coach menu" onPress={() => setMenu((m) => !m)}>
              <MoreHorizontal color={tokens.colors.text} size={24} />
            </IconButton>
            <IconButton label="Close the coach" onPress={onClose}>
              <X color={tokens.colors.text} size={24} />
            </IconButton>
          </View>
        </View>
        {menu ? (
          <View className="mx-4 rounded-md bg-surface p-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Clear history" onPress={askClear} className="px-3 py-3">
              <Text className="font-semibold text-danger">Clear history</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-3 p-4" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {history.isPending ? <Loading label="Loading the chat…" /> : null}
          {history.isError && !history.data ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : null}
          {history.data && messages.length === 0 ? <Empty title="No messages yet" hint="Ask about a place, a plan, your gear or a photo." /> : null}
          {messages.map((m) => (
            <Message key={m.id} message={m} onOpen={onClose} />
          ))}
          {send.isPending ? <Text className="text-text-muted">The coach is thinking…</Text> : null}
        </ScrollView>

        <View className="gap-2 border-t border-border px-4 py-3">
          {problem ? <Notice tone="error" text={errorText(problem)} /> : null}
          <TextInput
            accessibilityLabel="Message to the coach"
            value={text}
            onChangeText={setText}
            placeholder="Ask the coach"
            placeholderTextColor={tokens.colors.textMuted}
            multiline
            className="max-h-32 rounded-md border border-border bg-surface px-4 py-3 text-base text-text"
          />
          <View className="flex-row items-center justify-between gap-3">
            <Text className={tooLong ? 'text-danger' : 'text-text-muted'}>{tooLong ? `${message.length}/${MAX_MESSAGE}: make it shorter` : `${message.length}/${MAX_MESSAGE}`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sendTitle}
              accessibilityState={{ disabled: !canSend, busy: send.isPending }}
              disabled={!canSend}
              onPress={onSend}
              className={`min-h-11 items-center justify-center rounded-pill px-5 py-2 ${canSend || send.isPending ? 'bg-primary' : 'bg-surface-alt'}`}
            >
              <Text className={`font-semibold ${canSend || send.isPending ? 'text-on-primary' : 'text-text-muted'}`}>{sendTitle}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
