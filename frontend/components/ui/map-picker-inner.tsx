"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Vite/Next bundlers strip Leaflet's default marker images; point at the CDN
// copies so the marker actually shows up.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface InnerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
  readOnly?: boolean;
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

export default function MapPickerInner({ latitude, longitude, onPick, readOnly }: InnerProps) {
  const hasPin = latitude !== null && longitude !== null;
  const center: [number, number] = hasPin ? [latitude!, longitude!] : INDIA_CENTER;
  const zoom = hasPin ? 13 : 5;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={!readOnly}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} readOnly={readOnly} />
      <Recentre lat={latitude} lng={longitude} />
      {hasPin && <Marker position={[latitude!, longitude!]} />}
    </MapContainer>
  );
}
