import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { sendOtp, verifyOtp, login } = useAuth();

  // Authentication mode: 'PHONE_OTP' | 'PASSWORD'
  const [authMode, setAuthMode] = useState<'PHONE_OTP' | 'PASSWORD'>('PHONE_OTP');

  // Phone + OTP State
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [lastOtp, setLastOtp] = useState('123456');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Email + Password Fallback State
  const [email, setEmail] = useState('owner@staynest.in');
  const [password, setPassword] = useState('Owner@123456');

  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let interval: any;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  // Handle Step 1: Send OTP
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    setInfoMessage('Contacting server...');
    try {
      const res = await sendOtp(cleanPhone);
      setStep('OTP');
      setOtp('');
      if (res.demoOtp) {
        setLastOtp(res.demoOtp);
      }
      setTimer(30);
      setTimerActive(true);
      setInfoMessage(res.message || `OTP sent to +91 ${cleanPhone}`);
    } catch (err: any) {
      // Even if network or server takes time, never trap user on spinner: advance to OTP tab!
      setStep('OTP');
      setOtp('');
      setLastOtp('123456');
      setTimer(30);
      setTimerActive(true);
      setInfoMessage('Server busy. Test OTP: 123456');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone.replace(/[^0-9]/g, ''), cleanOtp);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Email + Password Login
  const handlePasswordLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>PG OWNER APP</Text>
              <Text style={styles.versionBadge}>v1.0.0</Text>
            </View>
            <Text style={styles.subtitle}>
              {authMode === 'PHONE_OTP'
                ? step === 'PHONE'
                  ? 'Sign in or register with your mobile number'
                  : 'Enter 6-digit verification code'
                : 'Sign in with your email & password'}
            </Text>
          </View>

          {/* Info Banner */}
          {infoMessage && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>✓ {infoMessage}</Text>
            </View>
          )}

          {/* PHONE + OTP MODE */}
          {authMode === 'PHONE_OTP' && (
            <>
              {step === 'PHONE' ? (
                /* Step 1: Mobile Number Input */
                <View style={styles.form}>
                  <Text style={styles.label}>MOBILE NUMBER</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      value={phone}
                      onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={10}
                      placeholder="9876543210"
                      placeholderTextColor="#94a3b8"
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.quickFillPill}
                    onPress={() => setPhone('9876543210')}
                  >
                    <Text style={styles.quickFillText}>💡 Tap to quick-fill demo: 9876543210</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleSendOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Get Verification Code →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* Step 2: 6-Digit OTP Input */
                <View style={styles.form}>
                  <View style={styles.phoneEditRow}>
                    <Text style={styles.otpSubtitle}>
                      Code sent to <Text style={styles.boldText}>+91 {phone}</Text>
                    </Text>
                    <TouchableOpacity onPress={() => setStep('PHONE')}>
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>ENTER 6-DIGIT OTP</Text>
                  <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="123456"
                    placeholderTextColor="#cbd5e1"
                    autoFocus
                  />

                  {/* Auto-fill test OTP */}
                  <TouchableOpacity
                    style={styles.quickFillPill}
                    onPress={() => setOtp(lastOtp)}
                  >
                    <Text style={styles.quickFillText}>⚡ Tap to auto-fill code: {lastOtp}</Text>
                  </TouchableOpacity>

                  {/* Resend OTP Timer */}
                  <View style={styles.resendRow}>
                    {timerActive ? (
                      <Text style={styles.timerText}>Resend code in {timer}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                        <Text style={styles.resendLink}>Resend OTP Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Verify & Enter Dashboard</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* EMAIL + PASSWORD FALLBACK MODE */}
          {authMode === 'PASSWORD' && (
            <View style={styles.form}>
              <Text style={styles.label}>OWNER EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="owner@staynest.in"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handlePasswordLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In with Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Switcher */}
          <View style={styles.bottomSwitcher}>
            <TouchableOpacity
              onPress={() => {
                setAuthMode(authMode === 'PHONE_OTP' ? 'PASSWORD' : 'PHONE_OTP');
                setStep('PHONE');
              }}
            >
              <Text style={styles.switchModeText}>
                {authMode === 'PHONE_OTP'
                  ? '🔑 Or sign in with Email & Password'
                  : '📱 Or sign in with Mobile Number (OTP)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    letterSpacing: 1,
  },
  versionBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTitle: {
    color: '#4f46e5',
  },
  pgTag: {
    color: '#f59e0b',
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  countryCodeBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 1.5,
  },
  otpInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 14,
  },
  quickFillPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  quickFillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  phoneEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  otpSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  boldText: {
    fontWeight: '800',
    color: '#0f172a',
  },
  editText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
    textDecorationLine: 'underline',
  },
  resendRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  timerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bottomSwitcher: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  logoImage: {
    width: 220,
    height: 100,
    alignSelf: 'center',
    marginBottom: 8,
  },
});
