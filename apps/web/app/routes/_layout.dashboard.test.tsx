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

beforeEach(() => {
  const mockResponse = {
    ok: true,
    status: 200,
    headers: { get: vi.fn().mockReturnValue('application/json') },
    json: () => Promise.resolve({ volume: [], levels: [], services: [], hosts: [], total24h: 0 }),
    text: () => Promise.resolve(''),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
});

describe('DashboardPage empty state', () => {
  it('offers add source and add integration actions', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add source/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add integration/i })).toBeInTheDocument();
    });
  });
});
