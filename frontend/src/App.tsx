import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ExplorePage } from './pages/public/ExplorePage';
import { OwnerDashboard } from './pages/owner/OwnerDashboard';
import { TenantDashboard } from './pages/tenant/TenantDashboard';
import { AuthModal } from './components/modals/AuthModal';
import { PropertyDetailModal } from './components/modals/PropertyDetailModal';
import { useAuth } from './context/AuthContext';

export const App: React.FC = () => {
  const { user, isOwner } = useAuth();

  const [activeTab, setActiveTab] = useState<'explore' | 'tenant'>('explore');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSuccessRole = (role: string) => {
    if (role === 'ROLE_CUSTOMER') {
      setActiveTab('tenant');
    } else {
      setActiveTab('explore');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab as any}
        setActiveTab={setActiveTab as any}
        openAuthModal={handleOpenAuth}
      />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col">
        {activeTab === 'explore' && (
          <ExplorePage onSelectProperty={(id) => setSelectedPropertyId(id)} />
        )}

        {activeTab === 'tenant' && <TenantDashboard />}
      </main>

      {/* Mobile-First Bottom Nav (for smartphones) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onSuccessRole={handleAuthSuccessRole}
      />

      {/* Room & Bed Inventory Detail Modal */}
      <PropertyDetailModal
        propertyId={selectedPropertyId}
        onClose={() => setSelectedPropertyId(null)}
        onOpenAuth={() => handleOpenAuth('login')}
      />
    </div>
  );
};

export default App;

