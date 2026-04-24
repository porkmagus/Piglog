import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '~/lib/auth-client';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Piglog</h1>
          <p className="text-sm text-[#8A8F98]">
            {isSignup ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E6AD2]"
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4f5ab8] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8A8F98]">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-[#5E6AD2] hover:underline"
          >
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
