import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
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

  function getLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (location) => {
        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        setPosition([lat, lng]);
        setLoading(false);
      },
      (error) => {
        console.log(error);
        alert("Location access denied. Please allow location permission.");
        setLoading(false);
      }
    );
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-5">

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Your Location
          </h2>

          <p className="text-sm text-muted">
            Use your location to find nearby rescue options.
          </p>
        </div>

        <button
          onClick={getLocation}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80"
        >
          📍 {loading ? "Getting location..." : "Use My Location"}
        </button>
      </div>

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

        <Marker position={position}>
          <Popup>
            📍 Your current location
          </Popup>
        </Marker>
      </MapContainer>

      <div className="mt-3 text-sm text-muted">
        Latitude: {position[0].toFixed(6)}
        <br />
        Longitude: {position[1].toFixed(6)}
      </div>

    </div>
  );
}

export default LocationMap;