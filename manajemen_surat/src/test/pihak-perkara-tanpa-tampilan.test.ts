/**
 * ============================================================================
 * PIHAK PERKARA DIBACA DARI TABELNYA, BUKAN DARI v_pihak_perkara
 * ============================================================================
 *
 * Bukan soal selera kueri - soal apakah panel ekstensi muncul atau tidak.
 *
 * Diukur pada salinan SIPP PA Donggala (10.110 perkara), satu perkara:
 * lewat `v_pihak_perkara` 7,48 detik, lewat kelima tabel `perkara_pihak1..5`
 * 0,12 detik. Konteks perkara seluruhnya turun dari 10,08 ke 0,88 detik.
 * Batasnya 8 detik di gerbang portal dan 9 detik di ekstensi, jadi bentuk lama
 * SELALU lewat tenggat: panelnya jatuh ke keterangan simpanan dan bagian
 * penetapan tidak pernah digambar.
 *
 * Sebabnya ada di bentuk tampilannya: ia menggabungkan kelima cabang pihak
 * dengan UNION dan membawa subkueri berkorelasi pada tiap baris, sehingga
 * saringan `nomor_perkara` tidak dapat didorong ke dalamnya - seluruh isi
 * tampilan disusun lebih dulu untuk mengambil dua baris.
 *
 * Yang dijaga di sini: jalur yang dipakai panel tidak boleh kembali ke
 * tampilan itu, kelima cabang harus tetap disebut (satu cabang hilang =
 * satu pihak hilang dari panggilan), dan jumlah parameternya harus mengikuti
 * jumlah cabangnya.
 *
 * Lihat juga memori v-pihak-perkara-lambat-dan-tidak-stabil.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const pekerja = readFileSync(
  path.join(AKAR, "aleta_bot/services/ecourtNotificationWorker.js"),
  "utf8"
).replace(/\r\n/g, "\n");

/** Badan fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) =>
    new RegExp(`^(?:async )?function ${nama}\\(`).test(b)
  );
  expect(mulai, `fungsi ${nama} tidak ditemukan`).toBeGreaterThan(-1);
  let akhir = mulai;
  while (akhir < baris.length && baris[akhir] !== "}") akhir += 1;
  expect(akhir, `penutup fungsi ${nama} tidak ditemukan`).toBeLessThan(baris.length);
  return baris.slice(mulai, akhir + 1).join("\n");
}

describe("fetchCaseParties tidak melewati v_pihak_perkara", () => {
  it("tampilan lambat itu tidak disebut lagi di dalam fungsinya", () => {
    expect(potongFungsi(pekerja, "fetchCaseParties")).not.toContain("v_pihak_perkara");
  });

  it("kelima cabang pihak disebut, sebagaimana tampilannya menyebutnya", () => {
    expect(pekerja).toContain("const CABANG_PIHAK = [1, 2, 3, 4, 5];");
    const badan = potongFungsi(pekerja, "fetchCaseParties");
    expect(badan).toContain("FROM perkara_pihak${ke} a");
    expect(badan).toContain("${ke} AS pihak_ke");
  });

  it("parameternya sebanyak cabang ditambah satu untuk pengacara", () => {
    const badan = potongFungsi(pekerja, "fetchCaseParties");
    expect(badan).toContain("CABANG_PIHAK.map(() => nomorPerkara).concat([nomorPerkara])");
    expect(badan).not.toContain("runQuery(sql, [nomorPerkara, nomorPerkara])");
  });

  it("kuasa hukum tetap ikut - cabangnya tidak ikut terhapus", () => {
    const badan = potongFungsi(pekerja, "fetchCaseParties");
    expect(badan).toContain("perkara_pengacara");
    expect(badan).toContain("'kuasa' AS jenis");
  });
});
