import { Redirect } from 'expo-router';

import { useSession } from '../auth/session';

export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === 'signed_in' ? '/today' : '/sign-in'} />;
}
