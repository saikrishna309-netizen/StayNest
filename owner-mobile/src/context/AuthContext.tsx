import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { safeStorage } from '../utils/safeStorage';
import { API_BASE, apiClient, setAuthToken, setOnUnauthorizedHandler } from '../api/client';
import { fastDataCache } from '../services/dataCache';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrating: boolean;
  sendOtp: (phone: string) => Promise<{ message: string; demoOtp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  updateProfile: (fullName: string, email: string, markProfileComplete?: boolean) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Session storage for generated OTP codes
const activeOtps: Record<string, string> = {};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState<boolean>(true);

  // ─── RESTORE SESSION ON APP LAUNCH & HYDRATE FROM GET /users/me ───
  useEffect(() => {
    let mounted = true;
    // Non-blocking ping to wake Render backend from cold sleep immediately on startup
    fetch(`${API_BASE}/health`).catch(() => {});

    const safetyTimer = setTimeout(() => {
      if (mounted) setHydrating(false);
    }, 4000);

    const restoreSession = async () => {
      try {
        const storedToken = await safeStorage.getItem('@staynest_owner_token');
        const storedUser = await safeStorage.getItem('@staynest_owner_user');
        if (
          storedToken &&
          !storedToken.startsWith('live-session-token-') &&
          !storedToken.startsWith('mock-jwt-token')
        ) {
          setAuthToken(storedToken);
          setToken(storedToken);

          let hasCachedUser = false;
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
              hasCachedUser = true;
            } catch {
              hasCachedUser = false;
            }
          }

          // If we already have a cached user, enter the app immediately and refresh /users/me in background
          if (hasCachedUser) {
            if (mounted) setHydrating(false);
            apiClient<User>('/users/me')
              .then((freshUser) => {
                if (mounted && freshUser) {
                  setUser(freshUser);
                  safeStorage.setItem('@staynest_owner_user', JSON.stringify(freshUser)).catch(() => {});
                }
              })
              .catch(() => {});
          } else {
            // No cached user yet: race /users/me against a 3.5s cap so cold starts never hang the splash screen
            try {
              const freshUser = await Promise.race([
                apiClient<User>('/users/me'),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
              ]);
              if (mounted && freshUser) {
                setUser(freshUser);
                await safeStorage.setItem('@staynest_owner_user', JSON.stringify(freshUser)).catch(() => {});
              }
            } catch {
              // If 401, onUnauthorizedHandler clears session; otherwise fall through cleanly
            }
          }
        } else if (storedToken) {
          await safeStorage.removeItem('@staynest_owner_token').catch(() => {});
          await safeStorage.removeItem('@staynest_owner_user').catch(() => {});
        }
      } catch (err) {
        console.log('Error restoring session:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (mounted) setHydrating(false);
      }
    };
    restoreSession();

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const sendOtp = async (phone: string): Promise<{ message: string; demoOtp?: string }> => {
    const digits = phone.replace(/[^0-9]/g, '');
    const cleanPhone = digits.length > 10 ? digits.slice(-10) : digits;

    // 1. Generate real random 6-digit OTP
    const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
    activeOtps[cleanPhone] = randomOtp;

    // 2. Direct Automated WhatsApp Message via UltraMsg API (Sent only ONCE)
    try {
      const params = new URLSearchParams();
      params.append('token', '4kcul3wmcwdoh5d0');
      params.append('to', `+91${cleanPhone}`);
      params.append(
        'body',
        `🔐 *StayNest Verification Code*\n\nHello PG Owner!\n\nYour 6-digit login verification code is: *${randomOtp}*\n\nValid for 10 minutes. Enter this code to sign in to your StayNest Owner account.\n\n— *StayNest Team*`
      );

      fetch('https://api.ultramsg.com/instance197383/messages/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }).catch((e) => console.log('UltraMsg mobile note:', e));
    } catch (waErr) {
      console.log('WhatsApp send error:', waErr);
    }

    // 3. Notify backend API with the exact same synchronized OTP (with 8s cap to prevent blocking UI on cold starts)
    try {
      const res = await Promise.race([
        apiClient<{ message: string; demoOtp?: string }>('/auth/otp/send', {
          method: 'POST',
          body: JSON.stringify({ phone: cleanPhone, role: 'ROLE_OWNER', otp: randomOtp }),
        }),
        new Promise<{ message: string; demoOtp?: string }>((resolve) =>
          setTimeout(
            () => resolve({ message: `Verification code sent to +91 ${cleanPhone}`, demoOtp: randomOtp }),
            8000
          )
        ),
      ]);
      return { message: res.message || `Verification code sent to +91 ${cleanPhone}`, demoOtp: randomOtp };
    } catch {
      return { message: `Verification code sent to +91 ${cleanPhone}`, demoOtp: randomOtp };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const digits = phone.replace(/[^0-9]/g, '');
    const cleanPhone = digits.length > 10 ? digits.slice(-10) : digits;
    const cleanOtp = otp.trim();

    let authenticatedUser: User | null = null;
    let authenticatedToken: string | null = null;

    try {
      const res = await apiClient<{ accessToken: string; user: User }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
      });

      authenticatedToken = res.accessToken;
      authenticatedUser = res.user;
    } catch (err: any) {
      // Retry by syncing OTP to backend first in case /auth/otp/send had timed out during cold start
      const expected = activeOtps[cleanPhone];
      if (expected && cleanOtp === expected) {
        try {
          await apiClient('/auth/otp/send', {
            method: 'POST',
            body: JSON.stringify({ phone: cleanPhone, role: 'ROLE_OWNER', otp: cleanOtp }),
          });
          const retryRes = await apiClient<{ accessToken: string; user: User }>('/auth/otp/verify', {
            method: 'POST',
            body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp }),
          });
          authenticatedToken = retryRes.accessToken;
          authenticatedUser = retryRes.user;
        } catch (retryErr: any) {
          throw new Error(
            retryErr?.message ||
              'Server is waking up or unreachable. Please tap Verify OTP again in a few seconds.'
          );
        }
      } else {
        throw new Error(err.message || 'Incorrect OTP code. Please enter the 6-digit code received on your WhatsApp.');
      }
    }

    if (authenticatedUser && authenticatedToken) {
      // Only clear account-scoped caches when switching to a DIFFERENT owner mobile number
      const lastLoginPhone = await safeStorage.getItem('@staynest_last_login_phone').catch(() => null);
      if (lastLoginPhone && lastLoginPhone !== cleanPhone) {
        clearAccountScopedCaches();
        fastDataCache.invalidateAll();
      }
      await safeStorage.setItem('@staynest_last_login_phone', cleanPhone).catch(() => {});
      // Navigate immediately by updating auth state first, persist in parallel
      setAuthToken(authenticatedToken);
      setToken(authenticatedToken);
      setUser(authenticatedUser);

      Promise.all([
        safeStorage.setItem('@staynest_owner_token', authenticatedToken),
        safeStorage.setItem('@staynest_owner_user', JSON.stringify(authenticatedUser)),
      ]).catch(() => {});

      // Non-blocking background WhatsApp welcome message on first onboarding
      void (async () => {
        try {
          const welcomeKey = `@staynest_welcomed_${cleanPhone}`;
          const hasBeenWelcomed = await safeStorage.getItem(welcomeKey);
          if (!hasBeenWelcomed) {
            const welcomeParams = new URLSearchParams();
            welcomeParams.append('token', '4kcul3wmcwdoh5d0');
            welcomeParams.append('to', `+91${cleanPhone}`);
            welcomeParams.append(
              'body',
              `🎉 *Welcome to StayNest!* 🏡\n\nHappily manage your PG seamlessly with StayNest Owner App!\n\n• Manage PG rooms, beds & monthly rents\n• Track month-wise collections & profits\n• Send 1-click WhatsApp rent reminders\n\n— *Team StayNest*`
            );
            fetch('https://api.ultramsg.com/instance197383/messages/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: welcomeParams.toString(),
            }).catch(() => {});
            await safeStorage.setItem(welcomeKey, 'true');
          }
        } catch {}
      })();
    }
  };

  const updateProfile = async (
    fullName: string,
    email: string,
    markProfileComplete: boolean = true
  ) => {
    const updatedUser = await apiClient<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
        isProfileComplete: markProfileComplete,
      }),
    });
    const hydratedUser = { ...updatedUser, isProfileComplete: markProfileComplete };
    setUser(hydratedUser);
    await safeStorage.setItem('@staynest_owner_user', JSON.stringify(hydratedUser));
  };

  const login = async (email: string, pass: string) => {
    const res = await apiClient<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email.trim(), password: pass }),
    });

    setAuthToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    await safeStorage.setItem('@staynest_owner_token', res.accessToken);
    await safeStorage.setItem('@staynest_owner_user', JSON.stringify(res.user));
  };

  const clearAccountScopedCaches = () => {
    const keys = [
      '@staynest_custom_properties',
      '@staynest_active_property_id',
      '@staynest_custom_tenants',
      '@staynest_owner_payout',
      '@staynest_owner_subscription_v2',
      '@staynest_owner_custom_profile',
    ];
    keys.forEach((k) => {
      safeStorage.removeItem(k).catch(() => {});
    });
    if (typeof window !== 'undefined' && window.localStorage) {
      [
        'staynest_custom_properties',
        'staynest_active_property_id',
        'staynest_owner_subscription_v2',
      ].forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {}
      });
    }
  };

  const logout = () => {
    safeStorage.removeItem('@staynest_owner_token').catch(() => {});
    safeStorage.removeItem('@staynest_owner_user').catch(() => {});
    fastDataCache.invalidateAll();
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const unauthorizedAlertShownRef = useRef(false);

  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      if (!unauthorizedAlertShownRef.current) {
        unauthorizedAlertShownRef.current = true;
        Alert.alert(
          'Session Expired',
          'Your login session expired or the server restarted. Please sign in again with your mobile number.'
        );
        setTimeout(() => {
          unauthorizedAlertShownRef.current = false;
        }, 5000);
      }
      logout();
    });
    return () => setOnUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        hydrating,
        sendOtp,
        verifyOtp,
        updateProfile,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
