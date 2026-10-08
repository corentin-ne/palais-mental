import { useLocalSearchParams } from 'expo-router';

import ShelfDetail from '@/components/media/ShelfDetail';

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShelfDetail kind="book" id={String(id ?? '')} />;
}
