import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
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

  // 1. If not authenticated -> Login Screen (Mobile + OTP)
  if (!isAuthenticated) {
    return <LoginScreen />;
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
      <View style={styles.container}>
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

        {/* Bottom Navigation Bar: Dashboard, Properties, Management, Profile */}
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
    backgroundColor: '#f6f4ee',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f4ee',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fdfcf9',
    borderTopWidth: 1,
    borderTopColor: '#e8dec8',
    paddingVertical: 10,
    paddingBottom: 16,
    justifyContent: 'space-around',
    shadowColor: '#0c2340',
    shadowOpacity: 0.08,
    shadowRadius: 10,
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
    color: '#78716c',
  },
  navLabelActive: {
    color: '#0f2b5c',
    fontWeight: '900',
  },
});
