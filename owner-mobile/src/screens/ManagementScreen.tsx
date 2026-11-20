import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { TenantsScreen } from './TenantsScreen';
import { FinanceScreen } from './FinanceScreen';

export const ManagementScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<'finance' | 'tenants' | 'reports'>('finance');

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.pageTitleBold}>Operations & Management</Text>
            <Text style={styles.pageTitleSub}>Expenses, Rent & Resident Records</Text>
          </View>
        </View>
      </View>

      {/* Segmented Controller: Expenses & Rent FIRST, Tenants SECOND */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, subTab === 'finance' && styles.segmentBtnActive]}
          onPress={() => setSubTab('finance')}
        >
          <Text style={[styles.segmentText, subTab === 'finance' && styles.segmentTextActive]}>
            💰 Expenses & Rent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, subTab === 'tenants' && styles.segmentBtnActive]}
          onPress={() => setSubTab('tenants')}
        >
          <Text style={[styles.segmentText, subTab === 'tenants' && styles.segmentTextActive]}>
            👥 Tenants
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen View */}
      <View style={styles.body}>
        {subTab === 'finance' ? (
          <FinanceScreen onBack={() => {}} />
        ) : (
          <TenantsScreen onBack={() => {}} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4ee',
  },
  header: {
    backgroundColor: '#fdfcf9',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8dec8',
  },
  pageTitleBold: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageTitleSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    margin: 12,
    padding: 4,
    borderRadius: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  headerLogo: {
    width: 76,
    height: 38,
    marginRight: 10,
  },
});
