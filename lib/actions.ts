/** User actions shared by several screens, with their confirmations and undos. */
import i18n from '@/locales/i18n';
import { SearchResult, fetchMovie, fetchShow } from './api';
import { fetchBook } from './books';
import { fetchGame } from './games';
import { Book, Game } from './types';
import { ShelfStatus, useLibrary } from '@/store/useLibrary';
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

export async function addBook(id: string) {
  const { book, redirect } = await fetchBook(id, i18n.language);
  const final = redirect ? (await fetchBook(redirect, i18n.language)).book : book;
  useLibrary.getState().addBook(final);
  toast(final.releaseDate && final.releaseDate > Date.now() ? 'toast.awaitMovie' : 'toast.addedBook', { title: final.title });
  return final;
}

export async function addGame(id: string) {
  const { game, redirect } = await fetchGame(id, i18n.language);
  const final = redirect ? (await fetchGame(redirect, i18n.language)).game : game;
  useLibrary.getState().addGame(final);
  toast(final.releaseDate && final.releaseDate > Date.now() ? 'toast.awaitMovie' : 'toast.addedGame', { title: final.title });
  return final;
}

export function removeBook(id: string) {
  const removed = useLibrary.getState().removeBook(id);
  if (removed) toast('toast.removed', { title: removed.title }, () => useLibrary.getState().restoreBook(removed));
}

export function removeGame(id: string) {
  const removed = useLibrary.getState().removeGame(id);
  if (removed) toast('toast.removed', { title: removed.title }, () => useLibrary.getState().restoreGame(removed));
}

/** Status change with an undo back to where it was. */
export function setShelfStatus(kind: 'book' | 'game', id: string, status: ShelfStatus) {
  const lib = useLibrary.getState();
  const before = kind === 'book' ? lib.books[id] : lib.games[id];
  if (!before) return;
  if (kind === 'book') lib.setBookStatus(id, status);
  else lib.setGameStatus(id, status);
  const key = status === 'finished' ? (kind === 'book' ? 'toast.finishedBook' : 'toast.finishedGame') : status === 'dropped' ? 'toast.dropped' : undefined;
  if (key)
    toast(key, { title: before.title }, () =>
      kind === 'book' ? useLibrary.getState().restoreBook(before as Book) : useLibrary.getState().restoreGame(before as Game),
    );
}
