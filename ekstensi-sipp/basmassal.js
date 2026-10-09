"use strict";

/*
 * ============================================================================
 * BAS MASSAL - BERITA ACARA SIDANG SATU TANGGAL, UNTUK PANITERA SIDANG / PP
 * (PERBAIKAN 30 SEP 2026 SORE, BUTIR U4 - KONTRAK K4)
 * ============================================================================
 *
 * Skrip konten bersama panel SIPP (konten.js, halaman daftar perkara) dan
 * panel ABT (abt.js, beranda). Dimuat SESUDAH panel-alat.js dan jurusita.js,
 * SEBELUM konten.js / abt.js. Ia tidak memasang apa pun sendiri; yang
 * memanggilnya panel pemilik halaman:
 *
 *   globalThis.aletaBasMassalPasang(wadah, { situs: "sipp"|"abt", peran? })
 *     -> Promise<boolean>  true bila bagian BAS massal tergambar di `wadah`
 *
 * `peran` (opsional) = peran yang sedang AKTIF menurut panel pemanggil (mode
 * ganti peran dihormati). Tanpa itu dipakai akun ALETA dari /ekstensi/siapa.
 *
 * ============================================================================
 * APA YANG DIKERJAKAN "BAS MASSAL"
 * ============================================================================
 *
 * Hakim punya Putusan massal, juru sita punya Relaas massal. Panitera sidang:
 *
 *   1. Pilih tanggal sidang -> daftar perkara yang bersidang (bawaan: yang
 *      panitera penggantinya pengguna ini; admin: semua), dengan status tiap
 *      perkara: BAS sidang itu sudah/belum diunggah ke SIPP, saksi yang
 *      diajukan, lembar BAS di ALETA, kehadiran yang tercatat.
 *   2. Blangko BAS diusulkan dari set yang cocok dengan jenis perkaranya pada
 *      jenjang "BAS <urutan sidang>" - hanya bila keadaan di nama blangko
 *      cocok dengan kehadiran di SIPP; selain itu dipilih petugas.
 *   3. Pratinjau (GET bas/periksa): berapa penanda terisi dari SIPP, lembar
 *      ALETA, dan keterangan saksi yang sudah terekam di ABT; apa yang masih
 *      kosong dan harus dilengkapi.
 *   4. Unduh (GET bas/naskah): blangko ASLI ABT dengan penanda terisi, RTF.
 *   5. "Kerjakan yang dicentang": pratinjau lalu unduh, BERUNTUN, satu per
 *      satu; yang pratinjaunya menemukan halangan dilewati kecuali petugas
 *      mencentang "unduh walau ada halangan". Dapat dihentikan.
 *   6. Buka di ABT: blangko yang sama dibuka di ABT lewat jalur ABT sendiri
 *      (POST abt/main/cari, persis tautan kartu blangko ABT - pemeriksaan hak
 *      akses ABT tetap berlaku), atau kelompok blangkonya (GET beranda?a=&c=).
 *      Di sanalah panel ABT per perkara menyusun keterangan saksi 1 & 2
 *      (mesin abt.js + /aleta-bot/abt/usulan, dengan pratinjau).
 *
 * ============================================================================
 * TIDAK ADA JALUR TULIS BARU
 * ============================================================================
 *
 * Seluruh permintaan jaringan di berkas ini GET: /ekstensi/siapa,
 * /bas-massal (baru, hanya membaca), /bas/periksa, /bas/naskah. Tidak ada
 * yang ditulis ke SIPP, ABT, maupun ALETA. "Buka di ABT" adalah navigasi yang
 * sama dengan tautan kartu blangko ABT (main/cari hanya membaca - ada di
 * ALETA_COBA_BOLEH) dan tetap diperiksa terhadap mode coba dan mode latihan
 * sebelum dikirim. Satu-satunya yang disimpan: token blangko BAS yang terbaca
 * dari halaman ABT, di chrome.storage.local "tokenBlangkoBas" - supaya tombol
 * "Buka di ABT" tersedia juga dari SIPP.
 *
 * Tampilan Lama: pulang false SEKETIKA - tanpa elemen, permintaan, maupun
 * simpanan apa pun.
 *
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 (AGEN M) - HANYA UI BARU
 * ============================================================================
 *
 *   - Fungsi bersama KONTRAK K4 (lihat bagian 1b): deteksi putusan massal,
 *     pengelompokan per user, gambar kelompok bercentang.
 *   - Butir 14: admin/super admin di UI Baru melihat BAS massal "Semua PP"
 *     dikelompokkan PER PP (berlipat, centang "Kerjakan semua milik X" dan per
 *     perkara). PP tetap melihat miliknya (bawaan "PP: saya") seperti 1.176.0.
 *   - Butir 1: rincian "Yang perlu dilengkapi" memakai bentuk lipat seragam
 *     (alatJadikanLipat) di UI Baru.
 *   Tampilan Baru tetap persis 1.176.0; tidak ada jalur tulis baru.
 */

const BASMASSAL_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const BASMASSAL_API_DAFTAR = "/aleta/api/aleta-ecourt/bas-massal";
const BASMASSAL_API_PERIKSA = "/aleta/api/aleta-ecourt/bas/periksa";
const BASMASSAL_API_NASKAH = "/aleta/api/aleta-ecourt/bas/naskah";
const BASMASSAL_KUNCI_TOKEN = "tokenBlangkoBas";
const BASMASSAL_PENANDA = "aleta-basmassal";
const BASMASSAL_TOKEN_MAKS = 400;
const BASMASSAL_JEDA_BERUNTUN_MS = 400;
/** Golongan peran (alatGolonganPeran) yang boleh - sama dengan matriks K1 "bas-massal". */
const BASMASSAL_GOLONGAN_BOLEH = ["admin", "panitera"];

/* ─── 1. Gerbang tampilan dan peran ──────────────────────────────────────── */

/** Tampilan UI Baru (K1) - satu-satunya tempat perubahan 1 Okt berlaku. */
function basmassalModeUi() {
  try {
    return typeof alatUjiMode === "function" && alatUjiMode() === "ui";
  } catch {
    return false;
  }
}

function basmassalModeBaru() {
  try {
    return typeof alatUjiMode === "function" && alatUjiMode() !== "lama";
  } catch {
    return false;
  }
}

/** Satu peran boleh membuka BAS massal? Matriks K1 bila ada, golongan bila tidak. */
function basmassalPeranBoleh(situs, peran) {
  const p = String(peran || "").trim();
  if (!p) return false;
  try {
    if (typeof alatMenuPeran === "function") {
      const menu = alatMenuPeran(situs === "abt" ? "abt" : "sipp", "daftar", p);
      if (Array.isArray(menu)) return menu.includes("bas-massal");
    }
  } catch {
    /* jatuh ke golongan */
  }
  if (typeof alatGolonganPeran !== "function") return false;
  return BASMASSAL_GOLONGAN_BOLEH.includes(alatGolonganPeran(p));
}

async function basmassalMuatSiapa() {
  try {
    const r = await alatAmbil(BASMASSAL_API_SIAPA, { credentials: "include", cache: "no-store" }, "Membaca akun ALETA");
    if (!r.ok) return null;
    const luar = await r.json();
    const isi = luar && luar.data ? luar.data : luar;
    if (!isi || !isi.nama) return null;
    return {
      nama: String(isi.nama || ""),
      peran: String(isi.peran || ""),
      roleId: String(isi.roleId || ""),
      peranTambahan: Array.isArray(isi.peranTambahan) ? isi.peranTambahan.map(String) : [],
    };
  } catch {
    return null;
  }
}

