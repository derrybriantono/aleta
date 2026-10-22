// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LencanaKeadaanPutusan } from "@/components/portal/ecourt-aksi-perkara";
import { KODE_IDE_L2, KUNCI_SAKLAR_IDE_L2, PERAN_IDE_L2 } from "@/lib/sipp-ide-l2";

/**
 * 22 Okt 2026 - deteksi: putusan belum diunggah ke e-Court, dan putusan di
 * e-Court belum ditandatangani panitera (TTE). Logika DIJALANKAN, bukan dibaca.
 */
const muat = createRequire(import.meta.url);
const akar = path.resolve(__dirname, "../../..");
const baca = (r: string) => readFileSync(path.join(akar, r), "utf8");

const ide = muat(path.join(akar, "aleta_bot/services/sippIdeL2Service.js"));
const putusanSvc = muat(path.join(akar, "aleta_bot/services/putusanEcourtService.js"));
const tag = muat(path.join(akar, "aleta_bot/services/tagPerkaraService.js"));

const putus = { tanggal: "2026-10-20", verstek: "", statusId: 62, bht: "" };
const catatan = (u: Record<string, unknown> = {}) => ({
  adaBaris: true,
  dokumenAda: true,
  paniteraTte: true,
  ...u,
});
const nilai = (f: Record<string, unknown>) => ide.nilaiPutusanEcourt(f);

describe("penanda SIPP: putusan di e-Court", () => {
  it("belum diunggah (tanpa dokumen, atau tanpa baris putusan) menyala merah", () => {
    for (const c of [catatan({ dokumenAda: false, paniteraTte: false }), catatan({ adaBaris: false, dokumenAda: false })]) {
      const [p] = nilai({ putus, putusanEcourt: c });
      expect(p).toMatchObject({ kode: "putusan-ecourt", tingkat: "merah", label: "Putusan belum diunggah ke e-Court" });
      expect(p.jelas).toMatch(/20 Oktober 2026/);
    }
  });

  it("sudah diunggah tetapi belum TTE panitera menyala merah dengan kalimat awam", () => {
    const [p] = nilai({ putus, putusanEcourt: catatan({ paniteraTte: false }) });
    expect(p).toMatchObject({ tingkat: "merah", label: "Putusan di e-Court belum ditandatangani panitera" });
  });

  it("diam bila lengkap, belum putus, atau e-Court belum pernah dibaca", () => {
    expect(nilai({ putus, putusanEcourt: catatan() })).toEqual([]);
    expect(nilai({ putus: null, putusanEcourt: catatan({ dokumenAda: false }) })).toEqual([]);
    expect(nilai({ putus, putusanEcourt: null })).toEqual([]);
  });

  it("terdaftar di katalog, nilaiPerkara, bagian terbaca, saklar, dan peran (panitera/PP bertugas)", () => {
    expect(ide.KODE_SAKLAR).toContain("putusan-ecourt");
    expect(KODE_IDE_L2).toContain("putusan-ecourt");
    expect(KUNCI_SAKLAR_IDE_L2["putusan-ecourt"]).toBe("ideL2PutusanEcourt");
    expect(PERAN_IDE_L2["putusan-ecourt"]).toEqual(expect.arrayContaining(["panitera", "panitera-pengganti", "hakim"]));
    expect(ide.kodeTerbaca({ putusanEcourt: false, putusan: true })["putusan-ecourt"]).toBe(false);
    expect(ide.kodeTerbaca({ putusanEcourt: true, putusan: true })["putusan-ecourt"]).toBe(true);
    const kini = { tanggal: "2026-10-22", menit: 600 };
    const f = {
      perkaraId: 1, nomor: "1/Pdt.G/2026/PA.Dgl", alur: 15, jenisId: 347, tglDaftar: "2026-01-01",
      putus, jadwal: [], ecourt: true, dokumenEcourt: [], tunjuk: {}, ikrar: null, aktaCerai: false,
      pbt: {}, sita: null, eksekusi: [], izin: null, durasi: null,
      putusanEcourt: catatan({ paniteraTte: false }),
    };
    expect(ide.nilaiPerkara(f, kini).map((p: { kode: string }) => p.kode)).toContain("putusan-ecourt");
    const popup = baca("ekstensi-sipp/popup-ide-l2.js");
    expect(popup).toContain('"putusan-ecourt": ["ketua", "hakim", "panitera-pengganti", "panitera"]');
    expect(baca("ekstensi-sipp/sipp-ide-l2.js")).toContain('"putusan-ecourt": "ideL2PutusanEcourt"');
    expect(baca("ekstensi-sipp/popup.html")).toContain('id="ideL2PutusanEcourt"');
  });
});

