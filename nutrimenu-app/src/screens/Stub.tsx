import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { S, FONT } from '../theme';
import { Muted, Card } from '../ui/base';

/** Заглушка для экранов, до которых ещё не дошли. */
export default function Stub({ title, note }: { title: string; note: string }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 110 }}>
      <Text style={{ ...FONT.h1, color: p.text, marginBottom: S.lg }}>{title}</Text>
      <Card><Muted style={{ lineHeight: 19 }}>{note}</Muted></Card>
      <View style={{ height: 600 }} />
    </ScrollView>
  );
}
