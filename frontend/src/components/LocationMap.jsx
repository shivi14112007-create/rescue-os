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

function ChangeMapView({ position }) {
  const map = useMap();

  map.setView(position, 15);

  return null;
}

function LocationMap() {
  const [position, setPosition] = useState([28.7041, 77.1025]);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [bestOption, setBestOption] = useState(null);

  const rescuePartners = [
    {
      id: 1,
      name: "Fresh Foods Processing",
      type: "buyer",
      lat: 28.714763,
      lng: 77.110345,
      offer: "₹18/kg",
      capacity: "500 kg"
    },
    {
      id: 2,
      name: "Local Retailer",
      type: "buyer",
      lat: 28.6955,
      lng: 77.115,
      offer: "₹20/kg",
      capacity: "100 kg"
    },
    {
      id: 3,
      name: "Food Rescue NGO",
      type: "ngo",
      lat: 28.725,
      lng: 77.09,
      offer: "Donation",
      capacity: "300 kg"
    }
  ];

  async function getRoutes(start) {
    try {
      const results = await Promise.all(
        rescuePartners.map(async (partner) => {
          const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${start[1]},${start[0]};${partner.lng},${partner.lat}` +
            `?overview=full&geometries=geojson`;

          const response = await fetch(url);
          const data = await response.json();

          if (data.code !== "Ok") {
            return null;
          }

          const routeCoordinates =
            data.routes[0].geometry.coordinates;

          const leafletCoordinates = routeCoordinates.map(
            ([lng, lat]) => [lat, lng]
          );

          return {
            ...partner,
            distance: (data.routes[0].distance / 1000).toFixed(2),
            duration: Math.round(
              data.routes[0].duration / 60
            ),
            coordinates: leafletCoordinates
          };
        })
      );

      const validRoutes = results.filter(Boolean);

      setRoutes(validRoutes);

      if (validRoutes.length > 0) {
        const buyers = validRoutes.filter(
          (item) => item.type === "buyer"
        );

        const best =
          buyers.length > 0
            ? buyers.sort(
                (a, b) =>
                  parseFloat(a.distance) -
                  parseFloat(b.distance)
              )[0]
            : validRoutes[0];

        setBestOption(best);
      }
    } catch (error) {
      console.log("Route error:", error);
    }
  }

  function getLocation() {
    if (!navigator.geolocation) {
      alert(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (location) => {
        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        const newPosition = [lat, lng];

        setPosition(newPosition);

        getRoutes(newPosition);

        setLoading(false);
      },
      (error) => {
        console.log(error);

        alert(
          "Location access denied. Please allow location permission."
        );

        setLoading(false);
      }
    );
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Your Location
          </h2>

          <p className="text-sm text-muted">
            Find nearby buyers and NGOs for faster
            produce rescue.
          </p>
        </div>

        <button
          onClick={getLocation}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80"
        >
          📍{" "}
          {loading
            ? "Getting location..."
            : "Use My Location"}
        </button>
      </div>

      {/* Map */}
      <MapContainer
        center={position}
        zoom={13}
        style={{
          height: "400px",
          width: "100%",
          borderRadius: "12px"
        }}
      >
        <ChangeMapView position={position} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Seller Location */}
        <Marker position={position}>
          <Popup>
            <strong>📍 Your Location</strong>
            <br />
            Seller / Produce Batch
          </Popup>
        </Marker>

        {/* Buyers and NGOs */}
        {rescuePartners.map((partner) => (
          <Marker
            key={partner.id}
            position={[
              partner.lat,
              partner.lng
            ]}
          >
            <Popup>
              <strong>
                {partner.type === "ngo"
                  ? "🤝"
                  : "🏭"}{" "}
                {partner.name}
              </strong>

              <br />

              {partner.type === "ngo"
                ? "Donation"
                : `Offer: ${partner.offer}`}

              <br />

              Capacity: {partner.capacity}
            </Popup>
          </Marker>
        ))}

        {/* Routes */}
        {routes.map((item) => (
          <Polyline
            key={item.id}
            positions={item.coordinates}
          />
        ))}
      </MapContainer>

      {/* Route Cards */}
      {routes.length > 0 && (
        <div className="mt-4">

          <h3 className="text-base font-bold text-ink mb-3">
            Nearby Rescue Options
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {routes.map((item) => (
              <div
                key={item.id}
                className="bg-canvas border border-border rounded-lg p-4"
              >
                <div className="font-semibold text-ink">
                  {item.type === "ngo"
                    ? "🤝"
                    : "🏭"}{" "}
                  {item.name}
                </div>

                <div className="text-sm text-muted mt-2">
                  📏 {item.distance} km
                </div>

                <div className="text-sm text-muted">
                  ⏱️ {item.duration} min
                </div>

                <div className="text-sm text-muted mt-1">
                  {item.offer}
                </div>

                <div className="text-sm text-muted">
                  📦 Capacity: {item.capacity}
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      {/* Best Option */}
      {bestOption && (
        <div className="mt-5 bg-canvas border border-border rounded-xl p-5">

          <div className="text-sm text-muted">
            AI Rescue Recommendation
          </div>

          <div className="text-xl font-bold text-ink mt-1">
            🏆 {bestOption.name}
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted">
            <span>
              📏 {bestOption.distance} km
            </span>

            <span>
              ⏱️ {bestOption.duration} min
            </span>

            <span>
              💰 {bestOption.offer}
            </span>

            <span>
              📦 {bestOption.capacity}
            </span>
          </div>

          <p className="text-sm text-muted mt-3">
            Recommended because this is the closest
            suitable buyer with available capacity.
          </p>

          <button
            className="mt-4 bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-80"
            onClick={() =>
              alert(
                `Rescue deal created with ${bestOption.name}`
              )
            }
          >
            Create Rescue Deal
          </button>

        </div>
      )}

      {/* Coordinates */}
      <div className="mt-3 text-sm text-muted">
        Latitude: {position[0].toFixed(6)}
        <br />
        Longitude: {position[1].toFixed(6)}
      </div>

    </div>
  );
}

export default LocationMap;