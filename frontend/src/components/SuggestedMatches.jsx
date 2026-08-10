import { useEffect, useState } from "react";
import { Phone, MessageCircle, Globe, Mail, MapPin, Radar, Loader2 } from "lucide-react";
import { getMatches } from "../api";

/**
 * "Rescue Match" — shown on batches that need action (risk/urgent/expired,
 * not yet claimed). Proactively suggests the nearest registered NGOs/buyers
 * instead of making the seller wait for someone to browse the marketplace.
 *
 * Real-world data fallback: not every partner has every field publicly
 * available. This component shows whatever's actually there (WhatsApp,
 * phone, website, address, logo) instead of assuming a phone number always
 * exists - and clearly flags placeholder/example entries so nobody mistakes
 * them for a verified real partner.
 */
export default function SuggestedMatches({ batch }) {
  const [matches, setMatches] = useState(null);
  const [source, setSource] = useState(null); // "openstreetmap" | "seed_data" | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const eligible =
    batch &&
    !["fresh", "claimed", "completed", "pending"].includes(batch.status) &&
    batch.recommended_action !== "hold";

  useEffect(() => {
    if (!eligible) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMatches(batch.id)
      .then((data) => {
        if (!cancelled) {
          setMatches(data.matches || []);
          setSource(data.source || null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch?.id, eligible]);

  if (!eligible) return null;

  return (
    <div className="bg-fasttrack-light border border-fasttrack/20 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-fasttrack font-semibold text-sm">
          <Radar size={15} />
          Suggested Rescue Matches
        </div>
        {!loading && source === "openstreetmap" && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand-light px-1.5 py-0.5 rounded shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            LIVE · NEAR YOU
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted text-xs py-2">
          <Loader2 size={14} className="animate-spin" />
          Searching real NGOs/buyers near this batch's location...
        </div>
      )}

      {error && <p className="text-xs text-red-600">Couldn't load matches: {error}</p>}

      {!loading && !error && matches?.length === 0 && (
        <p className="text-xs text-muted">
          No nearby partners found for this batch's location yet.
        </p>
      )}

      {!loading && matches?.length > 0 && (
        <div className="flex flex-col gap-2">
          {source === "seed_data" && (
            <p className="text-[11px] text-muted italic">
              No live results nearby - showing the starter directory instead.
            </p>
          )}
          {matches.map((m) => (
            <PartnerCard key={m.id} partner={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function whatsappHref(partner) {
  const raw = partner.whatsapp || partner.contact;
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // assume already includes country code (India numbers stored with +91)
  return `https://wa.me/${digits}`;
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function PartnerCard({ partner }) {
  const hasImage = Boolean(partner.image_url);
  const wa = whatsappHref(partner);

  return (
    <div className="bg-panel rounded-lg px-3 py-2.5 border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Logo if we have one, otherwise a plain initials tile - no emoji */}
          {hasImage ? (
            <img
              src={partner.image_url}
              alt={partner.name}
              className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-brand-light text-brand text-xs font-bold flex items-center justify-center shrink-0">
              {initials(partner.name)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-ink text-sm font-medium truncate">{partner.name}</span>
              {partner.is_placeholder && (
                <span className="text-[10px] font-semibold text-donate bg-donate-light px-1.5 py-0.5 rounded shrink-0">
                  EXAMPLE
                </span>
              )}
              {partner.source === "openstreetmap" && (
                <span className="text-[10px] font-semibold text-muted bg-panel border border-border px-1.5 py-0.5 rounded shrink-0">
                  OpenStreetMap
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-muted text-xs mt-0.5">
              <MapPin size={11} />
              {partner.distance_km} km away
              <span className="mx-1">•</span>
              <span className="capitalize">{partner.partner_type}</span>
            </div>

            {partner.address && (
              <p className="text-muted text-xs mt-1 leading-snug">{partner.address}</p>
            )}
            {partner.notes && (
              <p className="text-muted text-xs mt-1 leading-snug italic">{partner.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Fallback action row: show whichever contact channels actually exist */}
      <div className="flex items-center gap-3 mt-2.5 pl-11.5">
        {partner.contact && (
          <a
            href={`tel:${partner.contact.replace(/\s+/g, "")}`}
            className="flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <Phone size={12} />
            Call
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <MessageCircle size={12} />
            WhatsApp
          </a>
        )}
        {partner.website && (
          <a
            href={partner.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <Globe size={12} />
            Website
          </a>
        )}
        {partner.email && (
          <a
            href={`mailto:${partner.email}`}
            className="flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <Mail size={12} />
            Email
          </a>
        )}
        {!partner.contact && !wa && !partner.website && !partner.email && (
          <span className="text-xs text-muted">No public contact info available</span>
        )}
      </div>
    </div>
  );
}
