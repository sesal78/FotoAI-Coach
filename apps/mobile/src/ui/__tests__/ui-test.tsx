import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ApiClientError } from '../../lib/api';
import { Field, Screen } from '../form';
import { ErrorState } from '../states';
import { ThemeProvider, useTheme } from '../ThemeProvider';

// The module object form.tsx reads KeyboardAvoidingView from, so the test can watch its props.
const RN = jest.requireActual('react-native') as typeof import('react-native');
const wrap = (ui: React.ReactElement) => <ThemeProvider initial="golden">{ui}</ThemeProvider>;

test('ErrorState shows the message and Retry calls the query again', async () => {
  const retry = jest.fn();
  await render(wrap(<ErrorState error={new ApiClientError('validation', 400, 'Set your loadout first')} onRetry={retry} />));
  expect(screen.getByText('Set your loadout first')).toBeTruthy();
  await fireEvent.press(screen.getByText('Retry'));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('an offline error shows the offline banner, not a crash', async () => {
  await render(wrap(<ErrorState error={new ApiClientError('offline', 0, 'No connection')} onRetry={() => undefined} />));
  expect(screen.getByTestId('offline-banner')).toBeTruthy();
  expect(screen.getByText('You are offline. Saved items still work.')).toBeTruthy();
});

test('an unknown error shows a general message', async () => {
  await render(wrap(<ErrorState error={new Error('db password=hunter2')} />));
  expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(screen.queryByText(/hunter2/)).toBeNull();
});

function ThemeProbe() {
  const { theme, tokens, setSetting } = useTheme();
  return (
    <Text testID="probe" onPress={() => setSetting('camera')}>
      {`${theme} ${tokens.colors.bg} ${tokens.dialStyle}`}
    </Text>
  );
}

test('changing the theme setting re-colours the screen', async () => {
  await render(wrap(<ThemeProbe />));
  expect(screen.getByTestId('probe').props.children).toBe('golden #fbf5ec false');
  await act(async () => await fireEvent.press(screen.getByTestId('probe')));
  expect(screen.getByTestId('probe').props.children).toBe('camera #0f1012 true');
});

test('a Screen moves up out of the way of the keyboard (Android draws edge to edge, so it does not resize)', async () => {
  // Imported at the top: loading them inside the test made it time out under a full parallel run.
  const Real = RN.KeyboardAvoidingView;
  const behaviors: unknown[] = [];
  const spy = jest.spyOn(RN, 'KeyboardAvoidingView', 'get').mockReturnValue(((props: React.ComponentProps<typeof Real>) => {
    behaviors.push(props.behavior);
    return <Real {...props} />;
  }) as unknown as typeof Real);
  try {
    await render(wrap(<Screen title="Pin"><Field label="Pin notes" /></Screen>));
    expect(behaviors).toEqual(['padding']);
    expect(screen.getByLabelText('Pin notes')).toBeTruthy();
  } finally {
    spy.mockRestore();
  }
});
