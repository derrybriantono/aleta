"use strict";

/**
 * Penjadwal penarikan berkas e-Court.
 *
 * ============================================================================
 * KENDALANYA BUKAN TEKNIS, MELAINKAN CAPTCHA
 * ============================================================================
 *
 * e-Court menuntut captcha saat login. Sesi yang sudah dibuat dapat bertahan,
 * tetapi tetap punya masa berlaku dan akan habis sendiri. Tidak ada cara bagi
 * program menghidupkannya kembali - dan itu memang seharusnya begitu.
 *
 * Karena itu penjadwal ini berhenti ketika sesinya mati, bukan mencoba terus.
 * Mencoba berulang kali dengan sesi mati ke sistem Mahkamah Agung persis
 * perilaku yang membuat akun ditandai, dan tidak akan pernah berhasil.
 *
 * ============================================================================
 * MEMANGGIL JEMBATAN, BUKAN MENIRUNYA
 * ============================================================================
 *
 * Penjadwal menjalankan tools/ecourt-bridge/run.js sebagai proses terpisah,
 * bukan menyalin ulang alurnya. Menyalin alur berarti punya dua jalur yang
 * dapat berbeda perilaku - dan yang dijalankan terjadwal justru yang paling
 * jarang diperhatikan orang.
 *
 * Kode keluarnya dibaca untuk membedakan sebab: 0 selesai, 1 gagal, 2 sesi
 * habis. Ketiganya menuntut tindakan berbeda.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
const ecourtPermintaanService = require("./ecourtPermintaanService");
const ecourtAkunService = require("./ecourtAkunService");
const ecourtAuditArsipService = require("./ecourtAuditArsipService");
const ecourtDocumentService = require("./ecourtDocumentService");

/** Nilai bawaan bila belum pernah diatur. */
const BAWAAN = {
  aktif: false,
  jarakJam: 2,
  jamMulai: 7,
  jamSelesai: 17,
  maksPerkara: 25,
};

/** Keadaan dalam memori. Tidak perlu bertahan antar penyalaan ulang. */
const keadaan = {
  timer: null,
  sedangJalan: false,
  terakhirMulai: null,
  terakhirSelesai: null,
  terakhirKode: null,
  terakhirCatatan: "",
  jumlahPutaran: 0,
  // Keterangan putaran yang SEDANG berjalan - dipakai layar pemantauan.
  sumber: "",
  berkasLog: "",
  perkaraDiminta: "",
  akun: "",
  anak: null,
  // Butir 8 (1.189.x): kemajuan nyata putaran yang sedang berjalan (dari
  // baris @@ALETA-KEMAJUAN jembatan) - { tahap, label, persen, i, n, teks }.
  kemajuan: null,
};

/**
 * Folder log, dibagi dengan host lewat pemasangan volume.
 *
 * /var/www/html/aleta-data/reports pada host terpasang ke sini. Log yang
 * ditulis penarikan dari portal masuk ke folder yang SAMA dengan log skrip
 * aleta-ecourt-unduh-latar.sh, memakai pola nama yang sama pula - sehingga
 * layar pemantauan menampilkan keduanya, dan penarikan yang dimulai dari
 * PuTTY tidak menjadi tidak terlihat begitu ada tombol di portal.
 */
const FOLDER_LOG = path.resolve(__dirname, "..", "reports");

/**
 * Berkas kunci berdetak, dibaca juga oleh skrip host.
 *
 * PID tidak dapat dipakai lintas container - nomor proses di dalam container
 * tidak berarti apa-apa di host. Karena itu kuncinya berisi waktu detak
 * terakhir: kunci yang detaknya basi berarti prosesnya sudah mati, sekalipun
 * berkasnya tertinggal karena bot berhenti mendadak.
 */
const BERKAS_KUNCI = path.join(FOLDER_LOG, "ecourt-unduh-aleta.lock");
const DETAK_MS = 30 * 1000;
const KUNCI_BASI_MS = 3 * 60 * 1000;

let detakKunci = null;

function tulisKunci(keterangan) {
  try {
    fs.mkdirSync(FOLDER_LOG, { recursive: true });
    fs.writeFileSync(
      BERKAS_KUNCI,
      JSON.stringify({ ...keterangan, detak: new Date().toISOString() }),
      "utf8"
    );
  } catch {
    // Kunci adalah lapisan tambahan, bukan penjagaan utama. Gagal menulisnya
    // tidak boleh menggagalkan penarikan - keadaan.sedangJalan tetap menjaga
    // putaran ganda dari dalam bot.
  }
}

