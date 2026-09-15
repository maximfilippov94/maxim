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
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../store';
import { api, Food } from '../api';
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

  const lookup = useCallback(async (code: string) => {
    if (seen.current === code || busy) return;
    seen.current = code;
    setBusy(true); setErr(null);
    haptic.tap();
    try {
      const j = await api<{ food: Food }>(`/client/foods/barcode/${code}`);
      haptic.success();
      setFound(j.food);
    } catch (e: any) {
      haptic.error();
      setErr(e?.message ?? 'Такого штрихкода не нашлось');
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

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
        onBarcodeScanned={({ data }) => lookup(String(data).replace(/\D+/g, ''))}
      />
      {/* Рамка прицела: без неё непонятно, куда подносить пачку. */}
      <View pointerEvents="none" style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: '74%', aspectRatio: 1.6, borderRadius: R.lg,
          borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
        }} />
        <Text style={{ ...FONT.body, color: '#fff', marginTop: S.lg, textAlign: 'center' }}>
          {busy ? 'Ищем товар…' : 'Наведите на штрихкод'}
        </Text>
        {err ? (
          <Text style={{ ...FONT.small, color: '#FFB4AE', marginTop: S.sm, textAlign: 'center',
            paddingHorizontal: S.xl }}>{err}</Text>
        ) : null}
      </View>

      <View style={{ position: 'absolute', left: S.lg, right: S.lg, bottom: insets.bottom + 24, gap: S.sm }}>
        <SysButton label="Ввести руками"
          onPress={() => { haptic.tap(); router.replace(`/food-log?meal=${meal ?? ''}`); }} />
      </View>
      <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}
        style={{ position: 'absolute', top: insets.top + 8, left: S.lg,
          width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Icon name="close" size={20} color="#fff" width={2.2} />
      </Pressable>
    </View>
  );
}
