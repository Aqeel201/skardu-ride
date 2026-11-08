const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const User = require('./models/User');
const Ride = require('./models/Ride');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'skardu_ride_mern_secret_2026';

// Increase payload limit to 25MB to support real Base64 photo uploads (Profile pic, CNIC Front/Back, Driving License, Vehicle Photo)
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

let isMongoConnected = false;
const LOCAL_STORE_PATH = path.join(__dirname, 'mongodb_collections.json');

// Connect to MongoDB Atlas / Local MongoDB if MONGO_URI is provided
async function initDatabase() {
  const uri = (process.env.MONGO_URI || '').trim();
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB Database via Mongoose');
    } catch (err) {
      console.warn('⚠️ MongoDB connection failed, using local persistent collection store:', err.message);
    }
  } else {
    console.log('ℹ️ MONGO_URI not set in backend/.env — using persistent local MongoDB collection engine (backend/mongodb_collections.json)');
  }
}

function readStore() {
  try {
    if (!fs.existsSync(LOCAL_STORE_PATH)) {
      const emptyStore = { users: [], rides: [], otps: {} };
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(emptyStore, null, 2));
      return emptyStore;
    }
    return JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));
  } catch {
    return { users: [], rides: [], otps: {} };
  }
}

function writeStore(store) {
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}

function generateObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

