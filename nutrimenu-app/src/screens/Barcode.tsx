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
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../store';
import { api, Food, MEAL_TITLES } from '../api';
import { round } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

/* Штрихкоды продуктов: EAN-13 и EAN-8 в Европе, UPC в Америке. Остальные
   типы (QR, Code-128) на упаковках еды не встречаются, и включать их
   значит ловить ложные срабатывания на чём попало. */
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
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateY: -30 + sweepAt.value * 60 }],
    opacity: 0.55 + sweepAt.value * 0.45,
  }));

  /* Рамка, которая цепляется за найденный код — как в банковских
     сканерах QR. Камера отдаёт границы кода уже в точках слоя превью:
     нативная часть прогоняет их через `transformedMetadataObject`
     (`MetaDataDelegate.swift:37`), так что пересчитывать ничего не надо
     — числа сразу в той системе координат, в которой мы рисуем.

     Держим их в разделяемых значениях, а не в состоянии: кадры идут
     десятками в секунду, и каждый вызвал бы перерисовку всего экрана.
     Так рамка живёт на своём потоке и не трогает React. */
  /* Какой объектив снимает — ради фокуса вблизи.
     Широкоугольная камера на новых iPhone резко видит примерно с
     двадцати сантиметров: поднесённый вплотную штрихкод остаётся
     размытым, сколько ни жди. Виртуальная камера — это несколько
     матриц под одним именем, и система сама переключается на
     ультраширокую, когда объект близко; это и есть макро.

     Выбираем её, когда устройство такую отдаёт, иначе остаётся
     прежняя. Ставил это раньше и убрал, не дождавшись проверки, —
     теперь понятно, что без неё вблизи фокуса не будет. */
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

  const box = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  const boxOn = useSharedValue(0);
  const lostAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hold = useCallback((b?: { origin?: { x: number; y: number };
                                  size?: { width: number; height: number } }) => {
    const x = b?.origin?.x, y = b?.origin?.y;
    const w = b?.size?.width, h = b?.size?.height;
    /* Границы бывают пустыми: документация честно предупреждает, что
       для части типов там либо ноль, либо область самого сканера. */
    if (x == null || y == null || !w || !h) return;
    /* Положение ставим разом и без сглаживания: код в кадре дрожит, и
       рамка должна дрожать вместе с ним, иначе она не «прилипла», а
       догоняет. Плавно меняется только видимость. */
    box.value = { x, y, w, h };
    boxOn.value = withTiming(1, { duration: 120 });
    /* Код ушёл из кадра — событий больше нет, и рамку надо убрать
       самим: иначе она застынет там, где кода давно нет. */
    if (lostAt.current) clearTimeout(lostAt.current);
    lostAt.current = setTimeout(() => {
      boxOn.value = withTiming(0, { duration: 220 });
    }, 500);
  }, [box, boxOn]);

  useEffect(() => () => { if (lostAt.current) clearTimeout(lostAt.current); }, []);

  const boxStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: box.value.x, top: box.value.y,
    width: box.value.w, height: box.value.h,
    opacity: boxOn.value,
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
  if (found) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Нашли" back onBack={() => { setFound(null); seen.current = null; }} />
        <View style={{ padding: S.lg, gap: S.md }}>
          <Card style={{ gap: 6 }}>
            <Text style={{ ...FONT.h3, fontSize: 17, color: p.text }}>{found.name}</Text>
            {found.brand ? <Muted>{found.brand}</Muted> : null}
            <Text style={{ ...FONT.body, color: p.text2, marginTop: 4 }}>
              {round(found.kcal)} ккал · Б {found.protein} Ж {found.fat} У {found.carbs} / 100 г
            </Text>
          </Card>
          <SysButton label="Записать в дневник" variant="prominent"
            onPress={() => { haptic.tap(); router.replace(`/food-log?meal=${meal}&code=${found.barcode ?? ''}`); }} />
          <SysButton label="Сканировать другой"
            onPress={() => { setFound(null); seen.current = null; }} />
        </View>
      </View>
    );
  }

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
        barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
        onBarcodeScanned={r => { hold(r.bounds); lookup(String(r.data)); }}
      />
      {/* Поверх кадра — тёмная подложка: белый текст на светлой кухне
          иначе не читается. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,
        { backgroundColor: 'rgba(12,17,24,0.45)' }]} />

      {/* Рамка, прилипшая к найденному коду. Прямоугольная и тонкая:
          штрихкод — узкая полоска, и скруглённые углы на такой высоте
          превращали рамку в овал. Координаты приходят в точках слоя
          превью, а он теперь во весь экран — значит это и есть
          координаты экрана. */}
      <Animated.View pointerEvents="none" style={[boxStyle, {
        borderWidth: 2.5, borderColor: p.primary, borderRadius: 3,
        backgroundColor: 'rgba(223,255,58,0.14)',
        shadowColor: p.primary, shadowOpacity: 0.8,
        shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
      }]} />

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

        {/* Рамка прицела: четыре уголка и бегущая линия — как в вебе.
            Лежит в потоке экрана, а кадр идёт фоном во всю высоту. */}
        <View style={{ height: 230, marginTop: S.lg, justifyContent: 'center' }}>
          <View style={StyleSheet.absoluteFill}>
            {([['tl', { top: 0, left: 0 }], ['tr', { top: 0, right: 0 }],
               ['bl', { bottom: 0, left: 0 }], ['br', { bottom: 0, right: 0 }]] as const)
              .map(([k, pos]) => (
                <View key={k} style={{
                  position: 'absolute', width: 54, height: 54, ...pos,
                  borderColor: p.primary,
                  borderTopWidth: k[0] === 't' ? 4 : 0,
                  borderBottomWidth: k[0] === 'b' ? 4 : 0,
                  borderLeftWidth: k[1] === 'l' ? 4 : 0,
                  borderRightWidth: k[1] === 'r' ? 4 : 0,
                  borderRadius: 6,
                }} />
              ))}
          </View>
          {/* Линия ходит вверх-вниз, как в вебе (`scan-sweep`): 2,3 с
              туда-обратно, со свечением. Неподвижная полоса читается
              как часть рамки, а движение говорит, что камера работает
              и ждёт код. «Уменьшение движения» в настройках телефона
              останавливает её — об этом заботится ReducedMotionConfig
              на корне приложения. */}
          <Animated.View style={[{
            height: 2, backgroundColor: p.primary, marginHorizontal: 28,
            shadowColor: p.primary, shadowOpacity: 0.6,
            shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
          }, sweep]} />
          <Text style={{
            position: 'absolute', left: 12, right: 12, bottom: 0,
            textAlign: 'center', fontSize: 11, color: '#fff',
          }}>
            Распознавание начнётся автоматически
          </Text>
        </View>

        {/* Состояние распознавания словами: человек должен понимать,
            ждёт камера код или уже ищет товар. */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
          marginTop: S.md, paddingVertical: 9, paddingHorizontal: 14,
          borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.08)',
        }}>
          <View style={{
            width: 9, height: 9, borderRadius: 5,
            backgroundColor: busy ? p.warn : p.primary,
          }} />
          <Text style={{ ...FONT.body, color: '#fff' }}>
            {busy ? 'Ищем продукт…' : 'Автопоиск включён'}
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
    </View>
  );
}
