// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KETERANGAN SAKSI PADA PERKARA PERMOHONAN DAN CERAI TALAK
 * ============================================================================
 *
 * Kata pengguna 22 September 2026: "sepertinya kalau perkara permohonan dan
 * cerai talak pencarian deteksi keterangan saksi untuk input abt belum konek
 * dan tidak menemukannya padahal keterangan saksi sudah jelas hanya saja
 * penyebutannya pemohon atau termohon".
 *
 * Benar, dan sebabnya satu baris: fungsi siapa() hanya mencari untai
 * "tergugat" dan "penggugat". Kalimat "Yang meninggalkan tempat tinggal
 * bersama adalah Termohon;" DITEMUKAN - kutipannya tetap tampil di panel -
 * tetapi nilainya kosong, dan lencananya berbunyi "tidak ditemukan".
 *
 * Terukur pada abt_keterangan_saksi (66.506 jawaban): dari 4.337 jawaban yang
 * memuat kata "meninggalkan", 846 (19,5%) HANYA menyebut Pemohon/Termohon,
 * menyentuh 331 perkara.
 *
 * ============================================================================
 * JEBAKAN YANG HARUS DIJAGA SELAMANYA
 * ============================================================================
 *
 *   pihak.pelaku = variabel ABT 0047 = "Tergugat" / "Termohon"
 *   pihak.lawan  = variabel ABT 0046 = "Penggugat" / "Pemohon"
 *
 * Kebalikan dari yang disangka namanya. Dua tempat sudah pernah tertukar
 * karenanya, dan salah satunya menulis pihak yang keliru ke jawaban "siapa
 * yang meninggalkan kediaman bersama" - keterangan yang masuk berita acara
 * sidang yang ditandatangani.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));

type Usulan = { kode: string; nilai: string; keyakinan: string };
type Hasil = { usulan: Usulan[] };
type Layanan = {
  dariKeteranganSaksi: (
    a: string,
    b: string,
    c?: string,
    d?: { pelaku?: string; lawan?: string },
    e?: string
  ) => Hasil;
};

const layanan = require_(
  path.join(akar, "aleta_bot/services/abtUsulanService.js")
) as Layanan;

const ambil = (h: Hasil, kode: string) =>
  h.usulan.find((x) => x.kode === kode) ?? { kode, nilai: "", keyakinan: "kosong" };

/** Persis bentuk yang diketik petugas pada perkara cerai talak. */
const TALAK_1 = [
  "- Bahwa saksi kenal dengan Pemohon karena saksi adalah kakak kandung Pemohon;",
  "- Bahwa antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa Pemohon dan Termohon sudah pisah tempat tinggal sejak Januari 2026, sampai sekarang sudah sekitar 8 (delapan) bulan;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Termohon;",
  "- Bahwa Pemohon dan Termohon sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;",
].join("\n");

const TALAK_2 = [
  "- Bahwa saksi kenal dengan Pemohon karena saksi adalah ponakan Pemohon;",
  "- Bahwa antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa Pemohon dan Termohon sudah pisah tempat tinggal sejak Januari 2026, sampai sekarang sudah sekitar 8 (delapan) bulan;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Termohon;",
  "- Bahwa Pemohon dan Termohon sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;",
].join("\n");

/** Sebutan pihak sebagaimana ABT mengirimkannya - perhatikan ruasnya. */
const PIHAK_TALAK = { pelaku: "Termohon", lawan: "Pemohon" };
const PIHAK_GUGAT = { pelaku: "Tergugat", lawan: "Penggugat" };

