import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { LinksFunction } from 'react-router';
import './tailwind.css';
import { AuthProvider } from './lib/auth-client';
import { WorkspaceProvider } from './lib/workspace';
import CommandPalette from './components/command-palette';
import { useCommandPalette } from './components/command-palette';
import WorkspaceGuard from './components/workspace-guard';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=DotGothic16&family=Space+Grotesk:ital,wght@0,400..700;1,400..700&display=swap',
  },
];

function CommandPaletteWrapper() {
  const { open, setOpen } = useCommandPalette();
  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-[#0D0D0D] text-gray-100 antialiased">
        <AuthProvider>
          <WorkspaceProvider>
            <WorkspaceGuard>
              {children}
              <CommandPaletteWrapper />
            </WorkspaceGuard>
          </WorkspaceProvider>
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
