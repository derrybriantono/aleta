"use strict";

/**
 * ============================================================================
 * BLOK TANDA TANGAN DI RTF - DIBACA PER BARIS DAN PER SEL TABEL (3 Nov 2026)
 * ============================================================================
 *
 * Diukur atas blangko Derry sungguhan (putusan [01] [Kabul Verstek] Cerai (Format Lengkap) dan BAS ALUR 04 [3]) yang dirender
 * seperti ABT, lalu diubah LibreOffice 7.4 container bot - sama letaknya dengan PDF 633/Pdt.G/2026 dan 631/Pdt.G/2026:
 *
 *   1. Putusan: blok majelis berasal dari variabel #8500# = TABEL. Tiap sel SATU paragraf (\pard) berisi
 *      "Ketua Majelis,\par\par\par\par \b <nama>\b0\cell". Pembaca lama memotong naskah hanya di \pard, sehingga label dan nama
 *      terbaca "Ketua Majelis,Himawan ..." - bukan label - dan "ttd" tidak pernah ditulis.
 *   2. BAS: satu baris tabel, DUA sel ("Panitera Sidang," / 3 baris kosong / nama | "Ketua Majelis," / 3 baris kosong / nama).
 *      Isi sel pertama seluruhnya tertulis lebih dulu, baru sel kedua; pembaca lama merangkai baris lintas sel menjadi
 *      "Qadariyah, S.H.<tab>Ketua Majelis," sehingga pasangan label-nama tidak ditemukan dan tanda tangan asli tidak dibubuhkan.
 *   3. Baris tabel tanda tangan BAS tanpa \trkeep TERBELAH oleh LibreOffice: label di dasar halaman 2, nama di halaman 3.
 *
 * Berkas ini membaca RTF menjadi BARIS (diakhiri \par, \line, \cell, \row, \sect, \page) beserta letak sel tabelnya, tanpa
 * menebak dari potongan \pard. Fungsi MURNI: tidak membaca basis data, tidak menulis ke mana pun.
 */

/**
 * Label tempat tanda tangan pejabat persidangan. "Panitera," ikut (3 Nov): #6034#/#8556# menulis "Panitera" bila panitera
 * sidang adalah Panitera sendiri. Blok "Untuk Salinan" tidak terbaca sebagai pejabat persidangan karena pemanggil membatasi
 * wilayahnya sebelum blok itu (putusan) - lihat salinanPutusanService.
 */
const LABEL_PEJABAT = /^(ketua majelis|hakim ketua|hakim anggota|hakim tunggal|hakim|panitera sidang|panitera pengganti|panitera),?$/i;

/** Kelompok tujuan yang isinya bukan teks naskah (tabel huruf, gambar, bentuk, kode field, kepala/kaki halaman, dst.). */
const TUJUAN_LEWAT = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "shp",
  "shpinst",
  "shprslt",
  "shpgrp",
  "nonshppict",
  "object",
  "objdata",
  "fldinst",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "xmlnstbl",
  "themedata",
  "colorschememapping",
  "latentstyles",
  "datastore",
  "generator",
  "pgdsctbl",
  "footnote",
  "annotation",
]);

const AKHIR_BARIS = new Set(["par", "line", "sect", "page", "cell", "nestcell", "row", "nestrow"]);

/**
 * RTF -> baris. Tiap baris: { teks, awal, ujungMulai, ujungAkhir, jenis, intbl, baris, sel, pardSebelum }.
 *   awal       - indeks sesudah pengakhir baris sebelumnya (atau `dari`)
 *   ujungMulai - indeks "\" kata pengakhir (\par, \cell, ...); ujungAkhir - sesudahnya (termasuk satu spasi pembatas)
 *   intbl      - paragrafnya di dalam tabel (\intbl) pada saat diakhiri; baris/sel = nomor baris tabel & sel (0..)
 *   pard       - indeks \pard terakhir sebelum pengakhir (-1 bila tidak ada sejak `dari`)
 * Juga: tabel[] = { baris, trowd: [indeks "\trowd"...], akhir: indeks sesudah "\row" }.
 */