/*
 * ============================================================================
 * 1b. KONTRAK K4 - PEKERJAAN MASSAL PER USER (PERBAIKAN 1 OKT 2026, AGEN M)
 * ============================================================================
 *
 * Tiga fungsi GLOBAL untuk semua panel massal. basmassal.js dimuat sebelum
 * konten.js dan abt.js (manifest), jadi keduanya dapat memakainya. Selalu
 * periksa dulu `typeof aletaMassalPutusanLayak === "function"` dst.
 *
 * ── 1. aletaMassalPutusanLayak(perkara) -> boolean  (MURNI) ────────────────
 *      aletaMassalAlasanPutusan(perkara) -> { layak, jenis, sebab }
 *
 *   Perkara ikut PUTUSAN MASSAL hanya bila sidang hari itu:
 *     jenis "putus"          hasil/keterangan sidangnya menyatakan putus
 *                            (putus, dikabulkan, ditolak, tidak dapat
 *                            diterima, verstek, gugur, dicabut, dicoret), atau
 *                            tanggal putusan SIPP = tanggal sidang itu;
 *     jenis "tunda-putusan"  ditunda dengan alasan musyawarah majelis /
 *                            pembacaan putusan / pembacaan penetapan;
 *     jenis "agenda-putusan" hasilnya BELUM dicatat dan agenda hari itu
 *                            musyawarah / pembacaan putusan / "putus" - yaitu
 *                            pagi hari sebelum panitera mengisi hasil sidang.
 *   Bukan: putusan sela, "isi putusan", "pembebanan putusan", "salinan
 *   penetapan", penetapan hari sidang/majelis, musyawarah keluarga, dan
 *   sidang yang ditunda dengan alasan LAIN (panggil, pembuktian, mediasi).
 *
 *   Bentuk masukan (semua opsional; nama ruas bot dan nama ruas
 *   alatSidangPadaTanggal sama-sama diterima):
 *     {
 *       ditunda:        boolean | "Y" | "T",
 *       alasanDitunda:  string   (atau alasan_ditunda / alasan),
 *       agenda:         string,
 *       keterangan:     string   (atau keteranganSidang / hasilSidang),
 *       sudahPutus:     boolean,
 *       tanggalPutusan: "YYYY-MM-DD",
 *       tanggalSidang:  "YYYY-MM-DD" (atau tanggal),
 *       ikrar:          boolean  (atau sidangIkrarTalak)
 *     }
 *   PENTING bagi A dan S: alatSidangPadaTanggal (panel-alat.js, milik W) per
 *   1.176.0 belum meneruskan alasanDitunda, tanggalPutusan, dan tanggalSidang
 *   dari jawaban /sidang - tanpa ketiganya hanya agenda yang dapat dinilai.
 *   Baris jadwal bot (/sidang, /bas-massal) sudah membawa semuanya.
 *
 *   Diukur atas sipp_donggala (16.076 baris jadwal 2018 s.d. Sep 2026) - lihat
 *   angka di ekstensi-massal-1okt.test.ts dan laporan agen M.
 *
 * ── 2. aletaMassalKelompokkan(daftar, kunciPengguna) ───────────────────────
 *      -> [{ pengguna: { id, nama }, perkara: [...] }]
 *
 *   kunciPengguna: nama ruas (mis. "pengguna", "paniteraNama", "hakimNama")
 *   atau fungsi (perkara) -> { id?, nama } | string. Ruas berbentuk objek
 *   { id, nama } dipakai apa adanya. Nama yang sama dengan gelar berbeda
 *   ("Siti Aminah" dan "Siti Aminah, S.H.") menjadi SATU kelompok. Urutan:
 *   nama menurut abjad, yang tanpa nama paling akhir ("Belum ada nama").
 *   Urutan perkara di dalam kelompok tidak diubah.
 *
 * ── 3. aletaMassalGambarKelompok(wadah, kelompok, opsi) -> pengendali ─────
 *
 *   opsi = {
 *     peran:        peran AKTIF (wajib untuk tampilan per user),
 *     kunciLipat:   awalan kunci ingat buka/tutup, mis. "putusan-massal-abt",
 *     gambarBaris:  (perkara, wadahIsi, kelompok) -> HTMLInputElement
 *                   | { centang: HTMLInputElement } | void
 *                   - menggambar satu baris perkara dan memulangkan kotak
 *                   centangnya; tanpa itu digambar baris sederhana
 *                   (centang + labelPerkara),
 *     labelPerkara: (perkara) -> string (bawaan nomorPerkara / nomor),
 *     judul:        (pengguna, perkara[]) -> string (bawaan "nama · n perkara"),
 *     terbuka:      boolean - kelompok terbuka bawaannya (bawaan true),
 *     onCentang:    ({ pengguna, perkara, dicentang }) -> void,
 *     -- tambahan 2 Okt (agen R), semuanya opsional --
 *     peranLipat:   tag peran di kepala tiap kelompok (butir 7), mis.
 *                   "jurusita" / "PP" / "Hakim" - diteruskan ke alatLipat,
 *     namaSaya:     string | string[] - butir 19: kelompok milik akun yang
 *                   masuk TERBUKA, kelompok user lain TERTUTUP (satu
 *                   kelompok saja selalu terbuka; ingatan buka/tutup per
 *                   kunci tetap menang). Kelompoknya bertanda
 *                   data-milik-saya="ya",
 *     terbukaUntuk: (pengguna, perkara[]) -> boolean - penentu sendiri
 *   }
 *
 *   Pengelompokan per user HANYA untuk golongan "admin" (alatGolonganPeran:
 *   Admin, Super Admin) dan HANYA di tampilan UI Baru. Selain itu daftar
 *   digambar DATAR (tanpa kepala kelompok) dengan gambarBaris yang sama -
 *   pemanggil cukup satu jalur. Kepala kelompok memuat centang "Kerjakan
 *   semua milik X" (menyalakan/mematikan seluruh centang yang aktif di
 *   kelompok itu; setengah bila sebagian) dan dapat dilipat (alatLipat milik
 *   agen W bila ada, <details> bila belum). TIDAK ADA yang tercentang sendiri.
 *
 *   Pengendali: { perUser, kelompok: [{ pengguna, akar, centangKelompok,
 *   centang[], perkara[], milikSaya }], dicentang() -> perkara[],
 *   centangSemua(bool), segarkan() }.
 *
 * ── 4. aletaMassalBarisBlangko(perkara, opsi) -> HTMLElement  (2 Okt, K3) ──
 *
 *   Butir 3: putusan massal memakai SATU blangko utama (dipilih di kepala
 *   daftar); perkara yang putusannya berbeda diberi pengecualian. Baris ini
 *   menampilkan blangko yang berlaku untuk satu perkara + tombol kecil
 *   "Blangko berbeda…" yang membuka pemilih blangko UNTUK PERKARA ITU SAJA,
 *   dan "Ikuti blangko utama" untuk membatalkan pengecualian. Lihat bagian
 *   1c di bawah dan contoh di ujung KONTRAK.md perbaikan 2 Okt.
 */

const BASMASSAL_BUKAN_ISI = ["", "0", "-", "null", "undefined"];
/** Hasil sidang yang menyatakan perkara diputus / diakhiri pada hari itu. */
const BASMASSAL_POLA_HASIL = /\b(?:di)?putus\b|\bdi ?kabulkan\b|\bkabul\b|\bditolak\b|\btidak dapat diterima\b|\bverstek\b|\bgugur\b|\bdigugurkan\b|\b(?:di)?cabut\b|\bdicoret\b/;
/** "putus" sebagai kata - di alasan tunda pun berarti hasil, bukan agenda (10 baris di data). */
const BASMASSAL_POLA_PUTUS = /\b(?:di)?putus\b/;
/** Musyawarah majelis beserta salah ketik yang ada di data: musywarah, musaywarah, musyawarh, musy., MMH. */
const BASMASSAL_POLA_MUSYAWARAH = /\bmus[a-z]{0,3}w[a-z]{0,4}r[a-z]{0,3}\b|\bmusy\b|\bmmh\b|\brapat majelis\b/g;
const BASMASSAL_POLA_KATA_PUTUSAN = /\b(?:o?putusan|penetapan|putus)\b/g;

