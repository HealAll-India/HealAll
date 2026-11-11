import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DESKTOP_UA = navigator.userAgent;
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function installOffer(outcome: "accepted" | "dismissed") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return { event, prompt };
}

// The install offer lives in module state, so each test gets fresh modules.
async function renderGuide() {
  vi.resetModules();
  const { InstallGuide } = await import("@/components/pwa/install-guide");
  return render(<InstallGuide />);
}

describe("InstallGuide", () => {
  beforeEach(() => setStandalone(false));
  afterEach(() => setUserAgent(DESKTOP_UA));

  it("installs through the browser's own dialog and confirms", async () => {
    await renderGuide();
    const { event, prompt } = installOffer("accepted");
    act(() => {
      window.dispatchEvent(event);
    });
    fireEvent.click(await screen.findByRole("button", { name: /install healall/i }));
    expect(await screen.findByText(/healall is on your home screen/i)).toBeTruthy();
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("keeps the page useful after the dialog is dismissed", async () => {
    await renderGuide();
    const { event } = installOffer("dismissed");
    act(() => {
      window.dispatchEvent(event);
    });
    fireEvent.click(await screen.findByRole("button", { name: /install healall/i }));
    expect(await screen.findByText(/install it from this page any time/i)).toBeTruthy();
    // A browser offer can only be used once; fall back to the menu steps.
    expect(screen.queryByRole("button", { name: /install healall/i })).toBeNull();
    expect(screen.getByText(/install app/i)).toBeTruthy();
  });

  it("walks iPhone users through Add to Home Screen", async () => {
    setUserAgent(IPHONE_UA);
    await renderGuide();
    expect(await screen.findByText(/add to home screen/i)).toBeTruthy();
    expect(screen.getByText("Share")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /install healall/i })).toBeNull();
  });

  it("points other browsers at their menu", async () => {
    await renderGuide();
    expect(await screen.findByText(/open your browser's menu/i)).toBeTruthy();
  });

  it("says so when already running as the app", async () => {
    setStandalone(true);
    await renderGuide();
    expect(await screen.findByText(/already using the healall app/i)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
