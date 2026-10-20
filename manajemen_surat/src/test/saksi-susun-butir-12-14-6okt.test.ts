// @vitest-environment node
/**
 * ============================================================================
 * BUTIR 12, 13, 14 (6 OKTOBER 2026) - "SUSUN KETERANGAN SAKSI"
 * ============================================================================
 *
 * 12. Modus "Hanya sebagian alasan yang ia ketahui": centang yang tampil
 *     langsung hanya alasan yang SESUAI POSITA (sumber 'alasan-posita' = bot
 *     alasanDariPosita, sumber yang sama dengan "Alasan yang dipakai"); alasan
 *     lain di bagian terlipat "Lainnya (di luar posita)". Posita tak terbaca =
 *     semua tampil seperti dahulu.
 * 13. "Tidak tahu pertengkarannya, hanya tahu sudah pisah" tepat sesudah "Tahu
 *     berselisih & berpisah, tidak tahu sebabnya".
 * 14. Tidak ada isian kosong / "..." / "#....#" / "undefined" pada keluaran
 *     untuk posita sungguhan yang dianonimkan; lama pisah dihitung dari
 *     "sejak" (juga lintas tahun).
 *
 * Keduanya di tampilan yang berkelompok (saklar abt-8 / UI Baru). Tampilan
 * Lama dan Baru tanpa saklar tidak berubah (dijaga ekstensi-abt-tahap6).
 *
 * Posita di bawah DIANONIMKAN dari perkara cerai 2025 sipp_donggala lokal:
 * nama orang, desa, dan nomor diganti; bentuk kalimatnya (termasuk salah ketik
 * dan baris daftar yang terpotong) dipertahankan karena justru itu yang diuji.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
// ALETA_UJI_LAYANAN_SAKSI hanya untuk pembukti gigitan (layanan sebelum butir 14).
const layanan = require(process.env.ALETA_UJI_LAYANAN_SAKSI || path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

// ----------------------------------------------------------------------------
// Posita sungguhan yang dianonimkan
// ----------------------------------------------------------------------------
/** Cerai gugat: riwayat tinggal berpindah, anak "2 dua)", daftar sebab "yakni:" terpotong baris. */
const POSITA_A = [
  "pada tanggal 12 Juni 2015, Penggugat dan Tergugat telah melangsungkan pernikahan, sesuai dengan Kutipan Akta Nikah Nomor: 111/22/VI/2015",
  "setelah pernikahan tersebut Penggugat dan Tergugat tinggal di rumah orangtua Penggugat di Desa Sukamaju kurang lebih 1 tahun kemudian pindah kerumah nenek Penggugat di Kabonena sekitar 3 tahun kemudian kembali kerumah orangtua Penggugat",
  "dalam Perkawinan awalnya antara Penggugat dan Tergugat hidup rukun layaknya suami istri dan telah dikaruniai 2 dua) orang anak yakni:",
  "Putri lahir di Sukamaju, 25 oktober 2015",
  "Dan saat ini anak-anak tinggal bersama denganPenggugat.",
  "perselisihan dan cekcok mulai terjadi sejak tahun 2017 dikarenakan Penggugat mendapatkan bukti chat mesra antara Tergugat dengan seorang perempuan di handphone milik Tergugat, akibat cekcok tersebut Tergugat pergi meninggalkan rumah selama kurang lebih 2 (dua) minggu lamanya dan kemudian kembali hidup rukun bersama Penggugat.",
  "puncak keretakan rumah tangga terjadi sekitar akhir tahun 2020 dimana Tergugat sempat kembali kerumah orangtua Penggugat selama 2 hari namun karena Penggugat masih mendapati bukti perselingkuhan Tergugat sehingga Penggugat mengusir Tergugat dan sampai sekarang tidak tinggal bersama lagi.",
  "sebab-sebab terjadinya perselisihan Penggugat dan Tergugat yakni:",
  "1 Tergugat berselingkuh dengan seorang perempuan dan tidak bisa",
  "menepati janjinya untuk tidak menjalin hubungan .",
  "2 Tergugat suka membohongi Penggugat dan berpura-pura telah putus hubungan",
].join("\n");

