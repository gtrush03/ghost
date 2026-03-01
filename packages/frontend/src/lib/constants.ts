export const EXPLORER_URL = "https://testnet.monadscan.com";
export const USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const WMON_ADDRESS = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
export const NATIVE_MON = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const UNLINK_POOL = "0x0813da0a10328e5ed617d37e514ac2f6fa49a254";

export const SUGGESTED_PROMPTS = [
  { label: "Check position", message: "What's our current position?" },
  { label: "Rebalance 60/40", message: "Rebalance to 60/40 ETH/USDC" },
  { label: "100% memecoin", message: "Swap 100% to memecoin" },
  { label: "Privacy model", message: "Who can see our strategy?" },
  { label: "Block explorer", message: "Show me on the block explorer" },
];

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  check_balance: "Checking treasury balances",
  get_price: "Fetching price via x402",
  execute_swap: "Executing private swap",
  generate_report: "Generating treasury report",
  update_settings: "Updating governance settings",
  get_members: "Fetching member list",
};

export const TOKEN_COLORS: Record<string, string> = {
  USDC: "#2775ca",
  ETH: "#627eea",
  MON: "#8b5cf6",
};
