export function urlToDenoUrl(url: URL) {
  return [
    url.href,
    url.hash,
    url.host,
    url.hostname,
    url.origin,
    url.password,
    url.pathname,
    url.port,
    url.protocol,
    url.search,
    url.username,
  ].join('\n');
}

export const url = [
  {
    name: 'op_url_parse',
    sync: (arg) => {
      let url = new URL(arg);
      return urlToDenoUrl(url);
    },
    async: async (arg) => {
      return arg;
    },
  },
  {
    name: 'op_url_reparse',
    sync: (arg, value) => {
      const SET_HASH = 1;
      const SET_HOST = 2;
      const SET_HOSTNAME = 3;
      const SET_PASSWORD = 4;
      const SET_PATHNAME = 5;
      const SET_PORT = 6;
      const SET_PROTOCOL = 7;
      const SET_SEARCH = 8;
      const SET_USERNAME = 9;

      let url = new URL(arg);
      switch (arg) {
        case SET_HASH:
          url.hash = value;
          break;
        case SET_HOST:
          url.host = value;
          break;
        case SET_HOSTNAME:
          url.hostname = value;
          break;
        case SET_PASSWORD:
          url.password = value;
          break;
        case SET_PATHNAME:
          url.pathname = value;
          break;
        case SET_PORT:
          url.port = value;
          break;
        case SET_PROTOCOL:
          url.protocol = value;
          break;
        case SET_SEARCH:
          url.search = value;
          break;
        case SET_USERNAME:
          url.username = value;
          break;
      }

      return urlToDenoUrl(url);
    },
  },
];
