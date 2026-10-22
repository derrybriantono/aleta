"use strict";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1: SEPULUH PENANDA (Tahap L2, 16 Okt 2026)
 * ============================================================================
 *
 * Penanda kecil di halaman SIPP (daftar perkara, Jadwal Sidang, detil perkara)
 * yang dibaca dari basis data SIPP. Tiap penanda membawa penjelasan dalam
 * bahasa sehari-hari dan dasar hukumnya; yang dasarnya belum pasti diberi
 * `perluDicek: true` dan disebut demikian di layar.
 *
 * Aturan TIDAK ditulis dua kali. Yang sudah ada dipakai apa adanya:
 *   sita / eksekusi   sitaEksekusiPerkaraService.sitaEksekusiBanyakPerkara
 *   izin cerai        penandaPerkaraPihakService.bahanPenanda (izinCeraiService;
 *                     PPPK = ASN, pensiunan/CPNS/PPPK paruh waktu bukan PNS)
 *   umur perkara &    sippJadwalSidangService.durasiBanyakPerkara (tangga SK
 *   lewat 5 bulan     Dirjen Badilag 048/2024 + hariSema SEMA 2/2014)
 * Yang baru di berkas ini hanya enam aturan yang belum pernah ada: penetapan
 * awal, belum ditunda 15.00, potensi verstek, tanpa sidang berikutnya, sisa
 * waktu ikrar, dan akta cerai/pemberitahuan.
 *
 * ----------------------------------------------------------------------------
 * UKURAN ATAS DATA NYATA (sipp_donggala salinan 16 Okt 2026 15.36, agregat)
 * ----------------------------------------------------------------------------
 *   Belum ditunda 15.00  dari 1.257 tundaan 2026, baris sidang berikutnya
 *                        dicatat sebelum 15.00 pada hari sidang: 1.020 (81%);
 *                        15.00-akhir hari: 158 (13%); hari berikutnya: 79 (6%).
 *                        Dipisah (ukur ulang sesudah jawaban pengguna 16 Okt):
 *                        e-Court jawab-menjawab/kesimpulan 196 tundaan - 115
 *                        (59%) sebelum 15.00, 44 (22%) 15.00-16.29, 12 >= 16.30,
 *                        25 hari berikutnya -> batas 16.30 menandai 19%, bukan
 *                        41%; agenda lain 1.061 - 905 (85%) sebelum 15.00.
 *                        (87 dari 253 sidang jawab-menjawab 2026 terjadwal 15.00.)
 *   Potensi verstek      gugatan putus 2025-2026 yang tergugatnya tidak pernah
 *                        hadir sebelum hari putus: 1.017, 909 (89%) berakhir
 *                        verstek (sisanya dicabut/gugur/NO); 909 dari 989
 *                        putusan verstek (92%) tertangkap.
 *   Penetapan awal       919 perkara 2026: keempat penetapan PERTAMA (tabel
 *                        riwayat perkara_hakim_pn dst.) setanggal pada 918, dan
 *                        918 lengkap PADA HARI PENDAFTARAN (1 lewat 3 hari kerja)
 *                        -> ambang "lewat 1 hari kerja" hanya menandai yang ganjil.
 *                        perkara_penetapan menyimpan penetapan TERAKHIR - bila
 *                        majelis diganti (166 perkara) tanggalnya berbeda dari
 *                        PHS pada 119 perkara: membacanya akan memerahkan 13%
 *                        perkara tanpa salah. Karena itu yang dibaca riwayat.
 *   Sisa waktu ikrar     cerai talak dikabulkan 2024-2026: 274; 246 sudah
 *                        ikrar (225 dalam 30 hari sejak PHS ikrar); belum
 *                        ikrar 28: 9 menunggu BHT, 14 sisa > 30 hari, 5 lewat.
 *   Akta cerai           976 cerai dikabulkan 2025-2026 yang sudah BHT/ikrar:
 *                        961 akta terbit hari itu juga, 12 dalam 7 hari, 3
 *                        dalam 8-14 hari; belum terbit kini 2 (> 30 hari).
 *   Pemberitahuan        verstek gugatan 2026: 360 dari 385 diberitahukan
 *                        dalam 14 hari (ambang 14 hari dipertahankan). Verstek
 *                        2025-2026: BHT dicatat hari ke-15 sesudah pemberitahuan
 *                        pada 424 dari 750, hari ke-16..21 pada 270, > 21 pada 18
 *                        -> BHT = pemberitahuan + 15 (tenggang 14 hari dihitung
 *                        sejak hari sesudah pemberitahuan; jawaban pengguna 16 Okt).
 *                        Historis: 38 dicatat sebelum +15, 424 tepat +15, 272
 *                        +16..+22 (akan kuning), 16 > +22 (akan merah).
 *                        Kini (16 Okt, salinan & server sama): 33 menunggu
 *                        pemberitahuan (< 14 hari, detil), 16 perkiraan BHT (abu),
 *                        0 kuning/merah.
 *   Verifikasi e-Court   server 16 Okt 21.40 (arsip tarikan, baca saja): 58
 *                        dokumen "belum" di 31 perkara gugatan - 28 sudah putus,
 *                        3 agenda bukan jawab-menjawab -> 0 ditandai. Tanpa
 *                        saringan babak/agenda/putus, 31 perkara salah tanda.
 *
 * SIPP hanya DIBACA. Bagian yang gagal dibaca dilaporkan di `terbaca`, dan
 * ketiadaan penanda dari bagian itu TIDAK berarti "baik".
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

function runQueryBawaan(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Tanggal YYYY-MM-DD dari Date/teks MySQL; kosong bila tidak sah atau 0000-00-00. */
function tgl(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  const t = cleanText(nilai).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t.startsWith("0000")) return "";
  return t;
}

/**
 * Teks "YYYY-MM-DD HH:MM:SS" dari kolom bot yang ditulis toMysqlDate (UTC) -> Date
 * yang benar (sama dengan botDbService.fromMysqlDate, tanpa memuat sambungannya).
 * Date dibiarkan apa adanya; selain itu null.
 */
