// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt, each, find, toArray
} from '@phosphor/algorithm';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  Kernel, KernelMessage
} from '../kernel';

import {
  IAjaxSettings
} from '../utils';

import * as utils
  from '../utils';

import {
  Session
} from './session';

import * as validate
  from './validate';


/**
 * The url for the session service.
 */
const SESSION_SERVICE_URL = 'api/sessions';


/**
 * Session object for accessing the session REST api. The session
 * should be used to start kernels and then shut them down -- for
 * all other operations, the kernel object should be used.
 */
export
class DefaultSession implements Session.IWritableSession {
  /**
   * Construct a new session.
   */
  constructor(options: Session.IOptions) {
    this._path = options.path;
    this._baseUrl = options.baseUrl || utils.getBaseUrl();
    this._uuid = utils.uuid();
    this._ajaxSettings = JSON.stringify(
      utils.ajaxSettingsWithToken(options.ajaxSettings || {}, options.token)
    );
    this._token = options.token || utils.getConfigOption('token');
    Private.runningSessions.push(this);
    this._options = {...options};
  }

  /**
   * A signal emitted when the session is shut down.
   */
  get terminated(): ISignal<this, void> {
    return this._terminated;
  }

  /**
   * A signal emitted when the kernel changes.
   */
  get changed(): ISignal<this, keyof Session.ISession> {
    return this._changed;
  }

  /**
   * A signal emitted for a kernel messages.
   */
  get iopubMessage(): ISignal<this, KernelMessage.IMessage> {
    return this._iopubMessage;
  }

  /**
   * A signal emitted for an unhandled kernel message.
   */
  get unhandledMessage(): ISignal<this, KernelMessage.IMessage> {
    return this._unhandledMessage;
  }

