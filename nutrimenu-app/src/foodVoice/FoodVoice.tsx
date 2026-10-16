import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, FadeIn, LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { api, ApiError, FOOD_MEALS, type Food, type FoodMeal } from '../api';
import { useApp } from '../store';
import { Icon } from '../ui/Icon';
import { haptic } from '../haptics';
import { plural } from '../format';
import { VoiceOrb } from './VoiceOrb';
import { VoicePCM } from './pcm';
import { cancelVoiceCue, playVoiceCue } from './cues';
import { VoicePreview } from './preview';
import { applyAmount, chooseFood, fillKnownMeal, localDay, readyToConfirm, rowHint, selectedFood, type VoiceCapabilities, type VoiceDraft, type VoiceItem } from './model';

type Mode = 'record' | 'text' | 'processing' | 'review' | 'edit' | 'done';
type Capture = 'idle' | 'permission' | 'recording' | 'ready';
const newKey = () => `expo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
const erase = (file: File | null) => { try { if (file?.exists) file.delete(); } catch {} };
const snackContext = (meal: FoodMeal) => meal === 'snack1' ? 'после завтрака' : meal === 'snack2' ? 'после обеда' : '';

async function previewSpeech(bytes: Uint8Array, key: string, seq: number, signal: AbortSignal): Promise<string> {
  const file = new File(Paths.cache, `equa-preview-${key}-${seq}.pcm`);
  try {
    file.create({ overwrite: true }); file.write(bytes);
    const body = new FormData(); body.append('audio', file); body.append('session_key', key); body.append('seq', String(seq));
    const result = await api<{ text: string }>('/client/food-voice/preview', { method: 'POST', body, fileUpload: true, signal, retry: false, dedupe: false, timeoutMs: 14000 });
    return result.text;
  } finally { erase(file); }
}

/** Mounted inside Today, outside the scrolling content. No WebView or cloud keys. */
export function FoodVoice({ onSaved }: { onSaved: () => void }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion(), pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse); pulse.value = 0;
    if (!open && !reduced) pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      withDelay(3000, withTiming(0, { duration: 1 }))
    ), -1);
    return () => cancelAnimation(pulse);
  }, [open, reduced, pulse]);
  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : 1 + pulse.value * .025 }] }));
  const halo = useAnimatedStyle(() => ({ opacity: reduced ? 0 : pulse.value * .14, transform: [{ scale: 1 + pulse.value * .18 }] }));
  return <>
    <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[{ position: 'absolute', right: 20, bottom: insets.bottom + 58, width: 56, height: 56 }, breathing]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Записать еду голосом"
      onPress={() => { haptic.tap(); setOpen(true); }}
      style={({ pressed }) => ({ width: 56, height: 56,
        borderRadius: 28, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? .8 : 1, transform: [{ scale: pressed ? .94 : 1 }], elevation: 5,
        shadowColor: p.shadow, shadowOpacity: .18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } })}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 28, borderWidth: 2, borderColor: p.primary }, halo]} />
      <Icon name="mic" size={24} color={p.onPrimary} />
    </Pressable>
    </Animated.View>
    {open && <VoiceDialog onClose={() => setOpen(false)} onSaved={onSaved} />}
  </>;
}

function VoiceDialog(props: { onClose: () => void; onSaved: () => void }) {
  const supported = Platform.OS !== 'web' && typeof (AudioModule as unknown as { AudioStream?: unknown }).AudioStream === 'function';
  return supported ? <NativeVoiceDialog {...props} /> : <UnavailableDialog {...props} />;
}
function UnavailableDialog({ onClose }: { onClose: () => void }) {
  const { p } = useApp();
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(9,16,18,.7)' }}>
      <View style={{ padding: 24, borderRadius: 24, backgroundColor: p.surface, gap: 20 }}>
        <Text style={{ color: p.text, fontSize: 21, fontWeight: '600' }}>Голосовой дневник</Text>
        <Text style={{ color: p.text2, fontSize: 16, lineHeight: 23 }}>
          {Platform.OS === 'web' ? 'Откройте приложение в Expo Go на телефоне. Голосовой ввод в браузере доступен в PWA EQUA.' : 'Обновите Expo Go до версии с SDK 57 и перезапустите приложение. Для записи нужен модуль AudioStream.'}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ padding: 14 }}><Text style={{ color: p.accent, textAlign: 'center', fontSize: 17 }}>Понятно</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function NativeVoiceDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets(), { height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('record');
  const [capture, setCapture] = useState<Capture>('idle');
  const [liveText, setLiveText] = useState('');
  const preview = useRef(new VoicePreview(previewSpeech, text => setLiveText(text)));
  const [level, setLevel] = useState(0), [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(''), [permissionDenied, setPermissionDenied] = useState(false);
  const [cap, setCap] = useState<VoiceCapabilities | null>(null);
  const [transcript, setTranscript] = useState(''), [textOpen, setTextOpen] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null), [items, setItems] = useState<VoiceItem[]>([]);
  const [refine, setRefine] = useState<{ draft_id: string; items: VoiceItem[]; scope: number | null } | null>(null);
  const [heardAudio, setHeardAudio] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mealPicker, setMealPicker] = useState<'missing' | 'all' | null>(null);
  const [editor, setEditor] = useState<{ index: number; row: VoiceItem; amount: string; unit: 'g' | 'pc' } | null>(null);
  const [query, setQuery] = useState(''), [results, setResults] = useState<Food[]>([]), [searchBusy, setSearchBusy] = useState(false);
  const [saving, setSaving] = useState(false), [totalSaved, setTotalSaved] = useState(0);
  const [date] = useState(localDay);
  const alive = useRef(true), working = useRef(false), recording = useRef(false), permission = useRef(false);
  const generation = useRef(0), pcm = useRef(new VoicePCM()), upload = useRef<File | null>(null);
  const requestKey = useRef(newKey()), textSignature = useRef(''), request = useRef<AbortController | null>(null);
  const refineBaseText = useRef('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const capRef = useRef<VoiceCapabilities | null>(null);
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'float32', onBuffer: buffer => {
    if (!alive.current || !recording.current) return;
    try {
      const volume = pcm.current.push(buffer.data, buffer.sampleRate, buffer.channels);
      if (volume > .12) setHeardAudio(true);
      setLevel(volume); setSeconds(pcm.current.seconds);
      preview.current.tick(pcm.current.seconds, () => pcm.current.encode(), capRef.current?.live_preview_available === true);
      if (pcm.current.seconds >= pcm.current.maxSeconds) stopRef.current();
    } catch (e) { stopRef.current(); setError(e instanceof Error ? e.message : 'Не удалось записать звук'); }
  } });

  const stop = useCallback(() => {
    if (!recording.current) return;
    recording.current = false; preview.current.cancel();
    if (timeout.current) clearTimeout(timeout.current);
    try { stream.stop(); } catch {}
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (alive.current) { setCapture(pcm.current.seconds >= .2 ? 'ready' : 'idle'); setLevel(0); setSeconds(pcm.current.seconds); }
  }, [stream]);
  useEffect(() => { stopRef.current = stop; }, [stop]);
  const invalidate = useCallback(() => { ++generation.current; permission.current = false; }, []);

  const start = useCallback(async () => {
    const speechBlocked = () => capRef.current?.speech_available === false;
    if (working.current || recording.current || permission.current || speechBlocked()) return;
    const version = ++generation.current;
    permission.current = true; setCapture('permission'); setError(''); setPermissionDenied(false);
    try {
      const access = await requestRecordingPermissionsAsync();
      if (!alive.current || generation.current !== version) return;
      if (!access.granted) { setPermissionDenied(true); throw new Error('Разрешите микрофон, чтобы назвать продукты голосом.'); }
      if (speechBlocked()) { setCapture('idle'); return; }
      await playVoiceCue('start');
      if (!alive.current || generation.current !== version || speechBlocked()) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      if (!alive.current || generation.current !== version) { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); return; }
      pcm.current.clear(); erase(upload.current); upload.current = null; requestKey.current = newKey(); textSignature.current = '';
      preview.current.begin(requestKey.current); setLiveText('');
      setSeconds(0); setHeardAudio(false); recording.current = true;
      await stream.start();
      if (!alive.current || generation.current !== version || speechBlocked()) { stop(); return; }
      setCapture('recording'); haptic.tap();
      timeout.current = setTimeout(stop, 24000);
    } catch (e) {
      recording.current = false;
      try { stream.stop(); } catch {}
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (alive.current && generation.current === version) { setCapture('idle'); setError(e instanceof Error ? e.message : 'Не удалось включить микрофон.'); }
    } finally { if (generation.current === version) permission.current = false; }
  }, [stream, stop]);

  useEffect(() => {
    alive.current = true;
    const ctl = new AbortController();
    api<VoiceCapabilities>('/client/food-voice/capabilities', { noCache: true, signal: ctl.signal }).then(c => {
      if (!alive.current) return;
      capRef.current = c; setCap(c);
      if (!c.speech_available) { stop(); setError(c.message || 'Голосовой ввод временно недоступен. Повторите позже.'); }
    }).catch(e => { if (alive.current && !ctl.signal.aborted) { stop(); setError(e.message); } });
    const buffer = pcm.current, previewCapture = preview.current;
    queueMicrotask(() => { if (alive.current) start(); });
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') { if (state === 'background') { cancelVoiceCue(); if (permission.current) { invalidate(); setCapture('idle'); } } stop(); } });
    return () => {
      alive.current = false; cancelVoiceCue(); previewCapture.cancel(); invalidate(); ctl.abort(); request.current?.abort();
      if (timeout.current) clearTimeout(timeout.current);
      recording.current = false;
      try { stream.stop(); } catch {}
      buffer.clear(); erase(upload.current); upload.current = null; sub.remove();
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, [start, stop, stream, invalidate]);

  // Stale search replies never replace the current query or another product.
  useEffect(() => {
    if (mode !== 'edit' || query.trim().length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      api<{ foods: Food[] }>('/client/food-voice/search?q=' + encodeURIComponent(query.trim()), { signal: ctl.signal, retry: false })
        .then(j => { if (!ctl.signal.aborted) setResults(j.foods); })
        .catch(e => { if (!ctl.signal.aborted) setError(e.message); })
        .finally(() => { if (!ctl.signal.aborted) setSearchBusy(false); });
    }, 280);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [query, mode]);

  async function analyze(asText = false) {
    if (working.current || permission.current) return;
    if (asText && !transcript.trim()) return;
    working.current = true; stop(); setError('');
    const returnMode = asText ? 'text' : 'record';
    setMode('processing'); request.current = new AbortController();
    try {
      let body: FormData | { text: string; request_key: string; eaten_on: string; refine_json?: string };
      const refinement = refine ? JSON.stringify({ ...refine, items: refine.items.map(({ name, ingredient_id, grams, meal, pieces, weight_source, source_index }) => ({ name, ingredient_id, grams, meal, pieces, weight_source, source_index })) }) : undefined;
      if (asText) {
        if (textSignature.current !== transcript.trim()) { requestKey.current = newKey(); textSignature.current = transcript.trim(); }
        body = { text: transcript.trim(), request_key: requestKey.current, eaten_on: date };
        if (refinement) body.refine_json = refinement;
      } else {
        if (!upload.current) {
          const bytes = pcm.current.encode();
          upload.current = new File(Paths.cache, `equa-food-${requestKey.current}.pcm`);
          upload.current.create({ overwrite: true }); upload.current.write(bytes);
        }
        body = new FormData();
        // SDK 57's Expo fetch serializes File.bytes(); legacy {uri} parts fail
        // before any HTTP request and must not be passed as pretend Blobs.
        body.append('audio', upload.current);
        body.append('request_key', requestKey.current); body.append('eaten_on', date);
        if (refinement) body.append('refine_json', refinement);
      }
      const result = await api<VoiceDraft>('/client/food-voice/analyze', { method: 'POST', body,
        signal: request.current.signal, retry: false, dedupe: false, timeoutMs: 70000, fileUpload: !asText });
      if (!alive.current) return;
      setDraft(result); setItems(fillKnownMeal(result.items)); setTranscript(result.transcript);
      setRefine(null);
      setMode('review'); setExpanded(null); setTextOpen(false); setMealPicker(null); haptic.success(); if (!asText) void playVoiceCue('ready');
      erase(upload.current); upload.current = null; pcm.current.clear(); setCapture('idle');
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && e.status && ![409, 429].includes(e.status)) requestKey.current = newKey();
      setMode(returnMode); setCapture(pcm.current.seconds >= .2 || upload.current ? 'ready' : 'idle');
      setError(e instanceof Error ? e.message : 'Не удалось отправить запись. Повторите отправку.');
    } finally { working.current = false; }
  }
  function openEditor(index: number) {
    const row = items[index], unit = row.weight_source === 'pieces' && row.pieces && selectedFood(row)?.piece_g ? 'pc' : 'g';
    setEditor({ index, row: { ...row }, amount: String(unit === 'pc' ? row.pieces : row.grams ?? ''), unit });
    setQuery(row.name); setResults([]); setSearchBusy(true); setError(''); setMode('edit');
  }
  function beginRefinement(scope: number | null = null) {
    if (!draft || working.current || !cap?.refinement_available) return;
    const current = editor ? items.map((r, i) => i === editor.index ? (applyAmount(editor.row, Number(editor.amount.replace(',', '.')), editor.unit) ?? editor.row) : r) : items;
    refineBaseText.current = transcript; setTranscript('');
    setItems(current); setRefine({ draft_id: draft.draft_id, items: current, scope });
    setEditor(null); setMode('record'); setError(''); start();
  }
  function cancelRefinement() {
    invalidate(); stop(); erase(upload.current); upload.current = null; pcm.current.clear();
    setTranscript(refineBaseText.current); setRefine(null); setMode('review'); setError('');
  }
  async function confirm() {
    if (!draft || !readyToConfirm(items) || working.current) return;
    working.current = true; setSaving(true); setError(''); request.current = new AbortController();
    try {
      const result = await api<{ items_count: number }>(`/client/food-voice/${draft.draft_id}/confirm`, {
        method: 'POST', body: { eaten_on: date, items: items.map(r => ({ ingredient_id: r.ingredient_id, grams: r.grams, meal: r.meal, source_index: r.source_index })) },
        signal: request.current.signal, retry: false,
      });
      onSaved();
      if (!alive.current) return;
      setTotalSaved(result.items_count); setMode('done'); haptic.success();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Не удалось сохранить. Повторите отправку.'); }
    finally { working.current = false; if (alive.current) setSaving(false); }
  }

  const ink = { color: p.text }, muted = { color: p.text3 };
  const close = () => { if (!saving) onClose(); };
  function foodChoice(food: Food, pick: () => void) {
    return <Pressable key={food.id} onPress={() => { haptic.select(); pick(); }} accessibilityRole="button"
      accessibilityLabel={`${food.name}, выбрать`} style={({ pressed }) => ({ padding: 14, backgroundColor: pressed ? p.ov3 : p.ov1,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
      <View style={{ flex: 1 }}><Text style={[ink, { fontSize: 16, fontWeight: '500' }]}>{food.name}</Text>
        <Text style={[muted, { fontSize: 12, marginTop: 3 }]}>{food.match_note ? `${food.match_note} · ` : ''}{food.kcal} ккал / 100 г{food.brand ? ` · ${food.brand}` : ''}</Text></View>
      <Icon name="plus" size={19} color={p.accent} />
    </Pressable>;
  }
  const meals = [...new Set(items.map(r => r.meal).filter(Boolean))];
  const missingMeal = items.some(r => !r.meal);
  const editorFood = editor && selectedFood(editor.row);
  const editedAmount = editor ? applyAmount(editor.row, Number(editor.amount.replace(',', '.')), editor.unit) : null;
  const processing = mode === 'processing';
  const title = mode === 'record' || processing ? '' : mode === 'review' ? 'Проверьте еду' : mode === 'edit' ? 'Количество' : mode === 'done' ? 'Записано' : 'Что вы съели?';

  return <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 10, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10) }}>
      <Pressable accessibilityLabel="Закрыть голосовой дневник" onPress={close} style={StyleSheet.absoluteFill}>
        <BlurView intensity={8} tint={p.name} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(9,16,18,.16)' }]} />
      </Pressable>
      <Animated.View layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)} accessibilityViewIsModal style={{ backgroundColor: 'transparent', overflow: 'hidden', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: p.separator,
        maxHeight: Math.max(240, height - insets.top - insets.bottom - 36), flexShrink: 1, paddingBottom: 14 }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <BlurView intensity={64} tint={p.name === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.name === 'dark' ? 'rgba(22,31,40,.48)' : 'rgba(247,249,248,.66)' }]} />
        </View>
        <View accessible={false} style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: p.text3, opacity: .5, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 4 }}>
          {mode === 'edit' && <RoundButton label="Назад к списку" icon="back" action={() => { setMode('review'); setEditor(null); setError(''); }} />}
          {title ? <Text accessibilityRole="header" style={[ink, { flex: 1, fontSize: 22, fontWeight: '600', letterSpacing: -.5 }]}>{title}</Text> : <View style={{ flex: 1 }} />}
          {mode === 'review' && cap?.refinement_available && <RoundButton label="Уточнить список голосом" icon="mic" action={() => beginRefinement()} subtle />}
          <RoundButton label={mode === 'record' ? (refine ? 'Вернуться к списку' : 'Отменить запись') : 'Закрыть'} icon="close" action={mode === 'record' && refine ? cancelRefinement : close} disabled={saving} subtle />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false}
          style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 12 }}>
          <Animated.View key={mode} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={{ gap: 10 }}>
          {(mode === 'record' || processing) && <>
            <VoiceOrb level={level} processing={processing} />
            {processing && <Text accessibilityLiveRegion="polite" style={[muted, { textAlign: 'center', fontSize: 15, paddingBottom: 8 }]}>{refine ? 'Уточняю список…' : 'Разбираю продукты…'}</Text>}
            {mode === 'record' && capture === 'permission' && <Text accessibilityLiveRegion="polite" style={[muted, { textAlign: 'center', fontSize: 14 }]}>Разрешите микрофон</Text>}
            {mode === 'record' && <View style={{ minHeight: liveText ? 48 : 24, justifyContent: 'center', paddingHorizontal: 8, paddingBottom: 4 }}>
              <Text accessibilityLabel="Предварительно распознанная речь" accessibilityLiveRegion="polite" style={{ color: liveText ? p.text : p.text3, fontSize: liveText ? 18 : 14, lineHeight: 24, textAlign: 'center' }} numberOfLines={2}>{liveText || (heardAudio ? '' : refine ? 'Скажите, что изменить' : 'Назовите продукты и количество')}</Text>
            </View>}
          </>}
          {mode === 'text' && <TextInput accessibilityLabel="Что вы съели" multiline autoFocus maxLength={2500} value={transcript}
            onChangeText={setTranscript} placeholder="Например, на обед рис 100 г и два яйца" placeholderTextColor={p.text3}
            style={[ink, { fontSize: 17, minHeight: 110, padding: 16, borderRadius: 18, backgroundColor: p.inset, textAlignVertical: 'top' }]} />}
          {mode === 'review' && <>

            <Pressable accessibilityRole="button" onPress={() => setMealPicker(mealPicker ? null : missingMeal ? 'missing' : 'all')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: p.accent, fontSize: 16, fontWeight: '500' }}>{missingMeal ? 'Уточните приём пищи' : meals.length === 1 ? `${FOOD_MEALS.find(([m]) => m === meals[0])?.[1]}${snackContext(meals[0]!) ? ` · ${snackContext(meals[0]!)}` : ''}  ⌄` : 'Несколько приёмов пищи  ⌄'}</Text>
            </Pressable>
            {(missingMeal || mealPicker) && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {FOOD_MEALS.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label} ${snackContext(key)}`}
                onPress={() => { setItems(rows => rows.map(r => ({ ...r, meal: mealPicker === 'all' || !r.meal ? key : r.meal }))); setMealPicker(null); haptic.select(); }}
                style={{ backgroundColor: p.inset, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, minWidth: 84, alignItems: 'center' }}>
                <Text style={[ink, { fontSize: 15 }]}>{label}</Text>
                {!!snackContext(key) && <Text style={[muted, { fontSize: 10, marginTop: 2 }]}>{snackContext(key)}</Text>}
              </Pressable>)}
            </ScrollView>}
            <View style={{ borderRadius: 20, backgroundColor: p.inset, overflow: 'hidden' }}>
              {items.map((row, index) => <View key={index} style={{ borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: p.separator }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${selectedFood(row)?.name ?? row.name}, ${rowHint(row)}`}
                  onPress={() => { if (!selectedFood(row) && row.candidates.length) { setExpanded(expanded === index ? null : index); haptic.select(); } else openEditor(index); }}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 16, alignItems: 'center', opacity: pressed ? .7 : 1 })}>
                  <View style={{ flex: 1 }}><Text style={[ink, { fontSize: 16, fontWeight: '600', lineHeight: 22 }]}>{selectedFood(row)?.name ?? row.name}</Text>
                    <Text style={{ color: selectedFood(row) && row.grams ? p.text3 : p.accent, fontSize: 13, marginTop: 4 }}>{rowHint(row)}{meals.length > 1 && row.meal ? ` · ${FOOD_MEALS.find(([m]) => m === row.meal)?.[1]} ${snackContext(row.meal)}` : ''}</Text></View>
                  <Text style={[ink, { fontSize: 15, fontWeight: '500', maxWidth: 100 }]}>{row.grams ? `${row.grams} г` : row.pieces ? `${row.pieces} шт.` : '—'}</Text>
                  <Icon name="chevr" size={16} color={p.text3} />
                </Pressable>
                {expanded === index && <View style={{ gap: 6, paddingHorizontal: 12, paddingBottom: 12 }}>
                  {row.candidates.slice(0, 3).map(food => foodChoice(food, () => { setItems(rows => rows.map((r, i) => i === index ? chooseFood(r, food) : r)); setExpanded(null); }))}
                  <Pressable onPress={() => openEditor(index)} accessibilityRole="button" style={{ padding: 12 }}><Text style={{ color: p.accent }}>Найти другой продукт</Text></Pressable>
                </View>}
              </View>)}
            </View>
            <Pressable onPress={() => setTextOpen(!textOpen)} accessibilityRole="button" style={{ paddingVertical: 8 }}><Text style={[muted, { fontSize: 14 }]}>Текст {textOpen ? '⌃' : '⌄'}</Text></Pressable>
            {textOpen && <><Text style={[muted, { lineHeight: 21 }]}>{transcript}</Text>
              <Pressable onPress={() => { setDraft(null); setMode('text'); }} accessibilityRole="button" style={{ paddingVertical: 8 }}><Text style={{ color: p.accent }}>Исправить и разобрать заново</Text></Pressable></>}
          </>}
          {mode === 'edit' && editor && <>
            <Text style={[ink, { fontSize: 18, fontWeight: '600', lineHeight: 25 }]}>{editorFood?.name ?? editor.row.name}</Text>
            {cap?.refinement_available && <Pressable onPress={() => beginRefinement(editor.index)} accessibilityRole="button" accessibilityLabel="Уточнить этот продукт голосом" style={{ paddingVertical: 8 }}><Text style={{ color: p.accent }}>Уточнить голосом</Text></Pressable>}
            <View style={{ flexDirection: 'row', backgroundColor: p.inset, borderRadius: 18, paddingHorizontal: 16, alignItems: 'center' }}>
              <TextInput value={editor.amount} onChangeText={amount => setEditor({ ...editor, amount })} keyboardType="decimal-pad"
                accessibilityLabel={editor.unit === 'g' ? 'Количество в граммах' : 'Количество штук'} placeholder="Количество" placeholderTextColor={p.text3}
                maxLength={8} style={[ink, { flex: 1, minHeight: 60, fontSize: 24, paddingVertical: 12 }]} />
              {(['g', 'pc'] as const).filter(u => u === 'g' || !!editorFood?.piece_g).map(unit => <Pressable key={unit} accessibilityRole="button"
                accessibilityState={{ selected: editor.unit === unit }} onPress={() => {
                  if (unit === editor.unit) return;
                  const amount = Number(editor.amount.replace(',', '.'));
                  setEditor({ ...editor, unit, amount: amount > 0 && editorFood?.piece_g ? String(Math.round((unit === 'g' ? amount * editorFood.piece_g : amount / editorFood.piece_g) * 10) / 10) : '' });
                }} style={{ padding: 10, borderRadius: 12, backgroundColor: editor.unit === unit ? p.ov3 : 'transparent' }}>
                <Text style={{ color: editor.unit === unit ? p.accent : p.text3, fontSize: 16 }}>{unit === 'g' ? 'г' : 'шт.'}</Text>
              </Pressable>)}
            </View>
            {editor.unit === 'pc' && <Text style={[muted, { fontSize: 13 }]}>По справочнику: 1 шт. = {editorFood?.piece_g} г{editedAmount ? ` · ≈ ${editedAmount.grams} г` : ''}</Text>}
            <TextInput accessibilityLabel="Найти продукт" value={query} onChangeText={value => { setQuery(value); setResults([]); setSearchBusy(value.trim().length >= 2); }} placeholder="Найти продукт" placeholderTextColor={p.text3}
              maxLength={140} style={[ink, { fontSize: 16, padding: 15, borderRadius: 16, backgroundColor: p.inset, marginTop: 4 }]} />
            {searchBusy && <Text style={muted}>Ищу…</Text>}
            {!searchBusy && query.trim().length >= 2 && !results.length && <Text style={[muted, { fontSize: 13 }]}>Точного варианта нет. Можно изменить запрос.</Text>}
            {results.map(food => foodChoice(food, () => { const row = chooseFood(editor.row, food); setEditor({ ...editor, row, unit: 'g', amount: String(row.grams ?? '') }); }))}
          </>}
          {mode === 'done' && <View style={{ alignItems: 'center', paddingVertical: 30, gap: 14 }}>
            <Icon name="check" size={54} color={p.accent} /><Text style={[muted, { fontSize: 16 }]}>{totalSaved} {plural(totalSaved, ['продукт', 'продукта', 'продуктов'])} в дневнике</Text>
          </View>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 14, lineHeight: 20, paddingVertical: 8 }}>{error}</Text>}
          {permissionDenied && <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={{ paddingVertical: 10 }}><Text style={{ color: p.accent }}>Открыть настройки микрофона</Text></Pressable>}
          </Animated.View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, borderTopWidth: mode === 'review' || mode === 'edit' ? StyleSheet.hairlineWidth : 0, borderTopColor: p.separator }}>
          {mode === 'record' && <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', paddingTop: 4, paddingBottom: 8 }}>
            {<RoundButton label="Ввести текст" icon="keyboard" action={() => { invalidate(); stop(); if (liveText) setTranscript(liveText); setMode('text'); }} disabled={capture === 'permission'} />}
            {<RoundButton label={capture === 'recording' ? 'Остановить запись' : 'Записать ещё раз'} icon={capture === 'recording' ? 'pause' : 'mic'} progressSeconds={seconds} action={() => capture === 'recording' ? stop() : start()} disabled={capture === 'permission' || cap?.speech_available === false} />}
            {<RoundButton label="Отправить запись" icon="arrowUp" action={() => analyze()} primary disabled={!['recording', 'ready'].includes(capture) || cap?.speech_available === false} />}
          </View>}
          {mode === 'text' && <Action label="Разобрать продукты" fn={() => analyze(true)} disabled={!transcript.trim() || cap?.text_available === false} />}
          {mode === 'review' && <Action label={saving ? 'Сохраняю…' : `Добавить ${items.length} ${plural(items.length, ['продукт', 'продукта', 'продуктов'])}`} fn={confirm} disabled={saving || !draft || !readyToConfirm(items)} />}
          {mode === 'edit' && editor && <View style={{ gap: 8 }}>
            {<Action label="Готово" fn={() => { if (!editedAmount) return; setItems(rows => rows.map((r, i) => i === editor.index ? editedAmount : r)); setMode('review'); setEditor(null); setError(''); }} disabled={!editedAmount} />}
            <Pressable accessibilityRole="button" onPress={() => { setItems(rows => rows.filter((_, i) => i !== editor.index)); setMode('review'); setEditor(null); }} style={{ padding: 10 }}><Text style={{ color: p.text3, textAlign: 'center' }}>Удалить продукт</Text></Pressable>
          </View>}
          {mode === 'done' && <Action label="Готово" fn={close} />}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

function RoundButton({ label, icon, action, primary = false, disabled = false, subtle = false, progressSeconds }: { label: string; icon: string; action: () => void; primary?: boolean; disabled?: boolean; subtle?: boolean; progressSeconds?: number }) {
    const { p } = useApp();
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityValue={progressSeconds === undefined ? undefined : { min: 0, max: 24, now: Math.min(24, Math.floor(progressSeconds)), text: `${Math.floor(progressSeconds)} из 24 секунд` }} disabled={disabled}
      onPress={action} style={({ pressed }) => ({ width: primary ? 62 : progressSeconds !== undefined ? 60 : 48, height: primary ? 62 : progressSeconds !== undefined ? 60 : 48, borderRadius: 30,
        backgroundColor: primary ? p.primary : subtle ? 'transparent' : p.inset, opacity: disabled ? .4 : pressed ? .7 : 1,
        alignItems: 'center', justifyContent: 'center' })}>
      {progressSeconds !== undefined && <Svg width="60" height="60" style={StyleSheet.absoluteFill} accessible={false}><Circle cx="30" cy="30" r="27" fill="none" stroke={p.text3} strokeOpacity={.18} strokeWidth={2} /><Circle cx="30" cy="30" r="27" fill="none" stroke={p.primary} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[169.646,169.646]} strokeDashoffset={169.646 * (1 - Math.min(24, Math.max(0, progressSeconds)) / 24)} rotation={-90} origin="30,30" /></Svg>}
      <Icon name={icon} size={progressSeconds !== undefined ? 19 : 23} color={primary ? p.onPrimary : p.text2} />
      {progressSeconds !== undefined && <Text style={{ color: p.text3, fontSize: 9, fontVariant: ['tabular-nums'], marginTop: 2 }}>{`0:${String(Math.floor(progressSeconds)).padStart(2,'0')}`}</Text>}
    </Pressable>;
  }
function Action({ label, fn, disabled = false }: { label: string; fn: () => void; disabled?: boolean }) {
    const { p } = useApp();
    return <Pressable onPress={fn} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: 28, padding: 15, alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.primary, opacity: disabled ? .4 : pressed ? .75 : 1 })}>
      <Text style={{ color: p.onPrimary, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>;
  }
