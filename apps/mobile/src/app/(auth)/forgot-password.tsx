import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { requestReset } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setSent((await requestReset(getSupabase()!.auth, email)).message);
    setBusy(false);
  };

  return (
    <Screen title="Reset your password">
      <Text className="text-text-muted">We email you a link. Open it on this phone to set a new password in the app.</Text>
      {sent ? <Notice tone="success" text={sent} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <PrimaryButton title="Send the link" onPress={submit} busy={busy} />
      <TextLink title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
