// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  KATALOG_JENIS,
  PETA_JENIS,
  cocokkanPerkara,
  kunciNama,
  namaDariTeksPenetapan,
  namaSama,
  namaTanpaPadanan,
  ringkasTemuan,
  samarkanNik,
  tanggalDariTeksEcourt,
  type FaktaPencocok,
  type MasukanPencocok,
} from "@/lib/pencocok-data";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_PENCOCOK_TEMUAN } from "@/server/db/schema";
import { periksaPencocok } from "@/server/modules/kesehatan/pemeriksa";
import {
  UMUR_CACHE_MS,
  bacaCatatanPencocok,
  bacaSetelanPencocok,
  bersihkanSetelanPencocok,
  daftarTemuan,
  detakPencocok,
  jalankanPutaran,
  nilaiKelompok,
  pemberitahuanPencocok,
  periksaSatuPerkara,
  ringkasKesehatanPencocok,
  simpanSetelanPencocok,
  simpanTemuanKelompok,
  type SumberPencocok,
} from "@/server/modules/pencocok/layanan";

/**
 * ============================================================================
 * PENCOCOK DATA SIPP - ABT - e-COURT (N3, 1 Nov 2026)
 * ============================================================================
 *
 * Perilaku nyata: mesin aturan murni (tiap jenis: menyala pada beda, DIAM pada cocok dan pada sumber yang tidak terbaca),
 * pembaca fakta bot dengan kueri TIRUAN (bentuk fakta, kegagalan sumber, tanpa N+1), dan penyimpanan/penjadwalan/cache atas pg-mem.
 * Nomor perkara, nama, dan NIK rekaan.
 */

const AKAR = path.resolve(process.cwd());
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));
const require_ = createRequire(import.meta.url);
const HARI = "2026-10-28";

function fakta(ubah: Partial<FaktaPencocok> = {}): FaktaPencocok {
  // Tahapan bawaan mengikuti keadaan putusan supaya aturan lain tidak ikut menyala karena kelalaian fixture.
  const tahapanBawaan = ubah.putusan ? { id: 7, teks: "Putusan", proses: "Putus" } : { id: 5, teks: "Persidangan", proses: "Sidang pertama" };
  return {
    perkaraId: "9001",
    nomorPerkara: "901/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    jenisPerkaraId: 345,
    alurPerkaraId: 7,
    tanggalPendaftaran: "2026-08-03",
    tahapan: tahapanBawaan,
    putusan: null,
    aktaCerai: null,
    sidang: [],
    courtCalendar: [],
    lewatEcourt: false,
    hadirLengkapPertama: "",
    mediasi: null,
    sidangLaporanMediasi: "",
    pihak: { p: [{ pihakId: 1, nama: "Rina Marlina binti Ahmad" }], t: [{ pihakId: 2, nama: "Joko Santoso bin Slamet" }] },
    majelis: { aktif: ["Budi Santoso, S.H.", "Dewi Anggraini, S.H.I.", "Eko Prasetyo, S.H."], ppAktif: ["Citra Lestari, S.H."], tanggalAktif: "2026-08-05", tanggalPpAktif: "2026-08-05", penetapan: null },
    biaya: { masuk: 0, keluar: 0, baris: 0 },
    abt: { terbaca: { masuk: true, putus: true, minutasi: true, akta: true, biaya: true }, masuk: null, putus: null, minutasi: null, aktaCerai: null, biaya: null },
    ecourt: { putusan: null },
    ktp: [],
    ...ubah,
  };
}

const putus = (ubah: Partial<NonNullable<FaktaPencocok["putusan"]>> = {}): NonNullable<FaktaPencocok["putusan"]> => ({
  tanggal: "2026-10-12",
  statusId: 62,
  amarVerstek: false,
  adaAmar: true,
  adaBerkas: true,
  tanggalMinutasi: "",
  tanggalBht: "",
  dicabut: false,
  gugur: false,
  ...ubah,
});

const sidang = (tanggal: string, ubah: Partial<FaktaPencocok["sidang"][number]> = {}): FaktaPencocok["sidang"][number] => ({
  id: Number(tanggal.replace(/\D/g, "")),
  urutan: 1,
  tanggal,
  agenda: "Sidang Pertama",
  dihadiriOleh: 1,
  ditunda: false,
  ikrar: false,
  adaBas: true,
  ...ubah,
});

// "tahapan-mandek" (belum putus, sidang terakhir lampau) disaring: fixture dengan satu sidang lampau memang memenuhinya dan itu bukan yang diuji.
const jenisDari = (m: Partial<MasukanPencocok> & { fakta: FaktaPencocok }) => cocokkanPerkara({ acuan: HARI, ...m }).map((t) => t.jenis).filter((j) => j !== "tahapan-mandek");

describe("mesin aturan: alat kecil", () => {
  it("tanggal tab putusan e-Court (nama hari + bulan Indonesia) dibaca; teks asing = kosong", () => {
    expect(tanggalDariTeksEcourt("Senin, 25 Mei 2026")).toBe("2026-05-25");
    expect(tanggalDariTeksEcourt("Rabu, 03 Juni 2026")).toBe("2026-06-03");
    expect(tanggalDariTeksEcourt("Kamis, 5 Nopember 2026")).toBe("2026-11-05");
    expect(tanggalDariTeksEcourt("belum ada")).toBe("");
    expect(tanggalDariTeksEcourt("12 Foo 2026")).toBe("");
  });

  it("NIK tersamar: hanya 4 angka awal dan 2 akhir; kosong disebut kosong", () => {
    const s = samarkanNik("7271010101010002");
    expect(s.startsWith("7271")).toBe(true);
    expect(s.endsWith("02")).toBe(true);
    expect(s).not.toContain("0101010");
    expect(samarkanNik("")).toBe("(kosong)");
  });

  it("nama sama bila gelar/tanda baca/urutan berbeda; nama lain tidak", () => {
    expect(kunciNama("Sudarmin H.I.M. Tang, S.H.I.,M.H")).toBe("sudarmin h i m tang");
    expect(namaSama("Idris, S.H.I., M.H.", "Idris,S.H.I.,M.H.")).toBe(true);
    expect(namaSama("Idris", "Idris, S.H.I., M.H.")).toBe(true);
    expect(namaSama("Fahri Saifuddin, S.H.I.", "Abdul Salam, S.HI.")).toBe(false);
    expect(namaDariTeksPenetapan("Hakim Ketua: A Satu, S.H.</br>Hakim Anggota 1: B Dua, S.H.</br>Hakim Anggota 2: C Tiga")).toEqual(["A Satu, S.H.", "B Dua, S.H.", "C Tiga"]);
    expect(namaDariTeksPenetapan("Panitera Pengganti: Citra Lestari, S.H.")).toEqual(["Citra Lestari, S.H."]);
    expect(namaTanpaPadanan(["A Satu", "B Dua"], ["a satu, s.h."])).toEqual(["B Dua"]);
  });

  it("katalog: kode unik, tiap jenis punya judul dan saran, tidak ada kata Aleta di teks yang dapat tampil di naskah/sistem lain", () => {
    expect(new Set(KATALOG_JENIS.map((j) => j.kode)).size).toBe(KATALOG_JENIS.length);
    for (const j of KATALOG_JENIS) {
      expect(j.judul.length).toBeGreaterThan(8);
      expect(j.saran.length).toBeGreaterThan(8);
      expect(PETA_JENIS.get(j.kode)).toBe(j);
    }
    // Setiap aturan yang menghasilkan temuan memakai kode yang terdaftar (diuji tiap kasus di bawah lewat PETA_JENIS).
  });
});

