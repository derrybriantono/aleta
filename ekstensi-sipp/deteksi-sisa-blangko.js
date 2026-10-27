"use strict";

/**
 * ============================================================================
 * DETEKSI SISA BLANGKO / PERBAIKAN PADA PUTUSAN, BAS, DAN RELAAS (17 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim PA Donggala: setiap naskah putusan, BAS, dan relaas yang
 * diunggah atau diunduh diperiksa dulu - masih adakah sisa tulisan blangko atau
 * catatan perbaikan yang lupa dibersihkan:
 *
 *   - kurung siku: [ ]  [...]  [nama]  [[...]]
 *   - tanda isian: #1234#  {{...}}  <<...>>  "placeholder"  "isi di sini"  XXXX
 *   - catatan perbaikan: "perlu di review", "perlu dicek", "periksa kembali", TODO
 *   - titik-titik isian (...., ......) dan garis isian (____)
 *   - tulisan berwarna MERAH (tabel warna RTF + \cfN, atau w:color di DOCX)
 *   - kalimat yang masih berbentuk blangko ("bin/binti", "pilih salah satu")
 *
 * PENGECUALIAN: "..." atau "…" di dalam kutipan yang dipotong (ayat, hadis,
 * kitab fiqh, pasal) BUKAN blangko - lihat dalamKutipan().
 *
 * PERILAKU: TIDAK MENAHAN. Bila ada temuan, tampil dialog yang menyebut apa
 * yang perlu diperbaiki, dengan pilihan "Unduh daftar masalah (.txt) lalu
 * lanjut", "Lanjut saja", dan "Batal". Tanpa temuan tidak ada dialog dan alur
 * lama berjalan persis seperti sebelumnya. Naskah yang tidak terbaca (PDF,
 * .doc biner) dilewati diam-diam.
 *
 * SATU ATURAN, DUA SALINAN: berkas ini adalah salinan JS murni dari
 * manajemen_surat/src/lib/deteksi-sisa-blangko.ts. Uji
 * deteksi-sisa-blangko-17okt mengadu keduanya atas masukan yang sama - ubah
 * aturan di KEDUA berkas.
 *
 * BATAS KERAS: modul ini TIDAK menulis apa pun ke SIPP/ABT. Dialog hanya hidup
 * di halaman (DOM), daftar masalah hanya diunduh ke komputer petugas.
 */
