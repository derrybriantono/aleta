// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL "INPUT KE ABT" HANYA PADA BLANGKO YANG MEMUAT VARIABEL CERAI
 * ============================================================================
 *
 * Tombol itu menurunkan tujuh variabel cerai dari keterangan saksi: 0222,
 * 0246, 9944, 7035, 1268, 5227, 8503. Sampai 1.167 ia tergambar di SETIAP
 * blangko - termasuk dispensasi kawin dan itsbat nikah, yang tidak memuat
 * satu pun dari ketujuhnya.
 *
 * Variabel tiap blangko di bawah BUKAN karangan: dibaca dari berkas RTF
 * blangko ABT satker (folder _blangko_abt/derry_briantono) persis seperti
 * Abt_model::show_variabel_rtf menggambar tabel variabelnya - kode #dddd#
 * sesudah baris baru dan dua penanda font dibuang. 33 blangko, tanpa isi
 * perkara apa pun.
 *
 * panel-alat.js dan abt.js dimuat SUNGGUHAN ke halaman blangko jsdom; panel
 * dibangun oleh pasang() sendiri, lalu tombolnya dibaca dari panel itu.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_PANEL_ALAT / ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan:
// cacat dipasang pada SALINAN, bukan pada berkas yang dipakai agen/uji lain.
const SUMBER_ALAT = readFileSync(process.env.ALETA_UJI_PANEL_ALAT || path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(process.env.ALETA_UJI_ABT || path.join(AKAR, "abt.js"), "utf8");

/** Ketujuh variabel cerai menurut rencana kerja - DIKETIK di sini, bukan dibaca dari abt.js. */
const VARIABEL_CERAI = ["0222", "0246", "9944", "7035", "1268", "5227", "8503"];

/** [folder, blangko, variabel yang tergambar] - dari RTF blangko satker. */
const BLANGKO: Array<[string, string, string]> = [
  ["1 Perceraian CG", "[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0139 8507 8508 8509 8510 0690 0047 9955 1006 0007 0222 5227 5127 0003 9944 7035 1267 1268 2557 2555 2558 2556 8503 4020 0661 0663 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 8526 8523 8524 8529 1242 8521 4003 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1 Perceraian CG", "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 4004 0047 1077 1069 5227 0003 7035 1268 8505 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143 0155 7095"],
  ["1 Perceraian CG", "[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 1077 4004 9955 1197 1198 1199 1200 1201 1202 1241 1011 5105 1006 0007 0222 2555 5127 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1242 0101 5227 5108 1005 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0047 0102 0098 1077 0120 4004 9955 1197 1198 1199 1200 1201 1202 1241 1006 0007 0222 5127 2555 2557 8486 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1208 2556 2558 8487 5227 1242 4001 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[01] [Kabul Verstek] Cerai (Format Lengkap)", "0001 8010 0194 7060 7047 7048 0046 0053 0017 8008 0306 5125 4001 0139 8507 8508 8509 8510 0690 0047 1214 0222 5227 0246 9944 7035 1268 8503 4020 0661 0663 0227 0132 0156 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8526 8523 8524 8529 8528 8521 8522 8530 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1 Perceraian CG", "[02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0047 0102 0098 0690 8017 0056 8012 0058 2111 9955 1197 1198 1199 1200 1201 1202 1241 1011 5105 1006 0007 0222 5127 2555 2557 8486 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1208 1242 2556 2558 8487 8438 8436 8507 0101 8523 8524 5227 4048 1005 8527 4001 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1 Perceraian CG", "[02] [Kabul] CG - F", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0047 0102 0098 8507 0690 8509 8510 7139 8017 0056 8012 0058 9881 7111 8534 2018 7112 2019 7113 2020 2111 9955 1197 1198 1199 1200 1201 1202 1241 1006 0007 0222 5127 2555 2557 8486 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1208 1242 2556 2558 8487 2112 9911 6100 6101 6102 6103 6104 6105 1251 6106 6107 6108 6109 6110 6111 1252 8438 8436 8437 8523 8524 0101 5227 4048 1011 4050 1005 8527 4001 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1 Perceraian CG", "[98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai)", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 8507 8508 8509 8510 0690 0047 8526 8523 8524 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 8507 8509 8510 0690 0047 1077 8523 8524 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban)", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0690 0047 8017 0056 8012 0058 0101 8523 8524 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[98] [Gugur] 3. Cerai P & T Tidak Hadir", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 8547 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1 Perceraian CG", "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 8507 8509 8510 0047 1077 8523 8524 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 0279 6060 6074 0312 0281 5223 0143"],
  ["1a Perceraian CT", "[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah", "0001 8010 0194 7060 7047 7048 0046 0053 0017 8008 0306 5125 4001 0139 8507 8508 8509 8510 0690 0047 1214 0222 5227 0246 9944 7035 1268 8503 4020 0661 0663 0227 0132 0156 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8526 8523 8524 8529 8528 8521 8522 8530 0100 5171 7777 6055 1006 0003 6054 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1a Perceraian CT", "[01] [Kabul Verstek] Cerai (Format Lengkap)", "0001 8010 0194 7060 7047 7048 0046 0053 0017 8008 0306 5125 4001 0139 8507 8508 8509 8510 0690 0047 1214 0222 5227 0246 9944 7035 1268 8503 4020 0661 0663 0227 0132 0156 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8526 8523 8524 8529 8528 8521 8522 8530 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["1a Perceraian CT", "[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0690 0098 0047 0102 8017 0056 8012 0058 4004 9881 7111 8534 2018 7112 2019 7113 2020 7114 2111 9955 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 2112 9911 6100 6101 6102 6103 6104 6105 1251 2023 6106 6107 6108 6109 6110 6111 1252 2024 8438 8436 8437 0101 0222 5227 0246 9944 1011 5127 7035 1005 0007 1006 0104 5271 7120 6055 6054 6071 5110 5115 2004 0100 5171 0709 5114 0711 6072 0143 0155 7095 8501 0032 0033 8184 8502 8500 0279 6060 6074 0312 0281 5223"],
  ["1a Perceraian CT", "[98] [Gugur] 3. Cerai P & T Tidak Hadir", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 8547 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1c Perceraian Kumulasi Itsbat Nikah", "[01aa] [Kabul Verstek] IN + CG - B & F", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0690 0098 0047 0102 5197 5178 1077 0120 9957 1197 1198 1199 1200 1201 1202 1241 5105 1003 1002 1046 1217 8087 0650 0651 1001 0072 1006 0007 0222 5127 2555 2557 8486 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1208 2556 2558 8487 5227 4004 1242 4001 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["1c Perceraian Kumulasi Itsbat Nikah", "[01aa] [Kabul Verstek] IN + CG - F", "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0098 0047 0102 5197 5178 1077 0120 0690 9957 1197 1198 1199 1200 1201 1202 1241 5105 1003 1002 1046 1217 8087 0650 0651 1001 0072 1006 0007 0222 5127 2555 2557 0003 7035 9944 1267 1268 1203 1204 1205 1206 1207 1208 2556 2558 5227 4004 1242 4001 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["2 Itsbat Nikah", "[01a] [Kabul] IN - Syahadah Al Istifadhah", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0690 0194 0098 1033 5197 5105 6032 0033 9958 1197 1198 1199 1200 1201 1202 1241 0228 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 0007 1358 1203 1204 1205 1206 1207 1208 1242 7777 0101 5178 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[01b] [Kabul] IN Itsbat Terpadu", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0194 1359 6032 0690 0364 0366 5197 5105 5178 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 1358 0007 7082 0033 9958 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 8185 0098 1033 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[01] [Kabul] IN", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0194 1359 6032 0690 0364 0366 5197 5105 5178 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 1358 0007 7082 0033 9958 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 8185 0098 1033 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)", "0001 8010 0048 7047 0053 0046 0017 8008 0306 5125 0690 0194 0098 1033 5197 5105 6032 0033 9958 1197 1198 1199 1200 1201 1202 1241 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 0007 1358 1203 1204 1205 1206 1207 1208 1242 0101 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[98] [Cabut] IN", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0194 0098 1033 5197 5105 4004 8433 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[98] [Gugur] IN", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0194 0098 1033 5197 5105 0690 4004 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["3 Dispensasi Kawin", "[01] [Kabul] DK - (Anak P Cewek) Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0606 0600 1666 0999 0607 5178 2030 2029 0609 6331 0601 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0600 0606 1666 0999 0601 5178 2029 2030 0609 6331 0607 0610 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 0279 6063 0281 6060 8004 0312 5223"],
  ["3 Dispensasi Kawin", "[02] [Kabul] DK - (Anak P Cewek) sudah berhubungan badan", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0606 0600 1666 0607 5178 2030 2029 0609 6331 0601 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0143 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[02] [Kabul] DK - (Anak P Cowok) sudah berhubungan badan", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0600 0606 1666 0601 5178 2029 2030 0609 6331 0607 0610 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0143 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[03] [Tolak] DK - (Anak P Cewek) Belum Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0690 0606 0600 1666 0607 5178 2030 2029 0609 6331 0601 0999 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[98] [Cabut] DK", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0606 0600 0690 8505 0155 7095 0032 0033 8184 0012 0015 6034 8500 0279 6063 0281 6060 0312 5223 0143 8004"],
  ["4 Kebendaan", "[00] [E-Court] HB Kabul", "0001 8010 0048 7047 7048 0053 0046 0017 8008 0306 5125 0690 1359 1064 8507 0047 8509 8510 0106 0156 0109 0370 0184 0197 0111 0170 0157 0173 0372 0185 0198 0112 8017 0056 8012 0058 9881 7111 8534 7112 7113 7114 0218 2111 9955 9951 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 2112 9911 9952 6100 6101 6102 6103 6104 6105 1251 2023 6106 6107 6108 6109 6110 6111 1252 2024 8438 5216 0225 0226 0219 5032 5197 0888 0889 1321 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 0242 0244 5223 0143 0155"],
  ["6 Perwalian", "Perwalian Anak oleh ortu kandung Kabul", "5368 0001 0048 7047 0046 0053 0017 8008 0306 5125 1359 0690 5114 5115 0709 0098 1025 0101 0712 6331 8131 1197 1198 1199 1200 1201 1202 1241 2025 5197 5105 0007 8513 8514 1282 1230 1203 1204 1205 1206 1207 1208 1242 8171 1069 5110 8506 2224 5178 5116 0047 2026 8515 8505 0155 7095 8501 0033 8184 8502 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["6 Perwalian", "Perwalian Anak oleh ortu kandung Tolak Primer Kabul Subsider", "5368 0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 1359 0690 5114 5115 0709 0098 1025 0101 0712 6331 8131 1197 1198 1199 1200 1201 1202 1241 2025 5197 5105 0007 8513 8514 1282 1230 8171 1203 1204 1205 1206 1207 1208 1242 1069 5110 2224 5178 0047 5116 2026 0143 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6060 6074 0312 0281 5223"],];

const halamanTerbuka: JSDOM[] = [];
afterEach(() => {
  while (halamanTerbuka.length) halamanTerbuka.pop()!.window.close();
});

/**
 * Satu halaman blangko ABT: tabel empat kolom seperti views/abt/view.php -
 * nomor variabel (td ber-id), nama, isi, dan tautan edit load_form(...).
 */
type OpsiBlangko = {
  /** Isi sel nilai per kode (baris baru menjadi <br>, seperti list_keterangan). */
  isi?: Record<string, string>;
  /** Jaringan tiruan; bawaannya portal menjawab 401. */
  fetch?: (alamat: string, o?: any) => Promise<any>;
};

function bukaBlangko(kode: string[], opsi: OpsiBlangko = {}) {
  const baris = kode
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td>` +
        `<td>${opsi.isi && k in opsi.isi ? opsi.isi[k].split("\n").join("<br>") : `isi ${k}`}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" ` +
        `onclick="load_form('${k}','10018','');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    {
      url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3",
      runScripts: "outside-only",
    }
  );
  halamanTerbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: {
      getManifest: () => ({ version: "uji" }),
      getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  // Portal menjawab 401 (belum masuk): panelnya tetap dibangun - yang diuji tombolnya.
  w.fetch = opsi.fetch || (async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "", clone() { return this; } }));
  // jsdom tidak punya innerText; cukup <br> -> baris baru, seperti peramban.
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "");
    },
  });
  // SATU skrip, seperti satu dunia terasing Chrome: eval ketat memberi tiap
  // pemanggilan lingkupnya sendiri, sehingga dua eval tidak saling melihat.
  w.eval(SUMBER_ALAT + "\n;\n" + SUMBER_ABT);
  return w;
}

async function tombolSaksi(w: any): Promise<any> {
  for (let i = 0; i < 100; i += 1) {
    const panel = w.document.getElementById("aleta-panel-abt");
    if (panel) {
      const tombol = Array.from(panel.querySelectorAll("button")).find((b: any) => b.textContent === "Input ke ABT");
      if (tombol) return tombol;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("panel blangko ABT tidak terbangun");
}

describe("tombol 'Input ke ABT' - menurut variabel blangko yang SUNGGUH tergambar", () => {
  it("fixture memuat blangko dari tiap jenis, dan tidak lebih dari 40", () => {
    expect(BLANGKO.length).toBeLessThanOrEqual(40);
    const folder = new Set(BLANGKO.map((b) => b[0]));
    for (const f of ["1 Perceraian CG", "1a Perceraian CT", "2 Itsbat Nikah", "3 Dispensasi Kawin"]) expect(folder.has(f), f).toBe(true);
  });

  for (const [folder, blangko, daftar] of BLANGKO) {
    const kode = daftar.split(" ");
    const cerai = VARIABEL_CERAI.some((v) => kode.includes(v));
    it(`${cerai ? "TAMPAK" : "tersembunyi"} - ${folder} / ${blangko}`, async () => {
      const w = bukaBlangko(kode);
      const tombol = await tombolSaksi(w);
      expect(tombol.hidden).toBe(!cerai);
    });
  }

  it("blangko cerai [01] tampak; seluruh blangko dispensasi kawin dan itsbat nikah tersembunyi", () => {
    const cerai01 = BLANGKO.filter((b) => /^\[01\] \[Kabul Verstek\] Cerai/.test(b[1]));
    expect(cerai01.length).toBeGreaterThanOrEqual(2);
    for (const b of cerai01) expect(VARIABEL_CERAI.some((v) => b[2].split(" ").includes(v)), b[1]).toBe(true);
    for (const b of BLANGKO.filter((x) => x[0] === "3 Dispensasi Kawin" || x[0] === "2 Itsbat Nikah")) {
      expect(VARIABEL_CERAI.some((v) => b[2].split(" ").includes(v)), b[1]).toBe(false);
    }
  });
});

/**
 * ============================================================================
 * "INPUT KE ABT" MEMBACA KETERANGAN SAKSI MENTAH (rencana butir 6)
 * ============================================================================
 *
 * Layar blangko menggambar keterangan lewat replace_ket_saksi, yang merusak
 * kata di tengah kalimat ('anaknya, dan' -> 'anakndan', 'saya' -> 'saksi').
 * Penyunting tanya-jawab ABT (tanyajawab_perkara_edit, ajax_data) memberikannya
 * apa adanya - dan rutenya hanya memakai c, d, dan no_var, sehingga terbaca
 * juga dari blangko yang tidak menggambar 2021/2022. Jawaban di bawah karangan
 * uji berbentuk isian saksi, tanpa nama pihak.
 */
const JAWABAN_1 = [
  { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya, saya kenal dengan Penggugat karena tetangga" },
  { urutan_pertanyaan: "2", pertanyaan: "Sebabnya?", jawaban: "Tergugat jarang pulang dan sering bertengkar soal anaknya, dan nafkah" },
];
const JAWABAN_2 = [{ urutan_pertanyaan: "1", pertanyaan: "Sejak kapan?", jawaban: "Saya melihat mereka sudah pisah rumah sejak 2023" }];
// Bentuk layar yang sama sesudah replace_ket_saksi (Abt_model::list_keterangan).
const LAYAR_1 = "-   Bahwa saksi kenal dengan Penggugat karena tetangga\n-   Bahwa Tergugat jarang pulang dan sering bertengkar soal anakndan nafkah";
const LAYAR_2 = "-   Bahwa saksi melihat mereka sudah pisah rumah sejak 2023";

function jaringanTanyaJawab(opsi: { gagal?: boolean } = {}) {
  const catatan = { tanyaJawab: [] as string[], usulan: [] as any[] };
  const r = (status: number, badan: string) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => badan,
    json: async () => JSON.parse(badan),
    clone() {
      return this;
    },
  });
  const fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (a.includes("/tanyajawab_perkara_edit?")) {
      const q = new URL(a).searchParams;
      catatan.tanyaJawab.push(`${q.get("no_var")}@${q.get("d")}`);
      if (opsi.gagal) return r(200, "<html><body>Silakan masuk</body></html>");
      const baris = q.get("d") !== "3" ? [] : q.get("no_var") === "2021" ? JAWABAN_1 : q.get("no_var") === "2022" ? JAWABAN_2 : [];
      return r(200, `<script>\n  var ajax_data = ${JSON.stringify(baris)}\n</script>`);
    }
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      // Panel juga meminta usulan SIPP saat dibangun - yang diuji hanya
      // permintaan dari tombol "Input ke ABT".
      if (muatan.sumber === "saksi") catatan.usulan.push(muatan);
      const n = (t: string) => (String(t || "").match(/^-\s*Bahwa/gim) || []).length;
      const saksi = { butir: { saksi1: n(muatan.saksi1), saksi2: n(muatan.saksi2) }, usulan: [], selisih: [], huruf: [], hurufBelumSiap: [] };
      return r(200, JSON.stringify({ data: { available: true, saksi } }));
    }
    return r(401, "{}");
  };
  return { catatan, fetch };
}

async function tekanDanTunggu(w: any, tombol: any, tanda: RegExp): Promise<string> {
  tombol.click();
  for (let i = 0; i < 300; i += 1) {
    const teks = Array.from(w.document.querySelectorAll("#aleta-panel-abt .aleta-abt-kabar"))
      .map((x: any) => String(x.textContent || ""))
      .find((t) => tanda.test(t));
    if (teks) return teks;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("kabar tombol 'Input ke ABT' tidak muncul");
}

describe("'Input ke ABT' membaca keterangan saksi MENTAH dari penyunting tanya-jawab ABT", () => {
  const TANPA_2021 = BLANGKO.find((b) => b[1].startsWith("[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan"))!;
  const DENGAN_2021 = BLANGKO.find((b) => b[0] === "1 Perceraian CG" && b[1] === "[01] [Kabul Verstek] Cerai (Format Lengkap)")!;

  it("blangko cerai tanpa 2021/2022: keterangan tetap terbaca - dahulu 'masih kosong di halaman ini'", async () => {
    const kode = TANPA_2021[2].split(" ");
    expect(kode.includes("2021") || kode.includes("2022")).toBe(false);
    const jaringan = jaringanTanyaJawab();
    const w = bukaBlangko(kode, { fetch: jaringan.fetch });
    const kabar = await tekanDanTunggu(w, await tombolSaksi(w), /Terbaca|terbaca|kosong/);
    expect(kabar).toBe("Terbaca 2 butir dari saksi 1 dan 1 dari saksi 2.");
    expect(jaringan.catatan.tanyaJawab).toEqual(["2021@3", "2022@3"]);
    expect(jaringan.catatan.usulan).toHaveLength(1);
    expect(jaringan.catatan.usulan[0].saksi1).toBe(
      "- Bahwa ya, saya kenal dengan Penggugat karena tetangga\n- Bahwa tergugat jarang pulang dan sering bertengkar soal anaknya, dan nafkah"
    );
    expect(jaringan.catatan.usulan[0].saksi2).toBe("- Bahwa saya melihat mereka sudah pisah rumah sejak 2023");
  });

  it("blangko dengan 2021/2022: yang dikirim teks mentah, bukan teks layar yang dirusak replace_ket_saksi", async () => {
    const jaringan = jaringanTanyaJawab();
    const w = bukaBlangko(DENGAN_2021[2].split(" "), { fetch: jaringan.fetch, isi: { "2021": LAYAR_1, "2022": LAYAR_2 } });
    await tekanDanTunggu(w, await tombolSaksi(w), /Terbaca|terbaca|kosong/);
    const muatan = jaringan.catatan.usulan[0];
    expect(muatan.saksi1).toContain("anaknya, dan nafkah");
    expect(muatan.saksi1).not.toContain("anakndan");
    expect(muatan.saksi2).toBe("- Bahwa saya melihat mereka sudah pisah rumah sejak 2023");
  });

  it("bacaan mentah gagal: teks layar dipakai, dan hal itu DISEBUT - bukan ditelan", async () => {
    const jaringan = jaringanTanyaJawab({ gagal: true });
    const w = bukaBlangko(DENGAN_2021[2].split(" "), { fetch: jaringan.fetch, isi: { "2021": LAYAR_1, "2022": LAYAR_2 } });
    const kabar = await tekanDanTunggu(w, await tombolSaksi(w), /Terbaca|terbaca|kosong/);
    expect(jaringan.catatan.usulan[0].saksi1).toBe(LAYAR_1);
    expect(kabar).toContain("saksi 1 dibaca dari layar - bacaan mentah gagal: daftar tanya-jawab tidak terbaca dari halaman ABT");
  });

  it("2021/2022 tergambar KOSONG: tidak ada yang ditanyakan ke ABT, dan kabarnya tetap 'masih kosong'", async () => {
    const jaringan = jaringanTanyaJawab();
    const w = bukaBlangko(DENGAN_2021[2].split(" "), { fetch: jaringan.fetch, isi: { "2021": "", "2022": "" } });
    const kabar = await tekanDanTunggu(w, await tombolSaksi(w), /Terbaca|terbaca|kosong/);
    expect(kabar).toBe("Keterangan saksi 1 dan saksi 2 masih kosong di halaman ini.");
    expect(jaringan.catatan.tanyaJawab).toHaveLength(0);
    expect(jaringan.catatan.usulan).toHaveLength(0);
  });
});

/**
 * ============================================================================
 * USULAN YANG BOT RAGUKAN TIDAK TERCENTANG SENDIRI
 * ============================================================================
 *
 * Bot menandai usulan yang ia sendiri ragukan dengan keyakinan "ragu" - 0222
 * dari dalil posita yang belum dikuatkan saksi, 1268 bila saksi berkata belum
 * pernah ada upaya damai - dan huruf alasan blangko [01] dengan
 * centangOtomatis: false (keputusan 11). Panel dahulu mencentang SETIAP usulan
 * bernilai yang tidak bentrok dan hanya membaca syarat pada huruf, sehingga
 * yang ragu masuk ke blangko dengan satu tekanan "Terapkan yang dicentang"
 * tanpa pernah dipilih petugas - dan lencananya berbunyi "tidak ditemukan"
 * di samping nilai yang jelas ada.
 *
 * Jawaban bot di bawah karangan uji dalam bentuk jawaban /abt/usulan, tanpa
 * nama pihak.
 */
const SAKSI_BERAGAM = {
  butir: { saksi1: 2, saksi2: 1 },
  usulan: [
    {
      kode: "0222",
      nama: "Sejak kapan tidak rukun",
      nilai: "sejak bulan Mei 2020",
      keyakinan: "ragu",
      catatan: "Kedua saksi tidak menyebut kapan perselisihan mulai; diambil dari posita - dalil yang belum dikuatkan saksi.",
      sumber: [{ saksi: 0, asal: "posita", kalimat: "Bahwa sejak bulan Mei 2020 rumah tangga mulai goyah" }],
    },
    {
      kode: "0246",
      nama: "Sejak kapan pisah",
      nilai: "sejak tahun 2023",
      keyakinan: "pasti",
      sumber: [{ saksi: 1, kalimat: "sudah pisah rumah sejak 2023" }, { saksi: 2, kalimat: "pisah rumah sejak 2023" }],
    },
    { kode: "9944", nama: "Lama pisah", nilai: "2 tahun", keyakinan: "cukup", sumber: [{ saksi: 2, kalimat: "sudah 2 tahun" }] },
    { kode: "7035", nama: "Yang meninggalkan", nilai: "Tergugat", keyakinan: "bentrok", bentrok: "Penggugat", sumber: [] },
    {
      kode: "1268",
      nama: "Upaya damai",
      nilai: "",
      keyakinan: "ragu",
      catatan: "Saksi 1 menerangkan belum/tidak pernah ada upaya damai.",
      sumber: [],
    },
  ],
  selisih: [],
  huruf: [
    // Jalur blangko [01]: bot menandainya tidak boleh dicentang sendiri.
    { huruf: "F", dasar: [], pemicu: ["bertengkar"], syarat: "", centangOtomatis: false },
    // Jalur lama tanpa penanda dan tanpa syarat: perilakunya tidak berubah.
    { huruf: "A", dasar: [], pemicu: ["judi"], syarat: "" },
  ],
  hurufBelumSiap: [],
};

function jaringanUsulanSaksi() {
  const dasar = jaringanTanyaJawab();
  const fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan") && JSON.parse(String(o.body || "{}")).sumber === "saksi") {
      const badan = JSON.stringify({ data: { available: true, saksi: SAKSI_BERAGAM } });
      return { ok: true, status: 200, text: async () => badan, json: async () => JSON.parse(badan), clone() { return this; } };
    }
    return dasar.fetch(alamat, o);
  };
  return { fetch };
}

describe("usulan yang bot ragukan tidak tercentang sendiri", () => {
  const DENGAN_2021 = BLANGKO.find((b) => b[0] === "1 Perceraian CG" && b[1] === "[01] [Kabul Verstek] Cerai (Format Lengkap)")!;

  async function bukaDanMinta() {
    const w = bukaBlangko(DENGAN_2021[2].split(" "), {
      fetch: jaringanUsulanSaksi().fetch,
      isi: { "2021": LAYAR_1, "2022": LAYAR_2 },
    });
    await tekanDanTunggu(w, await tombolSaksi(w), /Terbaca|terbaca|kosong/);
    const kartu: Record<string, { dicentang: boolean; mati: boolean; lencana: string }> = {};
    for (const k of Array.from(w.document.querySelectorAll("#aleta-panel-abt .aleta-abt-kartu")) as any[]) {
      const kode = k.querySelector(".aleta-abt-kode");
      if (!kode) continue;
      const centang = k.querySelector(".aleta-abt-centang");
      kartu[kode.textContent] = {
        dicentang: centang.checked,
        mati: centang.disabled,
        lencana: String(k.querySelector(".aleta-tanda")?.textContent || ""),
      };
    }
    const huruf: Record<string, boolean> = {};
    for (const b of Array.from(w.document.querySelectorAll("#aleta-panel-abt .aleta-abt-huruf")) as any[]) {
      huruf[b.querySelector(".aleta-abt-huruf-nama").textContent] = b.querySelector(".aleta-abt-centang").checked;
    }
    return { kartu, huruf };
  }

  it("0222 dari posita (ragu) bernilai tetapi TIDAK dicentang, dan lencananya menyebut ragu", async () => {
    const { kartu } = await bukaDanMinta();
    expect(kartu["0222"]).toEqual({ dicentang: false, mati: false, lencana: "ragu — periksa dulu" });
  });

  it("pasti dan cukup tetap dicentang sendiri; bentrok tidak; ragu tanpa nilai tidak dapat dicentang", async () => {
    const { kartu } = await bukaDanMinta();
    expect(kartu["0246"].dicentang).toBe(true);
    expect(kartu["9944"].dicentang).toBe(true);
    expect(kartu["7035"].dicentang).toBe(false);
    expect(kartu["1268"]).toMatchObject({ dicentang: false, mati: true });
  });

  it("huruf bertanda centangOtomatis: false tidak dicentang; huruf lama tanpa penanda tetap seperti dahulu", async () => {
    const { huruf } = await bukaDanMinta();
    expect(huruf).toEqual({ "Huruf F": false, "Huruf A": true });
  });
});
