"use strict";

/**
 * ============================================================================
 * PEMBACA SQL UNTUK MODE KEMBARAN
 * ============================================================================
 *
 * Bukan penguraiyi SQL penuh. Hanya cukup untuk tiga pekerjaan, dan GAGAL
 * TERTUTUP bila tidak yakin (hasilnya "tak terbaca", yang berarti baris itu
 * tidak akan dikirim otomatis ke server):
 *
 *   1. MENGENALI tulisan  - INSERT/UPDATE/DELETE/REPLACE/DDL/CALL; apa pun yang
 *      kata pertamanya tidak dikenal dianggap tulisan.
 *   2. MENGURAI tulisan sederhana - satu tabel; kolom yang diubah; WHERE; baris
 *      yang disisipkan - untuk mencuplik nilai lama dan memeriksa bentrok.
 *   3. MENGGANTI jam relatif (NOW(), CURDATE() dst.) dengan literal saat tulisan
 *      itu terjadi, supaya tanggal/jam yang dikirim ke server Senin depan tetap
 *      jam saat petugas bekerja di laptop - bukan jam saat dikirim.
 *
 * Semua pencarian kata kunci berjalan di atas salinan "bertopeng": isi tanda
 * kutip, nama berpetik-balik, dan komentar diganti 'x' dengan panjang yang
 * sama, jadi indeks di salinan itu = indeks di SQL aslinya, dan kata kunci di
 * dalam teks (mis. 'Tunda WHERE ...') tidak pernah terbaca sebagai kata kunci.
 */

