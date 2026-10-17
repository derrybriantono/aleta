"use strict";

/**
 * ============================================================================
 * EVIDEN SKP - FAKTA PER PERKARA UNTUK BUKTI DUKUNG SKP (2.40.0)
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: bukti dukung SKP hakim di eKinerja BKN
 * diunduh dari ALETA dalam PDF, Excel, dan Word - datanya dari SIPP, bukan
 * diketik ulang ke spreadsheet tiap triwulan. Contoh yang dipakai sekarang:
 * spreadsheet "SKP 2026 DERRY BRIANTONO", 25 kolom status per perkara.
 *
 * Berkas ini HANYA mengumpulkan FAKTA (DataEvidenSkp, lihat
 * manajemen_surat/src/lib/eviden-skp-tipe.ts). Memilih perkara per dokumen,
 * menghitung realisasi indikator, dan menulis teks sel dikerjakan portal
 * (lib/eviden-skp-katalog.ts) - aturan hitung tinggal di satu sisi saja.
 *
 * ============================================================================
 * PERKARA YANG MASUK PERIODE
 * ============================================================================
 *
 * Hubungan orang itu dengan perkara ditentukan lewat ID SIPP, tidak pernah
 * lewat nama (lihat rekapPetugasService). Empat jalan masuk, masing-masing
 * dengan aturan periodenya sendiri:
 *
 *   majelis pemeriksa   didaftarkan paling lambat akhir periode DAN belum
 *                       putus atau putus sejak awal periode. Siapa pemeriksanya
 *                       WAJIB dari majelisPemeriksaService - yang menjabat pada
 *                       hari putusan, bukan yang aktif sekarang. Berkas ini
 *                       tidak menulis aturan hari putusan sendiri.
 *   upaya hukum         majelis pemeriksa (kapan pun) yang banding, kasasi,
 *                       atau PK-nya dimohonkan, diputus, atau diberitahukan
 *                       dalam periode - bukti dukung RHK pemberitahuan
 *                       putusan tingkat banding/kasasi/PK.
 *   majelis ikrar       sidang ikrar talak dalam periode: tanggal ikrar, atau
 *                       jadwal sidang berbendera ikrar_talak. Majelisnya dari
 *                       ikrarLengkap (majelisPemeriksaService): penunjukan
 *                       tahapan 18 bila ada, selainnya borang ikrar
 *                       perkara_ikrar_talak - calonnya dicari di keduanya.
 *   mediator            penetapan mediator paling lambat akhir periode DAN
 *                       laporan mediator sejak awal periode atau belum ada.
 *                       Mediasi tanpa laporan pada perkara yang sudah putus
 *                       sebelum periode TIDAK ikut: itu catatan yang tak
 *                       pernah ditutup (terukur 2016-2018 di sipp_donggala),
 *                       bukan mediasi yang berjalan.
 *
 * Tanggal yang terisi SESUDAH akhir periode tetap dikirim apa adanya; portal
 * yang membaca keadaan per akhir periode. Yang dipilih per periode di sini
 * hanya ruas yang kontraknya tidak membawa tanggal: penanda sidang keliling,
 * itsbat terpadu, e-Summons, dan tanggal musyawarah majelis.
 *
 * ============================================================================
 * SUMBER TIAP RUAS - DIBACA, BUKAN DITEBAK
 * ============================================================================
 *
 *   putusan, status        perkara_putusan; nama status lewat JOIN
 *                          status_putusan atas id-nya (status_putusan_nama
 *                          kosong pada data satker)
 *   minutasi, BHT          perkara_putusan.tanggal_minutasi / tanggal_bht
 *   salinan terunggah      perkara_putusan.amar_putusan_dok terisi; tanggalnya
 *                          tanggal baris Direktori Putusan yang dibuat SIPP saat
 *                          berkas itu diunggah (dirput_dokumen, urutan 99)
 *   anonimisasi            amar_putusan_anonimisasi_dok; tanggal dari
 *                          dirput_dokumen urutan 100
 *   direktori putusan      dirput_dokumen.link_dirput - alamat
 *                          putusan.mahkamahagung.go.id yang diberikan
 *                          Direktori; tanggal terbitnya dari dirput_antrian
 *                          yang berhasil (status 1)
 *   musyawarah majelis     jadwal sidang beragenda "musyawarah", atau sidang
 *                          sesudah sidang yang DITUNDA untuk musyawarah
 *                          (alasan_ditunda SIPP = agenda sidang berikutnya).
 *                          SIPP tidak punya kolom musyawarah; yang tidak
 *                          diagendakan tidak tercatat - dan disebut begitu.
 *   sidang keliling        jadwal sidang bertanda sidang_keliling, ruangannya
 *                          "Sidang Keliling ...", atau perkara_atribut
 *   itsbat terpadu         perkara itsbat nikah (jenis_perkara_id 360) yang
 *                          bersidang di ruang "Terpadu ..." - ruang terpadu
 *                          hanya memuat itsbat nikah, terukur di sipp_donggala
 *   ghaib                  perkara_pihak2.ghaib = 1
 *   prodeo                 perkara.prodeo = 1
 *   e-Court                ada baris perkara_efiling_id
 *   e-Summons              relaas bersandi E (elektronik)
 *   banding/kasasi/PK      perkara_banding/_kasasi/_pk; amar tingkat atas dari
 *                          kolom teks status-nya (id-nya bukan rujukan
 *                          status_putusan satker: id 120 "Menguatkan" di
 *                          perkara_banding, "Tidak Dapat Diterima" di
 *                          status_putusan). Tanggal INPUT pemberitahuannya
 *                          dari perkara_proses (proses 400, 500, 571/580/590)
 *   ikrar talak            perkara_ikrar_talak
 *   mediasi                perkara_mediasi; mediator dikenali lewat
 *                          mediator.hakim_id dan FIND_IN_SET atas mediator_id
 *   majelis, PP, JS        majelisPemeriksaService (pemeriksa; majelis ikrar
 *                          lewat ikrarLengkap)
 *   identitas hakim        hakim_pn (nama bergelar, NIP, jabatan, pangkat)
 *   Ketua                  sys_config KetuaPNNama/KetuaPNNIP - HANYA nama
 *                          konfigurasi itu yang dibaca; sys_config juga
 *                          memuat sandi dan kunci yang tidak boleh tersentuh
 *
 * Ruas yang gagal dibaca menjadi null dan DISEBUT di `galat` - tidak pernah
 * menjadi false atau nol diam-diam.
 *
 * ============================================================================
 * SELURUHNYA SELECT
 * ============================================================================
 *
 * Kuerinya ditulis harfiah di dalam runQuery - penjaga verify-pemisahan-
 * database dan verify-sipp-baca-saja membaca teksnya. Nama kolom yang
 * disisipkan hanya dari daftar di berkas ini yang sudah dicocokkan dengan
 * information_schema lewat sippSkemaService.
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");
const majelisPemeriksaService = require("./majelisPemeriksaService");
const acuanRuasService = require("./acuanRuasService");
const { tanggalHariIni } = require("./periodePenilaianService");
const { bacaId } = require("./rekapPetugasService");
// Sebutan para pihak punya SATU sumber - dari alur/jenis perkara, bukan kata.
const { sebutanPihakPerkara } = require("./sebutanPihakService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Peran yang dapat dibuatkan eviden. Panitera dan juru sita menyusul. */
const PERAN_EVIDEN = Object.freeze(["hakim"]);
const KUNCI_PERIODE = Object.freeze(["tw1", "tw2", "tw3", "tw4", "tahun"]);
/** Periode bulanan (SKP jabatan perkara): b01 = Januari ... b12 = Desember. */
const KUNCI_BULAN = Object.freeze(["b01", "b02", "b03", "b04", "b05", "b06", "b07", "b08", "b09", "b10", "b11", "b12"]);
const KUNCI_PERIODE_SEMUA = Object.freeze([...KUNCI_PERIODE, ...KUNCI_BULAN]);

/** Potongan daftar IN (...) - sama dengan majelisPemeriksaService. */
const POTONGAN_IN = 500;
/**
 * Potongan untuk tabel yang TIDAK berindeks perkara_id di SIPP satker -
 * perkara_pelaksanaan_relaas, dirput_antrian, dan dirput_dokumen (perkara_id
 * urutan keempat kunci utamanya). Tiap kueri atasnya memindai seluruh tabel,
 * jadi satu kueri besar lebih murah daripada tiga pemindaian. Terukur 27
 * September 2026 atas sipp_donggala (buffer InnoDB 16 MB): eviden Tahun 2026
 * seorang hakim (714 perkara, dua potongan) memindai relaas dua kali, 3,6 dan
 * 2,7 detik.
 */
const POTONGAN_PINDAI = 5000;
/** Pagu baris penunjukan seorang hakim; hakim tersibuk sipp_donggala 2.073 perkara. */
const BATAS_PENUNJUKAN = 200000;

/** Singgahan: menu unduh membaca dulu, lalu tiga format diunduh berurutan. */
const SINGGAHAN_MS = 2 * 60 * 1000;
const SINGGAHAN_MAKS = 20;

const TAHAPAN_IKRAR = majelisPemeriksaService.TAHAPAN_IKRAR;
/** Pengesahan Perkawinan/Istbat Nikah - id baku Badilag (lihat tagPerkaraService). */
const JENIS_ITSBAT = 360;

/**
 * Arti sandi hasil mediasi menurut komentar kolom hasil_mediasi SIPP - sama
 * dengan HASIL_MEDIASI di sippJadwalSidangService. `berhasil` null untuk D:
 * mediasi yang tidak dapat dilaksanakan tidak berhasil maupun gagal.
 */
const HASIL_MEDIASI = Object.freeze({
  Y1: { teks: "Berhasil dengan kesepakatan", berhasil: true },
  Y2: { teks: "Berhasil dengan pencabutan", berhasil: true },
  S: { teks: "Berhasil sebagian", berhasil: true },
  T: { teks: "Tidak berhasil", berhasil: false },
  D: { teks: "Tidak dapat dilaksanakan", berhasil: null },
});

/**
 * Kolom tiap tingkat upaya hukum. Nama kolom disisipkan ke teks kueri, jadi
 * HANYA dari daftar ini, dan hanya yang dijawab ada oleh sippSkemaService.
 * Pemberitahuan dapat tercatat pada satu kolom gabungan atau per pihak; yang
 * dipakai: kolom gabungan, atau yang TERAKHIR dari kolom per pihak - para
 * pihak baru seluruhnya diberi tahu pada tanggal itu.
 */
