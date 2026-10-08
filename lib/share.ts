/** The system share sheet for a title: its name, year and a page about it. */
import { Share } from 'react-native';

export function shareTitle(title: string, year?: number, url?: string) {
  const name = year ? `${title} (${year})` : title;
  return Share.share(url ? { message: `${name} ${url}`, url, title: name } : { message: name, title: name }).catch(() => undefined);
}
