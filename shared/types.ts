export interface VpnServer {
  hostname?: string | null;
  ip: string;
  score?: string;
  country_short?: string | null;
  country_long?: string | null;
  config_b64?: string;
}

export interface ServerInfo {
  ip?: string;
  hostname?: string | null;
  country_short?: string | null;
  country_long?: string | null;
}

export interface LastServer {
  ip: string;
  country_short?: string;
  country_long?: string;
  hostname?: string;
}

export interface VpnStatus {
  connected: boolean;
  ip?: string;
  hostname?: string | null;
  score?: string;
  country_short?: string | null;
  country_long?: string | null;
  pid?: string;
  last?: LastServer;
}

export type ConnectionState = "connected" | "connecting" | "disconnected";

export type VpnEvent =
  | { type: "log"; message: string }
  | { type: "busy"; busy: boolean }
  | { type: "status"; state: "connecting"; message?: string }
  | ({ type: "connected"; pid?: string } & VpnServer)
  | { type: "disconnected" };

export type Unsubscribe = () => void;

export interface VpnApi {
  next(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<VpnStatus>;
  fetchList(): Promise<VpnServer[]>;
  connectVpn(ip: string, country?: string): Promise<void>;
  getUnusedVpns(): Promise<VpnServer[]>;
  hide(): void;
  onEvent(cb: (ev: VpnEvent) => void): Unsubscribe;
}

export interface AuthApi {
  submit(pw: string): void;
  cancel(): void;
}

declare global {
  interface Window {
    vpnAPI: VpnApi;
    authAPI: AuthApi;
  }
}