describe("mesin aturan: putusan (SIPP - ABT - e-Court - dokumen)", () => {
  it("tanggal putus SIPP berbeda dengan register ABT = penting; sama = diam; register ABT tak terbaca = diam", () => {
    const abt = (tanggal: string, statusId = 62) => ({ ...fakta().abt, putus: { tanggal, statusId }, masuk: { nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-08-03", jenisPerkaraId: 345, paraPihak: "" } });
    const beda = cocokkanPerkara({ acuan: HARI, fakta: fakta({ putusan: putus(), abt: abt("2026-10-13") }) });
    expect(beda.map((t) => t.jenis)).toEqual(["putus-tanggal-abt"]);
    expect(beda[0].tingkat).toBe("tinggi");
    expect(beda[0].sisi.map((s) => s.sumber)).toEqual(["SIPP", "ABT"]);
    expect(jenisDari({ fakta: fakta({ putusan: putus(), abt: abt("2026-10-12") }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: putus(), abt: { ...abt("2026-10-13"), terbaca: { ...fakta().abt.terbaca, putus: false } } }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: putus(), abt: abt("2026-10-13") }), terbaca: { abt: false } })).toEqual([]);
  });

  it("status putusan berbeda (tanggal sama) = ringan; putusan SIPP belum masuk register ABT hanya sesudah 14 hari dan hanya bila perkara sudah terdaftar di ABT", () => {
    const dasar = fakta().abt;
    const masuk = { nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-08-03", jenisPerkaraId: 345, paraPihak: "" };
    const status = cocokkanPerkara({ acuan: HARI, fakta: fakta({ putusan: putus(), abt: { ...dasar, masuk, putus: { tanggal: "2026-10-12", statusId: 92 } } }) });
    expect(status.map((t) => [t.jenis, t.tingkat])).toEqual([["putus-status-abt", "rendah"]]);
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-20" }), abt: { ...dasar, masuk } }) })).toEqual([]); // baru 8 hari
  });

  it("belum masuk register ABT: menyala sesudah 14 hari, diam sebelum itu atau bila ABT belum mencatat perkaranya", () => {
    const dasar = fakta().abt;
    const masuk = { nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-08-03", jenisPerkaraId: 345, paraPihak: "" };
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-01" }), abt: { ...dasar, masuk } }) })).toContain("putus-belum-abt");
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-20" }), abt: { ...dasar, masuk } }) })).not.toContain("putus-belum-abt");
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-01" }), abt: dasar }) })).not.toContain("putus-belum-abt");
  });

  it("tab putusan e-Court: tanggal beda = penting; dokumen ada di e-Court tetapi belum di e-Doc SIPP; e-Court dibaca SEBELUM putus tidak dituduh", () => {
    const ec = (ubah: Partial<NonNullable<FaktaPencocok["ecourt"]["putusan"]>>) => ({
      putusan: { adaTab: true, adaBaris: true, alasan: "", tanggalTeks: "Senin, 12 Oktober 2026", dokumenAda: true, tte: true, diperiksaPada: "2026-10-20T01:00:00Z", ...ubah },
    });
    expect(jenisDari({ fakta: fakta({ putusan: putus(), ecourt: ec({}) }) })).toEqual([]);
    const tgl = cocokkanPerkara({ acuan: HARI, fakta: fakta({ putusan: putus(), ecourt: ec({ tanggalTeks: "Selasa, 13 Oktober 2026" }) }) });
    expect(tgl.map((t) => [t.jenis, t.tingkat])).toEqual([["putus-ecourt-tanggal", "tinggi"]]);
    expect(jenisDari({ fakta: fakta({ putusan: putus({ adaBerkas: false }), ecourt: ec({}) }) })).toEqual(["ecourt-dokumen-putusan"]);
    // baris putusan e-Court kosong: dituduh hanya bila e-Court dibaca >= 3 hari SESUDAH putus dan perkara e-Litigasi
    const kosong = (diperiksaPada: string, lewatEcourt = true) => fakta({ lewatEcourt, putusan: putus(), ecourt: ec({ adaBaris: false, dokumenAda: false, tanggalTeks: "", diperiksaPada }) });
    expect(jenisDari({ fakta: kosong("2026-10-20T01:00:00Z") })).toEqual(["ecourt-belum-putusan"]);
    expect(jenisDari({ fakta: kosong("2026-10-05T01:00:00Z") })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-10-20T01:00:00Z", false) })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-10-20T01:00:00Z"), terbaca: { ecourt: false } })).toEqual([]);
  });

  it("cocok-putusan (amar/tanggal vs dokumen) ikut sebagai satu jenis di tempat yang sama; keadaan lain diam", () => {
    expect(jenisDari({ fakta: fakta({ putusan: putus() }), cocokPutusan: { keadaan: "beda", ringkas: "nominal biaya berbeda" } })).toEqual(["putus-dokumen"]);
    expect(jenisDari({ fakta: fakta({ putusan: putus() }), cocokPutusan: { keadaan: "cocok", ringkas: "" } })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: putus() }), cocokPutusan: { keadaan: "tidak-terbaca", ringkas: "pindaian" } })).toEqual([]);
  });

  it("tanggal putus tidak jatuh pada sidang mana pun; sidang sesudah putus bukan ikrar; ikrar dan pencabutan dikecualikan", () => {
    const s = [sidang("2026-09-01"), sidang("2026-10-05", { urutan: 2 })];
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-12" }), sidang: s }) })).toEqual(["putus-tanpa-sidang"]);
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-12", dicabut: true }), sidang: s }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-05" }), sidang: s }) })).toEqual([]);
    const sesudah = [sidang("2026-10-05"), sidang("2026-10-12", { urutan: 2 }), sidang("2026-10-20", { urutan: 3, agenda: "Pemeriksaan tambahan" })];
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-12" }), sidang: sesudah }) })).toEqual(["sidang-setelah-putus"]);
    const ikrar = [sidang("2026-10-12"), sidang("2026-10-20", { urutan: 2, agenda: "Sidang Ikrar Talak", ikrar: true })];
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggal: "2026-10-12" }), sidang: ikrar }) })).toEqual([]);
  });

  it("minutasi dan akta cerai: beda tanggal menyala; ABT belum mencatat minutasi hanya sesudah 14 hari", () => {
    const masuk = { nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-08-03", jenisPerkaraId: 345, paraPihak: "" };
    const abt = (ubah: Partial<FaktaPencocok["abt"]>) => ({ ...fakta().abt, masuk, putus: { tanggal: "2026-10-12", statusId: 62 }, ...ubah });
    const p = putus({ tanggalMinutasi: "2026-10-14" });
    expect(jenisDari({ fakta: fakta({ putusan: p, abt: abt({ minutasi: { tanggal: "2026-10-15" } }) }) })).toEqual(["minutasi-abt"]);
    expect(jenisDari({ fakta: fakta({ putusan: p, abt: abt({ minutasi: { tanggal: "2026-10-14" } }) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: p, abt: abt({}) }) })).toEqual(["minutasi-abt"]); // 14 Okt -> 28 Okt = tepat 14 hari
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggalMinutasi: "2026-10-15" }), abt: abt({}) }) })).toEqual([]); // 13 hari
    expect(jenisDari({ fakta: fakta({ putusan: putus({ tanggalMinutasi: "2026-10-20" }), abt: abt({}) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ putusan: p, tahapan: { id: 9, teks: "Akta Cerai", proses: "" }, aktaCerai: { tanggal: "2026-10-20" }, abt: abt({ minutasi: { tanggal: "2026-10-14" }, aktaCerai: { tanggal: "2026-10-21" } }) }) })).toEqual(["akta-abt"]);
  });
});