function hapusKunci() {
  if (detakKunci) {
    clearInterval(detakKunci);
    detakKunci = null;
  }
  try {
    fs.unlinkSync(BERKAS_KUNCI);
  } catch {
    // Sudah tidak ada - tidak ada yang perlu dikerjakan.
  }
}

/** Apakah ada penarikan LAIN yang masih hidup menurut berkas kunci? */
function kunciMasihHidup() {
  try {
    const isi = JSON.parse(fs.readFileSync(BERKAS_KUNCI, "utf8"));
    const detak = Date.parse(isi && isi.detak);
    if (!Number.isFinite(detak)) return false;
    return Date.now() - detak < KUNCI_BASI_MS;
  } catch {
    return false;
  }
}

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(maks, Math.floor(n)));
}

/** Pengaturan penjadwal yang berlaku sekarang. */
function getSettings(runtimeConfig = readRuntimeConfig()) {
  const p = runtimeConfig.ecourtJadwal || {};
  return {
    aktif: p.aktif === true,
    jarakJam: angka(p.jarakJam, BAWAAN.jarakJam, 1, 24),
    jamMulai: angka(p.jamMulai, BAWAAN.jamMulai, 0, 23),
    jamSelesai: angka(p.jamSelesai, BAWAAN.jamSelesai, 1, 24),
    maksPerkara: angka(p.maksPerkara, BAWAAN.maksPerkara, 1, 200),
  };
}

/**
 * Menyimpan pengaturan penjadwal.
 *
 * Nilai di luar akal ditolak, bukan dipaksa masuk. Jarak satu jam sekali ke
 * sistem Mahkamah Agung sudah cukup sering; lebih rapat dari itu menambah
 * beban tanpa menambah manfaat, karena dokumen e-Litigasi tidak masuk tiap
 * menit.
 */
function saveSettings({ aktif, jarakJam, jamMulai, jamSelesai, maksPerkara, olehSiapa = "" } = {}) {
  const jarak = Number(jarakJam);
  const mulai = Number(jamMulai);
  const selesai = Number(jamSelesai);
  const maks = Number(maksPerkara);

  if (!Number.isFinite(jarak) || jarak < 1 || jarak > 24) {
    return { ok: false, alasan: "jarak_jam_di_luar_1_sampai_24" };
  }
  if (!Number.isFinite(mulai) || mulai < 0 || mulai > 23) {
    return { ok: false, alasan: "jam_mulai_di_luar_0_sampai_23" };
  }
  if (!Number.isFinite(selesai) || selesai < 1 || selesai > 24) {
    return { ok: false, alasan: "jam_selesai_di_luar_1_sampai_24" };
  }
  if (selesai <= mulai) {
    return { ok: false, alasan: "jam_selesai_harus_setelah_jam_mulai" };
  }
  if (!Number.isFinite(maks) || maks < 1 || maks > 200) {
    return { ok: false, alasan: "maks_perkara_di_luar_1_sampai_200" };
  }

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({
    ...sekarang,
    ecourtJadwal: {
      aktif: aktif === true,
      jarakJam: Math.floor(jarak),
      jamMulai: Math.floor(mulai),
      jamSelesai: Math.floor(selesai),
      maksPerkara: Math.floor(maks),
    },
  });

  void logService.logSecurityEvent({
    eventType: "ecourt_jadwal_disunting",
    severity: "warning",
    message: aktif === true ? "Penjadwal e-Court dinyalakan." : "Penjadwal e-Court dimatikan.",
    metadata: { aktif: aktif === true, jarakJam: Math.floor(jarak), olehSiapa: String(olehSiapa || "") },
  });

  // Perubahan berlaku pada putaran berikutnya tanpa menyalakan ulang bot.
  mulaiUlang();
  return { ok: true, alasan: "" };
}

/** Apakah sekarang di dalam jam kerja yang diatur? */
function dalamJamKerja(sekarang = new Date(), pengaturan = getSettings()) {
  const jam = sekarang.getHours();
  const hari = sekarang.getDay(); // 0 Minggu, 6 Sabtu

  // Akhir pekan dilewati: pihak dan kuasa hukum mengunggah pada hari kerja,
  // dan menarik di akhir pekan hanya membebani server pengadilan.
  if (hari === 0 || hari === 6) return false;
  return jam >= pengaturan.jamMulai && jam < pengaturan.jamSelesai;
}

/**
 * Menjalankan satu putaran.
 *
 * Tidak pernah dua putaran sekaligus: putaran yang menumpuk akan membuka dua
 * peramban sekaligus dan menarik perkara yang sama dua kali.
 */
