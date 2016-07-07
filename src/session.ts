// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IAjaxSettings
} from 'jupyter-js-utils';

import * as utils
  from 'jupyter-js-utils';

import {
  ISignal, Signal, clearSignalData
} from 'phosphor-signaling';

import {
  IKernel, KernelMessage
} from './ikernel';

import {
  ISession
} from './isession';

import {
  connectToKernel, getKernelSpecs
} from './kernel';

import * as validate
  from './validate';


/**
 * The url for the session service.
 */
const SESSION_SERVICE_URL = 'api/sessions';


/**
 * An implementation of a session manager.
 */
export
class SessionManager implements ISession.IManager {
  /**
   * Construct a new session manager.
   *
   * @param options - The default options for each session.
   */
  constructor(options?: ISession.IOptions) {
    this._options = utils.copy(options || {});
  }

  /**
   * Get the available kernel specs. See also [[getKernelSpecs]].
   *
   * @param options - Overrides for the default options.
   */
  getSpecs(options?: ISession.IOptions): Promise<IKernel.ISpecModels> {
    return getKernelSpecs(this._getOptions(options));
  }

  /**
   * List the running sessions.  See also [[listRunningSessions]].
   *
   * @param options - Overrides for the default options.
   */
  listRunning(options?: ISession.IOptions): Promise<ISession.IModel[]> {
    return listRunningSessions(this._getOptions(options));
  }

  /**
   * Start a new session.  See also [[startNewSession]].
   *
   * @param options - Overrides for the default options, must include a
   *   `'path'`.
   */
  startNew(options: ISession.IOptions): Promise<ISession> {
    return startNewSession(this._getOptions(options));
  }

  /**
   * Find a session by id.
   */
  findById(id: string, options?: ISession.IOptions): Promise<ISession.IModel> {
    return findSessionById(id, this._getOptions(options));
  }

  /**
   * Find a session by path.
   */
  findByPath(path: string, options?: ISession.IOptions): Promise<ISession.IModel> {
    return findSessionByPath(path, this._getOptions(options));
  }

  /*
   * Connect to a running session.  See also [[connectToSession]].
   */
  connectTo(id: string, options?: ISession.IOptions): Promise<ISession> {
    return connectToSession(id, this._getOptions(options));
  }

  /**
   * Get optionally overidden options.
   */
  private _getOptions(options: ISession.IOptions): ISession.IOptions {
    if (options) {
      options = utils.extend(utils.copy(this._options), options);
    } else {
      options = this._options;
    }
    return options;
  }

  private _options: ISession.IOptions = null;
}


/**
 * List the running sessions.
 *
 * #### Notes
 * Uses the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/sessions), and validates the response.
 *
 * All client-side sessions are updated with current information.
 *
 * The promise is fulfilled on a valid response and rejected otherwise.
 */
export
function listRunningSessions(options?: ISession.IOptions): Promise<ISession.IModel[]> {
  options = options || {};
  let baseUrl = options.baseUrl || utils.getBaseUrl();
  let url = utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL);
  let ajaxSettings = utils.copy(options.ajaxSettings) || {};
  ajaxSettings.method = 'GET';
  ajaxSettings.dataType = 'json';
  ajaxSettings.cache = false;

  return utils.ajaxRequest(url, ajaxSettings).then(success => {
    if (success.xhr.status !== 200) {
      throw Error('Invalid Status: ' + success.xhr.status);
    }
    if (!Array.isArray(success.data)) {
      throw Error('Invalid Session list');
    }
    for (let i = 0; i < success.data.length; i++) {
      validate.validateSessionModel(success.data[i]);
    }
    return Private.updateRunningSessions(success.data);
  }, Private.onSessionError);
}


/**
 * Start a new session.
 *
 * #### Notes
 * Uses the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/sessions), and validates the response.
 *
 * A path must be provided.  If a kernel id is given, it will
 * connect to an existing kernel.  If no kernel id or name is given,
 * the server will start the default kernel type.
 *
 * The promise is fulfilled on a valid response and rejected otherwise.
 *
 * Wrap the result in an Session object. The promise is fulfilled
 * when the session is created on the server, otherwise the promise is
 * rejected.
 */
