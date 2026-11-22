import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface NavbarProps {
  activeTab: 'explore' | 'tenant' | 'owner' | 'admin';
  setActiveTab: (tab: 'explore' | 'tenant' | 'owner' | 'admin') => void;
  openAuthModal: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, openAuthModal }) => {
  const { user, isAuthenticated, logout, isCustomer, isOwner } = useAuth();
  const { showToast } = useToast();

  const handleLogoutConfirm = () => {
    if (window.confirm('Are you sure you want to sign out from StayNest?')) {
      logout();
      showToast('Signed out successfully. See you soon!', 'info');
      setActiveTab('explore');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo (matching Mobile App) */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer select-none"
          onClick={() => setActiveTab('explore')}
        >
          <img
            src="/logo.png"
            alt="StayNest"
            className="h-10 w-auto object-contain"
          />
          <span className="hidden sm:inline-block ml-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <i className="fa-solid fa-circle text-[6px] mr-1 text-emerald-500"></i>Online
          </span>
        </div>

        {/* Navigation Tabs (Customer & Tenant Facing) */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'explore'
                ? 'text-[#6c5ce7] bg-[#6c5ce7]/10 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-[#6c5ce7] hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-compass"></i> Discover PGs
          </button>

          <button
            onClick={() => {
              if (!isAuthenticated) {
                showToast('Please sign in to view your bookings and stays', 'info');
                openAuthModal('login');
              } else {
                setActiveTab('tenant');
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'tenant'
                ? 'text-[#6c5ce7] bg-[#6c5ce7]/10 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-[#6c5ce7] hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-bed"></i> My Stays & Holds
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold ml-2">
            <i className="fa-solid fa-mobile-screen-button text-[#6c5ce7]"></i>
            <span>PG Owners: Open Mobile App</span>
          </div>
        </nav>

        {/* User Auth Actions (Login / Logout - Requirement 2) */}
        <div className="flex items-center space-x-3">
          {!isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openAuthModal('login')}
                className="text-xs font-extrabold px-3.5 py-2 text-slate-700 hover:text-[#6c5ce7] hover:bg-slate-100 rounded-xl transition"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="text-xs font-extrabold px-4 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5e4ee3] text-white shadow-sm shadow-[#6c5ce7]/30 transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-user-plus text-xs"></i> Register
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div
                onClick={() => setActiveTab('tenant')}
                className="flex items-center space-x-2.5 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-full border border-slate-200 transition cursor-pointer"
                title="View your customer dashboard"
              >
                <div className="w-7 h-7 rounded-full bg-[#6c5ce7] text-white flex items-center justify-center text-xs font-bold shadow-inner">
                  {user?.fullName ? user.fullName[0].toUpperCase() : 'C'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight max-w-[130px] truncate">
                    {user?.fullName || user?.email}
                  </div>
                  <div className="text-[9px] uppercase font-extrabold text-[#6c5ce7] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    CUSTOMER
                  </div>
                </div>
              </div>

              {/* Explicit Sign Out Button */}
              <button
                onClick={handleLogoutConfirm}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                title="Sign out of StayNest"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
