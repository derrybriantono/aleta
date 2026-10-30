// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET HIBAH, WAKAF DAN PENETAPAN MAFQUD (I28, 18 Okt): abt-hibah-derry (366), abt-wakaf-derry (367), abt-mafqud-derry (369 Lain-Lain Pdt.P)
 * ============================================================================
 *
 * 133 berkas baru (hibah 60, wakaf 60, mafqud 13), 6 menu (180-185), ALUR BAS 47-49, 59 variabel (9790-9875). Yang dijaga: (A) berkas di fixture, md5 sama dengan paket, dijangkau peta;
 * (B) ALUR 47-49 dan pemilihan BAS (gugatan pola wasiat, permohonan, mafqud); (C) keadaan baru (permohonan, mafqud); (D) pemilihan putusan; (E) TS = panel-alat.js;
 * (F) label isian awam; (G) katalog saksi hibah, wakaf, mafqud ikut dalam panduan pertanyaan saksi.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { jenisPerkaraIdDariNama } from "@/lib/pandu-saksi";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, masukanRekomendasiDariBaris, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { semuaSalinanBas } from "@/lib/salinan-bas-jenis";
import { SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";
import { susunPanduan } from "@/server/shared/pandu-saksi";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
// 30 Okt 2026: langkah PS (pemeriksaan setempat) menunjuk berkas BARU paket ABT abt-paket/sela-ps-30okt (belum ada di pohon server 17 Okt).
const PAKET_SELA_PS = readFileSync(path.resolve(__dirname, "../../../abt-paket/sela-ps-30okt/paket-satker/daftar-rtf.tsv"), "utf8")
  .split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")).map(([f, b]) => `${f}/${b}`);
const SERVER_DAN_PAKET = [...FIX.berkas, ...PAKET_SELA_PS];
const A = "derry_briantono/";
const MD5: Record<string, string> = {
  "4d Hibah/[01] [Kabul] Hibah - Kontradiktoir.rtf": "173b0a59e173a339a2cd3898f093fa86",
  "4d Hibah/[01a] [Kabul] Hibah - T Tidak Hadir Setelah Mediasi.rtf": "2f8c5c6f0ef30c885bd7daaaff6de185",
  "4d Hibah/[01b] [Kabul Verstek] Hibah.rtf": "b4e895bdb46fd789e197b3f16fd82a0d",
  "4d Hibah/[01p] [Kabul] Hibah - Permohonan Penetapan (Pemohon Hadir).rtf": "67424b7403ebc8fbab42a076db86b1b2",
  "4d Hibah/[03] [Tolak] Hibah - Kontradiktoir - Dalil Tidak Terbukti.rtf": "ef8c0a8eb5a90a1788edd3e2b025d8cc",
  "4d Hibah/[03b] [Tolak Verstek] Hibah - Dalil Tidak Terbukti.rtf": "7f893a0708a655d309ab735b8aaa5f67",
  "4d Hibah/[03p] [Tolak] Hibah - Dalil Permohonan Tidak Terbukti.rtf": "9059255ff38600421beb6d6d79f2b133",
  "4d Hibah/[97] [Perdamaian] Hibah - Akta Perdamaian.rtf": "dc9bbb126c8404783df281cb212d162e",
  "4d Hibah/[98] [Cabut] Hibah - P & T Hadir Sebelum Jawaban.rtf": "d6e4cdce29096f7d8e1db1e30d9fb46d",
  "4d Hibah/[98a] [Gugur] Hibah - P Tidak Hadir Sidang Pertama.rtf": "c2cd25e813b83cee3dda5e139c7a1d8a",
  "4d Hibah/[98b] [Cabut] Hibah - Sesudah Jawaban dengan Persetujuan T.rtf": "2bca49dd2680c4618a637ad9f4c76431",
  "4d Hibah/[98c] [Coret] Hibah - Dibatalkan dari Pendaftaran - Panjar Habis.rtf": "17bc6a8392381ea619230293d894bdd6",
  "4d Hibah/[99] [NO] Hibah - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf": "c1cd3c7aac784b676305bd0f9f0da197",
  "4d Hibah/[99a] [NO] Hibah - Kurang Pihak (Plurium Litis Consortium).rtf": "af03546f2cb530a32181d80af41687a6",
  "4d Hibah/[99p] [NO] Hibah - Permohonan Tidak Dapat Diterima (Formil).rtf": "041cfcab3d387f045082e7a616ff8881",
  "4d Hibah - BAS/BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4d Hibah - BAS/BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf": "0e84c7aa296bc0441d29ba5bdf4f1149",
  "4d Hibah - BAS/BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf": "90e3bf528342021b4c2f4582f3d68090",
  "4d Hibah - BAS/BAS ALUR 04 [4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada).rtf": "cbc160f3a663b7ec6ba4cf7921bd0962",
  "4d Hibah - BAS/BAS ALUR 04 [5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada).rtf": "3d923a9e7b11a559e1b3470fe1b259d8",
  "4d Hibah - BAS/BAS ALUR 04 [5a] BAS 5a P & T Hadir - Duplik Rekonvensi.rtf": "5cb41e7c131563cfc6e1cd336a68984c",
  "4d Hibah - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf": "450b3d60c5ce3cbdbfe678e961c8182a",
  "4d Hibah - BAS/BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf": "cece1fa703c528a6a4d08ff0cb59efff",
  "4d Hibah - BAS/BAS ALUR 04 [6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf": "1698231209ff07c5536334d2adb42600",
  "4d Hibah - BAS/BAS ALUR 04 [6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi).rtf": "7792738b40f17fadb6dd578cb53568c8",
  "4d Hibah - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf": "611d9de15ff10c7b7a6f2cde257e5a0b",
  "4d Hibah - BAS/BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf": "53047334b0380d5b4d9e3c77b54f7c12",
  "4d Hibah - BAS/BAS ALUR 04 [7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi).rtf": "dcc59d7f59ac99fdee9fafa5eb29aa8e",
  "4d Hibah - BAS/BAS ALUR 04 [8] BAS 8 P & T Hadir - Kesimpulan.rtf": "482514b90ec0df8cda61811717c89716",
  "4d Hibah - BAS/BAS ALUR 04 [9] BAS 9 P & T Hadir - Penyampaian Putusan.rtf": "533152d28570bf4a9da2cdd265becba0",
  "4d Hibah - BAS/BAS ALUR 04 [T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf": "b81cda3998a9715680002fd3884a30ad",
  "4d Hibah - BAS/BAS ALUR 05 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4d Hibah - BAS/BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P.rtf": "a3cf72c85e14e28db8f5f736d857739f",
  "4d Hibah - BAS/BAS ALUR 05 [4] BAS 4 P & T Hadir - Musyawarah Majelis dan Pembacaan Putusan.rtf": "124b143c514bd0ab9f90e34bf9e1c6dd",
  "4d Hibah - BAS/BAS ALUR 06 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4d Hibah - BAS/BAS ALUR 06 [2] BAS 2 P Hadir & T Tidak Hadir - Laporan Mediasi, Tunda Panggil T.rtf": "9f4ecb6e0b5d7573c075331d00659929",
  "4d Hibah - BAS/BAS ALUR 07 [1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf": "b6ac8bd51751ff97f545997fa1059967",
  "4d Hibah - BAS/BAS ALUR 07 [2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf": "b81cda3998a9715680002fd3884a30ad",
  "4d Hibah - BAS/BAS ALUR 07 [3] BAS Putus P & T Tidak Hadir - Gugur.rtf": "fe41324425bc726f5874f57cfa8aa537",
  "4d Hibah - BAS/BAS ALUR 08 [A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sidang Pertama sebelum Mediasi.rtf": "b9a00dee1786bb33dae8db1b18a14a1a",
  "4d Hibah - BAS/BAS ALUR 08 [C1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4d Hibah - BAS/BAS ALUR 08 [C2] BAS Putus P & T Hadir - Cabut Perkara Damai dari Mediasi.rtf": "31477085606e85138467b7a6258e65d1",
  "4d Hibah - BAS/BAS ALUR 09 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf": "4e5cdb91df28f2fedda5aa2122a786b6",
  "4d Hibah - BAS/BAS ALUR 09 [2] BAS Putus P Hadir & T Tidak Hadir - NO (Alamat T Salah).rtf": "52bed87a5bc8e5f7a0a930f8c381a7b2",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf": "8221a9c863239f9357e5da4209977480",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf": "e1b5df161c4ec2b1ca817bc3df1146b9",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf": "be4b9b68952559122db242aba3351c66",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf": "fbb44d946259e6493f3dae3bab820b36",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf": "a7c784143182b0e0e4a08276e6177ccf",
  "4d Hibah - BAS/BAS ALUR 47 Hibah - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf": "3d8549b9e2231e2906a508eff8652df6",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf": "6d0ba82b1f6b35d07c99dba09a55c80e",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "9efa960da92d9639783b499aac75ae93",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf": "6d7e4e15a0d94dd32a7c0ce9abde3948",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf": "b7196f257f91725fb3b3b4daac88fd39",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "f3fb3bf0ef7e12a13e5b94a4cbf6c815",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "2dfc9e8f5d3088437d3bd1752858f73c",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf": "743f4098e1dfac036a079b48342fde24",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [3] Sidang Terakhir - Pembacaan Penetapan.rtf": "f84434a8f36fed7e580d2607c6807646",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022).rtf": "4f5780947d96edf165d97be82b63c7e3",
  "4d Hibah - BAS/BAS ALUR 47 Hibah Mohon - [T] Pemohon Tidak Hadir - Tunda Panggil Pemohon.rtf": "b5cf576583c5ff769a2e8cd126ef52aa",
  "4e Wakaf/[01] [Kabul] Wakaf - Kontradiktoir.rtf": "83f86a35dac1bb06c0f29ffc10e0501b",
  "4e Wakaf/[01a] [Kabul] Wakaf - T Tidak Hadir Setelah Mediasi.rtf": "2bcf5db263bbf3a96f823359829854e3",
  "4e Wakaf/[01b] [Kabul Verstek] Wakaf.rtf": "a3fda21205c5108f45f9977dd7d93f63",
  "4e Wakaf/[01p] [Kabul] Wakaf - Permohonan Penetapan (Pemohon Hadir).rtf": "62c5bd2903a30b44d240a0355a1275c0",
  "4e Wakaf/[03] [Tolak] Wakaf - Kontradiktoir - Dalil Tidak Terbukti.rtf": "4081f0cbec3dc7d685c609e68f53c590",
  "4e Wakaf/[03b] [Tolak Verstek] Wakaf - Dalil Tidak Terbukti.rtf": "0cf92e45715e8fd8591902a16c93da50",
  "4e Wakaf/[03p] [Tolak] Wakaf - Dalil Permohonan Tidak Terbukti.rtf": "9699132ab0bb922fe7542ad9b00bd6b9",
  "4e Wakaf/[97] [Perdamaian] Wakaf - Akta Perdamaian.rtf": "346acaa9a3d5745ca689a354ba2e6a62",
  "4e Wakaf/[98] [Cabut] Wakaf - P & T Hadir Sebelum Jawaban.rtf": "7da46a66a27c6cefb0d2877d65157df6",
  "4e Wakaf/[98a] [Gugur] Wakaf - P Tidak Hadir Sidang Pertama.rtf": "69bb32a476739fea12221ce496b3a39f",
  "4e Wakaf/[98b] [Cabut] Wakaf - Sesudah Jawaban dengan Persetujuan T.rtf": "ed2a102e245d6a586358d531b7fc8925",
  "4e Wakaf/[98c] [Coret] Wakaf - Dibatalkan dari Pendaftaran - Panjar Habis.rtf": "cde3cf61058ee257a9463f6c4814669a",
  "4e Wakaf/[99] [NO] Wakaf - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf": "7c091b7095d6a47576478479bf10803d",
  "4e Wakaf/[99a] [NO] Wakaf - Kurang Pihak (Plurium Litis Consortium).rtf": "3acd98795b16f056b9be2a569c1751da",
  "4e Wakaf/[99p] [NO] Wakaf - Permohonan Tidak Dapat Diterima (Formil).rtf": "55485eb3a1fa9f8c5599b04392309ff4",
  "4e Wakaf - BAS/BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4e Wakaf - BAS/BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf": "0e84c7aa296bc0441d29ba5bdf4f1149",
  "4e Wakaf - BAS/BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf": "90e3bf528342021b4c2f4582f3d68090",
  "4e Wakaf - BAS/BAS ALUR 04 [4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada).rtf": "cbc160f3a663b7ec6ba4cf7921bd0962",
  "4e Wakaf - BAS/BAS ALUR 04 [5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada).rtf": "3d923a9e7b11a559e1b3470fe1b259d8",
  "4e Wakaf - BAS/BAS ALUR 04 [5a] BAS 5a P & T Hadir - Duplik Rekonvensi.rtf": "5cb41e7c131563cfc6e1cd336a68984c",
  "4e Wakaf - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf": "7593f89c39d9001588628752637ad54b",
  "4e Wakaf - BAS/BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf": "4af7b351b7dcceee86f5b76828242dbc",
  "4e Wakaf - BAS/BAS ALUR 04 [6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf": "2c85f2f04ff01e34165de5f6538f6b16",
  "4e Wakaf - BAS/BAS ALUR 04 [6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi).rtf": "4628290b464d18cc943f8780b8ed535a",
  "4e Wakaf - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf": "24245698054f3efd75fc8d42afbb8656",
  "4e Wakaf - BAS/BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf": "aae51f7ef6e344ad12e21b75c3d59c49",
  "4e Wakaf - BAS/BAS ALUR 04 [7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi).rtf": "2d79cd49e0fc3a608b4e59cc7a1baddc",
  "4e Wakaf - BAS/BAS ALUR 04 [8] BAS 8 P & T Hadir - Kesimpulan.rtf": "482514b90ec0df8cda61811717c89716",
  "4e Wakaf - BAS/BAS ALUR 04 [9] BAS 9 P & T Hadir - Penyampaian Putusan.rtf": "533152d28570bf4a9da2cdd265becba0",
  "4e Wakaf - BAS/BAS ALUR 04 [T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf": "b81cda3998a9715680002fd3884a30ad",
  "4e Wakaf - BAS/BAS ALUR 05 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4e Wakaf - BAS/BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P.rtf": "a3cf72c85e14e28db8f5f736d857739f",
  "4e Wakaf - BAS/BAS ALUR 05 [4] BAS 4 P & T Hadir - Musyawarah Majelis dan Pembacaan Putusan.rtf": "124b143c514bd0ab9f90e34bf9e1c6dd",
  "4e Wakaf - BAS/BAS ALUR 06 [1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4e Wakaf - BAS/BAS ALUR 06 [2] BAS 2 P Hadir & T Tidak Hadir - Laporan Mediasi, Tunda Panggil T.rtf": "9f4ecb6e0b5d7573c075331d00659929",
  "4e Wakaf - BAS/BAS ALUR 07 [1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf": "b6ac8bd51751ff97f545997fa1059967",
  "4e Wakaf - BAS/BAS ALUR 07 [2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf": "b81cda3998a9715680002fd3884a30ad",
  "4e Wakaf - BAS/BAS ALUR 07 [3] BAS Putus P & T Tidak Hadir - Gugur.rtf": "fe41324425bc726f5874f57cfa8aa537",
  "4e Wakaf - BAS/BAS ALUR 08 [A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sidang Pertama sebelum Mediasi.rtf": "b9a00dee1786bb33dae8db1b18a14a1a",
  "4e Wakaf - BAS/BAS ALUR 08 [C1] BAS 1 P & T Hadir - Mediasi.rtf": "cb4af7dfc2a459b8c1289252a2dd231b",
  "4e Wakaf - BAS/BAS ALUR 08 [C2] BAS Putus P & T Hadir - Cabut Perkara Damai dari Mediasi.rtf": "31477085606e85138467b7a6258e65d1",
  "4e Wakaf - BAS/BAS ALUR 09 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf": "4e5cdb91df28f2fedda5aa2122a786b6",
  "4e Wakaf - BAS/BAS ALUR 09 [2] BAS Putus P Hadir & T Tidak Hadir - NO (Alamat T Salah).rtf": "52bed87a5bc8e5f7a0a930f8c381a7b2",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf": "18a0a7b3d46df77f4fa058fdaff237dc",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf": "e1b5df161c4ec2b1ca817bc3df1146b9",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf": "be4b9b68952559122db242aba3351c66",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf": "8d392d181c7a6f4b0f04cf3fe6562043",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf": "a7c784143182b0e0e4a08276e6177ccf",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf": "3d8549b9e2231e2906a508eff8652df6",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf": "fba03658f84bdebd52fb9bcfddc92a90",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "8cda2b18752e058ff76eead207c317f8",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf": "0489d4b4e6c0d151e0e54c25d597eb08",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf": "554f0119613736470009c3043528b71f",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "95938c9789756fe6c9e6cf4336459f4e",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "ebabaf80f583fdae27462dacd72efc82",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf": "73968df9ce49e4a349fbb5943e6a3e17",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [3] Sidang Terakhir - Pembacaan Penetapan.rtf": "229aad9a758dc7a6c8acbf4b530bf7fa",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022).rtf": "4f5780947d96edf165d97be82b63c7e3",
  "4e Wakaf - BAS/BAS ALUR 48 Wakaf Mohon - [T] Pemohon Tidak Hadir - Tunda Panggil Pemohon.rtf": "b5cf576583c5ff769a2e8cd126ef52aa",
  "9c Penetapan Mafqud/[01] [Kabul] Mafqud - Orang Hilang Ditetapkan Meninggal Secara Hukum.rtf": "3568b0132ff21b096ceda6cb03cf5e7f",
  "9c Penetapan Mafqud/[03] [Tolak] Mafqud - Dalil Permohonan Tidak Terbukti.rtf": "35c432a06f9efaba28214e582b35b062",
  "9c Penetapan Mafqud/[99] [NO] Mafqud - Permohonan Tidak Dapat Diterima (Formil).rtf": "6efed7921ca0f99e59106d69eec1e35e",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang).rtf": "bb98e42299e16bce3b89a5490c046609",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "61a0cab0a232af3baf4450b6aafa3f6d",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi.rtf": "3f0821c0ec2afbbfd6657c7acf899e0c",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan.rtf": "b047597e76d1348d3d913c3bec53d01d",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "afd4b317746c21d44851a583434ee011",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan.rtf": "57635862d892afde1febbe2ba522514b",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan.rtf": "b96d22c834e09fa1e72d264e5bd4367e",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [3] Sidang Terakhir - Pembacaan Penetapan.rtf": "cb549f607dedb286784e718bd570c7c7",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022).rtf": "4f5780947d96edf165d97be82b63c7e3",
  "9c Penetapan Mafqud - BAS/BAS ALUR 49 Mafqud - [T] Pemohon Tidak Hadir - Tunda Panggil Pemohon.rtf": "b5cf576583c5ff769a2e8cd126ef52aa",
};
const nama = (x: string) => x.replace(/\.rtf$/, "");
const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), semua: r.map((x) => nama(x.berkas)) } : null;
};
const HIBAH_G = { jenisPerkara: "Hibah", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
const HIBAH_P = { jenisPerkara: "Hibah", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
const WAKAF_G = { jenisPerkara: "Wakaf", nomorPerkara: "6/Pdt.G/2026/PA.Dgl" };
const WAKAF_P = { jenisPerkara: "Wakaf", nomorPerkara: "6/Pdt.P/2026/PA.Dgl" };
const LAIN_P = { jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2026/PA.Dgl" };
const FOLDER_PUTUSAN = ["4d Hibah", "4e Wakaf", "9c Penetapan Mafqud"];

describe("A. pohon", () => {
  it("133 berkas ada di fixture server (hibah 60, wakaf 60, mafqud 13) dan tidak ada yang ganda", () => {
    const kunci = Object.keys(MD5);
    expect(kunci).toHaveLength(133);
    expect(kunci.filter((b) => !FIX.berkas.includes(`${A}${b}`))).toEqual([]);
    expect(new Set(FIX.berkas).size).toBe(FIX.berkas.length);
    const per = (f: string) => kunci.filter((b) => b.startsWith(`${f}/`)).length;
    expect([per("4d Hibah"), per("4d Hibah - BAS"), per("4e Wakaf"), per("4e Wakaf - BAS"), per("9c Penetapan Mafqud"), per("9c Penetapan Mafqud - BAS")]).toEqual([15, 45, 15, 45, 3, 10]);
  });

  it("md5 berkas paket (bila paket ada di laptop ini) sama dengan yang dipetakan", () => {
    const akar = "D:/aleta-dev/kerja/batch-14okt-sore/i28-wakaf-hibah-mafqud";
    const paket = (f: string) => (f.startsWith("4d") ? "abt-hibah-derry" : f.startsWith("4e") ? "abt-wakaf-derry" : "abt-mafqud-derry");
    for (const [berkas, md5] of Object.entries(MD5)) {
      const jalur = `${akar}/${paket(berkas)}/paket-satker/rtf/${A}${berkas}`;
      if (!existsSync(jalur)) continue;
      expect(createHash("md5").update(readFileSync(jalur)).digest("hex"), berkas).toBe(md5);
    }
  });

  it("semua putusan dijangkau peta bawaan (utama atau varian) dan folder putusan terpetakan ke menu", () => {
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    const putusan = Object.keys(MD5).filter((b) => FOLDER_PUTUSAN.some((f) => b.startsWith(`${f}/`)));
    expect(putusan).toHaveLength(33);
    expect(putusan.filter((b) => !dijangkau.has(b))).toEqual([]);
    expect(FOLDER_MENU_PUTUSAN["Putusan Hibah"]).toBe("4d Hibah");
    expect(FOLDER_MENU_PUTUSAN["Putusan Wakaf"]).toBe("4e Wakaf");
    expect(FOLDER_MENU_PUTUSAN["Putusan Penetapan Mafqud"]).toBe("9c Penetapan Mafqud");
  });

  it("folder dikenali tugas blangko: hibah, wakaf, mafqud", () => {
    expect(jenisPerkaraDariFolder("derry_briantono/4d Hibah").untuk).toContain("hibah");
    expect(jenisPerkaraDariFolder("derry_briantono/4e Wakaf - BAS").untuk).toContain("wakaf");
    expect(jenisPerkaraDariFolder("derry_briantono/9c Penetapan Mafqud").untuk).toEqual(expect.arrayContaining(["mafqud", "lain-lain"]));
  });
});

describe("B. ALUR BAS 47-49", () => {
  const alur = (id: string) => ALUR_BAS_BARU.find((a) => a.id === id)!;
  const KODE_G = ["V1", "AP", "CB", "V2", "TP", "NO"];
  const KODE_M = ["1", "1a", "1b", "1c", "2", "2a", "2b", "3", "T", "N"];

  it("tiga alur baru: folder, menu, jenis, dan kode langkah", () => {
    expect(alur("alur-47")).toMatchObject({ nomor: 47, folder: `${A}4d Hibah - BAS`, jenisMin: 366, jenisMaks: 366, menu: { id: 181, nama: "Hibah - BAS" } });
    expect(alur("alur-48")).toMatchObject({ nomor: 48, folder: `${A}4e Wakaf - BAS`, jenisMin: 367, jenisMaks: 367, menu: { id: 183, nama: "Wakaf - BAS" } });
    expect(alur("alur-49")).toMatchObject({ nomor: 49, folder: `${A}9c Penetapan Mafqud - BAS`, jenisMin: 369, jenisMaks: 369, menu: { id: 185, nama: "Penetapan Mafqud - BAS" } });
    expect(alur("alur-47").langkah.map((l) => l.kode)).toEqual([...KODE_G, ...KODE_M, "PS"]); // + PS (sela-ps 30 Okt)
    expect(alur("alur-48").langkah.map((l) => l.kode)).toEqual([...KODE_G, ...KODE_M, "PS"]);
    expect(alur("alur-49").langkah.map((l) => l.kode)).toEqual(KODE_M);
    for (const id of ["alur-47", "alur-48", "alur-49"]) for (const l of alur(id).langkah) expect(SERVER_DAN_PAKET, l.berkas).toContain(`${alur(id).folder}/${l.berkas}`);
  });

  it("29 salinan BAS ALUR 04-09 di folder hibah dan wakaf sama persis dengan paket; mafqud tanpa salinan", () => {
    for (const [folder, jenis] of [["4d Hibah - BAS", "Hibah"], ["4e Wakaf - BAS", "Wakaf"]] as const) {
      const salinan = Object.keys(MD5).filter((b) => b.startsWith(`${folder}/`) && /^BAS ALUR 0[4-9] /.test(b.split("/")[1]));
      expect(salinan, jenis).toHaveLength(29);
      const dariTabel: string[] = [];
      for (const [folderSumber, isi] of Object.entries(SALINAN_BAS_JENIS)) {
        for (const berkasSumber of Object.keys(isi)) {
          if (!isi[berkasSumber].includes(folder)) continue;
          const s = semuaSalinanBas(folderSumber, berkasSumber).find((x) => x.folder === `${A}${folder}`);
          expect(s, `${folderSumber}/${berkasSumber}`).toBeDefined();
          dariTabel.push(`${folder}/${s!.berkas}`);
        }
      }
      expect(dariTabel.sort()).toEqual([...salinan].sort());
    }
    expect(Object.keys(MD5).filter((b) => b.startsWith("9c Penetapan Mafqud - BAS/") && /ALUR 0[4-9]/.test(b))).toEqual([]);
  });

  it("hibah dan wakaf Pdt.G: verstek, damai, cabut, P tidak hadir, NO (pola wasiat); jenis dikenali", () => {
    expect(jenisBasBaru("Hibah", "5/Pdt.G/2026/PA.Dgl")).toBe("hibah");
    expect(jenisBasBaru("Wakaf", "6/Pdt.G/2026/PA.Dgl")).toBe("wakaf");
    const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
      const h = tentukanBasBaru({ urutanSidang: 3, dihadiriOleh: 1, ...HIBAH_G, ...m });
      return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
    };
    expect(t({ urutanSidang: 1, dihadiriOleh: 2, tergugatPernahHadir: false })).toEqual({ id: "alur-47", kode: "V1" });
    expect(t({ urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: false })).toEqual({ id: "alur-47", kode: "V2" });
    expect(t({ agenda: "mediasi berhasil perdamaian" })).toEqual({ id: "alur-47", kode: "AP" });
    expect(t({ akhir: "cabut" })).toEqual({ id: "alur-47", kode: "CB" });
    expect(t({ dihadiriOleh: 3 })).toEqual({ id: "alur-47", kode: "TP" });
    expect(t({ akhir: "no" })).toEqual({ id: "alur-47", kode: "NO" });
    expect(t({ ...WAKAF_G, akhir: "no" })).toEqual({ id: "alur-48", kode: "NO" });
    expect(t({ ...WAKAF_G, urutanSidang: 1, dihadiriOleh: 2, tergugatPernahHadir: false })).toEqual({ id: "alur-48", kode: "V1" });
  });

  it("hibah dan wakaf Pdt.P (permohonan): sidang 1, lanjutan, tunda panggil Pemohon, NO SEMA; cabut dan gugur ke 9b", () => {
    expect(jenisBasBaru("Hibah", "5/Pdt.P/2026/PA.Dgl")).toBe("hibah-mohon");
    const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
      const h = tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, ...HIBAH_P, ...m });
      return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
    };
    expect(t({ agenda: "Pemeriksaan permohonan, bukti surat dan 2 saksi" })?.id).toBe("alur-47");
    expect(t({ urutanSidang: 3, agenda: "Pembacaan penetapan" })).toEqual({ id: "alur-47", kode: "3" });
    expect(t({ dihadiriOleh: 4 })).toEqual({ id: "alur-47", kode: "T" });
    expect(t({ urutanSidang: 3, dihadiriOleh: 4, penggugatPernahHadir: true })).toEqual({ id: "alur-47", kode: "N" });
    expect(t({ ...WAKAF_P, dihadiriOleh: 4 })).toEqual({ id: "alur-48", kode: "T" });
    expect(t({ akhir: "cabut" })?.id).toBe("alur-15"); // tanpa BAS cabut di folder jenisnya: 9b Permohonan Umum
    expect(t({ akhir: "gugur" })?.id).toBe("alur-15");
  });

  it("mafqud: Lain-Lain Pdt.P yang ditandai (bot atau agenda) memakai ALUR 49; tanpa tanda tetap pengangkatan anak; Pdt.G tetap hak asuh", () => {
    const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
      const h = tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, ...LAIN_P, ...m });
      return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
    };
    expect(t({ mafqud: true, agenda: "Pemeriksaan permohonan" })?.id).toBe("alur-49");
    expect(t({ agenda: "Pemeriksaan permohonan penetapan mafqud" })?.id).toBe("alur-49");
    expect(t({ agenda: "Pemeriksaan orang yang hilang" })?.id).toBe("alur-49");
    expect(t({ mafqud: true, urutanSidang: 3, agenda: "Pembacaan penetapan" })).toEqual({ id: "alur-49", kode: "3" });
    expect(t({ mafqud: true, dihadiriOleh: 4 })).toEqual({ id: "alur-49", kode: "T" });
    expect(t({ agenda: "Pemeriksaan permohonan" })?.id).toBe("alur-18");
    expect(t({ mafqud: false, agenda: "mafqud" })?.id).toBe("alur-18"); // penanda tegas false menang atas dugaan dari agenda
    expect(tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2026/PA.Dgl", mafqud: true, agenda: "" })?.alur.id).not.toBe("alur-49"); // Pdt.G = gugatan hak asuh
  });
});

