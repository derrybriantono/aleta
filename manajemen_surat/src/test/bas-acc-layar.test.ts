// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ACC HAKIM SAMPAI KE LAYAR - PENJAGA TANPA BASIS DATA
 * ============================================================================
 *
 * Aturannya sudah diuji atas basis data sungguhan di bas-acc-hakim. Yang
 * dijaga di sini penyambungannya: aturan yang benar tetapi tidak pernah sampai
 * ke layar sama tidak bergunanya dengan aturan yang tidak ada - dan itu persis
 * yang terjadi pada rubrik penilaian, yang rutenya sudah lama ada di bot tanpa
 * satu pun jalan dari portal menuju ke sana.
 *
 * Berkas ini sengaja TIDAK menyentuh basis data. Uji yang menyemai basis data
 * penuh berjalan bermenit-menit; penjagaan penyambungan tidak menuntut ongkos
 * itu, dan penjaga yang mahal adalah penjaga yang lama-lama dilewati orang.
 */

const akar = path.resolve(process.cwd());

const baca = (relatif: string) => readFileSync(path.join(akar, relatif), "utf8");

describe("kewenangan acc sampai ke layar", () => {
  it("kedua rute pembaca lembar membawa bolehAcc", () => {
    // Dua rute membaca lembar - satu untuk daftar, satu untuk lembar yang
    // sedang diisi. Yang membawa kewenangannya hanya salah satu berarti
    // tombolnya muncul di satu layar dan hilang di layar lain, untuk orang
    // yang sama.
    for (const rute of [
      "src/app/api/aleta-ecourt/bas/lembar/route.ts",
      "src/app/api/aleta-ecourt/bas/tanya-jawab/route.ts",
    ]) {
      const isi = baca(rute);
      expect(isi, rute).toContain("bolehMengacc(db, actorUserId)");
    }
  });

  it("bolehAcc BUKAN penjagaan - penjagaannya tetap di peladen", () => {
    // Kalau kelak seseorang menyimpulkan bahwa memeriksa di layar sudah
    // cukup, penjagaan sebenarnya akan dicabut sebagai "pemeriksaan ganda".
    // Alasannya karena itu tertulis di berkas aturannya, bukan hanya di sini.
    const isi = baca("src/server/modules/aleta-ecourt/bas-acc.ts");
    expect(isi).toContain("TIDAK dipakai sebagai penjagaan");
    // Dan jalur tulisnya tetap memeriksa sendiri.
    expect(isi).toContain("await pastikanPengacc(db, actorUserId)");
  });

  it("rutenya menolak tindakan yang tidak dikenali, tidak menebak", () => {
    // Menebak di sini berarti satu salah ketik dapat meng-acc lembar yang
    // sebenarnya hendak dikembalikan.
    const isi = baca("src/app/api/aleta-ecourt/bas/acc/route.ts");
    expect(isi).toContain("Tindakan tidak dikenali");
  });
});

describe("layar menampilkan keadaan accnya", () => {
  const layar = () => baca("src/components/portal/bas-lembar-isian.tsx");

  it("keempat keadaan punya sebutannya", () => {
    const isi = layar();
    for (const sebutan of [
      "Masih diisi panitera",
      "Menunggu acc hakim",
      "Dikembalikan hakim",
      "Sudah di-acc hakim",
    ]) {
      expect(isi, sebutan).toContain(sebutan);
    }
  });

  it("bilahnya digambar untuk siapa pun, tombolnya hanya bila boleh", () => {
    // Panitera yang tidak dapat melihat keadaan accnya tidak tahu apakah
    // pekerjaannya sudah diperiksa - dan yang paling perlu dilihatnya justru
    // pengembalian beserta alasannya.
    const isi = layar();
    expect(isi).toContain("<BilahAcc");
    expect(isi).toContain("boleh={Boolean(lembar.bolehAcc)}");
    expect(isi).toContain("{boleh && keadaan !== \"belum-selesai\" ? (");
  });

  it("alasan pengembalian ditampilkan apa adanya, tidak disingkat", () => {
    // Alasan yang terpotong memaksa panitera menebak sisanya, dan tebakan
    // yang salah menghasilkan pengembalian kedua atas hal yang sama.
    const isi = layar();
    expect(isi).toContain('keadaan === "dikembalikan" && alasan ?');
    expect(isi).not.toContain("alasan.slice(0,");
  });

  it("pengembalian dari layar menuntut alasan sebelum tombolnya hidup", () => {
    expect(layar()).toContain("disabled={Boolean(sibuk) || !alasanBaru.trim()}");
  });

  it("membuka bungkus jawaban rutenya", () => {
    // Kelas cacat yang sudah menjatuhkan lima layar lain di sesi ini.
    expect(layar()).toContain("((await jawaban.json())?.data ?? {})");
  });
});
