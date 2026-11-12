import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BackendAPI } from '../services/api';
import { VEHICLE_TYPES } from '../data/skarduLocations';
import GoogleOAuthModal from '../components/GoogleOAuthModal';
import { syncUserToFirestore } from '../services/firebase';

export default function AuthScreen({ onLoginSuccess }) {
  // 'role_select' | 'phone_entry' | 'registration_kyc' | 'otp_verify'
  const [step, setStep] = useState('phone_entry');
  const [role, setRole] = useState('passenger'); // 'passenger' | 'driver'

  // Common User Fields (Empty by default — 100% real user input)
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cnicNumber, setCnicNumber] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // Captain / Driver Complete KYC Fields
  const [cnicFrontImage, setCnicFrontImage] = useState('');
  const [cnicBackImage, setCnicBackImage] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseExpiry, setDrivingLicenseExpiry] = useState('');
  const [drivingLicenseImage, setDrivingLicenseImage] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState('car_mini');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleRegistrationImage, setVehicleRegistrationImage] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState('');

  // OTP & Server State
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [serverOtpPreview, setServerOtpPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Google Sign-In Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);

  const formatPakPhone = (raw) => {
    const cleaned = (raw || '').replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+92')) return cleaned;
    if (cleaned.startsWith('92')) return '+' + cleaned;
    return '+92' + cleaned.replace(/^0/, '');
  };

  // Real Camera or Gallery Image Picker (returns Base64 data URI for MongoDB storage)
  const pickImage = async (setter, useCamera = false) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow Camera / Gallery access to upload verification photos.'
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.45,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.45,
            base64: true,
          });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setter(dataUri);
      }
    } catch (err) {
      Alert.alert('Image Error', err.message || 'Could not select image');
    }
  };

  const promptPhotoSource = (title, setter) => {
    Alert.alert(title, 'Choose how to upload your photo:', [
      { text: '📷 Take Photo (Camera)', onPress: () => pickImage(setter, true) },
      { text: '🖼️ Choose from Gallery', onPress: () => pickImage(setter, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Step 1: Send WhatsApp OTP & Check if Phone is Already Registered
  const handleCheckPhoneAndSendOtp = async () => {
    setErrorMsg('');
    const digitsOnly = phone.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 10) {
      setErrorMsg('Please enter a valid 11-digit Pakistani WhatsApp number (e.g. 03455123456)');
      return;
    }

    setLoading(true);
    try {
      const formatted = formatPakPhone(phone);
      const res = await BackendAPI.sendWhatsAppOtp(formatted);
      setIsExistingAccount(Boolean(res.isRegisteredUser));
      if (res.existingRole) {
        setRole(res.existingRole);
      }
      if (res.serverOtpPreview) {
        setServerOtpPreview(res.serverOtpPreview);
      }
      setIsGoogleFlow(false);

      // If already registered, go straight to OTP verification! Otherwise collect KYC & Profile first.
      if (res.isRegisteredUser) {
        setStep('otp_verify');
      } else {
        setStep('registration_kyc');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to SkarduRide MERN server');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate Registration / Captain KYC before OTP Verification (or Google completion)
  const handleProceedFromRegistration = async () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Please enter your Full Name');
      return;
    }
    if (!profilePhoto) {
      setErrorMsg('Please upload your Profile Photo (Camera or Gallery)');
      return;
    }

    if (role === 'driver') {
      if (!cnicNumber.trim() || cnicNumber.trim().length < 13) {
        setErrorMsg('Please enter your valid 13-digit CNIC Number');
        return;
      }
      if (!cnicFrontImage || !cnicBackImage) {
        setErrorMsg('Please upload both CNIC Front and CNIC Back photos');
        return;
      }
      if (!drivingLicenseNumber.trim()) {
        setErrorMsg('Please enter your Driving License Number');
        return;
      }
      if (!drivingLicenseImage) {
        setErrorMsg('Please upload your Driving License photo');
        return;
      }
      if (!vehicleModel.trim() || !vehiclePlate.trim()) {
        setErrorMsg('Please enter your Vehicle Model and Registration Number Plate');
        return;
      }
      if (!vehicleRegistrationImage) {
        setErrorMsg('Please upload your Vehicle Registration Book / Smart Card photo');
        return;
      }
    }

    if (isGoogleFlow) {
      // Complete Google Registration directly on Backend
      setLoading(true);
      try {
        const finalEmail = (googleEmailInput || email).trim().toLowerCase();
        const finalName = (name || googleNameInput).trim();
        const res = await BackendAPI.googleAuth({
          email: finalEmail,
          name: finalName,
          phone: formatPakPhone(phone),
          role,
          profilePhoto,
          cnicNumber: cnicNumber.trim(),
          captainDetails:
            role === 'driver'
              ? {
                  cnicNumber: cnicNumber.trim(),
                  cnicFrontImage,
                  cnicBackImage,
                  drivingLicenseNumber: drivingLicenseNumber.trim(),
                  drivingLicenseExpiry: drivingLicenseExpiry.trim(),
                  drivingLicenseImage,
                  vehicleCategory,
                  vehicleModel: vehicleModel.trim(),
                  vehicleColor: vehicleColor.trim() || 'White',
                  vehiclePlate: vehiclePlate.trim().toUpperCase(),
                  vehicleRegistrationImage,
                  vehiclePhoto,
                }
              : undefined,
        });
        // Sync directly to Google Cloud Firestore
        try {
          await syncUserToFirestore(res.user?._id || res.user?.id || 'usr_' + Date.now(), {
            name: finalName,
            email: finalEmail,
            phone: formatPakPhone(phone),
            role,
            profilePhoto,
            cnicNumber: cnicNumber.trim(),
            authProvider: 'google',
            captainDetails: role === 'driver' ? {
              vehicleCategory,
              vehicleModel: vehicleModel.trim(),
              vehicleColor: vehicleColor.trim() || 'White',
              vehiclePlate: vehiclePlate.trim().toUpperCase(),
              drivingLicenseNumber: drivingLicenseNumber.trim(),
            } : null,
            kycImages: role === 'driver' ? {
              cnicFront: cnicFrontImage,
              cnicBack: cnicBackImage,
              license: drivingLicenseImage,
              registration: vehicleRegistrationImage,
              vehiclePhoto: vehiclePhoto,
            } : null,
          });
        } catch (fsErr) {
          console.warn('Firestore sync warning:', fsErr);
        }

        onLoginSuccess(res.user);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setStep('otp_verify');
    }
  };

  // Step 3: Verify 6-Digit WhatsApp OTP & Save User/Captain to MongoDB
  const handleVerifyOtpAndComplete = async () => {
    setErrorMsg('');
    if (!otpInput || otpInput.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const formatted = formatPakPhone(phone);
      const res = await BackendAPI.verifyWhatsAppOtp({
        phone: formatted,
        code: otpInput.trim(),
        name: name.trim(),
        email: email.trim(),
        role,
        profilePhoto,
        cnicNumber: cnicNumber.trim(),
        captainDetails:
          role === 'driver'
            ? {
                cnicNumber: cnicNumber.trim(),
                cnicFrontImage,
                cnicBackImage,
                drivingLicenseNumber: drivingLicenseNumber.trim(),
                drivingLicenseExpiry: drivingLicenseExpiry.trim(),
                drivingLicenseImage,
                vehicleCategory,
                vehicleModel: vehicleModel.trim(),
                vehicleColor: vehicleColor.trim() || 'White',
                vehiclePlate: vehiclePlate.trim().toUpperCase(),
                vehicleRegistrationImage,
                vehiclePhoto,
              }
            : undefined,
      });
      onLoginSuccess(res.user);
    } catch (err) {
      setErrorMsg(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Real Google Sign-In with OAuth
  const handleGoogleSuccess = async (googleProfile) => {
    setShowGoogleModal(false);
    setLoading(true);
    setErrorMsg('');
    try {
      setGoogleEmailInput(googleProfile.email);
      setGoogleNameInput(googleProfile.name);
      if (googleProfile.picture && !profilePhoto) {
        setProfilePhoto(googleProfile.picture);
      }

      const res = await BackendAPI.googleAuth({
        email: googleProfile.email.trim().toLowerCase(),
        name: googleProfile.name,
        googleId: googleProfile.googleId,
      });

      if (res.token && res.user) {
        // Sync directly to Google Cloud Firestore
        try {
          await syncUserToFirestore(res.user?._id || res.user?.id || 'usr_' + Date.now(), {
            name: res.user.name || googleProfile.name,
            email: googleProfile.email,
            phone: res.user.phone || '',
            role: res.user.role || 'passenger',
            profilePhoto: res.user.profilePhoto || googleProfile.picture || '',
            authProvider: 'google',
            googleId: googleProfile.googleId,
          });
        } catch (fsErr) {
          console.warn('Firestore sync warning:', fsErr);
        }

        onLoginSuccess(res.user);
      } else if (res.needsRegistration) {
        setIsGoogleFlow(true);
        setEmail(googleProfile.email.trim().toLowerCase());
        if (googleProfile.name) setName(googleProfile.name);
        setStep('registration_kyc');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Live Server OTP Notification Banner (when WhatsApp Cloud API token is not set in .env) */}
      {serverOtpPreview && step === 'otp_verify' && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setOtpInput(String(serverOtpPreview))}
          style={styles.whatsappPushBanner}
        >
          <View style={styles.waIconBadge}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.waSenderTitle}>
              LIVE SERVER OTP • {formatPakPhone(phone)}
            </Text>
            <Text style={styles.waMessageBody}>
              Your 6-digit SkarduRide OTP is{' '}
              <Text style={styles.waOtpHighlight}>{serverOtpPreview}</Text>. Tap to fill.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Brand Header */}
      <View style={styles.heroSection}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>🏔️</Text>
        </View>
        <Text style={styles.appTitle}>SkarduRide</Text>
        <Text style={styles.appSubtitle}>
          Real MERN Stack Ride-Hailing & 4x4 Network
        </Text>
      </View>

      <View style={styles.authCard}>
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
          </View>
        ) : null}

        {/* ================================================================
            STEP 1: PHONE ENTRY & ACCOUNT TYPE SELECTION
           ================================================================ */}
        {step === 'phone_entry' && (
          <>
            <Text style={styles.sectionLabel}>SELECT YOUR ACCOUNT TYPE</Text>
            <View style={styles.roleSelectorRow}>
              <TouchableOpacity
                onPress={() => setRole('passenger')}
                style={[
                  styles.roleOption,
                  role === 'passenger' && styles.roleOptionActive,
                ]}
              >
                <Text style={styles.roleEmoji}>🧍🏽‍♂️</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'passenger' && styles.roleTitleActive,
                    ]}
                  >
                    Passenger
                  </Text>
                  <Text style={styles.roleDesc}>Book city & 4x4 rides</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRole('driver')}
                style={[
                  styles.roleOption,
                  role === 'driver' && styles.roleOptionActive,
                ]}
              >
                <Text style={styles.roleEmoji}>🚖</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'driver' && styles.roleTitleActive,
                    ]}
                  >
                    Captain (Driver)
                  </Text>
                  <Text style={styles.roleDesc}>Accept rides & earn</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>WHATSAPP PHONE NUMBER</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>🇵🇰 +92</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="345 1234567"
                placeholderTextColor="#64748B"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleCheckPhoneAndSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#022C22" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Continue with WhatsApp OTP →
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.orDividerRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => setShowGoogleModal(true)}
            >
              <View style={styles.googleGIcon}>
                <Text style={styles.googleGText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ================================================================
            STEP 2: REAL PROFILE & CAPTAIN KYC DOCUMENT UPLOAD
           ================================================================ */}
        {step === 'registration_kyc' && (
          <>
            <View style={styles.stepHeaderRow}>
              <TouchableOpacity onPress={() => setStep('phone_entry')}>
                <Text style={styles.backLinkText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.stepHeaderBadge}>
                {role === 'driver' ? '🚖 CAPTAIN KYC REGISTRATION' : '🧍 PASSENGER REGISTRATION'}
              </Text>
            </View>

            {/* Profile Photo Upload (Required for both Passenger and Captain) */}
            <View style={styles.avatarUploadSection}>
              <TouchableOpacity
                style={styles.avatarCircleBtn}
                onPress={() =>
                  promptPhotoSource('Upload Profile Photo', setProfilePhoto)
                }
              >
                {profilePhoto ? (
                  <Image
                    source={{ uri: profilePhoto }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                    <Text style={styles.avatarUploadText}>Upload Photo *</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarHint}>
                Tap to take a selfie or choose from gallery (Required)
              </Text>
            </View>

            <Text style={styles.sectionLabel}>FULL NAME (AS ON CNIC) *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#64748B"
            />

            {isGoogleFlow && (
              <>
                <Text style={styles.sectionLabel}>WHATSAPP PHONE NUMBER *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="0345 1234567"
                  placeholderTextColor="#64748B"
                />
              </>
            )}

            <Text style={styles.sectionLabel}>
              CNIC NUMBER {role === 'driver' ? '*' : '(OPTIONAL)'}
            </Text>
            <TextInput
              style={styles.input}
              value={cnicNumber}
              onChangeText={setCnicNumber}
              keyboardType="number-pad"
              placeholder="71101-1234567-1"
              placeholderTextColor="#64748B"
            />

            {/* CAPTAIN / DRIVER MANDATORY KYC DOCUMENTS & VEHICLE INFO */}
            {role === 'driver' && (
              <View style={styles.kycSectionBox}>
                <Text style={styles.kycSectionTitle}>
                  🪪 1. Captain Identity & Driving License Documents
                </Text>

                {/* CNIC Front & Back Photo Upload Grid */}
                <View style={styles.docGridRow}>
                  <TouchableOpacity
                    style={styles.docUploadCard}
                    onPress={() =>
                      promptPhotoSource('CNIC Front Photo', setCnicFrontImage)
                    }
                  >
                    {cnicFrontImage ? (
                      <Image
                        source={{ uri: cnicFrontImage }}
                        style={styles.docPreviewImg}
                      />
                    ) : (
                      <>
                        <Text style={styles.docUploadEmoji}>🪪</Text>
                        <Text style={styles.docUploadLabel}>CNIC Front *</Text>
                        <Text style={styles.docUploadSub}>Tap to upload</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docUploadCard}
                    onPress={() =>
                      promptPhotoSource('CNIC Back Photo', setCnicBackImage)
                    }
                  >
                    {cnicBackImage ? (
                      <Image
                        source={{ uri: cnicBackImage }}
                        style={styles.docPreviewImg}
                      />
                    ) : (
                      <>
                        <Text style={styles.docUploadEmoji}>🪪</Text>
                        <Text style={styles.docUploadLabel}>CNIC Back *</Text>
                        <Text style={styles.docUploadSub}>Tap to upload</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>DRIVING LICENSE NUMBER *</Text>
                <TextInput
                  style={styles.input}
                  value={drivingLicenseNumber}
                  onChangeText={setDrivingLicenseNumber}
                  placeholder="e.g. GB-SKD-DL-99281"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.sectionLabel}>DRIVING LICENSE EXPIRY DATE</Text>
                <TextInput
                  style={styles.input}
                  value={drivingLicenseExpiry}
                  onChangeText={setDrivingLicenseExpiry}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#64748B"
                />

                <TouchableOpacity
                  style={[styles.docUploadCard, { width: '100%', marginBottom: 16 }]}
                  onPress={() =>
                    promptPhotoSource('Driving License Photo', setDrivingLicenseImage)
                  }
                >
                  {drivingLicenseImage ? (
                    <Image
                      source={{ uri: drivingLicenseImage }}
                      style={styles.docPreviewImgWide}
                    />
                  ) : (
                    <>
                      <Text style={styles.docUploadEmoji}>📄</Text>
                      <Text style={styles.docUploadLabel}>
                        Upload Driving License Photo *
                      </Text>
                      <Text style={styles.docUploadSub}>
                        Clear photo of your valid Gilgit-Baltistan / Pakistan Driving License
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.kycSectionTitle}>
                  🛻 2. Vehicle Registration & Category
                </Text>

                <Text style={styles.sectionLabel}>SELECT VEHICLE CATEGORY *</Text>
                <View style={styles.vehCatGrid}>
                  {VEHICLE_TYPES.map((vt) => {
                    const active = vehicleCategory === vt.id;
                    return (
                      <TouchableOpacity
                        key={vt.id}
                        onPress={() => setVehicleCategory(vt.id)}
                        style={[
                          styles.vehCatChip,
                          active && styles.vehCatChipActive,
                        ]}
                      >
                        <Text style={{ fontSize: 18 }}>{vt.icon}</Text>
                        <Text
                          style={[
                            styles.vehCatChipText,
                            active && { color: '#10B981', fontWeight: '900' },
                          ]}
                        >
                          {vt.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>VEHICLE MAKE & MODEL *</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="e.g. Toyota Corolla XLi / Prado TZ / Suzuki Alto"
                  placeholderTextColor="#64748B"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>VEHICLE COLOR *</Text>
                    <TextInput
                      style={styles.input}
                      value={vehicleColor}
                      onChangeText={setVehicleColor}
                      placeholder="e.g. White / Silver"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>NUMBER PLATE *</Text>
                    <TextInput
                      style={styles.input}
                      value={vehiclePlate}
                      onChangeText={setVehiclePlate}
                      autoCapitalize="characters"
                      placeholder="GB-SKD-1234"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.docGridRow}>
                  <TouchableOpacity
                    style={styles.docUploadCard}
                    onPress={() =>
                      promptPhotoSource(
                        'Vehicle Registration Book / Card',
                        setVehicleRegistrationImage
                      )
                    }
                  >
                    {vehicleRegistrationImage ? (
                      <Image
                        source={{ uri: vehicleRegistrationImage }}
                        style={styles.docPreviewImg}
                      />
                    ) : (
                      <>
                        <Text style={styles.docUploadEmoji}>📋</Text>
                        <Text style={styles.docUploadLabel}>
                          Registration Card *
                        </Text>
                        <Text style={styles.docUploadSub}>Running Paper / Card</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docUploadCard}
                    onPress={() =>
                      promptPhotoSource('Vehicle Exterior Photo', setVehiclePhoto)
                    }
                  >
                    {vehiclePhoto ? (
                      <Image
                        source={{ uri: vehiclePhoto }}
                        style={styles.docPreviewImg}
                      />
                    ) : (
                      <>
                        <Text style={styles.docUploadEmoji}>🚘</Text>
                        <Text style={styles.docUploadLabel}>Vehicle Photo</Text>
                        <Text style={styles.docUploadSub}>With number plate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleProceedFromRegistration}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#022C22" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isGoogleFlow
                    ? 'Complete Registration & Sign In →'
                    : 'Proceed to OTP Verification →'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ================================================================
            STEP 3: 6-DIGIT WHATSAPP OTP VERIFICATION
           ================================================================ */}
        {step === 'otp_verify' && (
          <View style={styles.otpVerifyBox}>
            <Text style={styles.otpVerifyTitle}>
              Enter 6-Digit WhatsApp OTP
            </Text>
            <Text style={styles.otpVerifySub}>
              Sent to {formatPakPhone(phone)} ({isExistingAccount ? 'Existing Account Login' : `New ${role === 'driver' ? 'Captain' : 'Passenger'} Registration`})
            </Text>

            <TextInput
              style={styles.otpCodeInput}
              value={otpInput}
              onChangeText={setOtpInput}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="• • • • • •"
              placeholderTextColor="#475569"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { width: '100%' }]}
              onPress={handleVerifyOtpAndComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#022C22" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  ✅ Verify & Open {role === 'driver' ? 'Captain App' : 'Passenger App'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep('phone_entry')}
              style={{ marginTop: 14 }}
            >
              <Text style={styles.backLinkText}>← Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Real Google OAuth Modal via Firebase */}
      <GoogleOAuthModal
        visible={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        onSuccess={handleGoogleSuccess}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 44,
  },
  whatsappPushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  waIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waSenderTitle: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '900',
  },
  waMessageBody: {
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  waOtpHighlight: {
    color: '#FDE047',
    fontWeight: '900',
    fontSize: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 10,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 30,
  },
  appTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
  },
  appSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  authCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    gap: 8,
  },
  roleOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10B981',
  },
  roleEmoji: {
    fontSize: 22,
  },
  roleTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  roleTitleActive: {
    color: '#10B981',
  },
  roleDesc: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  countryCodeBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  countryCodeText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#022C22',
    fontSize: 14,
    fontWeight: '900',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293B',
  },
  orText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  googleBtn: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleGIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  googleBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backLinkText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  stepHeaderBadge: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
  },
  avatarUploadSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircleBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#10B981',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
  },
  avatarUploadText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  avatarHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
  },
  kycSectionBox: {
    backgroundColor: '#090D16',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  kycSectionTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  docGridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  docUploadCard: {
    flex: 1,
    height: 105,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  docPreviewImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  docPreviewImgWide: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  docUploadEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  docUploadLabel: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  docUploadSub: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  vehCatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  vehCatChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vehCatChipActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  vehCatChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  otpVerifyBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  otpVerifyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
  },
  otpVerifySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
  },
  otpCodeInput: {
    backgroundColor: '#1E293B',
    color: '#10B981',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginBottom: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  googleModalCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  googleModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  googleGIconLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  googleGLargeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  googleModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  googleModalSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  googleCancelBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  googleCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
});
