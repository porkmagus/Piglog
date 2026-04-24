import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderRoute(ui: ReactElement) {
  return render(ui);
}
