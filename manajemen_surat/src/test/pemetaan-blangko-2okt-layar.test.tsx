/**
 * Perbaikan 2 Okt sore (agen P) - layar admin "Pemetaan blangko":
 * putusan dapat dibuka per status putusan (butir 3), tab BAS ber-grup per
 * jenis (butir 6), dan kolom "Dipakai saat" yang menandai kunci yang tidak
 * dikenali ekstensi (butir 2). Pendamping pemetaan-blangko-2okt.test.ts
 * (berkas itu berlingkungan node; layar React butuh jsdom).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtPemetaanBlangko } from "@/components/portal/aleta-ecourt-pemetaan-blangko";
import { KUNCI_BAKU, STATUS_BERVERSTEK, STATUS_PUTUSAN_SIPP, kapanDipakai, type JenisPemetaan } from "@/lib/pemetaan-blangko";

type Butir = { kunci: string; namaBerkas: string; sumber?: string };
let server: Record<string, Butir[]> = {};
let dikirim: Array<{ jenis: string; butir: Array<{ kunci: string; namaBerkas: string }> }> = [];

function jawaban(jenis: JenisPemetaan) {
  const butir = (server[jenis] || []).map((b) => ({ sebutan: b.kunci, catatan: "", diubahPada: "2026-10-02T09:54:00Z", diubahOleh: "usr-admin", sumber: "admin", ...b }));
  return {
    jenis,
    butir,
    diubahPada: butir.length ? "2026-10-02T09:54:00Z" : null,
    label: jenis,
    kunciBaku: KUNCI_BAKU[jenis],
    saran: [],
    bolehMengubah: true,
    kapan: Object.fromEntries(butir.map((b) => [b.kunci, kapanDipakai(jenis, b.kunci)])),
    ...(jenis === "putusan" ? { statusPutusan: STATUS_PUTUSAN_SIPP.map((s) => s.nama), statusBerverstek: [...STATUS_BERVERSTEK] } : {}),
  };
}

beforeEach(() => {
  server = {};
  dikirim = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method || "GET") === "PUT") {
        const b = JSON.parse(String(init?.body || "{}"));
        dikirim.push(b);
        return new Response(JSON.stringify({ ok: true, data: jawaban(b.jenis) }), { status: 200 });
      }
      const jenis = (new URL(String(url), "http://localhost").searchParams.get("jenis") || "putusan") as JenisPemetaan;
      return new Response(JSON.stringify({ ok: true, data: jawaban(jenis) }), { status: 200 });
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Pemetaan blangko - layar admin (2 Okt sore)", () => {
  it("Putusan: 'Per status putusan' membuka baris status; isian tersimpan berkunci Jenis|Status|verstek", async () => {
    server.putusan = [{ kunci: "Cerai Gugat", namaBerkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)" }];
    render(<AletaEcourtPemetaanBlangko />);
    const buka = await waitFor(() => {
      const b = document.querySelector('tr[data-kunci="Cerai Gugat"] button[aria-expanded]') as HTMLButtonElement;
      expect(b).toBeTruthy();
      return b;
    });
    expect(document.querySelector('tr[data-kunci="Cerai Gugat|Dikabulkan|verstek"]')).toBeNull();
    fireEvent.click(buka);
    const baris = await waitFor(() => {
      const b = document.querySelector('tr[data-kunci="Cerai Gugat|Dikabulkan|verstek"]');
      expect(b).toBeTruthy();
      return b as HTMLElement;
    });
    expect(baris.textContent).toContain("Dikabulkan (verstek)");
    expect(baris.textContent).toContain("Ikut jenis");
    expect(document.querySelector('tr[data-kunci="Cerai Gugat|Dicoret dari Register"]')).toBeTruthy();
    fireEvent.change(baris.querySelector("input") as HTMLInputElement, { target: { value: "[01] Kabul Verstek Khusus" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan pemetaan" }));
    await waitFor(() => expect(dikirim).toHaveLength(1));
    expect(dikirim[0]).toEqual({ jenis: "putusan", butir: [{ kunci: "Cerai Gugat|Dikabulkan|verstek", namaBerkas: "[01] Kabul Verstek Khusus", catatan: "" }] });
    await screen.findByText(/paling lama 1 menit lagi, tanpa Reload/);
  });

  it("Relaas: kunci buatan pengguna dikenali; kunci asing ditandai 'tidak dikenali', tidak dibuang", async () => {
    server.relaas = [
      { kunci: "relaas-panggilan-sidang-pertama-pemohon", namaBerkas: "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf" },
      { kunci: "panggilan-kuasa", namaBerkas: "[JS] Kuasa.rtf" },
    ];
    render(<AletaEcourtPemetaanBlangko />);
    fireEvent.click(await screen.findByRole("tab", { name: "Relaas panggilan" }));
    const dikenal = await waitFor(() => {
      const el = document.querySelector('tr[data-kunci="relaas-panggilan-sidang-pertama-pemohon"] [data-dipakai]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(dikenal.getAttribute("data-dipakai")).toBe("ya");
    expect(dikenal.textContent).toContain("sidang pertama - Pemohon");
    const asing = document.querySelector('tr[data-kunci="panggilan-kuasa"] [data-dipakai]') as HTMLElement;
    expect(asing.getAttribute("data-dipakai")).toBe("tidak-dikenali");
  });

  it("BAS: grup per jenis tertutup, dibuka menampilkan keadaan sidang x kehadiran", async () => {
    render(<AletaEcourtPemetaanBlangko />);
    fireEvent.click(await screen.findByRole("tab", { name: "Berita acara sidang (BAS)" }));
    const judul = await screen.findByRole("button", { name: /Cerai Gugat/ });
    expect(document.querySelector('tr[data-kunci="Cerai Gugat|1|p-hadir"]')).toBeNull();
    fireEvent.click(judul);
    const baris = await waitFor(() => {
      const b = document.querySelector('tr[data-kunci="Cerai Gugat|1|p-hadir"]');
      expect(b).toBeTruthy();
      return b as HTMLElement;
    });
    expect(baris.textContent).toContain("Sidang pertama - hanya P hadir (T tidak hadir)");
    expect(baris.textContent).toContain("Otomatis");
    expect((baris.querySelector("input") as HTMLInputElement).placeholder).toBe("kosong = usulan otomatis BAS massal");
  });
});
