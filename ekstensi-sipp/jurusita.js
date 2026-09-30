/*
 * ============================================================================
 * TAB JURU SITA - CETAK RELAAS PANGGILAN DAN PEMBERITAHUAN PUTUSAN (30 SEP 2026)
 * ============================================================================
 *
 * Skrip konten bersama untuk panel SIPP (konten.js) dan panel ABT (abt.js).
 * Dimuat SESUDAH panel-alat.js (alatUjiMode, alatAmbil, alatKelasPeran, alatEl,
 * alatKeringNyala) dan SEBELUM konten.js / abt.js. Ia tidak memasang apa pun
 * sendiri; panel yang memanggilnya:
 *
 *   globalThis.aletaJurusitaPasang(wadah, { situs: "sipp"|"abt", nomorPerkara, perkaraId })
 *     -> Promise<boolean>  true bila bagian Juru Sita tergambar di `wadah`
 *   globalThis.aletaJurusitaBoleh(peran?)
 *     -> boolean           penentu cepat untuk menampilkan tabnya atau tidak
 *   globalThis.aletaJurusitaPasangMassal(wadah, { situs: "sipp"|"abt" })
 *     -> Promise<boolean>  panel "Relaas & pemberitahuan putusan - massal"
 *                          yang berdiri sendiri, untuk halaman DAFTAR perkara
 *                          SIPP dan BERANDA ABT (kontrak K3, perbaikan 30 Sep
 *                          sore). false = ditolak (Lama / peran tidak boleh).
 *
 * ============================================================================
 * TAMPILAN LAMA TIDAK MENGGAMBAR APA PUN
 * ============================================================================
 *
 * Dalam tampilan Lama pemanggilan ini pulang false SEKETIKA: tidak ada satu
 * pun elemen, atribut, permintaan jaringan, maupun pesan ke pekerja latar.
 *
 * Yang boleh melihatnya (perbaikan 30 Sep sore, selaras matriks
 * alatGolonganPeran/alatMenuPeran di panel-alat.js): ADMIN (Super Admin dan
 * Admin) dan JURU SITA. Panitera, PP, panmud, ketua/wakil, dan hakim TIDAK -
 * menurut susunan menu yang ditetapkan pengguna, relaas/PBT milik juru sita.
 * Peran "lain" (operator, staf, analis, ...) memakai aturan lama
 * (alatKelasPeran super/admin/panitera) - tidak dikurangi. Satu saja dari
 * peran utama/tambahan akun yang boleh sudah cukup.
 *
 * ============================================================================
 * JALUR CETAKNYA JALUR YANG SUDAH ADA (KONTRAK K5) - TIDAK ADA YANG BARU
 * ============================================================================
 *
 * Relaas dicetak lewat mesin relaas massal di latar.js - pesan chrome.runtime
 * { sumber: "aleta-panel", jenis: "relaas-mulai" | "relaas-keadaan" |
 * "relaas-henti" | "relaas-lanjut" | "relaas-bersihkan" }, persis bentuk yang
 * diteruskan jembatan aleta.js dari dialog Cetak relaas di Antrian Sidang.
 * Pekerja latar yang mengambil RTF dari ABT (dengan hak akses ABT petugas itu
 * sendiri), meminta PDF ke /aleta/api/aleta-bot/abt/pdf, lalu menyimpannya di
 * folder unduhan:
 *
 *   ALETA relaas <tanggal>/<juru sita>/<nomor perkara> - <keterangan>.rtf|.pdf
 *
 * Asal portal dan ABT dihitung dari location.origin halaman ini, seperti
 * jembatan aleta.js; latar.js memeriksanya lagi terhadap asal tab pengirim.
 * TIDAK ADA YANG DITULIS KE SIPP: relaas di sini pembuatan dokumen (unduhan).
 * Seluruh permintaan di jalurnya pembacaan atau hitungan yang memang sudah
 * dibolehkan mode coba dan mode latihan (abt/pdf, main/cari ABT). Mode KERING
 * menahannya: yang akan dicetak disebutkan, tidak ada yang diunduh.
 *
 * Bahan per perkara: GET /aleta/api/aleta-ecourt/sidang?nomor= (rincian SIPP -
 * seluruh jadwal perkara, putusan, juru sita). Bahan massal: GET
 * /aleta/api/aleta-ecourt/relaas-massal/cetak?tanggal= - rute yang sama dengan
 * dialog Cetak relaas di portal, lengkap dengan blangko dan penilaian "dapat
 * dicetak" dari pohon-blangko.ts.
 *
 * ============================================================================
 * PEMETAAN BLANGKO (KONTRAK K3): SERVER, LALU SIMPANAN, LALU BAWAAN
 * ============================================================================
 *
 * GET /aleta/api/aleta-ecourt/pemetaan-blangko?jenis=relaas|pbt. Jawaban server
 * disimpan di chrome.storage.local "petaBlangkoRelaasPbt" dan dipakai bila
 * server tidak menjawab (404 sebelum rutenya terpasang, bot mati, jaringan).
 * Tanpa keduanya dipakai bawaan tertanam - nama berkas yang SAMA PERSIS dengan
 * BLANGKO_RELAAS di manajemen_surat/src/lib/pohon-blangko.ts (dijaga uji
 * ekstensi-jurusita.test.ts), termasuk SATU SPASI sebelum ".rtf" pada blangko
 * sidang lanjutan.
 *
 * Kunci yang dibaca (K3): panggilan-penggugat, panggilan-tergugat,
 * panggilan-pemohon, panggilan-termohon, panggilan-ikrar, pbt-penggugat,
 * pbt-tergugat, pbt-pemohon, pbt-termohon, dan satu kunci bebas:
 * panggilan-sidang-pertama. Sidang PERTAMA selalu memakai kunci itu (bawaannya
 * blangko "P dan T"), bukan kunci per pihak: blangko per pihak bawaannya
 * berjudul "(Sidang Lanjutan)".
 */

const JURUSITA_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
const JURUSITA_API_PEMETAAN = "/aleta/api/aleta-ecourt/pemetaan-blangko";
const JURUSITA_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";
const JURUSITA_API_CETAK = "/aleta/api/aleta-ecourt/relaas-massal/cetak";
const JURUSITA_KUNCI_PETA = "petaBlangkoRelaasPbt";
const JURUSITA_PENANDA = "aleta-jurusita";
/**
 * Kelas peran (alatKelasPeran) yang melihat tab Juru Sita - kini HANYA untuk
 * peran bergolongan "lain" menurut matriks K1 (lihat jurusitaKelasBoleh).
 */
const JURUSITA_KELAS_BOLEH = ["aleta-peran-super", "aleta-peran-admin", "aleta-peran-panitera"];
/**
 * Nilai data-peran panel (alatTandaiPeranPanel) - cadangan bila akun ALETA
 * tidak terbaca dan pemanggil tidak menyebut perannya. "panitera" di sana
 * mencakup juru sita (alatKelasPeran tidak membedakannya), jadi ia tetap
 * diterima: tanpa akun, rute ALETA mana pun menolak, dan yang tampak hanya
 * keterangan gagal - bukan kewenangan.
 */
const JURUSITA_DATA_PERAN_BOLEH = ["super", "admin", "panitera"];
const JURUSITA_BATAS_MULAI_MS = 60000;
const JURUSITA_BATAS_PESAN_MS = 15000;
const JURUSITA_JEDA_PANTAU_MS = 2500;
const JURUSITA_NAMA_MAKS = 180;

/**
 * Blangko bawaan per kunci pemetaan - dipakai hanya bila server dan simpanan
 * sama-sama tidak menyebut kuncinya. Nama berkasnya APA ADANYA.
 */
const JURUSITA_BLANGKO_P_DAN_T = "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf";
const JURUSITA_BLANGKO_T_LANJUTAN = "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf";
const JURUSITA_BLANGKO_PBT = "[JS] 2. Relaas Pemberitahuan Putusan.rtf";
const JURUSITA_BLANGKO_IKRAR = "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf";
const JURUSITA_TERTANAM = {
  relaas: {
    "panggilan-sidang-pertama": JURUSITA_BLANGKO_P_DAN_T,
    "panggilan-penggugat": JURUSITA_BLANGKO_P_DAN_T,
    "panggilan-pemohon": JURUSITA_BLANGKO_P_DAN_T,
    "panggilan-tergugat": JURUSITA_BLANGKO_T_LANJUTAN,
    "panggilan-termohon": JURUSITA_BLANGKO_T_LANJUTAN,
    "panggilan-ikrar": JURUSITA_BLANGKO_IKRAR,
  },
  pbt: {
    "pbt-penggugat": JURUSITA_BLANGKO_PBT,
    "pbt-pemohon": JURUSITA_BLANGKO_PBT,
    "pbt-tergugat": JURUSITA_BLANGKO_PBT,
    "pbt-termohon": JURUSITA_BLANGKO_PBT,
  },
};
const JURUSITA_SEBUTAN_SUMBER = { server: "server", simpanan: "simpanan server terakhir", bawaan: "bawaan ekstensi" };

/** Akun ALETA yang sedang masuk - dibaca sekali per halaman. */
let jurusitaSiapa = null;
/** Pemetaan yang berlaku: { relaas: {peta, sumber}, pbt: {peta, sumber} } - dibaca sekali per halaman. */
let jurusitaPetaBerlaku = null;

/* ─── 1. Peran dan gerbang tampilan ───────────────────────────────────────── */

function jurusitaModeBaru() {
  try {
    return typeof alatUjiMode === "function" && alatUjiMode() !== "lama";
  } catch {
    return false;
  }
}

/**
 * Satu nama/id peran boleh melihat relaas & PBT?
 *
 * Matriks K1 (alatGolonganPeran) lebih dahulu: admin dan juru sita boleh,
 * golongan bernama lainnya (ketua, hakim, panitera) tidak. Peran "lain" -
 * atau matriks yang belum termuat - jatuh ke aturan lama alatKelasPeran,
 * supaya peran yang tidak disebut pengguna tidak kehilangan apa pun.
 */
function jurusitaKelasBoleh(peran) {
  if (!peran) return false;
  const golongan = typeof alatGolonganPeran === "function" ? alatGolonganPeran(peran) : "";
  if (golongan === "admin" || golongan === "jurusita") return true;
  if (golongan && golongan !== "lain") return false;
  if (typeof alatKelasPeran !== "function") return false;
  return JURUSITA_KELAS_BOLEH.includes(alatKelasPeran(peran));
}

/** Boleh melihat tab Juru Sita? Satu saja dari peran utama/tambahan yang cocok sudah cukup. */
function jurusitaPeranBoleh(siapa) {
  if (!siapa) return false;
  const semua = [siapa.roleId, siapa.peran, ...(Array.isArray(siapa.peranTambahan) ? siapa.peranTambahan : [])];
  return semua.some((p) => jurusitaKelasBoleh(String(p || "")));
}

function jurusitaAdmin(siapa) {
  if (!siapa || typeof alatKelasPeran !== "function") return false;
  const semua = [siapa.roleId, siapa.peran, ...(Array.isArray(siapa.peranTambahan) ? siapa.peranTambahan : [])];
  return semua.some((p) => ["aleta-peran-super", "aleta-peran-admin"].includes(alatKelasPeran(String(p || ""))));
}

/** Juru sita sungguhan (bukan panitera/admin) - penentu bawaan saringan "milik saya". */
function jurusitaJurusitaSendiri(siapa) {
  if (!siapa) return false;
  const semua = [siapa.roleId, siapa.peran, ...(Array.isArray(siapa.peranTambahan) ? siapa.peranTambahan : [])];
  return semua.some((p) => /juru\s*sita|jurusita/i.test(String(p || "")));
}

async function jurusitaMuatSiapa() {
  if (jurusitaSiapa) return jurusitaSiapa;
  try {
    const r = await alatAmbil(JURUSITA_API_SIAPA, { credentials: "include", cache: "no-store" }, "Membaca akun ALETA");
    if (!r.ok) return null;
    const luar = await r.json();
    const isi = luar && luar.data ? luar.data : luar;
    if (!isi || !isi.nama) return null;
    jurusitaSiapa = {
      nama: String(isi.nama || ""),
      peran: String(isi.peran || ""),
      roleId: String(isi.roleId || ""),
      peranTambahan: Array.isArray(isi.peranTambahan) ? isi.peranTambahan.map(String) : [],
    };
    return jurusitaSiapa;
  } catch {
    return null;
  }
}

/* ─── 2. Pemetaan blangko (K3) ────────────────────────────────────────────── */

