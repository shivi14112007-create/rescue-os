import { useEffect, useState } from "react";
import { listBatches, getImpact } from "./api";

import Sidebar from "./components/Sidebar";
import StatCards from "./components/StatCards";
import StatusOverview from "./components/StatusOverview";
import RecentBatchesTable from "./components/RecentBatchesTable";
import ImpactSnapshot from "./components/ImpactSnapshot";
import TopSellers from "./components/TopSellers";
import AddBatchForm from "./components/AddBatchForm";
import MyBatches from "./components/MyBatches";
import Marketplace from "./components/Marketplace";
import BatchDetail from "./components/BatchDetail";
import LocationMap from "./components/LocationMap";
import RescueCertificate from "./components/RescueCertificate";

import LanguageToggle from "./components/LanguageToggle";
import { useLanguage } from "./i18n/LanguageContext";

import {
  Bell,
  MapPin,
  Loader2,
} from "lucide-react";

import LandingPage from "./components/LandingPage";
import LoginPage from "./components/LoginPage";

const SELLER_NAME = "Ramesh Yadav";

export default function App() {
  const { t } = useLanguage();

  // =========================
  // APP STATES
  // =========================

  const [showLanding, setShowLanding] =
    useState(true);

  const [showLogin, setShowLogin] =
    useState(false);

  const [user, setUser] = useState(null);

  const [page, setPage] =
    useState("dashboard");

  const [batches, setBatches] =
    useState([]);

  const [impact, setImpact] =
    useState(null);

  const [selectedBatch, setSelectedBatch] =
    useState(null);

  const [certificateBatch, setCertificateBatch] =
    useState(null);

  const [connectionError, setConnectionError] =
    useState(false);

  const [currentLocation, setCurrentLocation] =
    useState("Detecting location...");

  // =========================
  // BACKEND DATA
  // =========================

  async function refresh() {
    try {
      const [
        batchList,
        impactData,
      ] = await Promise.all([
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

  // =========================
  // CURRENT LOCATION
  // =========================

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentLocation(
        "Location unavailable"
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const {
          latitude,
          longitude,
        } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );

          if (!response.ok) {
            throw new Error(
              "Location lookup failed"
            );
          }

          const data =
            await response.json();

          const address =
            data.address || {};

          const location =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.county ||
            "Current Location";

          const state =
            address.state || "";

          setCurrentLocation(
            state
              ? `${location}, ${state}`
              : location
          );
        } catch {
          setCurrentLocation(
            `${latitude.toFixed(
              4
            )}, ${longitude.toFixed(4)}`
          );
        }
      },
      () => {
        setCurrentLocation(
          "Location permission denied"
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);

  // =========================
  // GET STARTED
  // =========================

  function handleGetStarted() {
    setShowLanding(false);
    setShowLogin(true);
  }

  // =========================
  // LOGIN SUCCESS
  // =========================

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);

    setShowLogin(false);
    setShowLanding(false);
    setPage("dashboard");
  }

  // =========================
  // BATCH CREATED
  // =========================

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

  // =========================
  // CLAIM / RESCUE
  // =========================

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

    // Show rescue certificate
    setCertificateBatch(
      updatedBatch
    );
  }

  // =========================
  // LANDING PAGE
  // =========================

  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={
          handleGetStarted
        }
      />
    );
  }

  // =========================
  // LOGIN PAGE
  // =========================

  if (showLogin) {
    return (
      <LoginPage
        onBack={() => {
          setShowLogin(false);
          setShowLanding(true);
        }}
        onLogin={handleLogin}
      />
    );
  }

  // =========================
  // MAIN DASHBOARD
  // =========================

  return (
    <div className="min-h-screen flex bg-canvas text-ink">

      {/* =========================
          SIDEBAR
      ========================= */}

      <Sidebar
        active={page}
        onNavigate={setPage}
        sellerName={
          user?.displayName ||
          SELLER_NAME
        }
      />

      {/* =========================
          MAIN
      ========================= */}

      <main className="flex-1 min-w-0">

        {/* =========================
            HEADER
        ========================= */}

        <header className="bg-panel border-b border-border px-8 py-4 flex items-center justify-between">

          {/* HEADER LEFT */}

          <div>
            <h1 className="text-lg font-bold text-ink">

              {page === "dashboard" &&
                t(
                  "header.greeting",
                  {
                    name:
                      user?.displayName?.split(
                        " "
                      )[0] ||
                      SELLER_NAME.split(
                        " "
                      )[0],
                  }
                )}

              {page === "add" &&
                t(
                  "header.addTitle"
                )}

              {page === "batches" &&
                t(
                  "header.batchesTitle"
                )}

              {page === "marketplace" &&
                t(
                  "header.marketplaceTitle"
                )}

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

            {/* CURRENT LOCATION */}

            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted border border-border rounded-full px-3 py-1.5">

              {currentLocation ===
              "Detecting location..." ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <MapPin size={14} />
              )}

              <span>
                {currentLocation}
              </span>

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

        {/* =========================
            CONTENT
        ========================= */}

        <div className="p-8">

          {/* CONNECTION ERROR */}

          {connectionError && (
            <div className="bg-donate-light border border-donate/30 text-donate rounded-lg px-4 py-3 mb-6 text-sm">

              {t(
                "connection.error",
                {
                  url: "127.0.0.1:8000",
                  command:
                    "uvicorn app.main:app --reload",
                }
              )}

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

                <TopSellers
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
              sellerName={
                user?.displayName ||
                SELLER_NAME
              }
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
              onSelect={
                setSelectedBatch
              }
            />
          )}

          {/* =========================
              MARKETPLACE
          ========================= */}

          {page === "marketplace" && (
            <Marketplace
              batches={batches}
              onClaim={
                handleClaim
              }
              onSelect={
                setSelectedBatch
              }
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

      {/* =========================
          RESCUE CERTIFICATE
      ========================= */}

      <RescueCertificate
        batch={certificateBatch}
        sellerName={
          user?.displayName ||
          SELLER_NAME
        }
        onClose={() =>
          setCertificateBatch(null)
        }
      />

    </div>
  );
}