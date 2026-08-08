declare module 'y-webrtc' {
  import * as Y from 'yjs';

  export class WebrtcProvider {
    constructor(
      roomName: string,
      doc: Y.Doc,
      opts?: {
        signaling?: string[];
        password?: string | null;
        maxConns?: number;
        filterBcConns?: boolean;
        peerOpts?: any;
        awareness?: any;
      }
    );
    awareness: any;
    roomName: string;
    doc: Y.Doc;
    connected: boolean;
    connect(): void;
    disconnect(): void;
    destroy(): void;
    on(event: string, handler: (...args: any[]) => void): void;
  }
}