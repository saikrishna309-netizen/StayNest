import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

const BRAND_IMAGE_URIS = {
  phonepe: 'https://cdn.iconscout.com/icon/free/png-256/free-phonepe-11-569472.png',
  gpay: 'https://cdn.iconscout.com/icon/free/png-256/free-google-pay-2038779-1721670.png',
  paytm: 'https://cdn.iconscout.com/icon/free/png-256/free-paytm-226448.png',
  bhim: 'https://cdn.iconscout.com/icon/free/png-256/free-bhim-3628678-3029990.png',
  card: 'https://cdn.iconscout.com/icon/free/png-256/free-credit-card-3580550-2997637.png',
};

export const PhonePeLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="24" fill="#5F259F" />
      <SvgText
        x="24"
        y="32"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="24"
        fontWeight="bold"
      >
        पे
      </SvgText>
    </Svg>
  );
};

export const GooglePayLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <Image
        source={{ uri: BRAND_IMAGE_URIS.gpay }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
      <Path
        d="M34.6 24.3c0-.8-.1-1.6-.2-2.3H24v4.6h6c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.2-5 3.2-8.5z"
        fill="#4285F4"
      />
      <Path
        d="M24 35c3.2 0 6-1.1 8-3l-3.7-2.8c-1.1.7-2.5 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2h-3.8v2.9C15.1 32.1 19.2 35 24 35z"
        fill="#34A853"
      />
      <Path
        d="M16.9 25.2c-.3-.8-.4-1.7-.4-2.7s.1-1.9.4-2.7v-2.9h-3.8C12 18.9 11.5 21.4 11.5 24s.5 5.1 1.6 7.1l3.8-2.9v-3z"
        fill="#FBBC05"
      />
      <Path
        d="M24 17.5c1.8 0 3.3.6 4.6 1.8l3.4-3.4C29.9 14 27.2 13 24 13c-4.8 0-8.9 2.9-10.9 6.9l3.8 2.9c1-3 3.8-5.3 7.1-5.3z"
        fill="#EA4335"
      />
    </Svg>
  );
};

export const PaytmLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <Image
        source={{ uri: BRAND_IMAGE_URIS.paytm }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="48" rx="10" fill="#002E6E" />
      <SvgText
        x="7"
        y="24"
        fill="#FFFFFF"
        fontSize="13"
        fontWeight="900"
        fontFamily="sans-serif"
      >
        Pay
      </SvgText>
      <SvgText
        x="27"
        y="35"
        fill="#00BAF2"
        fontSize="13"
        fontWeight="900"
        fontFamily="sans-serif"
      >
        tm
      </SvgText>
      <Path
        d="M8 32c4-1 9-1 14 0"
        stroke="#00BAF2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
};

export const BhimUpiLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <Image
        source={{ uri: BRAND_IMAGE_URIS.bhim }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
      <Path d="M14 29l8-14h7l-8 14h-7z" fill="#F47920" />
      <Path d="M22 29l8-14h6l-8 14h-6z" fill="#097939" />
    </Svg>
  );
};

export const CardPaymentLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <Image
        source={{ uri: BRAND_IMAGE_URIS.card }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="34" x="0" y="7" rx="6" fill="#1E293B" />
      <Rect width="48" height="6" x="0" y="13" fill="#0F172A" />
      <Circle cx="34" cy="28" r="4.5" fill="#EB001B" />
      <Circle cx="40" cy="28" r="4.5" fill="#F79E1B" fillOpacity="0.85" />
      <Rect width="6" height="5" x="7" y="24" rx="1.5" fill="#FCD34D" />
    </Svg>
  );
};
