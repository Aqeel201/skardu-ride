import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VERCEL_PRODUCTION_API_URL = 'https://skardu-ride.vercel.app/api';
export const VERCEL_TEAM_API_URL =
  'https://skardu-ride-aqeel-ahmeds-projects-0bb6d05a.vercel.app/api';
export const LAN_API_URL = 'http://192.168.18.30:4000/api';
export const GITHUB_DISCOVERY_URL =
  'https://raw.githubusercontent.com/Aqeel201/skardu-ride/master/live-backend.json';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || VERCEL_PRODUCTION_API_URL;

const TOKEN_KEY = '@skarduride_jwt_token';
const USER_KEY = '@skarduride_user_profile';

let memoryToken = null;
let dynamicDiscoveredUrls = [];
let lastWorkingBaseUrl = null;

// Discover updated live backend URLs from GitHub raw config in background
(async () => {
  try {
    const res = await fetch(`${GITHUB_DISCOVERY_URL}?t=${Date.now()}`);
    if (res.ok) {
      const cfg = await res.json();
      if (Array.isArray(cfg?.apiUrls)) {
        dynamicDiscoveredUrls = cfg.apiUrls;
      }
    }
  } catch {}
})();

export const SessionStorage = {
  async saveSession(token, user) {
    memoryToken = token;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  },

  async loadSession() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const rawUser = await AsyncStorage.getItem(USER_KEY);
      if (token && rawUser) {
        memoryToken = token;
        return { token, user: JSON.parse(rawUser) };
      }
    } catch {}
    return null;
  },

  async clearSession() {
    memoryToken = null;
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    } catch {}
  },
};

async function fetchWithTimeout(url, options, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const candidateBases = [];
  if (lastWorkingBaseUrl) {
    candidateBases.push(lastWorkingBaseUrl);
  }
  for (const u of [
    ...dynamicDiscoveredUrls,
    API_BASE_URL,
    VERCEL_PRODUCTION_API_URL,
    VERCEL_TEAM_API_URL,
    LAN_API_URL,
  ]) {
    if (u && !candidateBases.includes(u)) {
      candidateBases.push(u);
    }
  }
  if (
    Platform.OS === 'web' &&
    !candidateBases.includes('http://localhost:4000/api')
  ) {
    candidateBases.push('http://localhost:4000/api');
  }

  let lastError = null;
  for (const base of candidateBases) {
    try {
      const res = await fetchWithTimeout(
        `${base}${endpoint}`,
        {
          ...options,
          headers,
        },
        5000
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server request failed');
      }
      lastWorkingBaseUrl = base;
      return data;
    } catch (err) {
      lastError = err;
      if (
        err.message &&
        !err.message.includes('Network request failed') &&
        !err.message.includes('Failed to fetch') &&
        !err.message.includes('Load failed') &&
        !err.message.includes('Aborted') &&
        err.name !== 'AbortError' &&
        err.name !== 'TypeError' &&
        err.name !== 'SyntaxError'
      ) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Could not connect to SkarduRide server');
}

export const BackendAPI = {
  async checkHealth() {
    return await apiRequest('/health');
  },

  async sendWhatsAppOtp(phone) {
    return await apiRequest('/auth/whatsapp/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async verifyWhatsAppOtp(payload) {
    const data = await apiRequest('/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token && data.user) {
      await SessionStorage.saveSession(data.token, data.user);
    }
    return data;
  },

  async googleAuth(payload) {
    const data = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token && data.user) {
      await SessionStorage.saveSession(data.token, data.user);
    }
    return data;
  },

  async getCurrentUser() {
    const data = await apiRequest('/auth/me');
    if (data.user && memoryToken) {
      await SessionStorage.saveSession(memoryToken, data.user);
    }
    return data.user;
  },

  async getRides() {
    const data = await apiRequest('/rides');
    return data.rides || [];
  },

  async createRide(ridePayload) {
    const data = await apiRequest('/rides', {
      method: 'POST',
      body: JSON.stringify(ridePayload),
    });
    return data.ride;
  },

  async sendDriverBid(rideId, bidPayload) {
    const data = await apiRequest(`/rides/${rideId}/bid`, {
      method: 'POST',
      body: JSON.stringify(bidPayload),
    });
    return data.ride;
  },

  async acceptBid(rideId, bidId) {
    const data = await apiRequest(`/rides/${rideId}/accept-bid`, {
      method: 'POST',
      body: JSON.stringify({ bidId }),
    });
    return data.ride;
  },

  async updateRideStatus(rideId, status) {
    const data = await apiRequest(`/rides/${rideId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    return data.ride;
  },

  async submitRating(rideId, ratingData) {
    try {
      const data = await apiRequest(`/rides/${rideId}/rating`, {
        method: 'POST',
        body: JSON.stringify(ratingData),
      });
      return data.ride;
    } catch {
      return null;
    }
  },

  async sendRideMessage(rideId, payload) {
    const bodyObj =
      typeof payload === 'string' ? { text: payload, type: 'text' } : payload;
    const data = await apiRequest(`/rides/${rideId}/messages`, {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });
    return data.ride;
  },

  async updateCallStatus(rideId, action) {
    const data = await apiRequest(`/rides/${rideId}/call`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    return data.ride;
  },

  async sendCallAudioChunk(rideId, audioData) {
    return await apiRequest(`/rides/${rideId}/call-audio`, {
      method: 'POST',
      body: JSON.stringify({ audioData }),
    });
  },

  async getCallAudioChunks(rideId, sinceSeq = 0) {
    return await apiRequest(`/rides/${rideId}/call-audio?since=${sinceSeq}`);
  },

  async topUpWallet(amount, provider, transactionRef) {
    const data = await apiRequest('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount, provider, transactionRef }),
    });
    if (data.user && memoryToken) {
      await SessionStorage.saveSession(memoryToken, data.user);
    }
    return data;
  },
};
