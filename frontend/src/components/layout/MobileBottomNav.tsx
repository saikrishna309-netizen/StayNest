import React from 'react';

interface MobileBottomNavProps {
  activeTab: 'explore' | 'tenant' | 'owner';
  setActiveTab: (tab: 'explore' | 'tenant' | 'owner') => void;
  pmsSubtab?: string;
  setPmsSubtab?: (subtab: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  pmsSubtab,
  setPmsSubtab,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-lg">
      <button
        onClick={() => setActiveTab('explore')}
        className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition ${
          activeTab === 'explore' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <i className="fa-solid fa-compass text-base mb-0.5"></i>
        <span>Discover</span>
      </button>

      <button
        onClick={() => setActiveTab('tenant')}
        className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition ${
          activeTab === 'tenant' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <i className="fa-solid fa-bed text-base mb-0.5"></i>
        <span>Tenant</span>
      </button>

      <button
        onClick={() => {
          setActiveTab('owner');
          if (setPmsSubtab) setPmsSubtab('overview');
        }}
        className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition ${
          activeTab === 'owner' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <i className="fa-solid fa-building-user text-base mb-0.5"></i>
        <span>Owner PMS</span>
      </button>

      {activeTab === 'owner' && setPmsSubtab && (
        <button
          onClick={() => setPmsSubtab('tenants')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition ${
            pmsSubtab === 'tenants' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <i className="fa-solid fa-user-plus text-base mb-0.5"></i>
          <span>Onboard</span>
        </button>
      )}
    </div>
  );
};

