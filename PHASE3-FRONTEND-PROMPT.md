# PHASE 3: Ghost Treasury Frontend — Startup Prompt

## YOUR TASK

Build the Ghost Treasury frontend dashboard. This is the demo screen for a hackathon (Unlink x Monad, NYC, judging in hours). The frontend needs to be **investor-grade, polished, and fully working** — not a prototype.

## WORKING DIRECTORY

```
/Users/gtrush/Downloads/ghost-treasury/packages/frontend
```

Create this package from scratch. The backend is already running and tested (14/14 tests pass).

## FILES TO READ FIRST

Read these skills before writing ANY code:

1. `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/g-tru-design-system.md` — **Exact design tokens** (colors, fonts, glass effects, animations). Use these EXACTLY.
2. `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/ghost-frontend-spec.md` — **Component spec** (layout, screens, UX details)
3. `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/unlink-react-sdk.md` — **Unlink React SDK** (UnlinkProvider, useDeposit, useUnlinkBalances, etc.)
4. `/Users/gtrush/Downloads/ghost-treasury/CLAUDE.md` — Full project spec (architecture, demo flow, judge profiles, pitch script)
5. `/Users/gtrush/Downloads/ghost-treasury/GHOST-EXPLAINED.md` — What the project is + current status
6. `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/routes/agent.ts` — Backend API shape
7. `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/services/demo.ts` — Demo responses (to understand what the API returns)
8. `/Users/gtrush/Downloads/ghost-treasury/packages/shared/src/types.ts` — TypeScript interfaces

Also reference these design projects for visual patterns (DO NOT modify them):
- `/Users/gtrush/Downloads/portfolio/src/index.css` — Global styles, animations, glow orbs, glass effects
- `/Users/gtrush/Downloads/portfolio/src/components/` — Nav, Hero, glass card patterns
- `/Users/gtrush/Downloads/tru proof landing/src/index.css` — Glass panels, liquid borders, section fades
- `/Users/gtrush/Downloads/tru-synth cc version/src/design-system/tokens.ts` — Full token system

## TECH STACK

```
React 19
Vite (latest)
TypeScript
Tailwind CSS 4 (@tailwindcss/vite plugin)
Framer Motion
Lucide React (icons)
@unlink-xyz/react@canary (privacy wallet SDK)
```

## BACKEND (ALREADY RUNNING)

The backend runs on these ports. Do NOT modify backend code.

```
Trading agent:   http://localhost:3002
Treasury agent:  http://localhost:3003
```

### API Endpoints

```
POST http://localhost:3003/api/agent/chat
  Body: { "message": "What's our position?" }
  Returns: { "response": "...", "toolCalls": [...], "events": [...] }

GET  http://localhost:3003/api/agent/history
  Returns: { "messages": [{ role, content, timestamp, toolCalls? }] }

POST http://localhost:3003/api/agent/clear
  Returns: { "cleared": true }

GET  http://localhost:3003/api/treasury/state
  Returns: { "balances": {...}, "privacyStatus": "shielded", "lastUpdated": "..." }

GET  http://localhost:3003/health
  Returns: { "agent": "treasury", "status": "ready", "brain": "openrouter", "model": "anthropic/claude-sonnet-4-6" }

GET  http://localhost:3002/price/eth
  Returns: { "asset": "ETH", "price": 3847.50, "timestamp": "...", "source": "x402-ghost" }
```

### Response Shape for Chat

The `events` array in the chat response contains these event types:
```typescript
type AgentEvent = {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  text?: string;       // for "text" events
  name?: string;       // for "tool_call" and "tool_result"
  input?: Record<string, unknown>;  // for "tool_call"
  result?: unknown;    // for "tool_result"
  error?: string;      // for "error"
};
```

## DESIGN SYSTEM — OBSIDIAN & GOLD

