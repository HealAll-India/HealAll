"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Leaflet uses `window` at import time, so we must skip SSR.
const MapPickerInner = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "260px", display: "grid", placeItems: "center", color: "#9ca3af", fontSize: "12px" }}>
      Loading map…
    </div>
  ),
});

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  height?: number;
  readOnly?: boolean;
}

export function MapPicker({ latitude, longitude, onChange, height = 280, readOnly = false }: Props) {
  // Leaflet's CSS must load on the client side only.
  const [cssReady, setCssReady] = useState(false);
  useEffect(() => {
    let active = true;
    void import("leaflet/dist/leaflet.css").then(() => active && setCssReady(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="stack" style={{ gap: "8px" }}>
      <div
        style={{
          height: `${height}px`,
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border-strong)",
        }}
      >
        {cssReady ? (
          <MapPickerInner
            latitude={latitude}
            longitude={longitude}
            onPick={(lat, lng) => onChange(lat, lng)}
            readOnly={readOnly}
          />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#9ca3af", fontSize: "12px" }}>
            Loading map styles…
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="row" style={{ gap: "8px", fontSize: "12px", color: "#6b7280", alignItems: "center" }}>
          {latitude !== null && longitude !== null ? (
            <>
              <span>📍 Pinned: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
              <button
                type="button"
                className="ghost"
                onClick={() => onChange(null, null)}
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Clear pin
              </button>
            </>
          ) : (
            <span>Tap the map to drop a pin (optional).</span>
          )}
        </div>
      )}
    </div>
  );
}
