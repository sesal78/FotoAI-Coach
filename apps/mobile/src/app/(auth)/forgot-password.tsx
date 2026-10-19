import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { requestReset } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink, useAction } from '../../ui/form';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, setError, run } = useAction();

  const submit = () =>
    run(async () => {
      setSent(null);
      const out = await requestReset(getSupabase()!.auth, email);
      if (out.ok) setSent(out.message);
      else setError(out.message);
    });

  return (
    <Screen title="Reset your password">
      <Text className="text-text-muted">We email you a link. Open it on this phone to set a new password in the app.</Text>
      {sent ? <Notice tone="success" text={sent} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <PrimaryButton title="Send the link" onPress={submit} busy={busy} />
      <TextLink title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
