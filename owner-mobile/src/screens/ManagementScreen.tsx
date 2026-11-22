import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FinanceScreen } from './FinanceScreen';

export const ManagementScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Dedicated Finance, Expenses & Rent Ledger Screen without redundant tenant tab */}
      <FinanceScreen onBack={() => {}} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4ee',
  },
});
