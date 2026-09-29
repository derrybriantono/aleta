import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PILIHAN "RINGKAS / LENGKAP" DI JADWAL SIDANG HARUS DIINGAT PERAMBAN
 * ============================================================================
 *
 * Cacat 28 Sep 2026: saat layar dibuka, efek yang MENYIMPAN pilihan berjalan
 * serentak dan menulis nilai bawaan ("0" = Lengkap) ke localStorage, sedangkan
 * efek yang MEMBACA menunda pembacaannya satu putaran. Ketika pembacaan tiba,
 * simpanannya sudah tertimpa "0" - Ringkas selalu kembali ke Lengkap.
 *
 * Yang dibuktikan di sini dengan menggambar layar sungguhan:
 *
 *   - pilih Ringkas, bongkar, pasang ulang -> tetap Ringkas;
 *   - simpanan "1" yang sudah ada tidak ditimpa sekadar karena layar dibuka;
 *   - tanpa simpanan, bawaannya tetap Lengkap dan tidak ada yang ditulis;
 *   - memilih Lengkap kembali juga diingat;
 *   - penyimpanan yang diblokir peramban tidak meruntuhkan layar.
 */

const KUNCI = "aleta.jadwal-sidang.ringkas";

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Penguji", roleId: "admin" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));

function jawab(isi: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => isi } as unknown as Response);
}

beforeEach(() => {
  window.localStorage.clear();
  // Rute apa pun menjawab kosong - yang diuji hanya pemilih tampilannya.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jawab({ ok: true, data: {} }))
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** Pasangan tombol Ringkas | Lengkap di kepala layar. */
function pemilih(wadah: HTMLElement) {
  const ringkas = [...wadah.querySelectorAll("button")].find(
    (b) => b.textContent === "Ringkas" && b.nextElementSibling?.textContent === "Lengkap"
  ) as HTMLButtonElement | undefined;
  if (!ringkas) throw new Error("pemilih Ringkas/Lengkap tidak ditemukan");
  return { ringkas, lengkap: ringkas.nextElementSibling as HTMLButtonElement };
}

const aktif = (b: HTMLElement) => /\bbg-primary\b/.test(b.className);

/** Gambar layarnya dan tunggu sampai pembacaan simpanan (satu putaran mikro) selesai. */
async function pasang() {
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang));
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
  return hasil;
}

describe("pilihan Ringkas / Lengkap diingat peramban", () => {
  it("pilih Ringkas, pasang ulang -> tetap Ringkas", async () => {
    const pertama = await pasang();
    let p = pemilih(pertama.container);
    expect(aktif(p.lengkap)).toBe(true);

    fireEvent.click(p.ringkas);
    p = pemilih(pertama.container);
    expect(aktif(p.ringkas)).toBe(true);
    expect(window.localStorage.getItem(KUNCI)).toBe("1");

    pertama.unmount();

    const kedua = await pasang();
    await waitFor(() => expect(aktif(pemilih(kedua.container).ringkas)).toBe(true));
    expect(aktif(pemilih(kedua.container).lengkap)).toBe(false);
    expect(window.localStorage.getItem(KUNCI)).toBe("1");
  }, 40_000);

  it("simpanan '1' yang sudah ada tidak ditimpa '0' hanya karena layar dibuka", async () => {
    window.localStorage.setItem(KUNCI, "1");
    const { container } = await pasang();
    expect(window.localStorage.getItem(KUNCI)).toBe("1");
    await waitFor(() => expect(aktif(pemilih(container).ringkas)).toBe(true));
  }, 40_000);

  it("tanpa simpanan: bawaan tetap Lengkap, dan membuka layar tidak menulis apa pun", async () => {
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    const { container } = await pasang();
    const p = pemilih(container);
    expect(aktif(p.lengkap)).toBe(true);
    expect(aktif(p.ringkas)).toBe(false);
    expect(tulis.mock.calls.filter(([k]) => k === KUNCI)).toHaveLength(0);
    expect(window.localStorage.getItem(KUNCI)).toBeNull();
  }, 40_000);

  it("kembali memilih Lengkap juga diingat", async () => {
    window.localStorage.setItem(KUNCI, "1");
    const pertama = await pasang();
    await waitFor(() => expect(aktif(pemilih(pertama.container).ringkas)).toBe(true));
    fireEvent.click(pemilih(pertama.container).lengkap);
    expect(window.localStorage.getItem(KUNCI)).toBe("0");
    pertama.unmount();

    const kedua = await pasang();
    expect(aktif(pemilih(kedua.container).lengkap)).toBe(true);
    expect(aktif(pemilih(kedua.container).ringkas)).toBe(false);
  }, 40_000);

  it("penyimpanan yang diblokir tidak meruntuhkan layar - pilihannya tetap berlaku di halaman itu", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { container } = await pasang();
    expect(aktif(pemilih(container).lengkap)).toBe(true);
    fireEvent.click(pemilih(container).ringkas);
    expect(aktif(pemilih(container).ringkas)).toBe(true);
  }, 40_000);
});
