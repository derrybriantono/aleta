"use strict";

/**
 * ============================================================================
 * BENTUK DI PARAGRAF KOSONG PENUTUP BAGIAN - DIPERTAHANKAN SEPERTI DI WORD (3 Nov 2026)
 * ============================================================================
 *
 * Diukur dengan LibreOffice 7.4.7 SERVER (container aleta-bot): paragraf yang HANYA berisi bentuk lalu \sect dibuang LibreOffice dan
 * bentuknya ditambatkan ke paragraf PERTAMA bagian berikut (halaman baru). Word/WPS menggambarnya di bawah paragraf sebelumnya, di
 * halaman yang sama.
 *
 * Kasus nyata: BAS ALUR 04 [3] "... Jawaban (dan Gugatan Rekonvensi bila ada)" BAS 631/Pdt.G/2026 (uji tangan Derry 2 Nov, layar-5/6).
 * Tanda Z blangko ("SC Z 1x" + grup garis Z) berada di paragraf #12030#; sesudah dirender isian itu menjadi paragraf-paragraf ber-\par
 * (jawaban tertulis, atau "..." bila kosong) sehingga paragraf tanda Z tinggal KOSONG -> di PDF garis Z dan "SC Z 1x / tanggal" menimpa
 * "Selanjutnya Ketua Majelis menyatakan ..." di halaman 2, padahal halaman 1 bagian bawah kosong.
 *
 * Perbaikan: paragraf seperti itu diberi satu spasi tak terpecah (\~) sebelum \sect - paragrafnya dipertahankan LibreOffice persis
 * seperti di Word. Ini JARING PENGAMAN untuk naskah yang tidak melewati Z otomatis (cetak massal, unggahan lama): Z otomatis sendiri
 * membuang tanda Z lama dan menambatkan Z barunya di paragraf bertulisan.
 *
 * Berkas terpisah dari rtfSofficeRapi.js supaya perubahan paralel di sana (baris tanda tangan) tidak bertabrakan. Fungsi MURNI atas teks
 * RTF (latin1); paragraf bertulisan, paragraf tanpa bentuk, dan isi kepala/kaki halaman tidak disentuh.
 */

/** Tujuan RTF yang isinya bukan teks badan naskah (tabel huruf/warna, kepala/kaki halaman, gambar, isi bentuk, catatan, field). */
const TUJUAN_BUKAN_BADAN = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf", "pict",
  "shp", "shpgrp", "shpinst", "shprslt", "shptxt", "listtable", "listoverridetable", "rsidtbl", "generator", "themedata", "colorschememapping",
  "datastore", "latentstyles", "pgdsctbl", "fldinst", "footnote", "annotation", "xmlnstbl", "mmathpr", "background", "object", "objdata",
  "nonshppict", "listtext", "pntext", "revtbl", "userprops",
]);

/** Teks RTF -> { rtf, diubah }: \~ disisipkan sebelum tiap \sect yang menutup paragraf tanpa tulisan tetapi berbentuk. */
function rapikanBentukAkhirBagian(rtf) {
  const s = String(rtf || "");
  if (!/\\sect(?![a-z])/.test(s) || !/\{\\shp(?:grp)?[\s\\{]/.test(s)) return { rtf: s, diubah: 0 };
  const sisip = [];
  const tumpuk = [];
  let abaikan = false;
  let bertulisan = false;
  let berbentuk = false;
  let lewati = 0; // karakter cadangan sesudah \uN
  let uc = 1;
  const n = s.length;
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === "{") {
      tumpuk.push({ abaikan, uc });
      let j = i + 1;
      while (j < n && (s[j] === "\r" || s[j] === "\n")) j += 1;
      if (s[j] === "\\") {
        if (s[j + 1] === "*") abaikan = true;
        else {
          const m = /^\\([a-zA-Z]+)/.exec(s.slice(j, j + 24));
          const nama = m ? m[1].toLowerCase() : "";
          if ((nama === "shp" || nama === "shpgrp") && !abaikan) berbentuk = true;
          if (TUJUAN_BUKAN_BADAN.has(nama)) abaikan = true;
        }
      }
      i += 1;
      continue;
    }
    if (c === "}") {
      const t = tumpuk.pop();
      if (t) {
        abaikan = t.abaikan;
        uc = t.uc;
      }
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "\\") {
      const d = s[i + 1];
      if (d === undefined) break;
      if (d === "'") {
        if (lewati > 0) lewati -= 1;
        else if (!abaikan) bertulisan = true;
        i += 4;
        continue;
      }
      if (!/[a-zA-Z]/.test(d)) {
        // simbol kendali: \~ \- \_ \\ \{ \} = tulisan; \* sudah ditangani di awal grup
        if (!abaikan && d !== "*" && d !== "\r" && d !== "\n") bertulisan = true;
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < n && /[a-zA-Z]/.test(s[j])) j += 1;
      const nama = s.slice(i + 1, j);
      let param = "";
      if (s[j] === "-" || (s[j] >= "0" && s[j] <= "9")) {
        let k = j;
        if (s[k] === "-") k += 1;
        while (k < n && s[k] >= "0" && s[k] <= "9") k += 1;
        param = s.slice(j, k);
        j = k;
      }
      if (s[j] === " ") j += 1;
      if (nama === "bin") {
        i = j + (Number(param) || 0);
        continue;
      }
      if (nama === "uc") uc = Number(param) || 0;
      else if (nama === "u") {
        if (!abaikan) bertulisan = true;
        lewati = uc;
      } else if (!abaikan && (nama === "par" || nama === "cell" || nama === "row")) {
        bertulisan = false;
        berbentuk = false;
      } else if (!abaikan && nama === "sect") {
        if (!bertulisan && berbentuk) sisip.push(i);
        bertulisan = false;
        berbentuk = false;
      } else if (!abaikan && /^(?:tab|line|emdash|endash|bullet|lquote|rquote|ldblquote|rdblquote|emspace|enspace|chpgn)$/.test(nama)) {
        bertulisan = true;
      }
      i = j;
      continue;
    }
    if (lewati > 0) lewati -= 1;
    else if (!abaikan && c !== " ") bertulisan = true;
    i += 1;
  }
  if (!sisip.length) return { rtf: s, diubah: 0 };
  let hasil = s;
  for (const pos of sisip.sort((a, b) => b - a)) hasil = `${hasil.slice(0, pos)}\\~${hasil.slice(pos)}`;
  return { rtf: hasil, diubah: sisip.length };
}

/** Buffer RTF -> Buffer (apa adanya bila bukan RTF, memuat data biner mentah, atau tidak ada yang dirapikan). */
function rapikanBentukAkhirBagianBuffer(isi) {
  if (!Buffer.isBuffer(isi) || isi.length < 6 || isi.subarray(0, 5).toString("latin1") !== "{\\rtf") return isi;
  const teks = isi.toString("latin1");
  if (/\\bin\d/.test(teks)) return isi;
  const h = rapikanBentukAkhirBagian(teks);
  return h.diubah ? Buffer.from(h.rtf, "latin1") : isi;
}

module.exports = { rapikanBentukAkhirBagian, rapikanBentukAkhirBagianBuffer };