describe("mesin aturan: pendaftaran, pihak, kuasa, NIK, biaya", () => {
  const masuk = (ubah: Partial<NonNullable<FaktaPencocok["abt"]["masuk"]>> = {}) => ({
    nomorPerkara: "901/Pdt.G/2026/PA.Dgl",
    tanggalPendaftaran: "2026-08-03",
    jenisPerkaraId: 345,
    paraPihak: "<b>Penggugat</b><br>Rina Marlina binti Ahmad, umur 30 tahun ...<br><b>Tergugat</b><br>Joko Santoso bin Slamet, umur 33 tahun",
    ...ubah,
  });
  const dgnAbt = (m: NonNullable<FaktaPencocok["abt"]["masuk"]>) => ({ ...fakta().abt, masuk: m });

  it("nomor, tanggal daftar, jenis perkara berbeda dari register ABT = perlu dicek; semua sama = diam", () => {
    expect(jenisDari({ fakta: fakta({ abt: dgnAbt(masuk()) }) })).toEqual([]);
    const t = cocokkanPerkara({ acuan: HARI, fakta: fakta({ abt: dgnAbt(masuk({ jenisPerkaraId: 360, tanggalPendaftaran: "2026-08-04" })) }) });
    expect(t.map((x) => x.jenis)).toEqual(["daftar-abt"]);
    expect(t[0].ringkas).toContain("tanggal pendaftaran");
    expect(t[0].ringkas).toContain("jenis perkara");
  });

  it("nama pihak: ejaan spasi/besar-kecil dimaafkan; nama berbeda ditandai ringan; data terpotong tidak dinilai", () => {
    expect(jenisDari({ fakta: fakta({ abt: dgnAbt(masuk({ paraPihak: "RINA MARLINA BINTI AHMAD, Joko Santoso bin Slamet" })) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ abt: dgnAbt(masuk({ paraPihak: "RinaMarlina binti Ahmad, JokoSantoso bin Slamet" })) }) })).toEqual([]);
    const beda = cocokkanPerkara({ acuan: HARI, fakta: fakta({ abt: dgnAbt(masuk({ paraPihak: "Rina Marlina binti Ahmad, Jokowi bin Slamet" })) }) });
    expect(beda.map((t) => [t.jenis, t.tingkat])).toEqual([["pihak-abt", "rendah"]]);
    expect(beda[0].ringkas).toContain("Joko Santoso");
    expect(jenisDari({ fakta: fakta({ abt: dgnAbt(masuk({ paraPihak: "x".repeat(12000) })) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ abt: dgnAbt(masuk({ paraPihak: "orang lain" })) }), terbaca: { pihak: false } })).toEqual([]);
  });

  it("kuasa hukum yang ada di e-Court tetapi belum di SIPP: hanya perkara e-Litigasi", () => {
    const kuasa = { sipp: [{ pihakId: 10, nama: "Ujang H., S.H." }], ecourt: [{ pihakId: 10, nama: "Ujang H., S.H." }, { pihakId: 11, nama: "Moh. Safaad, S.H." }] };
    const t = cocokkanPerkara({ acuan: HARI, fakta: fakta({ lewatEcourt: true, kuasa }) });
    expect(t.map((x) => x.jenis)).toEqual(["kuasa-ecourt"]);
    expect(t[0].ringkas).toContain("Moh. Safaad");
    expect(t[0].ringkas).not.toContain("Ujang");
    expect(jenisDari({ fakta: fakta({ lewatEcourt: false, kuasa }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ lewatEcourt: true, kuasa: { sipp: kuasa.ecourt, ecourt: kuasa.ecourt } }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ lewatEcourt: true, kuasa }), terbaca: { kuasa: false } })).toEqual([]);
    // orang sama dengan dua pihak_id (catatan ganda SIPP) dan baris e-Court ganda per pihak yang diwakili: tidak dituduh
    const ganda = { sipp: [{ pihakId: 8612, nama: "Misbahudin S.H.,M.H" }], ecourt: [{ pihakId: 29736, nama: "MISBAHUDIN, SH.,MH" }, { pihakId: 29736, nama: "MISBAHUDIN, SH.,MH" }] };
    expect(jenisDari({ fakta: fakta({ lewatEcourt: true, kuasa: ganda }) })).toEqual([]);
    // SIPP menyatukan beberapa kuasa dalam satu isian nama
    const gabung = { sipp: [{ pihakId: 1, nama: "Rahmi, S.H.,M.H, Helmy, S.H, Andirwan ,S.H" }], ecourt: [{ pihakId: 2, nama: "ANDIRWAN, S.H." }] };
    expect(jenisDari({ fakta: fakta({ lewatEcourt: true, kuasa: gabung }) })).toEqual([]);
    // ejaan nama berbeda (Misbahudin / Misbahuddin) tetap disebut: itu perbedaan nyata
    const eja = { sipp: [{ pihakId: 1, nama: "Misbahuddin, S.H., M.H" }], ecourt: [{ pihakId: 2, nama: "MISBAHUDIN, SH.,MH" }] };
    expect(jenisDari({ fakta: fakta({ lewatEcourt: true, kuasa: eja }) })).toEqual(["kuasa-ecourt"]);
    // dua baris e-Court untuk kuasa yang sama tetapi belum tercatat: disebut SEKALI
    const dua = { sipp: [], ecourt: [{ pihakId: 11, nama: "Moh. Safaad, S.H." }, { pihakId: 11, nama: "Moh. Safaad, S.H." }] };
    expect(cocokkanPerkara({ acuan: HARI, fakta: fakta({ lewatEcourt: true, kuasa: dua }) })[0].ringkas.match(/Safaad/g)).toHaveLength(1);
  });

  it("NIK dari KTP vs SIPP: beda = penting dan TERSAMAR; SIPP kosong = perlu dicek; sama/NIK tak sah = diam", () => {
    const ktp = (nik: string, nikSipp: string, nikSah = true) => ({ pihakId: 1, nik, nikSah, nama: "Rina Marlina", nikSipp });
    const beda = cocokkanPerkara({ acuan: HARI, fakta: fakta({ ktp: [ktp("7271010101010002", "7271010101010099")] }) });
    expect(beda.map((t) => [t.jenis, t.tingkat])).toEqual([["pihak-nik", "tinggi"]]);
    const semuaTeks = JSON.stringify(beda);
    expect(semuaTeks).not.toContain("7271010101010002");
    expect(semuaTeks).not.toContain("7271010101010099");
    expect(jenisDari({ fakta: fakta({ ktp: [ktp("7271010101010002", "")] }) })).toEqual(["pihak-nik-kosong"]);
    expect(jenisDari({ fakta: fakta({ ktp: [ktp("7271010101010002", "7271010101010002")] }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ ktp: [ktp("7271010101010002", "7271010101010099", false)] }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ ktp: [ktp("12345", "99999")] }) })).toEqual([]);
  });

  it("biaya: jumlah pemasukan/pengeluaran SIPP vs ABT; ABT tanpa baris atau tak terbaca = diam", () => {
    const sipp = { masuk: 500000, keluar: 355000, baris: 6 };
    const abt = (biaya: { masuk: number; keluar: number; baris: number } | null, terbacaBiaya = true) => ({ ...fakta().abt, biaya, terbaca: { ...fakta().abt.terbaca, biaya: terbacaBiaya } });
    expect(jenisDari({ fakta: fakta({ biaya: sipp, abt: abt({ masuk: 500000, keluar: 355000, baris: 6 }) }) })).toEqual([]);
    const t = cocokkanPerkara({ acuan: HARI, fakta: fakta({ biaya: sipp, abt: abt({ masuk: 500000, keluar: 298000, baris: 5 }) }) });
    expect(t.map((x) => x.jenis)).toEqual(["biaya-abt"]);
    expect(t[0].ringkas).toContain("pengeluaran");
    expect(t[0].ringkas).not.toContain("pemasukan");
    expect(jenisDari({ fakta: fakta({ biaya: sipp, abt: abt(null) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ biaya: sipp, abt: abt({ masuk: 1, keluar: 1, baris: 1 }, false) }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ biaya: { masuk: 0, keluar: 0, baris: 0 }, abt: abt({ masuk: 1, keluar: 1, baris: 1 }) }) })).toEqual([]);
  });
});