function basmassalTeksRapi(x) {
  return String(x === null || x === undefined ? "" : x)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function basmassalBerisi(x) {
  return !BASMASSAL_BUKAN_ISI.includes(basmassalTeksRapi(x));
}

/** Teks menunjuk sidang putusan: musyawarah majelis, pembacaan putusan/penetapan, "putus". */
function basmassalMenujuPutusan(teks) {
  const t = basmassalTeksRapi(teks);
  if (!t) return false;
  const kata = new RegExp(BASMASSAL_POLA_KATA_PUTUSAN.source, "g");
  let m;
  while ((m = kata.exec(t))) {
    const sebelum = t.slice(Math.max(0, m.index - 16), m.index);
    const sesudah = t.slice(m.index + m[0].length, m.index + m[0].length + 28);
    if (/^\s*sela\b/.test(sesudah)) continue;
    if (/\b(?:isi|pembebanan|salinan|menyerahkan)\s+$/.test(sebelum)) continue;
    if (
      m[0] === "penetapan" &&
      /^\s*(?:kembali\s+)?(?:hari\s+sidang|majelis|pmh|phs|ppp|pjs|juru\s*sita|panitera|mediator)\b/.test(sesudah)
    ) {
      continue;
    }
    return true;
  }
  const mus = new RegExp(BASMASSAL_POLA_MUSYAWARAH.source, "g");
  while ((m = mus.exec(t))) {
    if (/\bkeluarga\b/.test(t.slice(m.index + m[0].length, m.index + m[0].length + 32))) continue;
    return true;
  }
  return false;
}

function basmassalRuas(p, nama) {
  for (const n of nama) {
    if (p && p[n] !== undefined && p[n] !== null) return p[n];
  }
  return undefined;
}

/** Penilaian lengkap - sebab ditulis supaya petugas tahu MENGAPA perkara itu ikut. */
function aletaMassalAlasanPutusan(perkara) {
  const p = perkara && typeof perkara === "object" ? perkara : {};
  const d = basmassalRuas(p, ["ditunda"]);
  const ditunda = d === true || String(d || "").toUpperCase() === "Y";
  const alasan = String(basmassalRuas(p, ["alasanDitunda", "alasan_ditunda", "alasan"]) || "").trim();
  const ket = String(basmassalRuas(p, ["keterangan", "keteranganSidang", "hasilSidang"]) || "").trim();
  const agenda = String(basmassalRuas(p, ["agenda"]) || "").trim();
  const tglSidang = String(basmassalRuas(p, ["tanggalSidang", "tanggal"]) || "").slice(0, 10);
  const tglPutus = String(basmassalRuas(p, ["tanggalPutusan"]) || "").slice(0, 10);
  const sudahPutus = basmassalRuas(p, ["sudahPutus"]) === true;
  const alasanAda = basmassalBerisi(alasan);
  const ketAda = basmassalBerisi(ket);
  const rapi = (x) => String(x).replace(/\s+/g, " ").trim();

  // 1. PUTUS hari itu.
  if (alasanAda && (BASMASSAL_POLA_PUTUS.test(basmassalTeksRapi(alasan)) || (!ditunda && BASMASSAL_POLA_HASIL.test(basmassalTeksRapi(alasan))))) {
    return { layak: true, jenis: "putus", sebab: `Hasil sidang: ${rapi(alasan)}` };
  }
  if (ketAda && BASMASSAL_POLA_HASIL.test(basmassalTeksRapi(ket))) {
    return { layak: true, jenis: "putus", sebab: `Keterangan sidang: ${rapi(ket)}` };
  }
  if (sudahPutus && /^\d{4}-\d{2}-\d{2}$/.test(tglPutus) && tglPutus === tglSidang) {
    return { layak: true, jenis: "putus", sebab: "Putusan di SIPP bertanggal hari sidang ini" };
  }
  // 2. DITUNDA UNTUK putusan / musyawarah majelis.
  if (alasanAda && basmassalMenujuPutusan(alasan)) {
    return { layak: true, jenis: "tunda-putusan", sebab: `Ditunda untuk: ${rapi(alasan)}` };
  }
  if (ketAda && basmassalMenujuPutusan(ket)) {
    return { layak: true, jenis: "tunda-putusan", sebab: `Keterangan sidang: ${rapi(ket)}` };
  }
  // 3. Hasil belum dicatat, agenda hari itu sidang putusan. Bila hasilnya
  //    SUDAH dicatat dengan hal lain (panggil, pembuktian...), agenda kalah.
  if (!alasanAda && !ketAda && basmassalMenujuPutusan(agenda)) {
    return { layak: true, jenis: "agenda-putusan", sebab: `Agenda hari itu: ${rapi(agenda)}` };
  }
  return { layak: false, jenis: "", sebab: "" };
}

function aletaMassalPutusanLayak(perkara) {
  try {
    return aletaMassalAlasanPutusan(perkara).layak === true;
  } catch {
    return false;
  }
}

/** Kunci pengelompokan nama: huruf kecil, gelar sesudah koma dibuang, tanpa tanda baca. */
function basmassalKunciPengguna(nama) {
  return String(nama || "")
    .split(",")[0]
    .toLowerCase()
    .replace(/\b(?:drs?|dra|hj?|ir|prof)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function basmassalPenggunaDari(perkara, kunciPengguna) {
  let x;
  try {
    x = typeof kunciPengguna === "function" ? kunciPengguna(perkara) : perkara ? perkara[kunciPengguna || "pengguna"] : undefined;
  } catch {
    x = undefined;
  }
  if (x && typeof x === "object") {
    const nama = String(x.nama || x.name || "").trim();
    const id = String(x.id || "").trim();
    return { id: id || basmassalKunciPengguna(nama), nama };
  }
  const nama = String(x || "").trim();
  return { id: basmassalKunciPengguna(nama), nama };
}

function aletaMassalKelompokkan(daftar, kunciPengguna) {
  const peta = new Map();
  for (const perkara of Array.isArray(daftar) ? daftar : []) {
    const pengguna = basmassalPenggunaDari(perkara, kunciPengguna);
    const kunci = pengguna.id || "";
    if (!peta.has(kunci)) peta.set(kunci, { pengguna: { id: kunci, nama: pengguna.nama }, perkara: [] });
    const k = peta.get(kunci);
    // Nama terlengkap (bergelar) yang dipakai sebagai judul.
    if (pengguna.nama.length > k.pengguna.nama.length) k.pengguna.nama = pengguna.nama;
    k.perkara.push(perkara);
  }
  return [...peta.values()].sort((a, b) => {
    if (!a.pengguna.id !== !b.pengguna.id) return a.pengguna.id ? -1 : 1;
    return a.pengguna.nama.localeCompare(b.pengguna.nama, "id", { sensitivity: "base" });
  });
}

/** Tampilan per user boleh? Golongan admin DAN tampilan UI Baru. */
function basmassalPerUserBoleh(peran) {
  try {
    if (typeof alatUjiMode !== "function" || alatUjiMode() !== "ui") return false;
    return typeof alatGolonganPeran === "function" && alatGolonganPeran(peran) === "admin";
  } catch {
    return false;
  }
}

/**
 * Satu bentuk lipat: alatLipat (agen W) bila ada, <details> bila belum.
 * `peran` (2 Okt, butir 7): tag peran di kepala (opsi `peran` alatLipat) -
 * tanpa nilai, kepala tampak persis seperti 1 Okt.
 */
function basmassalLipat(judul, kunci, terbuka, peran) {
  if (typeof alatLipat === "function") {
    try {
      const l = alatLipat(judul, { kunci, terbuka, kelas: "aleta-massal-kelompok", ...(peran ? { peran } : {}) });
      if (l && l.akar && l.kepala && l.isi) {
        return {
          akar: l.akar,
          kepala: l.kepala,
          isi: l.isi,
          ringkas: (teks) => {
            if (typeof l.setelRingkas === "function") l.setelRingkas(teks);
          },
        };
      }
    } catch {
      /* jatuh ke details */
    }
  }
  const akar = basmassalEl("details", "aleta-massal-kelompok aleta-massal-kelompok-lipat");
  if (kunci) akar.setAttribute("data-kunci", kunci);
  akar.open = terbuka !== false;
  const kepala = basmassalEl("summary", "aleta-massal-kelompok-kepala");
  kepala.appendChild(basmassalEl("span", "aleta-massal-kelompok-judul", judul));
  const ringkas = basmassalEl("span", "aleta-massal-kelompok-ringkasan");
  kepala.appendChild(ringkas);
  const isi = basmassalEl("div", "aleta-massal-kelompok-isi");
  akar.appendChild(kepala);
  akar.appendChild(isi);
  // Bentuk lipat seragam (K2) bila alatJadikanLipat sudah ada.
  if (typeof alatJadikanLipat === "function") {
    try {
      alatJadikanLipat(akar, { kunci, ...(peran ? { peran } : {}) });
    } catch {
      /* details biasa */
    }
  }
  return {
    akar,
    kepala,
    isi,
    ringkas: (teks) => {
      ringkas.textContent = teks ? ` - ${teks}` : "";
    },
  };
}

/*
 * Butir 19 (2 Okt): bawaan buka/tutup kelompok per user. Ingatan alatLipat
 * per kunci (orang pernah membuka/menutup) tetap menang - ini hanya bawaan.
 *
 *   opsi.terbuka      boolean  - seluruh kelompok (perilaku 1 Okt; tanpa
 *                                namaSaya/terbukaUntuk bawaannya true)
 *   opsi.namaSaya     string | string[] - nama akun yang masuk (dan nama
 *                                lain miliknya). Kelompok yang namanya cocok
 *                                (gelar diabaikan) TERBUKA, lainnya TERTUTUP.
 *   opsi.terbukaUntuk (pengguna, perkara[]) -> boolean - penentu sendiri.
 * Satu kelompok saja = seluruh daftar: selalu terbuka.
 */
const BASMASSAL_GELAR = new Set(["drs", "dra", "dr", "hj", "sh", "shi", "si", "mh", "ma", "mag", "ag", "se", "st", "ir", "lc", "msi", "mkn", "spdi", "sag", "sy", "ssy", "bin", "binti"]);

function basmassalPotonganNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length > 2 && !BASMASSAL_GELAR.has(k));
}

/** Nama akun cocok dengan nama petugas - aturan namaCocokSatu (lib/perkara-sendiri.ts). */
function basmassalNamaCocok(namaAkun, namaPetugas) {
  const akun = basmassalPotonganNama(namaAkun);
  const petugas = basmassalPotonganNama(namaPetugas);
  if (akun.length === 0 || petugas.length === 0) return false;
  const punya = new Set(petugas);
  if (!akun.every((k) => punya.has(k))) return false;
  if (akun.length >= 2) return true;
  return new Set(akun).size === punya.size;
}

function basmassalMilikSaya(o, pengguna) {
  const saya = (Array.isArray(o.namaSaya) ? o.namaSaya : [o.namaSaya]).map((x) => String(x || "").trim()).filter(Boolean);
  if (saya.length === 0 || !pengguna || !pengguna.nama) return false;
  return saya.some((n) => basmassalNamaCocok(n, pengguna.nama));
}

function basmassalKelompokTerbuka(o, pengguna, perkara, jumlahKelompok) {
  if (typeof o.terbukaUntuk === "function") {
    if (jumlahKelompok === 1) return true;
    try {
      return Boolean(o.terbukaUntuk(pengguna, perkara));
    } catch {
      return false;
    }
  }
  const adaNama = (Array.isArray(o.namaSaya) ? o.namaSaya : [o.namaSaya]).some((x) => String(x || "").trim());
  if (adaNama) return jumlahKelompok === 1 || basmassalMilikSaya(o, pengguna);
  return o.terbuka !== false;
}

function basmassalAmbilCentang(hasil) {
  if (!hasil) return null;
  if (hasil.tagName === "INPUT") return hasil;
  if (hasil.centang && hasil.centang.tagName === "INPUT") return hasil.centang;
  return null;
}

function aletaMassalGambarKelompok(wadah, kelompok, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const daftarKelompok = Array.isArray(kelompok) ? kelompok : [];
  const perUser = basmassalPerUserBoleh(o.peran);
  const labelPerkara = (p) => {
    try {
      if (typeof o.labelPerkara === "function") return String(o.labelPerkara(p) || "");
    } catch {
      /* label bawaan */
    }
    return String((p && (p.nomorPerkara || p.nomor)) || "");
  };
  const gambarBaris = (p, isi, k) => {
    if (typeof o.gambarBaris === "function") return basmassalAmbilCentang(o.gambarBaris(p, isi, k));
    const label = basmassalEl("label", "aleta-massal-kelompok-perkara");
    const c = document.createElement("input");
    c.type = "checkbox";
    label.appendChild(c);
    label.appendChild(basmassalEl("span", "", ` ${labelPerkara(p)}`));
    isi.appendChild(label);
    return c;
  };
  const kabar = (pengguna, perkara, dicentang) => {
    if (typeof o.onCentang !== "function") return;
    try {
      o.onCentang({ pengguna, perkara, dicentang });
    } catch {
      /* pemanggil */
    }
  };

  const akarSemua = basmassalEl("div", `aleta-massal-kelompok-daftar${perUser ? " aleta-massal-per-user" : ""}`);
  const hasil = [];
  for (const k of daftarKelompok) {
    const pengguna = k && k.pengguna ? k.pengguna : { id: "", nama: "" };
    const perkara = Array.isArray(k && k.perkara) ? k.perkara : [];
    const nama = pengguna.nama || "Belum ada nama";
    const entri = { pengguna, akar: null, centangKelompok: null, centang: [], perkara, sedangMassal: false, ringkas: null, milikSaya: false };
    let isi = akarSemua;
    if (perUser) {
      let judul = `${nama} · ${perkara.length} perkara`;
      try {
        if (typeof o.judul === "function") judul = String(o.judul(pengguna, perkara) || judul);
      } catch {
        /* judul bawaan */
      }
      const kunci = `${String(o.kunciLipat || "massal")}-user-${pengguna.id || "tanpa-nama"}`;
      const lipat = basmassalLipat(judul, kunci, basmassalKelompokTerbuka(o, pengguna, perkara, daftarKelompok.length), o.peranLipat);
      entri.milikSaya = basmassalMilikSaya(o, pengguna);
      if (entri.milikSaya) lipat.akar.setAttribute("data-milik-saya", "ya");
      lipat.akar.classList.add("aleta-massal-kelompok");
      lipat.akar.setAttribute("data-pengguna", pengguna.id || "");
      entri.ringkas = lipat.ringkas;
      const pilihSemua = basmassalEl("label", "aleta-massal-kelompok-semua");
      const cSemua = document.createElement("input");
      cSemua.type = "checkbox";
      cSemua.className = "aleta-massal-kelompok-centang";
      cSemua.setAttribute("aria-label", `Kerjakan semua milik ${nama}`);
      pilihSemua.appendChild(cSemua);
      pilihSemua.appendChild(basmassalEl("span", "", ` Kerjakan semua milik ${nama}`));
      lipat.isi.appendChild(pilihSemua);
      entri.akar = lipat.akar;
      entri.centangKelompok = cSemua;
      isi = basmassalEl("div", "aleta-massal-kelompok-baris");
      lipat.isi.appendChild(isi);
      akarSemua.appendChild(lipat.akar);
    }
    for (const p of perkara) {
      let c = null;
      try {
        c = gambarBaris(p, isi, k);
      } catch {
        c = null;
      }
      if (c) {
        c.checked = false;
        entri.centang.push({ perkara: p, c });
      }
    }
    hasil.push(entri);
  }

  const segarkanKelompok = (entri) => {
    if (!entri.centangKelompok) return;
    const aktif = entri.centang.filter((x) => !x.c.disabled);
    const nyala = aktif.filter((x) => x.c.checked).length;
    entri.centangKelompok.disabled = aktif.length === 0;
    entri.centangKelompok.checked = aktif.length > 0 && nyala === aktif.length;
    entri.centangKelompok.indeterminate = nyala > 0 && nyala < aktif.length;
    // Kelompok yang terlipat tetap memberi tahu berapa yang akan dikerjakan.
    if (typeof entri.ringkas === "function") entri.ringkas(nyala ? `${nyala} dicentang` : "");
  };
  for (const entri of hasil) {
    for (const x of entri.centang) {
      x.c.addEventListener("change", () => {
        segarkanKelompok(entri);
        if (!entri.sedangMassal) kabar(entri.pengguna, [x.perkara], x.c.checked);
      });
    }
    if (entri.centangKelompok) {
      entri.centangKelompok.addEventListener("change", () => {
        const nyala = entri.centangKelompok.checked;
        const berubah = [];
        entri.sedangMassal = true;
        for (const x of entri.centang) {
          if (x.c.disabled || x.c.checked === nyala) continue;
          x.c.checked = nyala;
          berubah.push(x.perkara);
          // Pemilik baris (mis. tombol Kerjakan) ikut tahu.
          x.c.dispatchEvent(new Event("change", { bubbles: true }));
        }
        entri.sedangMassal = false;
        segarkanKelompok(entri);
        kabar(entri.pengguna, berubah, nyala);
      });
    }
    segarkanKelompok(entri);
  }
  if (wadah && typeof wadah.appendChild === "function") wadah.appendChild(akarSemua);

  return {
    perUser,
    akar: akarSemua,
    kelompok: hasil.map((e) => ({ pengguna: e.pengguna, akar: e.akar, centangKelompok: e.centangKelompok, centang: e.centang.map((x) => x.c), perkara: e.perkara, milikSaya: e.milikSaya })),
    dicentang: () => hasil.flatMap((e) => e.centang.filter((x) => x.c.checked && !x.c.disabled).map((x) => x.perkara)),
    centangSemua: (nyala) => {
      for (const e of hasil) {
        for (const x of e.centang) {
          if (x.c.disabled || x.c.checked === Boolean(nyala)) continue;
          x.c.checked = Boolean(nyala);
          x.c.dispatchEvent(new Event("change", { bubbles: true }));
        }
        segarkanKelompok(e);
      }
    },
    segarkan: () => hasil.forEach(segarkanKelompok),
  };
}

/*
 * ─── 1c. Pengecualian blangko per perkara (K3, perbaikan 2 Okt butir 3) ────
 *
 *   aletaMassalBarisBlangko(perkara, {
 *     blangkoUtama,   blangko di kepala daftar (bawaan seluruh perkara)
 *     daftarBlangko,  larik blangko pilihan, atau (perkara) -> larik
 *                     (nama lain: `pilihan`; butir bernilai "" dilewati)
 *     onPilih,        ({ perkara, blangko, bawaan, nilai, label, berkas? }) -> void
 *     label?          nama perkara untuk aria-label (bawaan nomorPerkara/nomor)
 *   }) -> HTMLElement div.aleta-massal-blangko-baris
 *
 *   Blangko boleh teks (nama berkas) atau objek { nilai|id|berkas|value,
 *   label|nama|teks }; `blangko` di onPilih adalah objek/teks ASLI milik
 *   pemanggil (bukan salinan), jadi pemanggil tidak perlu memetakan ulang.
 *   bawaan true = perkara mengikuti blangko utama.
 *
 *   Elemen memegang pengendali di el.aletaBlangko:
 *     pilihan()      -> { blangko, bawaan }
 *     setelUtama(b)  blangko kepala berganti: baris yang mengikuti utama ikut
 *                    berganti (onPilih TIDAK dipanggil - pemanggil sudah tahu),
 *                    baris berpengecualian tetap
 *     setelDaftar(x) ganti daftar pilihan
 *     ulang()        batalkan pengecualian (onPilih dipanggil, bawaan true)
 *
 *   Murni DOM: tidak membaca jaringan, tidak menyimpan apa pun, tidak
 *   mencentang apa pun. Gerbang tampilan (UI Baru) urusan pemanggil.
 */
function basmassalBlangkoRapi(b) {
  if (b === undefined || b === null || b === "") return null;
  if (typeof b !== "object") {
    const t = String(b).trim();
    return t ? { nilai: t, label: t, asli: b } : null;
  }
  // <option value=""> pemanggil ("ikuti blangko utama") bukan blangko - baris
  // ini punya tombol "Ikuti blangko utama" sendiri.
  for (const k of ["nilai", "value"]) {
    if (Object.prototype.hasOwnProperty.call(b, k) && String(b[k] === null || b[k] === undefined ? "" : b[k]).trim() === "") return null;
  }
  const nilai = [b.nilai, b.id, b.berkas, b.value, b.kunci].find((x) => x !== undefined && x !== null && String(x).trim() !== "");
  const label = [b.label, b.nama, b.teks, b.berkas].find((x) => x !== undefined && x !== null && String(x).trim() !== "");
  if (nilai === undefined && label === undefined) return null;
  return { nilai: String(nilai !== undefined ? nilai : label).trim(), label: String(label !== undefined ? label : nilai).trim(), asli: b };
}

function aletaMassalBarisBlangko(perkara, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const nama = (() => {
    try {
      if (typeof o.label === "function") return String(o.label(perkara) || "");
      if (typeof o.label === "string") return o.label;
    } catch {
      /* label bawaan */
    }
    return String((perkara && (perkara.nomorPerkara || perkara.nomor)) || "perkara ini");
  })();
  let utama = basmassalBlangkoRapi(o.blangkoUtama);
  // `pilihan` = nama lain daftarBlangko (dipakai abt.js 2 Okt).
  let sumberDaftar = o.daftarBlangko !== undefined ? o.daftarBlangko : o.pilihan;
  let beda = null;
  const daftar = () => {
    let x = sumberDaftar;
    try {
      if (typeof x === "function") x = x(perkara);
    } catch {
      x = [];
    }
    return (Array.isArray(x) ? x : []).map(basmassalBlangkoRapi).filter(Boolean);
  };

  const akar = basmassalEl("div", "aleta-massal-blangko-baris");
  const teks = basmassalEl("span", "aleta-massal-blangko-teks");
  const tombolBeda = basmassalEl("button", "aleta-massal-blangko-beda", "Blangko berbeda…");
  tombolBeda.type = "button";
  tombolBeda.setAttribute("aria-expanded", "false");
  const tombolUlang = basmassalEl("button", "aleta-massal-blangko-ulang", "Ikuti blangko utama");
  tombolUlang.type = "button";
  tombolUlang.hidden = true;
  const pilih = document.createElement("select");
  pilih.className = "aleta-massal-blangko-pilih";
  pilih.setAttribute("aria-label", `Blangko untuk ${nama}`);
  pilih.hidden = true;
  for (const x of [teks, tombolBeda, tombolUlang, pilih]) akar.appendChild(x);

  const kabar = () => {
    if (typeof o.onPilih !== "function") return;
    const b = beda || utama;
    try {
      // nilai/label/berkas ikut di permukaan: pemanggil yang membaca
      // x.nilai atau x.berkas (bentuk <option>) juga mendapatkannya.
      const berkas = b && b.asli && typeof b.asli === "object" && b.asli.berkas ? String(b.asli.berkas) : undefined;
      o.onPilih({
        perkara,
        blangko: b ? b.asli : null,
        bawaan: !beda,
        nilai: b ? b.nilai : "",
        label: b ? b.label : "",
        ...(berkas ? { berkas } : {}),
      });
    } catch {
      /* pemanggil */
    }
  };
  const gambarTeks = () => {
    akar.setAttribute("data-keadaan", beda ? "beda" : "utama");
    if (beda) teks.textContent = `Blangko berbeda: ${beda.label}`;
    else teks.textContent = utama ? `Blangko utama: ${utama.label}` : "Blangko utama belum dipilih";
    teks.title = teks.textContent;
    tombolUlang.hidden = !beda;
    const lain = daftar().filter((b) => !utama || b.nilai !== utama.nilai);
    tombolBeda.disabled = lain.length === 0;
    tombolBeda.title = lain.length === 0 ? "Tidak ada blangko lain untuk dipilih" : `Pilih blangko lain untuk ${nama} saja`;
    tombolBeda.textContent = beda ? "Ganti…" : "Blangko berbeda…";
  };
  const isiPilihan = () => {
    pilih.textContent = "";
    const kosong = document.createElement("option");
    kosong.value = "";
    kosong.textContent = "Pilih blangko untuk perkara ini…";
    pilih.appendChild(kosong);
    daftar().forEach((b, i) => {
      const op = document.createElement("option");
      op.value = String(i);
      op.textContent = utama && b.nilai === utama.nilai ? `${b.label} (blangko utama)` : b.label;
      op.title = b.label;
      pilih.appendChild(op);
    });
    const ke = beda ? daftar().findIndex((b) => b.nilai === beda.nilai) : -1;
    pilih.value = ke >= 0 ? String(ke) : "";
  };
  const tutupPemilih = () => {
    pilih.hidden = true;
    tombolBeda.setAttribute("aria-expanded", "false");
  };

  tombolBeda.addEventListener("click", () => {
    if (pilih.hidden) {
      isiPilihan();
      pilih.hidden = false;
      tombolBeda.setAttribute("aria-expanded", "true");
      try {
        pilih.focus();
      } catch {
        /* tanpa fokus */
      }
    } else tutupPemilih();
  });
  pilih.addEventListener("change", () => {
    const b = daftar()[Number(pilih.value)];
    if (pilih.value === "" || !b) return;
    // Memilih blangko utama di pemilih = kembali mengikuti utama.
    beda = utama && b.nilai === utama.nilai ? null : b;
    tutupPemilih();
    gambarTeks();
    kabar();
  });
  pilih.addEventListener("keydown", (e) => {
    if (e.key === "Escape") tutupPemilih();
  });
  const ulang = () => {
    if (!beda) return;
    beda = null;
    tutupPemilih();
    gambarTeks();
    kabar();
  };
  tombolUlang.addEventListener("click", ulang);

  akar.aletaBlangko = {
    pilihan: () => {
      const b = beda || utama;
      return { blangko: b ? b.asli : null, bawaan: !beda };
    },
    setelUtama: (b) => {
      utama = basmassalBlangkoRapi(b);
      // Pengecualian yang kini SAMA dengan utama tidak lagi pengecualian.
      if (beda && utama && beda.nilai === utama.nilai) beda = null;
      gambarTeks();
      if (!pilih.hidden) isiPilihan();
    },
    setelDaftar: (x) => {
      sumberDaftar = x;
      gambarTeks();
      if (!pilih.hidden) isiPilihan();
    },
    ulang,
  };
  gambarTeks();
  return akar;
}

globalThis.aletaMassalBarisBlangko = aletaMassalBarisBlangko;
globalThis.aletaMassalPutusanLayak = aletaMassalPutusanLayak;
globalThis.aletaMassalAlasanPutusan = aletaMassalAlasanPutusan;
globalThis.aletaMassalKelompokkan = aletaMassalKelompokkan;
globalThis.aletaMassalGambarKelompok = aletaMassalGambarKelompok;

/* ─── 2. Pembantu kecil ──────────────────────────────────────────────────── */

function basmassalEl(tag, kelas, teks) {
  if (typeof alatEl === "function") return alatEl(tag, kelas, teks);
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined && teks !== null) e.textContent = String(teks);
  return e;
}

