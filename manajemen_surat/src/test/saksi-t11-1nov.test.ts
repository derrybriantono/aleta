// @vitest-environment node
/**
 * 1 Nov 2026 (T11) - kekurangan keterangan saksi, uji sasaran:
 *   1. itsbat nikah: umur, status, wali, saksi nikah, mahar, tanggal/tempat akad dari posita (isiJawabanSaksiPositaNikah);
 *   2. cerai huruf A dan D pada pengetahuan "tahu berselisih, tidak tahu sebab" (modus tidak-tahu): nol titik-titik pada butir sebab;
 *   3. saksi Tergugat: jawaban e-Court / hanya lisan di BAS / tidak ada sama sekali.
 * Kode asli, tanpa jaringan dan tanpa basis data. Tidak satu pun data perkara asli (nama dan angka rekaan).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const REPO = path.resolve(process.cwd(), "..");
const EKS = path.join(REPO, "ekstensi-sipp");
const require_ = createRequire(import.meta.url);
const svc = require_(path.join(REPO, "aleta_bot/services/abtUsulanService.js")) as any;
const isiS = require_(path.join(REPO, "aleta_bot/services/isiJawabanSaksiService.js")) as any;
const PB = require_(path.join(REPO, "aleta_bot/services/saksiPerbaikan1Nov.js")) as any;
const DS = require_(path.join(EKS, "blangko-derry-draf-saksi.js")) as any;
const ARAH = require_(path.join(EKS, "blangko-derry-saksi-arah.js")) as any;
const BDS = require_(path.join(EKS, "blangko-derry-saksi.js")) as any;
const M = require_(path.join(EKS, "saksi-katalog.js")) as any;

const POSITA: Record<string, string> = {
  "347":
    "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Mei 2015 di KUA Kecamatan Banawa;\nBahwa setelah menikah Penggugat dan Tergugat tinggal di rumah orang tua Penggugat di Desa Contoh dan telah dikaruniai 2 orang anak;\nBahwa sejak Januari 2024 rumah tangga Penggugat dan Tergugat mulai tidak harmonis karena Tergugat tidak memberi nafkah, sering berjudi dan tidak mau mendengar nasehat yang di sampaikan oleh Penggugat;\nBahwa puncaknya pada bulan Maret 2025 Tergugat pergi ke Makassar meninggalkan Penggugat dan sejak itu tidak pernah kembali;\nBahwa keluarga telah berusaha merukunkan namun tidak berhasil;",
  "346":
    "Bahwa Pemohon dan Termohon menikah pada tanggal 3 Juni 2016 di KUA Kecamatan Sindue;\nBahwa setelah menikah Pemohon dan Termohon tinggal di rumah orang tua Termohon dan telah dikaruniai 1 orang anak;\nBahwa sejak Februari 2024 rumah tangga Pemohon dan Termohon tidak harmonis karena Termohon cemburu berlebihan dan tidak menghargai Pemohon sebagai suami;\nBahwa puncaknya pada bulan April 2025 Pemohon pergi meninggalkan Termohon dan kembali ke rumah orang tua Pemohon;\nBahwa keluarga telah berusaha merukunkan namun tidak berhasil;",
};
const SEBUT: Record<string, [string, string]> = { "347": ["Penggugat", "Tergugat"], "346": ["Pemohon", "Termohon"] };
const FOLDER = {
  verstek: "1 Perceraian CG - BAS/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)",
  kontra: "1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P",
  pembuktianT: "1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T",
} as const;

type Baris = { no: string; tanya: string; jawab: string };
/** Set draf seperti drafSaksiOtomatis (pihak + dasar), baris berurutan seperti pakaiSetSaksi. */
function templatDraf(jenis: "346" | "347", huruf: string, folder: string, pihak: "P" | "T" = "P", dasar?: string): Baris[] {
  const [P, T] = SEBUT[jenis];
  const t = tawarkanSetSaksi({ namaJenis: jenis === "346" ? "Cerai Talak" : "Cerai Gugat", nomor: "9/Pdt.G/2026/PA.Dgl", folder, huruf, sebutanP: P, sebutanT: T, jumlahP: 1 });
  const p = ARAH.pilihSetPihak(t.set, pihak, dasar);
  if (!p) return [];
  let rows: Baris[] = p.utama.baris.map((r: Baris) => ({ no: "", tanya: r.tanya, jawab: r.jawab }));
  for (const tb of p.tambahan) {
    const akhir = rows.length && /masih ada (yang|keterangan|hal)/i.test(rows[rows.length - 1].tanya) ? rows.length - 1 : rows.length;
    rows = [...rows.slice(0, akhir), ...tb.baris.map((r: Baris) => ({ no: "", tanya: r.tanya, jawab: r.jawab })), ...rows.slice(akhir)];
  }
  return rows.map((r, i) => ({ ...r, no: String(i + 1) }));
}
type Saksi = { ke: number; pihak: "P" | "T"; modus: string; sumber?: string; sumberNama?: string; alasan?: string[]; dasar?: string };
/** Urutan rute 'saksi-sdg': susun -> lengkapi -> perbaiki. */
function susun(jenis: "346" | "347", templat: Baris[], posita: string, saksi: Saksi[], lain: Record<string, unknown> = {}) {
  const [P, T] = SEBUT[jenis];
  const s = saksi.map((x) => ({ alasan: [], sumber: "penggugat", sumberNama: P, ...x }));
  const h = svc.susunKeteranganSaksiSdg({ templat: templat.map((b) => ({ ...b })), posita, alasan: [], pelaku: T, lawan: P, nomorPerkara: "9/Pdt.G/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: jenis, alur: "15", tanggalSidang: "2026-10-20", saksi: s });
  isiS.lengkapi(h, { templatMasuk: templat, posita, jenisPerkara: jenis, alur: "15", pelaku: T, lawan: P, saksi: s });
  PB.perbaiki(h, { templat, posita, jenisPerkara: jenis, pelaku: T, lawan: P, saksi: s, ...lain });
  return h;
}
const cari = (h: any, i: number, re: RegExp) => (h.saksi[i].jawaban as any[]).find((j) => re.test(j.tanya));


const iS = require_(path.join(REPO, "aleta_bot/services/isiJawabanSaksiPosita.js")) as any;
const nikah = require_(path.join(REPO, "aleta_bot/services/isiJawabanSaksiPositaNikah.js")) as any;
const fk = require_(path.join(REPO, "aleta_bot/services/isiJawabanSaksiFakta.js")) as any;

// ----------------------------------------------------------------------------
// 1. Itsbat nikah
// ----------------------------------------------------------------------------
type Hasil = Record<string, { nilai: string; yakin: string } | null>;
const KUNCI = ["umurP1", "umurP2", "statusP1", "statusP2", "waliNama", "waliHubungan", "saksiNikah1", "saksiNikah2", "mahar", "tglNikah", "tempatNikah"];
/** Fakta seperti yang dipakai pengisi jawaban: mesin deteksi bot (usulan) + pola tambahan posita, dipertimbangkan bangunFakta. */
function faktaItsbat(posita: string, jenis = "itsbat"): Hasil {
  const d = isiS.deteksiPosita({ posita, jenis, jenisPerkara: "360", alur: "permohonan" });
  const F = fk.bangunFakta({ usulan: d.usulan, tambahan: iS.positaTambahan(posita, jenis) });
  const h: Hasil = {};
  for (const k of KUNCI) h[k] = F.ambil(k);
  return h;
}
const nilai = (h: Hasil, k: string) => (h[k] && h[k]!.yakin !== "ragu" ? h[k]!.nilai.toLowerCase() : null);

const KASUS: Array<{ nama: string; posita: string; harap: Record<string, string | RegExp> }> = [
  {
    nama: "1 butir bernomor, baku (jejaka/perawan, umur, wali, dua saksi, mas kawin tunai)",
    posita:
      "1. Bahwa pada tanggal 07 Mei 2017 Pemohon I dan Pemohon II telah melangsungkan pernikahan di Desa Maku, Kecamatan Dolo menurut agama Islam dengan wali nikah ayah kandung Pemohon II bernama Ludin, disaksikan oleh dua orang saksi masing-masing bernama Millo dan Maliwan dengan mas kawin berupa uang Rp. 100.000 dibayar tunai;\n2. Bahwa pada saat menikah Pemohon I berstatus jejaka berumur 24 tahun dan Pemohon II berstatus perawan berumur 18 tahun;",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "24", umurP2: "18", waliNama: "ludin", waliHubungan: "ayah kandung pemohon ii", saksiNikah1: "millo", saksiNikah2: "maliwan", mahar: /^uang rp\. 100\.000.*tunai/, tglNikah: "7 mei 2017" },
  },
  {
    nama: "2 ejaan perjaka/gadis, usia, bin, mahar alat salat",
    posita:
      "Bahwa pada hari Sabtu tanggal 07 Mei 2017 Pemohon I dan Pemohon II telah menikah menurut hukum Islam di rumah orang tua Pemohon II di Desa Maku Kecamatan Dolo.\nBahwa pada saat menikah Pemohon I berstatus perjaka berusia 24 tahun dan Pemohon II berstatus gadis berusia 18 tahun.\nBahwa yang bertindak sebagai wali nikah adalah ayah kandung Pemohon II bernama Ludin bin Samad.\nBahwa pernikahan disaksikan oleh dua orang saksi yaitu Millo dan Maliwan.\nBahwa maharnya berupa seperangkat alat salat dibayar tunai.",
    harap: { statusP1: "perjaka", statusP2: "gadis", umurP1: "24", umurP2: "18", waliNama: "ludin bin samad", saksiNikah1: "millo", saksiNikah2: "maliwan", mahar: "seperangkat alat salat, dibayar tunai", tglNikah: "7 mei 2017" },
  },
  {
    nama: "3 duda/janda, paman wali, dua saksi (2 (dua) orang), mahar uang dibayar kontan",
    posita:
      "1. Bahwa pada tanggal 3 Januari 2010 Pemohon I dan Pemohon II telah melangsungkan pernikahan di Kecamatan Sirenja;\n2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus duda dan Pemohon II berstatus janda;\n3. Bahwa pernikahan tersebut dilaksanakan dengan wali nikah paman Pemohon II bernama Rahman;\n4. Bahwa pernikahan tersebut dihadiri oleh 2 (dua) orang saksi bernama Ahmad dan Basri;\n5. Bahwa mas kawin berupa uang sebesar Rp. 500.000,- (lima ratus ribu rupiah) dibayar kontan;",
    harap: { statusP1: "duda", statusP2: "janda", waliNama: "rahman", waliHubungan: "paman pemohon ii", saksiNikah1: "ahmad", saksiNikah2: "basri", mahar: /500\.000.*kontan/, tglNikah: "3 januari 2010" },
  },
  {
    nama: "4 umur dan status dalam kurung, wali dengan hubungan dalam kurung, mahar emas dihutang",
    posita:
      "Bahwa Pemohon I (umur 30 tahun, jejaka) dan Pemohon II (umur 25 tahun, perawan) menikah pada tanggal 12 Agustus 2005.\nBahwa wali nikahnya adalah Abdul Karim (ayah kandung Pemohon II).\nBahwa saksi nikah masing-masing bernama Sudirman dan Hasan.\nBahwa mahar berupa emas 5 gram dihutang.",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "30", umurP2: "25", waliNama: "abdul karim", waliHubungan: "ayah kandung pemohon ii", saksiNikah1: "sudirman", saksiNikah2: "hasan", mahar: "emas 5 gram, dihutang", tglNikah: "12 agustus 2005" },
  },
  {
    nama: "5 umur dengan angka huruf (dua puluh lima / tujuh belas)",
    posita: "Bahwa Pemohon I berstatus jejaka dengan usia dua puluh lima tahun dan Pemohon II berstatus perawan dengan usia tujuh belas tahun saat menikah.",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "25", umurP2: "17" },
  },
  {
    nama: "6 itsbat kontensius (Pemohon dan Termohon), kakak wali, saksi dengan sebutan, mahar kebun belum dibayar",
    posita:
      "Bahwa saat menikah Pemohon berumur 22 tahun berstatus jejaka dan Termohon berumur 19 tahun berstatus perawan.\nBahwa wali nikah Termohon adalah kakak kandung bernama Yusuf.\nBahwa dengan disaksikan oleh Pak Daeng dan Pak Ali sebagai saksi.\nBahwa mahar berupa sebidang kebun yang belum dibayar.",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "22", umurP2: "19", waliNama: "yusuf", saksiNikah1: "pak daeng", saksiNikah2: "pak ali", mahar: "sebidang kebun yang belum dibayar" },
  },
  {
    nama: "7 satu kalimat panjang: wali + yang menikahkan + saksi + mahar (nama penghulu tidak terbaca sebagai saksi)",
    posita:
      "Bahwa Pemohon I telah menikah dengan Pemohon II pada tahun 1998 di Desa Lero.\nBahwa wali nikahnya yaitu Ludin (Ayah Kandung Pemohon II) dan yang menikahkan adalah Imam Desa bernama Hamsih, saksinya Millo dan Maliwan, maharnya berupa uang Rp. 50.000 dibayar tunai.",
    harap: { waliNama: "ludin", waliHubungan: "ayah kandung pemohon ii", mahar: /^uang rp\. 50\.000.*tunai/, tglNikah: "tahun 1998" },
  },
  {
    nama: "8 wali nasab ayah kandung Termohon, mahar 'uang tunai Rp. ...' tidak terpotong",
    posita:
      "Bahwa pada waktu menikah Pemohon berusia 20 tahun dengan status perjaka, sedangkan Termohon berusia 17 tahun dengan status gadis.\nBahwa pernikahan dilangsungkan dengan wali nasab yaitu ayah kandung Termohon bernama Mansur.\nBahwa pernikahan disaksikan dua orang saksi yaitu Rudi dan Anto.\nBahwa maskawin berupa uang tunai Rp. 1.000.000,-.",
    harap: { statusP1: "perjaka", statusP2: "gadis", umurP1: "20", umurP2: "17", waliNama: "mansur", waliHubungan: "ayah kandung termohon", saksiNikah1: "rudi", saksiNikah2: "anto", mahar: /^uang tunai rp\. 1\.000\.000/ },
  },
  {
    nama: "9 satu kalimat sangat panjang dengan duda cerai mati",
    posita:
      "Bahwa Pemohon I dan Pemohon II menikah di rumah mempelai perempuan di Desa Tolai pada tanggal 5 Maret 1995, saat itu Pemohon I berstatus duda cerai mati umur 40 tahun dan Pemohon II berstatus perawan umur 21 tahun, dengan wali nikah ayah kandung bernama Dg. Mapaselle, saksi nikah Arifin dan Syamsul, mahar uang Rp 250.000 tunai.",
    harap: { statusP1: "duda cerai mati", statusP2: "perawan", umurP1: "40", umurP2: "21", waliNama: "dg. mapaselle", saksiNikah1: "arifin", saksiNikah2: "syamsul", mahar: /250\.000/, tglNikah: "5 maret 1995" },
  },
  {
    nama: "10 urutan pihak dibalik (Termohon dahulu): umur dan status mengikuti label, bukan urutan",
    posita: "Bahwa Pemohon dan Termohon menikah pada tanggal 1 Juni 2015 di Palu, Termohon berstatus perawan umur 20 tahun, Pemohon berstatus jejaka umur 26 tahun, wali nikah ayah kandung Termohon bernama Hasan, disaksikan saksi bernama Rizal dan Fandi, mas kawin berupa cincin emas 2 gram dibayar tunai.",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "26", umurP2: "20", waliNama: "hasan", saksiNikah1: "rizal", saksiNikah2: "fandi", mahar: "cincin emas 2 gram, dibayar tunai", tglNikah: "1 juni 2015" },
  },
  {
    nama: "11 umur 'saat menikah' sebelum status, wali saudara kandung, saksi nikah adalah",
    posita:
      "Bahwa Pemohon I berumur 24 tahun saat menikah dan statusnya jejaka, Pemohon II berumur 18 tahun saat menikah dan statusnya perawan.\nBahwa mahar berupa Al-Quran dan seperangkat alat shalat, dibayar tunai.\nBahwa wali nikah adalah saudara kandung Pemohon II bernama Ibrahim.\nBahwa saksi nikah adalah Hasanuddin dan Marwan.",
    harap: { statusP1: "jejaka", statusP2: "perawan", umurP1: "24", umurP2: "18", waliNama: "ibrahim", waliHubungan: "saudara kandung pemohon ii", saksiNikah1: "hasanuddin", saksiNikah2: "marwan", mahar: "al-quran dan seperangkat alat shalat, dibayar tunai" },
  },
  {
    nama: "12 umur dengan 'berumur masing-masing 24 dan 18 tahun' dan status berurutan",
    posita: "Bahwa pada saat menikah Pemohon I dan Pemohon II berstatus jejaka dan perawan, berumur masing-masing 24 dan 18 tahun.\nBahwa Pemohon I dan Pemohon II berstatus jejaka dan perawan.",
    harap: {},
  },
  {
    nama: "13 mahar uang dengan titik di dalam angka dan tanpa cara bayar",
    posita: "Bahwa pernikahan tersebut disertai mahar berupa uang sebesar Rp. 1.500.000,- (satu juta lima ratus ribu rupiah).\nBahwa wali nikah ayah kandung Pemohon II bernama Syukur.",
    harap: { waliNama: "syukur", mahar: /^uang sebesar rp\. 1\.500\.000/ },
  },
  {
    nama: "14 pasangan tunggal: Pemohon janda, hanya status dan umur Pemohon",
    posita: "Bahwa pada saat pernikahan, Pemohon I berstatus janda umur 35 tahun.",
    harap: { statusP1: "janda", umurP1: "35" },
  },
];

