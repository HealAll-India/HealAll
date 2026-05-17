"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Leaflet uses `window` at import time, so we must skip SSR.
const MapPickerInner = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => <div className="map-picker-loading">Loading map…</div>,
});

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  height?: number;
  readOnly?: boolean;
}

export function MapPicker({ latitude, longitude, onChange, height = 280, readOnly = false }: Props) {
  // Leaflet's CSS only loads on the client side.
  const [cssReady, setCssReady] = useState(false);
  useEffect(() => {
    let active = true;
    void import("leaflet/dist/leaflet.css")
      .then(() => {
        if (active) setCssReady(true);
      })
      .catch((err) => {
        // Fail open — render the map even if the CSS chunk fails so the
        // user isn't stuck on "Loading map styles…" forever.
        console.error("Failed to load Leaflet CSS", err);
        if (active) setCssReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Only `height` is dynamic — everything else is in .map-picker-frame.
  const frameStyle = { height: `${height}px` };

  return (
    <div className="stack" style={{ gap: "8px" }}>
      <div className="map-picker-frame" style={frameStyle}>
        {cssReady ? (
          <MapPickerInner
            latitude={latitude}
            longitude={longitude}
            onPick={(lat, lng) => onChange(lat, lng)}
            readOnly={readOnly}
          />
        ) : (
          <div className="map-picker-loading">Loading map styles…</div>
        )}
      </div>
      {!readOnly && (
        <div className="row map-picker-meta">
          {latitude !== null && longitude !== null ? (
            <>
              <span>📍 Pinned: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
              <button
                type="button"
                className="ghost btn-sm"
                onClick={() => onChange(null, null)}
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