describe("C. keadaan baru", () => {
  it("hibah / wakaf Pdt.P = permohonan (tanpa mediasi, verstek, atau sesudah jawaban); Pdt.G = gugatan seperti wasiat", () => {
    const p = keadaanPutusan({ ...HIBAH_P, dihadiriOleh: 1 });
    expect(p).toContain("permohonan");
    expect(p).not.toContain("kontradiktoir");
    expect(p).not.toContain("sesudah-jawaban");
    expect(keadaanPutusan({ ...WAKAF_P, dihadiriOleh: 1 })).toContain("permohonan");
    expect(keadaanPutusan({ ...HIBAH_G, dihadiriOleh: 1 })).toEqual(expect.arrayContaining(["kontradiktoir"]));
    expect(keadaanPutusan({ ...HIBAH_G, dihadiriOleh: 1 })).not.toContain("permohonan");
    expect(keadaanPutusan({ ...WAKAF_G, dihadiriOleh: 2, verstekPutusan: true })).not.toContain("permohonan");
    expect(keadaanPutusan({ ...HIBAH_G, dihadiriOleh: 1, sesudahJawaban: true })).toContain("sesudah-jawaban");
    expect(keadaanPutusan({ ...HIBAH_G, dihadiriOleh: 1, kurangPihak: true })).toContain("kurang-pihak");
    const sema = keadaanPutusan({ ...HIBAH_P, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } });
    expect(sema).toContain("permohonan-sema-1-2022");
    expect(sema).not.toContain("permohonan");
  });

  it("mafqud hanya Lain-Lain Pdt.P: dari saklar atau amar yang menyebutnya; saklar false menang", () => {
    expect(keadaanPutusan({ ...LAIN_P, dihadiriOleh: 1, mafqud: true })).toContain("mafqud");
    expect(keadaanPutusan({ ...LAIN_P, dihadiriOleh: 1 })).not.toContain("mafqud");
    expect(keadaanPutusan({ ...LAIN_P, dihadiriOleh: 1, amarPutusan: "Menetapkan Fulan bin Fulan mafqud" })).toContain("mafqud");
    expect(keadaanPutusan({ ...LAIN_P, dihadiriOleh: 1, amarPutusan: "Menetapkan Fulan bin Fulan mafqud", mafqud: false })).not.toContain("mafqud");
    expect(keadaanPutusan({ ...LAIN_P, nomorPerkara: "7/Pdt.G/2026/PA.Dgl", mafqud: true })).not.toContain("mafqud");
    expect(keadaanPutusan({ jenisPerkara: "Dispensasi Kawin", nomorPerkara: "7/Pdt.P/2026/PA.Dgl", mafqud: true })).not.toContain("mafqud");
    expect(keadaanPutusan({ ...LAIN_P, dihadiriOleh: 4, mafqud: true, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } })).toContain("mafqud-sema-1-2022");
  });

  it("baris bot membawa penanda mafqud ke masukan rekomendasi (boolean saja)", () => {
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", mafqud: true })).toMatchObject({ mafqud: true });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", mafqud: false })).toMatchObject({ mafqud: false });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", mafqud: null })).not.toHaveProperty("mafqud");
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", mafqud: "ya" })).not.toHaveProperty("mafqud");
  });
});

