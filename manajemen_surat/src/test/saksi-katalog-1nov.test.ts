// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 1 NOV 2026 (agen H2) - KATALOG BARU KETERANGAN SAKSI DAN KEBERSIHAN DATA SAKSI
 * ============================================================================
 *
 * Yang dijaga:
 *   1. katalog baru dikenali menurut jenis perkara SIPP: 745 pengangkatan anak, 744 perjanjian perkawinan, 369 alur 15
 *      di luar hak asuh (gugatan lain-lain), serta butir tambahan tanggapan keluarga pada izin poligami;
 *   2. SEMUA kombinasi dropdown / centangan keadaan tiap katalog baru menghasilkan keterangan tanpa jawaban kosong,
 *      tanpa penanda mentah, tanpa titik-titik tak sengaja, dan dua saksi tidak pernah berbunyi sama;
 *   3. butir yang diminta tinjauan bagian E tersedia pada keadaan bawaan (PAW: dengan siapa almarhum menikah; wali adhal:
 *      hubungan Pemohon dengan wali; izin poligami: tanggapan keluarga apa pun sikap istri);
 *   4. kebersihan data (temuan 11): jawaban yang saksinya sudah tidak ada di SIPP atau milik perkara lain tidak dipakai,
 *      saksi yang tersimpan di dua sidang tidak dihitung dua kali - HANYA di jalur baca (tidak ada penulisan);
 *   5. bot mengenal jenis 343, 352, 353, 355, 356, 357, 359, 361, 744, 745 (tidak jatuh ke "umum" tanpa disengaja).
 *
 * Seluruh nomor perkara, nama, dan isi di bawah REKAAN.
 */

type Apa = any;
const REPO = path.resolve(__dirname, "../../..");
const EKS = path.join(REPO, "ekstensi-sipp");
const require_ = createRequire(import.meta.url);
const Mesin: Apa = require_(path.join(EKS, "saksi-katalog.js"));
const FOLDER = path.join(EKS, "saksi-katalog");
const muatBot = createRequire(path.join(REPO, "aleta_bot/package.json"));

const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

const katalog: Apa[] = readdirSync(FOLDER)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")))
  .filter((k) => !k.contoh);

const pilih = (jenisPerkaraId: string, alurPerkaraId = "", nama = "") => Mesin.kenaliPaket(katalog, { jenisPerkaraId, alurPerkaraId, nama });

const BARU = [
  { kunci: "pengangkatan-anak-745", jenis: "745", alur: "16", nama: "Pengangkatan Anak" },
  { kunci: "perjanjian-perkawinan", jenis: "744", alur: "16", nama: "Perjanjian Perkawinan/Perjanjian Kawin" },
  { kunci: "gugatan-lain-lain", jenis: "369", alur: "15", nama: "Lain-Lain" },
];

const JENIS: string[] = Mesin.JENIS_KETERANGAN;

/** Semua kombinasi keadaan yang dideklarasikan katalog: tiap dropdown x tiap nilai, centangan jamak: tiap nilai sendiri dan semua sekaligus. */
function semuaKeadaan(kat: Apa): Record<string, unknown>[] {
  let hasil: Record<string, unknown>[] = [{}];
  for (const [kunci, dek] of Object.entries<Apa>(kat.keadaan || {})) {
    const nilai: string[] = (dek.nilai || []).map(String);
    const pilihan: unknown[] = dek.jamak ? [...nilai.map((n) => [n]), nilai] : nilai;
    hasil = hasil.flatMap((h) => pilihan.map((p) => ({ ...h, [kunci]: p })));
  }
  return hasil;
}

const variabelPenuh = (kode: string) => (kode === "0046" ? "Penggugat" : kode === "0047" ? "Tergugat" : kode === "7036" ? "Pemohon" : `isi${kode}`);

