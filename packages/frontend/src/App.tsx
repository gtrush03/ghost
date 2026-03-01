import { useState, useCallback } from "react";
import { Nav } from "./components/Nav";
import { AgentChat } from "./components/AgentChat";
import { LeftTabs } from "./components/LeftTabs";
import { PoolBar } from "./components/PoolBar";
import { Footer } from "./components/Footer";
import { GlowOrbs } from "./components/GlowOrbs";
import { DepositPanel } from "./components/DepositPanel";
import { useHealth } from "./hooks/useHealth";
import { useTreasury } from "./hooks/useTreasury";
import { useActivity } from "./hooks/useActivity";
import { useAgent } from "./hooks/useAgent";
import { useWallet } from "./hooks/useWallet";
import { usePool } from "./hooks/usePool";
import { useConstraints } from "./hooks/useConstraints";
import type { AgentEvent } from "./lib/types";

export function App() {
  const [depositOpen, setDepositOpen] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | undefined>();
  const { isLive, brain, model } = useHealth();
  const { treasury, refresh: refreshTreasury } = useTreasury();
  const { activities, addFromEvents, addEntry } = useActivity();
  const wallet = useWallet();
  const { pool, refresh: refreshPool } = usePool(wallet.address);
  const { settings, refresh: refreshConstraints } = useConstraints();

  const handleAgentComplete = useCallback(
    (events: AgentEvent[]) => {
      addFromEvents(events);
      refreshTreasury();
      refreshPool();
      refreshConstraints();
    },
    [addFromEvents, refreshTreasury, refreshPool, refreshConstraints]
  );

  const { messages, isProcessing, hasInteracted, sendMessage, clearMessages } = useAgent({
    onComplete: handleAgentComplete,
    walletAddress: wallet.address ?? undefined,
  });

  const handleSend = useCallback(
    (text: string) => {
      addEntry({
        type: "chat",
        description: `User: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`,
        privacy: "private",
      });
      sendMessage(text);
      setPrefillMessage(undefined);
    },
    [sendMessage, addEntry]
  );

  const handleAskAgent = useCallback((message: string) => {
    setPrefillMessage(message);
  }, []);

  return (
    <div className="w-full h-full bg-obsidian relative overflow-hidden">
      {/* Background effects */}
      <div className="noise-overlay" />
      <GlowOrbs />

      {/* Navigation */}
      <Nav
        isLive={isLive}
        brain={brain}
        onDeposit={() => setDepositOpen(true)}
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        chainOk={wallet.chainOk}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />

      {/* Main layout */}
      <div className="relative z-10 h-full flex flex-col pt-16 px-4 pb-0">
        {/* Pool bar */}
        <div className="max-w-7xl mx-auto w-full mb-2">
          <PoolBar pool={pool} walletAddress={wallet.address} onConnect={wallet.connect} />
        </div>

        <div className="flex-1 flex gap-4 min-h-0 max-w-7xl mx-auto w-full">
          {/* Left panel — 40% */}
          <div className="w-[40%] py-2">
            <LeftTabs
              treasury={treasury}
              activities={activities}
              pool={pool}
              settings={settings}
              walletAddress={wallet.address}
              onConnect={wallet.connect}
              onAskAgent={handleAskAgent}
            />
          </div>

          {/* Right panel — 60% — THE STAR */}
          <div className="w-[60%] py-2">
            <AgentChat
              messages={messages}
              isProcessing={isProcessing}
              hasInteracted={hasInteracted}
              onSend={handleSend}
              onClear={clearMessages}
              model={model}
              walletAddress={wallet.address}
              mySharePercent={pool.myShare}
              prefillMessage={prefillMessage}
            />
          </div>
        </div>

        <Footer />
      </div>

      {/* Deposit modal */}
      <DepositPanel isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