describe("keadaan putusan: dua ruas untuk Jadwal Sidang", () => {
  const sipp = { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", sudahPutus: true };
  it("belumDiunggah / belumTte mengikuti kesimpulan; belum ditarik tidak menuduh", () => {
    expect(putusanSvc.simpulkan(sipp, catatan({ dokumenAda: false }))).toMatchObject({ belumDiunggah: true, belumTte: false });
    expect(putusanSvc.simpulkan(sipp, catatan({ adaBaris: false }))).toMatchObject({ belumDiunggah: true });
    expect(putusanSvc.simpulkan(sipp, catatan({ paniteraTte: false }))).toMatchObject({ belumDiunggah: false, belumTte: true });
    expect(putusanSvc.simpulkan(sipp, catatan())).toMatchObject({ belumDiunggah: false, belumTte: false, perluTindakan: false });
    expect(putusanSvc.simpulkan(sipp, null)).toMatchObject({ belumDiunggah: false, belumTte: false, perluTindakan: false });
  });
});

describe("Jadwal Sidang: lencana MERAH dan kalimat awam", () => {
  const html = (k: unknown, kalimat = true) => renderToStaticMarkup(createElement(LencanaKeadaanPutusan, { keadaan: k as never, kalimat }));
  it("dua keadaan merah (danger, terang dan gelap lewat token Badge)", () => {
    const a = html({ keadaan: "salinan_belum_diunggah", sebutan: "x", perluTindakan: true, belumDiunggah: true, belumTte: false });
    const b = html({ keadaan: "belum_tte_panitera", sebutan: "x", perluTindakan: true, belumDiunggah: false, belumTte: true });
    expect(a).toContain("Putusan belum diunggah ke e-Court");
    expect(b).toContain("Putusan di e-Court belum ditandatangani panitera");
    for (const h of [a, b]) {
      expect(h).toContain("bg-rose-100");
      expect(h).toContain("dark:bg-rose-950");
    }
  });
  it("lengkap tidak menggambar apa pun; bentuk ringkas lama tetap", () => {
    expect(html({ keadaan: "lengkap", sebutan: "x", perluTindakan: false })).toBe("");
    expect(html({ keadaan: "belum_tte_panitera", sebutan: "x", perluTindakan: true, belumTte: true }, false)).toContain("Belum TTE panitera");
  });
  it("baris jadwal memberi lencana keadaan dari data jadwal (tanpa permintaan tambahan) dan rincian memakai kalimat", () => {
    const sidang = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(sidang).toMatch(/<EcourtLencanaPutusan[\s\S]{0,200}keadaan=\{baris\.putusanEcourt \?\? undefined\}[\s\S]{0,60}kalimat/);
    expect(baca("manajemen_surat/src/components/portal/ecourt-aksi-perkara.tsx")).toContain("<LencanaKeadaanPutusan keadaan={p} kalimat />");
  });
});

describe("tag perkara dan saringan Status Perkara", () => {
  it("dua tag e-Court merah, tersambung lewat nomor perkara ke hasil bacaan e-Court", () => {
    const a = tag.TAG["putusan-belum-unggah-ecourt"];
    const b = tag.TAG["putusan-belum-tte-ecourt"];
    for (const t of [a, b]) {
      expect(t).toMatchObject({ kelompok: "ecourt", nada: "bahaya" });
      expect(t.syarat).toContain("pu.tglPutus IS NOT NULL");
      expect(t.syarat).toContain("pe.nomor IS NOT NULL"); // belum pernah dibaca = tidak dituduh
    }
    expect(a.label).toBe("Putusan belum diunggah ke e-Court");
    expect(b.label).toBe("Putusan di e-Court belum ditandatangani panitera");
    expect(tag.SAMBUNGAN.pe.dari).toMatch(/aleta_bot_ecourt_putusan a$/);
    expect(tag.SAMBUNGAN.pe.pada).toBe("pe.nomor = p.nomor_perkara");
  });
});
