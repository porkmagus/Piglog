import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import AppLayout from './_layout';
import { renderRoute } from '../test/render';
import { MockAuthProvider, MockWorkspaceProvider } from '../test/providers';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...(actual as object),
    useNavigate: () => vi.fn(),
  };
});

describe('AppLayout', () => {
  const wrapWithProviders = (ui: React.ReactNode) => (
    <MockAuthProvider>
      <MockWorkspaceProvider>
        {ui}
      </MockWorkspaceProvider>
    </MockAuthProvider>
  );

  it('shows a workspace switcher without a fake chevron-only action', () => {
    renderRoute(
      wrapWithProviders(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      )
    );

    expect(screen.getByText('Piglog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace switcher/i })).toBeInTheDocument();
  });

  it('renders the user account area as a link to account settings', () => {
    renderRoute(
      wrapWithProviders(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      )
    );

    expect(screen.getByRole('link', { name: /account settings/i })).toHaveAttribute('href', '/settings/account');
  });
});
