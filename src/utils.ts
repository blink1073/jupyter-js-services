// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  JSONObject
} from '@phosphor/coreutils';

import * as minimist
  from 'minimist';

import * as url
  from 'url';

import * as urljoin
  from 'url-join';

import {
  ManagedSocket
} from './socket';


// Stub for requirejs.
declare var requirejs: any;


// Export the Promise Delegate for now to preserve API.
export { PromiseDelegate } from '@phosphor/coreutils';


/**
 * Copy the contents of one object to another, recursively.
 *
 * From [stackoverflow](http://stackoverflow.com/a/12317051).
 */
export
function extend(target: any, source: any): any {
  target = target || {};
  for (let prop in source) {
    if (typeof source[prop] === 'object') {
      target[prop] = extend(target[prop], source[prop]);
    } else {
      target[prop] = source[prop];
    }
  }
  return target;
}


/**
 * Get a deep copy of a JSON object.
 */
export
function copy(object: JSONObject): JSONObject {
  return JSON.parse(JSON.stringify(object));
}


/**
 * Get a random 32 character hex string (not a formal UUID)
 */
export
function uuid(): string {
  let s: string[] = [];
  let hexDigits = '0123456789abcdef';
  let nChars = hexDigits.length;
  for (let i = 0; i < 32; i++) {
    s[i] = hexDigits.charAt(Math.floor(Math.random() * nChars));
  }
  return s.join('');
}


/**
 * A URL object.
 *
 * This interface is from the npm package URL object interface. We
 * include it here so that downstream libraries do not have to include
 * the `url` typing files, since the npm `url` package is not in the
 * @types system.
 */

export interface IUrl {
    href?: string;
    protocol?: string;
    auth?: string;
    hostname?: string;
    port?: string;
    host?: string;
    pathname?: string;
    search?: string;
    query?: string | any;
    slashes?: boolean;
    hash?: string;
    path?: string;
}


/**
 * Parse a url into a URL object.
 *
 * @param urlString - The URL string to parse.
 *
 * @param parseQueryString - If `true`, the query property will always be set
 *   to an object returned by the `querystring` module's `parse()` method.
 *   If `false`, the `query` property on the returned URL object will be an
 *   unparsed, undecoded string. Defaults to `false`.
 *
 * @param slashedDenoteHost - If `true`, the first token after the literal
 *   string `//` and preceeding the next `/` will be interpreted as the `host`.
 *   For instance, given `//foo/bar`, the result would be
 *   `{host: 'foo', pathname: '/bar'}` rather than `{pathname: '//foo/bar'}`.
 *   Defaults to `false`.
 *
 * @returns A URL object.
 */

export
function urlParse(urlStr: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): IUrl {
  return url.parse(urlStr, parseQueryString, slashesDenoteHost);
}


/**
 * Resolve a url.
 *
 * Take a base URL, and a href URL, and resolve them as a browser would for
 * an anchor tag.
 */
export
function urlResolve(from: string, to: string): string {
  return url.resolve(from, to);
}


/**
 * Join a sequence of url components and normalizes as in node `path.join`.
 */
export
function urlPathJoin(...parts: string[]): string {
  return urljoin(...parts);
}


/**
 * Encode the components of a multi-segment url.
 *
 * #### Notes
 * Preserves the `'/'` separators.
 * Should not include the base url, since all parts are escaped.
 */
export
function urlEncodeParts(uri: string): string {
  // Normalize and join, split, encode, then join.
  uri = urljoin(uri);
  let parts = uri.split('/').map(encodeURIComponent);
  return urljoin(...parts);
}


/**
 * Return a serialized object string suitable for a query.
 *
 * From [stackoverflow](http://stackoverflow.com/a/30707423).
 */
export
function jsonToQueryString(json: JSONObject): string {
  return '?' + Object.keys(json).map(key =>
    encodeURIComponent(key) + '=' + encodeURIComponent(String(json[key]))
  ).join('&');
}


/**
 * Try to load an object from a module or a registry.
 *
 * Try to load an object from a module asynchronously if a module
 * is specified, otherwise tries to load an object from the global
 * registry, if the global registry is provided.
 */
export
function loadObject(name: string, moduleName: string, registry?: { [key: string]: any }): Promise<any> {
  return new Promise((resolve, reject) => {
    // Try loading the view module using require.js
    if (moduleName) {
      if (typeof requirejs === 'undefined') {
        throw new Error('requirejs not found');
      }
      requirejs([moduleName], (mod: any) => {
        if (mod[name] === void 0) {
          let msg = `Object '${name}' not found in module '${moduleName}'`;
          reject(new Error(msg));
        } else {
          resolve(mod[name]);
        }
      }, reject);
    } else {
      if (registry && registry[name]) {
        resolve(registry[name]);
      } else {
        reject(new Error(`Object '${name}' not found in registry`));
      }
    }
  });
};


/**
 * Global config data for the Jupyter application.
 */
let configData: any = null;


/**
 * Declare a stub for the node process variable.
 */
declare var process: any;


/**
 *  Make an object fully immutable by freezing each object in it.
 */
