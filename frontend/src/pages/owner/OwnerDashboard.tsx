import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { tenantApi } from '../../api/tenant.api';
import { financeApi } from '../../api/finance.api';
import { Expense, Income, PropertySummary, RentInvoice, Tenant, TenantStay } from '../../types';
import { OnboardTenantModal } from '../../components/modals/OnboardTenantModal';
import { AssignBedModal } from '../../components/modals/AssignBedModal';
import { useToast } from '../../context/ToastContext';

interface TenantWithStays extends Tenant {
  stays?: TenantStay[];
}

export const OwnerDashboard: React.FC = () => {
  const { showToast } = useToast();

  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'properties' | 'tenants' | 'invoices' | 'finance'>('overview');

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [tenants, setTenants] = useState<TenantWithStays[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isAssignBedModalOpen, setIsAssignBedModalOpen] = useState(false);
  const [selectedTenantForBed, setSelectedTenantForBed] = useState<Tenant | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Properties
      const propsRes = await propertyApi.getOwnerProperties();
      const loadedProps = propsRes.content || [];
      setProperties(loadedProps);

      // 2. Tenants & Stays
      const tenantsRes = await tenantApi.listTenants();
      const loadedTenants = tenantsRes.content || [];

      // Fetch active stays for each tenant
      const tenantsWithStays = await Promise.all(
        loadedTenants.map(async (t) => {
          try {
            const stays = await tenantApi.getTenantStays(t.id);
            return { ...t, stays };
          } catch {
            return { ...t, stays: [] };
          }
        })
      );
      setTenants(tenantsWithStays);

      // 3. Invoices
      const invoicesRes = await financeApi.listInvoices();
      setInvoices(invoicesRes.content || []);

      // 4. Expenses & Income
      const expensesRes = await financeApi.listExpenses();
      setExpenses(expensesRes.content || []);

      const incomeRes = await financeApi.listIncome();
      setIncomes(incomeRes.content || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculations for KPIs
  const totalTenantsCount = tenants.length;
  const activeStaysCount = tenants.filter((t) => t.stays && t.stays.some((s) => s.status === 'ACTIVE')).length;

  const totalExpensesPaise = expenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0);
  const totalIncomePaise = incomes.reduce((sum, i) => sum + (i.amountPaise || 0), 0);

  const handleRecordOfflinePayment = async (invoiceId: string) => {
    try {
      await financeApi.recordPayment(invoiceId, {
        paymentMode: 'UPI_QR',
        notes: 'Offline payment verified by owner',
      });
      showToast('Payment marked as PAID via UPI/Cash!');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleQuickAddExpense = async () => {
    const category = prompt('Expense Category (ELECTRICITY, GROCERY, MAINTENANCE, SALARY):', 'GROCERY');
    if (!category) return;
    const amount = prompt('Amount (₹):', '2500');
    if (!amount) return;

    try {
      await financeApi.recordExpense({
        category,
        amountPaise: Math.round(parseFloat(amount) * 100),
        paymentMode: 'CASH',
        description: 'Recorded from mobile quick action',
      });
      showToast('Expense recorded successfully!');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record expense', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full pb-20 md:pb-8">
      {/* Mobile-Friendly Header with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">PG Owner PMS Portal</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-100 text-brand-700 uppercase">
              Partner Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage properties, allocate beds, collect monthly rent & track expenses on mobile or web.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setIsOnboardModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm shadow-brand-500/20 transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <i className="fa-solid fa-user-plus"></i> Onboard Tenant
          </button>
          <button
            onClick={handleQuickAddExpense}
            className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <i className="fa-solid fa-receipt text-rose-500"></i> + Expense
          </button>
          <button
            onClick={loadAllData}
            className="p-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl shadow-sm transition"
            title="Refresh Data"
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Top Mobile KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">My Properties</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-hotel"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{properties.length}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">Live in PostgreSQL</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Tenants</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalTenantsCount}</div>
          <div className="text-[11px] text-slate-500 font-bold mt-1">{activeStaysCount} Beds Allocated</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rent Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{invoices.length}</div>
          <div className="text-[11px] text-slate-500 font-bold mt-1">Monthly Ledger</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Expenses Logged</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-wallet"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            ₹{(totalExpensesPaise / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">{expenses.length} Records</div>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center space-x-1 border-b border-slate-200 mb-6 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveSubtab('overview')}
          className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeSubtab === 'overview'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <i className="fa-solid fa-chart-pie"></i> Overview
        </button>

        <button
          onClick={() => setActiveSubtab('properties')}
          className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeSubtab === 'properties'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <i className="fa-solid fa-building"></i> Properties ({properties.length})
        </button>

        <button
          onClick={() => setActiveSubtab('tenants')}
          className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeSubtab === 'tenants'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <i className="fa-solid fa-users"></i> Tenants & Stays ({tenants.length})
        </button>

        <button
          onClick={() => setActiveSubtab('invoices')}
          className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeSubtab === 'invoices'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <i className="fa-solid fa-file-invoice"></i> Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveSubtab('finance')}
          className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeSubtab === 'finance'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <i className="fa-solid fa-money-bill-transfer"></i> Expenses & Ledger
        </button>
      </div>

      {/* SUBTAB 1: OVERVIEW */}
      {activeSubtab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">PG Performance Summary</h3>
            <p className="text-xs text-slate-500 mb-4">Real-time status of your co-living properties and beds.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block mb-1">Total Verified Properties</span>
                <div className="text-xl font-black text-slate-900">{properties.length} Properties</div>
                <div className="text-xs text-slate-400 mt-1">Auto-approved in PostgreSQL</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <span className="text-xs font-bold text-emerald-800 block mb-1">Occupancy Ratio</span>
                <div className="text-xl font-black text-emerald-700">
                  {totalTenantsCount > 0 ? `${activeStaysCount} / ${totalTenantsCount} Active` : '0 Active'}
                </div>
                <div className="text-xs text-emerald-600 mt-1">Real-time bed assignment status</div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <span className="text-xs font-bold text-indigo-800 block mb-1">Net Cashflow</span>
                <div className="text-xl font-black text-indigo-900">
                  ₹{((totalIncomePaise - totalExpensesPaise) / 100).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-indigo-600 mt-1">Income minus operational expenses</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PROPERTIES & INVENTORY */}
      {activeSubtab === 'properties' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">My Properties List</h3>
            <span className="text-xs text-slate-500">{properties.length} Active Listings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {p.genderPolicy}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {p.approvalStatus}
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-slate-900 mb-1">{p.name}</h4>
                <p className="text-xs text-slate-500 mb-3">
                  <i className="fa-solid fa-location-dot text-slate-400 mr-1"></i> {p.localityName ? `${p.localityName}, ` : ''}{p.cityName}
                </p>
                <div className="text-xs font-bold text-brand-600 mb-3">
                  Starting ₹{(p.startingPricePaise / 100).toLocaleString('en-IN')} /mo
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Food: {p.foodIncluded ? 'Included' : 'No'}</span>
                  <span className="text-emerald-600 font-bold">5 Floors / 25 Rooms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: TENANTS & STAYS */}
      {activeSubtab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tenant Directory & Bed Allocation</h3>
              <p className="text-xs text-slate-500">Track all onboarded tenants and their currently assigned beds.</p>
            </div>
            <button
              onClick={() => setIsOnboardModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-user-plus"></i> Onboard Tenant
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Tenant Name</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">ID Proof</th>
                    <th className="px-6 py-3">Allocated Stay / Bed</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No tenants onboarded yet. Click "Onboard Tenant" to add your first tenant.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((t) => {
                      const activeStay = t.stays && t.stays.find((s) => s.status === 'ACTIVE');
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 font-bold text-slate-900">{t.fullName}</td>
                          <td className="px-6 py-4">
                            {t.phone}
                            <br />
                            <span className="text-slate-400">{t.email || ''}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px]">
                            {t.idProofType}: {t.idProofNumber || '--'}
                          </td>
                          <td className="px-6 py-4">
                            {activeStay ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px] font-bold">
                                  <i className="fa-solid fa-bed text-emerald-600"></i> Active Stay
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5 font-bold">
                                  ₹{(activeStay.monthlyRentPaise / 100).toLocaleString('en-IN')}/mo (From {activeStay.checkIn})
                                </div>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                No Bed Assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              ACTIVE
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedTenantForBed(t);
                                setIsAssignBedModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white rounded-lg transition flex items-center gap-1 ml-auto"
                            >
                              <i className="fa-solid fa-bed"></i> Assign Bed
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: RENT INVOICES */}
      {activeSubtab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Rent Invoices & Offline Collection</h3>
            <span className="text-xs text-slate-500">{invoices.length} Bills</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Invoice #</th>
                  <th className="px-6 py-3">Billing Month</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No invoices issued yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-bold">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4">{inv.billingMonth}</td>
                      <td className="px-6 py-4 font-extrabold text-slate-900">
                        ₹{(inv.amountPaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {inv.status !== 'PAID' && (
                          <button
                            onClick={() => handleRecordOfflinePayment(inv.id)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg transition"
                          >
                            Mark Paid (Cash/UPI)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 5: EXPENSES & LEDGER */}
      {activeSubtab === 'finance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Operational Expenses & Extra Income</h3>
            <button
              onClick={handleQuickAddExpense}
              className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-plus"></i> Add Expense
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expenses List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Expenses Log</h4>
              <div className="space-y-2">
                {expenses.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No expenses recorded yet.</p>
                ) : (
                  expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{e.category}</span>
                        <div className="text-[10px] text-slate-400">{e.description || e.paidTo || 'Operational'}</div>
                      </div>
                      <span className="font-extrabold text-rose-600">
                        -₹{(e.amountPaise / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Income List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Extra Income Log</h4>
              <div className="space-y-2">
                {incomes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No extra income recorded yet.</p>
                ) : (
                  incomes.map((i) => (
                    <div key={i.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{i.category}</span>
                        <div className="text-[10px] text-slate-400">{i.notes || 'Ancillary Service'}</div>
                      </div>
                      <span className="font-extrabold text-emerald-600">
                        +₹{(i.amountPaise / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <OnboardTenantModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        properties={properties}
        onSuccess={loadAllData}
      />

      <AssignBedModal
        isOpen={isAssignBedModalOpen}
        onClose={() => setIsAssignBedModalOpen(false)}
        tenant={selectedTenantForBed}
        properties={properties}
        onSuccess={loadAllData}
      />
    </div>
  );
};

