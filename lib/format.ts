import i18n from '@/locales/i18n';

const DAY = 86_400_000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const dayKey = (ms: number) => startOfDay(ms);

/** Whole days from today to `ms` (0 = today). */
export const daysFromToday = (ms: number, now = Date.now()) => Math.round((startOfDay(ms) - startOfDay(now)) / DAY);

/** "Today", "Tomorrow", "Friday", "12 Mar", "12 Mar 2027". */
export function relativeDay(ms: number, now = Date.now()) {
  const lang = i18n.language;
  const days = daysFromToday(ms, now);
  if (days === 0) return i18n.t('date.today');
  if (days === 1) return i18n.t('date.tomorrow');
  if (days === -1) return i18n.t('date.yesterday');
  if (days > 1 && days < 7) return capitalize(new Date(ms).toLocaleDateString(lang, { weekday: 'long' }));
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const fullDate = (ms: number) => new Date(ms).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

/** "in 3 days", "in 5 weeks"… for countdown badges. */
export function countdown(ms: number, now = Date.now()) {
  const days = daysFromToday(ms, now);
  if (days <= 0) return i18n.t('date.today');
  if (days === 1) return i18n.t('date.tomorrow');
  if (days < 14) return i18n.t('date.inDays', { count: days });
  if (days < 60) return i18n.t('date.inWeeks', { count: Math.round(days / 7) });
  return i18n.t('date.inMonths', { count: Math.round(days / 30) });
}

export function runtime(min?: number) {
  if (!min) return undefined;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}

/** Long durations as days and hours ("12d 4h"). */
export function duration(min: number) {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  if (d) return i18n.t('date.daysHours', { d, h });
  return i18n.t('date.hoursMinutes', { h, m: min % 60 });
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
