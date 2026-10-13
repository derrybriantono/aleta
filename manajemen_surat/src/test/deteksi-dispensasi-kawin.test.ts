// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Butir 15 (13 Okt 2026): deteksi variabel blangko DISPENSASI KAWIN (putusan dan
 * BAS) - aleta_bot/services/deteksiDispensasiKawinService.js. Posita di bawah
 * disalin APA ADANYA dari SIPP PA Donggala (perkara.posita, baca-saja), termasuk
 * salah ketiknya: 231/Pdt.P/2026 menulis anak perempuan para Pemohon "Awliya
 * Annisa Mohtar bin Mohtar Syawal" - sebab panel hanya mengusulkan 5178.
 */

type Usulan = { kode: string; nilai: string; keyakinan: string; catatan?: string; sumber?: Array<{ kalimat: string }> };
type HasilLain = { ok: boolean; usulan: Usulan[]; belumSiap: Array<{ kode: string }>; bawaanAbt: unknown[]; catatan?: string; tidakTerdeteksiDk?: Array<{ kode: string; sebab: string }> };
type Nilai = Record<string, { nilai: string; kalimat: string; keyakinan: string; catatan?: string }>;
type Dk = {
  deteksiDk: (posita: string) => { nilai: Nilai; calon: { anak: { jk: string }; jkPasti: boolean } | null };
  lengkapiUsulanDk: (hasil: unknown, posita: string, opsi: { jenisPerkara?: string }) => HasilLain;
  positaCadanganSipp: (body: unknown) => Promise<string>;
  PETA_SUMBER: Array<{ kode: string; sumber: string; blangko: string[] }>;
  UKUR_DK: Record<string, { n: number; benar: number; banding?: { n: number; benar: number } }>;
  GERBANG_DK: { presisiMinimal: number; nMinimal: number };
};
type Lain = { dariPositaLain: (posita: string, opsi: { jenisPerkara: string }) => HasilLain };
type Pemuat = { DAFTAR: readonly string[]; modulUntuk: (j: unknown) => { kunci: string } | null; usulanModul: (j: unknown, posita: string) => Usulan[] };

const require_ = createRequire(import.meta.url);
const bot = (b: string) => path.resolve(process.cwd(), "../aleta_bot/services", b);
// db_config tidak boleh disentuh uji ini.
const berkasDb = path.resolve(process.cwd(), "../aleta_bot/db_config.js");
require_.cache[berkasDb] = { id: berkasDb, filename: berkasDb, loaded: true, exports: { query: () => Promise.reject(new Error("db mati")) } } as unknown as NodeJS.Module;
const dk = require_(bot("deteksiDispensasiKawinService.js")) as Dk;
const lain = require_(bot("abtUsulanLainService.js")) as Lain;
const pemuat = require_(bot("deteksi/index.js")) as Pemuat;

