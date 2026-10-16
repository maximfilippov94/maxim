import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { api, ApiError, FOOD_MEALS, type Food, type FoodMeal } from '../api';
import { useApp } from '../store';
import { Icon } from '../ui/Icon';
import { haptic } from '../haptics';
import { plural } from '../format';
import { VoiceOrb } from './VoiceOrb';
import { VoicePCM } from './pcm';
import { applyAmount, chooseFood, fillKnownMeal, localDay, readyToConfirm, rowHint, selectedFood, type VoiceCapabilities, type VoiceDraft, type VoiceItem } from './model';

type Mode = 'record' | 'text' | 'processing' | 'review' | 'edit' | 'done';
type Capture = 'idle' | 'permission' | 'recording' | 'ready';
const newKey = () => `expo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
const erase = (file: File | null) => { try { if (file?.exists) file.delete(); } catch {} };
const snackContext = (meal: FoodMeal) => meal === 'snack1' ? 'после завтрака' : meal === 'snack2' ? 'после обеда' : '';

/** Mounted inside Today, outside the scrolling content. No WebView or cloud keys. */
export function FoodVoice({ onSaved }: { onSaved: () => void }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Записать еду голосом"
      onPress={() => { haptic.tap(); setOpen(true); }}
      style={({ pressed }) => ({ position: 'absolute', right: 20, bottom: insets.bottom + 90, width: 56, height: 56,
        borderRadius: 28, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? .8 : 1, transform: [{ scale: pressed ? .94 : 1 }], elevation: 5,
        shadowColor: p.shadow, shadowOpacity: .18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } })}>
      <Icon name="mic" size={24} color={p.onPrimary} />
    </Pressable>
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
  const [level, setLevel] = useState(0), [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(''), [permissionDenied, setPermissionDenied] = useState(false);
  const [cap, setCap] = useState<VoiceCapabilities | null>(null);
  const [transcript, setTranscript] = useState(''), [textOpen, setTextOpen] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null), [items, setItems] = useState<VoiceItem[]>([]);
  const [refine, setRefine] = useState<{ draft_id: string; items: VoiceItem[]; scope: number | null } | null>(null);
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
      setLevel(volume); setSeconds(pcm.current.seconds);
      if (pcm.current.seconds >= pcm.current.maxSeconds) stopRef.current();
    } catch (e) { stopRef.current(); setError(e instanceof Error ? e.message : 'Не удалось записать звук'); }
  } });

  const stop = useCallback(() => {
    if (!recording.current) return;
    recording.current = false;
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
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      if (!alive.current || generation.current !== version) { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); return; }
      pcm.current.clear(); erase(upload.current); upload.current = null; requestKey.current = newKey(); textSignature.current = '';
      setSeconds(0); recording.current = true;
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
    const buffer = pcm.current;
    queueMicrotask(() => { if (alive.current) start(); });
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => {
      alive.current = false; invalidate(); ctl.abort(); request.current?.abort();
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
      setMode('review'); setExpanded(null); setTextOpen(false); setMealPicker(null); haptic.success();
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
  const title = mode === 'record' || processing ? 'EQUA AI' : mode === 'review' ? 'Проверьте еду' : mode === 'edit' ? 'Количество' : mode === 'done' ? 'Записано' : 'Что вы съели?';

  return <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 10 }}>
      <Pressable accessibilityLabel="Закрыть голосовой дневник" onPress={close} style={StyleSheet.absoluteFill}>
        <BlurView intensity={22} tint={p.name} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(9,16,18,.45)' }]} />
      </Pressable>
      <Animated.View layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)} accessibilityViewIsModal style={{ backgroundColor: p.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        maxHeight: Math.max(240, height - insets.top - 20), flexShrink: 1, paddingBottom: Math.max(insets.bottom, 14) }}>
        <View accessible={false} style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: p.text3, opacity: .5, alignSelf: 'center', marginTop: 10, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 }}>
          {mode === 'edit' && <RoundButton label="Назад к списку" icon="back" action={() => { setMode('review'); setEditor(null); setError(''); }} />}
          <Text accessibilityRole="header" style={[ink, { flex: 1, fontSize: 22, fontWeight: '600', letterSpacing: -.5 }]}>{title}</Text>
          {mode !== 'record' && <RoundButton label="Закрыть" icon="close" action={close} disabled={saving} />}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false}
          style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14, gap: 12 }}>
          {(mode === 'record' || processing) && <>
            <VoiceOrb level={level} processing={processing} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 16 }}>
              <Text accessibilityLiveRegion="polite" style={[muted, { fontSize: 16 }]}>
                {processing ? (refine ? 'Уточняю список…' : 'Разбираю продукты…') : capture === 'permission' ? 'Разрешите микрофон' : capture === 'recording' ? (refine ? 'Слушаю уточнение…' : 'Слушаю…') : capture === 'ready' ? 'Готово к отправке' : refine ? 'Что изменить?' : 'Расскажите, что съели'}
              </Text>
              {!processing && <Text style={[muted, { fontSize: 15, fontVariant: ['tabular-nums'] }]}>0:{String(Math.floor(seconds)).padStart(2, '0')}</Text>}
            </View>
          </>}
          {mode === 'text' && <TextInput accessibilityLabel="Что вы съели" multiline autoFocus maxLength={2500} value={transcript}
            onChangeText={setTranscript} placeholder="Например, на обед рис 100 г и два яйца" placeholderTextColor={p.text3}
            style={[ink, { fontSize: 17, minHeight: 110, padding: 16, borderRadius: 18, backgroundColor: p.inset, textAlignVertical: 'top' }]} />}
          {mode === 'review' && <>
            {cap?.refinement_available && <Pressable onPress={() => beginRefinement()} accessibilityRole="button" accessibilityLabel="Уточнить список голосом" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}><Icon name="mic" size={18} color={p.accent} /><Text style={{ color: p.accent, fontSize: 15 }}>Уточнить голосом</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => setMealPicker(mealPicker ? null : missingMeal ? 'missing' : 'all')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: p.accent, fontSize: 16, fontWeight: '500' }}>{missingMeal ? 'Уточните приём пищи' : meals.length === 1 ? `${FOOD_MEALS.find(([m]) => m === meals[0])?.[1]}${snackContext(meals[0]!) ? ` · ${snackContext(meals[0]!)}` : ''}  ⌄` : 'Несколько приёмов пищи  ⌄'}</Text>
            </Pressable>
            {(missingMeal || mealPicker) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FOOD_MEALS.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label} ${snackContext(key)}`}
                onPress={() => { setItems(rows => rows.map(r => ({ ...r, meal: mealPicker === 'all' || !r.meal ? key : r.meal }))); setMealPicker(null); haptic.select(); }}
                style={{ backgroundColor: p.inset, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={[ink, { fontSize: 15 }]}>{label}</Text>
                {!!snackContext(key) && <Text style={[muted, { fontSize: 10, marginTop: 2 }]}>{snackContext(key)}</Text>}
              </Pressable>)}
            </View>}
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
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, borderTopWidth: mode === 'review' || mode === 'edit' ? StyleSheet.hairlineWidth : 0, borderTopColor: p.separator }}>
          {mode === 'record' && <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
            {<RoundButton label={refine ? 'Вернуться к списку' : 'Отменить запись'} icon={refine ? 'back' : 'close'} action={refine ? cancelRefinement : close} />}
            {<RoundButton label="Ввести текст" icon="edit" action={() => { invalidate(); stop(); setMode('text'); }} disabled={capture === 'permission'} />}
            {<RoundButton label={capture === 'recording' ? 'Остановить запись' : 'Записать ещё раз'} icon={capture === 'recording' ? 'pause' : 'mic'} action={() => capture === 'recording' ? stop() : start()} disabled={capture === 'permission' || cap?.speech_available === false} />}
            {<RoundButton label="Отправить запись" icon="send" action={() => analyze()} primary disabled={!['recording', 'ready'].includes(capture) || cap?.speech_available === false} />}
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

function RoundButton({ label, icon, action, primary = false, disabled = false }: { label: string; icon: string; action: () => void; primary?: boolean; disabled?: boolean }) {
    const { p } = useApp();
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      onPress={action} style={({ pressed }) => ({ width: primary ? 56 : 46, height: primary ? 56 : 46, borderRadius: 30,
        backgroundColor: primary ? p.primary : p.inset, opacity: disabled ? .4 : pressed ? .7 : 1,
        alignItems: 'center', justifyContent: 'center' })}>
      <Icon name={icon} size={23} color={primary ? p.onPrimary : p.text2} />
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
