/**
 * Отправка файла на сервер.
 *
 * Через `fetch` с FormData iOS кладёт файл в память целиком и на снимке
 * с камеры срывается ещё до ответа сервера — наружу это выглядит как
 * «нет связи». Системная выгрузка читает файл потоком и возвращает
 * настоящий код ответа, поэтому ошибку сервера видно как есть.
 */
import { Platform } from 'react-native';
import { API_BASE, getToken, ApiError } from './api';

export interface Upload { uri: string; name: string; type: string }

export async function uploadFile(path: string, file: Upload, field = 'file'): Promise<string> {
  const url = API_BASE + '/api/v1' + path;
  const token = getToken();
  const auth: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};

  if (Platform.OS === 'web') {
    const fd = new FormData();
    fd.append(field, { uri: file.uri, name: file.name, type: file.type } as any);
    const res = await fetch(url, { method: 'POST', headers: auth, body: fd });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new ApiError(json?.error ?? `Сервер ответил ${res.status}`, res.status);
    return json.url;
  }

  const FS = require('expo-file-system/legacy');
  let r: { status: number; body: string };
  try {
    r = await FS.uploadAsync(url, file.uri, {
      httpMethod: 'POST',
      uploadType: FS.FileSystemUploadType.MULTIPART,
      fieldName: field,
      mimeType: file.type,
      headers: auth,
    });
  } catch (e: any) {
    throw new ApiError(`Файл не ушёл: ${e?.message ?? 'обрыв связи'}`, 0);
  }

  let json: any = {};
  try { json = JSON.parse(r.body); } catch { /* сервер ответил не JSON */ }
  if (r.status >= 400) {
    /* Старый сервер про этот адрес ещё не знает — так и говорим,
       иначе «ошибка сервера» отправляет искать поломку в приложении. */
    const known = r.status === 404
      ? 'Сервер ещё не знает про вложения — обновите архив на хостинге.'
      : json?.error;
    throw new ApiError(known ?? `Сервер ответил ${r.status}`, r.status);
  }
  if (!json?.url) throw new ApiError('Сервер не вернул ссылку на файл', r.status);
  return json.url;
}
