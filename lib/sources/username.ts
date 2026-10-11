/**
 * The username in whatever was pasted: a bare name, "@name", or a profile link such as
 * serializd.com/user/name/profile, letterboxd.com/name/, myanimelist.net/profile/name,
 * anilist.co/user/name, trakt.tv/users/name, goodreads.com/user/show/123-name…
 */
export function usernameFrom(service: string, input: string) {
  // These parse links themselves (instances, vanity urls, profile ids), or take a plain name.
  if (['bookwyrm', 'steam', 'plex', 'jellyfin', 'emby', 'hardcover'].includes(service)) return input.trim();
  const raw = input.trim().replace(/^@/, '');
  // Share links from the Letterboxd app hide the name: kept whole, opened on the next sync.
  if (service === 'letterboxd' && /boxd\.it\//i.test(raw)) return raw;
  if (service === 'goodreads') return raw.match(/(?:user\/show|review\/list(?:_rss)?|user)\/(\d+)/)?.[1] ?? raw.match(/^\d+/)?.[0] ?? raw;
  if (!/[/.]/.test(raw) || !/[a-z]\.[a-z]/i.test(raw)) return raw.replace(/[/?#].*$/, '');
  const path = raw
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/[?#].*$/, '')
    .split('/')
    .slice(1)
    .filter(Boolean);
  const after = (word: string) => {
    const i = path.findIndex((p) => p.toLowerCase() === word);
    return i >= 0 ? path[i + 1] : undefined;
  };
  const name =
    service === 'serializd' ? after('user') :
    service === 'letterboxd' ? path[0] :
    service === 'mal' ? (after('profile') ?? after('animelist')) :
    service === 'trakt' || service === 'kitsu' ? after('users') :
    service === 'openlibrary' ? after('people') :
    after('user');
  return decodeURIComponent(name ?? path[path.length - 1] ?? raw).replace(/^@/, '');
}