const UPAYA_HUKUM = Object.freeze({
  banding: {
    tabel: "perkara_banding",
    permohonan: "permohonan_banding",
    putusan: "putusan_banding",
    status: "status_putusan_banding_text",
    pemberitahuan: "pemberitahuan_putusan_banding",
    pemberitahuanPihak: ["pemberitahuan_putusan_banding_pembanding", "pemberitahuan_putusan_banding_terbanding"],
    proses: [400],
  },
  kasasi: {
    tabel: "perkara_kasasi",
    permohonan: "permohonan_kasasi",
    putusan: "putusan_kasasi",
    status: "status_putusan_kasasi_text",
    pemberitahuan: "pemberitahuan_putusan_kasasi",
    pemberitahuanPihak: ["pemberitahuan_putusan_kasasi_pihak1", "pemberitahuan_putusan_kasasi_pihak2"],
    proses: [500],
  },
  pk: {
    tabel: "perkara_pk",
    permohonan: "permohonan_pk",
    putusan: "putusan_pk",
    status: "status_putusan_pk_text",
    pemberitahuan: "pemberitahuan_putusan_pk",
    pemberitahuanPihak: ["pemberitahuan_putusan_pk_pihak1", "pemberitahuan_putusan_pk_pihak2"],
    proses: [571, 580, 590],
  },
});

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const ANGKA_ROMAWI = { tw1: "I", tw2: "II", tw3: "III", tw4: "IV" };

// ============================================================================
// PEMERIKSA MASUKAN DAN PERIODE - MURNI
// ============================================================================

/** Tanggal yyyy-mm-dd yang sah, atau null. */
function tanggalIso(nilai) {
  if (!nilai) return null;
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return null;
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  const teks = cleanText(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && !teks.startsWith("0000") ? teks : null;
}

/** "1 April 2026". */
function tanggalPanjang(iso) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!cocok) return "";
  return `${Number(cocok[3])} ${NAMA_BULAN[Number(cocok[2]) - 1]} ${cocok[1]}`;
}

/** Periode SKP: tw1 = Januari-Maret, ..., tahun = Januari-Desember, b01..b12 = satu bulan. */
function susunPeriode(kunci, tahun) {
  const t = Number(tahun);
  if (kunci === "tahun") {
    return {
      kunci,
      tahun: t,
      label: "Tahunan",
      labelPanjang: `Tahun ${t}`,
      mulai: `${t}-01-01`,
      selesai: `${t}-12-31`,
      bulan: 12,
    };
  }
  if (/^b(0[1-9]|1[0-2])$/.test(String(kunci))) {
    // Bulanan: label = nama bulan, rentang = satu bulan kalender penuh.
    const ke = Number(String(kunci).slice(1));
    const dua = (n) => String(n).padStart(2, "0");
    const hariAkhir = new Date(Date.UTC(t, ke, 0)).getUTCDate();
    return {
      kunci,
      tahun: t,
      label: NAMA_BULAN[ke - 1],
      labelPanjang: `${NAMA_BULAN[ke - 1]} ${t}`,
      mulai: `${t}-${dua(ke)}-01`,
      selesai: `${t}-${dua(ke)}-${dua(hariAkhir)}`,
      bulan: 1,
    };
  }
  const ke = Number(String(kunci).slice(2));
  const bulanMulai = (ke - 1) * 3 + 1;
  const bulanSelesai = bulanMulai + 2;
  const hariAkhir = new Date(Date.UTC(t, bulanSelesai, 0)).getUTCDate();
  const dua = (n) => String(n).padStart(2, "0");
  return {
    kunci,
    tahun: t,
    label: `Triwulan ${ANGKA_ROMAWI[kunci]}`,
    labelPanjang: `Triwulan ${ANGKA_ROMAWI[kunci]} Tahun ${t}`,
    mulai: `${t}-${dua(bulanMulai)}-01`,
    selesai: `${t}-${dua(bulanSelesai)}-${dua(hariAkhir)}`,
    bulan: 3,
  };
}

/**
 * Memeriksa seluruh masukan sekaligus. Yang tidak dikenali DITOLAK beserta
 * alasannya, bukan diganti bawaan diam-diam - periode yang salah ketik lalu
 * diam-diam menjadi "tahun ini" menghasilkan eviden periode yang bukan
 * dimintanya, dan eviden itu ditandatangani.
 */
function periksaMasukan(masukan = {}, hariIni = "") {
  const tolak = (alasan, error) => ({ ok: false, status: 400, alasan, error });

  const peran = cleanText(masukan.peran).toLowerCase();
  if (!PERAN_EVIDEN.includes(peran)) {
    return tolak("peran_tidak_dikenal", "Peran eviden SKP yang tersedia saat ini hanya hakim.");
  }
  const id = bacaId(masukan.id);
  if (id === null) return tolak("id_tidak_sah", "ID SIPP harus bilangan bulat positif.");

  const tahunTeks = cleanText(masukan.tahun);
  const tahun = /^\d{4}$/.test(tahunTeks) ? Number(tahunTeks) : NaN;
  if (!(tahun >= 2000 && tahun <= 2100)) return tolak("tahun_tidak_sah", "Tahun harus empat angka (2000-2100).");

  const periode = cleanText(masukan.periode).toLowerCase();
  if (!KUNCI_PERIODE_SEMUA.includes(periode)) {
    return tolak("periode_tidak_dikenal", "Periode harus tw1, tw2, tw3, tw4, tahun, atau b01 sampai b12.");
  }
  const susunan = susunPeriode(periode, tahun);
  if (hariIni && susunan.mulai > hariIni) {
    return tolak("periode_belum_mulai", `Periode ${susunan.labelPanjang} belum dimulai.`);
  }
  return { ok: true, pilihan: { peran, id, tahun, periode } };
}

/**
 * Kalimat aturan perkara masuk periode - dicetak di catatan kaki dokumen.
 * Sampai tanggal berapa keadaannya dibaca (akhir periode, atau hari ini bila
 * periodenya belum berakhir) ditulis katalog portal, satu kalimat untuk
 * seluruh dokumen.
 */
function kalimatAturanPeriode(periode) {
  const awal = tanggalPanjang(periode.mulai);
  const akhir = tanggalPanjang(periode.selesai);
  return (
    `Perkara masuk ${periode.labelPanjang} (${awal} s.d. ${akhir}): sebagai majelis pemeriksa bila ` +
    `didaftarkan paling lambat ${akhir} dan belum diputus atau diputus sejak ${awal}; sebagai majelis ` +
    `pemeriksa yang banding, kasasi, atau PK-nya dimohonkan, diputus, atau diberitahukan dalam periode; ` +
    `sebagai majelis ikrar talak bila sidang ikrarnya dalam periode; sebagai mediator bila mediator ` +
    `ditetapkan paling lambat ${akhir} dan laporan mediatornya sejak ${awal} atau belum ada. Majelis ` +
    `pemeriksa perkara yang sudah putus adalah yang menjabat pada hari putusan; yang belum putus, ` +
    `penunjukan yang aktif.`
  );
}

/**
 * Batas keadaan: akhir periode, atau HARI INI (WITA) bila periodenya belum
 * berakhir - jadwal yang baru direncanakan belum terjadi. Satu batas untuk
 * seluruh jalur: saringan perkara, musyawarah, sidang keliling, e-Summons,
 * sidang ikrar, upaya hukum, dan mediasi.
 */
function batasKeadaan(periode, hariIni) {
  return hariIni && hariIni < periode.selesai ? hariIni : periode.selesai;
}

/**
 * Kalimat untuk petugas bila bacaan INTI gagal. Galat MySQL-nya TIDAK ikut -
 * isinya nama tabel, kolom, dan kadang potongan kueri; rinciannya ke log bot.
 */
function kalimatGagalInti(bagian) {
  return (
    `Data inti SIPP tidak dapat dibaca (${bagian.join(", ")}). Coba lagi beberapa saat lagi; ` +
    `rinciannya tercatat di log ALETA Bot.`
  );
}

// ============================================================================
// ATURAN MURNI ATAS BARIS SIPP - DIUJI LANGSUNG
// ============================================================================

/** Isian SIPP yang berarti kosong: "", "0", "-". */
function isianKosong(nilai) {
  const teks = cleanText(nilai);
  return teks === "" || teks === "0" || teks === "-";
}

/** Nama untuk dibandingkan: huruf kecil, huruf saja. */
function kunciNama(nilai) {
  return cleanText(nilai)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** "PENGADILAN AGAMA DONGGALA" -> "Pengadilan Agama Donggala". */
function hurufJudul(teks) {
  return cleanText(teks)
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, depan, huruf) => `${depan}${huruf.toUpperCase()}`);
}

/**
 * Musyawarah majelis yang tercatat pada jadwal sidang satu perkara, paling
 * lambat `akhir`.
 *
 * alasan_ditunda SIPP berisi agenda sidang BERIKUTNYA (terukur: perkara 9215,
 * sidang 4 "Jawaban Tergugat" ditunda "Replik Penggugat", sidang 5 beragenda
 * "Replik Penggugat"). Sidang yang ditunda "untuk musyawarah majelis" karena
 * itu menunjuk sidang sesudahnya sebagai hari musyawarah. Yang dipakai:
 * musyawarah TERAKHIR sampai akhir periode - bila sebuah perkara
 * dimusyawarahkan dua kali (putusan sela dan putusan akhir), yang terdekat
 * dengan periodenya.
 *
 * @param jadwal baris jadwal satu perkara { tanggal, urutan, id, agenda, alasanDitunda }
 * @returns { tanggal, sumber } | null
 */
