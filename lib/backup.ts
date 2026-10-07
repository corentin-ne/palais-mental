/**
 * Your data, portable: a full JSON backup (re-importable) and CSV sheets readable by any
 * spreadsheet. On the web files download; on phones they open the share sheet.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { episodeCode, sortEpisodes } from './progress';
import { Movie, Show } from './types';
import { LibraryData, useLibrary } from '@/store/useLibrary';

const FORMAT = 'palais-mental';
const VERSION = 1;

const stamp = () => new Date().toISOString().slice(0, 10);
const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : '');

export function buildBackup(): string {
  const { shows, movies } = useLibrary.getState();
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), shows, movies }, null, 2);
}

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

export function buildShowsCsv(shows: Show[]) {
  const rows: unknown[][] = [['show', 'tvmaze_id', 'imdb_id', 'season', 'episode', 'code', 'title', 'aired', 'watched_at', 'dropped']];
  for (const s of shows)
    for (const e of sortEpisodes(s.episodes))
      rows.push([s.title, s.tvmazeId, s.imdbId ?? '', e.season, e.number, episodeCode(e), e.name, iso(e.airstamp), iso(s.watched[e.id]), s.droppedAt ? 'yes' : '']);
  return csv(rows);
}

export function buildMoviesCsv(movies: Movie[]) {
  const rows: unknown[][] = [['title', 'year', 'release_date', 'director', 'runtime_min', 'imdb_id', 'source', 'watched_at', 'added_at']];
  for (const m of movies) rows.push([m.title, m.year ?? '', iso(m.releaseDate).slice(0, 10), m.director ?? '', m.runtime ?? '', m.imdbId ?? '', `${m.source}:${m.sourceId}`, iso(m.watchedAt), iso(m.addedAt)]);
  return csv(rows);
}

async function deliver(name: string, content: string, mime: string) {
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

/** Pick a backup file; resolves undefined when cancelled. */
export async function pickBackup(): Promise<LibraryData | undefined> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return undefined;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' ? await (asset.file ? asset.file.text() : fetch(asset.uri).then((r) => r.text())) : await new File(asset.uri).text();
  return parseBackup(text);
}
