// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

export * from './config';
export * from './contents';
export * from './kernel';
export * from './manager';
export * from './nbformat';
export * from './session';
export * from './terminal';

export {
  IAjaxSettings
} from './utils';

import * as utils
  from './utils';

export { utils };


/**
 * Server options.
 */
export
interface IServerOptions {
  /**
   * The root url of the server.
   */
  baseUrl: string;

  /**
   * The url to access websockets.
   */
  wsUrl: string;

  /**
   * The token used for API requests.
   */
  token: string;

  /**
   * Is a Boolean that indicates whether or not cross-site Access-Control
   * requests should be made using credentials such as cookies or
   * authorization headers.  Defaults to `false`.
   */
  withCredentials: boolean;

  /**
   * Default mapping of request headers, used via `setRequestHeader`.
   */
  requestHeaders?: { [key: string]: string; };

  /**
   * The user name for the server with the request.  Defaults to `''`.
   */
  user: string;

  /**
   * The password for the server.  Defaults to `''`.
   */
  password: string;
}
