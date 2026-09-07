/**
 * Лента.
 *
 * Общая для клиентов и специалистов: посты видят все, поэтому и экран
 * один — отличается только тем, откуда на него приходят. Лайк ставится
 * сразу на месте и откатывается, если сервер не принял: ждать ответа
 * ради галочки в сердечке незачем.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, RefreshControl,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, Post } from '../api';
import { uploadForm } from '../upload';
import { pickPhoto } from '../photo';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { Empty, SysConfirm } from '../ui/system';
import { ago, plural } from '../format';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

const MAX = 1500;

export default function Feed() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(true);
  const [tail, setTail] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ posts: Post[] }>('/feed');
      setList(r.posts ?? []);
      setMore((r.posts ?? []).length >= 20);
      setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Лента не открылась'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Дозагрузка вниз: сервер отдаёт по двадцать постов и ждёт id
     последнего, а не номер страницы — так новые посты сверху не сдвигают
     выдачу и ничего не задваивается. */
  const loadMore = useCallback(async () => {
    if (tail || !more || !list?.length) return;
    setTail(true);
    try {
      const last = list[list.length - 1].id;
      const r = await api<{ posts: Post[] }>('/feed?before=' + last);
      const add = r.posts ?? [];
      setList(l => [...(l ?? []), ...add]);
      setMore(add.length >= 20);
    } catch { /* внизу ленты молчим: экран уже показан */ }
    finally { setTail(false); }
  }, [tail, more, list]);

  const like = useCallback(async (post: Post) => {
    haptic.tap();
    const on = !post.liked;
    setList(l => l && l.map(x => x.id === post.id
      ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x));
    try {
      const r = await api<{ likes: number; liked: boolean }>(`/feed/${post.id}/like`, { method: 'POST' });
      setList(l => l && l.map(x => x.id === post.id
        ? { ...x, liked: r.liked, likes: r.likes } : x));
    } catch {
      /* Не приняли — возвращаем как было, молча: сердечко не повод
         перекрывать экран сообщением об ошибке. */
      setList(l => l && l.map(x => x.id === post.id
        ? { ...x, liked: post.liked, likes: post.likes } : x));
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setList(l => l && l.filter(x => x.id !== id));
    try { await api('/feed/' + id, { method: 'DELETE' }); haptic.success(); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Пост не удалился'); load(); }
  }, [load]);

  if (err && !list) return <Fail title="Лента" text={err} />;
  if (!list) return <Loading title="Лента" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Лента" back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={p.text3} />}
          onScroll={e => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (contentOffset.y + layoutMeasurement.height > contentSize.height - 400) loadMore();
          }}
          scrollEventThrottle={200}>

          <Compose busy={busy} setBusy={setBusy}
            onDone={post => setList(l => [post, ...(l ?? [])])}
            onError={setErr} />

          {err ? (
            <Card style={{ marginBottom: S.sm }}>
              <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
            </Card>
          ) : null}

          {list.length === 0 ? (
            <Empty icon="camera" title="Здесь пока пусто"
              note="Первый пост может быть вашим: фото тарелки, результат недели или мысль о том, что помогает держаться." />
          ) : list.map((post, i) => (
            <Animated.View key={post.id}
              entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(220)}>
              <PostCard post={post} onLike={() => like(post)} onDelete={() => remove(post.id)} />
            </Animated.View>
          ))}

          {tail ? (
            <View style={{ paddingVertical: S.lg, alignItems: 'center' }}>
              <ActivityIndicator color={p.text3} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Поле «поделиться»: текст, фото и кнопка. */
function Compose({ busy, setBusy, onDone, onError }: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: (post: Post) => void;
  onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);

  async function attach() {
    try {
      const f = await pickPhoto();
      if (f) { setPhoto(f); haptic.tap(); }
    } catch (e: any) { onError(e?.message ?? 'Не вышло взять фото'); }
  }

  async function publish() {
    const body = text.trim();
    if (!body && !photo) { haptic.error(); onError('Напишите текст или добавьте фото'); return; }
    setBusy(true);
    try {
      /* С фото пост уходит формой — текст едет тем же запросом; без
         фото хватает обычного JSON. И там, и там сервер возвращает
         готовый пост, так что перечитывать ленту не нужно. */
      const r = photo
        ? await uploadForm<{ post: Post }>('/feed', photo, 'photo', { text: body })
        : await api<{ post: Post }>('/feed', { method: 'POST', body: { text: body } });
      if (r.post) onDone(r.post);
      setText(''); setPhoto(null);
      haptic.success();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Пост не опубликовался'); }
    finally { setBusy(false); }
  }

  return (
    <Card style={{ marginTop: S.md, marginBottom: S.md, gap: S.sm }}>
      <TextInput
        value={text} onChangeText={t => setText(t.slice(0, MAX))}
        multiline placeholder="Что сегодня в тарелке? Как идут дела?"
        placeholderTextColor={p.text3}
        style={{
          minHeight: 62, maxHeight: 160, color: p.text, fontSize: 15, lineHeight: 21,
          paddingTop: 2,
        }} />

      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }}
            style={{ width: '100%', height: 170, borderRadius: R.md, backgroundColor: p.inset }}
            contentFit="cover" transition={150} />
          <Pressable onPress={() => setPhoto(null)} hitSlop={10}
            style={({ pressed }) => ({
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: 14,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.55)', opacity: pressed ? 0.6 : 1,
            })}>
            <Icon name="close" size={14} color="#FFFFFF" width={2} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Pressable onPress={attach} hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.5 : 1,
          })}>
          <Icon name="clip" size={17} color={p.text2} width={1.9} />
          <Text style={{ ...FONT.small, color: p.text2 }}>
            {photo ? 'Другое фото' : 'Фото'}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />
        {text.length > MAX - 200 ? (
          <Muted>{MAX - text.length}</Muted>
        ) : null}

        <Pressable onPress={publish} disabled={busy}
          style={({ pressed }) => ({
            paddingHorizontal: 18, height: 38, borderRadius: R.pill,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.primary, opacity: pressed || busy ? 0.6 : 1,
          })}>
          {busy
            ? <ActivityIndicator color={p.onPrimary} size="small" />
            : <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>
                Опубликовать
              </Text>}
        </Pressable>
      </View>
    </Card>
  );
}

