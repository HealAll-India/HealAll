"use client";

import { useId } from "react";
import { Gauge, MapPin, Search } from "lucide-react";

import { CATEGORIES, URGENCIES } from "@/lib/ui/post-meta";
import type { FeedFilters } from "@/lib/types/api";

import { unionCities } from "./feed-query";

const URGENCY_FILTERS = URGENCIES.filter((u) => u.badge);

interface Props {
  filters: FeedFilters;
  searchInput: string;
  cities: readonly string[];
  onSearchInput: (value: string) => void;
  onSearchSubmit: () => void;
  onChange: (partial: Partial<Omit<FeedFilters, "search">>) => void;
}

/** Search, city, urgency and category filters — always above the list. */
export function FeedControls({ filters, searchInput, cities, onSearchInput, onSearchSubmit, onChange }: Props) {
  const searchId = useId();
  const cityOptions = unionCities(cities, [], filters.city);

  return (
    <div className="feed-controls">
      <div className="feed-controls__bar">
        <form
          role="search"
          className="feed-field feed-field--search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <label htmlFor={searchId} className="sr-only">
            Search requests
          </label>
          <Search size={18} className="feed-field__icon" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            placeholder="Search requests"
            autoComplete="off"
            enterKeyHint="search"
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
          />
        </form>

        <label className="feed-field feed-field--city">
          <span className="sr-only">City</span>
          <MapPin size={18} className="feed-field__icon" aria-hidden="true" />
          <select value={filters.city} onChange={(e) => onChange({ city: e.target.value })}>
            <option value="">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="feed-field feed-field--urgency">
          <span className="sr-only">Urgency</span>
          <Gauge size={18} className="feed-field__icon" aria-hidden="true" />
          <select value={filters.urgency} onChange={(e) => onChange({ urgency: e.target.value })}>
            <option value="">Any urgency</option>
            {URGENCY_FILTERS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chip-rail feed-chips" role="group" aria-label="Category">
        <button
          type="button"
          className="chip-toggle"
          aria-pressed={filters.category === ""}
          onClick={() => onChange({ category: "" })}
        >
          All
        </button>
        {CATEGORIES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className="chip-toggle"
            aria-pressed={filters.category === value}
            onClick={() => onChange({ category: value })}
          >
            <Icon size={18} className={`cat-tone--${value}`} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