function basmassalTombol(teks, kelas, judul) {
  const b = basmassalEl("button", `aleta-basmassal-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

function basmassalTanggalIso(d) {
  if (typeof alatTanggalIso === "function") return alatTanggalIso(d || new Date());
  const t = d || new Date();
  const dua = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}

function basmassalPesanStatus(status, yangDiminta) {
  if (typeof alatPesanGagal === "function") return alatPesanGagal(null, status, yangDiminta);
  return `${yangDiminta} gagal (${status}).`;
}

function basmassalKabar(wadah, teks, jenis) {
  wadah.textContent = teks || "";
  wadah.className = `aleta-basmassal-kabar${jenis ? ` aleta-basmassal-kabar-${jenis}` : ""}`;
  wadah.hidden = !teks;
}

/** Kunci nama untuk mencocokkan kelompok/berkas: huruf kecil, tanpa tanda baca, tanpa .rtf. */
function basmassalKunciNama(nama) {
  return String(nama || "")
    .replace(/\.rtf\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nama kelompok dari folder set: "derry_briantono/- BAS VERSTEK PERCERAIAN -" -> "bas verstek perceraian". */
function basmassalKunciFolder(folder) {
  const potong = String(folder || "").split("/");
  return basmassalKunciNama(potong[potong.length - 1]);
}

/** Alamat dasar ABT (".../aps_badilag/abt") di halaman ini. */
function basmassalAsalAbt() {
  const cocok = location.pathname.match(/^(.*?\/abt)\//);
  return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
}

/* ─── 3. Token blangko BAS dari halaman ABT ──────────────────────────────── */

async function basmassalBacaToken() {
  try {
    const s = await chrome.storage.local.get([BASMASSAL_KUNCI_TOKEN]);
    const isi = s && s[BASMASSAL_KUNCI_TOKEN];
    if (isi && typeof isi === "object") {
      return {
        kelompok: isi.kelompok && typeof isi.kelompok === "object" ? isi.kelompok : {},
        berkas: isi.berkas && typeof isi.berkas === "object" ? isi.berkas : {},
      };
    }
  } catch {
    /* tanpa simpanan: tidak ada tombol Buka di ABT dari SIPP */
  }
  return { kelompok: {}, berkas: {} };
}

/**
 * Membaca token kelompok (bilah kiri ABT) dan token berkas (kartu kelompok
 * yang sedang terbuka) yang namanya memuat "BAS". Hanya MEMBACA halaman ABT;
 * hasilnya disimpan lokal. Pulang jumlah token yang terbaca.
 */
async function basmassalPanenTokenAbt() {
  if (!document.querySelector("#navbar .accordion") && !document.querySelector(".pricing-top h3")) return 0;
  const asal = basmassalAsalAbt();
  const kini = Date.now();
  const kelompok = {};
  const berkas = {};
  for (const a of Array.from(document.querySelectorAll("#navbar a[href]"))) {
    let u;
    try {
      u = new URL(a.getAttribute("href"), location.origin);
    } catch {
      continue;
    }
    const tokenA = u.searchParams.get("a");
    const nama = String(a.textContent || "").replace(/\s+/g, " ").trim();
    const kunci = basmassalKunciNama(nama);
    if (!tokenA || !/(^| )bas( |$)/.test(kunci)) continue;
    kelompok[kunci] = { a: tokenA, nama, asal, diambil: kini };
  }
  for (const h3 of Array.from(document.querySelectorAll(".pricing-top h3"))) {
    // h3 = nama kelompok + "<br>" + jenis dan nomor perkara - hanya simpul pertamanya.
    const nama = String((h3.firstChild && h3.firstChild.textContent) || h3.textContent || "").replace(/\s+/g, " ").trim();
    const kunciKel = basmassalKunciNama(nama);
    if (!/(^| )bas( |$)/.test(kunciKel)) continue;
    const kartu = h3.closest(".pricing_inner_w3ls") || h3.parentElement;
    if (!kartu) continue;
    for (const t of Array.from(kartu.querySelectorAll(".pricing-bottom-bottom a[onclick], .pricing-bottom-bottom a[href*='abt/preview']"))) {
      const token = typeof alatTokenDariTautan === "function" ? alatTokenDariTautan(t) : null;
      if (!token || !token.a || !token.b) continue;
      const span = t.querySelector("span");
      const namaBerkas = String((span || t).textContent || "").replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
      if (!namaBerkas) continue;
      berkas[`${kunciKel}|${basmassalKunciNama(namaBerkas)}`] = { a: token.a, b: token.b, berkas: namaBerkas, kelompok: nama, asal, diambil: kini };
    }
  }
  const jumlah = Object.keys(kelompok).length + Object.keys(berkas).length;
  if (jumlah === 0) return 0;
  const lama = await basmassalBacaToken();
  const gabung = (x, y) => {
    const hasil = { ...x, ...y };
    const kunci = Object.keys(hasil).sort((p, q) => Number(hasil[q].diambil || 0) - Number(hasil[p].diambil || 0));
    const bersih = {};
    for (const k of kunci.slice(0, BASMASSAL_TOKEN_MAKS)) bersih[k] = hasil[k];
    return bersih;
  };
  try {
    await chrome.storage.local.set({
      [BASMASSAL_KUNCI_TOKEN]: { kelompok: gabung(lama.kelompok, kelompok), berkas: gabung(lama.berkas, berkas) },
    });
  } catch {
    /* tanpa simpanan: token hanya berlaku di halaman ini */
  }
  return jumlah;
}

/**
 * Token untuk satu blangko: berkas di kelompok yang namanya sama dengan
 * foldernya; bila tidak ada, berkas bernama sama yang SATU-SATUNYA (nama yang
 * sama di dua kelompok tidak ditebak). Kelompok saja bila berkasnya belum
 * pernah terbaca.
 */
function basmassalTokenUntuk(peta, folder, namaBerkas) {
  const kunciKel = basmassalKunciFolder(folder);
  const kunciBerkas = basmassalKunciNama(namaBerkas);
  let berkas = peta.berkas[`${kunciKel}|${kunciBerkas}`] || null;
  if (!berkas) {
    const sama = Object.entries(peta.berkas).filter(([k]) => k.split("|")[1] === kunciBerkas);
    if (sama.length === 1) berkas = sama[0][1];
  }
  const kelompok = peta.kelompok[kunciKel] || null;
  return { berkas, kelompok };
}

/** Mode coba atau mode latihan menahan POST ini? */
function basmassalDitahan(alamat) {
  try {
    if (typeof alatCobaMenahan === "function" && alatCobaMenahan(alamat, "POST")) return "mode coba";
    if (typeof alatLatihanMenahan === "function" && alatLatihanMenahan(alamat, "POST")) return "mode latihan";
  } catch {
    return "";
  }
  return "";
}

/** Membuka blangko di ABT lewat jalur ABT sendiri - POST main/cari {a, b, c}, tab baru. */
function basmassalBukaDiAbt(token, perkaraId) {
  const asal = String(token.asal || basmassalAsalAbt());
  const alamat = `${asal}/main/cari`;
  const tahan = basmassalDitahan(alamat);
  if (tahan) return { ok: false, sebab: `Ditahan ${tahan}: membuka blangko di ABT tidak dikirim.` };
  const borang = document.createElement("form");
  borang.method = "post";
  borang.action = alamat;
  borang.target = "_blank";
  borang.style.display = "none";
  for (const [nama, nilai] of [
    ["a", token.a],
    ["b", token.b],
    ["c", String(perkaraId || "")],
  ]) {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = nama;
    i.value = String(nilai || "");
    borang.appendChild(i);
  }
  document.body.appendChild(borang);
  try {
    borang.submit();
  } finally {
    borang.remove();
  }
  return { ok: true };
}

/* ─── 4. Rute ALETA (semuanya GET) ───────────────────────────────────────── */

async function basmassalMuatDaftar(tanggal, saringan) {
  const q = new URLSearchParams();
  if (tanggal) q.set("tanggal", tanggal);
  if (saringan) q.set("saringan", saringan);
  let r;
  try {
    r = await alatAmbil(`${BASMASSAL_API_DAFTAR}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca daftar sidang");
  } catch (e) {
    return { sebab: String((e && e.message) || e) };
  }
  const luar = await r.json().catch(() => null);
  if (!r.ok || !luar || luar.ok === false) {
    return {
      sebab: String((luar && (luar.alasan || (luar.error && luar.error.message))) || basmassalPesanStatus(r.status, "Membaca daftar sidang")),
    };
  }
  const data = luar.data ? luar.data : luar;
  if (!data || !Array.isArray(data.sidang)) return { sebab: "Daftar sidang tidak terbaca." };
  return { data };
}

