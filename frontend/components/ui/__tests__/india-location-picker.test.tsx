import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IndiaLocationPicker } from "@/components/ui/india-location-picker";
import indiaLocations from "@/lib/data/india-locations.json";

function selects() {
  const [state, city] = screen.getAllByRole("combobox") as HTMLSelectElement[];
  return { state, city };
}

describe("IndiaLocationPicker", () => {
  it("ships every Indian state with its cities", () => {
    expect(indiaLocations.length).toBe(36);
    const maharashtra = indiaLocations.find((s) => s.name === "Maharashtra");
    expect(maharashtra?.cities).toContain("Mumbai");
  });

  it("shows a saved city and state", () => {
    render(<IndiaLocationPicker value="Mumbai, Maharashtra" onChange={() => {}} />);
    const { state, city } = selects();
    expect(state.selectedOptions[0].textContent).toBe("Maharashtra");
    expect(city.value).toBe("Mumbai");
  });

  it("treats a lone state name as a state", () => {
    render(<IndiaLocationPicker value="Kerala" onChange={() => {}} />);
    const { state, city } = selects();
    expect(state.selectedOptions[0].textContent).toBe("Kerala");
    expect(city.value).toBe("");
  });

  it("emits the state, then the city with the state", () => {
    const onChange = vi.fn();
    const { rerender } = render(<IndiaLocationPicker value="" onChange={onChange} />);
    const code = indiaLocations.find((s) => s.name === "Maharashtra")!.code;
    fireEvent.change(selects().state, { target: { value: code } });
    expect(onChange).toHaveBeenLastCalledWith(", Maharashtra");

    rerender(<IndiaLocationPicker value=", Maharashtra" onChange={onChange} />);
    fireEvent.change(selects().city, { target: { value: "Pune" } });
    expect(onChange).toHaveBeenLastCalledWith("Pune, Maharashtra");
  });

  it("keeps the city disabled until a state is picked", () => {
    render(<IndiaLocationPicker value="" onChange={() => {}} />);
    expect(selects().city.disabled).toBe(true);
  });
});
