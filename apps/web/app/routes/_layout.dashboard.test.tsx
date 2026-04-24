import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import DashboardPage from './_layout.dashboard';
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
  workspaces: [{ id: 'w1', name: 'Test Workspace', slug: 'test', role: 'OWNER', color: '#5E6AD2' }],
  activeWorkspace: { id: 'w1', name: 'Test Workspace', slug: 'test', role: 'OWNER', color: '#5E6AD2' },
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ volume: [], levels: [], services: [], hosts: [], total24h: 0 }),
    text: () => Promise.resolve(''),
  }));
});

describe('DashboardPage empty state', () => {
  it('offers add source and add integration actions', () => {
    renderWithProviders(<DashboardPage />);

    waitFor(() => {
      expect(screen.getByRole('button', { name: /add source/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add integration/i })).toBeInTheDocument();
    });
  });
});
