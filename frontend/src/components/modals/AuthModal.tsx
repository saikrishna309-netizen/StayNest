import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccessRole?: (role: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccessRole,
}) => {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  // Default shows username as lite color and password as well
  const [email, setEmail] = useState('customer@staynest.in');
  const [password, setPassword] = useState('Password@123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      if (initialMode === 'login' && !email) {
        setEmail('customer@staynest.in');
        setPassword('Password@123');
      }
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    if (newMode === 'login') {
      if (!email) setEmail('customer@staynest.in');
      if (!password) setPassword('Password@123');
    } else {
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login({ username: email.trim(), password });
        showToast('Signed in successfully!');
        if (onSuccessRole) onSuccessRole('ROLE_CUSTOMER');
      } else {
        await register({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          role: 'ROLE_CUSTOMER',
        });
        showToast('Account registered successfully!');
        if (onSuccessRole) onSuccessRole('ROLE_CUSTOMER');
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>

        {/* Modal Header with Mobile App StayNest Logo */}
        <div className="text-center mb-5">
          <img
            src="/logo.png"
            alt="StayNest"
            className="h-10 w-auto mx-auto mb-3 object-contain"
          />
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login' ? 'Sign In to StayNest' : 'Create Account'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'Enter your credentials to hold beds and manage stays'
              : 'Sign up to reserve rooms and lock your bed'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Sign In / Register) */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-[#6c5ce7] shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-right-to-bracket text-xs"></i> Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('register')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white text-[#6c5ce7] shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-user-plus text-xs"></i> Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'register' && (
            <>
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/20 outline-none transition"
                  placeholder="e.g. Karthik Reddy"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/20 outline-none transition"
                  placeholder="e.g. 9876543210"
                />
              </div>
            </>
          )}

          {/* USERNAME / EMAIL BOX (LITE COLOR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Username / Email *
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/90 border border-slate-200/90 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/20 outline-none shadow-sm transition"
                placeholder="Username or email"
              />
              <span className="absolute right-3.5 top-3.5 text-slate-400 text-xs">
                <i className="fa-regular fa-envelope"></i>
              </span>
            </div>
          </div>

          {/* PASSWORD BOX (LITE COLOR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Password *
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">Min 6 characters</span>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50/90 border border-slate-200/90 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/20 outline-none shadow-sm transition"
                placeholder="••••••••"
              />
              <span className="absolute right-3.5 top-3.5 text-slate-400 text-xs">
                <i className="fa-solid fa-lock"></i>
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl font-bold flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#6c5ce7] hover:bg-[#5e4ee3] disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-[#6c5ce7]/30 transition flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
            <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-5 text-center pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => handleSwitchMode(mode === 'login' ? 'register' : 'login')}
            className="text-xs font-bold text-[#6c5ce7] hover:underline"
          >
            {mode === 'login'
              ? "Don't have an account? Register here"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
