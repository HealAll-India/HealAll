"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Leaflet's default-marker images are stripped by Next/Webpack bundling.
// We point at locally-hosted copies so the marker still renders when CSP,
// adblock, or network policies block third-party CDNs.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

interface InnerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
  readOnly?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  recenterToken?: number;
}

const INDIA_CENTER: [number, number] = [22.5937, 78.9629];

function ClickHandler({ onPick, readOnly }: { onPick: (lat: number, lng: number) => void; readOnly?: boolean }) {
  useMapEvents({
    click(e) {
      if (readOnly) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recentre({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
    }
  }, [lat, lng, map]);
  return null;
}

function RecentreToUser({
  user,
  token,
}: {
  user?: { lat: number; lng: number } | null;
  token?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (token && user) {
      map.flyTo([user.lat, user.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    }
  }, [token, user, map]);
  return null;
}

export default function MapPickerInner({
  latitude,
  longitude,
  onPick,
  readOnly,
  userLocation,
  recenterToken,
}: InnerProps) {
  const hasPin = latitude !== null && longitude !== null;
  const center: [number, number] = hasPin
    ? [latitude!, longitude!]
    : userLocation
    ? [userLocation.lat, userLocation.lng]
    : INDIA_CENTER;
  const zoom = hasPin || userLocation ? 13 : 5;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="map-picker-inner-root"
      scrollWheelZoom={!readOnly}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} readOnly={readOnly} />
      <Recentre lat={latitude} lng={longitude} />
      <RecentreToUser user={userLocation} token={recenterToken} />
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }}
        />
      )}
      {hasPin && <Marker position={[latitude!, longitude!]} />}
    </MapContainer>
  );
}