function musyawarahDariJadwal(jadwal, akhir) {
  const urut = [...(Array.isArray(jadwal) ? jadwal : [])]
    .filter((j) => tanggalIso(j.tanggal))
    .sort(
      (a, b) =>
        tanggalIso(a.tanggal).localeCompare(tanggalIso(b.tanggal)) ||
        (Number(a.urutan) || 0) - (Number(b.urutan) || 0) ||
        (Number(a.id) || 0) - (Number(b.id) || 0)
    );
  const pola = /musyawarah/i;
  let terpilih = null;
  for (let i = 0; i < urut.length; i += 1) {
    const j = urut[i];
    const tanggal = tanggalIso(j.tanggal);
    if (akhir && tanggal > akhir) break;
    if (pola.test(cleanText(j.agenda))) {
      terpilih = { tanggal, sumber: `Agenda sidang ${tanggal}: "${cleanText(j.agenda)}"` };
      continue;
    }
    const sebelumnya = urut[i - 1];
    if (sebelumnya && pola.test(cleanText(sebelumnya.alasanDitunda))) {
      terpilih = {
        tanggal,
        sumber: `Sidang ${tanggalIso(sebelumnya.tanggal)} ditunda untuk "${cleanText(sebelumnya.alasanDitunda)}"; sidang berikutnya ${tanggal}`,
      };
    }
  }
  return terpilih;
}

/**
 * Sidang di luar gedung pada jadwal satu perkara, paling lambat `akhir`.
 *
 * Tempatnya dibaca dari SALINAN nama ruangan pada baris jadwal, bukan dari
 * ruangan_id: id ruangan SIPP satker dipakai ulang untuk ruang lain (terukur:
 * id 7 dulu "Sidang diluar gedung Pengadilan (sidang terpadu)", kini "Ruang
 * Sidang Elektronik 1"). Pengelompokannya dari acuanRuasService; ejaan yang
 * belum dipetakan dikenali dari kata "keliling"/"terpadu" pada namanya.
 * Tanda sidang_keliling = 'Y' diakui walau ruangannya kosong atau tertulis
 * ruang dalam gedung - sama dengan LIPA 14 (penilaianDipa04Service).
 */
function sidangLuarGedungDariJadwal(jadwal, akhir) {
  const hasil = [];
  for (const j of Array.isArray(jadwal) ? jadwal : []) {
    const tanggal = tanggalIso(j.tanggal);
    if (!tanggal || (akhir && tanggal > akhir)) continue;
    const ruangan = cleanText(j.ruangan);
    const peta = acuanRuasService.petakanRuangSidang(ruangan);
    const terpadu = peta.kelompok === "Sidang Terpadu di Luar Gedung" || (!peta.dikenali && /terpadu/i.test(ruangan));
    const keliling = peta.kelompok === "Sidang Keliling" || (!peta.dikenali && /keliling/i.test(ruangan));
    const bertanda = cleanText(j.keliling).toUpperCase() === "Y";
    if (!terpadu && !keliling && !bertanda) continue;
    hasil.push({
      tanggal,
      tempat: ruangan || "Di luar gedung (ruangan tidak tercatat)",
      terpadu: terpadu && !keliling,
    });
  }
  return hasil.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

/** Tanggal terakhir yang terisi di antara beberapa kolom, atau null. */
function tanggalTerakhir(...nilai) {
  const sah = nilai.map(tanggalIso).filter(Boolean).sort();
  return sah.length ? sah[sah.length - 1] : null;
}

/** Daftar id mediator ber-koma ("15,17") menjadi angka. */
function idMediatorDaftar(teks) {
  return String(teks === null || teks === undefined ? "" : teks)
    .split(",")
    .map((x) => bacaId(x.trim()))
    .filter(Boolean);
}

/** Hubungan dari kedudukan majelis pemeriksa (majelisPemeriksaService). */
function hubunganDariKedudukan(kedudukan) {
  const teks = cleanText(kedudukan);
  if (teks === "Hakim Ketua") return "hakim-ketua";
  if (teks === "Hakim Tunggal") return "hakim-tunggal";
  if (/^Hakim Anggota\b/.test(teks)) return "hakim-anggota";
  return null;
}

// ============================================================================
// PEMBACAAN SIPP
// ============================================================================

/** Menjalankan kerja atas potongan daftar id, lalu menggabungkan barisnya. */
async function perPotongan(daftarId, kerja, ukuran = POTONGAN_IN) {
  const hasil = [];
  for (let i = 0; i < daftarId.length; i += ukuran) {
    const potong = daftarId.slice(i, i + ukuran);
    hasil.push(...(await kerja(potong, potong.map(() => "?").join(", "))));
  }
  return hasil;
}

async function identitasHakim(id) {
  const [utama] = await runQuery(
    `SELECT h.id AS id, h.nama AS nama, h.nama_gelar AS namaGelar, h.nip AS nip,
            h.jabatan AS jabatan, h.pangkat AS pangkat
       FROM hakim_pn h WHERE h.id = ? LIMIT 1`,
    [id]
  );
  if (utama) return { ...utama, sumber: "hakim_pn" };
  const [salinan] = await runQuery(
    `SELECT hk.hakim_nama AS nama
       FROM perkara_hakim_pn hk WHERE hk.hakim_id = ? ORDER BY hk.id DESC LIMIT 1`,
    [id]
  );
  return salinan ? { ...salinan, sumber: "perkara_hakim_pn" } : null;
}

/**
 * Ketua dari konfigurasi SIPP. HANYA nama konfigurasi yang disebut di sini
 * yang dibaca - sys_config juga menyimpan sandi dan kunci aplikasi.
 */
async function konfigurasiKetua() {
  return runQuery(
    `SELECT c.name AS nama, c.value AS nilai
       FROM sys_config c
      WHERE c.name IN ('NamaPN', 'KetuaPNNama', 'KetuaPNNIP', 'PltKetua', 'PlhKetua')`
  );
}

async function hakimBerNipAwal(awalan) {
  return runQuery(
    `SELECT h.id AS id, h.nip AS nip, h.nama AS nama, h.nama_gelar AS namaGelar
       FROM hakim_pn h WHERE h.nip LIKE ? ORDER BY h.id LIMIT 5`,
    [`${awalan}%`]
  );
}

/**
 * Ketua yang mengetahui eviden (kanan tanda tangan).
 *
 * NIP yang tidak 18 angka DILENGKAPI hanya bila tepat satu hakim_pn ber-NIP
 * diawali angka itu DAN bernama sama - terukur di sipp_donggala: KetuaPNNIP
 * "19820831200704100" (17 angka), hakim_pn id 32 "198208312007041001" atas
 * nama yang sama persis. Selain itu NIP apa adanya.
 *
 * Seluruh keterangannya urusan PETUGAS (konfigurasi SIPP yang perlu
 * dibetulkan) - masuk catatanOperator yang tampil di menu unduhan, bukan ke
 * dokumen yang ditandatangani Ketua.
 */
async function bacaKetua(catatanOperator) {
  const baris = await konfigurasiKetua();
  const konfigurasi = new Map(baris.map((b) => [cleanText(b.nama), cleanText(b.nilai)]));
  const nama = konfigurasi.get("KetuaPNNama") || "";
  const namaPn = konfigurasi.get("NamaPN") || "";
  if (!nama) {
    catatanOperator.push(
      "Nama Ketua tidak terisi di konfigurasi SIPP (sys_config KetuaPNNama) - tempat tanda tangan Ketua dicetak titik-titik."
    );
    return null;
  }
  for (const [kunci, sebutan] of [
    ["PltKetua", "Plt. Ketua"],
    ["PlhKetua", "Plh. Ketua"],
  ]) {
    const isi = konfigurasi.get(kunci) || "";
    if (isi) {
      catatanOperator.push(
        `Konfigurasi SIPP mencatat ${sebutan} "${isi}", tetapi tanda tangan memakai Ketua (KetuaPNNama). Periksa sebelum ditandatangani.`
      );
    }
  }
  let nip = (konfigurasi.get("KetuaPNNIP") || "").replace(/\s+/g, "");
  let sumber = "SIPP sys_config (KetuaPNNama, KetuaPNNIP)";
  if (!nip) {
    catatanOperator.push("NIP Ketua tidak terisi di konfigurasi SIPP (sys_config KetuaPNNIP) - dicetak titik-titik.");
  } else if (!/^\d{18}$/.test(nip)) {
    const calon = /^\d{8,17}$/.test(nip) ? await hakimBerNipAwal(nip) : [];
    const kunciKetua = kunciNama(nama);
    const kunciTanpaGelar = kunciNama(nama.split(",")[0]);
    const cocok = calon.filter(
      (c) =>
        /^\d{18}$/.test(cleanText(c.nip)) &&
        (kunciNama(c.namaGelar) === kunciKetua || kunciNama(c.nama) === kunciTanpaGelar)
    );
    if (cocok.length === 1) {
      const lengkap = cleanText(cocok[0].nip);
      catatanOperator.push(
        `NIP Ketua di konfigurasi SIPP (KetuaPNNIP) hanya ${nip.length} angka ("${nip}"); dilengkapi dari hakim_pn ` +
          `id ${cocok[0].id} yang bernama sama dan ber-NIP diawali angka itu: ${lengkap}. Sebaiknya konfigurasi SIPP dibetulkan.`
      );
      sumber = `SIPP sys_config (KetuaPNNama); NIP dari hakim_pn id ${cocok[0].id} karena KetuaPNNIP tidak lengkap`;
      nip = lengkap;
    } else {
      catatanOperator.push(
        `NIP Ketua di konfigurasi SIPP (KetuaPNNIP) bukan 18 angka ("${nip}") dan tidak dapat dilengkapi - periksa sebelum ditandatangani.`
      );
    }
  }
  return {
    nama,
    nip: nip || null,
    jabatan: `Ketua ${hurufJudul(namaPn) || "Pengadilan"}`,
    sumber,
  };
}

async function penunjukanOrang(id) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan
       FROM perkara_hakim_pn h
      WHERE h.hakim_id = ?
      GROUP BY h.perkara_id, h.tahapan_id
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

/**
 * Perkara yang BORANG penetapan ikrar talaknya memuat id hakim ini.
 *
 * Tabel penunjukan tidak selalu mencatat majelis ikrar: terukur di
 * sipp_donggala (majelisPemeriksaService), borang perkara_ikrar_talak
 * mencatat majelis ikrar pada 73 perkara yang tanpa baris aktif tahapan 18.
 * majelis_hakim_id berupa daftar ber-koma ("9,1,6"), dicocokkan dengan
 * FIND_IN_SET - tetap lewat id, tidak lewat nama.
 */
async function perkaraBorangIkrarOrang(id) {
  return runQuery(
    `SELECT t.perkara_id AS perkaraId
       FROM perkara_ikrar_talak t
      WHERE FIND_IN_SET(?, REPLACE(t.majelis_hakim_id, ' ', '')) > 0
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function mediatorMilikHakim(hakimId) {
  return runQuery(`SELECT md.id AS id FROM mediator md WHERE md.hakim_id = ? ORDER BY md.id ASC LIMIT 20`, [hakimId]);
}

/**
 * Tanggal daftar lewat INDEKS tabel perkara (lihat dasarPerkaraLewatIndeks di
 * rekapPetugasService: baris perkara SIPP panjang dan tidak muat di buffer).
 * SIPP yang indeksnya bernama lain menolak FORCE INDEX; jalurnya lalu jatuh
 * ke pembacaan baris biasa - lebih lambat, jawabannya sama.
 */
async function tanggalDaftarBanyak(ids) {
  try {
    return await perPotongan(ids, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS daftar
           FROM perkara p FORCE INDEX (tanggal_pendaftaran)
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    );
  } catch {
    return perPotongan(ids, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS daftar
           FROM perkara p
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    );
  }
}

/** Tanggal putusan terakhir tiap perkara - putusan terakhir menang, seperti rekap. */
async function tanggalPutusBanyak(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT pu.perkara_id AS perkaraId, DATE_FORMAT(MAX(pu.tanggal_putusan), '%Y-%m-%d') AS putus
         FROM perkara_putusan pu
        WHERE pu.perkara_id IN (${isian})
        GROUP BY pu.perkara_id`,
      potong
    )
  );
}

