import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { BackendAPI } from '../services/api';

import { checkForUpdate, downloadAndInstall, currentVersion } from '../services/updater';

export default function ProfileWalletScreen({ user, setUser, onLogout }) {
  const [updMsg, setUpdMsg] = React.useState('');
  const doCheck = async () => {
    try {
      setUpdMsg('Checking...');
      const u = await checkForUpdate();
      if (!u.available) { setUpdMsg('You are on the latest version (v' + currentVersion() + ')'); return; }
      setUpdMsg('Downloading ' + u.version + '...');
      await downloadAndInstall(u.url, (p) => setUpdMsg('Downloading ' + Math.round(p * 100) + '%'));
      setUpdMsg('');
    } catch (e) { setUpdMsg('Update failed: ' + e.message); }
  };
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [topUpRef, setTopUpRef] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [myRides, setMyRides] = useState([]);

  const isCaptain = user?.role === 'driver';
  const cap = user?.captainDetails || {};

  useEffect(() => {
    (async () => {
      try {
        const list = await BackendAPI.getRides();
        setMyRides(list || []);
      } catch {}
    })();
  }, []);

  const handleTopUp = async (provider) => {
    const num = Number(topUpAmount);
    if (!num || num < 100) {
      Alert.alert('Invalid Amount', 'Minimum top-up amount is Rs. 100');
      return;
    }
    setTopUpLoading(true);
    try {
      const res = await BackendAPI.topUpWallet(
        num,
        provider,
        topUpRef.trim() || 'TXN-' + Date.now()
      );
      if (res.user && setUser) {
        setUser(res.user);
      }
      setTopUpRef('');
      Alert.alert(
        `${provider} Top-Up Successful`,
        `Rs. ${num} has been added to your SkarduRide Wallet.`
      );
    } catch (err) {
      Alert.alert('Top-Up Error', err.message);
    } finally {
      setTopUpLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Real User / Captain Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          {user?.profilePhoto ? (
            <Image
              source={{ uri: user.profilePhoto }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>
                {isCaptain ? '🚖' : '🧍'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user?.name}</Text>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedPillText}>
                  {isCaptain ? '🚖 Captain' : '🧍 Passenger'}
                </Text>
              </View>
            </View>
            <Text style={styles.userContact}>
              {user?.phone} {user?.email ? `• ${user.email}` : ''}
            </Text>
            {user?.cnicNumber ? (
              <Text style={styles.cnicLine}>🪪 CNIC: {user.cnicNumber}</Text>
            ) : null}
            <Text style={styles.authBadgeText}>
              ⭐ {user?.rating || '5.0'} • {user?.totalTrips || 0} Completed Trips
            </Text>
          </View>
        </View>
      </View>

      {/* Captain Uploaded KYC Documents & Vehicle Section (ONLY FOR CAPTAINS) */}
      {isCaptain && (
        <View style={styles.kycDocsCard}>
          <View style={styles.kycHeaderRow}>
            <Text style={styles.sectionTitle}>
              🪪 Captain KYC & Vehicle Documents
            </Text>
            <View style={styles.kycStatusBadge}>
              <Text style={styles.kycStatusText}>✓ KYC Verified</Text>
            </View>
          </View>

          <View style={styles.kycInfoGrid}>
            <Text style={styles.kycInfoLine}>
              🚘 <Text style={styles.kycBold}>Vehicle:</Text> {cap.vehicleModel} ({cap.vehicleColor})
            </Text>
            <Text style={styles.kycInfoLine}>
              🔢 <Text style={styles.kycBold}>Number Plate:</Text> {cap.vehiclePlate}
            </Text>
            <Text style={styles.kycInfoLine}>
              🪪 <Text style={styles.kycBold}>CNIC:</Text> {cap.cnicNumber}
            </Text>
            <Text style={styles.kycInfoLine}>
              📄 <Text style={styles.kycBold}>Driving License:</Text>{' '}
              {cap.drivingLicenseNumber}{' '}
              {cap.drivingLicenseExpiry ? `(Exp: ${cap.drivingLicenseExpiry})` : ''}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
          >
            {cap.cnicFrontImage ? (
              <View style={styles.docThumbBox}>
                <Image
                  source={{ uri: cap.cnicFrontImage }}
                  style={styles.docThumbImg}
                />
                <Text style={styles.docThumbLabel}>CNIC Front</Text>
              </View>
            ) : null}
            {cap.cnicBackImage ? (
              <View style={styles.docThumbBox}>
                <Image
                  source={{ uri: cap.cnicBackImage }}
                  style={styles.docThumbImg}
                />
                <Text style={styles.docThumbLabel}>CNIC Back</Text>
              </View>
            ) : null}
            {cap.drivingLicenseImage ? (
              <View style={styles.docThumbBox}>
                <Image
                  source={{ uri: cap.drivingLicenseImage }}
                  style={styles.docThumbImg}
                />
                <Text style={styles.docThumbLabel}>Driving License</Text>
              </View>
            ) : null}
            {cap.vehicleRegistrationImage ? (
              <View style={styles.docThumbBox}>
                <Image
                  source={{ uri: cap.vehicleRegistrationImage }}
                  style={styles.docThumbImg}
                />
                <Text style={styles.docThumbLabel}>Registration Card</Text>
              </View>
            ) : null}
            {cap.vehiclePhoto ? (
              <View style={styles.docThumbBox}>
                <Image
                  source={{ uri: cap.vehiclePhoto }}
                  style={styles.docThumbImg}
                />
                <Text style={styles.docThumbLabel}>Vehicle Photo</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* Digital Wallet & EasyPaisa / JazzCash Top-Up */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletLabel}>SKARDURIDE WALLET BALANCE</Text>
            <Text style={styles.walletBalanceText}>
              Rs. {user?.walletBalance ?? 0}
            </Text>
          </View>
          {isCaptain && (
            <View style={styles.commissionTag}>
              <Text style={styles.commissionTagText}>8% Captain Fee</Text>
            </View>
          )}
        </View>

        <View style={styles.topUpInputRow}>
          <TextInput
            style={styles.topUpInput}
            value={topUpAmount}
            onChangeText={setTopUpAmount}
            keyboardType="numeric"
            placeholder="Amount (PKR)"
            placeholderTextColor="#A7F3D0"
          />
          <TextInput
            style={[styles.topUpInput, { flex: 1.4 }]}
            value={topUpRef}
            onChangeText={setTopUpRef}
            placeholder="EasyPaisa/JazzCash TID (Optional)"
            placeholderTextColor="#A7F3D0"
          />
        </View>

        <View style={styles.topUpButtonsRow}>
          <TouchableOpacity
            style={styles.easypaisaBtn}
            disabled={topUpLoading}
            onPress={() => handleTopUp('EasyPaisa')}
          >
            <Text style={styles.epBtnTitle}>+Rs. {topUpAmount || 0}</Text>
            <Text style={styles.epBtnSub}>Top-up EasyPaisa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.jazzcashBtn}
            disabled={topUpLoading}
            onPress={() => handleTopUp('JazzCash')}
          >
            <Text style={styles.jcBtnTitle}>+Rs. {topUpAmount || 0}</Text>
            <Text style={styles.jcBtnSub}>Top-up JazzCash</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Real Trip History from MongoDB */}
      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>
          🛣️ My Real Trip History ({myRides.length})
        </Text>

        {myRides.length === 0 ? (
          <Text style={styles.emptyHistoryText}>
            No trips recorded on this account yet.
          </Text>
        ) : (
          myRides.map((r) => (
            <View key={r._id || r.id} style={styles.tripItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripRoute}>
                  {r.pickup?.name?.split(' (')[0]} →{' '}
                  {r.dropoff?.name?.split(' (')[0]}
                </Text>
                <Text style={styles.tripMeta}>
                  Status: {r.status.toUpperCase()} • {r.paymentMethod}
                </Text>
              </View>
              <Text style={styles.tripPrice}>
                Rs. {r.agreedFare || r.offeredFare}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={{ backgroundColor: '#111827', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' }}>
        <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 15 }}>Settings</Text>
        <Text style={{ color: '#94A3B8', marginTop: 4 }}>App version v{currentVersion()}</Text>
        <TouchableOpacity onPress={doCheck} style={{ backgroundColor: '#10B981', padding: 12, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
          <Text style={{ color: '#04120C', fontWeight: '900' }}>Check for Updates</Text>
        </TouchableOpacity>
        {!!updMsg && <Text style={{ color: '#10B981', marginTop: 8 }}>{updMsg}</Text>}
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>🚪 Sign Out of Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 30,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  verifiedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  verifiedPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  userContact: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  cnicLine: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  authBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  kycDocsCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  kycHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kycStatusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kycStatusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
  },
  kycInfoGrid: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  kycInfoLine: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  kycBold: {
    fontWeight: '800',
    color: '#F8FAFC',
  },
  docThumbBox: {
    marginRight: 10,
    alignItems: 'center',
  },
  docThumbImg: {
    width: 110,
    height: 75,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  docThumbLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: '#064E3B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginBottom: 14,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  walletLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  walletBalanceText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  commissionTag: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  commissionTagText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
  },
  topUpInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  topUpInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  topUpButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  easypaisaBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  epBtnTitle: {
    color: '#022C22',
    fontSize: 15,
    fontWeight: '900',
  },
  epBtnSub: {
    color: '#064E3B',
    fontSize: 11,
    fontWeight: '800',
  },
  jazzcashBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  jcBtnTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  jcBtnSub: {
    color: '#451A03',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  historyCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  emptyHistoryText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 10,
  },
  tripItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginTop: 6,
  },
  tripRoute: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  tripMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  tripPrice: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '900',
  },
  logoutBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutBtnText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '800',
  },
});