function bacaBaris(rtf, dari = 0, sampai) {
  const s = String(rtf || "");
  const batas = Math.min(s.length, sampai === undefined ? s.length : sampai);
  const baris = [];
  const tabel = [];
  const tumpukan = [];
  let lewat = false;
  let teks = "";
  let awal = dari;
  let intbl = false;
  let nomorBaris = 0;
  let nomorSel = 0;
  let pardTerakhir = -1;
  let trowdKini = [];
  let lewatiUnicode = 0;
  let ucN = 1;
  let i = dari;

  const tutupBaris = (jenis, mulai, akhir) => {
    const dalamTabel = intbl || jenis === "cell" || jenis === "nestcell";
    baris.push({
      teks,
      awal,
      ujungMulai: mulai,
      ujungAkhir: akhir,
      jenis,
      intbl: dalamTabel,
      baris: dalamTabel ? nomorBaris : null,
      sel: dalamTabel ? nomorSel : null,
      pard: pardTerakhir,
    });
    teks = "";
    awal = akhir;
  };

  while (i < batas) {
    const c = s[i];
    if (c === "{") {
      tumpukan.push({ lewat, intbl });
      // {\* ...} atau {\kata ...} yang termasuk tujuan bukan-teks
      const m = /^\{\s*(\\\*)?\s*\\([a-zA-Z]+)/.exec(s.slice(i, i + 40));
      if (m && (m[1] || TUJUAN_LEWAT.has(m[2]))) lewat = true;
      i += 1;
      continue;
    }
    if (c === "}") {
      // Sifat paragraf (\intbl) ikut dipulihkan saat kelompok ditutup, sama seperti aturan RTF.
      const t = tumpukan.pop();
      if (t) {
        lewat = t.lewat;
        intbl = t.intbl;
      }
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    if (c !== "\\") {
      if (!lewat) {
        if (lewatiUnicode > 0) lewatiUnicode -= 1;
        else teks += c;
      }
      i += 1;
      continue;
    }
    // kendali
    const hex = /^\\'([0-9a-fA-F]{2})/.exec(s.slice(i, i + 4));
    if (hex) {
      if (!lewat) {
        if (lewatiUnicode > 0) lewatiUnicode -= 1;
        else teks += String.fromCharCode(parseInt(hex[1], 16));
      }
      i += 4;
      continue;
    }
    const kata = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 48));
    if (!kata) {
      const simbol = s[i + 1] || "";
      if (!lewat) {
        if (simbol === "{" || simbol === "}" || simbol === "\\") teks += simbol;
        else if (simbol === "~") teks += " ";
        else if (simbol === "_") teks += "-";
      }
      i += 2;
      continue;
    }
    const nama = kata[1];
    const nilai = kata[2] === undefined ? null : Number(kata[2]);
    const mulai = i;
    const akhir = i + kata[0].length;
    i = akhir;
    if (nama === "pard") {
      if (!lewat) {
        intbl = false;
        pardTerakhir = mulai;
      }
      continue;
    }
    if (nama === "intbl") {
      if (!lewat) intbl = true;
      continue;
    }
    if (nama === "trowd") {
      if (!lewat) trowdKini.push(mulai);
      continue;
    }
    if (lewat) continue;
    if (nama === "uc" && nilai !== null) {
      ucN = Math.max(0, nilai);
      continue;
    }
    if (nama === "u" && nilai !== null) {
      teks += String.fromCharCode(nilai < 0 ? nilai + 65536 : nilai);
      lewatiUnicode = ucN;
      continue;
    }
    if (nama === "tab") {
      teks += "\t";
      continue;
    }
    if (AKHIR_BARIS.has(nama)) {
      if (nama === "row" || nama === "nestrow") {
        if (teks.replace(/\s+/g, "")) tutupBaris("par", mulai, mulai);
        tabel.push({ baris: nomorBaris, trowd: trowdKini.slice(), akhir });
        trowdKini = [];
        nomorBaris += 1;
        nomorSel = 0;
        teks = "";
        awal = akhir;
        continue;
      }
      tutupBaris(nama, mulai, akhir);
      if (nama === "cell" || nama === "nestcell") nomorSel += 1;
      continue;
    }
  }
  if (teks.replace(/\s+/g, "")) tutupBaris("akhir", batas, batas);
  return { baris, tabel };
}

const rapat = (t) => String(t || "").replace(/[\s ]+/g, " ").trim();
const kosong = (t) => !rapat(t);
const adaTtd = (t) => /(^|\s)ttd\.?(\s|$)/i.test(rapat(t));
/** Kolom sebuah baris (dipisah tab / tiga spasi lebih). */
const kolom = (t) =>
  String(t || "")
    .split(/\t+| {3,}/)
    .map(rapat)
    .filter(Boolean);
