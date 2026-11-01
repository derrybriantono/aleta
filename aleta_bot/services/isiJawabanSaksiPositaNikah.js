"use strict";

/**
 * ============================================================================
 * FAKTA PERNIKAHAN DARI POSITA ITSBAT (T11 butir 1, 1 Nov 2026)
 * ============================================================================
 *
 * Perluasan pengisi fakta saksi (isiJawabanSaksiPosita.itsbat) - BUKAN pembaca posita kedua. Dipanggil sekali dari
 * itsbat() atas butir posita yang sama, murni aturan (tanpa AI, tanpa jaringan), tanpa kerja berat: satu lintasan
 * regex per butir, hasilnya ikut di-cache oleh pemanggil bersama fakta lain.
 *
 * Yang dibaca: umur dan status (jejaka/perawan/duda/janda) mempelai saat menikah, wali nikah (nama + hubungan), dua saksi
 * nikah, mahar (bentuk + tunai/terutang), tanggal dan tempat akad. Nama disalin apa adanya dari posita.
 * Aturan: yang ragu TIDAK dikeluarkan (butir tetap titik-titik); tidak ada yang ditebak.
 *
 * Hasil: [{ kunci, nilai, yakin: "cukup", ket }] - kunci fakta milik isiJawabanSaksiFakta.js.
 */

const { bersihNilai, tanggalIndo } = require("./isiJawabanSaksiFakta");

// ----------------------------------------------------------------------------
// Bilangan
// ----------------------------------------------------------------------------

const SATUAN = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };

/** "dua puluh lima" -> 25, "tujuh belas" -> 17, "sebelas" -> 11, "30" -> 30; null bila bukan bilangan 1-99. */
function bilangan(teks) {
  const t = String(teks == null ? "" : teks).trim().toLowerCase().replace(/\s+/g, " ");
  if (/^\d{1,3}$/.test(t)) return Number(t);
  if (!t) return null;
  if (t === "sepuluh") return 10;
  if (t === "sebelas") return 11;
  const kata = t.split(" ");
  let n = 0;
  if (kata.length === 2 && kata[1] === "belas" && kata[0] in SATUAN) return 10 + SATUAN[kata[0]];
  if (kata.length === 2 && kata[1] === "puluh" && kata[0] in SATUAN) return SATUAN[kata[0]] * 10;
  if (kata.length === 3 && kata[1] === "puluh" && kata[0] in SATUAN && kata[2] in SATUAN) return SATUAN[kata[0]] * 10 + SATUAN[kata[2]];
  if (kata.length === 1 && kata[0] in SATUAN) return SATUAN[kata[0]];
  if (kata.length === 1 && kata[0] === "seratus") return 100;
  return n > 0 ? n : null;
}

const NUM = "(?:\\d{1,2}|(?:(?:se|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\\s+puluh(?:\\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?|(?:se|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\\s+belas|sebelas|sepuluh|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))";

function umurValid(teks) {
  const n = bilangan(String(teks).replace(/^se(?=puluh)/i, "satu "));
  return n !== null && n >= 10 && n <= 90 ? String(n) : null;
}

// ----------------------------------------------------------------------------
// Nama orang (disalin apa adanya; harus diawali huruf besar)
// ----------------------------------------------------------------------------

const BUKAN_NAMA = /^(?:Pemohon|Termohon|Penggugat|Tergugat|Bahwa|Kantor|Kecamatan|Desa|Kelurahan|KUA|Kabupaten|Kota|Islam|Rp|Saksi|Wali|Dan|Yang|Pada|Dengan|Mas|Mahar|Maskawin|Hari|Tanggal|Ayah|Ibu|Menikah|Pernikahan|Perkawinan|Sebagai|Oleh|Serta|Atau|Karena|Setelah|Sesuai)$/;
const PENGHUBUNG_NAMA = /^(?:bin|binti|bte|bt|alias|als)\.?$/i;