function PostCard({ post, onLike, onDelete }: {
  post: Post; onLike: () => void; onDelete: () => void;
}) {
  const { p } = useApp();
  const avatar = mediaUrl(post.author_avatar);
  const photo = mediaUrl(post.photo_url);

  return (
    <Card style={{ marginBottom: S.sm, gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        {avatar ? (
          <Image source={{ uri: avatar }}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.inset }}
            contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={{
            width: 38, height: 38, borderRadius: 19, backgroundColor: p.inset,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="user" size={17} color={p.text3} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{post.author_name}</Text>
          <Muted style={{ marginTop: 1 }}>
            {[post.author_type === 'specialist' ? 'Специалист' : null, ago(post.created_at)]
              .filter(Boolean).join(' · ')}
          </Muted>
        </View>
      </View>

      {post.text ? (
        <Text style={{ ...FONT.body, color: p.text, lineHeight: 21 }}>{post.text}</Text>
      ) : null}

      {photo ? (
        <Image source={{ uri: photo }}
          style={{ width: '100%', height: 220, borderRadius: R.md, backgroundColor: p.inset }}
          contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg }}>
        <Pressable onPress={onLike} hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6,
            opacity: pressed ? 0.5 : 1,
          })}>
          <Icon name="heart" size={17} width={1.9}
            color={post.liked ? p.danger : p.text3} />
          <Text style={{
            ...FONT.small, color: post.liked ? p.danger : p.text3,
            fontWeight: post.liked ? '600' : '400',
          }}>
            {post.likes > 0
              ? `${post.likes} ${plural(post.likes, ['отклик', 'отклика', 'откликов'])}`
              : 'Поддержать'}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />
        {post.mine ? (
          <SysConfirm label="Удалить" title="Удалить пост?"
            confirmLabel="Удалить" onConfirm={onDelete} tint={p.text3} />
        ) : null}
      </View>
    </Card>
  );
}
