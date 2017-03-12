// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  JSONObject, JSONValue, PromiseDelegate
} from '@phosphor/coreutils';

import * as minimist
  from 'minimist';

import * as url
  from 'url';

import * as urljoin
  from 'url-join';


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
 * The namespace for Server interaction.
 */
export
namespace Server {
  /**
   * Asynchronous XMLHttpRequest handler.
   *
   * @param request - The ajax request data.
   *
   * @param options - The server options for the request.
   *
   * @returns a Promise that resolves with the success data.
   */
  export
  function ajaxRequest(request: Partial<IAjaxRequest>, options: Partial<IOptions> = {}): Promise<IAjaxSuccess> {
    return Private.makeRequest(
      Private.handleRequestData(request), createOptions(options)
    );
  }

  /**
   * Create an AJAX error from an AJAX success.
   *
   * @param success - The original success object.
   *
   * @param message - The optional new error message.  If not given
   *  we use "Invalid Status: <xhr.status>"
   */
  export
  function makeAjaxError(success: IAjaxSuccess, message?: string): IAjaxError {
    let { xhr, request, options, event } = success;
    message = message || `Invalid Status: ${xhr.status}`;
    return { xhr, request, options, event, message };
  }

  /**
   * Create the server options given an options object.
   */
  export
  function createOptions(options: Partial<IOptions>): IOptions {
    let baseUrl = options.baseUrl || Private.getBaseUrl();
    return {
      baseUrl,
      wsUrl: options.wsUrl || Private.getWsUrl(baseUrl),
      token: options.token || getConfigOption('token'),
      withCredentials: !!options.withCredentials,
      user: options.user || '',
      password: options.password || '',
      requestHeaders: options.requestHeaders || {},
      requestFactory: options.requestFactory || Private.defaultRequestFactory,
      socketFactory: options.socketFactory || Private.defaultSocketFactory
    };
  }

  /**
   * An AJAX request.
   */
  export
  interface IAjaxRequest {
    /**
     * The url of the request.
     */
    readonly url: string;

    /**
     * The HTTP method to use.  Defaults to `'GET'`.
     */
    readonly method: string;

    /**
     * The return data type (used to parse the return data).
     */
    readonly dataType: string;

    /**
     * The outgoing content type, used to set the `Content-Type` header.
     */
    readonly contentType: string;

    /**
     * The request data.
     */
    readonly data: JSONValue;

    /**
     * Whether to cache the response. Defaults to `true`.
     */
    readonly cache: boolean;

    /**
     * The number of milliseconds a request can take before automatically
     * being terminated.  A value of 0 (which is the default) means there is
     * no timeout.
     */
    readonly timeout: number;

    /**
     * A mapping of request headers, used via `setRequestHeader`.
     */
    readonly requestHeaders: { readonly [key: string]: string; };
  }

  /**
   * A server options object.
   */
  export
  interface IOptions {
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
     * Whether or not cross-site Access-Control
     * requests should be made using credentials such as cookies or
     * authorization headers.  Defaults to `false`.
     */
    readonly withCredentials: boolean;

    /**
     * The user name for the server with the request.  Defaults to `''`.
     */
    readonly user: string;

    /**
     * The password for the server.  Defaults to `''`.
     */
    readonly password: string;

    /**
     * Mapping of request headers for every request, used via `setRequestHeader`.
     */
    readonly requestHeaders: { readonly [key: string]: string; };

    /**
     * The XMLHttpRequest factory.
     */
    requestFactory: () => XMLHttpRequest;

    /**
     * The Websocket factory.
     */
    socketFactory: (url: string) => WebSocket;
  }

  /**
   * Data for a successful  AJAX request.
   */
  export
  interface IAjaxSuccess {
    /**
     * The `onload` event.
     */
    readonly event: ProgressEvent;

    /**
     * The XHR object.
     */
    readonly xhr: XMLHttpRequest;

