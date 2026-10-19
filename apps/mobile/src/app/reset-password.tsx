// Opened by the password-reset email link (Android App Link for
// https://myfoto.topues.com/reset-password). Reachable signed in or out.

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { completeReset, parseRecoveryLink } from '../auth/actions';
import { getSupabase } from '../auth/supabase';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../ui/form';
import { Loading } from '../ui/states';

export default function ResetPassword() {
  const live = Linking.useLinkingURL();
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (live) setUrl(live);
    else Linking.getInitialURL().then((u) => setUrl((prev) => prev ?? u)).catch(() => setUrl(null));
  }, [live]);

  if (url === undefined) return <Loading />;
  const valid = url ? parseRecoveryLink(url) !== null : false;

  if (!valid || expired) {
    return (
      <Screen title="Link expired">
        <Notice tone="error" text="This reset link has expired or was already used. Ask for a new one." />
        <PrimaryButton title="Ask for a new link" onPress={() => router.replace('/forgot-password')} />
        <TextLink title="Back to sign in" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const out = await completeReset(getSupabase()!.auth, url!, password, confirm);
    setBusy(false);
    if (out.ok) router.replace({ pathname: '/sign-in', params: { changed: '1' } });
    else if (out.next === 'expired') setExpired(true);
    else setError(out.message);
  };

  return (
    <Screen title="New password">
      <Text className="text-text-muted">Choose a new password. You then sign in with it.</Text>
      {error ? <Notice tone="error" text={error} /> : null}
      <Field label="New password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Field label="New password again" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      <PrimaryButton title="Save the new password" onPress={submit} busy={busy} />
    </Screen>
  );
}
