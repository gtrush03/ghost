# x402 Protocol -- Complete API Reference for Ghost Treasury

> Extracted from coinbase/x402 source (v2.5.0), Monad docs, and npm package READMEs.
> Last updated: 2026-02-27

---

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Architecture & Flow](#architecture--flow)
3. [HTTP Headers](#http-headers)
4. [Core Types & Interfaces](#core-types--interfaces)
5. [Client-Side API](#client-side-api)
6. [Server-Side API](#server-side-api)
7. [Express Middleware](#express-middleware)
8. [Fetch Wrapper](#fetch-wrapper)
9. [EVM Mechanism](#evm-mechanism)
10. [Monad-Specific Configuration](#monad-specific-configuration)
11. [Facilitator API](#facilitator-api)
12. [Complete Examples](#complete-examples)
13. [Gotchas & Important Notes](#gotchas--important-notes)

---

## Protocol Overview

x402 is Coinbase's open payment protocol that enables instant, automatic stablecoin payments over HTTP using the `402 Payment Required` status code. It uses EIP-3009 `transferWithAuthorization` for gasless stablecoin transfers (USDC).

**Packages (all @x402/ namespace, v2.5.0):**
- `@x402/core` -- Core protocol (client, server, facilitator, types, HTTP utilities)
- `@x402/evm` -- EVM mechanism (ExactEvmScheme for client and server)
- `@x402/express` -- Express.js middleware
- `@x402/fetch` -- Fetch API wrapper with automatic 402 handling
- `@x402/next` -- Next.js integration
- `@x402/hono` -- Hono framework support
- `@x402/axios` -- Axios interceptor
- `@x402/svm` -- Solana blockchain support
- `@x402/extensions` -- Bazaar, EIP-2612, ERC-20 approval extensions

**License:** Apache-2.0
**Repository:** https://github.com/coinbase/x402

---

## Architecture & Flow

```
Step 1: Client  ---GET /resource--->  Resource Server
Step 2: Client  <---402 + PAYMENT-REQUIRED header---  Resource Server
Step 3: Client  ---GET /resource + PAYMENT-SIGNATURE header--->  Resource Server
Step 4: Resource Server  ---POST /verify--->  Facilitator
Step 5: Resource Server  <---{isValid: true}--->  Facilitator
Step 6: Client  <---200 + data + PAYMENT-RESPONSE header---  Resource Server
Step 7: Resource Server  ---POST /settle--->  Facilitator (executes on-chain transfer)
```

**Key actors:**
- **Client (Buyer):** Signs EIP-712 typed data authorizing a transfer. No gas needed.
- **Resource Server (Seller):** Protects endpoints with payment requirements. Verifies payments via facilitator.
- **Facilitator:** Third-party service that verifies signatures and executes on-chain settlement. Covers gas fees.

---

## HTTP Headers

### v2 Protocol (current)

| Header | Direction | Purpose |
|--------|-----------|---------|
| `PAYMENT-REQUIRED` | Server -> Client | Base64-encoded `PaymentRequired` object |
| `PAYMENT-SIGNATURE` | Client -> Server | Base64-encoded `PaymentPayload` object |
| `PAYMENT-RESPONSE` | Server -> Client | Base64-encoded `SettleResponse` object |

### v1 Protocol (legacy)

| Header | Direction | Purpose |
|--------|-----------|---------|
| (body) | Server -> Client | `PaymentRequired` in response body |
| `X-PAYMENT` | Client -> Server | Base64-encoded payment payload |
| `X-PAYMENT-RESPONSE` | Server -> Client | Base64-encoded settlement response |

### Encoding/Decoding Functions

```typescript
import {
  encodePaymentSignatureHeader,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  decodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  decodePaymentResponseHeader,
} from "@x402/core/http";

// All use safeBase64Encode(JSON.stringify(obj)) / JSON.parse(safeBase64Decode(str))
```

---

## Core Types & Interfaces

### Foundational Types

```typescript
// From @x402/core/types

// Network identifier in CAIP-2 format
type Network = `${string}:${string}`;
// Examples: "eip155:8453" (Base), "eip155:84532" (Base Sepolia), "eip155:10143" (Monad)

type Money = string | number;
// Examples: "$0.10", "0.10", 0.10

type AssetAmount = {
  amount: string;       // Token amount in smallest units (e.g., "100000" for $0.10 USDC)
  asset: string;        // Token contract address
  extra?: Record<string, unknown>;  // e.g., { name: "USDC", version: "2" }
};

type Price = Money | AssetAmount;
```

### Payment Types

```typescript
interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

type PaymentRequirements = {
  scheme: string;                    // "exact"
  network: Network;                  // "eip155:10143"
  asset: string;                     // Token contract address
  amount: string;                    // Amount in smallest units
  payTo: string;                     // Recipient address
  maxTimeoutSeconds: number;         // Max time for payment validity
  extra: Record<string, unknown>;    // { name: "USDC", version: "2", assetTransferMethod: "eip3009" }
};

type PaymentRequired = {
  x402Version: number;               // 2 for current protocol
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];    // Array of accepted payment options
  extensions?: Record<string, unknown>;
};

type PaymentPayload = {
  x402Version: number;               // 2 for current protocol
  resource?: ResourceInfo;
  accepted: PaymentRequirements;     // The chosen payment option
  payload: Record<string, unknown>;  // Scheme-specific payload (EIP-3009 authorization + signature)
  extensions?: Record<string, unknown>;
};
```

### Facilitator Types

```typescript
type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  extensions?: Record<string, unknown>;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleResponse = {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;     // Transaction hash
  network: Network;
  extensions?: Record<string, unknown>;
};

type SupportedKind = {
  x402Version: number;
  scheme: string;
  network: Network;
  extra?: Record<string, unknown>;
};

type SupportedResponse = {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>;  // CAIP family pattern -> signer addresses
};

class VerifyError extends Error {
  readonly invalidReason?: string;
  readonly invalidMessage?: string;
  readonly payer?: string;
  readonly statusCode: number;
  constructor(statusCode: number, response: VerifyResponse);
}

class SettleError extends Error {
  readonly errorReason?: string;
  readonly errorMessage?: string;
  readonly payer?: string;
  readonly transaction: string;
  readonly network: Network;
  readonly statusCode: number;
  constructor(statusCode: number, response: SettleResponse);
}
```

### Mechanism Interfaces

```typescript
// Client-side scheme interface
interface SchemeNetworkClient {
  readonly scheme: string;
  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult>;
}

// Server-side scheme interface
interface SchemeNetworkServer {
  readonly scheme: string;
  parsePrice(price: Price, network: Network): Promise<AssetAmount>;
  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: { x402Version: number; scheme: string; network: Network; extra?: Record<string, unknown> },
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements>;
}

// Facilitator-side scheme interface
interface SchemeNetworkFacilitator {
  readonly scheme: string;
  readonly caipFamily: string;  // "eip155:*" or "solana:*"
  getExtra(network: Network): Record<string, unknown> | undefined;
  getSigners(network: string): string[];
  verify(payload: PaymentPayload, requirements: PaymentRequirements, context?: FacilitatorContext): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements, context?: FacilitatorContext): Promise<SettleResponse>;
}

type MoneyParser = (amount: number, network: Network) => Promise<AssetAmount | null>;

type PaymentPayloadResult = Pick<PaymentPayload, "x402Version" | "payload"> & {
  extensions?: Record<string, unknown>;
};

interface PaymentPayloadContext {
  extensions?: Record<string, unknown>;
}
```

---

## Client-Side API

### x402Client

```typescript
import { x402Client } from "@x402/core/client";

// Constructor
const client = new x402Client(paymentRequirementsSelector?);
// Default selector: (x402Version, accepts) => accepts[0]

// Static factory
const client = x402Client.fromConfig({
  schemes: SchemeRegistration[],
  policies?: PaymentPolicy[],
  paymentRequirementsSelector?: SelectPaymentRequirements,
});

// Registration
client.register(network: Network, schemeClient: SchemeNetworkClient): x402Client;  // v2
client.registerV1(network: string, schemeClient: SchemeNetworkClient): x402Client; // v1
client.registerPolicy(policy: PaymentPolicy): x402Client;
client.registerExtension(extension: ClientExtension): x402Client;

// Payment creation
client.createPaymentPayload(paymentRequired: PaymentRequired): Promise<PaymentPayload>;

// Lifecycle hooks
client.onBeforePaymentCreation(hook): x402Client;
client.onAfterPaymentCreation(hook): x402Client;
client.onPaymentCreationFailure(hook): x402Client;
```

#### Hook Types

```typescript
type BeforePaymentCreationHook = (context: PaymentCreationContext) =>
  Promise<void | { abort: true; reason: string }>;

type AfterPaymentCreationHook = (context: PaymentCreatedContext) => Promise<void>;

type OnPaymentCreationFailureHook = (context: PaymentCreationFailureContext) =>
  Promise<void | { recovered: true; payload: PaymentPayload }>;

type PaymentPolicy = (x402Version: number, paymentRequirements: PaymentRequirements[]) =>
  PaymentRequirements[];

type SelectPaymentRequirements = (x402Version: number, paymentRequirements: PaymentRequirements[]) =>
  PaymentRequirements;
```

#### Client Extension Interface

```typescript
interface ClientExtension {
  key: string;
  enrichPaymentPayload?: (
    paymentPayload: PaymentPayload,
    paymentRequired: PaymentRequired,
  ) => Promise<PaymentPayload>;
}
```

#### SchemeRegistration Config

```typescript
interface SchemeRegistration {
  network: Network;
  client: SchemeNetworkClient;
  x402Version?: number;  // Default: 2
}

interface x402ClientConfig {
  schemes: SchemeRegistration[];
  policies?: PaymentPolicy[];
  paymentRequirementsSelector?: SelectPaymentRequirements;
}
```

### x402HTTPClient

```typescript
import { x402HTTPClient } from "@x402/core/client";

const httpClient = new x402HTTPClient(client: x402Client);

// Encode payment payload to HTTP headers
httpClient.encodePaymentSignatureHeader(paymentPayload: PaymentPayload): Record<string, string>;
// v2: { "PAYMENT-SIGNATURE": base64EncodedPayload }
// v1: { "X-PAYMENT": base64EncodedPayload }

// Parse 402 response
httpClient.getPaymentRequiredResponse(
  getHeader: (name: string) => string | null | undefined,
  body?: unknown,
): PaymentRequired;

// Parse settlement response from headers
httpClient.getPaymentSettleResponse(
  getHeader: (name: string) => string | null | undefined,
): SettleResponse;

// Delegate to underlying client
httpClient.createPaymentPayload(paymentRequired: PaymentRequired): Promise<PaymentPayload>;

// Hook for 402 responses
httpClient.onPaymentRequired(hook: PaymentRequiredHook): this;
```

---

## Server-Side API

### x402ResourceServer

```typescript
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const server = new x402ResourceServer(facilitatorClient);

// Registration
server.register(network: Network, schemeServer: SchemeNetworkServer): x402ResourceServer;
server.registerExtension(extension: ResourceServerExtension): x402ResourceServer;

// Initialization (fetches /supported from facilitator)
await server.initialize();

// Query
server.hasRegisteredScheme(network, scheme): boolean;
server.hasExtension(key): boolean;
server.getExtensions(): Map<string, ResourceServerExtension>;
server.getSupportedKind(version, network, scheme): SupportedKind | undefined;
server.getFacilitatorExtensions(): string[];

// Payment requirement building
server.buildPaymentRequirements(resourceConfig: ResourceConfig): Promise<PaymentRequirements>;
server.createPaymentRequiredResponse(options): Promise<PaymentRequired>;

// Payment processing
server.verifyPayment(paymentPayload, paymentRequirements): Promise<VerifyResponse>;
server.settlePayment(paymentPayload, paymentRequirements): Promise<SettleResponse>;
server.processPaymentRequest(paymentPayload, requirements[]): Promise<VerifyResponse>;

// Lifecycle hooks
server.onBeforeVerify(hook): x402ResourceServer;
server.onAfterVerify(hook): x402ResourceServer;
server.onBeforeSettle(hook): x402ResourceServer;
server.onAfterSettle(hook): x402ResourceServer;
// Plus failure hooks
```

### HTTPFacilitatorClient

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

interface FacilitatorConfig {
  url?: string;                      // Default: "https://x402.org/facilitator"
  createAuthHeaders?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
  }>;
}

const client = new HTTPFacilitatorClient({ url: "https://x402-facilitator.molandak.org" });

// API methods
client.verify(paymentPayload, paymentRequirements): Promise<VerifyResponse>;
client.settle(paymentPayload, paymentRequirements): Promise<SettleResponse>;
client.getSupported(): Promise<SupportedResponse>;

// Internal: retries getSupported 3x with exponential backoff on 429
```

### FacilitatorClient Interface

```typescript
interface FacilitatorClient {
  verify(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<SettleResponse>;
  getSupported(): Promise<SupportedResponse>;
}
```

### Route Configuration

```typescript
// From @x402/core/server
interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  description?: string;
  mimeType?: string;
  extensions?: Record<string, unknown>;
}

type PaymentOption = {
  scheme: string;          // "exact"
  price: string;           // "$0.001"
  network: string;         // "eip155:10143"
  payTo: string;           // "0x..."
  maxTimeoutSeconds?: number;
};

type RoutesConfig = {
  [routePattern: string]: RouteConfig;
};
// Route pattern examples: "GET /weather", "POST /api/*"
```

---

## Express Middleware

```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
```

### paymentMiddleware (main entry point)

```typescript
function paymentMiddleware(
  routes: RoutesConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean,  // default: true
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

### paymentMiddlewareFromHTTPServer

```typescript
function paymentMiddlewareFromHTTPServer(
  httpServer: x402HTTPResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean,
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

### paymentMiddlewareFromConfig

```typescript
function paymentMiddlewareFromConfig(
  routes: RoutesConfig,
  facilitatorClients?: FacilitatorClient | FacilitatorClient[],
  schemes?: SchemeRegistration[],
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean,
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

### PaywallConfig

```typescript
interface PaywallConfig {
  appName: string;
  appLogo: string;
  testnet: boolean;
}
```

### Middleware Behavior

1. Creates an `ExpressAdapter` from the request
2. Checks if route requires payment (`httpServer.requiresPayment(context)`)
3. If no payment needed, calls `next()`
4. On first protected request, initializes facilitator sync (lazy)
5. Processes the HTTP request via `httpServer.processHTTPRequest(context, paywallConfig)`
6. Three result types:
   - `"no-payment-required"` -- calls `next()`
   - `"payment-error"` -- returns 402 with payment requirements
   - `"payment-verified"` -- buffers response, calls `next()`, then settles payment after handler completes
7. If handler returns status >= 400, skips settlement
8. If settlement fails, returns 402 with error

### Exports from @x402/express

```typescript
export { paymentMiddleware, paymentMiddlewareFromHTTPServer, paymentMiddlewareFromConfig };
export { x402ResourceServer, x402HTTPResourceServer } from "@x402/core/server";
export { ExpressAdapter } from "./adapter";
export { RouteConfigurationError } from "@x402/core/server";
export type {
  PaymentRequired, PaymentRequirements, PaymentPayload, Network, SchemeNetworkServer,
  PaywallProvider, PaywallConfig, RouteValidationError,
} from "@x402/core/types" | "@x402/core/server";
```

---

## Fetch Wrapper

```typescript
import { wrapFetchWithPayment, wrapFetchWithPaymentFromConfig, x402Client, x402HTTPClient } from "@x402/fetch";
```

### wrapFetchWithPayment

```typescript
function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  client: x402Client | x402HTTPClient,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```

**Behavior:**
1. Makes initial fetch request
2. If response is not 402, returns response as-is
3. Parses `PaymentRequired` from response (headers for v2, body for v1)
4. Runs `handlePaymentRequired` hooks (if any return headers, retries with those first)
5. Creates payment payload via `client.createPaymentPayload(paymentRequired)`
6. Encodes payment into headers via `httpClient.encodePaymentSignatureHeader(paymentPayload)`
7. Checks for infinite loop (if PAYMENT-SIGNATURE or X-PAYMENT already present, throws)
8. Sets `Access-Control-Expose-Headers: PAYMENT-RESPONSE,X-PAYMENT-RESPONSE`
9. Retries the request with payment headers
10. Returns the second response

### wrapFetchWithPaymentFromConfig

```typescript
function wrapFetchWithPaymentFromConfig(
  fetch: typeof globalThis.fetch,
  config: x402ClientConfig,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```

### Re-exports from @x402/fetch

```typescript
export { x402Client, x402HTTPClient } from "@x402/core/client";
export { decodePaymentResponseHeader } from "@x402/core/http";
export type {
  PaymentPolicy, SchemeRegistration, SelectPaymentRequirements, x402ClientConfig,
  Network, PaymentPayload, PaymentRequired, PaymentRequirements, SchemeNetworkClient,
} from "@x402/core/client" | "@x402/core/types";
```

---

## EVM Mechanism

### Package Exports (@x402/evm)

```typescript
// Client scheme
export { ExactEvmScheme } from "./exact";

// Permit2 utilities
export {
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams,
  erc20AllowanceAbi,
  type Permit2AllowanceParams,
} from "./exact/client";

// Signers
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer";

// Types
export type {
  AssetTransferMethod,    // "eip3009" | "permit2"
  ExactEIP3009Payload,
  ExactPermit2Payload,
  ExactEvmPayloadV1,
  ExactEvmPayloadV2,
  Permit2Witness,
  Permit2Authorization,
} from "./types";
export { isPermit2Payload, isEIP3009Payload } from "./types";

// Constants
export {
  PERMIT2_ADDRESS,                  // "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  x402ExactPermit2ProxyAddress,     // "0x402085c248EeA27D92E8b30b2C58ed07f9E20001"
  x402UptoPermit2ProxyAddress,      // "0x402039b3d6E6BEC5A02c2C9fd937ac17A6940002"
  permit2WitnessTypes,
  authorizationTypes,
  eip3009ABI,
  x402ExactPermit2ProxyABI,
} from "./constants";
```

### Sub-package Exports

```typescript
// @x402/evm/exact/client
export { ExactEvmScheme } from "./scheme";
export { registerExactEvmScheme } from "./register";
export type { EvmClientConfig } from "./register";
export { createPermit2ApprovalTx, getPermit2AllowanceReadParams, type Permit2AllowanceParams } from "./permit2";
export { erc20AllowanceAbi } from "../../constants";

// @x402/evm/exact/server
export { ExactEvmScheme } from "./scheme";
export { registerExactEvmScheme } from "./register";
export type { EvmResourceServerConfig } from "./register";
```

### ClientEvmSigner

```typescript
type ClientEvmSigner = {
  readonly address: `0x${string}`;

  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;

  readContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;

  // Optional: for ERC-20 approval gas sponsoring
  signTransaction?(args: {
    to: `0x${string}`;
    data: `0x${string}`;
    nonce: number;
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    chainId: number;
  }): Promise<`0x${string}`>;

  getTransactionCount?(args: { address: `0x${string}` }): Promise<number>;
  estimateFeesPerGas?(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
};
```

### toClientEvmSigner

```typescript
function toClientEvmSigner(
  signer: Omit<ClientEvmSigner, "readContract"> & { readContract?: ClientEvmSigner["readContract"] },
  publicClient?: {
    readContract(args: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
    getTransactionCount?(args: { address: `0x${string}` }): Promise<number>;
    estimateFeesPerGas?(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
  },
): ClientEvmSigner;

// Usage:
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";

const account = privateKeyToAccount("0x...");
const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const signer = toClientEvmSigner(account, publicClient);

// Or with extended wallet client:
import { createWalletClient } from "viem";
import { publicActions } from "viem";
const signer = createWalletClient({
  account: privateKeyToAccount("0x..."),
  chain: monadTestnet,
  transport: http(),
}).extend(publicActions);
```

### FacilitatorEvmSigner

```typescript
type FacilitatorEvmSigner = {
  getAddresses(): readonly `0x${string}`[];
  readContract(args: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
  verifyTypedData(args: { address: `0x${string}`; domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown>; signature: `0x${string}` }): Promise<boolean>;
  writeContract(args: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }): Promise<`0x${string}`>;
  sendTransaction(args: { to: `0x${string}`; data: `0x${string}` }): Promise<`0x${string}`>;
  waitForTransactionReceipt(args: { hash: `0x${string}` }): Promise<{ status: string }>;
  getCode(args: { address: `0x${string}` }): Promise<`0x${string}` | undefined>;
};

function toFacilitatorEvmSigner(
  client: Omit<FacilitatorEvmSigner, "getAddresses"> & { address: `0x${string}` },
): FacilitatorEvmSigner;
```

### ExactEvmScheme (Client)

```typescript
// @x402/evm/exact/client
class ExactEvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact";
  constructor(signer: ClientEvmSigner);

  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult>;

  // Routes to EIP-3009 or Permit2 based on requirements.extra.assetTransferMethod
  // Default: "eip3009"
  // Automatically handles EIP-2612 gas sponsoring for Permit2 flows
}
```

### ExactEvmScheme (Server)

```typescript
// @x402/evm/exact/server
class ExactEvmScheme implements SchemeNetworkServer {
  readonly scheme = "exact";

  registerMoneyParser(parser: MoneyParser): ExactEvmScheme;
  parsePrice(price: Price, network: Network): Promise<AssetAmount>;
  enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys): Promise<PaymentRequirements>;
}

// Default stablecoins (built-in):
// "eip155:8453"  -> USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (name: "USD Coin", version: "2", decimals: 6)
// "eip155:84532" -> USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e (name: "USDC", version: "2", decimals: 6)
// "eip155:4326"  -> USDM 0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7 (name: "MegaUSD", version: "1", decimals: 18)
// NOTE: Monad is NOT in the defaults -- must use registerMoneyParser!
```

### EIP-3009 Payload Types

```typescript
type ExactEIP3009Payload = {
  signature?: `0x${string}`;
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;    // Unix timestamp, typically now - 600 (10 min past)
    validBefore: string;   // Unix timestamp, typically now + maxTimeoutSeconds
    nonce: `0x${string}`;  // Random 32-byte hex
  };
};
```

### EIP-712 Signing Domain & Types

```typescript
// For TransferWithAuthorization (EIP-3009)
const domain = {
  name: "USDC",          // Token's EIP-712 domain name (varies by chain!)
  version: "2",          // Token's EIP-712 domain version
  chainId: 10143,        // Numeric chain ID
  verifyingContract: "0x534b2f3A21130d7a60830c2Df862319e593943A3",  // Token contract
};

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
```

### EIP-3009 ABI

```typescript
const eip3009ABI = [
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
```

### EIP-3009 Payload Creation (internal)

```typescript
// From @x402/evm/exact/client/eip3009.ts
async function createEIP3009Payload(
  signer: ClientEvmSigner,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<PaymentPayloadResult> {
  const nonce = createNonce();  // Random 32-byte hex
  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from: signer.address,
    to: getAddress(paymentRequirements.payTo),
    value: paymentRequirements.amount,
    validAfter: (now - 600).toString(),       // 10 minutes in the past (clock skew buffer)
    validBefore: (now + paymentRequirements.maxTimeoutSeconds).toString(),
    nonce,
  };

  const signature = await signEIP3009Authorization(signer, authorization, paymentRequirements);
  // Signs EIP-712 typed data with domain { name, version, chainId, verifyingContract: asset }

  return { x402Version, payload: { authorization, signature } };
}
```

### Utility Functions

```typescript
// From @x402/evm/utils.ts
function getEvmChainId(network: string): number;
// "eip155:10143" -> 10143

function createNonce(): `0x${string}`;
// Random 32-byte hex for EIP-3009

function createPermit2Nonce(): string;
// Random 256-bit number as string for Permit2
```

### Permit2 Types

```typescript
type Permit2Witness = {
  to: `0x${string}`;
  validAfter: string;
};

type Permit2Authorization = {
  permitted: { token: `0x${string}`; amount: string };
  spender: `0x${string}`;
  nonce: string;
  deadline: string;
  witness: Permit2Witness;
};

type ExactPermit2Payload = {
  signature: `0x${string}`;
  permit2Authorization: Permit2Authorization & { from: `0x${string}` };
};

const permit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Witness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Witness: [
    { name: "to", type: "address" },
    { name: "validAfter", type: "uint256" },
  ],
} as const;
```

---

## Monad-Specific Configuration

### Constants

```typescript
const MONAD_NETWORK: Network = "eip155:10143";
const MONAD_CHAIN_ID = 10143;
const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const MONAD_FACILITATOR_URL = "https://x402-facilitator.molandak.org";

// USDC EIP-712 domain on Monad:
const MONAD_USDC_DOMAIN = {
  name: "USDC",       // NOT "USD Coin" -- important!
  version: "2",
  chainId: BigInt(10143),
  verifyingContract: MONAD_USDC_TESTNET,
};
```

### Monad Facilitator Endpoints

```
Base URL: https://x402-facilitator.molandak.org

GET  /supported  - Returns supported networks, schemes, signer addresses
POST /verify     - Verifies payment signature
POST /settle     - Executes payment on-chain (facilitator covers gas)
```

### Server Setup for Monad (Custom Money Parser Required)

Because Monad is NOT in the default stablecoin map, you MUST register a custom money parser:

```typescript
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { Network } from "@x402/core/types";

const MONAD_NETWORK: Network = "eip155:10143";
const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const monadScheme = new ExactEvmScheme();

monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === MONAD_NETWORK) {
    const tokenAmount = Math.floor(amount * 1_000_000).toString();
    return {
      amount: tokenAmount,
      asset: MONAD_USDC_TESTNET,
      extra: {
        name: "USDC",     // Must match the EIP-712 domain name
        version: "2",     // Must match the EIP-712 domain version
      },
    };
  }
  return null;  // Fall through to default parser
});

const server = new x402ResourceServer(facilitatorClient)
  .register(MONAD_NETWORK, monadScheme);
```

### Client Setup for Monad

```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({
  chain: {
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  },
  transport: http(),
});

const signer = toClientEvmSigner(account, publicClient);
// Or: signer = privateKeyToAccount(process.env.PRIVATE_KEY) if readContract not needed

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));
// Or register specifically: client.register("eip155:10143", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Use it
const response = await fetchWithPayment("http://localhost:4021/price-data");
const data = await response.json();
```

### Package Version Requirement

Monad facilitator ONLY supports x402 version 2 and above. Ensure packages are >= 2.2.0:

```json
{
  "dependencies": {
    "@x402/core": "^2.5.0",
    "@x402/evm": "^2.5.0",
    "@x402/express": "^2.5.0",
    "@x402/fetch": "^2.5.0"
  }
}
```

### Faucets for Testing

- **USDC:** https://faucet.circle.com (1 USDC per 2 hours)
- **MON:** https://faucet.monad.xyz

---

## Facilitator API

### Facilitator HTTP Endpoints

All facilitators expose these REST endpoints:

#### GET /supported

Returns capabilities of the facilitator.

```typescript
// Response: SupportedResponse
{
  kinds: [
    { x402Version: 2, scheme: "exact", network: "eip155:10143", extra: { ... } },
    // ...
  ],
  extensions: ["bazaar", "eip2612GasSponsoring"],
  signers: {
    "eip155:*": ["0xFacilitatorSignerAddress1", "0xFacilitatorSignerAddress2"],
  },
}
```

#### POST /verify

Verifies a payment signature without executing it on-chain.

```typescript
// Request body:
{
  x402Version: 2,
  paymentPayload: PaymentPayload,     // (JSON-safe, BigInts as strings)
  paymentRequirements: PaymentRequirements,
}

// Response: VerifyResponse
{
  isValid: true,
  payer: "0xPayerAddress",
}
// Or on failure:
{
  isValid: false,
  invalidReason: "insufficient_balance",
  invalidMessage: "Payer has insufficient USDC balance",
  payer: "0xPayerAddress",
}
```

#### POST /settle

Executes the payment on-chain. The facilitator broadcasts the `transferWithAuthorization` transaction and covers gas.

```typescript
// Request body: same as /verify

// Response: SettleResponse
{
  success: true,
  payer: "0xPayerAddress",
  transaction: "0xTransactionHash",
  network: "eip155:10143",
}
// Or on failure:
{
  success: false,
  errorReason: "settlement_failed",
  errorMessage: "Transaction reverted",
  payer: "0xPayerAddress",
  transaction: "",
  network: "eip155:10143",
}
```

### Default Facilitator URLs

| Network | Facilitator URL |
|---------|----------------|
| Base, Base Sepolia | `https://x402.org/facilitator` |
| Monad Testnet | `https://x402-facilitator.molandak.org` |

---

## Complete Examples

### Express Server with Monad x402 (Ghost Treasury Pattern)

```typescript
import express from "express";
import { config } from "dotenv";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { Network } from "@x402/core/types";

config();

const MONAD_NETWORK: Network = "eip155:10143";
const MONAD_USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";
const PAY_TO = process.env.PAY_TO_ADDRESS as `0x${string}`;
const PORT = process.env.PORT || 4021;

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

// Create EVM scheme with Monad money parser
const monadScheme = new ExactEvmScheme();
monadScheme.registerMoneyParser(async (amount, network) => {
  if (network === MONAD_NETWORK) {
    return {
      amount: Math.floor(amount * 1_000_000).toString(),
      asset: MONAD_USDC,
      extra: { name: "USDC", version: "2" },
    };
  }
  return null;
});

// Create resource server
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(MONAD_NETWORK, monadScheme);

const app = express();

// Apply payment middleware
app.use(
  paymentMiddleware(
    {
      "GET /api/price/:token": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: MONAD_NETWORK,
          payTo: PAY_TO,
        },
        description: "Real-time token price data",
        mimeType: "application/json",
      },
      "GET /api/portfolio": {
        accepts: {
          scheme: "exact",
          price: "$0.01",
          network: MONAD_NETWORK,
          payTo: PAY_TO,
        },
        description: "Portfolio analytics",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// Protected endpoints
app.get("/api/price/:token", (req, res) => {
  res.json({
    token: req.params.token,
    price: 1842.50,
    timestamp: Date.now(),
    source: "ghost-treasury",
  });
});

app.get("/api/portfolio", (req, res) => {
  res.json({
    holdings: [],
    totalValue: 0,
    timestamp: Date.now(),
  });
});

// Unprotected endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Ghost Treasury API running on port ${PORT}`);
});
```

### Fetch Client for Monad (Ghost Treasury Agent)

```typescript
import { config } from "dotenv";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";

config();

const PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY as `0x${string}`;
const API_BASE = process.env.PRICE_API_URL || "http://localhost:4021";

// Set up signer
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: {
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  },
  transport: http(),
});
const signer = toClientEvmSigner(account, publicClient);

// Create x402 client
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

// Add spending policy (optional)
client.registerPolicy((version, reqs) => {
  // Only allow payments under $1.00
  return reqs.filter(r => BigInt(r.amount) < BigInt("1000000"));
});

// Wrap fetch
const paidFetch = wrapFetchWithPayment(fetch, client);

// Use it
async function getPriceData(token: string) {
  const response = await paidFetch(`${API_BASE}/api/price/${token}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch price: ${response.status}`);
  }

  // Extract settlement info
  const httpClient = new x402HTTPClient(client);
  try {
    const settlement = httpClient.getPaymentSettleResponse(name => response.headers.get(name));
    console.log(`Payment settled: tx=${settlement.transaction} on ${settlement.network}`);
  } catch {
    // No settlement header (might be cached or free)
  }

  return response.json();
}
```

### Official Express Server Example (from repo)

```typescript
import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const svmAddress = process.env.SVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:84532",
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: svmAddress,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("eip155:84532", new ExactEvmScheme())
      .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme()),
  ),
);

app.get("/weather", (req, res) => {
  res.send({ report: { weather: "sunny", temperature: 70 } });
});

app.listen(4021, () => { console.log("Server listening at http://localhost:4021"); });
```

### Official Fetch Client Example (from repo)

```typescript
import { config } from "dotenv";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
config();

const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";

async function main() {
  const evmSigner = privateKeyToAccount(evmPrivateKey);
  const svmSigner = await createKeyPairSignerFromBytes(base58.decode(svmPrivateKey));

  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(evmSigner));
  client.register("solana:*", new ExactSvmScheme(svmSigner));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const response = await fetchWithPayment(`${baseURL}${endpointPath}`, { method: "GET" });
  const body = await response.json();
  console.log("Response body:", body);

  if (response.ok) {
    const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(
      name => response.headers.get(name),
    );
    console.log("Payment response:", JSON.stringify(paymentResponse, null, 2));
  }
}

main().catch(console.error);
```

### Environment Variables

```bash
# Server (.env)
PAY_TO_ADDRESS=0xYourWalletAddress
FACILITATOR_URL=https://x402-facilitator.molandak.org  # For Monad
# FACILITATOR_URL=https://x402.org/facilitator          # For Base

# Client (.env)
EVM_PRIVATE_KEY=0xYourPrivateKey
RESOURCE_SERVER_URL=http://localhost:4021
ENDPOINT_PATH=/api/price/ETH
```

---

## Gotchas & Important Notes

### Monad-Specific

1. **Monad facilitator ONLY supports x402 v2+.** Migration from v1 required.
2. **USDC name on Monad is "USDC"** (not "USD Coin" like on Base mainnet). The EIP-712 domain name MUST match exactly.
3. **Monad is NOT in the default stablecoin map.** You MUST register a custom `MoneyParser` on the server-side `ExactEvmScheme`.
4. **USDC decimals on Monad: 6.** Conversion: `Math.floor(amount * 1_000_000)`.
5. **USDC Testnet Address:** `0x534b2f3A21130d7a60830c2Df862319e593943A3`
6. **Chain ID:** `10143` (CAIP-2: `eip155:10143`)
7. **Facilitator URL:** `https://x402-facilitator.molandak.org`

### Protocol-Level

8. **validAfter uses 600s past buffer.** The EIP-3009 `validAfter` is set to `now - 600` (10 minutes in the past) to handle clock skew.
9. **validBefore uses maxTimeoutSeconds.** Set to `now + maxTimeoutSeconds` from the payment requirements.
10. **Infinite loop prevention.** The fetch wrapper checks for existing `PAYMENT-SIGNATURE` or `X-PAYMENT` headers before retrying.
11. **Settlement is post-response.** The Express middleware buffers the response, executes the route handler, THEN settles payment. If the handler returns >= 400, settlement is skipped.
12. **Facilitator initialization is lazy.** The Express middleware only syncs with the facilitator on the first protected request, not at startup (unless `syncFacilitatorOnStart` is explicitly set).
13. **getSupported retries on 429.** The HTTPFacilitatorClient retries `GET /supported` 3 times with exponential backoff on rate limit errors.
14. **Default facilitator URL is `https://x402.org/facilitator`** -- you MUST override this for Monad.

### Type Safety

15. **Network is a template literal type.** `type Network = \`${string}:${string}\`` -- always use CAIP-2 format.
16. **BigInt handling.** The HTTPFacilitatorClient converts BigInts to strings for JSON serialization.
17. **Wildcard registration.** `"eip155:*"` matches any EVM chain. Specific registrations take precedence over wildcards.
18. **EIP-712 domain parameters (name, version) are REQUIRED** in `paymentRequirements.extra` for EIP-3009 signing. Without them, the client throws an error.

### Import Paths

19. **Client vs Server imports have different paths:**
    - Client: `import { ExactEvmScheme } from "@x402/evm/exact/client"`
    - Server: `import { ExactEvmScheme } from "@x402/evm/exact/server"`
    - Both export `ExactEvmScheme` but they are DIFFERENT classes!
20. **Core sub-paths:**
    - `@x402/core/client` -- x402Client, x402HTTPClient
    - `@x402/core/server` -- x402ResourceServer, HTTPFacilitatorClient
    - `@x402/core/http` -- Header encode/decode functions
    - `@x402/core/types` -- All type definitions

### Pricing

21. **CDP Facilitator:** 1,000 free transactions/month, then $0.001 per transaction.
22. **Monad Facilitator:** Pricing not specified (likely free during testnet).
23. **Price format:** Use `"$0.001"` format in route config. The server's `parsePrice` handles the `$` prefix.
