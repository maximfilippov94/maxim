/**
 * Удаление учётной записи.
 *
 * Спрашиваем дважды: первый диалог объясняет, что именно исчезнет,
 * второй — последняя остановка перед необратимым действием. Так просит
 * App Store и так честно: удаление здесь настоящее, а не заявка в
 * поддержку.
 */
import { Alert } from 'react-native';
import { api } from '../api';

export function confirmDeleteAccount(
  role: 'client' | 'specialist',
  onDone: () => void,
  onError: (message: string) => void,
) {
  const what = role === 'client'
    ? 'Исчезнут анкета, дневник питания, вес и замеры, фотографии прогресса и переписка со специалистом.'
    : 'Исчезнут ваш профиль, шаблоны меню и услуги. Клиенты останутся со своими данными, но без специалиста.';

  Alert.alert('Удалить аккаунт?', what + '\n\nВосстановить будет нельзя.', [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Удалить',
      style: 'destructive',
      onPress: () => Alert.alert('Точно удалить?', 'Последняя остановка.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить навсегда',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/${role}/account`, { method: 'DELETE' });
              onDone();
            } catch (e: any) {
              onError(e?.message ?? 'Не удалось удалить аккаунт');
            }
          },
        },
      ]),
    },
  ]);
}
