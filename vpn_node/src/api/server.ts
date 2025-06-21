import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import { WireGuardManager } from '../utils/wireguard';
import { BlockchainService } from '../services/blockchain';
import { BandwidthTracker } from '../services/bandwidth';
import { NodeConfig, ApiResponse, WireGuardPeer, NodeInfo } from '../types';

export class VPNApiServer {
  private app: express.Application;
  private wireguard: WireGuardManager;
  private blockchain: BlockchainService;
  private bandwidthTracker: BandwidthTracker;
  private config: NodeConfig;
  private port: number;

  constructor(
    wireguard: WireGuardManager,
    blockchain: BlockchainService,
    bandwidthTracker: BandwidthTracker,
    config: NodeConfig,
    port: number = 5000
  ) {
    this.wireguard = wireguard;
    this.blockchain = blockchain;
    this.bandwidthTracker = bandwidthTracker;
    this.config = config;
    this.port = port;

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Serialize BigInt values to strings for JSON response
   */
  private serializeBigInts(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeBigInts(item));
    }
    
    if (typeof obj === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serializeBigInts(value);
      }
      return serialized;
    }
    
    return obj;
  }

  /**
   * Serialize NodeInfo for API response
   */
  private serializeNodeInfo(nodeInfo: NodeInfo): any {
    return {
      owner: nodeInfo.owner,
      metadata: nodeInfo.metadata,
      stake: nodeInfo.stake.toString(),
      reputation: nodeInfo.reputation,
      lastActive: nodeInfo.lastActive,
      isActive: nodeInfo.isActive,
      totalBandwidthProvided: nodeInfo.totalBandwidthProvided,
      totalEarnings: nodeInfo.totalEarnings.toString()
    };
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Node status
    this.app.get('/status', async (req: Request, res: Response) => {
      try {
        const nodeAddress = this.blockchain.getAddress();
        const interfaceStatus = await this.wireguard.getInterfaceStatus();
        const bandwidthStats = this.bandwidthTracker.getFormattedStats();
        
        let nodeInfo = null;
        try {
          nodeInfo = await this.blockchain.getNodeInfo(nodeAddress);
        } catch (error) {
          // Node not registered yet, this is normal
          console.log('Node not registered yet:', error instanceof Error ? error.message : String(error));
        }

        const response: ApiResponse = {
          success: true,
          data: {
            nodeAddress,
            isRunning: interfaceStatus.isUp,
            peers: interfaceStatus.peers,
            bandwidthStats,
            nodeInfo: nodeInfo ? this.serializeNodeInfo(nodeInfo) : null,
            uptime: bandwidthStats.uptime
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get status: ${error}`
        });
      }
    });

    // Connect client
    this.app.post('/connect', async (req: Request, res: Response) => {
      try {
        const { publicKey, ip } = req.body;

        if (!publicKey || !ip) {
          return res.status(400).json({
            success: false,
            error: 'Missing public_key or ip'
          });
        }

        if (!WireGuardManager.isValidPublicKey(publicKey)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid WireGuard public key format'
          });
        }

        const peer: WireGuardPeer = {
          publicKey,
          allowedIPs: `${ip}/32`
        };

        await this.wireguard.addPeer(peer);
        this.bandwidthTracker.addClient(publicKey, ip);

        const response: ApiResponse = {
          success: true,
          message: 'Client connected successfully',
          data: {
            publicKey,
            ip,
            nodePublicKey: this.wireguard.getPublicKey()
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to connect client: ${error}`
        });
      }
    });

    // Disconnect client
    this.app.post('/disconnect', async (req: Request, res: Response) => {
      try {
        const { publicKey } = req.body;

        if (!publicKey) {
          return res.status(400).json({
            success: false,
            error: 'Missing public_key'
          });
        }

        await this.wireguard.removePeer(publicKey);
        this.bandwidthTracker.removeClient(publicKey);

        const response: ApiResponse = {
          success: true,
          message: 'Client disconnected successfully'
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to disconnect client: ${error}`
        });
      }
    });

    // Get bandwidth stats
    this.app.get('/bandwidth', (req: Request, res: Response) => {
      try {
        const stats = this.bandwidthTracker.getStats();
        const formattedStats = this.bandwidthTracker.getFormattedStats();

        const response: ApiResponse = {
          success: true,
          data: {
            raw: stats,
            formatted: formattedStats
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get bandwidth stats: ${error}`
        });
      }
    });

    // Get client stats
    this.app.get('/clients', (req: Request, res: Response) => {
      try {
        const stats = this.bandwidthTracker.getStats();
        const clients = Object.entries(stats.clients).map(([publicKey, clientStats]) => ({
          publicKey,
          ...clientStats,
          totalBandwidth: clientStats.bytesSent + clientStats.bytesReceived
        }));

        const response: ApiResponse = {
          success: true,
          data: {
            clients,
            totalClients: clients.length
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get client stats: ${error}`
        });
      }
    });

    // Blockchain operations
    this.app.get('/blockchain/balance', async (req: Request, res: Response) => {
      try {
        const address = this.blockchain.getAddress();
        const balance = await this.blockchain.getTokenBalance(address);

        const response: ApiResponse = {
          success: true,
          data: {
            address,
            balance: balance.toString(),
            balanceFormatted: `${Number(balance) / 1e18} DVPN`
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get balance: ${error}`
        });
      }
    });

    this.app.get('/blockchain/node-info', async (req: Request, res: Response) => {
      try {
        const address = this.blockchain.getAddress();
        const nodeInfo = await this.blockchain.getNodeInfo(address);

        const response: ApiResponse = {
          success: true,
          data: this.serializeNodeInfo(nodeInfo)
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get node info: ${error}`
        });
      }
    });

    this.app.post('/blockchain/register', async (req: Request, res: Response) => {
      try {
        const { metadata, stake } = req.body;

        if (!metadata || !stake) {
          return res.status(400).json({
            success: false,
            error: 'Missing metadata or stake'
          });
        }

        const stakeAmount = BigInt(stake);
        await this.blockchain.registerNode(metadata, stakeAmount);

        const response: ApiResponse = {
          success: true,
          message: 'Node registered successfully'
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to register node: ${error}`
        });
      }
    });

    this.app.post('/blockchain/unregister', async (req: Request, res: Response) => {
      try {
        await this.blockchain.unregisterNode();

        const response: ApiResponse = {
          success: true,
          message: 'Node unregistered successfully'
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to unregister node: ${error}`
        });
      }
    });

    // WireGuard operations
    this.app.get('/wireguard/status', async (req: Request, res: Response) => {
      try {
        const status = await this.wireguard.getInterfaceStatus();
        const publicKey = this.wireguard.getPublicKey();

        const response: ApiResponse = {
          success: true,
          data: {
            ...status,
            publicKey,
            port: this.config.wireguard.port,
            network: this.config.wireguard.network
          }
        };

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to get WireGuard status: ${error}`
        });
      }
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: Function) => {
      console.error('API Error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  /**
   * Start the API server
   */
  start(): void {
    this.app.listen(this.port, () => {
      console.log(`VPN API server running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`Status: http://localhost:${this.port}/status`);
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
} 