/**
 * Batas waktu satu putaran penarikan.
 *
 * Lapisan kedua, bukan pengganti perbaikan di run.js. Selama penjadwal
 * menandai putaran sebagai sedang jalan hingga anaknya keluar, satu proses
 * yang menggantung akan mengunci SELURUH putaran berikutnya - permanen, dan
 * tanpa pesan galat. Penjagaan di run.js menutup satu sebab yang sudah
 * diketahui; batas waktu ini menutup sebab yang belum.
 *
 * Bawaannya dua jam: cukup longgar untuk 200 perkara pada jaringan lambat,
 * dan tetap jauh lebih pendek daripada selamanya.
 */
const BATAS_PUTARAN_MS = Number(process.env.ALETA_BOT_ECOURT_BATAS_PUTARAN_MS || 2 * 60 * 60 * 1000);

/** Jalur ke jembatan e-Court. */
function jembatanPath() {
  return path.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js");
}

function jalankanSatuPutaran({
  nomorPerkara = "",
  permintaanId = "",
  // 0 berarti TANPA batas - dipakai penarikan menyeluruh dari portal, sama
  // seperti aleta-ecourt-unduh-latar.sh dengan MAKS=0. Bila tidak disebut,
  // batasnya mengikuti pengaturan penjadwal.
  maksPerkara = null,
  // Menarik HANYA perkara yang berkasnya belum ada - lihat
  // mulaiPenarikanBelumAda dan --hanya-belum-ada pada run.js.
  hanyaBelumAda = false,
  // Membaca daftar dokumen + status verifikasinya SAJA, tanpa mengunduh
  // berkas (--tanpa-unduh pada run.js) - dipakai penarik verifikasi harian
  // (ecourtVerifikasiHarianService, butir 30, 5 Okt 2026).
  tanpaUnduh = false,
  sumber = "jadwal",
  // Batas waktu putaran ini sendiri (ms). Bawaannya BATAS_PUTARAN_MS (2 jam);
  // tarikan satu perkara dari penanda "belum upload" Jadwal Sidang (7 Okt
  // 2026) memakai batas yang jauh lebih pendek - ada orang yang menunggunya.
  batasMs = null,
  // Butir 8 (1.189.x): tiap baris kemajuan jembatan (@@ALETA-KEMAJUAN, lihat
  // ecourtKemajuanTarik) diteruskan ke sini - tarikan satu perkara memakainya
  // untuk persen + tahap yang nyata. Gagal di sini tidak menyentuh penarikan.
  padaKemajuan = null,
} = {}) {
  return new Promise((selesai) => {
    if (keadaan.sedangJalan) {
      selesai({ dilewati: true, alasan: "putaran_sebelumnya_belum_selesai" });
      return;
    }

    // Penarikan dari PuTTY memakai proses di luar bot, sehingga tidak terlihat
    // oleh keadaan.sedangJalan. Dua penarikan sekaligus membuka dua peramban
    // dan menarik perkara yang sama dua kali ke server Mahkamah Agung.
    if (kunciMasihHidup()) {
      selesai({ dilewati: true, alasan: "penarikan_lain_masih_berjalan" });
      return;
    }

    const pengaturan = getSettings();

    // ==================================================================
    // AKUN DIPILIH DI SINI, BUKAN DITETAPKAN SEKALI DI PENGATURAN
    // ==================================================================
    //
    // Yang dipilih adalah akun aktif berikutnya yang punya sesi tersimpan
    // dan tidak sedang diistirahatkan. Memakai akun yang sama terus-menerus
    // membuat sesi akun lain menganggur sampai basi - dan cadangan yang basi
    // bukan cadangan.
    const pilihan = ecourtAkunService.pilihAkunSiap();
    const slotAkun = pilihan.ok ? pilihan.slot : "";

    keadaan.sedangJalan = true;
    keadaan.terakhirMulai = new Date().toISOString();
    keadaan.sumber = sumber;
    keadaan.perkaraDiminta = String(nomorPerkara || "");
    keadaan.akun = slotAkun;

    // Nama log mengikuti pola skrip host supaya keduanya muncul di layar
    // pemantauan yang sama.
    const cap = new Date().toISOString().replace(/[-:]/g, "").replace(/[.].*$/, "").replace("T", "-");
    const berkasLog = path.join(FOLDER_LOG, `ecourt-unduh-${cap}.log`);
    keadaan.berkasLog = path.basename(berkasLog);

    let tulisLog = null;
    try {
      fs.mkdirSync(FOLDER_LOG, { recursive: true });
      tulisLog = fs.createWriteStream(berkasLog, { flags: "a" });
      tulisLog.write(
        `=== Penarikan e-Court dimulai ${new Date().toISOString()} (sumber: ${sumber}` +
          `${nomorPerkara ? `, perkara: ${nomorPerkara}` : ""}) ===\n`
      );
    } catch {
      // Tanpa log pun penarikan tetap berjalan. Yang hilang hanya
      // pemantauannya, dan itu tidak sebanding dengan membatalkan penarikan.
      tulisLog = null;
      keadaan.berkasLog = "";
    }

    tulisKunci({ sumber, nomorPerkara: String(nomorPerkara || ""), log: keadaan.berkasLog });
    detakKunci = setInterval(
      () => tulisKunci({ sumber, nomorPerkara: String(nomorPerkara || ""), log: keadaan.berkasLog }),
      DETAK_MS
    );

    const batas = maksPerkara === null ? pengaturan.maksPerkara : Number(maksPerkara);

    const argumen = [jembatanPath(), "--terjadwal"];
    if (slotAkun) argumen.push("--akun", slotAkun);
    if (hanyaBelumAda) argumen.push("--hanya-belum-ada");
    if (tanpaUnduh) argumen.push("--tanpa-unduh");
    if (nomorPerkara) {
      argumen.push("--perkara", String(nomorPerkara));
    } else if (batas > 0) {
      argumen.push("--maks-perkara", String(batas));
    }

    const anak = spawn(process.execPath, argumen, {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    keadaan.anak = anak;

    // Dimatikan di penanganan close, apa pun sebab keluarnya.
    let dipaksaBerhenti = false;
    const batasPutaran =
      Number.isFinite(Number(batasMs)) && Number(batasMs) > 0 ? Math.min(Number(batasMs), BATAS_PUTARAN_MS) : BATAS_PUTARAN_MS;
    const pewaktu = setTimeout(() => {
      dipaksaBerhenti = true;
      anak.kill("SIGKILL");
    }, batasPutaran);

    let keluaran = "";
    const kemajuanTarik = require("./ecourtKemajuanTarik");
    keadaan.kemajuan = kemajuanTarik.hitungKemajuan({ tahap: "buka-peramban" });
    const pilahKemajuan = kemajuanTarik.pemilahBaris((laporan) => {
      keadaan.kemajuan = kemajuanTarik.majukan(keadaan.kemajuan, laporan);
      if (typeof padaKemajuan === "function") padaKemajuan(laporan);
    });

    /**
     * Menyalurkan keluaran ke dua tempat sekaligus.
     *
     * Ke memori, untuk cuplikan galat pada catatan sistem seperti sebelumnya;
     * dan ke berkas log, supaya layar pemantauan di portal dapat mengikutinya
     * seperti tail -f. Yang di memori dipangkas 20 ribu huruf terakhir - satu
     * penarikan menyeluruh dapat menghasilkan puluhan megabita, dan menahan
     * seluruhnya di memori bot bukan hal yang pantas dilakukan.
     */
    function salurkan(potongan) {
      const teks = String(potongan);
      keluaran += teks;
      if (keluaran.length > 20000) keluaran = keluaran.slice(-20000);
      pilahKemajuan(teks);
      if (tulisLog) {
        try {
          tulisLog.write(teks);
        } catch {
          // Log penuh atau tidak dapat ditulis - penarikannya tetap jalan.
        }
      }
    }

    anak.stdout.on("data", salurkan);
    anak.stderr.on("data", salurkan);

    /** Merapikan berkas log dan kunci, apa pun sebab putaran berakhir. */
    function bereskan(catatanPenutup) {
      if (tulisLog) {
        try {
          tulisLog.write(`=== ${catatanPenutup} (${new Date().toISOString()}) ===\n`);
          tulisLog.end();
        } catch {
          // Tidak ada yang dapat dikerjakan lagi di sini.
        }
        tulisLog = null;
      }
      hapusKunci();
      keadaan.anak = null;
      keadaan.sumber = "";
      keadaan.perkaraDiminta = "";
      keadaan.akun = "";
    }

    anak.on("close", (kode) => {
      clearTimeout(pewaktu);

      // Permintaan titipan ditandai selesai apa pun hasilnya. Membiarkannya
      // berstatus "dikerjakan" selamanya membuat perkara itu tidak pernah
      // dapat diminta lagi - penjagaan terhadap banjir permintaan berubah
      // menjadi pemblokiran permanen.
      if (permintaanId) {
        void ecourtPermintaanService
          .tandaiSelesai(permintaanId, {
            berhasil: kode === 0,
            catatan: kode === 0 ? "selesai" : `berhenti dengan kode ${kode}`,
          })
          .catch(() => {});
      }
      keadaan.sedangJalan = false;
      keadaan.terakhirSelesai = new Date().toISOString();
      keadaan.terakhirKode = kode;
      keadaan.jumlahPutaran += 1;

      // Sesi habis (2) BUKAN kegagalan sistem - itu keadaan wajar yang
      // menuntut manusia login. Membedakannya penting supaya petugas tidak
      // mengira ada kerusakan.
      if (kode === 2) {
        keadaan.terakhirCatatan = "Sesi e-Court habis. Perlu login dari portal.";
        // Akun ini diistirahatkan supaya putaran berikutnya beralih ke akun
        // lain yang sesinya masih hidup - bukan mencoba akun mati berulang.
        if (slotAkun) ecourtAkunService.tandaiGagal(slotAkun, "sesi_habis");
        void logService.logSystemEvent({
          eventType: "ecourt_jadwal_sesi_habis",
          severity: "warning",
          message: "Penjadwal e-Court berhenti: sesi kedaluwarsa, perlu login dari portal.",
          metadata: {},
        });
      } else if (kode === 0) {
        keadaan.terakhirCatatan = "Selesai.";
        if (slotAkun) ecourtAkunService.tandaiBerhasil(slotAkun);
      } else {
        keadaan.terakhirCatatan = dipaksaBerhenti
          ? `Dihentikan paksa setelah melewati batas ${Math.round(batasPutaran / 60000)} menit.`
          : `Berhenti dengan kode ${kode}.`;
        void logService.logSystemEvent({
          eventType: "ecourt_jadwal_gagal",
          severity: "warning",
          message: "Putaran penjadwal e-Court gagal.",
          metadata: { kode, cuplikan: keluaran.slice(-400) },
        });
      }

      bereskan(keadaan.terakhirCatatan);
      selesai({ dilewati: false, kode, catatan: keadaan.terakhirCatatan });
    });

    anak.on("error", (error) => {
      clearTimeout(pewaktu);
      keadaan.sedangJalan = false;
      keadaan.terakhirSelesai = new Date().toISOString();
      keadaan.terakhirKode = -1;
      keadaan.terakhirCatatan = `Gagal menjalankan jembatan: ${error.message}`;
      bereskan(keadaan.terakhirCatatan);
      selesai({ dilewati: false, kode: -1, catatan: keadaan.terakhirCatatan });
    });
  });
}

/**
 * ============================================================================
 * PEMERIKSAAN KEUTUHAN ARSIP - DIJALANKAN SENDIRI, BUKAN MENUNGGU DIMINTA
 * ============================================================================
 *
 * ecourtAuditArsipService sudah lengkap sejak lama: ia membandingkan tiap
 * baris aleta_bot_ecourt_files dengan berkasnya di disk pada empat hal - ada,
 * ukuran, sidik jari SHA-256, dan penanda bentuk - lalu membuang catatan yang
 * rusak supaya penarikan berikutnya mengambilnya kembali.
 *
 * Yang tidak ada: satu pun pemanggilnya yang berjalan sendiri. Satu-satunya
 * jalan masuk selama ini POST /ecourt/audit-arsip, yakni layar portal yang
 * harus dibuka orang. Berkas yang hilang atau terpotong karena itu baru
 * ketahuan ketika ada yang membukanya - kadang berbulan kemudian, dan yang
 * membukanya menerima berkas rusak tanpa satu pun keterangan.
 *
 * Inilah keluhan "dibilang terunduh tetapi berkasnya rusak": bukan
 * pemeriksaannya yang keliru, melainkan tidak ada yang pernah menjalankannya.
 *
 * Dijalankan SESUDAH penarikan, bukan sebelumnya: yang baru saja diunduh ikut
 * terperiksa pada putaran yang sama. Bergilir sesuai rancangan layanannya -
 * yang paling lama tidak diperiksa didahulukan - sehingga tidak ada satu
 * putaran pun yang membaca seluruh arsip sekaligus.
 *
 * perbaiki: true. Membiarkan yang rusak tercatat berarti perkaranya terhitung
 * lengkap selamanya, dan justru itulah keadaan yang hendak diakhiri. Berkas
 * yang sengaja dihapus karena masa simpan tidak ikut diperiksa - lihat
 * penjagaan dihapus_retensi di layanannya.
 */
const JEDA_AUDIT_MS = 6 * 60 * 60 * 1000;
let auditTerakhir = 0;

async function periksaArsipBerkala() {
  if (Date.now() - auditTerakhir < JEDA_AUDIT_MS) return;
  auditTerakhir = Date.now();

  try {
    const hasil = await ecourtAuditArsipService.periksaArsip({
      perbaiki: true,
      olehSiapa: "penjadwal",
    });
    const diperiksa = Number(hasil?.diperiksa || 0);
    const rusak = Number(hasil?.dibuang || 0);
    if (rusak > 0) {
      // ====================================================================
      // HILANG SEMUA BUKAN "BEBERAPA BERKAS RUSAK" - ITU ARSIP YANG TIDAK
      // PERNAH DI-MOUNT
      // ====================================================================
      //
      // Berkas rusak satu-dua memang terjadi: unduhan terpotong, cakram
      // penuh. Tetapi seluruh atau hampir seluruh yang diperiksa hilang
      // sekaligus punya satu sebab yang jauh lebih mungkin - folder arsipnya
      // berada di dalam LAPISAN CONTAINER, bukan di volume. Tiap
      // "docker compose up -d" yang membuat ulang container menghapusnya,
      // sementara barisnya di aleta_bot_ecourt_files tetap ada.
      //
      // Dua keadaan itu menuntut dua tindakan yang sama sekali berbeda -
      // yang satu menunggu penarikan berikutnya, yang satu menuntut baris
      // mount di docker-compose - jadi keduanya disebut berbeda pula.
      const hampirSemua = diperiksa >= 5 && rusak >= Math.ceil(diperiksa * 0.8);
      void logService.logSecurityEvent({
        eventType: hampirSemua ? "ecourt_arsip_hilang_menyeluruh" : "ecourt_arsip_rusak_dibuang",
        severity: hampirSemua ? "critical" : "warning",
        message: hampirSemua
          ? `Arsip e-Court hilang MENYELURUH: ${rusak} dari ${diperiksa} berkas yang diperiksa tidak ada di cakram. ` +
            `Folder arsip yang dipakai ${ecourtDocumentService.resolveRoot()}. Periksa apakah folder itu benar-benar ` +
            "ter-mount ke volume di docker-compose; tanpa mount, seluruh unduhan terhapus setiap container dibuat ulang."
          : `Pemeriksaan arsip e-Court membuang ${rusak} catatan berkas yang hilang atau rusak; ` +
            "berkasnya akan ditarik ulang pada putaran berikutnya.",
        metadata: {
          diperiksa,
          utuh: hasil?.utuh ?? null,
          dibuang: rusak,
          akarArsip: ecourtDocumentService.resolveRoot(),
        },
      });
    }
  } catch (galat) {
    // Gagal-terbuka: pemeriksaan arsip bukan pekerjaan utama penjadwal, dan
    // kegagalannya tidak boleh menghentikan penarikan berikutnya.
    void logService
      .logSecurityEvent({
        eventType: "ecourt_arsip_periksa_gagal",
        severity: "warning",
        message: `Pemeriksaan keutuhan arsip e-Court gagal: ${String(galat.message || galat).slice(0, 200)}`,
      })
      .catch(() => {});
  }
}

/** Satu detak penjadwal. */
async function detak() {
  const pengaturan = getSettings();
  if (!pengaturan.aktif) return;
  if (!dalamJamKerja(new Date(), pengaturan)) return;

  // Permintaan titipan didahulukan.
  //
  // Di baliknya ada petugas yang sedang membuka perkara itu di SIPP dan
  // menunggu datanya. Penarikan menyeluruh tidak ditunggu siapa pun, dan
  // kehilangan satu putaran tidak merugikan - perkaranya akan terambil di
  // putaran berikutnya.
  const permintaan = await ecourtPermintaanService.ambilBerikutnya().catch(() => null);
  if (permintaan) {
    await jalankanSatuPutaran({
      nomorPerkara: permintaan.nomorPerkara,
      permintaanId: permintaan.id,
    });
    return;
  }

  await jalankanSatuPutaran();
}

function berhenti() {
  if (keadaan.timer) {
    clearInterval(keadaan.timer);
    keadaan.timer = null;
  }
}

/**
 * Menyalakan penjadwal.
 *
 * Detaknya tiap 15 menit, bukan tiap jarakJam. Detak yang sering dengan
 * pemeriksaan jam kerja membuat perubahan pengaturan berlaku cepat, dan
 * membuat putaran tidak terlewat ketika bot sempat mati sebentar.
 */
function mulai() {
  berhenti();

  const pengaturan = getSettings();
  if (!pengaturan.aktif) return;

  const detakMs = 15 * 60 * 1000;
  let terakhirPutaran = 0;

  // Sekali segera sesudah bot menyala, bukan menunggu detak pertama lima
  // belas menit lagi. Justru saat inilah arsip paling mungkin baru saja
  // lenyap: bot yang baru menyala hampir selalu berarti container yang baru
  // dibuat, dan itu persis kejadian yang menghapus folder yang tidak
  // ter-mount. Mengetahuinya sekarang jauh lebih berguna daripada seperempat
  // jam kemudian.
  void periksaArsipBerkala();

  keadaan.timer = setInterval(() => {
    const p = getSettings();
    if (!p.aktif) return;

    // ======================================================================
    // PEMERIKSAAN ARSIP BERDIRI DI LUAR JAM KERJA DAN DI LUAR JARAK PUTARAN
    // ======================================================================
    //
    // Ia tidak menuntut sesi e-Court dan tidak menyentuh Mahkamah Agung sama
    // sekali - hanya membaca berkas yang sudah ada di disk. Menaruhnya di
    // dalam detak() berarti ia ikut berhenti di luar jam kerja dan ikut
    // menunggu jarakJam, padahal berkas hilang justru paling sering terjadi
    // di luar jam kerja: container dibuat ulang saat pemasangan malam hari,
    // dan seluruh arsip yang tidak ter-mount lenyap bersamanya.
    void periksaArsipBerkala();

    const jarakMs = p.jarakJam * 60 * 60 * 1000;
    if (Date.now() - terakhirPutaran < jarakMs) return;
    terakhirPutaran = Date.now();
    void detak();
  }, detakMs);

  if (typeof keadaan.timer.unref === "function") keadaan.timer.unref();
}

function mulaiUlang() {
  berhenti();
  mulai();
}

/** Keadaan penjadwal untuk ditampilkan portal. */
function getStatus() {
  const pengaturan = getSettings();
  return {
    pengaturan,
    berjalan: keadaan.timer !== null,
    sedangJalan: keadaan.sedangJalan,
    dalamJamKerja: dalamJamKerja(),
    terakhirMulai: keadaan.terakhirMulai,
    terakhirSelesai: keadaan.terakhirSelesai,
    terakhirKode: keadaan.terakhirKode,
    terakhirCatatan: keadaan.terakhirCatatan,
    jumlahPutaran: keadaan.jumlahPutaran,
    // Keterangan putaran yang sedang berjalan, untuk layar pemantauan.
    sumber: keadaan.sumber,
    berkasLog: keadaan.berkasLog,
    perkaraDiminta: keadaan.perkaraDiminta,
    akun: keadaan.akun,
    kemajuan: keadaan.sedangJalan ? keadaan.kemajuan : null,
    daftarAkun: ecourtAkunService.daftarAkun(),
    // Penarikan dari PuTTY tidak terlihat oleh keadaan.sedangJalan. Kuncinya
    // yang memberi tahu bahwa ada penarikan lain di luar bot.
    adaPenarikanLain: !keadaan.sedangJalan && kunciMasihHidup(),
  };
}

/**
 * Menarik SELURUH berkas yang belum lengkap, atas permintaan dari portal.
 *
 * ============================================================================
 * PADANAN aleta-ecourt-unduh-latar.sh, BUKAN PENGGANTINYA
 * ============================================================================
 *
 * Menjalankan jembatan yang sama dengan argumen yang sama seperti skrip host
 * ketika MAKS=0: tanpa batas jumlah perkara, dan melewati perkara yang
 * berkasnya sudah lengkap. Skripnya tetap ada dan tetap dapat dipakai - yang
 * ditambahkan hanya pintu masuk dari portal, supaya petugas tidak perlu SSH.
 *
 * TIDAK ditunggu sampai selesai. Satu penarikan menyeluruh dapat berjam-jam,
 * dan menahan permintaan HTTP selama itu akan kehabisan waktu di proksi jauh
 * sebelum penarikannya selesai. Kemajuannya diikuti lewat berkas log.
 */
function mulaiPenarikanMenyeluruh({ olehSiapa = "" } = {}) {
  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_menyeluruh_dimulai",
    severity: "warning",
    message: "Penarikan seluruh berkas e-Court dimulai dari portal.",
    metadata: { olehSiapa: String(olehSiapa || "") },
  });

  // Sengaja tidak di-await: lihat catatan di atas.
  void jalankanSatuPutaran({ maksPerkara: 0, sumber: "portal-menyeluruh" });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog };
}

