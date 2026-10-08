import { useLocalSearchParams } from 'expo-router';

import ShelfDetail from '@/components/media/ShelfDetail';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShelfDetail kind="game" id={String(id ?? '')} />;
}
