/**
 * Экран «обновите приложение».
 *
 * Появляется, только если сервер прямо сказал, что эта версия больше не
 * работает: в старой сборке нашли поломку, из-за которой её нельзя
 * оставлять в руках у людей. Это не способ подгонять к обновлению —
 * человек за ним ничего сделать не может, поэтому экран показывает
 * единственную кнопку и объясняет, почему он здесь.
 *
 * Нет связи — экрана нет: сервер, до которого не достучались, ничего не
 * запрещал, и запирать человека из-за плохой сети нельзя.
 */
import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { APP_VERSION } from '../appConfig';

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { p, cfg } = useApp();
  if (!cfg.update_required) return <>{children}</>;

  const open = () => {
    if (cfg.store_url) Linking.openURL(cfg.store_url).catch(() => {});
  };

  return (
    <View style={{
      flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: S.xl, gap: S.md,
    }}>
      <View style={{
        width: 64, height: 64, borderRadius: 32, backgroundColor: p.primarySoft,
        alignItems: 'center', justifyContent: 'center', marginBottom: S.sm,
      }}>
        <Icon name="device" size={30} color={p.primary} width={2} />
      </View>

      <Text style={{ ...FONT.h2, color: p.text, textAlign: 'center' }}>
        Нужно обновить приложение
      </Text>
      <Text style={{ ...FONT.body, color: p.text3, textAlign: 'center' }}>
        В этой версии нашлась ошибка, из-за которой данные могут показываться
        неверно. Обновление уже в магазине — установите его, и всё продолжит
        работать как прежде.
      </Text>

      {cfg.store_url ? (
        <Pressable onPress={open} accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: 48, justifyContent: 'center', paddingHorizontal: S.xl,
            borderRadius: R.pill, backgroundColor: p.primary, marginTop: S.md,
            opacity: pressed ? 0.75 : 1,
          })}>
          <Text style={{ ...FONT.body, fontWeight: '700', color: '#fff' }}>
            Открыть магазин
          </Text>
        </Pressable>
      ) : (
        <Text style={{ ...FONT.small, color: p.text3, textAlign: 'center', marginTop: S.md }}>
          Обновите приложение через App Store или Google Play.
        </Text>
      )}

      <Text style={{ ...FONT.small, color: p.text3, marginTop: S.lg }}>
        У вас {APP_VERSION}, нужна {cfg.min_version} или новее
      </Text>
    </View>
  );
}