export
function startNewSession(options: ISession.IOptions): Promise<ISession> {
  if (options.path === void 0) {
    return Promise.reject(new Error('Must specify a path'));
  }
  return Private.startSession(options).then(model => {
    return Private.createSession(model, options);
  });
}


/**
 * Find a session by id.
 *
 * #### Notes
 * If the session was already started via `startNewSession`, the existing
 * Session object's information is used in the fulfillment value.
 *
 * Otherwise, if `options` are given, we attempt to find to the existing
 * session.
 * The promise is fulfilled when the session is found,
 * otherwise the promise is rejected.
 */
export
function findSessionById(id: string, options?: ISession.IOptions): Promise<ISession.IModel> {
  let sessions = Private.runningSessions;
  for (let clientId in sessions) {
    let session = sessions[clientId];
    if (session.id === id) {
      let model = {
        id,
        notebook: { path: session.path },
        kernel: { name: session.kernel.name, id: session.kernel.id }
      };
      return Promise.resolve(model);
    }
  }
  return Private.getSessionModel(id, options).catch(() => {
    let msg = `No running session for id: ${id}`;
    return Private.typedThrow<ISession.IModel>(msg);
  });
}


/**
 * Find a session by path.
 *
 * #### Notes
 * If the session was already started via `startNewSession`, the existing
 * Session object's info is used in the fulfillment value.
 *
 * Otherwise, if `options` are given, we attempt to find to the existing
 * session using [listRunningSessions].
 * The promise is fulfilled when the session is found,
 * otherwise the promise is rejected.
 *
 * If the session was not already started and no `options` are given,
 * the promise is rejected.
 */
export
function findSessionByPath(path: string, options?: ISession.IOptions): Promise<ISession.IModel> {
  let sessions = Private.runningSessions;
  for (let clientId in sessions) {
    let session = sessions[clientId];
    if (session.path === path) {
      let model = {
        id: session.id,
        notebook: { path: session.path },
        kernel: { name: session.kernel.name, id: session.kernel.id }
      };
      return Promise.resolve(model);
    }
  }
  return listRunningSessions(options).then(models => {
    for (let model of models) {
      if (model.notebook.path === path) {
        return model;
      }
    }
    let msg = `No running session for path: ${path}`;
    return Private.typedThrow<ISession.IModel>(msg);
  });
}


/**
 * Connect to a running session.
 *
 * #### Notes
 * If the session was already started via `startNewSession`, the existing
 * Session object is used as the fulfillment value.
 *
 * Otherwise, if `options` are given, we attempt to connect to the existing
 * session.
 * The promise is fulfilled when the session is ready on the server,
 * otherwise the promise is rejected.
 *
 * If the session was not already started and no `options` are given,
 * the promise is rejected.
 */
export
function connectToSession(id: string, options?: ISession.IOptions): Promise<ISession> {
  for (let clientId in Private.runningSessions) {
    let session = Private.runningSessions[clientId];
    if (session.id === id) {
      return session.clone();
    }
  }
  return Private.getSessionModel(id, options).then(model => {
    return Private.createSession(model, options);
  }).catch(() => {
    let msg = `No running session with id: ${id}`;
    return Private.typedThrow<ISession>(msg);
  });
}


/**
 * Session object for accessing the session REST api. The session
 * should be used to start kernels and then shut them down -- for
 * all other operations, the kernel object should be used.
 */
class Session implements ISession {
  /**
   * Construct a new session.
   */
  constructor(options: ISession.IOptions, id: string, kernel: IKernel) {
    this.ajaxSettings = options.ajaxSettings || { };
    this._id = id;
    this._path = options.path;
    options.baseUrl = options.baseUrl || utils.getBaseUrl();
    this._url = utils.urlPathJoin(options.baseUrl, SESSION_SERVICE_URL, this._id);
    this._uuid = utils.uuid();
    Private.runningSessions[this._uuid] = this;
    this.setupKernel(kernel);
    this._options = utils.copy(options);
  }

  /**
   * A signal emitted when the session dies.
   */
  get sessionDied(): ISignal<ISession, void> {
    return Private.sessionDiedSignal.bind(this);
  }

