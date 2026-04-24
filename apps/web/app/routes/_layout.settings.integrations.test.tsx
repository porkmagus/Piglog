import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import IntegrationsPage from './_layout.settings.integrations';
import { renderRoute } from '../test/render';
import { AuthContext } from '../lib/auth-client';
import { WorkspaceContext } from '../lib/workspace';

const mockAuthContext = {
  user: { id: 'u1', email: 'test@example.com', name: 'Test', image: null },
  isLoading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

const mockWorkspaceContext = {
  workspaces: [{ id: 'w1', name: 'Test Workspace', slug: 'test', role: 'OWNER', color: '#F09040' }],
  activeWorkspace: { id: 'w1', name: 'Test Workspace', slug: 'test', role: 'OWNER', color: '#F09040' },
  setActiveWorkspace: vi.fn(),
  isLoading: false,
  refreshWorkspaces: vi.fn(),
};

function renderWithProviders(ui: React.ReactElement) {
  return renderRoute(
    <MemoryRouter>
      <AuthContext.Provider value={mockAuthContext}>
        <WorkspaceContext.Provider value={mockWorkspaceContext}>
          {ui}
        </WorkspaceContext.Provider>
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