  /**
   * Get the current session id.
   */
  get id(): string | null {
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
  get kernel() : Kernel.IKernel {
    return this._kernel;
  }

  /**
   * Get the session path.
   */
  get path(): string {
    return this._path;
  }

  /**
   * The name of the session.
   */
  get name(): string {
    return this._name;
  }

  /**
   * The type of the session.
   */
  get type(): string {
    return this._type;
  }

  /**
   * The default kernel name.  If not given, the server default will
   * be used as the default.
   */
  get defaultKernelName(): string {
    return this._defaultKernelName;
  }
  set defaultKernelName(value: string) {
    this._defaultKernelName = value;
  }

  /**
   * Get the model associated with the session.
   */
  get model(): Session.IModel {
    let kernel = (
      this.kernel ? this.kernel.model : { name: this._defaultKernelName}
    );
    return {
      id: this.id,
      kernel,
      path: this._path,
      type: this._type,
      name: this._name
    };
  }

  /**
   * The current status of the session.
   *
   * #### Notes
   * This is a delegate to the kernel status.
   */
  get status(): Kernel.Status {
    return this._kernel ? this._kernel.status : 'dead';
  }

  /**
   * Get the base url of the session.
   */
  get baseUrl(): string {
    return this._baseUrl;
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
   */
  get isDisposed(): boolean {
    return this._options === null;
  }

  /**
   * Dispose of the resources held by the session.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._options = null;
    if (this._kernel) {
      this._kernel.dispose();
    }
    ArrayExt.removeFirstOf(Private.runningSessions, this);
    this._kernel = null;
    Signal.clearData(this);
  }

  /**
   * Update the session based on a session model from the server.
   */
  update(model: Session.IModel): Promise<void> {
    // Avoid a race condition if we are waiting for a REST call return.
    if (this._updating) {
      return Promise.resolve(void 0);
    }
    this._id = model.id;
    let oldModel = this.model;
    this._path = model.path;
    this._type = model.type;
    this._name = model.name;

    // Start a client kernel session if necessary.
    let deadKernel = this._kernel && this._kernel.isDisposed;
    let promise: Promise<void>;
    if (deadKernel || model.kernel.id !== oldModel.kernel.id) {
      let options = this._getKernelOptions();
      options.name = model.kernel.name;
      promise = Kernel.connectTo(model.kernel.id, options).then(kernel => {
        this.setupKernel(kernel);
      });
    } else {
      promise = Promise.resolve(void 0);
    }
    // Emit the other signals after we have handled the kernel.
    return promise.then(() => {
      if (oldModel.path !== this._path) {
        this._changed.emit('path');
      }
      if (oldModel.name !== this._name) {
        this._changed.emit('name');
      }
      if (oldModel.type !== this._type) {
        this._changed.emit('type');
      }
    });
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
  setPath(path: string): Promise<void> {
    if (this._path === path) {
      return Promise.resolve(void 0);
    }
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    this._path = path;
    this._changed.emit('path');
    if (!this._id) {
      return Promise.resolve(void 0);
    }
    let data = JSON.stringify({ path });
    return this._patch(data).then(() => { return void 0; });
  }


  /**
   * Change the session name.
   *
   * @param path - The new session name.
   *
   * #### Notes
   * This uses the Jupyter REST API, and the response is validated.
   * The promise is fulfilled on a valid response and rejected otherwise.
   */
  setName(name: string): Promise<void> {
    if (this._name === name) {
      return Promise.resolve(void 0);
    }
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    this._name = name;
    this._changed.emit('name');
    if (!this._id) {
      return Promise.resolve(void 0);
    }
    let data = JSON.stringify({ name });
    return this._patch(data).then(() => { return void 0; });
  }

  /**
   * Change the session type.
   *
   * @param path - The new session type.
   *
   * #### Notes
   * This uses the Jupyter REST API, and the response is validated.
   * The promise is fulfilled on a valid response and rejected otherwise.
   */
  setType(type: string): Promise<void> {
    if (this._type === type) {
      return Promise.resolve(void 0);
    }
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    let data = JSON.stringify({ type });
    this._type = type;
    this._changed.emit('type');
    if (!this._id) {
      return Promise.resolve(void 0);
    }
    return this._patch(data).then(() => { return void 0; });
  }

  /**
   * Start a kernel.
   *
   * @param options - The name or id of the new kernel.  Defaults
   *   to the default kernel for the session.
   *
   * @returns A promise that resolves with the new kernel object.
   *
   * #### Notes
   * This shuts down the existing kernel and creates a new kernel,
   * keeping the existing session path.
   */
  startKernel(options?: Kernel.IModel): Promise<Kernel.IKernel> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Session is disposed'));
    }
    if (this._kernel) {
      this._kernel.dispose();
    }
    if (options === void 0) {
      if (this._defaultKernelName) {
        options = { name: this._defaultKernelName };
      } else {
        options = {};
      }
    }
    let promise: Promise<Session.IModel>;
    if (!this._id) {
      promise = this._createServerSession(options);
    } else {
      let data = JSON.stringify({ kernel: options });
      promise = this._patch(data);
    }
    return promise.then(() => {
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
    let id = this._id;
    this._id = null;
    return Private.shutdownSession(id, this._baseUrl, this.ajaxSettings);
  }

  /**
   * Handle connections to a kernel.
   */
  protected setupKernel(kernel: Kernel.IKernel | null): void {
    this._kernel = kernel;
    if (kernel) {
      kernel.statusChanged.connect(this.onKernelStatus, this);
      kernel.unhandledMessage.connect(this.onUnhandledMessage, this);
      kernel.iopubMessage.connect(this.onIOPubMessage, this);
    }
    this._changed.emit('kernel');
  }

  /**
   * Handle to changes in the Kernel status.
   */
  protected onKernelStatus() {
    this._changed.emit('status');
  }

  /**
   * Handle iopub kernel messages.
   */
  protected onIOPubMessage(sender: Kernel.IKernel, msg: KernelMessage.IIOPubMessage) {
    this._iopubMessage.emit(msg);
  }

  /**
   * Handle unhandled kernel messages.
   */
  protected onUnhandledMessage(sender: Kernel.IKernel, msg: KernelMessage.IMessage) {
    this._unhandledMessage.emit(msg);
  }

  /**
   * Get the options used to create a new kernel.
   */
  private _getKernelOptions(): Kernel.IOptions {
    return {
      baseUrl: this._options.baseUrl,
      wsUrl: this._options.wsUrl,
      username: this.kernel.username,
      ajaxSettings: this.ajaxSettings
    };
  }

  /**
   * Create a server session for the client session.
   */
  private _createServerSession(kernel: Kernel.IModel): Promise<Session.IModel> {
    let model = {
      path: this._path,
      name: this._name,
      type: this._type,
      kernel,
    };
    return Private.startSession(model);
  }

  /**
   * Send a PATCH to the server, updating the session path or the kernel.
   */
  private _patch(data: string): Promise<Session.IModel> {
    let url = Private.getSessionUrl(this._baseUrl, this._id);
    let ajaxSettings = this.ajaxSettings;
    ajaxSettings.method = 'PATCH';
    ajaxSettings.dataType = 'json';
    ajaxSettings.data = data;
    ajaxSettings.contentType = 'application/json';
    ajaxSettings.cache = false;
    this._updating = true;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      this._updating = false;
      if (success.xhr.status !== 200) {
        throw utils.makeAjaxError(success);
      }
      let value = success.data as Session.IModel;
      try {
        validate.validateModel(value);
      } catch (err) {
        throw utils.makeAjaxError(success, err.message);
      }
      return Private.updateFromServer(value);
    }, error => {
      this._updating = false;
      return Private.onSessionError(error);
    });
  }

  private _id: string | null = null;
  private _path = '';
  private _name = '';
  private _type = '';
  private _ajaxSettings = '';
  private _token = '';
  private _kernel: Kernel.IKernel | null = null;
  private _uuid = '';
  private _baseUrl = '';
  private _defaultKernelName = '';
  private _options: Session.IOptions = null;
  private _updating = false;
  private _changed = new Signal<this, keyof Session.ISession>(this);
  private _terminated = new Signal<this, void>(this);
  private _iopubMessage = new Signal<this, KernelMessage.IMessage>(this);
  private _unhandledMessage = new Signal<this, KernelMessage.IMessage>(this);
}

/**
 * The namespace for `DefaultSession` statics.
 */
export
namespace DefaultSession {
  /**
   * List the running sessions.
   */
  export
  function listRunning(options?: Session.IOptions): Promise<Session.IModel[]> {
    return Private.listRunning(options);
  }

