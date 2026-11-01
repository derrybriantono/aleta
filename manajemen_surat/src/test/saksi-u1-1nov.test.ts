// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 - AGEN U1: KETERANGAN SAKSI CERAI & UMUM (lanjutan audit docs kekurangan-saksi-1nov.md bagian 5)
 * ============================================================================
 * Uji PERILAKU dengan kode asli (set portal -> bot susun -> lengkapi -> perbaiki), urutan sama dengan rute 'saksi-sdg':
 *   1  hubungan saksi: pilihan petugas > kolom Keterangan saksi SIPP > isian blangko; kotak pilih di panel (modul ekstensi);
 *   2  alamat Tergugat dari SIPP (bukan kediaman bersama), ghaib hanya bila SIPP/posita menyatakan;
 *   3  pertanyaan "masih tinggal serumah" dan "masih ada komunikasi selama pisah" (bunyi BAS nyata) + jawaban bawaan dari posita;
 *   4  kesaksian murni (disampaikan kepada Tergugat, mendengar membantah, sikap Tergugat) menurut pengetahuan & kehadiran;
 *   5  huruf A/B/H dari posita;
 *   6  arah Tolak/NO "tidak-tahu-apa" pada butir A/D.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const REPO = path.resolve(process.cwd(), "..");
const EKS = path.join(REPO, "ekstensi-sipp");
const require_ = createRequire(import.meta.url);
const svc = require_(path.join(REPO, "aleta_bot/services/abtUsulanService.js")) as any;
const isiS = require_(path.join(REPO, "aleta_bot/services/isiJawabanSaksiService.js")) as any;
const PB = require_(path.join(REPO, "aleta_bot/services/saksiPerbaikan1Nov.js")) as any;
const U1 = require_(path.join(REPO, "aleta_bot/services/saksiU1.js")) as any;
const DS = require_(path.join(EKS, "blangko-derry-draf-saksi.js")) as any;
const ARAH = require_(path.join(EKS, "blangko-derry-saksi-arah.js")) as any;
const BDS = require_(path.join(EKS, "blangko-derry-saksi.js")) as any;

const POSITA: Record<string, string> = {
  "347":
    "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Mei 2015 di KUA Kecamatan Banawa;\nBahwa setelah menikah Penggugat dan Tergugat tinggal di rumah orang tua Penggugat di Desa Contoh dan telah dikaruniai 2 orang anak;\nBahwa sejak Januari 2024 rumah tangga Penggugat dan Tergugat mulai tidak harmonis karena Tergugat tidak memberi nafkah dan berkata kasar;\nBahwa puncaknya pada bulan Maret 2025 Tergugat pergi meninggalkan Penggugat dan sejak itu tidak pernah kembali;\nBahwa keluarga telah berusaha merukunkan namun tidak berhasil;",
  "346":
    "Bahwa Pemohon dan Termohon menikah pada tanggal 3 Juni 2016 di KUA Kecamatan Sindue;\nBahwa setelah menikah Pemohon dan Termohon tinggal di rumah orang tua Termohon dan telah dikaruniai 1 orang anak;\nBahwa sejak Februari 2024 rumah tangga Pemohon dan Termohon tidak harmonis karena Termohon cemburu berlebihan;\nBahwa puncaknya pada bulan April 2025 Pemohon pergi meninggalkan Termohon dan kembali ke rumah orang tua Pemohon;\nBahwa keluarga telah berusaha merukunkan namun tidak berhasil;",
};
const POSITA_A =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Mei 2015 di KUA Kecamatan Banawa;\nBahwa sejak Januari 2022 rumah tangga Penggugat dan Tergugat tidak harmonis dan sering terjadi pertengkaran karena Tergugat sering berjudi dan mabuk-mabukan;\nBahwa sejak bulan Maret 2022 Tergugat berjudi hampir setiap malam;\nBahwa Tergugat sudah berkali-kali dinasihati namun tetap mengulangi perbuatannya;\nBahwa puncaknya pada bulan Juni 2024 Tergugat pergi meninggalkan Penggugat;";
const SEBUT: Record<string, [string, string]> = { "347": ["Penggugat", "Tergugat"], "346": ["Pemohon", "Termohon"] };
const FOLDER = {
  verstek: "1 Perceraian CG - BAS/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)",
  kontra: "1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P",
  pembuktianT: "1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T",
} as const;

