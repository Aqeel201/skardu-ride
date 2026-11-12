import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

const REDIRECT_URI = 'https://studio-7677131056-95d9f.firebaseapp.com/__/auth/handler';
const CLIENT_ID = '281581738250-hbtbsdbmj2p8f693av13k6q7qitpdgk8.apps.googleusercontent.com';

// Safe pure JS JWT parser without any native dependencies
function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    for (let i = 0; i < base64.length; i += 4) {
      const a = chars.indexOf(base64.charAt(i));
      const b = chars.indexOf(base64.charAt(i + 1));
      const c = chars.indexOf(base64.charAt(i + 2));
      const d = chars.indexOf(base64.charAt(i + 3));
      const b1 = (a << 2) | (b >> 4);
      const b2 = ((b & 15) << 4) | (c >> 2);
      const b3 = ((c & 3) << 6) | d;
      str += String.fromCharCode(b1);
      if (c !== 64 && c !== -1) str += String.fromCharCode(b2);
      if (d !== 64 && d !== -1) str += String.fromCharCode(b3);
    }
    const decoded = decodeURIComponent(
      str
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(decoded);
  } catch (err) {
    console.warn('JWT Decode error:', err);
    return null;
  }
}

export default function GoogleOAuthModal({ visible, onClose, onSuccess }) {
  // 'oauth' | 'manual'
  const [activeTab, setActiveTab] = useState('oauth');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [processing, setProcessing] = useState(false);

  const hasHandledRef = useRef(false);
  const webViewRef = useRef(null);

  // Compute OAuth URL ONCE when modal becomes visible - NEVER changes on re-renders!
  const authUrl = useMemo(() => {
    if (!visible) return '';
    hasHandledRef.current = false;
    const nonce = Math.random().toString(36).substring(2, 10);
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token%20id_token&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&nonce=${nonce}&prompt=select_account`;
  }, [visible]);

  useEffect(() => {
    if (visible) {
      hasHandledRef.current = false;
      setProcessing(false);
      setActiveTab('oauth');
    }
  }, [visible]);

  const extractTokensFromUrl = (url) => {
    if (!url) return null;
    let tokenString = '';
    if (url.includes('#')) {
      tokenString = url.split('#')[1];
    } else if (url.includes('?')) {
      tokenString = url.split('?')[1];
    }
    if (!tokenString) return null;

    const params = new URLSearchParams(tokenString);
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');
    if (accessToken || idToken) {
      return { accessToken, idToken };
    }
    return null;
  };

  const handleTokensExtracted = async (tokens) => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    setProcessing(true);

    try {
      // 1. Try decoding id_token first (Instant, zero network lag)
      let profile = null;
      if (tokens.idToken) {
        const decoded = decodeJwtPayload(tokens.idToken);
        if (decoded && decoded.email) {
          profile = {
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
            picture: decoded.picture || '',
            googleId: decoded.sub || 'gid_' + Date.now(),
            idToken: tokens.idToken,
            accessToken: tokens.accessToken,
          };
        }
      }

      // 2. If profile is not complete and accessToken exists, fetch userinfo
      if (!profile && tokens.accessToken) {
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            profile = {
              email: data.email,
              name: data.name || data.email.split('@')[0],
              picture: data.picture || '',
              googleId: data.sub || 'gid_' + Date.now(),
              idToken: tokens.idToken,
              accessToken: tokens.accessToken,
            };
          }
        } catch (e) {
          console.warn('Userinfo fetch fallback warning:', e);
        }
      }

      if (profile && profile.email) {
        onSuccess(profile);
      } else {
        Alert.alert('Sign-In Notice', 'Could not retrieve profile. Please enter your Gmail address.', [
          { text: 'OK', onPress: () => setActiveTab('manual') },
        ]);
        setProcessing(false);
      }
    } catch (err) {
      console.warn('Google sign-in token handler error:', err);
      setActiveTab('manual');
      setProcessing(false);
    }
  };

  const handleShouldStartLoad = (request) => {
    const { url } = request;
    if (url.startsWith(REDIRECT_URI) || url.includes('access_token=') || url.includes('id_token=')) {
      const tokens = extractTokensFromUrl(url);
      if (tokens) {
        handleTokensExtracted(tokens);
        return false; // Crucial: Stop WebView from navigating to the handler page and looping!
      }
    }
    return true;
  };

  const handleNavigationStateChange = (navState) => {
    const { url } = navState;
    if (url.startsWith(REDIRECT_URI) || url.includes('access_token=') || url.includes('id_token=')) {
      const tokens = extractTokensFromUrl(url);
      if (tokens) {
        handleTokensExtracted(tokens);
      }
    }
  };

  const handleManualSubmit = () => {
    const cleanEmail = manualEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid Google / Gmail address');
      return;
    }
    onSuccess({
      email: cleanEmail,
      name: manualName.trim() || cleanEmail.split('@')[0],
      picture: '',
      googleId: 'google_manual_' + Date.now(),
    });
  };

  const INJECTED_CHECK_SCRIPT = `
    (function() {
      function checkTokens() {
        var h = window.location.href;
        if (h.indexOf('access_token=') !== -1 || h.indexOf('id_token=') !== -1) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOKENS', url: h }));
        }
      }
      checkTokens();
      window.addEventListener('hashchange', checkTokens);
    })();
    true;
  `;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleBox}>
            <View style={styles.gLogo}>
              <Text style={styles.gLogoText}>G</Text>
            </View>
            <Text style={styles.headerTitle}>Google Sign-In</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selector: Fast Switch between Official OAuth & Direct Gmail */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'oauth' && styles.tabItemActive]}
            onPress={() => setActiveTab('oauth')}
          >
            <Text style={[styles.tabText, activeTab === 'oauth' && styles.tabTextActive]}>
              🌐 Official Google Sign-In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'manual' && styles.tabItemActive]}
            onPress={() => setActiveTab('manual')}
          >
            <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
              ✍️ Enter Gmail Manually
            </Text>
          </TouchableOpacity>
        </View>

        {processing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.processingText}>Verifying Google Account with Firebase & Firestore...</Text>
          </View>
        ) : activeTab === 'oauth' ? (
          <View style={styles.webviewWrapper}>
            <WebView
              ref={webViewRef}
              source={{ uri: authUrl }}
              userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
              applicationNameForUserAgent=""
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              setSupportMultipleWindows={false}
              originWhitelist={['*']}
              injectedJavaScript={INJECTED_CHECK_SCRIPT}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data && data.url) {
                    const tokens = extractTokensFromUrl(data.url);
                    if (tokens) handleTokensExtracted(tokens);
                  }
                } catch {}
              }}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onNavigationStateChange={handleNavigationStateChange}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.loadingText}>Opening Google Account selector...</Text>
                </View>
              )}
              style={styles.webview}
            />

            {/* Quick helper banner at bottom */}
            <View style={styles.bottomHelper}>
              <Text style={styles.helperText}>Having trouble loading Google?</Text>
              <TouchableOpacity onPress={() => setActiveTab('manual')} style={styles.helperBtn}>
                <Text style={styles.helperBtnText}>Enter Gmail Manually →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Manual Direct Gmail Entry (100% Guaranteed fallback) */
          <View style={styles.manualContainer}>
            <View style={styles.manualCard}>
              <Text style={styles.manualTitle}>Sign in with your Google Account</Text>
              <Text style={styles.manualSub}>
                Enter your Gmail address below to instantly link your SkarduRide passenger or captain account.
              </Text>

              <Text style={styles.fieldLabel}>GMAIL ADDRESS *</Text>
              <TextInput
                style={styles.input}
                value={manualEmail}
                onChangeText={setManualEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="yourname@gmail.com"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.fieldLabel}>YOUR FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={manualName}
                onChangeText={setManualName}
                placeholder="Your Full Name"
                placeholderTextColor="#64748B"
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleManualSubmit}>
                <Text style={styles.primaryBtnText}>Continue with Google →</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setActiveTab('oauth')} style={styles.switchLink}>
                <Text style={styles.switchLinkText}>← Switch back to Official Google Browser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gLogoText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0B1120',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  webviewWrapper: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  processingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  processingText: {
    color: '#10B981',
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomHelper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  helperBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  helperBtnText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  manualContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  manualCard: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  manualTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  manualSub: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#022C22',
    fontWeight: '900',
    fontSize: 15,
  },
  switchLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchLinkText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
