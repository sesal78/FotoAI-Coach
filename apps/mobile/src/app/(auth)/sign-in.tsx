import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { signIn } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';

export default function SignIn() {
  const { changed } = useLocalSearchParams<{ changed?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const out = await signIn(getSupabase()!.auth, email, password);
    setBusy(false);
    // On success the session listener moves the app to the tabs.
    if (!out.ok) setError(out.message);
  };

  return (
    <Screen title="FotoAI">
      <Text className="text-text-muted">Sign in to plan your next shoot.</Text>
      {changed ? <Notice tone="success" text="Password changed. Sign in with your new password." /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <PrimaryButton title="Sign in" onPress={submit} busy={busy} />
      <TextLink title="Forgot password?" onPress={() => router.push('/forgot-password')} />
      <TextLink title="Create an account" onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
