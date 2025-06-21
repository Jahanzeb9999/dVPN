#!/usr/bin/env node

import dotenv from 'dotenv';
import { WireGuardManager } from './utils/wireguard';
import { BlockchainService } from './services/blockchain';
import { BandwidthTracker } from './services/bandwidth';
import { VPNApiServer } from './api/server';
import { NodeConfig } from './types';

// Load environment variables
dotenv.config();

class VPNNode {
  private config: NodeConfig;
  private wireguard: WireGuardManager;
  private blockchain: BlockchainService;
  private bandwidthTracker: BandwidthTracker;
  private apiServer: VPNApiServer;
  private isRunning: boolean = false;

  constructor() {
    this.config = {
      rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
      privateKey: process.env.PRIVATE_KEY || '',
      contractAddresses: {
        token: process.env.TOKEN_ADDRESS || '',
        nodeRegistry: process.env.NODE_REGISTRY_ADDRESS || '',
        paymentHub: process.env.PAYMENT_HUB_ADDRESS || ''
      },
      wireguard: {
        interface: process.env.WG_INTERFACE || 'wg0',
        port: parseInt(process.env.WG_PORT || '51820'),
        network: process.env.WG_NETWORK || '10.0.0.0/24'
      }
    };

    // Validate required environment variables
    this.validateConfig();

    // Initialize services
    this.wireguard = new WireGuardManager(
      this.config.wireguard.interface,
      this.config.wireguard.port,
      this.config.wireguard.network
    );

    this.blockchain = new BlockchainService(this.config);
    this.bandwidthTracker = new BandwidthTracker(this.wireguard);
    this.apiServer = new VPNApiServer(
      this.wireguard,
      this.blockchain,
      this.bandwidthTracker,
      this.config,
      parseInt(process.env.API_PORT || '5000')
    );
  }

  private validateConfig(): void {
    if (!this.config.privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    if (!this.config.contractAddresses.token) {
      throw new Error('TOKEN_ADDRESS environment variable is required');
    }

    if (!this.config.contractAddresses.nodeRegistry) {
      throw new Error('NODE_REGISTRY_ADDRESS environment variable is required');
    }

    if (!this.config.contractAddresses.paymentHub) {
      throw new Error('PAYMENT_HUB_ADDRESS environment variable is required');
    }
  }

  /**
   * Initialize the VPN node
   */
  async initialize(): Promise<void> {
    console.log('Initializing dVPN Node...');

    try {
      // Check blockchain connection
      const isConnected = await this.blockchain.isConnected();
      if (!isConnected) {
        throw new Error('Failed to connect to blockchain network');
      }
      console.log('✓ Connected to blockchain network');

      // Generate WireGuard keys
      const keys = await this.wireguard.generateKeys();
      console.log('✓ Generated WireGuard keys');

      // Create WireGuard configuration
      await this.wireguard.createConfig();
      console.log('✓ Created WireGuard configuration');

      // Start WireGuard interface
      await this.wireguard.startInterface();
      console.log('✓ Started WireGuard interface');

      // Start bandwidth tracking
      this.bandwidthTracker.startTracking();
      console.log('✓ Started bandwidth tracking');

      this.isRunning = true;
      console.log('✓ VPN Node initialized successfully');

    } catch (error) {
      console.error('Failed to initialize VPN Node:', error);
      throw error;
    }
  }

  /**
   * Start the VPN node
   */
  async start(): Promise<void> {
    try {
      await this.initialize();
      
      // Start API server
      this.apiServer.start();

      // Start background tasks
      this.startBackgroundTasks();

      const apiPort = parseInt(process.env.API_PORT || '5000');
      console.log('\n🎉 dVPN Node is now running!');
      console.log(`📡 WireGuard public key: ${this.wireguard.getPublicKey()}`);
      console.log(`🌐 API server: http://localhost:${apiPort}`);
      console.log(`📊 Status endpoint: http://localhost:${apiPort}/status`);
      console.log(`💳 Node address: ${this.blockchain.getAddress()}`);

    } catch (error) {
      console.error('Failed to start VPN Node:', error);
      process.exit(1);
    }
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Report bandwidth to blockchain every 5 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.reportBandwidth();
      }
    }, 5 * 60 * 1000);

    // Update node status every minute
    setInterval(async () => {
      if (this.isRunning) {
        await this.updateNodeStatus();
      }
    }, 60 * 1000);
  }

  /**
   * Report bandwidth usage to blockchain
   */
  private async reportBandwidth(): Promise<void> {
    try {
      const totalBandwidth = this.bandwidthTracker.getTotalBandwidth();
      
      if (totalBandwidth > 0) {
        // Create payment ticket
        const paymentData = {
          node: this.blockchain.getAddress(),
          bandwidth: totalBandwidth,
          timestamp: Math.floor(Date.now() / 1000)
        };

        // Sign the payment data
        const signature = await this.blockchain.signPaymentData(paymentData);

        console.log(`📊 Reported ${this.formatBytes(totalBandwidth)} bandwidth usage`);
        console.log(`🔐 Payment signature: ${signature}`);

        // Reset bandwidth counters after reporting
        this.bandwidthTracker.resetCounters();
      }
    } catch (error) {
      console.error('Failed to report bandwidth:', error);
    }
  }

  /**
   * Update node status in blockchain
   */
  private async updateNodeStatus(): Promise<void> {
    try {
      const interfaceStatus = await this.wireguard.getInterfaceStatus();
      const bandwidthStats = this.bandwidthTracker.getFormattedStats();

      console.log(`📈 Node Status - Peers: ${interfaceStatus.peers}, Bandwidth: ${bandwidthStats.totalBandwidth}`);
    } catch (error) {
      console.error('Failed to update node status:', error);
    }
  }

  /**
   * Stop the VPN node
   */
  async stop(): Promise<void> {
    console.log('\n🛑 Stopping dVPN Node...');

    this.isRunning = false;

    try {
      // Stop bandwidth tracking
      this.bandwidthTracker.stopTracking();
      console.log('✓ Stopped bandwidth tracking');

      // Stop WireGuard interface
      await this.wireguard.stopInterface();
      console.log('✓ Stopped WireGuard interface');

      console.log('✓ dVPN Node stopped successfully');
    } catch (error) {
      console.error('Error stopping VPN Node:', error);
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get node information
   */
  getNodeInfo(): {
    address: string;
    publicKey: string;
    isRunning: boolean;
    config: NodeConfig;
  } {
    return {
      address: this.blockchain.getAddress(),
      publicKey: this.wireguard.getPublicKey(),
      isRunning: this.isRunning,
      config: this.config
    };
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...');
  if (global.vpnNode) {
    await global.vpnNode.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  if (global.vpnNode) {
    await global.vpnNode.stop();
  }
  process.exit(0);
});

// Start the VPN node
async function main() {
  try {
    global.vpnNode = new VPNNode();
    await global.vpnNode.start();
  } catch (error) {
    console.error('Failed to start VPN Node:', error);
    process.exit(1);
  }
}

// Declare global variable for graceful shutdown
declare global {
  var vpnNode: VPNNode | undefined;
}

// Run the application
if (require.main === module) {
  main();
}

export { VPNNode }; 