function deepFreeze(obj: any): any {

  // Freeze properties before freezing self
  Object.getOwnPropertyNames(obj).forEach(function(name) {
    let prop = obj[name];

    // Freeze prop if it is an object
    if (typeof prop === 'object' && prop !== null && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  });

  // Freeze self
  return Object.freeze(obj);
}


/**
 * Get global configuration data for the Jupyter application.
 *
 * @param name - The name of the configuration option.
 *
 * @returns The config value or `undefined` if not found.
 *
 * #### Notes
 * For browser based applications, it is assumed that the page HTML
 * includes a script tag with the id `jupyter-config-data` containing the
 * configuration as valid JSON.
 */
export
function getConfigOption(name: string): string {
  if (configData) {
    return configData[name];
  }
  if (typeof document === 'undefined') {
    configData = minimist(process.argv.slice(2));
  } else {
    let el = document.getElementById('jupyter-config-data');
    if (el) {
      configData = JSON.parse(el.textContent);
    } else {
      configData = {};
    }
  }
  configData = deepFreeze(configData);
  return configData[name];
}


/**
 * A class that represents a server connection.
 */
export
class Server {
  /**
   * Create a new server instance.
   */
  constructor(options: Server.IOptions) {
    let populated = Private.populateOptions(options);
    this.baseUrl = populated.baseUrl;
    this.wsUrl = populated.wsUrl;
    this.token = populated.token;
    this.requestDefaults = populated.requestDefaults;
    this._socketFactory = populated.socketFactory;
  }

  /**
   * The root url of the server.
   */
  readonly baseUrl: string;

  /**
   * The url to access websockets.
   */
  readonly wsUrl: string;

  /**
   * The token used for API requests.
   */
  readonly token: string;

  /**
   *  Default request settings.
   */
  readonly requestDefaults: RequestInit;

  /**
   * Fetch a resource from the server.
   */
  fetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    return fetch(input, Private.getInit(this.requestDefaults, init));
  }

  /**
   * Create a managed socket connection to the server.
   */
  createSocket(url: string): ManagedSocket {
    // Add token if needed.
    if (this.token) {
      url = url + `&token=${encodeURIComponent(this.token)}`;
    }
    return new ManagedSocket({ url, factory: this._socketFactory });
  }

  private _socketFactory: (url: string) => WebSocket;
}


/**
 * The namespace for Server class statics.
 */
export
namespace Server {
  /**
   * A server options object.
   */
  export
  interface IOptions {
    /**
     * The root url of the server.
     */
    baseUrl?: string;

    /**
     * The url to access websockets.
     */
    wsUrl?: string;

    /**
     * The token used for API requests.
     */
    token?: string;

    /**
     * Request default settings.
     */
    requestDefaults?: RequestInit;

    /**
     * The web socket factory.
     */
    socketFactory?: (url: string) => WebSocket;
  }
}


/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * Populate the server options.
   */
  export
  function populateOptions(options: Server.IOptions = {}): Server.IOptions {
    let baseUrl = options.baseUrl || getBaseUrl();
    let token = options.token || getConfigOption('token');
    let requestDefaults = options.requestDefaults || {};
    let headers = requestDefaults.headers || [];
    if (!(headers instanceof Headers)) {
      headers = new Headers(headers);
    }
    if (token) {
      headers.set('Authorization', `token ${options.token}`);
    } else if (typeof document !== 'undefined' && document.cookie) {
      let xsrfToken = getCookie('_xsrf');
      if (xsrfToken !== void 0) {
        headers.set('X-XSRFToken', xsrfToken);
      }
    }
    requestDefaults.headers = headers;
    return {
      baseUrl,
      wsUrl: options.wsUrl || getWsUrl(baseUrl),
      token,
      requestDefaults,
      socketFactory: options.socketFactory || defaultSocketFactory
    };
  }

  /**
   * Get the init options for a given request.
   */
  export
  function getInit(defaults: RequestInit, init: RequestInit = {}): RequestInit {
    let defaultHeaders = defaults.headers as Headers;
    let out: RequestInit = {...defaults, ...init};
    // Set the headers that were in default but not in init.
    if (!(out.headers instanceof Headers)) {
      out.headers = new Headers(out.headers);
    }
    for (let key in defaultHeaders) {
      if (out.headers.has(key)) {
        continue;
      }
      out.headers.set(key, defaultHeaders.get(key));
    }
    // Make sure there is body data.
    out.body = out.body || new Blob();
    return out;
  }

  /**
   * Get the base URL for a Jupyter application.
   */
  export
  function getBaseUrl(): string {
    let baseUrl = getConfigOption('baseUrl');
    if (!baseUrl || baseUrl === '/') {
      baseUrl = (typeof location === 'undefined' ?
                 'http://localhost:8888/' : location.origin + '/');
    }
    return baseUrl;
  }


  /**
   * Get the base websocket URL for a Jupyter application.
   */
  export
  function getWsUrl(baseUrl?: string): string {
    let wsUrl = getConfigOption('wsUrl');
    if (!wsUrl) {
      baseUrl = baseUrl || getBaseUrl();
      if (baseUrl.indexOf('http') !== 0) {
        if (typeof location !== 'undefined') {
          baseUrl = urlPathJoin(location.origin, baseUrl);
        } else {
          baseUrl = urlPathJoin('http://localhost:8888/', baseUrl);
        }
      }
      wsUrl = 'ws' + baseUrl.slice(4);
    }
    return wsUrl;
  }

  /**
   * Get a cookie from the document.
   */
  function getCookie(name: string) {
    // from tornado docs: http://www.tornadoweb.org/en/stable/guide/security.html
    let r = document.cookie.match('\\b' + name + '=([^;]*)\\b');
    return r ? r[1] : void 0;
  }

  /**
   * The default socket factory.
   */
  export
  const defaultSocketFactory = (url: string) => {
    return new WebSocket(url);
  };
}