describe("7035 - siapa yang meninggalkan kediaman bersama", () => {
  it("cerai talak: menjawab Termohon, bukan kosong", () => {
    const u = ambil(layanan.dariKeteranganSaksi(TALAK_1, TALAK_2, "", PIHAK_TALAK), "7035");
    expect(u.nilai, "inilah yang dulu kosong dan berbunyi 'tidak ditemukan'").toBe("Termohon");
    expect(u.keyakinan).not.toBe("kosong");
  });

  it("gugatan tetap menjawab Tergugat - tidak ada yang rusak", () => {
    const G1 = TALAK_1.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat");
    const G2 = TALAK_2.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat");
    expect(ambil(layanan.dariKeteranganSaksi(G1, G2, "", PIHAK_GUGAT), "7035").nilai).toBe(
      "Tergugat"
    );
  });

  it("SEBUTANNYA TIDAK TERTUKAR - yang pergi Termohon, bukan Pemohon", () => {
    // Jebakan penamaan ruas. Bila pelaku/lawan tertukar, jawabannya menjadi
    // "Pemohon" - pihak yang justru mengajukan perkaranya - dan kalimat itu
    // masuk berita acara sidang yang ditandatangani.
    const u = ambil(layanan.dariKeteranganSaksi(TALAK_1, TALAK_2, "", PIHAK_TALAK), "7035");
    expect(u.nilai, "pihaknya tertukar").not.toBe("Pemohon");
  });

  it("yang PERGI PEMOHON pun terbaca benar", () => {
    const P1 = TALAK_1.replace(
      "adalah Termohon;",
      "adalah Pemohon;"
    );
    const P2 = TALAK_2.replace("adalah Termohon;", "adalah Pemohon;");
    expect(ambil(layanan.dariKeteranganSaksi(P1, P2, "", PIHAK_TALAK), "7035").nilai).toBe(
      "Pemohon"
    );
  });

  it('bentuk "meninggalkan rumah" ikut terbaca', () => {
    // 442 jawaban memakai bentuk "pergi meninggalkan rumah kediaman bersama".
    // Untai "meninggalkan kediaman" tidak cocok - ada kata "rumah" di
    // tengahnya - jadi seluruhnya dulu jatuh kosong.
    const R = [
      "- Bahwa antara Pemohon dan Termohon sering terjadi perselisihan sejak 2019;",
      "- Bahwa Termohon yang pergi meninggalkan rumah kediaman bersama, namun Termohon masih sering kembali;",
    ].join("\n");
    expect(ambil(layanan.dariKeteranganSaksi(R, R, "", PIHAK_TALAK), "7035").nilai).toBe(
      "Termohon"
    );
  });

  it("tanpa sebutan pihak, jatuh ke bentuk gugatan - bukan kosong", () => {
    // Perkara yang variabel 0046/0047-nya belum terbaca tetap mendapat
    // jawaban; menolak menjawab karena sebutannya belum ada hanya
    // mengosongkan blangko yang dapat diisi.
    const G1 = TALAK_1.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat");
    expect(ambil(layanan.dariKeteranganSaksi(G1, G1), "7035").nilai).toBe("Tergugat");
  });
});

describe("1268 - upaya damai keluarga bersebutan pihak perkaranya", () => {
  it("cerai talak: mendamaikan Pemohon dan Termohon", () => {
    const u = ambil(layanan.dariKeteranganSaksi(TALAK_1, TALAK_2, "", PIHAK_TALAK), "1268");
    expect(u.nilai).toContain("Pemohon dan Termohon");
    expect(u.nilai, "kalimat gugatan tidak boleh muncul di perkara permohonan").not.toContain(
      "Penggugat dan Tergugat"
    );
  });

  it("gugatan tetap berbunyi Penggugat dan Tergugat", () => {
    const G1 = TALAK_1.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat");
    const G2 = TALAK_2.replace(/Pemohon/g, "Penggugat").replace(/Termohon/g, "Tergugat");
    expect(
      ambil(layanan.dariKeteranganSaksi(G1, G2, "", PIHAK_GUGAT), "1268").nilai
    ).toContain("Penggugat dan Tergugat");
  });

  it("yang MENGAJUKAN disebut lebih dulu", () => {
    // Urutannya bukan selera: kalimatnya menerangkan siapa yang didamaikan
    // dengan siapa, dan membaliknya menempatkan termohon sebagai pengaju.
    const u = ambil(layanan.dariKeteranganSaksi(TALAK_1, TALAK_2, "", PIHAK_TALAK), "1268");
    expect(u.nilai.indexOf("Pemohon")).toBeLessThan(u.nilai.indexOf("Termohon"));
  });
});

describe("jebakan penamaan ruas dijaga di sumbernya", () => {
  const sumber = readFileSync(
    path.join(akar, "aleta_bot/services/abtUsulanService.js"),
    "utf8"
  ).replace(/\r\n/g, "\n");

  it("faktaDariPosita tidak lagi tertukar", () => {
    // Sampai 2.32.0: `siapaPergi = lawan` ketika kalimatnya menyebut
    // Tergugat, padahal lawan berisi 0046 = Penggugat. Cadangan harfiahnya
    // justru benar, jadi cacatnya hanya muncul ketika variabelnya sungguh
    // terbaca - yaitu pada pemakaian normal.
    const i = sumber.indexOf("let siapaPergi = \"\";");
    expect(i).toBeGreaterThan(-1);
    const blok = sumber.slice(i, i + 420);
    expect(blok).toContain('siapaPergi = pelaku || "Tergugat"');
    expect(blok).toContain('siapaPergi = lawan || "Penggugat"');
    expect(blok, "tertukar kembali").not.toContain('siapaPergi = lawan || "Tergugat"');
    expect(blok, "tertukar kembali").not.toContain('siapaPergi = pelaku || "Penggugat"');
  });

  it("pasangannya TERTULIS di sumbernya, supaya tidak ditebak lagi", () => {
    expect(sumber).toContain("0047");
    expect(sumber).toContain("0046");
  });
});