  /**
   * Start a new session.
   */
  export
  function startNew(options: Session.IOptions): Promise<Session.ISession> {
    return connectTo(options.path, options).catch(() => {
      return new DefaultSession(options);
    });
  }

  /**
   * Find a session by id.
   */
  export
  function findById(id: string, options?: Session.IOptions): Promise<Session.IModel> {
    return Private.findById(id, options);
  }

  /**
   * Find a session by path.
   */
  export
  function findByPath(path: string, options?: Session.IOptions): Promise<Session.IModel> {
    return Private.findByPath(path, options);
  }

  /**
   * Connect to a running session.
   */
  export
  function connectTo(path: string, options?: Session.IOptions): Promise<Session.ISession> {
    return Private.connectTo(path, options);
  }

  /**
   * Shut down a session by path.
   */
  export
  function shutdown(path: string, options: Session.IOptions): Promise<void> {
    return Private.shutdown(path, options);
  }
}


/**
 * A namespace for session private data.
 */
namespace Private {
  /**
   * The running sessions.
   */
  export
  const runningSessions: DefaultSession[] = [];

  /**
   * List the running sessions.
   */
  export
  function listRunning(options: Partial<Session.IOptions> = {}): Promise<Session.IModel[]> {
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let url = utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL);
    let ajaxSettings = utils.ajaxSettingsWithToken(options.ajaxSettings, options.token);
    ajaxSettings.method = 'GET';
    ajaxSettings.dataType = 'json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 200) {
        throw utils.makeAjaxError(success);
      }
      let data = success.data as Session.IModel[];
      if (!Array.isArray(success.data)) {
        throw utils.makeAjaxError(success, 'Invalid Session list');
      }
      for (let i = 0; i < data.length; i++) {
        try {
          validate.validateModel(data[i]);
        } catch (err) {
          throw utils.makeAjaxError(success, err.message);
        }
      }
      return updateRunningSessions(data);
    }, Private.onSessionError);
  }

  /**
   * Find a session by id.
   */
  export
  function findById(id: string, options: Partial<Session.IOptions> = {}): Promise<Session.IModel> {
    let session = find(runningSessions, value => value.id === id);
    if (session) {
      return Promise.resolve(session.model);
    }

    return getSessionModel(id, options).catch(() => {
      let msg = `No running session for id: ${id}`;
      return typedThrow<Session.IModel>(msg);
    });
  }

  /**
   * Find a session by path.
   */
  export
  function findByPath(path: string, options: Session.IOptions = {}): Promise<Session.IModel> {
    let session = find(runningSessions, value => value.path === path);
    if (session) {
      return Promise.resolve(session.model);
    }

    return listRunning(options).then(models => {
      let model = find(models, value => {
        return value.path === path;
      });
      if (model) {
        return model;
      }
      let msg = `No running session for path: ${path}`;
      return typedThrow<Session.IModel>(msg);
    });
  }

  /**
   * Connect to a running session.
   */
  export
  function connectTo(path: string, options: Session.IOptions = {}): Promise<Session.ISession> {
    let session = find(runningSessions, value => value.path === path);
    if (session) {
      return Promise.resolve(session);
    }
    return findByPath(path).then(model => {
      if (!model) {
        let msg = `Could not connect to ${path}`;
        return Promise.reject(new Error(msg));
      }
      let session = new DefaultSession(options);
      session.update(model);
      return session;
    });
  }

  /**
   * Shut down a session by path.
   */
  export
  function shutdown(path: string, options: Session.IOptions = {}): Promise<void> {
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let ajaxSettings = utils.ajaxSettingsWithToken(options.ajaxSettings, options.token);
    return findByPath(path, options).then(model => {
      if (!model) {
        return Promise.reject('Not found');
      }
      return shutdownSession(model.id, baseUrl, ajaxSettings);
    });
  }

  /**
   * Create a new session, or return an existing session if a session if
   * the session path already exists
   */
  export
  function startSession(model: Partial<Session.IModel>): Promise<Session.IModel> {
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let url = utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL);
    let ajaxSettings: IAjaxSettings = utils.ajaxSettingsWithToken(options.ajaxSettings, options.token);
    ajaxSettings.method = 'POST';
    ajaxSettings.dataType = 'json';
    ajaxSettings.data = JSON.stringify(model);
    ajaxSettings.contentType = 'application/json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 201) {
        throw utils.makeAjaxError(success);
      }
      try {
        validate.validateModel(success.data);
      } catch (err) {
        throw utils.makeAjaxError(success, err.message);
      }
      let data = success.data as Session.IModel;
      return updateFromServer(data);
    }, onSessionError);
  }

  /**
   * Get a full session model from the server by session id string.
   */
  export
  function getSessionModel(id: string, options?: Session.IOptions): Promise<Session.IModel> {
    options = options || {};
    let baseUrl = options.baseUrl || utils.getBaseUrl();
    let url = getSessionUrl(baseUrl, id);
    let ajaxSettings = utils.ajaxSettingsWithToken(options.ajaxSettings, options.token);
    ajaxSettings.method = 'GET';
    ajaxSettings.dataType = 'json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 200) {
        throw utils.makeAjaxError(success);
      }
      let data = success.data as Session.IModel;
      try {
        validate.validateModel(data);
      } catch (err) {
        throw utils.makeAjaxError(success, err.message);
      }
      return updateFromServer(data);
    }, Private.onSessionError);
  }

  /**
   * Update the running sessions based on new data from the server.
   */
  export
  function updateRunningSessions(sessions: Session.IModel[]): Promise<Session.IModel[]> {
    let promises: Promise<void>[] = [];

    each(runningSessions, session => {
      let updated = find(sessions, sId => {
        if (session.path === sId.path) {
          promises.push(session.update(sId));
          return true;
        }
      });
      // If session is no longer running on disk, emit dead signal.
      if (!updated && session.status !== 'dead') {
        session.terminated.emit(void 0);
      }
    });
    return Promise.all(promises).then(() => { return sessions; });
  }

  /**
   * Update the running sessions given an updated session Id.
   */
  export
  function updateFromServer(model: Session.IModel): Promise<Session.IModel> {
    let promises: Promise<void>[] = [];
    each(runningSessions, session => {
      if (session.path === model.path) {
        promises.push(session.update(model));
      }
    });
    return Promise.all(promises).then(() => { return model; });
  }

  /**
   * Shut down a session by id.
   */
  export
  function shutdownSession(id: string, baseUrl: string, ajaxSettings: IAjaxSettings = {}): Promise<void> {
    let url = getSessionUrl(baseUrl, id);
    ajaxSettings.method = 'DELETE';
    ajaxSettings.dataType = 'json';
    ajaxSettings.cache = false;

    return utils.ajaxRequest(url, ajaxSettings).then(success => {
      if (success.xhr.status !== 204) {
        throw utils.makeAjaxError(success);
      }
      killSessions(id);
    }, err => {
      if (err.xhr.status === 404) {
        let response = JSON.parse(err.xhr.responseText) as any;
        console.warn(response['message']);
        killSessions(id);
        return;
      }
      if (err.xhr.status === 410) {
        err.throwError = 'The kernel was deleted but the session was not';
      }
      return onSessionError(err);
    });
  }

  /**
   * Kill the sessions by id.
   */
  function killSessions(id: string): void {
    each(toArray(runningSessions), session => {
      if (session.id === id) {
        session.terminated.emit(void 0);
        session.dispose();
      }
    });
  }

  /**
   * Get a session url.
   */
  export
  function getSessionUrl(baseUrl: string, id: string): string {
    return utils.urlPathJoin(baseUrl, SESSION_SERVICE_URL, id);
  }

  /**
   * Handle an error on a session Ajax call.
   */
  export
  function onSessionError(error: utils.IAjaxError): Promise<any> {
    let text = (error.throwError ||
                error.xhr.statusText ||
                error.xhr.responseText);
    let msg = `API request failed: ${text}`;
    console.error(msg);
    return Promise.reject(error);
  }

  /**
   * Throw a typed error.
   */
  export
  function typedThrow<T>(msg: string): T {
    throw new Error(msg);
  }
}
