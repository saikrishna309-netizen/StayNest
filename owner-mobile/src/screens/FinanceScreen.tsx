import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiClient } from '../api/client';
import { RentInvoice, Expense } from '../types';

interface FinanceScreenProps {
  onBack: () => void;
}

export const FinanceScreen: React.FC<FinanceScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Log Expense Form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('ELECTRICITY');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const STANDARD_EXPENSES = [
    { label: '🏢 Building Rent', category: 'BUILDING_RENT', defaultTitle: 'Building Monthly Rent' },
    { label: '👷 Workers Salary', category: 'SALARY', defaultTitle: 'Cook & Staff Salary' },
    { label: '🥦 Vegetables & Goods', category: 'GROCERIES', defaultTitle: 'Daily Vegetables & Mess Groceries' },
    { label: '⚡ Electricity & Water', category: 'UTILITIES', defaultTitle: 'Electricity & Water Bill' },
    { label: '📶 Wi-Fi & Internet', category: 'INTERNET', defaultTitle: 'Wi-Fi & Broadband Bill' },
    { label: '🔧 Maintenance & Repairs', category: 'MAINTENANCE', defaultTitle: 'Plumbing & Electrical Repair' },
  ];

  const handleSelectTemplate = (template: typeof STANDARD_EXPENSES[0]) => {
    setTitle(template.defaultTitle);
    setCategory(template.category);
    setShowExpenseForm(true);
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [invRes, expRes] = await Promise.all([
        apiClient<{ content: RentInvoice[] }>('/owner/rent-invoices'),
        apiClient<{ content: Expense[] }>('/owner/expenses'),
      ]);
      setInvoices(invRes.content || []);
      setExpenses(expRes.content || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await apiClient(`/owner/rent-invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMode: 'UPI_QR',
          notes: 'Marked paid from mobile app',
        }),
      });
      Alert.alert('Payment Recorded', 'Invoice marked as PAID via UPI/Cash!');
      loadFinanceData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record payment');
    }
  };

  const handleCreateExpense = async () => {
    if (!title.trim() || !amountRupees) {
      Alert.alert('Required', 'Please enter expense title and amount');
      return;
    }

    setSubmittingExpense(true);
    try {
      await apiClient('/owner/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          amountPaise: Number(amountRupees) * 100,
          category,
          expenseDate: new Date().toISOString().split('T')[0],
        }),
      });
      Alert.alert('Saved', 'Expense record added to ledger');
      setTitle('');
      setAmountRupees('');
      setShowExpenseForm(false);
      loadFinanceData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not log expense');
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rent Ledger & Expenses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowExpenseForm(!showExpenseForm)}
        >
          <Text style={styles.addBtnText}>+ Expense</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick Add Standard Expenses */}
        <View style={styles.quickExpensesCard}>
          <Text style={styles.quickExpensesTitle}>⚡ QUICK ADD DAILY EXPENSE</Text>
          <Text style={styles.quickExpensesSub}>
            Tap any standard PG expense to quickly log payments:
          </Text>
          <View style={styles.templatesGrid}>
            {STANDARD_EXPENSES.map((tpl) => (
              <TouchableOpacity
                key={tpl.category}
                style={[
                  styles.templateChip,
                  category === tpl.category && showExpenseForm && styles.templateChipActive,
                ]}
                onPress={() => handleSelectTemplate(tpl)}
              >
                <Text
                  style={[
                    styles.templateChipText,
                    category === tpl.category && showExpenseForm && styles.templateChipTextActive,
                  ]}
                >
                  {tpl.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Log Expense Form */}
        {showExpenseForm && (
          <View style={styles.formCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.formTitle}>Log Operational Expense</Text>
              <TouchableOpacity onPress={() => setShowExpenseForm(false)}>
                <Text style={{ fontSize: 16, color: '#64748b', fontWeight: 'bold' }}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>TITLE / DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. BESCOM Electricity Bill"
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>AMOUNT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={amountRupees}
                  onChangeText={setAmountRupees}
                  keyboardType="numeric"
                  placeholder="3500"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>CATEGORY</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="ELECTRICITY"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, submittingExpense && { opacity: 0.6 }]}
              onPress={handleCreateExpense}
              disabled={submittingExpense}
            >
              <Text style={styles.saveBtnText}>
                {submittingExpense ? 'Saving...' : 'Add Expense Record'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invoices List */}
        <Text style={styles.sectionTitle}>RENT INVOICES</Text>
        {loading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 30 }} />
        ) : invoices.length === 0 ? (
          <Text style={styles.emptyText}>No rent invoices generated yet.</Text>
        ) : (
          invoices.map((inv) => (
            <View key={inv.id} style={styles.invCard}>
              <View style={styles.invHeader}>
                <View>
                  <Text style={styles.invTenant}>{inv.tenantName || 'Resident'}</Text>
                  <Text style={styles.invNo}>{inv.invoiceNumber}</Text>
                </View>
                <Text
                  style={[
                    styles.invAmount,
                    inv.status === 'PAID' ? { color: '#059669' } : { color: '#dc2626' },
                  ]}
                >
                  ₹{(inv.totalAmountPaise / 100).toLocaleString('en-IN')}
                </Text>
              </View>

              <View style={styles.invFooter}>
                <View
                  style={[
                    styles.statusChip,
                    inv.status === 'PAID' ? styles.statusPaid : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      inv.status === 'PAID' ? { color: '#059669' } : { color: '#d97706' },
                    ]}
                  >
                    {inv.status}
                  </Text>
                </View>

                {inv.status !== 'PAID' && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => handleMarkPaid(inv.id)}
                  >
                    <Text style={styles.payBtnText}>Mark Paid (Cash/UPI)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        {/* Expenses List */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>RECENT EXPENSES</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses logged yet.</Text>
        ) : (
          expenses.map((e) => (
            <View key={e.id} style={styles.expCard}>
              <View>
                <Text style={styles.expTitle}>{e.title}</Text>
                <Text style={styles.expCategory}>{e.category}</Text>
              </View>
              <Text style={styles.expAmount}>
                -₹{(e.amountPaise / 100).toLocaleString('en-IN')}
              </Text>
            </View>
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  invCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  invHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invTenant: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  invNo: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  invAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  invFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  statusChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPaid: {
    backgroundColor: '#ecfdf5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  payBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  expCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  expCategory: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  expAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 10,
  },
  quickExpensesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  quickExpensesTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4f46e5',
    letterSpacing: 0.5,
  },
  quickExpensesSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  templateChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  templateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  templateChipTextActive: {
    color: '#4f46e5',
    fontWeight: '900',
  },
});