function waktuUtc(nilai) {
  if (nilai instanceof Date) return nilai;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(String(nilai || "").trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hari(dari, sampai) {
  if (!dari || !sampai) return null;
  const a = new Date(`${dari}T00:00:00Z`).getTime();
  const b = new Date(`${sampai}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function tambahHari(t, n) {
  const d = new Date(`${t}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** t + n bulan kalender; tanggal yang tidak ada dijepit ke akhir bulan (31 Agu + 6 = 28/29 Feb). */
function tambahBulan(t, n) {
  const [y, m, d] = t.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const akhir = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, akhir));
  return target.toISOString().slice(0, 10);
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function tanggalIndo(t) {
  if (!t) return "";
  const [y, m, d] = t.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** 0 = Minggu ... 6 = Sabtu. */
function hariMinggu(t) {
  return new Date(`${t}T00:00:00Z`).getUTCDay();
}

/**
 * Hari kerja (Senin-Jumat) SESUDAH `dari` sampai dengan `sampai`. Libur nasional
 * belum dikurangi (hanya Sabtu/Minggu) - penanda bisa menyala sehari lebih awal
 * sesudah libur.
 */
function hariKerjaSesudah(dari, sampai) {
  const n = hari(dari, sampai);
  if (n === null || n <= 0) return 0;
  let jumlah = 0;
  for (let i = 1; i <= n; i += 1) {
    const w = hariMinggu(tambahHari(dari, i));
    if (w !== 0 && w !== 6) jumlah += 1;
  }
  return jumlah;
}

// ---------------------------------------------------------------------------
// Katalog: kode saklar, nama, dasar hukum. Satu-satunya tempat teks dasar.
// ---------------------------------------------------------------------------

const JENIS_CERAI_TALAK = 346;
const JENIS_CERAI_GUGAT = 347;
const ALUR_GUGATAN = 15;
const STATUS_DIKABULKAN = 62;

/** dihadiri_oleh (borang Edit Jadwal Sidang SIPP) yang berarti tergugat/termohon HADIR. */
const HADIR_TERGUGAT = new Set([1, 3, 8, 9, 11, 15]);
/** ... yang berarti tergugat/termohon TIDAK hadir (2 = penggugat saja, 4 = tidak ada yang hadir, dst.). */
const ABSEN_TERGUGAT = new Set([2, 4, 5, 7, 10, 13, 14]);

const BATAS_TUNDA_MENIT = 15 * 60;
/**
 * Jawaban pengguna 16 Okt: sidang e-Court beragenda jawab-menjawab/kesimpulan dijadwalkan
 * pukul 15.00 = batas akhir unggah dokumen e-Court, jadi tundaannya wajar SESUDAH 15.00.
 * Bagi mereka batasnya akhir hari kerja: 16.30 WITA (Jumat 17.00) - dipastikan pengguna 16 Okt.
 */
const AKHIR_HARI_KERJA_MENIT = 16 * 60 + 30;
const AKHIR_JUMAT_MENIT = 17 * 60;
const POLA_JAWAB_MENJAWAB = /jawab|replik|duplik|kesimpulan/i;
const SEMA_HARI = 150;
/** Jawaban pengguna 16 Okt: biasanya keempatnya sehari - ditandai bila lewat 1 hari kerja. */
const AMBANG_PENETAPAN_HARI_KERJA = 1;
const AMBANG_PEMBERITAHUAN_HARI = 14;
/** Tenggang verzet sejak pemberitahuan sah (Pasal 153 RBg / 129 HIR) - lalu BHT. */
const TENGGANG_VERZET_HARI = 14;
const AKTA_CERAI_HARI = 7;

const KATALOG = Object.freeze({
  sita: {
    nama: "Sita",
    dasar: {
      jaminan: "Sita Jaminan (conservatoir beslag): Pasal 261 RBg / Pasal 227 HIR.",
      revindikasi: "Sita Revindikasi (revindicatoir beslag): Pasal 260 RBg / Pasal 226 HIR.",
      marital: "Sita Marital (harta bersama): Pasal 78 huruf c UU 7/1989 jo. Pasal 24 ayat (2) huruf c PP 9/1975; Pasal 95 KHI.",
      lain: "Sita lainnya: lihat petitum.",
    },
    sumber: "Petitum (bagian primer) dan catatan sita jaminan pada Putusan Sela SIPP.",
  },
  eksekusi: {
    nama: "Eksekusi",
    dasar: "Sita eksekusi & eksekusi: Pasal 206-208 RBg / Pasal 195-197 HIR.",
    sumber: "Register eksekusi SIPP (perkara_eksekusi) yang tertaut ke perkara ini.",
  },
  "izin-cerai": {
    nama: "Izin cerai PNS/ASN",
    dasar:
      "Pasal 3 PP 10/1983 jo. PP 45/1990 (PNS wajib izin/surat keterangan pejabat sebelum bercerai); PPPK diperlakukan sebagai ASN (keputusan pengguna 11 Okt); pensiunan, CPNS, PPPK paruh waktu bukan PNS.",
    sumber: "SIPP Izin Cerai (perkara_izin_cerai), pekerjaan pihak, posita, judul dokumen e-Court.",
  },
  "penetapan-awal": {
    nama: "Penetapan awal (PMH/PPP/PJS/PHS)",
    dasar:
      "Pasal 145 RBg / Pasal 121 HIR (hari sidang ditetapkan); ketentuan pengguna (16 Okt 2026): PMH, PPP, PJS, PHS ditetapkan pada satu tanggal yang sama untuk semua jenis perkara, biasanya pada hari pendaftaran.",
    sumber: "Tanggal penetapan PERTAMA di riwayat SIPP (Penetapan Majelis Hakim, Panitera Pengganti, Juru Sita, Hari Sidang).",
  },
  "belum-ditunda": {
    nama: "Belum ditunda sampai 15.00",
    dasar:
      "Pasal 186 RBg / Pasal 159 HIR (sidang yang ditunda ditetapkan hari sidang berikutnya); batas pukul 15.00 WITA ketentuan kerja satker. Perkara e-Court beragenda jawab-menjawab/kesimpulan: pukul 15.00 adalah batas unggah dokumen e-Court, jadi batas tundanya akhir hari kerja.",
    sumber: "Jadwal Sidang SIPP hari ini (agenda, jam) dan tanda e-Court: belum ada tundaan, sidang berikutnya, atau putusan.",
  },
  "potensi-verstek": {
    nama: "Potensi verstek",
    dasar:
      "Pasal 149 RBg: tergugat yang tidak hadir walau dipanggil patut dapat diputus verstek (tanpa hadirnya tergugat).",
    sumber: "Kolom 'Dihadiri oleh' pada sidang-sidang yang sudah lewat.",
  },
  "umur-perkara": {
    nama: "Umur perkara",
    dasar:
      "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024 (waktu putus: <= 3 bulan nilai 5, 4 bulan nilai 3, 5 bulan nilai 1, > 5 bulan nilai 0) dan SEMA 2/2014 (tingkat pertama paling lambat 5 bulan).",
    sumber: "Tanggal pendaftaran sampai hari ini, hari pendaftaran ikut dihitung, dikurangi lama mediasi (dan kelonggaran ghaib SK).",
  },
  "tanpa-sidang-berikut": {
    nama: "Tanpa sidang berikutnya",
    dasar: "Pasal 186 RBg / Pasal 159 HIR: sidang yang ditunda ditetapkan hari sidang berikutnya.",
    sumber: "Jadwal Sidang SIPP: sidang terakhir sudah lewat, belum ada jadwal sesudahnya, perkara belum putus.",
  },
  "sisa-ikrar": {
    nama: "Sisa waktu ikrar talak",
    dasar:
      "Pasal 70 ayat (6) UU 7/1989: bila dalam 6 bulan sejak ditetapkan hari sidang penyaksian ikrar talak suami tidak datang (walau dipanggil patut), gugurlah kekuatan penetapan itu.",
    sumber: "SIPP Ikrar Talak: tanggal penetapan hari sidang ikrar (PHS ikrar) dan tanggal ikrar.",
  },
  "akta-cerai": {
    nama: "Akta cerai & pemberitahuan putusan",
    dasar:
      "Pasal 84 ayat (4) UU 7/1989: akta cerai diberikan paling lambat 7 hari setelah putusan berkekuatan hukum tetap; cerai talak sesudah ikrar diucapkan (dihitung dari tanggal ikrar). Putusan verstek: diberitahukan kepada tergugat/termohon, lalu 14 hari sejak pemberitahuan sah (tenggang verzet, Pasal 153 RBg / Pasal 129 HIR) putusan berkekuatan hukum tetap.",
    sumber: "SIPP Putusan (BHT), Ikrar Talak, Akta Cerai, dan Pemberitahuan Putusan (pihak kedua).",
  },
  "lewat-5-bulan": {
    nama: "Lewat 5 bulan (lapor Ketua)",
    dasar:
      "SEMA 2/2014: perkara tingkat pertama diselesaikan paling lambat 5 bulan; bila lewat, Ketua Majelis melaporkan alasannya kepada Ketua Pengadilan (tembusan Ketua PTA dan Ketua MA).",
    sumber: "Hari sejak pendaftaran dikurangi lama mediasi, tanpa kelonggaran ghaib.",
  },
  "ecourt-verifikasi": {
    nama: "Dokumen e-Court belum diverifikasi",
    dasar:
      "Persidangan elektronik (PERMA 1/2019 jo. PERMA 7/2022): dokumen jawaban, replik, duplik, dan kesimpulan yang diunggah pihak diverifikasi majelis sebelum diteruskan kepada pihak lawan.",
    sumber: "Arsip tarikan e-Court ALETA (status verifikasi tiap dokumen pihak) untuk perkara e-Court pada agenda jawab-menjawab/kesimpulan.",
    // Dasarnya dipastikan pengguna (keputusan 17 Okt butir 31) - tidak lagi "perlu dicek".
  },
  "putusan-ecourt": {
    nama: "Putusan di e-Court",
    dasar:
      "Salinan putusan harus terunggah di e-Court dan ditandatangani elektronik (TTE) oleh Panitera agar para pihak dapat mengambilnya (PERMA 1/2019 jo. PERMA 7/2022).",
    sumber: "Pembacaan tab Putusan e-Court oleh ALETA (terunggah atau belum, TTE panitera) dibandingkan dengan tanggal putusan di SIPP. Perkara yang belum pernah dibaca tidak ditandai.",
  },
});

const KODE_SAKLAR = Object.freeze(Object.keys(KATALOG));

function penanda(kode, tingkat, label, jelas, tambahan = {}) {
  const k = KATALOG[kode];
  return {
    kode,
    tingkat,
    label,
    jelas,
    dasar: typeof k.dasar === "string" ? k.dasar : tambahan.dasar || "",
    sumber: k.sumber,
    perluDicek: Boolean(k.perluDicek || tambahan.perluDicek),
    ...(tambahan.angka !== undefined ? { angka: tambahan.angka } : {}),
    ...(tambahan.hanyaDetil ? { hanyaDetil: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Aturan murni: fakta satu perkara -> daftar penanda. Diuji tanpa basis data.
// ---------------------------------------------------------------------------

/**
 * Jenis "lain" dari pembaca petitum adalah "Sita" + kata sesudahnya. Diukur 16 Okt
 * 2026 (salinan Donggala): satu-satunya temuan aktif "Sita Wati Binti" - NAMA orang
 * yang berawal "Sita". Karena itu "lain" hanya ditampilkan bila kata sesudahnya
 * memang benda/harta (contoh nyata yang sah: "Sita Harta Waris").
 */
const POLA_SITA_LAIN = /\bsita\s+(?:atas\s+)?(?:harta|tanah|rumah|barang|benda|objek|obyek|waris|bangunan|kendaraan|kebun|sawah)\b/i;

function nilaiSita(f) {
  const hasil = [];
  const daftar = (f.sita && Array.isArray(f.sita.daftar) ? f.sita.daftar : []).filter(
    (x) => x && x.kode !== "eksekusi" && (x.kode !== "lain" || POLA_SITA_LAIN.test(String(x.nama || "")))
  );
  if (daftar.length) {
    const nama = [...new Set(daftar.map((x) => x.nama || "Sita"))];
    const dasar = [...new Set(daftar.map((x) => KATALOG.sita.dasar[x.kode] || KATALOG.sita.dasar.lain))].join(" ");
    const asal = daftar.some((x) => x.sumber === "sipp") ? "dicatat di SIPP" : "dimohonkan dalam petitum";
    hasil.push(
      penanda(
        "sita",
        "biru",
        nama.join(" + "),
        `Perkara ini memuat ${nama.join(" dan ")} (${asal}). Pastikan permohonan sitanya dipertimbangkan (penetapan/putusan sela atau dalam putusan).`,
        { dasar }
      )
    );
  }
  const eksPetitum = (f.sita && Array.isArray(f.sita.daftar) ? f.sita.daftar : []).some((x) => x && x.kode === "eksekusi");
  const register = Array.isArray(f.eksekusi) ? f.eksekusi : [];
  if (register.length || eksPetitum) {
    const r = register[0];
    const tahap = r && r.tahapTerakhir ? `${r.tahapTerakhir.nama} (${tanggalIndo(r.tahapTerakhir.tanggal)})` : "";
    const label = register.length ? "Eksekusi" : "Sita Eksekusi";
    const jelas = register.length
      ? `Ada register eksekusi ${r.nomorRegister || ""} untuk perkara ini${tahap ? `; tahap terakhir: ${tahap}` : ""}${r.dicabut ? "; permohonan dicabut" : ""}.`
      : "Sita eksekusi tercatat untuk perkara ini.";
    hasil.push(penanda("eksekusi", "biru", label, jelas.replace(/\s+;/g, ";")));
  }
  return hasil;
}

function nilaiIzin(f) {
  if (f.putus || !f.izin) return [];
  const z = f.izin;
  if (z.keadaan === "belum-ada") {
    return [penanda("izin-cerai", "merah", "Izin cerai belum ada", "Pihak yang mengajukan cerai bekerja sebagai PNS/ASN/TNI/POLRI, tetapi izin atau surat keterangan atasannya belum tercatat di SIPP dan posita tidak menyebutnya.")];
  }
  if (z.keadaan === "belum-dicatat") {
    return [penanda("izin-cerai", "abu", "Izin cerai belum dicatat SIPP", "Posita atau berkas e-Court menyebut izin atasan, tetapi data Izin Cerai di SIPP masih kosong. Catat di SIPP supaya blangko membaca nomor suratnya.")];
  }
  if (z.keadaan === "belum-terbaca") {
    return [penanda("izin-cerai", "abu", "Izin atasan pihak lawan belum terbaca", "Hanya tergugat/termohon yang PNS/ASN/TNI/POLRI. SIPP tidak punya tempat mencatat surat atasan pihak lawan, jadi keadaannya tidak dapat dibaca.")];
  }
  if (z.keadaan === "ada") {
    return [penanda("izin-cerai", "hijau", "Izin cerai ada", "Izin atau surat keterangan atasan sudah tercatat di SIPP.", { hanyaDetil: true })];
  }
  return [];
}

function nilaiPenetapan(f, kini) {
  if (f.putus) return [];
  const t = f.tunjuk || {};
  const nama = { pmh: "PMH", ppp: "PPP", pjs: "PJS", phs: "PHS" };
  const kurang = Object.keys(nama).filter((k) => !t[k]);
  const umur = hari(f.tglDaftar, kini.tanggal);
  const kerja = f.tglDaftar ? hariKerjaSesudah(f.tglDaftar, kini.tanggal) : 0;
  if (kurang.length) {
    const daftar = kurang.map((k) => nama[k]).join(", ");
    if (kerja > AMBANG_PENETAPAN_HARI_KERJA) {
      return [
        penanda(
          "penetapan-awal",
          "kuning",
          `Belum ada ${daftar}`,
          `Perkara didaftarkan ${tanggalIndo(f.tglDaftar)} (${kerja} hari kerja lalu), tetapi ${daftar} belum ditetapkan di SIPP. Biasanya keempat penetapan selesai pada hari pendaftaran, paling lambat 1 hari kerja.`,
          { angka: kerja }
        ),
      ];
    }
    return [penanda("penetapan-awal", "abu", `Menunggu ${daftar}`, `Perkara baru ${Math.max(0, umur || 0)} hari sejak didaftarkan; ${daftar} belum ditetapkan (batas 1 hari kerja).`, { hanyaDetil: true })];
  }
  const semua = [t.pmh, t.ppp, t.pjs, t.phs];
  if (new Set(semua).size > 1) {
    const rinci = Object.keys(nama)
      .map((k) => `${nama[k]} ${tanggalIndo(t[k])}`)
      .join(", ");
    return [penanda("penetapan-awal", "kuning", "Penetapan tidak setanggal", `Tanggal penetapan pertama berbeda: ${rinci}. Di satker ini keempatnya biasanya satu tanggal.`)];
  }
  return [penanda("penetapan-awal", "hijau", "PMH/PPP/PJS/PHS lengkap", `Keempat penetapan awal ada dan setanggal (${tanggalIndo(t.pmh)}).`, { hanyaDetil: true })];
}

function barisPokok(f) {
  return (Array.isArray(f.jadwal) ? f.jadwal : []).filter((j) => j.tanggal && j.ikrar !== "Y" && j.verzet !== "Y" && j.keberatan !== "Y");
}

function nilaiBelumDitunda(f, kini) {
  const semua = Array.isArray(f.jadwal) ? f.jadwal : [];
  const hariIni = semua.filter((j) => j.tanggal === kini.tanggal);
  if (!hariIni.length) return [];
  const adaSesudah = semua.some((j) => j.tanggal > kini.tanggal);
  if (adaSesudah) return [];
  if (f.putus && f.putus.tanggal === kini.tanggal) return [];
  if (f.ikrar && f.ikrar.ikrar === kini.tanggal) return [];
  const selesai = hariIni.some((j) => j.ditunda === "Y" || /\bputus|ikrar|cabut|gugur|damai|rukun/i.test(j.alasan || ""));
  if (selesai) return [];
  // e-Court + agenda jawab-menjawab/kesimpulan: 15.00 = batas unggah dokumen e-Court
  // (jawaban pengguna 16 Okt) - batas tundanya akhir hari kerja.
  const unggahEcourt = Boolean(f.ecourt) && hariIni.some((j) => POLA_JAWAB_MENJAWAB.test(j.agenda || ""));
  if (unggahEcourt) {
    const akhir = hariMinggu(kini.tanggal) === 5 ? AKHIR_JUMAT_MENIT : AKHIR_HARI_KERJA_MENIT;
    const jam = `${Math.floor(akhir / 60)}.${String(akhir % 60).padStart(2, "0")}`;
    if (kini.menit < akhir) {
      return [
        penanda(
          "belum-ditunda",
          "abu",
          "Batas unggah e-Court 15.00",
          `Perkara e-Court dengan agenda jawab-menjawab/kesimpulan: batas unggah dokumen e-Court pukul 15.00, jadi tundaan wajar dicatat sesudah 15.00 - paling lambat akhir hari kerja (${jam}).`
        ),
      ];
    }
    return [
      penanda(
        "belum-ditunda",
        "merah",
        "Belum ditunda (lewat jam kerja)",
        `Perkara e-Court ini bersidang hari ini (agenda jawab-menjawab/kesimpulan, batas unggah dokumen e-Court 15.00), sudah lewat akhir hari kerja (${jam}), tetapi tundaannya belum dicatat di SIPP.`
      ),
    ];
  }
  if (kini.menit < BATAS_TUNDA_MENIT) {
    return [penanda("belum-ditunda", "abu", "Sidang hari ini", "Sidang hari ini belum dicatat hasilnya (tunda atau putus). Batasnya pukul 15.00.", { hanyaDetil: true })];
  }
  return [
    penanda(
      "belum-ditunda",
      "merah",
      "Belum ditunda (lewat 15.00)",
      "Perkara ini bersidang hari ini, sudah lewat pukul 15.00, tetapi hasil sidangnya (tunda ke tanggal berikutnya atau putus) belum dicatat di SIPP."
    ),
  ];
}

function nilaiVerstek(f, kini) {
  if (f.putus || Number(f.alur) !== ALUR_GUGATAN) return [];
  const lewat = barisPokok(f).filter((j) => j.tanggal < kini.tanggal);
  if (!lewat.length) return [];
  const hadir = lewat.filter((j) => HADIR_TERGUGAT.has(Number(j.hadir)));
  const absen = lewat.filter((j) => ABSEN_TERGUGAT.has(Number(j.hadir)));
  if (hadir.length || !absen.length) return [];
  const sebut = f.jenisId === JENIS_CERAI_TALAK ? "Termohon" : "Tergugat";
  return [
    penanda(
      "potensi-verstek",
      "kuning",
      "Potensi verstek",
      `${sebut} belum pernah hadir pada ${absen.length} sidang yang sudah lewat. Bila tetap tidak hadir padahal dipanggil patut, perkara dapat diputus verstek. Periksa relaas panggilannya.`,
      { angka: absen.length }
    ),
  ];
}

function nilaiTanpaSidang(f, kini) {
  if (f.putus) return [];
  const pokok = barisPokok(f);
  if (!pokok.length) return [];
  const semua = Array.isArray(f.jadwal) ? f.jadwal : [];
  if (semua.some((j) => j.tanggal >= kini.tanggal)) return [];
  const terakhir = pokok.reduce((a, b) => (b.tanggal > a.tanggal ? b : a));
  const sejak = hari(terakhir.tanggal, kini.tanggal);
  return [
    penanda(
      "tanpa-sidang-berikut",
      sejak > 7 ? "merah" : "kuning",
      "Tanpa sidang berikutnya",
      `Sidang terakhir ${tanggalIndo(terakhir.tanggal)} (${sejak} hari lalu), perkara belum putus, dan belum ada jadwal sidang sesudahnya di SIPP.`,
      { angka: sejak }
    ),
  ];
}

function nilaiIkrar(f, kini) {
  if (Number(f.jenisId) !== JENIS_CERAI_TALAK || !f.putus || Number(f.putus.statusId) !== STATUS_DIKABULKAN) return [];
  const it = f.ikrar || {};
  if (it.status || it.ikrar) return [];
  if (!it.phs) {
    if (f.putus.bht) {
      return [penanda("sisa-ikrar", "kuning", "PHS ikrar belum ada", `Putusan sudah berkekuatan hukum tetap (${tanggalIndo(f.putus.bht)}), tetapi hari sidang ikrar talak belum ditetapkan. Tenggat 6 bulan dihitung sejak penetapan itu.`)];
    }
    return [penanda("sisa-ikrar", "abu", "Menunggu BHT", "Putusan cerai talak belum berkekuatan hukum tetap; hari sidang ikrar ditetapkan sesudahnya.", { hanyaDetil: true })];
  }
  const batas = tambahBulan(it.phs, 6);
  const sisa = hari(kini.tanggal, batas);
  const dasarKalimat = `PHS ikrar ${tanggalIndo(it.phs)}; batas 6 bulan ${tanggalIndo(batas)}.`;
  if (sisa < 0) {
    return [
      penanda(
        "sisa-ikrar",
        "merah",
        "Lewat 6 bulan, ikrar belum",
        `${dasarKalimat} Sudah lewat ${-sisa} hari dan ikrar belum diucapkan. Bila Pemohon sudah dipanggil patut, penetapan izin ikrar gugur - periksa dan catat statusnya di SIPP.`,
        { angka: sisa }
      ),
    ];
  }
  const tingkat = sisa <= 30 ? "merah" : sisa <= 60 ? "kuning" : "abu";
  return [penanda("sisa-ikrar", tingkat, `Sisa waktu ikrar ${sisa} hari`, `${dasarKalimat} Ikrar talak belum diucapkan.`, { angka: sisa })];
}

function nilaiAkta(f, kini) {
  const hasil = [];
  if (!f.putus) return hasil;
  const cerai = [JENIS_CERAI_TALAK, JENIS_CERAI_GUGAT].includes(Number(f.jenisId));
  if (cerai && Number(f.putus.statusId) === STATUS_DIKABULKAN && !f.aktaCerai) {
    const talak = Number(f.jenisId) === JENIS_CERAI_TALAK;
    const ikrarSah = talak && f.ikrar && f.ikrar.ikrar && (!f.ikrar.status || String(f.ikrar.status) === "1");
    const mulai = talak ? (ikrarSah ? f.ikrar.ikrar : "") : f.putus.bht;
    if (mulai) {
      const batas = tambahHari(mulai, AKTA_CERAI_HARI);
      const sisa = hari(kini.tanggal, batas);
      const dari = talak ? `ikrar talak ${tanggalIndo(mulai)}` : `BHT ${tanggalIndo(mulai)}`;
      hasil.push(
        sisa < 0
          ? penanda("akta-cerai", "merah", `Akta cerai lewat ${-sisa} hari`, `Sejak ${dari}, akta cerai belum terbit di SIPP; batas 7 hari (${tanggalIndo(batas)}) sudah lewat.`, { angka: sisa })
          : penanda("akta-cerai", "kuning", `Akta cerai: sisa ${sisa} hari`, `Sejak ${dari}, akta cerai belum terbit di SIPP; batas 7 hari jatuh ${tanggalIndo(batas)}.`, { angka: sisa })
      );
    }
  }
  // Verstek (jawaban pengguna 16 Okt): putusan dibacakan, lalu diberitahukan; sejak
  // pemberitahuan sah dihitung 14 hari -> BHT. BHT TIDAK dihitung dari tanggal putus.
  if (Number(f.alur) === ALUR_GUGATAN && f.putus.verstek === "Y" && !f.putus.bht) {
    const sejakPutus = hari(f.putus.tanggal, kini.tanggal);
    const pbt = f.pbt && f.pbt.pihak2;
    if (!pbt) {
      if (sejakPutus !== null && sejakPutus >= AMBANG_PEMBERITAHUAN_HARI) {
        hasil.push(
          penanda(
            "akta-cerai",
            "kuning",
            `Belum diberitahukan (${sejakPutus} hari)`,
            `Putusan verstek ${tanggalIndo(f.putus.tanggal)} (${sejakPutus} hari lalu) belum tercatat diberitahukan kepada tergugat/termohon. Tenggang 14 hari menuju BHT baru berjalan sejak pemberitahuan sah.`,
            { angka: sejakPutus }
          )
        );
      } else if (sejakPutus !== null) {
        hasil.push(
          penanda("akta-cerai", "abu", "Menunggu pemberitahuan", `Putusan verstek ${tanggalIndo(f.putus.tanggal)} (${sejakPutus} hari lalu) belum diberitahukan kepada tergugat/termohon.`, {
            angka: sejakPutus,
            hanyaDetil: true,
          })
        );
      }
    } else {
      // Tenggang dihitung sejak HARI SESUDAH pemberitahuan: hari ke-14 = pemberitahuan + 14
      // (hari terakhir verzet), BHT = hari sesudahnya = pemberitahuan + 15.
      const akhirVerzet = tambahHari(pbt, TENGGANG_VERZET_HARI);
      const perkiraanBht = tambahHari(pbt, TENGGANG_VERZET_HARI + 1);
      const lewat = hari(perkiraanBht, kini.tanggal);
      if (lewat <= 0) {
        hasil.push(
          penanda(
            "akta-cerai",
            "abu",
            `Perkiraan BHT ${tanggalIndo(perkiraanBht)}`,
            `Putusan verstek diberitahukan ${tanggalIndo(pbt)}; tenggang verzet 14 hari berakhir ${tanggalIndo(akhirVerzet)}, jadi putusan berkekuatan hukum tetap ${tanggalIndo(perkiraanBht)} bila tidak ada verzet.`,
            { angka: -lewat || 0 }
          )
        );
      } else {
        hasil.push(
          penanda(
            "akta-cerai",
            lewat > 7 ? "merah" : "kuning",
            `BHT belum dicatat (lewat ${lewat} hari)`,
            `Putusan verstek diberitahukan ${tanggalIndo(pbt)}; tenggang verzet berakhir ${tanggalIndo(akhirVerzet)} dan BHT jatuh ${tanggalIndo(perkiraanBht)} - sudah lewat ${lewat} hari, tetapi BHT belum dicatat di SIPP. Periksa apakah ada verzet; bila tidak, catat BHT.`,
            { angka: lewat }
          )
        );
      }
    }
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Penanda ke-11: dokumen e-Court belum diverifikasi majelis (jawaban pengguna 16 Okt)
// ---------------------------------------------------------------------------

function nilaiVerifikasiEcourt(f, kini) {
  if (f.putus || !f.ecourt || !Array.isArray(f.dokumenEcourt) || !f.dokumenEcourt.length) return [];
  const pokok = barisPokok(f).sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
  if (!pokok.length) return [];
  // Sidang sasaran: hari ini/berikutnya; bila tidak ada, sidang terakhir.
  const sasaran = pokok.find((j) => j.tanggal >= kini.tanggal) || pokok[pokok.length - 1];
  if (!POLA_JAWAB_MENJAWAB.test(sasaran.agenda || "")) return [];
  // Hanya dokumen untuk babak ini: diunggah SESUDAH sidang sebelum sidang sasaran.
  const lalu = pokok.filter((j) => j.tanggal < sasaran.tanggal).map((j) => j.tanggal);
  const batas = lalu.length ? lalu[lalu.length - 1] : "";
  const belum = f.dokumenEcourt.filter((d) => d.menunggu && (!batas || (d.diunggah && d.diunggah > batas)));
  if (!belum.length) return [];
  const judul = [...new Set(belum.map((d) => d.judul).filter(Boolean))].slice(0, 4).join(", ");
  const terakhir = f.dokumenEcourt.map((d) => d.terlihat).filter(Boolean).sort().pop();
  return [
    penanda(
      "ecourt-verifikasi",
      sasaran.tanggal <= kini.tanggal ? "merah" : "kuning",
      `${belum.length} dokumen e-Court belum diverifikasi`,
      `Agenda ${sasaran.agenda} (${tanggalIndo(sasaran.tanggal)}): ${belum.length} dokumen pihak belum diverifikasi majelis${judul ? ` (${judul})` : ""}, sehingga belum dapat diteruskan ke pihak lawan.${terakhir ? ` Data e-Court terakhir ditarik ${terakhir}.` : ""}`,
      { angka: belum.length }
    ),
  ];
}

// ---------------------------------------------------------------------------
// Penanda ke-12: putusan belum diunggah ke e-Court / belum TTE panitera
// (permintaan hakim 22 Okt). Hanya perkara yang SUDAH putus dan SUDAH pernah
// dibaca dari e-Court; yang belum pernah dibaca tidak dituduh apa pun.
// ---------------------------------------------------------------------------

function nilaiPutusanEcourt(f) {
  const c = f.putusanEcourt;
  if (!f.putus || !c) return [];
  if (!c.adaBaris || !c.dokumenAda) {
    return [
      penanda(
        "putusan-ecourt",
        "merah",
        "Putusan belum diunggah ke e-Court",
        `Putusan diucapkan ${tanggalIndo(f.putus.tanggal)} di SIPP, tetapi salinan putusannya belum terunggah di e-Court. Tugas Panitera Pengganti / Panitera mengunggahnya agar para pihak dapat mengambilnya.`,
        { angka: 1 }
      ),
    ];
  }
  if (!c.paniteraTte) {
    return [
      penanda(
        "putusan-ecourt",
        "merah",
        "Putusan di e-Court belum ditandatangani panitera",
        `Salinan putusan (${tanggalIndo(f.putus.tanggal)}) sudah terunggah di e-Court, tetapi belum ditandatangani secara elektronik oleh Panitera, sehingga para pihak belum dapat mengambilnya.`,
        { angka: 2 }
      ),
    ];
  }
  return [];
}

const WARNA_NILAI_SK = { 5: "hijau", 3: "kuning", 1: "oranye", 0: "merah" };

function nilaiUmur(f) {
  if (f.putus || !f.durasi || !f.durasi.waktuPutusSk) return [];
  const d = f.durasi;
  const sk = d.waktuPutusSk;
  const rinci = [`${d.hariKotor} hari sejak pendaftaran`];
  if (d.hariMediasi > 0) rinci.push(`dikurangi ${d.hariMediasi} hari mediasi`);
  if (d.kelonggaran && d.kelonggaran.hari > 0) rinci.push(`dikurangi ${d.kelonggaran.hari} hari kelonggaran perkara ghaib`);
  const sisaPita = sk.sisaDiPita !== null && sk.sisaDiPita !== undefined ? ` Pita ini bertahan sekurangnya ${sk.sisaDiPita} hari lagi.` : "";
  // Uji di replika 16 Okt: perkara ghaib 107 hari tampil "1 hari" (kelonggaran 120
  // hari SK) - membingungkan di samping kolom "Lama Proses" SIPP. Label memakai hari
  // di luar mediasi saja (hariSema) + tanda ghaib; WARNA tetap nilai SK (berkelonggaran).
  const ghaib = Boolean(d.kelonggaran && d.kelonggaran.hari > 0);
  const hariLabel = d.hariSema !== null && d.hariSema !== undefined ? d.hariSema : d.hariBersih;
  return [
    penanda(
      "umur-perkara",
      WARNA_NILAI_SK[sk.nilai] || "abu",
      `${hariLabel} hari${ghaib ? " (ghaib)" : ""}`,
      `Umur perkara ${hariLabel} hari di luar mediasi (${rinci.join(", ")} = ${d.hariBersih} hari menurut SK): ${sk.sebutan}, nilai SK ${sk.nilai}.${sisaPita}`,
      { angka: d.hariBersih }
    ),
  ];
}

function nilaiLimaBulan(f) {
  if (f.putus || !f.durasi || f.durasi.hariSema === null || f.durasi.hariSema === undefined) return [];
  const h = f.durasi.hariSema;
  if (h <= SEMA_HARI) return [];
  return [
    penanda(
      "lewat-5-bulan",
      "merah",
      `Lewat 5 bulan (${h} hari)`,
      `Perkara sudah ${h} hari (di luar mediasi), lewat batas 5 bulan (150 hari) sebanyak ${h - SEMA_HARI} hari. Ketua Majelis wajib melaporkan alasannya kepada Ketua Pengadilan.`,
      { angka: h }
    ),
  ];
}

/** Seluruh penanda satu perkara, urut menurut katalog. */
function nilaiPerkara(f, kini) {
  return [
    ...nilaiSita(f),
    ...nilaiIzin(f),
    ...nilaiPenetapan(f, kini),
    ...nilaiBelumDitunda(f, kini),
    ...nilaiVerstek(f, kini),
    ...nilaiUmur(f),
    ...nilaiTanpaSidang(f, kini),
    ...nilaiIkrar(f, kini),
    ...nilaiAkta(f, kini),
    ...nilaiLimaBulan(f),
    ...nilaiVerifikasiEcourt(f, kini),
    ...nilaiPutusanEcourt(f),
  ];
}

// ---------------------------------------------------------------------------
// Pengumpul fakta (SELECT saja)
// ---------------------------------------------------------------------------

/** Waktu basis data SIPP (jam pengadilan), bukan jam mesin bot. */
async function waktuSipp(kueri) {
  const baris = await kueri("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d') AS tanggal, HOUR(NOW()) * 60 + MINUTE(NOW()) AS menit", []);
  const b = baris[0] || {};
  return { tanggal: String(b.tanggal || ""), menit: Number(b.menit) || 0 };
}

function petaPer(baris, kunci = "perkaraId") {
  const peta = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const k = String(b[kunci]);
    (peta[k] = peta[k] || []).push(b);
  }
  return peta;
}

async function faktaBanyakPerkara(id, deps = {}) {
  const kueri = deps.kueri || runQueryBawaan;
  const skema = deps.skema || require("./sippSkemaService");
  const terbaca = {};
  const aman = async (nama, kerja, kosong) => {
    try {
      const h = await kerja();
      terbaca[nama] = true;
      return h;
    } catch {
      terbaca[nama] = false;
      return kosong;
    }
  };
  const isian = id.map(() => "?").join(", ");
  const wajib = (adaTabel, tabel) => {
    if (!adaTabel) throw new Error(`tabel ${tabel} tidak terdaftar`);
  };

  const [putus, jadwal, tunjuk, ikrar, akta, pbt, ecourt] = await Promise.all([
    aman("putusan", async () => {
      wajib(await skema.tabelAda("perkara_putusan"), "perkara_putusan");
      return kueri(
        `SELECT perkara_id AS perkaraId, tanggal_putusan AS tanggal, putusan_verstek AS verstek, status_putusan_id AS statusId, tanggal_bht AS bht
           FROM perkara_putusan WHERE perkara_id IN (${isian}) AND tanggal_putusan IS NOT NULL`,
        id
      );
    }, []),
    aman("jadwal", async () => {
      wajib(await skema.tabelAda("perkara_jadwal_sidang"), "perkara_jadwal_sidang");
      return kueri(
        `SELECT perkara_id AS perkaraId, tanggal_sidang AS tanggal, urutan, ditunda, alasan_ditunda AS alasan, dihadiri_oleh AS hadir,
                ikrar_talak AS ikrar, verzet, keberatan, agenda, jam_sidang AS jam
           FROM perkara_jadwal_sidang WHERE perkara_id IN (${isian})`,
        id
      );
    }, []),
    aman("penetapan", async () => {
      wajib(await skema.tabelAda("perkara_hakim_pn"), "perkara_hakim_pn");
      wajib(await skema.tabelAda("perkara_panitera_pn"), "perkara_panitera_pn");
      wajib(await skema.tabelAda("perkara_jurusita"), "perkara_jurusita");
      wajib(await skema.tabelAda("perkara_penetapan_hari_sidang"), "perkara_penetapan_hari_sidang");
      // Tanggal PERTAMA dari riwayat - perkara_penetapan menyimpan yang terakhir (lihat kepala berkas).
      return kueri(
        `SELECT p.perkara_id AS perkaraId,
                (SELECT MIN(h.tanggal_penetapan) FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id) AS pmh,
                (SELECT MIN(h.tanggal_penetapan) FROM perkara_panitera_pn h WHERE h.perkara_id = p.perkara_id) AS ppp,
                (SELECT MIN(h.tanggal_penetapan) FROM perkara_jurusita h WHERE h.perkara_id = p.perkara_id) AS pjs,
                (SELECT MIN(h.tanggal_penetapan) FROM perkara_penetapan_hari_sidang h WHERE h.perkara_id = p.perkara_id) AS phs
           FROM perkara p WHERE p.perkara_id IN (${isian})`,
        id
      );
    }, []),
    aman("ikrar", async () => {
      wajib(await skema.tabelAda("perkara_ikrar_talak"), "perkara_ikrar_talak");
      return kueri(
        `SELECT perkara_id AS perkaraId, tanggal_penetapan_sidang_ikrar AS phs, tgl_ikrar_talak AS ikrar, status_penetapan_ikrar_talak_id AS status
           FROM perkara_ikrar_talak WHERE perkara_id IN (${isian})`,
        id
      );
    }, []),
    aman("aktaCerai", async () => {
      wajib(await skema.tabelAda("perkara_akta_cerai"), "perkara_akta_cerai");
      return kueri(
        `SELECT perkara_id AS perkaraId, tgl_akta_cerai AS tanggal, nomor_akta_cerai AS nomor FROM perkara_akta_cerai WHERE perkara_id IN (${isian})`,
        id
      );
    }, []),
    aman("pemberitahuan", async () => {
      wajib(await skema.tabelAda("perkara_putusan_pemberitahuan_putusan"), "perkara_putusan_pemberitahuan_putusan");
      return kueri(
        // MAX: pemberitahuan yang diulang (relaas pertama tidak sah) - yang terakhir yang berlaku.
        `SELECT perkara_id AS perkaraId, pihak, MAX(tanggal_pemberitahuan_putusan) AS tanggal
           FROM perkara_putusan_pemberitahuan_putusan
          WHERE perkara_id IN (${isian}) AND tanggal_pemberitahuan_putusan IS NOT NULL
          GROUP BY perkara_id, pihak`,
        id
      );
    }, []),
    aman("ecourt", async () => {
      wajib(await skema.tabelAda("perkara_efiling_id"), "perkara_efiling_id");
      return kueri(`SELECT DISTINCT perkara_id AS perkaraId FROM perkara_efiling_id WHERE perkara_id IN (${isian})`, id);
    }, []),
  ]);

  // Arsip tarikan e-Court ALETA (basis data bot, bukan SIPP): status verifikasi dokumen pihak.
  const nomorPer = deps.nomorPer || {};
  const daftarNomor = [...new Set(id.map((x) => nomorPer[String(x)]).filter(Boolean))];
  const dokumen = daftarNomor.length
    ? await aman(
        "dokumenEcourt",
        async () => {
          const bacaBot = deps.botKueri || ((sql, p) => require("./botDbService").query(sql, p));
          const store = deps.ecourtStore || require("./ecourtStoreService");
          // Waktu dibaca sebagai TEKS lalu ditegaskan UTC (toMysqlDate menulis UTC);
          // Date dari driver ditafsirkan LOKAL dan tanggalnya mundur sehari untuk
          // unggahan 00.00-07.59 WITA (audit 17 Okt).
          const baris = await bacaBot(
            `SELECT nomor_perkara AS nomorPerkara, judul_dokumen AS judulDokumen, status_verifikasi AS statusVerifikasi,
                    DATE_FORMAT(diunggah_pada, '%Y-%m-%d %H:%i:%s') AS diunggahPada,
                    DATE_FORMAT(terakhir_terlihat, '%Y-%m-%d %H:%i:%s') AS terlihat
               FROM aleta_bot_ecourt_documents WHERE nomor_perkara IN (${daftarNomor.map(() => "?").join(", ")})`,
            daftarNomor
          );
          return (Array.isArray(baris) ? baris : []).map((b) => ({
            nomor: cleanText(b.nomorPerkara).toLowerCase(),
            judul: cleanText(b.judulDokumen),
            menunggu: store.dokumenMenungguMajelis(b),
            diunggah: tgl(waktuUtc(b.diunggahPada)),
            terlihat: tgl(waktuUtc(b.terlihat)),
          }));
        },
        []
      )
    : [];

  // Keadaan putusan di e-Court (hasil bacaan ALETA); hanya untuk perkara yang tertaut nomornya.
  const putusanEcourt = daftarNomor.length
    ? await aman(
        "putusanEcourt",
        () => (deps.putusanEcourt || require("./putusanEcourtService").catatanBanyak)(daftarNomor),
        {}
      )
    : {};

  const sitaEks = await aman(
    "sita",
    () => (deps.sita || require("./sitaEksekusiPerkaraService").sitaEksekusiBanyakPerkara)(id),
    { sita: {}, eksekusi: {} }
  );
  terbaca.eksekusi = terbaca.sita;

  const bahanPihak = await aman(
    "izinCerai",
    () => (deps.bahanPenanda || require("./penandaPerkaraPihakService").bahanPenanda)(id),
    { izinCerai: {}, terbaca: { izinCerai: false } }
  );
  if (bahanPihak && bahanPihak.terbaca && bahanPihak.terbaca.izinCerai === false) terbaca.izinCerai = false;

  const durasi = await aman(
    "durasi",
    () => (deps.durasi || require("./sippJadwalSidangService").durasiBanyakPerkara)(id),
    {}
  );

  return {
    terbaca,
    putus: petaPer(putus),
    jadwal: petaPer(jadwal),
    tunjuk: petaPer(tunjuk),
    ikrar: petaPer(ikrar),
    akta: petaPer(akta),
    pbt: petaPer(pbt),
    sita: sitaEks.sita || {},
    eksekusi: sitaEks.eksekusi || {},
    izin: (bahanPihak && bahanPihak.izinCerai) || {},
    durasi: durasi || {},
    ecourt: new Set(ecourt.map((b) => String(b.perkaraId))),
    dokumen: petaPer(dokumen, "nomor"),
    putusanEcourt: putusanEcourt || {},
  };
}

/** Menyusun fakta satu perkara dari kumpulan baris. */
function susunFakta(p, kumpulan) {
  const k = String(p.perkaraId);
  const pu = (kumpulan.putus[k] || [])[0];
  const t = (kumpulan.tunjuk[k] || [])[0] || {};
  const it = (kumpulan.ikrar[k] || [])[0];
  const ac = (kumpulan.akta[k] || []).find((x) => tgl(x.tanggal) || cleanText(x.nomor));
  const pbt = {};
  for (const b of kumpulan.pbt[k] || []) pbt[`pihak${Number(b.pihak)}`] = tgl(b.tanggal);
  return {
    perkaraId: Number(p.perkaraId),
    nomor: cleanText(p.nomor),
    alur: Number(p.alur),
    jenisId: Number(p.jenisId),
    tglDaftar: tgl(p.tglDaftar),
    putus: pu && tgl(pu.tanggal)
      ? { tanggal: tgl(pu.tanggal), verstek: cleanText(pu.verstek), statusId: Number(pu.statusId), bht: tgl(pu.bht) }
      : null,
    jadwal: (kumpulan.jadwal[k] || []).map((j) => ({
      tanggal: tgl(j.tanggal),
      urutan: Number(j.urutan) || 0,
      ditunda: cleanText(j.ditunda),
      alasan: cleanText(j.alasan),
      hadir: j.hadir === null || j.hadir === undefined || j.hadir === "" ? null : Number(j.hadir),
      ikrar: cleanText(j.ikrar),
      verzet: cleanText(j.verzet),
      keberatan: cleanText(j.keberatan),
      agenda: cleanText(j.agenda),
      jam: cleanText(j.jam).slice(0, 5),
    })),
    ecourt: kumpulan.ecourt ? kumpulan.ecourt.has(k) : false,
    putusanEcourt: (kumpulan.putusanEcourt && kumpulan.putusanEcourt[normalizeCaseNumber(cleanText(p.nomor))]) || null,
    dokumenEcourt: (kumpulan.dokumen && kumpulan.dokumen[cleanText(p.nomor).toLowerCase()]) || [],
    tunjuk: { pmh: tgl(t.pmh), ppp: tgl(t.ppp), pjs: tgl(t.pjs), phs: tgl(t.phs) },
    ikrar: it ? { phs: tgl(it.phs), ikrar: tgl(it.ikrar), status: cleanText(it.status) } : null,
    aktaCerai: Boolean(ac),
    pbt,
    sita: kumpulan.sita[k] || null,
    eksekusi: kumpulan.eksekusi[k] || [],
    izin: kumpulan.izin[k] || null,
    durasi: kumpulan.durasi[k] || null,
  };
}

/** Penanda yang bagiannya tidak terbaca dibuang - tidak ada "baik" dari data yang tidak dibaca. */
const BAGIAN_PENANDA = Object.freeze({
  sita: ["sita"],
  eksekusi: ["eksekusi"],
  "izin-cerai": ["izinCerai"],
  "penetapan-awal": ["penetapan", "putusan"],
  "belum-ditunda": ["jadwal", "putusan", "ikrar", "ecourt"],
  "potensi-verstek": ["jadwal", "putusan"],
  "umur-perkara": ["durasi", "putusan"],
  "tanpa-sidang-berikut": ["jadwal", "putusan"],
  "sisa-ikrar": ["ikrar", "putusan"],
  "akta-cerai": ["aktaCerai", "putusan", "ikrar", "pemberitahuan"],
  "lewat-5-bulan": ["durasi", "putusan"],
  "ecourt-verifikasi": ["ecourt", "dokumenEcourt", "jadwal", "putusan"],
  "putusan-ecourt": ["putusanEcourt", "putusan"],
});

function kodeTerbaca(terbaca) {
  const hasil = {};
  for (const [kode, bagian] of Object.entries(BAGIAN_PENANDA)) hasil[kode] = bagian.every((b) => terbaca[b] !== false);
  return hasil;
}

/**
 * Penanda untuk daftar nomor perkara (paling banyak 100) dari halaman SIPP.
 *
 * @returns {Promise<{ok: boolean, kini: {tanggal, menit}, perkara: Object<string, {perkaraId, penanda: Array}>, terbaca: Object<string, boolean>, tidakDikenal: string[]}>}
 */
async function penandaBanyakNomor(daftarNomor = [], deps = {}) {
  const kueri = deps.kueri || runQueryBawaan;
  const nomor = [...new Set((Array.isArray(daftarNomor) ? daftarNomor : []).map((x) => normalizeCaseNumber(cleanText(x))).filter(Boolean))].slice(0, 100);
  if (!nomor.length) return { ok: true, kini: null, perkara: {}, terbaca: {}, tidakDikenal: [] };
  const kini = deps.kini || (await waktuSipp(kueri));
  const baris = await kueri(
    `SELECT perkara_id AS perkaraId, nomor_perkara AS nomor, alur_perkara_id AS alur, jenis_perkara_id AS jenisId, tanggal_pendaftaran AS tglDaftar
       FROM perkara WHERE nomor_perkara IN (${nomor.map(() => "?").join(", ")})`,
    nomor
  );
  const id = [...new Set(baris.map((b) => Number(b.perkaraId)).filter((x) => x > 0))];
  const nomorPer = {};
  for (const b of baris) nomorPer[String(b.perkaraId)] = cleanText(b.nomor);
  const kumpulan = id.length ? await faktaBanyakPerkara(id, { ...deps, nomorPer }) : null;
  const terbaca = kumpulan ? kodeTerbaca(kumpulan.terbaca) : {};
  const perkara = {};
  for (const p of baris) {
    const f = susunFakta(p, kumpulan);
    const daftar = nilaiPerkara(f, kini).filter((x) => terbaca[x.kode] !== false);
    perkara[f.nomor] = { perkaraId: f.perkaraId, penanda: daftar };
  }
  const dikenal = new Set(Object.keys(perkara).map((x) => x.toLowerCase()));
  return { ok: true, kini, perkara, terbaca, tidakDikenal: nomor.filter((x) => !dikenal.has(x.toLowerCase())) };
}

/**
 * Ringkasan untuk Ketua: perkara BELUM PUTUS yang lewat 5 bulan (SEMA 2/2014),
 * seluruh satker - bukan hanya yang tampak di halaman. Nomor dan hari saja.
 */
async function ringkasLimaBulan(deps = {}) {
  const kueri = deps.kueri || runQueryBawaan;
  // Calon kasar dulu (> 150 hari kalender, belum putus) - mediasi hanya dapat
  // MENGURANGI hari, jadi tidak ada yang lewat 5 bulan yang tertinggal.
  // Rentang tanggal_pendaftaran (berindeks), bukan DATEDIFF atas kolomnya.
  const calon = await kueri(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomor
       FROM perkara p
      WHERE p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND p.alur_perkara_id IN (15, 16)
        AND NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)
      ORDER BY p.tanggal_pendaftaran ASC
      LIMIT 500`,
    [SEMA_HARI - 1]
  );
  const id = calon.map((b) => Number(b.perkaraId));
  const durasi = id.length ? await (deps.durasi || require("./sippJadwalSidangService").durasiBanyakPerkara)(id) : {};
  const daftar = [];
  for (const b of calon) {
    const d = durasi[String(b.perkaraId)];
    if (!d || d.sudahPutus || d.hariSema === null || d.hariSema <= SEMA_HARI) continue;
    daftar.push({ nomor: cleanText(b.nomor), hari: d.hariSema, lewat: d.hariSema - SEMA_HARI });
  }
  daftar.sort((a, b) => b.hari - a.hari);
  return { ok: true, jumlah: daftar.length, daftar, dasar: KATALOG["lewat-5-bulan"].dasar };
}

module.exports = {
  KATALOG,
  KODE_SAKLAR,
  HADIR_TERGUGAT,
  ABSEN_TERGUGAT,
  tambahBulan,
  nilaiPerkara,
  nilaiSita,
  nilaiIzin,
  nilaiPenetapan,
  nilaiBelumDitunda,
  nilaiVerstek,
  nilaiTanpaSidang,
  nilaiIkrar,
  nilaiAkta,
  nilaiUmur,
  nilaiLimaBulan,
  nilaiVerifikasiEcourt,
  nilaiPutusanEcourt,
  hariKerjaSesudah,
  waktuUtc,
  susunFakta,
  kodeTerbaca,
  faktaBanyakPerkara,
  penandaBanyakNomor,
  ringkasLimaBulan,
};
