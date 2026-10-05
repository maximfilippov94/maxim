/**
 * Кадры упражнения с листанием пальцем — то же, что в вебе: у упражнения
 * два снимка, начало и конец движения, и переключаются они свайпом
 * (`woPhotoSwipeStart` и `.wo-run-dots` в `app.js`).
 *
 * Листаем обычной горизонтальной прокруткой со страницами, а не
 * `PagerView`: внутри модального листа тот отдавал пустую серую область —
 * страница у него оставалась нулевой высоты, и снимка не было вовсе.
 * Ширину страницы берём замером контейнера: проценты внутри прокрутки
 * считаются от содержимого, а не от окна.
 */
import React, { useState } from 'react';
import { View, ScrollView, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { useApp } from '../store';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export function PhotoSwipe({ shots, radius = 0, fallbackIcon = 'dumbbell' }: {
  /** Готовые адреса кадров: один — просто снимок, два — листаются */
  shots: string[];
  radius?: number;
  fallbackIcon?: string;
}) {
  const { p } = useApp();
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / w);
    if (next !== i) { haptic.select(); setI(next); }
  };

  if (!shots.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={fallbackIcon} size={44} color={p.text3} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, borderRadius: radius, overflow: 'hidden' }} onLayout={onLayout}>
      {/* Пока ширина не измерена, показываем первый кадр: пустая серая
          область на долю секунды читается как «фото не загрузилось». */}
      {w === 0 ? (
        <Image source={{ uri: shots[0] }} style={{ width: '100%', height: '100%' }}
          contentFit="cover" transition={200} />
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={shots.length > 1}
          onMomentumScrollEnd={onEnd}
          style={{ flex: 1 }}>
          {shots.map(u => (
            <Image key={u} source={{ uri: u }} style={{ width: w, height: '100%' }}
              contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ))}
        </ScrollView>
      )}

      {shots.length > 1 ? (
        <View style={{
          position: 'absolute', bottom: 10, alignSelf: 'center',
          flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 6,
          borderRadius: 999, backgroundColor: 'rgba(9,16,22,0.52)',
        }} pointerEvents="none">
          {shots.map((u, k) => (
            <View key={u} style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: k === i ? '#fff' : 'rgba(255,255,255,0.42)',
            }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
