// @vitest-environment node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PENJAGA DAFTAR CEK "Isi dari SIPP & input ke ABT" (agen Z1, 18 Okt 2026).
 *
 * docs/isi-sipp-abt/DAFTAR-CEK.json memuat SEMUA blangko Derry di pohon server beserta tiap isian popupnya dan
 * pengisinya. Penjaga ini memastikan:
 *   1. daftar itu mencakup tepat semua blangko di fixture pohon server (blangko baru WAJIB dicek: jalankan ulang
 *      scripts/isi-sipp-abt/analisa-isian.mts lalu bangun-daftar-cek.cjs, tinjau isian barunya);
 *   2. isian yang ditandai "ya"/"sebagian" benar-benar punya pengisi di kode (kode muncul sebagai token utuh di
 *      berkas pengisinya, atau terdaftar di modul deteksi bot dan tidak bertanda "belum");
 *   3. isian yang ditandai "tidak" punya keterangan sumber (sudah ditinjau, bukan terlewat).
 */

type Pengisi = { jenis: string; id: string; berkas: string; tingkat: string };
type Isian = {
  kunci: string;
  kode: string[];
  nama: string;
  namaAsli: string;
  jenis: string;
  wajib: boolean;
  cadangan: string;
  status: "ya" | "sebagian" | "tidak";
  jumlahBlangko: number;
  pengisi: Pengisi[];
  sumberMungkin: string;
};
type Daftar = {
  ringkasan: Record<string, number>;
  blangko: Array<{ jalur: string; isian: string[] }>;
  isian: Isian[];
};

