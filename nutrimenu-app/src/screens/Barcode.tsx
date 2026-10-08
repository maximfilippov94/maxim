/**
 * Сканер штрихкода.
 *
 * Человек стоит у холодильника с пачкой в руке. Переписывать с этикетки
 * четыре числа — верный способ бросить дневник на третий день; штрихкод
 * снимает эту работу целиком: нашли товар — КБЖУ уже заполнено.
 *
 * Ищем по порядку: сначала свой справочник, потом Open Food Facts.
 * Не нашли — это не тупик: предлагаем завести продукт руками, уже с
 * запомненным штрихкодом.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, runOnUI,
  FadeIn, Easing,
} from 'react-native-reanimated';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../store';
import { api, Food, MEAL_TITLES } from '../api';
import { round } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

/* Штрихкоды продуктов: EAN-13 и EAN-8 в Европе, UPC в Америке. Остальные
   типы (QR, Code-128) на упаковках еды не встречаются, и включать их
   значит ловить ложные срабатывания на чём попало.

   Читает их на iOS системный AVFoundation. Второй распознаватель,
   ZXing, в expo-camera тоже есть, но подключён ровно к трём типам —
   `pdf417`, `code39`, `codabar` (`BarcodeScanner.swift:19`), и к нашим
   отношения не имеет. Подменить им системный нельзя. */
const TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function Barcode() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  const [perm, ask] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<Food | null>(null);
  /* Камера отдаёт один и тот же код десятки раз в секунду, пока пачка
     в кадре. Запрос отправляем один: без этой защёлки мы бы завалили
     сервер и мигали ответами. */
  const seen = useRef<string | null>(null);

  /* Код, который распознали или ввели руками, но не нашли в каталоге:
     по нему предлагаем завести продукт по этикетке — как в вебе. */
  const [missing, setMissing] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  /* Движение линии прицела. Значения из веба: 2,3 секунды на проход,
     от −30 до +30 точек, прозрачность от 0,55 до единицы. */
  const sweepAt = useSharedValue(0);
  useEffect(() => {
    sweepAt.value = withRepeat(
      withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.ease) }),
      -1, true);
  }, [sweepAt]);
  /* Какой объектив снимает — ради фокуса вблизи.
     Широкоугольная камера на новых iPhone резко видит примерно с
     двадцати сантиметров: поднесённый вплотную штрихкод остаётся
     размытым, сколько ни жди. Виртуальная камера — это несколько
     матриц под одним именем, и система сама переключается на
     ультраширокую, когда объект близко; это и есть макро. */
  const cam = useRef<CameraView>(null);
  const [lens, setLens] = useState<string | undefined>(undefined);
  const pickLens = useCallback(async () => {
    try {
      const list = await cam.current?.getAvailableLensesAsync();
      if (!list?.length) return;
      const best = ['builtInTripleCamera', 'builtInDualWideCamera', 'builtInDualCamera']
        .find(n => list.includes(n));
      if (best) setLens(best);
    } catch { /* нет такого на платформе — снимаем чем есть */ }
  }, []);

  /* Одна рамка на всё: она же прицел, она же захват.
     Раньше их было две — неподвижные уголки в середине и отдельная
     рамка, вспыхивавшая на коде. Человек видел два разных предмета
     там, где смысл один: «ищу здесь» и «нашёл вот это» — это одна
     рамка в двух состояниях, как в банковских сканерах.

     Границы кода камера отдаёт уже в точках слоя превью: нативная
     часть прогоняет их через `transformedMetadataObject`
     (`MetaDataDelegate.swift:37`). Слой — во весь экран, значит это
     прямо координаты экрана, пересчитывать нечего.

     Значения разделяемые, а не состояние: кадры идут десятками в
     секунду, и каждый вызвал бы перерисовку всего экрана. */
  const { width: winW, height: winH } = useWindowDimensions();
  /* Дежурное место рамки — там же, где прицел стоял раньше: по центру
     и выше середины, чтобы её не закрывала клавиатура ручного ввода.
     Пропорция под штрихкод: он шире, чем выше. */
  const idleW = Math.min(300, winW * 0.78);
  const idleH = idleW * 0.62;
  const idleX = (winW - idleW) / 2;
  const idleY = winH * 0.34;

  const fx = useSharedValue(idleX);
  const fy = useSharedValue(idleY);
  const fw = useSharedValue(idleW);
  const fh = useSharedValue(idleH);
  /* Держим ли код: от этого гаснет бегущая линия — когда код найден,
     искать больше нечего, и линия превращается в украшение. */
  const held = useSharedValue(0);
  /* То же самое, но на стороне JS: значения с потока анимаций читать
     отсюда ненадёжно, а решение «первый это захват или продолжение»
     принимается именно здесь. */
  const holding = useRef(false);
  const lostAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Короткая вспышка в миг захвата — то самое «как будто сняли фото».
     Говорит о случившемся быстрее любой подписи: глаз замечает смену
     яркости раньше, чем успевает прочитать слово. */
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  /* Мутации разделяемых значений уводим на поток анимаций одним
     куском: и правило линтера о неизменяемости молчит, и четыре
     значения меняются в одном кадре, а не по очереди. */
  const moveTo = useCallback((x: number, y: number, w: number, h: number, ms: number) => {
    runOnUI((nx: number, ny: number, nw: number, nh: number, d: number) => {
      'worklet';
      const o = { duration: d, easing: Easing.out(Easing.quad) };
      fx.value = withTiming(nx, o);
      fy.value = withTiming(ny, o);
      fw.value = withTiming(nw, o);
      fh.value = withTiming(nh, o);
      held.value = withTiming(1, { duration: 140 });
    })(x, y, w, h, ms);
  }, [fx, fy, fw, fh, held]);

  const release = useCallback(() => {
    holding.current = false;
    runOnUI((nx: number, ny: number, nw: number, nh: number) => {
      'worklet';
      const o = { duration: 260, easing: Easing.out(Easing.quad) };
      fx.value = withTiming(nx, o);
      fy.value = withTiming(ny, o);
      fw.value = withTiming(nw, o);
      fh.value = withTiming(nh, o);
      held.value = withTiming(0, { duration: 200 });
    })(idleX, idleY, idleW, idleH);
  }, [fx, fy, fw, fh, held, idleX, idleY, idleW, idleH]);

  const hold = useCallback((b?: { origin?: { x: number; y: number };
                                  size?: { width: number; height: number } }) => {
    const x = b?.origin?.x, y = b?.origin?.y;
    const w = b?.size?.width, h = b?.size?.height;
    /* Границы бывают пустыми: документация честно предупреждает, что
       для части типов там либо ноль, либо область самого сканера. */
    if (x == null || y == null || !w || !h) return;
    /* Рамке есть куда сесть, но садиться вплотную к полоскам тесно —
       оставляем вокруг кода немного воздуха. */
    const pad = 10;
    /* Первый раз — переезд за две десятых секунды, он и читается как
       «села на код». Дальше код дрожит в кадре вместе с рукой, и
       рамка должна дрожать с ним: почти мгновенно, иначе она не
       прилипла, а догоняет. */
    const first = !holding.current;
    holding.current = true;
    if (first) {
      runOnUI(() => {
        'worklet';
        flash.value = withSequence(
          withTiming(0.4, { duration: 80 }),
          withTiming(0, { duration: 260 }));
      })();
    }
    moveTo(x - pad, y - pad, w + pad * 2, h + pad * 2, first ? 200 : 60);
    if (lostAt.current) clearTimeout(lostAt.current);
    lostAt.current = setTimeout(release, 600);
  }, [moveTo, release, flash]);

  useEffect(() => () => { if (lostAt.current) clearTimeout(lostAt.current); }, []);

  const frameStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: fx.value, top: fy.value, width: fw.value, height: fh.value,
  }));
  /* Линия живёт, пока рамка ищет, и гаснет, когда села на код. */
  const lineStyle = useAnimatedStyle(() => ({
    opacity: (1 - held.value) * (0.55 + sweepAt.value * 0.45),
    transform: [{ translateY: -30 + sweepAt.value * 60 }],
  }));

  const lookup = useCallback(async (code: string) => {
    const c = String(code ?? '').replace(/\D+/g, '');
    /* Восемь цифр — короче штрихкодов не бывает. Проверяем до запроса,
       как веб: иначе на каждую опечатку уходит обращение к серверу. */
    if (c.length < 8) {
      haptic.error();
      setErr('В штрихкоде должно быть не меньше 8 цифр.');
      return;
    }
    if (seen.current === c || busy) return;
    seen.current = c;
    setBusy(true); setErr(null); setMissing(null);
    haptic.tap();
    try {
      const j = await api<{ food: Food }>(`/client/foods/barcode/${c}`, { noCache: true });
      haptic.success();
      setFound(j.food);
    } catch (e: any) {
      haptic.error();
      /* Товара нет в каталоге — это не ошибка, а развилка: искать по
         названию или завести по этикетке. Остальные сбои — ошибка. */
      if (e?.status === 404) setMissing(c);
      else setErr(e?.message ?? 'Не удалось найти продукт');
      /* Даём отсканировать ещё раз — вдруг просто смазало. */
      setTimeout(() => { seen.current = null; }, 1500);
    } finally { setBusy(false); }
  }, [busy]);

  if (!perm) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Штрихкод" back />
        <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Штрихкод" back />
        <View style={{ padding: S.lg, gap: S.md }}>
          <Text style={{ ...FONT.h2, color: p.text }}>Нужен доступ к камере</Text>
          <Muted>
            Камера нужна только чтобы прочитать штрихкод с упаковки. Снимки никуда
            не сохраняются и не отправляются.
          </Muted>
          {perm.canAskAgain ? (
            <SysButton label="Разрешить" variant="prominent" onPress={() => { haptic.tap(); ask(); }} />
          ) : (
            <SysButton label="Открыть настройки" onPress={() => Linking.openSettings()} />
          )}
          <SysButton label="Ввести штрихкод руками"
            onPress={() => { haptic.tap(); router.replace(`/food-log?meal=${meal ?? ''}`); }} />
        </View>
      </View>
    );
  }

  /* Товар найден — показываем, что именно, прежде чем класть в дневник:
     штрихкод мог прочитаться с соседней пачки. */
  const mealTitle = MEAL_TITLES[meal ?? ''] ?? 'Приём пищи';
  const toSearch = () => { haptic.tap(); router.replace(`/food-log?meal=${meal ?? ''}`); };

  return (
    <View style={{ flex: 1, backgroundColor: '#0C1118' }}>
      {/* Кадр во всю высоту экрана — как было и как делают банковские
          сканеры. Да, превью у iOS всегда `resizeAspectFill`
          (`CameraView.swift:174`), и по бокам часть кадра уходит за
          край; распознаванию это не мешает — оно читает полный кадр,
          `rectOfInterest` не задан. */}
      <CameraView
        ref={cam}
        style={StyleSheet.absoluteFill}
        facing="back"
        selectedLens={lens}
        onCameraReady={pickLens}
        /* Разрешение кадра, из которого читает сканер. По умолчанию
           expo-camera ставит `high` (`CameraView.swift:84`), а это на
           iPhone 1280×720. Штрихкоду этого мало: он из узких полосок,
           и на мелкой этикетке они в такой кадр просто не разрешаются
           — приходится подносить ближе, а ближе камера уже не
           фокусируется. QR в банковском сканере крупный и читается
           даже в 720p, отсюда и разница в ощущениях.
           1920×1080 даёт втрое больше точек на ту же этикетку.

           На Android настройка касается только съёмки фото: там
           штрихкоды читает Google MLKit, и его анализатор и так берёт
           наибольшее доступное разрешение
           (`HIGHEST_AVAILABLE_STRATEGY`, `ExpoCameraView.kt:489`).
           Несуществующий размер тоже не беда — выбирается ближайший.
           Выходит, вся эта возня — про iOS. */
        pictureSize="1920x1080"
        barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
        onBarcodeScanned={r => { hold(r.bounds); lookup(String(r.data)); }}
      />
      {/* Поверх кадра — тёмная подложка: белый текст на светлой кухне
          иначе не читается. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,
        { backgroundColor: 'rgba(12,17,24,0.45)' }]} />

      {/* Та самая единственная рамка: четыре уголка и бегущая линия.
          Пока кода нет — стоит в дежурном месте и ищет; нашла —
          переезжает на код и обводит его. Лежит в абсолютном слое над
          кадром, а не в потоке экрана: иначе ей некуда было бы ехать —
          поток прокручивается вместе с текстом, а код живёт в
          координатах кадра. */}
      <Animated.View pointerEvents="none" style={frameStyle}>
        {([['tl', { top: 0, left: 0 }], ['tr', { top: 0, right: 0 }],
           ['bl', { bottom: 0, left: 0 }], ['br', { bottom: 0, right: 0 }]] as const)
          .map(([k, pos]) => (
            <View key={k} style={{
              position: 'absolute', width: 26, height: 26, ...pos,
              borderColor: p.primary,
              borderTopWidth: k[0] === 't' ? 3 : 0,
              borderBottomWidth: k[0] === 'b' ? 3 : 0,
              borderLeftWidth: k[1] === 'l' ? 3 : 0,
              borderRightWidth: k[1] === 'r' ? 3 : 0,
              borderRadius: 4,
            }} />
          ))}
        {/* Линия ходит вверх-вниз, как в вебе (`scan-sweep`): 2,3 с
            туда-обратно, со свечением. Неподвижная полоса читалась бы
            как часть рамки, а движение говорит, что камера работает и
            ждёт код; когда код найден, линия гаснет — искать больше
            нечего. «Уменьшение движения» в настройках телефона
            останавливает её: об этом заботится ReducedMotionConfig
            на корне приложения. */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View style={[{
            height: 2, backgroundColor: p.primary, marginHorizontal: 18,
            shadowColor: p.primary, shadowOpacity: 0.6,
            shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
          }, lineStyle]} />
        </View>
      </Animated.View>

      {/* Вспышка захвата. Поверх кадра, но под содержимым: она про
          камеру, а не про интерфейс. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
        { backgroundColor: '#fff' }, flashStyle]} />

      <ScrollView contentContainerStyle={{
        paddingTop: insets.top + S.md, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + S.xl,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Шапка: какой приём пищи и куда это кладётся */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.label, color: 'rgba(255,255,255,0.62)' }}>
              {mealTitle.toUpperCase()}
            </Text>
            <Text style={{ ...FONT.h1, color: '#fff', marginTop: 2 }}>Добавить еду</Text>
          </View>
          <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Закрыть сканер"
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22, alignItems: 'center',
              justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}>
            <Icon name="close" size={20} color="#fff" width={2.2} />
          </Pressable>
        </View>

        {/* Возврат к поиску по названию — первый выход, если кода нет */}
        <Pressable onPress={toSearch}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            marginTop: S.md, paddingVertical: 9, paddingHorizontal: 14,
            borderRadius: R.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
            opacity: pressed ? 0.6 : 1,
          })}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevr" size={15} color="#fff" />
          </View>
          <Text style={{ ...FONT.body, color: '#fff' }}>К поиску</Text>
        </Pressable>

        <View style={{ marginTop: S.lg }}>
          <Text style={{ ...FONT.label, color: 'rgba(255,255,255,0.62)' }}>СКАНЕР ПРОДУКТОВ</Text>
          <Text style={{ ...FONT.h2, color: '#fff', marginTop: 2 }}>Наведите на штрихкод</Text>
          <Text style={{ ...FONT.body, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            Держите упаковку ровно, чтобы код попал в рамку
          </Text>
        </View>

        {/* Место, которое занимала рамка прицела: сама рамка теперь
            живёт над кадром и переезжает к коду, а здесь остаётся
            пустота ровно её высоты — чтобы текст ниже не наезжал. */}
        <View pointerEvents="none" style={{ height: 230, marginTop: S.lg,
          justifyContent: 'flex-end' }}>
          <Text style={{ textAlign: 'center', fontSize: 11, color: '#fff' }}>
            Распознавание начнётся автоматически
          </Text>
        </View>

        {/* Ручной ввод: код бывает стёрт, а цифры под ним читаются */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.xl }}>
          <Text style={{ ...FONT.h3, color: '#fff' }}>Штрихкод</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <Text style={{ ...FONT.small, color: 'rgba(255,255,255,0.72)' }}>
            или введите код вручную
          </Text>
        </View>
        <TextInput
          value={typed}
          onChangeText={v => { setTyped(v.replace(/\D+/g, '').slice(0, 20)); setErr(null); }}
          keyboardType="number-pad"
          placeholder="Например, 4610401523495"
          placeholderTextColor="rgba(12,17,24,0.45)"
          accessibilityLabel="Штрихкод"
          style={{
            marginTop: S.sm, backgroundColor: '#fff', color: '#0C1118',
            borderRadius: R.lg, paddingHorizontal: S.xl, paddingVertical: 16, fontSize: 17,
          }} />

        {err ? (
          <Text style={{ ...FONT.small, color: '#FFB4AE', marginTop: S.sm }}>{err}</Text>
        ) : null}

        {/* Кода нет в каталоге — две дороги, как в вебе */}
        {missing ? (
          <View style={{
            marginTop: S.md, padding: S.lg, borderRadius: R.lg,
            backgroundColor: 'rgba(12,17,24,0.72)', gap: S.sm,
          }}>
            <Text style={{ ...FONT.h3, color: '#fff' }}>Штрихкод распознан</Text>
            <Text style={{ ...FONT.small, color: 'rgba(255,255,255,0.72)' }}>
              Товар {missing} пока не найден в каталоге.
            </Text>
            <View style={{ gap: S.sm, marginTop: S.xs }}>
              <SysButton label="Найти по названию" height={44} onPress={toSearch} />
              <SysButton label="Добавить по этикетке" height={44}
                onPress={() => {
                  haptic.tap();
                  router.replace(`/food-log?meal=${meal ?? ''}&code=${missing}`);
                }} />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: S.lg }}>
          <SysButton label="Найти продукт" variant="prominent"
            disabled={busy} onPress={() => lookup(typed)} />
        </View>

        <Text style={{
          ...FONT.small, color: 'rgba(255,255,255,0.6)',
          textAlign: 'center', marginTop: S.lg,
        }}>
          Камера используется только для считывания кода
        </Text>
      </ScrollView>

      {/* Нашли — показываем прямо здесь, не уводя с экрана. Раньше
          приложение улетало на отдельную страницу, и рамка, только что
          севшая на код, исчезала вместе с кадром. Теперь камера
          работает дальше, рамка держит код, а карточка ложится снизу:
          видно и что поймали, и на чём оно поймано. */}
      {found ? (
        <Animated.View entering={FadeIn.duration(180)} style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: S.lg, paddingTop: S.lg,
          paddingBottom: insets.bottom + S.lg, gap: S.md,
          backgroundColor: 'rgba(12,17,24,0.94)',
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
        }}>
          <View style={{ gap: 4 }}>
            <Text style={{ ...FONT.label, color: 'rgba(255,255,255,0.62)' }}>НАШЛИ</Text>
            <Text style={{ ...FONT.h3, fontSize: 18, color: '#fff' }}>{found.name}</Text>
            {found.brand ? (
              <Text style={{ ...FONT.small, color: 'rgba(255,255,255,0.72)' }}>
                {found.brand}
              </Text>
            ) : null}
            <Text style={{ ...FONT.body, color: 'rgba(255,255,255,0.86)', marginTop: 2 }}>
              {round(found.kcal)} ккал · Б {found.protein} Ж {found.fat} У {found.carbs} / 100 г
            </Text>
          </View>
          <SysButton label="Записать в дневник" variant="prominent"
            onPress={() => {
              haptic.tap();
              router.replace(`/food-log?meal=${meal}&code=${found.barcode ?? ''}`);
            }} />
          <SysButton label="Сканировать другой" height={44}
            onPress={() => { haptic.tap(); setFound(null); seen.current = null; }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
