declare module 'y-websocket' {
  import * as Y from 'yjs';

  export class WebsocketProvider {
    constructor(
      serverUrl: string,
      roomname: string,
      doc: Y.Doc,
      opts?: {
        connect?: boolean;
        awareness?: any;
        params?: Record<string, string>;
        maxBackoffTime?: number;
        disableBc?: boolean;
        resyncInterval?: number;
      }
    );
    awareness: any;
    roomname: string;
    doc: Y.Doc;
    connected: boolean;
    wsconnected: boolean;
    wsconnecting: boolean;
    synced: boolean;
    shouldConnect: boolean;
    connect(): void;
    disconnect(): void;
    destroy(): void;
    on(event: string, handler: (...args: any[]) => void): void;
  }
}