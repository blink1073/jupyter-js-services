// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  ISignal
} from '@phosphor/signaling';

import {
  IServerOptions
} from '../';

import {
  Kernel, KernelMessage
} from '../kernel';

import {
  DefaultSession
} from './default';


/**
 * A namespace for session interfaces and factory functions.
 *
 * #### Notes
 * The client side session has a different lifecycle than
 * the server side session.  A client side session does not
 * require an active kernel, and persists for the life of the
 * given path.
 * Consumers should connect to `iopubMessage` and `unhandledMessage`
 * on the session to avoid having to reconnect when the kernel changes.
 * Consumers should *not* call shutdown on the kernel itself, as that
 * is considered an error on the server.  Call shutdown on the session.
 */
export
namespace Session {
  /**
   * Interface of for a client session object.
   */
  export
  interface ISession extends IDisposable {
    /**
     * A signal emitted when the session is shut down.
     */
    readonly terminated: ISignal<this, void>;

    /**
     * A signal emitted when a session property changes.
     */
    readonly changed: ISignal<this, keyof ISession>;

    /**
     * A signal emitted for iopub kernel messages.
     */
    readonly iopubMessage: ISignal<this, KernelMessage.IIOPubMessage>;

    /**
     * A signal emitted for unhandled kernel message.
     */
    readonly unhandledMessage: ISignal<this, KernelMessage.IMessage>;

    /**
     * The path associated with the session.
     */
    readonly path: string;

    /**
     * The name of the session.
     */
    readonly name: string;

    /**
     * The type of the session.
     */
    readonly type: string;

    /**
     * The name of the default kernel.
     */
    defaultKernelName: string;

    /**
     * The kernel.
     *
     * #### Notes
     * This is a read-only property, and can be altered by [changeKernel].
     * Use the [statusChanged] and [unhandledMessage] signals on the session
     * instead of the ones on the kernel.
     */
    readonly kernel: Kernel.IKernel;

    /**
     * The current status of the session.
     *
     * #### Notes
     * This is a delegate to the kernel status.
     */
    readonly status: Kernel.Status;

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
    startKernel(options?: Kernel.IModel): Promise<Kernel.IKernel>;

    /**
     * Kill the kernel and shutdown the server session.
     *
     * @returns A promise that resolves when the session is shut down.
     *
     * #### Notes
     * This uses the Jupyter REST API, and the response is validated.
     * The promise is fulfilled on a valid response and rejected otherwise.
     */
    shutdown(): Promise<void>;
  }

  /**
   * An interface for a session that has writable attributes.
   */
  export
  interface IManagedSession extends ISession {
    /**
     * The id of the current server side session.
     */
    readonly id: string | null;

    /**
     * The name of the default kernel.
     */
    defaultKernelName: string;

    /**
     * The server settings
     */
    readonly serverSettings: IServerOptions;

    /**
     * The managed kernel instance.
     */
    readonly kernel: Kernel.IManagedKernel;

    /**
     * Set the path of the session.
     */
    setPath(path: string): Promise<void>;

    /**
     * Set the name of the session.
     */
    setName(name: string): Promise<void>;

    /**
     * Set the type of the session.
     */
    setType(type: string): Promise<void>;
  }

  /**
   * List the running sessions.
   *
   * @param options - The options used for the request.
   *
   * @returns A promise that resolves with the list of session models.
   *
   * #### Notes
   * Uses the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/sessions), and validates the response.
   *
   * All client-side sessions are updated with current information.
   *
   * The promise is fulfilled on a valid response and rejected otherwise.
   */
  export
  function listRunning(options?: Partial<IServerOptions>): Promise<Session.IModel[]> {
    return DefaultSession.listRunning(options);
  }

  /**
   * Start a new session.
   *
   * @param options - The options used to start the session.
   *
   * @returns A promise that resolves with the session instance.
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
  function startNew(options: IOptions): Promise<IManagedSession> {
    return DefaultSession.startNew(options);
  }

  /**
   * Find a session by id.
   *
   * @param id - The id of the target session.
   *
   * @param options - The options used to fetch the session.
   *
   * @returns A promise that resolves with the session model.
   *
   * #### Notes
   * If the session was already started via `startNew`, the existing
   * Session object's information is used in the fulfillment value.
   *
   * Otherwise, if `options` are given, we attempt to find to the existing
   * session.
   * The promise is fulfilled when the session is found,
   * otherwise the promise is rejected.
   */
  export
  function findById(id: string, options?: Partial<IServerOptions>): Promise<IModel> {
    return DefaultSession.findById(id, options);
  }

