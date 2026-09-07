/**
 * Открыть файл, лежащий за проверкой прав.
 *
 * Просто дать ссылку браузеру нельзя: сервер требует токен, а в адресе
 * его передавать нельзя — он осядет в истории браузера и в логах.
 * Поэтому скачиваем файл заголовком авторизации во временную папку
 * и отдаём системному просмотрщику: PDF и снимки он открывает сам.
 */
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { API_BASE, getToken, ApiError } from './api';

export async function openPrivateFile(url: string, suggestedName = 'file') {
  const full = /^https?:/i.test(url) ? url : API_BASE + url;
  const token = getToken();

  if (Platform.OS === 'web') {
    /* В браузере токен уже в заголовках fetch: качаем в память и
       отдаём вкладке через временную ссылку. */
    const res = await fetch(full, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) throw new ApiError('Файл не открылся', res.status);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    window.open(href, '_blank');
    setTimeout(() => URL.revokeObjectURL(href), 60000);
    return;
  }

  const FS = require('expo-file-system/legacy');
  const ext = full.split('?')[0].split('.').pop() || 'pdf';
  const to = FS.cacheDirectory + suggestedName.replace(/[^\w.-]+/g, '_') + '.' + ext;

  const r = await FS.downloadAsync(full, to, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  if (r.status >= 400) {
    throw new ApiError(r.status === 403 ? 'Нет доступа к файлу' : 'Файл не открылся', r.status);
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError('На этом устройстве нечем открыть файл', 0);
  }
  await Sharing.shareAsync(r.uri);
}
