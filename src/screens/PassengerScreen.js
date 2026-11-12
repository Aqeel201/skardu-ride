import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import SkarduMapPreview from '../components/SkarduMapPreview';
import RideChatModal from '../components/RideChatModal';
import InAppCallModal from '../components/InAppCallModal';
import TourPackageModal from '../components/TourPackageModal';
import SafetySOSModal from '../components/SafetySOSModal';
import {
  SKARDU_LOCATIONS,
  VEHICLE_TYPES,
  calculateRouteEstimate,
} from '../data/skarduLocations';
import { BackendAPI } from '../services/api';

const LOCATION_CATEGORIES = [
  'All',
  'City',
  'Tourism',
  'Transit',
  'Education',
  'Hospital',
];

export default function PassengerScreen({ user }) {
  const [pickup, setPickup] = useState(SKARDU_LOCATIONS[0]);
  const [dropoff, setDropoff] = useState(SKARDU_LOCATIONS[4]);
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLE_TYPES[1]);
  const [offeredFare, setOfferedFare] = useState(950);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const [locationModalTarget, setLocationModalTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [submitting, setSubmitting] = useState(false);

  const [currentRide, setCurrentRide] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // New Features: Intermediate Stop & Advance Scheduled Ride
  const [intermediateStop, setIntermediateStop] = useState(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('Tomorrow 08:00 AM');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const radarPulse = useRef(new Animated.Value(0)).current;
  const ctaGlow = useRef(new Animated.Value(1)).current;

  const estimate = calculateRouteEstimate(pickup, dropoff, selectedVehicle, intermediateStop);

  useEffect(() => {
    setOfferedFare(estimate.suggestedFare);
  }, [pickup.id, dropoff.id, selectedVehicle.id]);

  // Entrance & Continuous Micro-Animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

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

    const ctaLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaGlow, {
          toValue: 1.02,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(ctaGlow, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    ctaLoop.start();

    return () => {
      pulseLoop.stop();
      ctaLoop.stop();
    };
  }, []);

  // Poll Active Ride & Incoming In-App Calls from MERN Backend
  useEffect(() => {
    let mounted = true;
    const pollActiveRide = async () => {
      try {
        const rides = await BackendAPI.getRides();
        if (!mounted) return;
        const active = rides.find((r) =>
          ['searching', 'accepted', 'arrived', 'in_progress'].includes(r.status)
        );
        setCurrentRide(active || null);

        if (
          active?.activeCall &&
          ['ringing', 'connected'].includes(active.activeCall.status)
        ) {
          setShowCallModal(true);
        } else if (active?.activeCall?.status === 'ended') {
          setShowCallModal(false);
        }
      } catch {}
    };

    pollActiveRide();
    const interval = setInterval(pollActiveRide, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAdjustFare = (delta) => {
    setOfferedFare((prev) => Math.max(100, prev + delta));
  };

  const handleSwapLocations = () => {
    const temp = pickup;
    setPickup(dropoff);
    setDropoff(temp);
  };

  const handleCreateRideRequest = async () => {
    if (pickup.id === dropoff.id) {
      Alert.alert(
        'Invalid Route',
        'Pickup and Drop-off locations must be different.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const formattedNotes = [
        intermediateStop ? `Photo Stop: ${intermediateStop.name}` : null,
        isScheduled ? `Scheduled Departure: ${scheduledTime}` : null,
        notes.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(' • ');

      const ride = await BackendAPI.createRide({
        pickup,
        dropoff,
        intermediateStop: intermediateStop ? { name: intermediateStop.name, id: intermediateStop.id } : null,
        isScheduled,
        scheduledTime: isScheduled ? scheduledTime : null,
        vehicleCategory: selectedVehicle.id,
        vehicleCategoryName: selectedVehicle.name,
        offeredFare,
        distanceKm: estimate.distanceKm,
        durationMin: estimate.durationMin,
        paymentMethod,
        notes: formattedNotes,
      });
      setCurrentRide(ride);
    } catch (err) {
      Alert.alert(
        'Request Failed',
        err.message || 'Could not create ride request'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookTourPackage = async (tourData) => {
    setSubmitting(true);
    try {
      const tourPickup = {
        id: 'skardu_hotel',
        name: 'Hotel / Airport Pickup',
        area: 'Skardu',
        coords: pickup.coords,
      };
      const tourDropoff = {
        id: tourData.tour.id,
        name: tourData.tour.destination,
        area: tourData.tour.title,
        coords: dropoff.coords,
      };

      const ride = await BackendAPI.createRide({
        pickup: tourPickup,
        dropoff: tourDropoff,
        isTourPackage: true,
        tourId: tourData.tour.id,
        tourTitle: tourData.tour.title,
        scheduledTime: tourData.tourDate,
        vehicleCategory: 'jeep_4x4',
        vehicleCategoryName: `Tour: ${tourData.tour.title}`,
        offeredFare: tourData.offeredFare,
        distanceKm: 45,
        durationMin: 360,
        paymentMethod: 'Cash',
        notes: `🏔️ ${tourData.tour.title} (${tourData.passengersCount} Passengers) • ${tourData.tourDate} • ${tourData.customNotes || 'Tour Booking'}`,
      });
      setCurrentRide(ride);
      Alert.alert(
        'Tour Request Posted! 🏔️',
        `Your tour request for "${tourData.tour.title}" has been broadcast to 4x4 Mountain Captains in Skardu!`
      );
    } catch (err) {
      Alert.alert('Tour Booking Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptCaptainBid = async (bid) => {
    if (!currentRide) return;
    const rideId = currentRide._id || currentRide.id;
    const bidId = bid._id || bid.id;
    try {
      const updated = await BackendAPI.acceptBid(rideId, bidId);
      setCurrentRide(updated);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not accept bid');
    }
  };

  const handleStartInAppCall = async () => {
    if (!currentRide) return;
    setShowCallModal(true);
    try {
      const rideId = currentRide._id || currentRide.id;
      const updated = await BackendAPI.updateCallStatus(rideId, 'start');
      if (updated) setCurrentRide(updated);
    } catch {}
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;
    const rideId = currentRide._id || currentRide.id;
    try {
      await BackendAPI.updateRideStatus(rideId, 'cancelled');
      setCurrentRide(null);
      setShowChatModal(false);
      setShowCallModal(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const filteredLocations = SKARDU_LOCATIONS.filter((loc) => {
    const matchesCat =
      selectedCategory === 'All' || loc.category === selectedCategory;
    const matchesSearch =
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const rideStatus = currentRide?.status;
  const messagesCount = currentRide?.messages?.length || 0;
  const latestMessage =
    messagesCount > 0 ? currentRide.messages[messagesCount - 1] : null;

  return (
    <View style={styles.container}>
      <SkarduMapPreview
        pickup={currentRide ? currentRide.pickup : pickup}
        dropoff={currentRide ? currentRide.dropoff : dropoff}
        distanceKm={currentRide ? currentRide.distanceKm : estimate.distanceKm}
        durationMin={
          currentRide ? currentRide.durationMin : estimate.durationMin
        }
        activeRideStatus={
          rideStatus === 'searching'
            ? 'Broadcasting...'
            : rideStatus === 'accepted'
            ? 'Captain En Route'
            : rideStatus === 'arrived'
            ? 'Captain Arrived!'
            : rideStatus === 'in_progress'
            ? 'On Trip'
            : null
        }
        onSelectMapPin={(loc) => {
          if (!currentRide && loc.id !== pickup.id) {
            setDropoff(loc);
          }
        }}
      />

      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={styles.bottomSheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetHandle} />

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* STATE 1: NO ACTIVE RIDE -> BOOKING FORM */}
          {!currentRide && (
            <>
              {/* Quick Action Pills: Tour Packages & SOS Shield */}
              <View style={styles.topFeatureActionRow}>
                <TouchableOpacity
                  style={styles.tourPromoBanner}
                  onPress={() => setShowTourModal(true)}
                >
                  <Text style={{ fontSize: 18 }}>🏔️</Text>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.tourPromoTitle}>Skardu Tour Packages & 4x4</Text>
                    <Text style={styles.tourPromoSub}>Deosai, Shigar, Khaplu Day Trips</Text>
                  </View>
                  <Text style={styles.tourPromoArrow}>Explore →</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sosActionPill}
                  onPress={() => setShowSafetyModal(true)}
                >
                  <Text style={{ fontSize: 16 }}>🛡️</Text>
                  <Text style={styles.sosPillText}>SOS</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.routeCard}>
                <View style={styles.timelineVisualCol}>
                  <View style={styles.timelineGreenRing}>
                    <View style={styles.timelineGreenInner} />
                  </View>
                  <View style={styles.timelineVerticalLine} />
                  {intermediateStop && (
                    <>
                      <View style={styles.timelineStopSquare} />
                      <View style={styles.timelineVerticalLine} />
                    </>
                  )}
                  <View style={styles.timelineRedSquare} />
                </View>

                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setLocationModalTarget('pickup');
                    }}
                  >
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>PICKUP POINT</Text>
                      <Text style={styles.locationValue} numberOfLines={1}>
                        {pickup.name}
                      </Text>
                      <Text style={styles.locationAreaSub}>{pickup.area}</Text>
                    </View>
                    <View style={styles.editLocPill}>
                      <Text style={styles.editLocPillText}>Change</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Multi-Stop Intermediate Waypoint */}
                  {intermediateStop ? (
                    <>
                      <View style={styles.routeDivider} />
                      <View style={styles.locationRow}>
                        <View style={styles.locationTextWrap}>
                          <Text style={[styles.locationLabel, { color: '#F59E0B' }]}>
                            PHOTO / MARKET STOP (WAYPOINT)
                          </Text>
                          <Text style={styles.locationValue} numberOfLines={1}>
                            📸 {intermediateStop.name}
                          </Text>
                          <Text style={styles.locationAreaSub}>{intermediateStop.area}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.editLocPill, { borderColor: '#EF4444' }]}
                          onPress={() => setIntermediateStop(null)}
                        >
                          <Text style={[styles.editLocPillText, { color: '#EF4444' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}

                  <View style={styles.routeDivider} />

                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setLocationModalTarget('dropoff');
                    }}
                  >
                    <View style={styles.locationTextWrap}>
                      <Text style={[styles.locationLabel, { color: '#F87171' }]}>
                        WHERE TO? (DESTINATION)
                      </Text>
                      <Text style={styles.locationValue} numberOfLines={1}>
                        {dropoff.name}
                      </Text>
                      <Text style={styles.locationAreaSub}>
                        {dropoff.area} • {estimate.distanceKm} km (~
                        {estimate.durationMin} mins)
                      </Text>
                    </View>
                    <View style={[styles.editLocPill, { borderColor: '#EF4444' }]}>
                      <Text style={[styles.editLocPillText, { color: '#F87171' }]}>
                        Search
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.swapBtn}
                  onPress={handleSwapLocations}
                >
                  <Text style={styles.swapBtnIcon}>⇅</Text>
                </TouchableOpacity>
              </View>

              {/* Add Stop & Advance Schedule Toggle Row */}
              <View style={styles.routeExtraActionsRow}>
                {!intermediateStop ? (
                  <TouchableOpacity
                    style={styles.addStopBtn}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setLocationModalTarget('stop');
                    }}
                  >
                    <Text style={styles.addStopBtnText}>+ Add Photo / Market Stop</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.scheduleToggleBtn, isScheduled && styles.scheduleToggleActive]}
                  onPress={() => setIsScheduled(!isScheduled)}
                >
                  <Text style={[styles.scheduleToggleText, isScheduled && styles.scheduleToggleTextActive]}>
                    ⏰ {isScheduled ? scheduledTime : 'Schedule Advance Ride'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickSpotsScroll}
              >
                {SKARDU_LOCATIONS.map((spot) => {
                  const isSelected = dropoff.id === spot.id;
                  return (
                    <TouchableOpacity
                      key={spot.id}
                      onPress={() => spot.id !== pickup.id && setDropoff(spot)}
                      style={[
                        styles.spotChip,
                        isSelected && styles.spotChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.spotChipText,
                          isSelected && styles.spotChipTextActive,
                        ]}
                      >
                        {spot.category === 'Tourism' ? '🏔️ ' : '📍 '}
                        {spot.name.split(' (')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionTitle}>SELECT VEHICLE CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.vehicleScroll}
              >
                {VEHICLE_TYPES.map((v) => {
                  const isSelected = selectedVehicle.id === v.id;
                  const est = calculateRouteEstimate(pickup, dropoff, v);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setSelectedVehicle(v)}
                      style={[
                        styles.vehicleCard,
                        isSelected && styles.vehicleCardActive,
                      ]}
                    >
                      <View style={styles.vehicleHeader}>
                        <Text style={styles.vehicleEmoji}>{v.icon}</Text>
                        <View
                          style={[
                            styles.etaPill,
                            isSelected && { backgroundColor: '#10B981' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.vehicleEta,
                              isSelected && { color: '#022C22' },
                            ]}
                          >
                            {v.eta}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.vehicleName,
                          isSelected && styles.vehicleNameActive,
                        ]}
                      >
                        {v.name}
                      </Text>
                      <Text style={styles.vehicleSub} numberOfLines={1}>
                        {v.subtitle}
                      </Text>
                      <Text
                        style={[
                          styles.vehicleEstPrice,
                          isSelected && styles.vehiclePriceActive,
                        ]}
                      >
                        Rs. {est.suggestedFare}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.fareBidCard}>
                <View style={styles.fareHeaderRow}>
                  <Text style={styles.fareTitle}>OFFER YOUR FARE (PKR)</Text>
                  <View style={styles.recommendedPill}>
                    <Text style={styles.recommendedText}>
                      Est: Rs. {estimate.suggestedFare}
                    </Text>
                  </View>
                </View>

                <View style={styles.fareControlsRow}>
                  <TouchableOpacity
                    style={styles.fareStepBtn}
                    onPress={() => handleAdjustFare(-50)}
                  >
                    <Text style={styles.fareStepBtnText}>− 50</Text>
                  </TouchableOpacity>

                  <View style={styles.fareDisplayBox}>
                    <Text style={styles.currencyPrefix}>PKR</Text>
                    <TextInput
                      style={styles.fareInputText}
                      keyboardType="numeric"
                      value={String(offeredFare)}
                      onChangeText={(val) => {
                        const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
                        setOfferedFare(isNaN(num) ? 0 : num);
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.fareStepBtn, styles.fareStepBtnPlus]}
                    onPress={() => handleAdjustFare(50)}
                  >
                    <Text style={[styles.fareStepBtnText, { color: '#022C22' }]}>
                      + 50
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.optionsRow}>
                  {['Cash', 'EasyPaisa', 'JazzCash'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[
                        styles.payPill,
                        paymentMethod === method && styles.payPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.payPillText,
                          paymentMethod === method && styles.payPillTextActive,
                        ]}
                      >
                        {method === 'Cash' ? '💵 Cash' : `📱 ${method}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.noteInput}
                  placeholder="Instructions for Captain (e.g. Gate number, luggage)..."
                  placeholderTextColor="#64748B"
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              <Animated.View style={{ transform: [{ scale: ctaGlow }] }}>
                <TouchableOpacity
                  style={styles.findDriverBtn}
                  onPress={handleCreateRideRequest}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#022C22" />
                  ) : (
                    <Text style={styles.findDriverBtnText}>
                      ⚡ Request {selectedVehicle.name} • Offer Rs. {offeredFare}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </>
          )}

          {/* STATE 2: SEARCHING FOR REAL CAPTAINS (WITH ANIMATED RADAR) */}
          {currentRide && rideStatus === 'searching' && (
            <View style={styles.biddingContainer}>
              <View style={styles.biddingHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.biddingTitle}>
                    Broadcasting to Skardu Captains
                  </Text>
                  <Text style={styles.biddingSubtitle}>
                    Offered: Rs. {currentRide.offeredFare} ({currentRide.paymentMethod}) • {currentRide.distanceKm} km
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelSearchBtn}
                  onPress={handleCancelRide}
                >
                  <Text style={styles.cancelSearchBtnText}>✕ Cancel</Text>
                </TouchableOpacity>
              </View>

              {!currentRide.bids || currentRide.bids.length === 0 ? (
                <View style={styles.loadingDriversBox}>
                  <View style={styles.radarCenterWrap}>
                    <Animated.View
                      style={[
                        styles.searchRadarWave,
                        {
                          transform: [
                            {
                              scale: radarPulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 2.3],
                              }),
                            },
                          ],
                          opacity: radarPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.7, 0],
                          }),
                        },
                      ]}
                    />
                    <View style={styles.radarCoreCircle}>
                      <Text style={{ fontSize: 26 }}>📡</Text>
                    </View>
                  </View>

                  <Text style={styles.loadingDriversText}>
                    Waiting for online Captains in Skardu...
                  </Text>
                  <Text style={styles.loadingDriversSub}>
                    {currentRide.pickup?.name} → {currentRide.dropoff?.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.bidsList}>
                  <Text style={styles.bidsCountLabel}>
                    🔥 {currentRide.bids.length} CAPTAIN OFFER(S) RECEIVED:
                  </Text>
                  {currentRide.bids.map((bid) => (
                    <View key={bid._id || bid.id} style={styles.driverBidCard}>
                      <View style={styles.driverBidTop}>
                        {bid.driverProfilePhoto ? (
                          <Image
                            source={{ uri: bid.driverProfilePhoto }}
                            style={styles.driverAvatarImg}
                          />
                        ) : (
                          <View style={styles.driverAvatarCircle}>
                            <Text style={{ fontSize: 20 }}>🚖</Text>
                          </View>
                        )}
                        <View style={styles.driverBidInfo}>
                          <Text style={styles.driverNameText}>
                            {bid.driverName}
                          </Text>
                          <Text style={styles.driverVehicleText}>
                            {bid.vehicleModel} ({bid.vehicleColor}) •{' '}
                            {bid.vehiclePlate}
                          </Text>
                          <Text style={styles.driverMetaText}>
                            ⭐ {bid.driverRating} ({bid.driverTrips} trips) • ~
                            {bid.etaMinutes} mins away
                          </Text>
                        </View>
                        <View style={styles.bidPriceBox}>
                          <Text style={styles.bidPriceText}>
                            Rs. {bid.bidPrice}
                          </Text>
                          <Text
                            style={[
                              styles.bidMatchTag,
                              bid.isExactMatch
                                ? { color: '#10B981' }
                                : { color: '#F59E0B' },
                            ]}
                          >
                            {bid.isExactMatch
                              ? '✓ Accepted Fare'
                              : 'Counter Offer'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.bidActionsRow}>
                        <TouchableOpacity
                          style={styles.acceptBidBtn}
                          onPress={() => handleAcceptCaptainBid(bid)}
                        >
                          <Text style={styles.acceptBidText}>
                            Accept {bid.driverName} • Rs. {bid.bidPrice}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* STATE 3: CAPTAIN ACCEPTED / ARRIVED / IN PROGRESS */}
          {currentRide &&
            ['accepted', 'arrived', 'in_progress'].includes(rideStatus) &&
            currentRide.acceptedDriver && (
              <View style={styles.confirmedCard}>
                <View style={styles.confirmedStatusBanner}>
                  <Text style={styles.confirmedStatusText}>
                    {rideStatus === 'accepted'
                      ? '🟢 Captain is on the way to pickup'
                      : rideStatus === 'arrived'
                      ? '📍 Captain has arrived at pickup!'
                      : '🛣️ Ride in progress to destination'}
                  </Text>
                </View>

                <View style={styles.driverProfileRow}>
                  {currentRide.acceptedDriver.driverProfilePhoto ? (
                    <Image
                      source={{
                        uri: currentRide.acceptedDriver.driverProfilePhoto,
                      }}
                      style={styles.driverAvatarLargeImg}
                    />
                  ) : (
                    <View style={styles.driverAvatarLarge}>
                      <Text style={{ fontSize: 26 }}>🚖</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmedDriverName}>
                      {currentRide.acceptedDriver.driverName}
                    </Text>
                    <Text style={styles.confirmedVehicle}>
                      {currentRide.acceptedDriver.vehicleModel} (
                      {currentRide.acceptedDriver.vehicleColor})
                    </Text>
                    <View style={styles.plateBadge}>
                      <Text style={styles.plateBadgeText}>
                        {currentRide.acceptedDriver.vehiclePlate}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.agreedFareLabel}>AGREED FARE</Text>
                    <Text style={styles.agreedFareAmount}>
                      Rs. {currentRide.agreedFare}
                    </Text>
                    <Text style={styles.agreedPaymentType}>
                      {currentRide.paymentMethod}
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
                    <Text style={styles.replyLink}>Reply →</Text>
                  </TouchableOpacity>
                )}

                {/* In-App SMS / Chat + In-App HD Voice Call Buttons */}
                <View style={styles.confirmedActionsRow}>
                  <TouchableOpacity
                    style={styles.inAppChatBtn}
                    onPress={() => setShowChatModal(true)}
                  >
                    <Text style={styles.inAppChatBtnText}>
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

                  <TouchableOpacity
                    style={styles.inAppSosBtn}
                    onPress={() => setShowSafetyModal(true)}
                  >
                    <Text style={styles.inAppSosBtnText}>
                      🛡️ SOS
                    </Text>
                  </TouchableOpacity>
                </View>

                {rideStatus === 'accepted' && (
                  <TouchableOpacity
                    style={styles.cancelActiveBtn}
                    onPress={handleCancelRide}
                  >
                    <Text style={styles.cancelActiveBtnText}>Cancel Ride</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
        </Animated.View>
      </ScrollView>

      {/* In-App SMS & Chat Modal */}
      <RideChatModal
        visible={showChatModal}
        onClose={() => setShowChatModal(false)}
        ride={currentRide}
        currentUser={user}
        onRideUpdated={(updated) => setCurrentRide(updated)}
      />

      {/* In-App Voice Call Modal */}
      <InAppCallModal
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        ride={currentRide}
        currentUser={user}
        onRideUpdated={(updated) => setCurrentRide(updated)}
      />

      {/* Upgraded Google-Style Location Picker Modal */}
      <Modal
        visible={locationModalTarget !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLocationModalTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {locationModalTarget === 'pickup'
                    ? '🟢 Select Pickup Location'
                    : locationModalTarget === 'stop'
                    ? '📸 Select Photo / Market Stop'
                    : '🔴 Select Drop-off Destination'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Google Maps Verified Skardu Landmarks & Routes
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalClosePill}
                onPress={() => setLocationModalTarget(null)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Search Yadgar Chowk, Airport, Shangrila, Shigar..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catFilterScroll}
            >
              {LOCATION_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.catFilterChip,
                      active && styles.catFilterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catFilterText,
                        active && styles.catFilterTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView style={{ maxHeight: 380 }}>
              {filteredLocations.map((loc) => {
                const distFromPickup = calculateRouteEstimate(
                  pickup,
                  loc,
                  selectedVehicle
                );
                return (
                  <TouchableOpacity
                    key={loc.id}
                    style={styles.modalLocationItem}
                    onPress={() => {
                      if (locationModalTarget === 'pickup') {
                        setPickup(loc);
                      } else if (locationModalTarget === 'stop') {
                        setIntermediateStop(loc);
                      } else {
                        setDropoff(loc);
                      }
                      setLocationModalTarget(null);
                    }}
                  >
                    <View style={styles.modalLocIconCircle}>
                      <Text style={styles.modalLocIcon}>
                        {loc.category === 'Tourism'
                          ? '🏔️'
                          : loc.category === 'Transit'
                          ? '✈️'
                          : loc.category === 'Hospital'
                          ? '🏥'
                          : loc.category === 'Education'
                          ? '🎓'
                          : '📍'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalLocName}>{loc.name}</Text>
                      <Text style={styles.modalLocArea}>
                        {loc.area} •{' '}
                        {loc.id === pickup.id
                          ? 'Current Pickup'
                          : `${distFromPickup.distanceKm} km (~${distFromPickup.durationMin} mins)`}
                      </Text>
                    </View>
                    <View style={styles.modalCategoryBadge}>
                      <Text style={styles.modalCategoryText}>
                        {loc.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Skardu 4x4 Tourism Package Modal */}
      <TourPackageModal
        visible={showTourModal}
        onClose={() => setShowTourModal(false)}
        onBookTour={handleBookTourPackage}
      />

      {/* Skardu Ride Safety SOS & Emergency Shield Modal */}
      <SafetySOSModal
        visible={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        ride={currentRide}
        user={user}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#090D16',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(16, 185, 129, 0.35)',
  },
  bottomSheetContent: {
    padding: 16,
    paddingBottom: 38,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 14,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  timelineVisualCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  timelineGreenRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineGreenInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  timelineVerticalLine: {
    width: 2,
    height: 36,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  timelineRedSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.7,
  },
  locationValue: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 1,
  },
  locationAreaSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    fontWeight: '600',
  },
  editLocPill: {
    backgroundColor: '#090D16',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    marginLeft: 6,
  },
  editLocPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 10,
  },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  swapBtnIcon: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '900',
  },
  quickSpotsScroll: {
    marginTop: 12,
    marginBottom: 16,
  },
  spotChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  spotChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  spotChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  spotChipTextActive: {
    color: '#022C22',
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  vehicleScroll: {
    marginBottom: 16,
  },
  vehicleCard: {
    width: 140,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 13,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  vehicleCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10B981',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vehicleEmoji: {
    fontSize: 24,
  },
  etaPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vehicleEta: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
  },
  vehicleName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  vehicleNameActive: {
    color: '#10B981',
  },
  vehicleSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  vehicleEstPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#E2E8F0',
    marginTop: 8,
  },
  vehiclePriceActive: {
    color: '#10B981',
  },
  fareBidCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  fareHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  recommendedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  fareControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fareStepBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fareStepBtnPlus: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  fareStepBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  fareDisplayBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090D16',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
    marginRight: 6,
  },
  fareInputText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    minWidth: 75,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  payPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  payPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  payPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  payPillTextActive: {
    color: '#10B981',
    fontWeight: '900',
  },
  noteInput: {
    marginTop: 10,
    backgroundColor: '#090D16',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#F8FAFC',
  },
  findDriverBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  findDriverBtnText: {
    color: '#022C22',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  biddingContainer: {
    paddingVertical: 4,
  },
  biddingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  biddingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  biddingSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  cancelSearchBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelSearchBtnText: {
    color: '#F87171',
    fontWeight: '800',
    fontSize: 12,
  },
  loadingDriversBox: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 20,
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
  loadingDriversText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  loadingDriversSub: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '700',
  },
  bidsList: {
    gap: 10,
  },
  bidsCountLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  driverBidCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginBottom: 10,
  },
  driverBidTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  driverAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverBidInfo: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  driverVehicleText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  driverMetaText: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '700',
  },
  bidPriceBox: {
    alignItems: 'flex-end',
  },
  bidPriceText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  bidMatchTag: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  bidActionsRow: {
    marginTop: 12,
  },
  acceptBidBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  acceptBidText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#022C22',
  },
  confirmedCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  confirmedStatusBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 14,
  },
  confirmedStatusText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatarLargeImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  driverAvatarLarge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  confirmedDriverName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  confirmedVehicle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  plateBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
  },
  agreedFareLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  agreedFareAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  agreedPaymentType: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '700',
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
  confirmedActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inAppChatBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  inAppChatBtnText: {
    color: '#022C22',
    fontWeight: '900',
    fontSize: 13,
  },
  inAppCallBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  inAppCallBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
  },
  cancelActiveBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelActiveBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    paddingBottom: 30,
    borderTopWidth: 1.5,
    borderTopColor: '#10B981',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  modalClosePill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94A3B8',
  },
  searchInput: {
    backgroundColor: '#090D16',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  catFilterScroll: {
    marginBottom: 12,
  },
  catFilterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  catFilterChipActive: {
    backgroundColor: '#10B981',
  },
  catFilterText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  catFilterTextActive: {
    color: '#022C22',
    fontWeight: '900',
  },
  modalLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  modalLocIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLocIcon: {
    fontSize: 18,
  },
  modalLocName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalLocArea: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCategoryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  topFeatureActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tourPromoBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2F24',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tourPromoTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#34D399',
  },
  tourPromoSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  tourPromoArrow: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '900',
  },
  sosActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  sosPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F87171',
  },
  timelineStopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#F59E0B',
    marginVertical: 4,
  },
  routeExtraActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  addStopBtn: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  addStopBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
  },
  scheduleToggleBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scheduleToggleActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  scheduleToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  scheduleToggleTextActive: {
    color: '#60A5FA',
    fontWeight: '900',
  },
  inAppSosBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  inAppSosBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
