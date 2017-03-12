// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt
} from '@phosphor/algorithm';

import {
  JSONExt
} from '@phosphor/coreutils';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  Kernel
} from '../kernel';

import {
  Session
} from './session';

import {
  IServerOptions, createServerOptions
} from '../utils';

/**
 * An implementation of a session manager.
 */
export
class SessionManager implements Session.IManager {
  /**
   * Construct a new session manager.
   *
   * @param options - The server options for the manager.
   */
  constructor(options: Partial<IServerOptions> = {}) {
    this._options = createServerOptions(options);

    // Initialize internal data.
    this._readyPromise = this._refreshSpecs().then(() => {
      return this._refreshRunning();
    });

    // Set up polling.
    this._runningTimer = (setInterval as any)(() => {
      this._refreshRunning();
    }, 10000);
    this._specsTimer = (setInterval as any)(() => {
      this._refreshSpecs();
    }, 61000);
  }

  /**
   * A signal emitted when the kernel specs change.
   */
  get specsChanged(): ISignal<this, Kernel.ISpecModels> {
    return this._specsChanged;
  }

  /**
   * A signal emitted when the running sessions change.
   */
  get runningChanged(): ISignal<this, Session.IModel[]> {
    return this._runningChanged;
  }

  /**
   * Test whether the terminal manager is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    clearInterval(this._runningTimer);
    clearInterval(this._specsTimer);
    Signal.clearData(this);
    this._running = [];
  }

  /**
   * The server options.
   */
  get serverOptions(): IServerOptions {
    return this._options;
  }

  /**
   * Get the most recently fetched kernel specs.
   */
  get specs(): Kernel.ISpecModels | null {
    return this._specs;
  }

  /**
   * Test whether the manager is ready.
   */
  get isReady(): boolean {
    return this._specs !== null;
  }

  /**
   * A promise that fulfills when the manager is ready.
   */
  get ready(): Promise<void> {
    return this._readyPromise;
  }

  /**
   * The known running sessions.
   */
  get running(): ReadonlyArray<Session.IModel> {
    return this._running;
  }

  /**
   * Force a refresh of the specs from the server.
   *
   * @returns A promise that resolves when the specs are fetched.
   *
   * #### Notes
   * This is intended to be called only in response to a user action,
   * since the manager maintains its internal state.
   */
  refreshSpecs(): Promise<void> {
    return this._refreshSpecs();
  }

  /**
   * Force a refresh of the running sessions.
   *
   * @returns A promise that with the list of running sessions.
   *
   * #### Notes
   * This is not typically meant to be called by the user, since the
   * manager maintains its own internal state.
   */
  refreshRunning(): Promise<void> {
    return this._refreshRunning();
  }

  /**
   * Start a new session.  See also [[startNewSession]].
   *
   * @param options - Overrides for the default options, must include a
   *   `'path'`.
   */
  startNew(options: Session.IOptions): Promise<Session.IManagedSession> {
    options.serverOptions = this._options;
    return Session.startNew(options).then(session => {
      this._onStarted(session);
      return session;
    });
  }

  /**
   * Find a session by id.
   */
  findById(id: string): Promise<Session.IModel> {
    return Session.findById(id, this._options);
  }

  /**
   * Find a session by path.
   */
  findByPath(path: string): Promise<Session.IModel> {
    return Session.findByPath(path, this._options);
  }

  /*
   * Connect to a running session.  See also [[connectToSession]].
   */
  connectTo(path: string): Promise<Session.IManagedSession> {
    return Session.connectTo(path, this._options).then(session => {
      this._onStarted(session);
      return session;
    });
  }

  /**
   * Shut down a session by id.
   */
  shutdown(id: string): Promise<void> {
    return Session.shutdown(id, this._options).then(() => {
      this._onTerminated(id);
    });
  }

  /**
   * Handle a session terminating.
   */
  private _onTerminated(id: string): void {
    let index = ArrayExt.findFirstIndex(this._running, value => value.id === id);
    if (index !== -1) {
      this._running.splice(index, 1);
      this._runningChanged.emit(this._running.slice());
    }
  }

  /**
   * Handle a session starting.
   */
  private _onStarted(session: Session.IManagedSession): void {
    let id = session.id;
    let index = ArrayExt.findFirstIndex(this._running, value => value.id === id);
    if (index === -1) {
      this._running.push(session.model);
      this._runningChanged.emit(this._running.slice());
    }
    session.terminated.connect(() => {
      this._onTerminated(id);
    });
    session.changed.connect(() => {
      this._onChanged(session.model);
    });
  }

  /**
   * Handle a change to a session.
   */
  private _onChanged(model: Session.IModel): void {
    let index = ArrayExt.findFirstIndex(this._running, value => value.path === model.path);
    if (index !== -1) {
      let old = this._running[index];
      if (!JSONExt.deepEqual(old, model)) {
        this._running[index] = model;
        this._runningChanged.emit(this._running);
      }
    }
  }

  /**
   * Refresh the specs.
   */
  private _refreshSpecs(): Promise<void> {
    return Kernel.getSpecs(this._options).then(specs => {
      if (!JSONExt.deepEqual(specs, this._specs)) {
        this._specs = specs;
        this._specsChanged.emit(specs);
      }
    });
  }

  /**
   * Refresh the running sessions.
   */
  private _refreshRunning(): Promise<void> {
    return Session.listRunning(this._options).then(running => {
      if (!JSONExt.deepEqual(running, this._running)) {
        this._running = running.slice();
        this._runningChanged.emit(running);
      }
    });
  }

  private _options: IServerOptions;
  private _isDisposed = false;
  private _running: Session.IModel[] = [];
  private _specs: Kernel.ISpecModels = null;
  private _runningTimer = -1;
  private _specsTimer = -1;
  private _readyPromise: Promise<void>;
  private _specsChanged = new Signal<this, Kernel.ISpecModels>(this);
  private _runningChanged = new Signal<this, Session.IModel[]>(this);
}
