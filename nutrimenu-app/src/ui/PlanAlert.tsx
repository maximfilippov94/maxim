/**
 * Полоса о состоянии плана — перенос `aiPlanBanner` из веба.
 *
 * Два случая, и оба до сих пор проходили мимо приложения, хотя сервер
 * отдаёт их в «Сегодня» и в «Неделе»:
 *
 *  • `ai_plan.ok === false` — сборка новой недели не завершилась.
 *    Прежнее меню осталось как было, и без объяснения человек видит
 *    старые блюда и считает, что приложение сломалось.
 *  • `menu_stale` — меню составлено на прошлую дату и на сегодня не
 *    рассчитано; показывается ближайший день плана.
 *
 * Кнопка перечитывает день мимо кэша: пересборку запускает сам сервер,
 * клиенту остаётся спросить заново.
 */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../store';
import { api, AiPlanState } from '../api';
import { S, R, FONT, alpha } from '../theme';
import { Icon } from './Icon';
import { SysButton } from './system';
import { dmy } from '../format';
import { haptic } from '../haptics';

export function PlanAlert({ plan, stale, startDate, canRetry, onRetry }: {
  plan?: AiPlanState | null;
  stale?: boolean;
  /** Дата начала меню — её называем в объяснении, как в вебе */
  startDate?: string | null;
  /** Кнопку «Обновить» показываем только с доступом к питанию EQUA AI */
  canRetry?: boolean;
  onRetry: () => void;
}) {
  const { p } = useApp();
  const [busy, setBusy] = useState(false);
  const failed = plan?.ok === false;
  if (!failed && !stale) return null;

  async function retry() {
    haptic.tap();
    setBusy(true);
    try { await api('/client/today', { noCache: true }); } catch { /* перечитаем ниже */ }
    finally { setBusy(false); onRetry(); }
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
      padding: S.lg, marginBottom: S.md, borderRadius: R.lg,
      backgroundColor: alpha(p.warn, 12), borderWidth: 1, borderColor: alpha(p.warn, 34),
    }}>
      <Icon name="info" size={19} color={p.warn} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...FONT.h3, color: p.text }}>
          {failed ? 'План не обновился' : 'План устарел'}
        </Text>
        <Text style={{ ...FONT.small, color: p.text2, marginTop: 3, lineHeight: 18 }}>
          {failed
            ? `${plan?.error || 'Сборка новой недели не завершилась.'} Прежнее меню осталось без изменений.`
            : `Меню составлено на ${startDate ? dmy(String(startDate).slice(0, 10)) : 'прошлую дату'}`
              + ' и на сегодня не рассчитано. Показываем ближайший день плана.'}
        </Text>
        {failed || canRetry ? (
          <View style={{ marginTop: S.md, alignSelf: 'flex-start' }}>
            <SysButton label={failed ? 'Повторить' : 'Обновить'} height={40}
              disabled={busy} onPress={retry} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