/**
 * Berapa perkara paling banyak dalam satu penekanan "tarik yang belum ada".
 *
 * ============================================================================
 * BERBATAS, DAN BATASNYA DIHITUNG DARI BATAS PUTARAN
 * ============================================================================
 *
 * Daftar sasaran mode belum-ada PADAT: tiap perkara di dalamnya benar-benar
 * dibuka, sangat berbeda dengan daftar biasa yang sebagian besarnya dilewati
 * murah. Taksirannya 8 detik per perkara ditambah 4 detik per berkas, ditambah
 * istirahat 1-3 menit tiap 40 perkara.
 *
 * 120 perkara karena itu kira-kira 1,5 jam - di bawah BATAS_PUTARAN_MS yang 2
 * jam. Dua ratus akan melewatinya, dan putaran yang dibunuh paksa memang tidak
 * kehilangan data (yang sudah terunduh sudah tercatat) tetapi catatannya
 * berbunyi "Dihentikan paksa" tiap kali, dan itu membingungkan orang yang
 * menekan tombolnya. Sisanya terambil pada penekanan berikutnya.
 */
const MAKS_BELUM_ADA = Number(process.env.ALETA_BOT_ECOURT_MAKS_BELUM_ADA || 120);

/**
 * Menarik HANYA perkara yang berkasnya belum ada.
 *
 * Empat bedanya dengan mulaiPenarikanMenyeluruh: acuannya seluruh arsip e-Court
 * menurut SIPP (2.527 perkara, bukan 200 setahun terakhir); perkara yang
 * berkasnya utuh tidak dibuka ulang hanya karena majelisnya belum
 * memverifikasi; perkara yang arsipnya kosong sama sekali didahulukan; dan
 * penariknya beristirahat tiap beberapa puluh perkara.
 *
 * TIDAK ditunggu sampai selesai - lihat catatan pada mulaiPenarikanMenyeluruh.
 */
