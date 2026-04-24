import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { renderRoute } from '../../test/render';
import { AuthContext } from '../../lib/auth-client';
import { WorkspaceContext } from '../../lib/workspace';
import { NextDnsConnectForm } from './nextdns-connect-form';

const mockFetchApi = vi.fn();
const mockNavigate = vi.fn();

vi.mock('~/lib/api', () => ({
  fetchApi: (...args: unknown[]) => mockFetchApi(...args),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('NextDnsConnectForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the page state after a successful connect', async () => {
    const onConnected = vi.fn();
    const user = userEvent.setup();

    mockFetchApi
      .mockResolvedValueOnce({
        entities: [
          { id: 'p1', name: 'Home' },
          { id: 'p2', name: 'Office' },
        ],
      })
      .mockResolvedValueOnce({ id: 'int_1' });

    renderWithProviders(<NextDnsConnectForm onConnected={onConnected} />);

    await user.type(screen.getByPlaceholderText('e.g. My NextDNS'), 'My NextDNS');
    await user.type(screen.getByPlaceholderText('Enter your NextDNS API key'), 'secret-key');
    await user.click(screen.getByRole('button', { name: 'Discover Profiles' }));

    await screen.findByText('Home');
    await user.click(screen.getByRole('button', { name: 'Connect 2 Profiles' }));

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('e.g. My NextDNS')).toHaveValue('');
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });
});
