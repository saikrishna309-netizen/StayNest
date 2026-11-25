// Cross-platform lightweight event bus (works on Android/iOS native & Web)
type Listener = () => void;

const dataListeners = new Set<Listener>();

export const onDataChanged = (listener: Listener): (() => void) => {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
};

export const emitDataChanged = () => {
  dataListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('staynest_tenant_updated'));
      window.dispatchEvent(new CustomEvent('staynest_expense_added'));
    } catch {
      // ignore
    }
  }
};