    /**
     * The request data.
     */
    readonly request: IAjaxRequest;

    /**
     * The server options.
     */
    readonly options: IOptions;

    /**
     * The data returned by the ajax call.
     */
    readonly data: JSONValue;
  }

  /**
   * Data for an unsuccesful AJAX request.
   */
  export
  interface IAjaxError {
    /**
     * The event triggering the error.
     */
    readonly event: Event;

    /**
     * The XHR object.
     */
    readonly xhr: XMLHttpRequest;

    /**
     * The request data.
     */
    readonly request: IAjaxRequest;

    /**
     * The server options.
     */
    readonly options: IOptions;

    /**
     * The error message associated with the error.
     */
    readonly message: string;
  }
}


/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * Handle the ajax data, returning a new value.
   */
  export
  function handleRequestData(request: Partial<Server.IAjaxRequest>): Server.IAjaxRequest {
    let url = request.url || '';
    if (request.cache !== false) {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache.
      url += ((/\?/).test(url) ? '&' : '?') + (new Date()).getTime();
    }
    return {
      url,
      method: request.method || 'GET',
      data: request.data || '{}',
      dataType: request.dataType || 'application/json',
      cache: request.cache !== false,
      contentType: request.contentType || 'application/json',
      requestHeaders: request.requestHeaders || {},
      timeout: request.timeout || 0
    };
  }

  /**
   * Make a request.
   */
  export
  function makeRequest(request: Server.IAjaxRequest, options: Server.IOptions): Promise<Server.IAjaxSuccess> {
    let xhr = createXHR(request, options);
    let delegate = new PromiseDelegate();

    xhr.onload = (event: ProgressEvent) => {
      if (xhr.status >= 300) {
        let message = `Invalid Status: ${xhr.status}`;
        delegate.reject({ event, xhr, request, options, message });
      }
      let data = xhr.responseText;
      try {
        data = JSON.parse(data);
      } catch (err) {
        // no-op
      }
      delegate.resolve({ xhr, request, options, data, event });
    };

    xhr.onabort = (event: Event) => {
      delegate.reject({ xhr, event, request, options, message: 'Aborted' });
    };

    xhr.onerror = (event: ErrorEvent) => {
      delegate.reject({
        xhr, event, request, options, message: event.message
      });
    };

    xhr.ontimeout = (ev: ProgressEvent) => {
      delegate.reject({ xhr, event, request, options, message: 'Timed Out' });
    };

    xhr.send(request.data);
    return delegate.promise;
  }

  /**
   * Create the xhr object given a request and options.
   */
  function createXHR(request: Server.IAjaxRequest, options: Server.IOptions): XMLHttpRequest {
    let xhr = options.requestFactory();
    xhr.open(
      request.method, request.url, true, options.user,
      options.password
    );

    xhr.setRequestHeader('Content-Type', request.contentType);
    xhr.timeout = request.timeout;
    if (options.withCredentials) {
      xhr.withCredentials = true;
    }

    // Write the request headers.
    let headers = request.requestHeaders;
    for (let prop in headers) {
      xhr.setRequestHeader(prop, headers[prop]);
    }
    // Write the server request headers
    headers = options.requestHeaders;
    for (let prop in headers) {
      xhr.setRequestHeader(prop, headers[prop]);
    }

    // Handle authorization.
    if (options.token) {
      xhr.setRequestHeader('Authorization', `token ${options.token}`);
    } else if (typeof document !== 'undefined' && document.cookie) {
      let xsrfToken = getCookie('_xsrf');
      if (xsrfToken !== void 0) {
        xhr.setRequestHeader('X-XSRFToken', xsrfToken);
      }
    }

    return xhr;
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
   * The default request factory.
   */
  export
  const defaultRequestFactory = () => { return new XMLHttpRequest(); };

  /**
   * The default socket factory.
   */
  export
  const defaultSocketFactory = (url: string) => {
    return new WebSocket(url);
  };
}

