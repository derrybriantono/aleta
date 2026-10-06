"use strict";

/**
 * ============================================================================
 * PEMBEBANAN YANG DIBAYAR SAAT IKRAR TALAK - DIURAI DARI AMAR PUTUSAN
 * ============================================================================
 *
 * Diminta pengguna 6 Oktober 2026: pada sidang ikrar talak, tandai bila ada
 * pembebanan (mut'ah, nafkah iddah, nafkah madliyah, nafkah anak, dan
 * pembebanan lain yang dibayar saat ikrar), rinciannya di panel Rincian.
 *
 * ----------------------------------------------------------------------------
 * KENAPA DARI TEKS AMAR, BUKAN DARI TABEL
 * ----------------------------------------------------------------------------
 *
 * SIPP PUNYA tabelnya - perkara_nafkah_istri (iddah, mutah, madhiyah, maskan,
 * kiswah) dan perkara_anak_pihak (jumlah_nafkah, nafkah_pokok, ...). Diukur di
 * sipp_donggala 6 Oktober 2026:
 *
 *   perkara_nafkah_istri     1 baris (seluruh riwayat satker)
 *   perkara_anak_pihak       2.532 baris, jumlah_nafkah > 0 hanya 2
 *   putusan cerai talak dikabulkan                     988
 *   ... yang amarnya menyebut mut'ah                   110
 *   ... yang amarnya menyebut iddah                    124
 *
 * Tabelnya praktis tidak pernah diisi. Satu-satunya tempat pembebanan itu
 * tercatat sungguh-sungguh adalah kalimat amar di perkara_putusan.amar_putusan
 * (HTML dari penyunting kaya). amar_ikrar_talak di perkara_ikrar_talak sudah
 * diperiksa juga: isinya hanya "perkawinan putus" dan biaya penetapan.
 *
 * ----------------------------------------------------------------------------
 * TIDAK MENGARANG ANGKA
 * ----------------------------------------------------------------------------
 *
 *   - Pos yang jenisnya terbaca tetapi jumlahnya tidak (mut'ah berupa cincin
 *     emas 2 gram, rumah, tanah) tetap ditampilkan, dengan jumlah null dan
 *     uraiannya - BUKAN dinolkan, dan tidak ikut total.
 *   - Angka yang berbeda dengan terbilangnya ditandai ragu. Terbilang dipakai
 *     HANYA bila angkanya cacat bentuk (Rp1.00.000 untuk "satu juta").
 *   - Nafkah anak bulanan (berkala) tidak dijumlah ke total yang dibayar saat
 *     ikrar - ia dibayar tiap bulan. Yang dijumlah hanya yang sekaligus.
 *   - Amar yang menyebut pembebanan tetapi tidak satu pos pun dapat diurai
 *     dilaporkan sebagai tidakTerbaca, bukan sebagai "tidak ada pembebanan".
 *
 * ----------------------------------------------------------------------------
 * UKURAN KETERBACAAN (sipp_donggala, putusan s.d. 2 September 2026)
 * ----------------------------------------------------------------------------
 *
 *   putusan cerai talak dikabulkan                 988 (2015 - 2026)
 *   berpembebanan terurai                          173  (172 berangka, 1 barang saja)
 *   tanpa kata kunci pembebanan sama sekali        813
 *   menyebut pembebanan tetapi tak terurai           0
 *   bertanda ragu (angka vs terbilang, periode)     15
 *   menyebut waktu bayar sebelum/saat ikrar         72
 *   2025-2026 saja: 162 putusan, 32 berpembebanan, 23 sebelum ikrar
 *
 * 30 potongan berangka yang tidak menjadi pos diperiksa satu per satu: biaya
 * perkara, iwadl khul'i, jumlah ulang ("dengan jumlah keseluruhan"), angka
 * yang diganti terbilangnya, dan harta/utang bersama - seluruhnya memang
 * bukan pembebanan ikrar.
 *
 * Berkas ini MURNI - tanpa require, tanpa basis data - supaya pengurainya
 * dapat diuji langsung dari portal (vitest) atas contoh amar sungguhan.
 */

/** Sebutan tiap jenis pos, untuk layar. */
const SEBUTAN_JENIS = {
  mutah: "Mut'ah",
  iddah: "Nafkah iddah",
  madliyah: "Nafkah madliyah (lampau)",
  anak: "Nafkah anak",
  "kiswah-maskan": "Kiswah/maskan",
  mahar: "Mahar terutang",
  lainnya: "Pembebanan lain",
};