function basmassalQueryBlangko(baris, pilihan) {
  const q = new URLSearchParams();
  q.set("perkaraId", baris.perkaraId);
  q.set("folder", pilihan.folder);
  q.set("berkas", pilihan.berkas);
  if (Number(pilihan.basKe) > 0) q.set("sidangKe", String(pilihan.basKe));
  return q.toString();
}

async function basmassalPeriksa(baris, pilihan) {
  let r;
  try {
    r = await alatAmbil(
      `${BASMASSAL_API_PERIKSA}?${basmassalQueryBlangko(baris, pilihan)}`,
      { credentials: "include", cache: "no-store" },
      "Pratinjau BAS"
    );
  } catch (e) {
    return { ok: false, sebab: String((e && e.message) || e) };
  }
  const luar = await r.json().catch(() => null);
  if (!r.ok || !luar) return { ok: false, sebab: basmassalPesanStatus(r.status, "Pratinjau BAS") };
  const d = luar.data ? luar.data : luar;
  if (!d || d.ok === false) return { ok: false, sebab: String((d && d.sebab) || "Blangko tidak terbaca.") };
  return {
    ok: true,
    jumlahPenanda: Number(d.jumlahPenanda) || 0,
    jumlahTerisi: Number(d.jumlahTerisi) || 0,
    jumlahTersisa: Number(d.jumlahTersisa) || 0,
    ringkasan: String(d.ringkasan || ""),
    temuan: Array.isArray(d.temuan) ? d.temuan : [],
  };
}