  /**
   * Find a session by path.
   *
   * @param path - The path of the target session.
   *
   * @param options - The options used to fetch the session.
   *
   * @returns A promise that resolves with the session model.
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
  function findByPath(path: string, options?: Partial<IServerOptions>): Promise<IModel> {
    return DefaultSession.findByPath(path, options);
  }

  /**
   * Connect to a running session.
   *
   * @param path - The path of the target session.
   *
   * @param options - The options used to fetch the session.
   *
   * @returns A promise that resolves with the session instance.
   *
   * #### Notes
   * If the session was already started via `startNew`, the existing
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
  function connectTo(path: string, options: Partial<IServerOptions> = {}): Promise<IManagedSession> {
    return DefaultSession.connectTo(path, options);
  }

  /**
   * Shut down a session by path.
   *
   * @param path - The path of the target session.
   *
   * @param options - The options used to fetch the session.
   *
   * @returns A promise that resolves when the session is shut down.
   *
   */
  export
  function shutdown(path: string, options: Partial<IServerOptions> = {}): Promise<void> {
    return DefaultSession.shutdown(path, options);
  }

  /**
   * The session initialization options.
   */
  export
  interface IOptions {
    /**
     * The path (not including name) to the session.
     */
    path: string;

    /**
     * The name of the default kernel.
     */
    defaultKernelName?: string;

    /**
     * The name of the session.
     */
    name?: string;

    /**
     * The type of the session.
     */
    type?: string;

    /**
     * The username of the session client.
     */
    username?: string;

    /**
     * The unique identifier for the session client.
     */
    clientId?: string;

    /**
     * The server settings.
     */
    serverSettings?: Partial<IServerOptions>;
  }

  /**
   * Object which manages session instances.
   *
   * #### Notes
   * The manager is responsible for maintaining the state of running
   * sessions and the initial fetch of kernel specs.
   */
  export
  interface IManager extends IDisposable {
    /**
     * A signal emitted when the kernel specs change.
     */
    specsChanged: ISignal<IManager, Kernel.ISpecModels>;

    /**
     * A signal emitted when the running sessions change.
     */
    runningChanged: ISignal<IManager, IModel[]>;

    /**
     * The server settings
     */
    readonly serverSettings: IServerOptions;

    /**
     * The cached kernel specs.
     *
     * #### Notes
     * This value will be null until the manager is ready.
     */
    readonly specs: Kernel.ISpecModels | null;

    /**
     * The known running sessions.
     */
    readonly running: ReadonlyArray<IModel>;

    /**
     * Test whether the manager is ready.
     */
    readonly isReady: boolean;

    /**
     * A promise that is fulfilled when the manager is ready.
     */
    readonly ready: Promise<void>;

    /**
     * Start a new session.
     *
     * @param options - The session options to use.
     *
     * @returns A promise that resolves with the session instance.
     *
     * #### Notes
     * The baseUrl and wsUrl of the options will be forced
     * to the ones used by the manager. The ajaxSettings of the manager
     * will be used unless overridden.
     */
    startNew(options: IOptions): Promise<IManagedSession>;

    /**
     * Find a session by id.
     *
     * @param id - The id of the target session.
     *
     * @returns A promise that resolves with the session's model.
     */
    findById(id: string): Promise<IModel>;

    /**
     * Find a session by path.
     *
     * @param path - The path of the target session.
     *
     * @returns A promise that resolves with the session's model.
     */
    findByPath(path: string): Promise<IModel>;

    /**
     * Connect to a running session.
     *
     * @param path - The path of the target session.
     *
     * @param options - The session options to use.
     *
     * @returns A promise that resolves with the new session instance.
     */
    connectTo(path: string): Promise<IManagedSession>;

    /**
     * Shut down a session by path.
     *
     * @param path - The path of the target session.
     *
     * @returns A promise that resolves when the operation is complete.
     */
    shutdown(path: string): Promise<void>;

    /**
     * Force a refresh of the specs from the server.
     *
     * @returns A promise that resolves when the specs are fetched.
     *
     * #### Notes
     * This is intended to be called only in response to a user action,
     * since the manager maintains its internal state.
     */
    refreshSpecs(): Promise<void>;

    /**
     * Force a refresh of the running sessions.
     *
     * @returns A promise that resolves when the models are refreshed.
     *
     * #### Notes
     * This is intended to be called only in response to a user action,
     * since the manager maintains its internal state.
     */
    refreshRunning(): Promise<void>;
  }

  /**
   * The session model used by the server.
   *
   * #### Notes
   * See the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/sessions).
   */
  export
  interface IModel extends JSONObject {
    /**
     * The unique identifier for the session client.
     */
    readonly id: string;
    readonly path: string;
    readonly name: string;
    readonly type: string;
    readonly kernel: Partial<Kernel.IModel>;
  }
}
