import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, ProgressResponse } from '../api';
import { FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { kg, plural } from '../format';
import { Loading, Fail } from './Shopping';

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : s;
};

/** График веса — тот же, что в вебе: линия, заливка под ней и две точки
 *  по краям. Меньше двух измерений рисовать нечего. */
function WeightChart({ ws, color }: { ws: { weight_kg: number }[]; color: string }) {
  const W = 320, H = 140, PX = 8, PY = 18, n = ws.length;
  const v = ws.map(w => +w.weight_kg);
  const mn = Math.min(...v), mx = Math.max(...v);
  const pad = (mx - mn) * 0.3 || 1, lo = mn - pad, hi = mx + pad;
  const X = (i: number) => PX + i * (W - 2 * PX) / (n - 1);
  const Y = (val: number) => PY + (hi - val) / (hi - lo) * (H - 2 * PY);
  const pts = v.map((val, i) => `${X(i).toFixed(1)},${Y(val).toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.16" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={`${PX},${H} ${pts} ${W - PX},${H}`} fill="url(#wg)" />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={X(0)} cy={Y(v[0])} r={3} fill={color} />
      <Circle cx={X(n - 1)} cy={Y(v[n - 1])} r={4.5} fill={color} />
    </Svg>
  );
}

export default function Progress() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<ProgressResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<ProgressResponse>('/client/progress').then(setD).catch(e => setErr(e.message));
  }, []);

  if (err) return <Fail title="Прогресс" text={err} />;
  if (!d) return <Loading title="Прогресс" />;

  const ws = d.weights ?? [];
  const first = ws.length ? +ws[0].weight_kg : null;
  const last = ws.length ? +ws[ws.length - 1].weight_kg : null;
  const delta = first != null && last != null ? Math.round((last - first) * 10) / 10 : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Прогресс" back />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(240)}>
          <ListGroup style={{ marginTop: 8 }}>
            <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text style={{ ...FONT.num, color: p.text }}>{kg(last)}</Text>
                <Text style={{ ...FONT.body, color: p.text3 }}>кг</Text>
                {/* Снижение — зелёным в обеих темах: в «Фарфоре» акцент
                    графитовый, и им знак изменения не прочитать */}
                {delta != null && delta !== 0 ? (
                  <Text style={{ ...FONT.h3, color: delta < 0 ? p.mp : p.mf, marginLeft: 'auto' }}>
                    {delta > 0 ? '+' : '−'}{kg(Math.abs(delta))} кг
                  </Text>
                ) : null}
              </View>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
                {ws.length
                  ? `${ws.length} ${plural(ws.length, ['измерение', 'измерения', 'измерений'])} с ${dmy(ws[0].measured_on)}`
                  : 'Измерений пока нет'}
              </Text>
              {ws.length >= 2
                ? <View style={{ marginTop: 6 }}><WeightChart ws={ws} color={p.mp} /></View>
                : <Text style={{ ...FONT.small, color: p.text3, marginVertical: 20 }}>
                    Добавьте ещё одно измерение — и здесь появится график
                  </Text>}
            </View>
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(240)}>
          <ListHead>Съедено по плану</ListHead>
          <ListGroup>
            <ListRow first label="Отмеченных блюд" value={String(d.eaten_count ?? 0)} />
          </ListGroup>
        </Animated.View>

        {d.measurements?.length ? (
          <Animated.View entering={FadeInDown.delay(120).duration(240)}>
            <ListHead>Замеры</ListHead>
            <ListGroup>
              {d.measurements.slice().reverse().map((m, i) => (
                <ListRow key={m.id} first={i === 0}
                  label={dmy(m.measured_on)}
                  value={[
                    m.waist_cm ? `талия ${m.waist_cm}` : null,
                    m.hips_cm ? `бёдра ${m.hips_cm}` : null,
                    m.chest_cm ? `грудь ${m.chest_cm}` : null,
                  ].filter(Boolean).join(' · ')} />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}

        {d.weights?.length ? (
          <Animated.View entering={FadeInDown.delay(160).duration(240)}>
            <ListHead>История веса</ListHead>
            <ListGroup>
              {ws.slice().reverse().map((w, i) => (
                <ListRow key={w.id} first={i === 0}
                  label={dmy(w.measured_on)} value={`${kg(+w.weight_kg)} кг`} />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}