/** Seluruh kolom baris berupa label pejabat. */
const barisLabel = (t) => {
  const k = kolom(t);
  return k.length > 0 && k.every((x) => LABEL_PEJABAT.test(x));
};
const barisNama = (t) => {
  const k = kolom(t).filter((x) => !/^ttd\.?$/i.test(x));
  return k.length > 0 && !k.every((x) => LABEL_PEJABAT.test(x)) && k.some((x) => /[a-z]{3,}/i.test(x));
};

/** Baris-baris tabel dikelompokkan per sel: Map "baris:sel" -> baris[] berurutan. */
function selTabel(daftar) {
  const peta = new Map();
  for (const b of daftar) {
    if (!b.intbl || b.baris === null) continue;
    const kunci = `${b.baris}:${b.sel}`;
    if (!peta.has(kunci)) peta.set(kunci, []);
    peta.get(kunci).push(b);
  }
  return peta;
}

/**
 * Baris tabel yang tiap selnya paling banyak SATU baris berisi (label di satu baris tabel, nama di baris tabel lain) dibaca
 * seperti satu baris bertab "sel0<tab>sel1..." - dipasangkan dengan cara baris biasa. Sel bertumpuk (label, kosong, nama
 * dalam satu sel) dibaca per sel.
 */
function barisTabelSebarisan(daftar) {
  const perBaris = new Map();
  for (const [kunci, sel] of selTabel(daftar)) {
    const [nb, ns] = kunci.split(":").map(Number);
    if (!perBaris.has(nb)) perBaris.set(nb, []);
    perBaris.get(nb).push({ ns, sel });
  }
  const hasil = [];
  for (const [, daftarSel] of perBaris) {
    if (daftarSel.some((x) => x.sel.filter((b) => !kosong(b.teks)).length > 1)) continue;
    const urut = daftarSel.sort((a, b) => a.ns - b.ns);
    const teks = urut.map((x) => rapat((x.sel.find((b) => !kosong(b.teks)) || { teks: "" }).teks)).join("\t");
    hasil.push({ teks, intbl: false, ujungMulai: urut[0].sel[0].ujungMulai, ujungAkhir: urut[urut.length - 1].sel.slice(-1)[0].ujungAkhir, tabel: true });
  }
  return hasil;
}

/**
 * Pasangan label -> nama penanda tangan. Di sel tabel bertumpuk: label dan nama dicari DI DALAM sel yang sama (sel lain
 * diabaikan). Di luar tabel (dan baris tabel sebarisan): baris label (boleh beberapa kolom bertab) dipasangkan dengan baris
 * berisi berikutnya yang jumlah kolomnya sama. Hasil: [{ label, nama, indeks }] urut letak di naskah; nama ganda hanya sekali.
 */
function pasanganPejabat(daftar) {
  const hasil = [];
  for (const sel of selTabel(daftar).values()) {
    for (let k = 0; k < sel.length; k += 1) {
      if (!barisLabel(sel[k].teks) || kolom(sel[k].teks).length !== 1) continue;
      for (let j = k + 1; j < sel.length; j += 1) {
        if (kosong(sel[j].teks) || /^ttd\.?$/i.test(rapat(sel[j].teks))) continue;
        if (barisNama(sel[j].teks)) hasil.push({ label: rapat(sel[k].teks).replace(/,$/, ""), nama: rapat(sel[j].teks), indeks: sel[k].ujungMulai });
        break;
      }
    }
  }
  const luar = [...daftar.filter((b) => !b.intbl), ...barisTabelSebarisan(daftar)].sort((a, b) => a.ujungMulai - b.ujungMulai);
  for (let k = 0; k < luar.length; k += 1) {
    const label = kolom(luar[k].teks);
    if (!barisLabel(luar[k].teks)) continue;
    for (let j = k + 1; j < luar.length && j <= k + 12; j += 1) {
      const isi = kolom(luar[j].teks).filter((x) => !/^ttd\.?$/i.test(x));
      if (!isi.length) continue;
      if (isi.every((x) => LABEL_PEJABAT.test(x))) break;
      if (isi.length === label.length) {
        isi.forEach((nama, n) => {
          if (/[a-z]{3,}/i.test(nama)) hasil.push({ label: label[n].replace(/,$/, ""), nama, indeks: luar[k].ujungMulai + n });
        });
      }
      break;
    }
  }
  const sudah = new Set();
  return hasil
    .sort((a, b) => a.indeks - b.indeks)
    .filter((p) => {
      const kunci = p.nama.toLowerCase();
      if (sudah.has(kunci)) return false;
      sudah.add(kunci);
      return true;
    });
}