function susun(paket: Apa, keadaan: Record<string, unknown>, jenis: string | string[], jumlah: number, benih = "10/Pdt.P/2026/PA.Dgl") {
  const saksi = Array.from({ length: jumlah }, (_v, i) => ({ pihak: "P", jenis: Array.isArray(jenis) ? jenis[i % jenis.length] : jenis }));
  // slot isian petugas (lama, sejak, daftar, ...) diisi supaya "..." yang tersisa hanya yang tidak disengaja
  const slot = { lama: "dua tahun", sejak: "tahun 2020", daftar: "alasan pertama dan kedua", isi: "perselisihan terus-menerus", pekerjaan: "petani", penghasilan: "dua juta rupiah", waktu: "tahun 2020", peristiwa: "kejadian di rumah", hubungan: "tetangga" };
  // butir "jarang" ikut diuji walau tidak masuk susunan bawaan: petugas dapat menambahkannya
  return Mesin.susunSaksi(paket, { keadaan, benih, saksi, variabel: variabelPenuh, slot, tingkat: ["inti", "pilihan", "tambahan", "jarang"] });
}

const rapi = (t: string) => Mesin.rapikan(t);

describe("pengenalan katalog baru menurut jenis perkara SIPP", () => {
  it("745, 744, dan 369 alur 15 di luar hak asuh punya katalog sendiri", () => {
    for (const b of BARU) expect(pilih(b.jenis, b.alur, b.nama)?.kunci, b.kunci).toBe(b.kunci);
    expect(pilih("745", "", "")?.kunci).toBe("pengangkatan-anak-745");
    expect(pilih("744", "", "")?.kunci).toBe("perjanjian-perkawinan");
  });

  it("katalog lama tidak berubah pemilihnya: hak asuh tetap hak asuh, 369 alur 16 tetap pengangkatan/permohonan umum", () => {
    expect(pilih("369", "15", "Lain-lain Hak Asuh Anak")?.kunci).toBe("hak-asuh");
    expect(pilih("369", "15", "Hadhanah")?.kunci).toBe("hak-asuh");
    expect(pilih("369", "16", "Lain-lain Pengangkatan Anak")?.kunci).toBe("pengangkatan-anak");
    expect(pilih("369", "16", "Permohonan Umum")?.kunci).toBe("permohonan-umum");
    expect(pilih("371")?.kunci).toBe("penetapan-ahli-waris");
  });

  it("izin poligami digabung dengan butir tambahan tanggapan keluarga", () => {
    const p = pilih("341");
    expect(p.kunci).toBe("izin-poligami");
    expect(p.digabungDari).toContain("izin-poligami-keluarga");
  });

  it("katalog baru lolos skema dan memuat butir yang memadai", () => {
    for (const b of BARU) {
      const kat = katalog.find((k) => k.kunci === b.kunci);
      const r = Mesin.periksaKatalog(kat, { namaBerkas: `${b.kunci}.json`, variabelAda });
      expect(r.galat, `${b.kunci}\n${r.galat.slice(0, 8).join("\n")}`).toEqual([]);
      expect(Mesin.ringkasKatalog(kat).pertanyaan, b.kunci).toBeGreaterThanOrEqual(15);
    }
    const tambahan = katalog.find((k) => k.kunci === "izin-poligami-keluarga");
    expect(Mesin.periksaKatalog(tambahan, { variabelAda }).galat).toEqual([]);
  });

  it("dasar hukum yang belum terverifikasi tidak tampil dalam teks, dan tidak ada kata Aleta", () => {
    for (const b of BARU) {
      const kat = katalog.find((k) => k.kunci === b.kunci);
      expect(JSON.stringify(kat)).not.toMatch(/aleta/i);
      const belum = (kat.dasarHukum as Apa[]).filter((d) => d.status === "perlu-verifikasi");
      const tampil = JSON.stringify([kat.pertanyaan, kat.catatanPetugas]).toLowerCase();
      for (const d of belum) expect(tampil, d.rujukan).not.toContain(String(d.rujukan).toLowerCase());
    }
  });
});

