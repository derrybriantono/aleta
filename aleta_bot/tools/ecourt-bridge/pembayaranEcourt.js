"use strict";

/**
 * ============================================================================
 * PEMBAYARAN (e-PAYMENT) DAN e-SKUM DARI HALAMAN DETIL PENDAFTARAN e-COURT (3 Nov 2026)
 * ============================================================================
 *
 * Permintaan Derry (kasir 3 Nov): nomor rekening pengguna (biasanya Penggugat/Pemohon atau kuasanya)
 * tampil di data pihak Status Perkara dan di kartu Kasir ALETA, dan e-SKUM e-Court dapat dicetak dari
 * Kasir ALETA tanpa kolom JUMLAH terpotong.
 *
 * Sumbernya halaman yang SUDAH dibuka jembatan e-Court untuk tiap perkara (view_detil_pendaftaran):
 * bagian "Pembayaran (e-Payment)" - "Diterima Dari <nama> [Nomor Rekening Pengguna :..] [A.n :..]
 * [Pada Bank :..]", Nomor Pendaftaran Online, Nomor Pembayaran, Panjar Perkara, Status, Tanggal, Jam -
 * dan kotak "Lihat SKUM" (SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK). Tidak ada login, tidak ada aksi
 * yang menulis ke e-Court.
 *
 * Dibaca dari TEKS halaman (bukan susunan tag), karena e-Court dapat mengganti tabel menjadi div tanpa
 * mengubah labelnya. Fungsi murni: HTML masuk, data keluar; diuji tanpa peramban
 * (manajemen_surat/src/test/kasir-rekening-skum-3nov.test.ts, HTML REKAAN - tanpa data pihak nyata).
 */