describe("D. pemilihan putusan", () => {
  const f4d = "4d Hibah";
  const f4e = "4e Wakaf";
  it("hibah dan wakaf gugatan: kabul [01], T tidak hadir setelah mediasi [01a], verstek [01b], tolak [03] / [03b], damai [97], cabut [98] / [98b], gugur [98a], coret [98c], NO [99] / [99a]", () => {
    for (const [dasar, folder, N] of [[HIBAH_G, f4d, "Hibah"], [WAKAF_G, f4e, "Wakaf"]] as const) {
      const p = (m: object) => put({ ...dasar, ...m } as never);
      expect(p({ statusPutusan: "Dikabulkan" }), N).toMatchObject({ berkas: `[01] [Kabul] ${N} - Kontradiktoir`, folder });
      expect(p({ statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe(`[01b] [Kabul Verstek] ${N}`);
      expect(p({ statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toBe(`[01a] [Kabul] ${N} - T Tidak Hadir Setelah Mediasi`);
      expect(p({ statusPutusan: "Ditolak" })!.berkas).toBe(`[03] [Tolak] ${N} - Kontradiktoir - Dalil Tidak Terbukti`);
      expect(p({ statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe(`[03b] [Tolak Verstek] ${N} - Dalil Tidak Terbukti`);
      expect(p({ statusPutusan: "Perdamaian" })!.berkas).toBe(`[97] [Perdamaian] ${N} - Akta Perdamaian`);
      expect(p({ statusPutusan: "Dicabut" })!.berkas).toBe(`[98] [Cabut] ${N} - P & T Hadir Sebelum Jawaban`);
      expect(p({ statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe(`[98b] [Cabut] ${N} - Sesudah Jawaban dengan Persetujuan T`);
      expect(p({ statusPutusan: "Digugurkan" })!.berkas).toBe(`[98a] [Gugur] ${N} - P Tidak Hadir Sidang Pertama`);
      expect(p({ statusPutusan: "Dicoret dari Register" })!.berkas).toBe(`[98c] [Coret] ${N} - Dibatalkan dari Pendaftaran - Panjar Habis`);
      expect(p({ statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas).toBe(`[99a] [NO] ${N} - Kurang Pihak (Plurium Litis Consortium)`);
    }
  });

  it("hibah dan wakaf permohonan: [01p] / [03p] / [99p]; cabut, gugur, NO SEMA ke 9b Permohonan Umum", () => {
    for (const [dasar, folder, N] of [[HIBAH_P, f4d, "Hibah"], [WAKAF_P, f4e, "Wakaf"]] as const) {
      const p = (m: object) => put({ ...dasar, ...m } as never);
      expect(p({ statusPutusan: "Dikabulkan" }), N).toMatchObject({ berkas: `[01p] [Kabul] ${N} - Permohonan Penetapan (Pemohon Hadir)`, folder });
      expect(p({ statusPutusan: "Ditolak" })!.berkas).toBe(`[03p] [Tolak] ${N} - Dalil Permohonan Tidak Terbukti`);
      expect(p({ statusPutusan: "Tidak Dapat Diterima" })!.berkas).toBe(`[99p] [NO] ${N} - Permohonan Tidak Dapat Diterima (Formil)`);
      expect(p({ statusPutusan: "Dicabut" })).toMatchObject({ berkas: "[98] [Cabut] Permohonan", folder: "9b Permohonan Umum" });
      expect(p({ statusPutusan: "Digugurkan" })!.folder).toBe("9b Permohonan Umum");
      expect(p({ statusPutusan: "Tidak Dapat Diterima", dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true })!.folder).toBe("9b Permohonan Umum");
    }
  });

  it("mafqud: kabul [01], tolak [03], NO [99]; cabut, gugur, NO SEMA ke 9b; tanpa tanda tetap pengangkatan anak", () => {
    const f = "9c Penetapan Mafqud";
    const p = (m: object) => put({ ...LAIN_P, mafqud: true, ...m } as never);
    expect(p({ statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] Mafqud - Orang Hilang Ditetapkan Meninggal Secara Hukum", folder: f });
    expect(p({ statusPutusan: "Ditolak" })).toMatchObject({ berkas: "[03] [Tolak] Mafqud - Dalil Permohonan Tidak Terbukti", folder: f });
    expect(p({ statusPutusan: "Tidak Dapat Diterima" })).toMatchObject({ berkas: "[99] [NO] Mafqud - Permohonan Tidak Dapat Diterima (Formil)", folder: f });
    expect(p({ statusPutusan: "Dicabut" })!.folder).toBe("9b Permohonan Umum");
    expect(p({ statusPutusan: "Digugurkan" })!.folder).toBe("9b Permohonan Umum");
    expect(p({ statusPutusan: "Tidak Dapat Diterima", dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true })!.folder).toBe("9b Permohonan Umum");
    expect(put({ ...LAIN_P, statusPutusan: "Ditolak" })!.folder).toBe("9a Lain-Lain (Pengangkatan Anak)");
    expect(put({ ...LAIN_P, nomorPerkara: "7/Pdt.G/2026/PA.Dgl", mafqud: true, statusPutusan: "Ditolak" })!.folder).not.toBe(f);
  });

  it("jenis lain tidak berubah: wasiat dan harta bersama tetap blangkonya", () => {
    expect(put({ jenisPerkara: "Wasiat", nomorPerkara: "8/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] Wasiat - Kontradiktoir", folder: "4c Wasiat" });
    expect(put({ jenisPerkara: "Harta Bersama", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" })!.folder).toBe("4a Harta Bersama");
  });
});

describe("E. TS = panel-alat.js", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara untuk keadaan baru", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [];
    for (const j of ["Hibah", "Wakaf"]) {
      for (const s of ["Dikabulkan", "Ditolak", "Tidak Dapat Diterima", "Dicabut", "Digugurkan", "Gugur", "Dicoret dari Register", "Perdamaian"]) {
        for (const kd of [[], ["permohonan"], ["permohonan-sema-1-2022"], ["kontradiktoir"], ["t-tidak-hadir-setelah-mediasi"], ["sesudah-jawaban"], ["kurang-pihak"], ["sema-1-2022"]]) kasus.push([j, s, false, kd]);
        kasus.push([j, s, true, []]);
      }
    }
    for (const s of ["Dikabulkan", "Ditolak", "Tidak Dapat Diterima", "Dicabut", "Digugurkan", "Gugur", "Dicoret dari Register"]) {
      for (const kd of [["mafqud"], ["mafqud-sema-1-2022"], []]) kasus.push(["Lain-Lain", s, false, kd]);
    }
    expect(kasus.length).toBeGreaterThan(150);
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${v} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});

describe("F. isian baru (label awam, otomatis tidak tampil sebagai isian, tanpa kode di label)", () => {
  const D = (kode: string, nm: string, jenis = "data_teks", sql = "") => ({ kode, nama: nm, jenis, sql, bawaan: "" });
  const MANUAL = [9790, 9793, 9794, 9795, 9796, 9798, 9799, 9801, 9802, 9803, 9804, 9805, 9806, 9807, 9808, 9809, 9810, 9820, 9823, 9824, 9825, 9826, 9827, 9828, 9829, 9831, 9832, 9833, 9834, 9835, 9836, 9837, 9838, 9839, 9840, 9841, 9860, 9861, 9862, 9863, 9864, 9865, 9868, 9869, 9870, 9871, 9872, 9873, 9875].map(String);
  const OTOMATIS = ["9791", "9792", "9797", "9800", "9821", "9822", "9830", "9866", "9867", "9874"];

  it("49 isian tangan berlabel awam (ada label ramah), 10 otomatis tidak tampil sebagai isian: total 59 variabel", () => {
    expect(MANUAL.length + OTOMATIS.length).toBe(59);
    const katalog = new Map<string, Definisi>([...MANUAL.map((k) => D(k, `ABT NAMA ASLI ${k}`)), ...OTOMATIS.map((k) => D(k, `ABT OTOMATIS ${k}`, "data_sql", "select 1"))].map((d) => [d.kode, d]));
    const s = susunIsian([...MANUAL, ...OTOMATIS], katalog);
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(Object.keys(peta).sort()).toEqual([...MANUAL].sort());
    for (const k of MANUAL) {
      expect(peta[k].nama, k).not.toMatch(/ABT NAMA ASLI|#\d{4}#|\b9[78]\d\d\b/);
      expect(peta[k].nama.length, k).toBeGreaterThan(10);
    }
    expect(s.otomatis.map((o) => o.kode).sort()).toEqual([...OTOMATIS].sort());
  });

  it("pokok tuntutan / kepentingan: pilihan satu huruf; sebutan pihak mengikuti perkara", () => {
    const katalog = new Map<string, Definisi>(["9790", "9820", "9865", "9802", "9803", "9832"].map((k) => [k, D(k, `X ${k}`)]));
    const s = susunIsian(["9790", "9820", "9865", "9802", "9803", "9832"], katalog, { P: "Penggugat", T: "Tergugat" });
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(peta["9790"].pilihan).toHaveLength(7);
    expect(peta["9820"].pilihan).toHaveLength(6);
    expect(peta["9865"].pilihan).toHaveLength(3);
    for (const k of ["9790", "9820", "9865"]) for (const o of peta[k].pilihan) expect(o).toMatch(/^[A-G] · /);
    expect(peta["9802"].nama).toContain("Kedudukan Penggugat");
    expect(peta["9803"].nama).toContain("Kedudukan Tergugat");
  });
});

describe("G. katalog saksi hibah, wakaf, mafqud ikut panduan pertanyaan saksi", () => {
  const AKAR_EKS = path.resolve(__dirname, "../../../ekstensi-sipp");
  // Mesin dan data katalog dimuat dari disk persis seperti muatDasar() memuat versi tertanam.
  const dunia: Record<string, unknown> = {};
  for (const n of ["saksi-katalog.js", "saksi-katalog-data.js"]) {
    const modul = { exports: {} };
    new Function("module", "globalThis", "self", readFileSync(path.join(AKAR_EKS, n), "utf8"))(modul, dunia, dunia);
  }
  const mesin = dunia.AletaSaksiKatalog as { kenaliKatalog: (k: unknown[], p: Record<string, unknown>) => { kunci: string; pertanyaan: unknown[]; blangkoBas: Array<{ berkas: string }> } | null };
  const katalog = dunia.ALETA_SAKSI_KATALOG_DATA as Array<{ kunci: string; versi: number }>;

  it("jenis 366, 367 dikenali dari nama; panduan menyebut jenis lewat nomor atau nama", () => {
    expect(jenisPerkaraIdDariNama("Hibah")).toBe(366);
    expect(jenisPerkaraIdDariNama("Wakaf")).toBe(367);
  });

  it("katalog hibah, wakaf, mafqud ada di data ekstensi dan dikenali mesin menurut jenis (mafqud lewat nama, Lain-Lain biasa tetap pengangkatan anak)", () => {
    expect(katalog.map((k) => k.kunci)).toEqual(expect.arrayContaining(["hibah", "wakaf", "mafqud"]));
    expect(mesin.kenaliKatalog(katalog, { jenisPerkaraId: 366, alurPerkaraId: 15 })?.kunci).toBe("hibah");
    expect(mesin.kenaliKatalog(katalog, { jenisPerkaraId: 367, alurPerkaraId: 16 })?.kunci).toBe("wakaf");
    expect(mesin.kenaliKatalog(katalog, { jenisPerkaraId: 369, alurPerkaraId: 16, nama: "Lain-Lain mafqud" })?.kunci).toBe("mafqud");
    expect(mesin.kenaliKatalog(katalog, { jenisPerkaraId: 369, alurPerkaraId: 16, nama: "Pengangkatan Anak" })?.kunci).toBe("pengangkatan-anak");
    for (const kunci of ["hibah", "wakaf", "mafqud"]) {
      const k = mesin.kenaliKatalog(katalog, { jenisPerkaraId: kunci === "hibah" ? 366 : kunci === "wakaf" ? 367 : 369, alurPerkaraId: 16, nama: "mafqud" })!;
      expect(k.pertanyaan.length, kunci).toBeGreaterThan(10);
    }
  });

  it("BAS verstek dan permohonan ALUR 47-49 yang disebut katalog ada di pohon server", () => {
    const folderDari: Record<string, string> = { hibah: "4d Hibah - BAS", wakaf: "4e Wakaf - BAS", mafqud: "9c Penetapan Mafqud - BAS" };
    for (const [kunci, id] of [["hibah", 366], ["wakaf", 367], ["mafqud", 369]] as const) {
      const k = mesin.kenaliKatalog(katalog, { jenisPerkaraId: id, alurPerkaraId: 16, nama: "mafqud" })!;
      const khusus = k.blangkoBas.filter((b) => new RegExp(`ALUR (47|48|49) `).test(b.berkas));
      expect(khusus.length, kunci).toBeGreaterThan(0);
      for (const b of khusus) expect(FIX.berkas, b.berkas).toContain(`${A}${folderDari[kunci]}/${b.berkas.replace(/\.rtf$/, "")}.rtf`);
    }
  });

  it("panduan di portal memakai versi TERTANAM: hibah, wakaf, mafqud tersedia sesudah rilis-ekstensi menanam katalog (merah sampai ditanam)", () => {
    for (const [id, kunci, nama] of [[366, "hibah", ""], [367, "wakaf", ""], [369, "mafqud", "Lain-Lain mafqud"]] as const) {
      const p = susunPanduan({ jenisPerkaraId: id, alurPerkaraId: 16, jenisPerkara: nama });
      expect(p.tersedia, kunci).toBe(true);
      if (p.tersedia) {
        expect(p.kunci).toBe(kunci);
        expect(p.saksi.P.jumlahTanya).toBeGreaterThan(5);
      }
    }
  });
});
