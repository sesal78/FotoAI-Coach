import { render, screen } from '@testing-library/react-native';

import Home from '../index';

test('the start screen renders', async () => {
  await render(<Home />);
  expect(screen.getByText('FotoAI')).toBeTruthy();
});
