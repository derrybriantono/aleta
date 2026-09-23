// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * NAMA JURUSITA PADA RELAAS - DIBACA DARI AKUN PENGGUNANYA, BUKAN TABEL JURUSITA
 * ============================================================================
 *
 * perkara_pelaksanaan_relaas.jurusita_id BUKAN id jurusita. Ia userid pengguna
 * SIPP - yang disimpan di sana akun orang yang MENGINPUT relaasnya.
 * Dibuktikan oleh SIPP sendiri: data_relaas_c.php menulis
 * 'jurusita_id' => $this->session->userdata('userid').
 *
 * Diukur pada 14.495 baris relaas satker, 23 September 2026:
 *
 *     ke perkara_jurusita.jurusita_id        0 dari 14.495  (0%)
 *     ke jurusita.id                     7.101 dari 14.495  (49%)
 *     ke sys_users.userid               14.490 dari 14.495  (99,97%)
 *
 * Bukti ketiga yang berdiri sendiri: kolom diinput_oleh pada baris yang sama
 * mencocokkan sys_users.username pada 14.490 dari 14.490 - seratus persen.
 *
 * ============================================================================
 * KENAPA INI BUKAN SEKADAR KERAPIAN
 * ============================================================================
 *
 * Lapisan peta ini menyebut SIAPA YANG MELAYANI DESA MANA. Sambungan yang
 * keliru membuat 4.374 dari 7.101 baris bernama menyebut ORANG LAIN:
 *
 *     userid 20 tertulis "MOH.SAM'AN"          sebenarnya Nurhadi      2.016
 *     userid 21 tertulis "Mohammad Syukri, SH" sebenarnya Aguslin      1.041
 *     userid 17 tertulis "Moh.Syukri"          sebenarnya Muh. Sam'an    478
 *
 * dan dua jurusita TERSIBUK - Tanty Restianty 3.279 relaas dan Mustini 2.429 -
 * tidak pernah muncul sama sekali, sebab userid mereka tidak ada di tabel
 * `jurusita`.
 *
 * Catatan lama di berkas itu menyimpulkan keempat ejaan tersebut adalah satu
 * orang yang sama, lalu memutuskan tidak menyatukannya. Kesimpulan itu keliru:
 * mereka empat orang yang berbeda, dan keputusannya justru mengawetkan
 * kesalahannya.
 */

const akar = path.resolve(process.cwd(), "..");
const lapisan = readFileSync(
  path.join(akar, "aleta_bot/services/lapisanPetaService.js"),
  "utf8"
).replace(/\r\n/g, "\n");

const badanJurusita = () => {
  const i = lapisan.indexOf("async function jurusitaDesa(");
  expect(i, "jurusitaDesa tidak ditemukan").toBeGreaterThan(-1);
  return lapisan.slice(i, lapisan.indexOf("\n}", i));
};

describe("nama jurusita dibaca dari sys_users", () => {
  it("menyambung ke sys_users.userid, bukan ke jurusita.id", () => {
    const badan = badanJurusita();
    expect(badan).toContain("LEFT JOIN sys_users u ON u.userid = r.jurusita_id");
    expect(badan, "sambungan lama yang keliru kembali").not.toContain(
      "LEFT JOIN jurusita js ON js.id = r.jurusita_id"
    );
  });

  it("diinput_oleh menjadi cadangan namanya", () => {
    // Kolom itu mencocokkan sys_users.username pada 100% baris yang punya
    // pengguna, jadi ia cadangan yang sungguh menutup celahnya - bukan
    // tempelan. Lima baris yang useridnya tidak ada mana pun tetap kosong,
    // dan kosong lebih jujur daripada nama yang ditebak.
    const badan = badanJurusita();
    expect(badan).toContain("NULLIF(r.diinput_oleh, '')");
  });

  it("sebabnya TERTULIS, beserta angkanya", () => {
    // Tanpa angkanya, perapian berikutnya akan mengembalikannya ke tabel
    // `jurusita` - yang namanya memang terdengar lebih benar.
    expect(lapisan).toContain("sys_users.userid");
    expect(lapisan).toContain("99,97%");
    expect(lapisan).toContain("data_relaas_c.php");
  });

  it("cerita lama 'satu orang, lima ejaan' TIDAK kembali", () => {
    // Cerita itu terdengar cermat dan salah ke arah yang paling merugikan.
    expect(lapisan, "kesimpulan lama yang keliru kembali").not.toContain(
      "Empat baris itu satu orang"
    );
    expect(lapisan).toContain("lima orang yang berbeda".toUpperCase());
  });

  it("keterangan di layar menyebut keadaan yang BENAR", () => {
    // Keterangan lama memberi tahu pembacanya bahwa namanya terbaca 49% dan
    // bahwa ejaannya rangkap - dua-duanya keliru, dan keduanya membuat orang
    // memaafkan angka yang sebenarnya salah.
    const badan = badanJurusita();
    expect(badan).toContain("14.490 dari 14.495");
    expect(badan, "keterangan lama masih ada").not.toContain("7.101 dari");
  });
});
