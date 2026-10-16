import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let epoch = 0;
let finishCurrent: (() => void) | null = null;
export function cancelVoiceCue() { ++epoch; finishCurrent?.(); finishCurrent = null; }

/** Optional local cues. Playback failure must never block recording or review. */
export async function playVoiceCue(kind: 'start' | 'ready'): Promise<void> {
  cancelVoiceCue();
  const version = epoch;
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    if (version !== epoch) return;
    await new Promise<void>(resolve => {
      let player: AudioPlayer | null = null, subscription: { remove(): void } | null = null;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true; clearTimeout(timer); subscription?.remove();
        try { player?.remove(); } catch {}
        if (finishCurrent === finish) finishCurrent = null;
        setTimeout(resolve, 40);
      };
      const timer = setTimeout(finish, 650);
      finishCurrent = finish;
      try {
        player = createAudioPlayer(kind === 'start' ? require('../../assets/sounds/voice-start.wav') : require('../../assets/sounds/voice-ready.wav'), { updateInterval: 25 });
        player.volume = .28;
        subscription = player.addListener('playbackStatusUpdate', status => { if (status.didJustFinish) finish(); });
        player.play();
      } catch { finish(); }
    });
  } catch { /* Silent mode, unsupported playback or interrupted audio: keep the voice flow. */ }
}