  /**
   * A signal emitted when the kernel changes.
   */
  get kernelChanged(): ISignal<ISession, IKernel> {
    return Private.kernelChangedSignal.bind(this);
  }

  /**
   * A signal emitted when the kernel status changes.
   */
  get statusChanged(): ISignal<ISession, IKernel.Status> {
    return Private.statusChangedSignal.bind(this);
  }

  /**
   * A signal emitted for a kernel messages.
   */
  get iopubMessage(): ISignal<ISession, KernelMessage.IMessage> {
    return Private.iopubMessageSignal.bind(this);
  }

  /**
   * A signal emitted for an unhandled kernel message.
   */
  get unhandledMessage(): ISignal<ISession, KernelMessage.IMessage> {
    return Private.unhandledMessageSignal.bind(this);
  }

  /**
   * A signal emitted when the session path changes.
   */
  get pathChanged(): ISignal<ISession, string> {
    return Private.pathChangedSignal.bind(this);
  }

  /**
   * Get the session id.
   *
   * #### Notes
   * This is a read-only property.
   */
  get id(): string {
    return this._id;
  }

  /**
   * Get the session kernel object.
   *
   * #### Notes
   * This is a read-only property, and can be altered by [changeKernel].
   * Use the [statusChanged] and [unhandledMessage] signals on the session
   * instead of the ones on the kernel.
   */
  get kernel() : IKernel {
    return this._kernel;
  }

  /**
   * Get the session path.
   *
   * #### Notes
   * This is a read-only property.
   */
  get path(): string {
    return this._path;
  }

  /**
   * Get the model associated with the session.
   *
   * #### Notes
   * This is a read-only property.
   */
  get model(): ISession.IModel {
    return {
      id: this.id,
      kernel: this.kernel.model,
      notebook: {
        path: this.path
      }
    };
  }

  /**
   * The current status of the session.
   *
   * #### Notes
   * This is a read-only property, and is a delegate to the kernel status.
   */
  get status(): IKernel.Status {
    return this._kernel ? this._kernel.status : 'dead';
  }

  /**
   * Get a copy of the default ajax settings for the session.
   */
  get ajaxSettings(): IAjaxSettings {
    return JSON.parse(this._ajaxSettings);
  }

  /**
   * Set the default ajax settings for the session.
   */
  set ajaxSettings(value: IAjaxSettings) {
    this._ajaxSettings = JSON.stringify(value);
  }

  /**
   * Test whether the session has been disposed.
   *
   * #### Notes
   * This is a read-only property which is always safe to access.
   */
  get isDisposed(): boolean {
    return this._options === null;
  }

  /**
   * Clone the current session with a new clientId.
   */
  clone(): Promise<ISession> {
    let options = this._getKernelOptions();
    return connectToKernel(this.kernel.id, options).then(kernel => {
      options = utils.copy(this._options);
      options.ajaxSettings = this.ajaxSettings;
      return new Session(options, this._id, kernel);
    });
  }

  /**
   * Update the session based on a session model from the server.
   */
  update(model: ISession.IModel): Promise<void> {
    // Avoid a race condition if we are waiting for a REST call return.
    if (this._updating) {
      return Promise.resolve(void 0);
    }
    if (this._path !== model.notebook.path) {
      this.pathChanged.emit(model.notebook.path);
    }
    this._path = model.notebook.path;
    if (model.kernel.id !== this._kernel.id) {
      let options = this._getKernelOptions();
      options.name = model.kernel.name;
      return connectToKernel(model.kernel.id, options).then(kernel => {
        this.setupKernel(kernel);
        this.kernelChanged.emit(kernel);
      });
    }
    return Promise.resolve(void 0);
  }

