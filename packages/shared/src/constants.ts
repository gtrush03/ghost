// Monad Testnet
export const CHAIN_ID = 10143;
export const RPC_URL = "https://testnet-rpc.monad.xyz";
export const EXPLORER_URL = "https://testnet.monadscan.com";

// Unlink
export const UNLINK_POOL = "0x0813da0a10328e5ed617d37e514ac2f6fa49a254";
export const UNLINK_GATEWAY = "https://api.unlink.xyz";
export const NATIVE_MON = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Tokens (Circle USDC on Monad)
export const USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
// Unlink testnet USDC (minted by faucet, 18 decimals — used inside privacy pool)
export const UNLINK_USDC_ADDRESS = "0xc4fb617e4e4cfbdeb07216dff62b4e46a2d6fdf6";
export const WMON_ADDRESS = "0xea12354dfe3642574eef5d13f18ac17eb929912e";
export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";

// x402
export const X402_FACILITATOR = "https://x402-facilitator.molandak.org";
export const X402_NETWORK_ID = "eip155:10143";

// DEX Router on Monad Testnet (MockRouter — Uniswap V3 exactInputSingle interface)
export const DEX_ROUTER_ADDRESS = "0x64a6ae652d77f45167f7d563eeb7beeb58486394";

// Default constraints
export const DEFAULT_MAX_TRADE_PCT = 10;
export const DEFAULT_COOLDOWN_MINUTES = 5;
export const DEFAULT_ALLOWED_TOKENS = [USDC_ADDRESS, UNLINK_USDC_ADDRESS, WMON_ADDRESS, NATIVE_MON];
