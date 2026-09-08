/**
 * Выбор фотографии из галереи.
 *
 * Разрешение спрашиваем в момент, когда человек уже нажал «добавить
 * фото» — тогда понятно, зачем оно, и отказ не выглядит внезапным.
 * Возвращаем то, что нужно FormData: сервер ждёт файл, а не base64.
 */
import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto { uri: string; name: string; type: string }

export async function pickPhoto(square = false): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Нужен доступ к фотографиям');

  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: square ? [1, 1] : undefined,
    quality: 0.85,
  });
  if (r.canceled || !r.assets?.length) return null;

  const a = r.assets[0];
  const ext = (a.uri.split('.').pop() || 'jpg').toLowerCase();
  const type = a.mimeType ?? (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  return { uri: a.uri, name: a.fileName ?? `photo.${ext}`, type };
}



/** Фото или видео для переписки — без обрезки: кадр отправляют как снят. */
export async function pickMedia(video = true): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Нужен доступ к медиатеке');

  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: video ? ['images', 'videos'] : ['images'],
    quality: 0.85,
  });
  if (r.canceled || !r.assets?.length) return null;
  return asFile(r.assets[0]);
}

/** Снимок с камеры: удобнее, когда еду фотографируют прямо за столом. */
export async function shootPhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Нужен доступ к камере');

  const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  if (r.canceled || !r.assets?.length) return null;
  return asFile(r.assets[0]);
}

function asFile(a: ImagePicker.ImagePickerAsset): PickedPhoto {
  const ext = (a.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const byExt: Record<string, string> = {
    png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    mp4: 'video/mp4', mov: 'video/quicktime', m4a: 'audio/mp4',
  };
  return {
    uri: a.uri,
    name: a.fileName ?? `file.${ext}`,
    type: a.mimeType ?? byExt[ext] ?? 'application/octet-stream',
  };
}


/**
 * Документ для верификации: диплом приходит и снимком, и PDF из почты.
 *
 * Отдельная функция, а не флаг в pickPhoto: там открывается галерея,
 * а PDF в галерее не лежит. Здесь — системный выбор файлов.
 */
export async function pickDocument(): Promise<PickedPhoto | null> {
  const DocumentPicker = require('expo-document-picker');
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const ext = (a.name?.split('.').pop() || a.uri.split('?')[0].split('.').pop() || 'pdf').toLowerCase();
  const byExt: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png',
    webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  };
  return {
    uri: a.uri,
    name: a.name ?? `document.${ext}`,
    type: a.mimeType ?? byExt[ext] ?? 'application/pdf',
  };
}