  /**
   * Dispose of the resources held by the session.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    if (this._kernel) {
      this._kernel.dispose();
    }
    this._options = null;
    delete Private.runningSessions[this._uuid];
    this._kernel = null;
    clearSignalData(this);
  }

  /**
   * Change the session path.
   *
   * @param path - The new session path.
   *
   * #### Notes
   * This uses the Jupyter REST API, and the response is validated.
   * The promise is fulfilled on a valid response and rejected otherwise.
   */
  rename(path: string): Promise<void> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    let data = JSON.stringify({
      notebook: { path }
    });
    return this._patch(data).then(() => { return void 0; });
  }

  /**
   * Change the kernel.
   *
   * @params options - The name or id of the new kernel.
   *
   * #### Notes
   * This shuts down the existing kernel and creates a new kernel,
   * keeping the existing session ID and session path.
   */
  changeKernel(options: IKernel.IModel): Promise<IKernel> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    this._kernel.dispose();
    let data = JSON.stringify({ kernel: options });
    return this._patch(data).then(() => {
      return this.kernel;
    });
  }

  /**
   * Kill the kernel and shutdown the session.
   *
   * @returns - The promise fulfilled on a valid response from the server.
   *
   * #### Notes
   * Uses the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/sessions), and validates the response.
   * Emits a [sessionDied] signal on success.
   */
  shutdown(): Promise<void> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    let ajaxSettings = this.ajaxSettings;
    ajaxSettings.method = 'DELETE';
    ajaxSettings.dataType = 'json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(this._url, ajaxSettings).then(success => {
      if (success.xhr.status !== 204) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      this._kernel.dispose();
      this._kernel = null;
      this.sessionDied.emit(void 0);
    }, (rejected: utils.IAjaxError) => {
      if (rejected.xhr.status === 410) {
        throw Error('The kernel was deleted but the session was not');
      }
      Private.onSessionError(rejected);
    });
  }

  /**
   * Handle connections to a kernel.
   */
  protected setupKernel(kernel: IKernel): void {
    this._kernel = kernel;
    kernel.statusChanged.connect(this.onKernelStatus, this);
    kernel.unhandledMessage.connect(this.onUnhandledMessage, this);
    kernel.iopubMessage.connect(this.onIOPubMessage, this);
  }

  /**
   * Handle to changes in the Kernel status.
   */
  protected onKernelStatus(sender: IKernel, state: IKernel.Status) {
    this.statusChanged.emit(state);
  }

  /**
   * Handle iopub kernel messages.
   */
  protected onIOPubMessage(sender: IKernel, msg: KernelMessage.IIOPubMessage) {
    this.iopubMessage.emit(msg);
  }

  /**
   * Handle unhandled kernel messages.
   */
  protected onUnhandledMessage(sender: IKernel, msg: KernelMessage.IMessage) {
    this.unhandledMessage.emit(msg);
  }

  /**
   * Get the options used to create a new kernel.
   */
  private _getKernelOptions(): IKernel.IOptions {
    return {
      baseUrl: this._options.baseUrl,
      wsUrl: this._options.wsUrl,
      username: this.kernel.username,
      ajaxSettings: this.ajaxSettings
    };
  }

  /**
   * Send a PATCH to the server, updating the session path or the kernel.
   */
  private _patch(data: string): Promise<ISession.IModel> {
    let ajaxSettings = this.ajaxSettings;
    ajaxSettings.method = 'PATCH';
    ajaxSettings.dataType = 'json';
    ajaxSettings.data = data;
    ajaxSettings.contentType = 'application/json';
    ajaxSettings.cache = false;
    this._updating = true;

    return utils.ajaxRequest(this._url, ajaxSettings).then(success => {
      if (success.xhr.status !== 200) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      let data = success.data as ISession.IModel;
      validate.validateSessionModel(data);
      this._updating = false;
      return Private.updateByModel(data);
    }, error => {
      this._updating = false;
      return Private.onSessionError(error);
    });
  }

  private _id = '';
  private _path = '';
  private _ajaxSettings = '';
  private _kernel: IKernel = null;
  private _uuid = '';
  private _url = '';
  private _options: ISession.IOptions = null;
  private _updating = false;
}


/**
 * A namespace for session private data.
 */
namespace Private {
  /**
   * A signal emitted when the session is shut down.
   */
  export
  const sessionDiedSignal = new Signal<ISession, void>();

  /**
   * A signal emitted when the kernel changes.
   */
  export
  const kernelChangedSignal = new Signal<ISession, IKernel>();

  /**
   * A signal emitted when the session kernel status changes.
   */
  export
  const statusChangedSignal = new Signal<ISession, IKernel.Status>();

  /**
   * A signal emitted for iopub kernel messages.
   */
  export
  const iopubMessageSignal = new Signal<ISession, KernelMessage.IIOPubMessage>();

