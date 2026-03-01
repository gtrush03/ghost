import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, ArrowRight, Check, Loader2 } from "lucide-react";

interface DepositPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOKENS = [
  { symbol: "USDC", address: "0x534b2f3A21130d7a60830c2Df862319e593943A3", decimals: 6 },
  { symbol: "MON", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
  { symbol: "WMON", address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A", decimals: 18 },
];

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3003";

type Step = "input" | "signing" | "confirming" | "done" | "error";

export function DepositPanel({ isOpen, onClose }: DepositPanelProps) {
  const [token, setToken] = useState(TOKENS[0]);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const reset = () => {
    setAmount("");
    setStep("input");
    setError("");
    setTxHash("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    // Check for injected wallet (MetaMask etc)
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No wallet detected. Install MetaMask to deposit.");
      setStep("error");
      return;
    }

    try {
      setStep("signing");

      // Request wallet connection
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const depositor = accounts[0];

      // Convert to raw amount
      const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** token.decimals)).toString();

      // Get deposit calldata from backend
      const res = await fetch(`${API_BASE}/api/treasury/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositor, token: token.address, amount: rawAmount }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate deposit");
      }

      const { to, calldata, value } = await res.json();

      // Send the on-chain transaction via wallet
      const hash = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: depositor,
          to,
          data: calldata,
          value: value !== "0" ? `0x${BigInt(value).toString(16)}` : "0x0",
        }],
      });

      setTxHash(hash);
      setStep("confirming");

      // Confirm deposit with backend
      const confirmRes = await fetch(`${API_BASE}/api/treasury/deposit/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relayId: hash }),
      });

      if (!confirmRes.ok) {
        // Non-fatal — tx is already on-chain, confirmation can be retried
        console.warn("Deposit confirmation pending");
      }

      setStep("done");
    } catch (err: any) {
      if (err.code === 4001) {
        // User rejected in wallet
        setStep("input");
        return;
      }
      setError(err.message || "Deposit failed");
      setStep("error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       glass-card p-8 w-full max-w-sm space-y-5"
          >
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-glass-hover transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>

            <div className="text-center space-y-2">
              <Shield className="w-10 h-10 text-gold mx-auto" />
              <h3 className="text-lg font-semibold text-text-primary">
                Deposit to Privacy Pool
              </h3>
            </div>

            {step === "input" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted text-center leading-relaxed">
                  Deposit tokens into the Unlink privacy pool.
                  Your funds become invisible on-chain.
                </p>

                {/* Token selector */}
                <div className="flex gap-2">
                  {TOKENS.map((t) => (
                    <button
                      key={t.symbol}
                      onClick={() => setToken(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        token.symbol === t.symbol
                          ? "bg-gold/20 text-gold border border-gold/30"
                          : "bg-glass border border-glass-border text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t.symbol}
                    </button>
                  ))}
                </div>

                {/* Amount input */}
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3
                               text-text-primary placeholder:text-text-muted text-lg font-mono
                               focus:outline-none focus:border-gold/40 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    {token.symbol}
                  </span>
                </div>

                {/* Deposit button */}
                <button
                  onClick={handleDeposit}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="w-full py-3 rounded-xl font-medium text-sm transition-all cursor-pointer
                             bg-gold/20 text-gold border border-gold/30
                             hover:bg-gold/30 disabled:opacity-40 disabled:cursor-not-allowed
                             flex items-center justify-center gap-2"
                >
                  Deposit <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === "signing" && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="w-8 h-8 text-gold mx-auto animate-spin" />
                <p className="text-sm text-text-secondary">Confirm in your wallet...</p>
              </div>
            )}

            {step === "confirming" && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="w-8 h-8 text-gold mx-auto animate-spin" />
                <p className="text-sm text-text-secondary">Transaction submitted</p>
                <p className="text-xs text-text-muted font-mono break-all">{txHash}</p>
              </div>
            )}

            {step === "done" && (
              <div className="text-center space-y-3 py-4">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm text-text-primary font-medium">Deposit complete</p>
                <p className="text-xs text-text-muted">
                  {amount} {token.symbol} is now shielded in the privacy pool.
                </p>
                {txHash && (
                  <a
                    href={`https://testnet.monadscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gold hover:underline"
                  >
                    View on MonadScan
                  </a>
                )}
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-glass border border-glass-border
                             text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {step === "error" && (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-glass border border-glass-border
                             text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  Try again
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
