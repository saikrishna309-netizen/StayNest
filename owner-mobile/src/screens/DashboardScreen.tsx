import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property, Tenant, RentInvoice, Expense } from '../types';

interface DashboardScreenProps {
  onSelectPropertyForRooms: (property: Property) => void;
  onNavigateTab: (tab: 'rooms' | 'tenants' | 'finance') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onSelectPropertyForRooms,
  onNavigateTab,
}) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [propsRes, tenantsRes, invRes, expRes] = await Promise.all([
        apiClient<{ content: Property[] }>('/owner/properties'),
        apiClient<{ content: Tenant[] }>('/owner/tenants'),
        apiClient<{ content: RentInvoice[] }>('/owner/invoices'),
        apiClient<{ content: Expense[] }>('/owner/expenses'),
      ]);

      setProperties(propsRes.content || []);
      setTenants(tenantsRes.content || []);
      setInvoices(invRes.content || []);
      setExpenses(expRes.content || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100;
  const totalRentCollected = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + (i.paidAmountPaise || 0), 0) / 100;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>
            Stay<Text style={styles.brandAccent}>Nest</Text><Text style={styles.pgTag}>-PG</Text>
          </Text>
          <Text style={styles.welcomeText}>Welcome back, <Text style={styles.ownerName}>{user?.fullName || 'Owner'}</Text></Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>MY PROPERTIES</Text>
            <Text style={styles.kpiValue}>{properties.length}</Text>
            <Text style={styles.kpiSub}>Active Listings</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ACTIVE TENANTS</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{tenants.length}</Text>
            <Text style={styles.kpiSub}>Registered Residents</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>RENT COLLECTED</Text>
            <Text style={[styles.kpiValue, { color: '#4f46e5' }]}>
              ₹{totalRentCollected.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.kpiSub}>{invoices.length} Invoices</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>EXPENSES LOGGED</Text>
            <Text style={[styles.kpiValue, { color: '#e11d48' }]}>
              ₹{totalExpense.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.kpiSub}>{expenses.length} Records</Text>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onNavigateTab('tenants')}
          >
            <Text style={styles.actionBtnTitle}>+ Onboard Tenant</Text>
            <Text style={styles.actionBtnSub}>Assign bed & KYC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onNavigateTab('finance')}
          >
            <Text style={styles.actionBtnTitle}>Record Rent</Text>
            <Text style={styles.actionBtnSub}>Cash / UPI tracking</Text>
          </TouchableOpacity>
        </View>

        {/* Properties List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MY PG LISTINGS</Text>
          <Text style={styles.subtext}>Tap to manage floors & beds</Text>
        </View>

        {loading && properties.length === 0 ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 30 }} />
        ) : properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No PG properties listed yet.</Text>
          </View>
        ) : (
          properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.propertyCard}
              onPress={() => onSelectPropertyForRooms(p)}
            >
              <View style={styles.propertyHeader}>
                <Text style={styles.propertyName}>{p.name}</Text>
                <View style={styles.policyBadge}>
                  <Text style={styles.policyText}>{p.genderPolicy}</Text>
                </View>
              </View>

              <Text style={styles.propertyAddress}>
                {p.localityName ? `${p.localityName}, ` : ''}{p.cityName}
              </Text>

              <View style={styles.propertyFooter}>
                <Text style={styles.propertyPrice}>
                  Starting ₹{(((p.startingPricePaise || 0)) / 100).toLocaleString('en-IN')}/mo
                </Text>
                <View style={styles.manageBtn}>
                  <Text style={styles.manageBtnText}>Manage Floors & Beds →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  brandAccent: {
    color: '#4f46e5',
  },
  pgTag: {
    color: '#f59e0b',
    fontWeight: '900',
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 11,
  },
  content: {
    padding: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 10,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 12,
    borderRadius: 14,
  },
  actionBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  actionBtnSub: {
    fontSize: 10,
    color: '#6366f1',
    marginTop: 2,
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  policyBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  policyText: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '800',
  },
  propertyAddress: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  propertyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  propertyPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
  },
  manageBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  manageBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
