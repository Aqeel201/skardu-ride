import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { BackendAPI } from '../services/api';
import {
  ensureMicPermission,
  preparePlaybackAudioMode,
  fileUriToBase64,
  playBase64Audio,
  stopActiveVoicePlayer,
} from '../utils/audioHelper';

const QUICK_MESSAGES_PASSENGER = [
  'Salam Captain! Main pickup point par khara hun.',
  'Aap kahan tak pohanch gaye hain?',
  'Main main road ke paas intezar kar raha hun.',
  'Jaldi aa jayein please.',
];

const QUICK_MESSAGES_CAPTAIN = [
  'Salam! Main 2 minute mein pickup par pohanch raha hun.',
  'Main pickup location par aa gaya hun.',
  'Gari ka number plate check kar lein.',
  'Ok, main aa raha hun.',
];

const WAVE_BAR_HEIGHTS = [8, 16, 12, 20, 10, 22, 14, 18, 9, 21, 15, 19, 11, 14];

export default function RideChatModal({
  visible,
  onClose,
  ride,
  currentUser,
  onRideUpdated,
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [playingMsgId, setPlayingMsgId] = useState(null);

  const scrollRef = useRef(null);
  const recTimerRef = useRef(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!visible) {
      stopActiveVoicePlayer();
      setPlayingMsgId(null);
      if (isRecordingVoice) {
        cancelVoiceRecording();
      }
    }
  }, [visible]);

  useEffect(() => {
    if (isRecordingVoice) {
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
    }
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, [isRecordingVoice]);

  if (!ride) return null;

  const isCaptain = currentUser?.role === 'driver';
  const myId = String(currentUser?._id || currentUser?.id || '');

  const otherPartyName = isCaptain
    ? ride.passengerName
    : ride.acceptedDriver?.driverName || 'Captain';

  const otherPartyPhone = isCaptain
    ? ride.passengerPhone
    : ride.acceptedDriver?.driverPhone || '';

  const otherPartyPhoto = isCaptain
    ? ride.passengerProfilePhoto
    : ride.acceptedDriver?.driverProfilePhoto;

  const otherPartySubtitle = isCaptain
    ? `Passenger • ${ride.pickup?.name?.split(' (')[0]}`
    : `${ride.acceptedDriver?.vehicleModel || 'Captain'} • ${
        ride.acceptedDriver?.vehiclePlate || 'GB-SKD'
      }`;

  const messages = ride.messages || [];
  const quickReplies = isCaptain
    ? QUICK_MESSAGES_CAPTAIN
    : QUICK_MESSAGES_PASSENGER;

  const formatDuration = (sec) => {
    const total = Math.max(1, Math.round(Number(sec) || 1));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSendInAppMessage = async (msgText) => {
    const clean = (msgText ?? text).trim();
    if (!clean || sending) return;

    setSending(true);
    try {
      const rideId = ride._id || ride.id;
      const updatedRide = await BackendAPI.sendRideMessage(rideId, {
        type: 'text',
        text: clean,
      });
      if (msgText === undefined) setText('');
      if (onRideUpdated && updatedRide) {
        onRideUpdated(updatedRide);
      }
    } catch {}
    setSending(false);
  };

  const startVoiceRecording = async () => {
    try {
      stopActiveVoicePlayer();
      setPlayingMsgId(null);

      const granted = await ensureMicPermission();
      if (!granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Voice note bhejne ke liye microphone permission allow karein.'
        );
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecordingVoice(true);
    } catch (err) {
      Alert.alert(
        'Recording Error',
        err?.message || 'Could not start microphone recording'
      );
    }
  };

  const cancelVoiceRecording = async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch {}
    setIsRecordingVoice(false);
    setRecSeconds(0);
  };

  const finishAndSendVoiceNote = async () => {
    if (!isRecordingVoice || sending) return;
    const finalDuration = Math.max(1, recSeconds);
    setSending(true);
    try {
      await audioRecorder.stop();
      const recordedUri = audioRecorder.uri;
      setIsRecordingVoice(false);
      setRecSeconds(0);

      await preparePlaybackAudioMode();

      if (!recordedUri) {
        throw new Error('No audio file recorded');
      }

      const base64Audio = await fileUriToBase64(recordedUri);
      if (!base64Audio) {
        throw new Error('Could not encode voice note');
      }

      const rideId = ride._id || ride.id;
      const updatedRide = await BackendAPI.sendRideMessage(rideId, {
        type: 'audio',
        text: `🎤 Voice Note (${formatDuration(finalDuration)})`,
        audioData: base64Audio,
        durationSec: finalDuration,
      });

      if (onRideUpdated && updatedRide) {
        onRideUpdated(updatedRide);
      }
    } catch (err) {
      Alert.alert(
        'Voice Note Error',
        err?.message || 'Voice note send nahi ho saka.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleTogglePlayVoiceNote = async (msg, fallbackIdx) => {
    const msgKey = String(msg._id || fallbackIdx);
    if (playingMsgId === msgKey) {
      stopActiveVoicePlayer();
      setPlayingMsgId(null);
      return;
    }

    if (!msg.audioData) return;

    await preparePlaybackAudioMode();
    setPlayingMsgId(msgKey);
    await playBase64Audio(msg.audioData, msgKey, 1.0, () => {
      setPlayingMsgId((prev) => (prev === msgKey ? null : prev));
    });
  };

  const handleSendCellularSms = () => {
    if (!otherPartyPhone) return;
    const body = encodeURIComponent(
      text.trim() ||
        `Salam ${otherPartyName}! (SkarduRide: ${ride.pickup?.name?.split(' (')[0]} to ${ride.dropoff?.name?.split(' (')[0]})`
    );
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${otherPartyPhone}${sep}body=${body}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatContainer}>
          {/* Top Chat Header */}
          <View style={styles.chatHeader}>
            <View style={styles.headerLeft}>
              {otherPartyPhoto ? (
                <Image
                  source={{ uri: otherPartyPhoto }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={{ fontSize: 18 }}>{isCaptain ? '🧍' : '🚖'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {otherPartyName}
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  🟢 Text & Voice Chat • {otherPartySubtitle}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.simSmsBtn}
                onPress={handleSendCellularSms}
              >
                <Text style={styles.simSmsBtnText}>📲 SIM SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Route Summary Strip */}
          <View style={styles.routeStrip}>
            <Text style={styles.routeStripText} numberOfLines={1}>
              📍 {ride.pickup?.name?.split(' (')[0]} → 🏁{' '}
              {ride.dropoff?.name?.split(' (')[0]} • Rs.{' '}
              {ride.agreedFare || ride.offeredFare}
            </Text>
          </View>

          {/* Messages List */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd?.({ animated: true })
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChatBox}>
                <Text style={styles.emptyChatEmoji}>🎙️</Text>
                <Text style={styles.emptyChatTitle}>
                  Send Text or WhatsApp-Style Voice Note to {otherPartyName}
                </Text>
                <Text style={styles.emptyChatSub}>
                  Tap 🎙️ below to record your voice or tap any quick message.
                </Text>
              </View>
            ) : (
              messages.map((m, idx) => {
                const msgKey = String(m._id || idx);
                const isMine =
                  String(m.senderId) === myId ||
                  m.senderRole === currentUser?.role;
                const isAudioMsg = m.type === 'audio' && Boolean(m.audioData);
                const isPlayingThis = playingMsgId === msgKey;

                return (
                  <View
                    key={msgKey}
                    style={[
                      styles.msgBubbleWrap,
                      isMine ? styles.msgWrapRight : styles.msgWrapLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        isMine ? styles.msgBubbleMine : styles.msgBubbleTheirs,
                      ]}
                    >
                      {!isMine && (
                        <Text style={styles.msgSenderLabel}>
                          {m.senderName}
                        </Text>
                      )}

                      {isAudioMsg ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleTogglePlayVoiceNote(m, idx)}
                          style={styles.voiceNotePlayerRow}
                        >
                          <View
                            style={[
                              styles.voicePlayCircle,
                              isMine
                                ? styles.voicePlayCircleMine
                                : styles.voicePlayCircleTheirs,
                            ]}
                          >
                            <Text
                              style={[
                                styles.voicePlayIcon,
                                isMine
                                  ? { color: '#10B981' }
                                  : { color: '#022C22' },
                              ]}
                            >
                              {isPlayingThis ? '⏸' : '▶'}
                            </Text>
                          </View>

                          <View style={styles.voiceWaveColumn}>
                            <View style={styles.voiceBarsRow}>
                              {WAVE_BAR_HEIGHTS.map((h, barIdx) => (
                                <View
                                  key={barIdx}
                                  style={[
                                    styles.voiceBarItem,
                                    {
                                      height: isPlayingThis
                                        ? Math.max(6, ((barIdx + 3) % 4) * 5 + 6)
                                        : h,
                                      backgroundColor: isMine
                                        ? isPlayingThis
                                          ? '#022C22'
                                          : 'rgba(2, 44, 34, 0.55)'
                                        : isPlayingThis
                                        ? '#10B981'
                                        : '#64748B',
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                            <View style={styles.voiceMetaRow}>
                              <Text
                                style={[
                                  styles.voiceDurationText,
                                  isMine && { color: '#022C22' },
                                ]}
                              >
                                🎤 {isPlayingThis ? 'Playing...' : 'Voice Note'}{' '}
                                • {formatDuration(m.durationSec || 2)}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text
                          style={[
                            styles.msgText,
                            isMine && { color: '#022C22', fontWeight: '700' },
                          ]}
                        >
                          {m.text}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.msgTime,
                          isMine && { color: '#064E3B' },
                        ]}
                      >
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Quick Reply Chips */}
          {!isRecordingVoice && (
            <View style={styles.quickChipsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {quickReplies.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickChip}
                    onPress={() => handleSendInAppMessage(q)}
                  >
                    <Text style={styles.quickChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Bar: Either Live Voice Recording Controls OR Text + Mic Input */}
          {isRecordingVoice ? (
            <View style={styles.recordingBar}>
              <TouchableOpacity
                style={styles.cancelRecBtn}
                onPress={cancelVoiceRecording}
              >
                <Text style={styles.cancelRecText}>🗑️ Cancel</Text>
              </TouchableOpacity>

              <View style={styles.recStatusCenter}>
                <View style={styles.redRecDot} />
                <Text style={styles.recTimerText}>
                  Recording {formatDuration(recSeconds)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sendVoiceBtn}
                onPress={finishAndSendVoiceNote}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#022C22" />
                ) : (
                  <Text style={styles.sendVoiceBtnText}>Send Voice ➤</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={setText}
                placeholder={`Message ${otherPartyName}...`}
                placeholderTextColor="#64748B"
                onSubmitEditing={() => handleSendInAppMessage()}
              />

              {/* WhatsApp-Style Voice Note Mic Button */}
              <TouchableOpacity
                style={styles.micRecordBtn}
                onPress={startVoiceRecording}
                disabled={sending}
              >
                <Text style={styles.micRecordIcon}>🎙️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => handleSendInAppMessage()}
                disabled={sending || !text.trim()}
              >
                <Text style={styles.sendBtnText}>Send ➤</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    height: '84%',
    backgroundColor: '#090D16',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.5,
    borderTopColor: '#10B981',
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  headerName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  headerSub: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simSmsBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  simSmsBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
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
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '900',
  },
  routeStrip: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  routeStripText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 24,
  },
  emptyChatBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyChatTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyChatSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  msgBubbleWrap: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  msgWrapRight: {
    justifyContent: 'flex-end',
  },
  msgWrapLeft: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },
  msgBubbleMine: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  msgBubbleTheirs: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  msgSenderLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 3,
  },
  msgText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
  },
  voiceNotePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 195,
    paddingVertical: 3,
  },
  voicePlayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayCircleMine: {
    backgroundColor: '#022C22',
  },
  voicePlayCircleTheirs: {
    backgroundColor: '#10B981',
  },
  voicePlayIcon: {
    fontSize: 14,
    fontWeight: '900',
  },
  voiceWaveColumn: {
    flex: 1,
    gap: 4,
  },
  voiceBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  voiceBarItem: {
    width: 3.5,
    borderRadius: 2,
  },
  voiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceDurationText: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  msgTime: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  quickChipsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  quickChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
  },
  micRecordBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecordIcon: {
    fontSize: 20,
  },
  sendBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendBtnText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '900',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderTopWidth: 1.5,
    borderTopColor: '#EF4444',
    gap: 10,
  },
  cancelRecBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelRecText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  recStatusCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  redRecDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recTimerText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  sendVoiceBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendVoiceBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
});
