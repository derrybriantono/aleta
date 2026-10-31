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
    kosong: "Isian yang masih kosong",
    ulang: "Kata berulang (bekas isian yang tidak dibersihkan)",
    ragu: "Periksa: pilihan atau isian yang mungkin belum beres (belum tentu salah)",
    sesuai: "Tidak sesuai dengan perkara atau sidang ini",
  };
  const URUTAN_JENIS = ["sesuai", "merah", "kurung", "tanda", "perbaikan", "titik", "garis", "kalimat", "kosong", "ulang", "ragu"];
  /** Tingkat RAGU: hanya masuk daftar .txt (bertanda "periksa"), TIDAK dimerahkan di naskah. Selain itu (dan selain "merah" yang sudah merah) = PASTI. */
  const JENIS_RAGU = new Set(["ragu"]);
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
      tulis(teks, merah, sumber) {
        if (!teks) return;
        const dari = cur.teks.length;
        if (sumber) {
          if (!cur.src) cur.src = [];
          for (const s of sumber) cur.src.push(s);
        }
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

  /** peta=true: tiap paragraf membawa `src` = [awal, akhir, cf] per huruf (letak di RTF) - dipakai merahkanRtf. */
  function bacaRtfParagraf(rtfMasuk, peta) {
    const rtf = String(rtfMasuk == null ? "" : rtfMasuk);
    const merahIdx = indeksMerahRtf(rtf);
    const bangun = pembangunParagraf();
    const tumpuk = [];
    let k = { cf: 0, hl: 0, uc: 1, buang: false };
    let lewati = 0;
    let i = 0;
    const merahSekarang = () => merahIdx.has(k.cf) || merahIdx.has(k.hl);
    // a, b: letak sumber di RTF (b kosong = tiap huruf teks satu posisi sumber mulai dari a). Hanya dipakai bila peta=true.
    const tulis = (t, a, b) => {
      if (k.buang || !t) return;
      let sum;
      if (peta) {
        sum = [];
        for (let n = 0; n < t.length; n += 1) sum.push(b == null ? [a + n, a + n + 1, k.cf] : [a, b, k.cf]);
      }
      if (lewati > 0) {
        const pakai = Math.min(lewati, t.length);
        lewati -= pakai;
        t = t.slice(pakai);
        if (sum) sum = sum.slice(pakai);
        if (!t) return;
      }
      bangun.tulis(t, merahSekarang(), sum);
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
          tulis(s, i, i + 2);
          i += 2;
          continue;
        }
        if (s === "'") {
          const kode = Number.parseInt(rtf.slice(i + 2, i + 4), 16);
          if (!Number.isNaN(kode) && (kode >= 0x20 || kode === 0x09)) tulis(CP1252[kode] || String.fromCharCode(kode), i, i + 4);
          i += 4;
          continue;
        }
        if (s === "~") {
          tulis(" ", i, i + 2);
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
            tulis(" ", i - c[0].length, i);
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
              tulis(String.fromCharCode(angka < 0 ? angka + 65536 : angka), i - c[0].length, i);
              lewati = k.uc;
            }
            break;
          case "bin":
            if (angka && angka > 0) i += angka;
            break;
          default:
            if (Object.prototype.hasOwnProperty.call(RTF_TEKS_KENDALI, kata)) tulis(RTF_TEKS_KENDALI[kata], i - c[0].length, i);
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
      tulis(rtf.slice(i, j), i);
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

  // ==========================================================================
  // ISIAN TANGAN JURUSITA PADA RELAAS (30 Okt 2026, seret-lepas e-Doc) - salinan titikIsianTanganRelaas di deteksi-sisa-blangko.ts
  // ==========================================================================
  // Relaas dicetak SEBELUM dilaksanakan: hari/tanggal pelaksanaan, siapa yang ditemui/menerima, keterangan tidak bertemu, dan garis
  // tanda tangan/nama penerima memang diisi TANGAN oleh jurusita. Titik-titik di tempat itu bukan sisa blangko. Aturannya dirumuskan dari
  // 214 render relaas Derry (folder 98 Relaas) - yang di luar daftar ini tetap temuan (nama pihak, NIK, tanggal penetapan, biaya, dst.).
  //   a. didahului hari ini / hari / tanggal / pukul / jam / Nomor (tetapi BUKAN "Hari/Tanggal :" jadwal sidang, dan bukan sesudah
  //      "Nomor <angka>/..." - itu nomor/tanggal penetapan yang seharusnya sudah terisi);
  //   b. didahului kata penunjuk isian jurusita: berbicara dengan, diterima oleh, yang menerima, ditandatangani oleh saya serta, di sana
  //      saya, keterangan, kelurahan/desa, karena, Lain-lain, saksi, penerima;
  //   c. paragraf yang hanya titik (garis tanda tangan/nama), atau titik + sebutan jabatan penanda tangan (Jurusita, Penerima, Saksi, ...);
  //   c'. titik di kolom tanda tangan penerima di samping nama jurusita ("..... Tanty Restianty");
  //   d. tempat dan titik di ujung baris pendek ("Donggala, ......") atau di kepala surat ("Donggala, ...... Sifat : ...") = tanggal surat.
  const RELAAS_AWAL_A = /(?:\bhari(?:\s+ini)?|\btanggal|\bpukul|\bjam|\bnomor)\s*[:\-]?\s*$/i;
  const RELAAS_BUKAN_A = /hari\s*\/\s*tanggal\s*[:\-]?\s*$/i;
  const RELAAS_NOMOR_TERISI = /Nomor\s+\S*\d+\s*\//i;
  const RELAAS_AWAL_B =
    /(?:berbicara\s+dengan|bertemu\s+dengan|diterima\s+oleh|yang\s+menerima|menerima|ditandatangani\s+oleh\s+saya\s+serta|di\s?sana\s+saya|disana\s+saya|keterangan|kelurahan\s*\/\s*desa|karena|lain-lain|saksi|penerima)\s*[:,]?\s*$/i;
  const RELAAS_SISA_C = /^[\s\t.\u2026_\-,]*(?:jurusita|penerima|yang\s+menerima|saksi|lurah|kepala\s+desa|perangkat\s+desa)?[\s,.:]*$/i;
  const RELAAS_TITIK_LALU_NAMA = /^[\s\t]*(?:\u2026|\.{3,})[\s\t.\u2026]*(?:\p{Lu}[\p{L}.,']*\s*){1,6}$/u;
  const RELAAS_SESUDAH_SURAT = /^\s*(?:Sifat|Lampiran|Perihal|Hal)\s*:/i;
  const RELAAS_TEMPAT_D = /(?:^|[\s\t])\p{Lu}[\p{L}]+\s*,\s*$/u;

  /** true = titik-titik ini isian tangan jurusita pada relaas (bukan sisa blangko). Murni. */
  function titikIsianTanganRelaas(p, dari, sampai) {
    const titik = /(?:\u2026|\.{3}|(?:\.[\u00a0 ]){2}\.)(?:[\u00a0 ]?(?:\u2026|\.))*/g;
    if (RELAAS_SISA_C.test(p.replace(titik, "")) || RELAAS_TITIK_LALU_NAMA.test(p)) return true;
    const sebelum = p.slice(0, dari).replace(/[\u00a0 ]+$/g, "");
    if (RELAAS_AWAL_A.test(sebelum) && !RELAAS_BUKAN_A.test(sebelum) && !RELAAS_NOMOR_TERISI.test(sebelum)) return true;
    if (RELAAS_AWAL_B.test(sebelum)) return true;
    const sisa = p.slice(sampai).replace(titik, "").trim();
    if (((sisa === "" && p.length <= 90) || RELAAS_SESUDAH_SURAT.test(sisa)) && RELAAS_TEMPAT_D.test(sebelum)) return true;
    return false;
  }

  /** Opsi pemeriksaan { jenis }: "relaas" = isian tangan jurusita dikecualikan; "umum" = hanya sinyal kuat (kurung, tanda, perbaikan, merah). */
  const JENIS_LEMAH = new Set(["titik", "garis", "kalimat", "ulang", "ragu"]);

  // ==========================================================================
  // 31 Okt 2026 (sisa merah): pembantu aturan - salinan di deteksi-sisa-blangko.ts
  // ==========================================================================
  /** Pengecualian titik-titik (biaya, isian tangan relaas, kutipan). true = bukan sisa blangko. */
  function titikLewat(p, dari, sampai, opsi) {
    // Titik pengantar antara uraian dan nominal biaya ("Biaya panggilan ........ Rp. 60.000,-") bukan isian.
    if (/^[  ]*Rp\b/i.test(p.slice(sampai, sampai + 12))) return true;
    // Relaas: titik yang memang diisi tangan jurusita bukan sisa blangko.
    if (opsi && opsi.jenis === "relaas" && titikIsianTanganRelaas(p, dari, sampai)) return true;
    return dalamKutipan(p, dari, sampai);
  }
  /** Isian setengah: dilewati hanya bila SEMUA gugus titik di dalam temuan adalah pengecualian titik. */
  function titikBagianLewat(isi, p, dari, opsi) {
    const re = /[.…]{2,}|…/g;
    let m;
    let ada = false;
    while ((m = re.exec(isi))) {
      ada = true;
      const d = dari + m.index;
      if (!titikLewat(p, d, d + m[0].length, opsi)) return false;
    }
    return ada;
  }
  const KATA_ULANG_PASTI = new Set([
    "para", "pada", "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "oleh", "atas", "bahwa", "itu", "ini", "tersebut",
    "adalah", "telah", "akan", "dalam", "tidak", "penggugat", "tergugat", "pemohon", "termohon", "majelis", "hakim", "pengadilan", "agama",
  ]);
  /** Pengecualian tingkat RAGU: teks Arab, kutipan bertanda kutip, kutipan pasal/ayat/undang-undang, dan "... Rekonvensi/Konvensi". */
  function raguLewat(p, dari, sampai) {
    if (dekatArab(p, dari, sampai) || diapitKutip(p, dari)) return true;
    if (/\b(?:pasal|ayat|undang-undang|kompilasi|kuhper|kuhperdata)\b/i.test(p.slice(Math.max(0, dari - 120), dari))) return true;
    return /^\s*(?:rekonvensi|konvensi)\b/i.test(p.slice(sampai, sampai + 20));
  }
  const LABEL_ISIAN =
    "(?:nama(?:\\s+lengkap)?|umur|usia|nik|alamat|pekerjaan|agama|pendidikan|tempat\\s+(?:dan\\s+)?tanggal\\s+lahir|tempat\\s+lahir|tanggal\\s+lahir|tempat\\s+tinggal|kewarganegaraan|jabatan|nip|no\\.?\\s*hp|nomor\\s+(?:hp|telepon))";

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
    // 31 Okt 2026 (sisa merah) - PASTI: "XXX"/"xx" sebagai isian (angka Romawi XX/XXX sesudah Pasal/Bab/dst. dikecualikan),
    // {tanda}, #kode# huruf, dan placeholder berkurung "(nama)", "(alamat)", "(pilih salah satu)".
    {
      jenis: "tanda",
      lemah: true,
      // Huruf kecil "xx"/"xxx" TIDAK ditandai: itu topeng anonimisasi putusan ("Penggugat ( xxx ) bin xxx, NIK xxxxxxxxxxxxxxxx").
      re: /(?<![A-Za-z0-9])X{2,3}(?![A-Za-z0-9])/g,
      lewat(isi, p, dari) {
        return /^X+$/.test(isi) && /\b(?:pasal|bab|bagian|jilid|juz|abad|buku|surat|ke|tingkat|halaman|hlm)[\s.\-]*$/i.test(p.slice(Math.max(0, dari - 14), dari));
      },
    },
    { jenis: "tanda", lemah: true, re: /\{[^{}]{0,120}\}/g },
    { jenis: "tanda", lemah: true, re: /#[A-Za-z_][A-Za-z0-9_]{1,30}#/g },
    { jenis: "tanda", re: /\(\s*(?:nama|alamat|umur|pekerjaan|agama|tempat\s+lahir|tanggal\s+lahir|jabatan|diisi|isi\s+di\s?sini)\s*\)/gi },
    { jenis: "kalimat", re: /\(\s*(?:pilih\s+salah\s+satu(?:nya)?|coret\s+yang\s+tidak\s+perlu)\s*\)/gi },
    // "verifikasi" sebagai penanda isian ("butuh verifikasi", "perlu verifikasi", "(verifikasi)", "verifikasi dulu"); kata "verifikasi" polos dalam kalimat biasa BUKAN penanda.
    { jenis: "perbaikan", re: /\b(?:butuh|perlu|harus|tinggal)\s+(?:di)?verifikasi\w*|\bverifikasi\s+dulu\b|\(\s*verifikasi\b[^()]{0,40}\)|\*{1,2}\s*verifikasi\b[^*]{0,40}\*{1,2}/gi },
    { jenis: "perbaikan", re: /\bperlu\s+(?:di\s?)?(?:review|reviu|cek|check)\w*/gi },
    { jenis: "perbaikan", re: /\bperiksa\s+kembali\b/gi },
    { jenis: "perbaikan", re: /\bTODO\b/gi },
    {
      jenis: "titik",
      // Satu "gugus" titik: tiga titik atau lebih (boleh berspasi satu) atau "…", dengan sambungan titik di sebelahnya.
      re: /(?:\u2026|\.{3}|(?:\.[\u00a0 ]){2}\.)(?:[\u00a0 ]?(?:\u2026|\.))*/g,
      lewat: (_isi, p, dari, sampai, opsi) => titikLewat(p, dari, sampai, opsi),
    },
    // 31 Okt 2026 - PASTI: isian setengah ("20..", "Nomor ..../Pdt.G/....", "Rp. ....", "hari ..., tanggal ..."). Pengecualian titik
    // (kutipan, isian tangan relaas) berlaku per gugus titik: temuan dilewati hanya bila SETIAP gugusnya pengecualian.
    { jenis: "titik", lemah: true, re: /\b(?:19|20)\d?(?:[.\u2026]{2,}|\u2026)/g, lewat: (isi, p, dari, _s, opsi) => titikBagianLewat(isi, p, dari, opsi) },
    {
      jenis: "titik",
      lemah: true,
      re: /[.\u2026]{2,}\s*\/\s*Pdt\.[A-Za-z]+\s*\/\s*(?:\d{4}|[.\u2026]{2,})(?:\s*\/\s*[A-Za-z]+(?:\.[A-Za-z]+)*)?|\bPdt\.[A-Za-z]+\s*\/\s*[.\u2026]{2,}(?:\s*\/\s*[A-Za-z]+(?:\.[A-Za-z]+)*)?/g,
      lewat: (isi, p, dari, _s, opsi) => titikBagianLewat(isi, p, dari, opsi),
    },
    { jenis: "titik", lemah: true, re: /\bRp\.?\s*[.\u2026]{2,}/gi, lewat: (isi, p, dari, _s, opsi) => titikBagianLewat(isi, p, dari, opsi) },
    {
      jenis: "titik",
      lemah: true,
      re: /\bhari\s*[.\u2026]{2,}\s*,?\s*tanggal\s*[.\u2026]{2,}|\btanggal\s*[.\u2026]{2,}\s*,?\s*(?:bulan|tahun)\s*[.\u2026]{2,}/gi,
      lewat: (isi, p, dari, _s, opsi) => titikBagianLewat(isi, p, dari, opsi),
    },
    // 31 Okt 2026 - PASTI: kata berulang hasil isian ("para Para", "pada pada", "yang yang"), tidak peka huruf besar. Nama orang kembar
    // ("Siti Siti") tidak ditandai kecuali kata fungsi/sebutan pihak.
    {
      jenis: "ulang",
      lemah: true,
      re: /(?<![\p{L}\p{N}-])(\p{L}{2,20})\s+\1(?![\p{L}\p{N}-])/giu,
      lewat(isi, p, dari, sampai) {
        if (dekatArab(p, dari, sampai)) return true;
        const kata = isi.split(/\s+/);
        return kata[0] === kata[1] && /^\p{Lu}/u.test(kata[0]) && !KATA_ULANG_PASTI.has(kata[0].toLowerCase());
      },
    },
    // 31 Okt 2026 - RAGU (hanya daftar .txt, tidak dimerahkan): pilihan bergaris miring yang belum dipilih. "dan/atau" SAH (tidak ada di daftar);
    // "Penggugat/Tergugat Rekonvensi", kutipan pasal/ayat, dan kutipan bertanda kutip tidak ditandai.
    {
      jenis: "ragu",
      lemah: true,
      re: /\b(?:penggugat\s*\/\s*tergugat|tergugat\s*\/\s*penggugat|pemohon\s*\/\s*termohon|termohon\s*\/\s*pemohon|laki-laki\s*\/\s*perempuan|perempuan\s*\/\s*laki-laki|suami\s*\/\s*(?:istri|isteri)|(?:istri|isteri)\s*\/\s*suami)\b/gi,
      lewat: (isi, p, dari, sampai) => raguLewat(p, dari, sampai),
    },
    { jenis: "ragu", lemah: true, re: /\bbin\s*\/\s*binti\b|\bbinti\s*\/\s*bin\b/gi, lewat: (isi, p, dari, sampai) => raguLewat(p, dari, sampai) },
    {
      jenis: "garis",
      re: /_{3,}/g,
      lewat(_isi, p) {
        // Baris pemisah yang seluruhnya garis bawah/strip bukan isian.
        return /^[\s_\-=*+]*$/.test(p);
      },
    },
    { jenis: "kalimat", re: /\*+\)\s*(?:coret|hapus)\s+yang\s+tidak\s+(?:perlu|sesuai|diperlukan)/gi },
    { jenis: "kalimat", re: /\b(?:pilih|pilihlah)\s+salah\s+satu(?:nya)?\b|\b(?:coret|hapus)\s+yang\s+tidak\s+(?:perlu|sesuai|diperlukan)\b/gi },
    // 31 Okt 2026 (permintaan tambahan A) - bahasa blangko / isian kosong di luar daftar. PASTI = jelas sisa blangko; RAGU = bisa sah.
    // Kalimat petunjuk blangko (PASTI): "isi dengan ...", "isilah", "sesuaikan dengan ...", "hapus bagian ini".
    {
      jenis: "kalimat",
      lemah: true,
      re: /\b(?:isi|isilah|isikan|diisi)\s+(?:dengan|sesuai|nama|alamat|tanggal|nomor|di\s?sini)\b|\bsesuaikan\s+(?:dengan|nama|tanggal|nomor|alamat|isian|perkara)\b|\b(?:hapus|coret)\s+(?:bagian|kalimat|paragraf)\s+(?:ini|yang)\b/gi,
      lewat: (_i, p, dari, sampai) => dekatArab(p, dari, sampai) || diapitKutip(p, dari),
    },
    // Label tanpa isi (PASTI): "Nama : ......", "Umur : ____" (labelnya ikut merah) dan label berturut-turut tanpa isi ("Nama : Umur :").
    {
      jenis: "kosong",
      lemah: true,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${LABEL_ISIAN}\\s*:\\s*(?:[.\\u2026_]{2,}|-{2,})`, "giu"),
      lewat: (isi, p, dari, _s, opsi) => !/[_-]/.test(isi) && titikBagianLewat(isi, p, dari, opsi),
    },
    {
      jenis: "kosong",
      lemah: true,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${LABEL_ISIAN}\\s*:(?=\\s*${LABEL_ISIAN}\\s*:)`, "giu"),
    },
    // Tanggal / nomor / nominal kosong (PASTI): "tanggal bulan tahun", "Rp,00", "Rp ,-", "Nomor /Pdt.G/", "/Pdt.G//", "terbilang: )".
    { jenis: "kosong", lemah: true, re: /\btanggal\s+bulan\s+tahun\b|\bhari\s+tanggal\s+bulan\b/gi },
    { jenis: "kosong", lemah: true, re: /\bRp\.?\s*,\s*(?:00|-)|\bRp\.?\s*(?=$|[;)])/gi },
    { jenis: "kosong", lemah: true, re: /\b(?:Nomor|No\.?)\s*:?\s*\/\s*(?:Pdt\.[A-Za-z]+\s*\/)?|\/\s*Pdt\.[A-Za-z]+\s*\/\s*\/|\/\s*Pdt\.[A-Za-z]+\s*\/\s*PA\b/g },
    { jenis: "kosong", lemah: true, re: /\bterbilang\s*:?\s*(?=\)|$)/gi },
    // Bekas isian kosong di tengah kalimat (PASTI): "pada tanggal , ", "berumur ,", "Penggugat  bin  ", ", ,", "( )".
    { jenis: "kosong", lemah: true, re: /\b(?:tanggal|bulan|tahun|pukul|jam|berumur|beralamat|nomor)\s+[,;]/gi, lewat: (_i, p, dari, sampai) => dekatArab(p, dari, sampai) },
    { jenis: "kosong", lemah: true, re: /\b(?:bin|binti)\s{2,}(?=\S)|(?<=\S)\s{2,}(?:bin|binti)\b|\b(?:bin|binti)\s*(?:[,;]|$)/gi, lewat: (_i, p, dari, sampai) => dekatArab(p, dari, sampai) },
    { jenis: "kosong", lemah: true, re: /,(?:\s*,)+/g, lewat: (_i, p, dari, sampai) => dekatArab(p, dari, sampai) },
    { jenis: "kosong", lemah: true, re: /\(\s*\)/g },
    // RAGU (hanya .txt): kata kerja petunjuk polos, "contoh:", label di ujung paragraf tanpa isi, spasi ganda antar kata kecil, koma/titik ganda.
    {
      jenis: "ragu",
      lemah: true,
      re: /\b(?:ketik|ketikkan|tulis|tuliskan|pilih|pilihlah)\s+(?:sesuai|nama|tanggal|nomor|alamat|di\s?sini|dengan|yang|jenis|huruf)\b|\bcontoh\s*:|\bdiisi\b/gi,
      lewat: (_i, p, dari, sampai) => raguLewat(p, dari, sampai),
    },
    {
      jenis: "ragu",
      lemah: true,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${LABEL_ISIAN}\\s*:\\s*$`, "giu"),
      lewat: (_i, p, dari, sampai) => p.slice(0, dari).trim() === "" || raguLewat(p, dari, sampai),
    },
    { jenis: "ragu", lemah: true, re: /\p{L}+[  ]{2,}\p{Ll}+/gu, lewat: (_i, p, dari, sampai) => raguLewat(p, dari, sampai) },
    { jenis: "ragu", lemah: true, re: /(?<=[\p{L}\p{N}])\s+,(?=\s|$)|,\s*\.(?![.…\d])|(?<=[\p{L}])\.\.(?!\.)/gu, lewat: (_i, p, dari, sampai) => raguLewat(p, dari, sampai) },
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

  // Blok Jurusita / Jurusita Pengganti (31 Okt 2026): paragraf pendek yang menyebut "Jurusita" dan paragraf pendek sesudahnya (paling banyak 6)
  // adalah tempat jurusita mengisi tangan nama, tanda tangan, keterangan, tanggal/jam. Titik/garis/isian kosong di situ tidak ditandai,
  // tidak dimerahkan, dan baris kosongnya tidak dirapikan. Salinan di deteksi-sisa-blangko.ts.
  const JENIS_ISIAN_JURUSITA = new Set(["titik", "garis", "kosong", "ragu"]);
  function blokJurusita(daftar) {
    const hasil = new Array(daftar.length).fill(false);
    let sisa = 0;
    for (let n = 0; n < daftar.length; n += 1) {
      const t = daftar[n].teks;
      // Judul blok: paragraf yang DIAWALI "Jurusita" (boleh didahului titik/tab: "..........\tJurusita,"). Kalimat biasa yang kebetulan
      // menyebut "... sebagai Jurusita" bukan judul blok.
      if (/^[\s.…_-]*jurusita\b/i.test(t) && t.length <= 160) {
        hasil[n] = true;
        sisa = 6;
      } else if (sisa > 0 && t.length <= 120) {
        hasil[n] = true;
        sisa -= 1;
      } else sisa = 0;
    }
    return hasil;
  }

  /** Rentang sisa blangko pada SATU paragraf (yang tertelan rentang lebih besar sudah disisihkan), terurut menurut letaknya. */
  function rentangParagraf(par, opsi, dalamJurusita) {
    {
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
        if (opsi && opsi.jenis === "umum" && (JENIS_LEMAH.has(a.jenis) || a.lemah)) continue;
        // Blok Jurusita / Jurusita Pengganti: titik-titik, garis, dan isian kosong di situ diisi tangan oleh jurusita - bukan sisa blangko.
        if (dalamJurusita && JENIS_ISIAN_JURUSITA.has(a.jenis)) continue;
        for (const m of p.matchAll(a.re)) {
          const dari = m.index;
          const sampai = dari + m[0].length;
          if (a.lewat && a.lewat(m[0], p, dari, sampai, opsi)) continue;
          rentang.push({ jenis: a.jenis, dari, sampai });
        }
      }
      // Sisihkan yang seluruhnya berada di dalam rentang lain yang lebih "besar" (merah, kurung, tanda).
      const pemenang = rentang.filter((r) => {
        for (const o of rentang) {
          if (o === r) continue;
          // Tingkat RAGU tidak pernah menelan temuan PASTI.
          if (JENIS_RAGU.has(o.jenis) && !JENIS_RAGU.has(r.jenis)) continue;
          const lebihBesar = o.sampai - o.dari > r.sampai - r.dari || (o.sampai - o.dari === r.sampai - r.dari && URUTAN_JENIS.indexOf(o.jenis) < URUTAN_JENIS.indexOf(r.jenis));
          if (o.dari <= r.dari && o.sampai >= r.sampai && lebihBesar) return false;
        }
        return true;
      });
      pemenang.sort((x, y) => x.dari - y.dari);
      return { p, pemenang };
    }
  }

  /** Periksa daftar paragraf -> { temuan, jumlahParagraf, jumlahHalaman, terpotong }. */
  function periksaParagraf(daftar, opsi) {
    const temuan = [];
    let terpotong = 0;
    const jur = blokJurusita(daftar);
    for (let n = 0; n < daftar.length; n += 1) {
      const par = daftar[n];
      const { p, pemenang } = rentangParagraf(par, opsi, jur[n]);
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

  function periksaTeks(teks, opsi) {
    return periksaParagraf(paragrafDariTeks(teks), opsi);
  }
  function periksaRtf(rtf, opsi) {
    return periksaParagraf(bacaRtfParagraf(rtf), opsi);
  }
  function periksaDocxXml(xml, opsi) {
    return periksaParagraf(bacaDocxXml(xml), opsi);
  }

  // ==========================================================================
  // 31 Okt 2026 - (1) MERAHKAN sisa blangko tingkat PASTI pada RTF yang dicetak/diunduh dari panel,
  //               (2) RAPIKAN baris kosong berlebih (paling banyak SATU baris kosong antar paragraf).
  // Keduanya murni mengubah teks RTF hasil; tidak menulis apa pun ke SIPP/ABT.
  // ==========================================================================
  const MERAH_RTF = "\\red255\\green0\\blue0;";

  /** Indeks penutup "}" dari grup yang dibuka di `awal` (tanda lolos \\ { } dilewati), atau -1. */
  function akhirGrupRtf(rtf, awal) {
    let dalam = 0;
    for (let a = awal; a < rtf.length; a += 1) {
      const c = rtf[a];
      if (c === "\\") {
        a += 1;
        continue;
      }
      if (c === "{") dalam += 1;
      else if (c === "}") {
        dalam -= 1;
        if (dalam === 0) return a;
      }
    }
    return -1;
  }

  /** Indeks warna merah murni (255,0,0) di \colortbl - dipakai bila sudah ada, atau ditambahkan. { indeks, sisip:{pos,teks}|null } atau null. */
  function siapkanWarnaMerah(rtf) {
    const awal = rtf.indexOf("{\\colortbl");
    if (awal >= 0) {
      const akhir = akhirGrupRtf(rtf, awal);
      if (akhir > 0) {
        const bagian = rtf.slice(awal + "{\\colortbl".length, akhir).split(";");
        for (let n = 0; n < bagian.length - 1; n += 1) {
          const r = /\\red(\d+)/.exec(bagian[n]);
          const g = /\\green(\d+)/.exec(bagian[n]);
          const b = /\\blue(\d+)/.exec(bagian[n]);
          if (r && g && b && Number(r[1]) === 255 && Number(g[1]) === 0 && Number(b[1]) === 0) return { indeks: n, sisip: null };
        }
        return { indeks: bagian.length - 1, sisip: { pos: akhir, teks: MERAH_RTF } };
      }
    }
    // Tanpa tabel warna: sisipkan sesudah tabel huruf, atau sesudah kepala "{\rtf1\ansi...".
    let pos = -1;
    const f = rtf.indexOf("{\\fonttbl");
    const fa = f >= 0 ? akhirGrupRtf(rtf, f) : -1;
    if (fa > 0) pos = fa + 1;
    else {
      const m = /^\s*\{\\rtf\d*(?:\\[a-zA-Z]+-?\d*[ ]?)*/.exec(rtf);
      if (m) pos = m[0].length;
    }
    if (pos < 0) return null;
    return { indeks: 1, sisip: { pos, teks: `{\\colortbl;${MERAH_RTF}}` } };
  }

  /**
   * Mewarnai MERAH setiap sisa blangko tingkat PASTI (semua jenis kecuali "merah" yang sudah merah dan "ragu"):
   * tabel warna ditambah merah, potongan dibungkus \cfN ... (kembali ke warna semula, lazimnya \cf0). Potongan yang melintasi
   * pemformatan dipecah per bagian yang bersambung supaya kurung kurawal tetap seimbang. opsi: { jenis (sama dengan pemeriksaan),
   * untukBaca: salinan teks RTF yang sama panjang untuk dibaca (mis. didekode windows-1252) }.
   * Pulang { rtf, jumlah (bagian yang diwarnai), potongan (temuan PASTI), indeks }.
   */
  function merahkanRtf(rtfMasuk, opsi) {
    const rtf = String(rtfMasuk == null ? "" : rtfMasuk);
    const tanpaUbah = { rtf, jumlah: 0, potongan: 0, indeks: -1 };
    try {
      const baca = opsi && typeof opsi.untukBaca === "string" && opsi.untukBaca.length === rtf.length ? opsi.untukBaca : rtf;
      const warna = siapkanWarnaMerah(rtf);
      if (!warna) return tanpaUbah;
      const sisip = [];
      let potongan = 0;
      let jumlah = 0;
      const semuaPar = bacaRtfParagraf(baca, true);
      const jur = blokJurusita(semuaPar);
      for (let nn = 0; nn < semuaPar.length; nn += 1) {
        const par = semuaPar[nn];
        if (!par.src || par.src.length !== par.teks.length) continue;
        const { p, pemenang } = rentangParagraf(par, opsi, jur[nn]);
        for (const r of pemenang) {
          if (r.jenis === "merah" || JENIS_RAGU.has(r.jenis)) continue;
          potongan += 1;
          let mulai = r.dari;
          for (let n = r.dari; n < r.sampai; n += 1) {
            const putus = n === r.sampai - 1 || par.src[n + 1][0] !== par.src[n][1] || par.src[n + 1][2] !== par.src[n][2];
            if (!putus) continue;
            if (/\S/.test(p.slice(mulai, n + 1))) {
              const s = par.src[mulai];
              sisip.push({ pos: s[0], teks: `\\cf${warna.indeks} `, urut: sisip.length });
              sisip.push({ pos: par.src[n][1], teks: `\\cf${s[2]} `, urut: sisip.length });
              jumlah += 1;
            }
            mulai = n + 1;
          }
        }
      }
      if (!jumlah) return { ...tanpaUbah, potongan };
      if (warna.sisip) sisip.push({ pos: warna.sisip.pos, teks: warna.sisip.teks, urut: -1 });
      sisip.sort((x, y) => x.pos - y.pos || x.urut - y.urut);
      let hasil = "";
      let akhir = 0;
      for (const s of sisip) {
        hasil += rtf.slice(akhir, s.pos) + s.teks;
        akhir = s.pos;
      }
      hasil += rtf.slice(akhir);
      return { rtf: hasil, jumlah, potongan, indeks: warna.indeks };
    } catch {
      return tanpaUbah;
    }
  }

  const RTF_GAMBAR = new Set(["pict", "shp", "shpinst", "shppict", "nonshppict", "object", "do", "dpline", "dprect", "dpellipse", "dppolyline"]);

  /**
   * Daftar paragraf RTF isi naskah: { parPos, parLen, teks, gambar, tabel, halaman }. parPos/parLen = letak kata \par
   * penutupnya (parLen 0 = penutup yang tidak boleh dihapus: \cell, \row, \sect, atau garis miring + baris baru).
   */
  function strukturParagrafRtf(rtf) {
    const hasil = [];
    const tumpuk = [];
    let k = { uc: 1, buang: false };
    // sampah: letak [awal, akhir) spasi/tab/garis baru di paragraf ini - ikut dibuang bila paragrafnya kosong (jangan menempel ke paragraf berikutnya).
    const baru = () => ({ teks: "", gambar: false, tabel: false, halaman: false, jarak: false, teksPos: -1, sampah: [] });
    let cur = baru();
    let lewati = 0;
    let i = 0;
    const tambah = (t, pos, panjang) => {
      if (k.buang || !t) return;
      if (lewati > 0) {
        const pakai = Math.min(lewati, t.length);
        lewati -= pakai;
        t = t.slice(pakai);
        if (!t) return;
      }
      if (!/\S/.test(t)) cur.sampah.push([pos, pos + (panjang || t.length)]);
      else if (cur.teksPos < 0) cur.teksPos = pos;
      cur.teks += t;
    };
    const tutup = (pos, panjang) => {
      hasil.push({ parPos: pos, parLen: panjang, teks: cur.teks, gambar: cur.gambar, tabel: cur.tabel || panjang === 0, halaman: cur.halaman, jarak: cur.jarak, teksPos: cur.teksPos, sampah: cur.sampah });
      cur = baru();
    };
    while (i < rtf.length) {
      const h = rtf[i];
      if (h === "{") {
        tumpuk.push(k);
        k = { uc: k.uc, buang: k.buang };
        const m = /^\{\s*\\(\*)?\s*\\?([a-zA-Z]+)?/.exec(rtf.slice(i, i + 40));
        if (m && (m[1] === "*" || (m[2] && RTF_BUANG.has(m[2])))) k.buang = true;
        if (m && m[2] && RTF_GAMBAR.has(m[2])) cur.gambar = true;
        i += 1;
        continue;
      }
      if (h === "}") {
        k = tumpuk.pop() || { uc: 1, buang: false };
        lewati = 0;
        i += 1;
        continue;
      }
      if (h === "\\") {
        const s = rtf[i + 1];
        if (s === "\\" || s === "{" || s === "}") {
          tambah(s, i);
          i += 2;
          continue;
        }
        if (s === "'") {
          const kode = Number.parseInt(rtf.slice(i + 2, i + 4), 16);
          if (!Number.isNaN(kode) && (kode >= 0x20 || kode === 0x09)) tambah(String.fromCharCode(kode), i, 4);
          i += 4;
          continue;
        }
        if (s === "~") {
          tambah(" ", i, 2);
          i += 2;
          continue;
        }
        if (s === "-" || s === "_" || s === "|" || s === ":" || s === "*") {
          i += 2;
          continue;
        }
        if (s === "\n" || s === "\r") {
          if (!k.buang) tutup(i, 0);
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
        const letak = i;
        i += c[0].length;
        if (RTF_GAMBAR.has(kata)) cur.gambar = true;
        if (RTF_BUANG.has(kata)) {
          k.buang = true;
          continue;
        }
        if (k.buang) continue;
        switch (kata) {
          case "par":
            tutup(letak, c[0].length);
            break;
          case "sect":
          case "cell":
          case "row":
          case "nestcell":
          case "nestrow":
            tutup(letak, 0);
            break;
          case "intbl":
          case "trowd":
            cur.tabel = true;
            break;
          case "tab":
          case "line":
            cur.sampah.push([letak, i]);
            break;
          case "sb":
          case "sa":
            if (angka !== null && angka > 0) cur.jarak = true;
            break;
          case "page":
          case "pagebb":
          case "sbkpage":
            cur.halaman = true;
            break;
          case "uc":
            if (angka !== null) k.uc = angka;
            break;
          case "u":
            if (angka !== null) {
              tambah(String.fromCharCode(angka < 0 ? angka + 65536 : angka), letak, c[0].length);
              lewati = k.uc;
            }
            break;
          case "bin":
            if (angka && angka > 0) i += angka;
            break;
          default:
            if (Object.prototype.hasOwnProperty.call(RTF_TEKS_KENDALI, kata)) tambah(RTF_TEKS_KENDALI[kata], letak, c[0].length);
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
      tambah(rtf.slice(i, j), i);
      i = j;
    }
    return hasil;
  }

  /** Baris tanda tangan: sebutan jabatan di ujung blok TTD (pendek). Ruang kosong di sekitarnya adalah ruang tanda tangan. */
  const BARIS_TTD = /^(?:ketua(?:\s+majelis)?|hakim(?:\s+(?:ketua|anggota|tunggal))?(?:\s+(?:i|ii|iii|iv|\d+))?|panitera(?:\s+(?:pengganti|sidang))?|jurusita(?:\s+pengganti)?|penerima|yang\s+menerima|ttd|mengetahui|mengesahkan|untuk\s+salinan|pejabat)\b/i;
  function barisTtd(teks) {
    const t = String(teks).replace(/\s+/g, " ").trim();
    // Blok Jurusita / Jurusita Pengganti: ruang isian tangan jurusita, baris kosongnya tidak dirapikan.
    if (t.length > 0 && t.length <= 100 && /^[\s.…_-]*jurusita\b/i.test(t)) return true;
    return t.length > 0 && t.length <= 60 && BARIS_TTD.test(t);
  }

  function paragrafKosongRtf(par) {
    return par.parLen > 0 && !par.gambar && !par.tabel && !par.halaman && !/\S/.test(par.teks);
  }

  /** Judul bab huruf kapital yang tidak boleh rapat ke paragraf di sekitarnya ("DUDUK PERKARA", "PERTIMBANGAN HUKUM", "MENGADILI", ...). */
  const JUDUL_BAB = /^(?:TENTANG\s+\S+|DUDUK\s+PERKARA|PERTIMBANGAN\s+HUKUM|MENGADILI|MEMUTUSKAN|MENETAPKAN|MENIMBANG|MENGINGAT|DALAM\s+\S+|AMAR\s+PUTUSAN|PUTUSAN|PENETAPAN)\b/;
  function judulBab(par) {
    const t = String(par.teks).replace(/\s+/g, " ").trim();
    return t.length > 0 && t.length <= 70 && t === t.toUpperCase() && /\p{L}/u.test(t) && JUDUL_BAB.test(t);
  }
  /** Paragraf non-kosong pertama di kop surat: deret kosong sebelum paragraf ke-KOP dibiarkan (jarak kop diatur pengguna). */
  const PARAGRAF_KOP = 5;

  /** true = deret paragraf kosong daftar[n..m] jangan dihapus (kop surat, ruang tanda tangan, blok Jurusita, atau sekitar ganti halaman). */
  function deretKosongDilindungi(daftar, n, m, jur) {
    const sebelum = daftar[n - 1];
    const sesudah = daftar[m + 1];
    if ((sebelum && sebelum.halaman) || (sesudah && sesudah.halaman)) return true;
    for (let q = n; q <= m; q += 1) if (jur[q]) return true;
    if ((sebelum && jur[n - 1]) || (sesudah && jur[m + 1])) return true;
    let isi = 0;
    for (let q = 0; q < n; q += 1) if (!paragrafKosongRtf(daftar[q])) isi += 1;
    if (isi < PARAGRAF_KOP) return true;
    let ketemu = 0;
    for (let q = n - 1; q >= 0 && ketemu < 3; q -= 1) {
      if (paragrafKosongRtf(daftar[q])) continue;
      if (barisTtd(daftar[q].teks)) return true;
      ketemu += 1;
    }
    for (let q = m + 1; q < daftar.length; q += 1) {
      if (paragrafKosongRtf(daftar[q])) continue;
      return barisTtd(daftar[q].teks);
    }
    return false;
  }

  /**
   * HAPUS SEMUA paragraf kosong akibat enter (termasuk yang lahir dari isian kosong): jarak antar paragraf datang dari \sb/\sa format
   * blangko, bukan dari paragraf kosong. Dikecualikan: kop surat (sebelum paragraf isi ke-5), ruang tanda tangan (sekitar sebutan Ketua
   * Majelis/Hakim/Panitera/Jurusita/ttd), seluruh blok Jurusita/Jurusita Pengganti, sekitar ganti halaman (\page, \pagebb, \sect), sel tabel,
   * dan bentuk gambar. Judul bab huruf kapital yang berdampingan dengan paragraf kosong terhapus dan tidak punya \sb/\sa diberi \sb240 supaya
   * tetap renggang. Pulang { rtf, tempat (jumlah deret yang dibuang), dihapus (jumlah paragraf kosong), judul (jumlah judul diberi jarak) }.
   */
  function rapikanBarisKosong(rtfMasuk) {
    const rtf = String(rtfMasuk == null ? "" : rtfMasuk);
    const tanpaUbah = { rtf, tempat: 0, dihapus: 0, judul: 0 };
    try {
      const daftar = strukturParagrafRtf(rtf);
      const jur = blokJurusita(daftar);
      const ubah = []; // { pos, hapus (panjang yang dibuang), teks (yang disisipkan) }
      const judulSudah = new Set();
      let tempat = 0;
      let dihapus = 0;
      let n = 0;
      while (n < daftar.length) {
        if (!paragrafKosongRtf(daftar[n])) {
          n += 1;
          continue;
        }
        let m = n;
        while (m + 1 < daftar.length && paragrafKosongRtf(daftar[m + 1])) m += 1;
        if (!deretKosongDilindungi(daftar, n, m, jur)) {
          tempat += 1;
          for (let q = n; q <= m; q += 1) {
            // Spasi/tab/garis baru di dalam paragraf kosong ikut dibuang (kalau tidak, menempel ke awal paragraf berikutnya), lalu kata \par-nya.
            for (const [a, b] of daftar[q].sampah) ubah.push({ pos: a, hapus: b - a, teks: "" });
            ubah.push({ pos: daftar[q].parPos, hapus: daftar[q].parLen, teks: "" });
            dihapus += 1;
          }
          for (const tetangga of [daftar[n - 1], daftar[m + 1]]) {
            if (tetangga && !judulSudah.has(tetangga) && !tetangga.jarak && tetangga.teksPos >= 0 && judulBab(tetangga)) {
              judulSudah.add(tetangga);
              ubah.push({ pos: tetangga.teksPos, hapus: 0, teks: "\\sb240 " });
            }
          }
        }
        n = m + 1;
      }
      if (!ubah.length) return tanpaUbah;
      ubah.sort((x, y) => x.pos - y.pos);
      let hasil = "";
      let akhir = 0;
      let sesudahBuang = false;
      for (const u of ubah) {
        if (u.pos < akhir) continue; // tumpang tindih: sudah terbuang
        const utuh = rtf.slice(akhir, u.pos);
        // Kata kendali sebelum bagian yang dibuang (mis. "\ql" + "\par " + "G") butuh pembatas: tanpa spasi ia menempel ke huruf berikutnya ("\qlG").
        if (sesudahBuang && utuh && /[A-Za-z0-9]$/.test(hasil) && /^[A-Za-z0-9-]/.test(utuh)) hasil += " ";
        hasil += utuh;
        if (utuh) sesudahBuang = false;
        if (u.hapus > 0) sesudahBuang = true;
        hasil += u.teks;
        akhir = u.pos + u.hapus;
      }
      if (sesudahBuang && /[A-Za-z0-9]$/.test(hasil) && /^[A-Za-z0-9-]/.test(rtf.slice(akhir))) hasil += " ";
      hasil += rtf.slice(akhir);
      return { rtf: hasil, tempat, dihapus, judul: judulSudah.size };
    } catch {
      return tanpaUbah;
    }
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

  async function periksaDocxBita(bita, opsi) {
    const isi = await ambilDariZip(bita, "word/document.xml");
    if (!isi) return null;
    return periksaDocxXml(new TextDecoder("utf-8").decode(isi), opsi);
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
      if (bentuk === "rtf") return { dibaca: true, bentuk, hasil: periksaRtf(new TextDecoder("windows-1252").decode(bita), opsi) };
      if (bentuk === "docx") {
        const h = await periksaDocxBita(bita, opsi);
        return { dibaca: Boolean(h), bentuk, hasil: h };
      }
      if (bentuk === "teks") return { dibaca: true, bentuk, hasil: periksaTeks(new TextDecoder("utf-8").decode(bita), opsi) };
      if (bentuk === "pdf" && opsi && typeof opsi.bacaPdf === "function") {
        const paragraf = await opsi.bacaPdf(bita);
        return { dibaca: true, bentuk, hasil: periksaParagraf(paragraf, opsi) };
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
    if (Array.isArray(o.catatan)) for (const c of o.catatan) baris.push(`Info   : ${c}`);
    if (Array.isArray(o.catatan) && o.catatan.length) baris.push("");
    if (temuan.some((t) => JENIS_RAGU.has(t.jenis))) {
      baris.push("Butir bertanda \"Periksa\" belum tentu salah: hanya diingatkan di daftar ini dan TIDAK diwarnai merah di naskah.");
      baris.push("");
    }
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
   * o: { nama, jenis ("putusan"|"bas"|"relaas"), aksi ("unduh"|"unggah"), terpotong, tawarkanIngat, judul?, jenisTeks?, labelLanjut? }
   * (judul/jenisTeks/labelLanjut: seret-lepas e-Doc 30 Okt - jenis dokumen selain putusan/BAS/relaas dan temuan kesesuaian)
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
      kepala.appendChild(buat("div", "font-size:17px;font-weight:700;color:#9a3412;", (o && o.judul) || "Naskah ini masih memuat sisa blangko"));
      const jenisTeks = (o && o.jenisTeks) || (o && NAMA_NASKAH[o.jenis] ? NAMA_NASKAH[o.jenis] : "naskah");
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
      const bLanjut = buat("button", gayaTombol, (o && o.labelLanjut) || "Lanjut saja");
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
      if (B && typeof B.periksaSisaRtf === "function" && !(opsi && opsi.jenis === "relaas") && kenaliBentuk(bita, nama) === "rtf") {
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
      const h = await periksaBitaServerAtauLokal(bita, o.nama, { bacaPdf: o.bacaPdf, jenis: o.jenis });
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
        catatan: o.catatan,
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
    /* 31 Okt: sisa blangko PASTI dimerahkan di RTF cetak/unduh panel; baris kosong berlebih dirapikan. */
    rentangParagraf,
    merahkanRtf,
    rapikanBarisKosong,
    JENIS_RAGU,
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