function mulaiPenarikanBelumAda({ maksPerkara = MAKS_BELUM_ADA, olehSiapa = "" } = {}) {
  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  const batas = Math.min(Math.max(Number(maksPerkara) || MAKS_BELUM_ADA, 1), 1000);

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_belum_ada_dimulai",
    severity: "warning",
    message: "Penarikan berkas e-Court yang belum ada dimulai dari portal.",
    metadata: { olehSiapa: String(olehSiapa || ""), maksPerkara: batas },
  });

  void jalankanSatuPutaran({
    maksPerkara: batas,
    hanyaBelumAda: true,
    sumber: "portal-belum-ada",
  });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog, maksPerkara: batas };
}

/**
 * Menarik SATU perkara sekarang juga.
 *
 * Berbeda dengan antrean titipan yang menunggu detak penjadwal berikutnya -
 * dan hanya jalan bila penjadwalnya menyala dan sedang jam kerja. Petugas yang
 * menekan tombol di sebelah nomor perkara sedang menunggu berkas itu.
 */
function mulaiPenarikanPerkara(nomorPerkara, { olehSiapa = "" } = {}) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong", berkasLog: "" };

  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "penarikan_sedang_berjalan", berkasLog: keadaan.berkasLog };
  }
  if (kunciMasihHidup()) {
    return { ok: false, alasan: "penarikan_lain_masih_berjalan", berkasLog: "" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_perkara_dimulai",
    severity: "info",
    message: "Penarikan satu perkara e-Court dimulai dari portal.",
    metadata: { nomorPerkara: nomor, olehSiapa: String(olehSiapa || "") },
  });

  void jalankanSatuPutaran({ nomorPerkara: nomor, sumber: "portal-perkara" });

  return { ok: true, alasan: "", berkasLog: keadaan.berkasLog };
}

