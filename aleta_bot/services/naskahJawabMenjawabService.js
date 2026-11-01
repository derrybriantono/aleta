"use strict";

/**
 * ============================================================================
 * JAWAB-REPLIK (31 Okt 2026) - NASKAH UTUH JAWAB-MENJAWAB UNTUK ISIAN BLANGKO DERRY
 * ============================================================================
 *
 * Permintaan pengguna 31 Okt: isian Blangko ABT by Derry Briantono untuk jawaban (serta gugatan rekonvensi), replik (serta
 * jawaban rekonvensi), duplik (serta replik rekonvensi), duplik rekonvensi, kesimpulan Penggugat/Pemohon dan kesimpulan
 * Tergugat/Termohon - TERISI OTOMATIS dari dokumen e-Court, dapat disunting, dan bentuknya sudah benar (Enter = paragraf,
 * penomoran dan sub-judul rapi).
 *
 * Berkas ini MURNI (tanpa basis data, jaringan, ABT, SIPP). Masukan = teks dokumen yang dibaca portal dari arsip e-Court
 * (PDF berlapis teks: baris terpotong, "\f" antarhalaman, nomor halaman dan kepala berulang ikut terbaca). Keluaran = teks
 * POLOS satu paragraf per baris, yang dicetak ABT lewat fungsi isian_rtf_butir (inden gantung menurut penanda butir) -
 * lihat paket abt-paket/jawab-replik-31okt.
 *
 * ATURAN BENTUK (diuji jawab-replik-31okt.test.ts dan teks-pihak-1nov.test.ts):
 *   1. baris PDF yang terpotong disambung jadi paragraf utuh; kata terpenggal "pem-/bayaran" disambung; nomor butir yang
 *      terbaca sendirian ("1." lalu isinya di baris berikut) disatukan (J.barisSurat). Ini pemulihan tata letak PDF, bukan
 *      perubahan isi;
 *   2. kop/kepala surat, salam pembuka ("Dengan hormat", "Yth."), identitas pihak, nomor halaman, kepala berulang, penutup
 *      ("Demikian ...", "Hormat kami"), tempat-tanggal, dan blok tanda tangan dibuang; isi tidak dikarang;
 *   3. KEPUTUSAN 55 (1 Nov 2026, menggantikan perapian 31 Okt): isi surat disalin APA ADANYA. TIDAK diubah, dirapikan, atau dibetulkan:
 *      salah ketik, huruf besar/kecil, ejaan, ";" (tengah maupun ujung), "...", penanda butir ("1 ." tetap "1 ."), sub-judul
 *      ("DALAM POKOK PERKARA" tetap), sebutan pihak ("Penggugat/Pemohon", "Rekonpensi"), kata ganti orang pertama (saya/kami),
 *      kata berulang, petitum tanpa nomor. Satu-satunya yang berubah: baris kosong/Enter (satu paragraf = satu baris), spasi ganda,
 *      dan huruf yang tidak dapat disimpan kolom latin1 ABT (kutip/garis lengkung, titik tiga) - lihat TJ.amankan, selalu dicatat;
 *   4. sub-judul dikenali (untuk memisah rekonvensi dan menandai awal isi) tetapi dicetak persis seperti di surat;
 *   5. bagian rekonvensi (sub-judul "Dalam Rekonvensi" sebelum petitum) DIPISAH ke isiannya sendiri, sampai akhir surat
 *      (petitum ikut di bagian itu supaya urutan surat tetap bila keduanya dicetak berurutan). Tidak ada sub-judul tambahan.
 *   6. KEPUTUSAN 56: dua berkas atau lebih untuk bagian yang sama -> usulan "ragu" (saran) yang memuat SEMUA berkas di `pilihan`
 *      (yang terakhir diunggah paling atas = bawaan); satu berkas = perilaku biasa tanpa klik tambahan.
 */

const T = require("./tuntutanDeteksiService");
const J = require("./jawabMenjawabEcourtService");
const TJ = require("./tanyaJawabEcourtService");

