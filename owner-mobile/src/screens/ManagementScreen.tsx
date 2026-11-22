import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FinanceScreen } from './FinanceScreen';

interface ManagementScreenProps {
  onBackToDashboard?: () => void;
}

export const ManagementScreen: React.FC<ManagementScreenProps> = ({ onBackToDashboard }) => {
  return (
    <View style={styles.container}>
      {/* Dedicated Finance, Expenses & Rent Ledger Screen */}
      <FinanceScreen onBack={onBackToDashboard || (() => {})} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4ee',
  },
});
