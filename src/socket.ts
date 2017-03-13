// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PromiseDelegate
} from '@phosphor/coreutils';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  URLExt
} from './url';


/**
 * A class that manages a web socket connection.
 */
export
class ManagedSocket implements IDisposable {
  /**
   * Create a new managed socket.
   */
  constructor(options: ManagedSocket.IOptions) {
    this.url = options.url;
    this._factory = options.factory || ManagedSocket.defaultFactory;
  }

  /**
   * A signal emitted when the status has changed.
   */
  get statusChanged(): ISignal<this, ManagedSocket.Status> {
    return this._statusChanged;
  }

  /**
   * A signal emitted when a message is received.
   */
  get messageReceived(): ISignal<this, MessageEvent> {
    return this._messageReceived;
  }

  /**
   * The url of the socket.
   */
  readonly url: string;

  /**
   * The status of the socket.
   */
  get status(): ManagedSocket.Status {
    return this._status;
  }

  /**
   * Test whether the manager is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._close();
    clearTimeout(this._timer);
    Signal.clearData(this);
  }

  /**
   * Connect or reconnect to the socket.
   */
  connect(): Promise<void> {
    this._reconnectAttempt = 0;
    this._delegate = new PromiseDelegate<void>();
    this._createSocket();
    return this._delegate.promise;
  }

  /**
   * Send a message to the socket.
   *
   * #### Notes
   * If the socket is not open the message will be queued.
   */
  send(msg: string): void {
    if (!this._ws || this._status !== 'open') {
      this._pendingMessages.push(msg);
      return;
    }
    this._ws.send(msg);
  }

  /**
   * Close the socket.
   */
  close(): void {
    this._close();
    clearTimeout(this._timer);
    this._setStatus('closed');
  }

  /**
   * Create the websocket connection and add socket status handlers.
   */
  private _createSocket(): void {
    let url = this.url;
    // Strip any authentication from the display string.
    let parsed = URLExt.parse(url);
    let display = url.replace(parsed.auth || '', '');
    console.log(`Starting websocket: ${display}`);

    // Clear any existing socket.
    this._close();

    // Update the status.
    this._setStatus('connecting');

    // Connect to the socket and set it up.
    let factory = this._factory;
    this._ws = factory(url);

    // Ensure incoming binary messages are not Blobs.
    this._ws.binaryType = 'arraybuffer';

    this._ws.onmessage = (evt: MessageEvent) => { this._onWSMessage(evt); };
    this._ws.onopen = (evt: Event) => { this._onWSOpen(evt); };
    this._ws.onclose = (evt: Event) => { this._onWSClose(evt); };
    this._ws.onerror = (evt: Event) => { this._onWSClose(evt); };
  }

  /**
   * Handle a websocket open event.
   */
  private _onWSOpen(evt: Event): void {
    if (!this._ws) {
      return;
    }
    this._reconnectAttempt = 0;
    this._setStatus('open');
    this._delegate.resolve(void 0);

    // Shift the message off the queue
    // after the message is sent so that if there is an exception,
    // the message is still pending.
    while (this._pendingMessages.length > 0) {
      let msg = this._pendingMessages[0];
      this._ws.send(msg);
      this._pendingMessages.shift();
    }
  }

  /**
   * Handle a websocket message, validating and routing appropriately.
   */
  private _onWSMessage(evt: MessageEvent) {
    this._messageReceived.emit(evt);
  }

  /**
   * Handle a websocket close event.
   */
  private _onWSClose(evt: Event) {
    if (this._status === 'closed') {
      return;
    }

    if (this._reconnectAttempt < this._reconnectLimit) {
      let timeout = Math.pow(2, this._reconnectAttempt);
      console.error('Connection lost, reconnecting in ' + timeout + ' seconds.');
      clearTimeout(this._timer);
      this._timer = setTimeout(this._createSocket.bind(this), 1e3 * timeout);
      this._reconnectAttempt += 1;
    } else {
      this.close();
      this._delegate.reject(new Error('Could not connect to socket'));
    }
  }

  /**
   * Close the underlying socket.
   */
  private _close(): void {
    if (this._ws === null) {
      return;
    }
    // Clear the websocket event handlers and the socket itself.
    this._ws.onopen = this._dummyCallback;
    this._ws.onclose = this._dummyCallback;
    this._ws.onerror = this._dummyCallback;
    this._ws.onmessage = this._dummyCallback;
    this._ws.close();
    this._ws = null;
  }

  /**
   * Set the status of the socket.
   */
  private _setStatus(status: ManagedSocket.Status): void {
    if (status === this._status) {
      return;
    }
    this._status = status;
    this._statusChanged.emit(status);
  }

  private _isDisposed = false;
  private _delegate = new PromiseDelegate<void>();
  private _ws: WebSocket | null = null;
  private _status: ManagedSocket.Status = 'closed';
  private _pendingMessages: string[] = [];
  private _reconnectLimit = 7;
  private _reconnectAttempt = 0;
  private _timer = -1;
  private _statusChanged = new Signal<this, ManagedSocket.Status>(this);
  private _messageReceived = new Signal<this, MessageEvent>(this);
  private _dummyCallback = () => { /* no-op */ };
  private _factory: (url: string) => WebSocket;
}


/**
 * The namespace for ManagedSocket class statics.
 */
export
namespace ManagedSocket {
  /**
   * The options used to create a ManagedSocket.
   */
  export
  interface IOptions {
    /**
     * The url of the socket.
     */
    url: string;

    /**
     * The optional WebSocket constructor.
     */
    factory?: (url: string) => WebSocket;
  }

  /**
   * A socket status type.
   */
  export
  type Status = 'open' | 'connecting' | 'closed';

  /**
   * The default socket factory.
   */
  export
  const defaultFactory = (url: string) => {
    return new WebSocket(url);
  };
}