describe("T11/1 - itsbat nikah: butir nikah dari posita permohonan (aturan, tanpa AI)", () => {
  for (const k of KASUS) {
    it(k.nama, () => {
      const h = faktaItsbat(k.posita);
      for (const [kunci, harap] of Object.entries(k.harap)) {
        // tanda koma sebelum cara bayar tidak berarti (dua pembaca menulisnya berbeda)
        const n = (nilai(h, kunci) ?? "").replace(/,\s/g, " ");
        const hrp = typeof harap === "string" ? harap.replace(/,\s/g, " ") : harap;
        if (hrp instanceof RegExp) expect(n, kunci).toMatch(hrp);
        else expect(n, kunci).toBe(hrp);
      }
    });
  }
  it("kasus 12: dua pihak berurutan - status dan umur 'masing-masing' dibagi sesuai urutan", () => {
    const r = nikah.faktaNikahDariPosita(["Pemohon I dan Pemohon II berstatus jejaka dan perawan, berumur masing-masing 24 dan 18 tahun"]);
    const peta = Object.fromEntries(r.map((x: any) => [x.kunci, x.nilai]));
    expect(peta).toMatchObject({ statusP1: "jejaka", statusP2: "perawan", umurP1: "24", umurP2: "18" });
  });
  it("nama disalin apa adanya (huruf besar semua, gelar, bin) dan 'sebagai saksi' tidak ikut", () => {
    const h = faktaItsbat("Bahwa wali nikah adalah ayah kandung Pemohon II bernama H. LUDIN bin SAMAD.\nBahwa disaksikan dua orang saksi yaitu MILLO dan MALIWAN.");
    expect(h.waliNama!.nilai).toBe("H. LUDIN bin SAMAD");
    expect(h.saksiNikah1!.nilai).toBe("MILLO");
    expect(h.saksiNikah2!.nilai).toBe("MALIWAN");
  });
});

