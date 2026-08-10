import { useEffect, useState } from "react";
import { listBatches, getImpact } from "./api";

import Sidebar from "./components/Sidebar";
import StatCards from "./components/StatCards";
import StatusOverview from "./components/StatusOverview";
import RecentBatchesTable from "./components/RecentBatchesTable";
import ImpactSnapshot from "./components/ImpactSnapshot";
import AddBatchForm from "./components/AddBatchForm";
import MyBatches from "./components/MyBatches";
import Marketplace from "./components/Marketplace";
import BatchDetail from "./components/BatchDetail";
import LocationMap from "./components/LocationMap";

import LanguageToggle from "./components/LanguageToggle";
import { useLanguage } from "./i18n/LanguageContext";

import { Bell, MapPin } from "lucide-react";

import LandingPage from "./components/LandingPage";

const SELLER_NAME = "Ramesh Yadav";

export default function App() {
  const { t } = useLanguage();

  const [showLanding, setShowLanding] = useState(true);
  const [page, setPage] = useState("dashboard");

  const [batches, setBatches] = useState([]);
  const [impact, setImpact] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [connectionError, setConnectionError] =
    useState(false);

  async function refresh() {
    try {
      const [batchList, impactData] =
        await Promise.all([
          listBatches(),
          getImpact(),
        ]);

      setBatches(batchList);
      setImpact(impactData);
      setConnectionError(false);
    } catch {
      setConnectionError(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleGetStarted() {
    setShowLanding(false);
    setPage("dashboard");
  }

  function handleBatchCreated(newBatch) {
    setBatches((prev) => [
      newBatch,
      ...prev,
    ]);

    getImpact()
      .then(setImpact)
      .catch(() => {});

    setPage("dashboard");
  }

  function handleClaim(updatedBatch) {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === updatedBatch.id
          ? updatedBatch
          : b
      )
    );

    getImpact()
      .then(setImpact)
      .catch(() => {});
  }

  // =========================
  // LANDING PAGE
  // =========================

  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={handleGetStarted}
      />
    );
  }

  // =========================
  // DASHBOARD APP
  // =========================

  return (
    <div className="min-h-screen flex bg-canvas text-ink">

      {/* SIDEBAR */}

      <Sidebar
        active={page}
        onNavigate={setPage}
        sellerName={SELLER_NAME}
      />

      {/* MAIN */}

      <main className="flex-1 min-w-0">

        {/* HEADER */}

        <header className="bg-panel border-b border-border px-8 py-4 flex items-center justify-between">

          <div>
            <h1 className="text-lg font-bold text-ink">

              {page === "dashboard" &&
                t("header.greeting", {
                  name:
                    SELLER_NAME.split(" ")[0],
                })}

              {page === "add" &&
                t("header.addTitle")}

              {page === "batches" &&
                t("header.batchesTitle")}

              {page === "marketplace" &&
                t("header.marketplaceTitle")}

            </h1>

            {page === "dashboard" && (
              <p className="text-muted text-sm">
                {t(
                  "header.dashboardSubtitle"
                )}
              </p>
            )}
          </div>

          {/* HEADER RIGHT */}

          <div className="flex items-center gap-3">

            {/* LOCATION */}

            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted border border-border rounded-full px-3 py-1.5">

              <MapPin size={14} />

              Azadpur Mandi, Delhi

            </div>

            {/* LANGUAGE */}

            <LanguageToggle />

            {/* NOTIFICATION */}

            <button
              type="button"
              className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-muted relative hover:text-ink transition-colors"
            >
              <Bell size={16} />
            </button>

          </div>
        </header>

        {/* CONTENT */}

        <div className="p-8">

          {/* CONNECTION ERROR */}

          {connectionError && (
            <div className="bg-donate-light border border-donate/30 text-donate rounded-lg px-4 py-3 mb-6 text-sm">

              {t("connection.error", {
                url: "127.0.0.1:8000",
                command:
                  "uvicorn app.main:app --reload",
              })}

            </div>
          )}

          {/* =========================
              DASHBOARD
          ========================= */}

          {page === "dashboard" && (
            <>
              <StatCards
                batches={batches}
                impact={impact}
              />

              <StatusOverview
                batches={batches}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

                <RecentBatchesTable
                  batches={batches}
                  onSelect={
                    setSelectedBatch
                  }
                />

                <ImpactSnapshot
                  batches={batches}
                />

              </div>

              <LocationMap />
            </>
          )}

          {/* =========================
              ADD BATCH
          ========================= */}

          {page === "add" && (
            <AddBatchForm
              sellerName={SELLER_NAME}
              onBatchCreated={
                handleBatchCreated
              }
            />
          )}

          {/* =========================
              MY BATCHES
          ========================= */}

          {page === "batches" && (
            <MyBatches
              batches={batches}
              onSelect={setSelectedBatch}
            />
          )}

          {/* =========================
              MARKETPLACE
          ========================= */}

          {page === "marketplace" && (
            <Marketplace
              batches={batches}
              onClaim={handleClaim}
              onSelect={setSelectedBatch}
            />
          )}

        </div>
      </main>

      {/* =========================
          BATCH DETAIL
      ========================= */}

      <BatchDetail
        batch={selectedBatch}
        onClose={() =>
          setSelectedBatch(null)
        }
      />

    </div>
  );
}
