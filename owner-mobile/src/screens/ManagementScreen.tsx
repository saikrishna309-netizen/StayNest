import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FinanceScreen } from './FinanceScreen';
import { Property } from '../types';

interface ManagementScreenProps {
  onBackToDashboard?: () => void;
  selectedPropertyId?: string | null;
  onActivePropertyChange?: (property: Property) => void;
}

export const ManagementScreen: React.FC<ManagementScreenProps> = ({
  onBackToDashboard,
  selectedPropertyId,
  onActivePropertyChange,
}) => {
  return (
    <View style={styles.container}>
      {/* Dedicated Finance, Expenses & Rent Ledger Screen */}
      <FinanceScreen
        onBack={onBackToDashboard || (() => {})}
        selectedPropertyId={selectedPropertyId}
        onActivePropertyChange={onActivePropertyChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4ee',
  },
});
