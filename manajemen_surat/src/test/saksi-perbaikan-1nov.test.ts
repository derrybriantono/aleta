// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 - PERBAIKAN SUSUN KETERANGAN SAKSI (tinjauan docs/arahan/tinjau-saksi-1nov.md, keputusan pengguna 61-67)
 * ============================================================================
 * Uji PERILAKU dengan kode asli: set pertanyaan portal (tawarkanSetSaksi) -> pemilih set draf ekstensi -> bot susunKeteranganSaksiSdg
 * + isiJawabanSaksiService.lengkapi + saksiPerbaikan1Nov.perbaiki (urutan yang sama dengan rute 'saksi-sdg'), mesin katalog panel
 * ABT (saksi-katalog.js / saksi-susun.js), dan modul arah ekstensi (blangko-derry-saksi-arah.js). Matriks mini di bagian akhir
 * adalah potongan matriks agen F (D:/Aplikasi/aleta/tmp/w156/matriks-cerai.js) - pemeriksa temuannya sama, hasil harus NOL.
 *   61 draf tetap otomatis; butir dari gugatan/jawaban atau pengetahuan langsung bertanda peringatan (panel saja);
 *   62 saksi Tergugat cerai = jawaban & duplik, pilihan "ikut gugatan" = set Penggugat;
 *   63 arah Tolak/NO: menu tiga pilihan, bawaan "tidak tahu";
 *   64 cerai talak saksi Pemohon: "Pemohon tidak lagi menanggung nafkah Termohon" tetap bawaan;
 *   65 jumlah butir mengikuti keadaan (tidak dipotong);
 *   67 salah ketik posita yang masuk ke keterangan saksi dirapikan tanpa mengubah makna;
 *   temuan 3, 4, 6, 7, 8.
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

