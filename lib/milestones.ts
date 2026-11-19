/** Watches the library and celebrates what you just finished: a series, a season, a book, a game, a goal. */
import i18n from '@/locales/i18n';
import { duration } from './format';
import { minutesWatched } from './progress';
import { Milestone, milestoneOf } from './milestoneRules';
import { useLibrary } from '@/store/useLibrary';
import { usePrefs } from '@/store/usePrefs';
import { useUi } from '@/store/useUi';

const GOAL_LABEL = { show: 'stats.episodes', movie: 'common.movies', book: 'common.books', game: 'common.games' } as const;

function present(m: Milestone) {
  const t = i18n.t.bind(i18n);
  if (m.kind === 'goal') return { title: t('milestone.goal'), detail: t('milestone.goalDetail', { count: m.count, what: t(GOAL_LABEL[m.stat]).toLocaleLowerCase(), year: m.year }) };
  if (m.kind === 'showFinished')
    return { title: t('milestone.showFinished'), detail: t('milestone.showDetail', { title: m.show.title, count: Object.keys(m.show.watched).length, time: duration(minutesWatched(m.show)) }), art: m.show.poster };
  if (m.kind === 'seasonDone') return { title: t('milestone.seasonDone', { n: m.season }), detail: m.show.title, art: m.show.poster };
  if (m.kind === 'bookFinished') return { title: t('milestone.bookFinished'), detail: m.book.title, art: m.book.cover };
  return { title: t('milestone.gameFinished'), detail: m.game.title, art: m.game.cover };
}

export function startMilestones() {
  return useLibrary.subscribe((next, prev) => {
    if (next.shows === prev.shows && next.movies === prev.movies && next.books === prev.books && next.games === prev.games) return;
    const m = milestoneOf(prev, next, usePrefs.getState().goals);
    if (m) useUi.getState().celebrate(present(m));
  });
}