/** Kolom upaya hukum yang benar-benar ada, per tingkat. */
async function kolomUpayaHukum() {
  const hasil = {};
  for (const [tingkat, acuan] of Object.entries(UPAYA_HUKUM)) {
    if (!(await sippSkemaService.tabelAda(acuan.tabel))) {
      hasil[tingkat] = null;
      continue;
    }
    const ada = async (kolom) => ((await sippSkemaService.kolomAda(acuan.tabel, kolom)) ? kolom : "");
    const pihak = [];
    for (const kolom of acuan.pemberitahuanPihak) {
      if (await ada(kolom)) pihak.push(kolom);
    }
    hasil[tingkat] = {
      tabel: acuan.tabel,
      permohonan: await ada(acuan.permohonan),
      putusan: await ada(acuan.putusan),
      status: await ada(acuan.status),
      pemberitahuan: await ada(acuan.pemberitahuan),
      pemberitahuanPihak: pihak,
      proses: acuan.proses,
    };
  }
  return hasil;
}

/** Kolom tanggal satu tingkat upaya hukum yang dipakai menyaring periode. */
function kolomTanggalUpaya(k) {
  return [k.permohonan, k.putusan, k.pemberitahuan, ...k.pemberitahuanPihak].filter(Boolean);
}

/**
 * Perkara yang upaya hukumnya bergerak dalam periode: dimohonkan, diputus,
 * atau diberitahukan. Satu kueri per tingkat per potongan.
 *
 * @param rentang { mulai, batas } - batas = akhir periode, atau hari ini bila
 *   periodenya belum berakhir (batasKeadaan).
 */
async function perkaraUpayaHukumDalamPeriode(ids, kolom, rentang) {
  const hasil = new Set();
  for (const k of Object.values(kolom)) {
    if (!k) continue;
    const tanggal = kolomTanggalUpaya(k);
    if (tanggal.length === 0) continue;
    const syarat = tanggal.map((nama) => `u.${nama} BETWEEN ? AND ?`).join(" OR ");
    const nilaiTanggal = tanggal.flatMap(() => [rentang.mulai, rentang.batas]);
    const baris = await perPotongan(ids, (potong, isian) =>
      runQuery(
        `SELECT DISTINCT u.perkara_id AS perkaraId
           FROM ${k.tabel} u
          WHERE (${syarat}) AND u.perkara_id IN (${isian})`,
        [...nilaiTanggal, ...potong]
      )
    );
    baris.forEach((b) => hasil.add(String(b.perkaraId)));
  }
  return hasil;
}

/**
 * Perkara majelis ikrar yang sidang ikrarnya dalam periode - sampai batas
 * keadaan: sidang ikrar yang baru DIJADWALKAN sesudah hari ini belum terjadi.
 */
async function perkaraIkrarDalamPeriode(ids, rentang, ada) {
  const hasil = new Set();
  if (ada.ikrar) {
    const baris = await perPotongan(ids, (potong, isian) =>
      runQuery(
        `SELECT DISTINCT it.perkara_id AS perkaraId
           FROM perkara_ikrar_talak it
          WHERE it.tgl_ikrar_talak BETWEEN ? AND ? AND it.perkara_id IN (${isian})`,
        [rentang.mulai, rentang.batas, ...potong]
      )
    );
    baris.forEach((b) => hasil.add(String(b.perkaraId)));
  }
  const sidang = await perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT DISTINCT j.perkara_id AS perkaraId
         FROM perkara_jadwal_sidang j
        WHERE j.ikrar_talak = 'Y' AND j.tanggal_sidang BETWEEN ? AND ? AND j.perkara_id IN (${isian})`,
      [rentang.mulai, rentang.batas, ...potong]
    )
  );
  sidang.forEach((b) => hasil.add(String(b.perkaraId)));
  return hasil;
}

/**
 * Syarat baris perkara_mediasi milik sekumpulan mediator_id - sama dengan
 * syaratMediator di rekapPetugasService: mediator_id berupa DAFTAR ber-koma
 * ("15,17"), dicocokkan dengan FIND_IN_SET; yang kosong dicari lewat
 * perkara_mediator - tetap lewat id, tidak lewat mediator_text.
 */
function syaratMediator(ids, adaPerkaraMediator) {
  const isianId = ids.map(() => "?").join(", ");
  const bagianSql = ids.map(() => "FIND_IN_SET(?, REPLACE(m.mediator_id, ' ', '')) > 0");
  const nilai = [...ids];
  if (adaPerkaraMediator) {
    bagianSql.push(
      "((m.mediator_id IS NULL OR m.mediator_id = '') AND EXISTS (SELECT 1 FROM perkara_mediator pm " +
        `WHERE pm.perkara_id = m.perkara_id AND pm.aktif = 'Y' AND pm.mediator_id IN (${isianId})))`
    );
    nilai.push(...ids);
  }
  return { sql: `(${bagianSql.join(" OR ")})`, nilai };
}

/** Mediasi orang ini yang ditetapkan paling lambat batas keadaan. */
async function mediasiOrangIni(idMediator, rentang, ada) {
  const syarat = syaratMediator(idMediator, ada.perkaraMediator);
  return runQuery(
    `SELECT m.perkara_id AS perkaraId,
            DATE_FORMAT(m.penetapan_penunjukan_mediator, '%Y-%m-%d') AS penetapan,
            DATE_FORMAT(m.tgl_laporan_mediator, '%Y-%m-%d') AS laporan
       FROM perkara_mediasi m
      WHERE ${syarat.sql} AND m.penetapan_penunjukan_mediator <= ?
      LIMIT 5000`,
    [...syarat.nilai, rentang.batas]
  );
}

// ---- rincian seluruh perkara terpilih ----------------------------------------

async function barisPerkara(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomor, p.jenis_perkara_id AS jenisId,
              p.jenis_perkara_nama AS jenisNama, p.alur_perkara_id AS alurId,
              DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS daftar, p.prodeo AS prodeo
         FROM perkara p
        WHERE p.perkara_id IN (${isian})`,
      potong
    )
  );
}

/** Rujukan jenis perkara jarang berubah - disimpan sepuluh menit. */
const JENIS_MS = 10 * 60 * 1000;
let jenisTersimpan = null;

async function namaJenisPerkara() {
  if (jenisTersimpan && Date.now() - jenisTersimpan.waktu < JENIS_MS) return jenisTersimpan.baris;
  const baris = await runQuery(`SELECT jp.id AS id, jp.nama AS nama FROM jenis_perkara jp LIMIT 5000`);
  jenisTersimpan = { waktu: Date.now(), baris };
  return baris;
}

