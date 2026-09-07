import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import Health from '../src/screens/Health';

/** Здоровье клиента глазами специалиста: сюда приходят из карточки. */
export default function SpHealth() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  return <Health clientId={Number(id) || 0} title={name ? String(name) : 'Здоровье'} />;
}