describe("mesin aturan: majelis, PP, kehadiran, jadwal, tahapan", () => {
  const penetapan = (majelis: string, pp = "Panitera Pengganti: Citra Lestari, S.H.", tanggalMajelis = "2026-08-05", tanggalPp = "2026-08-05") => ({ majelis, pp, tanggalMajelis, tanggalPp });
  const TEKS = "Hakim Ketua: Budi Santoso, S.H.</br>Hakim Anggota 1: Dewi Anggraini, S.H.I.</br>Hakim Anggota 2: Eko Prasetyo, S.H.";

  it("majelis aktif berbeda dengan teks penetapan yang SETANGGAL = penetapan tidak diperbarui; penggantian yang lebih baru = sah, diam", () => {
    const m = (aktif: string[], tanggalAktif: string, tp: string) => ({ ...fakta().majelis, aktif, tanggalAktif, penetapan: penetapan(TEKS, undefined, tp) });
    expect(jenisDari({ fakta: fakta({ majelis: m(["Budi Santoso, S.H.", "Dewi Anggraini, S.H.I.", "Eko Prasetyo, S.H."], "2026-08-05", "2026-08-05") }) })).toEqual([]);
    const beda = cocokkanPerkara({ acuan: HARI, fakta: fakta({ majelis: m(["Budi Santoso, S.H.", "Fahri Saifuddin, S.H.I.", "Eko Prasetyo, S.H."], "2026-08-05", "2026-08-05") }) });
    expect(beda.map((t) => t.jenis)).toEqual(["majelis-penetapan"]);
    expect(jenisDari({ fakta: fakta({ majelis: m(["Budi Santoso, S.H.", "Fahri Saifuddin, S.H.I.", "Eko Prasetyo, S.H."], "2026-09-10", "2026-08-05") }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ majelis: m(["Fahri Saifuddin, S.H.I."], "2026-08-05", "2026-08-05") }), terbaca: { majelis: false } })).toEqual([]);
  });

  it("panitera pengganti beda dengan teks penetapan; penggantian PP yang lebih baru = sah", () => {
    const dasar = { ...fakta().majelis, penetapan: penetapan(TEKS) };
    expect(jenisDari({ fakta: fakta({ majelis: { ...dasar, ppAktif: ["Sri Wahyuni"] } }) })).toEqual(["pp-penetapan"]);
    expect(jenisDari({ fakta: fakta({ majelis: { ...dasar, ppAktif: ["Sri Wahyuni"], tanggalPpAktif: "2026-09-30" } }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ majelis: { ...dasar, ppAktif: ["Citra Lestari, S.H."] } }) })).toEqual([]);
  });

  it("sudah ada sidang tetapi majelis aktif kosong", () => {
    expect(jenisDari({ fakta: fakta({ majelis: { aktif: [], ppAktif: [], penetapan: null }, sidang: [sidang("2026-09-01")] }) })).toEqual(["majelis-kosong"]);
    expect(jenisDari({ fakta: fakta({ majelis: { aktif: [], ppAktif: [], penetapan: null }, sidang: [] }) })).toEqual([]);
  });

  it("amar verstek tetapi Tergugat hadir (semua sandi hadir); tanpa verstek atau sidang sesudah putus = diam", () => {
    const s = [sidang("2026-09-01", { dihadiriOleh: 1 }), sidang("2026-10-05", { urutan: 2, dihadiriOleh: 2 })];
    const t = cocokkanPerkara({ acuan: HARI, fakta: fakta({ putusan: putus({ amarVerstek: true, tanggal: "2026-10-05" }), sidang: s }) });
    expect(t.map((x) => [x.jenis, x.tingkat])).toEqual([["hadir-verstek", "tinggi"]]);
    expect(t[0].ringkas).toContain("1 Sep 2026");
    expect(t[0].ringkas).not.toContain("5 Okt 2026");
    expect(jenisDari({ fakta: fakta({ putusan: putus({ amarVerstek: false, tanggal: "2026-10-05" }), sidang: s }) })).toEqual([]);
    // sandi 11 (Sebagian Tergugat) dan 8/9/15 juga berarti Tergugat hadir - satu sumber dengan sandi-kehadiran
    expect(jenisDari({ fakta: fakta({ putusan: putus({ amarVerstek: true, tanggal: "2026-10-05" }), sidang: [sidang("2026-10-05", { dihadiriOleh: 11 })] }) })).toEqual(["hadir-verstek"]);
    expect(jenisDari({ fakta: fakta({ putusan: putus({ amarVerstek: true, tanggal: "2026-10-05" }), sidang: [sidang("2026-10-05", { dihadiriOleh: 2 })] }) })).toEqual([]);
  });

  it("kehadiran kosong pada sidang lewat (<= 60 hari); musyawarah, ikrar, ditunda, dan tumpukan lama dikecualikan", () => {
    const kosong = (tanggal: string, ubah: Partial<FaktaPencocok["sidang"][number]> = {}) => fakta({ sidang: [sidang(tanggal, { dihadiriOleh: null, ...ubah })] });
    expect(jenisDari({ fakta: kosong("2026-10-10") })).toEqual(["hadir-kosong"]);
    expect(jenisDari({ fakta: kosong("2026-10-10", { agenda: "Musyawarah Majelis" }) })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-10-10", { ikrar: true }) })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-10-10", { ditunda: true }) })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-06-10") })).toEqual([]);
    expect(jenisDari({ fakta: kosong("2026-11-03") })).toEqual([]);
  });

  it("Court Calendar: memakai keadaanCourtCalendar apa adanya; hanya perkara e-Litigasi, belum putus, sidang mendatang, sumber terbaca", () => {
    const siap = {
      lewatEcourt: true,
      hadirLengkapPertama: "2026-09-01",
      mediasi: { hasil: "TIDAK BERHASIL", keputusan: "2026-09-10", laporan: "2026-09-15" },
      sidang: [sidang("2026-09-01"), sidang("2026-11-03", { urutan: 3, agenda: "Panggil Tergugat" })],
      courtCalendar: [{ tanggal: "2026-11-03", agenda: "Pembuktian Tergugat" }],
    } satisfies Partial<FaktaPencocok>;
    const t = cocokkanPerkara({ acuan: HARI, fakta: fakta(siap) });
    expect(t.map((x) => x.jenis)).toEqual(["calendar-sinkron"]);
    expect(t[0].ringkas).toContain("3 Nov 2026");
    expect(jenisDari({ fakta: fakta({ ...siap, courtCalendar: [{ tanggal: "2026-11-03", agenda: "Panggil Tergugat" }] }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ ...siap, lewatEcourt: false }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ ...siap, putusan: putus({ tanggal: "2026-10-12" }) }) })).not.toContain("calendar-sinkron");
    expect(jenisDari({ fakta: fakta(siap), terbaca: { courtCalendar: false } })).toEqual([]);
    // Court Calendar belum dibuat sama sekali
    expect(jenisDari({ fakta: fakta({ ...siap, courtCalendar: [] }) })).toEqual(["calendar-sinkron"]);
  });

  it("tahapan: belum putus tetapi tahapan pasca-putus; sudah putus tetapi masih Persidangan; akta terbit tetapi masih Putusan; mandek", () => {
    const tahapan = (teks: string) => ({ id: 1, teks, proses: "" });
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Akta Cerai") }) })).toEqual(["tahapan-belum-putus"]);
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Persidangan"), putusan: putus() }) })).toEqual(["tahapan-sudah-putus"]);
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Putusan"), putusan: putus(), aktaCerai: { tanggal: "2026-10-20" } }) })).toEqual(["tahapan-akta"]);
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Akta Cerai"), putusan: putus(), aktaCerai: { tanggal: "2026-10-20" } }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Persidangan"), putusan: putus({ dicabut: true }) }) })).toEqual([]);
    const mandek = fakta({ sidang: [sidang("2026-09-20")] });
    expect(cocokkanPerkara({ acuan: HARI, fakta: mandek }).map((t) => t.jenis)).toEqual(["tahapan-mandek"]);
    expect(jenisDari({ fakta: fakta({ sidang: [sidang("2026-10-20")] }) })).toEqual([]);
    expect(jenisDari({ fakta: fakta({ tahapan: tahapan("Persidangan"), putusan: putus() }), terbaca: { putusan: false } })).toEqual([]);
  });

  it("urutan hasil: penting dulu; aturan yang melempar galat dilewati (tidak menjatuhkan yang lain); ringkasan menghitung perkara", () => {
    const f = fakta({
      tahapan: { id: 1, teks: "Akta Cerai", proses: "" },
      sidang: [sidang("2026-09-20", { dihadiriOleh: null })],
    });
    const t = cocokkanPerkara({ acuan: HARI, fakta: f });
    expect(t.map((x) => x.tingkat)).toEqual([...t.map((x) => x.tingkat)].sort((a, b) => ({ tinggi: 0, sedang: 1, rendah: 2 })[a] - ({ tinggi: 0, sedang: 1, rendah: 2 })[b]));
    expect(t[0].jenis).toBe("tahapan-belum-putus");
    // fakta rusak (tanpa bagian abt) -> tidak melempar ke pemanggil
    const rusak = { ...f, abt: undefined as unknown as FaktaPencocok["abt"] };
    expect(() => cocokkanPerkara({ acuan: HARI, fakta: rusak })).not.toThrow();
    const ring = ringkasTemuan(t.map((x) => ({ perkaraId: "1", jenis: x.jenis, tingkat: x.tingkat })));
    expect(ring.perkara).toBe(1);
    expect(ring.jumlah).toBe(t.length);
  });
});

// ============================================================================
// BOT: pembaca fakta dengan kueri tiruan
// ============================================================================