const P231 =
  "<p>1. Bahwa Pemohon I dan Pemohon II telah menikah pada tanggal 11 Februari 2004 yang tercatat dalam Kutipan Akta Nikah Nomor : 554/5/II/2004 tanggal 11 Februari 2004 di Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala,  Provinsi Sulawesi Tengah dan pernikahan tersebut telah dikaruniai 3 (Tiga) orang anak yang masing-masing bernama : <br />\n" +
  "a. Muh Almuftiqha’a Mukhtar bin Mohtar Syawal, umur 22 tahun;<br />\n" +
  "b. Awliya Annisa Mohtar bin Mohtar Syawal, umur 17 tahun;<br />\n" +
  "c. Ahmad Fatir Al Malaikah bin Mohtar Syawal, umur 9 tahun;<br />\n" +
  "2. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Awliya Annisa Mohtar bin Mohtar Syawal dengan Moh Afdal bin Sanuddin,;<br />\n" +
  "3. Bahwa syarat Perkawinan anak para Pemohon bernama Awliya Annisa Mohtar bin Mohtar Syawal dengan Moh Afdal bin Sanuddin belum terpenuhi persyaratan umurnya untuk melangsungkan perkawinan untuk anak para Pemohon Awliya Annisa Mohtar bin Mohtar Syawal, sampai saat ini masih berumur 17 tahun;<br />\n" +
  "4. Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur sesuai dengan surat Penolakan Nomor : B.287/Kua.22.02.1/PW.01/09/2026 tanggal 25 September 2026.<br />\n" +
  "5. Bahwa anak para Pemohon tersebut telah saling mengenal selama 1 tahun, dan hubungan mereka telah sedemikian eratnya sehingga anak para Pemohon sekarang sedang hamil 30 / 31 Minggu atau sekitar 8 bulan (Surat Keterangan Hamil nomor : 445/390/IX/2026) dari UPTD. Puskesmas Donggala ;<br />\n" +
  "6. Bahwa para Pemohon mohon agar segera diberi izin untuk menikahkan anak  para Pemohon tersebut yang telah saling mencintai dan sudah tidak dapat lagi dipisahkan ;<br />\n" +
  "7. Bahwa antara anak para Pemohon tersebut tidak ada larangan untuk melakukan pernikahan;<br />\n" +
  "8. Para Pemohon bersedia membayar biaya perkara sesuai dengan ketentuan yang berlaku.</p>";

// 217/Pdt.P/2026 - anak para Pemohon LAKI-LAKI, umur berdua "18 dan 16 tahun", hamil dalam minggu.
const P217 =
  "1. Bahwa Pemohon I dan Pemohon II telah menikah pada tanggal 21 November 2007 sesuai Surat keterangan Nikah yang dikeluarkan oleh kepala Desa Karawana dengan nomor : 145/250/SETDES , tanggal 13 Agustus 2026 di dan pernikahan tersebut telah dikaruniai seorang anak yang bernama : Ikram bin Mariam, umur 18 tahun; " +
  "2. Bahwa Pemohon III dan Pemohon IV pernah menikah di Kecamatan Marawola dan telah bercerai pada 14 Juni 2017 sesuai Akta Cerai nomor: 0133/AC/2017/PA.Dgl. Dan dari pernikahan tersebut telah dikaruniai 3 (tiga) orang anak yang masing-masing bernama : a. Radhitya Shakti bin Supryadi , umur 18 tahun; b. Zatilatul Ramadhani binti Supryadi, umur 16 tahun; c. Sa’if Al-Akbar bin Supryadi , umur 14 tahun " +
  "3. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Ikram bin Mariam dengan Zatilatul Ramadhani binti Supryadi " +
  "4. Bahwa syarat Perkawinan anak para Pemohon bernama Ikram bin Mariam dengan Zatilatul Ramadhani binti Supryadi belum terpenuhi persyaratan umurnya untuk persyaratan melangsungkan perkawinan, sampai saat ini masih berumur 18 dan 16 tahun ; " +
  "5. Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Marawola, Kabupaten Sigi, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur sesuai dengan surat Penolakan Nomor : B-248/KUA.22.10.05/2/PW.01/8/2026 tanggal 14 Agustus 2026; " +
  "6. Bahwa anak para Pemohon tersebut telah saling mengenal selama 7 bulan, dan hubungan mereka telah sedemikian eratnya sehingga anak para Pemohon sekarang sedang hamil 19 Minggu (Surat Keterangan Hamil Nomor : 0201/047.1398/VIII/2026) tertanggal 11 Agustus 2026; " +
  "7. Bahwa para Pemohon mohon agar segera diberi izin untuk menikahkan anak para Pemohon tersebut yang telah saling mencintai dan sudah tidak dapat lagi dipisahkan ; 8. Bahwa antara anak para Pemohon tersebut tidak ada larangan untuk melakukan pernikahan; 9. Para Pemohon bersedia membayar biaya perkara sesuai dengan ketentuan yang berlaku.";

