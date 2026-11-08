const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    driverProfilePhoto: { type: String, default: '' },
    driverRating: { type: Number, default: 5.0 },
    driverTrips: { type: Number, default: 0 },
    vehicleCategory: { type: String, required: true },
    vehicleModel: { type: String, required: true },
    vehicleColor: { type: String, default: '' },
    vehiclePlate: { type: String, required: true },
    bidPrice: { type: Number, required: true },
    isExactMatch: { type: Boolean, default: false },
    etaMinutes: { type: Number, default: 4 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderRole: {
      type: String,
      enum: ['passenger', 'driver'],
      required: true,
    },
    senderName: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'audio'],
      default: 'text',
    },
    text: { type: String, required: true, trim: true },
    audioData: { type: String, default: '' },
    durationSec: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const LocationPointSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String, required: true },
    area: { type: String, default: 'Skardu' },
    coords: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { _id: false }
);

const RideSchema = new mongoose.Schema(
  {
    passengerId: { type: String, required: true, index: true },
    passengerName: { type: String, required: true },
    passengerPhone: { type: String, required: true },
    passengerProfilePhoto: { type: String, default: '' },
    passengerRating: { type: Number, default: 5.0 },
    pickup: { type: LocationPointSchema, required: true },
    dropoff: { type: LocationPointSchema, required: true },
    vehicleCategory: {
      type: String,
      enum: ['bike', 'car_mini', 'car_plus', 'jeep_4x4'],
      required: true,
    },
    vehicleCategoryName: { type: String, required: true },
    offeredFare: { type: Number, required: true },
    agreedFare: { type: Number, default: null },
    distanceKm: { type: Number, required: true },
    durationMin: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'EasyPaisa', 'JazzCash'],
      default: 'Cash',
    },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'searching',
        'accepted',
        'arrived',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'searching',
      index: true,
    },
    bids: [BidSchema],
    messages: [ChatMessageSchema],
    activeCall: {
      callerId: { type: String, default: '' },
      callerName: { type: String, default: '' },
      callerRole: { type: String, default: '' },
      status: {
        type: String,
        enum: ['idle', 'ringing', 'connected', 'ended'],
        default: 'idle',
      },
      updatedAt: { type: Date },
    },
    acceptedDriver: {
      driverId: { type: String },
      driverName: { type: String },
      driverPhone: { type: String },
      driverProfilePhoto: { type: String },
      driverRating: { type: Number },
      vehicleModel: { type: String },
      vehicleColor: { type: String },
      vehiclePlate: { type: String },
    },
    commissionDeducted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Ride || mongoose.model('Ride', RideSchema);
