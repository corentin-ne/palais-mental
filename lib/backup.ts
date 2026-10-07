/**
 * Your data, portable: a full JSON backup (re-importable) and CSV sheets readable by any
 * spreadsheet. On the web files download; on phones they open the share sheet.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { toCsv as csv } from './csv';
import { episodeCode, sortEpisodes } from './progress';
import { Movie, Show } from './types';
import { LibraryData, compactLibrary, useLibrary } from '@/store/useLibrary';

const FORMAT = 'palais-mental';
const VERSION = 1;

const stamp = () => new Date().toISOString().slice(0, 10);
const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : '');

export function buildBackup(): string {
  const { shows, movies } = useLibrary.getState();
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), shows, movies }, null, 2);
}


export function buildShowsCsv(shows: Show[]) {
  const rows: unknown[][] = [['show', 'tvmaze_id', 'imdb_id', 'season', 'episode', 'code', 'title', 'aired', 'watched_at', 'dropped', 'rating_10']];
  for (const s of shows)
    for (const e of sortEpisodes(s.episodes))
      rows.push([s.title, s.tvmazeId, s.imdbId ?? '', e.season, e.number, episodeCode(e), e.name, iso(e.airstamp), iso(s.watched[e.id]), s.droppedAt ? 'yes' : '', s.rating ?? '']);
  return csv(rows);
}

export function buildMoviesCsv(movies: Movie[]) {
  const rows: unknown[][] = [['title', 'year', 'release_date', 'director', 'runtime_min', 'imdb_id', 'source', 'watched_at', 'added_at', 'rating_10']];
  for (const m of movies)
    rows.push([m.title, m.year ?? '', iso(m.releaseDate).slice(0, 10), m.director ?? '', m.runtime ?? '', m.imdbId ?? '', `${m.source}:${m.sourceId}`, iso(m.watchedAt), iso(m.addedAt), m.rating ?? '']);
  return csv(rows);
}

export async function deliver(name: string, content: string, mime: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}

export type ExportKind = 'json' | 'shows-csv' | 'movies-csv';

export async function exportData(kind: ExportKind) {
  const { shows, movies } = useLibrary.getState();
  if (kind === 'json') return deliver(`palais-mental-${stamp()}.json`, buildBackup(), 'application/json');
  if (kind === 'shows-csv') return deliver(`palais-mental-shows-${stamp()}.csv`, buildShowsCsv(Object.values(shows)), 'text/csv');
  return deliver(`palais-mental-films-${stamp()}.csv`, buildMoviesCsv(Object.values(movies)), 'text/csv');
}

export function parseBackup(text: string): LibraryData {
  const json = JSON.parse(text);
  if (json?.format !== FORMAT || typeof json.shows !== 'object' || typeof json.movies !== 'object') throw new Error('Not a Palais Mental backup');
  return { shows: json.shows ?? {}, movies: json.movies ?? {} };
}

type PickedAsset = DocumentPicker.DocumentPickerAsset;
const readAsset = (asset: PickedAsset) =>
  Platform.OS === 'web' ? (asset.file ? asset.file.text() : fetch(asset.uri).then((r) => r.text())) : new File(asset.uri).text();

/** Pick text files; resolves [] when cancelled. */
export async function pickFiles(multiple = false): Promise<{ name: string; text: string }[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'text/csv', 'text/comma-separated-values', '*/*'], copyToCacheDirectory: true, multiple });
  if (res.canceled || !res.assets?.length) return [];
  return Promise.all(res.assets.map(async (a) => ({ name: a.name ?? '', text: await readAsset(a) })));
}

/** Pick a backup file; resolves undefined when cancelled. */
export async function pickBackup(): Promise<LibraryData | undefined> {
  const [file] = await pickFiles();
  return file ? parseBackup(file.text) : undefined;
}

// ------------------------------------------------------------------ Automatic snapshots
/** A copy of the library kept on the device every few days, restorable from Profile. */
const SNAPSHOTS = 'palais-mental/snapshots';
const SNAPSHOT_EVERY = 3 * 86_400_000;
const KEEP = 3;

export interface Snapshot {
  at: number;
  shows: number;
  movies: number;
}

async function readSnapshots(): Promise<(Snapshot & { data: LibraryData })[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOTS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function autoSnapshot(force = false) {
  const { shows, movies } = useLibrary.getState();
  const counts = { shows: Object.keys(shows).length, movies: Object.keys(movies).length };
  if (!counts.shows && !counts.movies) return;
  const list = await readSnapshots();
  if (!force && list[0] && Date.now() - list[0].at < SNAPSHOT_EVERY) return;
  const next = [{ at: Date.now(), ...counts, data: compactLibrary({ shows, movies }) }, ...list].slice(0, KEEP);
  await AsyncStorage.setItem(SNAPSHOTS, JSON.stringify(next)).catch(() => undefined);
}

export async function listSnapshots(): Promise<Snapshot[]> {
  return (await readSnapshots()).map(({ at, shows, movies }) => ({ at, shows, movies }));
}

/** Merges a snapshot back in: nothing you logged since is lost. */
export async function restoreSnapshot(at: number) {
  const snap = (await readSnapshots()).find((s) => s.at === at);
  if (!snap) return false;
  useLibrary.getState().importData(snap.data, 'merge');
  return true;
}