// 4/Pdt.P/2026 - daftar anak "umur 15 tahun", kalimat syarat "masih berusia 16 tahun" (hakim: 16).
const P4 =
  "1. Bahwa para Pemohon I dan Pemohon II telah menikah pada tanggal 21 September 1997 yang tercatat dalam Kutipan Akta Nikah Nomor : 46/34/II/1998 di Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala Provinsi Sulawesi Tengah, tertanggal 27 Februari 1998 dan pernikahan tersebut telah dikaruniai 5 (lima) anak yang masing-masing bernama : a. Fini binti Sutarman, umur 26 tahun b. Fita binti Sutarman, umur 23 tahun; c. Safa binti Sutarman, umur 15 tahun d. Aurel bin Sutarman, umur 13 tahun; e. Fatin Nurqalesyah binti Sutarman, umur 7 tahun; " +
  "2. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Safa alias Salva binti Sutarman (calon mempelai wanita) dengan seorang laki-laki yang bernama Alfin bin Erfin (calon mempelai laki-laki); " +
  "3. Bahwa syarat Perkawinan anak para Pemohon belum terpenuhi persyaratan umurnya ; 4. Bahwa anak para Pemohon yang bernama Safa alias Salva binti Sutarman masih di bawah umur untuk persyaratan melangsungkan perkawinan yang sampai saat ini masih berusia 16 tahun; " +
  "5. Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten DOnggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur sesuai dengan surat Penolakan Nomor : B-16/KUA.22.02.02/PW.13/1/2026 tanggal 13 Januari 2026; " +
  "6. Bahwa anak Pemohon tersebut telah saling mengenal dengan calon Suaminya selama 1 tahun, dan hubungan mereka telah sedemikian eratnya); 7. Bahwa para Pemohon memohon agar diberi izin untuk menikahkan anak tersebut yang telah saling mencintai dan sudah tidak dapat lagi dipisahkan;";

// 345/Pdt.P/2018 - blok identitas anak dan calon suami (blangko lama memakai 0608-0611, 0602-0605).
const P345 =
  "Dengan hormat, perkenankanlah saya yang bertanda tangan di bawah ini: Amiruddin bin Badaruddin, umur 49 tahun, agama Islam, pendidikan S2, pekerjaan Guru, tempat tinggal di Jalan Lahasa RT/004 RW/006 Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi ; Selanjutnya disebut sebagai Pemohon; " +
  "Bahwa Pemohon berencana akan menikahkan anak Pemohon yang bernama Muh. Farhan Ansa Islami bin Amiruddin dengan seorang perempuan yang bernama Nur Intan Ramadhani binti Irham AR Hubaib; " +
  "Anak Pemohon: Muh. Farhan Ansa Islami bin Amiruddin , umur 18 tahun, agama Islam, pendidikan SLTA, pekerjaan Mahasiswa, tempat tinggal di Jalan Lahasa RT/004 RW/006 Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi; " +
  "Calon istri: Nur Intan Ramadhani binti Irham AR Hubaib , umur 18 tahun, agama Islam, pendidikan SLTA, pekerjaan Mahasiswi, tempat tinggal di Desa Kalukubula RT/001 RW/006, Kecamatan Sigi Biromaru, Kabupaten Sigi; " +
  "Bahwa anak Pemohon berstatus Perjaka, dan telah akil baliq serta sudah siap untuk menjadi suami atau kepala keluarga ;";

const nilai = (posita: string) => dk.deteksiDk(posita).nilai;

