import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { WireGuardPeer } from '../types';

const execAsync = promisify(exec);

export class WireGuardManager {
  private interface: string;
  private port: number;
  private network: string;
  private privateKey: string = '';
  private publicKey: string = '';

  constructor(interfaceName: string, port: number, network: string) {
    this.interface = interfaceName;
    this.port = port;
    this.network = network;
  }

  /**
   * Generate WireGuard key pair
   */
  async generateKeys(): Promise<{ privateKey: string; publicKey: string }> {
    try {
      // Generate private key
      const privateKeyResult = await execAsync('wg genkey');
      const privateKey = privateKeyResult.stdout.trim();

      // Generate public key from private key
      const publicKeyResult = await execAsync(`echo "${privateKey}" | wg pubkey`);
      const publicKey = publicKeyResult.stdout.trim();

      this.privateKey = privateKey;
      this.publicKey = publicKey;

      return { privateKey, publicKey };
    } catch (error) {
      throw new Error(`Failed to generate WireGuard keys: ${error}`);
    }
  }

  /**
   * Create WireGuard configuration file
   */
  async createConfig(): Promise<void> {
    // Detect platform
    const isMac = process.platform === 'darwin';
    let config = `[Interface]
      PrivateKey = ${this.privateKey}
      Address = 10.0.0.1/24
      ListenPort = ${this.port}
      SaveConfig = true
      `;
          if (!isMac) {
            config += `
      # Enable IP forwarding
      PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
      PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
      `;
    }

    try {
      await execAsync(`echo '${config}' | sudo tee /etc/wireguard/${this.interface}.conf`);
    } catch (error) {
      throw new Error(`Failed to create WireGuard config: ${error}`);
    }
  }

  /**
   * Start WireGuard interface
   */
  async startInterface(): Promise<void> {
    try {
      await execAsync(`sudo wg-quick up ${this.interface}`);
    } catch (error) {
      throw new Error(`Failed to start WireGuard interface: ${error}`);
    }
  }

  /**
   * Stop WireGuard interface
   */
  async stopInterface(): Promise<void> {
    try {
      await execAsync(`sudo wg-quick down ${this.interface}`);
    } catch (error) {
      throw new Error(`Failed to stop WireGuard interface: ${error}`);
    }
  }

  /**
   * Add a peer to the WireGuard interface
   */
  async addPeer(peer: WireGuardPeer): Promise<void> {
    try {
      // On macOS, we need to use the actual interface name (utun6) instead of the config name (wg0)
      const isMac = process.platform === 'darwin';
      let interfaceName = this.interface;
      
      if (isMac) {
        // Try to find the actual utun interface name
        try {
          const result = await execAsync('sudo wg show interfaces');
          const interfaces = result.stdout.trim().split('\n');
          if (interfaces.length > 0) {
            interfaceName = interfaces[0].trim(); // Use the first interface found
          }

        } catch (error) {
          throw new Error(`Failed to find WireGuard interface: ${error}`);
        }
      }

      let command = `sudo wg set ${interfaceName} peer ${peer.publicKey} allowed-ips ${peer.allowedIPs}`;
      if (peer.endpoint) {
        command += ` endpoint ${peer.endpoint}`;
      }
      if (peer.persistentKeepalive) {
        command += ` persistent-keepalive ${peer.persistentKeepalive}`;
      }

      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to add peer: ${error}`);
    }
  }

  /**
   * Remove a peer from the WireGuard interface
   */
  async removePeer(publicKey: string): Promise<void> {
    try {
      // On macOS, we need to use the actual interface name (utun6) instead of the config name (wg0)
      const isMac = process.platform === 'darwin';
      let interfaceName = this.interface;
      
      if (isMac) {
        // Try to find the actual utun interface name
        try {
          const result = await execAsync('sudo wg show interfaces');
          const interfaces = result.stdout.trim().split('\n');
          if (interfaces.length > 0) {
            interfaceName = interfaces[0].trim(); // Use the first interface found
          }
        } catch (error) {
          throw new Error(`Failed to find WireGuard interface: ${error}`);
        }
      }

      await execAsync(`sudo wg set ${interfaceName} peer ${publicKey} remove`);
    } catch (error) {
      throw new Error(`Failed to remove peer: ${error}`);
    }
  }

  /**
   * Get transfer statistics for all peers
   */
  async getTransferStats(): Promise<Record<string, { received: number; sent: number }>> {
    try {
      // On macOS, we need to use the actual interface name (utun6) instead of the config name (wg0)
      const isMac = process.platform === 'darwin';
      let interfaceName = this.interface;
      
      if (isMac) {
        // Try to find the actual utun interface name
        try {
          const result = await execAsync('sudo wg show interfaces');
          const interfaces = result.stdout.trim().split('\n');
          if (interfaces.length > 0) {
            interfaceName = interfaces[0].trim(); // Use the first interface found
          }
        } catch (error) {
          // If we can't find the interface, return empty stats
          return {};
        }
      }
      
      const result = await execAsync(`sudo wg show ${interfaceName} transfer`);
      const stats: Record<string, { received: number; sent: number }> = {};

      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            const publicKey = parts[0];
            const received = parseInt(parts[1], 10);
            const sent = parseInt(parts[2], 10);

            stats[publicKey] = { received, sent };
          }
        }
      }

      return stats;
    } catch (error) {
      // Return empty stats instead of throwing error to avoid breaking the node
      return {};
    }
  }

  /**
   * Get interface status
   */
  async getInterfaceStatus(): Promise<{ isUp: boolean; peers: number }> {
    try {
      // On macOS, we need to use the actual interface name (utun6) instead of the config name (wg0)
      const isMac = process.platform === 'darwin';
      let interfaceName = this.interface;
      
      if (isMac) {
        // Try to find the actual utun interface name
        try {
          const result = await execAsync('sudo wg show interfaces');
          const interfaces = result.stdout.trim().split('\n');
          if (interfaces.length > 0) {
            interfaceName = interfaces[0].trim(); // Use the first interface found
          }
        } catch (error) {
          return {
            isUp: false,
            peers: 0
          };
        }
      }

      const result = await execAsync(`sudo wg show ${interfaceName} dump`);
      const lines = result.stdout.trim().split('\n');
      
      // First line contains interface info, subsequent lines are peers
      const peerCount = Math.max(0, lines.length - 1);
      
      return {
        isUp: true,
        peers: peerCount
      };
    } catch (error) {
      return {
        isUp: false,
        peers: 0
      };
    }
  }

  /**
   * Generate a random IP address in the VPN network
   */
  generateClientIP(): string {
    const baseIP = '10.0.0.';
    const randomOctet = Math.floor(Math.random() * 254) + 2; // Avoid .1 (server) and .255 (broadcast)
    return `${baseIP}${randomOctet}`;
  }

  /**
   * Validate WireGuard public key format
   */
  static isValidPublicKey(publicKey: string): boolean {
    // WireGuard public keys are base64 encoded and typically 44 characters long
    // More lenient validation: base64 characters + = padding, length 44
    return /^[A-Za-z0-9+/]{43}=$/.test(publicKey) || /^[A-Za-z0-9+/]{44}=$/.test(publicKey);
  }

  /**
   * Get the public key of this node
   */
  getPublicKey(): string {
    return this.publicKey;
  }
} 