/**
 * Tempat "ttd" pada label yang SEPARAGRAF (satu \pard) dengan baris kosong dan namanya - sel tabel #8500# ("Label,\par\par\par
 * \par \b nama") maupun paragraf bertab yang dipisah \line. Tiap temuan: { label, kosong (baris kosong pertama), nama, sudahAda }.
 * Label yang baris kosong sesudahnya ber-\pard sendiri TIDAK diambil di sini (dikerjakan cara lama: paragraf label disalin).
 */
function tempatTtdSeparagraf(rtf, daftar) {
  const s = String(rtf || "");
  const hasil = [];
  const periksa = (urut) => {
    for (let k = 0; k < urut.length; k += 1) {
      const label = urut[k];
      if (!barisLabel(label.teks)) continue;
      let j = k + 1;
      const kosongan = [];
      let ttd = false;
      while (j < urut.length && (kosong(urut[j].teks) || adaTtd(urut[j].teks)) && j <= k + 10) {
        if (adaTtd(urut[j].teks)) ttd = true;
        else kosongan.push(urut[j]);
        j += 1;
      }
      const nama = urut[j];
      if (!nama || !barisNama(nama.teks)) continue;
      // Seluruhnya satu paragraf: tidak ada \pard di antara akhir label dan akhir nama.
      if (/\\pard(?![a-z])/.test(s.slice(label.ujungAkhir, nama.ujungMulai))) continue;
      hasil.push({ label, kosong: kosongan[0] || null, nama, sudahAda: ttd, jumlah: kolom(label.teks).length });
      k = j;
    }
  };
  for (const sel of selTabel(daftar).values()) periksa(sel);
  periksa(daftar.filter((b) => !b.intbl));
  return hasil;
}

/** Teks "ttd" sejajar kolom baris label: tiap label diganti "ttd", tab dipertahankan (\tab). */
function kerangkaTtd(teksLabel) {
  return String(teksLabel || "")
    .split(/(\t+)/)
    .map((bagian) => {
      if (/^\t+$/.test(bagian)) return "\\tab ".repeat(bagian.length);
      const k = rapat(bagian);
      if (!k) return "";
      return LABEL_PEJABAT.test(k) ? "ttd" : k.replace(/[\\{}]/g, (x) => `\\${x}`);
    })
    .join("");
}

/**
 * Baris tabel yang memuat blok tanda tangan (label pejabat lalu nama di sel yang sama) diberi \trkeep - "jangan terbelah
 * halaman" - supaya LibreOffice tidak memisahkan label dari namanya (BAS 631/Pdt.G/2026: label di halaman 2, nama di halaman 3).
 * Baris itu utuh pindah ke halaman berikutnya bila tidak muat; jumlah halaman tidak bertambah karena isinya memang sudah
 * menyeberang. Baris yang sudah ber-\trkeep (#8500#) dan tabel lain (agenda, rincian biaya) tidak disentuh.
 */
function jagaBarisTandaTangan(rtf) {
  const s = String(rtf || "");
  if (!/\\trowd/.test(s) || !/\\cell(?![a-z])/.test(s)) return { rtf: s, diubah: 0 };
  const { baris, tabel } = bacaBaris(s);
  const ditandai = new Set();
  for (const [kunci, sel] of selTabel(baris)) {
    for (let k = 0; k < sel.length; k += 1) {
      if (!barisLabel(sel[k].teks)) continue;
      const nama = sel.slice(k + 1).find((b) => !kosong(b.teks) && !adaTtd(b.teks));
      if (nama && barisNama(nama.teks)) {
        ditandai.add(Number(kunci.split(":")[0]));
        break;
      }
    }
  }
  const sisip = [];
  let diubah = 0;
  for (const t of tabel) {
    if (!ditandai.has(t.baris) || !t.trowd.length) continue;
    const wilayah = s.slice(t.trowd[0], t.akhir);
    if (/\\trkeep(?![a-z])/.test(wilayah)) continue;
    for (const p of t.trowd) sisip.push(p + "\\trowd".length);
    diubah += 1;
  }
  if (!sisip.length) return { rtf: s, diubah: 0 };
  let hasil = s;
  // "\trowd" + "\trkeep": kata kendali berikutnya tetap terpisah karena keduanya diawali "\".
  for (const p of sisip.sort((a, b) => b - a)) hasil = `${hasil.slice(0, p)}\\trkeep${hasil.slice(p)}`;
  return { rtf: hasil, diubah };
}

module.exports = { LABEL_PEJABAT, bacaBaris, pasanganPejabat, tempatTtdSeparagraf, kerangkaTtd, jagaBarisTandaTangan, selTabel, kolom, barisLabel, barisNama };
