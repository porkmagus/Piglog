import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useWorkspace } from '~/lib/workspace';
import { Search, LayoutDashboard, Radio, Settings, FileText, Keyboard, Zap, LogOut } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { activeWorkspace, workspaces } = useWorkspace();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      shortcut: 'G D',
      action: () => { navigate('/dashboard'); onClose(); },
    },
    {
      id: 'streams',
      label: 'Go to Streams',
      icon: <Radio className="w-4 h-4" />,
      shortcut: 'G S',
      action: () => { navigate('/streams'); onClose(); },
    },
    {
      id: 'sources',
      label: 'Go to Sources',
      icon: <FileText className="w-4 h-4" />,
      action: () => { navigate('/settings/sources'); onClose(); },
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => { navigate('/settings'); onClose(); },
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      shortcut: '?',
      action: () => { onClose(); alert('Keyboard shortcuts coming soon!'); },
    },
    ...workspaces.map((ws) => ({
      id: `workspace-${ws.id}`,
      label: `Switch to ${ws.name}`,
      icon: <Zap className="w-4 h-4" />,
      action: () => { onClose(); },
    })),
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) cmd.action();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-[#2A2A2A] bg-[#151515] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-12 border-b border-[#2A2A2A]">
          <Search className="w-4 h-4 text-[#8A8F98]" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder:text-[#8A8F98] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8A8F98] bg-[#0D0D0D] border border-[#2A2A2A]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[#8A8F98] text-center">No results found</div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex ? 'bg-[#5E6AD2]/10 text-gray-100' : 'text-[#8A8F98] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {cmd.icon}
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8A8F98] bg-[#0D0D0D] border border-[#2A2A2A]">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
