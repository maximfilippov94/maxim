import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useApp } from '../store';
import { api, Gamification, GamReward, ClientTask } from '../api';
import { uploadForm } from '../upload';
import { pickPhoto, shootPhoto } from '../photo';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted, Bar } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, SysConfirm } from '../ui/system';
import { plural, dmy } from '../format';
import { Loading, Fail } from './Shopping';
import { haptic } from '../haptics';

export default function Rewards() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [g, setG] = useState<Gamification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* Задание, которое сейчас закрывают: держим отдельно, чтобы окно
     отчёта не перерисовывало весь экран на каждую букву. */
  const [doing, setDoing] = useState<ClientTask | null>(null);

  const load = useCallback(async () => {
    try { setG(await api<Gamification>('/client/gamification')); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const redeem = useCallback(async (r: GamReward) => {
    setNote(null);
    try {
      const j = await api<{ code?: string }>('/client/redeem', {
        method: 'POST', body: { reward_id: r.id },
      });
      haptic.success();
      /* Код нужен, чтобы специалист сверил обмен: привилегию выдаёт он,
         а не сервис. */
      setNote(j.code ? `Код обмена ${j.code} — назовите его специалисту` : 'Готово');
      await load();
    } catch (e: any) { haptic.error(); setNote(e?.message ?? 'Не удалось обменять'); }
  }, [load]);

  if (err) return <Fail title="Награды и баллы" text={err} />;
  if (!g) return <Loading title="Награды и баллы" />;

  const span = Math.max(1, g.level_next - g.level_base);
  const inLevel = Math.max(0, Math.min(1, (g.earned - g.level_base) / span));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Награды и баллы" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false}>

        {/* Баланс и уровень: одна карточка отвечает на «сколько у меня»
            и «сколько до следующего» — дальше уже подробности. */}
        <Animated.View entering={FadeInDown.duration(240)}>
          <Card style={{ marginTop: S.md, marginBottom: S.md }}>
            <Label>Баллы</Label>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
              <Text style={{ ...FONT.num, color: p.text }}>{g.balance}</Text>
              <Muted style={{ marginLeft: 6 }}>всего заработано {g.earned}</Muted>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.lg }}>
              <View style={{
                paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.sm,
                backgroundColor: p.primarySoft,
              }}>
                <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent }}>
                  Ур. {g.level}
                </Text>
              </View>
              <Text style={{ ...FONT.h3, color: p.text }}>{g.level_title}</Text>
            </View>
            <View style={{ marginTop: S.md }}><Bar value={inLevel} /></View>
            <Muted style={{ marginTop: S.sm }}>
              {g.earned} / {g.level_next} до следующего уровня
            </Muted>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(240)}
          style={{ flexDirection: 'row', gap: S.md, marginBottom: S.md }}>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="flame" size={15} color={p.mf} />
              <Label>Серия</Label>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: p.text, marginTop: 3 }}>
              {g.streak}
            </Text>
            <Muted>{plural(g.streak, ['день', 'дня', 'дней'])} подряд</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={15} color={p.mp} />
              <Label>Идеальных дней</Label>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: p.text, marginTop: 3 }}>
              {g.perfect_days}
            </Text>
            <Muted>без пропусков</Muted>
          </Card>
        </Animated.View>

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
          Задания дня
        </Text>
        <Card style={{ padding: 0, marginBottom: S.md }}>
          {g.tasks.map((t, i) => (
            <View key={t.key} style={{
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              paddingVertical: 12, paddingHorizontal: S.lg,
              borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.done ? p.primary : 'transparent',
                borderWidth: t.done ? 0 : 1.5, borderColor: p.track,
              }}>
                {t.done ? <Icon name="check" size={12} color={p.onPrimary} width={2.6} /> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: t.done ? p.text3 : p.text }}>
                {t.label}
              </Text>
              {t.progress ? <Muted style={{ marginRight: 8 }}>{t.progress}</Muted> : null}
              <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent }}>
                +{t.reward}
              </Text>
            </View>
          ))}
        </Card>

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
          Достижения
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginBottom: S.md }}>
          {g.achievements.map(a => (
            <Card key={a.key} style={{ width: '47.5%', alignItems: 'center', paddingVertical: S.lg }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20, marginBottom: S.sm,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.unlocked ? p.primarySoft : p.inset,
              }}>
                <Icon name={a.icon} size={19} color={a.unlocked ? p.primary : p.text3} />
              </View>
              <Text numberOfLines={1} style={{
                ...FONT.h3, color: a.unlocked ? p.text : p.text3, textAlign: 'center',
              }}>{a.label}</Text>
              <Muted style={{ textAlign: 'center', marginTop: 2 }}>{a.hint}</Muted>
            </Card>
          ))}
        </View>

        {/* Личные задания специалиста. У них своя судьба — срок,
            фотоотчёт, отмена — поэтому они не сворачиваются в ежедневные. */}
        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
          Задания специалиста
        </Text>
        {g.personal_tasks?.length ? (
          <Card style={{ padding: 0, marginBottom: S.md }}>
            {g.personal_tasks.map((t, i) => (
              <View key={t.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: S.md,
                paddingVertical: 12, paddingHorizontal: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, color: t.status === 'done' ? p.text3 : p.text }}>
                    {t.title}
                  </Text>
                  <Muted style={{ marginTop: 2 }} numberOfLines={2}>
                    {[t.kind === 'photo' ? 'с фотоотчётом' : null,
                      `${t.points} баллов`,
                      t.due_on && t.status !== 'done' ? `до ${dmy(t.due_on)}` : null,
                     ].filter(Boolean).join(' · ')}
                  </Muted>
                  {t.note ? <Muted numberOfLines={2}>{t.note}</Muted> : null}
                </View>
                {t.photo_url ? (
                  <Image source={{ uri: t.photo_url }}
                    style={{ width: 40, height: 40, borderRadius: R.sm, backgroundColor: p.inset }}
                    contentFit="cover" />
                ) : null}
                {t.status === 'done' ? (
                  <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent }}>
                    +{t.points}
                  </Text>
                ) : (
                  <Pressable onPress={() => setDoing(t)} hitSlop={6}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
                      backgroundColor: p.primary, opacity: pressed ? 0.7 : 1,
                    })}>
                    <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>
                      {t.kind === 'photo' ? 'Отчёт' : 'Готово'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        ) : (
          <Card style={{ marginBottom: S.md }}>
            <Muted style={{ lineHeight: 19 }}>Личных заданий пока нет.</Muted>
          </Card>
        )}

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
          Обменять баллы
        </Text>
        {note ? (
          <Card style={{ marginBottom: S.md }}>
            <Text style={{ ...FONT.body, color: p.text }}>{note}</Text>
          </Card>
        ) : null}
        {g.rewards.length === 0 ? (
          <Card style={{ marginBottom: S.md }}>
            <Muted style={{ lineHeight: 19 }}>
              Специалист пока не назначил, на что можно обменять баллы.
            </Muted>
          </Card>
        ) : null}
        <Card style={{ padding: 0, marginBottom: S.md, display: g.rewards.length ? 'flex' : 'none' }}>
          {g.rewards.map((r, i) => {
            const can = g.balance >= r.cost;
            return (
              <View key={r.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: S.md,
                paddingVertical: 12, paddingHorizontal: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: can ? p.text : p.text3 }}>{r.label}</Text>
                  <Muted style={{ marginTop: 2 }}>
                    {[r.note, `${r.cost} баллов`].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
                {can ? (
                  <SysConfirm
                    label="Обменять"
                    tint={p.primary}
                    destructive={false}
                    title={r.label}
                    message={`Спишем ${r.cost} баллов и выдадим код обмена — назовите его специалисту.`}
                    confirmLabel="Обменять"
                    onConfirm={() => redeem(r)}
                  />
                ) : (
                  <Muted>не хватает {r.cost - g.balance}</Muted>
                )}
              </View>
            );
          })}
        </Card>

        {g.redemptions.length ? (
          <>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
              Мои коды обмена
            </Text>
            <Card style={{ padding: 0, marginBottom: S.md }}>
              {g.redemptions.map((r, i) => (
                <View key={r.code + i} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 12, paddingHorizontal: S.lg,
                  borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: p.text }}>{r.code}</Text>
                    <Muted numberOfLines={1}>{r.title ?? 'Привилегия'}</Muted>
                  </View>
                  <Muted>{r.status === 'used' ? 'использован' : 'активен'}</Muted>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Muted style={{ marginTop: S.sm, lineHeight: 18 }}>
          Баллы начисляются за отмеченные приёмы пищи, дни без пропусков,
          записанный вес и выполненные задания специалиста.
        </Muted>
      </ScrollView>

      <TaskSheet task={doing} onClose={() => setDoing(null)}
        onDone={() => { setDoing(null); load(); }} />
    </View>
  );
}

/**
 * Закрытие задания.
 *
 * Задание с фотоотчётом без снимка не закрывается — в этом и был смысл:
 * специалист хочет увидеть результат, а не галочку. Снимок можно и
 * сделать на месте, и выбрать из галереи: приготовленное блюдо
 * фотографируют сразу, а сданные анализы — уже готовым файлом.
 */
function TaskSheet({ task, onClose, onDone }: {
  task: ClientTask | null; onClose: () => void; onDone: () => void;
}) {
  const { p } = useApp();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setComment(''); setErr(null); }, [task?.id]);
  if (!task) return null;
  const needPhoto = task.kind === 'photo';

  async function send(withCamera?: boolean) {
    if (!task) return;
    setBusy(true); setErr(null);
    try {
      if (needPhoto) {
        const file = withCamera ? await shootPhoto() : await pickPhoto();
        if (!file) { setBusy(false); return; }
        await uploadForm(`/client/tasks/${task.id}/done`, file, 'photo', { comment });
      } else {
        await api(`/client/tasks/${task.id}/done`, { method: 'POST', body: { comment } });
      }
      haptic.success(); onDone();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не отправилось'); }
    finally { setBusy(false); }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{
          backgroundColor: p.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
          padding: S.lg, paddingBottom: S.xl + 12, gap: S.md,
        }}>
          <Text style={{ ...FONT.h3, color: p.text }}>{task.title}</Text>
          {task.note ? <Muted style={{ lineHeight: 19 }}>{task.note}</Muted> : null}

          <TextInput value={comment} onChangeText={setComment} multiline
            placeholder="Как прошло" placeholderTextColor={p.text3}
            style={{
              minHeight: 80, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15, lineHeight: 21,
              textAlignVertical: 'top',
            }} />

          {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
          {busy ? <ActivityIndicator color={p.primary} /> : null}

          {needPhoto ? (
            <View style={{ gap: S.sm }}>
              <SysButton label="Снять сейчас" icon="camera" variant="prominent"
                disabled={busy} onPress={() => send(true)} />
              <SysButton label="Выбрать из галереи" icon="photo"
                disabled={busy} onPress={() => send(false)} />
            </View>
          ) : (
            <SysButton label="Задание выполнено" icon="checkmark" variant="prominent"
              disabled={busy} onPress={() => send()} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