describe("231/Pdt.P/2026 - sebab laporan: panel hanya mengusulkan 5178", () => {
  it("pengurai lama tidak menemukan calon wanita (posita menulis 'bin' untuk anak perempuan)", () => {
    const lama = lain.dariPositaLain(P231, { jenisPerkara: "362" });
    const v = Object.fromEntries(lama.usulan.map((u) => [u.kode, u.nilai]));
    expect(v["0606"]).toBe("");
    expect(v["0607"]).toBe("");
  });
  it("peran dibaca dulu: anak para Pemohon = calon wanita (sedang hamil), pasangan = calon pria", () => {
    const n = nilai(P231);
    expect(n["0606"].nilai).toBe("Awliya Annisa Mohtar binti Mohtar Syawal");
    expect(n["0606"].keyakinan).toBe("ragu");
    expect(n["0606"].catatan).toContain("Awliya Annisa Mohtar bin Mohtar Syawal");
    expect(n["0600"].nilai).toBe("Moh Afdal bin Sanuddin");
    expect(n["0607"].nilai).toBe("17 tahun");
    expect(n["0601"]).toBeUndefined();
  });
  it("kehamilan, perkenalan, puskesmas, ayah calon pasangan - semuanya 'ragu' dengan kalimat sumbernya", () => {
    const n = nilai(P231);
    expect(n["0999"].nilai).toBe("8 (delapan) bulan");
    expect(n["1666"].nilai).toBe("1 (satu) tahun");
    expect(n["0997"].nilai).toBe("UPTD Puskesmas Donggala");
    expect(n["1551"].nilai).toBe("Sanuddin");
    for (const k of ["0999", "1666", "0997", "1551"]) {
      expect(n[k].keyakinan).toBe("ragu");
      expect(n[k].kalimat.length).toBeGreaterThan(10);
    }
  });
  it("lengkapiUsulanDk: 5178 lama tetap, delapan variabel kini terbaca, belumSiap dikosongkan untuk yang terbaca", () => {
    const lama = lain.dariPositaLain(P231, { jenisPerkara: "362" });
    const h = dk.lengkapiUsulanDk(lama, P231, { jenisPerkara: "362" });
    const v = Object.fromEntries(h.usulan.filter((u) => u.nilai).map((u) => [u.kode, u.nilai]));
    expect(Object.keys(v).sort()).toEqual(["0600", "0606", "0607", "0997", "0999", "1551", "1666", "5178"]);
    expect(v["5178"]).toBe("Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala");
    expect(h.belumSiap.map((b) => b.kode)).toEqual([]);
    expect((h.tidakTerdeteksiDk || []).map((t) => t.kode)).toEqual(["1552", "8812", "9956"]);
  });
  it("tidak menyentuh perkara bukan DK", () => {
    const masuk = { ok: true, usulan: [], belumSiap: [], bawaanAbt: [] };
    expect(dk.lengkapiUsulanDk(masuk, P231, { jenisPerkara: "360" })).toBe(masuk);
  });
});

