/**
 * ============================================================================
 * BAS DARI WORD KE PDF BERTANDA TANGAN SCAN - JENDELA e-Doc BAS DI SIPP (30 Okt 2026)
 * ============================================================================
 *
 * SIPP 7.0.4 (Jadwal Sidang > Kelola Dokumen Elektronik, kolom `from` = bas) hanya menerima PDF: kotak berkasnya ber-accept ".pdf",
 * dan pada perubahan pilihan ia memeriksa akhiran nama - bukan .pdf -> alert "Hanya file PDF yang diperbolehkan!" dan pilihan dikosongkan.
 * BAS disunting di Word (RTF, DOCX, DOC), jadi berkas ini mencegat PILIHAN berkas di jendela itu (peristiwa change, fase tangkap):
 *
 *   1. accept kotak berkas dilebarkan saat diklik, supaya berkas Word tampil di dialog pilih berkas;
 *   2. berkas berakhiran Word (rtf/doc/docx/dot/dotx/docm/odt/...) ditahan dari pemeriksa SIPP (stopImmediatePropagation) dan dikenali
 *      dari ISINYA: RTF / DOCX (juga ODT) / DOC. PDF dan berkas lain TIDAK disentuh - SIPP menjawab seperti biasa;
 *   3. sisa blangko diperiksa lebih dulu (deteksi-sisa-blangko.js, sama dengan unggah lain): ada sisa -> peringatan, Batal
 *      mengosongkan pilihan;
 *   4. berkas dikirim ke rute bas/word-ke-pdf (hanya MENGHITUNG, tidak menyimpan): server mengubahnya ke PDF dan membubuhkan
 *      tanda tangan scan Panitera Pengganti dan Ketua Majelis di atas namanya (sesuai blok tanda tangan BAS);
 *   5. PDF hasilnya DIPASANG di kotak berkas SIPP lalu peristiwa change dikirim ulang (bertanda, tidak dicegat lagi): pemeriksa SIPP kini
 *      melihat berkas .pdf dan meloloskannya, tombol Simpan SIPP muncul. SIPP sendiri yang mengunggah lewat Simpan-nya - akun, jejak,
 *      dan nama berkas di SIPP sama dengan unggahan PDF biasa. Simpan yang ditekan selagi PDF dibuat ditahan sampai selesai.
 *
 * Yang belum punya tanda tangan tersahkan TIDAK menggagalkan: PDF tetap jadi, kolom tanda tangannya kosong, dan petugas diberi
 * tahu siapa orangnya. Bila pengubahan gagal, alasannya ditampilkan dan pilihan dikosongkan (seperti penolakan SIPP sendiri).
 *
 * Tidak ada tulisan ke SIPP dari sini (tidak ada fetch/XHR ke SIPP, tidak ada isian baru yang bernama) dan tidak ada kata
 * ALETA pada nama berkas atau isi kiriman; kotak centang tanda tangan sengaja tanpa atribut name.
 */
