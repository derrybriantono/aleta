import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalLoadingProvider, useGlobalLoading } from "@/lib/global-loading";

function StickyLoadingButton() {
  const { startLoading } = useGlobalLoading();

  return (
    <button
      type="button"
      onClick={() => {
        startLoading({
          label: "ALETA sedang menjalankan proses panjang...",
          detail: "Proses ini sengaja tidak ditutup oleh test.",
          immediate: true,
        });
      }}
    >
      Mulai proses panjang
    </button>
  );
}

describe("global loading overlay", () => {
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows branded ALETA processing feedback and keeps it visible briefly", () => {
    vi.useFakeTimers();

    render(
      <GlobalLoadingProvider>
        <main>Halaman ALETA</main>
      </GlobalLoadingProvider>
    );

    const overlay = screen.getByTestId("global-loading-overlay");
    expect(overlay).toHaveAttribute("aria-busy", "false");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("aleta:show-loading", {
          detail: {
            label: "ALETA sedang menyimpan perubahan...",
            detail: "Perubahan sedang dikirim dan disimpan.",
            durationMs: 300,
            immediate: true,
          },
        })
      );
      vi.advanceTimersByTime(0);
    });

    expect(overlay).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("ALETA")).toBeInTheDocument();
    expect(screen.getByText("ALETA sedang menyimpan perubahan...")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(overlay).toHaveAttribute("aria-busy", "true");

    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(overlay).toHaveAttribute("aria-busy", "false");
  });

  it("shows loading feedback while opening another internal page", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/aleta/portal");

    render(
      <GlobalLoadingProvider>
        <a href="/aleta/admin/audit-trail" onClick={(event) => event.preventDefault()}>
          Audit Trail
        </a>
      </GlobalLoadingProvider>
    );

    const overlay = screen.getByTestId("global-loading-overlay");
    expect(overlay).toHaveAttribute("aria-busy", "false");

    act(() => {
      screen.getByText("Audit Trail").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(0);
    });

    expect(overlay).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("ALETA sedang membuka halaman...")).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, "", "/aleta/admin/audit-trail");
      vi.advanceTimersByTime(120);
      vi.advanceTimersByTime(520);
    });

    expect(overlay).toHaveAttribute("aria-busy", "false");
  });

  it("releases stale loading with an explicit error state instead of staying stuck forever", () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <GlobalLoadingProvider>
        <StickyLoadingButton />
      </GlobalLoadingProvider>
    );

    const overlay = screen.getByTestId("global-loading-overlay");

    act(() => {
      fireEvent.click(screen.getByText("Mulai proses panjang"));
      vi.advanceTimersByTime(0);
    });

    expect(overlay).toHaveAttribute("aria-busy", "true");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(overlay).toHaveAttribute("data-phase", "error");
    expect(screen.getByText("Proses terlalu lama")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_600);
    });

    expect(overlay).toHaveAttribute("aria-busy", "false");
    warnSpy.mockRestore();
  });
});
