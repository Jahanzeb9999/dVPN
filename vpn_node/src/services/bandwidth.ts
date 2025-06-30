import { BandwidthStats, ClientStats } from '../types';
import { WireGuardManager } from '../utils/wireguard';

export class BandwidthTracker {
  private stats: BandwidthStats;
  private wireguard: WireGuardManager;
  private isTracking: boolean = false;
  private trackingInterval?: NodeJS.Timeout;

  constructor(wireguard: WireGuardManager) {
    this.wireguard = wireguard;
    this.stats = {
      bytesSent: 0,
      bytesReceived: 0,
      startTime: Date.now(),
      clients: {}
    };
  }

  /**
   * Start bandwidth tracking
   */
  startTracking(): void {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    this.trackingInterval = setInterval(async () => {
      await this.updateStats();
    }, 10000); // Update every 10 seconds

    console.log('Bandwidth tracking started');
  }



  /**
   * Stop bandwidth tracking
   */
  stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    this.isTracking = false;
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }

    console.log('Bandwidth tracking stopped');
  }

  /**
   * Update bandwidth statistics from WireGuard
   */
  private async updateStats(): Promise<void> {
    try {
      const transferStats = await this.wireguard.getTransferStats();
      
      for (const [publicKey, stats] of Object.entries(transferStats)) {
        const { received, sent } = stats;
        
        // Update global stats
        this.stats.bytesReceived += received;
        this.stats.bytesSent += sent;
        
        // Update client stats
        if (this.stats.clients[publicKey]) {
          this.stats.clients[publicKey].bytesReceived += received;
          this.stats.clients[publicKey].bytesSent += sent;
        }
      }
    } catch (error) {
      console.error('Error updating bandwidth stats:', error);
    }
  }

  /**
   * Add a client to tracking
   */
  addClient(publicKey: string, ip: string): void {
    this.stats.clients[publicKey] = {
      ip,
      connectedAt: Date.now(),
      bytesSent: 0,
      bytesReceived: 0
    };

    console.log(`Client ${ip} added to bandwidth tracking`);
  }

  /**
   * Remove a client from tracking
   */
  removeClient(publicKey: string): void {
    if (this.stats.clients[publicKey]) {
      delete this.stats.clients[publicKey];
      console.log(`Client ${publicKey} removed from bandwidth tracking`);
    }
  }

  /**
   * Get current bandwidth statistics
   */
  getStats(): BandwidthStats {
    return {
      ...this.stats,
      clients: { ...this.stats.clients }
    };
  }

  /**
   * Get total bandwidth used since start
   */
  getTotalBandwidth(): number {
    return this.stats.bytesSent + this.stats.bytesReceived;
  }

  /**
   * Get bandwidth for a specific client
   */
  getClientStats(publicKey: string): ClientStats | null {
    return this.stats.clients[publicKey] || null;
  }

  /**
   * Reset bandwidth counters
   */
  resetCounters(): void {
    this.stats.bytesSent = 0;
    this.stats.bytesReceived = 0;
    
    // Reset client counters
    for (const clientKey in this.stats.clients) {
      this.stats.clients[clientKey].bytesSent = 0;
      this.stats.clients[clientKey].bytesReceived = 0;
    }

    console.log('Bandwidth counters reset');
  }

  /**
   * Get formatted bandwidth statistics
   */
  getFormattedStats(): {
    totalSent: string;
    totalReceived: string;
    totalBandwidth: string;
    uptime: string;
    activeClients: number;
  } {
    const totalSent = this.formatBytes(this.stats.bytesSent);
    const totalReceived = this.formatBytes(this.stats.bytesReceived);
    const totalBandwidth = this.formatBytes(this.getTotalBandwidth());
    const uptime = this.formatUptime();
    const activeClients = Object.keys(this.stats.clients).length;

    return {
      totalSent,
      totalReceived,
      totalBandwidth,
      uptime,
      activeClients
    };
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
   * Format uptime to human readable format
   */
  private formatUptime(): string {
    const uptime = Date.now() - this.stats.startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.isTracking;
  }
} 