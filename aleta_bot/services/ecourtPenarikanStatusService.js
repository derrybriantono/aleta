"use strict";

/**
 * ============================================================================
 * STATUS PENARIKAN DATA e-COURT (13 Okt 2026, butir 12)
 * ============================================================================
 *
 * Satu jawaban untuk dasbor ALETA e-Court: kapan tarikan terakhir (berkala dan
 * per perkara), berhasil/gagal beserta sebab singkat, jumlah perkara diperiksa
 * dan dokumen baru, akun yang dipakai, jadwal tarikan berikutnya, dan sesi
 * e-Court aktif atau tidak.
 *
 * SUMBERNYA DATA YANG SUDAH ADA, TANPA TABEL BARU. Tiap penarikan - dari
 * penjadwal, tombol portal, penanda "belum upload", maupun skrip host -
 * menulis log reports/ecourt-unduh-<cap>.log: baris kepala (sumber, perkara,
 * akun), "=== Ringkasan sinkronisasi ===" dari jembatan, dan baris penutup
 * (Selesai / Sesi habis / Berhenti dengan kode / Dihentikan paksa). Folder itu
 * di-mount ke host, jadi riwayatnya bertahan melewati penyalaan ulang bot -
 * berbeda dengan keadaan dalam memori penjadwal. aleta_bot_ecourt_sync_runs
 * tidak dipakai: ia tidak mencatat sumber maupun akun, dan baris "berjalan"
 * dari jembatan manual tidak pernah ditutup (terukur: 5 & 7 Okt).
 *
 * Hanya kepala (2 KB) dan ekor (8 KB) tiap log yang dibaca - log penarikan
 * menyeluruh dapat berukuran megabita.
 */

const fs = require("fs");
const path = require("path");

const POLA_LOG = /^ecourt-unduh-(\d{8})-(\d{6})\.log$/;
const KEPALA_BYTE = 2048;
const EKOR_BYTE = 8192;
/** Log tanpa penutup yang masih ditulis dalam selang ini = masih berjalan. */
const AMBANG_HIDUP_MS = 3 * 60 * 1000;

/** Sumber yang dijalankan sendiri oleh bot (bukan ditekan orang). */
const SUMBER_OTOMATIS = new Set(["jadwal", "verifikasi", "pagi"]);

const LABEL_SUMBER = {
  jadwal: "penjadwal berkala",
  pagi: "tarikan pagi (sidang hari ini)",
  verifikasi: "penarik verifikasi harian",
  "jadwal-belum-upload": "tombol belum upload (Jadwal Sidang)",
  "portal-perkara": "tarik satu perkara (portal)",
  "portal-menyeluruh": "tarik menyeluruh (portal)",
  "portal-belum-ada": "tarik yang belum ada (portal)",
  "server-skrip": "skrip server (SSH)",
};

function angkaRingkasan(teks, label) {
  const cocok = new RegExp(`^\\s*${label}\\s*:\\s*(\\d+)`, "m").exec(teks);
  return cocok ? Number(cocok[1]) : null;
}

