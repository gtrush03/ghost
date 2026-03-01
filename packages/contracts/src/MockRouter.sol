// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWMON {
    function deposit() external payable;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title MockRouter — Simulates Uniswap V3 exactInputSingle for hackathon demo
/// @notice Accepts input tokens and returns WMON at a fixed rate
/// @dev Pre-fund with MON (auto-wraps to WMON on each swap)
contract MockRouter {
    address public immutable WMON;
    address public owner;

    event Swap(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address recipient);

    constructor(address _wmon) {
        WMON = _wmon;
        owner = msg.sender;
    }

    receive() external payable {}

    /// @notice Matches Uniswap V3 SwapRouter02.exactInputSingle signature
    function exactInputSingle(
        (address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) calldata params
    ) external returns (uint256 amountOut) {
        // Pull input tokens from caller (Unlink adapter)
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Calculate output: 1 USDC (6 dec) ≈ 2.38 WMON (18 dec) at ~$0.42/MON
        // For 1_000_000 (1 USDC) → 2_380_000_000_000_000_000 (2.38 WMON)
        if (params.tokenOut == WMON) {
            // Wrap MON to WMON
            amountOut = params.amountIn * 2380000000000; // 6 dec → 18 dec with rate
            require(address(this).balance >= amountOut, "Fund router with MON");
            IWMON(WMON).deposit{value: amountOut}();
            IWMON(WMON).transfer(params.recipient, amountOut);
        } else {
            // Reverse: WMON → USDC
            amountOut = params.amountIn / 2380000000000;
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        }

        require(amountOut >= params.amountOutMinimum, "Insufficient output");
        emit Swap(params.tokenIn, params.tokenOut, params.amountIn, amountOut, params.recipient);
        return amountOut;
    }

    /// @notice Owner can withdraw stuck tokens
    function rescue(address token, uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }
}
