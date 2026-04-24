import { AuthContext } from '~/lib/auth-client';
import { WorkspaceContext } from '~/lib/workspace';
import type { ReactNode } from 'react';

interface MockAuthProviderProps {
  user?: { id: string; email: string; name: string | null; image: string | null } | null;
  children: ReactNode;
}

export function MockAuthProvider({ user = { id: 'test', email: 'test@example.com', name: 'Test', image: null }, children }: MockAuthProviderProps) {
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: false,
        login: async () => {},
        signup: async () => {},
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

interface MockWorkspaceProviderProps {
  workspaces?: Array<{ id: string; name: string; slug: string; role: string; color?: string }>;
  activeWorkspace?: { id: string; name: string; slug: string; role: string; color?: string } | null;
  children: ReactNode;
}

export function MockWorkspaceProvider({
  workspaces = [{ id: 'ws1', name: 'Test Workspace', slug: 'test', role: 'owner', color: '#5E6AD2' }],
  activeWorkspace = { id: 'ws1', name: 'Test Workspace', slug: 'test', role: 'owner', color: '#5E6AD2' },
  children,
}: MockWorkspaceProviderProps) {
  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace: () => {},
        isLoading: false,
        refreshWorkspaces: async () => {},
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
