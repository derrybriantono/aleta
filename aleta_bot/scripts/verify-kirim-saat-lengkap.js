#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * KIRIM SAAT DATA LENGKAP, DAN SAKLAR PER PESAN
 * ============================================================================
 *
 *   node scripts/verify-kirim-saat-lengkap.js
 *
 * Yang dijaga di sini, dan tiap-tiapnya berakibat pada orang bila keliru:
 *
 *   1. BAWAAN MATI. Fitur ini MEMULAI pengiriman ke nomor orang. Konfigurasi
 *      yang tidak menyebutnya harus dibaca mati - kebalikan dari saklar
 *      pegawai/pihak yang hanya menyaring jalur yang sudah ada.
 *
 *   2. LENGKAP BERARTI LENGKAP. Perkara tanpa PHS atau tanpa jadwal sidang
 *      pertama tidak boleh lolos; untuk pegawai, tanpa PPP atau PJS pun tidak.
 *
 *   3. SAKLAR PER PESAN MENGENAI SASARAN. Mematikan satu kunci untuk pihak
 *      tidak boleh ikut mematikannya untuk pegawai, dan sebaliknya - dan
 *      gerbangnya harus benar-benar terpasang di messageService.
 *
 *   4. NAMA PETUGAS COCOK TANPA GELAR. "Drs. H. ABDUL SALAM, M.H." di SIPP
 *      dan "ABDUL SALAM, S.HI. MH." di portal adalah orang yang sama.
 *
 * Tanpa database, tanpa WhatsApp. Yang diuji fungsi murninya.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Berkas konfigurasi sementara di D: - bukan di C:. Ditulis sebelum modul
// konfigurasi dimuat, karena jalurnya dibaca saat modul dimuat.
const folderSementara = fs.existsSync("D:/Aplikasi/aleta/tmp") ? "D:/Aplikasi/aleta/tmp" : os.tmpdir();
const berkasKonfig = path.join(folderSementara, `aleta-runtime-uji-lengkap-${process.pid}.json`);
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = berkasKonfig;

const runtimeConfigModule = require("../config/runtime-config");
const layanan = require("../services/kelengkapanDataService");

let lulus = 0;
let gagal = 0;

