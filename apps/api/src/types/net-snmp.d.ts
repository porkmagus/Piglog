declare module 'net-snmp' {
  export interface ReceiverOptions {
    port?: number;
    address?: string;
    disableAuthorization?: boolean;
    includeAuthentication?: boolean;
  }

  export interface ReceiverAuthorizer {
    addCommunity(community: string): void;
    addUser(user: {
      name: string;
      level: number;
      authProtocol: number;
      authKey: string;
      privProtocol: number;
      privKey: string;
    }): void;
  }

  export interface Receiver {
    getAuthorizer(): ReceiverAuthorizer;
    close(): void;
  }

  export const PduType: {
    Trap: number;
    TrapV2: number;
    InformRequest: number;
  };

  export const SecurityLevel: {
    noAuthNoPriv: number;
    authNoPriv: number;
    authPriv: number;
  };

  export const AuthProtocols: {
    md5: number;
    sha: number;
    sha256: number;
  };

  export const PrivProtocols: {
    des: number;
    aes: number;
    aes256b: number;
  };

  export function createReceiver(
    options: ReceiverOptions,
    callback: (error: Error | null, notification: any) => void
  ): Receiver;

  export default {
    createReceiver,
    PduType,
    SecurityLevel,
    AuthProtocols,
    PrivProtocols,
  };
}
