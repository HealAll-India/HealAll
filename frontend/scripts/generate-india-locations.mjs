// Writes lib/data/india-locations.json: India's states and their city names.
//
// country-state-city ships every country's cities (about 8 MB). Importing it
// in a client component put all of that in the signup, profile and new post
// pages. The picker only needs India, so this keeps just that.
//
// Run after upgrading country-state-city: node scripts/generate-india-locations.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { City, State } from "country-state-city";

const states = State.getStatesOfCountry("IN").map((s) => ({
  code: s.isoCode,
  name: s.name,
  cities: [...new Set(City.getCitiesOfState("IN", s.isoCode).map((c) => c.name))],
}));

const out = fileURLToPath(new URL("../lib/data/india-locations.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(states)}\n`);
console.log(`Wrote ${states.length} states to ${out}`);
