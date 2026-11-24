import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
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
import { Property } from './src/types';

// ─── TRENDY MODERN SVG ICONS (MATCHING SCREENSHOT) ───
const NavHomeIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 0114 20v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 013 20v-9.5z"
      fill={color}
    />
  </Svg>
);

const NavGridIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7.5" height="7.5" rx="2.5" stroke={color} strokeWidth="2.2" />
    <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2.5" stroke={color} strokeWidth="2.2" />
    <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2.5" stroke={color} strokeWidth="2.2" />
    <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" stroke={color} strokeWidth="2.2" />
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

const NavWalletIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Rect x="2.5" y="5.5" width="19" height="14" rx="3.5" stroke={color} strokeWidth="2.2" />
    <Path d="M2.5 10h19" stroke={color} strokeWidth="1.8" />
    <Path d="M14.5 11.5H20a1.5 1.5 0 011.5 1.5v2A1.5 1.5 0 0120 16.5h-5.5a1.5 1.5 0 01-1.5-1.5v-2a1.5 1.5 0 011.5-1.5z" stroke={color} strokeWidth="2" fill="#ffffff" />
    <Circle cx="17.5" cy="14" r="1.2" fill={color} />
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

  // Direct login straight to dashboard for all owners (no blocking onboarding wizard)
  const handleOpenProperty = (property: Property) => {
    setSelectedProperty(property);
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
          {/* Tab 1: Dashboard (Fast Persistent Pane) */}
          <View style={[styles.tabPane, currentTab === 'dashboard' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <DashboardScreen
              resetTrigger={dashboardResetTrigger}
              onSelectPropertyForRooms={handleOpenProperty}
              onActivePropertyChange={(p) => setSelectedProperty(p)}
              onNavigateTab={(tab) => {
                if (tab === 'rooms') setCurrentTab('properties');
                else if (tab === 'tenants') setCurrentTab('tenants');
                else if (tab === 'finance') setCurrentTab('management');
                else if (tab === 'profile') setCurrentTab('profile');
              }}
            />
          </View>

          {/* Tab 2: Properties (Combined Property, Floors, Rooms & Beds) */}
          <View style={[styles.tabPane, currentTab === 'properties' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <PropertiesScreen
              initialProperty={selectedProperty}
              onBackToDashboard={() => setCurrentTab('dashboard')}
            />
          </View>

          {/* Tab 3: Tenants (Dedicated Standalone Screen for all Resident actions) */}
          <View style={[styles.tabPane, currentTab === 'tenants' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <TenantsScreen
              selectedPropertyId={selectedProperty?.id}
              onBack={() => setCurrentTab('dashboard')}
            />
          </View>

          {/* Tab 4: Management (Expenses, Finance & Reports) */}
          <View style={[styles.tabPane, currentTab === 'management' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <ManagementScreen onBackToDashboard={() => setCurrentTab('dashboard')} />
          </View>

          {/* Tab 5: Profile (PG Owner Account & Settings) */}
          <View style={[styles.tabPane, currentTab === 'profile' ? styles.tabPaneActive : styles.tabPaneHidden]}>
            <ProfileScreen
              onBackToDashboard={() => setCurrentTab('dashboard')}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          </View>

          {/* ─── FLOATING TRENDY BOTTOM NAVIGATION BAR (MATCHING SCREENSHOT) ─── */}
          <View style={styles.floatingBarOuter}>
            <View style={styles.floatingPillBar}>
              {/* Tab 1: Dashboard / Home */}
              <TouchableOpacity
                style={[styles.floatingTabCircle, currentTab === 'dashboard' && styles.floatingTabCircleActive]}
                onPress={() => {
                  setCurrentTab('dashboard');
                  setDashboardResetTrigger((prev) => prev + 1);
                }}
                activeOpacity={0.8}
              >
                <NavHomeIcon color={currentTab === 'dashboard' ? '#ffffff' : '#9a3412'} />
              </TouchableOpacity>

              {/* Tab 2: Properties / Grid */}
              <TouchableOpacity
                style={[styles.floatingTabCircle, currentTab === 'properties' && styles.floatingTabCircleActive]}
                onPress={() => setCurrentTab('properties')}
                activeOpacity={0.8}
              >
                <NavGridIcon color={currentTab === 'properties' ? '#ffffff' : '#9a3412'} />
              </TouchableOpacity>

              {/* Tab 3: Tenants (Multiple People Logo) */}
              <TouchableOpacity
                style={[styles.floatingTabCircle, currentTab === 'tenants' && styles.floatingTabCircleActive]}
                onPress={() => setCurrentTab('tenants')}
                activeOpacity={0.8}
              >
                <NavTenantsIcon color={currentTab === 'tenants' ? '#ffffff' : '#9a3412'} />
              </TouchableOpacity>

              {/* Tab 4: Financials / Expenses & Reports */}
              <TouchableOpacity
                style={[styles.floatingTabCircle, currentTab === 'management' && styles.floatingTabCircleActive]}
                onPress={() => setCurrentTab('management')}
                activeOpacity={0.8}
              >
                <NavWalletIcon color={currentTab === 'management' ? '#ffffff' : '#9a3412'} />
              </TouchableOpacity>

              {/* Tab 5: User Profile */}
              <TouchableOpacity
                style={[styles.floatingTabCircle, currentTab === 'profile' && styles.floatingTabCircleActive]}
                onPress={() => setCurrentTab('profile')}
                activeOpacity={0.8}
              >
                <NavUserIcon color={currentTab === 'profile' ? '#ffffff' : '#9a3412'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
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
  // ─── Floating Trendy Bottom Bar (Light Orange Pill + White Icon on Active Circle) ───
  floatingBarOuter: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'android' ? 46 : 28,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  floatingPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed', // Sleek Light Orange / Warm Cream
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1.5,
    borderColor: '#fed7aa', // Light Orange Accent Border
    shadowColor: '#ea580c',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  floatingTabCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  floatingTabCircleActive: {
    backgroundColor: '#f97316', // Vibrant Orange fill when selected
    shadowColor: '#f97316',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
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
});