function signToken(user) {
  return jwt.sign(
    { id: user._id || user.id, role: user.role, phone: user.phone },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication token required' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// ============================================================================
// 1. HEALTH & SYSTEM STATUS
// ============================================================================
app.get('/api/health', async (req, res) => {
  if (isMongoConnected) {
    const usersCount = await User.countDocuments();
    const ridesCount = await Ride.countDocuments();
    return res.json({
      status: 'online',
      stack: 'MERN (MongoDB Connected)',
      mongoConnected: true,
      usersCount,
      ridesCount,
    });
  }
  const store = readStore();
  return res.json({
    status: 'online',
    stack: 'MERN (Express + Mongoose Schema Engine)',
    mongoConnected: false,
    usersCount: store.users.length,
    ridesCount: store.rides.length,
  });
});

// ============================================================================
// 2. WHATSAPP OTP DISPATCH & VERIFICATION
// ============================================================================
app.post('/api/auth/whatsapp/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = (phone || '').replace(/\s+/g, '').trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Valid Pakistani WhatsApp phone number is required' });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit real OTP
    const store = readStore();
    store.otps[cleanPhone] = {
      code: otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    writeStore(store);

    // Check if Meta WhatsApp Cloud API credentials are configured in .env
    let whatsappApiSent = false;
    if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
      try {
        const waRes = await fetch(
          `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone.replace(/^\+/, ''),
              type: 'text',
              text: {
                body: `SkarduRide Verification Code: ${otpCode}. Do not share this code with anyone.`,
              },
            }),
          }
        );
        whatsappApiSent = waRes.ok;
      } catch (e) {
        console.error('WhatsApp Cloud API error:', e.message);
      }
    }

    // Check if user already exists in DB so frontend knows whether to show Login or Full Registration
    let existingUser = null;
    if (isMongoConnected) {
      existingUser = await User.findOne({ phone: cleanPhone }).lean();
    } else {
      existingUser = store.users.find((u) => u.phone === cleanPhone) || null;
    }

    console.log(`📲 [WhatsApp OTP] ${cleanPhone} -> Code: ${otpCode}`);
    return res.json({
      success: true,
      phone: cleanPhone,
      isRegisteredUser: Boolean(existingUser),
      existingRole: existingUser ? existingUser.role : null,
      whatsappApiSent,
      serverOtpPreview: whatsappApiSent ? undefined : otpCode,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/whatsapp/verify-otp', async (req, res) => {
  try {
    const {
      phone,
      code,
      name,
      email,
      role,
      profilePhoto,
      cnicNumber,
      emergencyContact,
      captainDetails,
    } = req.body;

    const cleanPhone = (phone || '').replace(/\s+/g, '').trim();
    const store = readStore();
    const otpRecord = store.otps[cleanPhone];

    if (!otpRecord || otpRecord.code !== String(code || '').trim()) {
      return res.status(400).json({ error: 'Invalid or expired 6-digit OTP code' });
    }
    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
    }

    let user = null;
    if (isMongoConnected) {
      user = await User.findOne({ phone: cleanPhone });
    } else {
      user = store.users.find((u) => u.phone === cleanPhone);
    }

    // If user is registering for the first time, validate required KYC fields
    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Full Name is required for registration' });
      }
      if (!role || !['passenger', 'driver'].includes(role)) {
        return res.status(400).json({ error: 'Account role (passenger or driver) is required' });
      }
      if (!profilePhoto) {
        return res.status(400).json({ error: 'Profile photo is required' });
      }

      if (role === 'driver') {
        if (!captainDetails?.cnicNumber || !captainDetails?.drivingLicenseNumber) {
          return res.status(400).json({
            error: 'Captain CNIC Number and Driving License Number are required',
          });
        }
        if (!captainDetails?.cnicFrontImage || !captainDetails?.drivingLicenseImage) {
          return res.status(400).json({
            error: 'Captain CNIC Photo and Driving License Photo are required',
          });
        }
        if (!captainDetails?.vehicleModel || !captainDetails?.vehiclePlate) {
          return res.status(400).json({
            error: 'Vehicle Model and Skardu Registration Plate are required',
          });
        }
      }

      const newUserDoc = {
        _id: generateObjectId(),
        name: name.trim(),
        phone: cleanPhone,
        email: (email || '').trim().toLowerCase(),
        role,
        authProvider: 'whatsapp',
        profilePhoto: profilePhoto || '',
        cnicNumber: cnicNumber || captainDetails?.cnicNumber || '',
        emergencyContact: emergencyContact || '',
        rating: 5.0,
        totalTrips: 0,
        walletBalance: 0,
        todayEarnings: 0,
        captainDetails:
          role === 'driver'
            ? {
                kycStatus: 'verified',
                cnicNumber: captainDetails.cnicNumber,
                cnicFrontImage: captainDetails.cnicFrontImage || '',
                cnicBackImage: captainDetails.cnicBackImage || '',
                drivingLicenseNumber: captainDetails.drivingLicenseNumber,
                drivingLicenseExpiry: captainDetails.drivingLicenseExpiry || '',
                drivingLicenseImage: captainDetails.drivingLicenseImage || '',
                vehicleCategory: captainDetails.vehicleCategory || 'car_mini',
                vehicleModel: captainDetails.vehicleModel,
                vehicleColor: captainDetails.vehicleColor || 'White',
                vehiclePlate: captainDetails.vehiclePlate.toUpperCase(),
                vehicleRegistrationImage:
                  captainDetails.vehicleRegistrationImage || '',
                vehiclePhoto: captainDetails.vehiclePhoto || '',
                isOnline: true,
                currentLocation: { lat: 35.2971, lng: 75.6333 },
              }
            : {},
        createdAt: new Date().toISOString(),
      };

      if (isMongoConnected) {
        user = await User.create(newUserDoc);
      } else {
        store.users.push(newUserDoc);
        user = newUserDoc;
      }
    }

    delete store.otps[cleanPhone];
    writeStore(store);

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. GOOGLE AUTHENTICATION + COMPLETE PROFILE / KYC REGISTRATION
// ============================================================================
app.post('/api/auth/google', async (req, res) => {
  try {
    const {
      email,
      name,
      googleId,
      phone,
      role,
      profilePhoto,
      cnicNumber,
      captainDetails,
    } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid Google email address is required' });
    }

    const store = readStore();
    let user = null;
    if (isMongoConnected) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = store.users.find((u) => u.email === cleanEmail);
    }

    // If user doesn't exist yet and hasn't submitted registration details, tell frontend to collect KYC/Profile
    if (!user && !phone) {
      return res.json({
        needsRegistration: true,
        email: cleanEmail,
        name: name || '',
        googleId: googleId || '',
      });
    }

    if (!user) {
      if (!name || !phone || !role || !profilePhoto) {
        return res.status(400).json({
          error: 'Name, Phone Number, Role, and Profile Photo are required to complete Google Registration',
        });
      }
      if (role === 'driver') {
        if (
          !captainDetails?.cnicNumber ||
          !captainDetails?.drivingLicenseNumber ||
          !captainDetails?.cnicFrontImage ||
          !captainDetails?.drivingLicenseImage ||
          !captainDetails?.vehicleModel ||
          !captainDetails?.vehiclePlate
        ) {
          return res.status(400).json({
            error: 'All Captain KYC Documents (CNIC, Driving License, Vehicle Details & Photos) are required',
          });
        }
      }

      const newUserDoc = {
        _id: generateObjectId(),
        name: name.trim(),
        phone: phone.replace(/\s+/g, '').trim(),
        email: cleanEmail,
        googleId: googleId || 'gid_' + Date.now(),
        role,
        authProvider: 'google',
        profilePhoto,
        cnicNumber: cnicNumber || captainDetails?.cnicNumber || '',
        rating: 5.0,
        totalTrips: 0,
        walletBalance: 0,
        todayEarnings: 0,
        captainDetails:
          role === 'driver'
            ? {
                kycStatus: 'verified',
                cnicNumber: captainDetails.cnicNumber,
                cnicFrontImage: captainDetails.cnicFrontImage || '',
                cnicBackImage: captainDetails.cnicBackImage || '',
                drivingLicenseNumber: captainDetails.drivingLicenseNumber,
                drivingLicenseExpiry: captainDetails.drivingLicenseExpiry || '',
                drivingLicenseImage: captainDetails.drivingLicenseImage || '',
                vehicleCategory: captainDetails.vehicleCategory || 'car_mini',
                vehicleModel: captainDetails.vehicleModel,
                vehicleColor: captainDetails.vehicleColor || 'White',
                vehiclePlate: captainDetails.vehiclePlate.toUpperCase(),
                vehicleRegistrationImage:
                  captainDetails.vehicleRegistrationImage || '',
                vehiclePhoto: captainDetails.vehiclePhoto || '',
                isOnline: true,
                currentLocation: { lat: 35.2971, lng: 75.6333 },
              }
            : {},
        createdAt: new Date().toISOString(),
      };

      if (isMongoConnected) {
        user = await User.create(newUserDoc);
      } else {
        store.users.push(newUserDoc);
        writeStore(store);
        user = newUserDoc;
      }
    }

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Current Logged-in User Profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    let user = null;
    if (isMongoConnected) {
      user = await User.findById(req.auth.id).lean();
    } else {
      const store = readStore();
      user = store.users.find((u) => (u._id || u.id) === req.auth.id);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. REAL RIDE CREATION, BIDDING & LIFECYCLE (STRICT ROLE SEPARATION)
// ============================================================================

// Get rides (Captains see 'searching' rides or rides assigned to them; Passengers see their own rides)
app.get('/api/rides', authMiddleware, async (req, res) => {
  try {
    const { role, id } = req.auth;
    let rides = [];
    if (isMongoConnected) {
      if (role === 'driver') {
        rides = await Ride.find({
          $or: [{ status: 'searching' }, { 'acceptedDriver.driverId': id }],
        })
          .sort({ createdAt: -1 })
          .lean();
      } else {
        rides = await Ride.find({ passengerId: id }).sort({ createdAt: -1 }).lean();
      }
    } else {
      const store = readStore();
      if (role === 'driver') {
        rides = store.rides.filter(
          (r) => r.status === 'searching' || r.acceptedDriver?.driverId === id
        );
      } else {
        rides = store.rides.filter((r) => r.passengerId === id);
      }
    }
    return res.json({ rides });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create Ride Request — ONLY PASSENGERS CAN CREATE RIDES
app.post('/api/rides', authMiddleware, async (req, res) => {
  try {
    if (req.auth.role !== 'passenger') {
      return res.status(403).json({
        error: 'Captains/Drivers are not allowed to book passenger rides.',
      });
    }

    const store = readStore();
    const passenger = isMongoConnected
      ? await User.findById(req.auth.id).lean()
      : store.users.find((u) => (u._id || u.id) === req.auth.id);

    if (!passenger) {
      return res.status(404).json({ error: 'Passenger account not found' });
    }

    const {
      pickup,
      dropoff,
      vehicleCategory,
      vehicleCategoryName,
      offeredFare,
      distanceKm,
      durationMin,
      paymentMethod,
      notes,
    } = req.body;

    if (!pickup || !dropoff || !offeredFare) {
      return res.status(400).json({ error: 'Pickup, Dropoff and Offered Fare are required' });
    }

    const rideDoc = {
      _id: generateObjectId(),
      passengerId: String(passenger._id || passenger.id),
      passengerName: passenger.name,
      passengerPhone: passenger.phone,
      passengerProfilePhoto: passenger.profilePhoto || '',
      passengerRating: passenger.rating || 5.0,
      pickup,
      dropoff,
      vehicleCategory: vehicleCategory || 'car_mini',
      vehicleCategoryName: vehicleCategoryName || 'Economy Car',
      offeredFare: Number(offeredFare),
      agreedFare: null,
      distanceKm: Number(distanceKm) || 1.5,
      durationMin: Number(durationMin) || 5,
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      status: 'searching',
      bids: [], // ZERO fake bids! Only real bids from registered Captains
      messages: [], // Real-time in-app chat messages after ride is accepted
      acceptedDriver: null,
      commissionDeducted: 0,
      createdAt: new Date().toISOString(),
    };

    let savedRide = null;
    if (isMongoConnected) {
      savedRide = await Ride.create(rideDoc);
    } else {
      store.rides.unshift(rideDoc);
      writeStore(store);
      savedRide = rideDoc;
    }

    return res.status(201).json({ ride: savedRide });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Captain Submits a Bid or Accepts Passenger's Fare — ONLY DRIVERS CAN BID
app.post('/api/rides/:rideId/bid', authMiddleware, async (req, res) => {
  try {
    if (req.auth.role !== 'driver') {
      return res.status(403).json({
        error: 'Only registered Captains can send ride bids.',
      });
    }

    const { rideId } = req.params;
    const { bidPrice, etaMinutes } = req.body;

    const store = readStore();
    const captain = isMongoConnected
      ? await User.findById(req.auth.id).lean()
      : store.users.find((u) => (u._id || u.id) === req.auth.id);

    if (!captain) {
      return res.status(404).json({ error: 'Captain profile not found' });
    }

    const bidObj = {
      _id: generateObjectId(),
      driverId: String(captain._id || captain.id),
      driverName: captain.name,
      driverPhone: captain.phone,
      driverProfilePhoto: captain.profilePhoto || '',
      driverRating: captain.rating || 5.0,
      driverTrips: captain.totalTrips || 0,
      vehicleCategory: captain.captainDetails?.vehicleCategory || 'car_mini',
      vehicleModel: captain.captainDetails?.vehicleModel || 'Vehicle',
      vehicleColor: captain.captainDetails?.vehicleColor || 'White',
      vehiclePlate: captain.captainDetails?.vehiclePlate || 'GB-SKD',
      bidPrice: Number(bidPrice),
      etaMinutes: Number(etaMinutes) || 4,
      createdAt: new Date().toISOString(),
    };

    if (isMongoConnected) {
      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      bidObj.isExactMatch = Number(bidPrice) <= Number(ride.offeredFare);
      ride.bids = ride.bids.filter((b) => b.driverId !== bidObj.driverId);
      ride.bids.unshift(bidObj);
      await ride.save();
      return res.json({ ride });
    } else {
      const ride = store.rides.find((r) => (r._id || r.id) === rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      bidObj.isExactMatch = Number(bidPrice) <= Number(ride.offeredFare);
      ride.bids = (ride.bids || []).filter((b) => b.driverId !== bidObj.driverId);
      ride.bids.unshift(bidObj);
      writeStore(store);
      return res.json({ ride });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Passenger Accepts a Captain's Bid — ONLY PASSENGERS CAN ACCEPT BIDS
app.post('/api/rides/:rideId/accept-bid', authMiddleware, async (req, res) => {
  try {
    if (req.auth.role !== 'passenger') {
      return res.status(403).json({ error: 'Only the passenger can accept a bid' });
    }

    const { rideId } = req.params;
    const { bidId } = req.body;

    if (isMongoConnected) {
      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      const chosenBid = ride.bids.find((b) => String(b._id) === String(bidId));
      if (!chosenBid) return res.status(404).json({ error: 'Bid not found' });

      ride.status = 'accepted';
      ride.agreedFare = chosenBid.bidPrice;
      ride.acceptedDriver = {
        driverId: chosenBid.driverId,
        driverName: chosenBid.driverName,
        driverPhone: chosenBid.driverPhone,
        driverProfilePhoto: chosenBid.driverProfilePhoto,
        driverRating: chosenBid.driverRating,
        vehicleModel: chosenBid.vehicleModel,
        vehicleColor: chosenBid.vehicleColor,
        vehiclePlate: chosenBid.vehiclePlate,
      };
      if (!ride.messages) ride.messages = [];
      ride.messages.push({
        _id: generateObjectId(),
        senderId: chosenBid.driverId,
        senderRole: 'driver',
        senderName: chosenBid.driverName,
        text: `Salam! Mene aapki ride Rs. ${chosenBid.bidPrice} mein accept kar li hai. Main pickup point ki तरफ aa raha hun.`,
        createdAt: new Date().toISOString(),
      });
      await ride.save();
      return res.json({ ride });
    } else {
      const store = readStore();
      const ride = store.rides.find((r) => (r._id || r.id) === rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      const chosenBid = (ride.bids || []).find(
        (b) => String(b._id || b.id) === String(bidId)
      );
      if (!chosenBid) return res.status(404).json({ error: 'Bid not found' });

      ride.status = 'accepted';
      ride.agreedFare = chosenBid.bidPrice;
      ride.acceptedDriver = {
        driverId: chosenBid.driverId,
        driverName: chosenBid.driverName,
        driverPhone: chosenBid.driverPhone,
        driverProfilePhoto: chosenBid.driverProfilePhoto,
        driverRating: chosenBid.driverRating,
        vehicleModel: chosenBid.vehicleModel,
        vehicleColor: chosenBid.vehicleColor,
        vehiclePlate: chosenBid.vehiclePlate,
      };
      if (!ride.messages) ride.messages = [];
      ride.messages.push({
        _id: generateObjectId(),
        senderId: chosenBid.driverId,
        senderRole: 'driver',
        senderName: chosenBid.driverName,
        text: `Salam! Mene aapki ride Rs. ${chosenBid.bidPrice} mein accept kar li hai. Main pickup point ki taraf aa raha hun.`,
        createdAt: new Date().toISOString(),
      });
      writeStore(store);
      return res.json({ ride });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Send In-App Chat / SMS / Voice Note Message between Passenger and Captain on an Active Ride
app.post('/api/rides/:rideId/messages', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { text, type, audioData, durationSec } = req.body;
    const isAudio = type === 'audio' && Boolean(audioData);

    if (!isAudio && (!text || !text.trim())) {
      return res.status(400).json({ error: 'Message text or voice note is required' });
    }

    const store = readStore();
    const sender = isMongoConnected
      ? await User.findById(req.auth.id).lean()
      : store.users.find((u) => String(u._id || u.id) === String(req.auth.id));

    const msgObj = {
      _id: generateObjectId(),
      senderId: String(req.auth.id),
      senderRole: req.auth.role,
      senderName: sender?.name || (req.auth.role === 'driver' ? 'Captain' : 'Passenger'),
      type: isAudio ? 'audio' : 'text',
      text: isAudio
        ? text?.trim() || `🎤 Voice Note (${durationSec || 1}s)`
        : text.trim(),
      audioData: isAudio ? audioData : '',
      durationSec: isAudio ? Number(durationSec) || 1 : 0,
      createdAt: new Date().toISOString(),
    };

    if (isMongoConnected) {
      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      if (!ride.messages) ride.messages = [];
      ride.messages.push(msgObj);
      await ride.save();
      return res.json({ ride, message: msgObj });
    } else {
      const ride = store.rides.find((r) => String(r._id || r.id) === String(rideId));
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      if (!ride.messages) ride.messages = [];
      ride.messages.push(msgObj);
      writeStore(store);
      return res.json({ ride, message: msgObj });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Real-Time In-Memory Audio Relay Buffer for Live Two-Way In-App Voice Calls
const liveCallAudioRooms = new Map(); // rideId -> { seq: number, chunks: Array<{ seq, senderId, senderRole, audioData, createdAt }> }

// Real-Time In-App Voice Call Signaling (ringing | connected | ended)
app.post('/api/rides/:rideId/call', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { action } = req.body; // 'start' | 'answer' | 'end'

    if (action === 'start' || action === 'end') {
      liveCallAudioRooms.delete(String(rideId));
    }

    const store = readStore();
    const caller = isMongoConnected
      ? await User.findById(req.auth.id).lean()
      : store.users.find((u) => String(u._id || u.id) === String(req.auth.id));

    const callState =
      action === 'start'
        ? {
            callerId: String(req.auth.id),
            callerName:
              caller?.name || (req.auth.role === 'driver' ? 'Captain' : 'Passenger'),
            callerRole: req.auth.role,
            status: 'ringing',
            updatedAt: new Date().toISOString(),
          }
        : action === 'answer'
        ? {
            callerId: String(req.auth.id),
            callerName:
              caller?.name || (req.auth.role === 'driver' ? 'Captain' : 'Passenger'),
            callerRole: req.auth.role,
            status: 'connected',
            updatedAt: new Date().toISOString(),
          }
        : {
            callerId: '',
            callerName: '',
            callerRole: '',
            status: 'ended',
            updatedAt: new Date().toISOString(),
          };

    if (isMongoConnected) {
      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      ride.activeCall = callState;
      await ride.save();
      return res.json({ ride });
    } else {
      const ride = store.rides.find(
        (r) => String(r._id || r.id) === String(rideId)
      );
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      ride.activeCall = callState;
      writeStore(store);
      return res.json({ ride });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Push Live Voice Audio Chunk during an Active In-App Call
app.post('/api/rides/:rideId/call-audio', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { audioData } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'audioData is required' });
    }

    const key = String(rideId);
    if (!liveCallAudioRooms.has(key)) {
      liveCallAudioRooms.set(key, { seq: 0, chunks: [] });
    }
    const room = liveCallAudioRooms.get(key);
    room.seq += 1;
    room.chunks.push({
      seq: room.seq,
      senderId: String(req.auth.id),
      senderRole: req.auth.role,
      audioData,
      createdAt: Date.now(),
    });

    // Keep only the latest 20 chunks per active call
    if (room.chunks.length > 20) {
      room.chunks = room.chunks.slice(-20);
    }

    return res.json({ success: true, seq: room.seq });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Poll Incoming Live Voice Audio Chunks from the Other Party during an Active Call
app.get('/api/rides/:rideId/call-audio', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.params;
    const sinceSeq = Number(req.query.since || 0);
    const key = String(rideId);
    const room = liveCallAudioRooms.get(key);
    if (!room) {
      return res.json({ chunks: [], latestSeq: 0 });
    }

    const myId = String(req.auth.id);
    const incoming = room.chunks.filter(
      (c) => c.seq > sinceSeq && String(c.senderId) !== myId
    );
    return res.json({
      chunks: incoming,
      latestSeq: room.seq,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Ride Status (arrived, in_progress, completed, cancelled)
app.post('/api/rides/:rideId/status', authMiddleware, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    const store = readStore();
    let ride = isMongoConnected
      ? await Ride.findById(rideId)
      : store.rides.find((r) => (r._id || r.id) === rideId);

    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    ride.status = status;

    // When completed, update Captain's earnings & deduct 8% commission
    if (status === 'completed' && ride.acceptedDriver?.driverId) {
      const fare = Number(ride.agreedFare || ride.offeredFare);
      const commission = Math.round(fare * 0.08);
      ride.commissionDeducted = commission;

      if (isMongoConnected) {
        await User.findByIdAndUpdate(ride.acceptedDriver.driverId, {
          $inc: {
            todayEarnings: fare,
            totalTrips: 1,
            walletBalance: -commission,
          },
        });
        await User.findByIdAndUpdate(ride.passengerId, {
          $inc: { totalTrips: 1 },
        });
      } else {
        const drv = store.users.find(
          (u) => String(u._id || u.id) === String(ride.acceptedDriver.driverId)
        );
        if (drv) {
          drv.todayEarnings = (drv.todayEarnings || 0) + fare;
          drv.totalTrips = (drv.totalTrips || 0) + 1;
          drv.walletBalance = (drv.walletBalance || 0) - commission;
        }
        const pax = store.users.find(
          (u) => String(u._id || u.id) === String(ride.passengerId)
        );
        if (pax) {
          pax.totalTrips = (pax.totalTrips || 0) + 1;
        }
      }
    }

    if (isMongoConnected) {
      await ride.save();
    } else {
      writeStore(store);
    }

    return res.json({ ride });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 5. WALLET TOP-UP (EASYPAISA / JAZZCASH)
// ============================================================================
app.post('/api/wallet/topup', authMiddleware, async (req, res) => {
  try {
    const { amount, provider, transactionRef } = req.body;
    const addAmount = Number(amount);
    if (!addAmount || addAmount < 100) {
      return res.status(400).json({ error: 'Minimum top-up amount is Rs. 100' });
    }

    if (isMongoConnected) {
      const user = await User.findByIdAndUpdate(
        req.auth.id,
        { $inc: { walletBalance: addAmount } },
        { new: true }
      ).lean();
      return res.json({ success: true, user, provider, transactionRef });
    } else {
      const store = readStore();
      const user = store.users.find((u) => (u._id || u.id) === req.auth.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.walletBalance = (user.walletBalance || 0) + addAmount;
      writeStore(store);
      return res.json({ success: true, user, provider, transactionRef });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6. SERVE PRODUCTION WEB APP BUILD (IF PRESENT IN ../dist)
// ============================================================================
const WEB_DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(WEB_DIST_DIR)) {
  app.use(express.static(WEB_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexHtml = path.join(WEB_DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    next();
  });
}

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SkarduRide Full MERN Backend Server running on http://0.0.0.0:${PORT}`);
  });
});
