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
 * Round-tripping edge case: when only the state is picked (no city yet), we
 * emit just the state name ("Maharashtra"). On the next render, `splitValue`
 * has to decide whether a single token is a state or a city. We disambiguate
 * by checking the known state list — if the token matches an Indian state
 * name (case-insensitive), it's a state; otherwise it's a legacy free-text
 * city value. This keeps DB values clean ("Maharashtra" or "Mumbai,
 * Maharashtra") without leading-comma artefacts.
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

function splitValue(
  value: string,
  knownStateNames: ReadonlySet<string>,
): { state: string; city: string } {
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts.slice(1).join(", ") };
  }
  const trimmed = value.trim();
  if (!trimmed) return { city: "", state: "" };
  // Single-token value — could be either a state or a legacy free-text city.
  // Treat it as a state only if it matches the known India state list.
  if (knownStateNames.has(trimmed.toLowerCase())) {
    return { city: "", state: trimmed };
  }
  return { city: trimmed, state: "" };
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
  const knownStateNames = useMemo(
    () => new Set(states.map((s) => s.name.toLowerCase())),
    [states],
  );

  // Derive selection from the controlled value on every render.
  const { city, state } = splitValue(value ?? "", knownStateNames);
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
    onChange(nextCity ? `${nextCity}, ${stateName}` : `, ${stateName}`);
  }

  return (
    <div className="row location-picker-row">
      <label className="location-picker-field">
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

      <label className="location-picker-field">
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
