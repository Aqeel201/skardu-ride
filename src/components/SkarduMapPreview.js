import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { SKARDU_LOCATIONS } from '../data/skarduLocations';

export default function SkarduMapPreview({
  pickup,
  intermediateStop,
  dropoff,
  distanceKm,
  durationMin,
  onSelectMapPin,
  activeRideStatus,
  height = 290,
  compact = false,
  vehicleType = 'car_ac',
}) {
  // Tile Modes: 'city_hd' (Yandex/CartoDB Voyager) | 'dark_pro' (Uber Black Dark) | 'satellite' (Esri World Imagery)
  const [mapLayer, setMapLayer] = useState('city_hd');
  const [gpsLocation, setGpsLocation] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setGpsLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      } catch {}
    })();
  }, []);

  const mapHtml = useMemo(() => {
    const pLat = pickup?.coords?.lat || 35.2971;
    const pLng = pickup?.coords?.lng || 75.6333;
    const sLat = intermediateStop?.coords?.lat || null;
    const sLng = intermediateStop?.coords?.lng || null;
    const dLat = dropoff?.coords?.lat || 35.3355;
    const dLng = dropoff?.coords?.lng || 75.5361;

    const pShort = (pickup?.name || 'Pickup').split(' (')[0];
    const sShort = intermediateStop ? (intermediateStop.name || 'Stop').split(' (')[0] : '';
    const dShort = (dropoff?.name || 'Destination').split(' (')[0];

    const allSpotsJson = JSON.stringify(SKARDU_LOCATIONS);
    const gpsJson = JSON.stringify(gpsLocation);
    const hasStop = !!(sLat && sLng);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map {
      width: 100%;
      height: 100%;
      background: #090D16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    .leaflet-control-attribution { display: none !important; }

    /* Uber / Yandex Style Floating Pin Card */
    .pin-card-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
    }
    .pin-card {
      display: flex;
      align-items: center;
      background: rgba(15, 23, 42, 0.95);
      border-radius: 12px;
      padding: 5px 10px 5px 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      border: 1.5px solid rgba(255, 255, 255, 0.16);
      gap: 7px;
      white-space: nowrap;
      backdrop-filter: blur(10px);
    }
    .card-pickup { border-color: #10B981; }
    .card-stop { border-color: #F59E0B; }
    .card-dropoff { border-color: #EF4444; }

    .pin-badge {
      padding: 3px 7px;
      border-radius: 7px;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-pickup { background: #10B981; color: #022C22; }
    .badge-stop { background: #F59E0B; color: #451A03; }
    .badge-dropoff { background: #EF4444; color: #FFFFFF; }

    .pin-title {
      color: #F8FAFC;
      font-size: 11px;
      font-weight: 800;
    }
    .pin-sub {
      color: #94A3B8;
      font-size: 9px;
      font-weight: 700;
    }
    .pin-stem {
      width: 3px;
      height: 12px;
    }
    .stem-pickup { background: #10B981; }
    .stem-stop { background: #F59E0B; }
    .stem-dropoff { background: #EF4444; }

    .pin-anchor-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
    }
    .anchor-pickup { background: #10B981; box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.35); }
    .anchor-stop { background: #F59E0B; box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.35); }
    .anchor-dropoff { background: #EF4444; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.35); }

    /* Landmark Pills */
    .spot-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(15, 23, 42, 0.88);
      color: #E2E8F0;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      white-space: nowrap;
      transform: translate(-50%, -50%);
      cursor: pointer;
    }
    .spot-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38BDF8;
    }

    /* Live Vehicle Driver Animation */
    .vehicle-marker {
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .vehicle-icon-wrap {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #022C22;
      border: 2px solid #10B981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.8), 0 4px 10px rgba(0,0,0,0.5);
      animation: pulseGlow 2s infinite;
    }
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* In-Map Action Floating Control Column */
    .map-controls-col {
      position: absolute;
      bottom: 18px;
      right: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ctrl-btn {
      background: rgba(15, 23, 42, 0.94);
      color: #F8FAFC;
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer;
      user-select: none;
    }
    .ctrl-btn:active {
      transform: scale(0.92);
      border-color: #10B981;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="map-controls-col">
    <button class="ctrl-btn" onclick="zoomIn()" title="Zoom In">＋</button>
    <button class="ctrl-btn" onclick="zoomOut()" title="Zoom Out">－</button>
    <button class="ctrl-btn" onclick="fitRouteBounds()" style="border-color: #10B981; color: #10B981;" title="Center Route">🎯</button>
  </div>

  <script>
    // Primary & Fallback Tile Providers
    const layerMode = '${mapLayer}';
    let tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    let subdomains = ['a', 'b', 'c', 'd'];
    let maxZoom = 19;

    if (layerMode === 'dark_pro') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      subdomains = ['a', 'b', 'c', 'd'];
    } else if (layerMode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = [''];
      maxZoom = 18;
    }

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${(pLat + dLat) / 2}, ${(pLng + dLng) / 2}], 12);

    const baseLayer = L.tileLayer(tileUrl, {
      subdomains: subdomains,
      maxZoom: maxZoom
    }).addTo(map);

    // Fallback if tile fails
    baseLayer.on('tileerror', function() {
      // Automatic fallback to standard OSM if specialized CDN has intermittent glitch
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    });

    function zoomIn() { map.zoomIn(); }
    function zoomOut() { map.zoomOut(); }

    const spots = ${allSpotsJson};
    const pickupId = '${pickup?.id}';
    const stopId = '${intermediateStop?.id || ''}';
    const dropoffId = '${dropoff?.id}';

    // 1. Pickup Pin
    const pIcon = L.divIcon({
      className: '',
      html: \`<div class="pin-card-wrap">
        <div class="pin-card card-pickup">
          <span class="pin-badge badge-pickup">PICKUP</span>
          <div><div class="pin-title">${pShort}</div></div>
        </div>
        <div class="pin-stem stem-pickup"></div>
        <div class="pin-anchor-dot anchor-pickup"></div>
      </div>\`,
      iconSize: [0, 0]
    });
    L.marker([${pLat}, ${pLng}], { icon: pIcon, zIndexOffset: 2500 }).addTo(map);

    // 2. Intermediate Waypoint (if selected)
    ${hasStop ? `
    const sIcon = L.divIcon({
      className: '',
      html: \`<div class="pin-card-wrap">
        <div class="pin-card card-stop">
          <span class="pin-badge badge-stop">📸 STOP</span>
          <div><div class="pin-title">${sShort}</div></div>
        </div>
        <div class="pin-stem stem-stop"></div>
        <div class="pin-anchor-dot anchor-stop"></div>
      </div>\`,
      iconSize: [0, 0]
    });
    L.marker([${sLat}, ${sLng}], { icon: sIcon, zIndexOffset: 2400 }).addTo(map);
    ` : ''}

    // 3. Dropoff Destination Pin
    const dIcon = L.divIcon({
      className: '',
      html: \`<div class="pin-card-wrap">
        <div class="pin-card card-dropoff">
          <span class="pin-badge badge-dropoff">${durationMin || 12} MIN</span>
          <div>
            <div class="pin-title">${dShort}</div>
            <div class="pin-sub">${distanceKm || 4} km total</div>
          </div>
        </div>
        <div class="pin-stem stem-dropoff"></div>
        <div class="pin-anchor-dot anchor-dropoff"></div>
      </div>\`,
      iconSize: [0, 0]
    });
    L.marker([${dLat}, ${dLng}], { icon: dIcon, zIndexOffset: 2500 }).addTo(map);

    // 4. Other Skardu Points of Interest
    spots.forEach(function(s) {
      if (s.id === pickupId || s.id === dropoffId || s.id === stopId) return;
      const shortName = s.name.split(' (')[0];
      const icon = L.divIcon({
        className: '',
        html: \`<div class="spot-pill"><div class="spot-dot"></div><span>\${shortName}</span></div>\`,
        iconSize: [0, 0]
      });
      const m = L.marker([s.coords.lat, s.coords.lng], { icon, zIndexOffset: 100 }).addTo(map);
      m.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_SPOT', spotId: s.id }));
        }
      });
    });

    // 5. GPS User Location
    const userGps = ${gpsJson};
    if (userGps && userGps.lat && userGps.lng) {
      const gpsIcon = L.divIcon({
        className: '',
        html: '<div style=\"width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(59,130,246,0.35);\"></div>',
        iconSize: [16, 16]
      });
      L.marker([userGps.lat, userGps.lng], { icon: gpsIcon, zIndexOffset: 3000 }).addTo(map);
    }

    // 6. Multi-Waypoint Route Geometry
    let outerLine = null;
    let innerLine = null;
    let vehicleMarker = null;

    let allWaypoints = [
      [${pLat}, ${pLng}],
      ${hasStop ? `[${sLat}, ${sLng}],` : ''}
      [${dLat}, ${dLng}]
    ];

    let routeBounds = L.latLngBounds(allWaypoints);

    function fitRouteBounds() {
      map.fitBounds(routeBounds, {
        paddingTopLeft: [45, 80],
        paddingBottomRight: [45, 50],
        maxZoom: 14,
        animate: true
      });
    }

    function drawRoute(coords) {
      if (outerLine) map.removeLayer(outerLine);
      if (innerLine) map.removeLayer(innerLine);

      // Glowing route backshadow
      outerLine = L.polyline(coords, {
        color: '#059669',
        weight: 9,
        opacity: 0.38,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Sharp primary route road line
      innerLine = L.polyline(coords, {
        color: '#10B981',
        weight: 4.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      routeBounds = innerLine.getBounds();
      fitRouteBounds();

      // Live Animated 4x4 Driver Pin
      ${activeRideStatus ? `
      animateDriverOnRoute(coords);
      ` : ''}
    }

    // Driver 4x4 Moving Animation
    function animateDriverOnRoute(coords) {
      if (!coords || coords.length < 2) return;
      if (vehicleMarker) map.removeLayer(vehicleMarker);

      const vIcon = L.divIcon({
        className: 'vehicle-marker',
        html: \`<div class="vehicle-icon-wrap">🚙</div>\`,
        iconSize: [34, 34]
      });

      // Start at 20% or 60% of route depending on status
      const startIndex = '${activeRideStatus}' === 'accepted' ? 0 : Math.floor(coords.length * 0.35);
      vehicleMarker = L.marker(coords[startIndex], { icon: vIcon, zIndexOffset: 4000 }).addTo(map);

      let curIdx = startIndex;
      setInterval(function() {
        curIdx = (curIdx + 1) % coords.length;
        if (vehicleMarker) {
          vehicleMarker.setLatLng(coords[curIdx]);
        }
      }, 2500);
    }

    // Initial smooth natural bezier / waypoint line
    function generateNaturalCurve(pts) {
      let full = [];
      for (let i = 0; i < pts.length - 1; i++) {
        let p1 = pts[i];
        let p2 = pts[i + 1];
        let midLat = (p1[0] + p2[0]) / 2 + (i % 2 === 0 ? 0.0035 : -0.003);
        let midLng = (p1[1] + p2[1]) / 2 + (i % 2 === 0 ? -0.0025 : 0.003);
        full.push(p1);
        full.push([midLat, midLng]);
      }
      full.push(pts[pts.length - 1]);
      return full;
    }

    drawRoute(generateNaturalCurve(allWaypoints));

    // Skardu real driving network query via OSRM with safe 3s timeout
    const osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
      '${pLng},${pLat};' +
      ${hasStop ? `'${sLng},${sLat};' +` : "'' +"}
      '${dLng},${dLat}?overview=full&geometries=geojson';

    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, 3500);

    fetch(osrmUrl, { signal: controller.signal })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        clearTimeout(timeoutId);
        if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
          const raw = data.routes[0].geometry.coordinates.map(function(c) {
            return [c[1], c[0]];
          });
          if (raw.length > 1) {
            drawRoute(raw);
          }
        }
      })
      .catch(function() {
        // Fallback curve already rendered gracefully
      });
  </script>
</body>
</html>`;
  }, [
    pickup?.id,
    intermediateStop?.id,
    dropoff?.id,
    distanceKm,
    durationMin,
    mapLayer,
    gpsLocation,
    activeRideStatus,
  ]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECT_SPOT' && onSelectMapPin) {
        const found = SKARDU_LOCATIONS.find((l) => l.id === data.spotId);
        if (found) onSelectMapPin(found);
      }
    } catch {}
  };

  return (
    <View style={[styles.mapContainer, { height }]}>
      {Platform.OS === 'web' ? (
        <iframe
          title="Skardu Map"
          srcDoc={mapHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
        />
      )}

      {/* Top Left: Luxury Route Pill */}
      {distanceKm > 0 && (
        <View style={styles.routeOverlayCard}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>⚡ {distanceKm} km</Text>
          </View>
          <Text style={styles.routeDurationText}>~{durationMin} mins</Text>
          {intermediateStop ? (
            <View style={[styles.liveTag, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.liveTagText}>📸 1 STOP</Text>
            </View>
          ) : null}
          {activeRideStatus && !compact && (
            <View style={styles.liveTag}>
              <Text style={styles.liveTagText}>{activeRideStatus.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}

      {/* Top Right: 3-Mode Map Style Switcher (City HD / Dark Pro / 3D Satellite) */}
      <View style={styles.layerSwitcherPill}>
        {[
          { id: 'city_hd', label: '🗺️ City HD' },
          { id: 'dark_pro', label: '✨ Dark' },
          { id: 'satellite', label: '🛰️ 3D Sat' },
        ].map((mode) => {
          const active = mapLayer === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              onPress={() => setMapLayer(mode.id)}
              style={[styles.layerChip, active && styles.layerChipActive]}
            >
              <Text
                style={[
                  styles.layerChipText,
                  active && styles.layerChipTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 290,
    backgroundColor: '#090D16',
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  routeOverlayCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 13, 22, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    gap: 7,
  },
  routeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  routeBadgeText: {
    color: '#022C22',
    fontSize: 11,
    fontWeight: '900',
  },
  routeDurationText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  liveTag: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  layerSwitcherPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 13, 22, 0.94)',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  layerChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  layerChipActive: {
    backgroundColor: '#10B981',
  },
  layerChipText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  layerChipTextActive: {
    color: '#022C22',
    fontWeight: '900',
  },
});
