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
    id: 'katpana',
    name: 'Katpana Cold Desert & Dunes',
    area: 'Katpana, Skardu',
    category: 'Tourism',
    coords: { lat: 35.3210, lng: 75.5890 },
  },
  {
    id: 'khaplu_palace',
    name: 'Khaplu Palace (Serena)',
    area: 'Ghanche / Khaplu Valley',
    category: 'Tourism',
    coords: { lat: 35.1582, lng: 76.3361 },
  },
  {
    id: 'deosai_plains',
    name: 'Deosai National Park (Ali Malik Top)',
    area: 'Deosai High Plateau',
    category: 'Tourism',
    coords: { lat: 35.0305, lng: 75.4428 },
  },
  {
    id: 'sheosar_lake',
    name: 'Sheosar Lake (Heart of Deosai)',
    area: 'Deosai Plains',
    category: 'Tourism',
    coords: { lat: 34.9961, lng: 75.2458 },
  },
  {
    id: 'manthoka',
    name: 'Manthoka Waterfall',
    area: 'Kharmang Valley',
    category: 'Tourism',
    coords: { lat: 35.0069, lng: 76.1265 },
  },
  {
    id: 'basho_valley',
    name: 'Basho Valley Pine Meadows',
    area: 'Basho, Skardu',
    category: 'Tourism',
    coords: { lat: 35.4851, lng: 75.2891 },
  },
  {
    id: 'kazimabad',
    name: 'Kazimabad / New Bazaar',
    area: 'Skardu City',
    category: 'City',
    coords: { lat: 35.3012, lng: 75.6240 },
  },
];

export const TOUR_PACKAGES = [
  {
    id: 'tour_deosai_sheosar',
    title: 'Deosai Plains & Sheosar Lake 4x4 Expedition',
    destination: 'Deosai National Park & Sheosar Lake',
    duration: 'Full Day (8 - 10 Hours)',
    vehicle: '4x4 Prado / TZ / Land Cruiser',
    icon: '🏔️',
    rating: 4.9,
    highlights: ['Ali Malik Pass', 'Bara Pani Wooden Bridge', 'Sheosar Lake Reflection', 'Himalayan Brown Bear Habitat'],
    defaultFare: 22000,
    minFare: 18000,
    maxFare: 28000,
    tag: 'MOST POPULAR TOUR',
    pickupArea: 'Any Skardu Hotel / Airport',
  },
  {
    id: 'tour_shigar_sarfaranga',
    title: 'Shigar Royal Fort & Cold Desert Safari',
    destination: 'Shigar Valley & Sarfaranga Dunes',
    duration: 'Half / Full Day (5 - 7 Hours)',
    vehicle: 'Comfort Sedan / 4x4 Jeep',
    icon: '🏜️',
    rating: 4.8,
    highlights: ['Sarfaranga Desert Quad Bikes', 'Serena Shigar Fort', 'Amburiq Mosque', 'Blind Lake (Jarba Xho)'],
    defaultFare: 12000,
    minFare: 9500,
    maxFare: 16000,
    tag: 'CULTURAL & SAFARI',
    pickupArea: 'Skardu City / Hotel',
  },
  {
    id: 'tour_kachura_shangrila',
    title: 'Shangrila Resort & Upper Kachura Lake Boat Tour',
    destination: 'Lower & Upper Kachura Lakes',
    duration: 'Half Day (4 - 5 Hours)',
    vehicle: 'Economy Car / Sedan',
    icon: '⛵',
    rating: 4.9,
    highlights: ['Heart-Shaped Shangrila Lake', 'Upper Kachura Trout Fish & Boat Ride', 'Apricot Orchards Walk'],
    defaultFare: 6500,
    minFare: 5000,
    maxFare: 9000,
    tag: 'FAMILY FAVORITE',
    pickupArea: 'Skardu City / Airport',
  },
  {
    id: 'tour_khaplu_manthoka',
    title: 'Khaplu Serena Palace & Manthoka Waterfall',
    destination: 'Ghanche & Kharmang Valley',
    duration: 'Full Day (9 - 11 Hours)',
    vehicle: 'Sedan / 4x4 Jeep',
    icon: '🏰',
    rating: 4.9,
    highlights: ['Serena Khaplu Palace', 'Chaqchan Mosque (700 yrs old)', '180ft Manthoka Waterfall', 'Trout Farm'],
    defaultFare: 19000,
    minFare: 16000,
    maxFare: 24000,
    tag: 'HERITAGE & WATERFALL',
    pickupArea: 'Skardu City / Hotel',
  },
  {
    id: 'tour_basho_valley',
    title: 'Basho Valley Alpine Pine Wilderness',
    destination: 'Basho Meadow & Suspension Bridge',
    duration: 'Full Day (7 - 9 Hours)',
    vehicle: '4x4 Mountain Jeep Only',
    icon: '🌲',
    rating: 4.8,
    highlights: ['Basho Wooden Suspension Bridge', 'Alpine Pine Forest', 'Crystal Clear Streams', 'Barbecue Spot'],
    defaultFare: 17500,
    minFare: 15000,
    maxFare: 22000,
    tag: 'PURE ADVENTURE',
    pickupArea: 'Skardu City / Hotel',
  },
];

