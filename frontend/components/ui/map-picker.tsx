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
  enableLocate?: boolean;
}

export function MapPicker({
  latitude,
  longitude,
  onChange,
  height = 280,
  readOnly = false,
  enableLocate = false,
}: Props) {
  // Leaflet's CSS only loads on the client side.
  const [cssReady, setCssReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);

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

  function handleLocate() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocateError("Geolocation not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setRecenterToken((t) => t + 1);
        setLocating(false);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Could not determine your location."
            : err.code === err.TIMEOUT
            ? "Location request timed out."
            : "Could not get your location.";
        setLocateError(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Only `height` is dynamic — everything else is in .map-picker-frame.
  const frameStyle = { height: `${height}px` };

  return (
    <div className="stack stack--map">
      <div className="map-picker-frame" style={frameStyle}>
        {cssReady ? (
          <MapPickerInner
            latitude={latitude}
            longitude={longitude}
            onPick={(lat, lng) => onChange(lat, lng)}
            readOnly={readOnly}
            userLocation={userLocation}
            recenterToken={recenterToken}
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
          {enableLocate && (
            <button
              type="button"
              className="ghost btn-sm map-picker-locate-btn"
              onClick={handleLocate}
              disabled={locating}
              aria-label="Show my current location and recenter map"
            >
              {locating ? "Locating…" : userLocation ? "🎯 Recenter to me" : "🎯 Use my location"}
            </button>
          )}
        </div>
      )}
      {locateError && !readOnly && (
        <p className="error map-picker-error">{locateError}</p>
      )}
    </div>
  );
}
