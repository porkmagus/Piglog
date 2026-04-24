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
    json: () => Promise.resolve({ widgets: [], isPersonal: false }),
    text: () => Promise.resolve(''),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
});

describe('DashboardPage empty state', () => {
  it('shows edit dashboard button and empty message', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/no widgets on your dashboard/i)).toBeInTheDocument();
    });
  });
});
