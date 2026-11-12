import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';

const COMPLIMENTS = [
  '🏔️ Expert Mountain Driving',
  '✨ Clean & Sanitized 4x4',
  '🕒 Exactly On Time',
  '⭐ Polite & Respectful',
  '📸 Great Photo Spots Guide',
  '🚗 Smooth & Safe Ride',
];

const TIP_OPTIONS = [0, 50, 100, 200, 500];

export default function RideRatingModal({
  visible,
  onClose,
  ride,
  onSubmitRating,
}) {
  const [rating, setRating] = useState(5);
  const [selectedTips, setSelectedTips] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState([
    '🏔️ Expert Mountain Driving',
  ]);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleCompliment = (item) => {
    if (selectedCompliments.includes(item)) {
      setSelectedCompliments(selectedCompliments.filter((c) => c !== item));
    } else {
      setSelectedCompliments([...selectedCompliments, item]);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    if (onSubmitRating) {
      onSubmitRating({
        rideId: ride?.id,
        rating,
        tip: selectedTips,
        compliments: selectedCompliments,
        feedback: feedbackText,
      });
    }
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {submitted ? (
            <View style={styles.thankYouBox}>
              <Text style={styles.thankYouEmoji}>🎉</Text>
              <Text style={styles.thankYouTitle}>Thank You!</Text>
              <Text style={styles.thankYouSub}>
                Your rating and tip have been shared with Captain{' '}
                {ride?.captainName || ride?.driverName || 'Driver'}.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={styles.successBadge}>
                  <Text style={styles.successBadgeText}>✓ TRIP COMPLETED</Text>
                </View>
                <Text style={styles.title}>How was your ride?</Text>
                <Text style={styles.subtitle}>
                  Trip to {ride?.dropoff?.name?.split(' (')[0] || 'Destination'}
                </Text>
              </View>

              {/* Star Rating Selector */}
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starBtn}
                  >
                    <Text
                      style={[
                        styles.starText,
                        star <= rating && styles.starTextActive,
                      ]}
                    >
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>
                {rating === 5
                  ? '🌟 Outstanding Experience!'
                  : rating === 4
                  ? '👍 Very Good'
                  : rating === 3
                  ? '👌 Decent'
                  : '⚠️ Needs Improvement'}
              </Text>

              {/* Quick Compliment Chips */}
              <Text style={styles.sectionTitle}>What did you like most?</Text>
              <View style={styles.chipsWrap}>
                {COMPLIMENTS.map((item) => {
                  const active = selectedCompliments.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => toggleCompliment(item)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add a Tip for Captain */}
              <Text style={styles.sectionTitle}>Add Tip for Captain (PKR)</Text>
              <View style={styles.tipRow}>
                {TIP_OPTIONS.map((tip) => {
                  const active = selectedTips === tip;
                  return (
                    <TouchableOpacity
                      key={tip}
                      onPress={() => setSelectedTips(tip)}
                      style={[styles.tipBtn, active && styles.tipBtnActive]}
                    >
                      <Text
                        style={[
                          styles.tipBtnText,
                          active && styles.tipBtnTextActive,
                        ]}
                      >
                        {tip === 0 ? 'No Tip' : `+Rs. ${tip}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Leave an optional review or feedback..."
                placeholderTextColor="#64748B"
                value={feedbackText}
                onChangeText={setFeedbackText}
                multiline
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
              >
                <Text style={styles.submitBtnText}>
                  Submit Rating {selectedTips > 0 ? `• Tip Rs. ${selectedTips}` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipBtnText}>Skip for now</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
  card: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  successBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 10,
  },
  starBtn: {
    padding: 4,
  },
  starText: {
    fontSize: 38,
    color: '#334155',
  },
  starTextActive: {
    color: '#FBBF24',
  },
  ratingLabel: {
    textAlign: 'center',
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 8,
    marginTop: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tipBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tipBtnActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  tipBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  tipBtnTextActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#090D16',
    borderRadius: 14,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1E293B',
    minHeight: 60,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#022C22',
    fontSize: 15,
    fontWeight: '900',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  thankYouBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  thankYouEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  thankYouTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
    marginBottom: 6,
  },
  thankYouSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 1.5,
  },
});
