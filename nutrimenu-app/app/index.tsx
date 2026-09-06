import { Redirect } from 'expo-router';
import { useApp } from '../src/store';

export default function Index() {
  const { me } = useApp();
  if (!me) return <Redirect href="/login" />;
  /* У специалиста свои вкладки; панель владельца остаётся в браузере,
     поэтому его пускаем в клиентский вид только чтобы не упереться в пустоту. */
  if (me.user_type === 'specialist') return <Redirect href="/sp" />;
  return <Redirect href="/client" />;
}