/** { kunci: namaBerkas } dari jawaban K3; butir tanpa nama berkas dibuang. */
function jurusitaPetaDariButir(butir) {
  const peta = {};
  for (const b of Array.isArray(butir) ? butir : []) {
    const kunci = String((b && b.kunci) || "").trim();
    const nama = typeof (b && b.namaBerkas) === "string" ? b.namaBerkas : "";
    // Nama berkas TIDAK dirapikan: spasi sebelum ".rtf" bagian dari namanya.
    if (kunci && nama.trim()) peta[kunci] = nama;
  }
  return peta;
}

async function jurusitaBacaSimpananPeta() {
  try {
    const s = await chrome.storage.local.get([JURUSITA_KUNCI_PETA]);
    const isi = s && s[JURUSITA_KUNCI_PETA];
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    return {};
  }
}

async function jurusitaAmbilPetaServer(jenis) {
  try {
    const r = await alatAmbil(
      `${JURUSITA_API_PEMETAAN}?jenis=${encodeURIComponent(jenis)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca pemetaan blangko"
    );
    if (!r.ok) return null;
    const luar = await r.json();
    if (!luar || luar.ok === false) return null;
    const isi = luar.data ? luar.data : luar;
    if (!isi || !Array.isArray(isi.butir)) return null;
    return { peta: jurusitaPetaDariButir(isi.butir), diubahPada: String(isi.diubahPada || "") };
  } catch {
    return null;
  }
}

/**
 * Pemetaan relaas dan PBT yang berlaku. Tiap jenis: server -> simpanan -> kosong
 * (kosong berarti seluruh kunci jatuh ke bawaan tertanam).
 */
async function jurusitaMuatPeta(paksa) {
  if (jurusitaPetaBerlaku && !paksa) return jurusitaPetaBerlaku;
  const simpanan = await jurusitaBacaSimpananPeta();
  const hasil = {};
  const simpanBaru = { ...simpanan };
  let adaBaru = false;
  for (const jenis of ["relaas", "pbt"]) {
    const server = await jurusitaAmbilPetaServer(jenis);
    if (server) {
      hasil[jenis] = { peta: server.peta, sumber: "server", diubahPada: server.diubahPada };
      simpanBaru[jenis] = { peta: server.peta, diubahPada: server.diubahPada, diambil: Date.now() };
      adaBaru = true;
    } else if (simpanan[jenis] && simpanan[jenis].peta && typeof simpanan[jenis].peta === "object") {
      hasil[jenis] = { peta: simpanan[jenis].peta, sumber: "simpanan", diubahPada: String(simpanan[jenis].diubahPada || "") };
    } else {
      hasil[jenis] = { peta: {}, sumber: "bawaan", diubahPada: "" };
    }
  }
  if (adaBaru) {
    try {
      await chrome.storage.local.set({ [JURUSITA_KUNCI_PETA]: simpanBaru });
    } catch {
      /* tanpa simpanan, halaman berikutnya bertanya ke server lagi */
    }
  }
  jurusitaPetaBerlaku = hasil;
  return hasil;
}

/**
 * Blangko untuk daftar kunci (urutan = prioritas). Pulang { berkas, kunci,
 * sumber } atau null. Server/simpanan menang atas bawaan untuk kunci mana pun
 * di daftar; bawaan hanya bila tidak satu kunci pun dipetakan.
 */
function jurusitaPilihBlangko(petaBerlaku, jenis, kunciDaftar) {
  const berlaku = petaBerlaku && petaBerlaku[jenis];
  if (berlaku && berlaku.sumber !== "bawaan") {
    for (const k of kunciDaftar) {
      if (berlaku.peta[k]) return { berkas: berlaku.peta[k], kunci: k, sumber: berlaku.sumber };
    }
  }
  const tertanam = JURUSITA_TERTANAM[jenis] || {};
  for (const k of kunciDaftar) {
    if (tertanam[k]) return { berkas: tertanam[k], kunci: k, sumber: "bawaan" };
  }
  return null;
}

/* ─── 3. Perkara: sebutan pihak, golongan, dokumen ────────────────────────── */

/** Sebutan pihak menurut perkaranya: Pemohon/Termohon untuk cerai talak dan permohonan. */
function jurusitaSebutan(nomorPerkara, jenisPerkara) {
  const permohonan = /\/Pdt\.P\//i.test(String(nomorPerkara || "")) || /cerai\s+talak/i.test(String(jenisPerkara || ""));
  return permohonan
    ? { pertama: "Pemohon", kedua: "Termohon", k1: "pemohon", k2: "termohon" }
    : { pertama: "Penggugat", kedua: "Tergugat", k1: "penggugat", k2: "tergugat" };
}

/** Kunci pemetaan per pihak, sebutan khusus dulu lalu sebutan umum. */
function jurusitaKunciPihak(awalan, sisi, sebutan) {
  const khusus = `${awalan}-${sisi === 1 ? sebutan.k1 : sebutan.k2}`;
  const umum = `${awalan}-${sisi === 1 ? "penggugat" : "tergugat"}`;
  return khusus === umum ? [umum] : [khusus, umum];
}

/** Sidang ikrar: agendanya menyebut ikrar, atau sidang cerai talak sesudah putusan. */
function jurusitaSidangIkrar(sidang, rincian) {
  if (/ikrar/i.test(String((sidang && sidang.agenda) || ""))) return true;
  const putus = rincian && rincian.putusan && rincian.putusan.sudahPutus ? String(rincian.putusan.tanggalPutusan || "") : "";
  return Boolean(
    putus && /cerai\s+talak/i.test(String((rincian && rincian.jenisPerkara) || "")) && String(sidang.tanggalSidang || "") > putus
  );
}

function jurusitaGolonganSidang(sidang, rincian) {
  if (jurusitaSidangIkrar(sidang, rincian)) return "ikrar-talak";
  return Number(sidang.urutanSidang) === 1 ? "sidang-pertama" : "sidang-lanjutan";
}

/** Sebutan golongan sidang untuk petugas (U3: pertama dan tundaan disebut). */
const JURUSITA_SEBUTAN_JENIS_SIDANG = {
  "sidang-pertama": "sidang pertama",
  "sidang-lanjutan": "tundaan",
  "sidang-ditunda": "tundaan",
  "ikrar-talak": "ikrar talak",
  "pemberitahuan-putusan": "PBT",
};

/**
 * Kalimat pendek: siapa yang perlu dipanggil ke sidang tundaan ke-urutan,
 * menurut kehadiran sidang SEBELUMNYA (perkara_jadwal_sidang.dihadiri_oleh -
 * 1 semua pihak, 2 hanya pihak pertama, 3 hanya pihak kedua, 4 tidak ada;
 * sandi yang sama dengan pihakDipanggil di pohon-blangko.ts). Hanya
 * memberi tahu - tidak mencentang apa pun. "" bila tidak ada yang dapat
 * dikatakan (sidang pertama, ikrar, sandi kosong).
 */
function jurusitaPetunjukTundaan(jadwal, urutan, sebutan, rincian) {
  const tujuan = (jadwal || []).find((s) => Number(s.urutanSidang) === urutan);
  if (!tujuan || jurusitaGolonganSidang(tujuan, rincian) !== "sidang-lanjutan") return "";
  const sebelum = (jadwal || [])
    .filter((s) => Number(s.urutanSidang) < urutan)
    .sort((a, b) => Number(b.urutanSidang) - Number(a.urutanSidang))[0];
  if (!sebelum) return "";
  const sandi = Number(sebelum.dihadiriOleh);
  const ke = `Sidang ke-${sebelum.urutanSidang}`;
  if (sandi === 1) return `${ke} dihadiri semua pihak - biasanya diperintahkan hadir, tanpa relaas.`;
  if (sandi === 2) return `${ke} hanya dihadiri ${sebutan.pertama} - yang dipanggil ${sebutan.kedua}.`;
  if (sandi === 3) return `${ke} hanya dihadiri ${sebutan.kedua} - yang dipanggil ${sebutan.pertama}.`;
  if (sandi === 4) return `${ke} tidak dihadiri pihak - yang dipanggil ${sebutan.pertama} dan ${sebutan.kedua}.`;
  return "";
}

function jurusitaNomorAman(nomor, perkaraId) {
  return String(nomor || `perkara ${perkaraId}`).replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function jurusitaTanggalIso(d) {
  const t = d || new Date();
  const dua = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}

/**
 * Blangko "P dan T" memuat KEDUA pihak - pohon-blangko.ts (blangkoRelaas):
 * sidang ditunda yang memanggil pihak pertama atau keduanya memakai blangko
 * itu. Bila untuk sidang yang sama P dan T sudah akan dicetak, blangko
 * "T (Sidang Lanjutan)" hanya menggandakan panggilan Tergugat: pihaknya
 * digabung ke dokumen P dan T (perbaikan 30 Sep sore - sebelumnya dua
 * dokumen). Blangko lain dari pemetaan server tidak disentuh.
 */
function jurusitaSatukanPdanT(calon) {
  const pdanT = new Map();
  for (const c of calon) {
    if (c.jenis === "panggilan" && c.blangko && c.blangko.berkas === JURUSITA_BLANGKO_P_DAN_T) pdanT.set(`${c.golongan}|${c.d}`, c.blangko);
  }
  return calon.map((c) => {
    const p = c.jenis === "panggilan" && c.blangko && c.blangko.berkas === JURUSITA_BLANGKO_T_LANJUTAN ? pdanT.get(`${c.golongan}|${c.d}`) : null;
    return p ? { ...c, blangko: p } : c;
  });
}

/**
 * Dokumen untuk satu perkara dari pilihan juru sita.
 *
 * pilihan = { panggilan: [1|2 ...], pbt: [1|2 ...] }. Pihak yang blangko DAN
 * nomor sidangnya sama menjadi SATU dokumen: pratinjau ABT tidak menerima
 * pihak (lihat relaasAlamatPratinjau di latar.js), jadi dua cetakan akan
 * menghasilkan berkas yang persis sama.
 */
function jurusitaSusunDokumen(konteks, pilihan, petaBerlaku) {
  const { perkaraId, nomorPerkara, rincian, sidang, jurusita } = konteks;
  const sebutan = jurusitaSebutan(nomorPerkara, rincian && rincian.jenisPerkara);
  const nomorAman = jurusitaNomorAman(nomorPerkara, perkaraId);
  const calon = [];
  const tanpaBlangko = [];

  const panggilan = Array.isArray(pilihan && pilihan.panggilan) ? pilihan.panggilan : [];
  if (panggilan.length > 0 && sidang) {
    const golongan = jurusitaGolonganSidang(sidang, rincian);
    const d = Number(sidang.urutanSidang);
    for (const sisi of panggilan) {
      const kunci =
        golongan === "ikrar-talak"
          ? ["panggilan-ikrar"]
          : golongan === "sidang-pertama"
            ? ["panggilan-sidang-pertama"]
            : jurusitaKunciPihak("panggilan", sisi, sebutan);
      const blangko = jurusitaPilihBlangko(petaBerlaku, "relaas", kunci);
      const pihak = sisi === 1 ? sebutan.pertama : sebutan.kedua;
      if (!blangko) {
        tanpaBlangko.push(`Panggilan ${pihak}`);
        continue;
      }
      calon.push({ golongan, d, sisi, pihak, jenis: "panggilan", blangko });
    }
  }

  const pbt = Array.isArray(pilihan && pilihan.pbt) ? pilihan.pbt : [];
  for (const sisi of pbt) {
    const blangko = jurusitaPilihBlangko(petaBerlaku, "pbt", jurusitaKunciPihak("pbt", sisi, sebutan));
    const pihak = sisi === 1 ? sebutan.pertama : sebutan.kedua;
    if (!blangko) {
      tanpaBlangko.push(`PBT ${pihak}`);
      continue;
    }
    calon.push({ golongan: "pemberitahuan-putusan", d: 0, sisi, pihak, jenis: "pbt", blangko });
  }

  // Satukan yang sama blangko dan sidangnya.
  const kelompok = new Map();
  for (const c of jurusitaSatukanPdanT(calon)) {
    const k = `${c.golongan}|${c.d}|${c.blangko.berkas}`;
    if (!kelompok.has(k)) kelompok.set(k, { ...c, pihakSemua: [c.pihak], sisiSemua: [c.sisi] });
    else {
      const ada = kelompok.get(k);
      if (!ada.pihakSemua.includes(c.pihak)) ada.pihakSemua.push(c.pihak);
      ada.sisiSemua.push(c.sisi);
    }
  }

  const dokumen = [...kelompok.values()].map((c) => {
    const pihakTeks = c.pihakSemua.join(" dan ");
    const bagian =
      c.golongan === "pemberitahuan-putusan"
        ? "pemberitahuan putusan"
        : c.golongan === "ikrar-talak"
          ? `panggilan ikrar talak sidang ke-${c.d}`
          : `panggilan sidang ke-${c.d}`;
    const sisiKunci = [...new Set(c.sisiSemua)].sort().join("");
    return {
      kunci: `jurusita:${c.golongan}:${perkaraId}:${c.d}:${sisiKunci}`.slice(0, 160),
      perkaraId: String(perkaraId),
      nomorPerkara: String(nomorPerkara || ""),
      golongan: c.golongan,
      label: `${c.jenis === "pbt" ? "Pemberitahuan putusan" : "Panggilan"} ${pihakTeks}`.slice(0, 200),
      d: c.d,
      berkas: c.blangko.berkas,
      nama: `${nomorAman} - ${bagian} ${pihakTeks}`.slice(0, JURUSITA_NAMA_MAKS),
      jurusita: String(jurusita || "").slice(0, 120),
      sumberBlangko: c.blangko.sumber,
      kunciBlangko: c.blangko.kunci,
    };
  });
  return { dokumen, tanpaBlangko };
}

/* ─── 4. Massal ───────────────────────────────────────────────────────────── */

/** Potongan nama tanpa gelar - aturan yang sama dengan potonganNamaPetugas portal. */
const JURUSITA_GELAR = new Set(["drs", "dra", "dr", "hj", "sh", "shi", "si", "mh", "ma", "mag", "ag", "se", "st", "ir", "lc", "msi", "mkn", "spdi", "sag", "bin", "binti"]);

function jurusitaPotonganNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length > 2 && !JURUSITA_GELAR.has(k));
}

/** Sama dengan namaCocokSatu di lib/perkara-sendiri.ts. */
function jurusitaNamaCocok(namaAkun, namaPetugas) {
  const akun = jurusitaPotonganNama(namaAkun);
  const petugas = jurusitaPotonganNama(namaPetugas);
  if (akun.length === 0 || petugas.length === 0) return false;
  const punya = new Set(petugas);
  if (!akun.every((k) => punya.has(k))) return false;
  if (akun.length >= 2) return true;
  return new Set(akun).size === punya.size;
}

/** Kunci pemetaan untuk satu dokumen jawaban relaas-massal/cetak. */
function jurusitaKunciMassal(dok) {
  const golongan = String(dok.golongan || "");
  const sebutanPertama = String((dok.sebutanPihak && dok.sebutanPihak.pertama) || "");
  const sebutan = /pemohon/i.test(sebutanPertama)
    ? { k1: "pemohon", k2: "termohon" }
    : { k1: "penggugat", k2: "tergugat" };
  if (golongan === "ikrar-talak") return { jenis: "relaas", kunci: ["panggilan-ikrar"] };
  if (golongan === "sidang-pertama") return { jenis: "relaas", kunci: ["panggilan-sidang-pertama"] };
  if (golongan === "pemberitahuan-putusan") {
    return { jenis: "pbt", kunci: jurusitaKunciPihak("pbt", Number(dok.pihakKe) === 2 ? 2 : 1, sebutan) };
  }
  const sisi = String(dok.pihakDipanggil || "") === "kedua" ? 2 : 1;
  return { jenis: "relaas", kunci: jurusitaKunciPihak("panggilan", sisi, sebutan) };
}

/**
 * Dokumen massal yang ikut "cetak sekaligus": dapat dicetak, tidak menahan
 * "Pilih semua", belum tercatat di SIPP, dan (bila disaring) milik juru sita
 * yang masuk. Blangko dari server/simpanan pemetaan MENGGANTI blangko rute;
 * bawaan tertanam tidak - rute sudah memakai pohon-blangko.ts.
 */
function jurusitaPilahMassal(dokumen, opsi) {
  const siap = [];
  const perluDilihat = [];
  const namaSaya = opsi && opsi.hanyaSaya ? String(opsi.nama || "") : "";
  for (const dok of Array.isArray(dokumen) ? dokumen : []) {
    if (!dok || typeof dok !== "object") continue;
    const namaJs = String((dok.jurusita && dok.jurusita.nama) || "");
    if (namaSaya && !jurusitaNamaCocok(namaSaya, namaJs)) continue;
    const blangkoRute = dok.blangko && dok.blangko.berkas ? String(dok.blangko.berkas) : "";
    if (dok.bisaDicetak !== true || !blangkoRute) {
      perluDilihat.push({ dok, sebab: String(dok.sebabTidakBisa || "belum dapat dicetak") });
      continue;
    }
    if (dok.ikutPilihSemua === false) {
      const p = Array.isArray(dok.peringatan) && dok.peringatan[0] ? String(dok.peringatan[0].teks || "") : "";
      perluDilihat.push({ dok, sebab: p || "perlu dilihat dulu" });
      continue;
    }
    if (dok.sudahAdaRelaas === true) {
      perluDilihat.push({ dok, sebab: "sudah tercatat di SIPP" });
      continue;
    }
    const k = jurusitaKunciMassal(dok);
    const dariPeta = jurusitaPilihBlangko(opsi && opsi.peta, k.jenis, k.kunci);
    const pakaiPeta = dariPeta && dariPeta.sumber !== "bawaan";
    const golongan = String(dok.golongan || "");
    const d = golongan === "pemberitahuan-putusan" ? 0 : Number(dok.d);
    const bagian =
      golongan === "pemberitahuan-putusan"
        ? "pemberitahuan putusan"
        : golongan === "ikrar-talak"
          ? `panggilan ikrar talak sidang ke-${d}`
          : `panggilan sidang ke-${d}`;
    siap.push({
      kunci: String(dok.kunci || "").slice(0, 160),
      perkaraId: String(dok.perkaraId || ""),
      nomorPerkara: String(dok.nomorPerkara || ""),
      golongan,
      label: `${bagian} - ${pakaiPeta ? dariPeta.berkas : String((dok.blangko && dok.blangko.label) || blangkoRute)}`.slice(0, 200),
      d,
      berkas: pakaiPeta ? dariPeta.berkas : blangkoRute,
      nama: `${jurusitaNomorAman(dok.nomorPerkara, dok.perkaraId)} - ${bagian}${dok.pihakKe ? ` pihak ${dok.pihakKe}` : ""}`.slice(
        0,
        JURUSITA_NAMA_MAKS
      ),
      jurusita: (namaJs || "tidak tercatat").slice(0, 120),
      sumberBlangko: pakaiPeta ? dariPeta.sumber : "rute",
    });
  }
  return { siap, perluDilihat };
}

/**
 * GET relaas-massal/cetak?tanggal= -> { data, sebab }. Satu tempat untuk
 * bagian massal lama (per perkara) dan panel massal daftar/beranda.
 */
async function jurusitaAmbilDaftarRelaas(tanggal) {
  try {
    const r = await alatAmbil(
      `${JURUSITA_API_CETAK}?tanggal=${encodeURIComponent(tanggal || "")}`,
      { credentials: "include", cache: "no-store" },
      "Membaca daftar relaas"
    );
    const luar = await r.json().catch(() => null);
    if (!r.ok || !luar || luar.ok === false) {
      return {
        data: null,
        sebab: String(
          (luar && (luar.alasan || (luar.error && luar.error.message))) || jurusitaPesanStatus(r.status, "Membaca daftar relaas")
        ),
      };
    }
    return { data: luar.data ? luar.data : luar, sebab: "" };
  } catch (e) {
    return { data: null, sebab: String((e && e.message) || e) };
  }
}

/**
 * Kelompok "dari hari kerja sebelumnya" jawaban rute cetak - panggilan dari
 * sidang tundaan kemarin yang jadwalnya dicatat sesudah daftar kemarin
 * dibaca. Kunci yang sama dengan dokumen hari ini dibuang (seperti dialog
 * portal): satu kunci satu butir.
 */
function jurusitaDokumenKemarin(data) {
  const kemarin = data && data.hariKerjaSebelumnya;
  if (!kemarin || !Array.isArray(kemarin.dokumen)) return [];
  const hariIni = new Set((Array.isArray(data.dokumen) ? data.dokumen : []).map((d) => String((d && d.kunci) || "")));
  return kemarin.dokumen.filter((d) => d && typeof d === "object" && !hariIni.has(String(d.kunci || "")));
}

/* ─── 5. Pekerja latar (latar.js - mesin relaas yang sudah ada) ───────────── */

/** Satu pesan ke latar.js; SELALU pulang objek, tidak pernah melempar, tidak menunggu selamanya. */
function jurusitaKirim(jenis, tambahan, batasMs) {
  return new Promise((selesai) => {
    let sudah = false;
    const pulang = (x) => {
      if (sudah) return;
      sudah = true;
      clearTimeout(jam);
      selesai(x && typeof x === "object" ? x : { ok: false, sebab: "Pekerja latar ekstensi tidak memulangkan jawaban." });
    };
    const jam = setTimeout(
      () => pulang({ ok: false, batasWaktu: true, sebab: "Ekstensi belum menjawab - kemungkinan masih membaca blangko dari ABT." }),
      Number(batasMs) > 0 ? Number(batasMs) : JURUSITA_BATAS_PESAN_MS
    );
    const asal = location.origin;
    const pesan = { sumber: "aleta-panel", jenis, asal, asalAbt: `${asal}/aps_badilag`, ...(tambahan || {}) };
    try {
      chrome.runtime.sendMessage(pesan, (jawab) => {
        let salah = null;
        try {
          salah = chrome.runtime.lastError || null;
        } catch (e) {
          salah = e;
        }
        if (salah) pulang({ ok: false, sebab: `Pekerja latar ekstensi tidak menjawab: ${String(salah.message || salah)}` });
        else pulang(jawab);
      });
    } catch (e) {
      pulang({
        ok: false,
        sebab: `Ekstensi ALETA baru dimuat ulang - muat ulang halaman ini (${String((e && e.message) || e)}).`,
      });
    }
  });
}

/** Mengirim dokumen ke putaran relaas. Mode kering: tidak dikirim. */
async function jurusitaMulaiCetak(dokumen, tanggal) {
  const bersih = dokumen.map((d) => ({
    kunci: d.kunci,
    perkaraId: d.perkaraId,
    nomorPerkara: d.nomorPerkara,
    golongan: d.golongan,
    label: d.label,
    d: d.d,
    berkas: d.berkas,
    nama: d.nama,
    jurusita: d.jurusita,
  }));
  let kering = false;
  try {
    kering = typeof alatKeringNyala === "function" && alatKeringNyala();
  } catch {
    kering = false;
  }
  if (kering) return { ok: false, kering: true, sebab: `Mode kering: ${bersih.length} dokumen TIDAK dicetak - hanya ditampilkan.` };
  const asal = location.origin;
  return jurusitaKirim(
    "relaas-mulai",
    { pekerjaan: { tanggal: tanggal || jurusitaTanggalIso(), dokumen: bersih, dilewati: [], asal, asalAbt: `${asal}/aps_badilag` } },
    JURUSITA_BATAS_MULAI_MS
  );
}

/* ─── 6. Tampilan ─────────────────────────────────────────────────────────── */

function jurusitaEl(tag, kelas, teks) {
  if (typeof alatEl === "function") return alatEl(tag, kelas, teks);
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined && teks !== null) e.textContent = String(teks);
  return e;
}

function jurusitaTombol(teks, kelas, judul) {
  const b = jurusitaEl("button", `aleta-jurusita-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

/**
 * Judul bagian + ⓘ yang membuka uraian panjang (butir 6: penjelasan panjang dilipat).
 *
 * K5: ⓘ dan uraiannya bertanda aleta-teknis - seluruhnya menerangkan cara
 * kerja (ABT, PDF, pemetaan, folder unduhan), bukan pesan yang meminta
 * tindakan. Saklar "Sembunyikan penjelasan teknis" melipatnya berdua.
 */
function jurusitaJudul(teks, uraian) {
  const baris = jurusitaEl("div", "aleta-jurusita-judul");
  baris.appendChild(jurusitaEl("span", "aleta-jurusita-judul-teks", teks));
  if (!uraian) return { baris, uraian: null };
  const info = jurusitaTombol("ⓘ", "aleta-jurusita-info aleta-teknis", "Penjelasan");
  info.setAttribute("aria-expanded", "false");
  const isi = jurusitaEl("div", "aleta-jurusita-uraian aleta-teknis", uraian);
  isi.hidden = true;
  info.addEventListener("click", () => {
    isi.hidden = !isi.hidden;
    info.setAttribute("aria-expanded", isi.hidden ? "false" : "true");
  });
  baris.appendChild(info);
  // Uraiannya dulu tidak pernah dipasang ke halaman - ⓘ tidak membuka apa pun.
  // Kini ikut di baris judul (panel.css blok J: melebar satu baris penuh).
  baris.appendChild(isi);
  return { baris, uraian: isi };
}

function jurusitaCentang(label, nilai, mati, judul) {
  const l = jurusitaEl("label", "aleta-jurusita-centang");
  const c = document.createElement("input");
  c.type = "checkbox";
  c.value = nilai;
  c.disabled = Boolean(mati);
  if (judul) l.title = judul;
  l.appendChild(c);
  l.appendChild(document.createTextNode(` ${label}`));
  return { l, c };
}

function jurusitaTanggalPendek(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${bulan[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function jurusitaTautanPengaturan() {
  const a = jurusitaEl("a", "aleta-jurusita-tautan", "Atur pemetaan blangko");
  a.href = `${location.origin}/aleta/admin/aleta-ecourt#pemetaan-blangko`;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = "Integrasi e-Court - Pemetaan blangko (Super Admin & Admin)";
  return a;
}

/** Jawaban non-2xx sebagai kalimat - kalimat yang sama dengan panel lain (alatPesanGagal). */
function jurusitaPesanStatus(status, yangDiminta) {
  if (typeof alatPesanGagal === "function") return alatPesanGagal(null, status, yangDiminta);
  return `${yangDiminta} gagal (${status}).`;
}

/** Keterangan hasil satu tindakan - dipakai bagian per perkara dan massal. */
function jurusitaKabar(wadah, teks, jenis) {
  wadah.textContent = teks || "";
  wadah.className = `aleta-jurusita-kabar${jenis ? ` aleta-jurusita-kabar-${jenis}` : ""}`;
  wadah.hidden = !teks;
}

function jurusitaKalimatJawaban(jawab, jumlah) {
  if (jawab && jawab.ok) {
    const p = jawab.perkiraan && Number(jawab.perkiraan.rata) > 0 ? Math.max(1, Math.round(jawab.perkiraan.rata / 60000)) : 0;
    return {
      teks: `${jumlah} dokumen masuk putaran cetak${p ? ` (perkiraan ±${p} menit)` : ""}. RTF + PDF turun ke folder unduhan "ALETA relaas".`,
      jenis: "baik",
    };
  }
  if (jawab && jawab.kering) return { teks: jawab.sebab, jenis: "peringatan" };
  if (jawab && jawab.perluMasuk) {
    return { teks: `Masuk ke ABT dulu di peramban ini, lalu tekan Cetak lagi. ${String(jawab.sebab || "")}`.trim(), jenis: "salah" };
  }
  if (jawab && (jawab.batasWaktu || jawab.menyiapkan)) {
    return { teks: `${String(jawab.sebab || "Ekstensi sedang menyiapkan putaran.")} Jangan tekan Cetak lagi - keadaannya dipantau.`, jenis: "peringatan" };
  }
  return { teks: `Tidak dicetak: ${String((jawab && jawab.sebab) || "ekstensi menolak tanpa sebab")}`, jenis: "salah" };
}

/* ─── 6a. Putaran (keadaan cetak) ─────────────────────────────────────────── */

function jurusitaGambarPutaran(kotak, jawab, pantau) {
  kotak.textContent = "";
  const p = jawab && jawab.pekerjaan;
  if (!p) {
    kotak.hidden = true;
    return false;
  }
  kotak.hidden = false;
  const r = jawab.ringkas || {};
  const jumlah = (p.butir || []).length;
  const kepala = jurusitaEl("div", "aleta-jurusita-putaran-kepala");
  const status = p.selesai
    ? p.dihentikan
      ? "Putaran dihentikan"
      : "Putaran selesai"
    : p.tertahan
      ? "Putaran tertahan"
      : jawab.menyiapkan
        ? "Menyiapkan putaran"
        : "Mencetak";
  kepala.appendChild(
    jurusitaEl(
      "span",
      "aleta-jurusita-putaran-teks",
      `${status}: ${Number(r.selesai || 0)}/${jumlah} selesai` +
        (Number(r.gagal) ? ` · ${r.gagal} gagal` : "") +
        (Number(r.dilewati) ? ` · ${r.dilewati} dilewati` : "") +
        (Number(r.tanpaPdf) ? ` · ${r.tanpaPdf} tanpa PDF` : "")
    )
  );
  const tindak = (jenis, teks) => {
    const b = jurusitaTombol(teks, "aleta-jurusita-tombol-kecil");
    b.addEventListener("click", async () => {
      b.disabled = true;
      const j = await jurusitaKirim(jenis, {}, JURUSITA_BATAS_PESAN_MS);
      if (jenis === "relaas-bersihkan" && j && j.ok) {
        kotak.hidden = true;
        kotak.textContent = "";
        return;
      }
      if (j && j.pekerjaan !== undefined) jurusitaGambarPutaran(kotak, { ...j, ringkas: j.ringkas || jawab.ringkas }, pantau);
      pantau();
    });
    kepala.appendChild(b);
  };
  if (!p.selesai) tindak("relaas-henti", "Hentikan");
  if (!p.selesai && p.tertahan) tindak("relaas-lanjut", "Lanjutkan");
  if (p.selesai) tindak("relaas-bersihkan", "Bersihkan");
  kotak.appendChild(kepala);
  if (p.tertahan && p.tertahan.sebab) kotak.appendChild(jurusitaEl("div", "aleta-jurusita-kabar aleta-jurusita-kabar-salah", p.tertahan.sebab));
  if (p.tertahan && p.tertahan.perluMasuk === "aleta") {
    // Pekerja latar ditolak ALETA (401). Halaman ini bertanya sendiri, dengan
    // sesinya sendiri, supaya kalimatnya tidak menyuruh masuk orang yang
    // sebenarnya masih masuk (tangkapan 118-119).
    const cek = jurusitaEl("div", "aleta-jurusita-lembut aleta-jurusita-cek-sesi");
    cek.hidden = true;
    kotak.appendChild(cek);
    void jurusitaCekSesiHalaman(p.tertahan.pada).then((t) => {
      cek.textContent = t;
      cek.hidden = !t;
    });
  }
  const gagal = (p.butir || []).filter((b) => b.keadaan === "gagal" || (b.keadaan === "selesai" && b.tanpaPdf));
  const lewat = Array.isArray(p.dilewati) ? p.dilewati : [];
  if (gagal.length + lewat.length > 0) {
    const rinci = jurusitaEl("details", "aleta-jurusita-rinci");
    rinci.appendChild(jurusitaEl("summary", "", `Rincian (${gagal.length + lewat.length})`));
    const ul = jurusitaEl("ul", "aleta-jurusita-daftar");
    for (const b of [...gagal, ...lewat].slice(0, 30)) {
      ul.appendChild(jurusitaEl("li", "", `${b.nomorPerkara || ""} ${b.label || ""}: ${b.sebab || b.keadaan || ""}`.trim()));
    }
    rinci.appendChild(ul);
    kotak.appendChild(rinci);
  }
  return !p.selesai;
}

/** Satu pemeriksaan per penahanan (tertahan.pada) - pemantau menggambar ulang tiap 2,5 detik. */
let jurusitaCekSesi = { pada: null, janji: null };

/**
 * Apakah HALAMAN INI masih masuk ALETA? GET "siapa" dengan sesi halaman (bukan
 * simpanan jurusitaSiapa). Pulang kalimat untuk petugas, "" bila tak dapat
 * dikatakan apa pun yang pasti.
 */
function jurusitaCekSesiHalaman(pada) {
  if (jurusitaCekSesi.janji && jurusitaCekSesi.pada === pada) return jurusitaCekSesi.janji;
  const janji = (async () => {
    try {
      const r = await alatAmbil(JURUSITA_API_SIAPA, { credentials: "include", cache: "no-store" }, "Memeriksa sesi ALETA");
      if (r.status === 401) return "Halaman ini juga tidak lagi masuk ALETA - buka portal ALETA, masuk, lalu tekan Lanjutkan.";
      if (!r.ok) return "";
      const luar = await r.json().catch(() => null);
      const isi = luar && luar.data ? luar.data : luar;
      const nama = isi && isi.nama ? String(isi.nama) : "";
      if (!nama) return "";
      return (
        `Halaman ini masih masuk ALETA sebagai ${nama}, jadi sesi portal belum habis - yang ditolak permintaan PDF ` +
        "dari ekstensi. Tekan Lanjutkan; bila tertahan lagi, muat ulang halaman ini lalu Lanjutkan."
      );
    } catch {
      return "";
    }
  })();
  jurusitaCekSesi = { pada, janji };
  return janji;
}

/** Memantau putaran selama bagiannya masih ada di halaman. */
function jurusitaPasangPantau(akar, kotak) {
  let jam = 0;
  const tanya = async () => {
    clearTimeout(jam);
    if (!akar.isConnected) return;
    const j = await jurusitaKirim("relaas-keadaan", {}, JURUSITA_BATAS_PESAN_MS);
    if (!akar.isConnected) return;
    const berjalan = j && j.ok ? jurusitaGambarPutaran(kotak, j, tanya) : false;
    if (berjalan) jam = setTimeout(tanya, JURUSITA_JEDA_PANTAU_MS);
  };
  return tanya;
}

/* ─── 6b. Per perkara ─────────────────────────────────────────────────────── */

async function jurusitaMuatRincian(nomor) {
  const r = await alatAmbil(
    `${JURUSITA_API_SIDANG}?nomor=${encodeURIComponent(nomor)}`,
    { credentials: "include", cache: "no-store" },
    "Membaca jadwal sidang perkara"
  );
  if (!r.ok) return { sebab: jurusitaPesanStatus(r.status, "Membaca jadwal sidang perkara") };
  const luar = await r.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || !isi.sipp) return { sebab: String((isi && (isi.pesanSipp || isi.message)) || "Keterangan SIPP perkara ini belum dapat dibaca.") };
  return { rincian: isi.sipp };
}

/** Sidang bawaan: sidang terdekat yang belum lewat; tanpa itu sidang terakhir. */
function jurusitaSidangBawaan(jadwal) {
  const hariIni = jurusitaTanggalIso();
  const akan = jadwal.find((s) => String(s.tanggalSidang || "") >= hariIni);
  return akan || jadwal[jadwal.length - 1] || null;
}

function jurusitaGambarPerkara(bagian, konteksAwal, kotakPutaran, pantau) {
  const { baris: judul } = jurusitaJudul(
    `Perkara ${konteksAwal.nomorPerkara}`,
    "Pilih sidang yang dipanggil dan pihaknya, lalu Cetak. Relaas diambil dari ABT dengan akun ABT Anda sendiri " +
      "(hak akses ABT tetap berlaku), diubah menjadi PDF oleh ALETA, lalu RTF dan PDF-nya disimpan di folder unduhan " +
      '"ALETA relaas/<tanggal>/<juru sita>". Tidak ada yang ditulis ke SIPP. Penggugat dan Tergugat yang memakai ' +
      "blangko dan sidang yang sama dicetak SATU dokumen (blangko P dan T memuat keduanya). PBT hanya untuk perkara " +
      "yang sudah diputus. Sidang pertama selalu memakai blangko sidang pertama (P dan T)."
  );
  bagian.appendChild(judul);
  const isi = jurusitaEl("div", "aleta-jurusita-isi");
  isi.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", "Membaca jadwal sidang..."));
  bagian.appendChild(isi);

  void (async () => {
    let hasil;
    try {
      hasil = await jurusitaMuatRincian(konteksAwal.nomorPerkara);
    } catch (e) {
      hasil = { sebab: String((e && e.message) || e) };
    }
    const peta = await jurusitaMuatPeta();
    isi.textContent = "";
    if (!hasil.rincian) {
      isi.appendChild(jurusitaEl("div", "aleta-jurusita-kabar aleta-jurusita-kabar-salah", hasil.sebab));
      return;
    }
    const rincian = hasil.rincian;
    const perkaraId = /^\d+$/.test(String(konteksAwal.perkaraId || "")) && !/^0+$/.test(String(konteksAwal.perkaraId))
      ? String(konteksAwal.perkaraId)
      : String(rincian.perkaraId || "");
    const sebutan = jurusitaSebutan(konteksAwal.nomorPerkara, rincian.jenisPerkara);
    const jadwal = (Array.isArray(rincian.jadwalPerkara) ? rincian.jadwalPerkara : [])
      .filter((s) => Number(s.urutanSidang) > 0)
      .sort((a, b) => Number(a.urutanSidang) - Number(b.urutanSidang));
    const sudahPutus = Boolean(rincian.putusan && rincian.putusan.sudahPutus);
    const namaJs =
      (Array.isArray(rincian.jurusita) && rincian.jurusita[0] && rincian.jurusita[0].nama) ||
      (jurusitaSiapa && jurusitaSiapa.nama) ||
      "";

    // Pilih sidang
    const barisSidang = jurusitaEl("label", "aleta-jurusita-baris");
    barisSidang.appendChild(jurusitaEl("span", "aleta-jurusita-lembut", "Sidang"));
    const pilihSidang = document.createElement("select");
    pilihSidang.className = "aleta-jurusita-pilih aleta-jurusita-sidang";
    const bawaan = jurusitaSidangBawaan(jadwal);
    for (const s of jadwal) {
      const o = document.createElement("option");
      o.value = String(s.urutanSidang);
      // U3: sidang pertama dan TUNDAAN sama-sama dapat dipilih - jenisnya disebut.
      const jenis = JURUSITA_SEBUTAN_JENIS_SIDANG[jurusitaGolonganSidang(s, rincian)] || "";
      o.textContent =
        `ke-${s.urutanSidang} · ${jurusitaTanggalPendek(s.tanggalSidang)}${jenis ? ` · ${jenis}` : ""}` +
        `${s.agenda ? ` · ${String(s.agenda).slice(0, 40)}` : ""}`;
      if (bawaan && s === bawaan) o.selected = true;
      pilihSidang.appendChild(o);
    }
    if (jadwal.length === 0) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "belum ada jadwal sidang";
      pilihSidang.appendChild(o);
      pilihSidang.disabled = true;
    }
    barisSidang.appendChild(pilihSidang);
    isi.appendChild(barisSidang);
    // Siapa yang dipanggil ke sidang tundaan: dari kehadiran sidang sebelumnya.
    const petunjuk = jurusitaEl("div", "aleta-jurusita-petunjuk");
    petunjuk.hidden = true;
    isi.appendChild(petunjuk);

    // Centang
    const tanpaSidang = jadwal.length === 0 ? "Belum ada jadwal sidang - panggilan menuntut nomor sidang." : "";
    const belumPutus = sudahPutus ? "" : "Perkara belum diputus.";
    const kotakCentang = jurusitaEl("div", "aleta-jurusita-centang-kotak");
    const pP1 = jurusitaCentang(`Panggilan ${sebutan.pertama}`, "p1", Boolean(tanpaSidang), tanpaSidang);
    const pP2 = jurusitaCentang(`Panggilan ${sebutan.kedua}`, "p2", Boolean(tanpaSidang), tanpaSidang);
    const pB1 = jurusitaCentang(`PBT ${sebutan.pertama}`, "b1", !sudahPutus, belumPutus);
    const pB2 = jurusitaCentang(`PBT ${sebutan.kedua}`, "b2", !sudahPutus, belumPutus);
    for (const x of [pP1, pP2, pB1, pB2]) kotakCentang.appendChild(x.l);
    isi.appendChild(kotakCentang);

    // Blangko yang dipakai
    const rinciBlangko = jurusitaEl("details", "aleta-jurusita-rinci");
    const ringkasBlangko = jurusitaEl("summary", "", "Blangko yang dipakai");
    rinciBlangko.appendChild(ringkasBlangko);
    const daftarBlangko = jurusitaEl("ul", "aleta-jurusita-daftar");
    rinciBlangko.appendChild(daftarBlangko);
    if (jurusitaAdmin(jurusitaSiapa)) rinciBlangko.appendChild(jurusitaTautanPengaturan());
    isi.appendChild(rinciBlangko);

    const aksi = jurusitaEl("div", "aleta-jurusita-aksi");
    const cetak = jurusitaTombol("Cetak", "aleta-jurusita-tombol-utama", "Cetak relaas/PBT yang dicentang");
    cetak.disabled = true;
    aksi.appendChild(cetak);
    isi.appendChild(aksi);
    const kabar = jurusitaEl("div", "aleta-jurusita-kabar");
    kabar.hidden = true;
    isi.appendChild(kabar);

    const susun = () => {
      const urutan = Number(pilihSidang.value);
      const sidang = jadwal.find((s) => Number(s.urutanSidang) === urutan) || null;
      const pilihan = {
        panggilan: [pP1.c.checked ? 1 : 0, pP2.c.checked ? 2 : 0].filter(Boolean),
        pbt: [pB1.c.checked ? 1 : 0, pB2.c.checked ? 2 : 0].filter(Boolean),
      };
      return jurusitaSusunDokumen(
        { perkaraId, nomorPerkara: konteksAwal.nomorPerkara, rincian, sidang, jurusita: namaJs },
        pilihan,
        peta
      );
    };
    const segarkan = () => {
      const { dokumen, tanpaBlangko } = susun();
      const t = jurusitaPetunjukTundaan(jadwal, Number(pilihSidang.value), sebutan, rincian);
      petunjuk.textContent = t;
      petunjuk.hidden = !t;
      // K5: daftar blangko + sumber pemetaan = penjelasan teknis, KECUALI bila
      // ada yang belum dipetakan (itu meminta tindakan dan tidak disembunyikan).
      rinciBlangko.classList.toggle("aleta-teknis", tanpaBlangko.length === 0);
      daftarBlangko.textContent = "";
      for (const d of dokumen) {
        daftarBlangko.appendChild(
          jurusitaEl("li", "", `${d.label}: ${d.berkas} (${JURUSITA_SEBUTAN_SUMBER[d.sumberBlangko] || d.sumberBlangko})`)
        );
      }
      for (const t of tanpaBlangko) daftarBlangko.appendChild(jurusitaEl("li", "aleta-jurusita-salah", `${t}: blangko belum dipetakan`));
      if (dokumen.length + tanpaBlangko.length === 0) {
        const sumber = [...new Set([peta.relaas.sumber, peta.pbt.sumber])].map((s) => JURUSITA_SEBUTAN_SUMBER[s] || s).join(", ");
        daftarBlangko.appendChild(jurusitaEl("li", "aleta-jurusita-lembut", `Centang dokumen dulu. Pemetaan: ${sumber}.`));
      }
      cetak.disabled = dokumen.length === 0 || !/^\d+$/.test(perkaraId);
      cetak.textContent = dokumen.length > 1 ? `Cetak ${dokumen.length} dokumen` : "Cetak";
    };
    for (const x of [pP1, pP2, pB1, pB2]) x.c.addEventListener("change", segarkan);
    pilihSidang.addEventListener("change", segarkan);
    segarkan();

    cetak.addEventListener("click", async () => {
      const { dokumen } = susun();
      if (dokumen.length === 0) return;
      cetak.disabled = true;
      jurusitaKabar(kabar, "Mengirim ke ekstensi...", "");
      const jawab = await jurusitaMulaiCetak(dokumen);
      const k = jurusitaKalimatJawaban(jawab, dokumen.length);
      jurusitaKabar(kabar, k.teks, k.jenis);
      if (jawab && jawab.kering) {
        for (const d of dokumen) kabar.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", `${d.nama} - ${d.berkas}`));
      }
      segarkan();
      pantau();
    });
  })();
}

/* ─── 6c. Massal ──────────────────────────────────────────────────────────── */

function jurusitaGambarMassal(bagian, kotakPutaran, pantau) {
  const rinci = jurusitaEl("details", "aleta-jurusita-massal");
  const ringkas = jurusitaEl("summary", "aleta-jurusita-judul-teks", "Cetak massal");
  rinci.appendChild(ringkas);
  const { baris: judul } = jurusitaJudul(
    "",
    "Relaas panggilan sidang dan PBT yang lahir pada tanggal yang dipilih (perkara baru daftar, sidang ditunda, " +
      "putusan) - bahan yang sama dengan tombol Cetak relaas di Antrian Sidang portal. Yang dicetak sekaligus hanya " +
      "dokumen yang siap: blangko dan pihaknya pasti, tidak perlu konfirmasi, dan belum tercatat di SIPP. Sisanya " +
      "disebut sebagai \"perlu dilihat\" dan dikerjakan dari portal (Antrian Sidang - Cetak relaas), tempat pihaknya " +
      "dapat dipilih. \"Milik saya\" menyaring menurut juru sita yang ditunjuk pada perkaranya."
  );
  rinci.appendChild(judul);
  const isi = jurusitaEl("div", "aleta-jurusita-isi");
  rinci.appendChild(isi);
  bagian.appendChild(rinci);

  const barisAtas = jurusitaEl("div", "aleta-jurusita-baris");
  const tanggal = document.createElement("input");
  tanggal.type = "date";
  tanggal.className = "aleta-jurusita-pilih";
  tanggal.value = jurusitaTanggalIso();
  barisAtas.appendChild(tanggal);
  const saring = document.createElement("select");
  saring.className = "aleta-jurusita-pilih";
  for (const [nilai, teks] of [
    ["saya", "Milik saya"],
    ["semua", "Semua juru sita"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  saring.value = jurusitaJurusitaSendiri(jurusitaSiapa) ? "saya" : "semua";
  barisAtas.appendChild(saring);
  const muat = jurusitaTombol("Tampilkan", "aleta-jurusita-tombol-kecil");
  barisAtas.appendChild(muat);
  isi.appendChild(barisAtas);

  const hasilKotak = jurusitaEl("div", "aleta-jurusita-hasil");
  isi.appendChild(hasilKotak);

  let terakhir = null;
  const muatDaftar = async () => {
    muat.disabled = true;
    hasilKotak.textContent = "";
    hasilKotak.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", "Membaca daftar..."));
    const { data, sebab } = await jurusitaAmbilDaftarRelaas(tanggal.value);
    const peta = await jurusitaMuatPeta();
    muat.disabled = false;
    hasilKotak.textContent = "";
    if (!data || !Array.isArray(data.dokumen)) {
      hasilKotak.appendChild(jurusitaEl("div", "aleta-jurusita-kabar aleta-jurusita-kabar-salah", sebab || "Daftar relaas tidak terbaca."));
      return;
    }
    const hanyaSaya = saring.value === "saya";
    const pilah = jurusitaPilahMassal(data.dokumen, { hanyaSaya, nama: jurusitaSiapa && jurusitaSiapa.nama, peta });
    terakhir = { pilah, tanggal: tanggal.value };
    const perGolongan = {};
    for (const d of pilah.siap) perGolongan[d.golongan] = (perGolongan[d.golongan] || 0) + 1;
    const sebutanGolongan = {
      "sidang-pertama": "sidang pertama",
      "sidang-ditunda": "sidang lanjutan",
      "sidang-lanjutan": "sidang lanjutan",
      "ikrar-talak": "ikrar",
      "pemberitahuan-putusan": "PBT",
    };
    const bagianRingkas = Object.entries(perGolongan).map(([g, n]) => `${n} ${sebutanGolongan[g] || g}`);
    hasilKotak.appendChild(
      jurusitaEl(
        "div",
        "aleta-jurusita-ringkas",
        pilah.siap.length === 0 && pilah.perluDilihat.length === 0
          ? `Tidak ada relaas ${hanyaSaya ? "milik Anda " : ""}pada tanggal ini.`
          : `${pilah.siap.length} siap dicetak${bagianRingkas.length ? ` (${bagianRingkas.join(", ")})` : ""}` +
              (pilah.perluDilihat.length ? ` · ${pilah.perluDilihat.length} perlu dilihat` : "")
      )
    );
    // Panggilan tundaan dari hari kerja sebelumnya (kelompok tersendiri rute
    // cetak) tidak dicetak dari sini - disebut, supaya tidak hilang tanpa suara.
    const kemarin = jurusitaDokumenKemarin(data).filter(
      (d) => !hanyaSaya || jurusitaNamaCocok(String((jurusitaSiapa && jurusitaSiapa.nama) || ""), String((d.jurusita && d.jurusita.nama) || ""))
    );
    if (kemarin.length > 0) {
      hasilKotak.appendChild(
        jurusitaEl(
          "div",
          "aleta-jurusita-lembut",
          `${kemarin.length} panggilan dari hari kerja sebelumnya (${jurusitaTanggalPendek(data.hariKerjaSebelumnya.tanggal)}) ` +
            "dipilih di panel Relaas & PBT massal (daftar perkara SIPP / beranda ABT)."
        )
      );
    }
    if (pilah.siap.length + pilah.perluDilihat.length > 0) {
      const rinciDaftar = jurusitaEl("details", "aleta-jurusita-rinci");
      rinciDaftar.appendChild(jurusitaEl("summary", "", "Daftar"));
      const ul = jurusitaEl("ul", "aleta-jurusita-daftar");
      for (const d of pilah.siap) ul.appendChild(jurusitaEl("li", "", `${d.nomorPerkara} - ${d.label}`));
      for (const x of pilah.perluDilihat) {
        ul.appendChild(jurusitaEl("li", "aleta-jurusita-lembut", `${x.dok.nomorPerkara || ""} - perlu dilihat: ${x.sebab}`));
      }
      rinciDaftar.appendChild(ul);
      if (pilah.perluDilihat.length > 0) {
        const a = jurusitaEl("a", "aleta-jurusita-tautan", "Buka Antrian Sidang di portal");
        a.href = `${location.origin}/aleta/aleta-ecourt`;
        a.target = "_blank";
        a.rel = "noopener";
        rinciDaftar.appendChild(a);
      }
      hasilKotak.appendChild(rinciDaftar);
    }
    if (pilah.siap.length > 0) {
      const cetak = jurusitaTombol(`Cetak ${pilah.siap.length} dokumen`, "aleta-jurusita-tombol-utama");
      const kabar = jurusitaEl("div", "aleta-jurusita-kabar");
      kabar.hidden = true;
      cetak.addEventListener("click", async () => {
        if (!terakhir) return;
        const n = terakhir.pilah.siap.length;
        if (!window.confirm(`Cetak ${n} dokumen relaas/PBT sekaligus? Berkasnya turun ke folder unduhan "ALETA relaas".`)) return;
        cetak.disabled = true;
        jurusitaKabar(kabar, "Mengirim ke ekstensi...", "");
        const jawab = await jurusitaMulaiCetak(terakhir.pilah.siap, terakhir.tanggal);
        const k = jurusitaKalimatJawaban(jawab, n);
        jurusitaKabar(kabar, k.teks, k.jenis);
        cetak.disabled = Boolean(jawab && jawab.ok);
        pantau();
      });
      hasilKotak.appendChild(cetak);
      hasilKotak.appendChild(kabar);
    }
  };
  muat.addEventListener("click", () => void muatDaftar());
  // Daftar massal dibaca hanya saat bagiannya dibuka - panel tidak menembak
  // penilaian satu hari penuh untuk tiap halaman perkara yang dibuka.
  let sudahDibuka = false;
  rinci.addEventListener("toggle", () => {
    if (rinci.open && !sudahDibuka) {
      sudahDibuka = true;
      void muatDaftar();
    }
  });
}

/* ─── 6d. Panel massal - daftar perkara SIPP & beranda ABT (K3) ───────────── */

/**
 * ============================================================================
 * RELAAS & PBT MASSAL YANG BERDIRI SENDIRI (perbaikan 30 Sep sore, U2/U3)
 * ============================================================================
 *
 * Bahan: rute cetak yang SAMA dengan bagian massal lama dan dialog portal -
 * dokumen yang LAHIR pada tanggal itu: perkara baru daftar (panggilan sidang
 * pertama), sidang yang DITUNDA hari itu (panggilan ke sidang TUNDAAN
 * berikutnya, d = urutan sidang tujuan), jadwal baru, dan putusan (PBT).
 * Kelompok "dari hari kerja sebelumnya" (tundaan kemarin yang jadwalnya
 * dicatat sesudah daftar kemarin dibaca) ikut ditampilkan terpisah dan tidak
 * ikut "Pilih semua" - sama dengan dialog Cetak relaas portal.
 *
 * Per perkara ada centang Panggilan P/T dan PBT P/T. Centang PBT hanya muncul
 * untuk pihak yang memang ada dokumennya. "Pilih semua" mencentang pihak yang
 * menurut SIPP perlu dipanggil/diberi tahu - bukan yang sudah tercatat di
 * SIPP, yang perlu konfirmasi, atau yang pihaknya belum diketahui (centang
 * sendiri). Blangkonya: pemetaan server -> blangko rute (pohon-blangko.ts)
 * -> bawaan tertanam, dengan aturan P dan T yang sama dengan per perkara.
 *
 * Cetaknya lewat mesin relaas latar.js yang sudah ada (relaas-mulai), dengan
 * putaran yang dapat dihentikan dan dilanjutkan - tidak ada jalur tulis baru.
 */
const JURUSITA_MASSAL_PENANDA = "aleta-jurusita-massal-panel";

/** Sisi (1 pertama, 2 kedua) yang dicakup nilai pihakDipanggil. */
function jurusitaSisiPihak(pihak) {
  const p = String(pihak || "");
  if (p === "keduanya") return [1, 2];
  if (p === "pertama") return [1];
  if (p === "kedua") return [2];
  return [];
}

function jurusitaSamaSisi(a, b) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Sebutan pihak satu dokumen rute: sebutanPihak bot, cadangannya nomor & jenis perkara. */
function jurusitaSebutanDok(dok) {
  const s = dok && dok.sebutanPihak;
  if (s && String(s.pertama || "").trim() && String(s.kedua || "").trim()) {
    const mohon = /pemohon/i.test(String(s.pertama));
    return {
      pertama: String(s.pertama).trim(),
      kedua: String(s.kedua).trim(),
      k1: mohon ? "pemohon" : "penggugat",
      k2: mohon ? "termohon" : "tergugat",
    };
  }
  return jurusitaSebutan(dok && dok.nomorPerkara, dok && dok.jenisPerkara);
}

/**
 * Keadaan satu dokumen rute bagi centangnya.
 *   boleh      centangnya dapat dipakai
 *   pilihPihak SIPP tidak menjawab pihaknya - juru sita mencentang sendiri
 *   sisi       sisi yang menurut SIPP perlu (PBT: pihakKe-nya)
 *   bawaan     sisi yang dicentang "Pilih semua" ([] = tidak ikut)
 *   sebab      kenapa tidak dapat dicetak (boleh = false) - pesan, bukan teknis
 *   catatan    kalimat yang harus dibaca sebelum mencetak
 */
function jurusitaKeadaanDok(dok, kelompok) {
  if (!dok) return null;
  const catatan = [];
  if (dok.sudahAdaRelaas === true) catatan.push("sudah tercatat di SIPP");
  for (const p of Array.isArray(dok.peringatan) ? dok.peringatan : []) {
    if (p && p.teks) catatan.push(String(p.teks));
  }
  const pilihPihak =
    dok.bisaDicetak !== true &&
    String(dok.pihakDipanggil || "") === "tidak-diketahui" &&
    /belum diketahui/i.test(String(dok.sebabTidakBisa || ""));
  if (pilihPihak) catatan.push("Pihak yang dipanggil belum tercatat di SIPP - centang sendiri.");
  const boleh = (dok.bisaDicetak === true && Boolean(dok.blangko && dok.blangko.berkas)) || pilihPihak;
  const pbtSisi = Number(dok.pihakKe);
  const sisi =
    String(dok.golongan || "") === "pemberitahuan-putusan" && (pbtSisi === 1 || pbtSisi === 2)
      ? [pbtSisi]
      : jurusitaSisiPihak(dok.pihakDipanggil);
  const tahan = !boleh || pilihPihak || dok.ikutPilihSemua === false || dok.sudahAdaRelaas === true || kelompok !== "hari-ini";
  return {
    boleh,
    pilihPihak,
    sisi,
    bawaan: tahan ? [] : sisi,
    sebab: boleh ? "" : String(dok.sebabTidakBisa || "belum dapat dicetak"),
    catatan,
  };
}

/** Dokumen PBT untuk satu sisi: yang pihakKe-nya sisi itu, atau yang satu per perkara (pihakKe kosong). */
function jurusitaDokPbtSisi(daftar, sisi) {
  const semua = Array.isArray(daftar) ? daftar : [];
  return (
    semua.find((d) => Number(d.pihakKe) === sisi) ||
    semua.find((d) => !(Number(d.pihakKe) === 1 || Number(d.pihakKe) === 2) && (jurusitaSisiPihak(d.pihakDipanggil).includes(sisi) || String(d.pihakDipanggil || "") === "tidak-diketahui")) ||
    null
  );
}

/** Baris per perkara (satu per sidang yang dipanggil; PBT menempel di baris pertama perkaranya). */
function jurusitaBarisMassal(dokumen, kelompok) {
  const perPerkara = new Map();
  for (const dok of Array.isArray(dokumen) ? dokumen : []) {
    if (!dok || typeof dok !== "object") continue;
    const id = String(dok.perkaraId || "");
    if (!perPerkara.has(id)) {
      perPerkara.set(id, {
        perkaraId: id,
        nomorPerkara: String(dok.nomorPerkara || ""),
        jurusita: String((dok.jurusita && dok.jurusita.nama) || ""),
        sebutan: jurusitaSebutanDok(dok),
        panggilan: [],
        pbt: [],
      });
    }
    const p = perPerkara.get(id);
    if (String(dok.golongan || "") === "pemberitahuan-putusan") p.pbt.push(dok);
    else p.panggilan.push(dok);
    if (!p.jurusita && dok.jurusita && dok.jurusita.nama) p.jurusita = String(dok.jurusita.nama);
  }
  const baris = [];
  for (const p of perPerkara.values()) {
    const panggilan = p.panggilan.length > 0 ? p.panggilan : [null];
    panggilan.forEach((pg, i) => {
      baris.push({
        kunciBaris: `${kelompok}:${p.perkaraId}:${pg ? String(pg.kunci || pg.d || i) : "pbt"}`,
        kelompok,
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        jurusita: p.jurusita,
        sebutan: p.sebutan,
        panggilan: pg,
        pbt: i === 0 ? p.pbt : [],
      });
    });
  }
  // Urut nomor perkara (angka depan), lalu sidang.
  const angka = (n) => Number((/^(\d+)/.exec(n) || [0, 0])[1]);
  return baris.sort((a, b) => angka(a.nomorPerkara) - angka(b.nomorPerkara) || a.kunciBaris.localeCompare(b.kunciBaris));
}

/** Centang bawaan "Pilih semua" satu baris. */
function jurusitaPilihanBawaan(baris) {
  const pilih = { p1: false, p2: false, b1: false, b2: false };
  const kp = jurusitaKeadaanDok(baris.panggilan, baris.kelompok);
  if (kp) for (const s of kp.bawaan) pilih[`p${s}`] = true;
  for (const s of [1, 2]) {
    const k = jurusitaKeadaanDok(jurusitaDokPbtSisi(baris.pbt, s), baris.kelompok);
    if (k && k.bawaan.includes(s)) pilih[`b${s}`] = true;
  }
  return pilih;
}

/** Blangko satu bagian: pemetaan server/simpanan -> blangko rute -> bawaan tertanam. */
function jurusitaBlangkoBagian(dok, jenis, kunci, ruteBerlaku, peta) {
  const dariPeta = jurusitaPilihBlangko(peta, jenis, kunci);
  if (dariPeta && dariPeta.sumber !== "bawaan") return dariPeta;
  const rute = dok && dok.blangko && dok.blangko.berkas ? String(dok.blangko.berkas) : "";
  if (rute && ruteBerlaku) return { berkas: rute, kunci: kunci[0], sumber: "rute" };
  return dariPeta;
}

/** Dokumen untuk satu baris massal dari centangnya - bentuk yang sama dengan per perkara. */
function jurusitaDokumenBarisMassal(baris, pilih, peta) {
  const seb = baris.sebutan;
  const calon = [];
  const tanpaBlangko = [];
  const pg = baris.panggilan;
  const kp = jurusitaKeadaanDok(pg, baris.kelompok);
  const sisiP = [1, 2].filter((s) => pilih && pilih[`p${s}`]);
  if (pg && kp && kp.boleh && sisiP.length > 0) {
    const golongan = String(pg.golongan || "");
    const lanjutan = golongan === "sidang-ditunda" || golongan === "sidang-lanjutan";
    // Blangko rute untuk tundaan dihitung atas pihak SIPP - berlaku hanya bila
    // yang dicentang sama; sidang pertama dan ikrar tidak bergantung pihak.
    const ruteBerlaku = pg.bisaDicetak === true && (!lanjutan || jurusitaSamaSisi(sisiP, kp.sisi));
    for (const sisi of sisiP) {
      const kunci =
        golongan === "ikrar-talak"
          ? ["panggilan-ikrar"]
          : golongan === "sidang-pertama"
            ? ["panggilan-sidang-pertama"]
            : jurusitaKunciPihak("panggilan", sisi, seb);
      const blangko = jurusitaBlangkoBagian(pg, "relaas", kunci, ruteBerlaku, peta);
      const pihak = sisi === 1 ? seb.pertama : seb.kedua;
      if (!blangko) {
        tanpaBlangko.push(`Panggilan ${pihak}`);
        continue;
      }
      calon.push({ golongan, d: Number(pg.d), sisi, pihak, jenis: "panggilan", blangko, dok: pg });
    }
  }
  for (const sisi of [1, 2].filter((s) => pilih && pilih[`b${s}`])) {
    const dok = jurusitaDokPbtSisi(baris.pbt, sisi);
    const k = jurusitaKeadaanDok(dok, baris.kelompok);
    if (!dok || !k || !k.boleh) continue;
    const blangko = jurusitaBlangkoBagian(dok, "pbt", jurusitaKunciPihak("pbt", sisi, seb), dok.bisaDicetak === true, peta);
    const pihak = sisi === 1 ? seb.pertama : seb.kedua;
    if (!blangko) {
      tanpaBlangko.push(`PBT ${pihak}`);
      continue;
    }
    calon.push({ golongan: "pemberitahuan-putusan", d: 0, sisi, pihak, jenis: "pbt", blangko, dok });
  }

  const kelompok = new Map();
  for (const c of jurusitaSatukanPdanT(calon)) {
    const k = `${c.golongan}|${c.d}|${c.blangko.berkas}`;
    if (!kelompok.has(k)) kelompok.set(k, { ...c, pihakSemua: [c.pihak], sisiSemua: [c.sisi] });
    else {
      const ada = kelompok.get(k);
      if (!ada.pihakSemua.includes(c.pihak)) ada.pihakSemua.push(c.pihak);
      ada.sisiSemua.push(c.sisi);
    }
  }
  const nomorAman = jurusitaNomorAman(baris.nomorPerkara, baris.perkaraId);
  const dokumen = [...kelompok.values()].map((c) => {
    const pihakTeks = c.pihakSemua.join(" dan ");
    const bagian =
      c.golongan === "pemberitahuan-putusan"
        ? "pemberitahuan putusan"
        : c.golongan === "ikrar-talak"
          ? `panggilan ikrar talak sidang ke-${c.d}`
          : `panggilan sidang ke-${c.d}`;
    const sisiKunci = [...new Set(c.sisiSemua)].sort().join("");
    const dasar = String(c.dok.kunci || `${c.golongan}:${baris.perkaraId}:${c.d}`);
    return {
      kunci: `${dasar}:${sisiKunci}`.slice(0, 160),
      perkaraId: String(baris.perkaraId),
      nomorPerkara: String(baris.nomorPerkara || ""),
      golongan: c.golongan,
      label: `${c.jenis === "pbt" ? "Pemberitahuan putusan" : "Panggilan"} ${pihakTeks}`.slice(0, 200),
      d: c.d,
      berkas: c.blangko.berkas,
      nama: `${nomorAman} - ${bagian} ${pihakTeks}`.slice(0, JURUSITA_NAMA_MAKS),
      jurusita: (baris.jurusita || "tidak tercatat").slice(0, 120),
      sumberBlangko: c.blangko.sumber,
    };
  });
  return { dokumen, tanpaBlangko };
}

/** Hari kerja (Senin-Jumat) sebelum tanggal ISO. */
function jurusitaHariKerjaSebelum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date();
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return jurusitaTanggalIso(d);
}

/** Keterangan sidang/PBT satu baris - yang dibaca juru sita sebelum mencentang. */
function jurusitaKeteranganBaris(baris) {
  const bagian = [];
  const pg = baris.panggilan;
  if (pg) {
    const jenis = JURUSITA_SEBUTAN_JENIS_SIDANG[String(pg.golongan || "")] || String(pg.golongan || "");
    const tgl = pg.tanggalSidangTujuan ? ` · ${jurusitaTanggalPendek(pg.tanggalSidangTujuan)}` : "";
    const baru = String(pg.sebabMasuk || "") === "didaftarkan" ? " · perkara baru" : "";
    bagian.push(`Panggilan sidang ke-${pg.d}${tgl} · ${jenis}${baru}`);
  }
  if (baris.pbt.length > 0) {
    const status = String((baris.pbt[0] && baris.pbt[0].statusPutusanNama) || "").trim();
    bagian.push(`Pemberitahuan putusan${status ? ` (${status})` : ""}`);
  }
  return bagian.join(" · ");
}

/**
 * Satu baris perkara: nomor, keterangan sidang, centang, catatan, blangko
 * (teknis). ubah(kunciBaris, nilai, tercentang) dipanggil tiap centang berubah.
 */
function jurusitaGambarBarisMassal(baris, pilih, tampilJurusita, ubah) {
  const el = jurusitaEl("div", "aleta-jurusita-perkara");
  el.setAttribute("data-perkara-id", baris.perkaraId);
  el.setAttribute("data-kelompok", baris.kelompok);
  const kepala = jurusitaEl("div", "aleta-jurusita-perkara-kepala");
  kepala.appendChild(jurusitaEl("span", "aleta-jurusita-perkara-nomor", baris.nomorPerkara || `perkara ${baris.perkaraId}`));
  if (tampilJurusita) kepala.appendChild(jurusitaEl("span", "aleta-jurusita-lembut", baris.jurusita || "juru sita tidak tercatat"));
  el.appendChild(kepala);
  el.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", jurusitaKeteranganBaris(baris)));

  const kotak = jurusitaEl("div", "aleta-jurusita-centang-kotak");
  const seb = baris.sebutan;
  const pesan = [];
  const pasangCentang = (nilai, label, keadaan) => {
    const x = jurusitaCentang(label, nilai, !keadaan.boleh, keadaan.boleh ? "" : keadaan.sebab);
    x.c.checked = Boolean(pilih[nilai]) && keadaan.boleh;
    x.c.setAttribute("data-baris", baris.kunciBaris);
    x.c.addEventListener("change", () => ubah(baris.kunciBaris, nilai, x.c.checked));
    kotak.appendChild(x.l);
  };
  const kp = jurusitaKeadaanDok(baris.panggilan, baris.kelompok);
  if (kp) {
    pasangCentang("p1", `Panggilan ${seb.pertama}`, kp);
    pasangCentang("p2", `Panggilan ${seb.kedua}`, kp);
    if (kp.sebab) pesan.push({ teks: `Panggilan: ${kp.sebab}`, salah: true });
    for (const c of kp.catatan) pesan.push({ teks: `Panggilan: ${c}`, salah: false });
  }
  const sudahDisebut = new Set();
  for (const s of [1, 2]) {
    const dok = jurusitaDokPbtSisi(baris.pbt, s);
    const k = jurusitaKeadaanDok(dok, baris.kelompok);
    if (!k) continue;
    pasangCentang(`b${s}`, `PBT ${s === 1 ? seb.pertama : seb.kedua}`, k);
    if (sudahDisebut.has(dok)) continue;
    sudahDisebut.add(dok);
    if (k.sebab) pesan.push({ teks: `PBT: ${k.sebab}`, salah: true });
    for (const c of k.catatan) pesan.push({ teks: `PBT: ${c}`, salah: false });
  }
  el.appendChild(kotak);
  for (const p of pesan) el.appendChild(jurusitaEl("div", p.salah ? "aleta-jurusita-salah" : "aleta-jurusita-catatan", p.teks));
  // Keterangan bot (PHS ulang, sandi kehadiran...) - teknis.
  const ket = [...(baris.panggilan && Array.isArray(baris.panggilan.keterangan) ? baris.panggilan.keterangan : [])];
  if (ket.length > 0) el.appendChild(jurusitaEl("div", "aleta-jurusita-lembut aleta-teknis", ket.join(" ")));
  const blangko = jurusitaEl("div", "aleta-jurusita-lembut aleta-jurusita-blangko aleta-teknis");
  blangko.hidden = true;
  el.appendChild(blangko);
  return { el, blangko };
}

function jurusitaGambarPanelMassal(akar, kotakPutaran, pantau) {
  const isi = jurusitaEl("div", "aleta-jurusita-isi");
  akar.appendChild(isi);

  const atas = jurusitaEl("div", "aleta-jurusita-baris");
  const tanggal = document.createElement("input");
  tanggal.type = "date";
  tanggal.className = "aleta-jurusita-pilih aleta-jurusita-tanggal";
  tanggal.value = jurusitaTanggalIso();
  tanggal.title = "Tanggal lahirnya relaas: perkara didaftarkan, sidang ditunda, atau putusan pada hari itu";
  atas.appendChild(tanggal);
  const hariIni = jurusitaTombol("Hari ini", "aleta-jurusita-tombol-kecil aleta-jurusita-hari-ini");
  const sebelumnya = jurusitaTombol("Hari kerja sebelumnya", "aleta-jurusita-tombol-kecil aleta-jurusita-hari-sebelumnya");
  atas.appendChild(hariIni);
  atas.appendChild(sebelumnya);
  const saring = document.createElement("select");
  saring.className = "aleta-jurusita-pilih aleta-jurusita-saring";
  for (const [nilai, teks] of [
    ["saya", "Milik saya"],
    ["semua", "Semua juru sita"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  saring.value = jurusitaJurusitaSendiri(jurusitaSiapa) ? "saya" : "semua";
  atas.appendChild(saring);
  isi.appendChild(atas);

  const hasil = jurusitaEl("div", "aleta-jurusita-hasil");
  isi.appendChild(hasil);

  let data = null;
  let sebabGagal = "";
  let peta = null;
  let urutanMuat = 0;
  /** kunciBaris -> { p1, p2, b1, b2 } - bertahan selama tanggalnya sama. */
  const pilihan = new Map();

  const muat = async () => {
    const ke = (urutanMuat += 1);
    hasil.textContent = "";
    hasil.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", "Membaca daftar..."));
    const jawab = await jurusitaAmbilDaftarRelaas(tanggal.value);
    const p = await jurusitaMuatPeta();
    if (ke !== urutanMuat) return; // tanggal berganti selagi membaca
    data = jawab.data && Array.isArray(jawab.data.dokumen) ? jawab.data : null;
    sebabGagal = data ? "" : jawab.sebab || "Daftar relaas tidak terbaca.";
    peta = p;
    pilihan.clear();
    gambar();
  };

  const gambar = () => {
    hasil.textContent = "";
    if (!data) {
      hasil.appendChild(jurusitaEl("div", "aleta-jurusita-kabar aleta-jurusita-kabar-salah", sebabGagal));
      return;
    }
    const hanyaSaya = saring.value === "saya";
    const namaSaya = String((jurusitaSiapa && jurusitaSiapa.nama) || "");
    const lolos = (b) => !hanyaSaya || jurusitaNamaCocok(namaSaya, b.jurusita);
    const barisHariIni = jurusitaBarisMassal(data.dokumen, "hari-ini").filter(lolos);
    const barisKemarin = jurusitaBarisMassal(jurusitaDokumenKemarin(data), "kemarin").filter(lolos);
    const semuaBaris = [...barisHariIni, ...barisKemarin];
    for (const b of semuaBaris) if (!pilihan.has(b.kunciBaris)) pilihan.set(b.kunciBaris, { p1: false, p2: false, b1: false, b2: false });

    // Ringkasan: berapa perkara, panggilan (berapa tundaan), PBT.
    const panggilan = barisHariIni.filter((b) => b.panggilan);
    const tundaan = panggilan.filter((b) => /sidang-(ditunda|lanjutan)/.test(String(b.panggilan.golongan || ""))).length;
    const pbt = barisHariIni.filter((b) => b.pbt.length > 0).length;
    const perkara = new Set(barisHariIni.map((b) => b.perkaraId)).size;
    hasil.appendChild(
      jurusitaEl(
        "div",
        "aleta-jurusita-ringkas",
        perkara === 0
          ? `Tidak ada relaas ${hanyaSaya ? "milik Anda " : ""}pada tanggal ini.`
          : `${perkara} perkara · ${panggilan.length} panggilan${tundaan ? ` (${tundaan} tundaan)` : ""} · ${pbt} PBT`
      )
    );

    const barisEl = new Map();
    const ubah = (kunciBaris, nilai, tercentang) => {
      const p = pilihan.get(kunciBaris);
      if (p) p[nilai] = tercentang;
      segarkan();
    };
    if (barisHariIni.length > 0) {
      const alat = jurusitaEl("div", "aleta-jurusita-baris");
      const semua = jurusitaTombol("Pilih semua", "aleta-jurusita-tombol-kecil aleta-jurusita-pilih-semua", "Centang pihak yang menurut SIPP perlu dipanggil / diberi tahu");
      const kosong = jurusitaTombol("Kosongkan", "aleta-jurusita-tombol-kecil aleta-jurusita-kosongkan");
      semua.addEventListener("click", () => {
        for (const b of barisHariIni) pilihan.set(b.kunciBaris, jurusitaPilihanBawaan(b));
        gambar();
      });
      kosong.addEventListener("click", () => {
        for (const b of semuaBaris) pilihan.set(b.kunciBaris, { p1: false, p2: false, b1: false, b2: false });
        gambar();
      });
      alat.appendChild(semua);
      alat.appendChild(kosong);
      hasil.appendChild(alat);
      const daftar = jurusitaEl("div", "aleta-jurusita-daftar-perkara");
      for (const b of barisHariIni) {
        const g = jurusitaGambarBarisMassal(b, pilihan.get(b.kunciBaris), !hanyaSaya, ubah);
        barisEl.set(b.kunciBaris, g);
        daftar.appendChild(g.el);
      }
      hasil.appendChild(daftar);
    }
    if (data.hariKerjaSebelumnya && barisKemarin.length > 0) {
      const lipat = jurusitaEl("details", "aleta-jurusita-rinci aleta-jurusita-kemarin");
      lipat.appendChild(
        jurusitaEl(
          "summary",
          "",
          `Dari hari kerja sebelumnya · ${jurusitaTanggalPendek(data.hariKerjaSebelumnya.tanggal)} (${barisKemarin.length})`
        )
      );
      lipat.appendChild(
        jurusitaEl("div", "aleta-jurusita-lembut", "Panggilan tundaan kemarin yang dicatat sesudah daftar kemarin - tidak ikut Pilih semua.")
      );
      for (const b of barisKemarin) {
        const g = jurusitaGambarBarisMassal(b, pilihan.get(b.kunciBaris), !hanyaSaya, ubah);
        barisEl.set(b.kunciBaris, g);
        lipat.appendChild(g.el);
      }
      hasil.appendChild(lipat);
    }
    if (semuaBaris.some((b) => {
      const kp = jurusitaKeadaanDok(b.panggilan, b.kelompok);
      return (kp && !kp.boleh) || b.pbt.some((d) => !jurusitaKeadaanDok(d, b.kelompok).boleh);
    })) {
      const a = jurusitaEl("a", "aleta-jurusita-tautan", "Yang tidak dapat dicetak di sini: buka Antrian Sidang di portal");
      a.href = `${location.origin}/aleta/aleta-ecourt`;
      a.target = "_blank";
      a.rel = "noopener";
      hasil.appendChild(a);
    }

    const aksi = jurusitaEl("div", "aleta-jurusita-aksi");
    const cetak = jurusitaTombol("Cetak", "aleta-jurusita-tombol-utama aleta-jurusita-cetak-massal", "Cetak relaas/PBT yang dicentang");
    aksi.appendChild(cetak);
    const kabar = jurusitaEl("div", "aleta-jurusita-kabar");
    kabar.hidden = true;
    hasil.appendChild(aksi);
    hasil.appendChild(kabar);

    const susunSemua = () => {
      const dokumen = [];
      const tanpaBlangko = [];
      for (const b of semuaBaris) {
        const r = jurusitaDokumenBarisMassal(b, pilihan.get(b.kunciBaris), peta);
        dokumen.push(...r.dokumen);
        tanpaBlangko.push(...r.tanpaBlangko.map((t) => `${b.nomorPerkara} ${t}`));
        const g = barisEl.get(b.kunciBaris);
        if (g) {
          g.blangko.textContent = r.dokumen.length ? `Blangko: ${r.dokumen.map((d) => d.berkas).join("; ")}` : "";
          g.blangko.hidden = r.dokumen.length === 0;
        }
      }
      return { dokumen, tanpaBlangko };
    };
    const segarkan = () => {
      const { dokumen, tanpaBlangko } = susunSemua();
      cetak.disabled = dokumen.length === 0;
      cetak.textContent = dokumen.length > 0 ? `Cetak ${dokumen.length} dokumen` : "Cetak";
      if (tanpaBlangko.length > 0) jurusitaKabar(kabar, `Blangko belum dipetakan: ${tanpaBlangko.join(", ")}.`, "salah");
      else if (kabar.classList.contains("aleta-jurusita-kabar-salah") && /^Blangko belum/.test(kabar.textContent || "")) jurusitaKabar(kabar, "", "");
    };
    cetak.addEventListener("click", async () => {
      const { dokumen } = susunSemua();
      if (dokumen.length === 0) return;
      if (!window.confirm(`Cetak ${dokumen.length} dokumen relaas/PBT sekaligus? Berkasnya turun ke folder unduhan "ALETA relaas".`)) return;
      cetak.disabled = true;
      jurusitaKabar(kabar, "Mengirim ke ekstensi...", "");
      const jawab = await jurusitaMulaiCetak(dokumen, tanggal.value || jurusitaTanggalIso());
      const k = jurusitaKalimatJawaban(jawab, dokumen.length);
      jurusitaKabar(kabar, k.teks, k.jenis);
      if (jawab && jawab.kering) {
        for (const d of dokumen) kabar.appendChild(jurusitaEl("div", "aleta-jurusita-lembut", `${d.nama} - ${d.berkas}`));
      }
      cetak.disabled = Boolean(jawab && jawab.ok);
      pantau();
    });
    segarkan();
  };

  tanggal.addEventListener("change", () => void muat());
  hariIni.addEventListener("click", () => {
    tanggal.value = jurusitaTanggalIso();
    void muat();
  });
  sebelumnya.addEventListener("click", () => {
    tanggal.value = jurusitaHariKerjaSebelum(tanggal.value || jurusitaTanggalIso());
    void muat();
  });
  saring.addEventListener("change", () => gambar());
  // Pembacaan pertama diputuskan pemanggil (terbuka atau saat dibuka).
  return muat;
}

/* ─── 7. Pintu masuk ──────────────────────────────────────────────────────── */

/**
 * Boleh menampilkan tab Juru Sita? Sinkron - untuk panel yang menentukan ada
 * tidaknya tab. Tanpa peran yang disebut, memakai akun yang sudah terbaca.
 * Dengan peran yang disebut, akun yang SUDAH terbaca ikut dihitung (peran
 * tambahan juru sita pada akun PP, misalnya).
 */
function aletaJurusitaBoleh(peran) {
  if (!jurusitaModeBaru()) return false;
  if (peran && jurusitaKelasBoleh(String(peran))) return true;
  return jurusitaPeranBoleh(jurusitaSiapa);
}

/**
 * Gerbang peran bersama per perkara dan massal: akun ALETA (seluruh
 * perannya); tanpa akun, peran yang disebut pemanggil (opsi.peran), lalu
 * data-peran panel sebagai cadangan terakhir.
 */
async function jurusitaBolehPasang(wadah, o) {
  const siapa = await jurusitaMuatSiapa();
  if (siapa) return jurusitaPeranBoleh(siapa);
  if (o.peran) return jurusitaKelasBoleh(String(o.peran));
  const panel = wadah.closest ? wadah.closest("[data-peran]") : null;
  return Boolean(panel && JURUSITA_DATA_PERAN_BOLEH.includes(panel.getAttribute("data-peran")));
}

async function aletaJurusitaPasang(wadah, opsi) {
  // Tampilan Lama: tidak ada yang digambar, dibaca, maupun dikirim.
  if (!jurusitaModeBaru()) return false;
  if (!wadah || typeof wadah.appendChild !== "function") return false;
  const o = opsi && typeof opsi === "object" ? opsi : {};

  const boleh = await jurusitaBolehPasang(wadah, o);
  if (!boleh || !jurusitaModeBaru()) return false;

  const lama = wadah.querySelector(`:scope > .${JURUSITA_PENANDA}:not(.${JURUSITA_MASSAL_PENANDA})`);
  if (lama) lama.remove();
  const akar = jurusitaEl("div", JURUSITA_PENANDA);
  akar.setAttribute("data-situs", o.situs === "abt" ? "abt" : "sipp");

  const kotakPutaran = jurusitaEl("div", "aleta-jurusita-putaran");
  kotakPutaran.hidden = true;
  const pantau = jurusitaPasangPantau(akar, kotakPutaran);

  const nomor = String(o.nomorPerkara || "").trim();
  if (nomor) {
    const perkara = jurusitaEl("div", "aleta-jurusita-bagian");
    akar.appendChild(perkara);
    jurusitaGambarPerkara(perkara, { nomorPerkara: nomor, perkaraId: String(o.perkaraId || "").trim() }, kotakPutaran, pantau);
  }
  const massal = jurusitaEl("div", "aleta-jurusita-bagian");
  akar.appendChild(massal);
  jurusitaGambarMassal(massal, kotakPutaran, pantau);
  akar.appendChild(kotakPutaran);
  wadah.appendChild(akar);
  // Putaran yang sedang berjalan (dari tab lain atau dari portal) ikut tampil.
  void pantau();
  return true;
}

/**
 * Panel "Relaas & pemberitahuan putusan - massal" untuk halaman DAFTAR perkara
 * SIPP dan BERANDA ABT (K3). Dipanggil panel SIPP/ABT bila alatMenuPeran(...,
 * "daftar", ...) memuat "relaas-pbt-massal".
 *
 * Bawaan terbuka (kontrak S: "ditentukan berkas pemiliknya"): terbuka - dan
 * daftarnya langsung dibaca - bagi juru sita (pekerjaan utamanya) dan di
 * beranda ABT (panel ABT memasangnya saat tabnya dipilih). Admin di daftar
 * perkara SIPP, yang punya empat menu massal, mendapatnya terlipat: daftar
 * satu hari penuh dibaca saat dibuka, bukan tiap halaman daftar dimuat.
 * opsi.terbuka true/false memaksa salah satunya.
 */
async function aletaJurusitaPasangMassal(wadah, opsi) {
  // Tampilan Lama: tidak ada yang digambar, dibaca, maupun dikirim.
  if (!jurusitaModeBaru()) return false;
  if (!wadah || typeof wadah.appendChild !== "function") return false;
  const o = opsi && typeof opsi === "object" ? opsi : {};

  const boleh = await jurusitaBolehPasang(wadah, o);
  if (!boleh || !jurusitaModeBaru()) return false;

  const lama = wadah.querySelector(`:scope > .${JURUSITA_MASSAL_PENANDA}`);
  if (lama) lama.remove();
  const akar = jurusitaEl("div", `${JURUSITA_PENANDA} ${JURUSITA_MASSAL_PENANDA}`);
  akar.setAttribute("data-situs", o.situs === "abt" ? "abt" : "sipp");
  const lipat = jurusitaEl("details", "aleta-jurusita-massal aleta-jurusita-massal-lipat");
  lipat.appendChild(jurusitaEl("summary", "aleta-jurusita-judul-teks", "Relaas & pemberitahuan putusan - massal"));
  akar.appendChild(lipat);
  const { baris: judul } = jurusitaJudul(
    "",
    "Daftar relaas yang lahir pada tanggal yang dipilih: panggilan sidang pertama untuk perkara yang baru " +
      "didaftarkan, panggilan ke sidang TUNDAAN berikutnya untuk sidang yang ditunda hari itu, dan pemberitahuan " +
      "putusan (PBT) untuk putusan hari itu - bahan yang sama dengan tombol Cetak relaas di Antrian Sidang portal. " +
      "Tanggal sidang yang dipanggil tertulis di tiap perkara. Pilih semua mencentang pihak yang menurut SIPP perlu " +
      "dipanggil atau diberi tahu; yang sudah tercatat di SIPP, yang perlu konfirmasi, dan yang dari hari kerja " +
      "sebelumnya dicentang sendiri. Relaas diambil dari ABT dengan akun ABT Anda sendiri, diubah menjadi PDF oleh " +
      'ALETA, lalu disimpan di folder unduhan "ALETA relaas/<tanggal>/<juru sita>". Tidak ada yang ditulis ke SIPP.'
  );
  lipat.appendChild(judul);
  // Putaran di LUAR lipatan: yang sedang mencetak tetap tampak walau terlipat.
  const kotakPutaran = jurusitaEl("div", "aleta-jurusita-putaran");
  kotakPutaran.hidden = true;
  const pantau = jurusitaPasangPantau(akar, kotakPutaran);
  const muat = jurusitaGambarPanelMassal(lipat, kotakPutaran, pantau);
  akar.appendChild(kotakPutaran);
  lipat.open =
    o.terbuka === true || (o.terbuka !== false && (o.situs === "abt" || jurusitaJurusitaSendiri(jurusitaSiapa)));
  let dimuat = false;
  const mulai = () => {
    if (!lipat.open || dimuat) return;
    dimuat = true;
    void muat();
  };
  lipat.addEventListener("toggle", mulai);
  wadah.appendChild(akar);
  mulai();
  void pantau();
  return true;
}

globalThis.aletaJurusitaPasang = aletaJurusitaPasang;
globalThis.aletaJurusitaBoleh = aletaJurusitaBoleh;
globalThis.aletaJurusitaPasangMassal = aletaJurusitaPasangMassal;