describe("posita DK nyata lainnya", () => {
  it("217/2026: anak laki-laki - umur 'masih berumur 18 dan 16 tahun' dibagi menurut urutan nama", () => {
    const n = nilai(P217);
    expect(n["0600"].nilai).toBe("Ikram bin Mariam");
    expect(n["0606"].nilai).toBe("Zatilatul Ramadhani binti Supryadi");
    expect(n["0606"].keyakinan).toBe("cukup");
    expect(n["0601"].nilai).toBe("18 tahun");
    expect(n["0607"].nilai).toBe("16 tahun");
    expect(n["1666"].nilai).toBe("7 (tujuh) bulan"); // isian hakim: "7 (tujuh) bulan"
    // Minggu tidak diubah menjadi bulan - itu tafsiran, bukan bacaan.
    expect(n["0999"].nilai).toBe("19 (sembilan belas) minggu");
    // Kalimat baku "anak para Pemohon ... hamil" tidak membalik jenis kelamin yang tegas dari bin/binti.
    expect(dk.deteksiDk(P217).calon?.anak.jk).toBe("L");
  });
  it("4/2026: kalimat 'sampai saat ini masih berusia 16 tahun' didahulukan dari daftar anak (15) dan ditandai ragu", () => {
    const n = nilai(P4);
    expect(n["0606"].nilai).toBe("Safa alias Salva binti Sutarman");
    expect(n["0600"].nilai).toBe("Alfin bin Erfin");
    expect(n["0607"].nilai).toBe("16 tahun");
    expect(n["0607"].keyakinan).toBe("ragu");
    expect(n["0607"].catatan).toContain("15 tahun");
    expect(n["1666"].nilai).toBe("1 (satu) tahun");
    expect(n["0999"]).toBeUndefined(); // posita tidak menyebut hamil
  });
  it("345/2018: blok identitas milik tiap calon, bukan milik Pemohon", () => {
    const n = nilai(P345);
    expect(n["0600"].nilai).toBe("Muh. Farhan Ansa Islami bin Amiruddin");
    expect(n["0606"].nilai).toBe("Nur Intan Ramadhani binti Irham AR Hubaib");
    expect(n["0609"].nilai).toBe("SLTA");
    expect(n["0610"].nilai).toBe("Mahasiswi");
    expect(n["0604"].nilai).toBe("Mahasiswa");
    expect(n["6331"].nilai).toBe("Mahasiswa");
    expect(n["0611"].nilai).toBe("Desa Kalukubula RT/001 RW/006, Kecamatan Sigi Biromaru, Kabupaten Sigi");
    expect(n["2029"].nilai).toBe("perjaka");
    // Pendidikan/pekerjaan Pemohon (S2, Guru) tidak pernah terbaca sebagai milik calon.
    expect(Object.values(n).some((x) => /\bS2\b|^Guru$/.test(x.nilai))).toBe(false);
    expect(n["2030"]).toBeUndefined(); // status calon istri tidak disebut - tidak ditebak "gadis"
  });
});

describe("gerbang ukur dan kerangka", () => {
  it("'cukup' hanya untuk variabel yang lulus gerbang (presisi >= 0,9, n >= 10)", () => {
    const g = dk.GERBANG_DK;
    for (const [kode, u] of Object.entries(dk.UKUR_DK)) {
      const lulus = u.n >= g.nMinimal && u.benar / u.n >= g.presisiMinimal;
      if (!lulus) for (const p of [P231, P217, P4, P345]) expect(nilai(p)[kode]?.keyakinan ?? "ragu").toBe("ragu");
      // Menggantikan pengurai lama hanya bila tidak lebih buruk pada perkara yang sama.
      if (u.banding) expect(u.benar).toBeGreaterThanOrEqual(u.banding.benar);
    }
  });
  it("peta sumber memuat seluruh variabel isian blangko Derry DK (putusan dan BAS)", () => {
    const kode = new Set(dk.PETA_SUMBER.map((v) => v.kode));
    for (const k of ["0349", "0600", "0601", "0606", "0607", "0609", "0610", "0997", "0999", "1551", "1552", "1666", "2029", "2030", "5178", "6331", "8812", "9956"]) expect(kode.has(k)).toBe(true);
    expect(dk.PETA_SUMBER.filter((v) => v.sumber === "dihitung-abt").length).toBe(14);
  });
  it("terdaftar di kerangka deteksi per jenis", () => {
    expect(pemuat.DAFTAR).toContain("dispensasiKawin");
    expect(pemuat.modulUntuk(362)?.kunci).toBe("dispensasi-kawin");
    const u = pemuat.usulanModul(362, P231);
    expect(u.find((x) => x.kode === "0606")?.keyakinan).toBe("ragu");
  });
  it("posita cadangan SIPP: posita kiriman yang terbaca tidak diganti; tanpa nomor tetap apa adanya", async () => {
    expect(await dk.positaCadanganSipp({ posita: P231, nomorPerkara: "231/Pdt.P/2026/PA.Dgl" })).toBe(P231);
    expect(await dk.positaCadanganSipp({ posita: "", nomorPerkara: "" })).toBe("");
  });
});
