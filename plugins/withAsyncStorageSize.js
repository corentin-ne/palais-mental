// Android caps AsyncStorage at 6 MB for the whole app unless the build says otherwise. The library,
// its automatic copies and the cache of slow answers all live there: this gives them room.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'AsyncStorage_db_size_in_MB';

module.exports = function withAsyncStorageSize(config, { megabytes = 64 } = {}) {
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((item) => !(item.type === 'property' && item.key === KEY));
    c.modResults.push({ type: 'property', key: KEY, value: String(megabytes) });
    return c;
  });
};