/** Urutan tampil pos - mengikuti urutan lazim amar. */
const URUTAN_JENIS = ["mutah", "iddah", "madliyah", "kiswah-maskan", "mahar", "anak", "lainnya"];

// ---------------------------------------------------------------------------
// HTML -> potongan kalimat
// ---------------------------------------------------------------------------

function bersihkanEntitas(teks) {
  return String(teks || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&#039;|&rsquo;|&lsquo;|&#8217;|&#8216;|&acute;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[`‘’´ʼ]/g, "'");
}

/**
 * Amar HTML menjadi potongan: tiap paragraf / butir daftar / baris, lalu
 * dipecah lagi pada titik koma dan titik dua (diktum ditutup ";", kepala
 * daftar ditutup ":"). Amar yang seluruhnya ditulis dalam satu paragraf
 * (terukur ada) karena itu tetap terpecah per diktum.
 *
 * @returns {{teks: string, kepala: boolean}[]}
 */
function potongAmar(html) {
  const baris = bersihkanEntitas(html)
    // "</br>" ikut (terukur pada amar 2015) - bukan tag sah, tetapi ada.
    .replace(/<\s*(\/p|\/li|\/?br\s*\/?|\/div|\/h\d|\/tr|\/ol|\/ul)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .split(/\n/);
  const hasil = [];
  for (const satu of baris) {
    const teks = satu.replace(/\s+/g, " ").trim();
    if (!teks) continue;
    // Titik dua diikuti spasi/akhir = kepala daftar. "pukul 09:00" tidak
    // terpotong karena tidak diikuti spasi.
    const bagian = teks.split(/(;|:(?=\s|$))/);
    for (let i = 0; i < bagian.length; i += 2) {
      const isi = (bagian[i] || "").trim();
      const pemisah = bagian[i + 1] || "";
      if (!isi || /^[\s.,;:-]*$/.test(isi)) continue;
      hasil.push({ teks: isi, kepala: pemisah === ":" });
    }
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Angka dan terbilang
// ---------------------------------------------------------------------------

const KATA_ANGKA = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};

/**
 * "lima juta lima ratus ribu rupiah" -> 5500000. null bila ada kata yang
 * tidak dikenal atau susunannya cacat ("tiga juta ribu") - terbilang yang
 * tidak terbaca utuh tidak boleh menjadi angka.
 */
function terbilangKeAngka(teksMentah) {
  const kata = String(teksMentah || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((k) => k !== "rupiah" && k !== "dan");
  if (kata.length === 0) return null;
  let total = 0;
  let kelompok = 0;
  let satuan = 0;
  let adaSatuan = false;
  for (const k of kata) {
    if (k === "koma" || k === "sen") break;
    if (Object.prototype.hasOwnProperty.call(KATA_ANGKA, k)) {
      if (adaSatuan) return null;
      satuan = KATA_ANGKA[k];
      adaSatuan = true;
    } else if (k === "sepuluh") kelompok += 10;
    else if (k === "sebelas") kelompok += 11;
    else if (k === "seratus") kelompok += 100;
    else if (k === "belas") {
      if (!adaSatuan) return null;
      kelompok += satuan + 10;
      satuan = 0;
      adaSatuan = false;
    } else if (k === "puluh") {
      if (!adaSatuan) return null;
      kelompok += satuan * 10;
      satuan = 0;
      adaSatuan = false;
    } else if (k === "ratus") {
      if (!adaSatuan) return null;
      kelompok += satuan * 100;
      satuan = 0;
      adaSatuan = false;
    } else if (k === "seribu") total += 1000;
    else if (k === "ribu" || k === "juta" || k === "miliar" || k === "milyar") {
      const nilai = kelompok + satuan;
      if (nilai === 0) return null;
      const kali = k === "ribu" ? 1e3 : k === "juta" ? 1e6 : 1e9;
      total += nilai * kali;
      kelompok = 0;
      satuan = 0;
      adaSatuan = false;
    } else return null;
  }
  total += kelompok + satuan;
  return total > 0 ? total : null;
}

/**
 * Angka rupiah dari tulisan bebas: "10.000.000,00", "1.500.000,-",
 * "500.000.00", "3.500,000,00", "1.500 .000.00".
 *
 * @returns {{nilai: number, cacat: boolean} | null} cacat = kelompok ribuannya
 *   tidak tiga angka (Rp1.00.000, Rp3000.000) - angkanya tetap dibaca, tetapi
 *   terbilang (bila ada) yang menang.
 */
function angkaRupiah(mentah) {
  let teks = String(mentah || "").replace(/\s+/g, "");
  teks = teks.replace(/[.,\-]+$/, "");
  // Desimal: satu atau dua angka sesudah pemisah terakhir.
  teks = teks.replace(/[.,]\d{1,2}$/, "");
  teks = teks.replace(/[.,\-]+$/, "");
  if (!/^\d[\d.,]*$/.test(teks)) return null;
  const kelompok = teks.split(/[.,]/);
  const nilai = Number(kelompok.join(""));
  if (!Number.isFinite(nilai)) return null;
  const cacat =
    kelompok.length > 1
      ? kelompok.slice(1).some((k) => k.length !== 3) || kelompok[0].length > 3 || kelompok[0].length === 0
      : teks.length > 4; // "3000000" tanpa pemisah - sah, tetapi tidak lazim
  return { nilai, cacat: kelompok.length > 1 ? cacat : false };
}

// Angka berawalan Rp, atau berawalan "sejumlah/sebesar" tanpa Rp (terukur ada:
// "Nafkah iddah sejumlah 1.200.000,- (satu juta dua ratus ribu rupiah)").
const POLA_ANGKA =
  /(?:\bRp\s*[.,:;]?\s*(?:,-\s*)?|\b(?:sejumlah|sebesar|senilai|berjumlah)\s+(?=\d{1,3}[.,]\d{3}))(\d[\d.,]*(?:\s(?=[.,]?\d{3}\b)[.,]?\d{3}[\d.,]*)*)(?!\s*%)([.,\-]*)\s*(?:\(([^)]*)\))?/gi;

// Di bawah ini bukan pembebanan, melainkan salah ketik ("Rp 10% pertahun"
// tertangkap sebagai Rp10 bila % tidak dicegah) atau sisa nol.
const BATAS_BAWAH = 1000;

/**
 * Seluruh angka rupiah dalam satu potongan, beserta letaknya.
 * @returns {{mulai:number, akhir:number, nilai:number|null, angka:number|null, terbilang:number|null, ragu:boolean, catatan:string}[]}
 */
function cariAngka(teks) {
  const hasil = [];
  POLA_ANGKA.lastIndex = 0;
  let m;
  while ((m = POLA_ANGKA.exec(teks))) {
    const angka = angkaRupiah(m[1]);
    const terbilang = m[3] && /[a-z]/i.test(m[3]) ? terbilangKeAngka(m[3]) : null;
    let nilai = angka ? angka.nilai : null;
    let ragu = false;
    let catatan = "";
    if (angka && terbilang !== null && angka.nilai !== terbilang) {
      // Selisih tepat kelipatan seribu ("Rp 3.000.000.000 (tiga juta
      // rupiah)" - terukur 5 kali di satker) = satu kelompok ".000" berlebih
      // atau hilang saat mengetik. Angkanya yang salah: tidak ada mut'ah atau
      // iddah tiga miliar, dan memakainya akan membuat total di layar
      // seribu kali lipat.
      //
      // Tetapi ARAHNYA dua-duanya terukur: "Rp.500.000,- (lima ratus
      // rupiah)" - di sana terbilangnya yang kehilangan "ribu". Yang dipakai
      // karena itu yang masuk akal sebagai pembebanan (sepuluh ribu sampai
      // di bawah satu miliar); bila keduanya masuk akal atau keduanya tidak,
      // angkanya yang dipakai dan ditandai ragu.
      const rasio = angka.nilai > terbilang ? angka.nilai / terbilang : terbilang / angka.nilai;
      const salahKelompok = rasio === 1000 || rasio === 1e6;
      const masukAkal = (x) => x >= 10000 && x < 1e9;
      const pakaiTerbilang =
        angka.cacat || (salahKelompok && masukAkal(terbilang) && !masukAkal(angka.nilai));
      if (pakaiTerbilang) {
        nilai = terbilang;
        catatan = angka.cacat
          ? `angka tertulis "${m[1].trim()}" cacat bentuk; dipakai terbilangnya`
          : `angka tertulis Rp${angka.nilai.toLocaleString("id-ID")} berselisih seribu kali dengan terbilangnya; dipakai terbilangnya`;
        ragu = !angka.cacat;
      } else {
        ragu = true;
        catatan = `angka Rp${angka.nilai.toLocaleString("id-ID")} berbeda dengan terbilangnya (${terbilang.toLocaleString("id-ID")})`;
      }
    } else if (!angka && terbilang !== null) {
      nilai = terbilang;
    } else if (angka && angka.cacat && terbilang === null) {
      ragu = true;
      catatan = `angka tertulis "${m[1].trim()}" cacat bentuk`;
    }
    if (nilai === null || nilai < BATAS_BAWAH) {
      // Rp0,- (biaya penetapan nol) dan sejenisnya bukan pembebanan.
      continue;
    }
    hasil.push({ mulai: m.index, akhir: m.index + m[0].length, nilai, angka: angka ? angka.nilai : null, terbilang, ragu, catatan });
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Jenis pos
// ---------------------------------------------------------------------------

// Pola tiap jenis. Mut'ah TANPA \b di depan (terukur "danmut'ah" tanpa spasi)
// tetapi DENGAN \b di belakang - "Mutahir", "Mutiara" dalam nama pihak tidak
// boleh terbaca mut'ah (terukur dua-duanya di sipp_donggala).
const POLA_JENIS = [
  ["mahar", /\bmahar\b|\bmas kawin\b/gi],
  ["madliyah", /madl[iy]|madh[iy]|\bmadiyah|\blampau\b|ter(?:h)?utang/gi],
  ["mutah", /mut'?\s?ah\b/gi],
  ["anak", /\banak\b|\bhadh?[oa]nah\b/gi],
  ["iddah", /\bi?d'?dah\b|\bidah\b/gi],
  ["kiswah-maskan", /\bkiswah\b|\bmaskan\b/gi],
];

/**
 * Nama dalam kurung - "(Nur'idah binti Edwar)" - dibuang sebelum jenisnya
 * dibaca: nama pihak memuat potongan kata kunci lebih sering dari dugaan.
 * Panjangnya dipertahankan (diganti spasi) supaya letak angka tidak bergeser.
 */
function tanpaNama(teks) {
  return teks.replace(/\([^()]*\b(?:bin|binti|alias)\b[^()]*\)/gi, (x) => " ".repeat(x.length));
}

/** Kata kunci jenis TERDEKAT sebelum letak tertentu (atau seluruh teks). */
function jenisTerdekat(teks, sampai = teks.length) {
  const bersih = tanpaNama(teks).slice(0, sampai);
  let terbaik = null;
  let letak = -1;
  for (const [jenis, pola] of POLA_JENIS) {
    pola.lastIndex = 0;
    let m;
    while ((m = pola.exec(bersih))) {
      if (m.index >= letak) {
        // "anak" hanya pembebanan bila yang dibebankan nafkah/biayanya -
        // "Menetapkan anak ... dalam hadhanah" bukan.
        if (jenis === "anak" && !/nafkah|biaya/i.test(bersih)) continue;
        letak = m.index;
        terbaik = jenis;
      }
    }
  }
  return terbaik;
}

// "setiap bulan" sesudah angka - tetapi tidak sesudah "atau" (pilihan angka
// lain, bukan sifat angka ini).
const POLA_BERKALA = /^(?:(?!\batau\b)[^;]){0,40}?(?:\b(?:setiap|tiap|per)\s?bulan|\/\s?bulan)/i;
const POLA_PENJUMLAH = /(sehingga|seluruhnya|keseluruhan|berjumlah|total|dikali|jumlah)\W*(?:\w+\W+){0,3}$/i;
const POLA_TOLAK = /^\W*(?:\d+(?:\.\d+)*\.?|[a-z][.)])?\s*(menolak|menyatakan|tidak dapat diterima|mengabulkan)\b/i;
const POLA_BIAYA = /biaya\s+(?:yang timbul\s+)?(?:dalam\s+)?(perkara|penetapan|eksekusi|pengiriman|materai|meterai)|membiayai perkara|membayai perkara/i;
const POLA_HUKUM = /\b(menghukum|membebankan|mewajibkan|menetapkan|memberikan|memberi|membayar|menyerahkan)\b/i;
const POLA_RUJUKAN = /diktum|sebagaimana|tersebut (?:di )?atas|keseluruhan|seluruhnya/i;
const POLA_IKRAR = /ikrar/i;
// Pembagian harta bersama dan pelunasan utang bersama BUKAN pembebanan yang
// dibayar saat ikrar - terukur "separuh dari hasil penjualan rumah bersama",
// "tunggakan angsuran kredit pada Bank BNI".
const POLA_BUKAN_BEBAN_IKRAR = /harta bersama|rumah bersama|hasil penjualan|hutang|utang bersama|kredit|\bbank\b|angsuran/i;
const POLA_WAKTU_IKRAR =
  /(?:sebelum|menjelang|sesaat|saat|ketika|dalam sidang|pada sidang|setelah|sesudah)[^;]{0,100}ikrar|ikrar[^;]{0,60}(?:diucapkan|pengucapan)[^;]{0,20}sebelum/i;

/** Pihak yang dihukum membayar, dari "Menghukum X ...". "istri" bila Termohon/Penggugat. */
function pihakDihukum(teks) {
  const m = /\bmenghukum\s+(?:kepada\s+)?(pemohon|tergugat|termohon|penggugat)/i.exec(teks);
  if (!m) return "";
  return /pemohon|tergugat/i.test(m[1]) ? "suami" : "istri";
}

/** Sebutan penerima - Termohon / Penggugat Rekonvensi - dari kalimatnya. */
function penerimaDari(teks, jenis) {
  const bersih = tanpaNama(teks);
  const m =
    /(?:kepada|melalui|untuk)\s+(Termohon(?:\s+Konvensi)?|Penggugat\s+Rek[oa]n[vp]ensi|Penggugat)\b/i.exec(bersih) ||
    /(Termohon(?:\s+Konvensi)?|Penggugat\s+Rek[oa]n[vp]ensi)\b/i.exec(bersih);
  // Kosong bila kalimatnya tidak menyebut penerima ("Menetapkan nafkah iddah
  // Rp X") - diisi sesudahnya dari sebutan istri pada pos lain amar yang
  // sama, supaya satu perkara tidak menyebut istri yang sama dengan dua nama.
  return m ? m[1].replace(/\s+/g, " ") : "";
}

function sebutanPenerima(istri, jenis) {
  if (jenis === "anak") return istri ? `anak, melalui ${istri}` : "anak";
  return istri || "Termohon";
}

function ringkasKalimat(teks, batas = 400) {
  const t = String(teks || "").replace(/\s+/g, " ").trim();
  return t.length > batas ? `${t.slice(0, batas)}...` : t;
}

/**
 * Mengurai amar menjadi pos pembebanan.
 *
 * @param {string} amarHtml perkara_putusan.amar_putusan
 * @returns {{
 *   pos: {jenis:string, sebutan:string, jumlah:number|null, berkala:boolean,
 *         penerima:string, keterangan:string, kalimat:string, ragu:boolean, catatan:string}[],
 *   totalSekaligus: number,
 *   berkalaPerBulan: number,
 *   adaTanpaAngka: boolean,
 *   adaRagu: boolean,
 *   sebelumIkrar: boolean,
 *   waktuBayar: string,
 *   tidakTerbaca: boolean,
 * }}
 */
function uraiPembebanan(amarHtml) {
  const potongan = potongAmar(amarHtml);
  const pos = [];
  let kepala = "";
  let waktuBayar = "";

  for (const { teks, kepala: iniKepala } of potongan) {
    // Kalimat waktu bayar - "dibayar sebelum Tergugat Rekonvensi mengucapkan
    // ikrar talak", "sesaat sebelum ikrar talak diucapkan". Yang pertama
    // ditemukan disimpan utuh: syarat "kecuali ... tidak keberatan" (SEMA
    // 1/2017) ikut terbaca.
    //
    // Bentuknya beragam (terukur): "sebelum ikrar talak diucapkan", "sesaat
    // sebelum", "menjelang pengucapan ikrar talak", "diserahkan dalam sidang
    // pengucapan ikrar talak" - dan juga "sesaat SETELAH sidang pengucapan
    // ikrar", yang bukan syarat ikrar. Hanya kalimat yang membicarakan
    // pembayaran/penyerahan yang dibaca, bukan "Memerintahkan Panitera
    // mengirimkan salinan penetapan ikrar talak".
    if (
      !waktuBayar &&
      POLA_WAKTU_IKRAR.test(teks) &&
      /dibayar|diserahkan|diberikan|membayar|menyerahkan|memberikan|kewajiban|Rp|mut'?\s?ah\b|iddah|nafkah/i.test(teks)
    ) {
      waktuBayar = ringkasKalimat(teks, 300);
    }

    // Diktum baru yang berdiri sendiri (berawal kata kerja amar) menutup
    // kepala daftar sebelumnya.
    const diktumBaru = /^\W*(?:\d+(?:\.\d+)*\.?\s*)?(menghukum|menetapkan|membebankan|menolak|mengabulkan|menyatakan|memberi|memerintahkan)\b/i.test(teks);

    if (iniKepala) {
      // Kepala daftar ("Menghukum Pemohon membayar kepada Termohon berupa:")
      // menjadi konteks butir-butir sesudahnya. Kepala yang SENDIRI memuat
      // angka (titik dua salah ketik di ujung diktum, terukur) tetap diurai.
      kepala = teks;
      if (cariAngka(teks).length === 0) continue;
    }
    const konteks = diktumBaru || iniKepala ? "" : kepala;
    if (diktumBaru && !iniKepala) kepala = "";

    if (POLA_TOLAK.test(teks)) continue;
    if (POLA_BIAYA.test(teks)) continue;
    // Yang dihukum istri (Termohon/Penggugat) bukan pembebanan ikrar.
    const pelaku = pihakDihukum(teks) || pihakDihukum(konteks);
    if (pelaku === "istri") continue;

    const angka = cariAngka(teks);
    const jenisKalimat = jenisTerdekat(teks);
    const adaHukum = POLA_HUKUM.test(teks) || POLA_HUKUM.test(konteks);

    if (angka.length === 0) {
      // Pos tanpa angka - mut'ah berupa emas/rumah/tanah. Hanya bila
      // kalimatnya MEMBEBANKAN jenis itu, bukan merujuk diktum lain.
      if (!jenisKalimat || !adaHukum) continue;
      if (POLA_RUJUKAN.test(teks)) continue;
      if (jenisKalimat === "anak" && !/nafkah|biaya/i.test(teks)) continue;
      const berupa = /berupa\s+(.+)$/i.exec(teks);
      pos.push({
        jenis: jenisKalimat,
        jumlah: null,
        berkala: /setiap bulan|tiap bulan|per\s?bulan/i.test(teks),
        penerima: penerimaDari(`${konteks} ${teks}`, jenisKalimat),
        keterangan: berupa ? ringkasKalimat(berupa[1], 160) : "jumlahnya tidak tertulis dalam angka",
        kalimat: ringkasKalimat(teks),
        ragu: false,
        catatan: "",
      });
      continue;
    }

    // Tiap angka diberi jenis menurut kata kunci terdekat SEBELUMNYA. Angka
    // tanpa kata kunci baru sesudah angka sebelumnya adalah keterangan angka
    // itu (per bulan -> "sehingga berjumlah"), bukan pos baru.
    let posSebelum = null;
    let akhirSebelum = 0;
    for (let i = 0; i < angka.length; i += 1) {
      const a = angka[i];
      const sela = teks.slice(akhirSebelum, a.mulai);
      const jenisSela = jenisTerdekat(sela);
      // Ekor angka dipotong pada angka berikutnya: "Rp900.000 atau setiap
      // bulan Rp300.000" - "setiap bulan" milik angka kedua, bukan pertama.
      const batasEkor = i + 1 < angka.length ? angka[i + 1].mulai : teks.length;
      const sesudah = teks.slice(a.akhir, Math.min(a.akhir + 60, batasEkor));
      const berkala = POLA_BERKALA.test(sesudah) || /(?:setiap|tiap|per)\s?bulan\W*(?:\w+\W+){0,2}$/i.test(sela);

      if (posSebelum && !jenisSela) {
        if (POLA_PENJUMLAH.test(sela) || (posSebelum.berkala && !berkala)) {
          // "Rp1.000.000 per bulan ... sehingga berjumlah Rp3.000.000" -
          // angka kedua jumlah sesungguhnya, dan ia SEKALIGUS, bukan bulanan.
          // Kecuali nafkah anak: "Rp1.000.000 per anak setiap bulan sehingga
          // berjumlah Rp2.000.000 secara berkelanjutan" - jumlahnya tetap
          // bulanan, hanya untuk seluruh anak (terukur).
          posSebelum.jumlah = a.nilai;
          if (posSebelum.jenis !== "anak") posSebelum.berkala = false;
          posSebelum.ragu = a.ragu;
          posSebelum.catatan = a.catatan;
        }
        // Selain itu angka keterangan (kenaikan, pilihan) - diabaikan.
        akhirSebelum = a.akhir;
        continue;
      }

      let jenis = jenisSela || jenisTerdekat(teks, a.mulai) || jenisTerdekat(konteks);
      if (!jenis) {
        // Angka tanpa jenis: pembebanan lain HANYA bila kalimatnya menghukum
        // membayar DAN uangnya untuk istri atau dikaitkan dengan ikrar
        // ("uang tunai Rp110.000 diserahkan dalam sidang pengucapan ikrar",
        // "biaya transportasi Penggugat Rekonvensi"). Rujukan/jumlah ulang
        // ("dengan jumlah keseluruhan Rp14.500.000") bukan pos baru, dan
        // harta/utang bersama bukan beban ikrar.
        const gabung = `${konteks} ${teks}`;
        const untukIstri = /kepada\s+(?:Termohon|Penggugat)|melalui\s+(?:Termohon|Penggugat)|Penggugat\s+Rek[oa]n[vp]ensi/i.test(
          tanpaNama(gabung)
        );
        if (
          !adaHukum ||
          POLA_RUJUKAN.test(teks) ||
          POLA_BUKAN_BEBAN_IKRAR.test(gabung) ||
          !(POLA_IKRAR.test(gabung) || untukIstri)
        ) {
          akhirSebelum = a.akhir;
          continue;
        }
        jenis = "lainnya";
      }
      let berkalaPos = berkala;
      if (jenis === "anak") {
        // Nafkah anak hampir selalu bulanan, dan frasa bulanannya kerap jauh
        // dari angkanya ("setiap bulan sekurang-kurangnya sejumlah Rp...",
        // "berkelanjutan"). Dibaca dari seluruh kalimat - kecuali pembayaran
        // "1 (satu) bulan pertama ... sesaat sebelum ikrar", yang sekaligus.
        //
        // "Rp3.000.000 setiap bulan ..., yang pembayaran bulan pertamanya
        // diserahkan sesaat sebelum ikrar" tetap BULANAN (terukur) - hanya
        // kalimat bulan-pertama TANPA frasa bulanan yang sekaligus.
        const frasaBulanan = /(?:setiap|tiap|per)\s?bulan|\/\s?bulan|berkelanjutan/i.test(teks);
        berkalaPos = frasaBulanan || (berkala && !/bulan pertama/i.test(teks));
        // Nafkah anak yang tidak menyebut periodenya tetapi jelas berulang
        // ("dengan kenaikan 10% setiap tahunnya", "sampai anak dewasa") -
        // terukur 196/Pdt.G/2026. Dianggap bulanan, tetapi DITANDAI ragu:
        // amarnya sendiri tidak berkata "per bulan".
        if (
          !berkalaPos &&
          !/bulan pertama/i.test(teks) &&
          /kenaikan|setiap tahun|dewasa|21 tahun|berdiri sendiri|mandiri/i.test(teks)
        ) {
          berkalaPos = true;
          a.ragu = true;
          a.catatan = a.catatan || "amar tidak menyebut periodenya; dibaca bulanan karena nafkahnya berulang sampai anak dewasa";
        }
        // Uang untuk anak yang BUKAN nafkah/pemeliharaan dan bukan bulanan
        // (biaya aqiqah, biaya pernikahan anak) - pembebanan lain, sekaligus.
        if (!berkalaPos && !/nafkah|pemelihara|hadh?[oa]nah|hadlanah|biaya hidup|pendidikan/i.test(teks)) {
          jenis = "lainnya";
        }
      }
      const satu = {
        jenis,
        jumlah: a.nilai,
        berkala: berkalaPos,
        penerima: penerimaDari(`${konteks} ${teks}`, jenis),
        keterangan: "",
        kalimat: ringkasKalimat(teks),
        ragu: a.ragu,
        catatan: a.catatan,
      };
      pos.push(satu);
      posSebelum = satu;
      akhirSebelum = a.akhir;
    }
  }

  // Satu pos dapat tertulis dua kali: "Menetapkan nafkah iddah Rp X" lalu
  // "Menghukum ... membayar nafkah iddah Rp X sesaat sebelum ikrar" (terukur).
  // Yang sama jenis, jumlah, dan sifat berkalanya dihitung sekali.
  const unik = [];
  for (const p of pos) {
    const kembar = unik.find(
      (u) =>
        u.jenis === p.jenis &&
        u.berkala === p.berkala &&
        // Pos tanpa angka sejenis dianggap kembar walau ejaan barangnya
        // berbeda: "Menetapkan mut'ah berupa cincin emas 2 gram" lalu
        // "Menghukum ... mut'ah berupa cincin emas seberat 2 gram ... sesaat
        // sebelum ikrar" (terukur 344/Pdt.G/2019) adalah satu mut'ah.
        u.jumlah === p.jumlah
    );
    if (kembar) {
      // Kalimat yang menyebut ikrar lebih berguna sebagai sumber.
      if (POLA_IKRAR.test(p.kalimat) && !POLA_IKRAR.test(kembar.kalimat)) kembar.kalimat = p.kalimat;
      if (!kembar.penerima && p.penerima) kembar.penerima = p.penerima;
      continue;
    }
    unik.push(p);
  }
  const akhir = unik.filter(
    (p) => p.jumlah !== null || !unik.some((u) => u !== p && u.jenis === p.jenis && u.jumlah !== null && p.jenis !== "mutah")
  );
  // Di atas: pos tanpa angka yang jenisnya sudah punya pos berangka gugur -
  // sudah diwakili. KECUALI mut'ah: mut'ah berupa barang di samping mut'ah
  // uang memang dapat dibebankan bersama (terukur).
  akhir.sort((a, b) => URUTAN_JENIS.indexOf(a.jenis) - URUTAN_JENIS.indexOf(b.jenis));
  // Sebutan istri yang paling sering disebut pos lain - pengisi pos yang
  // kalimatnya tidak menyebut penerima.
  const hitungIstri = new Map();
  for (const p of akhir) if (p.penerima) hitungIstri.set(p.penerima, (hitungIstri.get(p.penerima) || 0) + 1);
  const istriUmum = [...hitungIstri].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  for (const p of akhir) {
    p.sebutan = SEBUTAN_JENIS[p.jenis] || p.jenis;
    p.penerima = sebutanPenerima(p.penerima || istriUmum, p.jenis);
  }

  const totalSekaligus = akhir.filter((p) => !p.berkala && p.jumlah !== null).reduce((s, p) => s + p.jumlah, 0);
  const berkalaPerBulan = akhir.filter((p) => p.berkala && p.jumlah !== null).reduce((s, p) => s + p.jumlah, 0);

  // Amar yang MENYEBUT pembebanan (kata kunci + kata kerja menghukum) tetapi
  // tidak menghasilkan satu pos pun - dilaporkan, bukan dianggap kosong.
  const teksPenuh = potongan.map((p) => p.teks).join(" ; ");
  const menyebut =
    /menghukum[^;]{0,200}(mut'?\s?ah\b|\biddah\b|madl|madh|lampau|nafkah[^;]{0,60}anak|kiswah|maskan|mahar)/i.test(
      tanpaNama(teksPenuh)
    );

  return {
    pos: akhir.map((p) => ({
      jenis: p.jenis,
      sebutan: p.sebutan,
      jumlah: p.jumlah,
      berkala: p.berkala,
      penerima: p.penerima,
      keterangan: p.keterangan,
      kalimat: p.kalimat,
      ragu: p.ragu,
      catatan: p.catatan,
    })),
    totalSekaligus,
    berkalaPerBulan,
    adaTanpaAngka: akhir.some((p) => p.jumlah === null),
    adaRagu: akhir.some((p) => p.ragu),
    // "sesaat SETELAH sidang pengucapan ikrar" (terukur) bukan syarat ikrar.
    sebelumIkrar: Boolean(waktuBayar) && !/(?:setelah|sesudah)[^;]{0,100}ikrar/i.test(waktuBayar),
    waktuBayar,
    tidakTerbaca: akhir.length === 0 && menyebut,
  };
}

/** Ada tidaknya sesuatu yang layak ditandai. */
function adaPembebanan(hasil) {
  return Boolean(hasil && (hasil.pos.length > 0 || hasil.tidakTerbaca));
}

module.exports = {
  uraiPembebanan,
  adaPembebanan,
  terbilangKeAngka,
  angkaRupiah,
  potongAmar,
  SEBUTAN_JENIS,
};
