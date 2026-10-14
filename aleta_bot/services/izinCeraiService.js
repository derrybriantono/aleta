"use strict";

/**
 * ============================================================================
 * IZIN CERAI PNS/ASN/TNI/POLRI - PENANDA DI SAMPING NOMOR PERKARA (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: tag "Izin cerai belum ada" di samping nomor perkara
 * untuk perkara cerai yang pihaknya PNS/ASN (termasuk PPPK), TNI, POLRI; bila
 * izin/keterangan atasan sudah ada, tidak ada tag.
 *
 * DASAR (yang sudah dipakai ALETA/ABT, bukan aturan baru):
 *   - PP 10/1983 jo. PP 45/1990: PNS yang hendak bercerai wajib memperoleh
 *     izin atau surat keterangan lebih dahulu dari pejabat; aturan TNI/Polri
 *     serupa (sippTahapanService.jenisPerluIzinAtasan, butir 31 5 Okt).
 *   - PPPK = ASN (PPPK) berdasar hukum PNS; pensiunan, CPNS, PPPK paruh waktu
 *     BUKAN (keputusan pengguna 11 Okt; pekerjaanPihakService).
 *   - BUMN/BUMD TIDAK ditandai: blangko ABT sendiri memuat pertimbangan bahwa
 *     PP 45/2005 (BUMN) mengesampingkan kewajiban izin PP 10/1983 bagi pegawai
 *     BUMN - menandainya "belum ada" akan menuduh kewajiban yang diperdebatkan.
 *
 * SUMBER (terukur di server 14 Okt 2026, cerai 2025+ = 1.348 perkara, 107
 * berpihak PNS/PPPK/TNI/POLRI):
 *   1. SIPP perkara_izin_cerai (perkara_id, pihak_id, STATUS, nomor_surat,
 *      tanggal_surat, pejabat) - sumber yang juga dibaca ABT (#0658#).
 *      Terisi pada 67 dari 71 perkara yang PENGGUGAT/PEMOHON-nya wajib izin,
 *      tetapi 0 dari 36 perkara yang hanya TERGUGAT/TERMOHON-nya wajib izin:
 *      SIPP tidak mencatat keterangan atasan pihak tergugat.
 *   2. Posita (perkara.posita) - kalimat "telah mendapat izin ... Keputusan
 *      Bupati Nomor ..." (cadangan; mis. 550/Pdt.G/2026 menyebutnya, SIPP kosong).
 *   3. Judul dokumen e-Court ("SK IZIN CERAI PNS ...") - hanya 1 dari 3.657
 *      dokumen tersimpan berjudul izin; izin biasanya diunggah sebagai
 *      "Dokumen Bukti" tanpa judul khusus, jadi ketiadaannya tidak berarti apa-apa.
 *
 * KEADAAN (jujur terhadap kekuatan sumber):
 *   ada            SIPP STATUS=1 - tanpa tag.
 *   belum-dicatat  SIPP kosong, tetapi posita/e-Court menyebut izin -
 *                  tag abu "Izin cerai belum dicatat SIPP" (blangko ABT
 *                  membaca nomor suratnya dari SIPP).
 *   belum-ada      penggugat/pemohon wajib izin, SIPP kosong, posita tidak
 *                  menyebut izin (atau menyebut "belum/sedang diurus") -
 *                  tag merah "Izin cerai belum ada". Sumbernya kuat (94%).
 *   belum-terbaca  hanya tergugat/termohon yang wajib izin - SIPP memang
 *                  tidak punya tempat mencatatnya; tag abu "Izin cerai belum
 *                  terbaca", bukan "belum ada".
 *
 * SIPP hanya DIBACA.
 */

const { cleanText } = require("./ecourtTextService");

/** Kode jenis_perkara SIPP: 346 Cerai Talak, 347 Cerai Gugat (poligami tidak - bukan cerai). */
const JENIS_CERAI = new Set([346, 347]);

/** Kunci pekerjaanPihakService yang wajib izin/keterangan atasan untuk bercerai. */
const KUNCI_WAJIB_IZIN = Object.freeze(["PNS", "PPPK", "TNI", "POLRI"]);

