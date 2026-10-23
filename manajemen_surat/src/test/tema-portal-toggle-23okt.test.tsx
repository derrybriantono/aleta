/**
 * Pemilih tema portal (terang | gelap | ikuti sistem) di dalam PortalProvider:
 * klik membawa pilihan TEGAS, atribut/kelas berubah seketika, dan tab lain
 * serta tampilan sistem diikuti tanpa menulis balik.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PortalProvider } from "@/lib/app-state";
import { DEFAULT_ASSISTANT_JUDGE_CONFIG } from "@/lib/assistant-judge";
import { DEFAULT_PANEL_SETTINGS } from "@/lib/panel-settings";
import {
  defaultAIConfig,
  defaultInstitutionIdentity,
  defaultWhatsAppWeb,
  dispositions,
  letters,
  moduleVisibility,
  personas,
  positions,
  roles,
} from "@/lib/mock-data";
import { KUNCI_SALINAN_TEMA, setelUlangTemaUntukUji } from "@/lib/tema-pilihan";
import { type PortalStateData } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const keadaanAwal = (): PortalStateData => ({
  currentUserId: "usr-ketua",
  roles,
  users: personas,
  positions,
  letters,
  dispositions,
  moduleVisibility,
  theme: "dark",
  aiConfig: defaultAIConfig,
  whatsAppWeb: defaultWhatsAppWeb,
  institutionIdentity: defaultInstitutionIdentity,
  panelSettings: DEFAULT_PANEL_SETTINGS,
  assistantJudgeConfig: DEFAULT_ASSISTANT_JUDGE_CONFIG,
});

function pasangSistem(gelap: boolean) {
  const pendengar = new Set<(e: { matches: boolean }) => void>();
  const mq: Record<string, unknown> = {
    matches: gelap,
    addEventListener: (_n: string, fn: (e: { matches: boolean }) => void) => pendengar.add(fn),
    removeEventListener: (_n: string, fn: (e: { matches: boolean }) => void) => pendengar.delete(fn),
  };
  window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;
  return {
    balik(baru: boolean) {
      mq.matches = baru;
      pendengar.forEach((fn) => fn({ matches: baru }));
    },
  };
}

const tombol = (judul: RegExp) => screen.getByRole("button", { name: judul });

function pasangKomponen() {
  return render(
    <PortalProvider initialState={keadaanAwal()}>
      <ThemeToggle />
    </PortalProvider>
  );
}

describe("ThemeToggle di dalam PortalProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    for (const n of Array.from(document.documentElement.getAttributeNames())) {
      if (n.startsWith("data-aleta")) document.documentElement.removeAttribute(n);
    }
    setelUlangTemaUntukUji();
    pasangSistem(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tiga pilihan tampil, dan yang tersimpan (sistem) yang menyala - kelas dark ikut sistem gelap", () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|5");
    pasangKomponen();
    expect(tombol(/sistem/i).getAttribute("aria-pressed")).toBe("true");
    expect(tombol(/tema terang/i).getAttribute("aria-pressed")).toBe("false");
    expect(tombol(/tema gelap/i).getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("tiap klik meneruskan pilihan tegas: terang, gelap, sistem - dan hasilnya benar seketika", () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|5");
    pasangKomponen();
    const html = document.documentElement;

    fireEvent.click(tombol(/tema terang/i));
    expect(html.classList.contains("dark")).toBe(false);
    expect(html.getAttribute("data-aleta-tema")).toBe("terang");
    expect(tombol(/tema terang/i).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toMatch(/^terang\|\d+$/);

    // Tekan terang SEKALI LAGI: tetap terang (bukan "kebalikan dari state").
    fireEvent.click(tombol(/tema terang/i));
    expect(html.classList.contains("dark")).toBe(false);

    fireEvent.click(tombol(/tema gelap/i));
    expect(html.classList.contains("dark")).toBe(true);
    expect(tombol(/tema gelap/i).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(tombol(/sistem/i));
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toMatch(/^sistem\|\d+$/);
    expect(html.classList.contains("dark")).toBe(true); // sistem gelap
    expect(tombol(/sistem/i).getAttribute("aria-pressed")).toBe("true");
  });

  it("pilihan sistem mengikuti tampilan sistem yang berganti, tanpa menulis penyimpanan", () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|5");
    const sistem = pasangSistem(true);
    pasangKomponen();
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    act(() => sistem.balik(false));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => sistem.balik(true));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(tombol(/sistem/i).getAttribute("aria-pressed")).toBe("true");
    expect(tulis).not.toHaveBeenCalled();
  });

  it("tab lain mengganti pilihan: diikuti, dan tidak ditulis balik oleh tab ini", () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|5");
    pasangKomponen();
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    localStorage.setItem(KUNCI_SALINAN_TEMA, "terang|900");
    tulis.mockClear();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KUNCI_SALINAN_TEMA, newValue: "terang|900" }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(tombol(/tema terang/i).getAttribute("aria-pressed")).toBe("true");
    expect(tulis).not.toHaveBeenCalled();
  });

  it("permintaan ekstensi: salinan yang ditulisnya dibaca; ekstensi lama (satu kata) tetap dilayani", () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|5");
    pasangKomponen();
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|700");
    act(() => {
      window.dispatchEvent(new CustomEvent("aleta-ekstensi-tema", { detail: { pilihan: "sistem", waktu: 700, tema: "gelap" } }));
    });
    expect(tombol(/sistem/i).getAttribute("aria-pressed")).toBe("true");
    act(() => {
      window.dispatchEvent(new CustomEvent("aleta-ekstensi-tema", { detail: { tema: "terang" } }));
    });
    expect(tombol(/tema terang/i).getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
