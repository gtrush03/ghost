import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  network: "monad-testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://testnet.monadscan.com" },
  },
  testnet: true,
};

const root = createRoot(document.getElementById("root")!);

if (PRIVY_APP_ID) {
  // Dynamic import — only load Privy when app ID is configured
  import("@privy-io/react-auth").then(({ PrivyProvider }) => {
    root.render(
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ["wallet", "google", "email"],
          appearance: {
            theme: "dark",
            accentColor: "#928466",
          },
          defaultChain: monadTestnet as any,
          supportedChains: [monadTestnet as any],
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
        }}
      >
        <App />
      </PrivyProvider>
    );
  });
} else {
  root.render(<App />);
}