describe("T11/1 - tidak salah tangkap: ragu = tetap titik-titik", () => {
  it("posita tanpa data nikah: tidak ada satu pun butir terisi", () => {
    const h = faktaItsbat("Bahwa Pemohon I dan Pemohon II tidak mempunyai kutipan akta nikah, karena buku nikah hilang.\nBahwa Pemohon I dan Pemohon II tinggal di Desa Maku.");
    for (const k of ["umurP1", "umurP2", "statusP1", "statusP2", "waliNama", "waliHubungan", "saksiNikah1", "saksiNikah2", "mahar", "tglNikah"]) expect(nilai(h, k), k).toBeNull();
  });
  it("'tidak mengetahui wali dan saksi' tidak menjadi nama; status tanpa umur tidak mengarang umur", () => {
    const h = faktaItsbat("Bahwa Pemohon tidak mengetahui lagi mengenai wali dan saksi karena sudah lama.\nBahwa Pemohon I berstatus jejaka dan Pemohon II berstatus perawan pada saat menikah.");
    expect(nilai(h, "waliNama")).toBeNull();
    expect(nilai(h, "saksiNikah1")).toBeNull();
    expect(nilai(h, "umurP1")).toBeNull();
    expect(nilai(h, "statusP1")).toBe("jejaka");
  });
  it("umur anak, umur lain, dan tanggal lahir bukan umur/tanggal nikah", () => {
    const h = faktaItsbat("Bahwa Pemohon I dan Pemohon II dikaruniai seorang anak bernama Budi yang lahir pada tanggal 3 Maret 2012 berumur 14 tahun.\nBahwa Pemohon II lahir pada tanggal 5 Mei 1990.");
    expect(nilai(h, "umurP1")).toBeNull();
    expect(nilai(h, "umurP2")).toBeNull();
    expect(nilai(h, "tglNikah")).toBeNull();
  });
  it("hubungan wali dalam kalimat lain tidak menjadi status/umur pihak (rujukan 'ayah kandung Pemohon II')", () => {
    const r = nikah.faktaNikahDariPosita(["Bahwa wali nikah ayah kandung Pemohon II berumur 60 tahun berstatus duda bernama Ludin"]);
    expect(r.find((x: any) => /umur|status/.test(x.kunci))).toBeUndefined();
  });
  it("dua nilai berbeda untuk pihak yang sama = ragu = tidak dikeluarkan", () => {
    const r = nikah.faktaNikahDariPosita(["Pemohon I berumur 24 tahun saat menikah.", "Pemohon I berumur 31 tahun saat menikah."]);
    expect(r.find((x: any) => x.kunci === "umurP1")).toBeUndefined();
  });
  it("satu nama saksi saja (tanpa pasangan) tidak diisi; nama bukan huruf besar tidak diisi", () => {
    expect(nikah.faktaNikahDariPosita(["Bahwa disaksikan oleh seorang saksi bernama Millo."]).find((x: any) => /saksiNikah/.test(x.kunci))).toBeUndefined();
    expect(nikah.faktaNikahDariPosita(["Bahwa wali nikah ayah kandung Pemohon II bernama ludin."]).find((x: any) => x.kunci === "waliNama")).toBeUndefined();
  });
  it("nama penghulu yang disebut 'bernama' pada kalimat yang menikahkan tidak menjadi saksi nikah", () => {
    const r = nikah.faktaNikahDariPosita(["Bahwa yang menikahkan adalah Imam Desa bernama Hamsih."]);
    expect(r.find((x: any) => /saksiNikah/.test(x.kunci))).toBeUndefined();
  });
  it("jenis cerai tidak ikut membaca butir nikah ini", () => {
    const r = iS.positaTambahan("Bahwa Pemohon I berstatus jejaka berumur 24 tahun. Bahwa disaksikan dua orang saksi yaitu Rudi dan Anto.", "cerai");
    expect(r.find((x: any) => /saksiNikah|statusP|umurP/.test(x.kunci))).toBeUndefined();
  });
  it("bilangan huruf: dua puluh lima, tujuh belas, sebelas, 9 (di bawah 10 = bukan umur nikah)", () => {
    expect(nikah.bilangan("dua puluh lima")).toBe(25);
    expect(nikah.bilangan("tujuh belas")).toBe(17);
    expect(nikah.bilangan("sebelas")).toBe(11);
    expect(nikah.bilangan("tiga puluh")).toBe(30);
    expect(nikah.faktaNikahDariPosita(["Pemohon I berumur 9 tahun saat menikah"]).find((x: any) => x.kunci === "umurP1")).toBeUndefined();
  });
  it("mahar 'uang tunai Rp ...' dipecah benar oleh uraiMahar: nominal tidak hilang, cara bayar tunai", () => {
    const u = fk.uraiMahar("uang tunai Rp. 1.000.000,-");
    expect(u.bayar).toBe("tunai");
    expect(u.barang).toMatch(/1\.000\.000/);
    expect(u.barang).not.toMatch(/tunai/);
    const v = fk.uraiMahar("emas 5 gram dihutang");
    expect(v).toMatchObject({ barang: "emas 5 gram", bayar: "hutang" });
  });
  it("kinerja: seribu kali dalam waktu wajar (satu lintasan regex per butir)", () => {
    const posita = KASUS[0].posita;
    const t0 = Date.now();
    for (let i = 0; i < 300; i++) iS.positaTambahan(posita, "itsbat");
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

// ----------------------------------------------------------------------------
// 2. Cerai: huruf A dan D pada "tahu berselisih, tidak tahu sebab" (modus tidak-tahu)
// ----------------------------------------------------------------------------
const RE_BERGANTUNG = /kebiasaan|kekerasan|bekas\s+luka|kejadian\s+itu|dinasihati\s+agar\s+berhenti|penyebab perselisihan dan pertengkaran tersebut/i;
const RE_TITIK = /\.{3,}|…/;

describe("T11/2 - cerai A/D, modus 'tahu berselisih, tidak tahu sebab': butir sebab konsisten, bukan titik-titik", () => {
  it("matriks: CG/CT x huruf F/A/D x verstek/kontradiktoir x posita ada/tidak -> nol titik-titik pada butir yang bergantung pada sebab", () => {
    let susunan = 0;
    let butirSebab = 0;
    const sisa: string[] = [];
    for (const jenis of ["347", "346"] as const)
      for (const huruf of ["F", "A", "D"])
        for (const folder of [FOLDER.verstek, FOLDER.kontra])
          for (const pos of [POSITA[jenis], ""]) {
            const templat = templatDraf(jenis, huruf, folder);
            const h = susun(jenis, templat, pos, [{ ke: 1, pihak: "P", modus: "tidak-tahu" }, { ke: 2, pihak: "P", modus: "tidak-tahu", sumber: "keluarga", sumberNama: "keluarga mereka" }]);
            susunan += 1;
            h.saksi.forEach((s: any, i: number) =>
              s.jawaban.forEach((b: any) => {
                if (!RE_BERGANTUNG.test(b.tanya)) return;
                butirSebab += 1;
                if (RE_TITIK.test(b.jawab)) sisa.push(`${jenis}|${huruf}|saksi ${i + 1}|${b.tanya.slice(0, 50)}`);
                else expect(b.jawab, b.tanya).toMatch(/(?:penyebab|sebab)\w*[^.;]*\b(?:tidak|belum)\b[^.;]*(?:ketahui|tahu)|\b(?:tidak|belum)\b[^.;]*(?:ketahui|tahu)[^.;]*(?:penyebab|sebab)/i);
              })
            );
          }
    expect(susunan).toBe(24);
    expect(butirSebab).toBeGreaterThan(100);
    expect(sisa).toEqual([]);
  }, 120000);

  it("bunyi saksi 1 dan saksi 2 berbeda pada butir yang sama; tanda pilihan pengetahuan, bukan gugatan", () => {
    for (const huruf of ["A", "D"]) {
      const templat = templatDraf("347", huruf, FOLDER.verstek);
      const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu" }, { ke: 2, pihak: "P", modus: "tidak-tahu" }]);
      h.saksi[0].jawaban.forEach((b: any, n: number) => {
        if (!RE_BERGANTUNG.test(b.tanya)) return;
        expect(h.saksi[1].jawaban[n].jawab, b.tanya).not.toBe(b.jawab);
        expect(b.usulan.sumber).toBe("pilihan pengetahuan saksi");
        expect(b.usulan.peringatan).toBeUndefined();
        expect(b.jawab).not.toMatch(/⚠/);
      });
    }
  });

  it("butir yang tidak bergantung pada sebab tetap seperti sekarang (sama dengan modus 'sama'), tanpa merusak butir lain", () => {
    for (const huruf of ["A", "D"]) {
      const templat = templatDraf("347", huruf, FOLDER.verstek);
      const tt = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu" }, { ke: 2, pihak: "P", modus: "sebagian" }]);
      for (const re of [/kenal dengan/i, /dikaruniai anak/i, /apa hubungan antara/i, /di mana Penggugat dan Tergugat tinggal bersama/i, /menyampaikan kepada Tergugat/i, /hal yang menghalangi/i]) {
        const b = cari(tt, 0, re);
        expect(b, String(re)).toBeTruthy();
        expect(b.usulan?.sumber ?? "").not.toBe("pilihan pengetahuan saksi");
      }
    }
  });

  it("modus lain tidak berubah: tidak ada butir 'pilihan pengetahuan saksi' di luar modus tidak-tahu dan arah", () => {
    for (const modus of ["sama", "mendengar", "sebagian", "tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"]) {
      for (const huruf of ["A", "D"]) {
        const templat = templatDraf("347", huruf, FOLDER.verstek);
        const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus }, { ke: 2, pihak: "P", modus: "sebagian", sumber: "keluarga", sumberNama: "keluarga mereka" }]);
        expect(h.perbaikan1Nov.sebab, `${modus}/${huruf}`).toBe(0);
        for (const s of h.saksi) for (const b of s.jawaban) expect(String(b.usulan?.sumber ?? ""), `${modus}/${huruf}`).not.toBe("pilihan pengetahuan saksi");
      }
    }
  });
});

// ----------------------------------------------------------------------------
// 3. Saksi Tergugat tanpa jawaban/duplik e-Court
// ----------------------------------------------------------------------------
describe("T11/3 - saksi Tergugat: e-Court, hanya lisan di BAS, atau tidak ada sama sekali", () => {
  const templat = templatDraf("347", "F", FOLDER.pembuktianT, "T", "jawaban");
  const saksiT: Saksi[] = [{ ke: 1, pihak: "T", modus: "sama", dasar: "jawaban" }, { ke: 2, pihak: "T", modus: "sama", dasar: "jawaban" }];
  const ECOURT = {
    jawaban: "Bahwa dalil Penggugat yang menyatakan sering terjadi pertengkaran adalah tidak benar. Tergugat masih ingin mempertahankan rumah tangga dengan Penggugat.",
    duplik: "Bahwa yang benar Penggugat pergi meninggalkan rumah tanpa alasan yang jelas. Yang sebenarnya masalahnya karena Penggugat sering keluar rumah tanpa izin.",
  };
  const ARAH_ = ARAH;
  const LISAN = {
    jawaban: [
      { tanya: "Jawaban Tergugat", jawab: "Tergugat membantah dalil Penggugat tentang pertengkaran, tidak benar sering bertengkar;" },
      { tanya: "", jawab: "Tergugat masih ingin mempertahankan rumah tangga dengan Penggugat;" },
    ],
    duplik: [{ tanya: "", jawab: "Yang benar Penggugat pergi meninggalkan rumah tanpa alasan, masalahnya karena Penggugat sering keluar rumah tanpa izin." }],
  };

  it("(a) e-Court ada: bunyi dari jawaban/duplik e-Court, sumber 'jawaban Tergugat', lisan tidak menimpa", () => {
    const n = ARAH_.naskahTDenganLisan(ECOURT, LISAN);
    expect(n.jawaban).toBe(ECOURT.jawaban);
    expect(n.duplik).toBe(ECOURT.duplik);
    expect(n.asal).toEqual({ jawaban: "", duplik: "" });
    const h = susun("347", templat, POSITA["347"], saksiT, { naskahT: n });
    const b = cari(h, 0, /mempertahankan/i);
    expect(b.jawab).toMatch(/masih ingin mempertahankan/);
    expect(b.usulan.sumber).toBe("jawaban Tergugat");
    expect(h.jawabanTBelumAda).toBeUndefined();
    expect(h.catatan || "").not.toMatch(/belum ada/);
  });

  it("(b) hanya lisan di BAS: naskah dilengkapi dari tanya-jawab lisan apa adanya, butir terisi, sumber menyebut lisan BAS", () => {
    const n = ARAH_.naskahTDenganLisan({ jawaban: "", duplik: "" }, LISAN);
    expect(n.asal).toEqual({ jawaban: "lisan", duplik: "lisan" });
    expect(n.jawaban).toContain("Tergugat membantah dalil Penggugat tentang pertengkaran");
    expect(n.jawaban).toContain("Tergugat masih ingin mempertahankan rumah tangga dengan Penggugat");
    expect(n.duplik).toBe("Yang benar Penggugat pergi meninggalkan rumah tanpa alasan, masalahnya karena Penggugat sering keluar rumah tanpa izin.");
    const h = susun("347", templat, POSITA["347"], saksiT, { naskahT: n });
    const semua = (h.saksi[0].jawaban as any[]).map((j) => j.jawab).join(" ");
    expect(semua).not.toMatch(/judi|melalaikan kewajiban nafkah/i);
    const b = cari(h, 0, /mempertahankan/i);
    expect(b.jawab).toMatch(/masih ingin mempertahankan/);
    expect(b.usulan.sumber).toBe("jawaban lisan Tergugat (BAS)");
    expect(b.usulan.ket).toMatch(/LISAN/);
    expect(b.usulan.peringatan).toBe("jawaban");
    expect(cari(h, 0, /sebenarnya menjadi masalah/i).jawab).toMatch(/keluar rumah tanpa izin/);
    expect(h.jawabanTBelumAda).toBeUndefined();
  });

  it("(b') lisan hanya sebagian: jawaban e-Court + duplik lisan -> hanya duplik berasal lisan; lisan pendek (>= 20 huruf) terbaca", () => {
    const n = ARAH_.naskahTDenganLisan({ jawaban: ECOURT.jawaban, duplik: "" }, LISAN);
    expect(n.asal).toEqual({ jawaban: "", duplik: "lisan" });
    const pendek = ARAH_.naskahTDenganLisan({}, { jawaban: [{ jawab: "Tergugat menolak bercerai" }] });
    const h = susun("347", templat, POSITA["347"], saksiT, { naskahT: pendek });
    expect(cari(h, 0, /mempertahankan/i).jawab).toMatch(/masih ingin mempertahankan/);
    expect(h.jawabanTBelumAda).toBeUndefined();
  });

  it("(c) tidak ada sama sekali: butir tetap titik-titik + catatan jelas di panel", () => {
    const n = ARAH_.naskahTDenganLisan({ jawaban: "", duplik: "" }, { jawaban: [], duplik: [{ jawab: "  " }] });
    expect(n).toEqual({ jawaban: "", duplik: "", asal: { jawaban: "", duplik: "" } });
    const h = susun("347", templat, POSITA["347"], saksiT, { naskahT: n });
    expect(cari(h, 0, /sebenarnya menjadi masalah/i).jawab).toMatch(/\.\.\./);
    expect(h.jawabanTBelumAda).toBe(true);
    expect(h.catatan).toMatch(/Jawaban Tergugat belum ada/);
    expect(h.catatan).toMatch(/isi dari keterangan saksi atau pilih 'Ikut membenarkan gugatan Penggugat'/);
    // tanpa naskah sama sekali (jalur lama) juga begitu
    const h2 = susun("347", templat, POSITA["347"], saksiT, {});
    expect(h2.catatan).toMatch(/Jawaban Tergugat belum ada/);
  });

  it("pilihan 'ikut membenarkan gugatan' (dasar gugatan) tidak tersentuh catatan jawaban belum ada", () => {
    const tg = templatDraf("347", "F", FOLDER.pembuktianT, "T", "gugatan");
    const h = susun("347", tg, POSITA["347"], [{ ke: 1, pihak: "T", modus: "sama", dasar: "gugatan" }], {});
    expect(h.jawabanTBelumAda).toBeUndefined();
  });

  it("muatan ke bot membawa asal 'lisan' (susunMuatan)", () => {
    const m = BDS.susunMuatan({ nomorPerkara: "9/Pdt.G/2026/PA.Dgl", templat: [{ no: "1", tanya: "a?", jawab: "x" }], jenisPerkara: "347", pelaku: "Tergugat", lawan: "Penggugat", saksi: [{ ke: 1, pihak: "T", modus: "sama", dasar: "jawaban" }], naskahT: ARAH_.naskahTDenganLisan({}, LISAN) });
    expect(m.naskahT.asal).toEqual({ jawaban: "lisan", duplik: "lisan" });
    expect(m.naskahT.jawaban).toContain("Tergugat membantah");
  });
});
