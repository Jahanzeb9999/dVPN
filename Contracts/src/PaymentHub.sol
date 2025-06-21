// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NodeRegistry.sol";

contract PaymentHub is Ownable, ReentrancyGuard {
    struct Stream {
        address sender;
        address recipient;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 withdrawn;
        bool isActive;
    }

    struct Payment {
        address sender;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        bytes signature;
    }

    IERC20 public token;
    NodeRegistry public nodeRegistry;
    uint256 public minPayment = 1 * 10**18; // 1 token minimum
    uint256 public paymentFee = 50; // 0.5% fee (50 basis points)
    uint256 public totalFeesCollected;

    mapping(bytes32 => Stream) public streams;
    mapping(bytes32 => bool) public processedPayments;
    mapping(address => uint256) public userBalances;

    event StreamCreated(bytes32 indexed streamId, address indexed sender, address indexed recipient, uint256 amount, uint256 duration);
    event StreamWithdrawn(bytes32 indexed streamId, address indexed recipient, uint256 amount);
    event StreamCancelled(bytes32 indexed streamId);
    event PaymentProcessed(address indexed sender, address indexed recipient, uint256 amount, uint256 fee);
    event FeeCollected(uint256 amount);

    constructor(address _token, address _nodeRegistry) Ownable(msg.sender) {
        token = IERC20(_token);
        nodeRegistry = NodeRegistry(_nodeRegistry);
    }

    function createStream(
        address recipient,
        uint256 amount,
        uint256 duration
    ) external nonReentrant returns (bytes32 streamId) {
        require(amount > 0, "Amount must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Cannot stream to self");

        streamId = keccak256(abi.encodePacked(msg.sender, recipient, block.timestamp));
        require(streams[streamId].sender == address(0), "Stream already exists");

        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            withdrawn: 0,
            isActive: true
        });

        emit StreamCreated(streamId, msg.sender, recipient, amount, duration);
    }

    function withdrawFromStream(bytes32 streamId, uint256 amount) external nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "Stream not active");
        require(msg.sender == stream.recipient, "Only recipient can withdraw");
        require(amount > 0, "Amount must be greater than 0");
        require(stream.withdrawn + amount <= stream.amount, "Insufficient stream balance");

        uint256 availableAmount = getAvailableAmount(streamId);
        require(amount <= availableAmount, "Amount exceeds available balance");

        stream.withdrawn += amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit StreamWithdrawn(streamId, msg.sender, amount);
    }

    function cancelStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "Stream not active");
        require(msg.sender == stream.sender, "Only sender can cancel");

        uint256 remainingAmount = stream.amount - stream.withdrawn;
        stream.isActive = false;

        if (remainingAmount > 0) {
            require(token.transfer(stream.sender, remainingAmount), "Refund transfer failed");
        }

        emit StreamCancelled(streamId);
    }

    function processPayment(Payment memory payment) external onlyOwner {
        bytes32 paymentId = keccak256(abi.encodePacked(payment.sender, payment.recipient, payment.amount, payment.timestamp));
        require(!processedPayments[paymentId], "Payment already processed");
        require(payment.amount >= minPayment, "Payment too small");

        // Verify the payment is for a registered node
        NodeRegistry.Node memory node = nodeRegistry.getNode(payment.recipient);
        require(node.isActive, "Recipient not an active node");

        uint256 fee = (payment.amount * paymentFee) / 10000;
        uint256 netAmount = payment.amount - fee;

        processedPayments[paymentId] = true;
        totalFeesCollected += fee;

        // Update node registry
        NodeRegistry.PaymentTicket memory ticket = NodeRegistry.PaymentTicket({
            node: payment.recipient,
            amount: netAmount,
            bandwidth: 0, // Will be set by the node software
            timestamp: payment.timestamp,
            signature: payment.signature
        });

        nodeRegistry.processPayment(ticket);

        emit PaymentProcessed(payment.sender, payment.recipient, netAmount, fee);
        emit FeeCollected(fee);
    }

    function getAvailableAmount(bytes32 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) return 0;

        uint256 elapsed = block.timestamp - stream.startTime;
        uint256 duration = stream.endTime - stream.startTime;
        
        if (elapsed >= duration) {
            return stream.amount - stream.withdrawn;
        } else {
            uint256 proportionalAmount = (stream.amount * elapsed) / duration;
            return proportionalAmount > stream.withdrawn ? proportionalAmount - stream.withdrawn : 0;
        }
    }

    function getStream(bytes32 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function withdrawFees() external onlyOwner {
        require(totalFeesCollected > 0, "No fees to withdraw");
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        require(token.transfer(owner(), amount), "Fee transfer failed");
    }

    function setPaymentFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        paymentFee = newFee;
    }

    function setMinPayment(uint256 newMin) external onlyOwner {
        minPayment = newMin;
    }
}