describe("bot: pencocokFaktaService", () => {
  const modul = require_(path.join(AKAR_BOT, "services/pencocokFaktaService.js")) as {
    buatLayanan: (d: Record<string, unknown>) => { daftarLingkup: (o: Record<string, unknown>) => Promise<any>; fakta: (o: Record<string, unknown>) => Promise<any> };
  };

  function tiruan(opsi: { gagalSipp?: string[]; gagalAbt?: boolean } = {}) {
    const sql: string[] = [];
    const baris: Array<[RegExp, unknown[]]> = [
      [/FROM perkara p WHERE p\.perkara_id IN/, [{ perkaraId: 9001, nomorPerkara: "901/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 345, jenisPerkara: "Cerai Gugat", alurPerkaraId: 7, tanggalPendaftaran: new Date(2026, 7, 3), tahapanId: 5, tahapanText: "Putusan", prosesText: "Putus" }, { perkaraId: 9002, nomorPerkara: "902/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 345, jenisPerkara: "Cerai Gugat", alurPerkaraId: 7, tanggalPendaftaran: "2026-08-04", tahapanId: 3, tahapanText: "Persidangan", prosesText: "" }]],
      [/FROM perkara_putusan pu WHERE/, [{ perkaraId: 9001, tanggal: new Date(2026, 9, 12), statusId: 62, amarVerstek: 1, adaAmar: 1, adaBerkas: 0, tanggalMinutasi: null, tanggalBht: null, tanggalCabut: null, tanggalGugur: null }]],
      [/FROM perkara_akta_cerai/, []],
      [/FROM perkara_jadwal_sidang WHERE/, [{ id: 1, perkaraId: 9001, urutan: 1, tanggal: new Date(2026, 9, 12), agenda: "Pembacaan putusan", dihadiriOleh: 3, ditunda: "T", ikrar: "T", edocBas: "bas.pdf" }]],
      [/FROM perkara_pihak1/, [{ perkaraId: 9001, ke: 1, urutan: 1, nama: "Rina Marlina binti Ahmad", pihakId: 1 }, { perkaraId: 9001, ke: 2, urutan: 1, nama: "Joko Santoso bin Slamet", pihakId: 2 }]],
      [/FROM perkara_biaya WHERE/, [{ perkaraId: 9001, masuk: "500000.00", keluar: "355000.00", baris: 6 }]],
      [/FROM perkara_hakim_pn/, [{ perkaraId: 9001, urutan: 1, nama: "Budi Santoso, S.H.", tanggal: new Date(2026, 7, 5) }]],
      [/FROM perkara_panitera_pn/, [{ perkaraId: 9001, urutan: 1, nama: "Citra Lestari, S.H.", tanggal: new Date(2026, 7, 5) }]],
      [/FROM perkara_penetapan/, [{ perkaraId: 9001, majelis: "Hakim Ketua: Budi Santoso, S.H.", pp: "Panitera Pengganti: Citra Lestari, S.H.", tanggalMajelis: new Date(2026, 7, 5), tanggalPp: new Date(2026, 7, 5) }]],
      [/FROM perkara_pengacara/, [{ perkaraId: 9001, pihakId: 10, nama: "Ujang H., S.H." }]],
      [/FROM perkara_efiling_id pe/, [{ perkaraId: 9001, pihakId: 10 }, { perkaraId: 9001, pihakId: 11 }]],
      [/FROM pihak WHERE id IN/, [{ id: 11, nama: "Moh. Safaad, S.H.", nik: "7271010101010099" }]],
    ];
    const abtBaris: Array<[RegExp, unknown[]]> = [
      [/FROM register_perkara_masuk/, [{ perkaraId: 9001, nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: new Date(2026, 7, 3), jenisPerkaraId: 345, paraPihak: "<b>Penggugat</b>" + "x".repeat(13000) }]],
      [/FROM register_perkara_putus/, [{ perkaraId: 9001, tanggal: new Date(2026, 9, 12), statusId: 62 }]],
      [/FROM register_minutasi/, []],
      [/FROM register_akta_cerai/, []],
      [/FROM keu_biaya/, [{ perkaraId: 9001, masuk: "500000.00", keluar: "298000.00", baris: 5 }]],
    ];
    const botBaris: Array<[RegExp, unknown[]]> = [
      [/FROM aleta_bot_ecourt_putusan/, [{ nomorPerkara: "901/Pdt.G/2026/PA.Dgl", adaTab: 1, adaBaris: 1, alasan: "", tanggalTeks: "Senin, 12 Oktober 2026", dokumenAda: 1, tte: 1, diperiksaPada: new Date("2026-10-20T01:00:00Z") }]],
      [/FROM aleta_bot_ktp_pihak/, [{ perkaraId: 9001, pihakId: 11, nik: "7271010101010002", nikSah: 1, nama: "Moh. Safaad" }]],
    ];
    const cari = (tabel: Array<[RegExp, unknown[]]>, kueri: string, gagal: string[] = []) => {
      sql.push(kueri);
      for (const g of gagal) if (kueri.includes(g)) throw new Error(`tiruan gagal: ${g}`);
      const h = tabel.find(([p]) => p.test(kueri));
      return h ? h[1] : [];
    };
    return {
      sql,
      d: {
        sipp: async (q: string) => cari(baris, q, opsi.gagalSipp),
        abt: async (q: string) => cari(abtBaris, q, opsi.gagalAbt ? ["register_perkara_putus"] : []),
        bot: async (q: string) => cari(botBaris, q),
        jadwal: {
          courtCalendarBanyakPerkara: async () => ({ 9001: [{ tanggal: "2026-10-12", agenda: "Putusan" }] }),
          hadirLengkapPertamaBanyakPerkara: async () => ({ 9001: "2026-10-12" }),
          mediasiBanyakPerkara: async () => ({}),
          sidangLaporanMediasiBanyakPerkara: async () => ({}),
          ecourtBanyakPerkara: async () => ({ 9001: true }),
        },
      },
    };
  }

  it("fakta tersusun per perkara dari tiga sumber; tanggal tanpa pergeseran zona; kuasa e-Court bernama; paraPihak dipotong 12.000", async () => {
    const t = tiruan();
    const h = await modul.buatLayanan(t.d).fakta({ perkaraId: [9001, 9002], acuan: HARI });
    expect(h.ok).toBe(true);
    const f = h.fakta["9001"] as FaktaPencocok;
    expect(f).toMatchObject({ nomorPerkara: "901/Pdt.G/2026/PA.Dgl", tanggalPendaftaran: "2026-08-03", lewatEcourt: true, hadirLengkapPertama: "2026-10-12" });
    expect(f.putusan).toMatchObject({ tanggal: "2026-10-12", statusId: 62, amarVerstek: true, adaBerkas: false });
    expect(f.sidang[0]).toMatchObject({ tanggal: "2026-10-12", dihadiriOleh: 3, ditunda: false, adaBas: true });
    expect(f.majelis).toMatchObject({ aktif: ["Budi Santoso, S.H."], tanggalAktif: "2026-08-05" });
    expect(f.majelis.penetapan).toMatchObject({ tanggalMajelis: "2026-08-05" });
    expect(f.kuasa?.ecourt).toEqual([{ pihakId: 10, nama: "" }, { pihakId: 11, nama: "Moh. Safaad, S.H." }]);
    expect(f.ktp[0]).toMatchObject({ pihakId: 11, nik: "7271010101010002", nikSipp: "7271010101010099" });
    expect(f.abt.masuk?.paraPihak.length).toBe(12000);
    expect(f.abt.putus).toMatchObject({ tanggal: "2026-10-12" });
    expect(f.biaya).toMatchObject({ masuk: 500000, keluar: 355000, baris: 6 });
    expect(f.ecourt.putusan).toMatchObject({ adaBaris: true, dokumenAda: true, tte: true });
    // perkara kedua: kosong tetapi tetap ada (bentuk lengkap, tanpa galat)
    const g = h.fakta["9002"] as FaktaPencocok;
    expect(g.putusan).toBeNull();
    expect(g.sidang).toEqual([]);
    expect(h.terbaca).toMatchObject({ putusan: true, abt: true, ecourt: true, ktp: true, kuasa: true });
    // fakta ini hidup di mesin aturan: verstek + Tergugat hadir (sandi 3) -> temuan penting
    const temuan = cocokkanPerkara({ acuan: HARI, fakta: f, terbaca: h.terbaca });
    expect(temuan.map((x) => x.jenis)).toEqual(expect.arrayContaining(["hadir-verstek", "biaya-abt", "kuasa-ecourt", "pihak-nik", "ecourt-dokumen-putusan"]));
  });

  it("TANPA N+1: tiap jenis fakta paling banyak satu kueri per kelompok; banyaknya kueri tidak bergantung pada jumlah perkara", async () => {
    const satu = tiruan();
    await modul.buatLayanan(satu.d).fakta({ perkaraId: [9001], acuan: HARI });
    const banyak = tiruan();
    await modul.buatLayanan(banyak.d).fakta({ perkaraId: Array.from({ length: 150 }, (_, i) => 9001 + i), acuan: HARI });
    expect(banyak.sql.length).toBe(satu.sql.length);
    expect(banyak.sql.length).toBeLessThanOrEqual(24);
  });

  it("sumber yang gagal dicatat dan ditandai tidak terbaca; sumber lain tetap jalan", async () => {
    const t = tiruan({ gagalSipp: ["FROM perkara_putusan"], gagalAbt: true });
    const h = await modul.buatLayanan(t.d).fakta({ perkaraId: [9001], acuan: HARI });
    expect(h.ok).toBe(true);
    expect(Object.keys(h.gagal).sort()).toEqual(["abt-putus", "putusan"]);
    expect(h.terbaca).toMatchObject({ putusan: false, abt: false, pihak: true });
    expect(h.fakta["9001"].putusan).toBeNull();
    expect(h.fakta["9001"].abt.terbaca.putus).toBe(false);
    // putusan tak terbaca bukan "belum putus": aturan tahapan DIAM
    const temuan = cocokkanPerkara({ acuan: HARI, fakta: h.fakta["9001"], terbaca: h.terbaca });
    expect(temuan.map((x) => x.jenis)).not.toContain("tahapan-sudah-putus");
    expect(temuan.map((x) => x.jenis)).not.toContain("putus-tanggal-abt");
  });

  it("daftar lingkup: belum putus + putus dalam N hari; halaman berdasarkan perkara_id (tanpa OFFSET)", async () => {
    const sql: Array<{ q: string; p: unknown[] }> = [];
    const d = { sipp: async (q: string, p: unknown[]) => (sql.push({ q, p }), [{ perkaraId: 11 }, { perkaraId: 12 }]) };
    const layanan = modul.buatLayanan(d);
    const h = await layanan.daftarLingkup({ acuan: "2026-10-28", hariPutus: 180, setelahId: 5, batas: 2 });
    expect(h).toMatchObject({ ok: true, sejak: "2026-05-01", perkaraId: [11, 12], berikut: 12 });
    expect(sql[0].p).toEqual([5, "2026-05-01"]);
    expect(sql[0].q).toMatch(/pu\.perkara_id IS NULL OR pu\.tanggal_putusan >= \?/);
    expect(sql[0].q).not.toMatch(/OFFSET/i);
    const akhir = await layanan.daftarLingkup({ acuan: "2026-10-28", batas: 5 });
    expect(akhir.berikut).toBeNull();
  });

  it("HANYA MEMBACA: berkas bot dan rutenya tanpa INSERT/UPDATE/DELETE/ALTER dan tanpa kata Aleta di SQL ke SIPP/ABT", () => {
    const kode = readFileSync(path.join(AKAR_BOT, "services/pencocokFaktaService.js"), "utf8");
    const sqlSaja = [...kode.matchAll(/`([^`]*(?:SELECT|FROM)[^`]*)`/g)].map((m) => m[1]);
    expect(sqlSaja.length).toBeGreaterThan(15);
    for (const q of sqlSaja) {
      expect(q).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE)\b/i);
    }
    // tabel milik bot (aleta_bot_*) hanya dibaca lewat kolam bot, tidak lewat kolam SIPP/ABT
    const lewatSipp = sqlSaja.filter((q) => /aleta/i.test(q));
    expect(lewatSipp.every((q) => /aleta_bot_(ecourt_putusan|ktp_pihak)/.test(q))).toBe(true);
    const rute = readFileSync(path.join(AKAR_BOT, "routes/jadwalSidangRoutes.js"), "utf8");
    expect(rute).toMatch(/router\.get\("\/pencocok\/lingkup", wajibToken/);
    expect(rute).toMatch(/router\.get\("\/pencocok\/fakta", wajibToken/);
    expect(rute).not.toMatch(/router\.post\("\/pencocok/);
  });
});

// ============================================================================
// PORTAL: penyimpanan, putaran malam, satu perkara, daftar, kesehatan
// ============================================================================

describe("portal: penyimpanan dan putaran (pg-mem)", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  });
  afterEach(async () => {
    await db.close();
  });

  const f1 = () =>
    fakta({
      perkaraId: "9001",
      putusan: putus({ amarVerstek: true, tanggal: "2026-10-05" }),
      tahapan: { id: 1, teks: "Putusan", proses: "" },
      sidang: [sidang("2026-10-05", { dihadiriOleh: 1 })],
    });
  const f2 = () => fakta({ perkaraId: "9002", nomorPerkara: "902/Pdt.G/2026/PA.Dgl", majelis: { aktif: ["Fahri Saifuddin, S.H.I."], ppAktif: ["Sri Wahyuni, S.H."], penetapan: null }, tahapan: { id: 1, teks: "Akta Cerai", proses: "" } });
  const sumber = (perkara: FaktaPencocok[], hitung = { lingkup: 0, fakta: 0, kelompok: [] as number[] }): SumberPencocok => ({
    async lingkup({ setelahId }) {
      hitung.lingkup += 1;
      const ids = perkara.map((p) => Number(p.perkaraId)).filter((x) => x > setelahId);
      return { ok: true, perkaraId: ids, berikut: null };
    },
    async fakta(ids) {
      hitung.fakta += 1;
      hitung.kelompok.push(ids.length);
      return { ok: true, fakta: Object.fromEntries(perkara.filter((p) => ids.includes(p.perkaraId)).map((p) => [p.perkaraId, p])), terbaca: {}, gagal: {} };
    },
  });

  it("simpan: temuan baru ditulis; isi sama TIDAK ditulis ulang; beda isi diperbarui; hilang dihapus", async () => {
    const kini = new Date("2026-10-28T14:30:00Z");
    const a = await simpanTemuanKelompok(db, await nilaiKelompok(db, { 9001: f1() }, {}, HARI), kini);
    expect(a.baru).toBeGreaterThan(0);
    expect(a).toMatchObject({ berubah: 0, dihapus: 0, tetap: 0 });
    const awal = await db.queryAll<{ jenis: string; pertama_terlihat: string; diperiksa_pada: string }>("SELECT jenis, pertama_terlihat, diperiksa_pada FROM aleta_pencocok_temuan ORDER BY jenis");
    expect(awal.map((r) => r.jenis)).toContain("hadir-verstek");

    const kemudian = new Date("2026-10-29T14:30:00Z");
    const b = await simpanTemuanKelompok(db, await nilaiKelompok(db, { 9001: f1() }, {}, HARI), kemudian);
    expect(b).toMatchObject({ baru: 0, berubah: 0, dihapus: 0, tetap: a.baru });
    const sama = await db.queryAll<{ jenis: string; pertama_terlihat: string; diperiksa_pada: string }>("SELECT jenis, pertama_terlihat, diperiksa_pada FROM aleta_pencocok_temuan ORDER BY jenis");
    expect(sama.map((r) => r.pertama_terlihat)).toEqual(awal.map((r) => r.pertama_terlihat)); // kapan pertama terlihat tidak bergeser
    expect(sama.every((r) => r.diperiksa_pada === kemudian.toISOString())).toBe(true); // penanda waktu dinaikkan

    // verstek diperbaiki (Tergugat dicatat tidak hadir) -> temuan hilang
    const diperbaiki = f1();
    diperbaiki.sidang = [sidang("2026-10-05", { dihadiriOleh: 2 })];
    const c = await simpanTemuanKelompok(db, await nilaiKelompok(db, { 9001: diperbaiki }, {}, HARI), kemudian);
    expect(c.dihapus).toBe(1);
    expect((await db.queryAll("SELECT jenis FROM aleta_pencocok_temuan WHERE jenis = 'hadir-verstek'")).length).toBe(0);
  });

  it("putaran penuh: kelompok sesuai ukuran, hasil + catatan tersimpan, perkara cocok tidak punya baris", async () => {
    const hitung = { lingkup: 0, fakta: 0, kelompok: [] as number[] };
    const bersih = fakta({ perkaraId: "9003", nomorPerkara: "903/Pdt.G/2026/PA.Dgl" });
    const c = await jalankanPutaran(db, { pemicu: "tangan", oleh: "Super Admin", sumber: sumber([f1(), f2(), bersih], hitung), kelompok: 10, acuan: HARI, kini: new Date("2026-10-28T14:30:00Z") });
    expect(c).toMatchObject({ galat: "", lengkap: true, diperiksa: 3, pemicu: "tangan", oleh: "Super Admin" });
    expect(hitung.fakta).toBe(1); // 3 perkara, 1 kelompok
    expect(c.ringkasan?.perkara).toBe(2);
    expect(c.ringkasan?.perTingkat.tinggi).toBeGreaterThan(0);
    const simpan = await bacaCatatanPencocok(db);
    expect(simpan?.diperiksa).toBe(3);
    const ids = await db.queryAll<{ perkara_id: string }>("SELECT DISTINCT perkara_id FROM aleta_pencocok_temuan ORDER BY perkara_id");
    expect(ids.map((r) => r.perkara_id)).toEqual(["9001", "9002"]);
    // kelompok kecil memecah panggilan bot
    const h2 = { lingkup: 0, fakta: 0, kelompok: [] as number[] };
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber(Array.from({ length: 25 }, (_, i) => fakta({ perkaraId: String(9100 + i) })), h2), kelompok: 10, acuan: HARI });
    expect(h2.kelompok).toEqual([10, 10, 5]);
  });

  it("bot tidak menjawab: putaran berhenti dengan galat tercatat, hasil lama TIDAK dihapus", async () => {
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber([f1()]), acuan: HARI });
    const sebelum = (await db.queryAll("SELECT jenis FROM aleta_pencocok_temuan")).length;
    expect(sebelum).toBeGreaterThan(0);
    const mati: SumberPencocok = { lingkup: async () => ({ ok: false, galat: "ALETA Bot tidak menjawab." }), fakta: async () => ({ ok: false, galat: "x" }) };
    const c = await jalankanPutaran(db, { pemicu: "tangan", sumber: mati, acuan: HARI });
    expect(c).toMatchObject({ lengkap: false, galat: "ALETA Bot tidak menjawab." });
    expect((await db.queryAll("SELECT jenis FROM aleta_pencocok_temuan")).length).toBe(sebelum);
    expect((await bacaCatatanPencocok(db))?.galat).toBe("ALETA Bot tidak menjawab.");
  });

  it("perkara yang sudah lama keluar dari lingkup dibuang; yang masih diperiksa dipertahankan", async () => {
    const lama = new Date("2026-08-01T00:00:00Z");
    await simpanTemuanKelompok(db, await nilaiKelompok(db, { 9002: f2() }, {}, HARI), lama);
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber([f1()]), acuan: HARI, kini: new Date("2026-10-28T14:30:00Z") });
    const ids = await db.queryAll<{ perkara_id: string }>("SELECT DISTINCT perkara_id FROM aleta_pencocok_temuan");
    expect(ids.map((r) => r.perkara_id)).toEqual(["9001"]);
  });

  it("detak: mati bila saklar mati / sebelum jam / sudah jalan hari ini; sekali per tanggal WITA", async () => {
    const hitung = { lingkup: 0, fakta: 0, kelompok: [] as number[] };
    const s = sumber([f1()], hitung);
    const siang = new Date("2026-10-28T04:00:00Z"); // 12.00 WITA
    const malam = new Date("2026-10-28T15:00:00Z"); // 23.00 WITA
    expect(await detakPencocok(db, { kini: siang, sumber: s })).toBeNull();
    expect(hitung.lingkup).toBe(0);
    const c = await detakPencocok(db, { kini: malam, sumber: s });
    expect(c).toMatchObject({ pemicu: "jadwal", tanggal: "2026-10-28", lengkap: true });
    expect(await detakPencocok(db, { kini: new Date("2026-10-28T15:05:00Z"), sumber: s })).toBeNull();
    expect(hitung.lingkup).toBe(1);
    // hari berikutnya jalan lagi
    expect(await detakPencocok(db, { kini: new Date("2026-10-29T15:00:00Z"), sumber: s })).toMatchObject({ tanggal: "2026-10-29" });
    // saklar mati / variabel lingkungan
    await simpanSetelanPencocok(db, { id: "u1", name: "Super Admin" }, { jadwal: false });
    expect(await detakPencocok(db, { kini: new Date("2026-10-30T15:00:00Z"), sumber: s })).toBeNull();
    await simpanSetelanPencocok(db, { id: "u1", name: "Super Admin" }, { jadwal: true });
    expect(await detakPencocok(db, { kini: new Date("2026-10-30T15:00:00Z"), sumber: s, env: { ALETA_PENCOCOK: "0" } })).toBeNull();
    // jam pemicu dapat diatur
    await simpanSetelanPencocok(db, { id: "u1", name: "Super Admin" }, { jam: "05.30" });
    expect((await bacaSetelanPencocok(db)).jam).toBe("05:30");
    expect(await detakPencocok(db, { kini: new Date("2026-10-30T22:00:00Z"), sumber: s })).toMatchObject({ tanggal: "2026-10-31" });
  });

  it("setelan dibersihkan: jam rusak -> bawaan, hari putus dibatasi", () => {
    expect(bersihkanSetelanPencocok({ jam: "25:99", hariPutus: 5 })).toMatchObject({ jam: "22:30", hariPutus: 30, jadwal: true });
    expect(bersihkanSetelanPencocok({ jam: "7.05", hariPutus: 99999, jadwal: false })).toMatchObject({ jam: "07:05", hariPutus: 1500, jadwal: false });
    expect(bersihkanSetelanPencocok(null)).toMatchObject({ jam: "22:30", hariPutus: 180 });
  });

  it("satu perkara: cache 10 menit (bot tidak ditanya ulang), segar melewati cache, hasil ikut disimpan", async () => {
    const hitung = { lingkup: 0, fakta: 0, kelompok: [] as number[] };
    const s = sumber([f1()], hitung);
    const t0 = new Date("2026-10-28T10:00:00Z");
    const a = await periksaSatuPerkara(db, "9001", { sumber: s, kini: t0, acuan: HARI });
    expect(a).toMatchObject({ ok: true, dariCache: false });
    expect(a.ok && a.temuan.map((t) => t.jenis)).toContain("hadir-verstek");
    const b = await periksaSatuPerkara(db, "9001", { sumber: s, kini: new Date(t0.getTime() + UMUR_CACHE_MS - 1000), acuan: HARI });
    expect(b).toMatchObject({ ok: true, dariCache: true });
    expect(hitung.fakta).toBe(1);
    const c = await periksaSatuPerkara(db, "9001", { sumber: s, kini: new Date(t0.getTime() + UMUR_CACHE_MS + 1000), acuan: HARI });
    expect(c).toMatchObject({ ok: true, dariCache: false });
    expect(hitung.fakta).toBe(2);
    await periksaSatuPerkara(db, "9001", { sumber: s, kini: t0, acuan: HARI, tanpaCache: true });
    expect(hitung.fakta).toBe(3);
    expect((await db.queryAll("SELECT jenis FROM aleta_pencocok_temuan WHERE perkara_id = '9001'")).length).toBeGreaterThan(0);
    expect(await periksaSatuPerkara(db, "abc", { sumber: s })).toMatchObject({ ok: false });
    expect(await periksaSatuPerkara(db, "5", { sumber: s, kini: t0 })).toMatchObject({ ok: false, galat: "Perkara tidak ditemukan di SIPP." });
    const mati: SumberPencocok = { lingkup: async () => ({ ok: false, galat: "x" }), fakta: async () => ({ ok: false, galat: "bot mati" }) };
    expect(await periksaSatuPerkara(db, "9002", { sumber: mati, kini: t0, tanpaCache: true })).toEqual({ ok: false, galat: "bot mati" });
  });

  it("daftar: saringan tingkat/jenis/bagian/cari; 'perkara saya' memakai nama petugas; ringkasan menghitung yang tersaring", async () => {
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber([f1(), f2()]), acuan: HARI });
    const semua = await daftarTemuan(db);
    expect(semua.ringkasan.perkara).toBe(2);
    expect(semua.baris[0].tingkat).toBe("tinggi");
    expect((await daftarTemuan(db, { jenis: "hadir-verstek" })).baris.map((b) => b.perkaraId)).toEqual(["9001"]);
    expect((await daftarTemuan(db, { kelompok: "tahapan" })).baris.map((b) => b.perkaraId)).toEqual(["9002"]);
    expect((await daftarTemuan(db, { cari: "902/pdt" })).baris.every((b) => b.perkaraId === "9002")).toBe(true);
    // petugas: f1 -> Budi Santoso (majelis) & Citra Lestari (PP); f2 -> Fahri Saifuddin & Sri Wahyuni
    expect((await daftarTemuan(db, { milikSaya: "Budi Santoso, S.H." })).baris.every((b) => b.perkaraId === "9001")).toBe(true);
    expect((await daftarTemuan(db, { milikSaya: "Sri Wahyuni" })).baris.every((b) => b.perkaraId === "9002")).toBe(true);
    expect((await daftarTemuan(db, { milikSaya: "Orang Lain" })).baris).toEqual([]);
    expect((await daftarTemuan(db, { milikSaya: "" })).baris.length).toBe(semua.baris.length);
    // jenis/tingkat tidak dikenal diabaikan, bukan dijadikan SQL
    expect((await daftarTemuan(db, { tingkat: "x'; DROP TABLE aleta_pencocok_temuan; --" })).baris.length).toBe(semua.baris.length);
    expect((await db.queryAll("SELECT 1 AS x FROM aleta_pencocok_temuan LIMIT 1")).length).toBe(1);
  });

  it("lonceng: hanya temuan penting; pimpinan satu ringkasan, petugas hanya perkaranya; tanpa temuan = tidak ada", async () => {
    expect(await pemberitahuanPencocok(db, { nama: "Budi Santoso, S.H.", lihatSemua: false })).toEqual([]);
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber([f1(), f2()]), acuan: HARI });
    const semua = await pemberitahuanPencocok(db, { nama: "Admin", lihatSemua: true });
    expect(semua).toHaveLength(1);
    expect(semua[0].judul).toContain("perbedaan penting");
    expect(semua[0].uraian).toContain("2 perkara");
    const budi = await pemberitahuanPencocok(db, { nama: "Budi Santoso, S.H.", lihatSemua: false });
    expect(budi[0].uraian).toContain("1 perkara");
    expect(await pemberitahuanPencocok(db, { nama: "Orang Lain", lihatSemua: false })).toEqual([]);
  });

  it("Pusat Kesehatan: belum berjalan = kelabu; ada temuan penting = kuning (informasi); galat putaran = kuning", async () => {
    const kini = new Date("2026-10-28T15:30:00Z");
    expect(periksaPencocok(null, kini).warna).toBe("kelabu");
    const kosong = await ringkasKesehatanPencocok(db);
    expect(periksaPencocok(kosong, kini)).toMatchObject({ warna: "kelabu" });
    expect(periksaPencocok(kosong, kini).ringkas).toContain("belum pernah berjalan");
    await jalankanPutaran(db, { pemicu: "tangan", sumber: sumber([f1(), f2()]), acuan: HARI });
    const r = await ringkasKesehatanPencocok(db);
    const k = periksaPencocok(r, kini);
    expect(k.warna).toBe("kuning");
    expect(k.ringkas).toMatch(/perbedaan pada 2 perkara/);
    expect(k.rincian.some((x) => x.label === "901/Pdt.G/2026/PA.Dgl")).toBe(true);
    const mati: SumberPencocok = { lingkup: async () => ({ ok: false, galat: "bot mati" }), fakta: async () => ({ ok: false, galat: "x" }) };
    await jalankanPutaran(db, { pemicu: "tangan", sumber: mati, acuan: HARI });
    expect(periksaPencocok(await ringkasKesehatanPencocok(db), kini)).toMatchObject({ warna: "kuning" });
  });
});