describe("61 - draf tetap otomatis, butir dari gugatan/pengetahuan langsung bertanda peringatan (panel saja)", () => {
  const templat = templatDraf("347", "F", FOLDER.verstek);
  it("butir yang diisi dari posita bertanda 'gugatan'; jawabannya tetap terisi (bukan dikosongkan)", () => {
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sebagian" }]);
    const nikah = cari(h, 0, /hubungan antara/i);
    expect(nikah.jawab).toMatch(/12 Mei 2015/);
    expect(nikah.usulan.peringatan).toBe("gugatan");
    const sebab = cari(h, 0, /penyebab/i);
    expect(sebab.usulan.peringatan).toBe("gugatan");
    // bentuk pertengkaran (kalimat contoh pengetahuan langsung) -> "pengetahuan"
    expect(cari(h, 0, /bentuk perselisihan/i).usulan.peringatan).toBe("pengetahuan");
    // tanda tidak pernah masuk ke bunyi jawaban (naskah cetak)
    for (const s of h.saksi) for (const j of s.jawaban) expect(j.jawab).not.toMatch(/⚠|peringatan|gugatan\/posita/i);
  });
  it("tanpa posita: 'melihat sendiri ... beberapa kali' tidak lagi disebut bersumber gugatan, tetapi bertanda pengetahuan langsung", () => {
    const h = susun("347", templat, "", [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sebagian" }]);
    const lihat = cari(h, 0, /melihat atau mendengar sendiri/i);
    expect(lihat.jawab).toMatch(/melihat dan mendengar sendiri/);
    expect(lihat.usulan.sumber).not.toMatch(/gugatan/);
    expect(lihat.usulan.peringatan).toBe("pengetahuan");
  });
  it("lencana panel: muncul selama jawaban masih susunan otomatis, hilang begitu petugas mengetik", () => {
    const r = { jawab: "A;", otomatis: "A;", usulan: { yakin: "cukup", sumber: "gugatan", peringatan: "gugatan" } };
    expect(ARAH.peringatanBaris(r)).toMatchObject({ jenis: "gugatan", label: "dari gugatan" });
    expect(ARAH.peringatanBaris({ ...r, jawab: "B;" })).toBeNull();
    // pasangJawaban ekstensi membawa tandanya ke baris
    const ps = BDS.pasangJawaban([{ no: "1", tanya: "T?", jawab: "Penyebabnya karena ...;", dasar: "Penyebabnya karena ...;" }], [{ jawab: "Penyebabnya karena judi;", usulan: { yakin: "cukup", sumber: "gugatan", peringatan: "gugatan" } }]);
    expect(ps.rows[0].usulan.peringatan).toBe("gugatan");
    expect(ARAH.peringatanBaris(ps.rows[0])).not.toBeNull();
  });
});

describe("62 - saksi Tergugat/Termohon cerai: jawaban & duplik, pilihan ikut gugatan", () => {
  it("set ber-pihak T ditawarkan dan hanya dipasang pada daftar saksi T (dasar jawaban); 'ikut gugatan' = set Penggugat", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", nomor: "9/Pdt.G/2026/PA.Dgl", folder: FOLDER.pembuktianT, huruf: "F", sebutanP: "Penggugat", sebutanT: "Tergugat", jumlahP: 1 });
    expect(t.set.some((x) => x.pihak === "T")).toBe(true);
    expect(ARAH.pilihSetPihak(t.set, "T", "jawaban").utama.id).toBe("cerai-saksi-tergugat");
    expect(ARAH.pilihSetPihak(t.set, "T", "gugatan").utama.id).toBe("cerai-F");
    expect(ARAH.pilihSetPihak(t.set, "P").utama.id).toBe("cerai-F");
    expect(DS.pilihSetDraf(t.set).utama.id).toBe("cerai-F");
    expect(templatDraf("347", "F", FOLDER.pembuktianT, "T", "jawaban")[0].jawab).toMatch(/\.\.\. Tergugat;$/);
  });
  it("keterangan saksi T disusun dari bantahan jawaban/duplik, tidak dari posita Penggugat; bertanda 'jawaban'", () => {
    const templat = templatDraf("347", "F", FOLDER.pembuktianT, "T", "jawaban");
    const naskahT = {
      jawaban: "Bahwa dalil Penggugat yang menyatakan sering terjadi pertengkaran adalah tidak benar. Tergugat masih ingin mempertahankan rumah tangga dengan Penggugat. Bahwa Tergugat selalu memberikan nafkah kepada Penggugat setiap bulan.",
      duplik: "Bahwa yang benar Penggugat pergi meninggalkan rumah tanpa alasan yang jelas. Yang sebenarnya masalahnya karena Penggugat sering keluar rumah tanpa izin.",
    };
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "T", modus: "sama", dasar: "jawaban" }, { ke: 2, pihak: "T", modus: "sama", dasar: "jawaban" }], { naskahT });
    const semua = (h.saksi[0].jawaban as any[]).map((j) => j.jawab).join(" ");
    expect(semua).not.toMatch(/judi|melalaikan kewajiban nafkah/i);
    expect(cari(h, 0, /sering terjadi perselisihan/i).jawab).toMatch(/tidak sering/);
    expect(cari(h, 0, /mempertahankan/i).jawab).toMatch(/masih ingin mempertahankan/);
    expect(cari(h, 0, /nafkah/i).jawab).toMatch(/Tergugat masih memberikan nafkah kepada Penggugat/);
    expect(cari(h, 0, /meninggalkan tempat tinggal/i).jawab).toMatch(/adalah Penggugat/);
    expect(cari(h, 0, /sebenarnya menjadi masalah/i).jawab).toMatch(/keluar rumah tanpa izin/);
    expect(cari(h, 0, /mempertahankan/i).usulan.peringatan).toBe("jawaban");
  });
  it("tanpa jawaban/duplik: butir dalil tetap titik-titik (tidak diisi posita Penggugat) dan ada catatan", () => {
    const templat = templatDraf("347", "F", FOLDER.pembuktianT, "T", "jawaban");
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "T", modus: "sama", dasar: "jawaban" }]);
    expect(cari(h, 0, /sebenarnya menjadi masalah/i).jawab).toMatch(/\.\.\./);
    expect(h.catatan).toMatch(/Jawaban dan duplik Tergugat belum terbaca/);
  });
  it("ikut gugatan: saksi T memakai set dan susunan saksi Penggugat seperti dahulu", () => {
    const templat = templatDraf("347", "F", FOLDER.pembuktianT, "T", "gugatan");
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "T", modus: "sama", dasar: "gugatan" }]);
    expect(cari(h, 0, /penyebab/i).jawab).toMatch(/judi/i);
  });
  it("muatan ekstensi membawa dasar saksi T dan naskah jawaban/duplik", () => {
    const m = BDS.susunMuatan({ nomorPerkara: "1", templat: [], pelaku: "Tergugat", lawan: "Penggugat", saksi: [{ pihak: "T", ke: 1, modus: "sama", sumber: "penggugat", alasan: [], dasar: "jawaban" }], naskahT: { jawaban: "isi jawaban", duplik: "" } });
    expect(m.saksi[0].dasar).toBe("jawaban");
    expect(m.naskahT.jawaban).toBe("isi jawaban");
    expect(BDS.bakukanPilihan({}, 0, { pihak: "T" })).toMatchObject({ dasar: "jawaban" });
    expect(ARAH.naskahT({ isi: {}, usulan: [{ kode: "12020", nilai: "J" }, { kode: "12024", nilai: "D" }] })).toEqual({ jawaban: "J", duplik: "D" });
  });
});