/** Cerai talak: tanpa sebab tertulis, belum "di karuniai" anak, pisah "pada tahun 2021", izin pulang lalu tidak kembali. */
const POSITA_B = [
  "pada tanggal 17 Januari 2021, Pemohon dan Termohon telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah",
  "setelah menikah, Pemohon dan Termohon tinggal bersama di rumah orang tua Termohon di Desa Makmur selama 1 bulan, setelah itu Pemohon dan Termohon tinggal di rumah pribadi Pemohon di Desa Lembah hingga pisah rumah",
  "setelah menikah, Pemohon dan Termohon hidup selayaknya suami isteri namun belum di karuniai anak",
  "sejak awal pernikahan keadaan rumah tangga Pemohon dan Termohon rukun dan harmonis",
  "pada tahun 2021, Termohon izin kepada Pemohon untuk kembali ke rumah orang tua Termohon di Desa Makmur untuk mengambil pakaian Termohon, namun hingga saat itu Termohon tidak lagi kembali ke kediaman bersama, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 3 tahun. Sejak saat itu hak dan kewajiban suami isteri tidak terlaksana sebagaimana mestinya",
].join("\n");

/** Cerai gugat: "di karuniai seorang anak" + pengasuhan, pisah "sejak bulan September 2025" tanpa lama. */
const POSITA_C = [
  "pada tanggal 3 Mei 2018 Penggugat dan Tergugat telah melangsungkan pernikahan",
  "setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Pantai hingga pisah rumah",
  "setelah menikah, Penggugat dan Tergugat hidup selayaknya suami isteri dan telah di karuniai seorang anak yang bernama Fulan bin Fulan, usia 2 tahun. Saat ini anak tersebut berada dalam pengasuhan Penggugat",
  "sejak bulan Maret 2024 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat malas bekerja dan tidak memberi nafkah",
  "Tergugat pergi meninggalkan rumah kediaman bersama sejak bulan September 2025 hingga sekarang",
].join("\n");

// Templat saksi cerai ABT (aps_badilag.abt_tanyajawab_template, kode 04 dan A1)
// - teks templat, bukan data perkara. Variabel fakta (0222, 5227, 0246, 9944,
// 7035, 1268, 8491, 8535) sengaja kosong: keadaan terburuk.
const TEMPLAT_04: Array<[string, string]> = [
  ["Apakah saksi kenal dengan #0046# dan #0047#?", "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;"],
  ["Dimana #0046# dan #0047# bertempat tinggal setelah menikah?", "Setelah menikah #0046# dan #0047# membina rumah tangga di #8491#;"],
  ["Apakah #0046# dan #0047# sudah dikaruniai anak?", "#0046# dan #0047# #8535#;"],
  ["Kapan mulai terjadi perselisihan dan pertengkaran antara #0046# dan #0047#?", "Perselisihan dan pertengkaran #0046# dan #0047# terjadi sejak #0222#;"],
  ["Apakah saksi tahu penyebab perselisihan dan pertengkaran #0046# dan #0047#?", "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu #5227#;"],
  ["Berapa kali saksi melihat dan mendengar #0046# dan #0047# bertengkar?", "Saya melihat dan mendengar #0046# dan #0047# bertengkar kurang lebih _ kali;"],
  ["Apakah saat ini #0046# dan #0047# masih tinggal serumah?", "#0046# dan #0047# sudah pisah tempat tinggal sejak #0246#;"],
  ["Siapa yang meninggalkan tempat tinggal bersama?", "Yang meninggalkan kediaman bersama adalah #7035#;"],
  ["Sudah berapa lama #0046# dan #0047# berpisah tempat tinggal?", "#0046# dan #0047# berpisah tempat tinggal sudah kurang lebih #9944#;"],
  ["Apakah sejak ada masalah, #0046# dan #0047# pernah diupayakan untuk rukun kembali?", "Ya, #1268#;"],
];
const TEMPLAT_A1: Array<[string, string]> = [
  ["Apakah saudara kenal dengan #0046#?", "Saya kenal dengan #0046# karena saya adalah ...;"],
  [
    "Dimana #0046# dan #0047# tinggal bersama setelah menikah?",
    "Setelah menikah #0046# dan #0047# tinggal bersama di ...... pernah juga tinggal bersama di ....... dan terakhir tinggal bersama di ...... ;Setelah menikah #0046# dan #0047# tidak pernah tinggal bersama;",
  ],
  [
    "Apakah #0046# dan #0047# sudah dikarunia anak?",
    "#0046# dan #0047# sudah dikaruniai ... orang anak, anak tersebut saat ini tinggal dengan #0046# / #0047#;#0046# dan #0047# belum dikaruniai anak;",
  ],
  ["Apakah antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran, dan kapan mulainya?", "Antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran sejak .....;"],
  ["Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047#?", "Yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047# adalah karena ........;"],
  [
    "Apakah saudara pernah melihat atau mendengar langsung #0046# dan #0047# bertengkar?",
    "Saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, sebanyak .... kali, di ........;Saya tidak pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, tapi setelah terjadi pertengkaran saya tahu karena .....;",
  ],
  ["Apakah ada kejadian yang merupakan puncak perselisihan dan pertengkaran antara #0046# dan #0047#?", "Puncak perselisihan dan pertengkaran antara #0046# dan #0047# terjadi pada ...;"],
  ["Apakah #0046# dan #0047# masih tinggal satu rumah sampai saat ini?", "#0046# dan #0047# sudah pisah tempat tinggal sejak ....., kira-kira sampai sekarang sudah sekitar ........ tahun/bulan;"],
  ["Siapa yang meninggalkan tempat tinggal bersama?", "Yang meninggalkan tempat tinggal bersama adalah #0046#/#0047#;"],
  [
    "Pernahkah ada upaya untuk merukunkan #0046# dan #0047#?",
    "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh ...., namun tidak berhasil;Belum pernah ada upaya untuk merukunkan #0046# dan #0047# karena ....;",
  ],
];
const TEMPLAT_A3_TINGGAL: Array<[string, string]> = [
  ["Dimana #0046# dan #0047# tinggal bersama setelah menikah?", "Setelah menikah #0046# dan #0047# tinggal bersama di ...... selama ....;"],
  [
    "Pernahkah #0046# dan #0047# tinggal bersama di tempat lain?",
    "#0046# dan #0047# pernah juga tinggal bersama di ...... selama ....... dan terakhir mereka tinggal bersama di ...... selama ........; #0046# dan #0047# tidak pernah tinggal bersama di tempat lain;",
  ],
];

