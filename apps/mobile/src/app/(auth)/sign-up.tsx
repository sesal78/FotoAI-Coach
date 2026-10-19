import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { MIN_PASSWORD, signUp } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const out = await signUp(getSupabase()!.auth, email, password, confirm);
    setBusy(false);
    if (out.ok) router.replace({ pathname: '/check-email', params: { email: email.trim().toLowerCase() } });
    else setError(out.message);
  };

  return (
    <Screen title="Create an account">
      <Text className="text-text-muted">We email you a link to confirm the address.</Text>
      {error ? <Notice tone="error" text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label={`Password (at least ${MIN_PASSWORD} characters)`} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Field label="Password again" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      <PrimaryButton title="Create account" onPress={submit} busy={busy} />
      <TextLink title="I already have an account" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
