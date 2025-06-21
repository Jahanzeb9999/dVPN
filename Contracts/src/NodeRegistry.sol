// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NodeRegistry is Ownable, ReentrancyGuard {
    struct Node {
        address owner;
        string metadata; // IP, location, bandwidth, etc.
        uint256 stake;
        uint256 reputation;
        uint256 lastActive;
        bool isActive;
        uint256 totalBandwidthProvided;
        uint256 totalEarnings;
    }

    struct PaymentTicket {
        address node;
        uint256 amount;
        uint256 bandwidth;
        uint256 timestamp;
        bytes signature;
    }

    IERC20 public token;
    uint256 public minStake = 1000 * 10**18; // 1000 tokens
    uint256 public reputationDecayRate = 1; // 1 point per day
    uint256 public slashAmount = 500 * 10**18; // 500 tokens

    mapping(address => Node) public nodes;
    mapping(address => bool) public isRegistered;
    address[] public registeredNodes;

    event NodeRegistered(address indexed node, uint256 stake, string metadata);
    event NodeUnregistered(address indexed node);
    event ReputationUpdated(address indexed node, uint256 newReputation);
    event PaymentProcessed(address indexed node, uint256 amount, uint256 bandwidth);
    event NodeSlashed(address indexed node, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function registerNode(string memory metadata, uint256 stake) external nonReentrant {
        require(!isRegistered[msg.sender], "Node already registered");
        require(stake >= minStake, "Insufficient stake");
        require(token.transferFrom(msg.sender, address(this), stake), "Stake transfer failed");

        nodes[msg.sender] = Node({
            owner: msg.sender,
            metadata: metadata,
            stake: stake,
            reputation: 100, // Start with 100 reputation
            lastActive: block.timestamp,
            isActive: true,
            totalBandwidthProvided: 0,
            totalEarnings: 0
        });

        isRegistered[msg.sender] = true;
        registeredNodes.push(msg.sender);

        emit NodeRegistered(msg.sender, stake, metadata);
    }

    function unregisterNode() external nonReentrant {
        require(isRegistered[msg.sender], "Node not registered");
        Node storage node = nodes[msg.sender];
        require(node.isActive, "Node already inactive");

        node.isActive = false;
        uint256 refundAmount = node.stake;
        node.stake = 0;

        require(token.transfer(msg.sender, refundAmount), "Refund transfer failed");

        emit NodeUnregistered(msg.sender);
    }

    function updateReputation(address node, uint256 newReputation) external onlyOwner {
        require(isRegistered[node], "Node not registered");
        nodes[node].reputation = newReputation;
        nodes[node].lastActive = block.timestamp;
        emit ReputationUpdated(node, newReputation);
    }

    function processPayment(PaymentTicket memory ticket) external onlyOwner {
        require(isRegistered[ticket.node], "Node not registered");
        require(nodes[ticket.node].isActive, "Node inactive");
        
        Node storage node = nodes[ticket.node];
        node.totalBandwidthProvided += ticket.bandwidth;
        node.totalEarnings += ticket.amount;
        node.lastActive = block.timestamp;

        emit PaymentProcessed(ticket.node, ticket.amount, ticket.bandwidth);
    }

    function slashNode(address node, string memory reason) external onlyOwner {
        require(isRegistered[node], "Node not registered");
        Node storage nodeData = nodes[node];
        
        uint256 slashValue = slashAmount;
        if (nodeData.stake < slashValue) {
            slashValue = nodeData.stake;
        }

        nodeData.stake -= slashValue;
        nodeData.reputation = nodeData.reputation > 50 ? nodeData.reputation - 50 : 0;

        emit NodeSlashed(node, slashValue);
    }

    function getNode(address node) external view returns (Node memory) {
        return nodes[node];
    }

    function getActiveNodes() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < registeredNodes.length; i++) {
            if (nodes[registeredNodes[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeNodes = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < registeredNodes.length; i++) {
            if (nodes[registeredNodes[i]].isActive) {
                activeNodes[index] = registeredNodes[i];
                index++;
            }
        }
        return activeNodes;
    }

    function getTotalNodes() external view returns (uint256) {
        return registeredNodes.length;
    }
}