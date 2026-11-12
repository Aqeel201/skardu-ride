import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';

export default function SafetySOSModal({ visible, onClose, currentRide, user }) {
  const handleDialPolice = () => {
    Linking.openURL('tel:15');
  };

  const handleDialRescue = () => {
    Linking.openURL('tel:1122');
  };

  const handleShareWhatsAppLive = () => {
    const rideDetails = currentRide
      ? `🚨 *EMERGENCY RIDE TRACKING - SkarduRide*\n` +
        `Passenger: ${user?.name || 'Passenger'}\n` +
        `Pickup: ${currentRide.pickup?.name || 'Skardu'}\n` +
        `Destination: ${currentRide.dropoff?.name || 'Skardu'}\n` +
        `Vehicle: ${currentRide.vehicleCategoryName || 'Car'}\n` +
        `Live Ride Status: ${currentRide.status || 'Active'}\n` +
        `Captain: ${currentRide.driverName || 'Verified Captain'}\n` +
        `Emergency Time: ${new Date().toLocaleTimeString()}\n` +
        `Please contact me immediately or call 1122 / 15 if I don't respond.`
      : `🚨 *SKARDURIDE EMERGENCY ALERT*\n` +
        `I need assistance in Skardu. My current time is ${new Date().toLocaleTimeString()}.\n` +
        `Please check on me or dial Rescue 1122 / Police 15.`;

    const url = `whatsapp://send?text=${encodeURIComponent(rideDetails)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`sms:?body=${encodeURIComponent(rideDetails)}`);
      }
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Text style={{ fontSize: 24 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Safety Shield & SOS</Text>
              <Text style={styles.subtitle}>24/7 Rapid Mountain Emergency Assistance</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency Dial Buttons */}
          <View style={styles.btnGrid}>
            <TouchableOpacity onPress={handleDialPolice} style={[styles.sosBtn, styles.policeBtn]}>
              <Text style={styles.sosEmoji}>👮</Text>
              <View>
                <Text style={styles.sosName}>Police 15</Text>
                <Text style={styles.sosSub}>Direct Police Helpline</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDialRescue} style={[styles.sosBtn, styles.rescueBtn]}>
              <Text style={styles.sosEmoji}>🚑</Text>
              <View>
                <Text style={styles.sosName}>Rescue 1122</Text>
                <Text style={styles.sosSub}>Ambulance & Medical</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Share Live Ride Location via WhatsApp */}
          <TouchableOpacity onPress={handleShareWhatsAppLive} style={styles.shareBtn}>
            <Text style={{ fontSize: 22 }}>📲</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.shareTitle}>Share Live Ride via WhatsApp</Text>
              <Text style={styles.shareSub}>Instantly sends Captain & Vehicle details to family</Text>
            </View>
          </TouchableOpacity>

          {/* Safety Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              🔒 Every SkarduRide driver has verified CNIC & Police Driving License registered on Cloud Firestore.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '900',
  },
  btnGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  sosBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  policeBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  rescueBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  sosEmoji: {
    fontSize: 24,
  },
  sosName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  sosSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  shareTitle: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '900',
  },
  shareSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  noticeBox: {
    backgroundColor: '#090D16',
    padding: 10,
    borderRadius: 10,
  },
  noticeText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
