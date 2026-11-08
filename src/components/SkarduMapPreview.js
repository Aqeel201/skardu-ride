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
  dropoff,
  distanceKm,
  durationMin,
  onSelectMapPin,
  activeRideStatus,
  height = 285,
  compact = false,
}) {
  // Default to 'google_hd' or 'dark_pro' or 'satellite'
  const [mapLayer, setMapLayer] = useState('google_hd'); // 'google_hd' | 'dark_pro' | 'satellite'
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
    const dLat = dropoff?.coords?.lat || 35.3355;
    const dLng = dropoff?.coords?.lng || 75.5361;

    const pShort = (pickup?.name || 'Pickup').split(' (')[0];
    const dShort = (dropoff?.name || 'Destination').split(' (')[0];

    const tileUrl =
      mapLayer === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}'
        : mapLayer === 'dark_pro'
        ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';

    const allSpotsJson = JSON.stringify(SKARDU_LOCATIONS);
    const gpsJson = JSON.stringify(gpsLocation);

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map {
      width: 100%;
      height: 100%;
      background: #090D16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .leaflet-control-attribution { display: none !important; }

    /* Uber / Yango Pro Floating Callout Pins */
    .uber-pin-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
    }
    .uber-card {
      display: flex;
      align-items: center;
      background: rgba(9, 13, 22, 0.94);
      border-radius: 14px;
      padding: 5px 10px 5px 6px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
      border: 1.5px solid rgba(255, 255, 255, 0.16);
      gap: 7px;
      white-space: nowrap;
      backdrop-filter: blur(8px);
    }
    .uber-card-pickup {
      border-color: #10B981;
    }
    .uber-card-dropoff {
      border-color: #EF4444;
    }
    .uber-badge {
      padding: 3px 7px;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-pickup {
      background: #10B981;
      color: #022C22;
    }
    .badge-dropoff {
      background: #EF4444;
      color: #FFFFFF;
    }
    .uber-title {
      color: #F8FAFC;
      font-size: 11.5px;
      font-weight: 800;
    }
    .uber-sub {
      color: #94A3B8;
      font-size: 9.5px;
      font-weight: 700;
    }
    .pin-stem {
      width: 3px;
      height: 12px;
      background: #F8FAFC;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    .stem-pickup { background: #10B981; }
    .stem-dropoff { background: #EF4444; }

    .pin-anchor-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.28), 0 3px 8px rgba(0,0,0,0.5);
    }
    .anchor-pickup {
      background: #10B981;
    }
    .anchor-dropoff {
      background: #EF4444;
      box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.28), 0 3px 8px rgba(0,0,0,0.5);
    }

    /* Subtle Landmark Pills for other Skardu locations */
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
      border: 1px solid rgba(56, 189, 248, 0.45);
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      white-space: nowrap;
      transform: translate(-50%, -50%);
    }
    .spot-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #38BDF8;
    }

    /* Live User GPS Blue Pulse */
    .gps-pulse {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.32);
    }

    /* Floating Map Recenter Button inside WebView */
    .recenter-btn {
      position: absolute;
      bottom: 24px;
      right: 12px;
      z-index: 999;
      background: rgba(15, 23, 42, 0.94);
      color: #10B981;
      border: 1.5px solid #10B981;
      width: 38px;
      height: 38px;
      border-radius: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="recenter-btn" onclick="fitRouteBounds()" title="Recenter Route">🎯</button>

  <script>
    const map = L.map('map', { zoomControl: false }).setView([${(pLat + dLat) / 2}, ${(pLng + dLng) / 2}], 13);
    L.tileLayer('${tileUrl}', { maxZoom: 20 }).addTo(map);

    const spots = ${allSpotsJson};
    const pickupId = '${pickup?.id}';
    const dropoffId = '${dropoff?.id}';

    spots.forEach((s) => {
      const isP = s.id === pickupId;
      const isD = s.id === dropoffId;
      const shortName = s.name.split(' (')[0];

      if (isP) {
        const html = \`
          <div class="uber-pin-wrap">
            <div class="uber-card uber-card-pickup">
              <span class="uber-badge badge-pickup">PICKUP</span>
              <div>
                <div class="uber-title">\${shortName}</div>
              </div>
            </div>
            <div class="pin-stem stem-pickup"></div>
            <div class="pin-anchor-dot anchor-pickup"></div>
          </div>\`;
        const icon = L.divIcon({ className: '', html, iconSize: [0, 0] });
        L.marker([s.coords.lat, s.coords.lng], { icon, zIndexOffset: 2000 }).addTo(map);
      } else if (isD) {
        const html = \`
          <div class="uber-pin-wrap">
            <div class="uber-card uber-card-dropoff">
              <span class="uber-badge badge-dropoff">${durationMin || 10} MIN</span>
              <div>
                <div class="uber-title">\${shortName}</div>
                <div class="uber-sub">${distanceKm || 3} km route</div>
              </div>
            </div>
            <div class="pin-stem stem-dropoff"></div>
            <div class="pin-anchor-dot anchor-dropoff"></div>
          </div>\`;
        const icon = L.divIcon({ className: '', html, iconSize: [0, 0] });
        L.marker([s.coords.lat, s.coords.lng], { icon, zIndexOffset: 2000 }).addTo(map);
      } else {
        const html = \`
          <div class="spot-pill">
            <div class="spot-dot"></div>
            <span>\${shortName}</span>
          </div>\`;
        const icon = L.divIcon({ className: '', html, iconSize: [0, 0] });
        const m = L.marker([s.coords.lat, s.coords.lng], { icon, zIndexOffset: 100 }).addTo(map);
        m.on('click', () => {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_SPOT', spotId: s.id }));
          }
        });
      }
    });

    const userGps = ${gpsJson};
    if (userGps && userGps.lat && userGps.lng) {
      const gpsIcon = L.divIcon({ className: '', html: '<div class="gps-pulse"></div>', iconSize: [18, 18] });
      L.marker([userGps.lat, userGps.lng], { icon: gpsIcon, zIndexOffset: 3000 }).addTo(map);
    }

    let routeBounds = L.latLngBounds([[${pLat}, ${pLng}], [${dLat}, ${dLng}]]);
    let outerLine = null;
    let innerLine = null;

    function drawRouteGeometry(coordsLatLng) {
      if (outerLine) map.removeLayer(outerLine);
      if (innerLine) map.removeLayer(innerLine);

      // Glowing outer aura
      outerLine = L.polyline(coordsLatLng, {
        color: '#059669',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // High-contrast inner road route line
      innerLine = L.polyline(coordsLatLng, {
        color: '#10B981',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      routeBounds = innerLine.getBounds();
      fitRouteBounds();
    }

    function fitRouteBounds() {
      map.fitBounds(routeBounds, {
        paddingTopLeft: [45, 82],
        paddingBottomRight: [45, 45],
        maxZoom: 14,
        animate: true
      });
    }

    // Initial curved fallback while real road geometry loads
    const midLat = (${pLat} + ${dLat}) / 2 + 0.0045;
    const midLng = (${pLng} + ${dLng}) / 2 - 0.0035;
    drawRouteGeometry([[${pLat}, ${pLng}], [midLat, midLng], [${dLat}, ${dLng}]]);

    // Fetch real driving road geometry along Skardu roads via OSRM
    fetch('https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson')
      .then(r => r.json())
      .then(data => {
        if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          if (coords.length > 1) {
            drawRouteGeometry(coords);
          }
        }
      })
      .catch(() => {});
  </script>
</body>
</html>`;
  }, [pickup?.id, dropoff?.id, distanceKm, durationMin, mapLayer, gpsLocation]);

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
          title="Skardu Google Map"
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
          {activeRideStatus && !compact && (
            <View style={styles.liveTag}>
              <Text style={styles.liveTagText}>{activeRideStatus}</Text>
            </View>
          )}
        </View>
      )}

      {/* Top Right: 3-Mode Map Style Switcher (Google HD / Dark Pro / 3D Satellite) */}
      <View style={styles.layerSwitcherPill}>
        {[
          { id: 'google_hd', label: '🗺️ Map' },
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
    backgroundColor: 'rgba(9, 13, 22, 0.92)',
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
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveTagText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
  },
  layerSwitcherPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 13, 22, 0.92)',
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
