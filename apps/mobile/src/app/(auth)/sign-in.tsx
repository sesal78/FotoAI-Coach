import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { signIn } from '../../auth/actions';
import { getSupabase } from '../../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink, useAction } from '../../ui/form';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useAction();

  const submit = () =>
    run(async () => {
      const out = await signIn(getSupabase()!.auth, email, password);
      // On success the session listener moves the app to the tabs.
      if (!out.ok) setError(out.message);
    });

  return (
    <Screen title="FotoAI">
      <Text className="text-text-muted">Sign in to plan your next shoot.</Text>
      {error ? <Notice tone="error" text={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <PrimaryButton title="Sign in" onPress={submit} busy={busy} />
      <TextLink title="Forgot password?" onPress={() => router.push('/forgot-password')} />
      <TextLink title="Create an account" onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
