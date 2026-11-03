import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAIFeatureFlags } from "@/lib/ai-feature-flags";

/**
 * 3 Nov 2026 (keputusan 140), halaman Pengaturan AI admin:
 *   - butir 7: kunci API tersimpan TIDAK dapat disalin (tersamar, tidak dapat dipilih, tanpa tombol salin/lihat; borang sunting tidak
 *     mengisi ulang kunci); peladen tidak pernah mengirim kunci utuh (dijaga uji kunci-api-terenkripsi-27okt);
 *   - butir 8: pada provider Claude kolom Model disembunyikan (model dan ketelitian dipilih otomatis oleh ALETA Ai); provider lain tetap.
 * Kunci di bawah RAKITAN uji.
 */

const KUNCI_UTUH = "sk-ant-uji-RAHASIA-UTUH-1234567890abcd";
const setAIConfig = vi.fn(async (..._a: unknown[]) => ({ ok: true as const }));

const koneksi = (id: string, providerId: string, modelId: string, aktif = false) => ({
  id,
  name: `Koneksi ${id}`,
  providerId,
  providerName: providerId === "claude" ? "Claude" : "Gemini",
  modelId,
  apiKey: "", // peladen: tak pernah kunci utuh
  maskedApiKey: "••••abcd",
  endpointUrl: undefined,
  models: providerId === "claude" ? ["Claude Sonnet 5.5", "Claude Opus 5.5", "Claude Haiku 5.5"] : ["Gemini 2.5 Pro", "Gemini 2.5 Flash"],
  builtin: false,
  connectionStatus: "connected" as const,
  isActive: aktif,
});

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({
    currentUser: { id: "u-super", roleId: "super-admin", name: "Super Admin" },
    aiConfig: {
      enabled: true,
      providerId: "claude",
      modelId: "Claude Sonnet 5.5",
      activeConnectionId: "k-claude",
      primaryLanguage: "id",
      featureFlags: defaultAIFeatureFlags,
      moduleConfigs: [],
      providers: [koneksi("k-claude", "claude", "Claude Sonnet 5.5", true), koneksi("k-gemini", "gemini", "Gemini 2.5 Flash")],
    },
    refreshAIConfig: async () => undefined,
    setAIConfig,
  }),
}));

import { AIControlPanel } from "@/components/portal/ai-control-panel";

const selectProvider = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("select")).find((s) => Array.from(s.options).map((o) => o.value).join() === "chatgpt,gemini,claude,llama") as HTMLSelectElement;

beforeEach(() => setAIConfig.mockClear());
afterEach(cleanup);

describe("butir 7: kunci API tersimpan tidak dapat disalin", () => {
  it("kunci tampil tersamar (empat huruf terakhir), tidak dapat dipilih, tanpa tombol salin/lihat; kunci utuh tidak ada di halaman", () => {
    const { container } = render(<AIControlPanel />);
    const tersamar = Array.from(container.querySelectorAll("[data-kunci-tersamar]")) as HTMLElement[];
    expect(tersamar.length).toBeGreaterThanOrEqual(2); // koneksi aktif + daftar koneksi
    for (const el of tersamar) {
      expect(el.textContent).toBe("••••abcd");
      expect(el.style.userSelect).toBe("none");
      expect(el.className).toContain("select-none");
      for (const nama of ["copy", "cut", "contextmenu", "dragstart"]) {
        const peristiwa = new Event(nama, { bubbles: true, cancelable: true });
        el.dispatchEvent(peristiwa);
        expect(peristiwa.defaultPrevented, nama).toBe(true);
      }
    }
    const teksHalaman = container.textContent ?? "";
    expect(teksHalaman).not.toContain(KUNCI_UTUH);
    expect(container.innerHTML).not.toContain(KUNCI_UTUH);
    expect(screen.queryByRole("button", { name: /salin|copy|lihat (api )?key|tampilkan (api )?key/i })).toBeNull();
  });

  it("sunting koneksi: kolom API key kosong (kunci lama tidak diisi ulang), disimpan tanpa apiKey = tetap memakai kunci lama", async () => {
    const { container } = render(<AIControlPanel />);
    const tombolSunting = Array.from(container.querySelectorAll("button")).find((b) => /sunting|edit/i.test(b.getAttribute("aria-label") ?? "") || /^\s*(sunting|edit)\s*$/i.test(b.textContent ?? ""));
    expect(tombolSunting, "tombol sunting koneksi").toBeTruthy();
    fireEvent.click(tombolSunting!);
    const kolomKunci = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(kolomKunci.value).toBe("");
    expect(kolomKunci.getAttribute("autocomplete")).toBe("new-password");
    const salin = new Event("copy", { bubbles: true, cancelable: true });
    kolomKunci.dispatchEvent(salin);
    expect(salin.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Simpan Perubahan/ }));
    await vi.waitFor(() => expect(setAIConfig).toHaveBeenCalledTimes(1));
    const kirim = setAIConfig.mock.calls[0][0] as { connection: { apiKey?: string; id?: string } };
    expect(kirim.connection.id).toBeTruthy();
    expect(kirim.connection.apiKey).toBeUndefined();
  });
});

describe("butir 8: koneksi Claude tanpa pilihan model", () => {
  it("provider Claude: kolom Model disembunyikan dengan keterangan otomatis; provider lain: kolom Model tampil", () => {
    const { container } = render(<AIControlPanel />);
    const pilihProvider = selectProvider(container);
    // bawaan Gemini -> Model tampil
    fireEvent.change(pilihProvider, { target: { value: "gemini" } });
    expect(screen.queryByText("Model")).not.toBeNull();
    expect(container.querySelector("[data-model-otomatis]")).toBeNull();
    fireEvent.change(pilihProvider, { target: { value: "claude" } });
    expect(screen.queryByText("Model")).toBeNull();
    const catatan = container.querySelector("[data-model-otomatis]");
    expect(catatan?.textContent).toMatch(/dipilih otomatis oleh ALETA Ai/);
    expect(catatan?.textContent).toMatch(/ketelitian/);
  });

  it("menyimpan koneksi Claude baru tanpa memilih model tetap sah: modelId terisi bawaan, kunci terkirim", async () => {
    const { container } = render(<AIControlPanel />);
    fireEvent.change(selectProvider(container), { target: { value: "claude" } });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: KUNCI_UTUH } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan Koneksi/ }));
    await vi.waitFor(() => expect(setAIConfig).toHaveBeenCalledTimes(1));
    const kirim = setAIConfig.mock.calls[0][0] as { connection: { providerId: string; modelId: string; apiKey?: string } };
    expect(kirim.connection.providerId).toBe("claude");
    expect(kirim.connection.modelId).toBe("Claude Sonnet 5.5");
    expect(kirim.connection.apiKey).toBe(KUNCI_UTUH);
  });
});