function jenisCerai(jenisId, jenisNama) {
  if (JENIS_CERAI.has(Number(jenisId))) return true;
  if (Number(jenisId) > 0) return false;
  return /\b(cerai|talak)\b/i.test(String(jenisNama || ""));
}

/** Teks posita SIPP (HTML/escape) menjadi kalimat polos. */
function teksPolos(teks) {
  return String(teks || "")
    .replace(/\\[nrt]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const POLA_IZIN = /\b(izin|ijin)\b/i;
const POLA_KAITAN = /\b(cerai|bercerai|perceraian|atasan|pejabat|bupati|walikota|wali kota|gubernur|kepala|keputusan|bkpsdm\w*|bkd|bkn|sekretaris|komandan|kapolres|kapolda|dandim|danrem)\b/i;
const POLA_KETERANGAN = /\bsurat keterangan\b[^.;]{0,80}\b(cerai|bercerai|perceraian)\b|\b(cerai|perceraian)\b[^.;]{0,60}\bsurat keterangan\b/i;
const POLA_BELUM =
  /\b(belum|sedang|akan|menyusul\w*|dalam proses|proses pengurusan|masih (?:dalam )?proses|tidak (?:mem)?(?:peroleh|dapat|mendapat\w*)|tanpa)\b/i;

/**
 * Apa kata posita tentang izin cerai. Murni.
 * @returns {{keadaan: "ada"|"belum"|"tidak", cuplikan: string}}
 */
function bacaIzinPosita(posita) {
  const t = teksPolos(posita);
  if (!t) return { keadaan: "tidak", cuplikan: "" };
  // Satu "kalimat" = potongan di antara titik koma/titik akhir kalimat/penomoran posita.
  const kalimat = t.split(/(?<=[;])\s+|(?<=\.)\s+(?=[A-Z0-9])|\s(?=\d{1,2}\.\s)/);
  let belum = "";
  for (const k of kalimat) {
    const kena = (POLA_IZIN.test(k) && POLA_KAITAN.test(k)) || POLA_KETERANGAN.test(k);
    if (!kena) continue;
    // "izin poligami"/"izin usaha" bukan izin cerai; "memberi izin kepada Pemohon
    // untuk menjatuhkan talak" adalah petitum cerai talak (terukur: 660/Pdt.G/2026).
    if (/\b(izin|ijin) (poligami|usaha|tinggal|keramaian)\b/i.test(k)) continue;
    if (/\b(menjatuhkan|mengucapkan|ikrar)\s+talak\b|\b(izin|ijin)\s+kepada\s+(pemohon|penggugat)\b/i.test(k)) continue;
    if (POLA_BELUM.test(k)) {
      if (!belum) belum = k;
      continue;
    }
    return { keadaan: "ada", cuplikan: k.slice(0, 240) };
  }
  return belum ? { keadaan: "belum", cuplikan: belum.slice(0, 240) } : { keadaan: "tidak", cuplikan: "" };
}

/** Judul dokumen e-Court yang jelas izin/keterangan atasan untuk bercerai. */
function judulIzinEcourt(judul) {
  const t = String(judul || "");
  return /\b(izin|ijin)\b[^]{0,40}\b(cerai|bercerai|perceraian|atasan)\b|\bsk\b[^]{0,10}\b(izin|ijin)\b|\bsurat keterangan\b[^]{0,40}\b(cerai|atasan)\b/i.test(t);
}

const SEBUT_SISI = { 1: "penggugat/pemohon", 2: "tergugat/termohon" };

/**
 * Keadaan izin cerai satu perkara. Murni.
 *
 * @param {object} o
 * @param {boolean} o.cerai perkaranya cerai talak/cerai gugat
 * @param {Array<{sisi:number, nama:string, kunci:string}>} o.pihak lencana pekerjaan pihak (penandaPerkaraPihakService)
 * @param {Array<{status:any, nomor?:string, tanggal?:string, pejabat?:string}>} [o.izinSipp] baris perkara_izin_cerai
 * @param {string} [o.posita]
 * @param {string[]} [o.judulEcourt] judul dokumen e-Court perkara itu
 * @returns {null | {keadaan: string, label: string, judul: string, sumber: string}}
 */
function keadaanIzinCerai({ cerai, pihak = [], izinSipp = [], posita = "", judulEcourt = [] }) {
  if (!cerai) return null;
  const wajib = (Array.isArray(pihak) ? pihak : []).filter(
    (p) => KUNCI_WAJIB_IZIN.includes(p.kunci) && (Number(p.sisi) === 1 || Number(p.sisi) === 2)
  );
  if (wajib.length === 0) return null;
  const sebutWajib = wajib
    .map((p) => `${cleanText(p.nama) || "pihak"} (${p.kunci === "PPPK" ? "ASN PPPK" : p.kunci}, ${SEBUT_SISI[Number(p.sisi)]})`)
    .join(", ");
  const dasar = "PP 10/1983 jo. PP 45/1990 (TNI/POLRI: aturan serupa).";

  const sah = (Array.isArray(izinSipp) ? izinSipp : []).filter((i) => String(i.status) === "1");
  if (sah.length > 0) {
    const i = sah[0];
    return {
      keadaan: "ada",
      label: "",
      judul: `Izin cerai tercatat di SIPP${i.nomor ? `: ${cleanText(i.nomor)}` : ""}${i.tanggal ? ` tanggal ${String(i.tanggal).slice(0, 10)}` : ""}${
        i.pejabat ? ` (${cleanText(i.pejabat)})` : ""
      }.`,
      sumber: "sipp",
    };
  }

  const pos = bacaIzinPosita(posita);
  const ecourt = (Array.isArray(judulEcourt) ? judulEcourt : []).map(cleanText).filter(judulIzinEcourt);
  if (pos.keadaan === "ada" || ecourt.length > 0) {
    const asal = pos.keadaan === "ada" ? `posita menyebut: "${pos.cuplikan}"` : `dokumen e-Court berjudul "${ecourt[0]}"`;
    return {
      keadaan: "belum-dicatat",
      label: "Izin cerai belum dicatat SIPP",
      judul: `Pihak wajib izin atasan: ${sebutWajib}. Izin tidak tercatat di SIPP (Data Pihak > Izin Cerai), tetapi ${asal}. Catat nomor dan tanggal suratnya di SIPP - blangko putusan ABT membacanya dari sana.`,
      sumber: pos.keadaan === "ada" ? "posita" : "ecourt",
    };
  }

  const adaPenggugat = wajib.some((p) => Number(p.sisi) === 1);
  const catatanSipp = (Array.isArray(izinSipp) ? izinSipp : []).length > 0 ? " SIPP mencatat baris izin berstatus tidak ada." : "";
  const catatanPosita = pos.keadaan === "belum" ? ` Posita menyebut: "${pos.cuplikan}".` : "";
  if (adaPenggugat) {
    return {
      keadaan: "belum-ada",
      label: "Izin cerai belum ada",
      judul: `Pihak wajib izin atasan: ${sebutWajib}. Izin/surat keterangan atasan untuk bercerai belum tercatat di SIPP dan tidak disebut di posita.${catatanSipp}${catatanPosita} Dasar: ${dasar}`,
      sumber: "sipp",
    };
  }
  return {
    keadaan: "belum-terbaca",
    label: "Izin cerai belum terbaca",
    judul: `Pihak wajib izin atasan: ${sebutWajib}. SIPP hanya mencatat izin cerai pihak penggugat/pemohon - keterangan atasan bagi tergugat/termohon tidak punya tempat di SIPP, jadi ALETA tidak dapat memastikan ada atau belumnya. Periksa berkas/keterangan tergugat di persidangan.${catatanPosita} Dasar: ${dasar}`,
    sumber: "tidak-ada",
  };
}

/**
 * Bahan izin cerai untuk sekumpulan perkara. Melempar bila SIPP tidak terbaca -
 * pemanggil mencatatnya sebagai tidak terbaca (tanpa tag sama sekali).
 *
 * @param {number[]} daftarPerkaraId
 * @param {Record<string, Array>} pekerjaan hasil pekerjaanPihakBanyakPerkara
 * @returns {Promise<Record<string, object>>} perkaraId -> keadaanIzinCerai (hanya yang tidak null)
 */
async function izinCeraiBanyakPerkara(daftarPerkaraId, pekerjaan = {}, deps = {}) {
  const hasil = {};
  const wajib = (Array.isArray(daftarPerkaraId) ? daftarPerkaraId : [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0)
    .filter((id) => (pekerjaan[String(id)] || []).some((p) => KUNCI_WAJIB_IZIN.includes(p.kunci)));
  const id = [...new Set(wajib)].slice(0, 500);
  if (id.length === 0) return hasil;
  const kueri = deps.kueri;
  if (typeof kueri !== "function") throw new Error("kueri SIPP tidak tersedia");
  const skema = deps.skema || require("./sippSkemaService");
  const isian = id.map(() => "?").join(", ");

  const adaPosita = await skema.kolomAda("perkara", "posita").catch(() => false);
  const perkara = await kueri(
    `SELECT perkara_id AS perkaraId, jenis_perkara_id AS jenisId, jenis_perkara_nama AS jenisNama, nomor_perkara AS nomor${
      adaPosita ? ", posita" : ""
    } FROM perkara WHERE perkara_id IN (${isian})`,
    id
  );
  const cerai = (Array.isArray(perkara) ? perkara : []).filter((p) => jenisCerai(p.jenisId, p.jenisNama));
  if (cerai.length === 0) return hasil;

  const izin = new Map();
  if (await skema.tabelAda("perkara_izin_cerai").catch(() => false)) {
    const idCerai = cerai.map((p) => Number(p.perkaraId));
    const baris = await kueri(
      `SELECT perkara_id AS perkaraId, STATUS AS status, nomor_surat AS nomor, tanggal_surat AS tanggal, jabatan_pejabat AS pejabat
         FROM perkara_izin_cerai WHERE perkara_id IN (${idCerai.map(() => "?").join(", ")})`,
      idCerai
    );
    for (const b of Array.isArray(baris) ? baris : []) {
      const k = String(b.perkaraId);
      if (!izin.has(k)) izin.set(k, []);
      izin.get(k).push(b);
    }
  } else {
    // Tanpa tabelnya tidak ada yang dapat disimpulkan - lebih baik diam.
    throw new Error("tabel perkara_izin_cerai tidak terdaftar");
  }

  // Judul dokumen e-Court (cadangan lemah) - gagal = diabaikan.
  const judul = new Map();
  if (typeof deps.judulEcourt === "function") {
    try {
      const peta = await deps.judulEcourt(cerai.map((p) => cleanText(p.nomor)).filter(Boolean));
      for (const [nomor, daftar] of Object.entries(peta || {})) judul.set(nomor, daftar);
    } catch {
      /* cadangan saja */
    }
  }

  for (const p of cerai) {
    const k = String(p.perkaraId);
    const r = keadaanIzinCerai({
      cerai: true,
      pihak: pekerjaan[k] || [],
      izinSipp: izin.get(k) || [],
      posita: p.posita || "",
      judulEcourt: judul.get(cleanText(p.nomor)) || [],
    });
    if (r) hasil[k] = r;
  }
  return hasil;
}

/** Judul dokumen e-Court tersimpan, per nomor perkara (basis data bot, hanya baca). */
async function judulEcourtBawaan(daftarNomor) {
  const nomor = [...new Set((daftarNomor || []).filter(Boolean))].slice(0, 500);
  if (nomor.length === 0) return {};
  const botDb = require("./botDbService");
  const baris = await botDb.query(
    `SELECT nomor_perkara AS nomor, judul_dokumen AS judul FROM aleta_bot_ecourt_documents WHERE nomor_perkara IN (${nomor
      .map(() => "?")
      .join(", ")})`,
    nomor
  );
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const k = cleanText(b.nomor);
    if (!hasil[k]) hasil[k] = [];
    hasil[k].push(b.judul);
  }
  return hasil;
}

module.exports = {
  JENIS_CERAI,
  KUNCI_WAJIB_IZIN,
  jenisCerai,
  teksPolos,
  bacaIzinPosita,
  judulIzinEcourt,
  keadaanIzinCerai,
  izinCeraiBanyakPerkara,
  judulEcourtBawaan,
};
