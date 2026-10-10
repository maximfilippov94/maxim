/**
 * Видеозвонок: состояние, сигнализация и сторож входящих.
 *
 * Протокол тот же, что у веба, и ничего своего в нём нет:
 *   POST /calls/start      — начать (специалист шлёт client_id)
 *   GET  /calls/poll       — «мне звонят?», состояние звонка, новые сигналы
 *   POST /calls/signal     — offer / answer / ice
 *   POST /calls/accept     — взять трубку
 *   POST /calls/decline    — отклонить входящий
 *   POST /calls/end        — положить трубку
 *
 * Звонящий сразу создаёт offer и ждёт. Принимающий после `accept`
 * начинает опрос, получает offer и отвечает. ICE, пришедшие до
 * описания, копятся и добавляются после — иначе часть кандидатов
 * теряется и соединение не поднимается.
 *
 * Сторож входящих опрашивает сервер раз в три секунды, пока приложение
 * открыто. Фоновые звонки на телефоне требуют CallKit и push-типа VoIP —
 * это отдельная работа, здесь её нет; о звонке в фоне человек узнаёт
 * обычным уведомлением, которое сервер шлёт в тот же момент.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { api } from '../api';
import { useApp } from '../store';
import { webrtc } from './webrtc';
import { haptic } from '../haptics';

export type CallRole = 'caller' | 'callee';
export type CallStage = 'idle' | 'incoming' | 'calling' | 'active';

export interface CallPeer { name: string; avatar_url?: string | null }
interface CallRow { id: number; status: string; caller_type: string }

interface CallCtx {
  stage: CallStage;
  peer: CallPeer | null;
  /** Поток собеседника и свой — для видео на экране */
  localUrl: string | null;
  remoteUrl: string | null;
  micOn: boolean;
  camOn: boolean;
  /** Секунды разговора — считаем у себя, сервер ведёт свой счёт */
  seconds: number;
  error: string | null;
  connected: boolean;
  /** Специалист звонит клиенту; клиент — своему специалисту, без аргумента */
  start: (clientId?: number) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: (reason?: 'hangup' | 'failed') => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
  flip: () => void;
}

