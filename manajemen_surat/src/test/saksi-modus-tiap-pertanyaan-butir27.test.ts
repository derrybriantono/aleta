// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 27 - TIAP MODUS SAKSI MENJAWAB TIAP PERTANYAAN SESUAI MODUSNYA
 * ============================================================================
 *
 * Modus saksi ("Tahu seluruh alasan, melihat sendiri" ... "Tidak tahu
 * pertengkarannya, hanya tahu sudah pisah") dahulu hanya menjawab penyebab,
 * cara tahu, dan berapa kali menyaksikan. Pertanyaan lain jatuh ke templat
 * yang ditulis untuk saksi yang MELIHAT sendiri, sehingga saksi tahu-pisah
 * menerangkan "perselisihan terjadi sejak ..." dan "saya mengetahui karena
 * saya melihat sendiri" (10,9% jawabannya bertentangan dengan modusnya), dan
 * dua saksi bermodus sama berbunyi kata demi kata sama pada 46,9% jawaban.
 *
 * Templat di bawah = templat 04 ABT sesudah variabelnya diganti; posita
 * KARANGAN meniru bentuk posita satker.
 */

const AKAR = path.resolve(__dirname, "../../..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const layanan = require(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

const TEMPLAT_04 = [
  ["1", "Apakah saksi kenal dengan Penggugat dan Tergugat?", "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah tetangga Penggugat;"],
  ["2", "Apakah saksi tahu hubungan Penggugat dan Tergugat?", "Antara Penggugat dan Tergugat adalah suami istri yang sah;"],
  ["3", "Dimana Penggugat dan Tergugat bertempat tinggal setelah menikah?", "Setelah menikah Penggugat dan Tergugat membina rumah tangga di Desa Contoh;"],
  ["4", "Apakah Penggugat dan Tergugat sudah dikaruniai anak?", "Penggugat dan Tergugat sudah dikaruniai 2 orang anak;"],
  ["5", "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?", "Pada awalnya kehidupan rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;"],
  ["6", "Kapan mulai terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat?", "Perselisihan dan pertengkaran Penggugat dan Tergugat terjadi sejak ...;"],
  ["7", "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu ...;"],
  ["8", "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", "Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran dan perselisihan Penggugat dan Tergugat;"],
  ["9", "Berapa kali saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?", "Saya melihat dan mendengar Penggugat dan Tergugat bertengkar kurang lebih _ kali;"],
  ["10", "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", "Penggugat dan Tergugat sudah pisah tempat tinggal sejak ...;"],
  ["11", "Siapa yang meninggalkan tempat tinggal bersama?", "Yang meninggalkan kediaman bersama adalah ...;"],
  ["12", "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?", "Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih ...;"],
  ["13", "Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?", "Selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;"],
  ["14", "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?", "Ya, ...;"],
  ["15", "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?", "Saya tidak sanggup lagi;"],
  ["16", "Apakah masih ada keterangan yang saksi akan sampaikan?", "Sudah cukup;"],
].map(([no, tanya, jawab]) => ({ no, tanya, jawab }));

const POSITA = [
  "Bahwa sejak bulan Maret 2021 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat tidak memberikan nafkah yang cukup kepada Penggugat;",
  "Bahwa puncak keretakan terjadi pada bulan Agustus 2023, Tergugat pergi meninggalkan rumah kediaman bersama sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 4 bulan;",
  "Bahwa keluarga Tergugat telah mencoba memusyawarahkan dengan keluarga Penggugat namun usaha tersebut tidak membuahkan hasil;",
].join("\n");

const MODUS = ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"];

type Butir = { no: string; jawab: string };
const susun = (modus: string, nomorPerkara = "1/Pdt.G/2026/PA.Uji", banyak = 2) =>
  layanan.susunKeteranganSaksiSdg({
    templat: TEMPLAT_04,
    posita: POSITA,
    pelaku: "Tergugat",
    lawan: "Penggugat",
    nomorPerkara,
    kodeKumpulan: "04",
    saksi: Array.from({ length: banyak }, (_, i) => ({ ke: i + 1, pihak: "P", modus, sumber: "penggugat", sumberNama: "Penggugat" })),
  }) as { saksi: { jawaban: Butir[] }[] };
const jawab = (s: { jawaban: Butir[] }, no: string) => s.jawaban.find((b) => b.no === no)?.jawab ?? "";

describe("butir 27 - jawaban sesuai modus", () => {
  it("tahu-pisah: tidak menerangkan kapan/keadaan/cara tahu pertengkaran yang tidak diketahuinya", () => {
    for (const s of susun("tahu-pisah", "1/Pdt.G/2026/PA.Uji", 4).saksi) {
      for (const no of ["5", "6", "8"]) {
        expect(jawab(s, no), no).toMatch(/tidak (pernah )?(mengetahui|tahu|saya ketahui)|tidak saya ketahui/i);
        expect(jawab(s, no), no).not.toMatch(/melihat sendiri|sering terjadi perselisihan|terjadi sejak/i);
      }
      // Pisah rumah justru yang ia ketahui - tetap diterangkan dari gugatan.
      expect(jawab(s, "10")).toContain("Agustus 2023");
    }
  });

  it("tahu-pisah: pertanyaan UPAYA rukun tidak dijawab 'tidak sanggup mendamaikan'", () => {
    for (const s of susun("tahu-pisah").saksi) {
      expect(jawab(s, "14")).not.toMatch(/sanggup|dapat mendamaikan/i);
      expect(jawab(s, "14")).toContain("keluarga Tergugat");
    }
  });

  it("tidak-tahu: cara tahu tidak mengaku mengetahui penyebabnya", () => {
    for (const s of susun("tidak-tahu").saksi) {
      expect(jawab(s, "8")).toMatch(/tidak (tahu|mengetahui|dapat menerangkan)|tidak saya ketahui/i);
    }
  });

  it("tidak-melihat dan dari-cerita: kapan mulai berselisih diterangkan dari cerita, tanggalnya tetap dari gugatan", () => {
    for (const s of susun("tidak-melihat").saksi) {
      expect(jawab(s, "6")).toMatch(/cerita|dengar/i);
      expect(jawab(s, "6")).toContain("Maret 2021");
      expect(jawab(s, "5")).toMatch(/cerita|dengar/i);
    }
    for (const s of susun("dari-cerita").saksi) {
      expect(jawab(s, "6")).toContain("Penggugat");
      expect(jawab(s, "6")).toMatch(/cerita|menceritakan|penuturan/i);
      expect(jawab(s, "6")).toContain("Maret 2021");
    }
  });

  it("tidak ada pembuka 'Ya,' di depan jawaban yang dibuka penyangkal", () => {
    for (const modus of MODUS) {
      for (let n = 1; n <= 30; n++) {
        for (const s of susun(modus, `${n}/Pdt.G/2026/PA.Uji`).saksi) {
          for (const b of s.jawaban) expect(b.jawab, b.jawab).not.toMatch(/^(Ya|Setahu saya|Sepengetahuan saya|Yang saya ketahui), (saya )?(tidak|belum)\b/i);
        }
      }
    }
  });

  it("tiap modus x tiap pertanyaan: jawaban tidak pernah kosong; kalimat modus utuh", () => {
    for (const modus of MODUS) {
      for (const s of susun(modus).saksi) {
        expect(s.jawaban).toHaveLength(TEMPLAT_04.length);
        for (const b of s.jawaban) {
          expect(b.jawab.replace(/[\s.;,_]/g, ""), `${modus} #${b.no}`).not.toBe("");
          expect(b.jawab, `${modus} #${b.no}`).not.toMatch(/\{(sumber|daftar|isi|jawab)\}/);
        }
      }
    }
  });
});

describe("butir 27 - dua saksi bermodus sama: kalimat berbeda, makna sama", () => {
  it("templat 04, 40 nomor perkara, tiap modus: jawaban identik antar dua saksi <= 5%", () => {
    for (const modus of MODUS) {
      let n = 0;
      let sama = 0;
      for (let k = 1; k <= 40; k++) {
        const [s1, s2] = susun(modus, `${k}/Pdt.G/2025/PA.Uji`).saksi;
        s1.jawaban.forEach((b, i) => {
          if (b.jawab === layanan.TANDA_BELUM_TERISI) return;
          n++;
          if (b.jawab === s2.jawaban[i].jawab) sama++;
        });
      }
      expect(sama / n, modus).toBeLessThanOrEqual(0.05);
    }
  });

  it("tanggal, lama, dan pihak yang pergi sama pada kedua saksi (fakta tidak berubah)", () => {
    const [s1, s2] = susun("sama").saksi;
    for (const s of [s1, s2]) {
      expect(jawab(s, "6")).toContain("Maret 2021");
      expect(jawab(s, "10")).toContain("Agustus 2023");
      expect(jawab(s, "11")).toContain("Tergugat");
      expect(jawab(s, "12")).toContain("1 tahun 4 bulan");
    }
  });
});
