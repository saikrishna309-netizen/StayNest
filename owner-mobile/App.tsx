import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform, StatusBar as RNStatusBar, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { OwnerRegistrationScreen } from './src/screens/OwnerRegistrationScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PropertiesScreen } from './src/screens/PropertiesScreen';
import { TenantsScreen } from './src/screens/TenantsScreen';
import { ManagementScreen } from './src/screens/ManagementScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SubscriptionPaywallModal } from './src/components/modals/SubscriptionPaywallModal';
import {
  getSubscriptionState,
  isProActive,
  SubscriptionState,
  syncSubscriptionFromServer,
} from './src/services/subscriptionService';
import { Property } from './src/types';
import { safeStorage } from './src/utils/safeStorage';

// ─── TRENDY MODERN SVG ICONS (MATCHING SCREENSHOT) ───
const NavHomeIcon = ({ color, filled = false }: { color: string; filled?: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 0114 20v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 013 20v-9.5z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const NavGridIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth="2.2" />
    <Rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke={color} strokeWidth="2.2" />
    <Rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke={color} strokeWidth="2.2" />
    <Rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke={color} strokeWidth="2.2" />
  </Svg>
);

const NavTenantsIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    {/* Primary / Left Person */}
    <Circle cx="9" cy="8" r="3.8" stroke={color} strokeWidth="2.2" />
    <Path d="M3 19.5c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* Secondary / Right Person (Behind) */}
    <Path d="M15.5 5.2a3.8 3.8 0 010 5.6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M17.5 14.5c2.2.5 3.5 2 3.5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const NavWalletIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Top Flap fold */}
    <Path
      d="M4 5.5A2 2 0 016 3.5h9a2 2 0 012 2V6H4v-.5z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Main Wallet Body */}
    <Rect x="2.5" y="6" width="18" height="14" rx="3" stroke={color} strokeWidth="2" />
    {/* Right Clasp with Snap Button */}
    <Path
      d="M15 10.5h4.5a1.5 1.5 0 011.5 1.5v2a1.5 1.5 0 01-1.5 1.5H15v-5z"
      stroke={color}
      strokeWidth="1.8"
      fill="#ffffff"
    />
    <Circle cx="18" cy="13" r="1.2" fill={color} />
  </Svg>
);

const NavUserIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="7.5" r="4.5" stroke={color} strokeWidth="2.2" />
    <Path d="M4.5 19.5c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const MainNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'properties' | 'tenants' | 'management' | 'profile'>('dashboard');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [registrationSkipped, setRegistrationSkipped] = useState(false);
  const [webDeviceMode, setWebDeviceMode] = useState<'MOBILE' | 'DESKTOP'>('DESKTOP');
  const [dashboardResetTrigger, setDashboardResetTrigger] = useState(0);
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [showTrialPaywall, setShowTrialPaywall] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const refreshSub = async () => {
      const local = await getSubscriptionState();
      if (active) setSubState(local);
      const synced = await syncSubscriptionFromServer();
      if (active) setSubState(synced);
    };
    void refreshSub();

    const appSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncSubscriptionFromServer().then((s) => {
          if (active) setSubState(s);
        });
      }
    });
    return () => {
      active = false;
      appSub.remove();
    };
  }, [isAuthenticated]);

  const isTrialExpired = Boolean(subState && subState.trialExpired === true && !isProActive(subState));

  // 1. If not authenticated -> Login Screen (Mobile + OTP)
  if (!isAuthenticated) {
    return (
      <View style={styles.webOuterWrapper}>
        {Platform.OS === 'web' && (
          <View style={styles.webTopBar}>
            <Text style={styles.webTopBarTitle}>StayNest PG Owner Web Preview</Text>
            <View style={styles.webToggleGroup}>
              <TouchableOpacity
                style={[styles.webToggleBtn, webDeviceMode === 'MOBILE' && styles.webToggleBtnActive]}
                onPress={() => setWebDeviceMode('MOBILE')}
              >
                <Text style={[styles.webToggleBtnText, webDeviceMode === 'MOBILE' && styles.webToggleBtnTextActive]}>
                  📱 Mobile (420px)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.webToggleBtn, webDeviceMode === 'DESKTOP' && styles.webToggleBtnActive]}
                onPress={() => setWebDeviceMode('DESKTOP')}
              >
                <Text style={[styles.webToggleBtnText, webDeviceMode === 'DESKTOP' && styles.webToggleBtnTextActive]}>
                  💻 Full Web (1200px)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View
          style={[
            styles.container,
            Platform.OS === 'web' && webDeviceMode === 'MOBILE' && styles.mobileFrameWeb,
            Platform.OS === 'web' && webDeviceMode === 'DESKTOP' && styles.desktopFrameWeb,
          ]}
        >
          <LoginScreen />
        </View>
      </View>
    );
  }

  // 2. If new owner (profile incomplete) -> Show 1-time Owner & First Property Setup
  const needsOwnerOnboarding =
    !registrationSkipped &&
    (!user?.fullName ||
      user.fullName === 'PG Owner' ||
      !user?.email ||
      user.email.startsWith('owner_'));

  if (needsOwnerOnboarding) {
    return (
      <OwnerRegistrationScreen
        onComplete={(createdProp) => {
          if (createdProp) {
            setSelectedProperty(createdProp);
          }
          setRegistrationSkipped(true);
        }}
      />
    );
  }

  // Unified property switcher: syncs active property across all 5 tabs & storage
  const handleActivePropertyChange = (property: Property) => {
    setSelectedProperty(property);
    safeStorage.setItem('@staynest_active_property_id', property.id).catch(() => {});
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('staynest_active_property_id', property.id);
      } catch {}
    }
  };

  // Direct login straight to dashboard for all owners (no blocking onboarding wizard)
  const handleOpenProperty = (property: Property) => {
    handleActivePropertyChange(property);
    setCurrentTab('properties');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <RNStatusBar barStyle="dark-content" />
      <StatusBar style="dark" />
      <View style={styles.webOuterWrapper}>
        {/* On Web: Switcher bar to toggle between Mobile Frame & Full Desktop Width */}
        {Platform.OS === 'web' && (
          <View style={styles.webTopBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>⚙️</Text>
              <Text style={styles.webTopBarTitle}>Screen Mode:</Text>
            </View>
            <View style={styles.webToggleGroup}>
              <TouchableOpacity
                style={[styles.webToggleBtn, webDeviceMode === 'MOBILE' && styles.webToggleBtnActive]}
                onPress={() => setWebDeviceMode('MOBILE')}
              >
                <Text style={[styles.webToggleBtnText, webDeviceMode === 'MOBILE' && styles.webToggleBtnTextActive]}>
                  📱 Mobile (420px)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.webToggleBtn, webDeviceMode === 'DESKTOP' && styles.webToggleBtnActive]}
                onPress={() => setWebDeviceMode('DESKTOP')}
              >
                <Text style={[styles.webToggleBtnText, webDeviceMode === 'DESKTOP' && styles.webToggleBtnTextActive]}>
                  💻 Full Web (1200px)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View
          style={[
            styles.container,
            Platform.OS === 'web' && webDeviceMode === 'MOBILE' && styles.mobileFrameWeb,
            Platform.OS === 'web' && webDeviceMode === 'DESKTOP' && styles.desktopFrameWeb,
          ]}
        >
          {/* Trial Countdown / Expired Banner on Home */}
          {currentTab === 'dashboard' && (isTrialExpired || (typeof subState?.trialDaysLeft === 'number' && subState.trialDaysLeft <= 5 && subState.autopayStatus !== 'ACTIVE')) && (
            <TouchableOpacity
              style={[styles.trialBanner, isTrialExpired ? styles.trialBannerExpired : styles.trialBannerWarning]}
              onPress={() => setShowTrialPaywall(true)}
              activeOpacity={0.88}
            >
              <Text style={styles.trialBannerText} numberOfLines={2}>
                {isTrialExpired
                  ? '🔒 30-Day Free Trial Ended • Rooms, Tenants & Wallet locked'
                  : `⏳ Free Trial ends in ${subState?.trialDaysLeft} day${subState?.trialDaysLeft === 1 ? '' : 's'} • Activate ₹149/mo AutoPay`}
              </Text>
              <View style={styles.trialBannerBtn}>
                <Text style={styles.trialBannerBtnText}>{isTrialExpired ? 'Unlock ₹149/mo' : 'Activate'}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Tab 1: Dashboard (Fast Persistent Pane — Always Available) */}
          <View style={[styles.tabPane, currentTab === 'dashboard' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <DashboardScreen
              resetTrigger={dashboardResetTrigger}
              selectedPropertyId={selectedProperty?.id}
              onSelectPropertyForRooms={handleOpenProperty}
              onActivePropertyChange={handleActivePropertyChange}
              onNavigateTab={(tab) => {
                if (tab === 'rooms') setCurrentTab('properties');
                else if (tab === 'tenants') setCurrentTab('tenants');
                else if (tab === 'finance') setCurrentTab('management');
                else if (tab === 'profile') setCurrentTab('profile');
              }}
            />
          </View>

          {/* Tab 2: Properties (Locked after 30-day trial expiry until Pro ₹149/mo active) */}
          <View style={[styles.tabPane, currentTab === 'properties' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            {isTrialExpired ? (
              <View style={styles.trialLockScreen}>
                <View style={styles.trialLockIconCircle}>
                  <Text style={{ fontSize: 32 }}>🔒</Text>
                </View>
                <Text style={styles.trialLockTitle}>Rooms & Flats Locked</Text>
                <Text style={styles.trialLockSub}>
                  Your 30-day free trial has ended. Your properties, rooms & beds are safely saved — activate StayNest Pro (₹149/mo) to unlock full access.
                </Text>
                <TouchableOpacity style={styles.trialLockCta} onPress={() => setShowTrialPaywall(true)} activeOpacity={0.85}>
                  <Text style={styles.trialLockCtaText}>Unlock Full App — ₹149/mo →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.trialLockBackBtn} onPress={() => setCurrentTab('dashboard')}>
                  <Text style={styles.trialLockBackText}>← Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <PropertiesScreen
                initialProperty={selectedProperty}
                onActivePropertyChange={handleActivePropertyChange}
                onBackToDashboard={() => setCurrentTab('dashboard')}
              />
            )}
          </View>

          {/* Tab 3: Tenants (Locked after 30-day trial expiry until Pro ₹149/mo active) */}
          <View style={[styles.tabPane, currentTab === 'tenants' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            {isTrialExpired ? (
              <View style={styles.trialLockScreen}>
                <View style={styles.trialLockIconCircle}>
                  <Text style={{ fontSize: 32 }}>🔒</Text>
                </View>
                <Text style={styles.trialLockTitle}>Tenant List & Reminders Locked</Text>
                <Text style={styles.trialLockSub}>
                  Your 30-day free trial has ended. All your tenant records & rent history are safely saved — activate StayNest Pro (₹149/mo) to view tenants & send WhatsApp reminders.
                </Text>
                <TouchableOpacity style={styles.trialLockCta} onPress={() => setShowTrialPaywall(true)} activeOpacity={0.85}>
                  <Text style={styles.trialLockCtaText}>Unlock Full App — ₹149/mo →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.trialLockBackBtn} onPress={() => setCurrentTab('dashboard')}>
                  <Text style={styles.trialLockBackText}>← Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TenantsScreen
                selectedPropertyId={selectedProperty?.id}
                onActivePropertyChange={handleActivePropertyChange}
                onNavigateToProfile={() => setCurrentTab('profile')}
                onBack={() => setCurrentTab('dashboard')}
              />
            )}
          </View>

          {/* Tab 4: Management (Locked after 30-day trial expiry until Pro ₹149/mo active) */}
          <View style={[styles.tabPane, currentTab === 'management' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            {isTrialExpired ? (
              <View style={styles.trialLockScreen}>
                <View style={styles.trialLockIconCircle}>
                  <Text style={{ fontSize: 32 }}>🔒</Text>
                </View>
                <Text style={styles.trialLockTitle}>Wallet & Finance Locked</Text>
                <Text style={styles.trialLockSub}>
                  Your 30-day free trial has ended. Activate StayNest Pro (₹149/mo) to unlock expenses, P&L reports & rent ledger.
                </Text>
                <TouchableOpacity style={styles.trialLockCta} onPress={() => setShowTrialPaywall(true)} activeOpacity={0.85}>
                  <Text style={styles.trialLockCtaText}>Unlock Full App — ₹149/mo →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.trialLockBackBtn} onPress={() => setCurrentTab('dashboard')}>
                  <Text style={styles.trialLockBackText}>← Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ManagementScreen
                selectedPropertyId={selectedProperty?.id}
                onActivePropertyChange={handleActivePropertyChange}
                onBackToDashboard={() => setCurrentTab('dashboard')}
              />
            )}
          </View>

          {/* Tab 5: Profile (PG Owner Account & Settings) */}
          <View style={[styles.tabPane, currentTab === 'profile' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <ProfileScreen
              selectedPropertyId={selectedProperty?.id}
              onActivePropertyChange={handleActivePropertyChange}
              onBackToDashboard={() => setCurrentTab('dashboard')}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          </View>

          {/* ─── MODERN BOTTOM NAVIGATION BAR (MATCHING SCREENSHOT) ─── */}
          <View style={styles.bottomNavWrapper}>
            <View style={styles.bottomNavInner}>
              {/* Tab 1: Dashboard / Home */}
              <TouchableOpacity
                style={styles.bottomNavItem}
                onPress={() => {
                  setCurrentTab('dashboard');
                  setDashboardResetTrigger((prev) => prev + 1);
                }}
                activeOpacity={0.8}
              >
                {currentTab === 'dashboard' && <View style={styles.navActiveTopLine} />}
                <NavHomeIcon
                  color={currentTab === 'dashboard' ? '#ea580c' : '#4b5563'}
                  filled={currentTab === 'dashboard'}
                />
                <Text style={[styles.bottomNavLabel, currentTab === 'dashboard' && styles.bottomNavLabelActive]}>
                  Home
                </Text>
              </TouchableOpacity>

              {/* Tab 2: Rooms */}
              <TouchableOpacity
                style={styles.bottomNavItem}
                onPress={() => setCurrentTab('properties')}
                activeOpacity={0.8}
              >
                {currentTab === 'properties' && <View style={styles.navActiveTopLine} />}
                <NavGridIcon color={currentTab === 'properties' ? '#ea580c' : '#4b5563'} />
                <Text style={[styles.bottomNavLabel, currentTab === 'properties' && styles.bottomNavLabelActive]}>
                  {isTrialExpired ? '🔒 Rooms' : 'Rooms'}
                </Text>
              </TouchableOpacity>

              {/* Tab 3: Tenants */}
              <TouchableOpacity
                style={styles.bottomNavItem}
                onPress={() => setCurrentTab('tenants')}
                activeOpacity={0.8}
              >
                {currentTab === 'tenants' && <View style={styles.navActiveTopLine} />}
                <NavTenantsIcon color={currentTab === 'tenants' ? '#ea580c' : '#4b5563'} />
                <Text style={[styles.bottomNavLabel, currentTab === 'tenants' && styles.bottomNavLabelActive]}>
                  {isTrialExpired ? '🔒 Tenants' : 'Tenants'}
                </Text>
              </TouchableOpacity>

              {/* Tab 4: Wallet */}
              <TouchableOpacity
                style={styles.bottomNavItem}
                onPress={() => setCurrentTab('management')}
                activeOpacity={0.8}
              >
                {currentTab === 'management' && <View style={styles.navActiveTopLine} />}
                <NavWalletIcon color={currentTab === 'management' ? '#ea580c' : '#4b5563'} />
                <Text style={[styles.bottomNavLabel, currentTab === 'management' && styles.bottomNavLabelActive]}>
                  {isTrialExpired ? '🔒 Wallet' : 'Wallet'}
                </Text>
              </TouchableOpacity>

              {/* Tab 5: User Profile */}
              <TouchableOpacity
                style={styles.bottomNavItem}
                onPress={() => setCurrentTab('profile')}
                activeOpacity={0.8}
              >
                {currentTab === 'profile' && <View style={styles.navActiveTopLine} />}
                <NavUserIcon color={currentTab === 'profile' ? '#ea580c' : '#4b5563'} />
                <Text style={[styles.bottomNavLabel, currentTab === 'profile' && styles.bottomNavLabelActive]}>
                  Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      <SubscriptionPaywallModal
        visible={showTrialPaywall}
        reason={isTrialExpired ? 'TRIAL_EXPIRED' : 'UPGRADE'}
        trialExpired={isTrialExpired}
        onClose={() => setShowTrialPaywall(false)}
        onActivated={(nextState) => {
          setSubState({ ...nextState, hasFullAccess: true, trialExpired: false });
          setShowTrialPaywall(false);
        }}
      />
    </SafeAreaView>
  );
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.log('StayNest ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🏡</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 }}>
            StayNest PG Owner
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
            Session loaded. Tap below to refresh your dashboard.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#ff7337', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>Open Dashboard</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
  },
  webOuterWrapper: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    width: '100%',
  },
  webTopBar: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  webTopBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  webToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  webToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  webToggleBtnActive: {
    backgroundColor: '#ff7337',
  },
  webToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  webToggleBtnTextActive: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  tabPane: {
    flex: 1,
    width: '100%',
  },
  tabPaneActive: {
    display: 'flex',
  },
  tabPaneHidden: {
    display: 'none',
  },
  mobileFrameWeb: {
    maxWidth: 420,
    marginVertical: 12,
    borderRadius: 24,
    borderWidth: 8,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 10,
  },
  desktopFrameWeb: {
    maxWidth: 1200,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  // ─── Modern Bottom Navigation Bar (Matching Screenshot) ───
  bottomNavWrapper: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'android' ? 48 : 24,
    paddingTop: 10,
    width: '100%',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 4,
  },
  bottomNavInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
    minHeight: 44,
  },
  navActiveTopLine: {
    position: 'absolute',
    top: -8,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ea580c',
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 3,
    textAlign: 'center',
  },
  bottomNavLabelActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 10,
    paddingBottom: 16,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  navItemActive: {
    transform: [{ scale: 1.05 }],
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 3,
    opacity: 0.7,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#ff7337',
    fontWeight: '900',
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ff7337',
    marginTop: 3,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  trialBannerWarning: {
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  trialBannerExpired: {
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  trialBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
  },
  trialBannerBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  trialBannerBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  trialLockScreen: {
    flex: 1,
    backgroundColor: '#faf8f6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  trialLockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trialLockTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  trialLockSub: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  trialLockCta: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  trialLockCtaText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  trialLockBackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  trialLockBackText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
});
