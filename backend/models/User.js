const mongoose = require('mongoose');

const CaptainDetailsSchema = new mongoose.Schema(
  {
    kycStatus: {
      type: String,
      enum: ['pending_submission', 'verified', 'rejected'],
      default: 'pending_submission',
    },
    cnicNumber: { type: String, default: '' },
    cnicFrontImage: { type: String, default: '' },
    cnicBackImage: { type: String, default: '' },
    drivingLicenseNumber: { type: String, default: '' },
    drivingLicenseExpiry: { type: String, default: '' },
    drivingLicenseImage: { type: String, default: '' },
    vehicleCategory: {
      type: String,
      enum: ['bike', 'car_mini', 'car_plus', 'jeep_4x4'],
      default: 'car_mini',
    },
    vehicleModel: { type: String, default: '' },
    vehicleColor: { type: String, default: '' },
    vehiclePlate: { type: String, default: '' },
    vehicleRegistrationImage: { type: String, default: '' },
    vehiclePhoto: { type: String, default: '' },
    isOnline: { type: Boolean, default: true },
    currentLocation: {
      lat: { type: Number, default: 35.2971 },
      lng: { type: Number, default: 75.6333 },
    },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    role: {
      type: String,
      enum: ['passenger', 'driver'],
      required: true,
    },
    authProvider: {
      type: String,
      enum: ['whatsapp', 'google', 'phone'],
      default: 'whatsapp',
    },
    googleId: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    cnicNumber: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    rating: { type: Number, default: 5.0 },
    totalTrips: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    todayEarnings: { type: Number, default: 0 },
    captainDetails: {
      type: CaptainDetailsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
