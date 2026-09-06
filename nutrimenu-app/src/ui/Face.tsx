import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useApp } from '../store';

/** Фото человека, а если его нет — первая буква имени на подложке. */
export function Face({ url, name, size = 40 }: {
  url?: string | null; name: string; size?: number;
}) {
  const { p } = useApp();
  if (url) {
    return (
      <Image source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.inset }}
        contentFit="cover" transition={200} cachePolicy="memory-disk" />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: p.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: p.accent }}>
        {(name || '·').trim()[0]?.toUpperCase() ?? '·'}
      </Text>
    </View>
  );
}
