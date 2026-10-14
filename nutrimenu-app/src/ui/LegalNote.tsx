/**
 * Строка согласия под кнопками входа и регистрации. Без неё нельзя ни в
 * App Store, ни по закону о персональных данных: человек должен видеть,
 * с чем соглашается, до того как нажмёт кнопку.
 */
import React from 'react';
import { Text, Pressable } from 'react-native';
import { S, FONT } from '../theme';
import { openLegal } from './legal';
import { haptic } from '../haptics';

export function LegalNote({ color = 'rgba(255,255,255,0.55)', link = 'rgba(255,255,255,0.85)' }: {
  color?: string; link?: string;
}) {
  const A = ({ doc, children }: { doc: 'terms' | 'privacy'; children: string }) => (
    <Text onPress={() => { haptic.tap(); openLegal(doc); }}
      style={{ color: link, textDecorationLine: 'underline' }}>{children}</Text>
  );
  return (
    <Text style={{
      ...FONT.small, fontSize: 11.5, lineHeight: 17, color,
      textAlign: 'center', marginTop: S.lg,
    }}>
      Продолжая, вы соглашаетесь с <A doc="terms">условиями использования</A> и{' '}
      <A doc="privacy">политикой конфиденциальности</A>, включая обработку данных о здоровье.
    </Text>
  );
}