function basmassalNamaUnduhan(respons, baris, pilihan) {
  const cd = String((respons.headers && respons.headers.get && respons.headers.get("content-disposition")) || "");
  const cocok = cd.match(/filename="([^"]+)"/i);
  const nama = cocok ? cocok[1] : `${baris.nomorPerkara} - ${pilihan.berkas}`;
  return nama.replace(/[\\/:*?"<>|]+/g, "_");
}

/** Unduh blangko terisi (RTF). Membaca, lalu menyerahkan berkasnya ke peramban. */
async function basmassalUnduh(baris, pilihan) {
  let r;
  try {
    r = await alatAmbil(
      `${BASMASSAL_API_NASKAH}?${basmassalQueryBlangko(baris, pilihan)}`,
      { credentials: "include", cache: "no-store" },
      "Mengunduh BAS"
    );
  } catch (e) {
    return { ok: false, sebab: String((e && e.message) || e) };
  }
  if (!r.ok) {
    const luar = await r.json().catch(() => null);
    return { ok: false, sebab: String((luar && luar.sebab) || basmassalPesanStatus(r.status, "Mengunduh BAS")) };
  }
  const nama = basmassalNamaUnduhan(r, baris, pilihan);
  const tersisa = String(r.headers.get("x-aleta-tersisa") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  let blob;
  try {
    blob = await r.blob();
  } catch (e) {
    return { ok: false, sebab: `Berkas tidak terbaca: ${String((e && e.message) || e)}` };
  }
  if (typeof URL.createObjectURL !== "function") return { ok: false, sebab: "Peramban ini tidak dapat menyimpan unduhan dari panel." };
  const alamat = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = alamat;
  a.download = nama;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(alamat);
    } catch {
      /* sudah dilepas */
    }
  }, 60000);
  return { ok: true, nama, tersisa };
}

/* ─── 5. Tampilan ────────────────────────────────────────────────────────── */

function basmassalTanda(teks, keadaan, judul) {
  const s = basmassalEl("span", `aleta-basmassal-tanda${keadaan ? ` aleta-basmassal-tanda-${keadaan}` : ""}`, teks);
  if (judul) s.title = judul;
  return s;
}

/** Kalimat hasil pratinjau + rincian temuannya. */
function basmassalGambarPratinjau(kotak, hasil, pilihan) {
  kotak.textContent = "";
  if (!hasil.ok) {
    kotak.appendChild(basmassalEl("div", "aleta-basmassal-kabar aleta-basmassal-kabar-salah", hasil.sebab));
    return;
  }
  const halangan = hasil.temuan.filter((t) => t && t.tingkat === "halangan").length;
  kotak.appendChild(
    basmassalEl(
      "div",
      `aleta-basmassal-kabar ${halangan ? "aleta-basmassal-kabar-peringatan" : "aleta-basmassal-kabar-baik"}`,
      `${hasil.jumlahTerisi} dari ${hasil.jumlahPenanda} isian terisi` +
        (hasil.jumlahTersisa ? ` · ${hasil.jumlahTersisa} masih kosong` : "") +
        (hasil.ringkasan ? ` - ${hasil.ringkasan}` : "")
    )
  );
  if (hasil.temuan.length) {
    const rinci = basmassalEl("details", "aleta-basmassal-rinci");
    rinci.appendChild(basmassalEl("summary", "", `Yang perlu dilengkapi (${hasil.temuan.length})`));
    const ul = basmassalEl("ul", "aleta-basmassal-daftar-temuan");
    for (const t of hasil.temuan.slice(0, 30)) {
      const li = basmassalEl("li", t && t.tingkat === "halangan" ? "aleta-basmassal-salah" : "", `${String((t && t.hal) || "")}: ${String((t && t.tindakan) || (t && t.keterangan) || "")}`);
      ul.appendChild(li);
    }
    rinci.appendChild(ul);
    kotak.appendChild(rinci);
    // Butir 1 (1 Okt): bentuk lipat seragam - UI Baru saja (K1).
    if (basmassalModeUi() && typeof alatJadikanLipat === "function") {
      try {
        alatJadikanLipat(rinci);
      } catch {
        /* details biasa */
      }
    }
  }
  kotak.appendChild(basmassalEl("div", "aleta-basmassal-lembut aleta-teknis", `Blangko: ${pilihan.berkas} (${pilihan.folder})`));
}

/**
 * Satu baris perkara. Pulang pengendali { baris, pilihan(), centang, kerjakan(paksa) }.
 */
