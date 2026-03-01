import { initUnlink, waitForConfirmation } from "@unlink-xyz/node";
import { approve, buildCall } from "@unlink-xyz/core";
import {
  USDC_ADDRESS,
  UNLINK_USDC_ADDRESS,
  WMON_ADDRESS,
  NATIVE_MON,
} from "@ghost/shared";

export interface WithdrawParams {
  token: string;
  amount: bigint;
  recipient: string;
}

export interface WithdrawResult {
  relayId: string;
  txHash?: string;
  status: string;
}

export interface UnlinkService {
  sync(): Promise<void>;
  getBalances(): Promise<Record<string, bigint>>;
  getBalance(token: string): Promise<bigint>;
  getAddress(): Promise<string>;
  fundBurner(index: number, token: string, amount: bigint): Promise<string>;
  getBurnerAddress(index: number): Promise<string>;
  getBurnerKey(index: number): Promise<string>;
  sweepBurner(index: number, token: string): Promise<void>;
  executeSwap(params: SwapParams): Promise<SwapResult>;
  withdraw(params: WithdrawParams): Promise<WithdrawResult>;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  dexRouter: string;
}

export interface SwapResult {
  relayId: string;
  txHash?: string;
  status: string;
}

type UnlinkInstance = Awaited<ReturnType<typeof initUnlink>>;

const TOKEN_SYMBOLS: Record<string, string> = {
  [USDC_ADDRESS.toLowerCase()]: "USDC",
  [UNLINK_USDC_ADDRESS.toLowerCase()]: "USDC",
  [WMON_ADDRESS.toLowerCase()]: "WMON",
  [NATIVE_MON.toLowerCase()]: "MON",
};

export function getTokenSymbol(address: string): string {
  return TOKEN_SYMBOLS[address.toLowerCase()] ?? address.slice(0, 10);
}

export function createUnlinkService(unlink: UnlinkInstance): UnlinkService {
  return {
    async sync() {
      await unlink.sync();
    },

    async getBalances(): Promise<Record<string, bigint>> {
      await unlink.sync();
      return await unlink.getBalances();
    },

    async getBalance(token: string): Promise<bigint> {
      await unlink.sync();
      return await unlink.getBalance(token);
    },

    async getAddress(): Promise<string> {
      const active = await unlink.sdk.accounts.getActive();
      return active.address as string;
    },

    async fundBurner(index: number, token: string, amount: bigint): Promise<string> {
      const result = await unlink.burner.fund(index, { token, amount });
      const status = await waitForConfirmation(unlink, result.relayId, { timeout: 60_000 });
      return status.txHash ?? result.relayId;
    },

    async getBurnerAddress(index: number): Promise<string> {
      const { address } = await unlink.burner.addressOf(index);
      return address;
    },

    async getBurnerKey(index: number): Promise<string> {
      return await unlink.burner.exportKey(index);
    },

    async sweepBurner(index: number, token: string): Promise<void> {
      await unlink.burner.sweepToPool(index, { token });
    },

    async executeSwap(params: SwapParams): Promise<SwapResult> {
      const { tokenIn, tokenOut, amountIn, minAmountOut, dexRouter } = params;

      const approveCall = approve(tokenIn, dexRouter, amountIn);
      const swapCall = buildCall({
        to: dexRouter,
        abi: "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
        functionName: "exactInputSingle",
        args: [[tokenIn, tokenOut, 3000, unlink.adapter.address, amountIn, minAmountOut, 0n]],
      });

      const result = await unlink.interact({
        spend: [{ token: tokenIn, amount: amountIn }],
        calls: [approveCall, swapCall],
        receive: [{ token: tokenOut, minAmount: minAmountOut }],
      });

      const status = await waitForConfirmation(unlink, result.relayId, { timeout: 120_000 });

      return {
        relayId: result.relayId,
        txHash: status.txHash,
        status: status.state,
      };
    },

    async withdraw(params: WithdrawParams): Promise<WithdrawResult> {
      const { token, amount, recipient } = params;

      const result = await unlink.withdraw({
        withdrawals: [{ token, amount, recipient }],
      });

      const status = await waitForConfirmation(unlink, result.relayId, { timeout: 120_000 });

      return {
        relayId: result.relayId,
        txHash: status.txHash,
        status: status.state,
      };
    },
  };
}