const BULAN = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function entitas(teks) {
  return String(teks || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** HTML -> baris teks (blok dan sel menjadi baris/pemisah), spasi dirapikan. */
function teksBerbaris(html) {
  const t = entitas(
    String(html || "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|table|thead|tbody|section)>/gi, "\n")
      .replace(/<\/(td|th)>/gi, "\t")
      .replace(/<[^>]+>/g, " ")
  );
  return t
    .split("\n")
    .map((b) => b.replace(/[  ]+/g, " ").replace(/\s*\t\s*/g, "\t").replace(/^\t+|\t+$/g, "").trim())
    .filter(Boolean);
}

function rapi(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/** "Rp. 355,000.00" | "30.000,00" | "355.000" -> 355000 (rupiah bulat); null bila tidak ada angka. */
function angkaRupiah(teks) {
  let t = String(teks || "").replace(/rp\.?/gi, "").replace(/[^\d.,]/g, "");
  if (!/\d/.test(t)) return null;
  // Pemisah desimal = tanda terakhir yang diikuti tepat dua angka di akhir.
  const desimal = t.match(/[.,](\d{2})$/);
  if (desimal && /[.,]/.test(t.slice(0, -3))) t = t.slice(0, -3);
  else if (desimal && t.length <= 6 && !/^\d{1,3}[.,]\d{3}$/.test(t)) t = t.slice(0, -3);
  const n = Number(t.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "B N I" -> "BNI"; "Bank Rakyat Indonesia" tetap. */
function rapiBank(teks) {
  const t = rapi(teks).replace(/^bank\s*:?\s*/i, "");
  if (/^([A-Za-z]\s)+[A-Za-z]$/.test(t)) return t.replace(/\s/g, "").toUpperCase();
  return t;
}

/** "Kamis, 14 Mei 2026" -> "2026-05-14". */
function tanggalIso(teks) {
  const m = rapi(teks).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) {
    const n = rapi(teks).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    return n ? `${n[3]}-${n[2].padStart(2, "0")}-${n[1].padStart(2, "0")}` : "";
  }
  const b = BULAN[m[2].toLowerCase()];
  return b ? `${m[3]}-${String(b).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

/** Potongan teks antara judul bagian dan judul bagian berikutnya. */
function potongBagian(baris, awalPola, akhirPola) {
  const i = baris.findIndex((b) => awalPola.test(b));
  if (i === -1) return [];
  const sisa = baris.slice(i + 1);
  const j = sisa.findIndex((b) => akhirPola.test(b));
  return j === -1 ? sisa.slice(0, 40) : sisa.slice(0, j);
}

const LABEL_BAYAR = [
  ["diterimaDari", /^Diterima\s+Dari\b/i],
  ["nomorPendaftaranOnline", /^Nomor\s+Pendaftaran\s+Online\b/i],
  ["nomorPembayaran", /^Nomor\s+Pembayaran\b/i],
  ["panjar", /^Panjar\s+Perkara\b/i],
  ["status", /^Status\s+Pembayaran\b/i],
  ["tanggal", /^Tanggal\s+Pembayaran\b/i],
  ["jam", /^Jam\s+Pembayaran\b/i],
];

/**
 * Bagian "Pembayaran (e-Payment)". null bila bagian itu tidak ada di halaman.
 * @returns {null | {
 *   diterimaDari: string, nomorRekening: string, atasNama: string, bank: string,
 *   nomorPendaftaranOnline: string, nomorPembayaran: string, panjar: number|null,
 *   status: string, tanggal: string, jam: string }}
 */
function extractPembayaranEcourt(html) {
  const baris = teksBerbaris(html);
  const bagian = potongBagian(baris, /^Pembayaran\s*\(\s*e-?Payment\s*\)/i, /^(Tambah\s+Panjar|Persetujuan\s+Pihak|Data\s+Pihak|Riwayat)\b/i);
  if (!bagian.length) return null;
  // Satukan menjadi "label\tnilai" per label; nilai boleh berlanjut ke baris berikut sampai label lain.
  const nilai = {};
  let kunci = "";
  for (const b of bagian) {
    const cocok = LABEL_BAYAR.find(([, pola]) => pola.test(b));
    if (cocok) {
      kunci = cocok[0];
      nilai[kunci] = rapi(b.replace(cocok[1], "").replace(/^[\t :]+/, ""));
    } else if (kunci) {
      nilai[kunci] = rapi(`${nilai[kunci]} ${b.replace(/\t/g, " ")}`);
    }
  }
  const dari = String(nilai.diterimaDari || "");
  const rekening = (dari.match(/Nomor\s+Rekening(?:\s+Pengguna)?\s*:\s*([\d][\d\s.-]*\d|\d)/i) || [])[1] || "";
  const atasNama = (dari.match(/A\.?\s*n\.?\s*:\s*([^\]\[]+)/i) || [])[1] || "";
  const bank = (dari.match(/Pada\s+Bank\s*:\s*([^\]\[]+)/i) || [])[1] || "";
  const hasil = {
    diterimaDari: rapi(dari.split("[")[0]),
    nomorRekening: rekening.replace(/[\s.-]/g, ""),
    atasNama: rapi(atasNama),
    bank: rapiBank(bank),
    nomorPendaftaranOnline: rapi(nilai.nomorPendaftaranOnline).split(" ")[0] || "",
    nomorPembayaran: rapi(nilai.nomorPembayaran).replace(/\s/g, ""),
    panjar: angkaRupiah(String(nilai.panjar || "").replace(/Lihat\s+SKUM.*/i, "")),
    status: rapi(nilai.status),
    tanggal: tanggalIso(nilai.tanggal),
    jam: (rapi(nilai.jam).match(/\d{1,2}[:.]\d{2}(?:[:.]\d{2})?/) || [""])[0].replace(/\./g, ":"),
  };
  const ada = hasil.diterimaDari || hasil.nomorRekening || hasil.nomorPembayaran || hasil.panjar !== null;
  return ada ? hasil : null;
}

/**
 * Isi e-SKUM (SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK) bila ada di HTML (kotak "Lihat SKUM" di halaman
 * yang sama, atau jawaban alamat SKUM-nya). null bila tidak ada.
 * @returns {null | { kop: string[], judul: string, nama: string, alamat: string, telp: string,
 *   pengantar: string, rincian: {no: number, uraian: string, jumlah: number|null}[], total: number|null,
 *   kodePendaftaran: string }}
 */
function extractSkumEcourt(html) {
  const baris = teksBerbaris(html);
  const iJudul = baris.findIndex((b) => /SURAT\s+KUASA\s+UNTUK\s+MEMBAYAR/i.test(b));
  if (iJudul === -1) return null;
  // Kop: sampai tiga baris tepat di atas judul (nama pengadilan, alamat, telepon) - tombol "Cetak" dibuang.
  const kop = [];
  for (let i = iJudul - 1; i >= 0 && kop.length < 3; i -= 1) {
    const b = rapi(baris[i].replace(/\t/g, " "));
    if (!b || /^(Cetak|Print|×|x|Tutup|Close)$/i.test(b)) continue;
    kop.unshift(b);
    if (/^PENGADILAN\b/i.test(b)) break;
  }
  const isi = baris.slice(iJudul + 1, iJudul + 80);
  const ambil = (pola) => {
    const b = isi.find((x) => pola.test(x));
    return b ? rapi(b.replace(pola, "").replace(/^[\t :]+/, "")) : "";
  };
  const rincian = [];
  let total = null;
  let pengantar = "";
  for (let k = 0; k < isi.length; k += 1) {
    const b = isi[k];
    if (/^Membayar\b/i.test(b)) pengantar = rapi(`${b} ${/^[a-z]/.test(isi[k + 1] || "") ? isi[k + 1] : ""}`);
    const t = /Total\s+yang\s+harus/i.test(b);
    if (t) {
      const sisa = rapi(b.replace(/^[\s\S]*?\(Rp\.?\)/i, "").replace(/\t/g, " ")) || rapi(isi[k + 1] || "");
      total = angkaRupiah(sisa);
      continue;
    }
    const m = b.match(/^(\d{1,2})\s*[.)]\s*([^\t]+?)\s*(?:\t\s*)?(?:Rp\.?\s*)?(?:\t\s*)?([\d.,]+)\s*$/i);
    if (m) rincian.push({ no: Number(m[1]), uraian: rapi(m[2].replace(/\s*Rp\.?$/i, "")), jumlah: angkaRupiah(m[3]) });
  }
  const kode = (String(html).match(/\b(PA\.[A-Z]{2,5}-\d{6,10}[A-Z]{0,4}\d{0,3})\b/) || [])[1] || "";
  return {
    kop,
    judul: rapi(baris[iJudul].replace(/\t/g, " ")),
    nama: ambil(/^Nama\b/i),
    alamat: ambil(/^Alamat\b/i),
    telp: ambil(/^Telp(?:\/HP)?\b|^Telepon\b|^HP\b/i),
    pengantar,
    rincian,
    total: total !== null ? total : rincian.length ? rincian.reduce((a, r) => a + (r.jumlah || 0), 0) : null,
    kodePendaftaran: kode,
  };
}

/**
 * Alamat isi SKUM bila kotak "Lihat SKUM" dimuat dari alamat lain (href / data-url / onclick).
 * Hanya alamat yang memuat "skum"; diperiksa diDalamEcourt oleh pemanggil.
 */
function alamatSkumEcourt(html, absolut) {
  const teks = String(html || "");
  const pola = /(?:href|data-url|data-href|data-remote|onclick)\s*=\s*["']([^"']*skum[^"']*)["']/gi;
  let m;
  while ((m = pola.exec(teks))) {
    const mentah = m[1];
    const dalam = mentah.match(/['"(]\s*((?:https?:\/\/|\/)[^'")\s]*skum[^'")\s]*)/i);
    const calon = dalam ? dalam[1] : mentah;
    if (/^javascript:|^#/i.test(calon)) continue;
    if (!/^(https?:\/\/|\/|[A-Za-z0-9_-]+\/)/.test(calon)) continue;
    return typeof absolut === "function" ? absolut(calon) : calon;
  }
  return "";
}

module.exports = {
  alamatSkumEcourt,
  angkaRupiah,
  extractPembayaranEcourt,
  extractSkumEcourt,
  rapiBank,
  tanggalIso,
  teksBerbaris,
};