function basmassalGambarBaris(daftar, baris, konteks) {
  const akar = basmassalEl("div", "aleta-basmassal-baris");
  akar.setAttribute("data-nomor", baris.nomorPerkara);

  const kepala = basmassalEl("div", "aleta-basmassal-kepala");
  const label = basmassalEl("label", "aleta-basmassal-pilih-perkara");
  const centang = document.createElement("input");
  centang.type = "checkbox";
  centang.className = "aleta-basmassal-centang";
  centang.disabled = true;
  label.appendChild(centang);
  label.appendChild(basmassalEl("span", "aleta-basmassal-nomor", baris.nomorPerkara));
  kepala.appendChild(label);
  const sidang = [
    baris.urutanSidang > 0 ? `sidang ke-${baris.urutanSidang}` : "",
    baris.jamSidang,
    baris.agenda,
  ]
    .filter(Boolean)
    .join(" · ");
  if (sidang) kepala.appendChild(basmassalEl("span", "aleta-basmassal-lembut", sidang));
  akar.appendChild(kepala);

  const status = basmassalEl("div", "aleta-basmassal-status");
  if (baris.basSipp === true) status.appendChild(basmassalTanda("BAS sudah di SIPP", "baik", "BAS sidang ini sudah diunggah ke SIPP."));
  else if (baris.basSipp === false) status.appendChild(basmassalTanda("BAS belum di SIPP", "belum", "BAS sidang ini belum diunggah ke SIPP."));
  status.appendChild(basmassalTanda(baris.kehadiran, "", "Kehadiran menurut jadwal sidang SIPP."));
  const saksi = baris.saksi || { pihak1: 0, pihak2: 0, nama1: [], nama2: [] };
  if (saksi.pihak1 + saksi.pihak2 > 0) {
    status.appendChild(
      basmassalTanda(
        `saksi ${saksi.pihak1 + saksi.pihak2}`,
        "",
        [...(saksi.nama1 || []), ...(saksi.nama2 || [])].join(", ") || "Saksi yang diajukan di SIPP."
      )
    );
  }
  if (baris.lembar && baris.lembar.jumlah > 0) {
    status.appendChild(
      basmassalTanda(
        `lembar BAS ${baris.lembar.selesai}/${baris.lembar.jumlah} selesai`,
        baris.lembar.selesai === baris.lembar.jumlah ? "baik" : "",
        "Lembar BAS yang diketik di Alat Bantu Tulis BAS portal ALETA."
      )
    );
  }
  if (baris.sudahPutus) status.appendChild(basmassalTanda("sudah putus", "", ""));
  if (konteks.tampilkanPp && baris.paniteraNama) status.appendChild(basmassalTanda(`PP: ${baris.paniteraNama}`, "", ""));
  akar.appendChild(status);

  const b = baris.blangko || { usulan: null, pilihan: [], sebab: "" };
  const barisBlangko = basmassalEl("div", "aleta-basmassal-baris-blangko");
  const pilih = document.createElement("select");
  pilih.className = "aleta-basmassal-blangko";
  const kosong = document.createElement("option");
  kosong.value = "";
  kosong.textContent = b.pilihan.length ? "Pilih blangko BAS..." : "tidak ada blangko BAS";
  pilih.appendChild(kosong);
  b.pilihan.forEach((p, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `${p.label}${b.pilihan.some((x) => x.setId !== p.setId) ? ` (${p.setNama})` : ""}`;
    o.title = p.berkas;
    pilih.appendChild(o);
  });
  if (b.usulan) {
    const i = b.pilihan.findIndex((p) => p.berkas === b.usulan.berkas && p.folder === b.usulan.folder);
    if (i >= 0) pilih.value = String(i);
  }
  pilih.disabled = b.pilihan.length === 0;
  barisBlangko.appendChild(pilih);
  // Perbaikan 2 Okt sore (P, butir 8 - UI Baru): usulan dari Pemetaan blangko
  // BAS server disebut asalnya. Pemilihannya sendiri dikerjakan rute
  // bas-massal (susun.ts) di semua tampilan; Lama tidak memanggil berkas ini.
  if (b.usulan && b.usulan.dariPemetaan && basmassalModeUi()) {
    const tanda = basmassalTanda("dari Pemetaan blangko", "", `Diatur admin di Pemetaan blangko > BAS (kunci ${b.usulan.dariPemetaan})`);
    tanda.classList.add("aleta-p3-dari-peta");
    barisBlangko.appendChild(tanda);
  }
  akar.appendChild(barisBlangko);
  if (b.sebab) akar.appendChild(basmassalEl("div", "aleta-basmassal-lembut", b.sebab));

  const aksi = basmassalEl("div", "aleta-basmassal-aksi");
  const tPratinjau = basmassalTombol("Pratinjau", "aleta-basmassal-tombol-kecil", "Periksa isian BAS sebelum diunduh - tidak ada yang ditulis");
  const tUnduh = basmassalTombol("Unduh", "aleta-basmassal-tombol-kecil", "Unduh blangko BAS terisi (RTF)");
  aksi.appendChild(tPratinjau);
  aksi.appendChild(tUnduh);
  const tAbt = basmassalTombol("Buka di ABT", "aleta-basmassal-tombol-kecil", "Buka blangko ini di ABT (tab baru) - susun keterangan saksi di panel ABT perkara itu");
  tAbt.hidden = true;
  aksi.appendChild(tAbt);
  const aKelompok = basmassalEl("a", "aleta-basmassal-tautan", "Kelompok di ABT");
  aKelompok.target = "_blank";
  aKelompok.rel = "noopener";
  aKelompok.hidden = true;
  aksi.appendChild(aKelompok);
  const aCetak = basmassalEl("a", "aleta-basmassal-tautan", "Cetak ABT");
  aCetak.target = "_blank";
  aCetak.rel = "noopener";
  aCetak.title = "Tombol CETAK ABT sendiri untuk blangko dan perkara ini";
  aCetak.hidden = true;
  aksi.appendChild(aCetak);
  akar.appendChild(aksi);

  const hasil = basmassalEl("div", "aleta-basmassal-hasil");
  akar.appendChild(hasil);
  daftar.appendChild(akar);

  const pilihan = () => {
    const i = pilih.value === "" ? -1 : Number(pilih.value);
    return i >= 0 && b.pilihan[i] ? b.pilihan[i] : null;
  };
  let tokenBerkas = null;
  const segarkan = () => {
    const p = pilihan();
    const bisa = Boolean(p) && /^\d+$/.test(String(baris.perkaraId || ""));
    centang.disabled = !bisa;
    if (!bisa) centang.checked = false;
    tPratinjau.disabled = !bisa;
    tUnduh.disabled = !bisa;
    const token = p ? basmassalTokenUntuk(konteks.token, p.folder, p.berkas) : { berkas: null, kelompok: null };
    tokenBerkas = bisa ? token.berkas : null;
    tAbt.hidden = !tokenBerkas;
    if (tokenBerkas) {
      const q = new URLSearchParams({ a: tokenBerkas.a, b: tokenBerkas.b, c: String(baris.perkaraId) });
      aCetak.href = `${String(tokenBerkas.asal || basmassalAsalAbt())}/preview?${q.toString()}`;
      aCetak.hidden = false;
      aKelompok.hidden = true;
    } else {
      aCetak.hidden = true;
      if (p && token.kelompok && baris.perkaraId) {
        const q = new URLSearchParams({ a: token.kelompok.a, c: String(baris.perkaraId) });
        aKelompok.href = `${String(token.kelompok.asal || basmassalAsalAbt())}/main/beranda?${q.toString()}`;
        aKelompok.title = `Buka kelompok "${token.kelompok.nama}" di ABT untuk perkara ini, lalu pilih blangkonya`;
        aKelompok.hidden = false;
      } else {
        aKelompok.hidden = true;
      }
    }
    konteks.segarkanAksi();
  };
  pilih.addEventListener("change", segarkan);
  centang.addEventListener("change", () => konteks.segarkanAksi());

  const pratinjau = async () => {
    const p = pilihan();
    if (!p) return null;
    hasil.textContent = "";
    hasil.appendChild(basmassalEl("div", "aleta-basmassal-lembut", "Memeriksa isian..."));
    const h = await basmassalPeriksa(baris, p);
    basmassalGambarPratinjau(hasil, h, p);
    return h;
  };
  const unduh = async () => {
    const p = pilihan();
    if (!p) return null;
    const u = await basmassalUnduh(baris, p);
    const kabar = basmassalEl("div", "aleta-basmassal-kabar");
    if (u.ok) {
      basmassalKabar(kabar, `Diunduh: ${u.nama}${u.tersisa.length ? ` - ${u.tersisa.length} isian masih kosong, lengkapi di Word` : ""}`, u.tersisa.length ? "peringatan" : "baik");
    } else {
      basmassalKabar(kabar, `Tidak diunduh: ${u.sebab}`, "salah");
    }
    hasil.appendChild(kabar);
    return u;
  };
  tPratinjau.addEventListener("click", async () => {
    tPratinjau.disabled = true;
    await pratinjau();
    tPratinjau.disabled = !pilihan();
  });
  tUnduh.addEventListener("click", async () => {
    tUnduh.disabled = true;
    await unduh();
    tUnduh.disabled = !pilihan();
  });
  tAbt.addEventListener("click", () => {
    if (!tokenBerkas) return;
    const j = basmassalBukaDiAbt(tokenBerkas, baris.perkaraId);
    if (!j.ok) {
      const kabar = basmassalEl("div", "aleta-basmassal-kabar");
      basmassalKabar(kabar, j.sebab, "peringatan");
      hasil.appendChild(kabar);
    }
  });

  /** Beruntun: pratinjau, lalu unduh bila tidak ada halangan (atau dipaksa). */
  const kerjakan = async (paksa) => {
    const h = await pratinjau();
    if (!h || !h.ok) return { keadaan: "gagal" };
    const halangan = h.temuan.filter((t) => t && t.tingkat === "halangan");
    if (halangan.length && !paksa) {
      const kabar = basmassalEl("div", "aleta-basmassal-kabar");
      basmassalKabar(kabar, `Dilewati - ada ${halangan.length} halangan. Lengkapi dulu, atau centang "unduh walau ada halangan".`, "peringatan");
      hasil.appendChild(kabar);
      return { keadaan: "dilewati" };
    }
    const u = await unduh();
    return { keadaan: u && u.ok ? "diunduh" : "gagal" };
  };

  segarkan();
  return { baris, centang, pilihan, kerjakan, segarkan };
}

