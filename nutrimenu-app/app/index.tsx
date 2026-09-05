import { Redirect } from 'expo-router';
import { useApp } from '../src/store';

export default function Index() {
  const { me } = useApp();
  if (!me) return <Redirect href="/login" />;
  /* Специалист и владелец пока работают в вебе — им покажем это на экране входа */
  return <Redirect href="/client" />;
}