Use these EXACT values (from the user's portfolio, TrueProof, TrueSynth):

### Colors
```
Background:      #050505
Gold:            #928466
Gold Light:      #E8E0CC
Gold Dark:       #6d6350
Text Primary:    #F8FAFC
Text Secondary:  #94A3B8
Text Muted:      #475569
Glass BG:        rgba(18, 18, 20, 0.65)
Glass Border:    rgba(255, 255, 255, 0.06)
Glass Hover:     rgba(255, 255, 255, 0.12)
Success:         #10b981
Error:           #ef4444
```

### Glass Card Pattern
```tsx
className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-[24px]"
```

### Primary Button
```tsx
className="bg-gradient-to-b from-[#c4b896] via-[#928466] to-[#6d6350] text-white border border-[#928466]/20 shadow-[0_2px_10px_-2px_rgba(146,132,102,0.5)] hover:shadow-[0_4px_20px_-4px_rgba(146,132,102,0.6)] hover:brightness-110 active:scale-[0.98] rounded-xl"
```

### Fonts
```
Sans: Inter (light/regular/semibold)
Mono: JetBrains Mono (for addresses, data, badges)
```

### Background Effects
- Floating glow orbs: `radial-gradient(circle, rgba(146,132,102,0.12), transparent 70%)` with `filter: blur(80px)` and `animation: float 20s ease-in-out infinite`
- Noise overlay: `opacity: 0.015`, fixed, pointer-events-none
- Gold gradient text: `linear-gradient(135deg, #6d6350, #928466, #d4c49a, #f5e6b8, #faf0d0, ...)` with shimmer animation

## LAYOUT

Two-panel dashboard. Chat is the hero.

```
┌────────────────────────────────────────────────────────┐
│  Nav (floating, rounded-full, blur backdrop)            │
├─────────────────────┬──────────────────────────────────┤
│  LEFT (40%)         │  RIGHT (60%)                      │
│                     │                                    │
│  TreasuryStats      │  AgentChat                        │
│  - Total value      │  - Message history                │
│  - Allocation bars  │  - Tool call steps (animated)     │
│  - Privacy badge    │  - Streaming responses            │
│  - Agent status     │  - Suggested prompt chips         │
│                     │  - Input field + send button      │
│  ActivityFeed       │                                    │
│  - Action log       │                                    │
│  - Privacy badges   │                                    │
│  - Timestamps       │                                    │
├─────────────────────┴──────────────────────────────────┤
│  Footer: Powered by Unlink + Monad + x402 + Claude     │
└────────────────────────────────────────────────────────┘
```

## COMPONENTS TO BUILD

### 1. App.tsx — Shell
- Full-viewport dark background (#050505)
- Glow orbs (2-3 floating background elements)
- Noise overlay
- Nav + main content + footer

### 2. Nav.tsx — Floating Navigation
- Fixed top, rounded-full, backdrop-blur
- Logo: ghost icon + "Ghost Treasury" text
- Links: Dashboard, Chat (active), Deposit
- Right side: Live/Demo status dot + brain badge ("Claude Sonnet 4.6" in mono)

### 3. AgentChat.tsx — THE MAIN DEMO SCREEN
- Full height of right panel
- Glass card container
- Message list (scrollable, auto-scroll to bottom)
  - User messages: right-aligned, subtle gold border
  - Agent messages: left-aligned, glass card style
  - Tool calls: inline expandable steps with status icons
    - Pending: spinner + amber text
    - Complete: checkmark + green text + timing (e.g. "240ms")
  - Markdown rendering in agent responses (bold, lists, code blocks)
- Suggested prompts (shown when chat is empty):
  1. "What's our position?"
  2. "Rebalance to 60/40 ETH/USDC"
  3. "Show me on the block explorer"
  4. "Swap 100% to memecoin"
  5. "Who can see our strategy?"
- Input area: glass card with text input + gold send button
- "Ghost is thinking..." indicator while waiting for response

### 4. TreasuryStats.tsx — Left Panel Top
- Total value: large text with gold gradient ($52,340)
- 24h change: green/red percentage
- Allocation bars:
  - USDC: blue-ish bar, percentage label
  - ETH: purple-ish bar, percentage label
  - MON: gold bar, percentage label
- Privacy status: "FULLY SHIELDED" badge with lock icon
- Agent status: 3 dots (Research/Trading/Treasury) with names

### 5. ActivityFeed.tsx — Left Panel Bottom
- Scrollable log, newest at top
- Each entry: `timestamp | description | privacy badge`
- Privacy badges:
  - PRIVATE: green dot + "PRIVATE"
  - PUBLIC: amber dot + "PUBLIC"
  - BURNER: gray dot + "BURNER"
- Populated from chat events (tool_call, tool_result)
- Initial demo entries for visual richness

### 6. DepositPanel.tsx — Modal (Nice to Have)
- Triggered from nav "Deposit" button
- Modal overlay with glass card
- Uses @unlink-xyz/react SDK
- Connect wallet → select token → enter amount → deposit
- Can be stubbed initially — the chat demo is the priority

## CRITICAL UX REQUIREMENTS

1. **Chat input auto-focuses on load** — judge sits down, starts typing immediately
2. **Suggested prompts are clickable** — one click sends the message
3. **Tool calls are VISUAL** — not just text, show animated steps
4. **Treasury stats update after trades** — poll /api/treasury/state after each chat
5. **No loading spinners on first load** — show skeleton or static data immediately
6. **No broken states** — every edge case handled gracefully
7. **Responsive** — works on projector/big screen (demo), but desktop-first

## PACKAGE.JSON

```json
{
  "name": "@ghost/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.460.0",
    "@unlink-xyz/react": "canary"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vite": "^6.0.0"
  }
}
```

## VITE CONFIG

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3003",
      "/health": "http://localhost:3003",
      "/price": "http://localhost:3002",
    },
  },
});
```

## WHAT SUCCESS LOOKS LIKE

When you're done, I should be able to:

1. `cd packages/frontend && npm install && npm run dev`
2. Open http://localhost:5173
3. See the dashboard with treasury stats + activity feed + agent chat
4. Click "What's our position?" → see tool calls animate → see response stream in
5. Click "Rebalance to 60/40 ETH/USDC" → see price fetch + swap execution
6. Click "Swap 100% to memecoin" → see rejection with constraint explanation
7. All of it looks premium — obsidian background, gold accents, glass cards, smooth animations
8. A judge looks at this and thinks "this is a real product"

## DO NOT

- Do NOT modify any backend code
- Do NOT create a new backend server
- Do NOT use Create React App (use Vite)
- Do NOT use Material UI, Chakra, or any component library — hand-crafted Tailwind only
- Do NOT use light theme or any color outside the design system
- Do NOT add unnecessary dependencies
- Do NOT make the DepositPanel block shipping — stub it if needed, AgentChat is the priority