(function (akar) {
  "use strict";

  // ==========================================================================
  // Label (bahasa awam) dan urutan tampil
  // ==========================================================================
  const LABEL = {
    merah: "Tulisan berwarna merah",
    kurung: "Kurung siku yang belum diganti",
    tanda: "Tanda isian yang belum terganti",
    perbaikan: "Catatan perbaikan yang masih tertinggal",
    titik: "Titik-titik isian yang belum diisi",
    garis: "Garis isian yang belum diisi",
    kalimat: "Kalimat yang masih berbentuk blangko",
  };
  const URUTAN_JENIS = ["merah", "kurung", "tanda", "perbaikan", "titik", "garis", "kalimat"];
  const NAMA_NASKAH = { putusan: "putusan", bas: "berita acara sidang (BAS)", relaas: "relaas" };

  const BATAS_TEMUAN = 500;
  const HURUF_PER_HALAMAN = 2800;

  // ==========================================================================
  // Warna
  // ==========================================================================
  /** Merah atau mirip merah (C00000, FF0000, FF3333, 990000, FF6600...), bukan jingga/merah muda pucat. */
  function merahKah(r, g, b) {
    return r >= 140 && g <= 110 && b <= 110 && r - Math.max(g, b) >= 80;
  }

  const WARNA_HIGHLIGHT_MERAH = new Set(["red", "darkred"]);

  // ==========================================================================
  // Pembaca RTF -> paragraf { teks, merah:[[dari,sampai]], halaman }
  // ==========================================================================
  const CP1252 = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰",
    0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
    0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
  };
  const RTF_BUANG = new Set([
    "fonttbl", "colortbl", "stylesheet", "listtable", "listoverridetable", "rsidtbl", "generator", "info",
    "pict", "object", "themedata", "colorschememapping", "latentstyles", "datastore", "xmlnstbl",
    "wgrffmtfilter", "template", "filetbl", "revtbl", "background", "shppict", "nonshppict", "fchars",
    "lchars", "upr", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf",
    "pgdsctbl", "fldinst", "listtext", "pnseclvl",
  ]);
  const RTF_TEKS_KENDALI = {
    emdash: "—", endash: "–", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", bullet: "•",
    emspace: " ", enspace: " ", qmspace: " ",
  };

  /** Tabel warna RTF -> daftar indeks yang merah (indeks 0 = otomatis). */
  function indeksMerahRtf(rtf) {
    const awal = rtf.indexOf("{\\colortbl");
    const hasil = new Set();
    if (awal < 0) return hasil;
    let dalam = 0;
    let akhir = awal;
    for (; akhir < rtf.length; akhir += 1) {
      const c = rtf[akhir];
      if (c === "{") dalam += 1;
      else if (c === "}") {
        dalam -= 1;
        if (dalam === 0) break;
      }
    }
    const isi = rtf.slice(awal + "{\\colortbl".length, akhir);
    const bagian = isi.split(";");
    for (let k = 0; k < bagian.length - 1; k += 1) {
      const r = /\\red(\d+)/.exec(bagian[k]);
      const g = /\\green(\d+)/.exec(bagian[k]);
      const b = /\\blue(\d+)/.exec(bagian[k]);
      if (r && g && b && merahKah(Number(r[1]), Number(g[1]), Number(b[1]))) hasil.add(k);
    }
    return hasil;
  }

  function pembangunParagraf() {
    const daftar = [];
    let cur = { teks: "", merah: [], halaman: 1 };
    let keras = 0;
    let muatan = 0;
    let lastRendered = false;
    return {
      tulis(teks, merah) {
        if (!teks) return;
        const dari = cur.teks.length;
        // Halaman paragraf = halaman tempat tulisannya DIMULAI (pemisah halaman di tengah paragraf tidak memecahnya).
        if (cur.halamanMulai === undefined && /\S/.test(teks)) cur.halamanMulai = lastRendered ? keras + 1 : keras + 1 + Math.floor(muatan / HURUF_PER_HALAMAN);
        cur.teks += teks;
        if (merah && /\S/.test(teks)) {
          const akhir = cur.merah[cur.merah.length - 1];
          if (akhir && akhir[1] === dari) akhir[1] = cur.teks.length;
          else cur.merah.push([dari, cur.teks.length]);
        }
      },
      akhiriParagraf() {
        if (/\S/.test(cur.teks)) {
          muatan += cur.teks.length;
          cur.halaman = cur.halamanMulai === undefined ? 1 : cur.halamanMulai;
          cur.nomor = daftar.length + 1;
          daftar.push(cur);
        }
        cur = { teks: "", merah: [], halaman: 1 };
      },
      halamanBaru(nyata) {
        keras += 1;
        muatan = 0;
        if (nyata) lastRendered = true;
      },
      selesai() {
        this.akhiriParagraf();
        return daftar;
      },
    };
  }

  function bacaRtfParagraf(rtfMasuk) {
    const rtf = String(rtfMasuk == null ? "" : rtfMasuk);
    const merahIdx = indeksMerahRtf(rtf);
    const bangun = pembangunParagraf();
    const tumpuk = [];
    let k = { cf: 0, hl: 0, uc: 1, buang: false };
    let lewati = 0;
    let i = 0;
    const merahSekarang = () => merahIdx.has(k.cf) || merahIdx.has(k.hl);
    const tulis = (t) => {
      if (k.buang || !t) return;
      if (lewati > 0) {
        const pakai = Math.min(lewati, t.length);
        lewati -= pakai;
        t = t.slice(pakai);
        if (!t) return;
      }
      bangun.tulis(t, merahSekarang());
    };
    while (i < rtf.length) {
      const h = rtf[i];
      if (h === "{") {
        tumpuk.push(k);
        k = { cf: k.cf, hl: k.hl, uc: k.uc, buang: k.buang };
        // Tujuan yang bukan naskah: {\*...} atau kata tujuan yang dikenal tepat sesudah "{".
        const m = /^\{\s*\\(\*)?\s*\\?([a-zA-Z]+)?/.exec(rtf.slice(i, i + 40));
        if (m && (m[1] === "*" || (m[2] && RTF_BUANG.has(m[2])))) k.buang = true;
        i += 1;
        continue;
      }
      if (h === "}") {
        k = tumpuk.pop() || { cf: 0, hl: 0, uc: 1, buang: false };
        lewati = 0;
        i += 1;
        continue;
      }
      if (h === "\\") {
        const s = rtf[i + 1];
        if (s === "\\" || s === "{" || s === "}") {
          tulis(s);
          i += 2;
          continue;
        }
        if (s === "'") {
          const kode = Number.parseInt(rtf.slice(i + 2, i + 4), 16);
          if (!Number.isNaN(kode) && (kode >= 0x20 || kode === 0x09)) tulis(CP1252[kode] || String.fromCharCode(kode));
          i += 4;
          continue;
        }
        if (s === "~") {
          tulis(" ");
          i += 2;
          continue;
        }
        if (s === "-" || s === "_" || s === "|" || s === ":") {
          i += 2;
          continue;
        }
        if (s === "*") {
          i += 2;
          continue;
        }
        if (s === "\n" || s === "\r") {
          bangun.akhiriParagraf();
          i += 2;
          continue;
        }
        const c = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 64));
        if (!c) {
          i += 1;
          continue;
        }
        const kata = c[1];
        const angka = c[2] === undefined ? null : Number(c[2]);
        i += c[0].length;
        if (RTF_BUANG.has(kata)) {
          k.buang = true;
          continue;
        }
        switch (kata) {
          case "par":
          case "sect":
          case "cell":
          case "row":
            if (!k.buang) bangun.akhiriParagraf();
            break;
          case "line":
          case "tab":
            tulis(" ");
            break;
          case "page":
          case "pagebb":
            if (!k.buang) bangun.halamanBaru(false);
            break;
          case "cf":
            if (angka !== null) k.cf = angka;
            break;
          case "highlight":
          case "chcbpat":
            if (angka !== null) k.hl = angka;
            break;
          case "plain":
            k.cf = 0;
            k.hl = 0;
            break;
          case "uc":
            if (angka !== null) k.uc = angka;
            break;
          case "u":
            if (angka !== null) {
              tulis(String.fromCharCode(angka < 0 ? angka + 65536 : angka));
              lewati = k.uc;
            }
            break;
          case "bin":
            if (angka && angka > 0) i += angka;
            break;
          default:
            if (Object.prototype.hasOwnProperty.call(RTF_TEKS_KENDALI, kata)) tulis(RTF_TEKS_KENDALI[kata]);
            break;
        }
        continue;
      }
      if (h === "\r" || h === "\n") {
        i += 1;
        continue;
      }
      let j = i;
      while (j < rtf.length && rtf[j] !== "\\" && rtf[j] !== "{" && rtf[j] !== "}" && rtf[j] !== "\r" && rtf[j] !== "\n") j += 1;
      tulis(rtf.slice(i, j));
      i = j;
    }
    return bangun.selesai();
  }

  // ==========================================================================
  // Pembaca DOCX (word/document.xml) -> paragraf
  // ==========================================================================
  function dekodeXml(s) {
    return String(s)
      .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function bacaDocxXml(xmlMasuk) {
    const xml = String(xmlMasuk == null ? "" : xmlMasuk);
    const bangun = pembangunParagraf();
    const adaRender = /<w:lastRenderedPageBreak\b/.test(xml);
    const paragrafRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
    let pm;
    while ((pm = paragrafRe.exec(xml))) {
      const p = pm[0];
      if (/<w:pageBreakBefore\b(?![^>]*w:val="(?:0|false)")/.test(p) && !adaRender) bangun.halamanBaru(false);
      const runRe = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
      let rm;
      while ((rm = runRe.exec(p))) {
        const r = rm[0];
        const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r);
        let merah = false;
        if (rpr) {
          const w = /<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(rpr[1]);
          if (w) {
            const n = parseInt(w[1], 16);
            merah = merahKah((n >> 16) & 255, (n >> 8) & 255, n & 255);
          }
          const hl = /<w:highlight\b[^>]*\bw:val="([A-Za-z]+)"/.exec(rpr[1]);
          if (hl && WARNA_HIGHLIGHT_MERAH.has(hl[1].toLowerCase())) merah = true;
        }
        // Isi run berurutan: teks, tab, penanda halaman.
        const isiRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b([^>]*)\/>|<w:lastRenderedPageBreak\s*\/>/g;
        let im;
        while ((im = isiRe.exec(r))) {
          if (im[1] !== undefined) bangun.tulis(dekodeXml(im[1]), merah);
          else if (im[0].startsWith("<w:tab")) bangun.tulis(" ", false);
          else if (im[0].startsWith("<w:lastRendered")) bangun.halamanBaru(true);
          else if (/w:type="page"/.test(im[2] || "")) {
            if (!adaRender) bangun.halamanBaru(false);
          } else bangun.tulis(" ", false);
        }
      }
      bangun.akhiriParagraf();
    }
    return bangun.selesai();
  }

  // ==========================================================================
  // Teks biasa -> paragraf
  // ==========================================================================
  function paragrafDariTeks(teks) {
    const bangun = pembangunParagraf();
    for (const baris of String(teks == null ? "" : teks).split(/\r\n|\r|\n|\f/)) {
      bangun.tulis(baris, false);
      bangun.akhiriParagraf();
    }
    return bangun.selesai();
  }

  // ==========================================================================
  // Aturan
  // ==========================================================================
  const ARAB = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const PEMICU_KUTIPAN = /(?:firman\s+allah|firman[-\s]nya|sabda|bersabda|dalam\s+kitab|kitab|q\.?\s?s\.?|surat|surah|ayat|hadis|hadits|al[-\s]?qur['’]?an|hr\.|diriwayatkan|riwayat|pasal)\b/gi;

  // Aksara Arab yang terbaca sebagai deretan huruf Latin-1 beraksen (RTF berkode laman 1256) juga dianggap teks Arab.
  const ARAB_RUSAK = /[\u00c0-\u00ff]{3,}/;
  function dekatArab(p, dari, sampai) {
    const w = `${p.slice(Math.max(0, dari - 40), dari)} ${p.slice(sampai, sampai + 40)}`;
    return ARAB.test(w) || ARAB_RUSAK.test(w);
  }

  /** Apakah posisi ini di dalam tanda kutip yang belum tertutup (lurus, miring, atau guillemet)? */
  function diapitKutip(p, dari) {
    const sebelum = p.slice(0, dari);
    if (((sebelum.match(/"/g) || []).length) % 2 === 1) return true;
    if (Math.max(sebelum.lastIndexOf("“"), sebelum.lastIndexOf("«")) > Math.max(sebelum.lastIndexOf("”"), sebelum.lastIndexOf("»"))) return true;
    if (sebelum.lastIndexOf("‘") > sebelum.lastIndexOf("’")) return true;
    // Kutip tunggal lurus yang BUKAN apostrof (tidak diapit huruf/angka di kedua sisi).
    const tunggal = sebelum.match(/(?<![\p{L}\p{N}])'|'(?![\p{L}\p{N}])/gu) || [];
    return tunggal.length % 2 === 1;
  }

  /** Didahului kata pemicu kutipan dan sudah ada isi kutipan (>= 15 huruf) sebelum titik-titiknya. */
  function didahuluiPemicu(p, dari) {
    const jendela = p.slice(Math.max(0, dari - 260), dari);
    let akhirPemicu = -1;
    const re = new RegExp(PEMICU_KUTIPAN.source, "gi");
    let m;
    while ((m = re.exec(jendela))) akhirPemicu = m.index + m[0].length;
    if (akhirPemicu < 0) return false;
    const antara = jendela.slice(akhirPemicu);
    return (antara.match(/\p{L}/gu) || []).length >= 15;
  }

  const TANDA_KUTIP = /["“”‘’'«»]/;
  /** Titik-titik di dalam kutipan yang dipotong (ayat, hadis, kitab, pasal) bukan blangko. */
  function dalamKutipan(p, dari, sampai) {
    // "…" dihitung 2 titik. Titik-titik panjang tetap blangko walau berada di dalam kutip.
    const potongan = p.slice(dari, sampai);
    const satuan = (potongan.match(/\./g) || []).length + 2 * (potongan.match(/…/g) || []).length;
    const kiri = p.slice(0, dari).trimEnd().slice(-1);
    const kanan = p.slice(sampai).trimStart().slice(0, 1);
    const kutipKiri = TANDA_KUTIP.test(kiri);
    const kutipKanan = TANDA_KUTIP.test(kanan);
    // Kutipan yang isinya HANYA titik-titik ("...." / '....') adalah isian kosong.
    if (kutipKiri && kutipKanan) return false;
    // Berdampingan dengan teks Arab: titik-titik pengganti bagian yang dipotong (sampai 8 titik).
    if (dekatArab(p, dari, sampai)) return satuan <= 8;
    if (satuan > 4) return false;
    // Pemotongan di awal atau akhir kutipan: tepat di samping satu tanda kutip.
    if (kutipKiri || kutipKanan) return true;
    return diapitKutip(p, dari) || didahuluiPemicu(p, dari);
  }

  const ATURAN = [
    {
      jenis: "kurung",
      re: /\[\[[^\]]{0,200}\]\]|\[[^\[\]]{0,200}\]/g,
      lewat(isi, p, dari, sampai) {
        const dalam = isi.replace(/^\[+|\]+$/g, "").trim();
        if (/^\d+$/.test(dalam) || /^sic$/i.test(dalam)) return true;
        // Keterangan terbitan pustaka ([Beirut: Dar al-Fikr, 1990], [t.th.]) bukan isian.
        if (/\b(?:1[3-9]|20)\d{2}\b|\bt\.?\s?th\b/i.test(dalam) && /[:,]/.test(dalam)) return true;
        if (dekatArab(p, dari, sampai) && /^[….\s]*$/.test(dalam)) return true;
        if (/^[….\s]+$/.test(dalam) && dalam && dalamKutipan(p, dari, sampai)) return true;
        return false;
      },
    },
    { jenis: "tanda", re: /#\d{2,6}#/g },
    { jenis: "tanda", re: /\{\{[^{}]{0,120}\}\}/g },
    { jenis: "tanda", re: /<<[^<>]{0,120}>>/g },
    { jenis: "tanda", re: /\bplace\s?holder\b/gi },
    { jenis: "tanda", re: /\bisi\s+(?:di\s?)?sini\b/gi },
    { jenis: "tanda", re: /(?<![A-Za-z0-9])X{4,}(?![A-Za-z0-9])/g },
    { jenis: "perbaikan", re: /\bperlu\s+(?:di\s?)?(?:review|reviu|cek|check)\w*/gi },
    { jenis: "perbaikan", re: /\bperiksa\s+kembali\b/gi },
    { jenis: "perbaikan", re: /\bTODO\b/gi },
    {
      jenis: "titik",
      // Satu "gugus" titik: tiga titik atau lebih (boleh berspasi satu) atau "…", dengan sambungan titik di sebelahnya.
      re: /(?:\u2026|\.{3}|(?:\.[\u00a0 ]){2}\.)(?:[\u00a0 ]?(?:\u2026|\.))*/g,
      lewat(_isi, p, dari, sampai) {
        // Titik pengantar antara uraian dan nominal biaya ("Biaya panggilan ........ Rp. 60.000,-") bukan isian.
        if (/^[\u00a0 ]*Rp\b/i.test(p.slice(sampai, sampai + 12))) return true;
        return dalamKutipan(p, dari, sampai);
      },
    },
    {
      jenis: "garis",
      re: /_{3,}/g,
      lewat(_isi, p) {
        // Baris pemisah yang seluruhnya garis bawah/strip bukan isian.
        return /^[\s_\-=*+]*$/.test(p);
      },
    },
    { jenis: "kalimat", re: /\bbin\s*\/\s*binti\b|\bbinti\s*\/\s*bin\b/gi },
    { jenis: "kalimat", re: /\b(?:pilih|pilihlah)\s+salah\s+satu(?:nya)?\b|\b(?:coret|hapus)\s+yang\s+tidak\s+(?:perlu|sesuai|diperlukan)\b/gi },
  ];

  function potong(teks, maks) {
    const t = String(teks).replace(/\s+/g, " ").trim();
    return t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t;
  }

  function kutipanSekitar(p, dari, sampai) {
    const lebarKiri = 50;
    const lebarKanan = 50;
    let sebelum = p.slice(Math.max(0, dari - lebarKiri), dari);
    let sesudah = p.slice(sampai, sampai + lebarKanan);
    if (dari > lebarKiri) sebelum = `…${sebelum.replace(/^\S*\s/, "")}`;
    if (sampai + lebarKanan < p.length) sesudah = `${sesudah.replace(/\s\S*$/, "")}…`;
    return {
      sebelum: sebelum.replace(/\s+/g, " ").trimStart(),
      cocok: potong(p.slice(dari, sampai), 120),
      sesudah: sesudah.replace(/\s+/g, " ").trimEnd(),
    };
  }

  /** Periksa daftar paragraf -> { temuan, jumlahParagraf, jumlahHalaman, terpotong }. */
  function periksaParagraf(daftar) {
    const temuan = [];
    let terpotong = 0;
    for (const par of daftar) {
      const p = par.teks.replace(/\u00a0/g, " ");
      const rentang = [];
      // Merah lebih dulu: satu temuan per rentang merah.
      // Rentang merah yang hanya dipisah spasi digabung: "Saksi kenal dengan" satu temuan, bukan tiga.
      const gabung = [];
      for (const r of par.merah) {
        const akhir = gabung[gabung.length - 1];
        if (akhir && /^\s*$/.test(p.slice(akhir[1], r[0]))) akhir[1] = r[1];
        else gabung.push([r[0], r[1]]);
      }
      for (const [dari, sampai] of gabung) {
        // Tanda baca saja yang berwarna merah (",", ";", "-") bukan sisa tulisan.
        if (!/[\p{L}\p{N}]/u.test(p.slice(dari, sampai))) continue;
        rentang.push({ jenis: "merah", dari, sampai });
      }
      for (const a of ATURAN) {
        for (const m of p.matchAll(a.re)) {
          const dari = m.index;
          const sampai = dari + m[0].length;
          if (a.lewat && a.lewat(m[0], p, dari, sampai)) continue;
          rentang.push({ jenis: a.jenis, dari, sampai });
        }
      }
      // Sisihkan yang seluruhnya berada di dalam rentang lain yang lebih "besar" (merah, kurung, tanda).
      const pemenang = rentang.filter((r) => {
        for (const o of rentang) {
          if (o === r) continue;
          const lebihBesar = o.sampai - o.dari > r.sampai - r.dari || (o.sampai - o.dari === r.sampai - r.dari && URUTAN_JENIS.indexOf(o.jenis) < URUTAN_JENIS.indexOf(r.jenis));
          if (o.dari <= r.dari && o.sampai >= r.sampai && lebihBesar) return false;
        }
        return true;
      });
      pemenang.sort((x, y) => x.dari - y.dari);
      for (const r of pemenang) {
        if (temuan.length >= BATAS_TEMUAN) {
          terpotong += 1;
          continue;
        }
        const k = kutipanSekitar(p, r.dari, r.sampai);
        temuan.push({
          jenis: r.jenis,
          label: LABEL[r.jenis],
          sebelum: k.sebelum,
          cocok: k.cocok,
          sesudah: k.sesudah,
          paragraf: par.nomor,
          halaman: par.halaman,
        });
      }
    }
    const jumlahHalaman = daftar.length ? daftar[daftar.length - 1].halaman : 0;
    return { temuan, jumlahParagraf: daftar.length, jumlahHalaman, terpotong };
  }

  function periksaTeks(teks) {
    return periksaParagraf(paragrafDariTeks(teks));
  }
  function periksaRtf(rtf) {
    return periksaParagraf(bacaRtfParagraf(rtf));
  }
  function periksaDocxXml(xml) {
    return periksaParagraf(bacaDocxXml(xml));
  }

  // ==========================================================================
  // ZIP -> word/document.xml (DecompressionStream; tanpa pustaka)
  // ==========================================================================
  function u16(b, o) {
    return b[o] | (b[o + 1] << 8);
  }
  function u32(b, o) {
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  }

  async function lepasDeflate(bita) {
    if (typeof DecompressionStream !== "function") throw new Error("pelepas tidak tersedia");
    const alir = new Blob([bita]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(alir).arrayBuffer());
  }

  /** Isi satu berkas di dalam ZIP, atau null. */
  async function ambilDariZip(bita, nama) {
    let eocd = -1;
    for (let i = bita.length - 22; i >= Math.max(0, bita.length - 65557); i -= 1) {
      if (u32(bita, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;
    const jumlah = u16(bita, eocd + 10);
    let o = u32(bita, eocd + 16);
    for (let n = 0; n < jumlah; n += 1) {
      if (u32(bita, o) !== 0x02014b50) return null;
      const metode = u16(bita, o + 10);
      const ukuranKompres = u32(bita, o + 20);
      const panjangNama = u16(bita, o + 28);
      const panjangEkstra = u16(bita, o + 30);
      const panjangKomentar = u16(bita, o + 32);
      const lokal = u32(bita, o + 42);
      const namaBerkas = new TextDecoder().decode(bita.subarray(o + 46, o + 46 + panjangNama));
      if (namaBerkas === nama) {
        const awalData = lokal + 30 + u16(bita, lokal + 26) + u16(bita, lokal + 28);
        const data = bita.subarray(awalData, awalData + ukuranKompres);
        if (metode === 0) return data;
        if (metode === 8) return lepasDeflate(data);
        return null;
      }
      o += 46 + panjangNama + panjangEkstra + panjangKomentar;
    }
    return null;
  }

  async function periksaDocxBita(bita) {
    const isi = await ambilDariZip(bita, "word/document.xml");
    if (!isi) return null;
    return periksaDocxXml(new TextDecoder("utf-8").decode(isi));
  }

  // ==========================================================================
  // Mengenali dan memeriksa berkas dari bita
  // ==========================================================================
  /** "rtf" | "docx" | "pdf" | "teks" | "lain". */
  function kenaliBentuk(bita, nama) {
    const n = String(nama || "").toLowerCase();
    const kepala = String.fromCharCode.apply(null, Array.from(bita.subarray(0, 8)));
    if (/^\s*\{\\rtf/.test(kepala) || kepala.startsWith("{\\rtf")) return "rtf";
    if (kepala.startsWith("PK\u0003\u0004")) return "docx";
    if (kepala.startsWith("%PDF")) return "pdf";
    if (kepala.startsWith("ÐÏ\u0011à")) return "lain"; // .doc biner lama
    if (/\.txt$/.test(n)) return "teks";
    return "lain";
  }

  /**
   * Memeriksa satu berkas. Pulang { dibaca, bentuk, hasil } - hasil dari periksaParagraf,
   * atau null bila bentuknya tidak terbaca (PDF, .doc biner, rusak). Tidak pernah melempar.
   * opsi.bacaPdf: fungsi (bita) => Promise<paragraf[]> bila pemanggil punya pembaca PDF.
   */
  async function periksaBita(bitaMasuk, nama, opsi) {
    try {
      const bita = bitaMasuk instanceof Uint8Array ? bitaMasuk : new Uint8Array(bitaMasuk);
      if (!bita.length || bita.length > 40 * 1024 * 1024) return { dibaca: false, bentuk: "lain", hasil: null };
      const bentuk = kenaliBentuk(bita, nama);
      if (bentuk === "rtf") return { dibaca: true, bentuk, hasil: periksaRtf(new TextDecoder("windows-1252").decode(bita)) };
      if (bentuk === "docx") {
        const h = await periksaDocxBita(bita);
        return { dibaca: Boolean(h), bentuk, hasil: h };
      }
      if (bentuk === "teks") return { dibaca: true, bentuk, hasil: periksaTeks(new TextDecoder("utf-8").decode(bita)) };
      if (bentuk === "pdf" && opsi && typeof opsi.bacaPdf === "function") {
        const paragraf = await opsi.bacaPdf(bita);
        return { dibaca: true, bentuk, hasil: periksaParagraf(paragraf) };
      }
      return { dibaca: false, bentuk, hasil: null };
    } catch {
      return { dibaca: false, bentuk: "lain", hasil: null };
    }
  }

  // ==========================================================================
  // Jenis naskah dari nama / alamat
  // ==========================================================================
  /** "putusan" | "bas" | "relaas" | "" - dari nama berkas atau alamat unggah/unduh. */
  function jenisNaskahDariNama(nama) {
    const n = String(nama || "");
    if (/relaas/i.test(n)) return "relaas";
    if (/(?:^|[^A-Za-z])BAS(?:[^A-Za-z]|$)|berita\s+acara/i.test(n)) return "bas";
    if (/putusan/i.test(n) && !/penetapan\s+putusan|ikrar/i.test(n)) return "putusan";
    return "";
  }

  /**
   * Jenis naskah dari alamat rute portal (unduh/unggah): berkas-sipp?jenis=relaas|bas|putusan,
   * putusan/unggah-*, bas/unggah-sipp, bas-massal, relaas-massal/cetak, ecourt-putusan/unggah.
   */
  function jenisNaskahDariAlamat(alamat) {
    const a = String(alamat || "");
    const jenisQuery = /[?&]jenis=([a-z-]+)/i.exec(a);
    if (jenisQuery) {
      const j = jenisQuery[1].toLowerCase();
      if (j === "relaas") return "relaas";
      if (j === "bas") return "bas";
      if (j === "putusan" || j === "putusan-anonim") return "putusan";
    }
    if (/\/relaas-massal\//i.test(a)) return "relaas";
    if (/\/bas-massal(?:[/?#]|$)|\/bas\/unggah-sipp/i.test(a)) return "bas";
    if (/\/putusan\/unggah-|\/ecourt-putusan\/unggah/i.test(a)) return "putusan";
    return "";
  }

  // ==========================================================================
  // Ringkasan dan daftar masalah (.txt)
  // ==========================================================================
  function ringkasJenis(temuan) {
    const hitung = new Map();
    for (const t of temuan) hitung.set(t.jenis, (hitung.get(t.jenis) || 0) + 1);
    return URUTAN_JENIS.filter((j) => hitung.has(j)).map((j) => ({ jenis: j, label: LABEL[j], jumlah: hitung.get(j) }));
  }

  function letak(t) {
    return `paragraf ke-${t.paragraf}, kira-kira halaman ${t.halaman}`;
  }

  function kalimatTemuan(t) {
    const s = t.sebelum ? `${t.sebelum} ` : "";
    const e = t.sesudah ? ` ${t.sesudah}` : "";
    return `${s}«${t.cocok}»${e}`.trim();
  }

  /** Isi berkas .txt daftar masalah (CRLF supaya terbuka rapi di Notepad). */
  function susunDaftarTxt(temuan, opsi) {
    const o = opsi || {};
    const baris = [];
    baris.push("DAFTAR MASALAH PADA NASKAH");
    baris.push("");
    baris.push(`Berkas : ${o.nama || "(tanpa nama)"}`);
    if (o.jenis && NAMA_NASKAH[o.jenis]) baris.push(`Jenis  : ${NAMA_NASKAH[o.jenis]}`);
    baris.push(`Jumlah : ${temuan.length} hal${o.terpotong ? ` (ditambah ${o.terpotong} lagi yang tidak ditampilkan)` : ""}`);
    baris.push("");
    baris.push("Ringkasan:");
    for (const r of ringkasJenis(temuan)) baris.push(`  - ${r.label}: ${r.jumlah}`);
    baris.push("");
    baris.push("Rincian (tulisan yang bermasalah ditandai « »; letak hanya perkiraan):");
    baris.push("");
    temuan.forEach((t, i) => {
      baris.push(`${i + 1}. ${t.label} - ${letak(t)}`);
      baris.push(`   ${kalimatTemuan(t)}`);
      baris.push("");
    });
    baris.push("Perbaiki naskah di Word, lalu unduh atau unggah lagi bila perlu.");
    return baris.join("\r\n");
  }

  // ==========================================================================
  // Ingatan keputusan (menghindari dialog berulang untuk berkas yang sama)
  // ==========================================================================
  const INGAT_MS = 3 * 60 * 1000;
  const CEPAT_MS = 60 * 1000;
  const ingatan = new Map();
  let abaikanSampai = 0;
  const jejakTanya = [];

  function kunciBerkas(nama, ukuran, jenis) {
    return `${jenis || ""}|${nama || ""}|${ukuran || 0}`;
  }
  function sudahDilanjutkan(kunci) {
    const w = ingatan.get(kunci);
    return Boolean(w) && Date.now() - w < INGAT_MS;
  }

  // ==========================================================================
  // Dialog (DOM biasa; tidak pernah menulis apa pun ke SIPP)
  // ==========================================================================
  function buat(tag, gaya, teks) {
    const e = document.createElement(tag);
    if (gaya) e.style.cssText = gaya;
    if (teks != null) e.textContent = teks;
    return e;
  }

  async function simpanTxt(nama, isi) {
    const blob = new Blob([`﻿${isi}`], { type: "text/plain;charset=utf-8" });
    if (typeof alatUnduh === "function") {
      const h = await alatUnduh(blob, nama, { tanpaPeriksaSisa: true, tanpaCadangan: true });
      if (h && h.ok !== false) return true;
    }
    // Tanpa cadangan <a download> blob dari halaman http (ditahan Chrome sebagai "Insecure download blocked").
    return false;
  }

  function namaTxt(nama) {
    const batang = String(nama || "naskah").replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim().slice(0, 120) || "naskah";
    return `Daftar masalah - ${batang}.txt`;
  }

  /**
   * Dialog peringatan. Pulang "lanjut" | "batal".
   * o: { nama, jenis ("putusan"|"bas"|"relaas"), aksi ("unduh"|"unggah"), terpotong, tawarkanIngat }
   */
  function tampilkanDialog(temuan, o) {
    return new Promise((selesai) => {
      if (typeof document === "undefined" || !document.body) return selesai("lanjut");
      const aksi = o && o.aksi === "unggah" ? "diunggah" : "diunduh";
      const sebelumFokus = document.activeElement;
      const tabir = buat("div", "position:fixed;inset:0;z-index:2147483600;background:var(--aleta-tirai-warna,rgba(15,23,42,.38));-webkit-backdrop-filter:var(--aleta-tirai-filter,none);backdrop-filter:var(--aleta-tirai-filter,none);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.5 system-ui,Segoe UI,Arial,sans-serif;");
      tabir.className = "aleta-sisa-tabir";
      tabir.setAttribute("role", "dialog");
      tabir.setAttribute("aria-modal", "true");
      tabir.setAttribute("aria-label", "Naskah masih memuat sisa blangko");
      const kotak = buat("div", "background:#fff;color:#111827;border-radius:12px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.35);overflow:hidden;");
      const kepala = buat("div", "padding:16px 20px 8px;");
      kepala.appendChild(buat("div", "font-size:17px;font-weight:700;color:#9a3412;", "Naskah ini masih memuat sisa blangko"));
      const jenisTeks = o && NAMA_NASKAH[o.jenis] ? NAMA_NASKAH[o.jenis] : "naskah";
      kepala.appendChild(buat("div", "margin-top:4px;color:#374151;", `Ditemukan ${temuan.length}${o && o.terpotong ? "+" : ""} hal pada ${jenisTeks}${o && o.nama ? ` "${o.nama}"` : ""} yang sebaiknya diperbaiki sebelum ${aksi}.`));
      const ringkas = buat("div", "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;");
      for (const r of ringkasJenis(temuan)) {
        ringkas.appendChild(buat("span", "background:#fef3c7;color:#92400e;border-radius:999px;padding:2px 10px;font-size:12px;", `${r.label}: ${r.jumlah}`));
      }
      kepala.appendChild(ringkas);
      const isi = buat("div", "padding:8px 20px;overflow:auto;flex:1;");
      const daftar = buat("ol", "margin:0;padding-left:20px;");
      const tampil = temuan.slice(0, 12);
      for (const t of tampil) {
        const li = buat("li", "margin:0 0 8px;");
        li.appendChild(buat("div", "font-weight:600;font-size:13px;", `${t.label} - ${letak(t)}`));
        const k = buat("div", "font-size:13px;color:#374151;word-break:break-word;");
        k.appendChild(document.createTextNode(t.sebelum ? `${t.sebelum} ` : ""));
        k.appendChild(buat("mark", "background:#fecaca;color:#7f1d1d;padding:0 2px;border-radius:3px;", t.cocok));
        k.appendChild(document.createTextNode(t.sesudah ? ` ${t.sesudah}` : ""));
        li.appendChild(k);
        daftar.appendChild(li);
      }
      isi.appendChild(daftar);
      if (temuan.length > tampil.length) {
        isi.appendChild(buat("div", "font-size:13px;color:#6b7280;", `Dan ${temuan.length - tampil.length}${o && o.terpotong ? "+" : ""} lainnya - lengkapnya ada di daftar masalah (.txt).`));
      }
      const kaki = buat("div", "padding:12px 20px 16px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:8px;");
      let ingat = null;
      if (o && o.tawarkanIngat) {
        const label = buat("label", "display:flex;gap:6px;align-items:center;font-size:13px;color:#374151;");
        ingat = buat("input");
        ingat.type = "checkbox";
        label.appendChild(ingat);
        label.appendChild(document.createTextNode("Untuk berkas-berkas berikutnya, jangan tanya lagi selama 2 menit"));
        kaki.appendChild(label);
      }
      const baris = buat("div", "display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;");
      const gayaTombol = "border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer;border:1px solid #d1d5db;background:#f9fafb;color:#111827;";
      const bUnduh = buat("button", `${gayaTombol}background:#1d4ed8;border-color:#1d4ed8;color:#fff;font-weight:600;`, "Unduh daftar masalah (.txt) lalu lanjut");
      const bLanjut = buat("button", gayaTombol, "Lanjut saja");
      const bBatal = buat("button", gayaTombol, "Batal");
      for (const b of [bUnduh, bLanjut, bBatal]) b.type = "button";
      let selesaiSudah = false;
      const tutup = (pilihan) => {
        if (selesaiSudah) return;
        selesaiSudah = true;
        document.removeEventListener("keydown", tombolKeyboard, true);
        tabir.remove();
        try {
          if (sebelumFokus && typeof sebelumFokus.focus === "function") sebelumFokus.focus();
        } catch {
          /* fokus tidak wajib */
        }
        if (pilihan === "lanjut" && ingat && ingat.checked) abaikanSampai = Date.now() + 2 * 60 * 1000;
        selesai(pilihan);
      };
      const tombolKeyboard = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          tutup("batal");
        }
      };
      document.addEventListener("keydown", tombolKeyboard, true);
      bBatal.addEventListener("click", () => tutup("batal"));
      bLanjut.addEventListener("click", () => tutup("lanjut"));
      bUnduh.addEventListener("click", async () => {
        bUnduh.disabled = true;
        bUnduh.textContent = "Menyimpan daftar…";
        await simpanTxt(namaTxt(o && o.nama), susunDaftarTxt(temuan, o));
        tutup("lanjut");
      });
      baris.appendChild(bBatal);
      baris.appendChild(bLanjut);
      baris.appendChild(bUnduh);
      kaki.appendChild(baris);
      kotak.appendChild(kepala);
      kotak.appendChild(isi);
      kotak.appendChild(kaki);
      tabir.appendChild(kotak);
      document.body.appendChild(tabir);
      try {
        bUnduh.focus();
      } catch {
        /* fokus tidak wajib */
      }
    });
  }

  // ==========================================================================
  // Pintu utama untuk pemanggil: tinjau(sumber, opsi)
  // ==========================================================================
  async function bitaDari(sumber) {
    if (typeof sumber === "string") return new TextEncoder().encode(sumber);
    if (sumber instanceof Uint8Array) return sumber;
    if (sumber instanceof ArrayBuffer) return new Uint8Array(sumber);
    if (sumber && typeof sumber.arrayBuffer === "function") return new Uint8Array(await sumber.arrayBuffer());
    return null;
  }

  /**
   * K14 (25 Okt 2026): naskah RTF besar diperiksa SERVER bila Super Admin menyalakan saklar berkasDiServer
   * (ALETA_BERKAS_SERVER, berkas-server.js) - aturan yang sama, PC tua tidak menguraikan puluhan ribu paragraf.
   * Server tidak aktif / menolak / putus / bentuk bukan RTF -> pemeriksa lokal seperti dulu.
   */
  async function periksaBitaServerAtauLokal(bita, nama, opsi) {
    try {
      const B = akar.ALETA_BERKAS_SERVER;
      if (B && typeof B.periksaSisaRtf === "function" && kenaliBentuk(bita, nama) === "rtf") {
        const h = await B.periksaSisaRtf(bita);
        if (h && h.dibaca && h.hasil && Array.isArray(h.hasil.temuan)) return { dibaca: true, bentuk: "rtf", hasil: h.hasil };
      }
    } catch {
      /* jatuh ke pemeriksa lokal */
    }
    return periksaBita(bita, nama, opsi);
  }

  /**
   * Memeriksa satu naskah dan, bila ada temuan, menanyakan petugas.
   * @param sumber Blob | File | ArrayBuffer | Uint8Array | string (RTF/teks)
   * @param opsi { nama, jenis, aksi: "unduh"|"unggah", bacaPdf?, tanpaDialog? }
   * @returns Promise<{ lanjut: boolean, periksa: boolean, temuan: [] }>  tidak pernah melempar
   */
  async function tinjau(sumber, opsi) {
    const o = opsi || {};
    try {
      if (o.jenis !== "putusan" && o.jenis !== "bas" && o.jenis !== "relaas") return { lanjut: true, periksa: false, temuan: [] };
      const bita = await bitaDari(sumber);
      if (!bita) return { lanjut: true, periksa: false, temuan: [] };
      const kunci = kunciBerkas(o.nama, bita.length, o.jenis);
      if (sudahDilanjutkan(kunci)) return { lanjut: true, periksa: false, temuan: [] };
      const h = await periksaBitaServerAtauLokal(bita, o.nama, { bacaPdf: o.bacaPdf });
      if (!h.dibaca || !h.hasil || !h.hasil.temuan.length) return { lanjut: true, periksa: h.dibaca, temuan: [] };
      if (o.tanpaDialog) return { lanjut: true, periksa: true, temuan: h.hasil.temuan };
      const sekarang = Date.now();
      if (sekarang < abaikanSampai) return { lanjut: true, periksa: true, temuan: h.hasil.temuan };
      while (jejakTanya.length && sekarang - jejakTanya[0] > CEPAT_MS) jejakTanya.shift();
      const beruntun = jejakTanya.length >= 1;
      jejakTanya.push(sekarang);
      const pilihan = await tampilkanDialog(h.hasil.temuan, {
        nama: o.nama,
        jenis: o.jenis,
        aksi: o.aksi,
        terpotong: h.hasil.terpotong,
        tawarkanIngat: beruntun || o.massal === true,
      });
      if (pilihan === "lanjut") ingatan.set(kunci, Date.now());
      return { lanjut: pilihan === "lanjut", periksa: true, temuan: h.hasil.temuan };
    } catch {
      return { lanjut: true, periksa: false, temuan: [] };
    }
  }

  /**
   * Memeriksa semua berkas dalam FormData (kecuali slot anonimisasi) sebelum unggah.
   * Pulang { lanjut } - false bila petugas membatalkan satu berkas pun.
   */
  async function tinjauFormData(badan, opsi) {
    const o = opsi || {};
    try {
      if (!badan || typeof badan.entries !== "function") return { lanjut: true };
      for (const [kolom, nilai] of badan.entries()) {
        if (!nilai || typeof nilai === "string" || typeof nilai.arrayBuffer !== "function") continue;
        if (/anonim/i.test(String(kolom)) || /anonim/i.test(String(nilai.name || ""))) continue;
        const nama = String(nilai.name || kolom || "");
        const jenis = o.jenis || jenisNaskahDariNama(nama);
        if (!jenis) continue;
        const h = await tinjau(nilai, { ...o, nama, jenis, aksi: "unggah" });
        if (!h.lanjut) return { lanjut: false };
      }
    } catch {
      /* gagal memeriksa tidak boleh menahan unggahan */
    }
    return { lanjut: true };
  }

  // ==========================================================================
  // Kait unggah langsung di halaman SIPP (tingkap e-Doc)
  // ==========================================================================
  /** Jenis naskah dari borang e-Doc SIPP: kolom tersembunyi `from` (fileupload_v) / `form` (fileupload_putusan_v). */
  function jenisDariBorangSipp(form) {
    if (!form || typeof form.querySelector !== "function") return "";
    const nilai = (nm) => {
      const e = form.querySelector(`[name="${nm}"]`);
      return e ? String(e.value || "").toLowerCase() : "";
    };
    const kode = `${nilai("from")} ${nilai("form")}`.trim();
    if (/\bbas\b|edoc_bas/.test(kode)) return "bas";
    if (/relaas/.test(kode)) return "relaas";
    if (/\bputusan\b|\banonimisasi\b/.test(kode)) return "putusan";
    return "";
  }

  /**
   * Dipasang sekali per dokumen di halaman SIPP. Hanya borang e-Doc dengan berkas
   * yang dipilih dan jenis naskah dikenal yang ditahan sejenak; selebihnya lewat
   * persis seperti biasa. Sesudah petugas memilih, kiriman diulang lewat tombolnya.
   */
  function pasangKaitSipp(dok) {
    const d = dok || (typeof document !== "undefined" ? document : null);
    if (!d || d.__sisaBlangkoKait) return;
    d.__sisaBlangkoKait = true;
    const lolos = new WeakSet();
    d.addEventListener(
      "submit",
      (e) => {
        try {
          const f = e.target;
          if (!f || f.nodeName !== "FORM" || lolos.has(f)) return;
          if (typeof alatPemilihMilikAleta === "function" && alatPemilihMilikAleta(f)) return;
          const jenis = jenisDariBorangSipp(f);
          if (!jenis) return;
          const berkas = Array.from(f.querySelectorAll('input[type="file"]'))
            .filter((x) => !(typeof alatPemilihMilikAleta === "function" && alatPemilihMilikAleta(x)))
            .map((x) => (x.files && x.files[0]) || null)
            .filter(Boolean);
          if (!berkas.length) return;
          // Hanya berkas yang bisa dibaca yang membuat penundaan berarti.
          const bacaan = berkas.filter((b) => /\.(?:rtf|docx|txt)$/i.test(b.name || ""));
          if (!bacaan.length) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          const pengirim = e.submitter || f.querySelector('[type="submit"]');
          (async () => {
            let lanjut = true;
            try {
              for (const b of bacaan) {
                const h = await tinjau(b, { nama: b.name, jenis, aksi: "unggah" });
                if (!h.lanjut) {
                  lanjut = false;
                  break;
                }
              }
            } catch {
              // Galat pemeriksa TIDAK BOLEH menahan unggah: kirim seperti biasa.
              lanjut = true;
            }
            if (!lanjut) return;
            // Lepas dari pengiriman yang sedang berjalan: pengiriman ulang di dalam peristiwa
            // submit yang sama diabaikan peramban (tahap "sedang mengirim"), terutama bila
            // pemeriksa gagal seketika tanpa menunggu apa pun.
            await new Promise((r) => setTimeout(r, 0));
            lolos.add(f);
            try {
              if (pengirim && typeof pengirim.click === "function") pengirim.click();
              else if (typeof f.requestSubmit === "function") f.requestSubmit();
              else f.submit();
            } finally {
              setTimeout(() => lolos.delete(f), 1500);
            }
          })();
        } catch {
          /* kait tidak boleh mengganggu Simpan SIPP */
        }
      },
      true
    );
  }

  const api = {
    LABEL,
    URUTAN_JENIS,
    merahKah,
    bacaRtfParagraf,
    bacaDocxXml,
    paragrafDariTeks,
    periksaParagraf,
    periksaTeks,
    periksaRtf,
    periksaDocxXml,
    periksaDocxBita,
    /* 20 Okt: dipakai pratinjau BAS/relaas (pratinjau-bas-relaas.js) untuk tampilan teks cadangan DOCX dan nama daftar masalah. */
    ambilDariZip,
    namaTxt,
    periksaBita,
    kenaliBentuk,
    jenisNaskahDariNama,
    jenisNaskahDariAlamat,
    ringkasJenis,
    susunDaftarTxt,
    tampilkanDialog,
    tinjau,
    tinjauFormData,
    jenisDariBorangSipp,
    pasangKaitSipp,
  };
  akar.aletaDeteksiSisa = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // Kait unggah langsung hanya di halaman SIPP (bukan ABT, bukan portal): tingkap e-Doc
  // SIPP sendiri. ABT non-Derry dan portal tidak disentuh di sini.
  try {
    if (typeof document !== "undefined" && typeof location !== "undefined" && location.pathname && !/\/aps_badilag\//i.test(location.pathname) && !/^\/aleta(?:\/|$)/i.test(location.pathname)) {
      api.pasangKaitSipp(document);
    }
  } catch {
    /* kait tidak boleh mengganggu halaman */
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
