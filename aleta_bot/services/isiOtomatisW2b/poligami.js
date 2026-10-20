"use strict";

/**
 * ============================================================================
 * ISIAN OTOMATIS TAMBAHAN IZIN POLIGAMI (jenis_perkara_id 341) - W2b-A, 21 Okt 2026
 * ============================================================================
 *
 * Melengkapi deteksi/poligami.js (8720-8726, 1152) dengan isian BARU paket ABT
 * abt-w2b-keluarga-lain (variabel 4850-4856). Satu sumber fakta: posita permohonan
 * (variabel 5125) yang sama dengan pembaca lama; tidak ada jalur kedua.
 *
 *   4850 surat persetujuan tertulis istri     posita "surat pernyataan persetujuan ... tanggal ..."
 *   4851 alasan keberatan istri               posita "Termohon keberatan ... karena ..."
 *   4852 keadaan istri tidak mungkin dimintai persetujuan
 *                                             posita "Termohon menderita gangguan jiwa", "tidak ada kabar ...", "tidak diketahui keberadaannya"
 *   4854 status calon istri kedua             blok calon istri: "Status : Perawan", "Status Janda dibuktikan dengan Nomor Akta Cerai"
 *   4855 bukti status janda calon istri       "Nomor Akta Cerai : 152/AC/2025/Pa.Dgl" atau akta/surat keterangan kematian
 *   4856 jumlah istri pemohon saat ini        posita "telah beristri dua orang"
 *
 * Semua usulan berkeyakinan "ragu" (kode baru, belum terukur terhadap isian petugas
 * karena belum ada pembanding: lihat docs/gelombang2/UKURAN-W2b-poligami.json). Naik
 * tingkat hanya lewat berkas usulan gerbang yang disetujui sesi utama.
 *
 * petunjukKeadaan(): petunjuk untuk keadaan borang katalog saksi (sikapIstri, statusCalon, kumulasi harta bersama) - dipakai panel bila ingin
 * menyarankan pilihan; tidak mengisi apa pun. Pekerjaan suami (ASN/TNI/Polri) sengaja TIDAK dibaca dari posita (kata PNS sering milik Termohon): ambil dari data pihak SIPP.
 */

const P = require("../deteksi/pembantuKebendaan");

const variabel = Object.freeze([
  { kode: "4850", nama: "Surat persetujuan tertulis istri", sumber: "posita", blangko: ["putusan"] },
  { kode: "4851", nama: "Alasan keberatan istri", sumber: "posita", blangko: ["putusan"] },
  { kode: "4852", nama: "Keadaan istri tidak mungkin dimintai persetujuan", sumber: "posita", blangko: ["putusan"] },
  { kode: "4854", nama: "Status calon istri kedua", sumber: "posita", blangko: ["putusan"] },
  { kode: "4855", nama: "Bukti status janda calon istri kedua", sumber: "posita", blangko: ["putusan"] },
  { kode: "4856", nama: "Jumlah istri pemohon saat ini", sumber: "posita", blangko: ["putusan"] },
]);

const BAWAH = "ragu";

