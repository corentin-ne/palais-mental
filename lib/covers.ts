/** Cover art by id, shared by books, games, their series and what they relate to. */
export const isbnCover = (isbn?: string, size: 'M' | 'L' = 'L') => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false` : undefined);
export const olCover = (id?: number, size: 'M' | 'L' = 'L') => (id && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : undefined);
/** Open Library author portrait. */
export const olAuthorPhoto = (olid: string) => `https://covers.openlibrary.org/a/olid/${olid}-M.jpg?default=false`;
/** Steam's 2:3 library capsule. */
export const steamCover = (appId: string | number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
