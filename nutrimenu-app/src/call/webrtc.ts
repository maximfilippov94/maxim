/**
 * Доступ к нативному WebRTC.
 *
 * Модуль нативный, и в Expo Go его нет — там внутри только то, что Expo
 * положил в своё приложение заранее.
 *
 * Обернуть `require` в try/catch недостаточно, и это проверено на живом
 * телефоне: при обращении к отсутствующему нативному модулю
 * `TurboModuleRegistry` бросает `Invariant Violation` уже при
 * инициализации пакета, и падает не вызов, а весь разбор дерева —
 * приложение не открывается вовсе. Поэтому сначала спрашиваем, не Expo
 * ли это Go, и только потом грузим. `isRunningInExpoGo` сама себя
 * защищает: нативного модуля `ExpoGo` вне Expo Go нет, и она просто
 * вернёт false.
 */
import { isRunningInExpoGo } from 'expo';

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
  if (isRunningInExpoGo()) {
    cached = null;
    return cached;
  }
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
