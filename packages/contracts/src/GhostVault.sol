// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title GhostVault — On-chain constraint enforcement for Ghost Treasury
/// @notice Layer 3 safety: the smart contract that prevents the AI agent from going rogue
contract GhostVault {
    address public owner;
    address public agent;

    uint256 public maxTradePercent = 10;    // 10% max single trade
    uint256 public cooldownSeconds = 300;   // 5 min between trades
    uint256 public lastTradeTime;
    bool public paused;

    mapping(address => bool) public allowedTokens;

    event TradeApproved(address indexed from, address indexed to, uint256 amount);
    event TradeDenied(string reason);
    event ConstraintsUpdated(uint256 maxPct, uint256 cooldown);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Not agent");
        _;
    }

    constructor(address _agent, address[] memory _tokens) {
        owner = msg.sender;
        agent = _agent;
        for (uint256 i = 0; i < _tokens.length; i++) {
            allowedTokens[_tokens[i]] = true;
        }
    }

    /// @notice Validate a trade against on-chain constraints
    /// @param fromToken Token being sold
    /// @param toToken Token being bought
    /// @param amountBps Trade size in basis points of total treasury
    /// @return allowed Whether the trade is permitted
    /// @return reason Human-readable rejection reason (empty if allowed)
    function validateTrade(
        address fromToken,
        address toToken,
        uint256 amountBps
    ) external view returns (bool allowed, string memory reason) {
        if (paused) return (false, "Treasury paused");
        if (!allowedTokens[fromToken] || !allowedTokens[toToken])
            return (false, "Token not allowed");
        if (amountBps > maxTradePercent * 100)
            return (false, "Exceeds max trade size");
        if (block.timestamp < lastTradeTime + cooldownSeconds)
            return (false, "Cooldown active");
        return (true, "");
    }

    /// @notice Record a trade (updates cooldown timer)
    function recordTrade(
        address fromToken,
        address toToken,
        uint256 amount
    ) external onlyAgent {
        lastTradeTime = block.timestamp;
        emit TradeApproved(fromToken, toToken, amount);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function setConstraints(
        uint256 _maxPct,
        uint256 _cooldown
    ) external onlyOwner {
        maxTradePercent = _maxPct;
        cooldownSeconds = _cooldown;
        emit ConstraintsUpdated(_maxPct, _cooldown);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
    }
}
