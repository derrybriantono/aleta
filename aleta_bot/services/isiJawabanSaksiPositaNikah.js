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
    if (/[.]$/.test(k) && k.length > 3 && !/^(?:Dg|Hj|Hi|Dr|Drs|Ir|Pak|Bpk|Alm|Abd|Muh|Moh|Mhd|Md|Mh|St|Sy|Ny|Ust|Kh|Hs|Ha)\.$/i.test(k)) {
      i++;
      break; // titik penutup kalimat
    }
  }
  let hasil = bersihNilai(nama.join(" "));
  // inisial di ujung nama ("Xxxd M.") tetap bertitik: itu bagian nama, bukan titik penutup kalimat
  if (/^[A-Z]\.$/.test(nama[nama.length - 1] || "") && !hasil.endsWith(".")) hasil += ".";
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
  // U2: pembacaan per peran (isi satu kalimat dipotong pada penanda wali/menikahkan/saksi/mahar) lebih dahulu; pola lama cadangan.
  const peran = peranNikah(butir);
  if (peran.waliNama || peran.waliHubungan) {
    if (peran.waliNama) hasil.push({ kunci: "waliNama", nilai: peran.waliNama, yakin: "cukup", ket: "Dari kalimat tentang wali nikah pada posita." });
    if (peran.waliHubungan) hasil.push({ kunci: "waliHubungan", nilai: peran.waliHubungan, yakin: "cukup" });
    return hasil;
  }
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
  const peran = peranNikah(butir);
  if (peran.saksiAda && !peran.saksi) return [];
  if (peran.saksi) {
    return [
      { kunci: "saksiNikah1", nilai: peran.saksi[0], yakin: "cukup", ket: "Dari kalimat tentang dua saksi nikah pada posita." },
      { kunci: "saksiNikah2", nilai: peran.saksi[1], yakin: "cukup" },
    ];
  }
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
// Peran dalam satu kalimat nikah: wali, yang menikahkan, saksi (U2, 1 Nov 2026)
// ----------------------------------------------------------------------------
//
// Posita itsbat satker menulis ketiganya dalam SATU kalimat panjang:
//   "... dilangsungkan dengan wali nikah Ayah Kandung dari Pemohon II yang bernama Madong dan yang menikahkan imam Masjid yang
//    bernama Hi. Moh Said dan dihadiri saksi Nikah lebih dari dua orang diantaranya masing-masing bernama : Moh Zainal dan Bukido
//    dengan Mas kawin ..."
// Pola per peran (wali..., saksi...) saling menelan nama peran lain. Di sini kalimat dipotong pada kata penanda peran
// (wali / menikahkan / saksi / mahar) lalu tiap potongan dibaca sendiri, sehingga imam desa, wali, dan saksi tidak tertukar.
// Keputusan Derry 99: yang menikahkan = imam desa / imam masjid (bukan saksi, bukan wali).

const JABATAN = "(?:imam|penghulu|p3n|ppn|pembantu\\s+pegawai\\s+pencatat(?:\\s+nikah)?|pegawai\\s+syara[’']?|pegawai\\s+pencatat(?:\\s+nikah)?|petugas\\s+(?:kua|pencatat)|kepala\\s+(?:desa|dusun|kua|lingkungan)|tokoh\\s+(?:agama|masyarakat)|ustad[zs]?|kiai|kyai|ulama|modin|naib|khatib|tuan\\s+guru|guru\\s+ngaji|sesepuh\\s+adat|pak\\s+imam)";
const TEMPAT_JABATAN = "(?:desa|dusun|masjid|mesjid|musholla|mushalla|langgar|kampung|kelurahan|setempat|kecamatan|lingkungan)";
const HUB_WALI = "(?:ayah|ayahanda|bapak|kakek|paman|kakak|abang|adik|saudara|keponakan|sepupu|orang\\s*tua|anak\\s+laki-laki|wali\\s+hakim|hakim)(?:\\s+(?:kandung|tiri|angkat|sebapak|seayah|seibu|laki-laki))?";
const RE_JABATAN_AWAL = new RegExp(`^(${JABATAN})(?:\\s+(${TEMPAT_JABATAN}))?(?![A-Za-z])`, "i");
const RE_HUB_WALI = new RegExp(`(?<![A-Za-z])(${HUB_WALI})(?:\\s+(?:dari\\s+)?(${PIHAK}))?`, "i");
const RE_PIHAK_AWAL = /^\s*(?:dari\s+)?(?:Pemohon|Termohon|Penggugat|Tergugat)(?:\s+(?:I|II|1|2)(?![A-Za-z0-9]))?/i;

