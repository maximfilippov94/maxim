/**
 * Доступ к нативному WebRTC.
 *
 * Модуль нативный, и в Expo Go его нет — там внутри только то, что Expo
 * положил в своё приложение заранее. Поэтому грузим его через `require`
 * в try/catch: без своей сборки приложение работает как прежде, а звонки
 * честно говорят, что им нужна своя сборка, вместо падения на старте.
 */
export interface WebRTC {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  RTCView: any;
  MediaStream: any;
  mediaDevices: any;
}

let cached: WebRTC | null | undefined;

export function webrtc(): WebRTC | null {
  if (cached !== undefined) return cached;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const m = require('react-native-webrtc');
    /* Глобальные объекты нужны коду, который ждёт браузерные имена. */
    if (typeof m.registerGlobals === 'function') m.registerGlobals();
    cached = {
      RTCPeerConnection: m.RTCPeerConnection,
      RTCSessionDescription: m.RTCSessionDescription,
      RTCIceCandidate: m.RTCIceCandidate,
      RTCView: m.RTCView,
      MediaStream: m.MediaStream,
      mediaDevices: m.mediaDevices,
    };
  } catch {
    cached = null;
  }
  return cached;
}

/** Есть ли в этой сборке нативная часть звонков. */
export const callsAvailable = () => webrtc() != null;
