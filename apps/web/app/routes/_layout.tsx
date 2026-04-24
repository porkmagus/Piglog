import { Outlet, Link } from 'react-router';
import { useAuth } from '~/lib/auth-client';
import { useWorkspace } from '~/lib/workspace';
import { LayoutDashboard, Radio, Settings, Inbox, Plug, Puzzle, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

function GlitchMarquee() {
  const ref = useRef<HTMLSpanElement>(null);
  const offsetRef = useRef(0);
  const directionRef = useRef(-1);
  const glitchRef = useRef(0);

  useEffect(() => {
    const unit = 240;
    const minOffset = -unit;
    const maxOffset = 0;

    const interval = setInterval(() => {
      if (glitchRef.current > 0) {
        glitchRef.current--;
        if (ref.current) {
          const dx = (Math.random() - 0.5) * 16;
          const skew = (Math.random() - 0.5) * 10;
          const op = Math.random() > 0.4 ? 1 : 0.3;
          ref.current.style.transform = `translateX(${offsetRef.current + dx}px) skewX(${skew}deg)`;
          ref.current.style.opacity = String(op);
        }
      } else {
        offsetRef.current += directionRef.current * 8;
        if (offsetRef.current <= minOffset) {
          offsetRef.current = minOffset;
          directionRef.current = 1;
        } else if (offsetRef.current >= maxOffset) {
          offsetRef.current = maxOffset;
          directionRef.current = -1;
        }
        if (Math.random() < 0.04) {
          glitchRef.current = 2 + Math.floor(Math.random() * 4);
        }
        if (ref.current) {
          ref.current.style.transform = `translateX(${offsetRef.current}px)`;
          ref.current.style.opacity = '1';
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-10 flex items-center overflow-hidden relative">
      <span
        ref={ref}
        className="absolute whitespace-nowrap text-[#E8E8E8]"
        style={{
          fontFamily: 'DotGothic16, sans-serif',
          fontWeight: 400,
          fontSize: 20,
          willChange: 'transform, opacity',
        }}
      >
        {'🐖 piglog 🐗 piglog 🥓 piglog 🐽 piglog 🐖 piglog 🐗 piglog 🥓 piglog 🐽 piglog '.repeat(2)}
      </span>
    </div>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [ingestionExpanded, setIngestionExpanded] = useState(() => {
    try {
      return localStorage.getItem('sidebar-ingestion-expanded') === 'true';
    } catch {
      return false;
    }
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-[#2A2A2A] bg-[#0D0D0D] flex flex-col">
        <div className="w-full border-b border-[#2A2A2A]">
          <GlitchMarquee />
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