function awalBesar(t) {
  const s = String(t || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "imam desa Lero" -> "Imam Desa Lero" (kata jabatan dan kata tempatnya berhuruf awal besar; nama tempat disalin). */
function jabatanRapi(t) {
  return awalBesar(String(t || "").replace(new RegExp(`(?<![A-Za-z])${TEMPAT_JABATAN}(?![A-Za-z])`, "gi"), (k) => awalBesar(k.toLowerCase())));
}

/** Membuang penghubung di awal potongan: "adalah", "yaitu", ":", "antara Pemohon I dengan Pemohon II", "sekaligus". */
function bukaPotongan(teks) {
  let s = String(teks || "").trim();
  const P = "(?:Pemohon|Termohon|Penggugat|Tergugat)(?:\\s+(?:I|II|1|2)(?![A-Za-z0-9]))?";
  const reAntara = new RegExp(`^antara\\s+(?:kedua\\s+)?${P}\\s+(?:dengan|dan)\\s+${P}\\s*`, "i");
  const reKedua = new RegExp(`^${P}\\s+(?:dengan|dan)\\s+${P}\\s*`, "i");
  for (let i = 0; i < 6; i++) {
    const sebelum = s;
    s = s
      .replace(/^[\s,:\-–]+/, "")
      .replace(/^(?:adalah|yaitu|yakni|ialah|sebagai|selaku|oleh|kepada)(?![A-Za-z])\s*/i, "")
      .replace(/^(?:sekaligus|juga)(?![A-Za-z])\s*/i, "")
      .replace(reAntara, "")
      .replace(reKedua, "");
    if (s === sebelum) break;
  }
  return s;
}

/** Nama sesudah "bernama" / dalam kurung / langsung; null bila tidak ada nama berhuruf kapital. */
/** Penanda isian blangko yang tidak diganti ("WALI NIKAH", "SAKSI NIKAH I"): bukan nama orang. */
const NAMA_PENANDA_ISIAN = /(?:^|\s)(?:NIKAH|WALI|SAKSI|PEMOHON|ISTRI|SUAMI)(?:\s|$)/;

function namaPeran(teks) {
  let s = String(teks || "").trim().replace(/^[\s,:\-–]+/, "");
  if (/^(?:yang\s+)?(?:bernama\s*[:\-]?\s*)?(?:WAKIL\s+)?(?:WALI\s+NIKAH|SAKSI\s+NIKA)/.test(s)) return null; // penanda isian yang tidak diganti
  s = s.replace(/^(?:yang\s+)?(?:bernama|benama|bernma|nama(?:nya)?)\s*[:\-]?\s*/i, "");
  s = s.replace(/^\(\s*/, "");
  s = s.replace(/^\d\s*[.)]\s*/, "");
  const n = ambilNama(s);
  // nama berhuruf kecil ("bernama ludin") sengaja tidak diisi: ragu = tetap titik-titik (keputusan T11)
  if (!n || NAMA_PENANDA_ISIAN.test(n.nama)) return null;
  // "Alm. Xxxa" -> "Xxxa" (sama dengan pembaca lama: Alm. di depan nama dibuang)
  const tanpaAlm = n.nama.replace(/^(?:Alm(?:arhum(?:ah)?)?\.?)\s+/i, "");
  return tanpaAlm.length >= 3 ? tanpaAlm : n.nama;
}

/** Potongan "yang menikahkan ..." -> { nilai, jabatan, nama } atau null. */
function kupasPenikah(potongan) {
  const s = bukaPotongan(potongan);
  if (!s) return null;
  const j = RE_JABATAN_AWAL.exec(s);
  if (j) {
    // Jabatan + (desa/masjid) + nama tempat berhuruf kapital: "Imam Desa Lero", "Imam Desa TOMADO".
    let sisa = s.slice(j[0].length);
    let jabatan = j[0].replace(/\s+/g, " ").trim();
    if (j[2]) {
      const tempat = /^\s+((?:[A-Z][\w'’\-]*)(?:\s+[A-Z][\w'’\-]*){0,2})/.exec(sisa);
      if (tempat && !BUKAN_NAMA.test(tempat[1].split(/\s+/)[0])) {
        jabatan = `${jabatan} ${tempat[1]}`;
        sisa = sisa.slice(tempat[0].length);
      }
    }
    const adaNama = /^\s*,?\s*(?:yang\s+)?(?:bernama|benama|bernma|nama(?:nya)?)(?![A-Za-z])/i.test(sisa) || /^\s*\(/.test(sisa);
    const nama = adaNama ? namaPeran(sisa) : null;
    jabatan = jabatanRapi(jabatan);
    return { jabatan, nama, nilai: nama ? `${jabatan} bernama ${nama}` : jabatan };
  }
  // "ayah kandung Pemohon II yang bernama Iswamin": wali sendiri yang menikahkan
  const hub = RE_HUB_WALI.exec(s);
  if (hub && hub.index === 0) {
    const w = kupasWali(s, false);
    if (w && w.nama) return { jabatan: w.hubungan, nama: w.nama, nilai: `${w.hubungan || "wali"} bernama ${w.nama}` };
  }
  // "Hamsih (Imam Desa Kaleke)" / "Sahido (Imam Desa Loli Tasiburi)" / "Bernama SALEH DANTO" / "Ali Sodikin"
  const nm = namaPeran(s);
  const n = ambilNama(s.replace(/^(?:yang\s+)?(?:bernama|benama|bernma|nama(?:nya)?)\s*[:\-]?\s*/i, ""));
  if (!n || !nm) return nm ? { jabatan: "", nama: nm, nilai: nm } : null;
  // gelar sesudah koma ("Xxxb, S.Pd.I (Kepala KUA Yyya)") disalin apa adanya sebagai bagian nama
  let nama = n.nama;
  let sisa = n.sisa || "";
  const gelar = /^\s*((?:[A-Z][A-Za-z]{0,3}\.){1,4}[A-Za-z]{0,3})(?![A-Za-z])/.exec(sisa);
  if (n.koma && gelar) {
    nama = `${nama}, ${gelar[1]}`;
    sisa = sisa.slice(gelar[0].length);
  }
  const kur = /^\s*\(\s*(.{2,70}?)\s*\)/.exec(sisa);
  if (kur && RE_JABATAN_AWAL.test(kur[1].trim())) {
    const jab = jabatanRapi(kur[1].replace(/\s+/g, " ").trim());
    return { jabatan: jab, nama, nilai: `${jab} bernama ${nama}` };
  }
  return { jabatan: "", nama, nilai: nama };
}

/** Potongan sesudah "wali nikah" -> { nama, hubungan } (salah satunya boleh kosong) atau null. */
function kupasWali(potongan, hakim) {
  let s = bukaPotongan(potongan);
  s = s.replace(/^(?:nikah|nasab)(?![A-Za-z])\s*/i, "");
  s = bukaPotongan(s);
  if (!s) return null;
  s = s.replace(/^(?:Pemohon|Termohon|Penggugat|Tergugat)(?:\s+(?:I|II|1|2)(?![A-Za-z0-9]))?\s+(?=adalah|yaitu|ialah|bernama)/i, "");
  s = bukaPotongan(s);
  // "diwakilkan kepada imam masjid bernama Ladami untuk menikahkan ..." : wali = yang sebelum "diwakilkan"
  const wakil = /(?<![A-Za-z])(?:yang\s+)?(?:diwakilkan|dikuasakan|diserahkan|diwakili)(?![A-Za-z])/i.exec(s);
  const utama = (wakil ? s.slice(0, wakil.index) : s).slice(0, 160);
  const h = RE_HUB_WALI.exec(utama);
  let hubungan = "";
  let nama = null;
  const jImam = RE_JABATAN_AWAL.exec(utama);
  if (jImam && !(h && h.index < jImam[0].length)) {
    // "wali nikah imam Mesjid bernama Zabur": hanya namanya yang dipakai (apakah wali hakim tidak disebut posita)
    const mm = /(?:yang\s+)?(?:bernama|benama|bernma)\s*[:\-]?\s*(.+)$/i.exec(utama.slice(jImam[0].length));
    nama = mm ? namaPeran(mm[1]) : null;
    if (nama) return { nama, hubungan: "", imam: awalBesar(jImam[0].replace(/\s+/g, " ").trim()) };
  } else if (h && h.index <= 70) {
    hubungan = hubunganRapi(h[1].replace(/^hakim$/i, "wali hakim"), h[2]);
    const sebelum = utama.slice(0, h.index);
    const sesudah = utama.slice(h.index + h[0].length);
    // "yang bernama Suprapto orang tua Pemohon II": nama sebelum hubungan
    const bernamaDulu = /(?:yang\s+)?(?:bernama|benama|bernma)\s*[:\-]?\s*(.+)$/i.exec(sebelum);
    if (bernamaDulu) nama = namaPeran(bernamaDulu[1]);
    if (!nama) nama = namaPeran(sesudah.replace(RE_PIHAK_AWAL, ""));
    if (!nama && /\(\s*$/.test(sebelum)) {
      const n0 = ambilNama(sebelum.replace(/\(\s*$/, ""));
      if (n0) nama = n0.nama;
    }
  } else {
    // nama langsung ("Ashar (Ayah kandung Pemohon I)"), hubungan di kurung
    const n = ambilNama(utama.replace(/^(?:yang\s+)?(?:bernama|benama|bernma|nama(?:nya)?)\s*[:\-]?\s*/i, ""));
    if (n) {
      nama = n.nama;
      const kur = new RegExp(`^\\s*[,(]?\\s*(?:yaitu\\s+|selaku\\s+|sebagai\\s+)?(${HUB_WALI})(?:\\s+(?:dari\\s+)?(${PIHAK}))?`, "i").exec(n.sisa || "");
      if (kur) hubungan = hubunganRapi(kur[1].replace(/^hakim$/i, "wali hakim"), kur[2]);
    }
  }
  if (nama && /^(?:Pemohon|Termohon|Penggugat|Tergugat)(?![A-Za-z])/.test(nama)) nama = null;
  if (nama) nama = nama.replace(/^(?:Alm(?:arhum(?:ah)?)?\.?)\s+(?=\S{3})/i, "");
  if (hakim && !hubungan) hubungan = "wali hakim";
  if (!nama && !hubungan) return null;
  return { nama, hubungan };
}

const RE_PENANDA = [
  { jenis: "wali", re: /(?<![A-Za-z])wali(?:\s+(?:nikah|nasab|hakim))*(?:nya)?(?![A-Za-z])/gi },
  { jenis: "penikah", re: /(?<![A-Za-z])(?:yang\s+)?menikahkan(?:nya)?/gi },
  { jenis: "penikah", re: /(?<![A-Za-z])dinikahkan\s+(?:secara\s+\w+\s+)?oleh(?![A-Za-z])/gi },
  // "wali nikah ... yang akad nikahnya diwakilkan kepada imam masjid bernama X (untuk menikahkan ...)"
  { jenis: "penikah", re: /(?<![A-Za-z])(?:yang\s+)?(?:akad\s+nikahnya\s+|pernikahannya\s+|pernikahan\s+itu\s+)?(?:diwakilkan|dikuasakan|diserahkan|diwakili)\s+(?:kepada|oleh)(?![A-Za-z])/gi },
  { jenis: "penikah", re: /(?<![A-Za-z])ijab\s*(?:dan|\/|&)?\s*(?:kabul|qabul|qobul)\s+(?:dilakukan|diucapkan|dipimpin|dilaksanakan)\s+oleh(?![A-Za-z])/gi },
  { jenis: "saksi", re: /(?<![A-Za-z])(?:dihadiri|disaksikan|dihadirkan)(?![A-Za-z])/gi },
  { jenis: "saksi", re: /(?<![A-Za-z])saksi(?:[\s-]+nikah)?(?:nya)?(?![A-Za-z])/gi },
  { jenis: "mahar", re: /(?<![A-Za-z])(?:mas\s*kawin|maskawin|mahar)(?![A-Za-z])/gi },
  { jenis: "akhir", re: /(?<![A-Za-z])(?:pernikahan|perkawinan)\s+tersebut(?![A-Za-z])|(?<![A-Za-z])(?:setelah|sesudah|sejak)\s+(?:menikah|pernikahan)(?![A-Za-z])/gi },
];

/** Bagi kalimat menjadi potongan bertanda: [{ jenis, teks, sekaligus }]. */
function potongPeran(kalimat) {
  const penanda = [];
  for (const { jenis, re } of RE_PENANDA) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(kalimat))) {
      if (!m[0].length) {
        re.lastIndex += 1;
        continue;
      }
      const sebelum = kalimat.slice(Math.max(0, m.index - 16), m.index);
      if (jenis === "penikah" && /(?:untuk|agar|guna|tidak\s+bersedia|bersedia|enggan|tidak\s+mau|tidak\s+dapat|belum)\s*$/i.test(sebelum)) continue;
      penanda.push({ jenis, kata: m[0], awal: m.index, akhir: m.index + m[0].length, sekaligus: /sekaligus\s*(?:yang\s*)?$/i.test(sebelum) });
    }
  }
  penanda.sort((a, b) => a.awal - b.awal);
  // penanda yang tumpang tindih ("menikahkan" di dalam "dinikahkan oleh"): yang pertama menang
  const bersih = [];
  for (const p of penanda) {
    const akhir = bersih[bersih.length - 1];
    if (akhir && p.awal < akhir.akhir) continue;
    bersih.push(p);
  }
  const potongan = [];
  for (let i = 0; i < bersih.length; i++) {
    const p = bersih[i];
    const batas = i + 1 < bersih.length ? bersih[i + 1].awal : kalimat.length;
    const teks = kalimat.slice(p.akhir, batas);
    const sebelumnya = potongan[potongan.length - 1];
    // "dihadiri" + "saksi nikah" bersebelahan = satu potongan saksi
    if (sebelumnya && sebelumnya.jenis === "saksi" && p.jenis === "saksi" && p.awal - sebelumnya.batas <= 30) {
      sebelumnya.teks += ` ${teks}`;
      sebelumnya.batas = batas;
      continue;
    }
    potongan.push({ jenis: p.jenis, kata: p.kata, teks, batas, sekaligus: p.sekaligus });
  }
  return potongan;
}

/** Lewati kata pengantar daftar saksi: "oleh saksi nikah lebih dari dua orang diantaranya masing-masing bernama :". */
function bukaDaftarSaksi(teks) {
  let s = String(teks || "").trim();
  for (let i = 0; i < 8; i++) {
    const sebelum = s;
    s = s
      .replace(/^[\s,:\-–]+/, "")
      .replace(/^(?:oleh|adalah|yaitu|yakni|ialah|bernama|nama(?:nya)?|yang)(?![A-Za-z])\s*/i, "")
      .replace(/^saksi(?:[\s-]+nikah)?(?![A-Za-z])\s*/i, "")
      .replace(/^(?:lebih\s+dari|sebanyak|sejumlah|kurang\s+lebih)\s+/i, "")
      .replace(/^(?:\d{1,2}|dua|tiga|empat|lima)\s*(?:\([^)]*\)\s*)?orang(?![A-Za-z])\s*/i, "")
      .replace(/^(?:di\s*antara(?:nya)?|antara\s+lain)(?![A-Za-z])\s*/i, "")
      .replace(/^masing\s*[-–]?\s*masing(?![A-Za-z])\s*/i, "")
      .replace(/^\d\s*[.)]\s*/, "");
    if (s === sebelum) break;
  }
  // lompati pengantar yang salah ketik ("dianataranya masing-masing bernama :") bila hanya kata biasa sebelum "bernama"
  const kb = /(?<![A-Za-z])(?:bernama|benama|bernma)\s*:?\s*/i.exec(s.slice(0, 110));
  if (kb && !/[A-Z][a-z]*\.?\s*[A-Z]/.test(s.slice(0, kb.index).replace(/(?:Nikah|Dua|Saksi|Dihadiri)/g, ""))) s = s.slice(kb.index + kb[0].length);
  return s
    .replace(/\(\s*(?:alm|almarhum|almarhumah|almh)\.?\s*\)\s*/gi, "")
    .replace(/\s*\([^()]{1,40}\)/g, "")
    .replace(/(?:^|\s)\d\s*[.)]\s+(?=[A-Z])/g, " ")
    .trim();
}