// ============================================================================
// PENDAFTARAN TIGA TEMPAT, RUTE, PENGKABELAN
// ============================================================================

describe("pendaftaran dan pengkabelan", () => {
  const baca = (...bagian: string[]) => readFileSync(path.join(AKAR, ...bagian), "utf8");

  it("DDL 0129 = cermin schema.ts; terdaftar di jurnal (idx 112 - 0128 tidak dipakai, when di atas 0127) dan di urutan simpan pg-mem", () => {
    const sql = baca("drizzle/0129_aleta_pencocok_temuan.sql");
    const rapat = (t: string) => t.replace(/--.*$/gm, "").replace(/;/g, " ").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_PENCOCOK_TEMUAN.tabel, ...DDL_PENCOCOK_TEMUAN.indeks].join(" ")));
    const jurnal = JSON.parse(baca("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const e = jurnal.entries.filter((x) => x.tag === "0129_aleta_pencocok_temuan");
    expect(e).toHaveLength(1);
    // G2 1 Nov: 0128 tidak dipakai (N1), jadi 0129 tepat sesudah 0127 di idx 112; idx = urutan.
    expect(e[0].idx).toBe(112);
    jurnal.entries.forEach((x, i) => expect(x.idx).toBe(i));
    expect(e[0].when).toBeGreaterThan(1792341000001);
    expect(new Set(jurnal.entries.map((x) => x.idx)).size).toBe(jurnal.entries.length);
    expect(new Set(jurnal.entries.map((x) => x.when)).size).toBe(jurnal.entries.length);
    expect(baca("src/server/db/client.ts")).toContain('"aleta_pencocok_temuan"');
  });

  it("rute: baca untuk kemampuan panel + penyaringan per orang di server; ubah/jalankan hanya Super Admin; tidak ada penulisan ke SIPP/ABT", () => {
    const rute = baca("src/app/api/aleta-ecourt/pencocok/route.ts");
    expect(rute).toMatch(/pastikanKapabilitas\(db, actorUserId, "panel"\)/g);
    expect(rute).toContain("bolehMenyuntingAkses(aktor)");
    expect(rute).toContain("lihatSemuaTenggat(aktor)");
    expect(rute).toMatch(/milikSaya: semua \?/);
    expect(rute).not.toMatch(/panggilBot|whatsapp-gateway-client|sipp.*(INSERT|UPDATE)/i);
    expect(baca("src/app/(portal)/aleta-ecourt/pencocok/page.tsx")).toContain("PencocokLayar");
    const instr = baca("src/instrumentation.ts");
    expect(instr).toContain("mulaiPencocokBerkala");
    expect(instr).toContain('process.env.ALETA_PENCOCOK !== "0"');
  });

  it("layar: satu tempat bernama Pencocok data; tanpa istilah teknis di teks tampil; tautan di menu ALETA e-Court; tutorial ada", () => {
    const layar = baca("src/components/portal/pencocok-layar.tsx");
    const tampil = [...layar.matchAll(/>\s*([^<>{}\n]{12,})\s*</g)].map((m) => m[1]).join(" ") + " " + [...layar.matchAll(/"([A-Z][^"]{20,})"/g)].map((m) => m[1]).join(" ");
    expect(tampil).not.toMatch(/\b(peladen|borang|galat|payload|JSON|SQL|endpoint)\b/i);
    expect(layar).not.toMatch(/method:\s*"(PUT|DELETE|PATCH)"/);
    expect(layar).toContain("slice(0, batas)"); // daftar dipotong: DOM ringan
    expect(baca("src/components/portal/aleta-ecourt-pengguna.tsx")).toContain('href="/aleta-ecourt/pencocok"');
    expect(baca("src/lib/tutorial-isi.ts")).toContain('id: "pencocok-data"');
    expect(baca("src/server/modules/tasks/service.ts")).toContain("pemberitahuanPencocok");
    expect(baca("src/server/modules/kesehatan/layanan.ts")).toContain('{ kunci: "pencocok"');
  });

  it("ekstensi: kotak Pencocok pasif (tanpa tombol tulis), jenis yang sudah punya alat tidak diulang", () => {
    const js = readFileSync(path.resolve(AKAR, "../ekstensi-sipp/temuan-perkara.js"), "utf8");
    expect(js).toContain("gambarPencocok");
    expect(js).toContain('"/aleta/api/aleta-ecourt/pencocok"');
    expect(js).toMatch(/SUDAH_DITAMPILKAN = new Set\(\["hadir-verstek", "putus-dokumen", "calendar-sinkron"\]\)/);
    const blok = js.slice(js.indexOf("async function gambarPencocok"), js.indexOf("/** Dipanggil blangko-derry-isian.js"));
    expect(blok).not.toMatch(/method:\s*"POST"|<button/);
  });
});
