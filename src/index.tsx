import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "./scss/theme-dark.scss";
import App from "./App";
import { ClusterProvider } from "./providers/cluster";
import { RichListProvider } from "./providers/richList";
import { SupplyProvider } from "./providers/supply";
import { TransactionsProvider } from "./providers/transactions";
import { AccountsProvider } from "./providers/accounts";
import { BlockProvider } from "./providers/block";
import { EpochProvider } from "./providers/epoch";
import { ScrollAnchorProvider } from "providers/scroll-anchor";
import { StatsProvider } from "providers/stats";
import { MintsProvider } from "providers/mints";

if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: "https://1461315772b645a58897178afb40f6eb@o4504830569938944.ingest.sentry.io/4504830571642880",
  });
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <Router>
    <ScrollAnchorProvider>
      <ClusterProvider>
        <StatsProvider>
          <SupplyProvider>
            <RichListProvider>
              <AccountsProvider>
                <BlockProvider>
                  <EpochProvider>
                    <MintsProvider>
                      <TransactionsProvider>
                        <App />
                      </TransactionsProvider>
                    </MintsProvider>
                  </EpochProvider>
                </BlockProvider>
              </AccountsProvider>
            </RichListProvider>
          </SupplyProvider>
        </StatsProvider>
      </ClusterProvider>
    </ScrollAnchorProvider>
  </Router>
);
