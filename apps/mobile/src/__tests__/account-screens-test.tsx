import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ResetPassword from '../app/reset-password';
import SignIn from '../app/(auth)/sign-in';
import { ThemeProvider } from '../ui/ThemeProvider';

const LINK = 'https://myfoto.topues.com/reset-password#access_token=at-1&refresh_token=rt-1&expires_in=3600&type=recovery';
const mockAuth = {
  setSession: jest.fn(async () => ({ data: {}, error: null })),
  updateUser: jest.fn(async () => ({ data: {}, error: null })),
  signOut: jest.fn(async () => ({ error: null })),
  signInWithPassword: jest.fn(),
};

jest.mock('../auth/supabase', () => ({ getSupabase: () => ({ auth: mockAuth }) }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({}) }));
const mockRouter = (jest.requireMock('expo-router') as { router: { replace: jest.Mock } }).router;
jest.mock('expo-linking', () => ({
  useLinkingURL: () => 'https://myfoto.topues.com/reset-password#access_token=at-1&refresh_token=rt-1&expires_in=3600&type=recovery',
  getInitialURL: async () => null,
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider initial="golden">{ui}</ThemeProvider>;

beforeEach(() => jest.clearAllMocks());

test('after a new password is saved, the screen says so and offers sign-in (no lost navigation)', async () => {
  await render(wrap(<ResetPassword />));
  await fireEvent.changeText(await screen.findByLabelText('New password (at least 8 characters)'), 'brand-new-pw');
  await fireEvent.changeText(screen.getByLabelText('New password again'), 'brand-new-pw');
  await act(async () => await fireEvent.press(screen.getByText('Save the new password')));
  expect(await screen.findByText('Password changed')).toBeTruthy();
  expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pw' });
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => await fireEvent.press(screen.getByText('Sign in')));
  expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  expect(LINK).toContain('type=recovery');
});

test('a sign-in that throws shows a message and frees the button', async () => {
  mockAuth.signInWithPassword.mockRejectedValue(new Error('Could not encrypt the data'));
  await render(wrap(<SignIn />));
  await fireEvent.changeText(screen.getByLabelText('Email'), 'seun@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
  await act(async () => await fireEvent.press(screen.getByText('Sign in')));
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(screen.getByText('Sign in')).toBeTruthy(); // the label is back: not stuck on the spinner
});