function potong(t, n) {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}...` : s;
}

/** Blok keterangan calon istri kedua: dari kalimat "hendak menikah lagi" / "calon istri" sampai "Selanjutnya disebut". */
function blokCalon(satu) {
  const m = /(?:hendak|bermaksud|ingin)\s+menikah\s+lagi|calon\s+iste?ri\s+(?:kedua|ke-?2)|Nama\s+(?:calon\s+)?iste?ri\s+(?:kedua|ke-?2)/i.exec(satu);
  if (!m) return "";
  const sisa = satu.slice(m.index);
  const akhir = sisa.search(/Selanjutnya\s+disebut/i);
  return sisa.slice(0, akhir < 0 ? 700 : akhir);
}

/**
 * Status calon istri: perawan | janda cerai | janda ditinggal mati suami | janda (sebab tidak tertulis).
 * @returns {{nilai:string,kalimat:string,jenis:string}|null}
 */
function statusCalon(satu) {
  const blok = blokCalon(satu);
  const pola = [
    /Status(?:\s+perkawinan)?\s*:?\s*(Perawan|Gadis|Janda[^;]{0,120})/i,
    /berstatus\s+(perawan|gadis|janda[^;]{0,80})/i,
    /(?:seorang|adalah)\s+(perawan|gadis|janda(?:\s+(?:cerai|mati|ditinggal[^;,.]{0,30}))?)/i,
  ];
  for (const teks of [blok, satu]) {
    if (!teks) continue;
    for (const p of pola) {
      const m = p.exec(teks);
      if (!m) continue;
      const lingkup = teks.slice(m.index, m.index + 200);
      const kata = m[1];
      if (/janda/i.test(kata)) {
        if (/cerai|bercerai|talak/i.test(lingkup)) return { nilai: "janda cerai", kalimat: potong(lingkup, 160), jenis: "janda-cerai" };
        if (/meninggal|mati|wafat|kematian|ditinggal/i.test(lingkup)) return { nilai: "janda ditinggal mati suami", kalimat: potong(lingkup, 160), jenis: "janda-meninggal" };
        return { nilai: "janda", kalimat: potong(lingkup, 160), jenis: "janda" };
      }
      return { nilai: "perawan", kalimat: potong(lingkup, 160), jenis: "gadis" };
    }
  }
  return null;
}

/** Bukti status janda: nomor akta cerai atau akta/surat keterangan kematian (dan tanggal bila ada tepat di sebelahnya). */
function buktiStatus(satu) {
  const blok = blokCalon(satu) || satu;
  let m = /Akta\s+Cerai\s*(?:Nomor|No\.?)?\s*:?\s*([0-9A-Za-z][0-9A-Za-z./-]{3,40})/i.exec(blok) || /Akta\s+Cerai\s*(?:Nomor|No\.?)?\s*:?\s*([0-9A-Za-z][0-9A-Za-z./-]{3,40})/i.exec(satu);
  if (m) {
    const sesudah = blok.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const tgl = /^\s*(?:,\s*)?(?:tanggal|tgl\.?)\s+(.+)/i.exec(sesudah);
    const tanggal = tgl ? P.tanggalBaku(tgl[1]) : "";
    return { nilai: `Akta Cerai Nomor ${m[1].replace(/[.,;]+$/, "")}${tanggal ? ` tanggal ${tanggal}` : ""}`, kalimat: potong(m[0], 140) };
  }
  m = /(?:Akta|Surat\s+Keterangan)\s+Kematian\s*(?:Nomor|No\.?)?\s*:?\s*([0-9A-Za-z][0-9A-Za-z./-]{3,40})/i.exec(blok) || /(?:Akta|Surat\s+Keterangan)\s+Kematian\s*(?:Nomor|No\.?)?\s*:?\s*([0-9A-Za-z][0-9A-Za-z./-]{3,40})/i.exec(satu);
  if (m) return { nilai: `${/Akta/i.test(m[0]) ? "Akta Kematian" : "Surat Keterangan Kematian"} Nomor ${m[1].replace(/[.,;]+$/, "")}`, kalimat: potong(m[0], 140) };
  return null;
}

const ANGKA = { 1: "seorang", 2: "dua orang", 3: "tiga orang", 4: "empat orang", satu: "seorang", seorang: "seorang", dua: "dua orang", tiga: "tiga orang", empat: "empat orang" };

function jumlahIstri(satu) {
  const m = /(?:telah|sudah|saat\s+ini|sekarang)?\s*(?:beristri|memiliki|mempunyai)\s+(\d{1,2}|satu|seorang|dua|tiga|empat)\s*(?:\([^)]*\)\s*)?(?:orang\s+)?(?:istri|isteri)/i.exec(satu);
  if (!m) return null;
  const k = ANGKA[String(m[1]).toLowerCase()];
  return k ? { nilai: k, kalimat: potong(m[0], 120) } : null;
}

function suratPersetujuan(satu) {
  const m = /surat\s+(?:pernyataan\s+)?(?:persetujuan|kesediaan|izin)\s+(?:dari\s+|dari\s+pihak\s+)?(?:Termohon|istri)[^;]{0,120}|surat\s+persetujuan\s+(?:tertulis\s+)?(?:dari\s+)?(?:Termohon|istri)[^;]{0,120}/i.exec(satu);
  if (!m) return null;
  const tgl = /tanggal\s+(\d{1,2}\s+\S+\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i.exec(m[0]);
  const tanggal = tgl ? P.tanggalBaku(tgl[1]) : "";
  return { nilai: tanggal ? `tanggal ${tanggal}` : "terlampir pada permohonan", kalimat: potong(m[0], 160) };
}

function alasanKeberatan(satu) {
  const m = /Termohon[^;]{0,80}?(?:keberatan|menolak|tidak\s+setuju|tidak\s+rela|tidak\s+menyetujui)[^;]{0,60}?(?:karena|sebab|dengan\s+alasan|disebabkan)\s+([^;]{5,200})/i.exec(satu);
  if (!m) return null;
  return { nilai: potong(m[1].replace(/[\s.]+$/, ""), 200), kalimat: potong(m[0], 220) };
}

const POLA_TIDAK_MUNGKIN = /(?:Termohon|istri\s+pertama)[^;]{0,100}?(menderita\s+(?:gangguan\s+jiwa|sakit\s+jiwa|gila|stroke|lumpuh)[^;]{0,60}|tidak\s+diketahui\s+(?:lagi\s+)?(?:keberadaannya|alamatnya|tempat\s+tinggalnya)[^;]{0,40}|tidak\s+ada\s+kabar[^;]{0,60}|hilang[^;]{0,60}|ghaib[^;]{0,40})/i;

function tidakMungkin(satu) {
  const m = POLA_TIDAK_MUNGKIN.exec(satu);
  if (!m) return null;
  return { nilai: potong(m[1].replace(/[\s.]+$/, ""), 200), kalimat: potong(m[0], 220) };
}

/**
 * Deteksi tambahan. Menerima baris posita (daftar) dan posita satu baris (satu) dari deteksi/poligami.js.
 * @returns {Object<string,{nilai,kalimat,yakin,kodePola,asal?,catatan?}>}
 */
function deteksi(satu) {
  const hasil = {};
  const isi = (kode, r, kodePola, catatan) => {
    if (r && r.nilai) hasil[kode] = { nilai: r.nilai, kalimat: r.kalimat, asal: "posita", yakin: BAWAH, kodePola, catatan: catatan || "" };
  };
  const st = statusCalon(satu);
  isi("4854", st, "w2b-poligami-status-calon", st && st.jenis === "janda" ? "Posita menyebut janda tanpa sebab (cerai atau suami meninggal) - lengkapi." : "");
  isi("4855", buktiStatus(satu), "w2b-poligami-bukti-status");
  isi("4856", jumlahIstri(satu), "w2b-poligami-jumlah-istri");
  isi("4850", suratPersetujuan(satu), "w2b-poligami-surat-setuju");
  isi("4851", alasanKeberatan(satu), "w2b-poligami-alasan-keberatan");
  isi("4852", tidakMungkin(satu), "w2b-poligami-tidak-mungkin");
  return hasil;
}

/** Petunjuk keadaan borang katalog izin-poligami. null = tidak terbaca. */
function petunjukKeadaan(satu, petitum) {
  const hasil = {};
  if (alasanKeberatan(satu)) hasil.sikapIstri = "keberatan";
  else if (tidakMungkin(satu)) hasil.sikapIstri = "tidak-mungkin";
  else if (/Termohon[^;]{0,60}?(?:rela|menyetujui|setuju|tidak\s+keberatan|bersedia\s+dimadu|mengizinkan)/i.test(satu)) hasil.sikapIstri = "setuju";
  const st = statusCalon(satu);
  if (st && st.jenis !== "janda") hasil.statusCalon = st.jenis;
  if (/harta\s+bersama|memperoleh\s+harta/i.test(`${satu} ${petitum || ""}`)) hasil.kumulasi = ["harta-bersama"];
  return hasil;
}

module.exports = {
  kunci: "izin-poligami-w2b",
  jenisPerkaraId: [341],
  variabel,
  deteksi,
  petunjukKeadaan,
  // diuji langsung
  statusCalon,
  buktiStatus,
  jumlahIstri,
  suratPersetujuan,
  alasanKeberatan,
  tidakMungkin,
};