function basmassalGambar(akar, konteks) {
  const judul = basmassalEl("div", "aleta-basmassal-judul");
  const judulTeks = basmassalEl("span", "aleta-basmassal-judul-teks", "BAS massal");
  judul.appendChild(judulTeks);
  // Butir 7 (2 Okt, UI Baru): tag peran di samping judul - bentuk yang sama
  // dengan kepala lipatan (alatLipatTagPeran milik W). Baru tetap 1.177.0.
  if (basmassalModeUi() && typeof alatLipatTagPeran === "function") {
    try {
      alatLipatTagPeran(judul, "PP", judulTeks);
    } catch {
      /* tanpa tag */
    }
  }
  const info = basmassalTombol("ⓘ", "aleta-basmassal-info", "Penjelasan");
  info.setAttribute("aria-expanded", "false");
  judul.appendChild(info);
  akar.appendChild(judul);
  const uraian = basmassalEl(
    "div",
    "aleta-basmassal-uraian",
    "Perkara yang bersidang pada tanggal yang dipilih, beserta status BAS-nya. Pilih blangko, Pratinjau untuk melihat " +
      "isian yang masih kosong, lalu Unduh - atau centang beberapa perkara dan tekan \"Kerjakan yang dicentang\". " +
      "Keterangan saksi 1 & 2 disusun di panel ABT perkara itu (Buka di ABT). Tombol Buka di ABT muncul setelah " +
      "kelompok blangko BAS pernah dibuka di ABT di peramban ini."
  );
  uraian.appendChild(
    basmassalEl(
      "div",
      "aleta-teknis",
      "Sumber: jadwal SIPP (edoc BAS, saksi, dihadiri_oleh) lewat ALETA Bot, katalog blangko APS Badilag, lembar " +
        "aleta_bas_lembar. Usulan blangko hanya bila keadaan di nama blangko cocok dengan kehadiran. Pratinjau = " +
        "GET bas/periksa, Unduh = GET bas/naskah (blangko asli ABT, RTF). Tidak ada yang ditulis ke SIPP, ABT, maupun ALETA."
    )
  );
  uraian.hidden = true;
  info.addEventListener("click", () => {
    uraian.hidden = !uraian.hidden;
    info.setAttribute("aria-expanded", uraian.hidden ? "false" : "true");
  });
  akar.appendChild(uraian);

  const atas = basmassalEl("div", "aleta-basmassal-baris-atas");
  const tanggal = document.createElement("input");
  tanggal.type = "date";
  tanggal.className = "aleta-basmassal-pilih aleta-basmassal-tanggal";
  tanggal.value = basmassalTanggalIso(new Date());
  atas.appendChild(tanggal);
  const saring = document.createElement("select");
  saring.className = "aleta-basmassal-pilih aleta-basmassal-saring";
  for (const [nilai, teks] of [
    ["", "Bawaan"],
    ["saya", "PP: saya"],
    ["semua", "Semua PP"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  saring.value = "";
  atas.appendChild(saring);
  const muat = basmassalTombol("Tampilkan", "aleta-basmassal-tombol-kecil");
  atas.appendChild(muat);
  akar.appendChild(atas);

  const kabar = basmassalEl("div", "aleta-basmassal-kabar");
  kabar.hidden = true;
  akar.appendChild(kabar);
  const daftar = basmassalEl("div", "aleta-basmassal-daftar");
  akar.appendChild(daftar);

  const bawah = basmassalEl("div", "aleta-basmassal-bawah");
  bawah.hidden = true;
  const semuaSiap = basmassalTombol("Centang semua yang berblangko", "aleta-basmassal-tombol-kecil");
  const labelPaksa = basmassalEl("label", "aleta-basmassal-paksa");
  const paksa = document.createElement("input");
  paksa.type = "checkbox";
  labelPaksa.appendChild(paksa);
  labelPaksa.appendChild(document.createTextNode(" unduh walau ada halangan"));
  const kerjakan = basmassalTombol("Kerjakan yang dicentang", "aleta-basmassal-tombol-utama", "Pratinjau lalu unduh, satu per satu");
  kerjakan.disabled = true;
  const henti = basmassalTombol("Hentikan", "aleta-basmassal-tombol-kecil");
  henti.hidden = true;
  for (const x of [semuaSiap, labelPaksa, kerjakan, henti]) bawah.appendChild(x);
  akar.appendChild(bawah);
  const kemajuan = basmassalEl("div", "aleta-basmassal-kabar");
  kemajuan.hidden = true;
  akar.appendChild(kemajuan);

  let pengendali = [];
  let berjalan = false;
  let berhenti = false;
  konteks.segarkanAksi = () => {
    if (konteks.kendali) konteks.kendali.segarkan();
    const dicentang = pengendali.filter((p) => p.centang.checked && !p.centang.disabled).length;
    kerjakan.disabled = berjalan || dicentang === 0;
    kerjakan.textContent = dicentang > 1 ? `Kerjakan ${dicentang} yang dicentang` : "Kerjakan yang dicentang";
  };

  const tampilkan = async () => {
    if (berjalan) return;
    muat.disabled = true;
    daftar.textContent = "";
    pengendali = [];
    konteks.kendali = null;
    bawah.hidden = true;
    basmassalKabar(kemajuan, "", "");
    basmassalKabar(kabar, "Membaca sidang...", "");
    const [j, token] = await Promise.all([basmassalMuatDaftar(tanggal.value, saring.value), basmassalBacaToken()]);
    // Bagiannya sudah dibuang (panel ditutup / dipasang ulang) selama menunggu.
    if (!akar.isConnected) return;
    konteks.token = token;
    muat.disabled = false;
    if (!j.data) {
      basmassalKabar(kabar, j.sebab || "Daftar sidang tidak terbaca.", "salah");
      return;
    }
    const d = j.data;
    if (saring.value === "" && (d.saringan === "saya" || d.saringan === "semua")) saring.value = d.saringan;
    konteks.tampilkanPp = d.saringan === "semua";
    const sidang = d.sidang;
    if (sidang.length === 0) {
      const lain = d.saringan === "saya" && Number(d.jumlahSemua) > 0 ? ` (${d.jumlahSemua} perkara bersidang dengan PP lain - pilih "Semua PP")` : "";
      basmassalKabar(kabar, `Tidak ada sidang ${d.saringan === "saya" ? "Anda " : ""}pada ${d.tanggal}${lain}.`, "");
      return;
    }
    const belumSipp = sidang.filter((s) => s.basSipp === false).length;
    const berUsulan = sidang.filter((s) => s.blangko && s.blangko.usulan).length;
    basmassalKabar(
      kabar,
      `${sidang.length} perkara bersidang${belumSipp ? ` · ${belumSipp} BAS belum di SIPP` : ""} · ${berUsulan} blangko terusul`,
      ""
    );
    if (d.saringan === "semua" && basmassalPerUserBoleh(konteks.peranAktif)) {
      // Butir 14 (1 Okt): admin di UI Baru bekerja PER PP - kelompok berlipat,
      // centang "Kerjakan semua milik X" dan centang per perkara. Nama PP ada
      // di kepala kelompok, jadi tanda "PP:" di tiap baris tidak diulang.
      konteks.tampilkanPp = false;
      // Butir 19 (2 Okt): kelompok milik akun yang masuk terbuka, PP lain
      // tertutup. Pemanggil yang menyebut peran belum membaca akunnya.
      if (konteks.namaSaya === undefined) {
        const siapa = await basmassalMuatSiapa();
        konteks.namaSaya = siapa ? siapa.nama : "";
        if (!akar.isConnected) return;
      }
      const kelompok = aletaMassalKelompokkan(sidang, (b) => (b && b.pengguna) || (b && b.paniteraNama) || "");
      konteks.kendali = aletaMassalGambarKelompok(daftar, kelompok, {
        peran: konteks.peranAktif,
        kunciLipat: "bas-massal",
        peranLipat: "PP",
        namaSaya: konteks.namaSaya,
        judul: (u, xs) => `PP: ${u.nama || "belum ditunjuk"} · ${xs.length} perkara`,
        gambarBaris: (s, isi) => {
          const p = basmassalGambarBaris(isi, s, konteks);
          pengendali.push(p);
          return p;
        },
      });
    } else {
      for (const s of sidang) pengendali.push(basmassalGambarBaris(daftar, s, konteks));
    }
    bawah.hidden = false;
    konteks.segarkanAksi();
  };
  muat.addEventListener("click", () => void tampilkan());
  tanggal.addEventListener("change", () => void tampilkan());
  saring.addEventListener("change", () => void tampilkan());

  semuaSiap.addEventListener("click", () => {
    for (const p of pengendali) if (!p.centang.disabled) p.centang.checked = true;
    konteks.segarkanAksi();
  });
  henti.addEventListener("click", () => {
    berhenti = true;
    henti.disabled = true;
  });
  kerjakan.addEventListener("click", async () => {
    const dipilih = pengendali.filter((p) => p.centang.checked && !p.centang.disabled);
    if (dipilih.length === 0 || berjalan) return;
    berjalan = true;
    berhenti = false;
    henti.hidden = false;
    henti.disabled = false;
    muat.disabled = true;
    // Uji rilis 9 Okt 2026: tanggal & saringan dikunci selama putaran. Dulu
    // keduanya tetap dapat diganti, tampilkan() diam-diam menolak (berjalan),
    // dan sesudah putaran daftar tanggal LAMA tampil di bawah tanggal BARU -
    // "Kerjakan" berikutnya mengunduh BAS sidang yang bukan tanggal tertulis.
    tanggal.disabled = true;
    saring.disabled = true;
    konteks.segarkanAksi();
    const hitung = { diunduh: 0, dilewati: 0, gagal: 0 };
    for (let i = 0; i < dipilih.length; i += 1) {
      if (berhenti) break;
      basmassalKabar(kemajuan, `Mengerjakan ${i + 1} dari ${dipilih.length}: ${dipilih[i].baris.nomorPerkara}`, "");
      let h;
      try {
        h = await dipilih[i].kerjakan(paksa.checked);
      } catch {
        h = { keadaan: "gagal" };
      }
      hitung[h.keadaan] = (hitung[h.keadaan] || 0) + 1;
      if (i < dipilih.length - 1 && !berhenti) await new Promise((r) => setTimeout(r, BASMASSAL_JEDA_BERUNTUN_MS));
    }
    const sisa = dipilih.length - hitung.diunduh - hitung.dilewati - hitung.gagal;
    basmassalKabar(
      kemajuan,
      `${berhenti ? "Dihentikan" : "Selesai"}: ${hitung.diunduh} diunduh` +
        (hitung.dilewati ? ` · ${hitung.dilewati} dilewati` : "") +
        (hitung.gagal ? ` · ${hitung.gagal} gagal` : "") +
        (sisa > 0 ? ` · ${sisa} belum dikerjakan` : ""),
      hitung.gagal ? "salah" : hitung.dilewati || sisa ? "peringatan" : "baik"
    );
    berjalan = false;
    henti.hidden = true;
    muat.disabled = false;
    tanggal.disabled = false;
    saring.disabled = false;
    konteks.segarkanAksi();
  });

  return tampilkan;
}

/* ─── 6. Pintu masuk ─────────────────────────────────────────────────────── */

async function aletaBasMassalPasang(wadah, opsi) {
  // Tampilan Lama: tidak ada yang digambar, dibaca, maupun disimpan.
  if (!basmassalModeBaru()) return false;
  if (!wadah || typeof wadah.appendChild !== "function") return false;
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const situs = o.situs === "abt" ? "abt" : "sipp";

  let boleh = false;
  let peranAktif = "";
  let namaSaya;
  if (typeof o.peran === "string" && o.peran.trim()) {
    boleh = basmassalPeranBoleh(situs, o.peran);
    peranAktif = o.peran.trim();
  } else {
    const siapa = await basmassalMuatSiapa();
    if (siapa) {
      const semua = [siapa.peran, siapa.roleId, ...siapa.peranTambahan];
      boleh = semua.some((p) => basmassalPeranBoleh(situs, p));
      // Pengelompokan per PP (K4) hanya bila akun ini memang admin.
      const admin = typeof alatGolonganPeran === "function" ? semua.find((p) => alatGolonganPeran(p) === "admin") : "";
      peranAktif = admin || siapa.peran;
      namaSaya = siapa.nama;
    }
  }
  if (!boleh || !basmassalModeBaru()) return false;

  if (situs === "abt") await basmassalPanenTokenAbt();

  const lama = wadah.querySelector(`:scope > .${BASMASSAL_PENANDA}`);
  if (lama) lama.remove();
  const akar = basmassalEl("div", BASMASSAL_PENANDA);
  akar.setAttribute("data-situs", situs);
  const konteks = { token: { kelompok: {}, berkas: {} }, tampilkanPp: false, segarkanAksi: () => {}, peranAktif, kendali: null, namaSaya };
  const tampilkan = basmassalGambar(akar, konteks);
  wadah.appendChild(akar);
  // Membaca daftar hari ini sekali (GET). Tidak ada yang tercentang sendiri.
  void tampilkan();
  return true;
}

globalThis.aletaBasMassalPasang = aletaBasMassalPasang;
