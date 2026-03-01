import { useState, useEffect, useCallback } from "react";
import { registerMember } from "../lib/api";

const STORAGE_KEY = "ghost:wallet";
const SESSION_TOKEN_KEY = "ghost:session";
const MONAD_TESTNET_CHAIN_ID = "0x279f"; // 10143
const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface UseWalletReturn {
  address: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  authToken: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Try to use Privy if available (only when app ID is configured)
let usePrivyHook: (() => any) | null = null;
let useWalletsHook: (() => any) | null = null;
if (import.meta.env.VITE_PRIVY_APP_ID) {
  try {
    const privy = await import("@privy-io/react-auth");
    usePrivyHook = privy.usePrivy;
    useWalletsHook = privy.useWallets;
  } catch {
    // Privy not installed or not in provider — use MetaMask fallback
  }
}

export async function performSiwe(address: string): Promise<string | null> {
  try {
    // 1. Get nonce
    const nonceRes = await fetch(`${API_BASE}/api/auth/nonce`);
    if (!nonceRes.ok) return null;
    const { nonceId, nonce } = await nonceRes.json();

    // 2. Build SIWE message
    const domain = window.location.host;
    const origin = window.location.origin;
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to Ghost Treasury",
      "",
      `URI: ${origin}`,
      "Version: 1",
      `Chain ID: 10143`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
    ].join("\n");

    // 3. Sign with wallet
    const eth = (window as any).ethereum;
    if (!eth) return null;

    const signature = await eth.request({
      method: "personal_sign",
      params: [message, address],
    });

    // 4. Verify on backend
    const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature, nonceId }),
    });

    if (!verifyRes.ok) return null;
    const { token } = await verifyRes.json();
    return token;
  } catch (err) {
    console.warn("[wallet] SIWE flow failed:", err);
    return null;
  }
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainOk, setChainOk] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_TOKEN_KEY)
  );

  // Privy hooks (if available)
  const privy = usePrivyHook?.();
  const walletsResult = useWalletsHook?.();

  // Sync Privy state
  useEffect(() => {
    if (!privy) return;
    if (privy.authenticated && walletsResult?.wallets?.length > 0) {
      const wallet = walletsResult.wallets[0];
      const addr = wallet.address?.toLowerCase();
      if (addr && addr !== address) {
        setAddress(addr);
        localStorage.setItem(STORAGE_KEY, addr);
        // Auto-run SIWE if no token
        if (!authToken) {
          performSiwe(addr).then((token) => {
            if (token) {
              setAuthToken(token);
              sessionStorage.setItem(SESSION_TOKEN_KEY, token);
            }
          });
        }
        registerMember(addr).catch(() => {});
      }
    } else if (privy && !privy.authenticated) {
      if (address && usePrivyHook) {
        setAddress(null);
        setAuthToken(null);
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  }, [privy?.authenticated, walletsResult?.wallets]);

  // Check chain and auto-switch to Monad Testnet if needed
  const checkChain = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      const chainId = await eth.request({ method: "eth_chainId" });
      if (chainId === MONAD_TESTNET_CHAIN_ID) {
        setChainOk(true);
        return;
      }
      // Prompt MetaMask to switch
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
        });
        setChainOk(true);
      } catch (switchErr: any) {
        // 4902 = chain not added yet — add it
        if (switchErr.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: MONAD_TESTNET_CHAIN_ID,
              chainName: "Monad Testnet",
              nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
              rpcUrls: ["https://testnet-rpc.monad.xyz"],
              blockExplorerUrls: ["https://testnet.monadscan.com"],
            }],
          });
          setChainOk(true);
        } else {
          setChainOk(false);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // On mount: try to restore from localStorage (MetaMask fallback)
  useEffect(() => {
    if (usePrivyHook) return; // Privy handles its own state
    const stored = localStorage.getItem(STORAGE_KEY);
    const eth = (window as any).ethereum;
    if (!stored || !eth) return;

    eth.request({ method: "eth_accounts" })
      .then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const addr = accounts[0].toLowerCase();
          setAddress(addr);
          localStorage.setItem(STORAGE_KEY, addr);
          checkChain();
          registerMember(addr).catch(() => {});
          // Re-run SIWE if no session token
          if (!sessionStorage.getItem(SESSION_TOKEN_KEY)) {
            const token = await performSiwe(addr);
            if (token) {
              setAuthToken(token);
              sessionStorage.setItem(SESSION_TOKEN_KEY, token);
            }
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
  }, [checkChain]);

  // Listen for account/chain changes (MetaMask fallback)
  useEffect(() => {
    if (usePrivyHook) return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setAuthToken(null);
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      } else {
        const addr = accounts[0].toLowerCase();
        setAddress(addr);
        localStorage.setItem(STORAGE_KEY, addr);
      }
    };

    const handleChainChanged = () => {
      checkChain();
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [checkChain]);

  const connect = useCallback(async () => {
    // If Privy is available, use it
    if (privy) {
      setIsConnecting(true);
      try {
        privy.login();
      } catch {
        // User cancelled
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // MetaMask fallback — wait briefly for provider injection
    let eth = (window as any).ethereum;
    if (!eth) {
      // Some wallets inject late; wait up to 1s
      await new Promise((r) => setTimeout(r, 500));
      eth = (window as any).ethereum;
    }
    if (!eth) {
      alert("No wallet detected. Please install MetaMask or another Web3 wallet extension.");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        const addr = accounts[0].toLowerCase();
        setAddress(addr);
        localStorage.setItem(STORAGE_KEY, addr);
        await checkChain();
        registerMember(addr).catch(() => {});

        // Run SIWE for session token
        const token = await performSiwe(addr);
        if (token) {
          setAuthToken(token);
          sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        }
      }
    } catch {
      // User rejected
    } finally {
      setIsConnecting(false);
    }
  }, [privy, checkChain]);

  const disconnect = useCallback(() => {
    if (privy) {
      privy.logout();
    }
    setAddress(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }, [privy]);

  return { address, isConnecting, chainOk, authToken, connect, disconnect };
}