function pangkas(teks, n = 160) {
  const t = String(teks || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Waktu dari nama berkas (cap ISO UTC tanpa tanda baca). */
function waktuDariNama(nama) {
  const c = POLA_LOG.exec(nama);
  if (!c) return "";
  const [, t, j] = c;
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${j.slice(0, 2)}:${j.slice(2, 4)}:${j.slice(4, 6)}.000Z`;
}

/**
 * Ringkasan SATU log - fungsi murni atas kepala dan ekornya.
 *
 * @param {{nama: string, kepala: string, ekor: string, diubahMs: number, sekarangMs?: number}} o
 */
function ringkasLog({ nama, kepala = "", ekor = "", diubahMs = 0, sekarangMs = Date.now() }) {
  // Kepala: "(sumber: X, perkara: Y, akun: Z, sidang: N)" - ruas boleh absen
  // dan boleh bertambah; dibaca sebagai pasangan kunci: nilai.
  const kep = /^=== Penarikan e-Court dimulai (\S+) \((.*)\) ===/m.exec(kepala);
  const ruas = {};
  if (kep) {
    for (const bagian of kep[2].split(", ")) {
      const i = bagian.indexOf(": ");
      if (i > 0) ruas[bagian.slice(0, i).trim()] = bagian.slice(i + 2).trim();
    }
  }
  const sumber = ruas.sumber || "server-skrip";
  const perkara = ruas.perkara || "";
  const akun = ruas.akun || "";
  const sidangDiutamakan = Number(ruas.sidang) || 0;
  const mulai = kep ? kep[1] : waktuDariNama(nama);

  const penutupSemua = [...String(ekor).matchAll(/^=== (.+?) \((\d{4}-\d{2}-\d{2}T[^)]+)\) ===\s*$/gm)];
  const penutup = penutupSemua.length ? penutupSemua[penutupSemua.length - 1] : null;
  const teksPenutup = penutup ? penutup[1].trim() : "";
  const selesai = penutup ? penutup[2] : "";

  const ringkasan = String(ekor).includes("=== Ringkasan sinkronisasi ===") ? ekor : "";
  const perkaraDiperiksa = angkaRingkasan(ringkasan, "Perkara diperiksa");
  const dokumenTerlihat = angkaRingkasan(ringkasan, "Dokumen terlihat");
  const dokumenBaru = angkaRingkasan(ringkasan, "Dokumen baru");
  const berkasTerunduh = angkaRingkasan(ringkasan, "Berkas terunduh");
  const galat = angkaRingkasan(ringkasan, "Galat");
  const galatTerakhir = (/^\s*Galat terakhir\s*:\s*(.+)$/m.exec(ringkasan) || [])[1] || "";
  const berhentiKarena = (/Sinkronisasi berhenti:\s*(.+)$/m.exec(ekor) || [])[1] || "";

  let hasil;
  let sebab = "";
  if (!penutup) {
    if (sekarangMs - diubahMs < AMBANG_HIDUP_MS) {
      hasil = "berjalan";
    } else {
      hasil = "terputus";
      sebab = "Log berhenti tanpa penutup - bot atau peramban mati di tengah penarikan.";
    }
  } else if (/sesi e-court habis/i.test(teksPenutup)) {
    hasil = "sesi-habis";
    sebab = "Sesi e-Court habis - perlu login ulang dari Integrasi e-Court.";
  } else if (/^selesai/i.test(teksPenutup)) {
    hasil = "berhasil";
    if (/berkasnya sudah lengkap, tidak dibuka/.test(ekor) && perkaraDiperiksa === 0) {
      sebab = "Perkara tidak dibuka (berkas tersimpan dianggap lengkap).";
    } else if (galat) {
      sebab = `${galat} galat${galatTerakhir ? `: ${galatTerakhir}` : ""}`;
    }
  } else {
    hasil = "gagal";
    sebab = berhentiKarena || galatTerakhir || teksPenutup;
  }

  // Bukti sesi dari penarikan itu sendiri.
  // Sesi yang habis DI TENGAH penarikan mengalahkan "masih berlaku" di
  // kepala log: yang terakhir diketahui adalah habis (30 Okt 2026).
  const sesiBerlaku = hasil === "sesi-habis" ? false : /Sesi tersimpan masih berlaku/.test(kepala) ? true : null;

  return {
    nama,
    mulai,
    selesai,
    sumber,
    labelSumber: LABEL_SUMBER[sumber] || sumber,
    otomatis: SUMBER_OTOMATIS.has(sumber),
    jenis: perkara ? "perkara" : sumber === "pagi" ? "pagi" : "berkala",
    sidangDiutamakan,
    perkara,
    akun,
    hasil,
    sebab: pangkas(sebab),
    perkaraDiperiksa,
    dokumenTerlihat,
    dokumenBaru,
    berkasTerunduh,
    galat,
    sesiBerlaku,
  };
}

function bacaPotongan(jalur, ukuran) {
  const fd = fs.openSync(jalur, "r");
  try {
    const kepalaBuf = Buffer.alloc(Math.min(KEPALA_BYTE, ukuran));
    fs.readSync(fd, kepalaBuf, 0, kepalaBuf.length, 0);
    const panjangEkor = Math.min(EKOR_BYTE, ukuran);
    const ekorBuf = Buffer.alloc(panjangEkor);
    fs.readSync(fd, ekorBuf, 0, panjangEkor, ukuran - panjangEkor);
    return { kepala: kepalaBuf.toString("utf8"), ekor: ekorBuf.toString("utf8") };
  } finally {
    fs.closeSync(fd);
  }
}

/** Riwayat penarikan dari folder log, terbaru lebih dulu. */
function bacaRiwayat({ folder, batas = 15, sekarangMs = Date.now() } = {}) {
  let nama;
  try {
    nama = fs.readdirSync(folder).filter((n) => POLA_LOG.test(n));
  } catch {
    return [];
  }
  nama.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const hasil = [];
  for (const n of nama.slice(0, Math.max(1, Math.min(100, batas)))) {
    try {
      const jalur = path.join(folder, n);
      const info = fs.statSync(jalur);
      if (!info.isFile()) continue;
      const { kepala, ekor } = bacaPotongan(jalur, info.size);
      hasil.push(ringkasLog({ nama: n, kepala, ekor, diubahMs: info.mtimeMs, sekarangMs }));
    } catch {
      // Berkas hilang/terkunci di antara readdir dan baca - lewati.
    }
  }
  return hasil;
}

/**
 * Keadaan sesi e-Court akun utama dari bukti TERBARU: pemeriksaan sesi
 * (ringan/Chrome), pemantau sesi berkala, atau penarikan terakhir.
 */
function sesiTerbaru({ pemeriksaan, pantau, riwayat, slot = "" }) {
  const bukti = [];
  const kunci = String(slot || "").trim().toLowerCase();
  if (pemeriksaan && pemeriksaan.diperiksaPada && (pemeriksaan.keadaan === "berlaku" || pemeriksaan.keadaan === "kedaluwarsa")) {
    bukti.push({ berlaku: pemeriksaan.keadaan === "berlaku", pada: pemeriksaan.diperiksaPada, sumber: pemeriksaan.cara === "ringan" ? "pemeriksaan ringan" : "pemeriksaan sesi" });
  }
  // Pemantau sesi hanya memeriksa slot bawaan "utama".
  if (pantau && pantau.terakhirDetak && typeof pantau.berlaku === "boolean" && (!kunci || kunci === "utama")) {
    bukti.push({ berlaku: pantau.berlaku, pada: pantau.terakhirDetak, sumber: "pemantau sesi" });
  }
  // Hanya log AKUN YANG SAMA (30 Okt 2026): dulu log akun cadangan ikut
  // menentukan keadaan akun utama.
  const tarik = (riwayat || []).find(
    (r) => typeof r.sesiBerlaku === "boolean" && (!kunci || String(r.akun || "utama").toLowerCase() === kunci)
  );
  if (tarik) bukti.push({ berlaku: tarik.sesiBerlaku, pada: tarik.selesai || tarik.mulai, sumber: "penarikan" });
  // Dibandingkan sebagai WAKTU, bukan teks - "2026-10-12T08:36:54.385Z"
  // dan "2026-10-12T08:36:54Z" tidak dapat diurutkan sebagai teks.
  const ms = (t) => {
    const n = Date.parse(String(t || ""));
    return Number.isFinite(n) ? n : 0;
  };
  bukti.sort((a, b) => ms(b.pada) - ms(a.pada));
  return bukti[0] || { berlaku: null, pada: "", sumber: "" };
}

/**
 * Status lengkap - dikumpulkan dari layanan yang sudah ada. Ketergantungan
 * dapat ditukar oleh uji.
 */
function statusPenarikan(deps = {}) {
  const penjadwal = deps.penjadwal || require("./ecourtSchedulerService");
  const akunSvc = deps.akun || require("./ecourtAkunService");
  const verifikasi = deps.verifikasi || require("./ecourtVerifikasiHarianService");
  const sesiStatus = deps.sesiStatus || require("./ecourtSesiStatusService");
  const pantau = deps.pantau || require("./ecourtSesiPantauService");
  const folder = deps.folderLog || path.resolve(__dirname, "..", "reports");
  const sekarangMs = deps.sekarangMs || Date.now();

  const jadwal = penjadwal.getStatus();
  const daftarAkun = Array.isArray(jadwal.daftarAkun) ? jadwal.daftarAkun : akunSvc.daftarAkun();
  const labelAkun = (slot) => (daftarAkun.find((a) => a.slot === slot) || {}).label || slot || "";
  const akunUtama = jadwal.pengaturan && jadwal.pengaturan.akunUtama ? jadwal.pengaturan.akunUtama : akunSvc.keadaanAkunUtama();

  const riwayat = bacaRiwayat({ folder, batas: deps.batas || 15, sekarangMs }).map((r) => ({
    ...r,
    labelAkun: r.akun ? labelAkun(r.akun) : "",
  }));

  let verif = null;
  try {
    verif = verifikasi.status();
  } catch {
    verif = null;
  }
  let pantauStatus = null;
  try {
    pantauStatus = pantau.getStatus();
  } catch {
    pantauStatus = null;
  }
  const pemeriksaan = sesiStatus.terakhirDiketahui ? sesiStatus.terakhirDiketahui(akunUtama.slot || "") : null;

  // Status akun satu sumber (30 Okt 2026) - yang dibaca penanda portal.
  let statusUtama = null;
  try {
    const statusAkun = deps.statusAkun || require("./ecourtStatusAkunService");
    statusUtama = statusAkun.statusSlot(akunUtama.slot || "utama");
  } catch {
    statusUtama = null;
  }

  return {
    ok: true,
    dibaca: new Date(sekarangMs).toISOString(),
    akunUtama,
    penjadwal: {
      aktif: Boolean(jadwal.pengaturan && jadwal.pengaturan.aktif),
      aktifTersimpan: Boolean(jadwal.pengaturan && jadwal.pengaturan.aktifTersimpan),
      selaluAktif: Boolean(jadwal.pengaturan && jadwal.pengaturan.selaluAktif),
      jarakJam: jadwal.pengaturan ? jadwal.pengaturan.jarakJam : null,
      jamMulai: jadwal.pengaturan ? jadwal.pengaturan.jamMulai : null,
      jamSelesai: jadwal.pengaturan ? jadwal.pengaturan.jamSelesai : null,
      dalamJamKerja: Boolean(jadwal.dalamJamKerja),
      sedangJalan: Boolean(jadwal.sedangJalan),
      sumberBerjalan: jadwal.sumber || "",
      perkaraBerjalan: jadwal.perkaraDiminta || "",
      akunBerjalan: jadwal.akun ? labelAkun(jadwal.akun) : "",
      berikutnya: jadwal.berikutnya || null,
      zonaWaktu: jadwal.zonaWaktu || "",
      // 13 Okt 10.05: selang acak putaran berkala dan tarikan pagi.
      selangMinMenit: jadwal.pengaturan ? jadwal.pengaturan.selangMinMenit ?? null : null,
      selangMaksMenit: jadwal.pengaturan ? jadwal.pengaturan.selangMaksMenit ?? null : null,
      pagi: jadwal.pagi || null,
    },
    verifikasiHarian: verif
      ? {
          menyala: Boolean(verif.menyala),
          detakBerikutnya: verif.detakBerikutnya || null,
          terakhirPutaran: verif.terakhirPutaran || "",
          tersambung: verif.tersambung !== false,
          alasan: verif.alasanTakTersambung || "",
          jumlahTarik: Number(verif.jumlahTarik || 0),
        }
      : null,
    terakhirBerkala: riwayat.find((r) => r.jenis === "berkala") || null,
    terakhirPerkara: riwayat.find((r) => r.jenis === "perkara") || null,
    terakhirPagi: riwayat.find((r) => r.jenis === "pagi") || null,
    riwayat,
    sesi: sesiTerbaru({ pemeriksaan, pantau: pantauStatus, riwayat, slot: akunUtama.slot || "utama" }),
    statusUtama,
  };
}

module.exports = {
  AMBANG_HIDUP_MS,
  LABEL_SUMBER,
  bacaRiwayat,
  ringkasLog,
  sesiTerbaru,
  statusPenarikan,
};