/** Variabel ABT data_teks (blok 12020-12049, paket jawab-replik-31okt). Isinya teks polos berparagraf. */
const KODE = Object.freeze({
  jawaban: "12020",
  gugatanRekonvensi: "12021",
  replik: "12022",
  jawabanRekonvensi: "12023",
  duplik: "12024",
  replikRekonvensi: "12025",
  duplikRekonvensi: "12026",
  kesimpulanLawan: "12027",
  kesimpulanPelaku: "12028",
});
/** Kode isian berparagraf: TIDAK dirapikan menjadi satu baris saat disimpan (ekstensi: isi-sipp-bersama.js KODE_NASKAH_BERBARIS). */
const KODE_BERBARIS = Object.freeze(Object.values(KODE));
/**
 * Keputusan 55 (1 Nov 2026): isian yang berisi SALINAN teks para pihak - disimpan apa adanya (tanpa aturan rapi isian 30 Okt).
 * Sama dengan KODE_TEKS_PIHAK di ekstensi-sipp/isi-sipp-bersama.js (uji teks-pihak-1nov menjaganya).
 */
const KODE_TEKS_PIHAK_ISIAN = Object.freeze([...KODE_BERBARIS, "8436", "8437", "9355", "9491", "9681", "9164"]);

const BATAS_MIN = 150;
const BATAS_MAKS = 60000;

// ─── Sub-judul ───────────────────────────────────────────────────────────────

const AWALAN_JUDUL = String.raw`(?:(?:[IVX]{1,4}|[A-H]|\d{1,2})\s*[.)]\s*)?`;
const DAFTAR_JUDUL = [
  [/^(?:dalam\s+)?konvensi\s+(?:dan|&)\s+rekon[pv]ensi$/i, "Dalam Konvensi dan Rekonvensi"],
  [/^(?:dalam\s+)?(?:gugatan\s+)?rekon[pv]ensi$/i, "Dalam Rekonvensi"],
  [/^(?:dalam\s+)?konvensi$/i, "Dalam Konvensi"],
  [/^(?:dalam\s+)?eksepsi$/i, "Dalam Eksepsi"],
  [/^(?:dalam\s+)?pokok\s+perkara$/i, "Dalam Pokok Perkara"],
  [/^(?:dalam\s+)?provisi$/i, "Dalam Provisi"],
  [/^(?:primair|primer)$/i, "Primair:"],
  [/^(?:lebih\s+)?(?:subsidair|subsider)$/i, null],
  [/^petitum$/i, "Petitum:"],
];
const RE_AWALAN_JUDUL = new RegExp(`^${AWALAN_JUDUL}`);

/** Baris/paragraf yang seluruhnya sub-judul -> bentuk bakunya; null bila bukan. */
function judulBaku(teks) {
  const asli = String(teks || "").replace(/\s+/g, " ").trim();
  if (!asli || asli.length > 60) return null;
  const inti = asli.replace(RE_AWALAN_JUDUL, "").replace(/[\s:;.,-]+$/, "").trim();
  if (!inti) return null;
  for (const [re, baku] of DAFTAR_JUDUL) {
    if (!re.test(inti)) continue;
    if (baku) return baku;
    return /^lebih/i.test(inti) ? "Lebih Subsidair:" : "Subsidair:";
  }
  return null;
}

// ─── Penanda butir ───────────────────────────────────────────────────────────

