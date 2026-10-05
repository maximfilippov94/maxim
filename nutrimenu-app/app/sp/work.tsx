/**
 * Вкладка «Работа» в кабинете специалиста: у тренера — тренировки,
 * у остальных — база блюд. Ровно так же устроена третья вкладка в
 * вебе: один слот, содержимое по профессии.
 *
 * Раньше оба раздела лежали за «Ещё»: нутрициолог заходил в базу блюд
 * через два нажатия, тренер так же добирался до своих программ — при
 * том что на сайте это главный экран их работы.
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useApp } from '../../src/store';
import { api, SpProfile } from '../../src/api';
import SpDishes from '../../src/screens/sp/Dishes';
import SpWorkouts from '../../src/screens/sp/Workouts';

export default function SpWork() {
  const { p } = useApp();
  const [pr, setPr] = useState<SpProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ profile: SpProfile }>('/specialist/profile')
      .then(r => { if (alive) setPr(r.profile); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  /* До ответа не угадываем: показать тренеру базу блюд и через секунду
     подменить её программами — хуже, чем короткое ожидание. */
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const trainer = pr?.profession === 'trainer' || pr?.profession === 'coach';
  return trainer ? <SpWorkouts /> : <SpDishes />;
}
