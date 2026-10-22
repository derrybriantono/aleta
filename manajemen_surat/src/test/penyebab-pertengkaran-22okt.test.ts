// @vitest-environment node
/**
 * W49 22 Okt 2026 - PENYEBAB PERTENGKARAN (5227 "Alasan-Alasan Cerai" dan keterangan saksi) lebih luas.
 *
 * Laporan pengguna: "kadang ALETA cuma langsung menyimpulkan perselisihan dan pertengkaran tanpa menyebutkan apa
 * masalahnya". Sebabnya: klausa sebab posita/saksi yang tidak dikenal kamus sebab-cerai (marah bila dinasihati,
 * tidak terbuka soal keuangan, kurang perhatian, mengucapkan talak, ...) membuat 5227 jatuh ke kalimat umum
 * "Antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran".
 *
 * Teks di bawah dipetik dari posita SIPP dan BAS saksi (abt_keterangan_saksi) sungguhan, dibaca baca-saja
 * 22 Okt 2026; nama, tempat, dan tanggal diganti. Ukur (D:/aleta-dev/kerja/w49): 1.060 perkara cerai ber-BAS
 * 2025-2026 - 5227 "hanya perselisihan" 44 -> 29, 87 perkara bertambah sebabnya; sebab isian 5227 hakim/PP yang
 * terbaca dari posita 649/777 -> 698/777 (lengkap 214 -> 251 dari 318 perkara).
 */
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const U: Apa = muat(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));
const SC: Apa = muat(path.join(AKAR, "aleta_bot/services/deteksi/sebabCerai.js"));

