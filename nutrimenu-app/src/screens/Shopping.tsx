import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, ShoppingResponse, ShoppingItem } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead } from '../ui/List';
import { Icon } from '../ui/Icon';
import { Bar } from '../ui/base';
import { Empty, SysConfirm, sysNative } from '../ui/system';
import { plural } from '../format';
import { haptic } from '../haptics';

export default function Shopping() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ShoppingResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<ShoppingResponse>('/client/shopping')); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Отметка ставится сразу, а запрос идёт следом: если сервер откажет —
     возвращаем как было. Ждать сеть ради галочки незачем. */
  const toggle = useCallback(async (it: ShoppingItem, to?: boolean) => {
    const next = (to ?? !it.checked) ? 1 : 0;
    if (next === (it.checked ? 1 : 0)) return;
    setData(d => d && { ...d, items: d.items.map(x => x.key === it.key ? { ...x, checked: next } : x) });
    haptic.select();
    try {
      await api('/client/shopping/check', {
        method: 'POST', body: { name: it.key, checked: !!next },
      });
    } catch {
      haptic.error();
      setData(d => d && { ...d, items: d.items.map(x => x.key === it.key ? { ...x, checked: it.checked } : x) });
    }
  }, []);

  /* Кладовка. Соль и масло попадают в список каждую неделю и каждую
     неделю в нём не нужны. Совсем убирать их нельзя — иногда они как
     раз заканчиваются, поэтому они уходят в отдельный список. */
  const pantry = useCallback(async (it: ShoppingItem, add: boolean) => {
    haptic.select();
    try {
      await api('/client/shopping/pantry', {
        method: 'POST', body: add ? { name: it.name } : { name: it.name, remove: true },
      });
      load();
    } catch { haptic.error(); }
  }, [load]);

  const clear = useCallback(async () => {
    const before = data?.items ?? [];
    setData(d => d && { ...d, items: d.items.map(x => ({ ...x, checked: 0 })) });
    try { await api('/client/shopping/clear', { method: 'POST' }); }
    catch { setData(d => d && { ...d, items: before }); }
  }, [data]);

  /* Группируем по категории — так список читается по отделам магазина */
  const cats = useMemo(() => {
    const out: [string, ShoppingItem[]][] = [];
    for (const it of data?.items ?? []) {
      const c = it.category || 'Прочее';
      const row = out.find(r => r[0] === c);
      if (row) row[1].push(it); else out.push([c, [it]]);
    }
    return out;
  }, [data]);

  if (err) return <Fail title="Список покупок" text={err} />;
  if (!data) return <Loading title="Список покупок" />;

  const done = data.items.filter(i => i.checked).length;
  const total = data.items.length;

  const head = (
    <Animated.View entering={FadeInDown.duration(240)}>
      <ListGroup style={{ marginTop: 8 }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, color: p.text }}>
              {done} из {total} куплено
            </Text>
            {/* Сброс стирает отметки всего списка — системный диалог
                спрашивает об этом ровно один раз и по-настоящему. */}
            <SysConfirm
              label="Сбросить"
              title="Снять все отметки?"
              message="Купленное придётся отметить заново."
              confirmLabel="Сбросить отметки"
              onConfirm={clear}
            />
          </View>
          <View style={{ marginTop: 10 }}>
            <Bar value={total ? done / total : 0} />
          </View>
          <Text style={{ ...FONT.small, color: p.text3, marginTop: 8 }}>
            {data.days} {plural(data.days, ['день', 'дня', 'дней'])} меню
          </Text>
        </View>
      </ListGroup>
    </Animated.View>
  );

  if (!total) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Список покупок" back />
        <Empty icon="cart" title="Список пуст"
          note="Он соберётся сам, когда специалист опубликует меню." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Список покупок" back />
      {sysNative ? (
        <>
          {head}
          <NativeList cats={cats} pantry={data.pantry ?? []}
            onSet={(it, v) => toggle(it, v)}
            onHome={it => pantry(it, true)}
            onBack={it => pantry(it, false)} />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}>
          {head}
          {cats.map(([cat, items], gi) => (
            <Animated.View key={cat} entering={FadeInDown.delay(40 + gi * 40).duration(240)}
              layout={LinearTransition.duration(220)}>
              <ListHead>{cat}</ListHead>
              <ListGroup>
                {items.map((it, i) => (
                  <Pressable key={it.key} onPress={() => toggle(it)}>
                    {({ pressed }) => (
                      <View>
                        {i ? <View style={{ height: 0.5, backgroundColor: p.border, marginLeft: 18 }} /> : null}
                        <View style={{
                          height: 48, flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: 18, gap: 14,
                          backgroundColor: pressed ? p.ov1 : 'transparent',
                        }}>
                          <View style={{
                            width: 22, height: 22, borderRadius: 11,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: it.checked ? p.primary : 'transparent',
                            borderWidth: it.checked ? 0 : 1.5, borderColor: p.track,
                          }}>
                            {it.checked ? <Icon name="check" size={13} color={p.onPrimary} width={2.6} /> : null}
                          </View>
                          <Text numberOfLines={1} style={{
                            flex: 1, fontSize: 16,
                            color: it.checked ? p.text3 : p.text,
                            textDecorationLine: it.checked ? 'line-through' : 'none',
                          }}>{it.name}</Text>
                          <Text style={{ ...FONT.small, color: p.text3 }}>
                            {it.amount?.text ?? `${it.grams} г`}
                          </Text>
                          {/* Домик убирает продукт в кладовку. Отдельной
                              кнопкой, а не долгим нажатием: то, чего не
                              видно, никто не найдёт. */}
                          <Pressable onPress={() => pantry(it, true)} hitSlop={10}>
                            {({ pressed: ph }) => (
                              <Icon name="home" size={16}
                                color={ph ? p.accent : p.text3} width={1.7} />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ListGroup>
            </Animated.View>
          ))}
          {data.pantry?.length ? (
            <>
              <ListHead>Уже есть дома</ListHead>
              <ListGroup>
                {data.pantry.map((it, i) => (
                  <View key={it.key}>
                    {i ? <View style={{ height: 0.5, backgroundColor: p.border, marginLeft: 18 }} /> : null}
                    <View style={{
                      height: 48, flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 18, gap: 14,
                    }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, color: p.text3 }}>
                        {it.name}
                      </Text>
                      <Pressable onPress={() => pantry(it, false)} hitSlop={8}>
                        <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                          Вернуть
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ListGroup>
            </>
          ) : null}
          <Text style={{ ...FONT.small, color: p.text3, paddingHorizontal: 18, marginTop: 14, lineHeight: 18 }}>
            Продукты, которые всегда есть дома, уберите значком домика —
            они перестанут появляться в списке.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Список в системном исполнении.
 *
 * Свайп по строке — не наша анимация, а `swipeActions` из SwiftUI: он
 * живёт только внутри настоящего `List`, поэтому здесь список целиком
 * системный. Взамен получаем всё разом: резину на краю, полный свайп
 * до конца, возврат строки, если палец передумал.
 */
function NativeList({ cats, pantry, onSet, onHome, onBack }: {
  cats: [string, ShoppingItem[]][];
  pantry: ShoppingItem[];
  onSet: (it: ShoppingItem, checked: boolean) => void;
  onHome: (it: ShoppingItem) => void;
  onBack: (it: ShoppingItem) => void;
}) {
  const { p } = useApp();
  const {
    Host, List, Section, HStack, VStack, Spacer, Text: SText, Image: SImage,
    Button, SwipeActions,
  } = require('@expo/ui/swift-ui');
  const m = require('@expo/ui/swift-ui/modifiers');

  return (
    <Host style={{ flex: 1 }}
      colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={p.primary}>
      <List
        modifiers={[m.listStyle('insetGrouped'), m.scrollContentBackground('hidden')]}>
        {cats.map(([cat, items]) => (
          <Section key={cat} title={cat}>
            {items.map(it => {
              const on = !!it.checked;
              return (
                <SwipeActions key={it.key}>
                  <SwipeActions.Actions edge="trailing">
                    <Button
                      label={on ? 'Вернуть' : 'Куплено'}
                      systemImage={on ? 'arrow.uturn.backward' : 'checkmark'}
                      onPress={() => onSet(it, !on)}
                      modifiers={[m.tint(on ? p.text3 : p.primary)]}
                    />
                    <Button
                      label="Есть дома"
                      systemImage="house"
                      onPress={() => onHome(it)}
                      modifiers={[m.tint(p.text3)]}
                    />
                  </SwipeActions.Actions>
                  <HStack spacing={12}
                    modifiers={[m.onTapGesture(() => onSet(it, !on))]}>
                    <SImage systemName={on ? 'checkmark.circle.fill' : 'circle'}
                      size={21} color={on ? p.primary : p.text3} />
                    <VStack alignment="leading" spacing={1}>
                      <SText modifiers={[
                        m.font({ size: 16 }),
                        m.foregroundStyle(on ? p.text3 : p.text),
                        ...(on ? [m.strikethrough({ isActive: true, pattern: 'solid' })] : []),
                      ]}>{it.name}</SText>
                    </VStack>
                    <Spacer />
                    <SText modifiers={[m.font({ size: 13 }), m.foregroundStyle(p.text3)]}>
                      {it.amount?.text ?? `${it.grams} г`}
                    </SText>
                  </HStack>
                </SwipeActions>
              );
            })}
          </Section>
        ))}
        {/* Кладовка — тем же списком, иначе убранное с глаз исчезало бы
            совсем и вернуть его было бы нечем. */}
        {pantry.length ? (
          <Section title="Уже есть дома">
            {pantry.map(it => (
              <SwipeActions key={it.key}>
                <SwipeActions.Actions edge="trailing">
                  <Button label="Вернуть" systemImage="arrow.uturn.backward"
                    onPress={() => onBack(it)} modifiers={[m.tint(p.primary)]} />
                </SwipeActions.Actions>
                <HStack spacing={12}>
                  <SImage systemName="house" size={19} color={p.text3} />
                  <SText modifiers={[m.font({ size: 16 }), m.foregroundStyle(p.text3)]}>
                    {it.name}
                  </SText>
                  <Spacer />
                </HStack>
              </SwipeActions>
            ))}
          </Section>
        ) : null}
      </List>
    </Host>
  );
}

export function Loading({ title }: { title: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title} back />
      <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
    </View>
  );
}

export function Fail({ title, text }: { title: string; text: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title} back />
      <Text style={{ ...FONT.body, color: p.text3, textAlign: 'center', marginTop: 40, paddingHorizontal: S.xl }}>
        {text}
      </Text>
    </View>
  );
}
