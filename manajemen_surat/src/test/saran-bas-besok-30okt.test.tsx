/**
 * 30 Okt 2026 malam (keputusan pengguna 43): Jadwal Sidang memberi SARAN kecil "Sidang besok: N perkara - BAS sudah
 * disiapkan" dengan tautan per perkara (membuka Blangko Derry pada perkara & sidang itu, draf "h1"); tanpa pindah otomatis.
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaranBasBesok } from "@/components/portal/lencana-bas-h1";

const D = (perkaraId: string, nomor: string, tanggal: string, label = "BAS 2") => ({
  perkaraId, nomorPerkara: nomor, jenisPerkara: "Cerai Gugat", tanggalSidang: tanggal, urutanSidang: 2, agenda: "Pembuktian", jenisAgenda: "pembuktian",
  blangko: { folder: "derry_briantono/1 Perceraian CG - BAS", berkas: "BAS ALUR 02 [2].rtf", menu: "BAS CG", alias: [], label }, alternatif: [], alasan: "", perkiraanKehadiran: true,
  saksi: { terdaftarP: 0, terdaftarT: 0, bertanyaJawab: 0 }, catatan: [], majelisNama: "", paniteraNama: "PP Satu", dibuatPada: "2026-10-30T08:00:00Z", keterangan: "BAS sidang disiapkan otomatis.",
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SaranBasBesok", () => {
  it("menyebut jumlah perkara sidang besok dan memberi satu tautan BAS H-1 per perkara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { hariIni: "2026-10-30", draf: [D("1", "640/Pdt.G/2026/PA.Dgl", "2026-11-02"), D("2", "635/Pdt.G/2026/PA.Dgl", "2026-11-02"), D("3", "9/Pdt.G/2026/PA.Dgl", "2026-10-30")] } }))));
    const r = render(createElement(SaranBasBesok, { boleh: true, setelanAps: "" }));
    await waitFor(() => expect(r.container.querySelector("[data-saran-bas-besok]")).not.toBeNull());
    const kotak = r.container.querySelector("[data-saran-bas-besok]")!;
    expect(kotak.textContent).toMatch(/Sidang besok \(Senin, 2 November 2026\): 2 perkara - BAS sudah disiapkan\./);
    const a = Array.from(kotak.querySelectorAll("a"));
    expect(a.map((x) => x.textContent)).toEqual(["635/Pdt.G/2026", "640/Pdt.G/2026"]);
    const muatan = JSON.parse(decodeURIComponent(a[0].getAttribute("href")!.split("#bd=")[1]));
    expect(muatan).toMatchObject({ v: 1, perkaraId: 2, tanggalSidang: "2026-11-02", jenis: "bas", draf: "h1" });
  });

  it("akun tanpa hak BAS atau tanpa draf: tidak tampil dan tidak meminta apa pun", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { hariIni: "2026-10-30", draf: [] } })));
    vi.stubGlobal("fetch", f);
    const r = render(createElement(SaranBasBesok, { boleh: false }));
    expect(r.container.innerHTML).toBe("");
    expect(f).not.toHaveBeenCalled();
    const r2 = render(createElement(SaranBasBesok, { boleh: true }));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(r2.container.querySelector("[data-saran-bas-besok]")).toBeNull();
  });
});
