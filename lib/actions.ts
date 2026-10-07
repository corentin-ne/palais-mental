/** User actions shared by several screens, with their confirmations and undos. */
import i18n from '@/locales/i18n';
import { SearchResult, fetchMovie, fetchShow } from './api';
import { useLibrary } from '@/store/useLibrary';
import { useUi } from '@/store/useUi';

const toast = (key: string, opts?: Record<string, unknown>, undo?: () => void) => useUi.getState().showToast(i18n.t(key, opts), undo);
const tmdbKey = () => useLibrary.getState().settings.tmdbKey || undefined;

export async function followShow(tvmazeId: number | string) {
  const { show } = await fetchShow(Number(tvmazeId), tmdbKey());
  useLibrary.getState().addShow(show);
  toast('toast.followed', { title: show.title });
  return show;
}

export async function addMovie(id: string, hint?: SearchResult) {
  const { movie } = await fetchMovie(id, { tmdbKey: tmdbKey(), lang: i18n.language, hint });
  useLibrary.getState().addMovie({ ...movie, poster: movie.poster ?? hint?.poster });
  toast('toast.addedMovie', { title: movie.title });
  return movie;
}

export function removeShow(id: string) {
  const removed = useLibrary.getState().removeShow(id);
  if (removed) toast('toast.removed', { title: removed.title }, () => useLibrary.getState().restoreShow(removed));
}

export function removeMovie(id: string) {
  const removed = useLibrary.getState().removeMovie(id);
  if (removed) toast('toast.removed', { title: removed.title }, () => useLibrary.getState().restoreMovie(removed));
}

export function setDropped(id: string, dropped: boolean) {
  const lib = useLibrary.getState();
  const show = lib.shows[id];
  if (!show) return;
  lib.setDropped(id, dropped);
  if (dropped) toast('toast.dropped', { title: show.title }, () => useLibrary.getState().setDropped(id, false));
  else toast('toast.resumed', { title: show.title });
}