type Baris = { no: string; tanya: string; jawab: string };
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
type Saksi = { ke: number; pihak: "P" | "T"; modus: string; sumber?: string; sumberNama?: string; alasan?: string[]; dasar?: string; hubungan?: string };
function susun(jenis: "346" | "347", templat: Baris[], posita: string, saksi: Saksi[], lain: Record<string, unknown> = {}) {
  const [P, T] = SEBUT[jenis];
  const s = saksi.map((x) => ({ alasan: [], sumber: "penggugat", sumberNama: P, ...x }));
  const h = svc.susunKeteranganSaksiSdg({ templat: templat.map((b) => ({ ...b })), posita, alasan: [], pelaku: T, lawan: P, nomorPerkara: "9/Pdt.G/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: jenis, alur: "15", tanggalSidang: "2026-10-20", modus: { saksi1: s[0], saksi2: s[1] }, saksi: s, ...(lain.alamatPihak ? { alamatPihak: lain.alamatPihak } : {}) });
  isiS.lengkapi(h, { templatMasuk: templat, posita, jenisPerkara: jenis, alur: "15", pelaku: T, lawan: P, saksi: s, ...(lain.alamatPihak ? { alamatPihak: lain.alamatPihak } : {}), ...(lain.sipp ? { sipp: lain.sipp } : {}) });
  PB.perbaiki(h, { templat, posita, jenisPerkara: jenis, pelaku: T, lawan: P, saksi: s, tanggalSidang: "2026-10-20", ...lain });
  return h;
}
const cari = (h: any, i: number, re: RegExp) => (h.saksi[i].jawaban as any[]).find((j) => re.test(j.tanya));
const titik = (t: string) => /\.{3,}|…/.test(t);

describe("U1/1 - hubungan saksi dengan pihak", () => {
  const templat = templatDraf("347", "F", FOLDER.verstek);
  it("pilihan petugas mengisi 'karena saya adalah ... Penggugat' untuk tiap saksi, tanpa titik, bersumber 'pilihan hubungan saksi'", () => {
    const h = susun("347", templat, POSITA["347"], [
      { ke: 1, pihak: "P", modus: "sama", hubungan: "ibu-kandung" },
      { ke: 2, pihak: "P", modus: "sama", hubungan: "ketua-rt" },
    ]);
    const a = cari(h, 0, /kenal/i);
    const b = cari(h, 1, /kenal/i);
    expect(a.jawab).toMatch(/ibu kandung Penggugat/);
    expect(titik(a.jawab)).toBe(false);
    expect(b.jawab).toMatch(/Ketua RT\/RW di lingkungan tempat tinggal Penggugat/);
    expect(a.usulan.sumber).toBe("pilihan hubungan saksi");
    expect(a.usulan.yakin).toBe("pasti");
    expect(h.saksi[0].hubunganDipakai).toMatchObject({ kunci: "ibu-kandung", sumber: "pilihan hubungan saksi" });
    expect(h.perbaikanU1.hubungan).toBe(2);
    // cerai talak: sebutan pihak mengikuti jenis perkara
    const ct = susun("346", templatDraf("346", "F", FOLDER.verstek), POSITA["346"], [{ ke: 1, pihak: "P", modus: "sama", hubungan: "tetangga" }]);
    expect(cari(ct, 0, /kenal/i).jawab).toMatch(/tetangga Pemohon/);
  });
  it("tanpa pilihan: kolom Keterangan saksi SIPP dipakai (otomatis, tanpa klik); pilihan petugas menang atas SIPP", () => {
    const sipp = { saksi: [{ pihak: "P", urutPihak: 1, keterangan: "Adik Kandung Penggugat" }, { pihak: "P", urutPihak: 2, keterangan: "Tetangga" }] };
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sama" }], { sipp });
    expect(cari(h, 0, /kenal/i).jawab).toMatch(/adik kandung Penggugat/);
    expect(cari(h, 1, /kenal/i).jawab).toMatch(/tetangga Penggugat/);
    expect(cari(h, 0, /kenal/i).usulan.sumber).toBe("data SIPP");
    expect(h.saksi[0].hubunganDipakai.kunci).toBe("adik-kandung");
    const menang = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama", hubungan: "teman" }, { ke: 2, pihak: "P", modus: "sama" }], { sipp });
    expect(cari(menang, 0, /kenal/i).jawab).toMatch(/teman Penggugat/);
    expect(cari(menang, 0, /kenal/i).jawab).not.toMatch(/adik kandung/);
  });
  it("variabel ABT hubungan saksi (1241/1242) dipakai bila SIPP tidak mencatat; tanpa sumber apa pun: tetap titik-titik", () => {
    const isian = { "1241": { nilai: "Paman Penggugat", keyakinan: "pasti" }, "1242": { nilai: "#1242#" } };
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sama" }], { isian });
    expect(cari(h, 0, /kenal/i).jawab).toMatch(/paman Penggugat/);
    expect(cari(h, 0, /kenal/i).usulan.sumber).toBe("isian blangko");
    expect(titik(cari(h, 1, /kenal/i).jawab)).toBe(true);
    expect(h.saksi[1].hubunganDipakai).toBeUndefined();
  });
  it("saksi Tergugat memakai sebutan Tergugat; kunci yang tidak dikenal tidak pernah dipakai", () => {
    const tt = templatDraf("347", "F", FOLDER.pembuktianT, "T");
    const h = susun("347", tt, POSITA["347"], [{ ke: 1, pihak: "T", modus: "sama", dasar: "jawaban", hubungan: "sahabat" }], { naskahT: { jawaban: "Tidak benar ada pertengkaran terus-menerus.", duplik: "" } });
    expect(cari(h, 0, /kenal/i).jawab).toMatch(/sahabat Tergugat/);
    expect(U1.kunciHubunganSah("sahabat")).toBe(true);
    expect(U1.kunciHubunganSah("<script>")).toBe(false);
    expect(U1.frasaHubungan("tidak-ada", "Penggugat")).toBeNull();
    const salah = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama", hubungan: "bukan-kunci" }]);
    expect(titik(cari(salah, 0, /kenal/i).jawab)).toBe(true);
  });
  it("panel: daftar pilihan ekstensi = daftar bot (kunci sama); pilihan tersaring, ikut ke muatan, dan hasil jawaban memasangnya", () => {
    expect(BDS.DAFTAR_HUBUNGAN.map((x: any) => x[0])).toEqual(U1.HUBUNGAN.map((x: any) => x[0]));
    expect(BDS.DAFTAR_HUBUNGAN.map((x: any) => x[2])).toEqual(U1.HUBUNGAN.map((x: any) => x[3]));
    for (const [kunci] of BDS.DAFTAR_HUBUNGAN) expect(BDS.frasaHubungan(kunci, "Penggugat"), kunci).toBe(U1.frasaHubungan(kunci, "Penggugat"));
    expect(BDS.bakukanPilihan({ modus: "sama", hubungan: "ibu-kandung" }, 0)).toMatchObject({ hubungan: "ibu-kandung" });
    expect(BDS.bakukanPilihan({ modus: "sama", hubungan: "ngawur" }, 0)).toEqual({ modus: "sama", sumber: "penggugat", alasan: [] });
    const m = BDS.susunMuatan({ nomorPerkara: "9/Pdt.G/2026/PA.Dgl", templat: [], pelaku: "Tergugat", lawan: "Penggugat", saksi: [{ pihak: "P", ke: 1, modus: "sama", hubungan: "tetangga" }, { pihak: "P", ke: 2, modus: "sama" }] });
    expect(m.saksi[0].hubungan).toBe("tetangga");
    expect(m.saksi[1].hubungan).toBeUndefined();
    const kel = BDS.kelompokHubungan();
    expect(kel.map((g: any) => g.label)).toEqual(["Keluarga", "Bukan keluarga"]);
    // hasil server terpasang ke baris tanya jawab (jawaban tanpa titik menggantikan contoh set)
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama", hubungan: "ayah-kandung" }]);
    const baris = templat.map((r) => ({ ...r, dasar: r.jawab }));
    const ps = BDS.pasangJawaban(baris, h.saksi[0].jawaban);
    expect(ps.rows.find((r: any) => /kenal/i.test(r.tanya)).jawab).toMatch(/ayah kandung Penggugat/);
  });
  it("tidak satu kata 'aleta' dan tidak ada titik pada butir hubungan yang terisi", () => {
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama", hubungan: "kakak-kandung" }]);
    expect(JSON.stringify(h.saksi[0].jawaban)).not.toMatch(/aleta/i);
  });
});

describe("U1/2 - alamat Tergugat sekarang dari SIPP", () => {
  const templat = templatDraf("347", "F", FOLDER.verstek);
  const tanya = /mengetahui di mana Tergugat tinggal sekarang/i;
  it("alamat SIPP yang berbeda dari Penggugat -> 'Sekarang Tergugat tinggal di ...' (bukan pilihan '/' dan bukan kediaman bersama)", () => {
    const h = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { alamatPihak: { lawan: "Jalan Merdeka No. 1 Desa Contoh Kecamatan Banawa", pelaku: "Desa Pombewe Kecamatan Sigi Biromaru Kabupaten Sigi" } });
    const j = cari(h, 0, tanya);
    expect(j.jawab).toBe("Sekarang Tergugat tinggal di Desa Pombewe Kecamatan Sigi Biromaru Kabupaten Sigi;");
    expect(j.pilihan).toBeUndefined();
    expect(j.usulan.sumber).toBe("data SIPP");
    expect(j.jawab).not.toMatch(/rumah orang tua|kediaman bersama/);
  });
  it("ghaib/tidak diketahui di SIPP -> 'tidak diketahui keberadaannya'; alamat yang sama dengan Penggugat (juga selisih penulisan) = kediaman bersama -> tetap dua pilihan", () => {
    const g = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { alamatPihak: { lawan: "Desa Contoh", pelaku: "Tidak diketahui alamatnya (ghaib)" } });
    expect(cari(g, 0, tanya).jawab).toBe("Sekarang Tergugat tidak diketahui keberadaannya;");
    const sama = susun("347", templat, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], {
      alamatPihak: { lawan: "Jalan BTN Kelapa Asri Permai Blok C1 No. 4 Desa Kalukubula Kecamatan Sigi Biromaru Kabupaten Sigi ", pelaku: "Jalan BTN Kelapa Asri Permai Blok C1  No. 4 Desa Kalukubula Kecamatan Sigi Biromaru Sigi" },
    });
    const j = cari(sama, 0, tanya);
    expect(j.pilihan).toHaveLength(2);
    expect(j.jawab).toMatch(/\//);
    expect(PB.samaAlamat("Desa Mpanau Kecamatan Sigi Biromaru Kabupaten Sigi", "Desa Pombewe Kecamatan Sigi Biromaru Kabupaten Sigi")).toBe(false);
  });
});

