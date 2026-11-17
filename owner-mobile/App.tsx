import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { RoomsBedsScreen } from './src/screens/RoomsBedsScreen';
import { TenantsScreen } from './src/screens/TenantsScreen';
import { FinanceScreen } from './src/screens/FinanceScreen';
import { Property } from './src/types';

const MainNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'rooms' | 'tenants' | 'finance'>('dashboard');
  const [selectedPropertyForRooms, setSelectedPropertyForRooms] = useState<Property | null>(null);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleOpenRooms = (property: Property) => {
    setSelectedPropertyForRooms(property);
    setCurrentTab('rooms');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {currentTab === 'dashboard' && (
          <DashboardScreen
            onSelectPropertyForRooms={handleOpenRooms}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'rooms' && (
          <RoomsBedsScreen
            property={selectedPropertyForRooms}
            onBack={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'tenants' && (
          <TenantsScreen onBack={() => setCurrentTab('dashboard')} />
        )}

        {currentTab === 'finance' && (
          <FinanceScreen onBack={() => setCurrentTab('dashboard')} />
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('dashboard')}
          >
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
            onPress={() => setCurrentTab('tenants')}
          >
            <Text
              style={[
                styles.navLabel,
                currentTab === 'tenants' && styles.navLabelActive,
              ]}
            >
              Tenants
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('finance')}
          >
            <Text
              style={[
                styles.navLabel,
                currentTab === 'finance' && styles.navLabelActive,
              ]}
            >
              Ledger
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
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#4f46e5',
    fontWeight: '900',
  },
});
