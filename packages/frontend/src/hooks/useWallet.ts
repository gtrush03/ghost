import { useState, useEffect, useCallback } from "react";
import { registerMember } from "../lib/api";

const STORAGE_KEY = "ghost:wallet";
const MONAD_TESTNET_CHAIN_ID = "0x279f"; // 10143

interface UseWalletReturn {
  address: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainOk, setChainOk] = useState(true);

  // Check chain
  const checkChain = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      const chainId = await eth.request({ method: "eth_chainId" });
      setChainOk(chainId === MONAD_TESTNET_CHAIN_ID);
    } catch {
      // ignore
    }
  }, []);

  // On mount: try to restore from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const eth = (window as any).ethereum;
    if (!stored || !eth) return;

    // Silent check — don't prompt
    eth.request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          const addr = accounts[0].toLowerCase();
          setAddress(addr);
          localStorage.setItem(STORAGE_KEY, addr);
          checkChain();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
  }, [checkChain]);

  // Listen for account/chain changes
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
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
    const eth = (window as any).ethereum;
    if (!eth) {
      window.open("https://metamask.io", "_blank");
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
        // Register as member
        registerMember(addr).catch(() => {});
      }
    } catch {
      // User rejected
    } finally {
      setIsConnecting(false);
    }
  }, [checkChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { address, isConnecting, chainOk, connect, disconnect };
}