/** Satu nama di awal teks -> { nama, sisa } atau null. Berhenti pada koma, kurung, dan kata biasa. */
function ambilNama(teks) {
  const kata = String(teks || "").replace(/^\s*(?:yang\s+)?(?:bernama\s+)?/i, "").split(/\s+/).filter(Boolean);
  const nama = [];
  let i = 0;
  let koma = false;
  for (; i < kata.length && nama.length < 7; i++) {
    let k = kata[i];
    koma = /[,;]$/.test(k);
    k = k.replace(/[,;]+$/, "");
    if (/^\(/.test(k)) break;
    const kapital = /^[A-Z][A-Za-z'’`.\-]*$/.test(k) && !BUKAN_NAMA.test(k.replace(/\.$/, ""));
    const sambung = nama.length > 0 && PENGHUBUNG_NAMA.test(k) && i + 1 < kata.length && /^[A-Z]/.test(kata[i + 1]);
    if (!kapital && !sambung) {
      koma = false;
      break;
    }
    nama.push(k);
    if (koma) {
      i++;
      break;
    }
    if (/[.]$/.test(k) && k.length > 3 && !/^(?:Dg|Hj|Dr|Drs|Ir|Pak|Bpk|Alm)\.$/i.test(k)) {
      i++;
      break; // titik penutup kalimat
    }
  }
  const hasil = bersihNilai(nama.join(" "));
  if (hasil.length < 3 || hasil.length > 70) return null;
  return { nama: hasil, sisa: kata.slice(i).join(" "), koma };
}

/** Dua nama yang dihubungkan "dan"/"&"/koma di awal teks -> [n1, n2] atau null. */
function duaNama(teks) {
  const a = ambilNama(teks);
  if (!a) return null;
  const m = /^\s*(?:dan|&)\s+(.*)$/i.exec(a.sisa) || (a.koma ? /^(.*)$/.exec(a.sisa) : null);
  if (!m) return null;
  const b = ambilNama(m[1]);
  if (!b || b.nama.toLowerCase() === a.nama.toLowerCase()) return null;
  return [a.nama, b.nama];
}

// ----------------------------------------------------------------------------
// Pihak, status, umur
// ----------------------------------------------------------------------------

const RE_ORANG = /\b(Pemohon|Termohon|Penggugat|Tergugat)(?:\s+(II|I|1|2)(?![A-Za-z0-9]))?/gi;
const RE_STATUS = /\b(jejaka|perjaka|perawan|gadis|duda(?:\s+cerai\s+(?:hidup|mati))?|janda(?:\s+cerai\s+(?:hidup|mati))?)\b/i;
const RE_UMUR = new RegExp(`(?:ber)?(?:umur|usia)\\s*(?:sekitar\\s+|kurang\\s+lebih\\s+|±\\s*|\\+/-\\s*)?(${NUM})\\s*(?:\\([^)]*\\)\\s*)?tahun`, "i");
const RE_UMUR_KURUNG = new RegExp(`^\\s*\\(\\s*(${NUM})\\s*tahun`, "i");
const RE_HUBUNGAN_SEBELUM = /(?:kandung|tiri|angkat|ayah|ayahanda|bapak|ibu|paman|kakek|kakak|adik|abang|saudara|wali|nenek|bibi|orang\s+tua|rumah|mempelai|anak|bagi)\s*$/i;

function indeksPihak(kata, nomor) {
  const k = String(kata).toLowerCase();
  if (k === "termohon" || k === "tergugat") return 2;
  const n = String(nomor || "").toUpperCase();
  return n === "II" || n === "2" ? 2 : 1;
}

function statusBaku(s) {
  return bersihNilai(s).replace(/\s+/g, " ").toLowerCase();
}

/** Umur dan status per mempelai dari satu butir. */
function umurStatus(butir, hasil, sudah) {
  const pasangStatus = new Set(); // indeks sebutan yang sudah dibagi lewat pola berpasangan
  const pasangUmur = new Set();
  const sebut = [];
  RE_ORANG.lastIndex = 0;
  let m;
  while ((m = RE_ORANG.exec(butir))) sebut.push({ awal: m.index, akhir: m.index + m[0].length, pihak: indeksPihak(m[1], m[2]), kata: m[0] });

  // "Pemohon I dan Pemohon II berstatus jejaka dan perawan" / "berumur 24 dan 18 tahun" (dua pihak, dua nilai berurutan)
  for (let j = 0; j + 1 < sebut.length; j++) {
    const antara = butir.slice(sebut[j].akhir, sebut[j + 1].awal);
    if (!/^\s*(?:dan|,|serta)\s*$/i.test(antara) || sebut[j].pihak === sebut[j + 1].pihak) continue;
    const ekor = butir.slice(sebut[j + 1].akhir).split(/[.;\n]/)[0];
    const st = /^\s*(?:masing-masing\s+)?(?:berstatus|dengan\s+status)\s+([a-z]+(?:\s+cerai\s+(?:hidup|mati))?)\s+dan\s+([a-z]+(?:\s+cerai\s+(?:hidup|mati))?)/i.exec(ekor);
    if (st && RE_STATUS.test(st[1]) && RE_STATUS.test(st[2])) {
      for (const [p, s] of [[sebut[j].pihak, st[1]], [sebut[j + 1].pihak, st[2]]]) beri(hasil, sudah, p === 1 ? "statusP1" : "statusP2", statusBaku(s));
      pasangStatus.add(j).add(j + 1);
    }
    const um = new RegExp(`(?:ber)?(?:umur|usia)\\s*(?:masing-masing\\s+)?(${NUM})\\s*(?:tahun\\s*)?(?:dan|,)\\s*(${NUM})\\s*tahun`, "i").exec(ekor);
    if (um) {
      const a = umurValid(um[1]);
      const b = umurValid(um[2]);
      if (a && b) {
        beri(hasil, sudah, sebut[j].pihak === 1 ? "umurP1" : "umurP2", a);
        beri(hasil, sudah, sebut[j + 1].pihak === 1 ? "umurP1" : "umurP2", b);
        pasangUmur.add(j).add(j + 1);
      }
    }
  }

  for (let j = 0; j < sebut.length; j++) {
    const s = sebut[j];
    const sebelum = butir.slice(Math.max(0, s.awal - 30), s.awal);
    if (RE_HUBUNGAN_SEBELUM.test(sebelum)) continue; // "ayah kandung Pemohon II": rujukan, bukan subjek
    const batas = j + 1 < sebut.length ? sebut[j + 1].awal : butir.length;
    let segmen = butir.slice(s.akhir, batas);
    const potong = segmen.search(/[.;\n]/);
    if (potong >= 0) segmen = segmen.slice(0, potong);
    segmen = segmen.slice(0, 90);
    const st = RE_STATUS.exec(segmen);
    if (st && !pasangStatus.has(j) && /(?:status|\(|,|\bsebagai\b)/i.test(segmen.slice(0, st.index + st[0].length))) {
      beri(hasil, sudah, s.pihak === 1 ? "statusP1" : "statusP2", statusBaku(st[1]));
    }
    const um = pasangUmur.has(j) ? null : RE_UMUR.exec(segmen) || RE_UMUR_KURUNG.exec(segmen);
    if (um) {
      const u = umurValid(um[1]);
      if (u) beri(hasil, sudah, s.pihak === 1 ? "umurP1" : "umurP2", u);
    }
  }
}

/** Satu kunci hanya diisi satu nilai; dua nilai berbeda untuk kunci yang sama = ragu = dibuang. */
function beri(hasil, sudah, kunci, nilai) {
  if (!nilai) return;
  const ada = sudah.get(kunci);
  if (ada === undefined) {
    sudah.set(kunci, nilai);
  } else if (ada !== nilai) {
    sudah.set(kunci, null);
  }
  void hasil;
}

// ----------------------------------------------------------------------------
// Wali nikah
// ----------------------------------------------------------------------------

const HUB = "(?:ayah|ayahanda|bapak|kakek|paman|kakak|abang|adik|saudara|keponakan|sepupu|anak\\s+laki-laki)(?:\\s+(?:kandung|tiri|angkat|sebapak|seayah|seibu))?";
const PIHAK = "(?:Pemohon|Termohon|Penggugat|Tergugat)(?:\\s+(?:II|I|1|2)(?![A-Za-z0-9]))?";

/** "Ayah kandung" + "pemohon ii" -> "ayah kandung Pemohon II" (hubungan huruf kecil, sebutan pihak seperti di posita). */
function hubunganRapi(hub, pihak) {
  const h = String(hub).replace(/\s+/g, " ").toLowerCase();
  if (!pihak) return h;
  const p = String(pihak).replace(/\s+/g, " ").replace(/^(\w)(\w*)/, (_x, a, b) => a.toUpperCase() + b.toLowerCase()).replace(/\b(ii|i)$/i, (x) => x.toUpperCase());
  return `${h} ${p}`;
}

function wali(butir) {
  const hasil = [];
  for (const b of butir) {
    // 1. "wali nikah (adalah) ayah kandung Pemohon II (yang) bernama Ludin"
    let m = new RegExp(`\\bwali(?:\\s+nikah|\\s+nasab)?(?:nya)?(?:\\s+${PIHAK})?\\s*(?:adalah\\s+|yaitu\\s+|ialah\\s+|:\\s*)?(${HUB})(?:\\s+(${PIHAK}))?\\s*(?:yang\\s+)?bernama\\s+(.+)$`, "i").exec(b);
    if (m) {
      const n = ambilNama(m[3]);
      if (n) {
        hasil.push({ kunci: "waliNama", nilai: n.nama, yakin: "cukup", ket: "Dari kalimat 'wali nikah ... bernama ...' pada posita." });
        hasil.push({ kunci: "waliHubungan", nilai: hubunganRapi(m[1], m[2]), yakin: "cukup" });
        break;
      }
    }
    // 2. "wali nikahnya adalah Abdul Karim (ayah kandung Pemohon II)" / "wali nikah Ashar, yaitu ayah kandung ..."
    m = new RegExp(`\\bwali(?:\\s+nikah|\\s+nasab)?(?:nya)?\\s*(?:adalah\\s+|yaitu\\s+|ialah\\s+|:\\s*)?(?=[A-Z])(.+)$`).exec(b);
    if (m) {
      const n = ambilNama(m[1]);
      if (n) {
        const kur = new RegExp(`^\\s*[,(]?\\s*(?:yaitu\\s+|selaku\\s+|sebagai\\s+)?(${HUB})(?:\\s+(${PIHAK}))?`, "i").exec(n.sisa);
        hasil.push({ kunci: "waliNama", nilai: n.nama, yakin: "cukup", ket: "Dari kalimat 'wali nikah ...' pada posita." });
        if (kur) hasil.push({ kunci: "waliHubungan", nilai: hubunganRapi(kur[1], kur[2]), yakin: "cukup" });
        break;
      }
    }
  }
  return hasil;
}

// ----------------------------------------------------------------------------
// Saksi nikah
// ----------------------------------------------------------------------------

const ANGKA_SAKSI = "(?:(?:dua|2)\\s*(?:\\(\\s*dua\\s*\\)\\s*)?orang\\s+)";
const ANCHOR_SAKSI = [
  /(?<![A-Za-z])saksi(?:\s+nikah)?(?:nya)?\s*(?:masing-masing\s+)?(?:(?:(?:adalah|yaitu|ialah|bernama)\s+|:\s*)+|\s+(?=[A-Z]))/gi,
  new RegExp(`(?<![A-Za-z])disaksikan\\s+(?:oleh\\s+)?(?:${ANGKA_SAKSI}saksi\\s*(?:nikah\\s*)?(?:masing-masing\\s*)?(?:(?:yaitu|bernama|adalah)\\s+)?)?`, "gi"),
  new RegExp(`(?<![A-Za-z])dihadiri\\s+(?:oleh\\s+)?(?:${ANGKA_SAKSI}saksi\\s*(?:nikah\\s*)?(?:masing-masing\\s*)?(?:(?:yaitu|bernama|adalah)\\s+)?)?`, "gi"),
];

function saksiNikah(butir) {
  for (const b of butir) {
    for (const re of ANCHOR_SAKSI) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(b))) {
        if (m[0].length === 0) {
          re.lastIndex += 1;
          continue;
        }
        const dua = duaNama(b.slice(m.index + m[0].length));
        if (dua) {
          return [
            { kunci: "saksiNikah1", nilai: dua[0], yakin: "cukup", ket: "Dari kalimat tentang dua saksi nikah pada posita." },
            { kunci: "saksiNikah2", nilai: dua[1], yakin: "cukup" },
          ];
        }
      }
    }
  }
  return [];
}

