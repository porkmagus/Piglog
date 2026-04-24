import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import IntegrationsPage from './_layout.settings.integrations';
import { renderRoute } from '../test/render';
import { AuthContext } from '../lib/auth-client';

const mockAuthContext = {
  user: { id: 'u1', email: 'test@example.com', name: 'Test', image: null },
  isLoading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

function renderWithProviders(ui: React.ReactElement) {
  return renderRoute(
    <MemoryRouter>
      <AuthContext.Provider value={mockAuthContext}>
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('IntegrationsPage', () => {
  it('renders NextDNS as a connect option and explains pull-based sync', () => {
    renderWithProviders(<IntegrationsPage />);

    expect(screen.getByText(/piglog connects to external services and syncs logs/i)).toBeInTheDocument();
    expect(screen.getByText(/connect nextdns/i)).toBeInTheDocument();
  });
});