  /**
   * A signal emitted for an unhandled kernel message.
   */
  export
  const unhandledMessageSignal = new Signal<ISession, KernelMessage.IMessage>();

  /**
   * A signal emitted when the session path changes.
   */
  export
  const pathChangedSignal = new Signal<ISession, string>();

  /**
   * The running sessions.
   */
  export
  const runningSessions: { [key: string]: Session; } = Object.create(null);

  /**
   * Create a new session, or return an existing session if a session if
   * the session path already exists
   */
  export
  function startSession(options: ISession.IOptions): Promise<ISession.IModel> {
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let url = utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL);
    let model = {
      kernel: { name: options.kernelName, id: options.kernelId },
      notebook: { path: options.path }
    };
    let ajaxSettings = utils.copy(options.ajaxSettings) || {};
    ajaxSettings.method = 'POST';
    ajaxSettings.dataType = 'json';
    ajaxSettings.data = JSON.stringify(model);
    ajaxSettings.contentType = 'application/json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 201) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateSessionModel(success.data);
      let data = success.data as ISession.IModel;
      return updateByModel(data);
    }, onSessionError);
  }

  /**
   * Create a Promise for a kernel object given a session model and options.
   */
  export
  function createKernel(model: ISession.IModel, options: ISession.IOptions): Promise<IKernel> {
    let kernelOptions = {
      name: model.kernel.name,
      baseUrl: options.baseUrl || utils.getBaseUrl(),
      wsUrl: options.wsUrl,
      username: options.username,
      clientId: options.clientId,
      ajaxSettings: options.ajaxSettings
    };
    return connectToKernel(model.kernel.id, kernelOptions);
  }

  /**
   * Create a Session object.
   *
   * @returns - A promise that resolves with a started session.
   */
  export
  function createSession(model: ISession.IModel, options: ISession.IOptions): Promise<Session> {
    return createKernel(model, options).then(kernel => {
       return new Session(options, model.id, kernel);
    }).catch(error => {
      return typedThrow('Session failed to start: ' + error.message);
    });
  }

  /**
   * Get a full session model from the server by session id string.
   */
  export
  function getSessionModel(id: string, options?: ISession.IOptions): Promise<ISession.IModel> {
    options = options || {};
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let url = utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL, id);
    let ajaxSettings = options.ajaxSettings || {};
    ajaxSettings.method = 'GET';
    ajaxSettings.dataType = 'json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 200) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      let data = success.data as ISession.IModel;
      validate.validateSessionModel(data);
      return updateByModel(data);
    }, Private.onSessionError);
  }

  /**
   * Update the running sessions based on new data from the server.
   */
  export
  function updateRunningSessions(sessions: ISession.IModel[]): Promise<ISession.IModel[]> {
    let promises: Promise<void>[] = [];
    for (let uuid in runningSessions) {
      let session = runningSessions[uuid];
      let updated = false;
      for (let sId of sessions) {
        if (session.id === sId.id) {
          promises.push(session.update(sId));
          updated = true;
          break;
        }
      }
      // If session is no longer running on disk, emit dead signal.
      if (!updated && session.status !== 'dead') {
        session.sessionDied.emit(void 0);
      }
    }
    return Promise.all(promises).then(() => { return sessions; });
  }

  /**
   * Update the running sessions given an updated session Id.
   */
  export
  function updateByModel(model: ISession.IModel): Promise<ISession.IModel> {
    let promises: Promise<void>[] = [];
    for (let uuid in runningSessions) {
      let session = runningSessions[uuid];
      if (session.id === model.id) {
        promises.push(session.update(model));
      }
    }
    return Promise.all(promises).then(() => { return model; });
  }

  /**
   * Handle an error on a session Ajax call.
   */
  export
  function onSessionError(error: utils.IAjaxError): any {
    let text = (error.statusText ||
                error.error.message ||
                error.xhr.responseText);
    console.error(`API request failed (${error.xhr.status}):  ${text}`);
    throw Error(text);
  }

  /**
   * Throw a typed error.
   */
  export
  function typedThrow<T>(msg: string): T {
    throw new Error(msg);
  }
}
