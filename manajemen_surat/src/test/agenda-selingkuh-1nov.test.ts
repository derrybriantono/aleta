// @vitest-environment node
/**
 * 1 NOV 2026 - KEPUTUSAN PENGGUNA 52 (urutan tahap pembuktian, MENGGANTI 29-30) dan 53 (tuduhan selingkuh, MEMPERBAIKI 35).
 *
 * 52: pembuktian diawali Penggugat; "pembuktian lanjutan" melanjutkan pihak yang sedang membuktikan; pembuktian tanpa sebutan pihak
 *     sesudah Penggugat SELESAI = Tergugat; satu tahap bisa beberapa sidang. Mesin: aleta_bot/services/tahapPembuktianService.js
 *     (kembaran paket ABT abt-paket/pembuktian-urut-1nov untuk 2111/7119/2112/7121 - kueri paket = mesin atas 10.278 perkara
 *     sipp_2810, lihat hasil/banding-semua.json) dan usulan BAS ALUR 04 (lib/alur-bas.ts langkahAlur04).
 * 53: selingkuh sesudah kata tuduhan tidak dibuang diam-diam: terbukti hanya bila dikuatkan DUA saksi atau satu saksi + bukti lain
 *     (satu saksi saja = "belum cukup terbukti", keputusan sementara sesi utama 1 Nov); tanpa penguat =
 *     tidak terbukti (dicatat di kartu 5227). Diukur atas 4.691 posita cerai sipp_2810 + saksi aps_badilag_2810: 99 salah tangkap lama
 *     (aturan sebelum 31 Okt) tetap bersih (98 "tuduhan terhadap lawan", 1 = 499/Pdt.G/2025 pengakuan sungguhan kini kembali).
 * Kasus = kalimat/urutan sidang SIPP nyata (nomor perkara di judul).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { langkahAlur04, sisiTahapPembuktian, tentukanAlurBas } from "@/lib/alur-bas";

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
type Sidang = { sidangId?: number; tanggalSidang: string; agenda?: string; alasanDitunda?: string; keterangan?: string };
const tahap = require_(path.join(AKAR, "services/tahapPembuktianService.js")) as {
  tahapPembuktian: (s: Sidang[], o?: { gugatan?: boolean }) => Array<{ sisi: "P" | "T" | "PT" | null; sebab: string }>;
  mulaiTahap: (s: Sidang[], o?: { gugatan?: boolean }) => { P: string | null; T: string | null };
  POSIX: Record<string, string>;
};
type Tuduhan = { status: string; tertuduh: string; pengakuan: boolean; penguat: Array<{ jenis: string; no?: number }> };
type Butir = { sebab: string[]; lencana: string; catatan: string; asal: string; bunyi: { nilai: string }[] };
type Pihak = { pelaku: string; lawan: string };
const mesin = require_(path.join(AKAR, "services/deteksi/alasanRincian.js")) as {
  deteksiRincian: (o: { gugatan: string[]; saksi?: unknown[]; saksiTidakDibaca?: boolean; bukti?: unknown[]; pihak?: Pihak }) => { butir: Butir[]; tuduhan: Tuduhan[] };
  catatanTuduhan: (t: Tuduhan[], p: Pihak) => string[];
  terapkan: (h: { usulan: Array<Record<string, unknown>> }, r: unknown) => boolean;
};
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as { lupakan: () => void };
afterEach(() => kamus.lupakan());

const urut = (...baris: Array<[string, string, string?, string?]>): Sidang[] =>
  baris.map(([tanggalSidang, agenda, alasanDitunda, keterangan], i) => ({ sidangId: i + 1, tanggalSidang, agenda, alasanDitunda: alasanDitunda ?? "", keterangan: keterangan ?? "" }));
const sisi = (s: Sidang[], o?: { gugatan?: boolean }) => tahap.tahapPembuktian(s, o).map((x) => x.sisi);

describe("keputusan 52: urutan tahap pembuktian dari jadwal sidang SIPP", () => {
  it("9971/2026: Pembuktian -> Pembuktian Lanjutan (masih Penggugat) -> Pembuktian Tergugat; tanggal tahap = sidang pertamanya", () => {
    const s = urut(
      ["2026-10-02", "Duplik Tergugat", "Pembuktian"],
      ["2026-10-06", "Pembuktian", "Pembuktian Lanjutan"],
      ["2026-10-20", "Pembuktian Lanjutan", " Pembuktian Tergugat  "],
      ["2026-10-27", "            Pembuktian Tergugat  ", "Panggil Tergugat"],
      ["2026-11-03", "Panggil Tergugat"]
    );
    expect(sisi(s)).toEqual([null, "P", "P", "T", null]);
    expect(tahap.mulaiTahap(s)).toEqual({ P: "2026-10-06", T: "2026-10-27" });
  });

  it("178/Pdt.G/2017: 'Pembuktian untuk Tergugat' sesudah alasan tunda 'Menghadirkan saksi-saksi Tergugat' = Tergugat (dulu kosong)", () => {
    const s = urut(
      ["2017-08-15", "Duplik Tertulis dari Tergugat", "Pembuktian untuk Penggugat"],
      ["2017-08-22", "Menghadirkan saksi-saksi dari Penggugat", "Menghadirkan saksi-saksi Tergugat"],
      ["2017-09-12", "Pembuktian untuk Tergugat", "Menghadirkan saksi-saksi Tergugat"]
    );
    expect(tahap.mulaiTahap(s)).toEqual({ P: "2017-08-22", T: "2017-09-12" });
  });

  it("pembuktian TANPA sebutan pihak sesudah Penggugat selesai (alasan tunda 'Pembuktian Tergugat') = Tergugat", () => {
    const s = urut(["2026-07-27", "Pembuktian", "pembuktian P"], ["2026-08-03", "Pembuktian Lanjutan", "Pembuktian Tergugat"], ["2026-08-10", "Pembuktian Lanjutan", "Kesimpulan"]);
    expect(sisi(s)).toEqual(["P", "P", "T"]);
    expect(tahap.mulaiTahap(s)).toEqual({ P: "2026-07-27", T: "2026-08-10" });
  });

  it("326/Pdt.G/2026: alasan tunda 'Pembuktian Lanjutan Termohon' = Termohon SUDAH mulai di sidang itu (T 10 Agt -> 3 Agt)", () => {
    const s = urut(
      ["2026-07-22", "Duplik Rekonvensi", "Duplik Rekonvensi"],
      ["2026-07-27", "Pembuktian", "pembuktian P"],
      ["2026-08-03", "Pembuktian lanjutan", "Pembuktian Lanjutan Termohon "],
      ["2026-08-10", "Pembuktian Lanjutan Termohon ", "Kesimpulan Pemohon dan Termohon"]
    );
    expect(sisi(s)).toEqual([null, "P", "PT", "T"]);
    expect(tahap.mulaiTahap(s)).toEqual({ P: "2026-07-27", T: "2026-08-03" });
  });

  it("tanda selesai dari keterangan: 'telah mencukupkan alat buktinya' / kesimpulan; 'belum cukup bukti' BUKAN", () => {
    const cukup = urut(["2026-01-05", "Pembuktian", "pembuktian lanjutan", "Penggugat telah mencukupkan alat buktinya"], ["2026-01-12", "Pembuktian Lanjutan"]);
    expect(sisi(cukup)).toEqual(["P", "T"]);
    const belum = urut(["2026-01-05", "Pembuktian", "Penggugat belum cukup bukti"], ["2026-01-12", "Pembuktian Lanjutan"]);
    expect(sisi(belum)).toEqual(["P", "P"]);
    const kes = urut(["2026-01-05", "Pembuktian", "Kesimpulan"], ["2026-01-12", "Pembuktian Lanjutan"]);
    expect(sisi(kes)).toEqual(["P", "T"]);
    // Agenda gabungan satu sidang ("pembuktian, kesimpulan, pembacaan putusan") bukan tanda selesai - lanjutannya tetap Penggugat.
    const gab = urut(["2026-01-05", "Sidang pertama, pemeriksaan pokok perkara, pembuktian, kesimpulan, pembacaan putusan", "Pembuktian Lanjutan"], ["2026-01-12", "Pembuktian Lanjutan"]);
    expect(sisi(gab)).toEqual(["P", "P"]);
  });

  it("keputusan 29 tetap: 'pembuktian dan panggil tergugat' BUKAN pembuktian Tergugat; tanda sebelum pembuktian dimulai tidak berlaku", () => {
    const s = urut(["2026-02-01", "Duplik", "Kesimpulan"], ["2026-02-08", "pembuktian dan panggil tergugat"], ["2026-02-15", "Pembuktian lanjutan dan panggil tergugat"]);
    expect(sisi(s)).toEqual([null, "P", "P"]);
    expect(tahap.mulaiTahap(s).T).toBeNull();
  });

  it("permohonan (Pdt.P): tanpa pihak lawan yang membuktikan - lanjutan sesudah kesimpulan tetap Pemohon", () => {
    const s = urut(["2026-03-01", "Pembuktian", "Kesimpulan"], ["2026-03-08", "Pembuktian Lanjutan"]);
    expect(sisi(s, { gugatan: false })).toEqual(["P", "P"]);
    expect(sisi(s, { gugatan: true })).toEqual(["P", "T"]);
  });

  it("442/Pdt.G/2023: pembuktian dimulai TEGAS Termohon -> 'pembuktian lanjutan' melanjutkan Termohon (Penggugat kosong)", () => {
    const s = urut(["2023-12-28", "pembuktian Termohon ", "pembuktiann janjutan "], ["2024-01-03", "pembuktian lanjutan ", "untuk musyawarah "]);
    expect(tahap.mulaiTahap(s)).toEqual({ P: null, T: "2023-12-28" });
  });

  it("singkatan pihak: 'Pembuktian lanjutan P' = Penggugat, 'pembuktian T.' = Tergugat; 'pembuktian tambahan' tanpa pihak", () => {
    expect(sisi(urut(["2026-04-01", "Pembuktian Penggugat", "Pembuktian Tergugat"], ["2026-04-08", "Pembuktian lanjutan P"]))).toEqual(["P", "P"]);
    expect(sisi(urut(["2026-04-01", "Pembuktian"], ["2026-04-08", "pembuktian T."]))).toEqual(["P", "T"]);
    expect(sisi(urut(["2026-04-01", "Pembuktian"], ["2026-04-08", "pembuktian tambahan"]))).toEqual(["P", "P"]);
  });

  it("paket ABT memuat pola POSIX yang SAMA dengan mesin bot (satu sumber) dan tanpa \\b / lookbehind", () => {
    const paket = path.resolve(process.cwd(), "../abt-paket/pembuktian-urut-1nov/paket-satker/abt-pembuktian-urut-1nov-PASANG.sql");
    const sql = [...fs.readFileSync(paket, "utf8").matchAll(/UNHEX\('([0-9A-F]+)'\)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
    expect(sql).toHaveLength(4);
    for (const q of sql.slice(2)) for (const k of ["T", "P", "T_MULAI", "CUKUP"]) expect(q).toContain(tahap.POSIX[k]);
    for (const k of Object.keys(tahap.POSIX)) expect(tahap.POSIX[k]).not.toMatch(/\\b|\(\?<|\\s/);
  });
});

describe("keputusan 52: usulan BAS ALUR 04 memakai tahap pembuktian bila agenda tidak menyebut pihak", () => {
  it("sidang ke-7 'Pembuktian Lanjutan' yang masih tahap Penggugat -> BAS 6 (dulu ditebak 7 karena urutan sidang)", () => {
    expect(langkahAlur04(7, "Pembuktian Lanjutan").kode).toBe("7");
    expect(langkahAlur04(7, "Pembuktian Lanjutan", "P").kode).toBe("6");
    expect(langkahAlur04(5, "Pembuktian", "T").kode).toBe("7");
    expect(langkahAlur04(6, "Pembuktian lanjutan", "PT")).toMatchObject({ kode: "6", alternatif: expect.arrayContaining(["7"]) });
  });
  it("agenda yang TEGAS menyebut pihak tetap menang atas tahap", () => {
    expect(langkahAlur04(8, "Pembuktian Tergugat", "P").kode).toBe("7");
    expect(langkahAlur04(4, "Pembuktian Penggugat", "T").kode).toBe("6");
  });
  it("tentukanAlurBas meneruskan tahapPembuktian dari jawaban bot ({sisi, sebab})", () => {
    const m = { jenisPerkara: "Cerai Gugat", urutanSidang: 8, dihadiriOleh: 1, agenda: "Pembuktian Lanjutan", tergugatPernahHadir: true };
    expect(tentukanAlurBas(m).langkah?.kode).toBe("7");
    expect(tentukanAlurBas({ ...m, tahapPembuktian: sisiTahapPembuktian({ sisi: "P", sebab: "x" }) }).langkah?.kode).toBe("6");
    expect(sisiTahapPembuktian({ sisi: "Q" })).toBeNull();
    expect(sisiTahapPembuktian(null)).toBeNull();
  });
});

const CG: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const P499 = "Sejak merantau ke kalimantan di bulan Maret 2020 Penggugat mencurigai bahwa Tergugat berhubungan dengan wanita lain dan Tergugat mengakui perbuatannya tersebut";
const SAKSI_499 = [
  { no: 1, pihak: "penggugat", butir: ["Yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah karena Tergugat sering keluar malam hanya sekedar kumpul-kumpul bersama temannya dan Tergugat juga telah mempunyai wanita idaman lain"] },
  { no: 2, pihak: "penggugat", butir: ["Yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah karena Tergugat sering keluar malam nongkrong bersama temannya dan Tergugat juga telah mempunyai wanita idaman lain"] },
];
const selingkuh = (r: { butir: Butir[] }) => r.butir.filter((b) => b.sebab.includes("selingkuh"));

describe("keputusan 53: selingkuh sesudah kata tuduhan - terbukti hanya bila dikuatkan", () => {
  it("499/Pdt.G/2025: kecurigaan + 'Tergugat mengakui', dikuatkan kedua saksi -> diusulkan (dulu hilang)", () => {
    const r = mesin.deteksiRincian({ gugatan: [P499], saksi: SAKSI_499, pihak: CG });
    const b = selingkuh(r);
    expect(b).toHaveLength(1);
    expect(b[0].asal).toBe("posita");
    expect(b[0].bunyi[0].nilai).toBe("Tergugat menjalin hubungan dengan perempuan lain");
    expect(b[0].lencana).toBe("dikuatkan kedua saksi Penggugat");
    expect(b[0].catatan).toMatch(/kecurigaan\/tuduhan \(disebut diakui\); dianggap terbukti karena dikuatkan kedua saksi Penggugat$/);
    expect(r.tuduhan).toMatchObject([{ status: "terbukti", tertuduh: "pelaku", pengakuan: true }]);
  });

  it("kalimat 499 tanpa penguat (saksi tidak menyebutnya) -> TIDAK diusulkan, dicatat 'tidak terbukti'", () => {
    const r = mesin.deteksiRincian({ gugatan: [P499], saksi: [{ no: 1, butir: ["Tergugat sering keluar malam"] }, { no: 2, butir: ["Penggugat dan Tergugat sudah pisah rumah"] }], pihak: CG });
    expect(selingkuh(r)).toHaveLength(0);
    expect(r.tuduhan[0].status).toBe("tidak-terbukti");
    expect(mesin.catatanTuduhan(r.tuduhan, CG)).toEqual([
      "Tuduhan/kecurigaan bahwa Tergugat berselingkuh di gugatan tidak dikuatkan keterangan saksi atau bukti lain (walau disebut diakui) - dianggap tidak terbukti, tidak diusulkan.",
    ]);
  });

  it("satu saksi saja BUKAN penguat yang cukup (satu saksi bukan saksi) -> 'belum cukup terbukti (hanya satu saksi)', tidak diusulkan", () => {
    const r = mesin.deteksiRincian({ gugatan: [P499], saksi: [SAKSI_499[0], { no: 2, pihak: "penggugat", butir: ["Penggugat dan Tergugat sudah pisah rumah"] }], pihak: CG });
    expect(selingkuh(r)).toHaveLength(0);
    expect(r.tuduhan[0]).toMatchObject({ status: "belum-cukup", penguat: [{ jenis: "saksi", no: 1 }] });
    expect(mesin.catatanTuduhan(r.tuduhan, CG)).toEqual([
      "Tuduhan/kecurigaan bahwa Tergugat berselingkuh di gugatan hanya diterangkan satu saksi (saksi Penggugat) tanpa bukti lain - belum cukup terbukti (hanya satu saksi), tidak diusulkan.",
    ]);
    const hasil = { usulan: [{ kode: "5227", nilai: "", catatan: "" } as Record<string, unknown>] };
    mesin.terapkan(hasil, r);
    expect(String(hasil.usulan[0].catatan)).toContain("belum cukup terbukti (hanya satu saksi)");
  });

  it("satu saksi + bukti lain (P.3) = cukup -> terbukti; bukti lain tanpa saksi yang bersesuaian = belum cukup", () => {
    const bukti = [{ tanda: "P.3", teks: "tangkapan layar percakapan Tergugat berselingkuh dengan perempuan lain" }];
    const r = mesin.deteksiRincian({ gugatan: [P499], saksi: [SAKSI_499[0], { no: 2, butir: ["Penggugat dan Tergugat sudah pisah rumah"] }], bukti, pihak: CG });
    expect(selingkuh(r)).toHaveLength(1);
    expect(selingkuh(r)[0].catatan).toMatch(/dikuatkan saksi Penggugat serta bukti P\.3$/);
    const tanpa = mesin.deteksiRincian({ gugatan: [P499], saksi: [{ no: 1, butir: ["Tergugat sering keluar malam"] }, { no: 2, butir: ["Penggugat dan Tergugat sudah pisah rumah"] }], bukti, pihak: CG });
    expect(selingkuh(tanpa)).toHaveLength(0);
    expect(tanpa.tuduhan[0].status).toBe("belum-cukup");
    expect(mesin.catatanTuduhan(tanpa.tuduhan, CG)[0]).toMatch(/hanya didukung bukti lain tanpa saksi yang menerangkannya - belum cukup terbukti/);
  });

  it("saksi belum diperiksa -> 'belum dapat dinilai', bukan dibuang; bukti lain saja tidak cukup", () => {
    const belum = mesin.deteksiRincian({ gugatan: ["Penggugat curiga Tergugat selingkuh"], saksi: [], saksiTidakDibaca: true, pihak: CG });
    expect(selingkuh(belum)).toHaveLength(0);
    expect(belum.tuduhan[0].status).toBe("belum-dinilai");
    const bukti = mesin.deteksiRincian({ gugatan: ["Penggugat curiga Tergugat selingkuh"], saksi: [], saksiTidakDibaca: true, bukti: [{ tanda: "P.3", teks: "tangkapan layar percakapan Tergugat berselingkuh dengan perempuan lain" }], pihak: CG });
    expect(selingkuh(bukti)).toHaveLength(0);
    expect(bukti.tuduhan[0].status).toBe("belum-dinilai");
  });

  it("salah tangkap lama tetap bersih walau saksi menyebut perselingkuhan Tergugat: yang dituduh = Penggugat/Pemohon", () => {
    const saksiSelingkuh = [{ no: 1, butir: ["Tergugat berselingkuh dengan perempuan lain"] }, { no: 2, butir: ["Tergugat memiliki wanita idaman lain"] }];
    const kasus: Array<[string, Pihak]> = [
      ["Tergugat sering curiga dan menuduh Penggugat memiliki hubungan dengan pria lain", CG], // 461/Pdt.G/2022
      ["terjadi perselisihan yang disebabkan karena Tergugat sering menuduh Penggugat mempunyai hubungan dengan pria lain", CG], // 14/Pdt.G/2023
      ["Termohon sering cemburu dan menuduh Pemohon memiliki hubungan dengan wanita lain", CT], // 491/Pdt.G/2019
      ["Tergugat Pencemburu, sering mencurigai Penggugat memiliki hubungan dengan laki laki lain", CG], // 57/Pdt.G/2024
      ["d. Bahwa Termohon menuduh Pemohon telah melakukan perselingkuhan dengan karyawan Pemohon, yang mana hal tersebut tidak terbukti", CT], // 556/Pdt.G/2025
      // 224/Pdt.G/2025 salah ketik ("menuduh Tergugat ... laki-laki lain"): orang ketiganya laki-laki = tuduhan terhadap istri.
      ["Tergugat memiliki sifat cemburu berlebihan dan sering menuduh Tergugat memiliki hubungan dengan laki-laki lain tanpa bukti", CG],
    ];
    for (const [g, ph] of kasus) {
      const r = mesin.deteksiRincian({ gugatan: [g], saksi: saksiSelingkuh, pihak: ph });
      expect(r.butir.filter((b) => b.asal === "posita" && b.sebab.includes("selingkuh")), g).toHaveLength(0);
      expect(r.tuduhan.map((t) => t.status), g).toEqual(["terhadap-lawan"]);
      expect(r.tuduhan[0].pengakuan, g).toBe(false);
    }
  });

  it("dalil tegas 'Tergugat berselingkuh' tidak tersentuh dan tidak diberi catatan tuduhan", () => {
    const r = mesin.deteksiRincian({ gugatan: ["Tergugat berselingkuh dengan perempuan lain", "Penggugat curiga Tergugat selingkuh"], saksi: [], saksiTidakDibaca: true, pihak: CG });
    expect(selingkuh(r)).toHaveLength(1);
    expect(r.tuduhan).toEqual([]);
  });

  it("kartu 5227: tuduhan yang tidak diusulkan dicatat di catatan kartu walau tidak ada alasan lain", () => {
    const hasil = { usulan: [{ kode: "5227", nilai: "", catatan: "" } as Record<string, unknown>] };
    const r = mesin.deteksiRincian({ gugatan: ["Tergugat sering menuduh Penggugat memiliki hubungan dengan pria lain"], saksi: [], saksiTidakDibaca: true, pihak: CG });
    expect(r.butir).toHaveLength(0);
    expect(mesin.terapkan(hasil, r)).toBe(true);
    expect(String(hasil.usulan[0].catatan)).toBe("Gugatan menyebut tuduhan bahwa Penggugat berselingkuh - bukan alasan perselingkuhan Tergugat, tidak diusulkan.");
  });
});

describe("keputusan 70: putusan pengadilan pidana perzinahan = terbukti tanpa saksi", () => {
  const SAKSI_LAIN = [
    { no: 1, pihak: "penggugat", butir: ["Tergugat sering keluar malam"] },
    { no: 2, pihak: "penggugat", butir: ["Penggugat dan Tergugat sudah pisah rumah"] },
  ];
  const PN = { tanda: "P.4", teks: "Fotokopi Putusan Pengadilan Negeri Donggala Nomor 41/Pid.B/2025/PN Dgl tanggal 3 Maret 2025 tentang tindak pidana perzinahan (Pasal 284 KUHP) atas nama Tergugat, telah bermeterai cukup, lalu diberi tanda P.4 serta diberi tanggal dan paraf oleh Ketua Majelis;" };

  it("putusan PN Pasal 284 KUHP + saksi tidak menyebutnya -> terbukti, diusulkan, catatan & lencana menyebut putusan", () => {
    const r = mesin.deteksiRincian({ gugatan: [P499], saksi: SAKSI_LAIN, bukti: [PN], pihak: CG });
    const b = selingkuh(r);
    expect(b).toHaveLength(1);
    expect(r.tuduhan).toMatchObject([{ status: "terbukti", penguat: [{ jenis: "bukti", tanda: "P.4" }] }]);
    expect(b[0].catatan).toMatch(/dianggap terbukti berdasarkan putusan pengadilan pidana tentang perzinahan \(bukti P\.4\) tanpa memerlukan saksi$/);
    expect(b[0].lencana).toBe("dikuatkan putusan pengadilan pidana (bukti P.4)");
  });

  it("saksi belum diperiksa: putusan pidana tetap cukup (dulu 'belum dapat dinilai')", () => {
    const r = mesin.deteksiRincian({ gugatan: ["Penggugat curiga Tergugat selingkuh"], saksi: [], saksiTidakDibaca: true, bukti: [PN], pihak: CG });
    expect(selingkuh(r)).toHaveLength(1);
    expect(r.tuduhan[0].status).toBe("terbukti");
  });

  it("KUHP baru Pasal 411 / kata 'zina' / Pengadilan Tinggi juga dikenali; cerai talak (Termohon)", () => {
    for (const teks of [
      "Salinan Putusan Pengadilan Negeri Palu Nomor 12/Pid.B/2026/PN Pal yang menyatakan Termohon terbukti melakukan tindak pidana Pasal 411 KUHP",
      "Petikan putusan Pengadilan Tinggi Sulawesi Tengah Nomor 5/PID/2026/PT PAL tentang perkara zina",
      "fotokopi putusan PN Donggala nomor 7/Pid.B/2025/PN Dgl atas nama Termohon, perkara perzinaan",
    ]) {
      const r = mesin.deteksiRincian({ gugatan: ["Pemohon mencurigai Termohon berselingkuh dengan laki-laki lain"], saksi: [], saksiTidakDibaca: true, bukti: [{ tanda: "P.3", teks }], pihak: CT });
      expect(r.tuduhan[0]?.status, teks).toBe("terbukti");
    }
  });

  it("BUKAN putusan pidana perzinahan -> bukti saja tetap belum cukup (keputusan 70 bagian 'sudah')", () => {
    const tetapBelum = [
      // bukti elektronik / surat biasa
      "tangkapan layar percakapan Tergugat berselingkuh dengan perempuan lain",
      // putusan pidana yang membebaskan
      "Fotokopi Putusan Pengadilan Negeri Donggala Nomor 41/Pid.B/2025/PN Dgl tentang perzinahan yang menyatakan Tergugat tidak terbukti dan membebaskan Tergugat",
      // terdakwanya pihak lawan (Penggugat), bukan yang dituduh
      "Fotokopi Putusan Pengadilan Negeri Donggala Nomor 41/Pid.B/2025/PN Dgl tentang perzinahan atas nama Penggugat",
      // laporan polisi, bukan putusan
      "Surat Tanda Terima Laporan Polisi tentang dugaan perzinahan Pasal 284 KUHP oleh Tergugat",
    ];
    for (const teks of tetapBelum) {
      const r = mesin.deteksiRincian({ gugatan: [P499], saksi: SAKSI_LAIN, bukti: [{ tanda: "P.5", teks }], pihak: CG });
      expect(selingkuh(r), teks).toHaveLength(0);
      expect(r.tuduhan[0].status, teks).not.toBe("terbukti");
    }
    // putusan pidana KDRT (tanpa tanda zina dan tanpa perselingkuhan) tidak menguatkan selingkuh sama sekali
    const kdrt = mesin.deteksiRincian({ gugatan: [P499], saksi: SAKSI_LAIN, bukti: [{ tanda: "P.6", teks: "Fotokopi Putusan Pengadilan Negeri Donggala Nomor 9/Pid.Sus/2025/PN Dgl tentang kekerasan dalam rumah tangga atas nama Tergugat" }], pihak: CG });
    expect(kdrt.tuduhan[0]).toMatchObject({ status: "tidak-terbukti", penguat: [] });
  });

  it("dari kiriman ekstensi sampai kartu 5227: abtUsulanService meneruskan opsi.bukti ke mesin", () => {
    const usulan = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
      dariKeteranganSaksi: (s1: string, s2: string, tgl: string, p: Pihak, posita: string, opsi: Record<string, unknown>) => { usulan: Array<Record<string, unknown>>; rincianAlasan?: { tuduhan: Tuduhan[] } };
    };
    const opsi = { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "penggugat" } };
    const s1 = "Saksi tahu Tergugat sering keluar malam.";
    const s2 = "Saksi tahu Penggugat dan Tergugat sudah pisah rumah.";
    const dengan = usulan.dariKeteranganSaksi(s1, s2, "", CG, P499, { ...opsi, bukti: [PN] });
    const tanpa = usulan.dariKeteranganSaksi(s1, s2, "", CG, P499, opsi);
    expect(dengan.rincianAlasan?.tuduhan[0]?.status).toBe("terbukti");
    expect(tanpa.rincianAlasan?.tuduhan[0]?.status).not.toBe("terbukti");
  });
});
