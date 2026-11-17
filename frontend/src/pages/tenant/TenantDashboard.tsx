import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const TenantDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Tenant & Guest Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review active bed reservations, 15-minute booking holds, payment receipts, and stay policies.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-brand-500/20">
            {user?.fullName ? user.fullName[0].toUpperCase() : 'T'}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{user?.fullName || 'Guest User'}</h3>
            <p className="text-xs text-slate-500">{user?.email || 'customer@staynest.in'} • {user?.phone || '9876543210'}</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Verified Resident
        </span>
      </div>

      {/* Active Stays & Bookings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">My Bed Reservations & Stays</h3>
          <span className="text-xs text-slate-500">Live booking status</span>
        </div>

        <div className="p-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                <i className="fa-solid fa-bed"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Venkateswra Gents PG - Room 101</h4>
                <p className="text-xs text-slate-500">Bed 1 (Double Sharing) • Check-in: 2026-12-01</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-brand-600">₹8,000/mo</span>
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Confirmed Stay</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
