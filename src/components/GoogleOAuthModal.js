import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';

const REDIRECT_URI = 'https://studio-7677131056-95d9f.firebaseapp.com/__/auth/handler';

export default function GoogleOAuthModal({ visible, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);

  // Direct Google OAuth 2.0 URL
  const CLIENT_ID = '281581738250-hbtbsdbmj2p8f693av13k6q7qitpdgk8.apps.googleusercontent.com';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token%20id_token&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&nonce=${Math.random().toString(36).substring(7)}&prompt=select_account`;

  const parseTokensFromUrl = (url) => {
    try {
      const hash = url.split('#')[1];
      if (!hash) return null;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');
      return { accessToken, idToken };
    } catch {
      return null;
    }
  };

  const handleNavigationStateChange = async (navState) => {
    const { url } = navState;
    if (url.startsWith(REDIRECT_URI) || url.includes('access_token=') || url.includes('id_token=')) {
      const tokens = parseTokensFromUrl(url);
      if (tokens && (tokens.accessToken || tokens.idToken)) {
        try {
          // Fetch Google user profile via Google userinfo endpoint
          const userInfoRes = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            }
          );
          if (userInfoRes.ok) {
            const profile = await userInfoRes.json();
            onSuccess({
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
              googleId: profile.sub,
              idToken: tokens.idToken,
              accessToken: tokens.accessToken,
            });
            return;
          }
        } catch (e) {
          console.warn('Google userinfo fetch error:', e);
        }
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign in with Google</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Connecting to Google...</Text>
          </View>
        )}

        <WebView
          source={{ uri: authUrl }}
          userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          style={styles.webview}
        />
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
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#090D16',
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 13,
  },
  webview: {
    flex: 1,
    backgroundColor: '#090D16',
  },
});
