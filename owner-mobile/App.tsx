import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { OwnerRegistrationScreen } from './src/screens/OwnerRegistrationScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PropertiesScreen } from './src/screens/PropertiesScreen';
import { ManagementScreen } from './src/screens/ManagementScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { Property } from './src/types';

const MainNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'properties' | 'management' | 'profile'>('dashboard');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [registrationSkipped, setRegistrationSkipped] = useState(false);
  const [webDeviceMode, setWebDeviceMode] = useState<'MOBILE' | 'DESKTOP'>('DESKTOP');

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

  // 2. If newly registered via phone and profile incomplete -> Owner Registration Screen
  const isProfileIncomplete = (!user?.fullName || user.fullName === 'PG Owner') && !registrationSkipped;
  if (isProfileIncomplete) {
    return <OwnerRegistrationScreen onComplete={() => setRegistrationSkipped(true)} />;
  }

  const handleOpenProperty = (property: Property) => {
    setSelectedProperty(property);
    setCurrentTab('properties');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          {/* Tab 1: Dashboard */}
          {currentTab === 'dashboard' && (
            <DashboardScreen
              onSelectPropertyForRooms={handleOpenProperty}
              onNavigateTab={(tab) => {
                if (tab === 'rooms') setCurrentTab('properties');
                else if (tab === 'tenants' || tab === 'finance') setCurrentTab('management');
                else if (tab === 'profile') setCurrentTab('profile');
              }}
            />
          )}

          {/* Tab 2: Properties (Combined Property, Floors, Rooms & Beds) */}
          {currentTab === 'properties' && (
            <PropertiesScreen
              initialProperty={selectedProperty}
              onBackToDashboard={() => setCurrentTab('dashboard')}
            />
          )}

          {/* Tab 3: Management (Tenants, Rent, Expenses & Reports) */}
          {currentTab === 'management' && <ManagementScreen />}

          {/* Tab 4: Profile (PG Owner Account & Settings) */}
          {currentTab === 'profile' && (
            <ProfileScreen onBackToDashboard={() => setCurrentTab('dashboard')} />
          )}

          {/* Bottom Navigation Bar */}
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('dashboard')}
            >
              <Text style={styles.navIcon}>📊</Text>
              <Text
                style={[
                  styles.navLabel,
                  currentTab === 'dashboard' && styles.navLabelActive,
                ]}
              >
                Dashboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('properties')}
            >
              <Text style={styles.navIcon}>🏢</Text>
              <Text
                style={[
                  styles.navLabel,
                  currentTab === 'properties' && styles.navLabelActive,
                ]}
              >
                Properties
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('management')}
            >
              <Text style={styles.navIcon}>📋</Text>
              <Text
                style={[
                  styles.navLabel,
                  currentTab === 'management' && styles.navLabelActive,
                ]}
              >
                Management
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('profile')}
            >
              <Text style={styles.navIcon}>👤</Text>
              <Text
                style={[
                  styles.navLabel,
                  currentTab === 'profile' && styles.navLabelActive,
                ]}
              >
                Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 3,
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
});
