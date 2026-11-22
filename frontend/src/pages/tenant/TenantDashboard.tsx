import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bookingApi } from '../../api/booking.api';
import { ResidentEnquiry } from '../../types';
import { useToast } from '../../context/ToastContext';

export const TenantDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [enquiries, setEnquiries] = useState<ResidentEnquiry[]>([]);

  useEffect(() => {
    loadEnquiries();

    const handleUpdate = () => loadEnquiries();
    window.addEventListener('staynest_new_enquiry', handleUpdate);
    window.addEventListener('staynest_enquiry_updated', handleUpdate);

    return () => {
      window.removeEventListener('staynest_new_enquiry', handleUpdate);
      window.removeEventListener('staynest_enquiry_updated', handleUpdate);
    };
  }, []);

  const loadEnquiries = () => {
    const list = bookingApi.getLocalEnquiries();
    setEnquiries(list);
  };

  const handleCancelHold = (id: string, bedLabel: string) => {
    if (window.confirm(`Are you sure you want to release the hold on ${bedLabel}?`)) {
      bookingApi.updateLocalEnquiryStatus(id, 'REJECTED');
      showToast(`Hold released for ${bedLabel}.`, 'info');
      loadEnquiries();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Customer & Tenant Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review active bed reservation holds, booking requests, and PG owner contact details.
          </p>
        </div>
      </div>

      {/* Customer Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-brand-500/20">
            {user?.fullName ? user.fullName[0].toUpperCase() : 'C'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">{user?.fullName || 'Verified Customer'}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Customer
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              📱 {user?.phone || '9876543210'} • ✉️ {user?.email || 'customer@staynest.in'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-center">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 block">ACTIVE HOLDS</span>
            <span className="text-base font-black text-emerald-600">
              {enquiries.filter((e) => e.status === 'PENDING_HOLD').length}
            </span>
          </div>
        </div>
      </div>

      {/* Active Bed Holds & Enquiries */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">My 15-Minute Bed Holds & Enquiries</h3>
            <p className="text-xs text-slate-400">Owner has been notified with your contact details</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
            {enquiries.length} Requests
          </span>
        </div>

        <div className="p-6">
          {enquiries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-3xl block mb-2">🛏️</span>
              <p className="text-sm font-bold text-slate-700">No active bed holds right now</p>
              <p className="text-xs text-slate-400 mt-1">
                Explore available PGs and lock any vacant bed in 1 click.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {enquiries.map((enq) => {
                const rent = (enq.monthlyRentPaise / 100).toLocaleString('en-IN');
                const isPending = enq.status === 'PENDING_HOLD';

                return (
                  <div
                    key={enq.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-sm border border-emerald-100">
                        🛏️
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{enq.propertyName}</h4>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : enq.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isPending ? '🟡 15-Min Hold Active' : enq.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Room {enq.roomNumber} • {enq.bedLabel} • Check-in: <span className="font-bold text-slate-700">{enq.checkInDate}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Enquiry ID: <span className="font-mono text-slate-500">{enq.id}</span> • Owner notified
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                      <div className="text-left md:text-right">
                        <span className="text-base font-black text-brand-600">₹{rent}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        <div className="text-[10px] font-bold text-slate-400">Pay at Property</div>
                      </div>

                      {isPending && (
                        <button
                          onClick={() => handleCancelHold(enq.id, enq.bedLabel)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition"
                        >
                          Release Hold
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