const C = createContext<CallCtx>(null as any);
export const useCall = () => useContext(C);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { me } = useApp();
  const [stage, setStage] = useState<CallStage>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  /* Всё, что не должно вызывать перерисовку, держим в ref: соединение,
     потоки, таймеры и курсор прочитанных сигналов. */
  const pc = useRef<any>(null);
  const local = useRef<any>(null);
  const remote = useRef<any>(null);
  const callId = useRef(0);
  const role = useRef<CallRole>('caller');
  const since = useRef(0);
  const pendingIce = useRef<any[]>([]);
  const remoteReady = useRef(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingId = useRef(0);
  const busy = useRef(false);

  const stopMedia = useCallback(() => {
    try { local.current?.getTracks().forEach((t: any) => t.stop()); } catch { /* уже закрыт */ }
    local.current = null;
    remote.current = null;
    setLocalUrl(null); setRemoteUrl(null);
  }, []);

  const teardown = useCallback(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
    if (pc.current) {
      try {
        pc.current.ontrack = null;
        pc.current.onicecandidate = null;
        pc.current.onconnectionstatechange = null;
        pc.current.oniceconnectionstatechange = null;
        pc.current.close();
      } catch { /* соединение уже закрыто */ }
      pc.current = null;
    }
    stopMedia();
    callId.current = 0; incomingId.current = 0; since.current = 0;
    pendingIce.current = []; remoteReady.current = false; busy.current = false;
    setStage('idle'); setPeer(null); setSeconds(0);
    setMicOn(true); setCamOn(true); setConnected(false);
  }, [stopMedia]);

  const send = useCallback(async (kind: string, payload: unknown) => {
    if (!callId.current) return;
    try {
      await api('/calls/signal', {
        method: 'POST', body: { call_id: callId.current, kind, payload },
      });
    } catch { /* сигнал потерян — следующий опрос подберёт состояние */ }
  }, []);

  const getMedia = useCallback(async () => {
    const w = webrtc();
    if (!w) throw new Error('Видеозвонки работают в собственной сборке приложения.');
    return w.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user' },
    });
  }, []);

  const fail = useCallback((msg: string) => {
    const id = callId.current;
    teardown();
    if (id) api('/calls/end', { method: 'POST', body: { call_id: id, reason: 'failed' } }).catch(() => {});
    setError(msg);
  }, [teardown]);

  const buildPc = useCallback((ice: any[]) => {
    const w = webrtc()!;
    const conn = new w.RTCPeerConnection({ iceServers: ice ?? [], iceCandidatePoolSize: 2 });
    remote.current = new w.MediaStream();

    local.current.getTracks().forEach((t: any) => conn.addTrack(t, local.current));

    conn.ontrack = (e: any) => {
      const tracks = e.streams?.[0] ? e.streams[0].getTracks() : [e.track];
      tracks.forEach((t: any) => {
        if (!remote.current.getTracks().includes(t)) remote.current.addTrack(t);
      });
      setRemoteUrl(remote.current.toURL());
    };
    conn.onicecandidate = (e: any) => { if (e.candidate) send('ice', e.candidate.toJSON()); };
    const up = () => setConnected(true);
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') up();
      if (conn.connectionState === 'failed') fail('Не удалось установить соединение.');
    };
    conn.oniceconnectionstatechange = () => {
      if (['connected', 'completed'].includes(conn.iceConnectionState)) up();
      if (conn.iceConnectionState === 'failed') fail('Не удалось установить соединение.');
    };
    return conn;
  }, [fail, send]);

  const applyRemote = useCallback(async (desc: any) => {
    const w = webrtc()!;
    await pc.current.setRemoteDescription(new w.RTCSessionDescription(desc));
    remoteReady.current = true;
    const queued = pendingIce.current.splice(0);
    for (const c of queued) {
      try { await pc.current.addIceCandidate(new w.RTCIceCandidate(c)); } catch { /* негодный кандидат */ }
    }
  }, []);

  const handleSignal = useCallback(async (s: { kind: string; payload: string }) => {
    let p: any;
    try { p = JSON.parse(s.payload); } catch { return; }
    if (!p || !pc.current) return;
    const w = webrtc()!;
    if (s.kind === 'offer' && role.current === 'callee') {
      await applyRemote(p);
      const ans = await pc.current.createAnswer();
      await pc.current.setLocalDescription(ans);
      send('answer', { type: ans.type, sdp: ans.sdp });
    } else if (s.kind === 'answer' && role.current === 'caller') {
      if (!pc.current.currentRemoteDescription) await applyRemote(p);
    } else if (s.kind === 'ice') {
      if (remoteReady.current) {
        try { await pc.current.addIceCandidate(new w.RTCIceCandidate(p)); } catch { /* негодный кандидат */ }
      } else pendingIce.current.push(p);
    }
  }, [applyRemote, send]);

  const startTimer = useCallback(() => {
    if (tick.current) return;
    tick.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }, []);

  const pollTick = useCallback(async () => {
    if (!callId.current) return;
    let j: any;
    try {
      j = await api(`/calls/poll?call_id=${callId.current}&since=${since.current}`, { noCache: true });
    } catch { return; }
    for (const s of (j.signals ?? [])) {
      since.current = Math.max(since.current, s.id);
      try { await handleSignal(s); } catch { /* сигнал не применился — соединение подхватит следующий */ }
    }
    const c: CallRow | null = j.call ?? null;
    if (!c) return;
    if (c.status === 'active' && stage !== 'active') {
      setStage('active');
      if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
      startTimer();
    }
    if (['ended', 'declined', 'missed'].includes(c.status)) {
      teardown();
      setError(c.status === 'declined' ? 'Собеседник отклонил звонок'
        : c.status === 'missed' ? 'Собеседник не ответил' : null);
    }
  }, [handleSignal, stage, startTimer, teardown]);

  const pollStart = useCallback(() => {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(() => { pollTick(); }, 1200);
  }, [pollTick]);

  /* ---------- действия ---------- */

  const hangup = useCallback(async (reason: 'hangup' | 'failed' = 'hangup', note?: string) => {
    const id = callId.current;
    teardown();
    if (note) setError(note);
    if (id) {
      try { await api('/calls/end', { method: 'POST', body: { call_id: id, reason } }); }
      catch { /* сервер закроет звонок по времени */ }
    }
  }, [teardown]);

  const start = useCallback(async (clientId?: number) => {
    if (busy.current) return;
    if (!webrtc()) { setError('Видеозвонки работают в собственной сборке приложения.'); return; }
    busy.current = true;
    setError(null);
    try {
      local.current = await getMedia();
      setLocalUrl(local.current.toURL());
    } catch (e: any) {
      busy.current = false;
      setError(e?.message ?? 'Нет доступа к камере или микрофону');
      return;
    }
    let j: any;
    try {
      j = await api('/calls/start', { method: 'POST', body: clientId ? { client_id: clientId } : {} });
    } catch (e: any) {
      stopMedia(); busy.current = false;
      setError(e?.message ?? 'Не удалось позвонить');
      return;
    }
    callId.current = j.call.id;
    role.current = 'caller';
    since.current = 0; pendingIce.current = []; remoteReady.current = false;
    setPeer(j.peer ?? null); setStage('calling'); setSeconds(0);
    haptic.tap();

    pc.current = buildPc(j.ice_servers);
    try {
      const off = await pc.current.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.current.setLocalDescription(off);
      await send('offer', { type: off.type, sdp: off.sdp });
    } catch (e: any) {
      fail('Не удалось начать звонок: ' + (e?.message ?? ''));
      return;
    }
    pollStart();
    ringTimer.current = setTimeout(() => {
      if (callId.current) hangup('hangup', 'Собеседник не ответил');
    }, ((j.ring_seconds as number) || 45) * 1000);
  }, [buildPc, fail, getMedia, hangup, pollStart, send, stopMedia]);

  const accept = useCallback(async () => {
    const id = incomingId.current;
    if (!id || busy.current) return;
    if (!webrtc()) { setError('Видеозвонки работают в собственной сборке приложения.'); return; }
    busy.current = true;
    setError(null);
    try {
      local.current = await getMedia();
      setLocalUrl(local.current.toURL());
    } catch (e: any) {
      busy.current = false;
      api('/calls/decline', { method: 'POST', body: { call_id: id } }).catch(() => {});
      teardown();
      setError(e?.message ?? 'Нет доступа к камере или микрофону');
      return;
    }
    let j: any;
    try { j = await api('/calls/accept', { method: 'POST', body: { call_id: id } }); }
    catch (e: any) {
      stopMedia(); busy.current = false; teardown();
      setError(e?.message ?? 'Звонок уже недоступен');
      return;
    }
    callId.current = id;
    role.current = 'callee';
    incomingId.current = 0;
    since.current = 0; pendingIce.current = []; remoteReady.current = false;
    setPeer(j.peer ?? null); setStage('active'); setSeconds(0);
    haptic.success();
    pc.current = buildPc(j.ice_servers);
    startTimer();
    pollStart();
    pollTick();
  }, [buildPc, getMedia, pollStart, pollTick, startTimer, stopMedia, teardown]);

  const decline = useCallback(async () => {
    const id = incomingId.current;
    teardown();
    if (id) {
      try { await api('/calls/decline', { method: 'POST', body: { call_id: id } }); }
      catch { /* сервер закроет звонок сам */ }
    }
  }, [teardown]);

  const toggleMic = useCallback(() => {
    if (!local.current) return;
    setMicOn(on => {
      const next = !on;
      local.current.getAudioTracks().forEach((t: any) => { t.enabled = next; });
      return next;
    });
    haptic.select();
  }, []);

  const toggleCam = useCallback(() => {
    if (!local.current) return;
    setCamOn(on => {
      const next = !on;
      local.current.getVideoTracks().forEach((t: any) => { t.enabled = next; });
      return next;
    });
    haptic.select();
  }, []);

  /* Переключение камеры в React Native делается самим треком, а не
     пересозданием потока, как в браузере. */
  const flip = useCallback(() => {
    try {
      local.current?.getVideoTracks().forEach((t: any) => t._switchCamera?.());
      haptic.select();
    } catch { /* одна камера — переключать нечего */ }
  }, []);

  /* ---------- сторож входящих ---------- */

  const kind = me?.user_type;
  useEffect(() => {
    if (!me || (kind !== 'client' && kind !== 'specialist')) return;
    if (!webrtc()) return;
    let alive = true;
    const watch = async () => {
      if (!alive || callId.current) return;
      if (AppState.currentState !== 'active' && !incomingId.current) return;
      let j: any;
      try { j = await api('/calls/poll', { noCache: true }); } catch { return; }
      const inc = j?.incoming?.call ? j.incoming : null;
      if (incomingId.current) {
        /* Звонящий отменил вызов или истекло время — гасим экран входящего */
        if (!inc || inc.call.id !== incomingId.current) {
          teardown();
          setError('Пропущенный звонок');
        }
        return;
      }
      if (inc) {
        incomingId.current = inc.call.id;
        setPeer(inc.peer ?? null);
        setStage('incoming');
        haptic.success();
      }
    };
    const t = setInterval(watch, 3000);
    watch();
    return () => { alive = false; clearInterval(t); };
  }, [me, kind, teardown]);

  /* Ушли из приложения во время разговора — сообщаем собеседнику. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background' && callId.current) hangup('hangup');
    });
    return () => sub.remove();
  }, [hangup]);

  return (
    <C.Provider value={{
      stage, peer, localUrl, remoteUrl, micOn, camOn, seconds, error, connected,
      start, accept, decline, hangup, toggleMic, toggleCam, flip,
    }}>
      {children}
    </C.Provider>
  );
}