describe("63 - arah putusan Tolak/NO: menu tiga pilihan, bawaan tidak tahu", () => {
  it("arah dibaca dari blangko yang dipilih dan keterangan sidang SIPP", () => {
    expect(ARAH.arahPutusan({ blangko: "1 Perceraian CG/[03a] [Tolak] Cerai F Tidak Terbukti" })).toBe("tolak");
    expect(ARAH.arahPutusan({ blangko: "[Tolak Verstek] Kurang 6 Bulan" })).toBe("tolak");
    expect(ARAH.arahPutusan({ blangko: "[NO] Obscuur Libel" })).toBe("no");
    expect(ARAH.arahPutusan({ blangko: "BAS ALUR 04 [6]", sidang: [{ ket: "putus DITOLAK" }] })).toBe("tolak");
    expect(ARAH.arahPutusan({ blangko: "BAS ALUR 04 [6]", sidang: [{ ket: "putus TIDAK DAPAT DITERIMA" }] })).toBe("no");
    expect(ARAH.arahPutusan({ blangko: "BAS ALUR 02 [2]", sidang: [{ ket: "putus DIKABULKAN (verstek)" }] })).toBe("");
    expect(ARAH.arahPutusan({ blangko: "[01] [Kabul] Cerai", sidang: [{ ket: "putus DITOLAK" }] })).toBe("");
  });
  it("bawaan dan menu", () => {
    expect(BDS.bakukanPilihan({}, 0, { arah: "tolak" }).modus).toBe("tidak-tahu-apa");
    expect(BDS.bakukanPilihan({}, 1, { arah: "no" }).modus).toBe("tidak-tahu-apa");
    expect(BDS.bakukanPilihan({}, 0, {}).modus).toBe("sama");
    expect(BDS.bakukanPilihan({ modus: "sebaliknya" }, 0, {}).modus).toBe("sebaliknya");
    const g = ARAH.opsiModus(BDS.DAFTAR_MODUS, "tolak", "tidak-tahu-apa");
    expect(g[0].opsi.map((x: string[]) => x[0])).toEqual(["tidak-tahu-apa", "sebaliknya", "sama"]);
    expect(g[1].opsi.length).toBe(BDS.DAFTAR_MODUS.length - 1);
    // tanpa arah: daftar lama apa adanya (fitur lama tidak berkurang)
    expect(ARAH.opsiModus(BDS.DAFTAR_MODUS, "", "sama")).toEqual([{ label: "", opsi: BDS.DAFTAR_MODUS }]);
  });
  it("jawaban 'tidak tahu' dan 'keterangan sebaliknya' tidak menguatkan dalil", () => {
    const templat = templatDraf("347", "F", FOLDER.kontra);
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu-apa" }, { ke: 2, pihak: "P", modus: "sebaliknya" }]);
    expect(cari(h, 0, /penyebab/i).jawab).toMatch(/tidak mengetahui/);
    expect(cari(h, 0, /melihat atau mendengar sendiri/i).jawab).toMatch(/tidak pernah melihat/);
    expect(cari(h, 0, /upaya dari keluarga/i).jawab).toMatch(/tidak mengetahui/);
    // saksi kedua: bunyi lain yang setara (dua saksi tidak sama persis)
    expect(cari(h, 1, /nafkah/i).jawab).toMatch(/Tergugat masih memberi(?:kan)? nafkah kepada Penggugat/);
    expect(cari(h, 1, /masih tinggal serumah/i).jawab).toMatch(/masih tinggal bersama/);
    const sama = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu-apa" }, { ke: 2, pihak: "P", modus: "tidak-tahu-apa" }]);
    expect(cari(sama, 1, /penyebab/i).jawab).not.toBe(cari(sama, 0, /penyebab/i).jawab);
    expect(cari(sama, 1, /penyebab/i).jawab).toMatch(/tidak saya ketahui/);
    // identitas & pernikahan tetap dari data
    expect(cari(h, 0, /hubungan antara/i).jawab).toMatch(/12 Mei 2015/);
  });
});

