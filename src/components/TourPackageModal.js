import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { TOUR_PACKAGES } from '../data/skarduLocations';

export default function TourPackageModal({ visible, onClose, onBookTour, user }) {
  const [selectedTour, setSelectedTour] = useState(TOUR_PACKAGES[0]);
  const [bidFare, setBidFare] = useState(TOUR_PACKAGES[0].defaultFare);
  const [customNotes, setCustomNotes] = useState('');
  const [passengersCount, setPassengersCount] = useState(4);
  const [tourDate, setTourDate] = useState('Tomorrow Morning (07:00 AM)');

  const handleSelectTour = (tour) => {
    setSelectedTour(tour);
    setBidFare(tour.defaultFare);
  };

  const handleAdjustFare = (delta) => {
    setBidFare((prev) => Math.max(selectedTour.minFare, prev + delta));
  };

  const handleSubmit = () => {
    onBookTour({
      tour: selectedTour,
      offeredFare: bidFare,
      passengersCount,
      tourDate,
      customNotes: customNotes.trim(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🏔️ Skardu Tour & 4x4 Packages</Text>
            <Text style={styles.headerSub}>Exclusive Day Trips with Verified Mountain Captains</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Tour Selection Cards */}
          <Text style={styles.sectionLabel}>CHOOSE YOUR DESTINATION EXPEDITION</Text>
          {TOUR_PACKAGES.map((t) => {
            const isSelected = selectedTour.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => handleSelectTour(t)}
                style={[styles.tourCard, isSelected && styles.tourCardActive]}
              >
                <View style={styles.tourHeaderRow}>
                  <View style={styles.tourIconBox}>
                    <Text style={{ fontSize: 26 }}>{t.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.tagRow}>
                      <Text style={styles.tagBadge}>{t.tag}</Text>
                      <Text style={styles.ratingText}>★ {t.rating}</Text>
                    </View>
                    <Text style={styles.tourTitle}>{t.title}</Text>
                    <Text style={styles.tourMeta}>
                      ⏱️ {t.duration} • 🛻 {t.vehicle}
                    </Text>
                  </View>
                </View>

                {/* Highlights */}
                <View style={styles.highlightsBox}>
                  {t.highlights.map((h, idx) => (
                    <Text key={idx} style={styles.highlightPill}>
                      ✓ {h}
                    </Text>
                  ))}
                </View>

                <View style={styles.tourFooterRow}>
                  <Text style={styles.defaultFareLabel}>Suggested Package Price:</Text>
                  <Text style={styles.defaultFareValue}>Rs. {t.defaultFare.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Booking Customization */}
          <View style={styles.bookingBox}>
            <Text style={styles.boxTitle}>📅 Customize Tour & Offer Fare</Text>

            <Text style={styles.fieldLabel}>DEPARTURE DATE & TIME</Text>
            <View style={styles.dateSelectorRow}>
              {['Today Afternoon', 'Tomorrow Morning (07:00 AM)', 'Day After Tomorrow'].map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setTourDate(d)}
                  style={[styles.dateChip, tourDate === d && styles.dateChipActive]}
                >
                  <Text style={[styles.dateChipText, tourDate === d && styles.dateChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>PASSENGERS COUNT</Text>
            <View style={styles.passengersRow}>
              {[1, 2, 4, 6, 8].map((count) => (
                <TouchableOpacity
                  key={count}
                  onPress={() => setPassengersCount(count)}
                  style={[styles.passChip, passengersCount === count && styles.passChipActive]}
                >
                  <Text style={[styles.passText, passengersCount === count && styles.passTextActive]}>
                    {count} {count === 1 ? 'Person' : 'People'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* InDriver Bidding Controls for Tour */}
            <Text style={styles.fieldLabel}>YOUR OFFERED TOUR FARE (PKR)</Text>
            <View style={styles.fareControlRow}>
              <TouchableOpacity onPress={() => handleAdjustFare(-1000)} style={styles.fareAdjustBtn}>
                <Text style={styles.adjustText}>-1000</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleAdjustFare(-500)} style={styles.fareAdjustBtn}>
                <Text style={styles.adjustText}>-500</Text>
              </TouchableOpacity>

              <View style={styles.fareDisplayBox}>
                <Text style={styles.fareCurrency}>Rs.</Text>
                <Text style={styles.fareAmount}>{bidFare.toLocaleString()}</Text>
              </View>

              <TouchableOpacity onPress={() => handleAdjustFare(500)} style={styles.fareAdjustBtn}>
                <Text style={styles.adjustText}>+500</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleAdjustFare(1000)} style={styles.fareAdjustBtn}>
                <Text style={styles.adjustText}>+1000</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>SPECIAL REQUESTS / HOTEL PICKUP LOCATION</Text>
            <TextInput
              style={styles.notesInput}
              value={customNotes}
              onChangeText={setCustomNotes}
              placeholder="e.g. Pickup from Serena Shigar, require experienced high-altitude driver, 2 luggage bags"
              placeholderTextColor="#64748B"
              multiline
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit}>
              <Text style={styles.confirmBtnText}>
                🚀 Post Tour Request (Rs. {bidFare.toLocaleString()}) →
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  headerSub: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '900',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 36,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tourCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  tourCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  tourHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tourIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagBadge: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ratingText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  tourTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  tourMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  highlightsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  highlightPill: {
    color: '#CBD5E1',
    fontSize: 11,
    backgroundColor: '#090D16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tourFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
  },
  defaultFareLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  defaultFareValue: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '900',
  },
  bookingBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  boxTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dateChipActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  dateChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  dateChipTextActive: {
    color: '#10B981',
  },
  passengersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  passChip: {
    flex: 1,
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  passChipActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  passText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  passTextActive: {
    color: '#10B981',
  },
  fareControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 4,
  },
  fareAdjustBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  adjustText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  fareDisplayBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#090D16',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  fareCurrency: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },
  fareAmount: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  notesInput: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#F8FAFC',
    padding: 10,
    minHeight: 64,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnText: {
    color: '#022C22',
    fontSize: 15,
    fontWeight: '900',
  },
});