// Penanda di awal paragraf: 1. 1) (1) a. a) (a) I. A. - • * (bulatan sudah diganti "- " oleh J.rapikanBarisHalaman).
const RE_PENANDA = /^(?:\(\d{1,2}\)|\([a-z]\)|\d{1,2}(?:\.\d{1,2})*\s*[.)]|[a-z]\s*[.)]|[IVX]{1,4}\s*\.|[A-H]\s*[.)]|[-•–—*])(?=\s|[A-Z(])/;
function adaPenanda(t) {
  return RE_PENANDA.test(String(t || ""));
}
/** "1 ." -> "1.", "1.Bahwa" -> "1. Bahwa", "a )" -> "a)", "•"/"–"/"*" -> "-". */
function rapikanPenanda(t) {
  const s = String(t || "");
  const m = RE_PENANDA.exec(s);
  if (!m) return s;
  let p = m[0].replace(/\s+/g, "");
  if (/^[-•–—*]$/.test(p)) p = "-";
  const sisa = s.slice(m[0].length).replace(/^\s+/, "");
  return sisa ? `${p} ${sisa}` : p;
}
/** Penanda dan isi: { penanda, isi } ("" bila tanpa penanda). */
function pisahPenanda(t) {
  const s = String(t || "");
  const m = RE_PENANDA.exec(s);
  if (!m) return { penanda: "", isi: s };
  return { penanda: rapikanPenanda(m[0]).trim(), isi: s.slice(m[0].length).replace(/^\s+/, "") };
}

// ─── Baris -> paragraf ───────────────────────────────────────────────────────

const RE_PEMBUKA = /^(?:Berdasarkan|Demikian|Hormat|Wassalam|Wabillah|Billahi|Oleh\s+karena|Dengan\s+demikian|Maka\b|Mohon|Memohon|Selanjutnya|Sehubungan|Untuk\s+itu|Atau\b|Apabila\b|Jika\b|Tertanda|Atas\s+(?:perhatian|kebijaksanaan)|Terima\s+kasih)/;
const RE_BAHWA = /^(?:bahwa|BAHWA|Bahwa)\b/;

/**
 * Baris (sudah tanpa nomor halaman / kepala berulang) -> paragraf. Paragraf baru dimulai pada: baris kosong asli, sub-judul,
 * penanda butir, "Bahwa", atau baris berhuruf besar sesudah baris yang berakhir tanda baca dan pendek (atau sesudah ";"/":").
 */
function susunParagraf(baris) {
  const hasil = [];
  let kini = null;
  let barisAkhir = "";
  const tutup = () => {
    if (kini && kini.teks.trim()) hasil.push({ teks: kini.teks.replace(/\s+/g, " ").trim(), judul: kini.judul || null });
    kini = null;
  };
  const panjang = baris.filter((x) => x && x.length > 40).map((x) => x.length).sort((a, b) => a - b);
  const lebar = panjang.length >= 4 ? panjang[Math.floor(panjang.length * 0.9)] : 0;
  for (const l0 of baris) {
    const l = String(l0 || "").trim();
    if (!l) {
      tutup();
      continue;
    }
    const jd = judulBaku(l);
    if (jd) {
      tutup();
      // Keputusan 55: teks sub-judul PERSIS seperti di surat; bentuk bakunya (jd) hanya penanda untuk logika pemisahan.
      hasil.push({ teks: l, judul: jd });
      barisAkhir = l;
      continue;
    }
    let baru = !kini || adaPenanda(l) || RE_BAHWA.test(l);
    if (!baru && /[.;:!?)]$/.test(barisAkhir) && /^[A-Z"(]/.test(l)) {
      const pendek = lebar > 0 && barisAkhir.length < lebar * 0.8;
      if (pendek || RE_PEMBUKA.test(l) || /[;:]$/.test(barisAkhir)) baru = true;
    }
    if (baru) {
      tutup();
      kini = { teks: l, judul: null };
    } else if (/[a-z]-$/.test(kini.teks) && /^[a-z]/.test(l)) {
      // Kata terpenggal di batas halaman ("ke-" / "butuhan"); kata ulang ("anak-" / "anak") tetap bertanda hubung.
      const depan = ((/([A-Za-z]+)-$/.exec(kini.teks) || [])[1] || "").toLowerCase();
      const belakang = (/^([a-z]+)/.exec(l) || [])[1] || "";
      const ulang = depan.length >= 2 && (belakang.startsWith(depan) || depan.startsWith(belakang));
      kini.teks = ulang ? `${kini.teks}${l}` : `${kini.teks.slice(0, -1)}${l}`;
    } else {
      kini.teks += ` ${l}`;
    }
    barisAkhir = l;
  }
  tutup();
  return hasil;
}

// ─── Awal dan akhir isi ──────────────────────────────────────────────────────

const RE_PENUTUP = /^(?:demikian\b|hormat\s+(?:kami|saya)\b|wassalam|wabillah|billahi|dibuat\s+(?:di|oleh)\b|tertanda\b|atas\s+(?:perhatian|kebijaksanaan)|terima\s+kasih|tembusan\b)/i;
/**
 * Arahan pengguna 31 Okt: yang diambil HANYA dalil (posita/uraian + sub-judulnya) dan petitum. Kalimat identitas pihak/kuasa dan kalimat
 * pengantar dibuang di mana pun letaknya (juga sesudah sub-judul pertama).
 */
const RE_IDENTITAS_KALIMAT = /^(?:(?:kami|saya)\s+)?yang\s+bertanda\s+tangan\b|\bdalam\s+hal\s+ini\s+(?:memberi(?:kan)?\s+kuasa|diwakili|bertindak)\b|\bberdasarkan\s+surat\s+kuasa\s+khusus\b[^.]{0,200}\b(?:bertindak|mewakili|untuk\s+dan\s+atas\s+nama)\b|^selanjutnya\s+disebut\s+(?:sebagai\s+)?(?:penggugat|tergugat|pemohon|termohon)\b/i;
const RE_PENGANTAR = /^(?:dengan\s+ini|bersama\s+ini|perkenankanlah|izinkanlah|perkenankan|melalui\s+surat\s+ini|pada\s+kesempatan\s+ini)\b[^.]{0,260}\b(?:mengajukan|menyampaikan|memberikan)\b[^.]{0,200}(?:sebagai\s+berikut|berikut\s+ini|sebagaimana\s+berikut)\s*[:.]?$|^(?:adapun\s+)?(?:jawaban|replik|duplik|kesimpulan)\b[^.]{0,160}(?:adalah\s+)?sebagai\s+berikut\s*:?$/i;
const RE_ORANG = /\b(?:advokat|pengacara|konsultan\s+hukum|berkantor|beralamat|kewarganegaraan|warga\s+negara|umur\s+\d+\s+tahun|NIK\b|NIP\b|pekerjaan\s*:)/i;
const RE_AMAR = /^(?:Mengabulkan|Menolak|Menyatakan|Menetapkan|Menghukum|Membebankan|Memberi(?:kan)?\s+izin|Menjatuhkan|Memerintahkan|Mengizinkan|Menerima|Menceraikan|Memutuskan|Mewajibkan|Menyerahkan|Membagi|Memutus|Mengesahkan|Membatalkan|Meletakkan|Mengangkat)\b/;
const RE_PEMBUKA_PETITUM = /^(?:\(?\d{1,2}[.)]\s*)?(?:bahwa\s+)?(?:(?:berdasarkan|maka|oleh\s+karena|dengan\s+demikian|untuk\s+itu|sehubungan|atas\s+dasar)\b[^.]{0,260}\b(?:mohon|memohon)\b|(?:mohon|memohon)\b)/i;

function bukanIsi(teks) {
  const t = J.tanpaNomor(teks);
  if (J.RE_IDENTITAS.test(t) || J.RE_SALAM.test(t) || (J.RE_KONTAK.test(teks) && teks.length < 120) || J.RE_TANGGAL_TEMPAT.test(t)) return true;
  // Kalimat identitas/kuasa dan pengantar: hanya bila bukan dalil "Bahwa ..." (dalil boleh menyebut "dalam hal ini bertindak").
  return !/^bahwa\b/i.test(t) && (RE_IDENTITAS_KALIMAT.test(t) || RE_PENGANTAR.test(t));
}

/** Paragraf -> { isi, yakin, dibuang } (kop sebelum isi dan penutup sesudahnya dilepas). */
function potongIsi(par) {
  const dibuang = { kop: 0, penutup: 0, identitas: 0 };
  let awal = par.findIndex((p) => {
    if (p.judul) return /^Dalam\b/.test(p.judul);
    if (bukanIsi(p.teks)) return false;
    const { penanda, isi } = pisahPenanda(p.teks);
    if (/^bahwa\b/i.test(isi) && p.teks.length >= 30) return true;
    // Identitas kuasa/pihak bernomor ("1. Andi, S.H., Advokat, berkantor di ...") bukan awal isi.
    return Boolean(penanda) && p.teks.length >= 40 && !/^(?:yang\s+bertanda|selanjutnya\s+disebut)/i.test(isi) && !RE_ORANG.test(isi);
  });
  let yakin = true;
  if (awal < 0) {
    awal = 0;
    yakin = false;
  }
  dibuang.kop = awal;
  let akhir = par.length;
  for (let i = awal + 1; i < par.length; i += 1) {
    const t = par[i].teks;
    if (!RE_PENUTUP.test(t) && !J.RE_TANGGAL_TEMPAT.test(t)) continue;
    // "Demikian ..., mohon Majelis Hakim memutus: 1. ..." - petitum sesudah kata penutup tetap isi.
    if (/^demikian\b/i.test(t) && /\b(?:mohon|memohon)\b/i.test(t) && par.slice(i + 1, i + 3).some((x) => RE_AMAR.test(pisahPenanda(x.teks).isi))) {
      let j = i + 1;
      while (j < par.length && (par[j].judul || RE_AMAR.test(pisahPenanda(par[j].teks).isi) || /^atau\b|apabila\s+majelis|ex\s+aequo/i.test(par[j].teks))) j += 1;
      akhir = j;
      break;
    }
    akhir = i;
    break;
  }
  dibuang.penutup = par.length - akhir;
  const isi = [];
  for (const p of par.slice(awal, akhir)) {
    if (!p.judul && bukanIsi(p.teks)) {
      dibuang.identitas += 1;
      continue;
    }
    if (!p.judul && p.teks.replace(/[^A-Za-z]/g, "").length < 4) continue;
    isi.push(p);
  }
  // Blok tanda tangan tanpa kata penutup di depannya.
  while (isi.length > 1) {
    const u = isi[isi.length - 1];
    if (u.judul || u.teks.length > 140 || !J.RE_BLOK_TTD.test(u.teks)) break;
    isi.pop();
    dibuang.penutup += 1;
  }
  return { isi, yakin, dibuang };
}

// ─── Petitum ─────────────────────────────────────────────────────────────────

/** Indeks paragraf pembuka petitum ("Berdasarkan ..., mohon ...") atau -1. Hanya untuk MENANDAI letak petitum; teksnya tidak diubah. */
function cariAwalPetitum(par) {
  return par.findIndex((p, i) => i > 0 && !p.judul && RE_PEMBUKA_PETITUM.test(p.teks));
}

// ─── Rakit ───────────────────────────────────────────────────────────────────

/**
 * Teks dokumen -> naskah salinan (keputusan 55: isi surat apa adanya, hanya baris kosong/Enter yang dirapikan).
 * @param {string} teks
 * @param {{peran?:string, sebutan?:{lawan:string, pelaku:string}, penulis?:string, pisahRekonvensi?:boolean}} opsi
 *   sebutan dan penulis diterima agar pemanggil lama tetap jalan, tetapi TIDAK dipakai untuk mengubah isi.
 * @returns {{konvensi:string, rekonvensi:string, yakin:boolean, alasan:string[], catatan:string[], dibuang:object, butir:number}}
 */
function naskahDariSurat(teks, opsi) {
  const o = opsi || {};
  const { baris, dibuang: dibuangBaris } = J.barisSurat(T.rapikanTeks(teks));
  const par = susunParagraf(baris);
  const potong = potongIsi(par);
  const alasan = [];
  const catatan = [];
  if (!potong.yakin) alasan.push("awal isi surat tidak terpisah jelas dari kop");
  // Tiap paragraf disalin apa adanya. TJ.amankan hanya menyeragamkan huruf yang tak dapat disimpan ABT (kutip/garis lengkung, titik tiga).
  let disesuaikan = 0;
  const bersih = [];
  for (const p of potong.isi) {
    if (p.judul) {
      bersih.push(p);
      continue;
    }
    const asli = p.teks.replace(/\s+/g, " ").trim();
    const aman = TJ.amankan(p.teks);
    if (aman !== asli) disesuaikan += 1;
    bersih.push({ teks: aman, judul: null });
  }
  if (disesuaikan) catatan.push(`${disesuaikan} paragraf memuat huruf yang tidak dapat disimpan ABT (kutip/garis lengkung atau titik tiga) - hanya huruf itu yang disesuaikan`);
  const awalPetitum = cariAwalPetitum(bersih);
  // Pisah rekonvensi: sub-judul "Dalam Rekonvensi" SEBELUM petitum.
  let konv = bersih;
  let rekon = [];
  if (o.pisahRekonvensi !== false) {
    const batas = awalPetitum >= 0 ? awalPetitum : bersih.length;
    const r = bersih.findIndex((p, i) => i < batas && p.judul === "Dalam Rekonvensi");
    if (r >= 0) {
      konv = bersih.slice(0, r);
      rekon = bersih.slice(r);
    } else if (bersih.some((p) => p.judul === "Dalam Rekonvensi")) {
      catatan.push("bagian rekonvensi hanya ada di petitum - tidak dipisah");
    }
  }
  const gabung = (xs) => xs.map((p) => p.teks).filter(Boolean).join("\n");
  const konvensi = gabung(konv);
  const rekonvensi = gabung(rekon);
  const isiSaja = [...konv, ...rekon].filter((p) => !p.judul);
  const total = isiSaja.reduce((n, p) => n + p.teks.length, 0);
  if (isiSaja.length < 2) alasan.push("isi surat terlalu sedikit");
  if (total < BATAS_MIN) alasan.push("isi surat terlalu pendek");
  if (total > BATAS_MAKS) alasan.push("isi surat terlalu panjang");
  alasan.push(...TJ.cacatKarakter(isiSaja.map((p) => p.teks).join(" ")));
  const sisa = TJ.sisaKop(isiSaja.slice(-2).map((p) => p.teks), true).filter((a) => !/kop, penutup|nama kuasa/.test(a) || isiSaja.length < 3);
  alasan.push(...sisa);
  return {
    konvensi,
    rekonvensi,
    yakin: alasan.length === 0,
    alasan: [...new Set(alasan)],
    catatan,
    dibuang: { ...dibuangBaris, ...potong.dibuang },
    butir: isiSaja.length,
  };
}

// ─── Usulan isian ────────────────────────────────────────────────────────────

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function tanggalPanjang(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${NAMA_BULAN[Number(m[2]) - 1]} ${m[1]}` : "";
}

/** Peran naskah satu dokumen yang sudah dikenali (J.kenaliJenis) -> tujuan isiannya, atau null. */
function tujuanDokumen(k) {
  if (!k || k.turut) return null;
  if (k.peran === "jawaban" && k.pihak !== "0046") return { jenis: "jawaban", kode: KODE.jawaban, rekon: KODE.gugatanRekonvensi, pihak: "0047" };
  if (k.peran === "replik" && k.pihak !== "0047") return { jenis: "replik", kode: KODE.replik, rekon: KODE.jawabanRekonvensi, pihak: "0046" };
  // Rereplik (jenis e-Court) atau duplik yang diunggah Penggugat/Pemohon = duplik rekonvensi.
  if (k.peran === "duplik" && (k.rekonvensiDuplik || k.pihak === "0046")) return { jenis: "duplik-rekonvensi", kode: KODE.duplikRekonvensi, rekon: "", pihak: "0046" };
  if (k.peran === "duplik") return { jenis: "duplik", kode: KODE.duplik, rekon: KODE.replikRekonvensi, pihak: "0047" };
  if (k.peran === "kesimpulan" && k.pihak === "0046") return { jenis: "kesimpulan", kode: KODE.kesimpulanLawan, rekon: "", pihak: "0046" };
  if (k.peran === "kesimpulan" && k.pihak === "0047") return { jenis: "kesimpulan", kode: KODE.kesimpulanPelaku, rekon: "", pihak: "0047" };
  return null;
}

const NAMA_JENIS = { jawaban: "Jawaban", replik: "Replik", duplik: "Duplik", "duplik-rekonvensi": "Duplik rekonvensi", kesimpulan: "Kesimpulan" };

/**
 * Dokumen e-Court (bentuk saringDokumen isiGugatanService) -> usulan isian 12020-12028.
 * Keyakinan "cukup" (ditulis sendiri ke isian yang KOSONG) hanya bila: jenis berkas pasti (jenis/judul/isi sepakat),
 * pengunggah dikenali, satu-satunya berkas untuk bagian itu, bukan OCR, dan naskahnya rapi; selain itu "ragu" (saran).
 * @param {{dokumen:Array<object>, sebutan:{lawan:string, pelaku:string}}} m
 */
function usulanNaskah(m) {
  const x = m || {};
  const sebutan = x.sebutan || { lawan: "Penggugat", pelaku: "Tergugat" };
  const per = new Map();
  (Array.isArray(x.dokumen) ? x.dokumen : []).forEach((d, indeks) => {
    if (!d || d.peran === "gugatan" || d.peran === "bukti") return;
    const k = J.kenaliJenis(d);
    const tj = tujuanDokumen(k);
    if (!tj) return;
    const daftar = per.get(tj.kode) || [];
    daftar.push({ d, k, tj, indeks });
    per.set(tj.kode, daftar);
  });
  const usulan = [];
  for (const [, daftar] of per) {
    daftar.sort((a, b) => String(a.d.diunggah || "").localeCompare(String(b.d.diunggah || "")) || a.indeks - b.indeks);
    const pilih = daftar[daftar.length - 1];
    const { d, k, tj } = pilih;
    const n = naskahDariSurat(d.teks, { pisahRekonvensi: Boolean(tj.rekon) });
    const ragu = [];
    if (k.ragu) ragu.push(`jenis berkas diragukan${k.catatan && k.catatan[0] ? ` (${k.catatan[0]})` : ""}`);
    if (!k.pihak) ragu.push("pengunggah tidak dikenali");
    if (d.baca === "ocr") ragu.push("dibaca OCR");
    if (daftar.length > 1) ragu.push(`ada ${daftar.length} berkas ${NAMA_JENIS[tj.jenis].toLowerCase()} - dipakai yang terakhir diunggah`);
    ragu.push(...n.alasan);
    const keyakinan = ragu.length ? "ragu" : "cukup";
    const tgl = tanggalPanjang(d.diunggah);
    const siapa = tj.pihak === "0046" ? sebutan.lawan : sebutan.pelaku;
    const asal = `dokumen e-Court "${d.judul}" (${siapa}${tgl ? `, diunggah ${tgl}` : ""})`;
    const ket = `Diisi dari ${asal}. Kop, salam, tanda tangan, dan nomor halaman dibuang; isi surat disalin apa adanya (tidak dirapikan atau dibetulkan, hanya baris kosong yang dibuang) - periksa sebelum dipakai.${ragu.length ? ` Belum diisi sendiri: ${ragu.join("; ")}.` : ""}${n.catatan.length ? ` Catatan: ${n.catatan.join("; ")}.` : ""}`;
    const sumber = [{ asal: "gugatan-ecourt", kalimat: `e-Court: ${d.judul}${tgl ? ` (diunggah ${tgl})` : ""}${d.baca === "ocr" ? " (dibaca OCR)" : ""}` }];
    const dasar = { bentrok: "", jagaIsianLama: true, sumber, kodePola: `naskah-${tj.jenis}`, dokumen: d.judul, diunggah: String(d.diunggah || "") };
    // Keputusan 56: dua berkas atau lebih untuk bagian yang sama -> semua berkas ikut sebagai `pilihan` (terakhir diunggah paling atas = bawaan);
    // panel memberi tahu ada beberapa berkas dan petugas dapat melihat/memilih masing-masing. Satu berkas: tidak ada `pilihan`.
    const banyak = daftar.length > 1;
    const urutBaru = daftar.slice().reverse();
    const naskahDari = (x) => (x === pilih ? n : naskahDariSurat(x.d.teks, { pisahRekonvensi: Boolean(tj.rekon) }));
    const susunPilihan = (ambil) => {
      if (!banyak) return {};
      const daftarPilihan = [];
      urutBaru.forEach((y, i) => {
        const nilai = ambil(naskahDari(y));
        if (!String(nilai || "").trim()) return;
        const t = tanggalPanjang(y.d.diunggah);
        daftarPilihan.push({ keadaan: `${y.d.judul}${t ? `, diunggah ${t}` : ""}${i === 0 ? " (terakhir diunggah, bawaan)" : ""}`, nilai });
      });
      return daftarPilihan.length > 1 ? { pilihan: daftarPilihan, berkasBanyak: daftar.length } : {};
    };
    const ketBanyak = banyak
      ? ` Ada ${daftar.length} berkas ${NAMA_JENIS[tj.jenis].toLowerCase()} di e-Court (${urutBaru.map((y) => `"${y.d.judul}"${tanggalPanjang(y.d.diunggah) ? `, ${tanggalPanjang(y.d.diunggah)}` : ""}`).join("; ")}); yang disarankan adalah yang terakhir diunggah - berkas lain dapat dipilih di kotak pilihan berkas.`
      : "";
    if (n.konvensi) usulan.push({ ...dasar, kode: tj.kode, nama: `${NAMA_JENIS[tj.jenis]} ${siapa} (uraian lengkap)`, nilai: n.konvensi, keyakinan, catatan: ket + ketBanyak, ...susunPilihan((h) => h.konvensi) });
    // Kesimpulan dalam kalimat blangko ("... yang pada pokoknya <frasa>;", isian 8436/8437): frasa "tetap pada ..." dari surat yang
    // sama ditulis sendiri bila suratnya pasti; bentuk lain tetap saran dari jawabMenjawabEcourtService (keputusan sementara 31 Okt).
    if (tj.jenis === "kesimpulan" && keyakinan === "cukup") {
      const kl = J.klausaKesimpulan(J.bersihkanSurat(d.teks));
      if (kl.pola === "kesimpulan-tetap-pada" && kl.klausa) {
        usulan.push({
          ...dasar,
          kode: tj.pihak === "0046" ? "8436" : "8437",
          nama: `Kesimpulan oleh ${siapa}`,
          nilai: TJ.amankan(kl.klausa),
          keyakinan: "cukup",
          kodePola: "kesimpulan-tetap-pada",
          catatan: `Frasa "tetap pada ..." diambil apa adanya dari ${asal} (huruf, ejaan, dan sebutannya tidak diubah) - dicetak sesudah "yang pada pokoknya".`,
        });
      }
    }
    if (tj.rekon && n.rekonvensi) {
      const namaRekon = tj.jenis === "jawaban" ? "Gugatan rekonvensi" : tj.jenis === "replik" ? "Jawaban rekonvensi" : "Replik rekonvensi";
      usulan.push({ ...dasar, kode: tj.rekon, nama: `${namaRekon} ${siapa} (uraian lengkap)`, nilai: n.rekonvensi, keyakinan, catatan: ket + ketBanyak, ...susunPilihan((h) => h.rekonvensi) });
    }
  }
  return usulan.sort((a, b) => Number(a.kode) - Number(b.kode));
}

/** Penyimpanan isian berparagraf (dipakai ekstensi saat menyimpan suntingan): tiap baris dirapatkan, baris kosong dibuang. */
function rapikanSimpanan(teks) {
  return String(teks == null ? "" : teks)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  KODE,
  KODE_BERBARIS,
  KODE_TEKS_PIHAK_ISIAN,
  judulBaku,
  rapikanPenanda,
  pisahPenanda,
  susunParagraf,
  potongIsi,
  cariAwalPetitum,
  naskahDariSurat,
  tujuanDokumen,
  usulanNaskah,
  rapikanSimpanan,
};
