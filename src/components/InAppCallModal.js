import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { BackendAPI } from '../services/api';
import {
  ensureMicPermission,
  fileUriToBase64,
  playBase64Audio,
  stopActiveVoicePlayer,
  startRingingTone,
  stopRingingTone,
} from '../utils/audioHelper';

export default function InAppCallModal({
  visible,
  onClose,
  ride,
  currentUser,
  onRideUpdated,
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [voiceActivityLabel, setVoiceActivityLabel] = useState(
    '🎙️ Preparing HD Voice Channel...'
  );
  const [packetsSent, setPacketsSent] = useState(0);
  const [packetsReceived, setPacketsReceived] = useState(0);

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0.3)).current;

  const lastSeqRef = useRef(0);
  const isPlayingRemoteRef = useRef(false);
  const isMutedRef = useRef(false);
  const isSpeakerRef = useRef(true);

  const callRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isSpeakerRef.current = isSpeaker;
  }, [isSpeaker]);

  const isCaptain = currentUser?.role === 'driver';
  const myId = String(currentUser?._id || currentUser?.id || '');

  const callStatus = ride?.activeCall?.status || 'ringing';
  const isIncomingRinging =
    callStatus === 'ringing' &&
    ride?.activeCall?.callerId &&
    String(ride.activeCall.callerId) !== myId;

  const otherPartyName = isCaptain
    ? ride?.passengerName || 'Passenger'
    : ride?.acceptedDriver?.driverName || 'Captain';

  const otherPartyPhone = isCaptain
    ? ride?.passengerPhone || ''
    : ride?.acceptedDriver?.driverPhone || '';

  const otherPartyPhoto = isCaptain
    ? ride?.passengerProfilePhoto
    : ride?.acceptedDriver?.driverProfilePhoto;

  const otherPartyRoleBadge = isCaptain
    ? '🧍 Verified Skardu Passenger'
    : `🚖 ${ride?.acceptedDriver?.vehicleModel || 'Captain'} • ${
        ride?.acceptedDriver?.vehiclePlate || 'GB-SKD'
      }`;

  // Visual Radar & Equalizer Animations
  useEffect(() => {
    if (!visible) {
      setSeconds(0);
      setPacketsSent(0);
      setPacketsReceived(0);
      lastSeqRef.current = 0;
      stopRingingTone();
      stopActiveVoicePlayer();
      return;
    }

    const createPulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 900);
    const wLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0.25,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );

    p1.start();
    p2.start();
    wLoop.start();

    return () => {
      p1.stop();
      p2.stop();
      wLoop.stop();
    };
  }, [visible]);

  // Audible Phone Ringing Tone while status === 'ringing'
  useEffect(() => {
    if (visible && callStatus === 'ringing') {
      startRingingTone();
    } else {
      stopRingingTone();
    }
    return () => {
      stopRingingTone();
    };
  }, [visible, callStatus]);

  // Call Timer + Real Two-Way Live Voice Audio Relay when Connected
  useEffect(() => {
    let secTimer = null;
    let pollAudioInterval = null;
    let activeLoop = true;

    const rideId = ride?._id || ride?.id;

    if (visible && callStatus === 'connected' && rideId) {
      stopRingingTone();

      secTimer = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);

      // 1. Poll & Play Incoming Voice Chunks from the Other Party
      pollAudioInterval = setInterval(async () => {
        if (!activeLoop || isPlayingRemoteRef.current) return;
        try {
          const data = await BackendAPI.getCallAudioChunks(
            rideId,
            lastSeqRef.current
          );
          if (data?.chunks && data.chunks.length > 0) {
            const latestChunk = data.chunks[data.chunks.length - 1];
            lastSeqRef.current = latestChunk.seq;
            isPlayingRemoteRef.current = true;
            setPacketsReceived((c) => c + 1);
            setVoiceActivityLabel(`🔊 Receiving Voice from ${otherPartyName}...`);

            await playBase64Audio(
              latestChunk.audioData,
              `call_${latestChunk.seq}`,
              isSpeakerRef.current ? 1.0 : 0.45,
              () => {
                isPlayingRemoteRef.current = false;
                if (activeLoop) {
                  setVoiceActivityLabel(
                    isMutedRef.current
                      ? '🔇 Microphone Muted'
                      : '🎙️ Live Mic Active • Two-Way Voice Connected'
                  );
                }
              }
            );
          }
        } catch {}
      }, 850);

      // 2. Continuous Microphone Voice Capture & Upload Loop
      const runMicLoop = async () => {
        const hasPerm = await ensureMicPermission();
        if (!hasPerm) {
          setVoiceActivityLabel('⚠️ Allow Microphone Permission for Voice');
          return;
        }
        setVoiceActivityLabel('🎙️ Live Mic Active • Speak Now');

        while (activeLoop) {
          if (isMutedRef.current || isPlayingRemoteRef.current) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }

          try {
            await callRecorder.prepareToRecordAsync();
            callRecorder.record();
            await new Promise((r) => setTimeout(r, 1850));

            if (!activeLoop) {
              try {
                await callRecorder.stop();
              } catch {}
              break;
            }

            await callRecorder.stop();
            const uri = callRecorder.uri;
            if (uri && !isMutedRef.current) {
              const b64 = await fileUriToBase64(uri);
              if (b64 && b64.length > 100) {
                await BackendAPI.sendCallAudioChunk(rideId, b64);
                if (activeLoop) {
                  setPacketsSent((c) => c + 1);
                }
              }
            }
          } catch {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      };

      runMicLoop();
    } else {
      setSeconds(0);
    }

    return () => {
      activeLoop = false;
      if (secTimer) clearInterval(secTimer);
      if (pollAudioInterval) clearInterval(pollAudioInterval);
      try {
        if (callRecorder.isRecording) {
          callRecorder.stop();
        }
      } catch {}
      stopActiveVoicePlayer();
    };
  }, [visible, callStatus, ride?._id, ride?.id]);

  if (!ride) return null;

  const formatTimer = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAnswerCall = async () => {
    stopRingingTone();
    try {
      const rideId = ride._id || ride.id;
      const updated = await BackendAPI.updateCallStatus(rideId, 'answer');
      if (onRideUpdated && updated) onRideUpdated(updated);
    } catch {}
  };

  const handleEndCall = async () => {
    stopRingingTone();
    stopActiveVoicePlayer();
    try {
      const rideId = ride._id || ride.id;
      const updated = await BackendAPI.updateCallStatus(rideId, 'end');
      if (onRideUpdated && updated) onRideUpdated(updated);
    } catch {}
    onClose();
  };

  const handleSwitchToSimCall = () => {
    if (otherPartyPhone) {
      Linking.openURL(`tel:${otherPartyPhone}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleEndCall}
    >
      <View style={styles.container}>
        {/* Top Encrypted VoIP Badge */}
        <View style={styles.topSecurityPill}>
          <View style={styles.greenDot} />
          <Text style={styles.topSecurityText}>
            SKARDURIDE HD REAL-TIME VOICE CALL
          </Text>
        </View>

        {/* Caller Identity & Animated Radar Avatar */}
        <View style={styles.centerSection}>
          <View style={styles.avatarRadarContainer}>
            <Animated.View
              style={[
                styles.radarRing,
                {
                  transform: [
                    {
                      scale: pulse1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.2],
                      }),
                    },
                  ],
                  opacity: pulse1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.65, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.radarRing,
                {
                  transform: [
                    {
                      scale: pulse2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.2],
                      }),
                    },
                  ],
                  opacity: pulse2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 0],
                  }),
                },
              ]}
            />

            <View style={styles.avatarOuterBorder}>
              {otherPartyPhoto ? (
                <Image
                  source={{ uri: otherPartyPhoto }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={{ fontSize: 44 }}>
                    {isCaptain ? '🧍' : '🚖'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.callerName}>{otherPartyName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{otherPartyRoleBadge}</Text>
          </View>

          {/* Call Status / Live Timer */}
          <Text style={styles.callStatusText}>
            {isIncomingRinging
              ? '📲 Incoming SkarduRide Voice Call...'
              : callStatus === 'connected'
              ? `🟢 Connected • ${formatTimer(seconds)}`
              : '🔔 Ringing on SkarduRide App...'}
          </Text>

          {/* Live Voice Transmission Indicator when Connected */}
          {callStatus === 'connected' && (
            <View style={styles.liveVoiceStatusCard}>
              <View style={styles.waveRow}>
                {[0.6, 1, 0.75, 1.2, 0.8, 1, 0.5].map((mult, idx) => (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: isMuted ? '#64748B' : '#10B981',
                        transform: [
                          {
                            scaleY: isMuted
                              ? 0.3
                              : Animated.multiply(waveAnim, mult),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.voiceActivityText}>{voiceActivityLabel}</Text>
              <Text style={styles.packetStatsText}>
                Sent: {packetsSent} audio packets • Received: {packetsReceived}{' '}
                audio packets
              </Text>
            </View>
          )}

          {/* Route Info Card */}
          <View style={styles.routeSummaryBox}>
            <Text style={styles.routeSummaryLine} numberOfLines={1}>
              🟢 Pickup: {ride.pickup?.name?.split(' (')[0]}
            </Text>
            <Text style={styles.routeSummaryLine} numberOfLines={1}>
              🔴 Drop-off: {ride.dropoff?.name?.split(' (')[0]} • Rs.{' '}
              {ride.agreedFare || ride.offeredFare}
            </Text>
          </View>
        </View>

        {/* Bottom Call Controls */}
        <View style={styles.controlsSection}>
          {/* Audio Toggles Row */}
          <View style={styles.secondaryControlsRow}>
            <TouchableOpacity
              onPress={() => setIsMuted(!isMuted)}
              style={[
                styles.controlOptionBtn,
                isMuted && styles.controlOptionActive,
              ]}
            >
              <Text style={styles.controlOptionEmoji}>
                {isMuted ? '🔇' : '🎙️'}
              </Text>
              <Text style={styles.controlOptionLabel}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsSpeaker(!isSpeaker)}
              style={[
                styles.controlOptionBtn,
                isSpeaker && styles.controlOptionActive,
              ]}
            >
              <Text style={styles.controlOptionEmoji}>
                {isSpeaker ? '🔊' : '🔈'}
              </Text>
              <Text style={styles.controlOptionLabel}>
                {isSpeaker ? 'Speaker ON' : 'Earpiece'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSwitchToSimCall}
              style={styles.controlOptionBtn}
            >
              <Text style={styles.controlOptionEmoji}>📲</Text>
              <Text style={styles.controlOptionLabel}>SIM Call</Text>
            </TouchableOpacity>
          </View>

          {/* Main Accept / End Call Buttons */}
          <View style={styles.primaryCallButtonsRow}>
            {isIncomingRinging && (
              <TouchableOpacity
                style={styles.answerCallBtn}
                onPress={handleAnswerCall}
              >
                <Text style={styles.callActionIcon}>📞</Text>
                <Text style={styles.answerCallText}>Answer Call</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.endCallBtn}
              onPress={handleEndCall}
            >
              <Text style={styles.callActionIcon}>📵</Text>
              <Text style={styles.endCallText}>
                {isIncomingRinging ? 'Decline' : 'End Call'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.97)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 22,
  },
  topSecurityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  topSecurityText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  centerSection: {
    alignItems: 'center',
    width: '100%',
  },
  avatarRadarContainer: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  radarRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(16, 185, 129, 0.32)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  avatarOuterBorder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: '#10B981',
    overflow: 'hidden',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerName: {
    color: '#F8FAFC',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  roleBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  callStatusText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
  liveVoiceStatusCard: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    width: '100%',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    marginBottom: 6,
  },
  waveBar: {
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  voiceActivityText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  packetStatsText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  routeSummaryBox: {
    marginTop: 14,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '100%',
    gap: 4,
  },
  routeSummaryLine: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  controlsSection: {
    width: '100%',
    gap: 18,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlOptionBtn: {
    width: 82,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  controlOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: '#10B981',
  },
  controlOptionEmoji: {
    fontSize: 22,
  },
  controlOptionLabel: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  primaryCallButtonsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  answerCallBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  answerCallText: {
    color: '#022C22',
    fontSize: 16,
    fontWeight: '900',
  },
  endCallBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callActionIcon: {
    fontSize: 18,
  },
  endCallText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
