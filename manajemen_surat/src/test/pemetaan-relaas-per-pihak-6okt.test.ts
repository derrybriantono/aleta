// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { blangkoMenurutPemetaan, pecahDokumenPerPihak } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { bawaanPemetaan, KUNCI_BAKU, uraiKunciRelaas } from "@/lib/pemetaan-blangko";
import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

/**
 * 6 Okt 2026, butir 10: relaas sidang pertama, sidang lanjutan, dan
 * pemberitahuan putusan HARUS sesuai pihaknya - Penggugat/Pemohon blangko P,
 * Tergugat/Termohon blangko T. Blangko gabungan hanya bila memang hanya itu
 * (ikrar talak). Nama berkas = folder ABT satker derry_briantono/Relaas
 * (dibaca `ls -b` di server 6 Okt 2026).
 */
const ABT_SATKER = [
  "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf",
  "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf",
  "[JS] 0. Relaas Panggilan Sidang Pertama T.rtf",
  "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
  "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
  "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
  "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
  "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf",
  "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf",
  "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf",
];
const GABUNGAN = "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf";

/** Kunci per pihak -> blangko yang WAJIB dipakai. */
const HARAP: Record<string, string> = {
  "relaas-panggilan-sidang-pertama-penggugat": "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf",
  "relaas-panggilan-sidang-pertama-pemohon": "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf",
  "relaas-panggilan-sidang-pertama-tergugat": "[JS] 0. Relaas Panggilan Sidang Pertama T.rtf",
  "relaas-panggilan-sidang-pertama-termohon": "[JS] 0. Relaas Panggilan Sidang Pertama T.rtf",
  "panggilan-penggugat": "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
  "panggilan-pemohon": "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
  "panggilan-tergugat": "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
  "panggilan-termohon": "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
  "pbt-penggugat": "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
  "pbt-pemohon": "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
  "pbt-tergugat": "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
  "pbt-termohon": "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
  "panggilan-ikrar": "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf",
  delegasi: "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf",
  amplop: "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf",
};

const petaBawaan = (jenis: "relaas" | "pbt") =>
  Object.fromEntries(bawaanPemetaan(jenis).map((b) => [b.kunci, b.namaBerkas]));

describe("bawaan pemetaan relaas/PBT per pihak (6 Okt, butir 10)", () => {
  it("nama blangko bawaan = nama berkas di folder ABT satker, persis", () => {
    expect(BLANGKO_RELAAS.map((b) => b.berkas).sort()).toEqual([...ABT_SATKER].sort());
  });

  it("tiap kunci per pihak -> blangko pihak yang benar", () => {
    const peta = { ...petaBawaan("relaas"), ...petaBawaan("pbt") };
    for (const [kunci, berkas] of Object.entries(HARAP)) expect(peta[kunci], kunci).toBe(berkas);
  });

  it("tidak ada kunci berpihak yang berbawaan blangko gabungan", () => {
    const semua = [...bawaanPemetaan("relaas"), ...bawaanPemetaan("pbt")];
    for (const b of semua) {
      if (uraiKunciRelaas(b.kunci).pihak) expect(b.namaBerkas, b.kunci).not.toBe(GABUNGAN);
    }
    // Gabungan hanya untuk kunci tanpa pihak.
    expect(semua.filter((b) => b.namaBerkas === GABUNGAN).map((b) => b.kunci)).toEqual(["panggilan-sidang-pertama"]);
  });

  it("kunci baku relaas memuat sidang pertama per pihak (kunci yang dibuat admin di server)", () => {
    const kunci = KUNCI_BAKU.relaas.map((k) => k.kunci);
    for (const p of ["penggugat", "tergugat", "pemohon", "termohon"]) {
      expect(kunci).toContain(`relaas-panggilan-sidang-pertama-${p}`);
    }
  });
});

