// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * RAGAM BAS: MAKNA TIDAK BERGESER, DAN PETUGAS TETAP YANG MEMILIH
 * ============================================================================
 *
 * periksaInvarian (bot) adalah pemeriksa yang dipakai penyusun sebelum sebuah
 * bentuk boleh ditawarkan. Berkas ini menjaga dua hal:
 *
 *   1. pemeriksanya MENGGIGIT - tiap jenis pelanggaran yang dijaganya
 *      ditangkap bila sengaja dibuat;
 *   2. keluaran susunKeteranganSaksiSdg atas templat berbentuk ABT x 6 modus
 *      x 2-4 saksi x 30 nomor perkara TIDAK melanggar satu pun - dibandingkan
 *      dengan keluaran yang sama tanpa ragam (profil 0, pembuka kosong).
 *
 * Ditambah perilaku yang dulu menerbitkan kalimat yang salah: pilihan templat
 * berlawanan, hubungan dua saksi "X / Y", "kurang lebih beberapa kali",
 * siapa yang meninggalkan kediaman, dan pola 'XX' yang rusak oleh karakter
 * backspace sungguhan di sumbernya.
 */

type Butir = { no: string; tanya: string; jawab: string; perluDiisi: boolean; pilihan?: string[]; varian: { indeks: number; n: number; habis: boolean } };
type Hasil = {
  ok: boolean;
  saksi1: { no: string; jawab: string }[];
  saksi2: { no: string; jawab: string }[];
  saksi: { ke: number; pihak: string; jawaban: Butir[] }[];
  perluDiisi: { no: string }[];
  invarian?: unknown;
};
type Layanan = {
  susunKeteranganSaksiSdg: (opsi: Record<string, unknown>) => Hasil;
  periksaInvarian: (dasar: string, hasil: string, opsi?: Record<string, unknown>) => { ok: boolean; pelanggaran: string[] };
  tiruanReplaceKetSaksi: (j: string) => string;
  faktaDariPosita: (posita: string, pelaku: string, lawan: string) => { siapaPergi: string };
  pecahPilihan: (j: string) => { jawab: string; pilihan: string[] };
};
const require_ = createRequire(import.meta.url);
const layanan = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as Layanan;

describe("periksaInvarian menggigit", () => {
  const cek = (dasar: string, hasil: string, opsi?: Record<string, unknown>) => layanan.periksaInvarian(dasar, hasil, opsi).pelanggaran;
  const DASAR = "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025";

  it("bentuk yang setara lolos, termasuk pembuka manusia", () => {
    expect(cek(DASAR, "Ya, Penggugat dan Tergugat sudah berpisah tempat tinggal sejak bulan Januari 2025;")).toEqual([]);
    expect(cek(DASAR, "Penggugat dan Tergugat sudah pisah rumah sejak bulan Januari 2025;")).toEqual([]);
  });

  it.each([
    ["sebutan_berubah", "Penggugat sudah pisah tempat tinggal sejak bulan Januari 2025;"],
    ["angka_berubah", "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2024;"],
    ["modal_negasi_berubah", "Penggugat dan Tergugat sudah pernah pisah tempat tinggal sejak bulan Januari 2025;"],
    ["modal_negasi_berubah", "Penggugat dan Tergugat tidak pisah tempat tinggal sejak bulan Januari 2025;"],
    ["iya", "Iya, Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;"],
    ["sebutan_huruf_kecil", "Ya, penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;"],
    ["kata_kembar", "Penggugat dan Tergugat sudah pisah pisah tempat tinggal sejak bulan Januari 2025;"],
  ])("%s tertangkap", (jenis, hasil) => {
    expect(cek(DASAR, hasil)).toContain(jenis);
  });

  it("kata berakhiran 'ya' + koma tertangkap - ABT memotongnya di putusan", () => {
    const rusak = "Semasa hidupnya, almarhum tetap beragama Islam;";
    expect(cek("Semasa hidupnya almarhum tetap beragama Islam", rusak)).toContain("kata_ya_koma");
    expect(layanan.tiruanReplaceKetSaksi(rusak)).toBe("Bahwa semasa hidupnalmarhum tetap beragama Islam;");
    expect(layanan.tiruanReplaceKetSaksi("Iya, penyebabnya judi;")).toBe("Bahwa ipenyebabnya judi;");
  });

  it("isi slot yang hilang, titik-titik yang hilang, dan jawaban tetap yang disentuh tertangkap", () => {
    expect(cek("saya adalah ibu kandung Penggugat", "saya adalah kerabat Penggugat;", { slot: ["ibu kandung Penggugat"] })).toContain("slot_hilang");
    expect(cek("saya kenal karena saya adalah ...", "saya kenal;")).toContain("titik_titik_berubah");
    expect(cek("Demi Allah saya bersumpah", "Demi Allah saya berjanji;", { tetap: true })).toContain("jawaban_tetap_disentuh");
  });
});

