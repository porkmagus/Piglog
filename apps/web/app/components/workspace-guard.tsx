import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useWorkspace } from '~/lib/workspace';
import { useAuth } from '~/lib/auth-client';

export default function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !workspaceLoading && user) {
      if (workspaces.length === 0) {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [authLoading, workspaceLoading, user, workspaces.length, navigate]);

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2A2A2A] border-t-[#5E6AD2]" />
      </div>
    );
  }

  return <>{children}</>;
}
