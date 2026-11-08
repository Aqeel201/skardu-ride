import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import AuthScreen from './src/screens/AuthScreen';
import PassengerScreen from './src/screens/PassengerScreen';
import DriverScreen from './src/screens/DriverScreen';
import ProfileWalletScreen from './src/screens/ProfileWalletScreen';
import { SessionStorage, BackendAPI } from './src/services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'profile'

  useEffect(() => {
    (async () => {
      try {
        const saved = await SessionStorage.loadSession();
        if (saved && saved.user) {
          setUser(saved.user);
          // Refresh user profile from MERN backend
          try {
            const freshUser = await BackendAPI.getCurrentUser();
            if (freshUser) setUser(freshUser);
          } catch {}
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveTab('main');
  };

  const handleLogout = async () => {
    await SessionStorage.clearSession();
    setUser(null);
    setActiveTab('main');
  };

  if (booting) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const isCaptain = user?.role === 'driver';

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090D16" />

      {!user ? (
        <AuthScreen onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          {/* Role-Specific Header */}
          <View style={styles.topHeader}>
            <View style={styles.brandBox}>
              {user.profilePhoto ? (
                <Image
                  source={{ uri: user.profilePhoto }}
                  style={styles.headerAvatar}
                />
              ) : (
                <View style={styles.brandBadge}>
                  <Text style={{ fontSize: 16 }}>
                    {isCaptain ? '🚖' : '🏔️'}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.brandTitle}>
                  {isCaptain ? 'SkarduRide Captain' : 'SkarduRide'}
                </Text>
                <Text style={styles.brandTagline}>
                  {isCaptain ? '🪪 Verified Captain' : '🧍 Verified Passenger'} •{' '}
                  {user.name}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.walletPill}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={styles.walletPillLabel}>WALLET</Text>
              <Text style={styles.walletPillValue}>
                Rs. {user.walletBalance ?? 0}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Strict Role-Separated Screen Container */}
          <View style={styles.screenContainer}>
            {activeTab === 'main' ? (
              isCaptain ? (
                /* CAPTAIN ONLY SEES DRIVER FEED — CANNOT BOOK RIDES */
                <DriverScreen user={user} setUser={setUser} />
              ) : (
                /* PASSENGER ONLY SEES BOOKING SCREEN — NO CAPTAIN MODE */
                <PassengerScreen user={user} />
              )
            ) : (
              <ProfileWalletScreen
                user={user}
                setUser={setUser}
                onLogout={handleLogout}
              />
            )}
          </View>

          {/* Strict Role-Separated Bottom Navigation */}
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={[
                styles.navItem,
                activeTab === 'main' && styles.navItemActive,
              ]}
              onPress={() => setActiveTab('main')}
            >
              <Text style={styles.navIcon}>{isCaptain ? '🚖' : '🗺️'}</Text>
              <Text
                style={[
                  styles.navLabel,
                  activeTab === 'main' && styles.navLabelActive,
                ]}
              >
                {isCaptain ? 'Live Ride Requests' : 'Book a Ride'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navItem,
                activeTab === 'profile' && styles.navItemActive,
              ]}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={styles.navIcon}>{isCaptain ? '🪪' : '👤'}</Text>
              <Text
                style={[
                  styles.navLabel,
                  activeTab === 'profile' && styles.navLabelActive,
                ]}
              >
                {isCaptain ? 'Captain KYC & Wallet' : 'My Profile & Wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#090D16',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  brandTagline: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  walletPill: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'flex-end',
  },
  walletPillLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
  },
  walletPillValue: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '900',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  navItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  navIcon: {
    fontSize: 16,
  },
  navLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  navLabelActive: {
    color: '#10B981',
    fontWeight: '900',
  },
});