async function barisPihak(tabel, ids) {
  // Nama tabel dari daftar tertutup di pemanggil, bukan dari luar.
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT ph.perkara_id AS perkaraId, ph.urutan AS urutan, ph.nama AS nama, ph.id AS id
         FROM ${tabel} ph
        WHERE ph.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function perkaraGhaib(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT DISTINCT ph.perkara_id AS perkaraId
         FROM perkara_pihak2 ph
        WHERE ph.ghaib = 1 AND ph.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function barisPutusan(ids, ada) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT pu.perkara_id AS perkaraId,
              DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS putus,
              ${ada.statusPutusan ? "sp.nama" : "NULL"} AS status,
              pu.putusan_verstek AS verstek,
              DATE_FORMAT(pu.tanggal_minutasi, '%Y-%m-%d') AS minutasi,
              DATE_FORMAT(pu.tanggal_bht, '%Y-%m-%d') AS bht,
              CASE WHEN pu.amar_putusan_dok IS NOT NULL AND TRIM(pu.amar_putusan_dok) <> '' THEN 1 ELSE 0 END AS adaDok,
              CASE WHEN pu.amar_putusan_anonimisasi_dok IS NOT NULL AND TRIM(pu.amar_putusan_anonimisasi_dok) <> ''
                   THEN 1 ELSE 0 END AS adaAnonim
         FROM perkara_putusan pu
         ${ada.statusPutusan ? "LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id" : ""}
        WHERE pu.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function barisMediasi(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT m.mediasi_id AS id, m.perkara_id AS perkaraId, m.mediator_id AS mediatorId,
              m.mediator_text AS mediatorTeks, m.hasil_mediasi AS hasil,
              DATE_FORMAT(m.penetapan_penunjukan_mediator, '%Y-%m-%d') AS penetapan,
              DATE_FORMAT(m.dimulai_mediasi, '%Y-%m-%d') AS mulai,
              DATE_FORMAT(m.keputusan_mediasi, '%Y-%m-%d') AS keputusan,
              DATE_FORMAT(m.tgl_laporan_mediator, '%Y-%m-%d') AS laporan
         FROM perkara_mediasi m
        WHERE m.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function barisPerkaraMediator(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT pm.perkara_id AS perkaraId, pm.mediator_id AS mediatorId
         FROM perkara_mediator pm
        WHERE pm.aktif = 'Y' AND pm.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function barisIkrar(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT it.perkara_id AS perkaraId,
              DATE_FORMAT(it.tgl_ikrar_talak, '%Y-%m-%d') AS ikrar,
              DATE_FORMAT(it.tanggal_penetapan_sidang_ikrar, '%Y-%m-%d') AS phs
         FROM perkara_ikrar_talak it
        WHERE it.perkara_id IN (${isian})`,
      potong
    )
  );
}

/** Satu tingkat upaya hukum untuk seluruh perkara - kolom dari kolomUpayaHukum. */
async function barisUpayaHukum(k, ids) {
  const pilih = (kolom, alias, tanggal = true) =>
    kolom ? (tanggal ? `DATE_FORMAT(u.${kolom}, '%Y-%m-%d') AS ${alias}` : `u.${kolom} AS ${alias}`) : `NULL AS ${alias}`;
  const pihak = [0, 1].map((i) => pilih(k.pemberitahuanPihak[i], `pemberitahuanPihak${i + 1}`)).join(", ");
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT u.perkara_id AS perkaraId, ${pilih(k.permohonan, "permohonan")}, ${pilih(k.putusan, "putus")},
              ${pilih(k.pemberitahuan, "pemberitahuan")}, ${pihak}, ${pilih(k.status, "status", false)}
         FROM ${k.tabel} u
        WHERE u.perkara_id IN (${isian})`,
      potong
    )
  );
}

/** Tanggal INPUT pemberitahuan putusan tingkat atas, dari jejak proses SIPP. */
async function barisInputPemberitahuan(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT pr.perkara_id AS perkaraId, pr.proses_id AS prosesId,
              DATE_FORMAT(MIN(pr.diinput_tanggal), '%Y-%m-%d') AS diinput
         FROM perkara_proses pr
        WHERE pr.proses_id IN (400, 500, 571, 580, 590) AND pr.perkara_id IN (${isian})
        GROUP BY pr.perkara_id, pr.proses_id`,
      potong
    )
  );
}

async function barisJadwal(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT j.perkara_id AS perkaraId, j.id AS id, j.urutan AS urutan,
              DATE_FORMAT(j.tanggal_sidang, '%Y-%m-%d') AS tanggal,
              j.agenda AS agenda, j.alasan_ditunda AS alasanDitunda, j.ruangan AS ruangan,
              j.sidang_keliling AS keliling
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function perkaraAtributKeliling(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT DISTINCT a.perkara_id AS perkaraId
         FROM perkara_atribut a
        WHERE a.sidang_keliling = 1 AND a.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function perkaraEfiling(ids) {
  return perPotongan(ids, (potong, isian) =>
    runQuery(
      `SELECT DISTINCT e.perkara_id AS perkaraId
         FROM perkara_efiling_id e
        WHERE e.perkara_id IN (${isian})`,
      potong
    )
  );
}

async function relaasElektronik(ids) {
  return perPotongan(
    ids,
    (potong, isian) =>
      runQuery(
        `SELECT r.perkara_id AS perkaraId, DATE_FORMAT(MIN(r.tanggal_relaas), '%Y-%m-%d') AS pertama, COUNT(*) AS jumlah
           FROM perkara_pelaksanaan_relaas r
          WHERE r.ket_temu = 'E' AND r.perkara_id IN (${isian})
          GROUP BY r.perkara_id`,
        potong
      ),
    POTONGAN_PINDAI
  );
}

async function barisDirput(ids, ada) {
  return perPotongan(
    ids,
    (potong, isian) =>
      runQuery(
        `SELECT d.perkara_id AS perkaraId, d.filename AS berkas,
                ${ada.dirputRef ? "r.urutan" : "NULL"} AS urutan,
                DATE_FORMAT(d.created_date, '%Y-%m-%d') AS dibuat, d.link_dirput AS tautan,
                d.pengajuan_id AS pengajuan, d.id AS id
           FROM dirput_dokumen d
           ${ada.dirputRef ? "LEFT JOIN dirput_dokumen_ref r ON r.dokumen_ref_id = d.dokumen_ref_id" : ""}
          WHERE d.perkara_id IN (${isian})`,
        potong
      ),
    POTONGAN_PINDAI
  );
}

/**
 * Hari terbit di Direktori Putusan: unggahan "Putusan berhasil dibuat/
 * dimodifikasi" yang berhasil (status 1) pertama. Terukur di sipp_donggala:
 * status 1 hanya berbunyi dua itu (9.989 dan 470 baris).
 */
async function barisDirputBerhasil(ids) {
  return perPotongan(
    ids,
    (potong, isian) =>
      runQuery(
        `SELECT a.perkara_id AS perkaraId, DATE_FORMAT(MIN(a.last_tried), '%Y-%m-%d') AS berhasil
           FROM dirput_antrian a
          WHERE a.status = 1 AND a.perkara_id IN (${isian})
          GROUP BY a.perkara_id`,
        potong
      ),
    POTONGAN_PINDAI
  );
}

// ============================================================================
// PENYUSUN
// ============================================================================

function kelompokkan(baris) {
  const peta = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = String(b.perkaraId);
    if (!peta.has(kunci)) peta.set(kunci, []);
    peta.get(kunci).push(b);
  }
  return peta;
}

/** Pihak satu sisi: nama urut menurut urutan SIPP, lalu id baris. */
function namaUrut(daftar) {
  return [...(daftar || [])]
    .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0))
    .map((x) => cleanText(x.nama))
    .filter(Boolean);
}

/** Klasifikasi baris Direktori Putusan: putusan (99) atau anonimisasi (100). */
function jenisDirput(b) {
  const urutan = Number(b.urutan);
  if (urutan === 99) return "putusan";
  if (urutan === 100) return "anonimisasi";
  const berkas = cleanText(b.berkas).toLowerCase();
  if (/_putusan_akhir\.[a-z0-9]+$/.test(berkas)) return "putusan";
  if (/_putusan_anonimisasi\.[a-z0-9]+$/.test(berkas)) return "anonimisasi";
  return "";
}

/**
 * Menyusun satu BarisEvidenSkp dari seluruh bacaan.
 *
 * `bacaan` memuat peta per perkara; ruas yang bacaannya GAGAL diterima
 * sebagai null pada petanya (bukan Map kosong), dan barisnya ikut null.
 */
function susunBaris(perkaraId, bahan) {
  // batas: akhir periode, atau hari ini bila periodenya belum berakhir.
  const { bacaan, batas, idMediator } = bahan;
  const p = bacaan.perkara.get(perkaraId) || {};
  const jenisPerkaraId = p.jenisId === null || p.jenisId === undefined ? null : Number(p.jenisId);
  const alurPerkaraId = p.alurId === null || p.alurId === undefined ? null : Number(p.alurId);
  const jenisPerkara =
    (bacaan.namaJenis && bacaan.namaJenis.get(String(p.jenisId))) || cleanText(p.jenisNama) || "Jenis perkara tidak tercatat";
  const nomorPerkara = cleanText(p.nomor);

  // ---- para pihak: sebutan dari alur/jenis lewat sebutanPihakService ----
  const sebutan = sebutanPihakPerkara({ alurPerkaraId, jenisPerkaraId, jenisPerkaraNama: jenisPerkara, nomorPerkara });
  const pihak = {
    satu: { sebutan: sebutan.satu, nama: namaUrut(bacaan.pihak1 && bacaan.pihak1.get(perkaraId)) },
    dua: { sebutan: sebutan.dua, nama: namaUrut(bacaan.pihak2 && bacaan.pihak2.get(perkaraId)) },
    turut: null,
  };
  const turut = namaUrut(bacaan.pihak4 && bacaan.pihak4.get(perkaraId));
  if (turut.length) pihak.turut = { sebutan: `Turut ${sebutan.dua}`, nama: turut };

  // ---- penunjukan: majelisPemeriksaService ----
  const tunjuk = bacaan.penunjukan ? bacaan.penunjukan.get(perkaraId) : null;
  const susunHakim = (daftar) =>
    (daftar || []).map((h) => ({
      kedudukan: cleanText(h.kedudukan),
      nama: cleanText(h.nama),
      hakimId: h.hakimId === null || h.hakimId === undefined ? null : String(h.hakimId),
    }));
  const majelis = tunjuk ? susunHakim(tunjuk.pemeriksa.hakim) : [];
  // Penunjukan tahapan 18 bila ada, selainnya borang ikrar (ikrarLengkap).
  const ikrarGabung = tunjuk ? majelisPemeriksaService.ikrarLengkap(tunjuk) : null;
  const majelisIkrar = ikrarGabung ? susunHakim(ikrarGabung.hakim) : [];
  // Satu nama sekali: petugas yang sama dapat aktif pada dua tahapan (terukur:
  // perkara 9215, juru sita pemeriksaan dan juru sita kasasi orang yang sama).
  const namaUnik = (daftar) => [...new Set(daftar.map((x) => cleanText(x.nama)).filter(Boolean))];
  const panitera = tunjuk ? namaUnik(tunjuk.pemeriksa.panitera) : [];
  const jurusita = tunjuk ? namaUnik(tunjuk.pemeriksa.jurusita) : [];

  // ---- putusan: putusan terakhir menang ----
  const putusanSemua = bacaan.putusan ? bacaan.putusan.get(perkaraId) || [] : null;
  const putusan = putusanSemua
    ? [...putusanSemua].sort((a, b) => String(tanggalIso(b.putus) || "").localeCompare(String(tanggalIso(a.putus) || "")))[0] || null
    : null;
  const tanggalPutusan = putusan ? tanggalIso(putusan.putus) : null;
  const verstekTeks = putusan ? cleanText(putusan.verstek).toUpperCase() : "";

  // ---- Direktori Putusan ----
  const dirput = bacaan.dirput ? bacaan.dirput.get(perkaraId) || [] : null;
  const tanggalDirput = (jenis) => {
    if (!dirput) return null;
    const tanggal = dirput.filter((d) => jenisDirput(d) === jenis).map((d) => tanggalIso(d.dibuat)).filter(Boolean).sort();
    return tanggal[0] || null;
  };
  let direktori = null;
  if (dirput) {
    const bertaut = dirput
      .filter((d) => /^https?:\/\//i.test(cleanText(d.tautan)))
      .sort(
        (a, b) =>
          (Number(a.pengajuan) === 1 ? 0 : 1) - (Number(b.pengajuan) === 1 ? 0 : 1) ||
          String(tanggalIso(b.dibuat) || "").localeCompare(String(tanggalIso(a.dibuat) || "")) ||
          (Number(b.id) || 0) - (Number(a.id) || 0)
      );
    const terbit = bacaan.dirputBerhasil ? bacaan.dirputBerhasil.get(perkaraId) : null;
    direktori = {
      url: bertaut.length ? cleanText(bertaut[0].tautan) : null,
      tanggal: bertaut.length && terbit && terbit.length ? tanggalIso(terbit[0].berhasil) : null,
    };
  }

  // ---- mediasi ----
  const mediasiSemua = bacaan.mediasi ? bacaan.mediasi.get(perkaraId) || [] : null;
  const perkaraMediator = bacaan.perkaraMediator ? bacaan.perkaraMediator.get(perkaraId) || [] : [];
  const milikOrangIni = (m) => {
    const daftar = idMediatorDaftar(m.mediatorId);
    if (daftar.length) return daftar.some((x) => idMediator.includes(x));
    return perkaraMediator.some((pm) => idMediator.includes(Number(pm.mediatorId)));
  };
  let mediasi = null;
  let rentangMediasi = mediasiSemua ? [] : undefined;
  if (mediasiSemua && mediasiSemua.length) {
    const urut = [...mediasiSemua].sort(
      (a, b) =>
        String(tanggalIso(b.penetapan) || "").localeCompare(String(tanggalIso(a.penetapan) || "")) ||
        (Number(b.id) || 0) - (Number(a.id) || 0)
    );
    const olehnya = urut.filter(milikOrangIni);
    const pilihan = olehnya[0] || urut[0];
    const sandi = cleanText(pilihan.hasil).toUpperCase();
    const arti = HASIL_MEDIASI[sandi];
    mediasi = {
      mediator: cleanText(pilihan.mediatorTeks) || null,
      olehOrangIni: olehnya.length > 0,
      hasil: arti ? arti.teks : sandi || null,
      berhasil: arti ? arti.berhasil : null,
      tanggalPenetapan: tanggalIso(pilihan.penetapan),
      tanggalLaporan: tanggalIso(pilihan.laporan),
    };
    rentangMediasi = mediasiSemua
      .filter((m) => tanggalIso(m.mulai))
      .map((m) => ({ mulai: tanggalIso(m.mulai), selesai: tanggalIso(m.keputusan) }));
  }

  // ---- ikrar talak ----
  let ikrar = null;
  if (bacaan.ikrar) {
    const it = (bacaan.ikrar.get(perkaraId) || [])[0];
    if (it) ikrar = { tanggalIkrar: tanggalIso(it.ikrar), tanggalPhsIkrar: tanggalIso(it.phs) };
  }

  // ---- upaya hukum ----
  const upaya = (tingkat) => {
    const peta = bacaan.upaya[tingkat];
    if (!peta) return null;
    const baris = (peta.get(perkaraId) || [])
      .slice()
      .sort((a, b) => String(tanggalIso(b.permohonan) || "").localeCompare(String(tanggalIso(a.permohonan) || "")))[0];
    if (!baris) return null;
    const input = bacaan.inputPemberitahuan
      ? (bacaan.inputPemberitahuan.get(perkaraId) || [])
          .filter((x) => UPAYA_HUKUM[tingkat].proses.includes(Number(x.prosesId)))
          .map((x) => tanggalIso(x.diinput))
          .filter(Boolean)
          .sort()
      : [];
    return {
      tanggalPermohonan: tanggalIso(baris.permohonan),
      tanggalPemberitahuan:
        tanggalIso(baris.pemberitahuan) || tanggalTerakhir(baris.pemberitahuanPihak1, baris.pemberitahuanPihak2),
      tanggalInputPemberitahuan: input[0] || null,
      putusan: cleanText(baris.status) || null,
      tanggalPutusan: tanggalIso(baris.putus),
    };
  };

  // ---- penanda dari jadwal, dipilih per akhir periode ----
  const jadwal = bacaan.jadwal ? bacaan.jadwal.get(perkaraId) || [] : null;
  const luarGedung = jadwal ? sidangLuarGedungDariJadwal(jadwal, batas) : null;
  const atributKeliling = bacaan.atributKeliling ? bacaan.atributKeliling.has(perkaraId) : false;
  const sidangKeliling = luarGedung ? luarGedung.some((s) => !s.terpadu) || atributKeliling : null;
  const itsbatTerpadu = luarGedung ? jenisPerkaraId === JENIS_ITSBAT && luarGedung.some((s) => s.terpadu) : null;

  let eSummons = null;
  if (bacaan.eSummons) {
    const e = (bacaan.eSummons.get(perkaraId) || [])[0];
    // Relaas elektronik tanpa tanggal tetap dihitung ada - tanggalnya saja
    // yang tidak terbaca.
    eSummons = Boolean(e && Number(e.jumlah) > 0 && (!tanggalIso(e.pertama) || tanggalIso(e.pertama) <= batas));
  }

  const prodeoTeks = cleanText(p.prodeo);
  return {
    perkaraId,
    nomorPerkara,
    jenisPerkara,
    jenisPerkaraId: Number.isFinite(jenisPerkaraId) ? jenisPerkaraId : null,
    alurPerkaraId: Number.isFinite(alurPerkaraId) ? alurPerkaraId : null,
    tanggalDaftar: tanggalIso(p.daftar),
    hubungan: [],
    pihak,
    majelis,
    majelisIkrar,
    panitera,
    jurusita,
    musyawarah: jadwal ? musyawarahDariJadwal(jadwal, batas) : null,
    tanggalPutusan,
    statusPutusan: tanggalPutusan && putusan ? cleanText(putusan.status) || null : null,
    verstek: tanggalPutusan ? (verstekTeks === "Y" ? true : verstekTeks === "T" ? false : null) : null,
    tanggalMinutasi: putusan ? tanggalIso(putusan.minutasi) : null,
    tanggalBht: putusan ? tanggalIso(putusan.bht) : null,
    mediasi: mediasiSemua ? mediasi : null,
    rentangMediasi,
    ikrar,
    banding: upaya("banding"),
    kasasi: upaya("kasasi"),
    pk: upaya("pk"),
    sidangKeliling,
    sidangLuarGedung: luarGedung || undefined,
    itsbatTerpadu,
    ghaib: bacaan.ghaib ? bacaan.ghaib.has(perkaraId) : null,
    prodeo: prodeoTeks === "1" ? true : prodeoTeks === "0" ? false : null,
    ecourt: bacaan.efiling ? bacaan.efiling.has(perkaraId) : null,
    eSummons,
    unggahPutusan: putusanSemua ? { ada: Boolean(putusan && Number(putusan.adaDok) === 1), tanggal: tanggalDirput("putusan") } : null,
    anonimisasi: putusanSemua
      ? { ada: Boolean(putusan && Number(putusan.adaAnonim) === 1), tanggal: tanggalDirput("anonimisasi") }
      : null,
    direktori,
  };
}

// ---- singgahan ------------------------------------------------------------------

const singgahan = new Map();

function ambilSinggahan(kunci, sekarang) {
  const isi = singgahan.get(kunci);
  if (!isi) return null;
  if (sekarang - isi.waktu > SINGGAHAN_MS) {
    singgahan.delete(kunci);
    return null;
  }
  return isi.data;
}

function simpanSinggahan(kunci, data, sekarang) {
  singgahan.set(kunci, { waktu: sekarang, data });
  while (singgahan.size > SINGGAHAN_MAKS) singgahan.delete(singgahan.keys().next().value);
}

/** Dipakai uji, dan bila SIPP baru saja diperbaiki dan angkanya harus segar. */
function kosongkanSinggahan() {
  singgahan.clear();
  jenisTersimpan = null;
}

/**
 * Seluruh fakta eviden satu orang untuk satu periode.
 *
 * @param masukan { peran, id, tahun, periode } - teks dari alamat.
 * @param opsi.hariIni tanggal acuan YYYY-MM-DD; bawaannya hari ini menurut
 *   zona pengadilan (Asia/Makassar).
 * @param opsi.sekarang milidetik epoch untuk singgahan dan dihitungPada.
 */
async function evidenSkp(masukan = {}, opsi = {}) {
  const hariIni = /^\d{4}-\d{2}-\d{2}$/.test(String(opsi.hariIni || "")) ? opsi.hariIni : tanggalHariIni();
  const sekarang = Number.isFinite(opsi.sekarang) ? opsi.sekarang : Date.now();
  const periksa = periksaMasukan(masukan, hariIni);
  if (!periksa.ok) return periksa;
  const { peran, id, tahun } = periksa.pilihan;
  const periode = susunPeriode(periksa.pilihan.periode, tahun);

  const kunciSinggahan = `${peran}:${id}:${periode.kunci}:${tahun}:${hariIni}`;
  const tersimpan = ambilSinggahan(kunciSinggahan, sekarang);
  if (tersimpan) return tersimpan;

  // Satu batas keadaan untuk seluruh jalur: akhir periode, atau hari ini bila
  // periodenya belum berakhir.
  const rentang = { mulai: periode.mulai, batas: batasKeadaan(periode, hariIni) };

  // ==========================================================================
  // TIGA WADAH KETERANGAN - DAN SIAPA PEMBACANYA
  // ==========================================================================
  //
  //   galat            bagian SIPP yang TIDAK TERBACA - kalimat ramah untuk
  //                    pembaca dokumen ("Direktori Putusan (alamat ...)");
  //                    dokumen menyebutnya, sebab angkanya jadi tidak utuh
  //   catatanOperator  keterangan untuk PETUGAS: konfigurasi SIPP yang perlu
  //                    dibetulkan, sumber borang, nama tabel dan kolom - tampil
  //                    di menu unduhan, TIDAK tercetak di dokumen yang
  //                    ditandatangani Ketua
  //   catatan          keterangan untuk pembaca dokumen dari bot (kini kosong:
  //                    aturan dan dasar hitung ditulis katalog portal)
  //
  // Galat MySQL mentah tidak masuk ketiganya - isinya nama tabel, kolom, dan
  // potongan kueri. Rinciannya ke log bot.
  const galat = [];
  const catatan = [];
  const catatanOperator = [];
  const pesanGalat = (error) => String((error && error.message) || error).slice(0, 500);
  const catatLog = (bagian, error) => console.warn(`[evidenSkp] ${bagian} tidak terbaca (hakim ${id}, ${periode.kunci} ${tahun}): ${pesanGalat(error)}`);
  const aman = async (bagian, kerja, cadangan) => {
    try {
      return await kerja();
    } catch (error) {
      catatLog(bagian, error);
      galat.push(bagian);
      return cadangan;
    }
  };
  // Bacaan INTI: tanpanya daftar perkaranya sendiri tidak dapat dipastikan.
  // Kegagalannya menggagalkan seluruh eviden (502) - eviden berisi "0 perkara"
  // yang lahir dari kueri gagal akan ditandatangani sebagai pernyataan yang
  // keliru, bukan keterangan yang kosong.
  const fatal = [];
  const inti = async (bagian, kerja) => {
    try {
      return await kerja();
    } catch (error) {
      catatLog(bagian, error);
      fatal.push(bagian);
      return null;
    }
  };
  const gagalInti = () => ({
    ok: false,
    status: 502,
    alasan: "sipp_tidak_terbaca",
    error: kalimatGagalInti(fatal),
  });

  const [
    adaStatusPutusan,
    adaMediasi,
    adaPerkaraMediator,
    adaMediator,
    adaIkrar,
    adaEfiling,
    adaRelaas,
    adaDirput,
    adaDirputRef,
    adaDirputAntrian,
    adaAtribut,
    adaJenis,
    adaPihak4,
    adaProses,
    adaKolomGhaib,
  ] = await Promise.all([
    sippSkemaService.tabelAda("status_putusan"),
    sippSkemaService.tabelAda("perkara_mediasi"),
    sippSkemaService.tabelAda("perkara_mediator"),
    sippSkemaService.tabelAda("mediator"),
    sippSkemaService.tabelAda("perkara_ikrar_talak"),
    sippSkemaService.tabelAda("perkara_efiling_id"),
    sippSkemaService.tabelAda("perkara_pelaksanaan_relaas"),
    sippSkemaService.tabelAda("dirput_dokumen"),
    sippSkemaService.tabelAda("dirput_dokumen_ref"),
    sippSkemaService.tabelAda("dirput_antrian"),
    sippSkemaService.tabelAda("perkara_atribut"),
    sippSkemaService.tabelAda("jenis_perkara"),
    sippSkemaService.tabelAda("perkara_pihak4"),
    sippSkemaService.tabelAda("perkara_proses"),
    sippSkemaService.kolomAda("perkara_pihak2", "ghaib"),
  ]);
  const adaBorangIkrar = await sippSkemaService.kolomAda("perkara_ikrar_talak", "majelis_hakim_id");
  const ada = {
    statusPutusan: adaStatusPutusan,
    perkaraMediator: adaPerkaraMediator,
    ikrar: adaIkrar,
    dirputRef: adaDirputRef,
  };

  // ---- tahap 1: identitas, Ketua, penunjukan, id mediator ---------------------
  // Nama bagian di bawah adalah kalimat untuk PEMBACA (galat) dan petugas
  // (kalimat 502) - bukan nama tabel.
  const [identitas, ketua, penunjukan, borangIkrar, milikMediator, kolomUpayaTerbaca] = await Promise.all([
    inti("identitas hakim", () => identitasHakim(id)),
    aman("Nama dan NIP Ketua", () => bacaKetua(catatanOperator), null),
    inti("penunjukan majelis hakim", () => penunjukanOrang(id)),
    adaBorangIkrar ? inti("penetapan majelis ikrar talak", () => perkaraBorangIkrarOrang(id)) : Promise.resolve([]),
    adaMediator ? aman("Daftar mediator hakim ini", () => mediatorMilikHakim(id), []) : Promise.resolve([]),
    aman("Data banding, kasasi, dan PK", () => kolomUpayaHukum(), null),
  ]);
  if (fatal.length) return gagalInti();
  if (!identitas && !penunjukan.length && !borangIkrar.length) {
    return { ok: false, status: 404, alasan: "petugas_tidak_ditemukan", error: `Tidak ada hakim dengan ID SIPP ${id}.` };
  }

  const idPemeriksa = [];
  // Calon majelis ikrar: penunjukan tahapan 18, DAN borang ikrar - yang kedua
  // mencatat majelis ikrar yang tidak punya baris penunjukan aktif.
  const idIkrar = borangIkrar.map((b) => String(b.perkaraId));
  for (const b of penunjukan || []) {
    const kunci = String(b.perkaraId);
    if (Number(b.tahapan) === TAHAPAN_IKRAR) idIkrar.push(kunci);
    else idPemeriksa.push(kunci);
  }
  const unik = (daftar) => [...new Set(daftar)];
  // null = kolomnya tidak terbaca (sudah disebut di galat) - dibedakan dari
  // tabel yang memang tidak ada di SIPP ini.
  const kolomUpaya = kolomUpayaTerbaca || { banding: null, kasasi: null, pk: null };
  const calonPemeriksa = unik(idPemeriksa);
  const calonIkrar = unik(idIkrar);
  const idMediator = (milikMediator || []).map((m) => bacaId(m.id)).filter(Boolean);

  // ---- tahap 2: saringan periode tiap jalan masuk --------------------------
  const [daftarPemeriksa, putusPemeriksa, upayaPeriode, ikrarPeriode, mediasiMentah] = await Promise.all([
    inti("tanggal pendaftaran perkara", () => tanggalDaftarBanyak(calonPemeriksa)),
    inti("tanggal putusan", () => tanggalPutusBanyak(calonPemeriksa)),
    aman(
      "Banding, kasasi, dan PK yang bergerak dalam periode",
      () => perkaraUpayaHukumDalamPeriode(calonPemeriksa, kolomUpaya, rentang),
      new Set()
    ),
    inti("sidang ikrar talak", () => perkaraIkrarDalamPeriode(calonIkrar, rentang, ada)),
    adaMediasi && idMediator.length
      ? inti("mediasi oleh hakim ini", () => mediasiOrangIni(idMediator, rentang, ada))
      : Promise.resolve([]),
  ]);
  if (fatal.length) return gagalInti();

  const petaDaftar = new Map(daftarPemeriksa.map((b) => [String(b.perkaraId), tanggalIso(b.daftar)]));
  const petaPutus = new Map(putusPemeriksa.map((b) => [String(b.perkaraId), tanggalIso(b.putus)]));
  const masukPemeriksa = new Set(
    calonPemeriksa.filter((pid) => {
      const daftar = petaDaftar.get(pid);
      const putus = petaPutus.get(pid);
      return Boolean(daftar) && daftar <= rentang.batas && (!putus || putus >= rentang.mulai);
    })
  );

  // Mediasi: penetapan <= batas sudah disaring kueri; laporan >= awal, atau
  // belum ada laporan pada perkara yang belum putus sebelum periode.
  const perkaraMediasi = unik(mediasiMentah.map((m) => String(m.perkaraId)));
  const putusMediasiBaris = perkaraMediasi.length
    ? await inti("tanggal putusan perkara yang dimediasi", () => tanggalPutusBanyak(perkaraMediasi))
    : [];
  if (fatal.length) return gagalInti();
  const putusMediasi = new Map(putusMediasiBaris.map((b) => [String(b.perkaraId), tanggalIso(b.putus)]));
  const masukMediator = new Set(
    mediasiMentah
      .filter((m) => {
        const laporan = tanggalIso(m.laporan);
        if (laporan) return laporan >= rentang.mulai;
        const putus = putusMediasi.get(String(m.perkaraId));
        return !putus || putus >= rentang.mulai;
      })
      .map((m) => String(m.perkaraId))
  );

  const semuaId = unik([...masukPemeriksa, ...upayaPeriode, ...ikrarPeriode, ...masukMediator]).sort(
    (a, b) => Number(a) - Number(b)
  );

  // ---- tahap 3: pemeriksa dan ikrar dari modul bersama ---------------------
  const penunjukanPerkara = semuaId.length
    ? await inti("majelis pemeriksa dan majelis ikrar", () => majelisPemeriksaService.penunjukanPerkaraBanyak(semuaId))
    : new Map();
  if (fatal.length) return gagalInti();

  // ---- tahap 4: rincian seluruh perkara terpilih, bersamaan -----------------
  const baca = (nama, syarat, kerja) => (syarat && semuaId.length ? aman(nama, kerja, null) : Promise.resolve(syarat ? [] : null));
  const [
    perkaraBaris,
    namaJenis,
    pihak1,
    pihak2,
    pihak4,
    ghaib,
    putusan,
    mediasi,
    perkaraMediatorBaris,
    ikrar,
    banding,
    kasasi,
    pk,
    inputPemberitahuan,
    jadwal,
    atribut,
    efiling,
    eSummons,
    dirput,
    dirputBerhasil,
  ] = await Promise.all([
    semuaId.length ? inti("rincian perkara", () => barisPerkara(semuaId)) : Promise.resolve([]),
    adaJenis ? aman("Nama jenis perkara", () => namaJenisPerkara(), []) : Promise.resolve([]),
    baca("Nama pihak pertama (penggugat/pemohon)", true, () => barisPihak("perkara_pihak1", semuaId)),
    baca("Nama pihak kedua (tergugat/termohon)", true, () => barisPihak("perkara_pihak2", semuaId)),
    baca("Nama turut tergugat", adaPihak4, () => barisPihak("perkara_pihak4", semuaId)),
    baca("Penanda ghaib", adaKolomGhaib, () => perkaraGhaib(semuaId)),
    // Inti: tanpa putusan, seluruh perkara terbaca "belum putus".
    semuaId.length ? inti("putusan", () => barisPutusan(semuaId, ada)) : Promise.resolve([]),
    baca("Data mediasi", adaMediasi, () => barisMediasi(semuaId)),
    baca("Mediator perkara", adaPerkaraMediator, () => barisPerkaraMediator(semuaId)),
    baca("Data ikrar talak", adaIkrar, () => barisIkrar(semuaId)),
    baca("Data banding", Boolean(kolomUpaya.banding), () => barisUpayaHukum(kolomUpaya.banding, semuaId)),
    baca("Data kasasi", Boolean(kolomUpaya.kasasi), () => barisUpayaHukum(kolomUpaya.kasasi, semuaId)),
    baca("Data peninjauan kembali", Boolean(kolomUpaya.pk), () => barisUpayaHukum(kolomUpaya.pk, semuaId)),
    baca("Tanggal input pemberitahuan putusan banding/kasasi/PK", adaProses, () => barisInputPemberitahuan(semuaId)),
    baca("Jadwal sidang (musyawarah majelis, sidang keliling, itsbat terpadu)", true, () => barisJadwal(semuaId)),
    baca("Penanda sidang keliling pada atribut perkara", adaAtribut, () => perkaraAtributKeliling(semuaId)),
    baca("Penanda e-Court", adaEfiling, () => perkaraEfiling(semuaId)),
    baca("Relaas elektronik (e-Summons)", adaRelaas, () => relaasElektronik(semuaId)),
    baca("Direktori Putusan (alamat dan tanggal unggah putusan)", adaDirput, () => barisDirput(semuaId, ada)),
    baca("Tanggal terbit di Direktori Putusan", adaDirputAntrian, () => barisDirputBerhasil(semuaId)),
  ]);
  if (fatal.length) return gagalInti();

  // Yang memang TIDAK ADA di SIPP ini disebut, bukan diam: kalimat pembaca di
  // galat (dokumen menyebutnya), nama tabelnya untuk petugas.
  const tidakAda = [
    [adaIkrar, "Data ikrar talak", "perkara_ikrar_talak"],
    [adaEfiling, "Penanda e-Court", "perkara_efiling_id"],
    [adaDirput, "Direktori Putusan", "dirput_dokumen"],
    [adaMediasi, "Data mediasi", "perkara_mediasi"],
    [adaKolomGhaib, "Penanda ghaib", "perkara_pihak2.ghaib"],
    [adaRelaas, "Relaas elektronik (e-Summons)", "perkara_pelaksanaan_relaas"],
    ...Object.entries(kolomUpayaTerbaca || {}).map(([tingkat, k]) => [
      Boolean(k),
      { banding: "Data banding", kasasi: "Data kasasi", pk: "Data peninjauan kembali" }[tingkat],
      UPAYA_HUKUM[tingkat].tabel,
    ]),
  ].filter(([adaTabel]) => !adaTabel);
  for (const [, bagian] of tidakAda) galat.push(`${bagian} (tidak tersedia di SIPP ini)`);
  if (tidakAda.length) {
    catatanOperator.push(`Tidak ada di SIPP ini, ruasnya dikosongkan: ${tidakAda.map(([, , tabel]) => tabel).join(", ")}.`);
  }

  const bacaan = {
    perkara: new Map(perkaraBaris.map((b) => [String(b.perkaraId), b])),
    namaJenis: new Map((namaJenis || []).map((x) => [String(x.id), cleanText(x.nama)])),
    pihak1: pihak1 ? kelompokkan(pihak1) : null,
    pihak2: pihak2 ? kelompokkan(pihak2) : null,
    pihak4: pihak4 ? kelompokkan(pihak4) : null,
    ghaib: ghaib ? new Set(ghaib.map((b) => String(b.perkaraId))) : null,
    putusan: putusan ? kelompokkan(putusan) : null,
    mediasi: mediasi ? kelompokkan(mediasi) : null,
    perkaraMediator: perkaraMediatorBaris ? kelompokkan(perkaraMediatorBaris) : null,
    ikrar: ikrar ? kelompokkan(ikrar) : null,
    upaya: {
      banding: banding ? kelompokkan(banding) : null,
      kasasi: kasasi ? kelompokkan(kasasi) : null,
      pk: pk ? kelompokkan(pk) : null,
    },
    inputPemberitahuan: inputPemberitahuan ? kelompokkan(inputPemberitahuan) : null,
    jadwal: jadwal ? kelompokkan(jadwal) : null,
    atributKeliling: atribut ? new Set(atribut.map((b) => String(b.perkaraId))) : null,
    efiling: efiling ? new Set(efiling.map((b) => String(b.perkaraId))) : null,
    eSummons: eSummons ? kelompokkan(eSummons) : null,
    dirput: dirput ? kelompokkan(dirput) : null,
    dirputBerhasil: dirputBerhasil ? kelompokkan(dirputBerhasil) : null,
    penunjukan: penunjukanPerkara,
  };

  const baris = [];
  let tidakMemeriksa = 0;
  let kedudukanTakDikenal = 0;
  let ikrarDariBorang = 0;
  let ikrarTakTerpasang = 0;
  for (const perkaraId of semuaId) {
    // Perkara yang penunjukannya ada tetapi barisnya tidak ada di tabel perkara
    // tidak dikarang.
    if (!bacaan.perkara.has(perkaraId)) continue;
    const satu = susunBaris(perkaraId, { bacaan, batas: rentang.batas, idMediator });

    const hubungan = [];
    const tunjuk = penunjukanPerkara.get(perkaraId);
    if (masukPemeriksa.has(perkaraId) || upayaPeriode.has(perkaraId)) {
      const milik = tunjuk ? tunjuk.pemeriksa.hakim.filter((h) => Number(h.hakimId) === id) : [];
      if (milik.length === 0) {
        if (masukPemeriksa.has(perkaraId)) tidakMemeriksa += 1;
      } else {
        for (const h of milik) {
          const jenis = hubunganDariKedudukan(h.kedudukan);
          if (jenis && !hubungan.includes(jenis)) hubungan.push(jenis);
          if (!jenis) kedudukanTakDikenal += 1;
        }
      }
    }
    // Majelis ikrar dari ikrarLengkap: penunjukan tahapan 18 bila ada,
    // selainnya borang ikrar - aturan yang sama dengan Status Perkara.
    if (ikrarPeriode.has(perkaraId)) {
      const ikrar = majelisPemeriksaService.ikrarLengkap(tunjuk);
      const milik = ikrar ? ikrar.hakim.filter((h) => Number(h.hakimId) === id) : [];
      if (milik.length > 0) {
        hubungan.push("majelis-ikrar");
        if (milik.every((h) => h.sumber === "penetapanIkrar")) ikrarDariBorang += 1;
      } else if (borangIkrar.some((b) => String(b.perkaraId) === perkaraId)) {
        // Id-nya ada di borang, tetapi borang itu tidak dapat memasangkan id
        // dengan nama (jumlahnya berbeda) - tidak ditebak siapa kedudukannya.
        ikrarTakTerpasang += 1;
      }
    }
    if (masukMediator.has(perkaraId)) hubungan.push("mediator");
    if (hubungan.length === 0) continue;
    satu.hubungan = hubungan;
    baris.push(satu);
  }
  baris.sort(
    (a, b) =>
      String(a.tanggalDaftar || "").localeCompare(String(b.tanggalDaftar || "")) ||
      Number(a.perkaraId) - Number(b.perkaraId)
  );

  // ---- keterangan untuk PETUGAS - menu unduhan, bukan dokumen -------------
  if (tidakMemeriksa > 0) {
    catatanOperator.push(
      `${tidakMemeriksa} perkara dalam periode ini pernah memuat hakim ini pada penunjukannya, tetapi ia tidak menjabat ` +
        `pada hari putusan (atau tidak aktif pada perkara yang belum putus) - tidak dihitung sebagai majelis pemeriksa.`
    );
  }
  if (kedudukanTakDikenal > 0) {
    catatanOperator.push(
      `${kedudukanTakDikenal} penunjukan berkedudukan yang tidak dikenali (bukan ketua, anggota, atau hakim tunggal) - tidak dihitung.`
    );
  }
  if (ikrarDariBorang > 0) {
    catatanOperator.push(
      `Majelis ikrar talak pada ${ikrarDariBorang} perkara dibaca dari blangko penetapan ikrar talak SIPP ` +
        `(perkara_ikrar_talak), sebab penunjukan majelis ikrarnya tidak tercatat.`
    );
  }
  if (ikrarTakTerpasang > 0) {
    catatanOperator.push(
      `${ikrarTakTerpasang} perkara memuat ID hakim ini pada blangko ikrar talak, tetapi blangko itu tidak dapat ` +
        `memasangkan ID dengan nama majelisnya - tidak dihitung sebagai majelis ikrar.`
    );
  }
  const identitasBersih = identitas || {};
  const nama = cleanText(identitasBersih.namaGelar) || cleanText(identitasBersih.nama) || `Hakim ${id}`;
  if (identitas && identitas.sumber === "perkara_hakim_pn") {
    catatanOperator.push(`Hakim ID ${id} tidak ada di hakim_pn; namanya dari salinan penunjukan terakhir dan NIP-nya kosong.`);
  }
  const jabatanSipp = isianKosong(identitasBersih.jabatan) ? "" : cleanText(identitasBersih.jabatan);
  const pangkatSipp = isianKosong(identitasBersih.pangkat) ? "" : cleanText(identitasBersih.pangkat);
  if (identitas && identitas.sumber === "hakim_pn") {
    if (!jabatanSipp) catatanOperator.push("Jabatan hakim tidak terisi di SIPP (hakim_pn.jabatan) - ditulis \"Hakim\".");
    if (!pangkatSipp) catatanOperator.push("Pangkat/golongan hakim tidak terisi di SIPP (hakim_pn.pangkat) - dicetak \"-\".");
  }
  const nip = isianKosong(identitasBersih.nip) ? null : cleanText(identitasBersih.nip);
  if (identitas && identitas.sumber === "hakim_pn" && nip && !/^\d{18}$/.test(nip)) {
    catatanOperator.push(`NIP hakim di SIPP bukan 18 angka ("${nip}") - periksa hakim_pn sebelum ditandatangani.`);
  }

  const data = {
    ok: true,
    peran,
    periode,
    orang: {
      id: String(id),
      nama,
      nip,
      jabatan: jabatanSipp || "Hakim",
      pangkatGolongan: pangkatSipp || null,
    },
    ketua: ketua || null,
    aturanPeriode: kalimatAturanPeriode(periode),
    baris,
    catatan,
    catatanOperator,
    galat,
    dihitungPada: new Date(sekarang).toISOString(),
  };
  // Yang sebagian gagal TIDAK disinggahkan: percobaan berikutnya harus
  // mendapat kesempatan membaca bagian itu lagi.
  if (galat.length === 0) simpanSinggahan(kunciSinggahan, data, sekarang);
  return data;
}

module.exports = {
  PERAN_EVIDEN,
  KUNCI_PERIODE,
  KUNCI_BULAN,
  KUNCI_PERIODE_SEMUA,
  HASIL_MEDIASI,
  UPAYA_HUKUM,
  // Murni - diuji langsung.
  susunPeriode,
  periksaMasukan,
  kalimatAturanPeriode,
  kalimatGagalInti,
  batasKeadaan,
  musyawarahDariJadwal,
  sidangLuarGedungDariJadwal,
  hubunganDariKedudukan,
  jenisDirput,
  hurufJudul,
  kosongkanSinggahan,
  evidenSkp,
};
