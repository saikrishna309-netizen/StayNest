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
  // Default shows username as lite color and password as well (Requirement 3)
  const [email, setEmail] = useState('customer@staynest.in');
  const [password, setPassword] = useState('Password@123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ROLE_CUSTOMER' | 'ROLE_OWNER'>('ROLE_CUSTOMER');
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

  const handleDemoFill = (type: 'customer' | 'owner' | 'admin') => {
    if (type === 'customer') {
      setEmail('customer@staynest.in');
      setPassword('Password@123');
      setRole('ROLE_CUSTOMER');
    } else if (type === 'owner') {
      setEmail('saikrishnakrishna1997@gmail.com');
      setPassword('Password@123');
      setRole('ROLE_OWNER');
    } else if (type === 'admin') {
      setEmail('admin@staynest.in');
      setPassword('Password@123');
    }
  };

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    if (newMode === 'login') {
      if (!email || email === '') setEmail('customer@staynest.in');
      if (!password || password === '') setPassword('Password@123');
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
      } else {
        await register({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          role,
        });
        showToast('Account registered successfully!');
      }

      onClose();
      if (onSuccessRole) onSuccessRole(role);
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

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-xl mx-auto mb-3 shadow-lg shadow-brand-500/30">
            <i className={mode === 'login' ? 'fa-solid fa-right-to-bracket' : 'fa-solid fa-user-plus'}></i>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login' ? 'Welcome to StayNest' : 'Create Customer Account'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'Sign in to hold beds, reserve rooms & manage stays'
              : 'Register as a verified customer or hostel guest'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-brand-600 shadow-sm font-extrabold'
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
                ? 'bg-white text-brand-600 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-user-plus text-xs"></i> Register
          </button>
        </div>

        {/* 1-Click Quick Demo Sign In Pills */}
        {mode === 'login' && (
          <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <i className="fa-solid fa-bolt text-amber-500"></i> 1-Click Instant Login:
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Auto-fills boxes</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('customer')}
                className={`text-xs font-bold py-2 px-3 rounded-xl border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  email === 'customer@staynest.in'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-500'
                }`}
              >
                <i className="fa-solid fa-user"></i> Customer Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('owner')}
                className={`text-xs font-bold py-2 px-3 rounded-xl border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  email === 'saikrishnakrishna1997@gmail.com'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-500'
                }`}
              >
                <i className="fa-solid fa-building"></i> Owner Demo
              </button>
            </div>
          </div>
        )}

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
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                  placeholder="e.g. Ramesh Kumar"
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
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                  placeholder="e.g. 9888811111"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1.5">
                  Account Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                >
                  <option value="ROLE_CUSTOMER">Tenant / Customer (Search & Hold Bed)</option>
                  <option value="ROLE_OWNER">PG Owner (Manage Hostel)</option>
                </select>
              </div>
            </>
          )}

          {/* USERNAME BOX (LITE COLOR) - Requirement 3 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Username / Email *
              </label>
              {mode === 'login' && (
                <span className="text-[10px] font-semibold text-brand-600">Lite Box Preview</span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/90 border border-slate-200/90 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none shadow-sm transition"
                placeholder="customer@staynest.in"
              />
              <span className="absolute right-3.5 top-3.5 text-slate-400 text-xs">
                <i className="fa-regular fa-envelope"></i>
              </span>
            </div>
          </div>

          {/* PASSWORD BOX (LITE COLOR) - Requirement 3 */}
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
                className="w-full bg-slate-50/90 border border-slate-200/90 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none shadow-sm transition"
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
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-brand-500/30 transition flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
            <span>{mode === 'login' ? 'Sign In & Continue' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-5 text-center pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => handleSwitchMode(mode === 'login' ? 'register' : 'login')}
            className="text-xs font-bold text-brand-600 hover:underline"
          >
            {mode === 'login'
              ? "New to StayNest? Register as Customer"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
