import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { resendConfirmation } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Notice, PrimaryButton, Screen, TextLink, useAction } from '../../ui/form';

const COOLDOWN_S = 60;

export default function CheckEmail() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [wait, setWait] = useState(COOLDOWN_S);
  const [note, setNote] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const { busy, error, run } = useAction();

  const resend = () =>
    run(async () => {
      setNote(null);
      setWait(COOLDOWN_S);
      const out = await resendConfirmation(getSupabase()!.auth, email);
      setNote(out.ok ? { text: 'A new link is on its way.', tone: 'success' } : { text: out.message, tone: 'error' });
    });

  return (
    <Screen title="Check your email">
      <Text className="text-text">
        If {email || 'that address'} can be used, a confirmation link is on its way. Open it, then come back and sign in.
      </Text>
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      {wait > 0 ? <Text className="text-text-muted">You can ask for a new link in {wait} s.</Text> : <PrimaryButton title="Send the link again" onPress={resend} busy={busy} />}
      <TextLink title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