function periksa(label, aktual, harapan) {
  const sama = JSON.stringify(aktual) === JSON.stringify(harapan);
  if (sama) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}\n        harapan=${JSON.stringify(harapan)} aktual=${JSON.stringify(aktual)}`);
  }
}

function tulisKonfig(isi) {
  fs.writeFileSync(berkasKonfig, JSON.stringify({ version: 1, ...isi }, null, 2), "utf8");
}

console.log("\n== Bawaan mati, dan angka dijepit ==");
{
  const rapi = runtimeConfigModule.normalizeKirimSaatLengkap(undefined);
  periksa("tanpa setelan: fitur MATI", rapi.enabled, false);
  periksa("tanpa setelan: saluran pegawai menyala", rapi.pegawai, true);
  periksa("tanpa setelan: saluran pihak menyala", rapi.pihak, true);
  periksa("tanpa setelan: jendela 14 hari", rapi.jendelaHari, 14);
  periksa("tanpa setelan: jarak 15 menit", rapi.intervalMenit, 15);

  const liar = runtimeConfigModule.normalizeKirimSaatLengkap({ enabled: "ya", jendelaHari: 900, intervalMenit: 1 });
  periksa("'ya' bukan menyala - hanya true", liar.enabled, false);
  periksa("jendela dijepit ke 90 hari", liar.jendelaHari, 90);
  periksa("jarak dijepit ke 5 menit", liar.intervalMenit, 5);

  const nyala = runtimeConfigModule.normalizeKirimSaatLengkap({ enabled: true, pihak: false });
  periksa("enabled: true terbaca menyala", nyala.enabled, true);
  periksa("pihak: false terbaca mati", nyala.pihak, false);
}

console.log("\n== Konfigurasi dibaca dari berkas ==");
{
  tulisKonfig({
    kirimSaatLengkap: { enabled: true, jendelaHari: 7 },
    pesanNonaktif: { pihak: ["pihak-sisa-panjar", "pihak-sisa-panjar", " "], pegawai: [] },
  });
  const konfig = runtimeConfigModule.readRuntimeConfig();
  periksa("kirimSaatLengkap.enabled dari berkas", konfig.kirimSaatLengkap.enabled, true);
  periksa("jendelaHari dari berkas", konfig.kirimSaatLengkap.jendelaHari, 7);
  periksa("intervalMenit kembali ke bawaan", konfig.kirimSaatLengkap.intervalMenit, 15);
  periksa("pesanNonaktif.pihak tanpa kembar dan tanpa kosong", konfig.pesanNonaktif.pihak, ["pihak-sisa-panjar"]);
  periksa("pesanNonaktif.pegawai kosong", konfig.pesanNonaktif.pegawai, []);

  tulisKonfig({});
  const polos = runtimeConfigModule.readRuntimeConfig();
  periksa("berkas lama tanpa kunci: fitur mati", polos.kirimSaatLengkap.enabled, false);
  periksa("berkas lama tanpa kunci: tidak ada pesan dimatikan", polos.pesanNonaktif, { pegawai: [], pihak: [] });
}

console.log("\n== Saklar per pesan mengenai sasaran ==");
{
  const konfig = { pesanNonaktif: { pihak: ["pihak-sisa-panjar"], pegawai: ["pegawai-kasir-harian"] } };
  const mati = runtimeConfigModule.pesanDimatikan;
  periksa("sisa panjar ke PIHAK tertahan", mati(konfig, "pihak-sisa-panjar", false), true);
  periksa("sisa panjar ke PEGAWAI tetap lolos", mati(konfig, "pihak-sisa-panjar", true), false);
  periksa("kasir ke PEGAWAI tertahan", mati(konfig, "pegawai-kasir-harian", true), true);
  periksa("kasir ke PIHAK tetap lolos", mati(konfig, "pegawai-kasir-harian", false), false);
  periksa("kunci lain lolos", mati(konfig, "pihak-hari-sidang", false), false);
  periksa("kunci kosong lolos", mati(konfig, "", false), false);
  periksa("konfigurasi tanpa daftar lolos", mati({}, "pihak-sisa-panjar", false), false);
}

console.log("\n== Gerbangnya benar-benar terpasang di messageService ==");
{
  const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "messageService.js"), "utf8");
  periksa("mengimpor pesanDimatikan", /pesanDimatikan/.test(sumber), true);
  periksa("menahan pesan pegawai", /pesan_pegawai_dimatikan/.test(sumber), true);
  periksa("menahan pesan pihak", /pesan_pihak_dimatikan/.test(sumber), true);
  // Dipasang SESUDAH saluran ditentukan (kePegawai), di dalam blok notifikasi.
  const posisiSaluran = sumber.indexOf("const kePegawai = adalahPenerimaPegawai(");
  const posisiSaklar = sumber.indexOf("pesanDimatikan(runtimeConfig, notificationKey, kePegawai)");
  periksa("saklar per pesan dipasang setelah saluran diketahui", posisiSaluran > 0 && posisiSaklar > posisiSaluran, true);
}

console.log("\n== Lengkap berarti lengkap ==");
{
  const dasar = { pmh: "2026-09-01", ppp: "2026-09-01", pjs: "2026-09-01", phs: "2026-09-01", tanggalSidang: "2026-09-15" };
  periksa("lengkap untuk pihak", layanan.perkaraLengkap(dasar, "pihak"), true);
  periksa("lengkap untuk pegawai", layanan.perkaraLengkap(dasar, "pegawai"), true);
  periksa("tanpa PHS: pihak tidak lengkap", layanan.perkaraLengkap({ ...dasar, phs: null }, "pihak"), false);
  periksa("tanpa jadwal sidang: pihak tidak lengkap", layanan.perkaraLengkap({ ...dasar, tanggalSidang: null }, "pihak"), false);
  periksa("tanpa PMH: pihak tidak lengkap", layanan.perkaraLengkap({ ...dasar, pmh: "" }, "pihak"), false);
  periksa("tanpa PPP: pihak masih lengkap", layanan.perkaraLengkap({ ...dasar, ppp: null }, "pihak"), true);
  periksa("tanpa PPP: pegawai TIDAK lengkap", layanan.perkaraLengkap({ ...dasar, ppp: null }, "pegawai"), false);
  periksa("tanpa PJS: pegawai TIDAK lengkap", layanan.perkaraLengkap({ ...dasar, pjs: null }, "pegawai"), false);
  periksa("perkara kosong tidak lengkap", layanan.perkaraLengkap(null, "pihak"), false);
}

console.log("\n== Penjaga berlapis, dan alasan yang disebut tepat ==");
{
  const pihak = layanan.DEFINISI.find((d) => d.saluran === "pihak");
  const pegawai = layanan.DEFINISI.find((d) => d.saluran === "pegawai");
  const nyala = { botEnabled: true, notificationsEnabled: true, kirimSaatLengkap: { enabled: true, pegawai: true, pihak: true } };

  periksa("semua menyala: pihak boleh", layanan.bolehJalan(nyala, pihak), { boleh: true, alasan: "" });
  periksa("semua menyala: pegawai boleh", layanan.bolehJalan(nyala, pegawai), { boleh: true, alasan: "" });
  periksa("fitur mati", layanan.bolehJalan({ ...nyala, kirimSaatLengkap: { enabled: false } }, pihak).alasan, "fitur_kirim_saat_lengkap_dimatikan");
  periksa("bot mati didahulukan", layanan.bolehJalan({ ...nyala, botEnabled: false }, pihak).alasan, "bot_dimatikan");
  periksa("notifikasi mati", layanan.bolehJalan({ ...nyala, notificationsEnabled: false }, pihak).alasan, "notifikasi_dimatikan");
  periksa("saluran pihak fitur mati: pihak tertahan", layanan.bolehJalan({ ...nyala, kirimSaatLengkap: { enabled: true, pihak: false } }, pihak).alasan, "fitur_saluran_pihak_dimatikan");
  periksa("saluran pihak fitur mati: PEGAWAI TETAP BOLEH", layanan.bolehJalan({ ...nyala, kirimSaatLengkap: { enabled: true, pihak: false } }, pegawai).boleh, true);
  periksa("saklar pegawai bot mati: pegawai tertahan", layanan.bolehJalan({ ...nyala, kirimPegawaiEnabled: false }, pegawai).alasan, "pengiriman_pegawai_dimatikan");
  periksa("saklar pegawai bot mati: PIHAK TETAP BOLEH", layanan.bolehJalan({ ...nyala, kirimPegawaiEnabled: false }, pihak).boleh, true);
  periksa("saklar per pesan: pihak-baru-lengkap dimatikan", layanan.bolehJalan({ ...nyala, pesanNonaktif: { pihak: ["pihak-baru-lengkap"] } }, pihak).alasan, "pesan_pihak_dimatikan");
  periksa("saklar per pesan pihak tidak menyentuh pegawai", layanan.bolehJalan({ ...nyala, pesanNonaktif: { pihak: ["pegawai-penugasan-lengkap"] } }, pegawai).boleh, true);
}

console.log("\n== Nama petugas cocok tanpa gelar ==");
{
  const kunci = layanan.namaKunci;
  periksa("gelar depan dan belakang dibuang", kunci("Drs. H. ABDUL SALAM, M.H."), "abdul salam");
  periksa("gelar portal dibuang", kunci("ABDUL SALAM, S.HI. MH."), "abdul salam");
  periksa("nama polos tetap", kunci("Derry Briantono"), "derry briantono");
  periksa("html dibuang", kunci("AKBAR ALI, S.H.I.<br />"), "akbar ali");
  periksa("kosong tetap kosong", kunci(""), "");

  const pegawai = [
    { id: "u1", name: "ABDUL SALAM, S.HI. MH.", whatsappNumber: "628123450001" },
    { id: "u2", name: "DERRY BRIANTONO, S.H.", whatsappNumber: "628123450002" },
    { id: "u3", name: "SRI SUSILOWATI", whatsappNumber: "628123450003" },
    { id: "u4", name: "Tanpa Nomor", whatsappNumber: "" },
  ];
  periksa("SIPP bergelar cocok dengan portal bergelar lain", layanan.cocokkanPegawai("Drs. H. ABDUL SALAM, M.H.", pegawai)?.id, "u1");
  periksa("nama pendek SIPP cocok", layanan.cocokkanPegawai("Derry Briantono", pegawai)?.id, "u2");
  periksa("nama yang tidak ada: null", layanan.cocokkanPegawai("Orang Lain Sekali", pegawai), null);
  periksa("pegawai tanpa nomor tidak pernah cocok", layanan.cocokkanPegawai("Tanpa Nomor", pegawai), null);
  periksa("nama pendek (< 8 huruf) tidak dicocokkan sebagian", layanan.cocokkanPegawai("Salam", pegawai), null);
  periksa("nama panjang memuat nama pokok cocok sebagian", layanan.cocokkanPegawai("Muhammad Abdul Salam", pegawai)?.id, "u1");
}

console.log("\n== Sebutan dan penulisan waktu ==");
{
  periksa("pihak ke-1 gugatan: Penggugat", layanan.sebutanPihak(1, "pihak", "Cerai Gugat"), "Penggugat");
  periksa("pihak ke-2 gugatan: Tergugat", layanan.sebutanPihak(2, "pihak", "Cerai Gugat"), "Tergugat");
  periksa("pihak ke-1 permohonan: Pemohon", layanan.sebutanPihak(1, "pihak", "Itsbat Nikah"), "Pemohon");
  periksa("pihak ke-2 permohonan: Termohon", layanan.sebutanPihak(2, "pihak", "Dispensasi Kawin"), "Termohon");
  periksa("kuasa disebut kuasa", layanan.sebutanPihak(1, "kuasa", "Cerai Talak"), "Kuasa Penggugat");
  periksa("hakim urutan 1: Ketua Majelis", layanan.sebutanPetugas("hakim", 1), "Ketua Majelis");
  periksa("hakim urutan 2: Hakim Anggota", layanan.sebutanPetugas("hakim", 2), "Hakim Anggota");
  periksa("panitera", layanan.sebutanPetugas("panitera", 0), "Panitera Pengganti");
  periksa("jurusita", layanan.sebutanPetugas("jurusita", 0), "Juru Sita");
  periksa("jam 09:00:00 ditulis 09.00", layanan.tulisJam("09:00:00"), "09.00");
  periksa("jam 9:30 ditulis 09.30", layanan.tulisJam("9:30"), "09.30");
  periksa("jam kosong ditulis -", layanan.tulisJam(""), "-");
  periksa("tanggal panjang berbahasa Indonesia", /^[A-Z][a-z]+, \d{1,2} [A-Z][a-z]+ 2026$/.test(layanan.tulisTanggalPanjang("2026-09-15T00:00:00Z")), true);
}

console.log("\n== Isi pesan ==");
{
  const perkara = {
    perkaraId: 10,
    nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    tanggalDaftar: "2026-09-01",
    paraPihak: "SITI<br />melawan<br />BUDI",
    majelisNama: "ABDUL SALAM",
    paniteraText: "SRI",
    jurusitaText: "FAHRI",
    tanggalSidang: "2026-09-15",
    jamSidang: "09:00:00",
    ruangan: "Ruang Sidang I",
    agenda: "Sidang Pertama",
  };
  const konfig = { institutionIdentity: { courtName: "Pengadilan Agama Donggala", csWhatsappNumber: "0822-7111-5021" } };
  const pesanPihak = layanan.susunPesanPihak(perkara, { nama: "SITI", pihakKe: 1, jenis: "pihak" }, konfig);
  periksa("pesan pihak menyebut nomor perkara", pesanPihak.includes("123/Pdt.G/2026/PA.Dgl"), true);
  periksa("pesan pihak menyebut kedudukan", pesanPihak.includes("Kedudukan Anda: Penggugat"), true);
  periksa("pesan pihak menyebut jam WITA", pesanPihak.includes("09.00 WITA"), true);
  periksa("pesan pihak menyebut nama pengadilan", pesanPihak.includes("Pengadilan Agama Donggala"), true);
  periksa("pesan pihak memuat para pihak per baris", pesanPihak.includes("SITI\nmelawan\nBUDI"), true);
  periksa("pesan pihak menyebut kontak", pesanPihak.includes("0822-7111-5021"), true);
  periksa("pesan pihak tidak memuat html", /<br/.test(pesanPihak), false);

  const pesanPegawai = layanan.susunPesanPegawai(perkara, { peran: "hakim", urutan: 1, nama: "ABDUL SALAM", namaPortal: "ABDUL SALAM, S.HI. MH." }, konfig);
  periksa("pesan pegawai menyebut peran", pesanPegawai.includes("*Ketua Majelis*"), true);
  periksa("pesan pegawai memakai nama portal", pesanPegawai.startsWith("Yth. ABDUL SALAM, S.HI. MH.,"), true);
  periksa("pesan pegawai menyebut juru sita", pesanPegawai.includes("Juru Sita: FAHRI"), true);

  const kunci = layanan.kunciIdempoten(layanan.DEFINISI[0], perkara, "pihak-77");
  periksa("kunci idempoten per definisi, perkara, penerima", kunci, "lengkap:pihak-baru-lengkap:10:pihak-77");
}

console.log("\n== Katalog di portal menyebut kunci yang sama ==");
{
  const katalog = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "manajemen_surat", "src", "lib", "katalog-pesan-bot.ts"),
    "utf8"
  );
  for (const definisi of layanan.DEFINISI) {
    periksa(`portal mengenal kunci ${definisi.key}`, katalog.includes(`key: "${definisi.key}"`), true);
  }
}

try {
  fs.unlinkSync(berkasKonfig);
} catch {
  // berkas sementara; bila gagal dihapus tidak mengubah hasil
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
