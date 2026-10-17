// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PengaturanSippAbt } from "@/components/portal/pengaturan-sipp-abt";

/**
 * Audit 17 Okt 2026 - Pengaturan SIPP & ABT > Isian blangko: "Pakai perkara
 * ini" dengan nomor yang tidak ada dulu MENGEMBALIKAN perkara contoh bawaan
 * (efek [perkara] berjalan lagi saat perkara menjadi null) - kotak nomor
 * terhapus dan uji berjalan atas perkara lain.
 */

const jawab = (data: unknown, ok = true) => new Response(JSON.stringify(ok ? { ok: true, data } : { ok: false, error: { message: "x" } }), { status: ok ? 200 : 500 });

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("RinciVar - perkara contoh", () => {
  it("nomor yang tidak ditemukan tidak diganti perkara bawaan; bawaan hanya dimuat sekali", async () => {
    window.history.replaceState(null, "", "/admin/pengaturan-sipp-abt?bagian=variabel&noVar=0046");
    let bawaan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const u = new URL(String(alamat), "http://localhost");
        const bagian = u.searchParams.get("bagian");
        if (bagian === "variabel" && u.searchParams.get("noVar"))
          return jawab({ variabel: { noVar: "0046", judul: "Sebutan P", nama: "Sebutan P", jenis: "data_sql", sql_query: "select 1 as data", default_data: "", dikunci: false, blangko: [] } });
        if (bagian === "variabel") return jawab({ daftar: [], jumlahBerkas: 0, hak: { lihat: true, ubahMenu: true, ubahKueri: true, ubahBawaan: true, ubahTemplat: true } });
        if (bagian === "perkara" && u.searchParams.get("nomor")) return jawab({ perkara: null });
        if (bagian === "perkara") {
          bawaan += 1;
          return jawab({ perkara: { perkaraId: 7, nomor: "7/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat" } });
        }
        if (bagian === "riwayat") return jawab({ riwayat: [] });
        return jawab(null, false);
      })
    );
    render(<PengaturanSippAbt roleId="super-admin" />);
    const kotak = (await screen.findByDisplayValue("7/Pdt.G/2026/PA.Dgl")) as HTMLInputElement;
    fireEvent.change(kotak, { target: { value: "999/Pdt.G/2026/PA.Dgl" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pakai perkara ini" }));
    });
    await screen.findByText("Nomor perkara tidak ditemukan di SIPP.");
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(kotak.value).toBe("999/Pdt.G/2026/PA.Dgl"));
    expect(bawaan).toBe(1);
  });
});
