import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ExplorePage } from './pages/public/ExplorePage';
import { OwnerDashboard } from './pages/owner/OwnerDashboard';
import { TenantDashboard } from './pages/tenant/TenantDashboard';
import {
  ComplianceFooter,
  CompliancePage,
  ComplianceSlug,
} from './pages/public/ComplianceSection';
import { AuthModal } from './components/modals/AuthModal';
import { PropertyDetailModal } from './components/modals/PropertyDetailModal';
import { useAuth } from './context/AuthContext';

const COMPLIANCE_SLUGS: ComplianceSlug[] = [
  'privacy-policy',
  'terms',
  'refund-policy',
  'pricing',
  'about',
  'contact',
  'delete-account',
];

const resolveComplianceFromLocation = (): ComplianceSlug | null => {
  if (typeof window === 'undefined') return null;
  const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const hashSlug = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const candidate = (pathSlug || hashSlug) as ComplianceSlug;
  return COMPLIANCE_SLUGS.includes(candidate) ? candidate : null;
};

export const App: React.FC = () => {
  const { user, isOwner } = useAuth();

  const [activeTab, setActiveTab] = useState<'explore' | 'tenant'>('explore');
  const [complianceSlug, setComplianceSlug] = useState<ComplianceSlug | null>(() =>
    resolveComplianceFromLocation()
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      setComplianceSlug(resolveComplianceFromLocation());
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  const navigateCompliance = (slug: ComplianceSlug | null) => {
    setComplianceSlug(slug);
    if (typeof window !== 'undefined') {
      const nextPath = slug ? `/${slug}` : '/';
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab as any}
        setActiveTab={(tab) => {
          navigateCompliance(null);
          setActiveTab(tab as any);
        }}
        openAuthModal={handleOpenAuth}
      />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col">
        {complianceSlug ? (
          <CompliancePage
            slug={complianceSlug}
            onNavigate={(slug) => navigateCompliance(slug)}
            onBackHome={() => navigateCompliance(null)}
          />
        ) : (
          <>
            {activeTab === 'explore' && (
              <ExplorePage onSelectProperty={(id) => setSelectedPropertyId(id)} />
            )}

            {activeTab === 'tenant' && <TenantDashboard />}
          </>
        )}
      </main>

      {/* Distinct Dark-Slate Compliance & Legal Footer (Razorpay & Play Store) */}
      <ComplianceFooter onNavigate={(slug) => navigateCompliance(slug)} />

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

