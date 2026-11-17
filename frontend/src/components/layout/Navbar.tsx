import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  activeTab: 'explore' | 'tenant' | 'owner' | 'admin';
  setActiveTab: (tab: 'explore' | 'tenant' | 'owner' | 'admin') => void;
  openAuthModal: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, openAuthModal }) => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('explore')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-brand-500/30">
            <i className="fa-solid fa-hotel text-lg"></i>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Stay<span className="text-brand-600">Nest</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i className="fa-solid fa-circle text-[6px] mr-1 text-emerald-500"></i>Online
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Customer & Tenant Facing) */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'explore' ? 'text-brand-600 bg-brand-50' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-compass"></i> Discover PGs
          </button>
          <button
            onClick={() => setActiveTab('tenant')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'tenant' ? 'text-brand-600 bg-brand-50' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-bed"></i> Tenant Dashboard
          </button>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold ml-2">
            <i className="fa-solid fa-mobile-screen-button text-brand-600"></i>
            <span>PG Owners: Use Mobile App</span>
          </div>
        </nav>

        {/* User Auth Actions */}
        <div className="flex items-center space-x-3">
          {!isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openAuthModal('login')}
                className="text-xs font-bold px-3.5 py-2 text-slate-700 hover:text-brand-600 transition"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20 transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-user-plus"></i> Register
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shadow-inner">
                  {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{user?.fullName || user?.email}</div>
                  <div className="text-[9px] uppercase font-extrabold text-brand-600">{user?.role?.replace('ROLE_', '')}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-600 transition"
                title="Logout"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