describe("semua kombinasi dropdown dan centangan menghasilkan keterangan yang bersih", () => {
  for (const b of BARU) {
    it(`${b.kunci}: tiap kombinasi keadaan x tiap jenis keterangan, 2 saksi bersama tidak pernah kembar`, () => {
      const paket = pilih(b.jenis, b.alur, b.nama);
      const kombinasi = semuaKeadaan(paket);
      const semuaKehadiran = paket.keadaan?.kehadiran ? (paket.keadaan.kehadiran.nilai as string[]) : [undefined];
      expect(kombinasi.length).toBeGreaterThanOrEqual(1);
      let baris = 0;
      for (const ke of kombinasi) {
        for (const jenis of JENIS) {
          const hasil = susun(paket, ke, jenis, 2);
          expect(hasil.saksi, `${b.kunci} ${JSON.stringify(ke)} ${jenis}`).toHaveLength(2);
          const peta = new Map<string, string[]>();
          for (const s of hasil.saksi) {
            expect(s.baris.length, `${b.kunci} saksi tanpa butir ${JSON.stringify(ke)}`).toBeGreaterThan(0);
            for (const r of s.baris) {
              baris += 1;
              const j = String(r.jawab || "");
              const lokasi = `${b.kunci} ${r.butir} ${r.jenis} ${JSON.stringify(ke)}`;
              expect(j.trim().length, `kosong: ${lokasi}`).toBeGreaterThan(3);
              expect(j, `penanda mentah: ${lokasi}`).not.toMatch(/[{}]|#\d{3,5}#/);
              expect(j, `titik-titik: ${lokasi}`).not.toMatch(/\.{2,}|…/);
              expect(j, `aleta: ${lokasi}`).not.toMatch(/aleta/i);
              expect(j, `ya, : ${lokasi}`).not.toMatch(/ya, /i);
              expect(String(r.tanya || "").trim().length, `tanya kosong: ${lokasi}`).toBeGreaterThan(3);
              expect(String(r.tanya), `tanya mentah: ${lokasi}`).not.toMatch(/[{}]|#\d{3,5}#|\.{2,}/);
              expect(r.kosong || [], `variabel kosong: ${lokasi}`).toEqual([]);
              peta.set(r.butir, [...(peta.get(r.butir) || []), rapi(j)]);
            }
          }
          for (const [butir, jawab] of peta) {
            if (jawab.length > 1) expect(new Set(jawab).size, `dua saksi kembar pada ${butir} ${jenis} ${JSON.stringify(ke)}`).toBe(jawab.length);
          }
        }
      }
      expect(baris).toBeGreaterThan(kombinasi.length * 10);
      void semuaKehadiran;
    });

    it(`${b.kunci}: 5 saksi pada keadaan bawaan tidak ada yang kembar dan butir tak berubah antar saksi`, () => {
      const paket = pilih(b.jenis, b.alur, b.nama);
      const ke = Mesin.keadaanBawaan(paket, {});
      const hasil = susun(paket, ke, ["melihat", "melihat", "melihat", "melihat", "melihat"], 5);
      const butirSaksi = hasil.saksi.map((s: Apa) => s.baris.map((r: Apa) => r.butir).join("|"));
      expect(new Set(butirSaksi).size).toBe(1);
      const peta = new Map<string, Set<string>>();
      for (const s of hasil.saksi) for (const r of s.baris) peta.set(r.butir, (peta.get(r.butir) || new Set()).add(rapi(r.jawab)));
      for (const [butir, himpunan] of peta) expect(himpunan.size, butir).toBe(5);
    });
  }

  it("jumlah butir mengikuti keadaan (keputusan 65): pengangkatan anak berumur 6-12 / 12-18 dan di lembaga menambah butir", () => {
    const paket = pilih("745", "16", "Pengangkatan Anak");
    const dasar = Mesin.keadaanBawaan(paket, {});
    const id = (ke: Record<string, unknown>) => Mesin.pertanyaanAktif(paket, ke, "P").map((q: Apa) => q.id);
    expect(id(dasar)).not.toContain("q-umur-mendesak");
    // bawaan mengikuti praktik PA Donggala: butir rincian "jarang" tidak ikut susunan bawaan
    expect(id(dasar).length).toBeLessThanOrEqual(32);
    expect(id(dasar)).not.toContain("q-pa-kesehatan-anak-aa");
    expect(id({ ...dasar, umurAnak: "6-sampai-12" })).toContain("q-umur-mendesak");
    expect(id({ ...dasar, umurAnak: "12-sampai-18" })).toContain("q-umur-perlindungan");
    expect(id({ ...dasar, asuhanAnak: "lembaga" })).toEqual(expect.arrayContaining(["q-lembaga", "q-terlantar"]));
    expect(id({ ...dasar, asuhanAnak: "keluarga" })).not.toContain("q-lembaga");
  });

  it("perjanjian perkawinan: waktu pembuatan, bentuk pengesahan, isi, dan perubahan menentukan butir", () => {
    const paket = pilih("744", "16", "");
    const dasar = Mesin.keadaanBawaan(paket, {});
    // keputusan 1 Nov: bawaannya SEBELUM menikah; pilihan saat menikah dan selama perkawinan tetap ada di menu
    expect(dasar.waktuPerjanjian).toBe("sebelum-nikah");
    expect(paket.keadaan.waktuPerjanjian.nilai).toEqual(["sebelum-nikah", "saat-nikah", "selama-nikah"]);
    const id = (ke: Record<string, unknown>) => Mesin.pertanyaanAktif(paket, ke, "P").map((q: Apa) => q.id);
    expect(id(dasar)).toContain("q-waktu-sebelum");
    expect(id({ ...dasar, waktuPerjanjian: "sebelum-nikah" })).toContain("q-waktu-sebelum");
    expect(id({ ...dasar, waktuPerjanjian: "saat-nikah" })).toContain("q-waktu-saat");
    expect(id({ ...dasar, waktuPerjanjian: "selama-nikah" })).toContain("q-waktu-selama");
    expect(id({ ...dasar, waktuPerjanjian: "selama-nikah" })).not.toContain("q-waktu-sebelum");
    expect(id({ ...dasar, bentukPengesahan: "pegawai-pencatat" })).toContain("q-pengesahan-pencatat");
    expect(id({ ...dasar, bentukPengesahan: "notaris" })).not.toContain("q-pengesahan-pencatat");
    expect(id({ ...dasar, isiPerjanjian: ["utang-masing-masing"] })).toContain("q-isi-utang");
    expect(id({ ...dasar, jenisPermohonan: "ubah-atau-cabut" })).toEqual(expect.arrayContaining(["q-ubah-sepakat", "q-ubah-pihak-ketiga"]));
    expect(id({ ...dasar, jenisPermohonan: "baru" })).not.toContain("q-ubah-sepakat");
  });
});

describe("butir yang diminta tinjauan bagian E ada pada keadaan bawaan", () => {
  it("penetapan ahli waris: dengan siapa almarhum menikah; wali adhal: hubungan Pemohon dengan wali", () => {
    const paw = pilih("371");
    expect(Mesin.pertanyaanAktif(paw, Mesin.keadaanBawaan(paw, {}), "P").map((q: Apa) => q.id)).toContain("q-paw-menikah");
    const wa = pilih("363");
    expect(Mesin.pertanyaanAktif(wa, Mesin.keadaanBawaan(wa, {}), "P").map((q: Apa) => q.id)).toContain("q-hubungan-wali");
  });

  it("izin poligami: tanggapan keluarga tersedia apa pun sikap istri dan kehadiran", () => {
    const ip = pilih("341");
    const dek = ip.keadaan;
    const sikap = (dek.sikapIstri.nilai as string[]).map(String);
    const hadir = (dek.kehadiran.nilai as string[]).map(String);
    for (const s of sikap) {
      for (const h of hadir) {
        const ids = Mesin.pertanyaanAktif(ip, { ...Mesin.keadaanBawaan(ip, {}), sikapIstri: s, kehadiran: h }, "P").map((q: Apa) => q.id);
        expect(ids, `${s}/${h}`).toEqual(expect.arrayContaining(["q-pg2-keluarga-suami", "q-pg2-keluarga-istri", "q-pg2-anak", "q-pg2-musyawarah", "q-pg2-keberatan"]));
      }
    }
    const hasil = susun(ip, Mesin.keadaanBawaan(ip, {}), "melihat", 2, "5/Pdt.G/2026/PA.Dgl");
    const butir = hasil.saksi[0].baris.map((r: Apa) => r.butir);
    expect(butir).toContain("q-pg2-keluarga-istri");
    // butir tambahan jatuh sesudah butir utama dan penutup tetap terakhir
    expect(butir[butir.length - 1]).toBe("q-penutup");
  });
});

describe("kebersihan data saksi di jalur baca BAS (temuan 11)", () => {
  const B: Apa = muatBot(path.join(REPO, "aleta_bot/services/basPerkara.js"));
  const jaw = (sidang: number, saksi: number, no: number, tanya: string, jawab: string) => ({ sidang_id: sidang, saksi_id: saksi, urutan_pertanyaan: no, pertanyaan: tanya, jawaban: jawab });
  const sippSaksi = [
    { id: 11, ke: 1, urutan: 1, nama: "Saksi Satu bin A", hubungan: "Adik kandung Pemohon" },
    { id: 12, ke: 1, urutan: 2, nama: "Saksi Dua bin B", hubungan: "Tetangga" },
  ];
  const baris = [
    jaw(2, 11, 1, "Apakah saksi kenal dengan Pemohon ?", "Saya kenal Pemohon;"),
    jaw(2, 11, 2, "Kapan Pemohon menikah ?", "Menikah tahun 2010;"),
    jaw(3, 11, 1, "Apakah saksi kenal dengan Pemohon ?", "Saya kenal Pemohon;"), // salinan di sidang berikutnya
    jaw(3, 11, 2, "Kapan Pemohon menikah ?", "Menikah tahun 2010;"),
    jaw(3, 11, 3, "Apa pekerjaan Pemohon ?", "Petani;"), // hanya di sidang 3: tetap dipakai
    jaw(2, 12, 1, "Apakah saksi kenal dengan Pemohon ?", "Saya kenal Pemohon;"),
    jaw(2, 12, 2, "Apakah saksi kenal dengan Pemohon ?", "Saya kenal Pemohon;"), // ganda DI SIDANG YANG SAMA: bukan salinan antar sidang
    jaw(2, 99, 1, "Apakah saksi kenal dengan Pemohon ?", "Saksi yang sudah dihapus dari SIPP;"),
    jaw(2, 77, 1, "Apakah saksi kenal dengan Pemohon ?", "Saksi milik perkara lain;"),
  ];
  const abt = async (sql: string) => (/abt_keterangan_saksi/.test(sql) ? baris : []);
  const sipp = (adaSaksi = true) => async (sql: string, params?: unknown[]) => {
    if (/WHERE id IN/.test(sql)) return (params || []).filter((x) => Number(x) === 77).map((x) => ({ id: Number(x), perkara_id: 5555 }));
    return /perkara_pihak5/.test(sql) ? (adaSaksi ? sippSaksi : []) : [];
  };

  it("saksi yang tidak ada di SIPP atau milik perkara lain tidak dipakai, dan disebut sebabnya", async () => {
    const r = await B.bacaBas(1, abt, sipp());
    expect(r.saksi.map((s: Apa) => s.id)).toEqual([11, 12]);
    const alasan = Object.fromEntries(r.diabaikan.filter((d: Apa) => d.alasan !== "ganda-di-sidang-lain").map((d: Apa) => [d.saksiId, d.alasan]));
    expect(alasan).toEqual({ 99: "saksi-tidak-ada-di-sipp", 77: "saksi-perkara-lain" });
    const semua = JSON.stringify(r.saksi);
    expect(semua).not.toContain("sudah dihapus");
    expect(semua).not.toContain("milik perkara lain");
  });

  it("saksi yang tersimpan di dua sidang tidak dihitung dua kali, yang hanya ada di satu sidang tetap ada", async () => {
    const r = await B.bacaBas(1, abt, sipp());
    const s11 = r.saksi.find((s: Apa) => s.id === 11);
    expect(s11.sidang).toEqual([2, 3]);
    expect(s11.tanyaJawab.map((t: Apa) => t.jawab)).toEqual(["Saya kenal Pemohon", "Menikah tahun 2010", "Petani"]);
    const ganda = r.diabaikan.find((d: Apa) => d.saksiId === 11 && d.alasan === "ganda-di-sidang-lain");
    expect(ganda).toMatchObject({ jumlah: 2, sidang: [3] });
    // ganda di sidang yang sama bukan salinan antar sidang: tidak disentuh
    expect(r.saksi.find((s: Apa) => s.id === 12).tanyaJawab).toHaveLength(2);
  });

  it("SIPP tidak terbaca atau kosong: tidak ada yang dibuang karena tidak bisa menilai", async () => {
    const r = await B.bacaBas(1, abt, sipp(false));
    expect(r.saksi.map((s: Apa) => s.id).sort((a: number, b: number) => a - b)).toEqual([11, 12, 77, 99]);
    expect(r.diabaikan.filter((d: Apa) => d.alasan !== "ganda-di-sidang-lain")).toEqual([]);
    const tanpaSipp = await B.bacaBas(1, abt, null);
    expect(tanpaSipp.saksi.length).toBeGreaterThan(0);
  });

  it("hanya membaca: tidak ada penulisan, hanya SELECT", async () => {
    const sql: string[] = [];
    const abtRekam = async (s: string) => (sql.push(s), /abt_keterangan_saksi/.test(s) ? baris : []);
    const sippRekam = async (s: string, p?: unknown[]) => (sql.push(s), sipp()(s, p));
    await B.bacaBas(1, abtRekam, sippRekam);
    expect(sql.length).toBeGreaterThan(2);
    for (const s of sql) expect(s.trim()).toMatch(/^SELECT /i);
  });
});

describe("bot mengenal jenis yang dahulu jatuh ke umum", () => {
  const J: Apa = muatBot(path.join(REPO, "aleta_bot/services/isiJawabanSaksiService.js"));
  it("745 = angkat, 352 = aua, 353 = asuh, 355/356/357 = perwalian; 343, 359, 361, 744 sengaja umum", () => {
    expect(J.kodeJenis("745", "16")).toBe("angkat");
    expect(J.kodeJenis("352", "16")).toBe("aua");
    expect(J.kodeJenis("353", "16")).toBe("asuh");
    for (const id of ["355", "356", "357"]) expect(J.kodeJenis(id, "16")).toBe("perwalian");
    for (const id of ["343", "359", "361", "744"]) expect(J.kodeJenis(id, "16")).toBe("umum");
  });
  it("kunci katalog baru dikenali walau id jenis tidak terbaca", () => {
    expect(J.kodeJenis("", "16", "pengangkatan-anak-745")).toBe("angkat");
    expect(J.kodeJenis("", "16", "pengesahan-anak")).toBe("aua");
    expect(J.kodeJenis("", "16", "pencabutan-kuasa-wali")).toBe("perwalian");
  });
  it("jenis yang sudah dikenal tidak berubah", () => {
    expect(J.kodeJenis("346", "15")).toBe("ct");
    expect(J.kodeJenis("347", "15")).toBe("cg");
    expect(J.kodeJenis("371", "16")).toBe("paw");
    expect(J.kodeJenis("999", "16")).toBe("umum");
  });
});