/** Salinan SQL sepanjang aslinya dengan isi kutip dan komentar diganti 'x' / spasi. */
function topeng(sql) {
  const s = String(sql);
  const n = s.length;
  const keluar = new Array(n);
  let i = 0;
  while (i < n) {
    const c = s[i];
    const c2 = s[i + 1];
    if (c === "'" || c === '"' || c === "`") {
      keluar[i] = c;
      i += 1;
      while (i < n) {
        const ch = s[i];
        if (ch === "\\" && c !== "`") {
          keluar[i] = "x";
          if (i + 1 < n) keluar[i + 1] = "x";
          i += 2;
          continue;
        }
        if (ch === c) {
          if (s[i + 1] === c) {
            keluar[i] = "x";
            keluar[i + 1] = "x";
            i += 2;
            continue;
          }
          keluar[i] = c;
          i += 1;
          break;
        }
        keluar[i] = "x";
        i += 1;
      }
      continue;
    }
    const komentarBaris =
      (c === "-" && c2 === "-" && (i + 2 >= n || /\s/.test(s[i + 2]))) || c === "#";
    if (komentarBaris) {
      while (i < n && s[i] !== "\n") {
        keluar[i] = " ";
        i += 1;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      const j = s.indexOf("*/", i + 2);
      const akhir = j < 0 ? n : j + 2;
      for (; i < akhir; i += 1) keluar[i] = " ";
      continue;
    }
    keluar[i] = c;
    i += 1;
  }
  return keluar.join("");
}

/** Kedalaman kurung di tiap indeks (kurung buka/tutup sendiri = kedalaman luar). */
function kedalaman(m) {
  const d = new Int16Array(m.length);
  let dalam = 0;
  for (let i = 0; i < m.length; i += 1) {
    if (m[i] === "(") {
      d[i] = dalam;
      dalam += 1;
    } else if (m[i] === ")") {
      dalam = Math.max(0, dalam - 1);
      d[i] = dalam;
    } else {
      d[i] = dalam;
    }
  }
  return d;
}

/** Memecah beberapa pernyataan pada ';' tingkat atas. Kosong dibuang. */
function pecahPernyataan(sql) {
  const s = String(sql);
  const m = topeng(s);
  const hasil = [];
  let mulai = 0;
  for (let i = 0; i <= m.length; i += 1) {
    if (i === m.length || m[i] === ";") {
      const potong = s.slice(mulai, i).trim();
      if (potong && topeng(potong).trim()) hasil.push(potong);
      mulai = i + 1;
    }
  }
  return hasil;
}

const KATA_BACA = new Set(["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "HELP", "USE"]);
const KATA_SESI = new Set(["SET"]);
const KATA_TRANSAKSI = new Set(["START", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE", "LOCK", "UNLOCK", "XA"]);
const KATA_TULIS = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE"]);
const KATA_DDL = new Set(["CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME"]);

function kataPertama(pernyataan) {
  const m = topeng(pernyataan);
  const x = /^[\s(]*([A-Za-z_]+)/.exec(m);
  return x ? x[1].toUpperCase() : "";
}

/**
 * Golongan satu pernyataan:
 *   "baca" | "sesi" | "transaksi"  -> diteruskan apa adanya
 *   "INSERT" | "UPDATE" | "DELETE" | "REPLACE" -> tulisan data
 *   "DDL"  -> CREATE/ALTER/DROP/TRUNCATE/RENAME (kecuali tabel TEMPORARY)
 *   "LAIN" -> CALL/LOAD/GRANT/... dan kata yang tidak dikenal (dianggap tulisan)
 */
function golongan(pernyataan) {
  const k = kataPertama(pernyataan);
  if (!k) return "baca";
  if (KATA_BACA.has(k)) return /\bINTO\s+(OUTFILE|DUMPFILE)\b/i.test(topeng(pernyataan)) ? "LAIN" : "baca";
  if (k === "WITH") return /\)\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(topeng(pernyataan)) ? "LAIN" : "baca";
  if (KATA_SESI.has(k)) return "sesi";
  if (KATA_TRANSAKSI.has(k)) return "transaksi";
  if (KATA_TULIS.has(k)) return k;
  if (KATA_DDL.has(k)) {
    if (/^[\s(]*(CREATE|DROP)\s+TEMPORARY\b/i.test(topeng(pernyataan))) return "sesi";
    return "DDL";
  }
  return "LAIN";
}

function adalahTulis(pernyataan) {
  const g = golongan(pernyataan);
  return g !== "baca" && g !== "sesi" && g !== "transaksi";
}

// ---------------------------------------------------------------------------
// Pencarian kata kunci tingkat atas
// ---------------------------------------------------------------------------

function cariKata(m, d, pola, dari = 0, sampai = m.length) {
  const re = new RegExp(`(?<![A-Za-z0-9_$.])(?:${pola})(?![A-Za-z0-9_$])`, "gi");
  re.lastIndex = Math.max(0, dari);
  let x = re.exec(m);
  while (x && x.index < sampai) {
    if (d[x.index] === 0) return { indeks: x.index, panjang: x[0].length };
    x = re.exec(m);
  }
  return null;
}

/** Memecah [dari, sampai) pada karakter `pemisah` yang kedalamannya `dalam`. */
function pisahTingkat(m, d, s, dari, sampai, pemisah, dalam = 0) {
  const hasil = [];
  let mulai = dari;
  for (let i = dari; i <= sampai; i += 1) {
    if (i === sampai || (m[i] === pemisah && d[i] === dalam)) {
      hasil.push(s.slice(mulai, i).trim());
      mulai = i + 1;
    }
  }
  return hasil.filter((x) => x !== "");
}

function lepasPetik(nama) {
  return String(nama || "").trim().replace(/^`|`$/g, "").replace(/``/g, "`");
}

const POLA_NAMA = "(?:`(?:[^`]|``)+`|[A-Za-z0-9_$]+)";
const RE_RUJUKAN_TABEL = new RegExp(
  `^(${POLA_NAMA})(?:\\s*\\.\\s*(${POLA_NAMA}))?(?:\\s+(?:AS\\s+)?(${POLA_NAMA}))?$`,
  "i"
);
const RE_RUJUKAN_TABEL_INSERT = new RegExp(`^(${POLA_NAMA})(?:\\s*\\.\\s*(${POLA_NAMA}))?`, "i");

function uraiRujukanTabel(teks) {
  const x = RE_RUJUKAN_TABEL.exec(String(teks).trim());
  if (!x) return null;
  const A = lepasPetik(x[1]);
  const B = x[2] ? lepasPetik(x[2]) : "";
  const alias = x[3] ? lepasPetik(x[3]) : "";
  if (/^(SET|WHERE|JOIN|LEFT|RIGHT|INNER|CROSS|ORDER|LIMIT|USING)$/i.test(alias)) return null;
  return B ? { skema: A, tabel: B, alias } : { skema: "", tabel: A, alias };
}

function namaKolom(teks) {
  const t = String(teks || "").trim();
  const bagian = t.split(/\s*\.\s*/);
  return lepasPetik(bagian[bagian.length - 1]);
}

// ---------------------------------------------------------------------------
// Nilai literal
// ---------------------------------------------------------------------------

function bukaKutip(isi, petik) {
  let hasil = "";
  for (let i = 0; i < isi.length; i += 1) {
    const c = isi[i];
    if (c === "\\" && i + 1 < isi.length) {
      const n = isi[i + 1];
      i += 1;
      if (n === "0") hasil += "\0";
      else if (n === "n") hasil += "\n";
      else if (n === "r") hasil += "\r";
      else if (n === "t") hasil += "\t";
      else if (n === "b") hasil += "\b";
      else if (n === "Z") hasil += "\x1a";
      else if (n === "%" || n === "_") hasil += `\\${n}`;
      else hasil += n;
      continue;
    }
    if (c === petik && isi[i + 1] === petik) {
      hasil += petik;
      i += 1;
      continue;
    }
    hasil += c;
  }
  return hasil;
}

/** { tipe: "null" | "angka" | "teks" | "kompleks", nilai } dari satu ekspresi SQL. */
function nilaiLiteral(ekspresi) {
  const t = String(ekspresi == null ? "" : ekspresi).trim();
  if (/^NULL$/i.test(t)) return { tipe: "null", nilai: null };
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) return { tipe: "angka", nilai: t.replace(/^\+/, "") };
  const x = /^(['"])([\s\S]*)\1$/.exec(t);
  // Satu literal utuh = salinan bertopengnya hanya kutip, 'x', kutip - bukan 'a' 'b' atau 'a' + 'b'.
  if (x && /^(['"])x*\1$/.test(topeng(t))) return { tipe: "teks", nilai: bukaKutip(x[2], x[1]) };
  return { tipe: "kompleks", nilai: t };
}

// ---------------------------------------------------------------------------
// Penguraian tulisan
// ---------------------------------------------------------------------------

const RE_AWAL_UPDATE = /^\s*UPDATE(?:\s+(?:LOW_PRIORITY|IGNORE))*\s+/i;
const RE_AWAL_DELETE = /^\s*DELETE(?:\s+(?:LOW_PRIORITY|QUICK|IGNORE))*\s+FROM\s+/i;
const RE_AWAL_INSERT = /^\s*(INSERT|REPLACE)(?:\s+(?:LOW_PRIORITY|DELAYED|HIGH_PRIORITY|IGNORE))*(?:\s+INTO)?\s+/i;

function uraiAssignments(m, d, s, dari, sampai) {
  const hasil = [];
  for (const bagian of pisahTingkat(m, d, s, dari, sampai, ",")) {
    const mb = topeng(bagian);
    const eq = mb.indexOf("=");
    if (eq < 0) return null;
    hasil.push({ kolom: namaKolom(bagian.slice(0, eq)), ekspresi: bagian.slice(eq + 1).trim() });
  }
  return hasil;
}

/**
 * Menguraikan satu tulisan data. Selalu mengembalikan objek; `terbaca:false`
 * (dengan `sebab`) bila bentuknya di luar yang dipahami.
 */
function uraiTulisan(pernyataan) {
  const s = String(pernyataan).trim();
  const m = topeng(s);
  const d = kedalaman(m);
  const g = golongan(s);
  const dasar = { jenis: g, terbaca: false, sebab: "", skema: "", tabel: "", alias: "", tabelRujukan: "" };

  if (g === "UPDATE") {
    const awal = RE_AWAL_UPDATE.exec(m);
    if (!awal) return { ...dasar, sebab: "awal UPDATE tidak dikenal" };
    const set = cariKata(m, d, "SET", awal[0].length);
    if (!set) return { ...dasar, sebab: "klausa SET tidak ditemukan" };
    const rujukan = s.slice(awal[0].length, set.indeks).trim();
    const t = uraiRujukanTabel(rujukan);
    if (!t) return { ...dasar, sebab: "UPDATE beberapa tabel / gabungan (JOIN)" };
    const akhirSet = [cariKata(m, d, "WHERE", set.indeks + 3), cariKata(m, d, "ORDER\\s+BY", set.indeks + 3), cariKata(m, d, "LIMIT", set.indeks + 3)]
      .filter(Boolean)
      .map((x) => x.indeks);
    const batasSet = akhirSet.length ? Math.min(...akhirSet) : s.length;
    const assignments = uraiAssignments(m, d, s, set.indeks + 3, batasSet);
    if (!assignments || !assignments.length) return { ...dasar, sebab: "isi SET tidak terbaca" };
    const where = cariKata(m, d, "WHERE", set.indeks + 3);
    const ol = [cariKata(m, d, "ORDER\\s+BY", set.indeks + 3), cariKata(m, d, "LIMIT", set.indeks + 3)].filter(Boolean).map((x) => x.indeks);
    const olMulai = ol.length ? Math.min(...ol) : -1;
    return {
      ...dasar,
      terbaca: true,
      skema: t.skema,
      tabel: t.tabel,
      alias: t.alias,
      tabelRujukan: rujukan,
      assignments,
      kolomUbah: assignments.map((a) => a.kolom),
      where: where ? s.slice(where.indeks + 5, olMulai >= 0 ? olMulai : s.length).trim() : "",
      urutBatas: olMulai >= 0 ? s.slice(olMulai).trim() : "",
    };
  }

  if (g === "DELETE") {
    const awal = RE_AWAL_DELETE.exec(m);
    if (!awal) return { ...dasar, sebab: "DELETE beberapa tabel" };
    if (cariKata(m, d, "USING", awal[0].length)) return { ...dasar, sebab: "DELETE dengan USING" };
    const batas = [cariKata(m, d, "WHERE", awal[0].length), cariKata(m, d, "ORDER\\s+BY", awal[0].length), cariKata(m, d, "LIMIT", awal[0].length)]
      .filter(Boolean)
      .map((x) => x.indeks);
    const akhirRujukan = batas.length ? Math.min(...batas) : s.length;
    const rujukan = s.slice(awal[0].length, akhirRujukan).trim();
    const t = uraiRujukanTabel(rujukan);
    if (!t) return { ...dasar, sebab: "tabel DELETE tidak terbaca" };
    const where = cariKata(m, d, "WHERE", awal[0].length);
    const ol = [cariKata(m, d, "ORDER\\s+BY", awal[0].length), cariKata(m, d, "LIMIT", awal[0].length)].filter(Boolean).map((x) => x.indeks);
    const olMulai = ol.length ? Math.min(...ol) : -1;
    return {
      ...dasar,
      terbaca: true,
      skema: t.skema,
      tabel: t.tabel,
      alias: t.alias,
      tabelRujukan: rujukan,
      kolomUbah: [],
      where: where ? s.slice(where.indeks + 5, olMulai >= 0 ? olMulai : s.length).trim() : "",
      urutBatas: olMulai >= 0 ? s.slice(olMulai).trim() : "",
    };
  }

  if (g === "INSERT" || g === "REPLACE") {
    const awal = RE_AWAL_INSERT.exec(m);
    if (!awal) return { ...dasar, sebab: "awal INSERT tidak dikenal" };
    const sisaAsli = s.slice(awal[0].length);
    const t = RE_RUJUKAN_TABEL_INSERT.exec(sisaAsli);
    if (!t) return { ...dasar, sebab: "tabel INSERT tidak terbaca" };
    const A = lepasPetik(t[1]);
    const B = t[2] ? lepasPetik(t[2]) : "";
    const skema = B ? A : "";
    const tabel = B || A;
    let posisi = awal[0].length + t[0].length;
    const onDup = cariKata(m, d, "ON\\s+DUPLICATE\\s+KEY\\s+UPDATE", posisi);
    const akhirIsi = onDup ? onDup.indeks : s.length;
    const base = { ...dasar, skema, tabel, alias: "", tabelRujukan: B ? `${A}.${B}` : A, onDuplicate: Boolean(onDup), kolomUbah: [] };

    // Kolom (opsional).
    let kolom = null;
    while (posisi < s.length && /\s/.test(s[posisi])) posisi += 1;
    if (s[posisi] === "(" && m[posisi] === "(") {
      let tutup = -1;
      for (let i = posisi + 1; i < m.length; i += 1) {
        if (m[i] === ")" && d[i] === d[posisi]) {
          tutup = i;
          break;
        }
      }
      if (tutup < 0) return { ...base, sebab: "daftar kolom INSERT tidak tertutup" };
      kolom = pisahTingkat(m, d, s, posisi + 1, tutup, ",", d[posisi] + 1).map(namaKolom);
      posisi = tutup + 1;
    }
    const values = cariKata(m, d, "VALUES?", posisi, akhirIsi);
    const set = cariKata(m, d, "SET", posisi, akhirIsi);
    const select = cariKata(m, d, "SELECT", posisi, akhirIsi);
    if (values && (!select || values.indeks < select.indeks)) {
      const baris = [];
      let i = values.indeks + values.panjang;
      while (i < akhirIsi) {
        if (m[i] === "(" && d[i] === 0) {
          let tutup = -1;
          for (let j = i + 1; j < akhirIsi; j += 1) {
            if (m[j] === ")" && d[j] === 0) {
              tutup = j;
              break;
            }
          }
          if (tutup < 0) return { ...base, sebab: "tanda kurung VALUES tidak tertutup" };
          baris.push(pisahTingkat(m, d, s, i + 1, tutup, ",", 1).map(nilaiLiteral));
          i = tutup + 1;
        } else {
          i += 1;
        }
      }
      if (!baris.length) return { ...base, sebab: "VALUES kosong" };
      return { ...base, terbaca: true, bentuk: "values", kolom, baris };
    }
    if (set && !select) {
      const assignments = uraiAssignments(m, d, s, set.indeks + 3, akhirIsi);
      if (!assignments || !assignments.length) return { ...base, sebab: "SET INSERT tidak terbaca" };
      return {
        ...base,
        terbaca: true,
        bentuk: "set",
        kolom: assignments.map((a) => a.kolom),
        baris: [assignments.map((a) => nilaiLiteral(a.ekspresi))],
      };
    }
    return { ...base, sebab: "INSERT ... SELECT tidak diuraikan" };
  }

  return { ...dasar, sebab: g === "DDL" ? "perubahan struktur (DDL)" : "pernyataan di luar INSERT/UPDATE/DELETE/REPLACE" };
}

/**
 * SELECT yang membaca baris yang AKAN terdampak UPDATE/DELETE (cuplikan lama).
 * Batasnya 501: lebih dari 500 baris = "terpotong", tidak diperiksa otomatis.
 */
const BATAS_CUPLIKAN = 500;
function susunSelectCuplikan(u) {
  if (!u || !u.terbaca || (u.jenis !== "UPDATE" && u.jenis !== "DELETE")) return null;
  const tabelKualifikasi = u.tabelRujukan;
  let urut = u.urutBatas || "";
  const adaLimit = /\bLIMIT\s+\d+/i.test(topeng(urut));
  if (!adaLimit) urut = `${urut} LIMIT ${BATAS_CUPLIKAN + 1}`.trim();
  return `SELECT * FROM ${tabelKualifikasi}${u.where ? ` WHERE ${u.where}` : ""}${urut ? ` ${urut}` : ""}`;
}

// ---------------------------------------------------------------------------
// Jam relatif -> literal
// ---------------------------------------------------------------------------

const POLA_JAM = [
  { re: /(?<![A-Za-z0-9_$.])(?:NOW|SYSDATE|LOCALTIME|LOCALTIMESTAMP|CURRENT_TIMESTAMP)\s*\(\s*\d*\s*\)/gi, bentuk: "dt" },
  { re: /(?<![A-Za-z0-9_$.])(?:LOCALTIME|LOCALTIMESTAMP|CURRENT_TIMESTAMP)(?![A-Za-z0-9_$(])/gi, bentuk: "dt" },
  { re: /(?<![A-Za-z0-9_$.])(?:CURDATE|CURRENT_DATE)\s*\(\s*\)/gi, bentuk: "d" },
  { re: /(?<![A-Za-z0-9_$.])CURRENT_DATE(?![A-Za-z0-9_$(])/gi, bentuk: "d" },
  { re: /(?<![A-Za-z0-9_$.])(?:CURTIME|CURRENT_TIME)\s*\(\s*\d*\s*\)/gi, bentuk: "t" },
  { re: /(?<![A-Za-z0-9_$.])CURRENT_TIME(?![A-Za-z0-9_$(])/gi, bentuk: "t" },
  { re: /(?<![A-Za-z0-9_$.])UTC_TIMESTAMP\s*\(\s*\d*\s*\)/gi, bentuk: "udt" },
  { re: /(?<![A-Za-z0-9_$.])UTC_DATE\s*\(\s*\)/gi, bentuk: "ud" },
  { re: /(?<![A-Za-z0-9_$.])UTC_TIME\s*\(\s*\d*\s*\)/gi, bentuk: "ut" },
];

function memuatJamRelatif(pernyataan) {
  const m = topeng(pernyataan);
  return POLA_JAM.some((p) => {
    p.re.lastIndex = 0;
    return p.re.test(m);
  });
}

/**
 * Mengganti jam relatif dengan literal. `jam` = { dt, d, t, udt, ud, ut }
 * (teks "YYYY-MM-DD HH:MM:SS" dst., menurut jam server SIPP yang disalin).
 */
function gantiJamRelatif(pernyataan, jam) {
  const s = String(pernyataan);
  const m = topeng(s);
  const temuan = [];
  for (const p of POLA_JAM) {
    p.re.lastIndex = 0;
    let x = p.re.exec(m);
    while (x) {
      temuan.push({ mulai: x.index, akhir: x.index + x[0].length, nilai: jam[p.bentuk] });
      x = p.re.exec(m);
    }
  }
  temuan.sort((a, b) => b.mulai - a.mulai);
  let hasil = s;
  let batas = Infinity;
  for (const t of temuan) {
    if (t.akhir > batas || t.nilai == null) continue; // tumpang tindih / tak ada nilai
    hasil = `${hasil.slice(0, t.mulai)}'${t.nilai}'${hasil.slice(t.akhir)}`;
    batas = t.mulai;
  }
  return hasil;
}

module.exports = {
  topeng,
  kedalaman,
  pecahPernyataan,
  golongan,
  adalahTulis,
  cariKata,
  pisahTingkat,
  lepasPetik,
  namaKolom,
  nilaiLiteral,
  uraiTulisan,
  susunSelectCuplikan,
  BATAS_CUPLIKAN,
  memuatJamRelatif,
  gantiJamRelatif,
};
