import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setInfo('');

    if (mode === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message || 'No se pudo iniciar sesión.');
      }

      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: 'https://obra-bi8tys4xa-facundos-projects-fd795dc8.vercel.app/app',
      },
    });

    if (signUpError) {
      setError(signUpError.message || 'No se pudo crear la cuenta.');
      setLoading(false);
      return;
    }

    if (data.session) {
      setInfo('Cuenta creada correctamente. Ingresando...');
    } else {
      setInfo('Cuenta creada. Revisá tu email para confirmar y luego iniciá sesión.');
      setMode('login');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
      >
        <h1 className="text-2xl font-bold text-white mb-2">{mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</h1>
        <p className="text-gray-400 mb-6">
          {mode === 'login' ? 'Accedé con tu email y contraseña.' : 'Creá tu cuenta con email y contraseña.'}
        </p>

        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        {info && <p className="text-green-400 text-sm mt-4">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`mt-6 w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
            loading ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          {loading
            ? mode === 'login'
              ? 'Ingresando...'
              : 'Creando cuenta...'
            : mode === 'login'
              ? 'Ingresar'
              : 'Crear cuenta'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (loading) return;
            setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
            setError('');
            setInfo('');
          }}
          className="mt-3 w-full text-sm text-gray-300 hover:text-white transition-colors"
        >
          {mode === 'login' ? '¿No tenés cuenta? Crear cuenta' : '¿Ya tenés cuenta? Iniciar sesión'}
        </button>
      </form>
    </div>
  );
}
