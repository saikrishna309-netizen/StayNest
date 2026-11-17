import React, { useState } from 'react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ROLE_CUSTOMER' | 'ROLE_OWNER'>('ROLE_OWNER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoFill = (type: 'owner' | 'customer' | 'admin') => {
    if (type === 'owner') {
      setEmail('saikrishnakrishna1997@gmail.com');
      setPassword('Password@123');
    } else if (type === 'customer') {
      setEmail('customer@staynest.in');
      setPassword('Password@123');
    } else if (type === 'admin') {
      setEmail('admin@staynest.in');
      setPassword('Password@123');
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
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center text-xl mx-auto mb-3 shadow-md shadow-brand-500/30">
            <i className="fa-solid fa-key"></i>
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            {mode === 'login' ? 'Sign in to StayNest' : 'Create StayNest Account'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Connect with verified credentials</p>
        </div>

        {/* 1-Click Quick Demo Sign In */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
          <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
            1-Click Quick Demo Sign In:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill('owner')}
              className="text-xs font-bold py-1.5 px-2 bg-white border border-slate-200 rounded-lg hover:border-brand-500 text-slate-700 shadow-sm transition"
            >
              PG Owner
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('customer')}
              className="text-xs font-bold py-1.5 px-2 bg-white border border-slate-200 rounded-lg hover:border-brand-500 text-slate-700 shadow-sm transition"
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('admin')}
              className="text-xs font-bold py-1.5 px-2 bg-white border border-slate-200 rounded-lg hover:border-brand-500 text-slate-700 shadow-sm transition"
            >
              Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {mode === 'register' && (
            <>
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="e.g. 9888811111"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
                  Account Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="ROLE_OWNER">PG / Hostel Owner (List & Manage)</option>
                  <option value="ROLE_CUSTOMER">Tenant / Customer (Search & Book)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-2.5 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
          >
            {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
            <span>{mode === 'login' ? 'Sign In' : 'Register Account'}</span>
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-xs font-bold text-brand-600 hover:underline"
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