const MODUS = ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"];
const POLA_KOSONG = /\.{3,}|…|(^|[\s(])_+(?=[\s,.;)]|$)|BELUM TERISI|undefined|\bnull\b|\bNaN\b|#\d{4}#|\[object/;
const POLA_RUSAK = /\b(?:Penggugat|Pemohon) dan (?:Tergugat|Termohon) (?:\d+ orang anak|belum mempunyai anak)|orang orang|anak anak\b/;

function susun(posita: string, templat: Array<[string, string]>, opsi: { talak?: boolean; modus?: string; tanggalSidang?: string; kode?: string } = {}) {
  const pelaku = opsi.talak ? "Termohon" : "Tergugat";
  const lawan = opsi.talak ? "Pemohon" : "Penggugat";
  const NILAI: Record<string, string> = { "#1241#": `ibu kandung ${lawan}`, "#1242#": `tetangga ${lawan}` };
  const ganti = (t: string) =>
    t
      .replace(/#0046#/g, lawan)
      .replace(/#0047#/g, pelaku)
      .replace(/#\d{4}#/g, (v) => NILAI[v] ?? "...");
  const modus = opsi.modus || "sama";
  return layanan.susunKeteranganSaksiSdg({
    templat: templat.map(([tanya, jawab], i) => ({ no: String(i + 1), tanya: ganti(tanya), jawab: ganti(jawab), jawabMentah: jawab })),
    posita,
    pelaku,
    lawan,
    nomorPerkara: "1/Pdt.G/2025/PA.Dgl",
    kodeKumpulan: opsi.kode || "04",
    tanggalSidang: opsi.tanggalSidang || "2026-10-06",
    saksi: [
      { ke: 1, pihak: "P", modus },
      { ke: 2, pihak: "P", modus },
    ],
  });
}
const jawabanDari = (hasil: any) => hasil.saksi.flatMap((s: any) => s.jawaban);

// ============================================================================
describe("butir 14 - lama pisah dihitung dari 'sejak', termasuk lintas tahun", () => {
  it("September 2025 sampai 6 Oktober 2026 = 1 tahun 1 bulan (contoh pengguna)", () => {
    expect(layanan.lamaSejakAcuan("bulan September 2025", "06/10/2026")).toEqual({ teks: "1 tahun 1 bulan", totalBulan: 13, taksiran: false });
  });

  it("lintas tahun: Desember 2025 -> Januari 2026 satu bulan, November 2025 -> Februari 2026 tiga bulan", () => {
    expect(layanan.lamaSejakAcuan("bulan Desember 2025", "2026-01-15").teks).toBe("1 bulan");
    expect(layanan.lamaSejakAcuan("bulan November 2025", "2026-02-01").teks).toBe("3 bulan");
    expect(layanan.lamaSejakAcuan("bulan Oktober 2024", "2026-10-06").teks).toBe("2 tahun");
  });

  it("hanya tahun = taksiran tahun; awal/akhir tahun = taksiran bulan", () => {
    expect(layanan.lamaSejakAcuan("tahun 2024", "2026-10-06")).toEqual({ teks: "2 tahun", totalBulan: 24, taksiran: true });
    expect(layanan.lamaSejakAcuan("akhir tahun 2023", "2026-10-06").teks).toBe("2 tahun 11 bulan");
    expect(layanan.lamaSejakAcuan("awal bulan Mei 2026", "2026-10-06").teks).toBe("5 bulan");
  });

  it("tidak mengarang: sejak sesudah acuan, sejak tahun yang sama, atau tidak terbaca -> null", () => {
    expect(layanan.lamaSejakAcuan("bulan November 2026", "2026-10-06")).toBeNull();
    expect(layanan.lamaSejakAcuan("tahun 2026", "2026-10-06")).toBeNull();
    expect(layanan.lamaSejakAcuan("bulan Entah 2025", "2026-10-06")).toBeNull();
    expect(layanan.lamaSejakAcuan("bulan Mei 2025", "")).toBeNull();
  });

  it("posita hanya menyebut sejak: lama dihitung ke tanggal sidang, tanpa tanggal sidang ke hari ini", () => {
    const sidang = layanan.faktaDariPosita(POSITA_C, "Tergugat", "Penggugat", { tanggalSidang: "2026-10-06" });
    expect(sidang.pisahSejak).toBe("bulan September 2025");
    expect(sidang.lamaPisah).toBe("1 tahun 1 bulan");
    expect(sidang.lamaPisahDihitung).toBe(true);
    const hariIni = layanan.faktaDariPosita(POSITA_C, "Tergugat", "Penggugat", { hariIni: new Date(2026, 1, 20) });
    expect(hariIni.lamaPisah).toBe("5 bulan");
  });

  it("'sejak tahun 2021' dengan lama tertulis: yang tertulis yang dipakai, tidak dihitung ulang", () => {
    const f = layanan.faktaDariPosita(POSITA_B, "Termohon", "Pemohon", { tanggalSidang: "2025-03-18" });
    expect(f.pisahSejak).toBe("tahun 2021");
    expect(f.lamaPisah).toBe("3 tahun");
    expect(f.lamaPisahDihitung).toBe(false);
  });

  it("lama tertulis hanya hari ('sempat kembali selama 2 hari') kalah oleh hitungan dari sejaknya", () => {
    const f = layanan.faktaDariPosita(POSITA_A, "Tergugat", "Penggugat", { tanggalSidang: "2025-02-18" });
    expect(f.pisahSejak).toBe("akhir tahun 2020");
    expect(f.lamaPisah).toBe("4 tahun 3 bulan");
    expect(f.lamaPisahDihitung).toBe(true);
  });
});

// ============================================================================
describe("butir 14 - fakta yang dahulu tidak terbaca dari posita", () => {
  it("jumlah anak: '2 dua) orang anak', 'di karuniai seorang anak', 'belum di karuniai anak'", () => {
    expect(layanan.faktaDariPosita(POSITA_A, "Tergugat", "Penggugat").jumlahAnak).toBe("2 orang anak");
    expect(layanan.faktaDariPosita(POSITA_C, "Tergugat", "Penggugat").jumlahAnak).toBe("1 orang anak");
    expect(layanan.faktaDariPosita(POSITA_B, "Termohon", "Pemohon").jumlahAnak).toBe("belum mempunyai anak");
    expect(layanan.faktaDariPosita("Bahwa dalam perkawinan tersebut tidak dikaruniai keturunan / anak;", "Tergugat", "Penggugat").jumlahAnak).toBe(
      "belum mempunyai anak"
    );
  });

  it("anak tinggal dengan siapa: 'tinggal bersama denganPenggugat', 'dalam pengasuhan Penggugat'", () => {
    expect(layanan.faktaDariPosita(POSITA_A, "Tergugat", "Penggugat").anakIkut).toBe("Penggugat");
    expect(layanan.faktaDariPosita(POSITA_C, "Tergugat", "Penggugat").anakIkut).toBe("Penggugat");
    expect(layanan.faktaDariPosita(POSITA_B, "Termohon", "Pemohon").anakIkut).toBe("");
  });

  it("riwayat tempat tinggal berurutan beserta lamanya; tempat sesudah berpisah tidak ikut", () => {
    const f = layanan.faktaDariPosita(POSITA_B, "Termohon", "Pemohon");
    expect(f.tempatTinggal).toEqual([
      { tempat: "rumah orang tua Termohon di Desa Makmur", lama: "1 bulan" },
      { tempat: "rumah pribadi Pemohon di Desa Lembah", lama: "" },
    ]);
    expect(f.kediaman).toBe("rumah orang tua Termohon di Desa Makmur");
  });

  it("penyebab dari daftar 'sebab-sebab ... yakni:' - baris yang terpotong disambung", () => {
    const f = layanan.faktaDariPosita(POSITA_A, "Tergugat", "Penggugat");
    // Kalimat perselisihan bertanggal dibaca lebih dahulu (sebab sesudah "dikarenakan").
    expect(f.penyebab).toContain("bukti chat mesra");
    const daftar = layanan.faktaDariPosita(POSITA_A.split("\n").slice(7).join("\n"), "Tergugat", "Penggugat");
    expect(daftar.penyebab).toBe(
      "Tergugat berselingkuh dengan seorang perempuan dan tidak bisa menepati janjinya untuk tidak menjalin hubungan dan Tergugat suka membohongi Penggugat dan berpura-pura telah putus hubungan"
    );
  });

  it("siapa yang pergi: yang izin pulang lalu 'tidak lagi kembali ke kediaman bersama'", () => {
    expect(layanan.faktaDariPosita(POSITA_B, "Termohon", "Pemohon").siapaPergi).toBe("Termohon");
  });

  it("awal perselisihan tanpa tanggal: 'mulai terjadi sejak awal pernikahan'", () => {
    const f = layanan.faktaDariPosita("Bahwa perselisihan dan cekcok mulai terjadi sejak awal pernikahan yang dipicu karena Tergugat berjudi;", "Tergugat", "Penggugat");
    expect(f.awalKonflik).toBe("awal pernikahan");
  });
});

// ============================================================================
describe("butir 14 - tidak ada isian kosong atau tak terbaca pada keluaran (posita sungguhan dianonimkan)", () => {
  for (const [nama, posita, talak] of [
    ["A (cerai gugat, daftar sebab)", POSITA_A, false],
    ["B (cerai talak, tanpa sebab tertulis)", POSITA_B, true],
    ["C (sejak September 2025 tanpa lama)", POSITA_C, false],
    ["kosong (posita tidak terbaca)", "", false],
  ] as const) {
    it(`${nama}: 3 templat x 6 modus x 2 saksi - jawaban dan pilihannya utuh`, () => {
      for (const [kode, templat] of [
        ["04", TEMPLAT_04],
        ["A1", TEMPLAT_A1],
        ["A3", TEMPLAT_A3_TINGGAL],
      ] as const) {
        for (const modus of MODUS) {
          for (const b of jawabanDari(susun(posita, templat as Array<[string, string]>, { talak, modus, kode }))) {
            const teks = [b.jawab, ...(b.pilihan || [])];
            for (const t of teks) {
              expect(t, `${kode} ${modus} #${b.no} ${b.tanya}`).not.toMatch(POLA_KOSONG);
              expect(t, `${kode} ${modus} #${b.no} ${b.tanya}`).not.toMatch(POLA_RUSAK);
              expect(t.trim().length, `${kode} ${modus} #${b.no}`).toBeGreaterThan(8);
            }
          }
        }
      }
    });
  }

  it("C templat 04: lama pisah 1 tahun 1 bulan, anak 1 orang, sejak September 2025, puncak tidak dikarang", () => {
    const j = jawabanDari(susun(POSITA_C, TEMPLAT_04, { tanggalSidang: "2026-10-06" })).slice(0, TEMPLAT_04.length);
    const cari = (pola: RegExp) => j.find((b: any) => pola.test(b.tanya)).jawab;
    expect(cari(/berapa lama/)).toMatch(/kurang lebih 1 tahun 1 bulan/);
    expect(cari(/dikaruniai anak/)).toMatch(/(?:telah|sudah) dikaruniai 1 orang anak/);
    expect(cari(/masih tinggal serumah/)).toMatch(/sejak bulan September 2025/);
    expect(cari(/meninggalkan/)).toMatch(/Tergugat/);
  });

  it("A1: pilihan anak dan tempat tinggal diputuskan posita; tempat berurutan; tanpa 'orang orang'", () => {
    const j = jawabanDari(susun(POSITA_A, TEMPLAT_A1, { kode: "A1", tanggalSidang: "2025-02-18" })).slice(0, TEMPLAT_A1.length);
    const anak = j.find((b: any) => /dikarunia anak/.test(b.tanya));
    expect(anak.pilihan).toBeUndefined();
    expect(anak.jawab).toMatch(/dikaruniai 2 orang anak, anak tersebut saat ini tinggal dengan Penggugat/);
    const tinggal = j.find((b: any) => /tinggal bersama setelah menikah/.test(b.tanya));
    expect(tinggal.pilihan).toBeUndefined();
    expect(tinggal.jawab).toMatch(/di rumah orangtua Penggugat di Desa Sukamaju.*terakhir tinggal bersama di rumah nenek Penggugat di Kabonena/);
  });

  it("data yang tidak ada TIDAK dikarang: siapa pergi dan upaya rukun menjadi pilihan yang wajib dipilih petugas", () => {
    const j = jawabanDari(susun("", TEMPLAT_04)).slice(0, TEMPLAT_04.length);
    const pergi = j.find((b: any) => /meninggalkan/.test(b.tanya));
    expect(pergi.pilihan).toEqual(["Yang meninggalkan kediaman bersama adalah Penggugat;", "Yang meninggalkan kediaman bersama adalah Tergugat;"]);
    expect(pergi.perluDiisi).toBe(true);
    const upaya = j.find((b: any) => /rukun kembali/.test(b.tanya));
    expect(upaya.pilihan).toHaveLength(2);
    expect(upaya.pilihan[1]).toMatch(/^Belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat/);
    const anak = j.find((b: any) => /dikaruniai anak/.test(b.tanya));
    expect(anak.pilihan).toEqual(["Penggugat dan Tergugat sudah dikaruniai anak;", "Penggugat dan Tergugat belum dikaruniai anak;"]);
  });

  it("hubungan saksi dan tempat melihat yang hanya diketahui saksi dibuang dari kalimat, barisnya tetap 'perlu diisi'", () => {
    const hasil = susun(POSITA_C, TEMPLAT_A1, { kode: "A1" });
    const j = hasil.saksi[0].jawaban;
    const kenal = j.find((b: any) => /kenal/.test(b.tanya));
    expect(kenal.jawab).not.toMatch(/karena saya/);
    expect(hasil.perluDiisi.map((x: any) => x.no)).toContain(kenal.no);
  });
});

// ============================================================================
// Panel ABT (abt.js) - butir 12 dan 13
// ============================================================================
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const bacaEkst = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = bacaEkst("panel-alat.js");
const SUMBER_ABT = process.env.ALETA_UJI_ABT ? readFileSync(process.env.ALETA_UJI_ABT, "utf8").replace(/\r\n/g, "\n") : bacaEkst("abt.js");
const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa sejak bulan November 2022 sering terjadi perselisihan karena Tergugat tidak memberi nafkah;",
  "0033": "10 September 2026",
  "1197": "Saksi Satu",
  "1203": "Saksi Dua",
  "2021": "",
  "2022": "",
};
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 5000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
type Minta = { url: string; cara: string; badan: string };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { simpanan?: Record<string, unknown>; alasanPosita?: unknown }) {
  const baris = Object.keys(ISI)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${ISI[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>${NOMOR}</span></h3><p class="cetak"><a id="cetak" href="${ASAL_ABT}/preview?c=10018&b=B&a=A">CETAK</a></p>` +
      `<table>${baris}</table></div></div></body></html>`,
    { url: `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = JSON.parse(JSON.stringify(p.simpanan ?? {}));
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.0.0" }), getURL: (x: string) => x, sendMessage: (_p: unknown, b?: (x: unknown) => void) => b && b({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const h: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) h[k] = JSON.parse(JSON.stringify(simpanan[k]));
          return h;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Minta[] = [];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (teks: string) => new Response(Buffer.from(teks, "latin1"), { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badan = typeof opsi?.body === "string" ? opsi.body : "";
    minta.push({ url, cara, badan });
    if (url.includes("/aleta-bot/abt/usulan")) {
      const m = JSON.parse(badan || "{}");
      if (m.sumber === "siapa") return json({ data: { available: true, pengguna: { nama: "Uji", peran: "Super Admin" }, kapabilitas: {} } });
      if (m.sumber === "alasan-posita") return json({ data: { available: true, ...(p.alasanPosita === undefined ? {} : { alasanPosita: p.alasanPosita }) } });
      if (m.sumber === "saksi-sdg") return json({ data: { available: true, saksiSdg: { ok: true, alasan: [], saksi: [] } } });
      return json({ data: { available: true } });
    }
    if (url.includes("/tanyajawab_perkara_edit?")) {
      if (badan.includes("load_template")) {
        return html(`<script>\n var ajax_data = ${JSON.stringify({ "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya kenal;" } })} \n</script>`);
      }
      return html(`<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`);
    }
    if (url.includes("/tanyajawab_template_edit?")) return html("<script>\n var ajax_data = [] \n</script>");
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.confirm = () => true;
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { w, minta, simpanan };
}
const panel = (h: ReturnType<typeof buka>) => h.w.document.getElementById("aleta-panel-abt") as any;
const tombol = (h: ReturnType<typeof buka>, teks: string) =>
  Array.from(panel(h)?.querySelectorAll("button") || []).find((b: any) => b.textContent === teks) as any;
async function bukaFormSdg(h: ReturnType<typeof buka>) {
  try {
    (await sampai(() => tombol(h, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
  } catch (e) {
    const p = panel(h);
    throw new Error(
      `${(e as Error).message}; panel=${Boolean(p)}; tombol=${JSON.stringify(Array.from(p?.querySelectorAll("button") || []).map((b: any) => b.textContent))}; minta=${JSON.stringify(h.minta.map((m) => m.url + " " + m.badan.slice(0, 40)))}`
    );
  }
  return sampai(() => panel(h)?.querySelector(".aleta-sdg-form"), "blangko SDG");
}
const urutanModus = (form: any) =>
  Array.from(form.querySelector(".aleta-sdg-modus select").options).map((o: any) => o.value);
const SESUAI = ["perselisihan terus-menerus", "tidak memberi nafkah"];

describe("butir 13 - urutan dropdown modus saksi", () => {
  it("UI Baru: 'hanya tahu sudah pisah' tepat sesudah 'tidak tahu sebabnya'; pilihan yang sudah dibuat tetap", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" }, alasanPosita: { ok: true, alasan: SESUAI, asalPosita: "ekstensi" } });
    const form = await bukaFormSdg(h);
    await sampai(() => urutanModus(form)[4] === "tahu-pisah", "diurutkan");
    expect(urutanModus(form)).toEqual(["sama", "mendengar", "sebagian", "tidak-tahu", "tahu-pisah", "tidak-melihat", "dari-cerita", "ragu"]);
    const pilih = form.querySelector(".aleta-sdg-modus select");
    expect(pilih.value).toBe("sama");
    expect(pilih.options[4].textContent).toBe("Tidak tahu pertengkarannya, hanya tahu sudah pisah");
    expect(pilih.options[3].textContent).toBe("Tahu berselisih & berpisah, tidak tahu sebabnya");
  });

  it("Lama: urutan semula, tidak ada permintaan alasan-posita", async () => {
    const h = buka({ simpanan: { ujiTampilan: "lama" }, alasanPosita: { ok: true, alasan: SESUAI, asalPosita: "ekstensi" } });
    const form = await bukaFormSdg(h);
    await tunggu(80);
    expect(urutanModus(form)).toEqual(["sama", "mendengar", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"]);
    expect(h.minta.some((m) => m.badan.includes("alasan-posita"))).toBe(false);
  });
});

describe("butir 12 - centang modus 'Hanya sebagian': sesuai posita di atas, lainnya terlipat", () => {
  it("yang tampil langsung hanya alasan posita; 14 lainnya di 'Lainnya (di luar posita)' yang terlipat", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" }, alasanPosita: { ok: true, alasan: SESUAI, asalPosita: "ekstensi" } });
    const form = await bukaFormSdg(h);
    const kotak = await sampai(() => {
      const k = form.querySelectorAll(".aleta-sdg-alasan-saksi")[1];
      return k && /^posita:/.test(k.getAttribute("data-t6-kelompok") || "") ? k : null;
    }, "dikelompokkan menurut posita");
    const lain = kotak.querySelector("details.aleta-t6-alasan-lain");
    const langsung = Array.from(kotak.querySelectorAll("input[type=checkbox]")).filter((c: any) => !lain.contains(c)).map((c: any) => c.value);
    expect(langsung).toEqual(SESUAI);
    expect(kotak.querySelector(".aleta-t6-alasan-posita-kepala").textContent).toBe("Sesuai posita (2)");
    expect(lain.open).toBe(false);
    expect(lain.querySelector("summary").textContent).toBe("Lainnya (di luar posita) (14)");
    expect(lain.querySelectorAll("input[type=checkbox]")).toHaveLength(14);
    // Permintaan alasan-posita membawa posita 5125 halaman ini.
    const m = h.minta.find((x) => x.badan.includes('"alasan-posita"'))!;
    expect(JSON.parse(m.badan).posita).toContain("tidak memberi nafkah");
  });

  it("centang di bagian 'Lainnya' tetap terkirim untuk saksi itu (kotak centangnya yang sama)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" }, alasanPosita: { ok: true, alasan: SESUAI, asalPosita: "ekstensi" } });
    const form = await bukaFormSdg(h);
    const kotak = await sampai(() => {
      const k = form.querySelectorAll(".aleta-sdg-alasan-saksi")[1];
      return k && /^posita:/.test(k.getAttribute("data-t6-kelompok") || "") ? k : null;
    }, "dikelompokkan");
    const judi = Array.from(kotak.querySelectorAll("details input[type=checkbox]")).find((c: any) => c.value === "judi") as any;
    judi.checked = true;
    const nafkah = Array.from(kotak.querySelectorAll("input[type=checkbox]")).find((c: any) => c.value === "tidak memberi nafkah") as any;
    nafkah.checked = true;
    (Array.from(form.querySelectorAll("button")) as any[]).find((b) => b.textContent === "Susun keterangan para saksi").click();
    const kirim = await sampai(() => h.minta.find((x) => x.badan.includes('"saksi-sdg"')), "muatan saksi-sdg");
    const saksi2 = JSON.parse(kirim.badan).saksi[1];
    expect(saksi2.modus).toBe("sebagian");
    expect(saksi2.alasan.sort()).toEqual(["judi", "tidak memberi nafkah"]);
  });

  it("posita tidak terbaca: semua alasan tampil seperti dahulu (tanpa lipatan)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" }, alasanPosita: { ok: false, alasan: [], asalPosita: "" } });
    const form = await bukaFormSdg(h);
    await sampai(() => h.minta.some((x) => x.badan.includes('"alasan-posita"')), "diminta");
    await tunggu(80);
    const kotak = form.querySelectorAll(".aleta-sdg-alasan-saksi")[1];
    expect(kotak.getAttribute("data-t6-kelompok")).toBe("ya");
    expect(kotak.querySelector("details")).toBeNull();
    expect(kotak.querySelectorAll("input[type=checkbox]")).toHaveLength(16);
  });

  it("bot/portal lama (tanpa ruas alasanPosita): semua alasan tampil", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui" } });
    const form = await bukaFormSdg(h);
    await sampai(() => h.minta.some((x) => x.badan.includes('"alasan-posita"')), "diminta");
    await tunggu(80);
    const kotak = form.querySelectorAll(".aleta-sdg-alasan-saksi")[1];
    expect(kotak.querySelector("details")).toBeNull();
    expect(kotak.querySelectorAll("input[type=checkbox]")).toHaveLength(16);
  });
});
