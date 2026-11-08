import { Platform } from 'react-native';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

let activeVoicePlayer = null;
let activeRingPlayer = null;

export async function ensureMicPermission() {
  try {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function preparePlaybackAudioMode() {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {}
}

export async function fileUriToBase64(uri) {
  if (!uri) return null;
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return base64;
    }
  } catch (e) {
    console.warn('fileUriToBase64 error:', e?.message);
    return null;
  }
}

export async function playBase64Audio(
  base64String,
  tag = 'msg',
  volume = 1.0,
  onDone = null
) {
  if (!base64String) return null;
  try {
    const cleanBase64 = base64String.includes(',')
      ? base64String.split(',')[1]
      : base64String;

    let playUri = `data:audio/mp4;base64,${cleanBase64}`;

    if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
      const tempFile = `${FileSystem.cacheDirectory}skarduride_${tag}_${Date.now()}.m4a`;
      await FileSystem.writeAsStringAsync(tempFile, cleanBase64, {
        encoding: 'base64',
      });
      playUri = tempFile;
    }

    if (activeVoicePlayer) {
      try {
        activeVoicePlayer.pause();
        activeVoicePlayer.remove();
      } catch {}
      activeVoicePlayer = null;
    }

    const player = createAudioPlayer(playUri);
    player.volume = volume;
    activeVoicePlayer = player;

    if (onDone) {
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (
          status &&
          !status.playing &&
          status.currentTime > 0 &&
          status.duration > 0 &&
          status.currentTime >= status.duration - 0.15
        ) {
          try {
            sub?.remove?.();
          } catch {}
          onDone();
        }
      });
    }

    player.play();
    return player;
  } catch (e) {
    console.warn('playBase64Audio error:', e?.message);
    if (onDone) onDone();
    return null;
  }
}

export function stopActiveVoicePlayer() {
  if (activeVoicePlayer) {
    try {
      activeVoicePlayer.pause();
      activeVoicePlayer.remove();
    } catch {}
    activeVoicePlayer = null;
  }
}

// Synthesize a clean 2.0-second standard phone ringback/ringtone WAV in Base64 (440Hz + 480Hz dual tone)
function generatePhoneRingWavBase64() {
  const sampleRate = 8000;
  const durationSec = 2;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Double ring cadence: 0.0-0.4s ON, 0.4-0.6s OFF, 0.6-1.0s ON, 1.0-2.0s OFF
    const isRinging = (t >= 0 && t <= 0.4) || (t >= 0.55 && t <= 0.95);
    let sample = 0;
    if (isRinging) {
      const wave =
        Math.sin(2 * Math.PI * 440 * t) * 0.5 +
        Math.sin(2 * Math.PI * 480 * t) * 0.5;
      sample = Math.max(-1, Math.min(1, wave)) * 12000;
    }
    view.setInt16(44 + i * 2, sample, true);
  }

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i = 0; i < buffer.length; i += 3) {
    const b1 = buffer[i];
    const b2 = i + 1 < buffer.length ? buffer[i + 1] : 0;
    const b3 = i + 2 < buffer.length ? buffer[i + 2] : 0;
    const trip = (b1 << 16) | (b2 << 8) | b3;
    base64 += chars[(trip >> 18) & 0x3f];
    base64 += chars[(trip >> 12) & 0x3f];
    base64 += i + 1 < buffer.length ? chars[(trip >> 6) & 0x3f] : '=';
    base64 += i + 2 < buffer.length ? chars[trip & 0x3f] : '=';
  }
  return base64;
}

export async function startRingingTone() {
  stopRingingTone();
  try {
    const wavB64 = generatePhoneRingWavBase64();
    let ringUri = `data:audio/wav;base64,${wavB64}`;
    if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
      const ringFile = `${FileSystem.cacheDirectory}skarduride_ringtone.wav`;
      await FileSystem.writeAsStringAsync(ringFile, wavB64, {
        encoding: 'base64',
      });
      ringUri = ringFile;
    }
    const player = createAudioPlayer(ringUri);
    player.loop = true;
    player.volume = 0.85;
    player.play();
    activeRingPlayer = player;
  } catch {}
}

export function stopRingingTone() {
  if (activeRingPlayer) {
    try {
      activeRingPlayer.pause();
      activeRingPlayer.remove();
    } catch {}
    activeRingPlayer = null;
  }
}