const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT = { pelaku: "Termohon", lawan: "Pemohon" };
const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b}`).join("\n");
const u5227 = (b1: string, b2: string, pihak: Apa, posita: string) =>
  U.dariKeteranganSaksi(b1, b2, "", pihak, posita, {}).usulan.find((u: Apa) => u.kode === "5227");
const sebabPosita = (teks: string, pihak: Apa = CG) =>
  SC.deteksi({ b1: [], b2: [], butirPosita: U.kalimatPositaSambung(teks), pihak }).butir.map((b: Apa) => `${b.subjekTeks} ${b.frasa}`);
const UMUM = /terus-menerus terjadi perselisihan dan pertengkaran$/;

describe("5227 menyebut masalahnya, bukan hanya 'terjadi perselisihan'", () => {
  const SEBAB =
    "Tergugat marah setiap kali diingatkan oleh Penggugat, selain itu Tergugat tidak terbuka tentang masalah keuangan rumah tangga dan Tergugat sering mengucapkan kata cerai kepada Penggugat";
  const POSITA = `Bahwa sejak tahun 2022 rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena ${SEBAB};\nBahwa sejak Juni 2024 Penggugat dan Tergugat telah pisah tempat tinggal;`;

  it("kedua saksi menerangkan sebab posita: 5227 pasti, memuat ketiga sebabnya (dulu kalimat umum)", () => {
    const u = u5227(
      bas("Penggugat dan Tergugat sering bertengkar;", `yang biasa menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah sebab ${SEBAB};`),
      bas("antara Penggugat dan Tergugat sering terjadi pertengkaran;", `penyebabnya yang saya tahu yaitu ${SEBAB};`),
      CG,
      POSITA
    );
    expect(u.nilai).toBe(
      "Tergugat marah setiap kali dinasihati atau diingatkan oleh Penggugat, mengucapkan kata talak atau cerai kepada Penggugat, dan tidak terbuka kepada Penggugat mengenai keuangan rumah tangga"
    );
    expect(u.nilai).not.toMatch(UMUM);
    expect(u.keyakinan).toBe("pasti");
  });

  it("saksi tidak menyebut sebab: sebab dari dalil posita, 'ragu' (diperiksa), bukan kalimat umum", () => {
    const u = u5227(bas("Penggugat dan Tergugat sering bertengkar;"), bas("sering bertengkar;"), CG, POSITA);
    expect(u.nilai).toMatch(/^Tergugat marah setiap kali dinasihati/);
    expect(u.keyakinan).toBe("ragu");
  });

  it("87/Pdt.G/2026 (disamarkan): kurang perhatian - dulu terbaca 'melalaikan kewajiban nafkah lahir' dari kata nafkah batin", () => {
    const u = u5227(
      bas(
        "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu Tergugat kurang perhatian dan cenderung tidak peduli terhadap Penggugat;",
        "Saya melihat dan mendengar Penggugat dan Tergugat bertengkar kurang lebih 3 kali;"
      ),
      bas(
        "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu Tergugat bersikap acuh tak acuh dan tidak menunjukkan kepedulian terhadap Penggugat;",
        "Saya melihat dan mendengar Penggugat dan Tergugat bertengkar kurang lebih 3 kali;"
      ),
      CG,
      "Bahwa sejak awal tahun 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat kurang memberikan perhatian kepada Penggugat hingga kurangnya memberikan nafkah batin;"
    );
    expect(u.nilai).toBe("Tergugat kurang memberikan perhatian dan kasih sayang kepada Penggugat");
    expect(u.keyakinan).toBe("pasti");
  });

  it("sebab PENDAMPING (mengucapkan cerai) sendirian tidak menggantikan dalil posita", () => {
    const u = u5227(
      bas("Penggugat dan Tergugat sering bertengkar;", "ketika bertengkar Tergugat sering mengucapkan kata cerai kepada Penggugat;"),
      bas("sering bertengkar;", "Tergugat sering mengucapkan kata cerai;"),
      CG,
      "Bahwa sejak 2023 sering terjadi pertengkaran yang disebabkan karena Tergugat memiliki sifat temperamental dan sering berkata kasar kepada Penggugat;"
    );
    expect(u.nilai).toMatch(/temperamental/);
    expect(u.nilai).toMatch(/berkata kasar/);
  });
});

describe("kamus sebab dari posita sungguhan (disamarkan)", () => {
  it("subjek dibaca per klausa: yang menasihati Penggugat, yang marah Tergugat; kebalikannya tidak menjadi sebab Tergugat", () => {
    expect(sebabPosita("Bahwa Tergugat sering mengonsumsi narkotika dan ketika Penggugat menasihati Tergugat hanya marah;")).toContain(
      "Tergugat marah setiap kali dinasihati atau diingatkan oleh Penggugat"
    );
    expect(sebabPosita("Bahwa ketika Tergugat menasehati Penggugat, Penggugat marah;").join(" ")).not.toMatch(/marah setiap kali/);
  });

  it("komunikasi yang putus SESUDAH pisah bukan sebab pertengkaran", () => {
    const hasil = sebabPosita(
      "Bahwa pada bulan Juni 2005 Tergugat meminta izin kepada Penggugat untuk pergi merantau. Hingga saat itu tidak terjalin lagi komunikasi yang baik antara Penggugat dan Tergugat;"
    );
    expect(hasil.join(" ")).not.toMatch(/komunikasi/);
    expect(sebabPosita("Bahwa disebabkan karena Tergugat kurang dalam hal komunikasi kepada Penggugat;")).toContain(
      "Tergugat kurang menjalin komunikasi yang baik dengan Penggugat"
    );
  });

  it("cerai talak: sebutan pihak dari alur (Termohon/Pemohon), rumusan rapi", () => {
    const hasil = sebabPosita(
      "Bahwa sejak 2024 sering terjadi pertengkaran yang disebabkan karena Termohon tidak terbuka masalah pengelolaan keuangan rumah tangga kepada Pemohon dan Termohon lebih memilih tinggal bersama keluarga Termohon;",
      CT
    );
    expect(hasil).toContain("Termohon tidak terbuka kepada Pemohon mengenai keuangan rumah tangga");
    expect(hasil).toContain("Termohon lebih memilih tinggal bersama orang tuanya daripada bersama Pemohon");
  });

  it("ragam sebab baru terbaca dengan kalimat Indonesia yang rapi", () => {
    const hasil = sebabPosita(
      [
        "Bahwa disebabkan karena:",
        "a. Tergugat sering keluar rumah tanpa sepengetahuan Penggugat hingga berhari-hari;",
        "b. Tergugat menjual harta bersama tanpa sepengetahuan Penggugat;",
        "c. Tergugat sering mengungkit nafkah yang telah Tergugat berikan kepada Penggugat;",
        "d. Tergugat tidak suka dengan keberadaan anak bawaan Penggugat dengan suami sebelumnya;",
        "e. Tergugat tidak mencontohkan yang baik dalam hal keagamaan;",
      ].join("\n")
    );
    expect(hasil).toEqual(
      expect.arrayContaining([
        "Tergugat sering keluar rumah tanpa sepengetahuan Penggugat",
        "Tergugat sering pergi meninggalkan rumah hingga berhari-hari",
        "Tergugat menjual harta bersama tanpa sepengetahuan Penggugat",
        "Tergugat sering mengungkit-ungkit pemberiannya kepada Penggugat",
        "Tergugat tidak dapat menerima dan menyayangi anak bawaan Penggugat",
        "Tergugat tidak memberikan teladan yang baik dalam hal keagamaan",
      ])
    );
  });
});
