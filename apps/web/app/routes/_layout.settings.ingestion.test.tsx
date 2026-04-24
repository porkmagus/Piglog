import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import IngestionPage from './_layout.settings.ingestion';
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

describe('IngestionPage', () => {
  it('explains the difference between sources and integrations', () => {
    renderWithProviders(<IngestionPage />);

    expect(screen.getByText(/systems that send logs to piglog/i)).toBeInTheDocument();
    expect(screen.getByText(/services piglog connects to and syncs from/i)).toBeInTheDocument();
  });

  it('renders add source and add integration actions', () => {
    renderWithProviders(<IngestionPage />);

    expect(screen.getByRole('link', { name: /add source/i })).toHaveAttribute('href', '/settings/sources');
    expect(screen.getByRole('link', { name: /add integration/i })).toHaveAttribute('href', '/settings/integrations');
  });
});
