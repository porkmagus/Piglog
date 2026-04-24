import { Outlet, Link } from 'react-router';
import { useAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { LayoutDashboard, Radio, Settings, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';

export default function AppLayout() {
  const { user } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-[#2A2A2A] bg-[#0D0D0D] flex flex-col">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[#2A2A2A]">
          <div className="w-5 h-5 rounded bg-[#5E6AD2]" />
          <span className="text-[#E8E8E8] text-sm" style={{ fontFamily: 'DotGothic16, sans-serif', fontWeight: 400 }}>🐖 Piglog 🐖</span>
        </div>

        {/* Workspace Switcher */}
        <div className="px-3 py-2 border-b border-[#2A2A2A]">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[#8A8F98]">
            Workspace
          </div>
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu((value) => !value)}
            aria-label="Workspace switcher"
            className="mt-1 flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm hover:bg-[#151515] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: activeWorkspace?.color || '#5E6AD2' }}
              />
              <span className="truncate font-medium">{activeWorkspace?.name || 'No workspace'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98] flex-shrink-0" />
          </button>

          {showWorkspaceMenu && (
            <div className="mt-1 rounded-md border border-[#2A2A2A] bg-[#151515] overflow-hidden">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setShowWorkspaceMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm transition-colors ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                      : 'text-gray-300 hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: '#5E6AD2' }}
                  />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/streams"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Radio className="w-4 h-4" />
            Streams
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>

        <div className="border-t border-[#2A2A2A] p-2">
          <Link
            to="/settings/account"
            aria-label="Account settings"
            className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#151515]"
          >
            <span className="text-sm truncate" title={user?.email}>{user?.email?.split('@')[0]}</span>
            <SettingsIcon className="w-4 h-4 text-[#8A8F98]" />
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0D0D0D]">
        <Outlet />
      </main>
    </div>
  );
}
