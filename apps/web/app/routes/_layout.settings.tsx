import { NavLink, Outlet } from 'react-router';
import { UserCircle2, Radio, Bell, Users, Settings, Inbox } from 'lucide-react';

const navItems = [
  { to: '/settings/account', label: 'Account', icon: UserCircle2 },
  { to: '/settings/workspace', label: 'Workspace', icon: Settings },
  { to: '/settings/ingestion', label: 'Ingestion', icon: Inbox },
  { to: '/settings/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings/team', label: 'Team', icon: Users },
];

export default function SettingsLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-48 flex-shrink-0 border-r border-[#2A2A2A] bg-[#0D0D0D] p-2">
        <div className="text-xs font-medium text-[#8A8F98] px-2 py-1.5 uppercase tracking-wider">
          Settings
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[#151515] text-gray-100'
                    : 'text-[#8A8F98] hover:bg-[#151515] hover:text-gray-200'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
