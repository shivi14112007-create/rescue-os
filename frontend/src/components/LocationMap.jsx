import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getNearbyPartners } from "../api";

function ChangeMapView({ position }) {
  const map = useMap();

  map.setView(position, 14);

  return null;
}

function LocationMap() {
  const [position, setPosition] = useState([
    28.7041,
    77.1025
  ]);

  const [loading, setLoading] = useState(false);
  const [rescuePartners, setRescuePartners] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [bestOption, setBestOption] = useState(null);
  const [error, setError] = useState("");

  async function findNearbyPlaces(lat, lng) {
    // Previously this called overpass-api.de directly from the browser -
    // a single public mirror, no retry, no fallback. That's what made it
    // flaky on the deployed site (rate-limited/blocked depending on the
    // visitor's own network path) while "working" locally whenever that
    // one mirror happened to respond. Now it goes through our own backend
    // (/partners/nearby), which already has multi-mirror + widening-radius
    // + caching + fail-soft logic (same code the "Suggested Rescue
    // Matches" panel uses).
    try {
      const data = await getNearbyPartners(lat, lng, 8);

      const places = (data.matches || [])
        .filter(
          (p) =>
            p.latitude !== undefined &&
            p.latitude !== null &&
            p.longitude !== undefined &&
            p.longitude !== null
        )
        .map((p) => ({
          id: p.id,
          name: p.name || "Nearby Food Location",
          type: p.partner_type === "ngo" ? "ngo" : "buyer",
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          category: p.partner_type === "ngo" ? "food_bank" : "market"
        }));

      const withDistance = places.map((place) => ({
        ...place,
        roughDistance: calculateDistance(
          lat,
          lng,
          place.lat,
          place.lng
        )
      }));

      withDistance.sort(
        (a, b) => a.roughDistance - b.roughDistance
      );

      return withDistance.slice(0, 5);
    } catch (err) {
      console.log(
        "Nearby places error:",
        err
      );

      throw err;
    }
  }

  function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
  ) {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
        ) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  }

  async function getRoutes(
    start,
    partners
  ) {
    try {
      const results =
        await Promise.all(
          partners.map(
            async (partner) => {
              try {
                const url =
                  `https://router.project-osrm.org/route/v1/driving/` +
                  `${start[1]},${start[0]};` +
                  `${partner.lng},${partner.lat}` +
                  `?overview=full&geometries=geojson`;

                const response =
                  await fetch(url);

                const data =
                  await response.json();

                if (
                  data.code !== "Ok" ||
                  !data.routes?.length
                ) {
                  return null;
                }

                const route =
                  data.routes[0];

                const coordinates =
                  route.geometry.coordinates.map(
                    ([lng, lat]) => [
                      lat,
                      lng
                    ]
                  );

                return {
                  ...partner,

                  distance: (
                    route.distance / 1000
                  ).toFixed(2),

                  duration: Math.max(
                    1,
                    Math.round(
                      route.duration / 60
                    )
                  ),

                  coordinates
                };
              } catch (err) {
                console.log(
                  "Route error:",
                  err
                );

                return null;
              }
            }
          )
        );

      const validRoutes =
        results.filter(Boolean);

      setRoutes(validRoutes);

      const buyers =
        validRoutes.filter(
          (item) =>
            item.type === "buyer"
        );

      const candidates =
        buyers.length > 0
          ? buyers
          : validRoutes;

      if (candidates.length > 0) {
        const best =
          [...candidates].sort(
            (a, b) =>
              parseFloat(
                a.distance
              ) -
              parseFloat(
                b.distance
              )
          )[0];

        setBestOption(best);
      } else {
        setBestOption(null);
      }
    } catch (err) {
      console.log(
        "OSRM error:",
        err
      );

      setRoutes([]);
      setBestOption(null);
    }
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by your browser."
      );

      return;
    }

    setLoading(true);
    setError("");
    setRoutes([]);
    setBestOption(null);
    setRescuePartners([]);

    navigator.geolocation.getCurrentPosition(
      async (location) => {
        try {
          const lat =
            location.coords.latitude;

          const lng =
            location.coords.longitude;

          const newPosition = [
            lat,
            lng
          ];

          setPosition(
            newPosition
          );

          const places =
            await findNearbyPlaces(
              lat,
              lng
            );

          if (!places.length) {
            setError(
              "No nearby food-related places were found in OpenStreetMap."
            );

            setLoading(false);

            return;
          }

          setRescuePartners(
            places
          );

          await getRoutes(
            newPosition,
            places
          );
        } catch (err) {
          console.log(err);

          setError(
            "Could not find nearby rescue options. Please try again."
          );
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.log(error);

        setError(
          "Location access denied. Please allow location permission."
        );

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-5">

      <div className="flex items-center justify-between mb-4 gap-4">

        <div>
          <h2 className="text-lg font-bold text-ink">
            Nearby Rescue Partners
          </h2>

          <p className="text-sm text-muted">
            Find real nearby markets,
            buyers and food rescue
            organizations.
          </p>
        </div>

        <button
          onClick={getLocation}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50"
        >
          {loading
            ? "Finding nearby places..."
            : "Use My Location"}
        </button>

      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <MapContainer
        center={position}
        zoom={13}
        style={{
          height: "400px",
          width: "100%",
          borderRadius: "12px"
        }}
      >

        <ChangeMapView
          position={position}
        />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={position}>
          <Popup>
            <strong>
              Your Location
            </strong>

            <br />

            Seller / Produce Batch
          </Popup>
        </Marker>

        {rescuePartners.map(
          (partner) => (
            <Marker
              key={partner.id}
              position={[
                partner.lat,
                partner.lng
              ]}
            >
              <Popup>

                <strong>
                  {partner.name}
                </strong>

                <br />

                {partner.type === "ngo"
                  ? "Food Rescue / Food Bank"
                  : "Potential Produce Buyer"}

                <br />

                Category:{" "}
                {partner.category}

              </Popup>
            </Marker>
          )
        )}

        {routes.map(
          (item) => (
            <Polyline
              key={item.id}
              positions={
                item.coordinates
              }
            />
          )
        )}

      </MapContainer>

      {routes.length > 0 && (
        <div className="mt-5">

          <h3 className="text-base font-bold text-ink mb-3">
            Nearby Rescue Options
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

            {routes.map(
              (item) => (
                <div
                  key={item.id}
                  className="bg-canvas border border-border rounded-lg p-4"
                >

                  <div className="font-semibold text-ink">
                    {item.name}
                  </div>

                  <div className="text-sm text-muted mt-2">
                    Distance:{" "}
                    {item.distance} km
                  </div>

                  <div className="text-sm text-muted">
                    Estimated time:{" "}
                    {item.duration} min
                  </div>

                  <div className="text-sm text-muted mt-1">
                    {item.type === "ngo"
                      ? "Food Rescue / Donation"
                      : "Potential Buyer"}
                  </div>

                </div>
              )
            )}

          </div>

        </div>
      )}

      {bestOption && (
        <div className="mt-5 bg-canvas border border-border rounded-xl p-5">

          <div className="text-sm text-muted">
            Rescue Recommendation
          </div>

          <div className="text-xl font-bold text-ink mt-1">
            {bestOption.name}
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted">

            <span>
              {bestOption.distance} km
            </span>

            <span>
              {bestOption.duration} min
            </span>

            <span>
              Potential Buyer
            </span>

          </div>

          <p className="text-sm text-muted mt-3">
            This location is currently the
            closest suitable buyer found
            near your current location.
          </p>

        </div>
      )}

      <div className="mt-3 text-sm text-muted">
        Latitude:{" "}
        {position[0].toFixed(6)}

        <br />

        Longitude:{" "}
        {position[1].toFixed(6)}
      </div>

      <div className="mt-3 text-xs text-muted">
        Map data © OpenStreetMap
        contributors. Nearby places
        provided by OpenStreetMap
        Overpass.
      </div>

    </div>
  );
}

export default LocationMap;