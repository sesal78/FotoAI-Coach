// The Coach button floats on every signed-in screen (the tabs, and the plan, roll, place, spot and
// photo screens), never on sign-in, onboarding or the password reset. It opens the coach chat,
// which knows the screen it was opened from.

import { useGlobalSearchParams, usePathname } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable } from 'react-native';

import { CoachSheet } from './coach/CoachSheet';
import { useTheme } from './ThemeProvider';

/** Room to leave on the right of a screen's last row, so the floating button sits beside it (56 pt button, 12 pt gap). */
export const COACH_CLEARANCE = 68;

const HIDDEN = ['/onboarding', '/reset-password'];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function CoachButton() {
  const pathname = usePathname();
  const raw = useGlobalSearchParams<Record<string, string | string[]>>();
  const [open, setOpen] = useState(false);
  const { tokens } = useTheme();
  if (pathname === '/' || HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, one(v)]));
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the coach"
        onPress={() => setOpen(true)}
        className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-pill bg-primary"
      >
        <MessageCircle color={tokens.colors.onPrimary} size={26} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        {open ? <CoachSheet pathname={pathname} params={params} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}
