import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';
import { Navigate } from 'react-router';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/auth',
  fetchOptions: {
    credentials: 'include',
  },
});

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void checkSession();
  }, []);

  async function checkSession() {
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || null,
          image: data.user.image || null,
        });
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: `${window.location.origin}/dashboard`,
    });
    if (error) throw new Error(error.message || 'Login failed');
    if (data?.user) setUser({ id: data.user.id, email: data.user.email, name: data.user.name || null, image: data.user.image || null });
  }

  async function signup(email: string, password: string, name: string) {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: `${window.location.origin}/dashboard`,
    });
    if (error) throw new Error(error.message || 'Signup failed');
    if (data?.user) setUser({ id: data.user.id, email: data.user.email, name: data.user.name || null, image: data.user.image || null });
  }

  async function logout() {
    await authClient.signOut();
    setUser(null);
    localStorage.removeItem('piglog:activeWorkspace');
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = typeof window !== 'undefined' ? window.location.pathname : '';
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2A2A2A] border-t-[#5E6AD2]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
