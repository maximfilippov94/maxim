import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useApp } from '../store';
import { mediaUrl } from '../api';

/**
 * Фото человека, а если его нет — первая буква имени на подложке.
 *
 * Адрес прогоняем через `mediaUrl`: сервер отдаёт путь относительный
 * («/api/v1/avatar/…»), а `Image` такой не грузит — показывался серый
 * кружок вместо снимка, причём везде сразу: шапка главного экрана,
 * чаты, списки клиентов, звонок. В профиле фото было видно только
 * потому, что там адрес собирали руками, минуя этот компонент.
 * Абсолютный адрес `mediaUrl` возвращает как есть, так что места,
 * которые уже собирали его сами, ничего не теряют.
 */
export function Face({ url, name, size = 40 }: {
  url?: string | null; name: string; size?: number;
}) {
  const { p } = useApp();
  const src = mediaUrl(url);
  if (src) {
    return (
      <Image source={{ uri: src }}
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
