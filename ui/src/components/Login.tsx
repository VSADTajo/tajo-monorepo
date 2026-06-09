import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginApi(user, password);
      login(result);
      navigate('/');
    } catch {
      setError('Credenciales incorrectas. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center relative px-4 sm:px-6">
      <h1 className="absolute top-16 sm:top-24 md:top-28 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-blue-600 tracking-tight">
        Tajo Backoffice
      </h1>
      <div className="w-full max-w-md">
        {/* Login modal / card */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4 sm:space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="user" className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Usuario
              </label>
              <input
                id="user"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Usuario"
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 pr-12 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-blue-600/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4 sm:mt-6">
          Tajo · Panel de monitoreo
        </p>
      </div>
    </div>
  );
}
