import { ethers } from 'ethers';
import { NodeConfig, NodeInfo, PaymentTicket, Stream, Payment } from '../types';

// Contract ABIs (simplified for MVP)
const TOKEN_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'mintRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const NODE_REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'node', type: 'address' }],
    name: 'getNode',
    outputs: [{
      components: [
        { internalType: 'address', name: 'owner', type: 'address' },
        { internalType: 'string', name: 'metadata', type: 'string' },
        { internalType: 'uint256', name: 'stake', type: 'uint256' },
        { internalType: 'uint256', name: 'reputation', type: 'uint256' },
        { internalType: 'uint256', name: 'lastActive', type: 'uint256' },
        { internalType: 'bool', name: 'isActive', type: 'bool' },
        { internalType: 'uint256', name: 'totalBandwidthProvided', type: 'uint256' },
        { internalType: 'uint256', name: 'totalEarnings', type: 'uint256' }
      ],
      internalType: 'struct NodeRegistry.Node',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'string', name: 'metadata', type: 'string' },
      { internalType: 'uint256', name: 'stake', type: 'uint256' }
    ],
    name: 'registerNode',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'unregisterNode',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getActiveNodes',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const PAYMENT_HUB_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'duration', type: 'uint256' }
    ],
    name: 'createStream',
    outputs: [{ internalType: 'bytes32', name: 'streamId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'streamId', type: 'bytes32' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'withdrawFromStream',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'streamId', type: 'bytes32' }],
    name: 'getStream',
    outputs: [{
      components: [
        { internalType: 'address', name: 'sender', type: 'address' },
        { internalType: 'address', name: 'recipient', type: 'address' },
        { internalType: 'uint256', name: 'amount', type: 'uint256' },
        { internalType: 'uint256', name: 'startTime', type: 'uint256' },
        { internalType: 'uint256', name: 'endTime', type: 'uint256' },
        { internalType: 'uint256', name: 'withdrawn', type: 'uint256' },
        { internalType: 'bool', name: 'isActive', type: 'bool' }
      ],
      internalType: 'struct PaymentHub.Stream',
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  }
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private tokenContract: ethers.Contract;
  private nodeRegistryContract: ethers.Contract;
  private paymentHubContract: ethers.Contract;

  constructor(config: NodeConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.tokenContract = new ethers.Contract(
      config.contractAddresses.token,
      TOKEN_ABI,
      this.wallet
    );
    
    this.nodeRegistryContract = new ethers.Contract(
      config.contractAddresses.nodeRegistry,
      NODE_REGISTRY_ABI,
      this.wallet
    );
    
    this.paymentHubContract = new ethers.Contract(
      config.contractAddresses.paymentHub,
      PAYMENT_HUB_ABI,
      this.wallet
    );
  }

  /**
   * Get node information from the registry
   */
  async getNodeInfo(nodeAddress: string): Promise<NodeInfo> {
    try {
      const nodeData = await this.nodeRegistryContract.getNode(nodeAddress);
      
      return {
        owner: nodeData[0],
        metadata: nodeData[1],
        stake: nodeData[2],
        reputation: Number(nodeData[3]),
        lastActive: Number(nodeData[4]),
        isActive: nodeData[5],
        totalBandwidthProvided: Number(nodeData[6]),
        totalEarnings: nodeData[7]
      };
    } catch (error) {
      throw new Error(`Failed to get node info: ${error}`);
    }
  }

  /**
   * Register this node in the registry
   */
  async registerNode(metadata: string, stake: bigint): Promise<void> {
    try {
      // First approve the token transfer
      const approveTx = await this.tokenContract.approve(
        await this.nodeRegistryContract.getAddress(),
        stake
      );
      await approveTx.wait();

      // Register the node
      const tx = await this.nodeRegistryContract.registerNode(metadata, stake);
      await tx.wait();
    } catch (error) {
      throw new Error(`Failed to register node: ${error}`);
    }
  }

  /**
   * Unregister this node from the registry
   */
  async unregisterNode(): Promise<void> {
    try {
      const tx = await this.nodeRegistryContract.unregisterNode();
      await tx.wait();
    } catch (error) {
      throw new Error(`Failed to unregister node: ${error}`);
    }
  }

  /**
   * Get all active nodes
   */
  async getActiveNodes(): Promise<string[]> {
    try {
      return await this.nodeRegistryContract.getActiveNodes();
    } catch (error) {
      throw new Error(`Failed to get active nodes: ${error}`);
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(address: string): Promise<bigint> {
    try {
      return await this.tokenContract.balanceOf(address);
    } catch (error) {
      throw new Error(`Failed to get token balance: ${error}`);
    }
  }

  /**
   * Create a payment stream to a node
   */
  async createPaymentStream(recipient: string, amount: bigint, duration: number): Promise<string> {
    try {
      // First approve the token transfer
      const approveTx = await this.tokenContract.approve(
        await this.paymentHubContract.getAddress(),
        amount
      );
      await approveTx.wait();

      // Create the stream
      const tx = await this.paymentHubContract.createStream(recipient, amount, duration);
      const receipt = await tx.wait();
      
      // Extract stream ID from event
      const event = receipt.logs.find((log: any) => 
        log.fragment?.name === 'StreamCreated'
      );
      
      if (event) {
        return event.args[0]; // streamId
      }
      
      throw new Error('Stream created but streamId not found in logs');
    } catch (error) {
      throw new Error(`Failed to create payment stream: ${error}`);
    }
  }

  /**
   * Get stream information
   */
  async getStream(streamId: string): Promise<Stream> {
    try {
      const streamData = await this.paymentHubContract.getStream(streamId);
      
      return {
        sender: streamData[0],
        recipient: streamData[1],
        amount: streamData[2],
        startTime: Number(streamData[3]),
        endTime: Number(streamData[4]),
        withdrawn: streamData[5],
        isActive: streamData[6]
      };
    } catch (error) {
      throw new Error(`Failed to get stream: ${error}`);
    }
  }

  /**
   * Withdraw from a payment stream
   */
  async withdrawFromStream(streamId: string, amount: bigint): Promise<void> {
    try {
      const tx = await this.paymentHubContract.withdrawFromStream(streamId, amount);
      await tx.wait();
    } catch (error) {
      throw new Error(`Failed to withdraw from stream: ${error}`);
    }
  }

  /**
   * Sign payment data for bandwidth verification
   */
  async signPaymentData(paymentData: any): Promise<string> {
    const message = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(paymentData)));
    return await this.wallet.signMessage(ethers.getBytes(message));
  }

  /**
   * Get the wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Check if the provider is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }
} 