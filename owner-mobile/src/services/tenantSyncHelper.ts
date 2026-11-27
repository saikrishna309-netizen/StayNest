import { safeStorage } from '../utils/safeStorage';
import { Tenant } from '../types';
import { fastDataCache } from './dataCache';
import { emitDataChanged } from '../utils/appEvents';
import { apiClient } from '../api/client';
import { isValidUuid } from './propertyDataService';

/**
 * Synchronizes tenant vacate/delete and bed release across:
 * - Backend API (when valid UUIDs)
 * - @staynest_custom_tenants
 * - @staynest_floors_<propertyId>
 * - fastDataCache SWR cache
 * - App-wide emitDataChanged() listeners (Home, Rooms, Tenants, Finance)
 */
export async function syncTenantVacateOrDelete(
  action: 'VACATE' | 'DELETE',
  params: {
    tenantId?: string;
    bedId?: string;
    propertyId?: string;
    phone?: string;
  }
): Promise<void> {
  const { tenantId, bedId, propertyId, phone } = params;
  const cleanTargetPhone = (phone || '').replace(/\D/g, '').slice(-10);

  // 1. Update backend bed status if bedId is a backend UUID
  if (bedId && isValidUuid(bedId)) {
    apiClient(`/owner/beds/${bedId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'AVAILABLE' }),
    }).catch(() => {});
  }

  // 2. Update @staynest_custom_tenants in safeStorage
  try {
    const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
    if (storedCustomStr) {
      const customList: Tenant[] = JSON.parse(storedCustomStr);
      if (Array.isArray(customList)) {
        const matches = (ct: Tenant) => {
          if (tenantId && ct.id === tenantId) return true;
          if (bedId && ct.bedId === bedId) return true;
          if (cleanTargetPhone) {
            const ctPhone = (ct.phone || '').replace(/\D/g, '').slice(-10);
            if (ctPhone && ctPhone === cleanTargetPhone) return true;
          }
          return false;
        };

        const updatedCustom =
          action === 'DELETE'
            ? customList.filter((ct) => !matches(ct))
            : customList.map((ct) =>
                matches(ct)
                  ? {
                      ...ct,
                      active: false,
                      stayStatus: 'TERMINATED' as const,
                      bedId: undefined,
                      roomNumber: undefined,
                    }
                  : ct
              );
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(updatedCustom));
      }
    }
  } catch {
    // ignore
  }

  // 3. Free up the bed in @staynest_floors_<propertyId>
  if (propertyId && bedId) {
    try {
      let cachedFloors = await safeStorage.getItem(`@staynest_floors_${propertyId}`).catch(() => null);
      if (!cachedFloors && typeof window !== 'undefined' && window.localStorage) {
        cachedFloors = window.localStorage.getItem(`staynest_floors_${propertyId}`);
      }
      if (cachedFloors) {
        const parsed = JSON.parse(cachedFloors);
        if (Array.isArray(parsed)) {
          const updatedFloors = parsed.map((f: any) => ({
            ...f,
            rooms: (f.rooms || []).map((r: any) => ({
              ...r,
              beds: (r.beds || []).map((b: any) =>
                b.id === bedId ? { ...b, status: 'AVAILABLE' } : b
              ),
            })),
          }));
          await safeStorage.setItem(`@staynest_floors_${propertyId}`, JSON.stringify(updatedFloors));
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`staynest_floors_${propertyId}`, JSON.stringify(updatedFloors));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Invalidate SWR cache and notify all mounted screens
  fastDataCache.invalidateAll();
  emitDataChanged();
}