/**
 * Wali, yang menikahkan, dan saksi nikah dari butir posita. Satu kalimat nikah dibaca sekali; yang ragu tidak dikeluarkan.
 * @returns {{waliNama?:string, waliHubungan?:string, penikah?:string, penikahJabatan?:string, penikahNama?:string, saksi?:string[]}}
 */
const CACHE_PERAN = new WeakMap();
function peranNikah(butir) {
  if (Array.isArray(butir) && CACHE_PERAN.has(butir)) return CACHE_PERAN.get(butir);
  const hasil = {};
  for (const b of Array.isArray(butir) ? butir : []) {
    if (!/(?:wali|nikahkan|saksi|dihadiri|disaksikan|ijab)/i.test(b)) continue;
    const potongan = potongPeran(b);
    let walinya = null;
    for (const p of potongan) {
      if (p.jenis === "wali" && !walinya) {
        const w = kupasWali(p.teks, /hakim/i.test(p.kata));
        if (w) {
          walinya = w;
          if (w.nama && !hasil.waliNama) hasil.waliNama = w.nama;
          if (w.hubungan && !hasil.waliHubungan) hasil.waliHubungan = w.hubungan;
        }
      } else if (p.jenis === "penikah" && !hasil.penikah && !p.sekaligus) {
        const k = kupasPenikah(p.teks);
        if (k && k.nilai.length >= 3 && k.nilai.length <= 100) {
          hasil.penikah = k.nilai;
          hasil.penikahJabatan = k.jabatan;
          hasil.penikahNama = k.nama || "";
        }
      } else if (p.jenis === "saksi" && !hasil.saksi) {
        hasil.saksiAda = true; // ada kata saksi: pembaca lama tidak dipakai lagi (ia sempat mengambil nama yang menikahkan sebagai saksi)
        const dua = duaNama(bukaDaftarSaksi(p.teks));
        if (dua) hasil.saksi = dua;
      }
    }
    // "wali hakim bernama X dan sekaligus menikahkan Pemohon II": yang menikahkan = wali itu sendiri
    if (!hasil.penikah && walinya && walinya.nama && /hakim/i.test(walinya.hubungan || "") && potongan.some((p) => p.jenis === "penikah" && p.sekaligus)) {
      hasil.penikah = `wali hakim bernama ${walinya.nama}`;
      hasil.penikahJabatan = "wali hakim";
      hasil.penikahNama = walinya.nama;
    }
    // "wali nikah imam Mesjid bernama Zabur" tanpa kalimat menikahkan lain: imam itu wali sekaligus yang menikahkan - TIDAK pasti
    // (wali bisa mewakilkan), maka ditandai ragu supaya petugas memeriksa.
    if (!hasil.penikah && walinya && walinya.imam && walinya.nama) {
      hasil.penikah = `${walinya.imam} bernama ${walinya.nama}`;
      hasil.penikahJabatan = walinya.imam;
      hasil.penikahNama = walinya.nama;
      hasil.penikahRagu = true;
    }
    if (hasil.saksi && (hasil.waliNama || hasil.waliHubungan) && hasil.penikah) break;
  }
  if (Array.isArray(butir)) CACHE_PERAN.set(butir, hasil);
  return hasil;
}

function penikah(butir) {
  const p = peranNikah(butir);
  if (!p.penikah) return [];
  return [
    p.penikahRagu
      ? { kunci: "penikah", nilai: p.penikah, yakin: "ragu", ket: "Posita menyebut imam itu sebagai wali nikah; dianggap juga yang menikahkan. Periksa dengan keterangan saksi." }
      : { kunci: "penikah", nilai: p.penikah, yakin: "cukup", ket: "Dari kalimat tentang yang menikahkan (imam desa / imam masjid) pada posita." },
  ];
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
  hasil.push(...wali(daftar), ...penikah(daftar), ...saksiNikah(daftar), ...mahar(daftar), ...tanggalTempat(daftar));
  return hasil;
}

module.exports = { faktaNikahDariPosita, peranNikah, bilangan, ambilNama, duaNama };
