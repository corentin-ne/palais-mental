/**
 * Everything coming up as an .ics file: Google Calendar, Apple Calendar, Outlook and any other
 * calendar app import it. Episodes keep their air time; films, books and games are all-day.
 */
import i18n from '@/locales/i18n';
import { deliver } from './backup';
import { episodeCode } from './progress';
import { relationLabel, visibleRelated } from './related';
import { UpcomingEntry, getUpcoming } from './sync';
import { useConnections } from '@/store/useConnections';
import { useLibrary } from '@/store/useLibrary';

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
};
/** The release day as stored (noon UTC keeps the calendar day). */
const day = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};
const nextDay = (ms: number) => day(ms + 86_400_000);
/** Commas, semicolons and line breaks escaped; long lines folded at 74 octets-ish. */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => (line.length <= 74 ? line : line.match(/.{1,73}/g)!.join('\r\n '));

function event(u: UpcomingEntry): string[] {
  const base = 'palaismental://';
  const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o);
  let uid: string;
  let summary: string;
  let url: string;
  let when: string[];
  switch (u.kind) {
    case 'episode':
      uid = `e${u.episode.id}`;
      summary = `${u.show.title} · ${episodeCode(u.episode)}${u.episode.name ? ` · ${u.episode.name}` : ''}`;
      url = `${base}show/${u.show.tvmazeId}`;
      when = [`DTSTART:${utc(u.date)}`, `DTEND:${utc(u.date + (u.episode.runtime ?? u.show.runtime ?? 30) * 60_000)}`];
      break;
    case 'movie':
      uid = `m${u.movie.id}`;
      summary = `${u.movie.title} · ${t('calendar.inTheaters')}`;
      url = `${base}movie/${u.movie.id}`;
      when = [`DTSTART;VALUE=DATE:${day(u.date)}`, `DTEND;VALUE=DATE:${nextDay(u.date)}`];
      break;
    case 'book':
      uid = `b${u.book.id}`;
      summary = `${u.book.title}${u.book.authors[0] ? ` · ${u.book.authors[0]}` : ''} · ${t('calendar.bookOut')}`;
      url = `${base}book/${u.book.id}`;
      when = [`DTSTART;VALUE=DATE:${day(u.date)}`, `DTEND;VALUE=DATE:${nextDay(u.date)}`];
      break;
    case 'game':
      uid = `g${u.game.id}`;
      summary = `${u.game.title} · ${t('calendar.gameOut')}`;
      url = `${base}game/${u.game.id}`;
      when = [`DTSTART;VALUE=DATE:${day(u.date)}`, `DTEND;VALUE=DATE:${nextDay(u.date)}`];
      break;
    default:
      uid = `r${u.related.imdbId}`;
      summary = `${u.related.title} · ${relationLabel(u.related)}`;
      url = u.related.href ? `${base}${u.related.href.replace(/^\//, '')}` : `https://www.imdb.com/title/${u.related.imdbId}/`;
      when = [`DTSTART;VALUE=DATE:${day(u.date)}`, `DTEND;VALUE=DATE:${nextDay(u.date)}`];
  }
  return ['BEGIN:VEVENT', `UID:${uid}@palaismental`, `DTSTAMP:${utc(Date.now())}`, ...when, `SUMMARY:${text(summary)}`, `URL:${url}`, 'TRANSP:TRANSPARENT', 'END:VEVENT'];
}

/** Writes the file and opens the share sheet; returns how many events it holds. */
export async function exportCalendar() {
  const { shows, movies, books, games, settings } = useLibrary.getState();
  const related = settings.related ? visibleRelated(useConnections.getState().related.entries) : [];
  const upcoming = getUpcoming(shows, movies, Date.now(), related, books, games).slice(0, 500);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Palais Mental//Releases//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(i18n.t('connect.calendarName'))}`,
    ...upcoming.flatMap(event),
    'END:VCALENDAR',
  ];
  await deliver(`palais-mental-${new Date().toISOString().slice(0, 10)}.ics`, lines.map(fold).join('\r\n') + '\r\n', 'text/calendar');
  return upcoming.length;
}
