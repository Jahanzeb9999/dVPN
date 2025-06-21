export interface NodeConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddresses: {
    token: string;
    nodeRegistry: string;
    paymentHub: string;
  };
  wireguard: {
    interface: string;
    port: number;
    network: string;
  };
}

export interface BandwidthStats {
  bytesSent: number;
  bytesReceived: number;
  startTime: number;
  clients: Record<string, ClientStats>;
}

export interface ClientStats {
  ip: string;
  connectedAt: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface PaymentTicket {
  node: string;
  amount: bigint;
  bandwidth: number;
  timestamp: number;
  signature: string;
}

export interface WireGuardPeer {
  publicKey: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;
}

export interface NodeInfo {
  owner: string;
  metadata: string;
  stake: bigint;
  reputation: number;
  lastActive: number;
  isActive: boolean;
  totalBandwidthProvided: number;
  totalEarnings: bigint;
}

export interface Stream {
  sender: string;
  recipient: string;
  amount: bigint;
  startTime: number;
  endTime: number;
  withdrawn: bigint;
  isActive: boolean;
}

export interface Payment {
  sender: string;
  recipient: string;
  amount: bigint;
  timestamp: number;
  signature: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 