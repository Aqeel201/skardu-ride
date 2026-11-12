import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const ROAD_CONDITIONS = [
  {
    route: 'Skardu Airport ⇄ City Center',
    status: 'CLEAR',
    type: 'Paved Road',
    distance: '14 km',
    advice: 'All vehicles (Cars, Sedans, Jeeps) safe 24/7.',
    statusColor: '#10B981',
  },
  {
    route: 'Skardu ⇄ Shangrila & Lower Kachura',
    status: 'OPEN',
    type: 'Metalled Highway',
    distance: '28 km',
    advice: 'Smooth scenic drive, light traffic around lakeside.',
    statusColor: '#10B981',
  },
  {
    route: 'Skardu ⇄ Shigar Fort & Cold Desert',
    status: 'OPEN',
    type: 'Asphalt & Dunes Track',
    distance: '32 km',
    advice: 'Open to all cars; 4x4 recommended for deep desert dunes.',
    statusColor: '#10B981',
  },
  {
    route: 'Skardu ⇄ Deosai National Park & Sheosar',
    status: '4x4 REQUIRED',
    type: 'High-Altitude Pass (4,100m)',
    distance: '48 km',
    advice: 'Snow patches at Ali Malik Top. High-clearance 4x4 Prado/Jeep mandatory.',
    statusColor: '#F59E0B',
  },
  {
    route: 'Skardu ⇄ Khaplu Palace & Manthoka',
    status: 'OPEN',
    type: 'Scenic Valley Road',
    distance: '103 km',
    advice: 'Clear paved road along Shyok River, beautiful daylight drive.',
    statusColor: '#10B981',
  },
  {
    route: 'Skardu ⇄ Basho Valley',
    status: '4x4 ONLY',
    type: 'Alpine Off-Road Track',
    distance: '45 km',
    advice: 'Jeep track with suspension bridge crossing. Local expert driver advised.',
    statusColor: '#F59E0B',
  },
];

export default function SkarduRoadWeatherModal({ visible, onClose }) {
  const [activeTab, setActiveTab] = useState('roads'); // 'roads' | 'weather'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🏔️ Skardu Mountain Advisory</Text>
              <Text style={styles.subtitle}>
                Live Pass Clearances & Weather Forecast
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'roads' && styles.tabActive]}
              onPress={() => setActiveTab('roads')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'roads' && styles.tabTextActive,
                ]}
              >
                🛣️ Road & Pass Conditions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'weather' && styles.tabActive]}
              onPress={() => setActiveTab('weather')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'weather' && styles.tabTextActive,
                ]}
              >
                ⛅ Mountain Weather
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {activeTab === 'roads' ? (
              <View style={styles.cardsList}>
                {ROAD_CONDITIONS.map((item, idx) => (
                  <View key={idx} style={styles.roadCard}>
                    <View style={styles.cardTop}>
                      <Text style={styles.roadRoute}>{item.route}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: `${item.statusColor}22`,
                            borderColor: item.statusColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: item.statusColor },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.roadMeta}>
                      📍 {item.distance} • {item.type}
                    </Text>
                    <Text style={styles.roadAdvice}>💡 {item.advice}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.weatherBox}>
                <View style={styles.weatherMainCard}>
                  <Text style={styles.weatherEmoji}>🌤️</Text>
                  <Text style={styles.weatherTemp}>14°C / 4°C</Text>
                  <Text style={styles.weatherCond}>Partly Cloudy • Clean Mountain Air</Text>
                  <Text style={styles.weatherCity}>Skardu Valley (Alt: 2,230m)</Text>
                </View>

                <View style={styles.forecastGrid}>
                  <View style={styles.forecastItem}>
                    <Text style={styles.forecastLoc}>Deosai Plains</Text>
                    <Text style={styles.forecastTemp}>4°C / -3°C</Text>
                    <Text style={styles.forecastCond}>❄️ Chilly winds</Text>
                  </View>
                  <View style={styles.forecastItem}>
                    <Text style={styles.forecastLoc}>Shigar Valley</Text>
                    <Text style={styles.forecastTemp}>16°C / 5°C</Text>
                    <Text style={styles.forecastCond}>☀️ Sunny & Clear</Text>
                  </View>
                  <View style={styles.forecastItem}>
                    <Text style={styles.forecastLoc}>Khaplu Valley</Text>
                    <Text style={styles.forecastTemp}>15°C / 3°C</Text>
                    <Text style={styles.forecastCond}>🌤️ Pleasant</Text>
                  </View>
                  <View style={styles.forecastItem}>
                    <Text style={styles.forecastLoc}>Kachura Lakes</Text>
                    <Text style={styles.forecastTemp}>13°C / 4°C</Text>
                    <Text style={styles.forecastCond}>⛅ Mild Breeze</Text>
                  </View>
                </View>

                <View style={styles.flightAlert}>
                  <Text style={styles.flightAlertTitle}>✈️ Skardu Flight Operations Alert</Text>
                  <Text style={styles.flightAlertSub}>
                    PIA & Airblue commercial direct flights from Islamabad/Karachi/Lahore operating normally with good visual visibility.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '900',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#022C22',
    fontWeight: '900',
  },
  cardsList: {
    gap: 10,
    paddingBottom: 20,
  },
  roadCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roadRoute: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  roadMeta: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    marginBottom: 4,
  },
  roadAdvice: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 1.4,
  },
  weatherBox: {
    paddingBottom: 20,
  },
  weatherMainCard: {
    backgroundColor: '#0F2F24',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  weatherEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  weatherTemp: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  weatherCond: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 2,
  },
  weatherCity: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  forecastItem: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  forecastLoc: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  forecastTemp: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38BDF8',
    marginTop: 4,
  },
  forecastCond: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  flightAlert: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 14,
    padding: 14,
  },
  flightAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#60A5FA',
    marginBottom: 4,
  },
  flightAlertSub: {
    fontSize: 11.5,
    color: '#CBD5E1',
    lineHeight: 1.4,
  },
});
