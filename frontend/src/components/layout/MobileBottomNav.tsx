import React from 'react';

interface MobileBottomNavProps {
  activeTab: 'explore' | 'tenant';
  setActiveTab: (tab: 'explore' | 'tenant') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2 flex items-center justify-around shadow-lg">
      <button
        onClick={() => setActiveTab('explore')}
        className={`flex flex-col items-center py-1 px-4 rounded-lg text-xs font-bold transition ${
          activeTab === 'explore' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <i className="fa-solid fa-compass text-lg mb-0.5"></i>
        <span>Discover PGs</span>
      </button>

      <button
        onClick={() => setActiveTab('tenant')}
        className={`flex flex-col items-center py-1 px-4 rounded-lg text-xs font-bold transition ${
          activeTab === 'tenant' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <i className="fa-solid fa-bed text-lg mb-0.5"></i>
        <span>My Stays</span>
      </button>
    </div>
  );
};