// ----------------------------------------------------------------------------
// Mahar
// ----------------------------------------------------------------------------

function mahar(butir) {
  for (const b of butir) {
    const m = /\b(?:mas\s*kawin|maskawin|mahar)(?:nya)?\s*(?:berupa|yaitu|adalah|sebesar|sejumlah|senilai|:)?\s*(.+)$/i.exec(b);
    if (!m) continue;
    let sisa = m[1];
    const tutup = sisa.search(/(?<=[a-z0-9)\-,])\.\s+(?=[A-Z])|\s*;|\n|,?\s+(?:serta\s+|dan\s+)?(?:pernikahan|perkawinan|Pemohon|Termohon|Penggugat|Tergugat|setelah|kemudian|sejak|hingga|sampai)\b/);
    if (tutup >= 0) sisa = sisa.slice(0, tutup);
    // Bunyi posita disalin utuh (termasuk cara bayarnya: "dibayar tunai", "yang belum dibayar"); uraiMahar di isiJawabanSaksiFakta
    // memisahkan barang dan cara bayar saat jawaban disusun - satu aturan untuk semua sumber mahar.
    const nilai = bersihNilai(sisa.replace(/[\s,\-]+$/, ""));
    if (nilai.length < 3 || nilai.length >= 160) continue;
    if (/^(?:dibayar|dihutang|tunai|kontan|terhutang|belum)\b/i.test(nilai)) continue; // hanya cara bayar, tanpa barangnya
    return [{ kunci: "mahar", nilai, yakin: "cukup", ket: "Dari kalimat 'mas kawin/mahar ...' pada posita." }];
  }
  return [];
}