/**
 * Menghentikan penarikan yang sedang berjalan.
 *
 * Hanya dapat menghentikan penarikan yang DIMULAI bot ini. Penarikan dari
 * PuTTY berjalan sebagai proses lain di luar jangkauan bot - untuk itu
 * petugas tetap perlu menghentikannya dari sana, dan pesannya mengatakan
 * demikian alih-alih berpura-pura berhasil.
 */
function hentikanPenarikan({ olehSiapa = "" } = {}) {
  if (!keadaan.sedangJalan || !keadaan.anak) {
    return { ok: false, alasan: kunciMasihHidup() ? "penarikan_lain_masih_berjalan" : "tidak_ada_penarikan" };
  }

  void logService.logSecurityEvent({
    eventType: "ecourt_penarikan_dihentikan",
    severity: "warning",
    message: "Penarikan e-Court dihentikan dari portal.",
    metadata: { olehSiapa: String(olehSiapa || ""), sumber: keadaan.sumber },
  });

  try {
    keadaan.anak.kill("SIGTERM");
  } catch {
    return { ok: false, alasan: "gagal_menghentikan" };
  }

  return { ok: true, alasan: "" };
}

module.exports = {
  BAWAAN,
  MAKS_BELUM_ADA,
  berhenti,
  dalamJamKerja,
  getSettings,
  getStatus,
  hentikanPenarikan,
  jalankanSatuPutaran,
  mulaiPenarikanBelumAda,
  mulaiPenarikanMenyeluruh,
  mulaiPenarikanPerkara,
  mulai,
  mulaiUlang,
  saveSettings,
};