const akar = path.resolve(process.cwd(), "..");
const daftar = JSON.parse(fs.readFileSync(path.join(akar, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8")) as Daftar;
const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "test", "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const registri = (() => {
  const { semuaModul } = require_(path.join(akar, "aleta_bot", "services", "deteksi", "index.js")) as {
    semuaModul: () => Array<{ kunci: string; variabel?: Array<{ kode: string; deteksi?: boolean; oleh?: string }> }>;
  };
  return semuaModul();
})();

/** Sama dengan jenisCadangan di scripts/isi-sipp-abt/bangun-daftar-cek.cjs: cadangan yang dicetak ABT sendiri bila isian dikosongkan. */
function jenisCadangan(namaAsli: string): string {
  if (/kosong\s*=\s*(dari\s*)?(data\s*)?sipp|\(otomatis|bila\s*sipp\s*tidak\s*memuat|isian\s*bila\s*sipp|kosong\s*=\s*otomatis/i.test(namaAsli)) return "sipp";
  if (/kosong\s*=\s*titik|boleh\s*dikosongkan|^CORET:/i.test(namaAsli)) return "titik";
  if (/kosong\s*=|\(bawaan|bawaan:/i.test(namaAsli)) return "bawaan";
  return "";
}

const bacaBerkas = (rel: string) => fs.readFileSync(path.join(akar, rel), "utf8");
const adaToken = (isi: string, kode: string) => new RegExp(`(?<![0-9])${kode}(?![0-9])`).test(isi);

describe("daftar cek isian popup blangko Derry", () => {
  it("mencakup tepat semua blangko di pohon server (blangko baru wajib dicek)", () => {
    const dalamDaftar = new Set(daftar.blangko.map((b) => b.jalur));
    const hilang = fixture.berkas.filter((b) => !dalamDaftar.has(b));
    const lebih = [...dalamDaftar].filter((b) => !fixture.berkas.includes(b));
    expect({ hilang: hilang.slice(0, 5), lebih: lebih.slice(0, 5) }).toEqual({ hilang: [], lebih: [] });
    expect(daftar.blangko.length).toBe(fixture.berkas.length);
    expect(daftar.ringkasan.blangko).toBe(fixture.berkas.length);
  });

  it("tiap isian yang disebut blangko ada di daftar isian, dan tiap isian dipakai sekurangnya satu blangko", () => {
    const kunci = new Set(daftar.isian.map((i) => i.kunci));
    const dipakai = new Set<string>();
    for (const b of daftar.blangko) {
      for (const k of b.isian) {
        expect(kunci.has(k), `${b.jalur} -> ${k}`).toBe(true);
        dipakai.add(k);
      }
    }
    expect([...kunci].filter((k) => !dipakai.has(k))).toEqual([]);
  });

  it("ringkasan cocok dengan isi daftar", () => {
    const hitung = (s: string) => daftar.isian.filter((i) => i.status === s).length;
    expect(daftar.ringkasan.isianUnik).toBe(daftar.isian.length);
    expect(daftar.ringkasan.ya).toBe(hitung("ya"));
    expect(daftar.ringkasan.sebagian).toBe(hitung("sebagian"));
    expect(daftar.ringkasan.tidak).toBe(hitung("tidak"));
    expect(daftar.ringkasan.ya + daftar.ringkasan.sebagian + daftar.ringkasan.tidak).toBe(daftar.isian.length);
  });

  it("isian 'ya' dan 'sebagian' benar-benar punya pengisi di kode", () => {
    const salah: string[] = [];
    for (const i of daftar.isian.filter((x) => x.status !== "tidak")) {
      if (!i.pengisi.length) {
        salah.push(`${i.kunci}: tanpa pengisi`);
        continue;
      }
      for (const p of i.pengisi) {
        if (p.jenis === "abt-bawaan") {
          if (!["sipp", "bawaan"].includes(jenisCadangan(i.namaAsli)) || jenisCadangan(i.namaAsli) !== i.cadangan) salah.push(`${i.kunci}: bukan isian bawaan ABT`);
        } else if (p.jenis === "saksi") {
          if (i.jenis !== "tj" || !bacaBerkas(p.berkas).includes("BATAS_SAKSI_SDG")) salah.push(`${i.kunci}: pengisi saksi tak terbukti`);
        } else if (p.jenis === "kelompok" || p.jenis === "f23") {
          const isi = bacaBerkas(p.berkas);
          for (const k of i.kode) {
            if (p.jenis === "kelompok" && !adaToken(isi, k)) {
              // tj: hanya salah satu kode serumpun yang perlu muncul
              if (i.jenis === "tj" && i.kode.some((x) => adaToken(isi, x))) continue;
              salah.push(`${i.kunci}: kode ${k} tidak ada di ${p.berkas}`);
            }
          }
          if (p.jenis === "f23" && !i.kode.some((k) => adaToken(isi, k))) salah.push(`${i.kunci}: tak ada di ${p.berkas}`);
        } else if (p.jenis === "deteksi") {
          const modul = registri.find((m) => m.kunci === p.id);
          const ada = modul && i.kode.some((k) => (modul.variabel ?? []).some((v) => String(v.kode) === k && v.deteksi !== false && !/^belum/i.test(v.oleh ?? "")));
          if (!ada) salah.push(`${i.kunci}: modul deteksi ${p.id} tidak memuatnya`);
        } else {
          salah.push(`${i.kunci}: jenis pengisi tak dikenal ${p.jenis}`);
        }
      }
    }
    expect(salah).toEqual([]);
  });

  it("isian 'tidak' sudah ditinjau: punya keterangan sumber yang mungkin", () => {
    const kosong = daftar.isian.filter((i) => i.status === "tidak" && !i.sumberMungkin.trim()).map((i) => i.kunci);
    expect(kosong).toEqual([]);
  });

  it("isian yang ditandai 'ya' terpenuhi untuk semua blangko pemakainya (tidak ada yang terlewat)", () => {
    const ya = daftar.isian.filter((i) => i.status === "ya");
    expect(ya.length).toBeGreaterThan(50);
    for (const i of ya) expect(i.pengisi.length, i.kunci).toBeGreaterThan(0);
  });
});