(function (akar) {
  "use strict";

  if (!akar || typeof akar.document === "undefined" || akar.aletaBasWordPdf) return;
  // Hanya halaman SIPP: bukan ABT dan bukan portal.
  try {
    const jalur = akar.location && akar.location.pathname ? String(akar.location.pathname) : "";
    if (/\/aps_badilag\//i.test(jalur) || /^\/aleta(?:\/|$)/i.test(jalur)) return;
  } catch {
    /* tanpa lokasi (uji): lanjut */
  }

  const API_UBAH = "/aleta/api/aleta-ecourt/bas/word-ke-pdf";
  const BATAS_BYTE = 20 * 1024 * 1024; // sama dengan batas rute konversi
  const BATAS_MS = 240000; // soffice yang baru dijalankan dapat memakan puluhan detik
  const KELAS = "aleta-bwp";
  const KELAS_GAYA = "aleta-bwp-gaya";
  const JENIS_BAS = "bas";

  const BENTUK_LABEL = { rtf: "RTF", docx: "DOCX", doc: "DOC" };
  /** Akhiran nama yang dianggap berkas Word (SIPP menolaknya karena bukan .pdf). */
  const POLA_AKHIRAN_WORD = /\.(?:rtf|docx?|docm|dotx?|dotm|odt|ott|wps)$/i;
  /** accept kotak berkas SIPP ".pdf,application/pdf" dilebarkan agar berkas Word tampil di dialog pilih berkas. */
  const ACCEPT_LEBAR = ".pdf,application/pdf,.rtf,.doc,.docx,.dot,.dotx,.docm,.odt";
  const TANDA_LEPAS = "data-bwp-lepas";

  // --------------------------------------------------------------------------
  // Murni: mengenali berkas dari isinya
  // --------------------------------------------------------------------------
  function ada(bita, pola, dari, sampai) {
    const akhir = Math.min(sampai === undefined ? bita.length : sampai, bita.length) - pola.length;
    let i = Math.max(0, dari || 0);
    while (i <= akhir) {
      i = bita.indexOf(pola[0], i);
      if (i < 0 || i > akhir) return false;
      let cocok = true;
      for (let k = 1; k < pola.length; k += 1) {
        if (bita[i + k] !== pola[k]) {
          cocok = false;
          break;
        }
      }
      if (cocok) return true;
      i += 1;
    }
    return false;
  }
  const asciiBita = (s) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
  const utf16Bita = (s) => Uint8Array.from(Array.from(s).flatMap((c) => [c.charCodeAt(0), 0]));
  const POLA_WORD_ZIP = asciiBita("word/");
  const POLA_ODT = asciiBita("application/vnd.oasis.opendocument.text");
  const POLA_WORD_OLE = utf16Bita("WordDocument");

  /** "rtf" | "docx" | "doc" bila Word; "pdf" bila PDF; "" selain itu (xlsx, zip, xls, dst. BUKAN Word). Sama dengan kenaliBerkasWord di server. */
  function kenaliBerkasWord(bita) {
    if (!bita || bita.length < 5) return "";
    const awal = String.fromCharCode(bita[0], bita[1], bita[2], bita[3], bita[4]);
    if (awal === "%PDF-") return "pdf";
    if (awal === "{\\rtf") return "rtf";
    if (bita[0] === 0x50 && bita[1] === 0x4b && bita[2] === 0x03 && bita[3] === 0x04) {
      const ujung = Math.max(0, bita.length - 512 * 1024);
      return ada(bita, POLA_WORD_ZIP, 0, 64 * 1024) || ada(bita, POLA_WORD_ZIP, ujung) || ada(bita, POLA_ODT, 0, 4096) ? "docx" : "";
    }
    if (bita[0] === 0xd0 && bita[1] === 0xcf && bita[2] === 0x11 && bita[3] === 0xe0) return ada(bita, POLA_WORD_OLE) ? "doc" : "";
    return "";
  }

  /** "BAS 12.docx" -> "BAS 12.pdf"; tanpa jalur, tanpa kata ALETA. */
  function namaPdf(nama) {
    const dasar = String(nama == null ? "" : nama)
      .replace(/^.*[\\/]/, "")
      .replace(/\.(?:rtf|docx?|docm|dotx?|dotm|odt|ott|wps|txt|pdf)$/i, "")
      .replace(/a[\s._\-*]*l[\s._\-*]*e[\s._\-*]*t[\s._\-*]*a/gi, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s._-]+|[\s._-]+$/g, "")
      .slice(0, 150)
      .trim();
    return `${dasar || "BAS"}.pdf`;
  }

  function ukuranTeks(byte) {
    const n = Number(byte) || 0;
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
    return `${Math.max(1, Math.round(n / 1024))} KB`;
  }

  /** Jenis e-Doc dari kolom tersembunyi `from` jendela e-Doc SIPP ("bas" = e-Doc BAS). */
  function jenisBorang(form) {
    if (!form || typeof form.querySelector !== "function") return "";
    const e = form.querySelector('[name="from"]');
    const kode = e ? String(e.value || "").toLowerCase() : "";
    return /^bas$|edoc_bas/.test(kode) ? JENIS_BAS : "";
  }

  // --------------------------------------------------------------------------
  // Peramban: tampilan, penggantian berkas, pengubahan
  // --------------------------------------------------------------------------
  const doc = akar.document;
  const keadaan = new WeakMap(); // input berkas -> { nomor, jalan: Promise|null, asli: File|null, hasil: "" }
  const lolos = new WeakSet(); // formulir yang kirimannya sudah boleh lewat (diulang sesudah PDF siap)
  let denganTtd = true; // pilihan petugas, berlaku selama halaman terbuka
  let nomorUrut = 0;

  function ambil(input) {
    let k = keadaan.get(input);
    if (!k) {
      k = { nomor: 0, jalan: null, asli: null, hasil: "" };
      keadaan.set(input, k);
    }
    return k;
  }

  function pasangGaya() {
    if (doc.getElementById(KELAS_GAYA) || !doc.head) return;
    const g = doc.createElement("style");
    g.id = KELAS_GAYA;
    g.textContent =
      `.${KELAS}{margin:6px 0 2px;padding:6px 8px;font:12px/1.45 Arial,Helvetica,sans-serif;text-align:left;border-left:3px solid #7a8b83;background:rgba(127,127,127,.10);color:inherit}` +
      `.${KELAS}.ok{border-left-color:#2e7d32}.${KELAS}.awas{border-left-color:#b26a00}.${KELAS}.gagal{border-left-color:#b3261e}` +
      `.${KELAS} ul{margin:4px 0 0 16px;padding:0}.${KELAS} li{margin:1px 0}` +
      `.${KELAS} label{display:block;margin-top:5px;cursor:pointer}.${KELAS} .i{cursor:help;margin-left:4px;font-weight:700}`;
    doc.head.appendChild(g);
  }

  function panelUntuk(input) {
    const induk = input.parentNode;
    let p = induk ? induk.querySelector(`.${KELAS}`) : null;
    if (p) return p;
    pasangGaya();
    p = doc.createElement("div");
    p.className = KELAS;
    p.setAttribute("data-bwp", "panel");
    const teks = doc.createElement("div");
    teks.className = "teks";
    teks.setAttribute("role", "status");
    teks.setAttribute("aria-live", "polite");
    const daftar = doc.createElement("ul");
    const label = doc.createElement("label");
    const kotak = doc.createElement("input");
    kotak.type = "checkbox"; // tanpa name: tidak ikut terkirim ke SIPP
    kotak.checked = denganTtd;
    kotak.setAttribute("data-bwp", "ttd");
    const keterangan = doc.createElement("span");
    keterangan.textContent = " Bubuhkan tanda tangan scan Panitera Pengganti dan Ketua Majelis ke PDF";
    const info = doc.createElement("span");
    info.className = "i";
    info.textContent = "(i)";
    info.title =
      "Tanda tangan dibubuhkan di atas nama yang tertera pada blok tanda tangan BAS, hanya bila orangnya punya tanda tangan scan yang sudah disahkan dan akun Anda berhak memasangnya. Yang belum ada dibiarkan kosong dan disebut di sini.";
    label.append(kotak, keterangan, info);
    p.append(teks, daftar, label);
    induk.appendChild(p);
    return p;
  }

  function tulis(input, jenis, kalimat, baris) {
    const p = panelUntuk(input);
    p.className = `${KELAS} ${jenis}`;
    p.querySelector(".teks").textContent = kalimat;
    const ul = p.querySelector("ul");
    ul.textContent = "";
    for (const b of baris || []) {
      const li = doc.createElement("li");
      li.textContent = b;
      ul.appendChild(li);
    }
    return p;
  }

  function hapusPanel(input) {
    const induk = input.parentNode;
    const p = induk ? induk.querySelector(`.${KELAS}`) : null;
    if (p) p.remove();
  }

  /** Memasang `berkas` sebagai satu-satunya pilihan di kotak berkas (peramban: DataTransfer; cadangan: sifat files). */
  function pasangBerkas(input, berkas) {
    if (typeof akar.DataTransfer === "function") {
      try {
        const dt = new akar.DataTransfer();
        dt.items.add(berkas);
        input.files = dt.files;
        return;
      } catch {
        /* jatuh ke cadangan */
      }
    }
    Object.defineProperty(input, "files", { value: [berkas], configurable: true });
  }

  function kosongkan(input) {
    try {
      input.value = "";
    } catch {
      /* peramban tertentu menolak */
    }
    if (input.files && input.files.length) {
      try {
        Object.defineProperty(input, "files", { value: [], configurable: true });
      } catch {
        /* sudah kosong */
      }
    }
  }

  async function bacaBita(berkas) {
    if (berkas && typeof berkas.arrayBuffer === "function") return new Uint8Array(await berkas.arrayBuffer());
    return await new Promise((selesai, gagal) => {
      const r = new akar.FileReader();
      r.onload = () => selesai(new Uint8Array(r.result));
      r.onerror = () => gagal(new Error("berkas tidak terbaca"));
      r.readAsArrayBuffer(berkas);
    });
  }

  function pesanDariJawab(luar, status) {
    const data = luar && luar.data !== undefined ? luar.data : luar;
    const pesan =
      (data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) ||
      (luar && luar.error && typeof luar.error === "object" ? luar.error.message : luar && luar.error) ||
      "";
    return String(pesan || `server menjawab ${status}`);
  }

  /** Kirim satu berkas Word ke rute pengubah; pulang { pdf: Uint8Array, nama, penandatangan[], peringatan[], blokTtd }. Melempar Error berpesan jelas. */
  async function mintaPdf(berkas, bolehTtd) {
    if (typeof akar.alatAmbil !== "function") throw new Error("penyambung ke server belum siap; muat ulang halaman ini");
    const badan = new akar.FormData();
    badan.append("berkas", berkas, berkas.name);
    badan.append("ttd", bolehTtd ? "1" : "0");
    const r = await akar.alatAmbil(API_UBAH, { method: "POST", body: badan, credentials: "include", batasMs: BATAS_MS }, "Mengubah BAS ke PDF");
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    if (!r.ok) throw new Error(pesanDariJawab(luar, r.status));
    const d = luar && luar.data !== undefined ? luar.data : luar;
    if (!d || !d.pdfBase64) throw new Error("server tidak mengembalikan PDF");
    const pdf = Uint8Array.from(akar.atob(String(d.pdfBase64)), (c) => c.charCodeAt(0));
    if (kenaliBerkasWord(pdf) !== "pdf") throw new Error("hasil dari server bukan PDF");
    return {
      pdf,
      nama: namaPdf(d.namaBerkas || berkas.name),
      penandatangan: Array.isArray(d.penandatangan) ? d.penandatangan : [],
      peringatan: Array.isArray(d.peringatan) ? d.peringatan.map(String) : [],
      blokTtd: String(d.blokTtd || ""),
    };
  }

  function barisPenandatangan(h) {
    return h.penandatangan.map((p) => {
      const sebut = `${p.jabatan || "Penanda tangan"} ${p.nama || ""}`.trim();
      return p.status === "terpasang" ? `${sebut}: tanda tangan terpasang.` : `${sebut}: ${p.keterangan || "tanda tangan tidak terpasang"}.`;
    });
  }

  async function periksaSisa(berkas) {
    const B = akar.aletaDeteksiSisa;
    if (!B || typeof B.tinjau !== "function") return true;
    try {
      const h = await B.tinjau(berkas, { nama: berkas.name, jenis: JENIS_BAS, aksi: "unggah" });
      return !h || h.lanjut !== false;
    } catch {
      return true; // galat pemeriksa tidak boleh menahan unggah
    }
  }

  /** Mengirim ulang peristiwa change (bertanda) supaya pemeriksa dan tombol Simpan SIPP bekerja atas berkas yang sudah .pdf. */
  function lepasKeSipp(input) {
    input.setAttribute(TANDA_LEPAS, "1");
    try {
      input.dispatchEvent(new akar.Event("change", { bubbles: true }));
    } finally {
      input.removeAttribute(TANDA_LEPAS);
    }
  }

  /** Seluruh urutan untuk satu pilihan berkas Word. Tidak pernah melempar. */
  async function kerjakan(input, berkas, nomor) {
    const k = ambil(input);
    const masihBerlaku = () => k.nomor === nomor;
    const tolak = (kalimat) => {
      kosongkan(input);
      k.asli = null;
      k.hasil = "gagal";
      tulis(input, "gagal", kalimat);
    };
    try {
      if (berkas.size > BATAS_BYTE) {
        tolak(`${berkas.name} lebih dari ${BATAS_BYTE / 1024 / 1024} MB; terlalu besar untuk diubah ke PDF. Pilihan dikosongkan.`);
        return;
      }
      let bita = null;
      try {
        bita = await bacaBita(berkas);
      } catch {
        bita = null;
      }
      if (!masihBerlaku()) return;
      const bentuk = bita ? kenaliBerkasWord(bita) : "";
      if (bentuk === "pdf") {
        // namanya Word tetapi isinya PDF: cukup diberi nama .pdf (SIPP memeriksa akhiran nama)
        const pdf = new akar.File([bita], namaPdf(berkas.name), { type: "application/pdf" });
        pasangBerkas(input, pdf);
        tulis(input, "ok", `Isi berkas ini ternyata PDF; dipakai sebagai ${pdf.name}. Tekan Simpan untuk mengunggah.`);
        lepasKeSipp(input);
        return;
      }
      if (bentuk !== "rtf" && bentuk !== "docx" && bentuk !== "doc") {
        tolak(`Isi ${berkas.name} bukan berkas Word (RTF, DOCX, atau DOC) maupun PDF, jadi tidak dapat diubah. SIPP hanya menerima PDF; pilihan dikosongkan.`);
        return;
      }
      tulis(input, "awas", `Berkas Word terdeteksi (${BENTUK_LABEL[bentuk] || bentuk}). SIPP hanya menerima PDF, jadi berkas ini diubah ke PDF dulu...`);
      if (!(await periksaSisa(berkas))) {
        if (!masihBerlaku()) return;
        tolak("Dibatalkan karena naskah masih memuat sisa blangko. Perbaiki naskahnya, lalu pilih berkas lagi.");
        return;
      }
      if (!masihBerlaku()) return;
      tulis(input, "awas", `Mengubah ${berkas.name} ke PDF${denganTtd ? " dan membubuhkan tanda tangan scan" : ""}... mohon tunggu, jangan tutup jendela ini.`);
      const h = await mintaPdf(berkas, denganTtd);
      if (!masihBerlaku()) return;
      const pdf = new akar.File([h.pdf], h.nama, { type: "application/pdf" });
      pasangBerkas(input, pdf);
      const baris = barisPenandatangan(h).concat(h.peringatan);
      if (!denganTtd) baris.unshift("Tanpa tanda tangan scan (sesuai pilihan Anda).");
      const bersih = h.penandatangan.length > 0 && h.penandatangan.every((p) => p.status === "terpasang") && h.peringatan.length === 0;
      const jenis = bersih || (!denganTtd && !h.peringatan.length) ? "ok" : "awas";
      tulis(input, jenis, `Siap diunggah sebagai PDF: ${h.nama} (${ukuranTeks(h.pdf.length)}). Berkas Word asli tidak ikut terunggah; tekan Simpan untuk mengunggah.`, baris);
      k.hasil = "ok";
      lepasKeSipp(input);
    } catch (e) {
      if (!masihBerlaku()) return;
      const sebab = String((e && e.message) || e);
      tolak(`Berkas Word tidak dapat diubah ke PDF: ${sebab}. Pilihan dikosongkan; coba lagi atau unggah PDF.`);
    }
  }

  function mulai(input, berkas) {
    const k = ambil(input);
    nomorUrut += 1;
    k.nomor = nomorUrut;
    k.asli = berkas;
    k.hasil = "";
    const janji = kerjakan(input, berkas, k.nomor).finally(() => {
      if (k.jalan === janji) k.jalan = null;
    });
    k.jalan = janji;
    return janji;
  }

  function lupakan(input) {
    const k = ambil(input);
    nomorUrut += 1;
    k.nomor = nomorUrut;
    k.asli = null;
    hapusPanel(input);
  }

  function inputBas(el) {
    if (!el || el.nodeType !== 1 || el.tagName !== "INPUT" || String(el.type).toLowerCase() !== "file") return null;
    if (typeof akar.alatPemilihMilikAleta === "function" && akar.alatPemilihMilikAleta(el)) return null;
    const form = el.form || (el.closest ? el.closest("form") : null);
    return jenisBorang(form) === JENIS_BAS ? el : null;
  }

  function saatUbah(e) {
    try {
      const t = e.target;
      // kotak centang tanda tangan: ubah ulang dari berkas ASLI
      if (t && t.nodeType === 1 && t.getAttribute && t.getAttribute("data-bwp") === "ttd") {
        denganTtd = Boolean(t.checked);
        const form = t.closest("form");
        const input = form ? form.querySelector('input[type="file"]') : null;
        const k = input ? ambil(input) : null;
        if (k && k.asli) mulai(input, k.asli);
        return;
      }
      const input = inputBas(t);
      if (!input) return;
      if (input.hasAttribute(TANDA_LEPAS)) return; // peristiwa kiriman ulang kita sendiri: biarkan SIPP memeriksanya
      const berkas = input.files && input.files[0];
      if (berkas && input.files.length === 1 && POLA_AKHIRAN_WORD.test(String(berkas.name))) {
        // SIPP akan menolaknya (bukan .pdf) dan mengosongkan pilihan: tahan, ubah dulu ke PDF.
        e.stopImmediatePropagation();
        mulai(input, berkas);
        return;
      }
      lupakan(input); // PDF atau berkas lain, atau pilihan dikosongkan: urusan SIPP seperti biasa
    } catch {
      /* pencegat tidak boleh mengganggu SIPP */
    }
  }

  /** Dialog pilih berkas SIPP hanya menampilkan .pdf; lebarkan sesaat sebelum dibuka agar berkas Word terlihat. */
  function saatKlik(e) {
    try {
      const input = inputBas(e.target);
      if (input && input.getAttribute("accept") !== ACCEPT_LEBAR) input.setAttribute("accept", ACCEPT_LEBAR);
    } catch {
      /* hanya kemudahan memilih */
    }
  }

  /** Simpan yang ditekan selagi PDF dibuat ditahan, lalu diulang lewat tombolnya begitu selesai. */
  function saatKirim(e) {
    try {
      const f = e.target;
      if (!f || f.nodeName !== "FORM" || lolos.has(f) || jenisBorang(f) !== JENIS_BAS) return;
      const input = f.querySelector('input[type="file"]');
      const k = input ? keadaan.get(input) : null;
      if (!k || !k.jalan) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const pengirim = e.submitter || f.querySelector('[type="submit"]');
      void (async () => {
        try {
          await k.jalan;
        } catch {
          /* kerjakan() tidak melempar */
        }
        await new Promise((r) => setTimeout(r, 0)); // lepas dari peristiwa submit yang sedang berjalan
        if (!input.files || !input.files.length) return; // pengubahan gagal/dibatalkan: pilihan sudah dikosongkan, tidak ada yang dikirim
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
      /* pencegat tidak boleh mengganggu Simpan SIPP */
    }
  }

  doc.addEventListener("change", saatUbah, true);
  doc.addEventListener("click", saatKlik, true);
  doc.addEventListener("submit", saatKirim, true);

  akar.aletaBasWordPdf = Object.freeze({ kenaliBerkasWord, namaPdf, jenisBorang, ukuranTeks, mintaPdf, barisPenandatangan, ttdDipilih: () => denganTtd });
  if (typeof module !== "undefined" && module.exports) module.exports = akar.aletaBasWordPdf;
})(typeof globalThis !== "undefined" ? globalThis : this);