describe("64/65 - nafkah cerai talak dan jumlah butir", () => {
  it("64: saksi Pemohon cerai talak - bawaan 'Pemohon tidak pernah lagi memberi nafkah kepada Termohon'", () => {
    const templat = templatDraf("346", "F", FOLDER.verstek);
    expect(templat.find((r) => /nafkah/.test(r.tanya))?.jawab).toBe("Selama berpisah Pemohon tidak pernah lagi memberi nafkah kepada Termohon;");
    const h = susun("346", templat, POSITA["346"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(cari(h, 0, /nafkah/i).jawab).toMatch(/Pemohon tidak pernah lagi memberi nafkah kepada Termohon/);
  });
  it("65: tidak ada pemotongan 18 butir - jumlah butir = set + tambahan sesuai keadaan", () => {
    const verstek = templatDraf("347", "F", FOLDER.verstek);
    const kontra = templatDraf("347", "DF", FOLDER.kontra);
    expect(verstek.length).toBeGreaterThan(18);
    expect(kontra.length).not.toBe(verstek.length);
    const h = susun("347", kontra, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(h.saksi[0].jawaban.length).toBe(kontra.length);
  });
});

describe("67 dan 7 - ejaan posita dan kerapian", () => {
  it("rapikanEjaan: salah ketik dibetulkan, makna tetap", () => {
    expect(PB.rapikanEjaan("tidak mau mendengar nasehat yang di sampaikan oleh Penggugat dirumah")).toBe("tidak mau mendengar nasihat yang disampaikan oleh Penggugat di rumah");
    expect(PB.rapikanEjaan("Tergugat tdk memberi nafkah yg cukup")).toBe("Tergugat tidak memberi nafkah yang cukup");
    expect(PB.rapikanEjaan("di Desa Contoh pada 12 Mei 2015")).toBe("di Desa Contoh pada 12 Mei 2015");
  });
  it("dalam draf: penyebab dari posita dirapikan; 'Ya,' pada pertanyaan terbuka dan 'Tidak,' di depan kalimat hilang; saksi 1 dan 2 tidak sama persis", () => {
    const templat = templatDraf("347", "F", FOLDER.verstek);
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sama" }]);
    const semua = h.saksi.flatMap((s: any) => s.jawaban.map((j: any) => j.jawab));
    expect(semua.join(" ")).not.toMatch(/di sampaikan|nasehat/);
    for (const s of h.saksi)
      for (const j of s.jawaban) {
        if (/^\s*(apa(?!kah)|bagaimana|di\s*mana|siapa|kapan|mengapa|berapa)\b/i.test(j.tanya)) expect(j.jawab).not.toMatch(/^(ya|iya),/i);
        expect(j.jawab).not.toMatch(/^(tidak|sudah|belum),\s/i);
        expect(j.jawab).not.toMatch(/\b(\w{3,})\s+\1\b/i);
      }
    expect(h.identik).toBe(0);
  });
  it("kata ganda pada katalog (sumber cerita berakhiran 'saya')", () => {
    expect(M.amankanKeAbt("dari penuturan ibu kandung saya saya tahu bahwa objek-objek itu itu milik para pemohon Pemohon")).toBe("dari penuturan ibu kandung saya tahu bahwa objek-objek itu milik para Pemohon");
  });
});

describe("3 - alamat Tergugat sekarang (verstek) bukan kediaman bersama", () => {
  const templat = templatDraf("347", "F", FOLDER.verstek);
  const alamatQ = /di mana Tergugat tinggal sekarang/i;
  it("posita menyebut Tergugat pergi ke Makassar -> bukan 'rumah orang tua Penggugat'", () => {
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    const j = cari(h, 0, alamatQ);
    expect(j.jawab).not.toMatch(/rumah orang tua Penggugat/);
    expect(j.jawab).toMatch(/pergi ke Makassar/);
    expect(j.usulan.peringatan).toBe("gugatan");
  });
  it("alamat SIPP: dipakai bila beda dengan alamat Penggugat; 'tidak diketahui' bila SIPP mencatatnya; sama = tidak dipakai", () => {
    const pos = POSITA["347"].replace(" ke Makassar", "");
    const beda = susun("347", templat, pos, [{ ke: 1, pihak: "P", modus: "sama" }], { alamatPihak: { lawan: "Desa Contoh", pelaku: "Jl. Merdeka No. 5, Kota Palu" } });
    expect(cari(beda, 0, alamatQ).jawab).toBe("Sekarang Tergugat tinggal di Jl. Merdeka No. 5, Kota Palu;");
    const ghaib = susun("347", templat, pos, [{ ke: 1, pihak: "P", modus: "sama" }], { alamatPihak: { lawan: "Desa Contoh", pelaku: "Tidak diketahui keberadaannya di wilayah RI" } });
    expect(cari(ghaib, 0, alamatQ).jawab).toBe("Sekarang Tergugat tidak diketahui keberadaannya;");
    const sama = susun("347", templat, pos, [{ ke: 1, pihak: "P", modus: "sama" }], { alamatPihak: { lawan: "Desa Contoh", pelaku: "Desa Contoh" } });
    const j = cari(sama, 0, alamatQ);
    expect(j.jawab).not.toMatch(/rumah orang tua|Desa Contoh/);
    expect(j.pilihan).toEqual(["Sekarang Tergugat tinggal di ...;", "Sekarang Tergugat tidak diketahui keberadaannya;"]);
  });
});

describe("4 - panel ABT itsbat kontensius (alur 15): bentuk dari alur", () => {
  it("turunkanKeadaan alur 15 -> bentuk gugatan (tidak lagi Penggugat I dan Penggugat II)", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
    const w = dom.window as any;
    w.eval([readFileSync(path.join(EKS, "saksi-katalog.js"), "utf8"), readFileSync(path.join(EKS, "saksi-susun.js"), "utf8")].join("\n;\n"));
    const kat = JSON.parse(readFileSync(path.join(EKS, "saksi-katalog/itsbat-nikah.json"), "utf8"));
    expect(w.AletaSaksiSusun.turunkanKeadaan(kat, { alur: "15", peta: new Map() }).bentuk).toBe("gugatan");
    expect(w.AletaSaksiSusun.turunkanKeadaan(kat, { alur: "16", peta: new Map() }).bentuk).toBeUndefined();
    const h = M.susunSaksi(kat, { keadaan: M.keadaanBawaan(kat, { bentuk: "gugatan" }), benih: "542/Pdt.G/2026/PA.Dgl", saksi: [{ pihak: "P", jenis: "melihat" }] });
    const teks = h.saksi[0].baris.map((b: any) => `${b.tanya} ${b.jawab}`).join(" ");
    expect(teks).not.toMatch(/#0046# I dan #0046# II|Penggugat I dan Penggugat II/);
  });
});

describe("6 - kalimat sesuai pengetahuan yang dipilih", () => {
  it("modus ragu: 'sejak kapan' tidak dijawab dengan puncak, 'puncak' tidak dijawab dengan mulai", () => {
    for (const nomor of ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl", "4/Pdt.G/2026/PA.Dgl", "5/Pdt.G/2026/PA.Dgl"]) {
      const mulai = svc.jawabMenurutModus({ tanya: "Sejak kapan mereka mulai bertengkar?", modus: "ragu", alasan: [], sumber: "", nomorSaksi: 1, urutan: Number(nomor[0]) });
      const puncak = svc.jawabMenurutModus({ tanya: "Kapan puncak pertengkaran mereka?", modus: "ragu", alasan: [], sumber: "", nomorSaksi: 1, urutan: Number(nomor[0]) });
      expect(mulai).not.toMatch(/puncak/);
      expect(puncak).not.toMatch(/\bmulai\b|sejak kapan/);
    }
  });
  it("katalog cerai q-saksi-lihat: de auditu tidak mengaku hadir/mengalami sendiri; butir pengetahuan diri saksi tanpa jenis de auditu", () => {
    for (const f of ["cerai-gugat.json", "cerai-talak.json"]) {
      const kat = JSON.parse(readFileSync(path.join(EKS, "saksi-katalog", f), "utf8"));
      expect(M.periksaKatalog(kat).ok).toBe(true);
      const q = kat.pertanyaan.find((x: any) => x.id === "q-saksi-lihat");
      for (const t of [...q.jawaban["de-auditu"].saksi1, ...q.jawaban["de-auditu"].saksi2]) expect(t).not.toMatch(/di hadapan saya|mengalami sendiri|saya pernah berada/);
      const upaya = kat.pertanyaan.find((x: any) => x.id === "q-upaya-saksi");
      expect(M.jenisKeteranganButir(upaya).filter((j: string) => j !== "berbeda")).toEqual(["melihat", "ragu"]);
      expect(upaya.hal).toMatch(/\bsaya\b/);
    }
  });
  it("izin poligami tanpa anak: butir anak tidak muncul, butir nafkah tanpa 'anak-anak'", () => {
    const kat = JSON.parse(readFileSync(path.join(EKS, "saksi-katalog/izin-poligami.json"), "utf8"));
    expect(M.periksaKatalog(kat).ok).toBe(true);
    const h = M.susunSaksi(kat, { keadaan: M.keadaanBawaan(kat, { anak: "tidak" }), benih: "x", saksi: [{ pihak: "P", jenis: "melihat" }] });
    const id = h.saksi[0].baris.map((b: any) => b.butir);
    expect(id).not.toContain("q-pg-anak-asuh");
    expect(id).not.toContain("q-pg-adil-pendidikan-anak");
    const tg = h.saksi[0].baris.find((b: any) => b.butir === "q-pg-tanggungan");
    expect(tg.jawab).not.toMatch(/anak/);
    expect(h.saksi[0].baris.find((b: any) => b.butir === "q-suami-istri").jawab).toMatch(/belum (?:dikaruniai|memiliki) anak/);
  });
  it("kumulasi nafkah: istri didalilkan nusyuz -> butir nusyuz yang dipakai, tanpa butir hilang", () => {
    const utama = JSON.parse(readFileSync(path.join(EKS, "saksi-katalog/cerai-gugat.json"), "utf8"));
    const tambah = JSON.parse(readFileSync(path.join(EKS, "saksi-katalog/cerai-kumulasi.json"), "utf8"));
    const kat = M.gabungKatalog(utama, [tambah]);
    const h = M.susunSaksi(kat, { keadaan: M.keadaanBawaan(kat, { kumulasi: ["nafkah-iddah"], nusyuz: "ada", suami: "lawan" }), benih: "x", saksi: [{ pihak: "P", jenis: "melihat" }] });
    const id = h.saksi[0].baris.map((b: any) => b.butir);
    expect(id).toContain("q-istri-nusyuz");
    expect(id).not.toContain("q-istri-tidak-nusyuz");
    expect(h.peringatan.join(" ")).not.toMatch(/q-istri-tidak-nusyuz/);
  });
});

describe("8 - pilihan keadaan tanpa pengaruh tidak digambar; kumulasi hanya nilai yang dipakai", () => {
  const baca = (f: string) => JSON.parse(readFileSync(path.join(EKS, "saksi-katalog", f), "utf8"));
  it("ekonomi syariah 'pengaju' dan penguasaan anak 'kedudukanPengaju' ditandai tanpa pengaruh; yang dipakai tidak", () => {
    const es = M.keadaanUntukBorang(baca("ekonomi-syariah.json"));
    expect(es.find((x: any) => x.kunci === "pengaju").tanpaPengaruh).toBe(true);
    expect(es.find((x: any) => x.kunci === "jenisAkad").tanpaPengaruh).toBeUndefined();
    expect(M.keadaanUntukBorang(baca("penguasaan-anak.json")).find((x: any) => x.kunci === "kedudukanPengaju").tanpaPengaruh).toBe(true);
    const ha = M.keadaanUntukBorang(baca("hak-asuh.json")).find((x: any) => x.kunci === "kumulasi");
    expect(ha.nilai).toEqual(["nafkah-anak"]);
    // katalog utama + tambahan kumulasi: kumulasi cerai tetap tampil (dipakai butir tambahan)
    const cg = M.gabungKatalog(baca("cerai-gugat.json"), [baca("cerai-kumulasi.json")]);
    expect(M.keadaanUntukBorang(cg).find((x: any) => x.kunci === "kumulasi").tanpaPengaruh).toBeUndefined();
  });
});

describe("tinjauan bagian E - pisah kurang 6 bulan, masih serumah, satu saksi", () => {
  it("set: 'Kurang 6 Bulan' / 'serumah' di nama blangko -> set tambahannya disarankan (dipasang draf)", () => {
    const k6 = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", nomor: "9/Pdt.G/2026/PA.Dgl", folder: "1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022", huruf: "F", sebutanP: "Penggugat", sebutanT: "Tergugat", jumlahP: 1 });
    expect(DS.pilihSetDraf(k6.set).tambahan.map((x: any) => x.id)).toContain("tambah-pisah-kurang");
    const biasa = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", nomor: "9/Pdt.G/2026/PA.Dgl", folder: FOLDER.verstek, huruf: "F", sebutanP: "Penggugat", sebutanT: "Tergugat", jumlahP: 1 });
    const pb = DS.pilihSetDraf(biasa.set);
    expect(pb.tambahan.map((x: any) => x.id)).not.toContain("tambah-pisah-kurang");
    expect(biasa.set.find((x) => x.id === "tambah-pisah-kurang")?.utama).toBe(false);
  });
  it("data perkara: pisah 2 bulan sebelum sidang -> saran set pisah kurang + peringatan; masih serumah -> saran set serumah", () => {
    const templat = templatDraf("347", "F", FOLDER.verstek);
    const pos2 = "Bahwa sejak Januari 2024 rumah tangga Penggugat dan Tergugat tidak harmonis karena Tergugat berjudi;\nBahwa puncaknya pada bulan Agustus 2026 Tergugat pergi meninggalkan Penggugat;";
    const h = susun("347", templat, pos2, [{ ke: 1, pihak: "P", modus: "sama" }], { tanggalSidang: "2026-10-20" });
    expect(h.saranSet).toEqual(["tambah-pisah-kurang"]);
    expect(h.peringatanPembuktian.join(" ")).toMatch(/2 bulan.*kurang dari 6 bulan/);
    const posSerumah = "Bahwa Penggugat dan Tergugat masih tinggal serumah namun sering bertengkar karena Tergugat berjudi;";
    const s = susun("347", templat, posSerumah, [{ ke: 1, pihak: "P", modus: "sama" }], { tanggalSidang: "2026-10-20" });
    expect(s.saranSet).toEqual(["tambah-serumah"]);
    const lama = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { tanggalSidang: "2026-10-20" });
    expect(lama.saranSet).toBeUndefined();
  });
  it("satu saksi (unus testis): dikenali dari blangko atau daftar saksi; keterangan tetap tersusun", () => {
    expect(ARAH.satuSaksi({ blangko: "[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis" })).toBe(true);
    const isi = [{ tanya: "T?", jawab: "J;" }];
    expect(ARAH.satuSaksi({ blangko: "BAS ALUR 02 [2]", daftar: [{ pihak: "P", dimuat: true, rows: isi }] })).toBe(true);
    expect(ARAH.satuSaksi({ blangko: "BAS ALUR 02 [2]", daftar: [{ pihak: "P", dimuat: true, rows: isi }, { pihak: "P", dimuat: true, rows: [] }] })).toBe(true);
    expect(ARAH.satuSaksi({ blangko: "BAS ALUR 02 [2]", daftar: [{ pihak: "P", dimuat: true, rows: isi }, { pihak: "P", dimuat: true, rows: isi }] })).toBe(false);
    const h = susun("347", templatDraf("347", "F", FOLDER.verstek), POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(h.saksi.length).toBe(1);
    expect(h.saksi[0].jawaban.filter((j: any) => j.jawab && !/\.\.\./.test(j.jawab)).length).toBeGreaterThan(10);
  });
});

// ----------------------------------------------------------------------------
// Matriks mini (potongan matriks agen F) - temuan C6/C9/C17/C18/C7 sebelum perbaikan: 2.550 / 34.023 / 4.284 / - / 2.304
// ----------------------------------------------------------------------------
describe("matriks mini jalur cerai (pemeriksa agen F): nol temuan sesudah perbaikan", () => {
  it("CG/CT x huruf F/A/D x verstek/kontradiktoir x 8 modus saksi 1 x posita ada/tidak", () => {
    const MODUS = ["sama", "mendengar", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"];
    const LIHAT = /\b(saya (?:pernah )?melihat (?:dan mendengar )?sendiri|saya menyaksikan sendiri|saya lihat sendiri|menyaksikan langsung)\b/i;
    const temuan: Record<string, number> = {};
    const catat = (k: string) => (temuan[k] = (temuan[k] || 0) + 1);
    let jalan = 0;
    for (const jenis of ["347", "346"] as const)
      for (const huruf of ["F", "A", "D"])
        for (const folder of [FOLDER.verstek, FOLDER.kontra]) {
          const templat = templatDraf(jenis, huruf, folder);
          for (const m1 of MODUS)
            for (const pos of [POSITA[jenis], ""]) {
              const h = susun(jenis, templat, pos, [{ ke: 1, pihak: "P", modus: m1 }, { ke: 2, pihak: "P", modus: "sebagian", sumber: "keluarga", sumberNama: "keluarga mereka" }]);
              jalan += 1;
              h.saksi.forEach((s: any, i: number) => {
                const mod = i === 0 ? m1 : "sebagian";
                s.jawaban.forEach((b: any) => {
                  const j = String(b.jawab || "");
                  if (/^(?:ya|iya),\s/i.test(j) && /^(apa|bagaimana|di ?mana|siapa|kapan|mengapa|berapa)\b/i.test(b.tanya.trim())) catat("C6");
                  if (/^(?:tidak|sudah|belum),\s/i.test(j)) catat("C18");
                  if (/tinggal di (?:rumah orang tua|rumah kediaman bersama|kediaman bersama)/i.test(j) && /di mana\s+(Tergugat|Termohon)\s+tinggal sekarang/i.test(b.tanya)) catat("C17");
                  if (["tidak-melihat", "dari-cerita", "tahu-pisah", "ragu"].includes(mod) && LIHAT.test(j) && !/tidak pernah|tidak melihat/i.test(j) && !/\.\.\./.test(j)) catat("C7");
                  if (/\b(\w{3,})\s+\1\b/i.test(j)) catat("C5");
                });
              });
              const s1 = h.saksi[0].jawaban;
              const s2 = h.saksi[1].jawaban;
              s1.forEach((b: any, n: number) => {
                const a = String(b.jawab).trim();
                if (a && a === String(s2[n].jawab).trim() && !/^(?:sudah cukup|cukup)/i.test(a) && !/\.\.\./.test(a)) catat("C9");
              });
            }
        }
    expect(jalan).toBe(192);
    expect(temuan).toEqual({});
  }, 120000);
});
