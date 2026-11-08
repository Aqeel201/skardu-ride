export const SKARDU_LOCATIONS = [
  {
    id: 'yadgar',
    name: 'Yadgar Chowk (Main Bazaar)',
    area: 'City Center, Skardu',
    category: 'City',
    coords: { lat: 35.2971, lng: 75.6333 },
  },
  {
    id: 'airport',
    name: 'Skardu International Airport',
    area: 'Airport Road, Skardu',
    category: 'Transit',
    coords: { lat: 35.3355, lng: 75.5361 },
  },
  {
    id: 'uobs',
    name: 'University of Baltistan (UOBS)',
    area: 'Hussainabad / Kargil Road',
    category: 'Education',
    coords: { lat: 35.2890, lng: 75.6150 },
  },
  {
    id: 'dhq',
    name: 'RHQ / DHQ Hospital Skardu',
    area: 'Hospital Road, Skardu',
    category: 'Hospital',
    coords: { lat: 35.2935, lng: 75.6395 },
  },
  {
    id: 'shangrila',
    name: 'Shangrila Resort (Lower Kachura)',
    area: 'Kachura, Skardu',
    category: 'Tourism',
    coords: { lat: 35.4264, lng: 75.4539 },
  },
  {
    id: 'upper_kachura',
    name: 'Upper Kachura Lake',
    area: 'Kachura Valley',
    category: 'Tourism',
    coords: { lat: 35.4192, lng: 75.4458 },
  },
  {
    id: 'satpara',
    name: 'Satpara Lake Viewpoint',
    area: 'Deosai Road, Skardu',
    category: 'Tourism',
    coords: { lat: 35.2347, lng: 75.6319 },
  },
  {
    id: 'shigar',
    name: 'Shigar Fort (Serena)',
    area: 'Shigar Valley',
    category: 'Tourism',
    coords: { lat: 35.4272, lng: 75.7414 },
  },
  {
    id: 'sarfaranga',
    name: 'Sarfaranga Cold Desert',
    area: 'Shigar Road',
    category: 'Tourism',
    coords: { lat: 35.3612, lng: 75.6910 },
  },
  {
    id: 'kazimabad',
    name: 'Kazimabad / New Bazaar',
    area: 'Skardu City',
    category: 'City',
    coords: { lat: 35.3012, lng: 75.6240 },
  },
];

export const VEHICLE_TYPES = [
  {
    id: 'bike',
    name: 'Moto / Bike',
    subtitle: '1 Passenger • City Commute',
    icon: '🏍️',
    baseFare: 100,
    perKmRate: 25,
    eta: '3 min',
  },
  {
    id: 'car_mini',
    name: 'Economy Car',
    subtitle: 'Alto / Cultus / Mehran • 4 Seats',
    icon: '🚗',
    baseFare: 250,
    perKmRate: 55,
    eta: '4 min',
  },
  {
    id: 'car_plus',
    name: 'Comfort Sedan',
    subtitle: 'Corolla / Yaris • AC & Heater',
    icon: '🚙',
    baseFare: 400,
    perKmRate: 75,
    eta: '6 min',
  },
  {
    id: 'jeep_4x4',
    name: '4x4 Prado / TZ Jeep',
    subtitle: 'Mountain & Tourist Routes • 7 Seats',
    icon: '🛻',
    baseFare: 1200,
    perKmRate: 140,
    eta: '8 min',
  },
];

export function calculateRouteEstimate(pickup, dropoff, vehicle) {
  if (!pickup || !dropoff || pickup.id === dropoff.id) {
    return { distanceKm: 0, durationMin: 0, suggestedFare: vehicle?.baseFare || 200 };
  }

  const R = 6371;
  const dLat = ((dropoff.coords.lat - pickup.coords.lat) * Math.PI) / 180;
  const dLon = ((dropoff.coords.lng - pickup.coords.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pickup.coords.lat * Math.PI) / 180) *
      Math.cos((dropoff.coords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;

  const distanceKm = Math.max(1.5, Number((straightDistance * 1.4).toFixed(1)));
  const durationMin = Math.max(5, Math.round(distanceKm * 2.4));

  const rawFare = vehicle.baseFare + distanceKm * vehicle.perKmRate;
  const suggestedFare = Math.round(rawFare / 50) * 50;

  return { distanceKm, durationMin, suggestedFare };
}
