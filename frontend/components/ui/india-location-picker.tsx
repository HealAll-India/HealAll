"use client";

import { useMemo } from "react";
import { State, City } from "country-state-city";

/**
 * Two cascading <select>s — state then city — using country-state-city's
 * prebuilt India data. Emits a single "City, State" string upward so existing
 * string-based `city` fields in the API and DB don't need to change.
 *
 * Fully controlled: state/city are derived from `value` on every render, so
 * the parent is the single source of truth and there's no effect-based sync.
 *
 * Backward compatible: if the caller passes a free-text value like "Delhi"
 * (no comma), the component tries to parse it; if it can't match a known
 * state, the state dropdown is reset and the user re-picks.
 */
interface Props {
  value: string;
  onChange: (combined: string) => void;
  required?: boolean;
  disabled?: boolean;
  labelState?: string;
  labelCity?: string;
}

const COUNTRY_CODE = "IN";

function splitValue(value: string): { state: string; city: string } {
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length >= 2) return { city: parts[0], state: parts.slice(1).join(", ") };
  return { city: value.trim(), state: "" };
}

export function IndiaLocationPicker({
  value,
  onChange,
  required,
  disabled,
  labelState = "State",
  labelCity = "City",
}: Props) {
  const states = useMemo(() => State.getStatesOfCountry(COUNTRY_CODE), []);

  // Derive selection from the controlled value on every render.
  const { city, state } = splitValue(value ?? "");
  const stateCode =
    states.find((s) => s.name.toLowerCase() === state.toLowerCase())?.isoCode ?? "";

  const cities = useMemo(
    () => (stateCode ? City.getCitiesOfState(COUNTRY_CODE, stateCode) : []),
    [stateCode],
  );

  function emit(nextCity: string, nextStateCode: string) {
    if (!nextStateCode) {
      onChange("");
      return;
    }
    const stateName = states.find((s) => s.isoCode === nextStateCode)?.name ?? "";
    onChange(nextCity ? `${nextCity}, ${stateName}` : stateName);
  }

  return (
    <div className="row" style={{ gap: "12px", flexWrap: "wrap" }}>
      <label style={{ flex: "1 1 180px", minWidth: 0 }}>
        {labelState}
        <select
          value={stateCode}
          required={required}
          disabled={disabled}
          onChange={(e) => emit("", e.target.value)}
        >
          <option value="">Select state…</option>
          {states.map((s) => (
            <option key={s.isoCode} value={s.isoCode}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ flex: "1 1 180px", minWidth: 0 }}>
        {labelCity}
        <select
          value={cities.some((c) => c.name === city) ? city : ""}
          required={required}
          disabled={disabled || !stateCode}
          onChange={(e) => emit(e.target.value, stateCode)}
        >
          <option value="">
            {stateCode
              ? cities.length
                ? "Select city…"
                : "No cities listed"
              : "Pick state first"}
          </option>
          {cities.map((c) => (
            <option
              key={`${c.name}-${c.latitude ?? ""}-${c.longitude ?? ""}`}
              value={c.name}
            >
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