describe("pemilih kunci per pihak - tidak ada 3.b bila blangko per pihak ada", () => {
  const relaas = petaBawaan("relaas");
  const pbt = petaBawaan("pbt");
  const kasus = [
    { golongan: "sidang-pertama", pihak: "pertama", harap: HARAP["relaas-panggilan-sidang-pertama-penggugat"] },
    { golongan: "sidang-pertama", pihak: "kedua", harap: HARAP["relaas-panggilan-sidang-pertama-tergugat"] },
    { golongan: "sidang-ditunda", pihak: "pertama", harap: HARAP["panggilan-penggugat"] },
    { golongan: "sidang-lanjutan", pihak: "kedua", harap: HARAP["panggilan-tergugat"] },
    { golongan: "pemberitahuan-putusan", pihak: "pertama", harap: HARAP["pbt-penggugat"] },
    { golongan: "pemberitahuan-putusan", pihak: "kedua", harap: HARAP["pbt-tergugat"] },
  ];
  for (const alur of [15, 16]) {
    for (const k of kasus) {
      it(`${k.golongan} ${k.pihak} (alur ${alur}) -> ${k.harap}`, () => {
        const dok = { golongan: k.golongan, pihakDipanggil: k.pihak, alurPerkaraId: alur };
        expect(blangkoMenurutPemetaan(dok, relaas, pbt)?.berkas).toBe(k.harap);
        const n = nilaiCetakDokumen({ ...dok, perkaraId: 1, d: 1 }, null, { relaas, pbt });
        expect(n.blangko?.berkas).toBe(k.harap);
      });
    }
  }

  it("data server 2 Okt (sidang pertama diarahkan ke '1. ... Lanjutan') TETAP dipakai bila belum diperbaiki - perbaikan data wajib", () => {
    // Admin di atas bawaan: pemilih tidak menebak. Inilah sebab skrip perbaikan data.
    const salah = { ...relaas, "relaas-panggilan-sidang-pertama-penggugat": HARAP["panggilan-penggugat"] };
    expect(blangkoMenurutPemetaan({ golongan: "sidang-pertama", pihakDipanggil: "pertama" }, salah, pbt)?.berkas).toBe(
      HARAP["panggilan-penggugat"]
    );
  });

  it("dokumen 'keduanya' dipecah menjadi P dan T - tidak satu pun memakai gabungan", () => {
    for (const golongan of ["sidang-pertama", "sidang-ditunda", "pemberitahuan-putusan"]) {
      const dok = { kunci: `${golongan}:9:1:0`, perkaraId: 9, d: 1, golongan, pihakDipanggil: "keduanya", pihakKe: null };
      const pecah = pecahDokumenPerPihak(dok, relaas, pbt);
      expect(pecah, golongan).toHaveLength(2);
      expect(pecah.map((x) => x.pihakDipanggil)).toEqual(["pertama", "kedua"]);
      expect(new Set(pecah.map((x) => x.kunci)).size).toBe(2);
      for (const x of pecah) {
        const n = nilaiCetakDokumen(x, null, { relaas, pbt });
        expect(n.blangko?.berkas).not.toBe(GABUNGAN);
        expect(n.bisaDicetak, n.sebabTidakBisa).toBe(true);
      }
    }
  });

  it("ikrar talak tidak dipecah - blangkonya hanya gabungan", () => {
    const dok = { kunci: "ikrar-talak:9:4:0", perkaraId: 9, d: 4, golongan: "ikrar-talak", pihakDipanggil: "keduanya", pihakKe: null };
    expect(pecahDokumenPerPihak(dok, relaas, pbt)).toHaveLength(1);
    expect(nilaiCetakDokumen(dok, null, { relaas, pbt }).blangko?.berkas).toBe(HARAP["panggilan-ikrar"]);
  });

  it("admin memetakan P dan T ke satu berkas yang sama -> tetap satu dokumen", () => {
    const sama = {
      ...relaas,
      "relaas-panggilan-sidang-pertama-penggugat": GABUNGAN,
      "relaas-panggilan-sidang-pertama-tergugat": GABUNGAN,
    };
    const dok = { kunci: "sidang-pertama:9:1:0", perkaraId: 9, d: 1, golongan: "sidang-pertama", pihakDipanggil: "keduanya", pihakKe: null };
    expect(pecahDokumenPerPihak(dok, sama, pbt)).toHaveLength(1);
  });
});

describe("ekstensi - bawaan tertanam mencerminkan bawaan server", () => {
  it("JURUSITA_TERTANAM = HARAP untuk tiap kunci per pihak", () => {
    const js = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/jurusita.js"), "utf8");
    const konstanta = Object.fromEntries(
      [...js.matchAll(/const (JURUSITA_BLANGKO_[A-Z_]+) = "([^"]+)";/g)].map((m) => [m[1], m[2]])
    );
    const blok = /const JURUSITA_TERTANAM = \{([\s\S]*?)\n\};/.exec(js)![1];
    const peta = Object.fromEntries(
      [...blok.matchAll(/"?([a-z-]+)"?: (JURUSITA_BLANGKO_[A-Z_]+),/g)].map((m) => [m[1], konstanta[m[2]]])
    );
    for (const [kunci, berkas] of Object.entries(HARAP)) {
      if (kunci === "delegasi" || kunci === "amplop") continue;
      expect(peta[kunci], kunci).toBe(berkas);
    }
    expect(peta["panggilan-sidang-pertama"]).toBe(GABUNGAN);
  });
});
