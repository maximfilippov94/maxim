/**
 * Вложения в переписке: снимок, видео и голосовое.
 *
 * Каждый вид показывается по-своему — картинка сразу открывается,
 * у видео есть системные кнопки, у голосового полоска заполняется по
 * ходу воспроизведения. Общий «файл со скрепкой» остаётся для всего
 * остального: лучше честная строка, чем пустой прямоугольник.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { attachKind, mediaUrl } from '../api';
import { haptic } from '../haptics';

const W = 232;

export function Attachment({ url, mine }: { url: string; mine: boolean }) {
  const kind = attachKind(url);
  const src = mediaUrl(url);
  if (!src) return null;
  if (kind === 'image') return <Photo src={src} />;
  if (kind === 'video') return <Clip src={src} />;
  if (kind === 'audio') return <Voice src={src} mine={mine} />;
  return <FileRow src={src} mine={mine} />;
}

function Photo({ src }: { src: string }) {
  const { p } = useApp();
  const [ratio, setRatio] = useState(0.75);
  return (
    <Pressable onPress={() => { haptic.tap(); Linking.openURL(src).catch(() => {}); }}>
      <Image
        source={{ uri: src }}
        onLoad={e => {
          const { width, height } = e.source ?? {};
          if (width && height) setRatio(Math.max(0.5, Math.min(1.6, width / height)));
        }}
        style={{ width: W, aspectRatio: ratio, borderRadius: R.md, backgroundColor: p.inset }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    </Pressable>
  );
}

function Clip({ src }: { src: string }) {
  const { p } = useApp();
  /* Ролик не запускаем сами: звук из чужого сообщения посреди
     разговора — последнее, чего ждёшь. */
  const player = useVideoPlayer(src, pl => { pl.loop = false; });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="cover"
      style={{ width: W, height: W * 1.2, borderRadius: R.md, backgroundColor: p.videoBg }}
    />
  );
}

/** «0:13» — длительность и позиция голосового. */
const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* Постоянный рисунок «волны»: настоящая огибающая требует разбора файла
   на устройстве, а для ориентира по времени хватает ровного узора —
   он одинаков у всех записей и не притворяется анализом звука. */
const BARS = [5, 9, 14, 20, 16, 11, 17, 22, 15, 9, 13, 19, 24, 18, 12, 8,
  14, 20, 16, 10, 15, 21, 17, 11, 7, 12, 18, 14, 9, 6];

function Voice({ src, mine }: { src: string; mine: boolean }) {
  const { p } = useApp();
  const player = useAudioPlayer(src);
  const st = useAudioPlayerStatus(player);
  const on = mine ? p.onPrimary : p.primary;
  const off = mine ? 'rgba(255,255,255,0.42)' : p.track;
  const done = st.duration ? Math.max(0, Math.min(1, st.currentTime / st.duration)) : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, width: W }}>
      <Pressable
        onPress={() => {
          haptic.tap();
          if (st.playing) player.pause();
          else { if (st.didJustFinish) player.seekTo(0); player.play(); }
        }}
        style={({ pressed }) => ({
          width: 38, height: 38, borderRadius: 19,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: mine ? 'rgba(255,255,255,0.22)' : p.primarySoft,
          transform: [{ scale: pressed ? 0.93 : 1 }],
        })}>
        <Icon name={st.playing ? 'pause' : 'play'} size={15} color={on} width={2} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 26 }}>
          {BARS.map((h, i) => (
            <View key={i} style={{
              flex: 1, height: h, borderRadius: 1,
              backgroundColor: i / BARS.length <= done ? on : off,
            }} />
          ))}
        </View>
        <Text style={{ ...FONT.small, color: mine ? 'rgba(255,255,255,0.75)' : p.text3, marginTop: 2 }}>
          {mmss(st.playing || st.currentTime ? st.currentTime : st.duration)}
        </Text>
      </View>
    </View>
  );
}

function FileRow({ src, mine }: { src: string; mine: boolean }) {
  const { p } = useApp();
  return (
    <Pressable onPress={() => { haptic.tap(); Linking.openURL(src).catch(() => {}); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <Icon name="clip" size={16} color={mine ? p.onPrimary : p.text2} />
      <Text style={{ ...FONT.body, color: mine ? p.onPrimary : p.text }}>Открыть файл</Text>
    </Pressable>
  );
}