export const VEHICLE_TYPES = [
  {
    id: 'bike',
    name: 'Moto / Bike',
    subtitle: '1 Passenger • Quick City Transit',
    icon: '🏍️',
    baseFare: 100,
    perKmRate: 25,
    eta: '3 min',
  },
  {
    id: 'car_mini',
    name: 'Economy Car',
    subtitle: 'Alto / Cultus / WagonR • 4 Seats',
    icon: '🚗',
    baseFare: 250,
    perKmRate: 55,
    eta: '4 min',
  },
  {
    id: 'car_plus',
    name: 'Comfort Sedan',
    subtitle: 'Corolla / Yaris • AC / Heater • 4 Seats',
    icon: '🚙',
    baseFare: 400,
    perKmRate: 75,
    eta: '6 min',
  },
  {
    id: 'jeep_4x4',
    name: '4x4 Prado / TZ Jeep',
    subtitle: 'Mountain & Tourism Routes • 7 Seats',
    icon: '🛻',
    baseFare: 1200,
    perKmRate: 140,
    eta: '8 min',
  },
];

export function calculateRouteEstimate(pickup, dropoff, vehicle, intermediateStop = null) {
  if (!pickup || !dropoff || pickup.id === dropoff.id) {
    return { distanceKm: 0, durationMin: 0, suggestedFare: vehicle?.baseFare || 200 };
  }

  const R = 6371;
  const calcDist = (p1, p2) => {
    const dLat = ((p2.coords.lat - p1.coords.lat) * Math.PI) / 180;
    const dLon = ((p2.coords.lng - p1.coords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.coords.lat * Math.PI) / 180) *
        Math.cos((p2.coords.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  let straightDistance = calcDist(pickup, dropoff);
  let stopExtraKm = 0;
  if (intermediateStop && intermediateStop.id !== pickup.id && intermediateStop.id !== dropoff.id) {
    const d1 = calcDist(pickup, intermediateStop);
    const d2 = calcDist(intermediateStop, dropoff);
    straightDistance = d1 + d2;
    stopExtraKm = 2.5; // stop buffer
  }

  const distanceKm = Math.max(1.5, Number((straightDistance * 1.4 + stopExtraKm).toFixed(1)));
  const durationMin = Math.max(5, Math.round(distanceKm * 2.5) + (intermediateStop ? 15 : 0));

  const rawFare = vehicle.baseFare + distanceKm * vehicle.perKmRate + (intermediateStop ? 200 : 0);
  const suggestedFare = Math.round(rawFare / 50) * 50;

  return { distanceKm, durationMin, suggestedFare };
}