// ----------------------------------------------------------------------------
// Tanggal dan tempat akad
// ----------------------------------------------------------------------------

const RE_PERISTIWA_NIKAH = /\b(?:menikah|dinikahkan|pernikahan|perkawinan|akad\s+nikah|melangsungkan|nikah)\b/i;
const RE_BUKAN_NIKAH = /\b(?:lahir|cerai|bercerai|meninggal|wafat|mengajukan|didaftarkan|terdaftar|pengadilan)\b/i;

function tanggalTempat(butir) {
  const hasil = [];
  for (const b of butir) {
    if (!RE_PERISTIWA_NIKAH.test(b) || RE_BUKAN_NIKAH.test(b)) continue;
    const lengkap = tanggalIndo(b);
    const tahun = /\b(?:pada\s+)?tahun\s+((?:19|20)\d{2})\b/i.exec(b);
    if (lengkap) hasil.push({ kunci: "tglNikah", nilai: lengkap, yakin: "cukup", ket: "Dari kalimat tentang pernikahan pada posita." });
    else if (tahun) hasil.push({ kunci: "tglNikah", nilai: `tahun ${tahun[1]}`, yakin: "cukup", ket: "Posita hanya menyebut tahun menikah." });
    const tp = /(?:menikah|dinikahkan|melangsungkan\s+pernikahan|akad\s+nikah|nikah)[^;]*?\bdi\s+((?:rumah\s+[a-z\s]{3,40}?(?:di\s+)?(?:Desa|Kelurahan|Kecamatan)\s+[A-Z][\w'’\-]*(?:\s+[A-Z][\w'’\-]*){0,2}|(?:Masjid|Desa|Kelurahan|Kecamatan|Kota|Kabupaten)\s+[A-Z][\w'’\-]*(?:\s+[A-Z][\w'’\-]*){0,2}))/.exec(b);
    if (tp) hasil.push({ kunci: "tempatNikah", nilai: bersihNilai(tp[1]), yakin: "cukup", ket: "Dari kalimat tentang pernikahan pada posita." });
    if (lengkap || tahun || tp) break;
  }
  return hasil;
}

// ----------------------------------------------------------------------------
// Titik masuk
// ----------------------------------------------------------------------------

/**
 * @param {string[]} butir butir posita (butirPosita)
 * @returns {Array<{kunci:string,nilai:string,yakin:string,ket?:string}>}
 */
function faktaNikahDariPosita(butir) {
  const daftar = Array.isArray(butir) ? butir : [];
  if (!daftar.length) return [];
  const hasil = [];
  const sudah = new Map();
  for (const b of daftar) umurStatus(b, hasil, sudah);
  for (const [kunci, nilai] of sudah) {
    if (nilai) hasil.push({ kunci, nilai, yakin: "cukup", ket: "Dari kalimat tentang status/umur mempelai pada posita." });
  }
  hasil.push(...wali(daftar), ...saksiNikah(daftar), ...mahar(daftar), ...tanggalTempat(daftar));
  return hasil;
}

module.exports = { faktaNikahDariPosita, bilangan, ambilNama, duaNama };