/** Templat berbentuk ABT (sebutan saja, tanpa nama; nilai variabel disamarkan). */
const TEMPLAT = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah ibu kandung Penggugat / tetangga Penggugat;", jawabMentah: "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;" },
  { no: "2", tanya: "Apakah saksi tahu hubungan Penggugat dan Tergugat?", jawab: "Antara Penggugat dan Tergugat adalah suami istri yang sah;" },
  { no: "3", tanya: "Dimana Penggugat dan Tergugat bertempat tinggal setelah menikah?", jawab: "Setelah menikah Penggugat dan Tergugat membina rumah tangga di rumah orang tua Penggugat;" },
  { no: "4", tanya: "Apakah Penggugat dan Tergugat sudah dikaruniai anak?", jawab: "Penggugat dan Tergugat sudah dikaruniai 2 orang anak;" },
  { no: "5", tanya: "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?", jawab: "Pada awalnya kehidupan rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;" },
  { no: "6", tanya: "Kapan mulai terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat?", jawab: "Perselisihan dan pertengkaran Penggugat dan Tergugat terjadi sejak bulan Maret 2023;" },
  { no: "7", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu xxx;" },
  { no: "8", tanya: "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", jawab: "Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran dan perselisihan Penggugat dan Tergugat;" },
  { no: "9", tanya: "Berapa kali saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?", jawab: "Saya melihat dan mendengar Penggugat dan Tergugat bertengkar kurang lebih _ kali;" },
  { no: "10", tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;" },
  { no: "11", tanya: "Siapa yang meninggalkan tempat tinggal bersama?", jawab: "Yang meninggalkan tempat tinggal bersama adalah Penggugat/Tergugat;" },
  { no: "12", tanya: "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?", jawab: "Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih 1 tahun 8 bulan;" },
  { no: "13", tanya: "Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?", jawab: "Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;" },
  { no: "14", tanya: "Apakah Tergugat masih memberikan nafkah kepada Penggugat?", jawab: "Tergugat sudah tidak pernah memberikan nafkah kepada Penggugat;" },
  { no: "15", tanya: "Apakah saudara pernah melihat atau mendengar langsung Penggugat dan Tergugat bertengkar?", jawab: "Saya pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar, sebanyak .... kali, di ........;Saya tidak pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar;" },
  { no: "16", tanya: "Pernahkah ada upaya untuk merukunkan Penggugat dan Tergugat?", jawab: "Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh ...., namun tidak berhasil;Belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat;" },
  { no: "17", tanya: "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?", jawab: "Ya, pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil;" },
  { no: "18", tanya: "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?", jawab: "Saya tidak sanggup lagi;" },
  { no: "19", tanya: "Semasa hidupnya, berapa kali almarhum menikah?", jawab: "Semasa hidupnya, xxx telah menikah XX kali;" },
  { no: "20", tanya: "Apakah masih ada yang ingin saudara sampaikan?", jawab: "Sudah cukup;" },
];
const POSITA =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Mei 2015. Bahwa sejak bulan Maret 2023 sering terjadi perselisihan " +
  "disebabkan Tergugat tidak memberi nafkah. Bahwa puncaknya Tergugat pergi meninggalkan rumah kediaman bersama sehingga Penggugat dan Tergugat telah pisah rumah.";
const MODUS = ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"];
const TANPA_RAGAM = {
  versi: "uji",
  daftar: {
    "bas.saksi.pembuka": [],
    "bas.saksi.profil": [
      "kenal", "tempat tinggal", "kehidupan", "penyebab", "cara tahu", "menyaksikan", "pisah", "upaya damai", "penutup", "keberatan",
      "komunikasi", "nafkah", "kenapa cerai", "maksud", "sanggup", "hubungan pihak", "siapa pergi", "anak", "awal perselisihan", "lain",
    ].map((kunci) => ({ kunci, nilai: "", data: { peluangRagam: 0 } })),
  },
};

describe("keluaran penyusun: 0 pelanggaran atas 6 modus x 2-4 saksi x 30 nomor", () => {
  it("dibandingkan dengan keluaran tanpa ragam, jawaban demi jawaban", () => {
    let jawaban = 0;
    const langgar: string[] = [];
    for (const modus of MODUS) {
      for (const jumlah of [2, 3, 4]) {
        for (let i = 1; i <= 30; i++) {
          const saksi = Array.from({ length: jumlah }, (_, k) => ({ ke: k + 1, pihak: "P", modus, sumberNama: "Penggugat", alasan: ["judi"] }));
          const opsi = { templat: TEMPLAT, alasan: ["tidak memberi nafkah", "judi"], posita: POSITA, pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: `${i}/Pdt.G/2025/PA.Dgl`, kodeKumpulan: "04", saksi };
          const h = layanan.susunKeteranganSaksiSdg(opsi);
          const d = layanan.susunKeteranganSaksiSdg({ ...opsi, tipeKeluaran: TANPA_RAGAM });
          expect(h.invarian, `${modus} ${jumlah} ${i}`).toBeUndefined();
          h.saksi.forEach((s, si) =>
            s.jawaban.forEach((b, bi) => {
              jawaban++;
              const dasar = d.saksi[si].jawaban[bi];
              const pembanding = dasar.varian.n > 1 ? b.jawab.replace(/^(Ya|Setahu saya|Sepengetahuan saya|Yang saya ketahui), /, "") : dasar.jawab;
              const c = layanan.periksaInvarian(pembanding, b.jawab);
              if (!c.ok) langgar.push(`${modus}/${jumlah}/${i} #${b.no}: ${c.pelanggaran} :: ${b.jawab}`);
            })
          );
        }
      }
    }
    expect(jawaban).toBe(6 * (2 + 3 + 4) * 30 * TEMPLAT.length);
    expect(langgar.slice(0, 5)).toEqual([]);
  });
});

describe("pilihan templat, hubungan dua saksi, dan isian yang dulu salah", () => {
  const h = layanan.susunKeteranganSaksiSdg({ templat: TEMPLAT, alasan: ["judi"], posita: POSITA, pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: "7/Pdt.G/2025/PA.Dgl", kodeKumpulan: "04" });
  const butir = (ke: number, no: string) => h.saksi[ke - 1].jawaban.find((b) => b.no === no) as Butir;

  it("pilihan berlawanan: yang pertama dipakai, SEMUA ditawarkan, dan ditandai perlu diisi", () => {
    for (const no of ["15", "16"]) {
      const b = butir(1, no);
      expect(b.perluDiisi, no).toBe(true);
      expect(b.pilihan?.length, no).toBe(2);
      expect(b.jawab, no).not.toContain(";S");
      expect(b.jawab.split(";").filter(Boolean)).toHaveLength(1);
    }
    expect(layanan.pecahPilihan("A;<br>B;")).toEqual({ jawab: "A", pilihan: ["A", "B"] });
    expect(layanan.pecahPilihan("karena: <br>- satu; <br>- dua;")).toEqual({ jawab: "karena: - satu - dua", pilihan: ["satu", "dua"] });
  });

  it("hubungan '#1241# / #1242#' dipecah: saksi 1 ibu kandung, saksi 2 tetangga - bukan keduanya", () => {
    expect(butir(1, "1").jawab).toContain("ibu kandung Penggugat");
    expect(butir(1, "1").jawab).not.toContain("tetangga");
    expect(butir(2, "1").jawab).toContain("tetangga Penggugat");
    expect(butir(2, "1").jawab).not.toContain("ibu kandung");
    // Templat mentah TANPA pola dua variabel tidak dipecah walau hasil gantinya bergaris miring.
    const tanpa = layanan.susunKeteranganSaksiSdg({
      templat: [{ no: "1", tanya: "Apakah saksi kenal dengan Tergugat?", jawab: "Saya kenal dengan Tergugat sebagai isteri / suami Penggugat;", jawabMentah: "Saya kenal dengan #0047# sebagai isteri / suami #0046#;" }],
      alasan: [],
    });
    expect(tanpa.saksi1[0].jawab).toContain("isteri / suami");
  });

  it("'kurang lebih _ kali' menjadi 'beberapa kali', bukan 'kurang lebih beberapa kali'", () => {
    for (const ke of [1, 2]) {
      expect(butir(ke, "9").jawab).toContain("beberapa kali");
      expect(butir(ke, "9").jawab).not.toMatch(/kurang lebih beberapa|sekitar beberapa/);
    }
  });

  it("siapa yang pergi: sebutan terdekat SEBELUM 'pergi/meninggalkan', dan pilihan templatnya terisi", () => {
    expect(butir(1, "11").jawab).toMatch(/^(?:Ya, |Setahu saya, |Sepengetahuan saya, |Yang saya ketahui, )?[Yy]ang meninggalkan tempat tinggal bersama adalah Tergugat;$/);
    expect(layanan.faktaDariPosita("Bahwa puncak keretakan terjadi, Tergugat pergi meninggalkan rumah sehingga Penggugat dan Tergugat pisah rumah", "Tergugat", "Penggugat").siapaPergi).toBe("Tergugat");
    expect(layanan.faktaDariPosita("Bahwa Penggugat pergi meninggalkan Tergugat dan pulang ke rumah orang tuanya", "Tergugat", "Penggugat").siapaPergi).toBe("Penggugat");
    // Anak kalimat 'yang meninggalkan ... adalah X' menunjuk subjek SESUDAH
    // kata kerjanya (ditemukan pada pemeriksaan tangan 20 posita sungguhan).
    expect(layanan.faktaDariPosita("Bahwa antara penggugat dengan tergugat telah pisah rumah dan pisah ranjang, yang meninggalkan tempat kediaman bersama adalah Penggugat", "Tergugat", "Penggugat").siapaPergi).toBe("Penggugat");
    // 'pergi' pertama milik yang mengusir; yang meninggalkan adalah yang diusir.
    expect(layanan.faktaDariPosita("Bahwa Tergugat pergi mengusir Penggugat untuk meninggalkan kediaman bersama", "Tergugat", "Penggugat").siapaPergi).toBe("Penggugat");
    // Tanpa sebutan di depan kata kerjanya dan tanpa pola "adalah X": kosong, tidak ditebak.
    expect(layanan.faktaDariPosita("Bahwa sejak itu pergi meninggalkan rumah kediaman bersama", "Tergugat", "Penggugat").siapaPergi).toBe("");
  });

  it("'XX' templat kini dikenali sebagai isian - dulu polanya memuat backspace sungguhan", () => {
    expect(butir(1, "19").perluDiisi).toBe(true);
    expect(butir(1, "19").jawab).toMatch(/^(?:Ya, |Setahu saya, |Sepengetahuan saya, |Yang saya ketahui, )?[Ss]emasa hidupnya xxx (?:telah|sudah) menikah XX kali;$/);
  });

  it("alasan diucapkan dengan frasanya, bukan label kunci bergaris miring atau berkurung", () => {
    const k = layanan.susunKeteranganSaksiSdg({ templat: TEMPLAT, alasan: ["pihak lain (wanita/pria idaman lain)", "kekerasan dalam rumah tangga", "murtad/pindah agama"], pelaku: "Tergugat", lawan: "Penggugat" });
    for (const s of k.saksi) {
      const b = s.jawaban.find((x) => x.no === "7") as Butir;
      expect(b.jawab).not.toMatch(/[()/]/);
      expect(b.jawab).toContain("Tergugat ");
    }
  });
});
