import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchApi } from './api';
import { useAuth } from './auth-client';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  color?: string;
  inviteCode?: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (w: Workspace) => void;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = (await fetchApi('/workspaces')) || [];
      setWorkspaces(data);
      if (data.length > 0) {
        const saved = localStorage.getItem('piglog:activeWorkspace');
        const match = saved ? data.find((w: Workspace) => w.id === saved) : null;
        if (saved && !match) {
          localStorage.removeItem('piglog:activeWorkspace');
        }
        setActiveWorkspace(match || data[0]);
      } else {
        localStorage.removeItem('piglog:activeWorkspace');
        setActiveWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      localStorage.removeItem('piglog:activeWorkspace');
      setIsLoading(false);
      return;
    }

    void refreshWorkspaces();
  }, [authLoading, refreshWorkspaces, user]);

  function handleSetActive(w: Workspace) {
    setActiveWorkspace(w);
    localStorage.setItem('piglog:activeWorkspace', w.id);
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspace, setActiveWorkspace: handleSetActive, isLoading, refreshWorkspaces }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
