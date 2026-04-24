import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

function renderRoute(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, options);
}

export { renderRoute };