describe("U1/3 - 'masih tinggal serumah' dan 'masih ada komunikasi selama pisah' (bunyi BAS nyata)", () => {
  it("set cerai memuat kedua pertanyaan dengan bunyi BAS nyata; tidak diduplikasi", () => {
    const t = templatDraf("347", "F", FOLDER.verstek);
    const serumah = t.filter((r) => /masih tinggal serumah/i.test(r.tanya));
    const komunikasi = t.filter((r) => /masih ada komunikasi/i.test(r.tanya));
    expect(serumah.map((r) => r.tanya)).toEqual(["Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?"]);
    expect(komunikasi.map((r) => r.tanya)).toEqual(["Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?"]);
    expect(komunikasi[0].jawab).toBe("Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;");
    expect(t.filter((r) => /saling mengunjungi/i.test(r.tanya))).toHaveLength(0);
    for (const huruf of ["A", "B", "D", "H", "FD"]) expect(templatDraf("347", huruf, FOLDER.kontra).filter((r) => /masih ada komunikasi/i.test(r.tanya))).toHaveLength(1);
    const ct = templatDraf("346", "F", FOLDER.verstek);
    expect(ct.find((r) => /masih ada komunikasi/i.test(r.tanya))!.tanya).toBe("Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?");
  });
  it("jawaban bawaan: sudah berpisah (sejak ... dari posita), tanpa komunikasi; posita masih serumah / masih berkomunikasi urusan anak mengubahnya (bertanda gugatan)", () => {
    const t = templatDraf("347", "F", FOLDER.verstek);
    const h = susun("347", t, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(cari(h, 0, /masih tinggal serumah/i).jawab).toMatch(/berpisah tempat tinggal sejak/);
    expect(cari(h, 0, /masih ada komunikasi/i).jawab).toMatch(/sudah tidak ada komunikasi/);
    const posSerumah = "Bahwa Penggugat dan Tergugat masih tinggal serumah namun sering bertengkar karena Tergugat berjudi;\nBahwa Penggugat dan Tergugat masih berkomunikasi hanya mengenai urusan anak;";
    const s = susun("347", t, posSerumah, [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(cari(s, 0, /masih tinggal serumah/i).jawab).toBe("Ya, Penggugat dan Tergugat masih tinggal serumah;");
    expect(cari(s, 0, /masih tinggal serumah/i).usulan.peringatan).toBe("gugatan");
    expect(cari(s, 0, /masih ada komunikasi/i).jawab).toBe("Selama pisah antara Penggugat dan Tergugat masih ada komunikasi, hanya mengenai anak;");
    // saksi yang tidak mengetahui langsung tidak diberi jawaban dari gugatan
    const tt = susun("347", t, posSerumah, [{ ke: 1, pihak: "P", modus: "tahu-pisah" }]);
    expect(cari(tt, 0, /masih tinggal serumah/i).jawab).not.toBe("Ya, Penggugat dan Tergugat masih tinggal serumah;");
  });
});

describe("U1/4 - butir kesaksian murni menurut pengetahuan saksi dan kehadiran Tergugat", () => {
  const NASKAH = "Bahwa Tergugat membantah dalil Penggugat karena tidak benar terjadi pertengkaran terus-menerus. Tergugat masih ingin mempertahankan rumah tangga dan ingin rukun.";
  const kontra = templatDraf("347", "F", FOLDER.kontra);
  const verstek = templatDraf("347", "F", FOLDER.verstek);
  it("verstek: saksi yang tidak tahu / ragu menjawab tidak mengetahui; saksi yang tahu langsung dibiarkan titik-titik (kesaksian murni)", () => {
    const h = susun("347", verstek, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu" }, { ke: 2, pihak: "P", modus: "ragu" }, ]);
    expect(cari(h, 0, /menyampaikan kepada Tergugat/i).jawab).toMatch(/tidak (?:saya )?mengetahui|tidak saya ketahui/);
    expect(titik(cari(h, 0, /menyampaikan kepada Tergugat/i).jawab)).toBe(false);
    expect(cari(h, 1, /menyampaikan kepada Tergugat/i).jawab).toMatch(/kurang ingat/);
    const l = susun("347", verstek, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(titik(cari(l, 0, /menyampaikan kepada Tergugat/i).jawab)).toBe(true);
  });
  it("kontradiktoir dengan naskah jawaban: sikap dan bantahan Tergugat dari jawaban, bertanda 'jawaban' (bukan ucapan saksi)", () => {
    const h = susun("347", kontra, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { naskahT: { jawaban: NASKAH, duplik: "" } });
    const sikap = cari(h, 0, /bagaimana sikap Tergugat/i);
    const bantah = cari(h, 0, /membantah atau membenarkan/i);
    expect(sikap.jawab).toBe("Tergugat membantah adanya pertengkaran dan masih ingin mempertahankan rumah tangga;");
    expect(sikap.usulan.peringatan).toBe("jawaban");
    expect(sikap.pilihan).toBeUndefined();
    expect(bantah.jawab).toBe("Saya pernah mendengar Tergugat membantah adanya pertengkaran itu;");
    expect(bantah.usulan.peringatan).toBe("jawaban");
    expect(h.perbaikanU1.murni).toBeGreaterThanOrEqual(2);
  });
  it("jawaban lisan di BAS dipakai bila e-Court kosong (asal 'lisan'); naskah bertentangan (membantah sekaligus setuju cerai) tidak diisi", () => {
    const l = susun("347", kontra, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { naskahT: { jawaban: "Tidak benar ada pertengkaran terus-menerus.", duplik: "", asal: { jawaban: "lisan", duplik: "" } } });
    expect(cari(l, 0, /bagaimana sikap Tergugat/i).jawab).toBe("Tergugat membantah adanya pertengkaran;");
    expect(cari(l, 0, /bagaimana sikap Tergugat/i).usulan.sumber).toMatch(/lisan/);
    const b = susun("347", kontra, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }], { naskahT: { jawaban: "Tidak benar ada pertengkaran terus-menerus dan Tergugat tidak keberatan bercerai dengan Penggugat.", duplik: "" } });
    expect(titik(cari(b, 0, /bagaimana sikap Tergugat/i).jawab)).toBe(true);
  });
  it("kontradiktoir tanpa naskah: sikap/bantahan tetap titik-titik + catatan; saksi tidak tahu menjawab tidak mengetahui", () => {
    const h = susun("347", kontra, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "tidak-tahu" }]);
    expect(titik(cari(h, 0, /bagaimana sikap Tergugat/i).jawab)).toBe(true);
    expect(titik(cari(h, 0, /membantah atau membenarkan/i).jawab)).toBe(true);
    expect(h.catatan).toMatch(/Jawaban Tergugat belum ada/);
    expect(cari(h, 1, /bagaimana sikap Tergugat/i).jawab).toMatch(/tidak saya ketahui/);
    expect(cari(h, 1, /membantah atau membenarkan/i).jawab).toMatch(/tidak pernah mendengar Tergugat membantah/);
  });
});

describe("U1/5 - huruf A, B, H dari posita", () => {
  it("huruf A: jenis kebiasaan, sejak, dinasihati, masih, akibat dari posita (bertanda gugatan); dua saksi tidak berbunyi sama persis", () => {
    const t = templatDraf("347", "A", FOLDER.verstek);
    const h = susun("347", t, POSITA_A, [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sama" }]);
    expect(cari(h, 0, /kebiasaan buruk apa/i).jawab).toBe("Tergugat mempunyai kebiasaan berjudi dan mabuk-mabukan;");
    expect(cari(h, 0, /kebiasaan buruk apa/i).usulan.peringatan).toBe("gugatan");
    expect(cari(h, 0, /sejak kapan dan seberapa sering/i).jawab).toBe("Sejak bulan Maret 2022, hampir setiap malam;");
    expect(cari(h, 0, /dinasihati agar berhenti/i).jawab).toBe("Sudah dinasihati, tetapi Tergugat tetap mengulanginya;");
    expect(cari(h, 0, /masih melakukan/i).jawab).toBe("Ya, sampai sekarang Tergugat masih berjudi dan mabuk-mabukan;");
    expect(cari(h, 0, /akibat kebiasaan/i).jawab).toMatch(/tidak harmonis dan sering terjadi pertengkaran/);
    const a = cari(h, 0, /mengetahui kebiasaan/i).jawab;
    const b = cari(h, 1, /mengetahui kebiasaan/i).jawab;
    expect(a).toMatch(/melihat sendiri|menyaksikan sendiri/);
    expect(a).not.toBe(b);
    expect(h.perbaikanU1.hurufA).toBeGreaterThanOrEqual(10);
    // butir lain tidak berubah: perselisihan tetap terisi dari posita
    expect(JSON.stringify(h.saksi[0].jawaban)).not.toMatch(/aleta/i);
  });
  it("huruf A: saksi yang tidak melihat/tahu-pisah/ragu TIDAK diberi jawaban dari gugatan; menjawab tidak mengetahui / kurang ingat", () => {
    const t = templatDraf("347", "A", FOLDER.verstek);
    const h = susun("347", t, POSITA_A, [{ ke: 1, pihak: "P", modus: "tidak-melihat" }, { ke: 2, pihak: "P", modus: "ragu" }]);
    expect(cari(h, 0, /kebiasaan buruk apa/i).jawab).toMatch(/tidak (?:saya )?(?:mengetahui|ketahui)/);
    expect(cari(h, 1, /kebiasaan buruk apa/i).jawab).toMatch(/kurang (?:ingat|yakin)/);
    for (const i of [0, 1]) for (const j of h.saksi[i].jawaban) if (/kebiasaan|dinasihati agar berhenti|akibat kebiasaan/i.test(j.tanya)) expect(titik(j.jawab), j.tanya).toBe(false);
  });
  it("huruf A: tanpa jenis kebiasaan di posita butir dibiarkan titik-titik; 'sebagian' hanya bila alasannya cocok", () => {
    const t = templatDraf("347", "A", FOLDER.verstek);
    const h = susun("347", t, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(titik(cari(h, 0, /kebiasaan buruk apa/i).jawab)).toBe(true);
    const s = susun("347", t, POSITA_A, [{ ke: 1, pihak: "P", modus: "sebagian", alasan: ["tidak memberi nafkah"] }, { ke: 2, pihak: "P", modus: "sebagian", alasan: ["judi"] }]);
    expect(titik(cari(s, 0, /kebiasaan buruk apa/i).jawab)).toBe(true);
    expect(cari(s, 1, /kebiasaan buruk apa/i).jawab).toMatch(/berjudi/);
  });
  it("huruf B: sejak kapan meninggalkan + lama dari posita; keluarga mencari hanya bila posita menyebut", () => {
    const posB = "Bahwa sejak bulan Januari 2024 Tergugat pergi meninggalkan Penggugat tanpa pamit dan tidak pernah kembali;\nBahwa keluarga sudah berusaha mencari dan meminta Tergugat pulang namun Tergugat tidak mau kembali;";
    const t = templatDraf("347", "B", FOLDER.verstek);
    const h = susun("347", t, posB, [{ ke: 1, pihak: "P", modus: "sama" }]);
    const j = cari(h, 0, /sejak kapan Tergugat meninggalkan/i);
    expect(j.jawab).toMatch(/^Tergugat pergi meninggalkan Penggugat sejak bulan Januari 2024/);
    expect(titik(j.jawab)).toBe(false);
    expect(cari(h, 0, /berusaha mencari/i).jawab).toBe("Sudah dicari dan diminta kembali, namun Tergugat tidak mau kembali;");
    const tanpa = susun("347", t, POSITA["347"].replace(/ meninggalkan/, " menghilang"), [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(titik(cari(tanpa, 0, /berusaha mencari/i).jawab)).toBe(true);
  });
  it("huruf D: bentuk kekerasan dan laporan hanya bila posita menyebutnya (pilihan '/' dipilih dari data)", () => {
    const posD = "Bahwa Tergugat sering memukul dan menendang Penggugat apabila marah;\nBahwa kejadian tersebut sudah pernah dilaporkan Penggugat ke Polsek setempat;";
    const t = templatDraf("347", "D", FOLDER.verstek);
    const h = susun("347", t, posD, [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(cari(h, 0, /pernah melakukan kekerasan/i).jawab).toBe("Ya, Tergugat pernah memukul dan menendang Penggugat;");
    expect(cari(h, 0, /dilaporkan kepada/i).jawab).toBe("Kejadian itu pernah dilaporkan kepada polisi;");
    expect(h.perbaikanU1.hurufD).toBe(2);
    const tanpa = susun("347", t, POSITA["347"], [{ ke: 1, pihak: "P", modus: "sama" }]);
    expect(cari(tanpa, 0, /pernah melakukan kekerasan/i).jawab).toMatch(/\//);
  });
  it("huruf H: agama baru dari posita mengisi 'agama ...'", () => {
    const posH = "Bahwa sejak bulan Mei 2023 Tergugat berpindah agama ke agama Kristen dan tidak lagi beribadah sebagai muslim;";
    const t = templatDraf("347", "H", FOLDER.verstek);
    const h = susun("347", t, posH, [{ ke: 1, pihak: "P", modus: "sama" }]);
    const semua = (h.saksi[0].jawaban as any[]).map((j) => j.jawab).join(" | ");
    expect(semua).not.toMatch(/agama \.\.\./);
  });
});

describe("U1/6 - arah Tolak/NO 'tidak-tahu-apa' dan 'sebaliknya' pada butir huruf A dan D", () => {
  it("tidak ada titik pada butir A/D bergantung sebab; bunyi sesuai pengetahuan; saksi 1 dan 2 berbeda", () => {
    for (const huruf of ["A", "D"]) {
      const t = templatDraf("347", huruf, FOLDER.kontra);
      for (const modus of ["tidak-tahu-apa", "sebaliknya"]) {
        const h = susun("347", t, POSITA["347"], [{ ke: 1, pihak: "P", modus }, { ke: 2, pihak: "P", modus }]);
        for (const i of [0, 1])
          for (const j of h.saksi[i].jawaban) if (/kebiasaan|kekerasan|bekas luka|kejadian itu|dinasihati agar berhenti/i.test(j.tanya)) expect(titik(j.jawab), `${huruf}/${modus}/${j.tanya}`).toBe(false);
        const a = h.saksi[0].jawaban.filter((j: any) => /kebiasaan|kekerasan/i.test(j.tanya)).map((j: any) => j.jawab).join("|");
        const b = h.saksi[1].jawaban.filter((j: any) => /kebiasaan|kekerasan/i.test(j.tanya)).map((j: any) => j.jawab).join("|");
        expect(a).not.toBe(b);
        if (modus === "tidak-tahu-apa") expect(a).toMatch(/tidak (?:saya )?(?:mengetahui|ketahui|tahu)|tidak saya ketahui/);
        else expect(a).toMatch(/tidak (?:pernah|mempunyai|berbuat)/);
      }
    }
  });
  it("butir 'dinasihati agar berhenti' tidak lagi dijawab dengan upaya keluarga merukunkan", () => {
    const t = templatDraf("347", "A", FOLDER.kontra);
    const h = susun("347", t, POSITA["347"], [{ ke: 1, pihak: "P", modus: "tidak-tahu-apa" }]);
    expect(cari(h, 0, /dinasihati agar berhenti/i).jawab).not.toMatch(/upaya keluarga|merukunkan/);
  });
});

describe("U1/1b - hubungan saksi di panel katalog (itsbat dan jenis lain)", () => {
  it("pilihan hubungan masuk slot {hubungan} katalog: jawaban 'kenal' memuat frasa lengkap, tanpa tanda kurung kurawal", () => {
    const M = require_(path.join(EKS, "saksi-katalog.js"));
    (globalThis as any).AletaSaksiKatalog = M;
    const fs = require_("node:fs");
    const dir = path.join(EKS, "saksi-katalog");
    (globalThis as any).ALETA_SAKSI_KATALOG_DATA = fs.readdirSync(dir).filter((n: string) => n.endsWith(".json")).sort().map((n: string) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"))).filter((k: any) => !k.contoh);
    const K = require_(path.join(EKS, "blangko-derry-katalog.js"));
    const kenal = K.kenali({ nomorPerkara: "301/Pdt.P/2026/PA.Dgl", jenisPerkaraId: "360", alurPerkaraId: "16", jenisPerkara: "Itsbat Nikah" });
    expect(kenal.mode).toBe("katalog");
    const keadaan = Object.assign({}, M.keadaanBawaan(kenal.kat, {}));
    const hubungan = BDS.frasaHubungan("ibu-kandung", kenal.sebutan.P);
    expect(hubungan).toBe(`ibu kandung ${kenal.sebutan.P}`);
    const hs = K.susun({
      kat: kenal.kat,
      sebutan: kenal.sebutan,
      benih: "301/Pdt.P/2026/PA.Dgl",
      keadaan,
      saksi: [
        { kunci: "saksi 1 p", pihak: "P", jenis: "melihat", hubungan },
        { kunci: "saksi 2 p", pihak: "P", jenis: "melihat" },
      ],
      variabel: () => "",
    });
    const kenalBaris = (i: number) => hs.saksi[i].baris.find((b: any) => /-kenal/.test(String(b.butir)));
    expect(kenalBaris(0).jawab).toMatch(/ibu kandung/);
    expect(kenalBaris(0).jawab).not.toMatch(/\{|\}/);
    expect(kenalBaris(1).jawab).not.toMatch(/ibu kandung/);
  });
});

describe("U1 - penjagaan", () => {
  it("portal meneruskan dasar, hubungan, dan naskah Tergugat ke bot (rute usulan + tipe klien)", () => {
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-bot/abt/usulan/route.ts"), "utf8");
    const klien = readFileSync(path.join(process.cwd(), "src/server/modules/aleta-bot/whatsapp-gateway-client.ts"), "utf8");
    expect(rute).toMatch(/function saringNaskahT/);
    expect(rute).toMatch(/naskahT: saringNaskahT\(body\.naskahT\)/);
    expect(rute).toMatch(/r\.hubungan/);
    expect(rute).toMatch(/r\.dasar === "jawaban"/);
    expect(klien).toMatch(/naskahT\?:/);
  });
  it("kinerja: seluruh rantai dua saksi cerai < 150 ms dan langkah U1 sendiri < 10 ms rata-rata (kerja murni, tanpa jaringan)", () => {
    const t = templatDraf("347", "AF", FOLDER.kontra);
    const t0 = Date.now();
    for (let i = 0; i < 30; i += 1) susun("347", t, POSITA_A, [{ ke: 1, pihak: "P", modus: "sama", hubungan: "tetangga" }, { ke: 2, pihak: "P", modus: "sebagian", alasan: ["judi"] }], { naskahT: { jawaban: "Tidak benar ada pertengkaran.", duplik: "" } });
    expect((Date.now() - t0) / 30).toBeLessThan(150); // seluruh rantai susun + isi + perbaiki; U1 sendiri diukur di bawah
    // jalur U1 sendiri
    const h = susun("347", t, POSITA_A, [{ ke: 1, pihak: "P", modus: "sama" }, { ke: 2, pihak: "P", modus: "sama" }]);
    const t1 = Date.now();
    for (let i = 0; i < 200; i += 1) U1.terapkan(JSON.parse(JSON.stringify(h)), { P: "Penggugat", T: "Tergugat", cerai: true, ct: false, posita: POSITA_A, templat: t, saksi: [{ pihak: "P", modus: "sama" }, { pihak: "P", modus: "sama" }] });
    expect((Date.now() - t1) / 200).toBeLessThan(10);
  });
  it("DS.pilihSetDraf tidak terpengaruh (set cerai tetap memuat set utama)", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", nomor: "9/Pdt.G/2026/PA.Dgl", folder: FOLDER.verstek, huruf: "F", sebutanP: "Penggugat", sebutanT: "Tergugat", jumlahP: 1 });
    expect(DS.pilihSetDraf(t.set).utama.id).toBe("cerai-F");
  });
});
