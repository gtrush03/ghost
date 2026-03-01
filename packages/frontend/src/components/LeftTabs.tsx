import { useState } from "react";
import { LayoutDashboard, Clock, Users, Settings } from "lucide-react";
import type { TreasuryDisplay, PoolState, SettingsResponse } from "../lib/types";
import type { ActivityItem } from "../lib/types";
import { TreasuryStats } from "./TreasuryStats";
import { ActivityFeed } from "./ActivityFeed";
import { YourPosition } from "./YourPosition";
import { MemberList } from "./MemberList";
import { SettingsPanel } from "./SettingsPanel";
import { ActivityLedger } from "./ActivityLedger";

interface LeftTabsProps {
  treasury: TreasuryDisplay | null;
  activities: ActivityItem[];
  pool: PoolState;
  settings: SettingsResponse;
  walletAddress: string | null;
  onConnect: () => void;
  onAskAgent: (message: string) => void;
  onDeposit?: () => void;
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "members", label: "Members", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LeftTabs({ treasury, activities, pool, settings, walletAddress, onConnect, onAskAgent, onDeposit }: LeftTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const me = walletAddress
    ? pool.members.find((m) => m.walletAddress.toLowerCase() === walletAddress.toLowerCase())
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-gold/10 border border-gold/20 text-gold"
                  : "text-text-muted hover:text-text-secondary hover:bg-glass-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {activeTab === "overview" && (
          <>
            <TreasuryStats treasury={treasury} />
            <YourPosition
              walletAddress={walletAddress}
              sharePercent={me?.sharePercent ?? 0}
              votingPower={me?.votingPower ?? 0}
              netValueUsd={me?.netValueUsd ?? 0}
              onConnect={onConnect}
              onDeposit={onDeposit}
            />
            <ActivityFeed activities={activities} />
          </>
        )}
        {activeTab === "activity" && <ActivityLedger />}
        {activeTab === "members" && (
          <div className="glass-card p-4">
            <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              Pool Members ({pool.totalMembers})
            </h2>
            <MemberList members={pool.members} currentWallet={walletAddress} />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="glass-card p-4">
            <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              Governance Settings
            </h2>
            <SettingsPanel settings={settings} onAskAgent={onAskAgent} />
          </div>
        )}
      </div>
    </div>
  );
}
