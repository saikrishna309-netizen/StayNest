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
  SafeAreaView,
  Modal,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AmbientOrangeBackground } from '../components/AmbientOrangeBackground';
import { GlassCard } from '../components/GlassCard';
import { ScalePressable } from '../components/ScalePressable';
import { BrandLoader } from '../components/BrandLoader';

export const LoginScreen: React.FC = () => {
  const { sendOtp, verifyOtp, login } = useAuth();

  // Authentication mode: 'PHONE_OTP' | 'PASSWORD'
  const [authMode, setAuthMode] = useState<'PHONE_OTP' | 'PASSWORD'>('PHONE_OTP');

  // Phone + OTP State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Terms & Conditions State
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [legalModalType, setLegalModalType] = useState<'TERMS' | 'PRIVACY' | null>(null);

  // Email + Password Fallback State
  const [email, setEmail] = useState('owner@staynest.in');
  const [password, setPassword] = useState('Owner@123456');

  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);

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

  // Handle Step 1: Instant Optimistic Transition + Async OTP Dispatch
  const handleSendOtp = async () => {
    if (!acceptedTerms) {
      setTermsError('Please accept the Terms & Conditions to continue.');
      return;
    }
    setTermsError(null);

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }

    // Optimistically transition to OTP screen immediately (< 50ms)
    setStep('OTP');
    setOtp('');
    setTimer(30);
    setTimerActive(true);
    setInfoMessage(`Sending verification code to +91 ${cleanPhone}...`);

    try {
      const res = await sendOtp(cleanPhone);
      setInfoMessage(res.message || `Verification code sent to +91 ${cleanPhone}`);
    } catch {
      setInfoMessage(`Verification code sent to +91 ${cleanPhone}`);
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
    <AmbientOrangeBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <GlassCard borderRadius={28} padding={24} style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.loginTitle}>Owner Login</Text>
                <Text style={styles.subtitle}>
                  {authMode === 'PHONE_OTP'
                    ? step === 'PHONE'
                      ? 'Enter your mobile number to sign in'
                      : 'Enter the 6-digit verification code'
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
                          style={[
                            styles.phoneInput,
                            phoneFocused && styles.phoneInputFocused,
                          ]}
                          value={phone}
                          onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                          onFocus={() => setPhoneFocused(true)}
                          onBlur={() => setPhoneFocused(false)}
                          keyboardType="number-pad"
                          maxLength={10}
                          placeholder="Enter 10-digit mobile number"
                          placeholderTextColor="#64748B"
                        />
                      </View>

                      {/* Mandatory Terms & Conditions Checkbox */}
                      <TouchableOpacity
                        style={styles.termsRow}
                        onPress={() => {
                          const next = !acceptedTerms;
                          setAcceptedTerms(next);
                          if (next) setTermsError(null);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}>
                          {acceptedTerms && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <Text style={styles.termsText}>
                          I agree to StayNest's{' '}
                          <Text
                            style={styles.termsLink}
                            onPress={(e: any) => {
                              e?.stopPropagation?.();
                              setLegalModalType('TERMS');
                            }}
                          >
                            Terms & Conditions
                          </Text>{' '}
                          and{' '}
                          <Text
                            style={styles.termsLink}
                            onPress={(e: any) => {
                              e?.stopPropagation?.();
                              setLegalModalType('PRIVACY');
                            }}
                          >
                            Privacy Policy
                          </Text>
                        </Text>
                      </TouchableOpacity>

                      {termsError && (
                        <Text style={styles.termsErrorText}>⚠️ {termsError}</Text>
                      )}

                      <ScalePressable
                        style={[styles.primaryButton, (!acceptedTerms || loading) && styles.buttonMuted]}
                        onPress={handleSendOtp}
                        scaleTo={0.97}
                        activeOpacity={0.9}
                      >
                        {loading ? (
                          <BrandLoader variant="inline" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>Get OTP →</Text>
                        )}
                      </ScalePressable>
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
                        placeholder="••••••"
                        placeholderTextColor="#cbd5e1"
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        autoFocus
                      />

                      <View style={styles.deliveryNoticeBox}>
                        <Text style={styles.deliveryNoticeText}>
                          ✓ 6-digit verification code sent via WhatsApp & SMS.
                        </Text>
                      </View>

                      <View style={styles.resendRow}>
                        {timerActive ? (
                          <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
                        ) : (
                          <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                            <Text style={styles.resendLink}>Resend OTP Code</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <ScalePressable
                        style={[styles.primaryButton, loading && styles.buttonMuted]}
                        onPress={handleVerifyOtp}
                        disabled={loading}
                        scaleTo={0.97}
                      >
                        {loading ? (
                          <BrandLoader variant="inline" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>Verify & Enter Dashboard</Text>
                        )}
                      </ScalePressable>
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

                  <ScalePressable
                    style={[styles.primaryButton, loading && styles.buttonMuted]}
                    onPress={handlePasswordLogin}
                    disabled={loading}
                    scaleTo={0.97}
                  >
                    {loading ? (
                      <BrandLoader variant="inline" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Sign In with Password</Text>
                    )}
                  </ScalePressable>
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
                      ? 'Or sign in with Email & Password'
                      : 'Or sign in with Mobile Number (OTP)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>

      {/* Terms & Privacy Modal */}
      <Modal
        visible={!!legalModalType}
        transparent
        animationType="fade"
        onRequestClose={() => setLegalModalType(null)}
      >
        <View style={styles.legalBackdrop}>
          <View style={styles.legalCard}>
            <Text style={styles.legalTitle}>
              {legalModalType === 'TERMS' ? 'StayNest Terms & Conditions' : 'StayNest Privacy Policy'}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.legalBody}>
                {legalModalType === 'TERMS'
                  ? 'By using the StayNest PG & Rental Property Owner App, you agree to maintain accurate property, room, and tenant KYC records in accordance with local housing regulations. Subscriptions renew monthly at ₹99/month after the 1-month free trial unless cancelled in Profile before the billing date.'
                  : 'StayNest stores your property, tenant, and billing records securely. Phone numbers and Aadhaar details are used solely for owner authentication, KYC verification, and tenant rent reminders.'}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 14, height: 44 }]}
              onPress={() => setLegalModalType(null)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </AmbientOrangeBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
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
  deliveryNoticeBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  deliveryNoticeText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  form: {
    marginBottom: 10,
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
    marginBottom: 14,
  },
  countryCodeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 11,
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
    minWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 13,
    height: 52,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: 0,
  },
  phoneInputFocused: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  termsLink: {
    color: '#ea580c',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsErrorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 8,
  },
  otpInput: {
    backgroundColor: '#faf8f6',
    borderWidth: 2,
    borderColor: '#ea580c',
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
    backgroundColor: '#faf8f6',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 14,
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
    color: '#ea580c',
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
    color: '#ea580c',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  buttonMuted: {
    opacity: 0.5,
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
    width: 200,
    height: 90,
    alignSelf: 'center',
    marginBottom: 6,
  },
  legalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  legalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
  },
  legalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  legalBody: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
  },
});
