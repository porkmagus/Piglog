import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchApi } from './api';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (w: Workspace) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchApi('/workspaces');
        setWorkspaces(data);
        if (data.length > 0) {
          const saved = localStorage.getItem('piglog:activeWorkspace');
          const match = saved ? data.find((w: Workspace) => w.id === saved) : null;
          setActiveWorkspace(match || data[0]);
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function handleSetActive(w: Workspace) {
    setActiveWorkspace(w);
    localStorage.setItem('piglog:activeWorkspace', w.id);
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspace, setActiveWorkspace: handleSetActive, isLoading }}
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
