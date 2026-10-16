/* Disposable native-module doubles only: production code always uses real API.
 * Run node tools/food-voice-test.cjs. No cloud credentials or diary writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, file) => {
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText, file);
};
const { VoicePCM } = require('../src/foodVoice/pcm.ts');
const model = require('../src/foodVoice/model.ts');
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const { orbContour } = require('../src/foodVoice/orbGeometry.ts');
check(orbContour(0,0)!==orbContour(1,0),'liquid silhouette moves even in silence');
check(orbContour(1,0)!==orbContour(1,1),'real volume deforms silhouette, not just internal texture');
check(orbContour(0,NaN)===orbContour(0,0),'invalid volume is safely quiet');
const contour=orbContour(2,1);check(contour.endsWith('Z')&&(contour.match(/C/g)||[]).length===12,'contour is one closed smooth shape');
for(const t of [0,1,2,3,4,5,6]){const coords=orbContour(t,1).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);check(coords.every(n=>Number.isFinite(n)&&n>=-10&&n<=210),'loud outline remains in viewport at phase '+t);}
// Reproduce the exact installed SVG parser warning from the user's screenshot.
const gradient=fs.readFileSync(require.resolve('react-native-svg/src/lib/extract/extractGradient.ts'),'utf8');
const parserCode=gradient.slice(gradient.indexOf('const percentReg'),gradient.indexOf('const offsetComparator'));
const warnings=[];const parser=require('node:vm').runInNewContext(ts.transpileModule(parserCode+'\npercentToFloat;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{console:{warn:m=>warnings.push(m)}});
parser('.48');check(warnings.length===1,'installed SVG parser reproduces old fractional-string warning');warnings.length=0;
const orbSource=fs.readFileSync(require.resolve('../src/foodVoice/VoiceOrb.tsx'),'utf8');
const offsets=[...orbSource.matchAll(/offset=\{([0-9.]+)\}/g)].map(m=>parser(Number(m[1])));
check(offsets.length>=20&&offsets.every(Number.isFinite)&&warnings.length===0&&!/offset="\./.test(orbSource),'all current stops accepted by actual installed SVG parser without warnings');
const food = (id, name, piece_g = null) => ({ id, name, piece_g, kcal: 100, protein: 10, fat: 3, carbs: 5, fiber: 0 });
check(model.rowHint({name:'тунец в собственном соку',candidates:[food(900,'Тунец в собственном соку')],ingredient_id:null})==='Выберите вариант','tuna hint never asks the liquid already spoken');
check(model.rowHint({name:'творог 5%',candidates:[food(900,'Творог 5%')],ingredient_id:null})==='Выберите вариант','fat already spoken is not asked twice');
const egg = food(1, 'Яйцо', 60), rice = food(2, 'Рис варёный'), dryRice = food(3, 'Рис сухой');
const row = { name: 'яйца', phrase: '2 яйца', quantity_text: '2 шт.', grams: 120, pieces: 2,
  weight_source: 'pieces', meal: null, ingredient_id: 1, candidates: [egg] };
for (const rate of [16000, 44100, 48000]) {
  const pcm = new VoicePCM();
  for (let k = 0; k < 10; k++) pcm.push(new Float32Array(rate / 10).fill(.25).buffer, rate, 1);
  const bytes = pcm.encode(), view = new DataView(bytes.buffer);
  check(bytes.length === 32000, `${rate}: exactly one second PCM16k`);
  check(view.getInt16(0, true) === 8192 && view.getInt16(bytes.length - 2, true) === 8192, `${rate}: little-endian amplitude and chunk boundaries`);
}
const bounded = new VoicePCM();
bounded.push(new Float32Array(48000 * 26).fill(2).buffer, 48000, 1);
check(bounded.seconds === 24 && bounded.encode().length === 768000, 'capture bounded at 24 seconds');
check(new DataView(bounded.encode().buffer).getInt16(0, true) === 32767, 'positive clipping');
const stereo = new VoicePCM(); stereo.push(new Float32Array([1, -1, 1, -1, ...Array(6400).fill(0)]).buffer, 16000, 2);
check(new DataView(stereo.encode().buffer).getInt16(0, true) === 0, 'stereo downmix');
assert.throws(() => new VoicePCM().encode()); checks++;
assert.throws(() => new VoicePCM().push(new ArrayBuffer(8), 0, 1)); checks++;
check(model.chooseFood(row, food(5, 'Без массы штуки')).grams === null, 'changing piece product clears stale grams');
check(model.applyAmount(row, 3, 'pc').grams === 180, 'catalog piece mass');
check(model.applyAmount(row, 90, 'g').pieces === null, 'manual grams clears stale piece count');
check(model.applyAmount(row, 0, 'g') === null && model.applyAmount(row, 101, 'pc') === null, 'invalid amounts rejected');
check(!model.readyToConfirm([row]), 'unknown meal blocks confirmation');
check(model.fillKnownMeal([row, { ...row, meal: 'snack2' }])[0].meal === 'snack2', 'known snack2 fills unknown without collapsing slots');
check(model.fillKnownMeal([row, { ...row, meal: 'snack1' }, { ...row, meal: 'snack2' }])[0].meal === null, 'different spoken meals preserved');

let audioBuffer, starts = 0, stops = 0, saved = 0, permission = async () => ({ granted: true });
let appState, calls = [], failAnalyze = false, holdConfirm = null;
let transportCalls = 0, transportFailure = false;
const files = new Map();
class File {
  constructor(base, name) { this.uri = name ? `${base.uri}/${name}` : base; }
  get name() { return this.uri.split('/').pop(); }
  get type() { return 'application/octet-stream'; }
  async bytes() { assert.ok(this.exists, 'file must still exist during serialization'); return files.get(this.uri); }
  get exists() { return files.has(this.uri); }
  create() { files.set(this.uri, new Uint8Array()); }
  write(data) { files.set(this.uri, data); }
  delete() { files.delete(this.uri); }
}
class FormDataDouble { _parts = []; get fields() { return this._parts; } }
// Exercise the installed SDK 57 implementation, not a permissive upload double.
const { installFormDataPatch } = require('../node_modules/expo/src/winter/FormData.ts');
const { convertFormDataAsync } = require('../node_modules/expo/src/winter/fetch/convertFormData.ts');
installFormDataPatch(FormDataDouble);
global.FormData = FormDataDouble;
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
const stream = { start: async () => { starts++; }, stop: () => { stops++; } };
const draft = { draft_id: 'a'.repeat(32), eaten_on: '2026-10-16', transcript: 'На обед рис сто грамм и два яйца',
  expires_in: 900, items: [{ ...row, source_index: 0, meal: 'lunch' }, { ...row, source_index: 1, name: 'рис', ingredient_id: null, candidates: [rice, dryRice], grams: 100, pieces: null, weight_source: 'voice', meal: 'lunch' }] };
const api = async (path, opt = {}) => {
  calls.push({ path, ...opt });
  if (path.endsWith('/preview')) return { text: 'рис 100 граммов', provisional: true };
  if (path.endsWith('/capabilities')) return { speech_available: true, text_available: true, refinement_available: true, live_preview_available: true, max_seconds: 25 };
  if (path.endsWith('/analyze')) {
    if (opt.body instanceof FormDataDouble) {
      check(opt.fileUpload === true, 'voice explicitly selects Expo file transport');
      const encoded = await convertFormDataAsync(opt.body);
      const payload = Buffer.from(encoded.body);
      const part = opt.body.fields.find(([name]) => name === 'audio')[1];
      check(part instanceof File, 'upload contains an actual File, never a URI descriptor');
      check(payload.includes(Buffer.from(await part.bytes())), 'real Expo serializer retains every PCM byte');
      check(payload.includes(Buffer.from('name="audio"; filename="')) && payload.includes(Buffer.from('name="request_key"')) && payload.includes(Buffer.from('name="eaten_on"')), 'multipart file and metadata headers serialized');
    }
    if (failAnalyze) { failAnalyze = false; throw new ApiError('Нет связи', 0); }
    const refinePart = opt.body instanceof FormDataDouble && opt.body.fields.find(([name]) => name === 'refine_json');
    if (refinePart) {
      const context = JSON.parse(refinePart[1]);
      check(context.scope === 1 && context.items[1].source_index === 1, 'focused voice correction carries current row identity');
      check(context.items[1].ingredient_id === rice.id && context.items[0].pieces === 2, 'manual product choices and other rows retained in correction context');
      return { ...structuredClone(draft), draft_id: 'b'.repeat(32), items: context.items.map((r, i) => ({ ...r, candidates: i ? [rice, dryRice] : [egg], grams: i === 1 ? 150 : r.grams })) };
    }
    return structuredClone(draft);
  }
  if (path.endsWith('/confirm')) {
    if (holdConfirm) await holdConfirm;
    return { items_count: opt.body.items.length };
  }
  if (path.includes('/search')) return { foods: [egg, rice, dryRice] };
  throw new Error('Unexpected API path ' + path);
};
const palette = new Proxy({ name: 'dark' }, { get: (o, k) => o[k] ?? '#aaaaaa' });
const originalLoad = Module._load;
Module._load = function(name, parent, ...rest) {
  if (name === './tokenStore' && parent?.filename.endsWith('/src/api.ts')) return { readToken: async () => null, writeToken: async () => {} };
  if (name === 'expo/fetch') return { fetch: async (_url, opt) => {
    transportCalls++;
    if (transportFailure) throw new Error('test upload transport failure');
    const encoded = await convertFormDataAsync(opt.body);
    check(encoded.body.length > 3200, 'actual API transport serializes PCM multipart');
    check(opt.headers.Authorization === 'Bearer disposable-qa-session', 'file transport retains existing authentication');
    check(!opt.headers['Content-Type'], 'fetch owns multipart boundary');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } };
  if (name === 'react-native-reanimated') return { __esModule: true, default: { View: 'AnimatedView' },
    ReduceMotion: { System: 'system' }, FadeIn: { duration: () => ({ reduceMotion: () => ({}) }) }, LinearTransition: { duration: () => ({ reduceMotion: () => ({}) }) } };
  if (name === 'react-native') return {
    AppState: { addEventListener: (_, fn) => { appState = fn; return { remove() {} }; } },
    KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView',
    Text: 'Text', TextInput: 'TextInput', View: 'View', Platform: { OS: 'ios' }, Linking: { openSettings() {} },
    useWindowDimensions: () => ({ width: 393, height: 852 }), StyleSheet: { absoluteFill: {}, hairlineWidth: .5 },
  };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) };
  if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle' };
  if (name === 'expo-blur') return { BlurView: 'BlurView' };
  if (name === 'expo-audio') return { AudioModule: { AudioStream: function() {} },
    requestRecordingPermissionsAsync: () => permission(), setAudioModeAsync: async () => {},
    useAudioStream: ({ onBuffer }) => { audioBuffer = onBuffer; return { stream }; } };
  if (name === 'expo-file-system') return { File, Paths: { cache: { uri: 'cache://' } } };
  if (parent?.filename.includes('/foodVoice/')) {
    if (name === '../api') return { api, ApiError, FOOD_MEALS: [['breakfast', 'Завтрак'], ['snack1', 'Перекус'], ['lunch', 'Обед'], ['snack2', 'Перекус'], ['dinner', 'Ужин']] };
    if (name === '../store') return { useApp: () => ({ p: palette }) };
    if (name === '../ui/Icon') return { Icon: 'Icon' };
    if (name === '../haptics') return { haptic: { tap() {}, select() {}, success() {} } };
    if (name === './VoiceOrb') return { VoiceOrb: 'VoiceOrb' };
  }
  return originalLoad.call(this, name, parent, ...rest);
};
const { FoodVoice } = require('../src/foodVoice/FoodVoice.tsx');
let tree;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const host = () => tree.root.findAllByType('Pressable');
const label = text => host().find(n => n.props.accessibilityLabel === text);
const textButton = text => host().find(n => n.findAllByType('Text').some(t => t.children.join('') === text));
async function tap(node) { assert.ok(node, 'button exists'); assert.ok(!node.props.disabled, 'button enabled'); await act(async () => { node.props.onPress(); }); await flush(); }
async function mount() {
  await act(async () => { tree = create(React.createElement(FoodVoice, { onSaved: () => saved++ })); });
  await tap(label('Записать еду голосом'));
}
function speak(seconds = 1) { audioBuffer({ data: new Float32Array(16000 * seconds).fill(.2).buffer, sampleRate: 16000, channels: 1, timestamp: 0 }); }

(async () => {
  const { VoicePreview } = require('../src/foodVoice/preview.ts');
  let previewResolve, previews=0, heard=[];
  const preview=new VoicePreview(async()=>{previews++;return new Promise(resolve=>{previewResolve=resolve})},text=>heard.push(text));
  preview.begin('a'.repeat(32));preview.tick(5,()=>new Uint8Array(10),true);preview.tick(7,()=>new Uint8Array(10),false);await flush();check(previews===0,'preview waits six seconds and server capability');
  preview.tick(6,()=>new Uint8Array(10),true);await flush();preview.tick(12,()=>new Uint8Array(10),true);await flush();check(previews===1,'only one preliminary request in flight');
  previewResolve('real speech');await flush();check(heard[0]==='real speech','preview displays provider text');
  preview.tick(12,()=>new Uint8Array(10),true);await flush();preview.cancel();previewResolve('late reply');await flush();check(heard.length===1,'cancel rejects stale text');
  preview.begin('b'.repeat(32));for(const second of [6,12,18,24]){preview.tick(second,()=>new Uint8Array(10),true);await flush();if(second<24){previewResolve('snapshot');await flush();}}check(previews===5,'at most three snapshots per new recording');
  let failed=0;const optional=new VoicePreview(async()=>{failed++;throw Error('offline')},()=>{});optional.begin('c'.repeat(32));optional.tick(6,()=>new Uint8Array(1),true);await flush();optional.tick(12,()=>new Uint8Array(1),true);await flush();check(failed===1,'preview failure never retries or blocks final audio');
  const legacy = new FormDataDouble(); legacy.append('audio', { uri: 'file:///voice.pcm', name: 'voice.pcm', type: 'application/octet-stream' });
  await assert.rejects(convertFormDataAsync(legacy), /Unsupported FormDataPart/); checks++;
  const actualApi = require('../src/api.ts');
  await actualApi.setToken('disposable-qa-session');
  const file = new File({ uri: 'cache://' }, 'transport.pcm'); file.create(); file.write(new Uint8Array(3200));
  const form = new FormDataDouble(); form.append('audio', file);
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('legacy fetch must not handle this File'); };
  try {
    check((await actualApi.api('/client/food-voice/analyze', { method: 'POST', body: form, fileUpload: true, retry: false })).ok, 'API selects explicit Expo transport');
    transportFailure = true;
    await assert.rejects(actualApi.api('/client/food-voice/analyze', { method: 'POST', body: form, fileUpload: true, retry: false }), e => e.message.includes('аудиозапись') && !e.message.includes('интернет')); checks++;
    check(transportCalls === 2, 'uploads are not retried automatically');
  } finally { global.fetch = oldFetch; transportFailure = false; file.delete(); }
  await mount();
  check(starts === 1, 'tap starts actual capture hook');
  check(!tree.root.findAllByType('Text').some(t=>['EQUA AI','Слушаю'].includes(t.children.join(''))),'recording has no branding or listening caption');
  await act(async () => speak(7));
  check(tree.root.findByType('VoiceOrb').props.level > 0, 'real PCM drives orb');
  check(label('Остановить запись').props.accessibilityValue.now===7,'record button exposes actual elapsed progress');
  check(tree.root.findAllByType('Text').find(n=>n.props.accessibilityLabel==='Предварительно распознанная речь').props.children==='рис 100 граммов','native recording displays actual preview response');
  await tap(label('Остановить запись'));
  check(!calls.some(c => c.path.endsWith('/analyze')), 'stop holds recording without sending');
  failAnalyze = true;
  await tap(label('Отправить запись'));
  check(files.size === 1, 'network failure retains PCM for explicit retry');
  const first = calls.find(c => c.path.endsWith('/analyze'));
  check(first.body instanceof FormDataDouble && first.body.fields.some(([k,v]) => k === 'audio' && v instanceof File && v.name.endsWith('.pcm')), 'voice uses PCM multipart, not a text substitute');
  check(files.values().next().value.length === 7 * 32000, 'reported seven-second recording is exactly 224000 PCM bytes');
  await tap(label('Отправить запись'));
  const attempts = calls.filter(c => c.path.endsWith('/analyze'));
  check(attempts[0].body.fields.find(x => x[0] === 'request_key')[1] === attempts[1].body.fields.find(x => x[0] === 'request_key')[1], 'network retry keeps idempotency key');
  check(files.size === 0, 'recognized audio removed from cache');
  check(textButton('Добавить 2 продукта').props.disabled, 'unresolved product blocks save');
  await tap(host().find(n => n.props.accessibilityLabel?.startsWith('рис,')));
  await tap(label('Рис варёный, выбрать'));
  check(!textButton('Добавить 2 продукта').props.disabled, 'inline choice resolves product');
  const analyzesBeforeCancel = calls.filter(c => c.path.endsWith('/analyze')).length;
  await tap(label('Уточнить список голосом'));
  await act(async () => speak());
  await tap(label('Вернуться к списку'));
  check(calls.filter(c => c.path.endsWith('/analyze')).length === analyzesBeforeCancel && !textButton('Добавить 2 продукта').props.disabled, 'cancel voice refinement restores resolved list without sending');
  await tap(host().find(n => n.props.accessibilityLabel?.startsWith('Рис варёный,')));
  await tap(label('Уточнить этот продукт голосом'));
  await act(async () => speak());
  await tap(label('Отправить запись'));
  check(host().some(n => n.props.accessibilityLabel?.startsWith('Рис варёный,')) && !textButton('Добавить 2 продукта').props.disabled, 'voice correction returns to complete valid list');
  await tap(host().find(n => n.props.accessibilityLabel?.startsWith('Яйцо,')));
  const input = tree.root.findByProps({ accessibilityLabel: 'Количество штук' });
  await act(async () => input.props.onChangeText('3'));
  await tap(textButton('Готово'));
  let release;
  holdConfirm = new Promise(r => { release = r; });
  await tap(textButton('Добавить 2 продукта'));
  check(!tree.root.findAllByType('Text').some(n => n.children.join('') === 'Записано'), 'no success before server confirmation');
  await act(async () => { release(); }); await flush(); holdConfirm = null;
  const confirmation = calls.find(c => c.path.endsWith('/confirm'));
  check(confirmation.body.items[0].grams === 180 && confirmation.body.items.every(r => r.meal === 'lunch'), 'confirm sends catalog grams and one meal');
  check(confirmation.body.items[1].grams === 150 && confirmation.body.items.every(r => Number.isInteger(r.source_index)), 'confirmed voice correction preserves source indices for personal learning');
  check(saved === 1, 'Today refresh only after confirmed save');
  check(tree.root.findAllByType('Text').some(n => n.children.join('') === 'Записано'), 'server-confirmed success');
  await tap(textButton('Готово'));
  await act(async () => tree.unmount());

  await mount(); await act(async () => speak());
  const beforeStop = stops;
  await act(async () => appState('background'));
  check(stops > beforeStop && label('Отправить запись'), 'background stops microphone and holds audio');
  await tap(label('Отменить запись'));
  check(files.size === 0, 'dismiss cleans temporary audio');
  await act(async () => tree.unmount());

  let grant;
  permission = () => new Promise(r => { grant = r; });
  const beforeStart = starts;
  await mount(); await tap(label('Отменить запись'));
  await act(async () => { grant({ granted: true }); }); await flush();
  check(starts === beforeStart, 'late permission never starts microphone after dismissal');
  await act(async () => tree.unmount());
  console.log(`PASS Expo voice: ${checks} checks (PCM, catalog units, native hook lifecycle, API flow and retries).`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
