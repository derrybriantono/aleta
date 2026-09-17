/**
 * ============================================================================
 * JAM PENETAPAN TIDAK PERNAH MENDAHULUI PENDAFTARAN PERKARANYA
 * ============================================================================
 *
 * Dijalankan, bukan dibaca. Penjaga teks di berkas lain menahan kodenya agar
 * tidak hilang; ia tidak dapat menjawab pertanyaan yang sesungguhnya diajukan:
 * "kalau kasir mendaftarkan perkara ini pukul 13.32, jam berapa penetapannya
 * tercatat?"
 *
 * Sebabnya nyata. Diukur pada basis data peladen, 825 perkara 2026: PMH selalu
 * sesudah kasir, nol yang mendahului. Diukur pada sepuluh perkara uji yang
 * ditetapkan ALETA di salinan setempat: SATU yang melanggar - perkara 571,
 * didaftarkan pukul 09.34, penetapannya tercatat pukul 08.27.40. Jendela lama
 * 08:00-14:00 disusun tanpa mengetahui jam pendaftarannya.
 *
 * Dan itu bukan kejanggalan yang tersembunyi: tab Riwayat Perkara SIPP
 * mengurut menurut tanggal, sehingga baris Penetapan duduk DI ATAS baris
 * Pendaftaran Perkara - terbaca siapa pun yang membuka perkaranya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const sumber = readFileSync(
  path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"),
  "utf8"
).replace(/\r\n/g, "\n");

/** Tetapan puncak - satu baris, dibuka di kolom nol. */
function potongTetapan(nama: string[]): string {
  const baris = sumber.split("\n");
  const hasil: string[] = [];
  for (const n of nama) {
    const cocok = baris.find((b) => new RegExp(`^const ${n}\\s*=`).test(b));
    if (!cocok) throw new Error(`tetapan tidak ditemukan: ${n}`);
    hasil.push(cocok);
  }
  return hasil.join("\n");
}

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(nama: string[]): string {
  const baris = sumber.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();

  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }

  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Waktu = (arg: {
  perkaraId: number;
  tanggalPenetapan: string;
  jenis: string;
  saatServer: string;
  didaftar?: string | Date;
}) => string;

function muat(): Waktu {
  const kode = [
    potongTetapan([
      "URUTAN_LANGKAH_WAKTU",
      "JAM_MULAI_PALING_AWAL",
      "LEBAR_JENDELA_MULAI",
      "JEDA_MINIMUM",
      "JEDA_MAKSIMUM",
      "SEBARAN_GESER_MAKSIMUM",
      "AKHIR_JENDELA_MULAI",
      "JEDA_SESUDAH_DAFTAR",
      "LEBAR_JENDELA_MINIMUM",
    ]),
    potongFungsi([
      "waktuMysql",
      "tanggalSah",
      "benihDari",
      "duaAngkaWaktu",
      "jedaLangkah",
      "detikJeda",
      "rangkaianDetik",
      "lantaiMulaiMenit",
      "waktuLangkah",
    ]),
  ].join("\n\n");
  return new Function(`${kode}\nreturn waktuLangkah;`)() as Waktu;
}

const URUT = ["pmh", "ppp", "pjs", "phs"];

function rangkaian(
  perkaraId: number,
  tanggal: string,
  server: string,
  didaftar?: string | Date
): string[] {
  const waktuLangkah = muat();
  return URUT.map((jenis) =>
    waktuLangkah({ perkaraId, tanggalPenetapan: tanggal, jenis, saatServer: server, didaftar })
  );
}

const jam = (teks: string) => teks.slice(11);

describe("lantai jam penetapan", () => {
  it("perkara 571 yang dahulu melanggar kini tertahan pendaftarannya", () => {
    const w = rangkaian(10123, "2026-09-16", "2026-09-16 13:46:00", "2026-09-16 09:34:00");
    for (const satu of w) expect(jam(satu) >= "09:34:00", w.join(" ")).toBe(true);
    expect(jam(w[0]) >= "09:44:00", w[0]).toBe(true);
  });

  it("didaftarkan sore hari, jendela lama sudah lewat seluruhnya", () => {
    const w = rangkaian(10151, "2026-09-16", "2026-09-16 17:30:00", "2026-09-16 15:30:00");
    for (const satu of w) {
      expect(jam(satu) >= "15:30:00", w.join(" ")).toBe(true);
      expect(jam(satu) <= "17:30:00", w.join(" ")).toBe(true);
    }
  });

  it("sela tiga menit: dirapatkan, tetap menaik, tidak melampaui peladen", () => {
    const w = rangkaian(10152, "2026-09-16", "2026-09-16 10:15:00", "2026-09-16 10:00:00");
    for (const satu of w) {
      expect(jam(satu) >= "10:00:00", w.join(" ")).toBe(true);
      expect(jam(satu) <= "10:15:00", w.join(" ")).toBe(true);
    }
    for (let i = 1; i < w.length; i += 1) expect(w[i] >= w[i - 1], w.join(" ")).toBe(true);
  });

  it("didaftarkan kemarin tidak menahan apa pun - perilaku lama utuh", () => {
    const dengan = rangkaian(10153, "2026-09-16", "2026-09-16 13:00:00", "2026-09-15 14:00:00");
    const tanpa = rangkaian(10153, "2026-09-16", "2026-09-16 13:00:00");
    expect(dengan.join()).toBe(tanpa.join());
  });

  it("pendaftaran berbentuk Date - sebagaimana dipulangkan penggerak mysql", () => {
    const w = rangkaian(10123, "2026-09-16", "2026-09-16 13:46:00", new Date(2026, 8, 16, 9, 34, 0));
    for (const satu of w) expect(jam(satu) >= "09:34:00", w.join(" ")).toBe(true);
  });

  it("250 rangkaian: nol yang mendahului pendaftarannya", () => {
    const waktuLangkah = muat();
    let melanggar = 0;
    for (const pukul of ["07:15:00", "09:34:00", "11:05:00", "13:32:33", "15:30:00"]) {
      for (let id = 10100; id < 10150; id += 1) {
        const w = URUT.map((jenis) =>
          waktuLangkah({
            perkaraId: id,
            tanggalPenetapan: "2026-09-16",
            jenis,
            saatServer: "2026-09-16 16:45:00",
            didaftar: `2026-09-16 ${pukul}`,
          })
        );
        if (w.some((x) => jam(x) < pukul)) melanggar += 1;
        if (w.some((x, i) => i > 0 && x < w[i - 1])) melanggar += 1;
      }
    }
    expect(melanggar).toBe(0);
  });
});

describe("penjaga sumbernya", () => {
  it("jam pendaftaran dibaca dari tahapan 10 dan diteruskan ke waktuLangkah", () => {
    expect(sumber).toContain("WHERE pr.perkara_id = p.perkara_id AND pr.tahapan_id = 10) AS didaftar");
    expect(sumber).toContain("didaftar: perkara.didaftar,");
  });

  it("bukti luringnya ikut menguji lantai itu", () => {
    const bukti = readFileSync(
      path.join(AKAR, "aleta_bot/scripts/verify-waktu-penetapan.js"),
      "utf8"
    );
    expect(bukti).toContain("250 rangkaian: nol yang mendahului pendaftarannya");
    expect(bukti).toContain("didaftarkan kemarin: sama persis dengan tanpa pendaftaran");
  });
});
