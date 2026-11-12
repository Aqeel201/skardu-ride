import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { BackendAPI } from '../services/api';
import SkarduMapPreview from '../components/SkarduMapPreview';
import RideChatModal from '../components/RideChatModal';
import InAppCallModal from '../components/InAppCallModal';

export default function DriverScreen({ user, setUser }) {
  const [isOnline, setIsOnline] = useState(true);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customBids, setCustomBids] = useState({});
  const [submittingRideId, setSubmittingRideId] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const radarPulse = useRef(new Animated.Value(0)).current;

  const captainId = String(user?._id || user?.id || '');
  const capDetails = user?.captainDetails || {};

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(radarPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, []);

  useEffect(() => {
    let mounted = true;
    const pollRides = async () => {
      try {
        const list = await BackendAPI.getRides();
        if (mounted) {
          setRides(list || []);
          setLoading(false);

          const assigned = (list || []).find(
            (r) =>
              r.acceptedDriver?.driverId === captainId &&
              ['accepted', 'arrived', 'in_progress'].includes(r.status)
          );
          if (
            assigned?.activeCall &&
            ['ringing', 'connected'].includes(assigned.activeCall.status)
          ) {
            setShowCallModal(true);
          } else if (assigned?.activeCall?.status === 'ended') {
            setShowCallModal(false);
          }
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    pollRides();
    const interval = setInterval(pollRides, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [captainId]);

  const activeAssignedRide = rides.find(
    (r) =>
      r.acceptedDriver?.driverId === captainId &&
      ['accepted', 'arrived', 'in_progress'].includes(r.status)
  );

  const searchingRides = rides.filter((r) => r.status === 'searching');

  const handleSendBid = async (ride, bidAmount) => {
    const rideId = ride._id || ride.id;
    const numericBid = Number(bidAmount);
    if (!numericBid || numericBid < 50) {
      Alert.alert('Invalid Bid', 'Please enter a valid fare offer in PKR.');
      return;
    }

    setSubmittingRideId(rideId);
    try {
      await BackendAPI.sendDriverBid(rideId, {
        bidPrice: numericBid,
        etaMinutes: 4,
      });
      const updatedList = await BackendAPI.getRides();
      setRides(updatedList || []);
    } catch (err) {
      Alert.alert('Bid Error', err.message || 'Could not send bid');
    } finally {
      setSubmittingRideId(null);
    }
  };

  const handleStartInAppCall = async () => {
    if (!activeAssignedRide) return;
    setShowCallModal(true);
    try {
      const rideId = activeAssignedRide._id || activeAssignedRide.id;
      const updated = await BackendAPI.updateCallStatus(rideId, 'start');
      if (updated) {
        setRides((prev) =>
          prev.map((r) =>
            String(r._id || r.id) === String(updated._id || updated.id)
              ? updated
              : r
          )
        );
      }
    } catch {}
  };

  const handleUpdateTripStatus = async (newStatus) => {
    if (!activeAssignedRide) return;
    const rideId = activeAssignedRide._id || activeAssignedRide.id;
    try {
      await BackendAPI.updateRideStatus(rideId, newStatus);
      const updatedUser = await BackendAPI.getCurrentUser();
      if (updatedUser && setUser) {
        setUser(updatedUser);
      }
      const updatedList = await BackendAPI.getRides();
      setRides(updatedList || []);

      if (newStatus === 'completed') {
        setShowChatModal(false);
        setShowCallModal(false);
        const fare =
          activeAssignedRide.agreedFare || activeAssignedRide.offeredFare;
        const comm = Math.round(fare * 0.08);
        Alert.alert(
          '🎉 Ride Completed!',
          `Collect Rs. ${fare} (${activeAssignedRide.paymentMethod}) from ${activeAssignedRide.passengerName}.\n\n8% Platform Commission (Rs. ${comm}) updated on your Captain account.`
        );
      }
    } catch (err) {
      Alert.alert('Status Error', err.message);
    }
  };

  const messagesCount = activeAssignedRide?.messages?.length || 0;
  const latestMessage =
    messagesCount > 0 ? activeAssignedRide.messages[messagesCount - 1] : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#090D16' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Captain Live Header & Vehicle KYC Status */}
          <View style={styles.driverDashboardCard}>
            <View style={styles.statusRow}>
              {user?.profilePhoto ? (
                <Image
                  source={{ uri: user.profilePhoto }}
                  style={styles.captainAvatar}
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.driverGreeting}>{user?.name}</Text>
                <Text style={styles.driverVehicleLine}>
                  {capDetails.vehicleModel || 'Captain Vehicle'} •{' '}
                  <Text style={{ color: '#FDE047', fontWeight: '900' }}>
                    {capDetails.vehiclePlate || 'GB-SKD'}
                  </Text>
                </Text>
                <Text style={styles.driverSubStatus}>
                  {isOnline
                    ? '🟢 Online • Listening for Skardu Passengers'
                    : '🔴 Offline • Switch online to receive rides'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOnline(!isOnline)}
                style={[
                  styles.onlineToggleBtn,
                  isOnline ? styles.onlineBtnActive : styles.offlineBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.onlineToggleText,
                    isOnline && { color: '#022C22' },
                  ]}
                >
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TODAY'S EARNINGS</Text>
                <Text style={styles.statValue}>
                  Rs. {user?.todayEarnings || 0}
                </Text>
                <Text style={styles.statHint}>
                  {user?.totalTrips || 0} Total Trips
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>CAPTAIN WALLET</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  Rs. {user?.walletBalance || 0}
                </Text>
                <Text style={styles.statHint}>
                  KYC:{' '}
                  {capDetails.kycStatus === 'verified' ? '✓ Verified' : 'Active'}
                </Text>
              </View>
            </View>
          </View>

          {/* ACTIVE ASSIGNED RIDE CONTROL PANEL + LIVE GOOGLE MAP */}
          {activeAssignedRide ? (
            <View style={styles.activeTripCard}>
              <View style={styles.activeTripHeaderStrip}>
                <Text style={styles.activeTripBadge}>
                  {activeAssignedRide.status === 'accepted'
                    ? '🚗 HEADING TO PASSENGER PICKUP'
                    : activeAssignedRide.status === 'arrived'
                    ? '📍 WAITING FOR PASSENGER AT PICKUP'
                    : '🛣️ RIDE IN PROGRESS'}
                </Text>
                <Text style={styles.activeTripFare}>
                  Rs. {activeAssignedRide.agreedFare} (
                  {activeAssignedRide.paymentMethod})
                </Text>
              </View>

              <View style={styles.activeMapWrapper}>
                <SkarduMapPreview
                  pickup={activeAssignedRide.pickup}
                  intermediateStop={activeAssignedRide.intermediateStop}
                  dropoff={activeAssignedRide.dropoff}
                  distanceKm={activeAssignedRide.distanceKm}
                  durationMin={activeAssignedRide.durationMin}
                  activeRideStatus="Active Captain Route"
                  height={245}
                  compact={true}
                />
              </View>

              <View style={styles.activeTripBody}>
                <View style={styles.paxRow}>
                  {activeAssignedRide.passengerProfilePhoto ? (
                    <Image
                      source={{ uri: activeAssignedRide.passengerProfilePhoto }}
                      style={styles.paxAvatar}
                    />
                  ) : (
                    <View style={styles.paxAvatarPlaceholder}>
                      <Text style={{ fontSize: 20 }}>🧍</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passengerTitle}>
                      {activeAssignedRide.passengerName}
                    </Text>
                    <Text style={styles.passengerPhoneText}>
                      📞 {activeAssignedRide.passengerPhone} • ⭐{' '}
                      {activeAssignedRide.passengerRating || '5.0'}
                    </Text>
                  </View>
                </View>

                {latestMessage && (
                  <TouchableOpacity
                    style={styles.latestMsgPreview}
                    onPress={() => setShowChatModal(true)}
                  >
                    <Text style={styles.latestMsgSender}>
                      {latestMessage.type === 'audio' ? '🎤' : '💬'}{' '}
                      {latestMessage.senderName}:
                    </Text>
                    <Text style={styles.latestMsgText} numberOfLines={1}>
                      {latestMessage.type === 'audio'
                        ? `Voice Note (${latestMessage.durationSec || 1}s) — Tap to Listen`
                        : `"${latestMessage.text}"`}
                    </Text>
                    <Text style={styles.replyLink}>Open Chat →</Text>
                  </TouchableOpacity>
                )}

                {/* In-App SMS / Chat + In-App HD Voice Call Row */}
                <View style={styles.commButtonsRow}>
                  <TouchableOpacity
                    style={styles.inAppSmsBtn}
                    onPress={() => setShowChatModal(true)}
                  >
                    <Text style={styles.inAppSmsBtnText}>
                      💬 In-App SMS ({messagesCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.inAppCallBtn}
                    onPress={handleStartInAppCall}
                  >
                    <Text style={styles.inAppCallBtnText}>
                      📞 In-App Call
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.routeTimeline}>
                  <View>
                    <Text style={styles.timelineLabel}>PICKUP POINT</Text>
                    <Text style={styles.timelinePlace}>
                      🟢 {activeAssignedRide.pickup?.name}
                    </Text>
                  </View>
                  {activeAssignedRide.intermediateStop && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={[styles.timelineLabel, { color: '#F59E0B' }]}>PHOTO / MARKET STOP</Text>
                      <Text style={styles.timelinePlace}>
                        📸 {activeAssignedRide.intermediateStop?.name}
                      </Text>
                    </View>
                  )}
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.timelineLabel}>
                      DROP-OFF DESTINATION
                    </Text>
                    <Text style={styles.timelinePlace}>
                      🔴 {activeAssignedRide.dropoff?.name}
                    </Text>
                  </View>
                </View>

                {activeAssignedRide.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.primaryTripBtn}
                    onPress={() => handleUpdateTripStatus('arrived')}
                  >
                    <Text style={styles.primaryTripBtnText}>
                      📍 I Have Arrived at Pickup
                    </Text>
                  </TouchableOpacity>
                )}

                {activeAssignedRide.status === 'arrived' && (
                  <TouchableOpacity
                    style={[
                      styles.primaryTripBtn,
                      { backgroundColor: '#F59E0B' },
                    ]}
                    onPress={() => handleUpdateTripStatus('in_progress')}
                  >
                    <Text style={styles.primaryTripBtnText}>
                      🛣️ Start Ride ({activeAssignedRide.distanceKm} km)
                    </Text>
                  </TouchableOpacity>
                )}

                {activeAssignedRide.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[
                      styles.primaryTripBtn,
                      { backgroundColor: '#10B981' },
                    ]}
                    onPress={() => handleUpdateTripStatus('completed')}
                  >
                    <Text
                      style={[styles.primaryTripBtnText, { color: '#022C22' }]}
                    >
                      ✅ Complete Trip & Collect Rs.{' '}
                      {activeAssignedRide.agreedFare}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : !isOnline ? (
            <View style={styles.offlineBox}>
              <Text style={styles.offlineEmoji}>☕</Text>
              <Text style={styles.offlineTitle}>You are Offline</Text>
              <Text style={styles.offlineSub}>
                Switch ONLINE above to start receiving real passenger ride requests in Skardu.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.feedHeaderRow}>
                <Text style={styles.feedTitle}>
                  LIVE PASSENGER REQUESTS ({searchingRides.length})
                </Text>
                <Text style={styles.feedSubtitle}>Real-Time MongoDB Feed</Text>
              </View>

              {loading ? (
                <View style={styles.emptyFeedBox}>
                  <ActivityIndicator size="large" color="#10B981" />
                </View>
              ) : searchingRides.length === 0 ? (
                <View style={styles.emptyFeedBox}>
                  <View style={styles.radarCenterWrap}>
                    <Animated.View
                      style={[
                        styles.searchRadarWave,
                        {
                          transform: [
                            {
                              scale: radarPulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 2.2],
                              }),
                            },
                          ],
                          opacity: radarPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.65, 0],
                          }),
                        },
                      ]}
                    />
                    <View style={styles.radarCoreCircle}>
                      <Text style={{ fontSize: 26 }}>📡</Text>
                    </View>
                  </View>

                  <Text style={styles.emptyFeedTitle}>
                    Scanning Skardu for Passenger Requests...
                  </Text>
                  <Text style={styles.emptyFeedSub}>
                    As soon as a Passenger in Skardu requests a ride, it will appear here automatically.
                  </Text>
                </View>
              ) : (
                searchingRides.map((req) => {
                  const rideId = req._id || req.id;
                  const myExistingBid = (req.bids || []).find(
                    (b) => b.driverId === captainId
                  );

                  return (
                    <View key={rideId} style={styles.requestCard}>
                      <View style={styles.reqHeaderRow}>
                        <View style={styles.vehicleBadge}>
                          <Text style={styles.vehicleBadgeText}>
                            {req.vehicleCategoryName || 'Ride Request'}
                          </Text>
                        </View>
                        <Text style={styles.reqTimeText}>
                          {req.distanceKm} km • ~{req.durationMin} mins
                        </Text>
                      </View>

                      <View style={styles.reqMainRow}>
                        {req.passengerProfilePhoto ? (
                          <Image
                            source={{ uri: req.passengerProfilePhoto }}
                            style={styles.paxAvatarSmall}
                          />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reqPassengerName}>
                            {req.passengerName} • ⭐{' '}
                            {req.passengerRating || '5.0'}
                          </Text>
                          <Text style={styles.reqDistanceInfo}>
                            Payment: {req.paymentMethod}
                          </Text>
                        </View>
                        <View style={styles.offeredFareBox}>
                          <Text style={styles.offeredFareLabel}>
                            OFFERED FARE
                          </Text>
                          <Text style={styles.offeredFareValue}>
                            Rs. {req.offeredFare}
                          </Text>
                        </View>
                      </View>

                      {req.isTourPackage && (
                        <View style={{
                          backgroundColor: '#064E3B',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: '#10B981',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          <Text style={{ fontSize: 13 }}>🏔️</Text>
                          <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '900' }}>
                            {req.packageTitle ? `${req.packageTitle.toUpperCase()} • 4x4 EXPEDITION` : '4x4 MOUNTAIN TOUR EXPEDITION'}
                          </Text>
                        </View>
                      )}

                      <View style={styles.reqRouteBox}>
                        <Text style={styles.reqRouteLine} numberOfLines={1}>
                          🟢 <Text style={{ fontWeight: '800' }}>Pickup:</Text>{' '}
                          {req.pickup?.name}
                        </Text>
                        {req.intermediateStop ? (
                          <Text style={[styles.reqRouteLine, { color: '#FBBF24' }]} numberOfLines={1}>
                            📸 <Text style={{ fontWeight: '800' }}>Stop:</Text>{' '}
                            {req.intermediateStop?.name}
                          </Text>
                        ) : null}
                        <Text style={styles.reqRouteLine} numberOfLines={1}>
                          🔴 <Text style={{ fontWeight: '800' }}>Drop:</Text>{' '}
                          {req.dropoff?.name}
                        </Text>
                        {req.isScheduled ? (
                          <Text style={{ color: '#60A5FA', fontSize: 11, fontWeight: '800', marginTop: 3 }}>
                            ⏰ Advance Schedule: {req.scheduledTime || 'Custom Time'}
                          </Text>
                        ) : null}
                        {req.notes ? (
                          <Text style={styles.reqNoteText}>
                            📝 "{req.notes}"
                          </Text>
                        ) : null}
                      </View>

                      {myExistingBid ? (
                        <View style={styles.sendingBidBanner}>
                          <Text style={styles.sendingBidText}>
                            ⏳ Your Bid of Rs. {myExistingBid.bidPrice} is live — waiting for{' '}
                            {req.passengerName} to accept...
                          </Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={styles.acceptExactBtn}
                        disabled={submittingRideId === rideId}
                        onPress={() => handleSendBid(req, req.offeredFare)}
                      >
                        <Text style={styles.acceptExactBtnText}>
                          {myExistingBid
                            ? `Update Bid to Passenger's Fare (Rs. ${req.offeredFare})`
                            : `Accept Passenger Fare • Rs. ${req.offeredFare}`}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.counterOfferRow}>
                        <Text style={styles.counterOfferLabel}>
                          COUNTER OFFER:
                        </Text>
                        {[50, 100, 200].map((extra) => {
                          const counterAmount =
                            Number(req.offeredFare) + extra;
                          return (
                            <TouchableOpacity
                              key={extra}
                              style={styles.counterChip}
                              onPress={() => handleSendBid(req, counterAmount)}
                            >
                              <Text style={styles.counterChipText}>
                                Rs. {counterAmount}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.customBidRow}>
                        <TextInput
                          style={styles.customBidInput}
                          keyboardType="numeric"
                          placeholder="Or enter custom fare (PKR)..."
                          placeholderTextColor="#64748B"
                          value={customBids[rideId] || ''}
                          onChangeText={(txt) =>
                            setCustomBids((prev) => ({
                              ...prev,
                              [rideId]: txt,
                            }))
                          }
                        />
                        <TouchableOpacity
                          style={styles.customBidSendBtn}
                          onPress={() =>
                            handleSendBid(req, customBids[rideId])
                          }
                        >
                          <Text style={styles.customBidSendText}>Send Bid</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* In-App SMS & Chat Modal */}
      <RideChatModal
        visible={showChatModal}
        onClose={() => setShowChatModal(false)}
        ride={activeAssignedRide}
        currentUser={user}
        onRideUpdated={(updatedRide) => {
          setRides((prev) =>
            prev.map((r) =>
              String(r._id || r.id) === String(updatedRide._id || updatedRide.id)
                ? updatedRide
                : r
            )
          );
        }}
      />

      {/* In-App Voice Call Modal */}
      <InAppCallModal
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        ride={activeAssignedRide}
        currentUser={user}
        onRideUpdated={(updatedRide) => {
          setRides((prev) =>
            prev.map((r) =>
              String(r._id || r.id) === String(updatedRide._id || updatedRide.id)
                ? updatedRide
                : r
            )
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    padding: 14,
    paddingBottom: 38,
  },
  driverDashboardCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  captainAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  driverGreeting: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  driverVehicleLine: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  driverSubStatus: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  onlineToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  onlineBtnActive: {
    backgroundColor: '#10B981',
  },
  offlineBtnActive: {
    backgroundColor: '#EF4444',
  },
  onlineToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#090D16',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  statHint: {
    color: '#10B981',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.7,
  },
  feedSubtitle: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '800',
  },
  emptyFeedBox: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  radarCenterWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  searchRadarWave: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  radarCoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeedTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyFeedSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  requestCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  reqTimeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '800',
  },
  reqMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  paxAvatarSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  reqPassengerName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  reqDistanceInfo: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  offeredFareBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  offeredFareLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  offeredFareValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  reqRouteBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  reqRouteLine: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  reqNoteText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 2,
  },
  acceptExactBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  acceptExactBtnText: {
    color: '#022C22',
    fontSize: 14,
    fontWeight: '900',
  },
  counterOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  counterOfferLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  counterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  counterChipText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  customBidRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customBidInput: {
    flex: 1,
    backgroundColor: '#090D16',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  customBidSendBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
  },
  customBidSendText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  sendingBidBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 10,
  },
  sendingBidText: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  activeTripCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10B981',
    marginTop: 4,
  },
  activeTripHeaderStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  activeMapWrapper: {
    height: 245,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    backgroundColor: '#090D16',
  },
  activeTripBody: {
    padding: 16,
    paddingTop: 12,
  },
  activeTripBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeTripFare: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  paxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  paxAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  paxAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  passengerPhoneText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  latestMsgPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090D16',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
    gap: 6,
  },
  latestMsgSender: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  latestMsgText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  replyLink: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
  },
  commButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inAppSmsBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  inAppSmsBtnText: {
    color: '#022C22',
    fontWeight: '900',
    fontSize: 13,
  },
  inAppCallBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  inAppCallBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
  },
  routeTimeline: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  timelinePlace: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  primaryTripBtn: {
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryTripBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
  },
  offlineBox: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  offlineEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  offlineSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
});
