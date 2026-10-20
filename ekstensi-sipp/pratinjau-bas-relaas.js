"use strict";

/**
 * ============================================================================
 * PRATINJAU BAS DAN RELAAS DI HALAMAN SIPP SEBELUM DIUNDUH (20 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: tombol unduh BAS dan relaas di SIPP menampilkan isi
 * dokumennya lebih dulu, di halaman itu juga; baru dari situ dapat diunduh.
 *
 * ----------------------------------------------------------------------------
 * YANG DICEGAT (hasil telaah kode SIPP di server, BACA SAJA)
 * ----------------------------------------------------------------------------
 *   1. Tautan e-Doc BAS: "Unduh Dokumen BAS" di tab Jadwal Sidang (edoc_bas),
 *      dan ikon unduh di Proses Minutasi. Berkasnya resources/file/doc/<th>/<bln>/
 *      <satker>_<nomor>_bas_<n>_<waktu>.<pdf|rtf|doc|docx> - dibuka lewat <a href>.
 *   2. Tautan e-Doc relaas: "Lihat" di Data Relaas (kolom upload_relaas) dan
 *      "download" resi+relaas. Hampir seluruhnya pdf/jpg.
 *   3. Borang cetak di jendela SIPP (popup_form): BAS Pertama/Lanjutan/Eksekusi
 *      (c_template_bas_*), Surat Panggilan RELAAS, relaas ikrar, instrumen
 *      panggilan, amplop (c_template_relaas_*), pemberitahuan putusan. Semuanya POST ke
 *      .../cetak_* dan dijawab RTF berlampiran (Content-Type application/vnd.ms-word,
 *      Content-Disposition attachment).
 *   4. Cetak BA elektronik (window.open(.../cetak_BA_elektronik/...)): GET, RTF.
 *
 * ----------------------------------------------------------------------------
 * YANG TERJADI
 * ----------------------------------------------------------------------------
 *   Saklar "Pratinjau sebelum unduh (BAS & relaas)" menyala (bawaan) -> klik /
 *   Cetak membuka kotak pratinjau besar (Shadow DOM, gelap/terang):
 *     - PDF           : penampil PDF bawaan peramban (blob dalam iframe);
 *     - gambar        : <img>;
 *     - RTF/DOC/DOCX  : diubah ke PDF oleh server (rute konversi-naskah yang sudah
 *                       ada: soffice, paling akurat) lalu ditampilkan sebagai PDF;
 *                       bila server tak terjangkau: teks berformat sederhana
 *                       (pengurai RTF/DOCX deteksi-sisa-blangko.js; tulisan merah
 *                       = sisa isian ditandai) atau pesan;
 *     - lainnya (zip, ...): tidak ada yang bisa ditampilkan -> diunduh langsung.
 *   Tombol: Unduh (alatUnduh -> chrome.downloads, nama berkas sama dengan
 *   sekarang, berkas ASLI dari SIPP bukan hasil konversi), Cetak (bila
 *   peramban mengizinkan), Tutup / Esc. Deteksi sisa blangko dijalankan atas
 *   berkas RTF/DOCX dan peringatannya tampil di atas pratinjau.
 *   Shift/Ctrl/Alt-klik = unduh langsung (tanpa pratinjau). Saklar mati =
 *   perilaku lama persis (modul ini tidak menyentuh apa pun).
 *
 * ----------------------------------------------------------------------------
 * JAMINAN
 * ----------------------------------------------------------------------------
 *   - Hanya MEMBACA berkas yang sama dengan yang akan diunduh, SATU kali per
 *     klik (hasilnya dipakai untuk pratinjau DAN unduhan - tidak ada permintaan
 *     kedua ke SIPP). Tidak ada yang ditulis ke SIPP.
 *   - Borang SIPP divalidasi SIPP sendiri dulu (penangan submit milik borang
 *     berjalan sebelum modul ini, yang mendengarkan di fase gelembung).
 *   - Gagal di mana pun -> tindakan ASLI dijalankan (tidak ada unduhan hilang).
 *   - Tanpa tulisan apa pun bernama aleta di DOM SIPP selain kotak lokal ini
 *     (kelas aleta-sisip, diabaikan pengamat konten.js); tidak ada kata ALETA
 *     yang dikirim ke SIPP.
 */
(function pratinjauBasRelaasModul() {
  if (typeof globalThis === "undefined" || typeof document === "undefined" || globalThis.aletaPratinjauBasRelaas) return;

  const KUNCI = "pratinjauBasRelaas";
  const KUNCI_TEMA = "temaPanel";
  const API_KONVERSI = "/aleta/api/aleta-ecourt/putusan/konversi-naskah";
  const BATAS_BAJT = 40 * 1024 * 1024;
  const BATAS_KONVERSI_BAJT = 20 * 1024 * 1024;
  const BATAS_KONVERSI_MS = 130 * 1000;
  const ID_KOTAK = "aleta-pratinjau-berkas";
  const NAMA_JENIS = { bas: "Berita Acara Sidang", relaas: "Relaas" };

  // Alamat cetak SIPP (c_template_*/cetak_*): BAS dan relaas. Pola longgar pada nama
  // controller, ketat pada nama fungsi cetaknya - teguran/pengembalian panjar dan
  // akta TIDAK ikut.
  const POLA_CETAK_BAS = /\/c_template_[a-z0-9_]*\/cetak_(?:bas[a-z0-9_]*|ba_[a-z0-9_]+)(?:[/?#]|$)/i;
  const POLA_CETAK_RELAAS =
    /\/c_template_[a-z0-9_]*\/cetak_(?:relaas[a-z0-9_]*|risalah_relaas|template_pendukung|template_amplop|pemberitahuan_putusan[a-z0-9_]*|pemberitahuan_pts|panggil[a-z0-9_]*)(?:[/?#]|$)/i;
  // Berkas e-Doc: <satker>_<nomor>_bas_<urutan>_<waktu>.ext dan relaas_/resi_<angka>_<angka>.ext
  const POLA_BERKAS_BAS = /(?:^|[_\-/ ])bas[_\- ]\d+[_\-]\d+\.[a-z0-9]{2,5}$/i;
  const POLA_BERKAS_RELAAS = /(?:^|[_\-/ ])(?:relaas|resi)[_\-]\d+(?:[_\-]\d+)+\.[a-z0-9]{2,5}$/i;

  let nyala = true;
  let kotakAktif = null;
  let sibuk = false;
  /** Tautan yang sengaja dibiarkan lewat (tindakan asli sebagai cadangan). */
  let lewatiSekali = null;
  /** Klik terakhir pada tombol kirim borang: untuk Shift/Ctrl = unduh langsung. */
  let ujungKlik = null;
  const KADALUARSA_UJUNG_MS = 4000;

  // --------------------------------------------------------------------------
  // Pembantu
  // --------------------------------------------------------------------------
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function catat(jenis, ringkas, rinci) {
    try {
      if (typeof alatCatat === "function") alatCatat(jenis, ringkas, rinci);
    } catch {
      /* catatan saja */
    }
  }
  function halamanSipp() {
    const p = String((location && location.pathname) || "");
    return !/\/aps_badilag\//i.test(p) && !/^\/aleta(?:\/|$)/i.test(p);
  }
  function mutlak(alamat) {
    try {
      const u = new URL(String(alamat || ""), location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      if (u.origin !== location.origin) return "";
      return u.href;
    } catch {
      return "";
    }
  }
  const jalur = (alamat) => {
    try {
      return new URL(alamat, location.href).pathname;
    } catch {
      return "";
    }
  };
  function langsungKah(e) {
    return Boolean(e && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
  }

  /** Jenis dari ALAMAT CETAK SIPP ("bas" | "relaas" | ""). BAS didahulukan. */
  function jenisCetak(alamat) {
    const p = jalur(alamat);
    if (POLA_CETAK_BAS.test(p)) return "bas";
    if (POLA_CETAK_RELAAS.test(p)) return "relaas";
    return "";
  }

  /** Jenis dari nama berkas e-Doc. */
  function jenisBerkas(alamat) {
    const nama = decodeURIComponentAman(jalur(alamat).split("/").filter(Boolean).pop() || "");
    if (POLA_BERKAS_BAS.test(nama)) return "bas";
    if (POLA_BERKAS_RELAAS.test(nama)) return "relaas";
    return "";
  }
  function decodeURIComponentAman(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }

  async function bitaDari(blob) {
    if (blob && typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
    return await new Promise((selesai, gagal) => {
      const pembaca = new FileReader();
      pembaca.onload = () => selesai(new Uint8Array(pembaca.result));
      pembaca.onerror = () => gagal(pembaca.error || new Error("berkas tidak terbaca"));
      pembaca.readAsArrayBuffer(blob);
    });
  }

  function akhiranNama(nama) {
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(nama || ""));
    return m ? m[1].toLowerCase() : "";
  }

  /** "pdf" | "rtf" | "docx" | "doc" | "gambar" | "lain" - dari isi, bukan dari nama. */
  function kenaliBentuk(bita, nama, tipe) {
    const k = bita.subarray(0, 12);
    const teks = String.fromCharCode.apply(null, Array.from(k));
    const akhiran = akhiranNama(nama);
    const mime = String(tipe || "").toLowerCase();
    if (teks.startsWith("%PDF-")) return "pdf";
    if (/^\s*\{\\rtf/.test(teks)) return "rtf";
    if (k[0] === 0x89 && teks.slice(1, 4) === "PNG") return "gambar";
    if (k[0] === 0xff && k[1] === 0xd8 && k[2] === 0xff) return "gambar";
    if (teks.startsWith("GIF8") || (teks.startsWith("BM") && akhiran === "bmp")) return "gambar";
    if (teks.startsWith("PK\u0003\u0004")) {
      return akhiran === "docx" || akhiran === "doc" || /wordprocessingml/.test(mime) ? "docx" : "lain";
    }
    if (k[0] === 0xd0 && k[1] === 0xcf && k[2] === 0x11 && k[3] === 0xe0) return akhiran === "doc" || /msword/.test(mime) ? "doc" : "lain";
    return "lain";
  }

  function mimeBentuk(bentuk, bita) {
    if (bentuk === "pdf") return "application/pdf";
    if (bentuk === "gambar") {
      if (bita[0] === 0x89) return "image/png";
      if (bita[0] === 0xff) return "image/jpeg";
      if (bita[0] === 0x47) return "image/gif";
      return "image/bmp";
    }
    return "application/octet-stream";
  }
  function akhiranBentuk(bentuk, bita) {
    if (bentuk === "gambar") return { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/bmp": "bmp" }[mimeBentuk(bentuk, bita)];
    return bentuk === "lain" ? "" : bentuk;
  }

  function namaDariDisposisi(nilai) {
    const s = String(nilai || "");
    const bintang = s.match(/filename\*\s*=\s*(?:[A-Za-z0-9_-]+)'[^']*'([^;]+)/i);
    if (bintang) return decodeURIComponentAman(bintang[1].trim().replace(/^"|"$/g, ""));
    const biasa = s.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
    return biasa ? String(biasa[1] !== undefined ? biasa[1] : biasa[2]).trim() : "";
  }

  /** Nama yang LAYAK (sama dengan jalur unduhan sekarang): Content-Disposition, tautan, alamat. */
  function pilihNama(kandidat, jenis, bentuk, bita, tipe) {
    for (const k of kandidat) {
      if (!k) continue;
      let n = "";
      if (typeof alatNamaUnduhanLayak === "function") n = alatNamaUnduhanLayak(k, tipe);
      else if (/\.[A-Za-z0-9]{2,5}$/.test(k)) n = String(k).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_");
      if (n) return n;
    }
    const akhiran = akhiranBentuk(bentuk, bita) || "rtf";
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const stempel = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    return `${jenis === "bas" ? "BAS" : "Relaas"} ${stempel}.${akhiran}`;
  }

  const ukuranTeks = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const LABEL_BENTUK = { pdf: "PDF", rtf: "RTF", docx: "DOCX", doc: "DOC", gambar: "Gambar", lain: "Berkas" };

  // --------------------------------------------------------------------------
  // Saklar (chrome.storage.local, bawaan MENYALA; kunci per akun ada di popup)
  // --------------------------------------------------------------------------
  async function bacaSaklar() {
    try {
      const s = await chrome.storage.local.get([KUNCI]);
      nyala = !(s && s[KUNCI] === false);
    } catch {
      nyala = true;
    }
  }
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((ubah, tempat) => {
        if (tempat === "local" && ubah && ubah[KUNCI]) nyala = ubah[KUNCI].newValue !== false;
      });
    }
  } catch {
    /* tanpa pendengar: nilai terakhir yang terbaca berlaku */
  }

  // --------------------------------------------------------------------------
  // Mengenali sasaran
  // --------------------------------------------------------------------------
  /** Tautan: e-Doc BAS/relaas (href) atau window.open(...cetak...) di onclick. */
  function sasaranDariTautan(a) {
    const onclick = a.getAttribute("onclick") || "";
    const dariKlik = /window\.open\(\s*(['"])(.+?)\1/.exec(onclick);
    if (dariKlik) {
      const alamat = mutlak(dariKlik[2]);
      const jenis = alamat ? jenisCetak(alamat) : "";
      if (!jenis) return null;
      return { jenis, metode: "GET", alamat, petunjuk: "", asli: () => window.open(alamat) };
    }
    const href = a.getAttribute("href") || "";
    if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) return null;
    const alamat = mutlak(a.href);
    if (!alamat) return null;
    let jenis = jenisCetak(alamat) || jenisBerkas(alamat);
    if (!jenis) {
      if (/unduh\s+dokumen\s+bas/i.test(sebaris(a.textContent))) jenis = "bas";
      else if (a.closest && a.closest(".upload_relaas")) jenis = "relaas";
    }
    if (!jenis) return null;
    const petunjuk = a.getAttribute("download") || decodeURIComponentAman(jalur(alamat).split("/").filter(Boolean).pop() || "");
    return {
      jenis,
      metode: "GET",
      alamat,
      petunjuk,
      asli: () => {
        lewatiSekali = a;
        try {
          a.click();
        } finally {
          lewatiSekali = null;
        }
      },
    };
  }

  /** Borang POST ke .../cetak_* BAS atau relaas. */
  function sasaranDariBorang(form, pengirim) {
    if (!form || String(form.tagName).toUpperCase() !== "FORM") return null;
    if (String(form.method || "get").toUpperCase() !== "POST") return null;
    const alamat = mutlak(form.action || location.href);
    const jenis = alamat ? jenisCetak(alamat) : "";
    if (!jenis) return null;
    let data;
    try {
      data = pengirim ? new FormData(form, pengirim) : new FormData(form);
    } catch {
      data = new FormData(form);
    }
    const badan = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      if (typeof v !== "string") return null; // berisi berkas: bukan borang cetak
      badan.append(k, v);
    }
    return {
      jenis,
      metode: "POST",
      alamat,
      badan,
      petunjuk: "",
      asli: () => {
        lewatiSekali = form;
        try {
          HTMLFormElement.prototype.submit.call(form);
        } finally {
          lewatiSekali = null;
        }
      },
    };
  }

  /** <select> "Cetak Relas"/BA: opsi bernilai alamat cetak -> window.open(nilai, '_self'). */
  function sasaranDariPilihan(pilih) {
    if (!pilih || String(pilih.tagName).toUpperCase() !== "SELECT") return null;
    if (!/pilih_cetak/.test(pilih.getAttribute("onchange") || "")) return null;
    const alamat = mutlak(pilih.value);
    const jenis = alamat ? jenisCetak(alamat) : "";
    if (!jenis) return null;
    return {
      jenis,
      metode: "GET",
      alamat,
      petunjuk: "",
      pilih,
      asli: () => window.open(alamat, "_self"),
    };
  }

  // --------------------------------------------------------------------------
  // Mengambil berkas (SATU permintaan: dipakai pratinjau DAN unduhan)
  // --------------------------------------------------------------------------
  /**
   * @returns {Promise<{ok:true, blob, bita, bentuk, nama, ukuran} | {ok:false, pakaiAsli?:boolean, pesan:string}>}
   * pakaiAsli: jaringan/ukuran - tak ada yang bisa dilaporkan, jalankan tindakan asli.
   */
  async function ambilBerkas(s) {
    let respons;
    try {
      respons = await fetch(s.alamat, { method: s.metode, body: s.badan || undefined, credentials: "include" });
    } catch (g) {
      return { ok: false, pakaiAsli: true, pesan: `permintaan gagal: ${String((g && g.message) || g).slice(0, 120)}` };
    }
    if (!respons.ok) return { ok: false, pesan: `SIPP menjawab kode ${respons.status}. Berkasnya tidak dapat diambil.` };
    const tipe = String((respons.headers && respons.headers.get && respons.headers.get("content-type")) || "");
    const blob = await respons.blob();
    if (!blob || blob.size === 0) return { ok: false, pesan: "Berkasnya kosong di SIPP." };
    if (blob.size > BATAS_BAJT) return { ok: false, pakaiAsli: true, pesan: "Berkas terlalu besar untuk pratinjau." };
    const bita = await bitaDari(blob);
    const disposisi = respons.headers && respons.headers.get ? respons.headers.get("content-disposition") : "";
    const nama0 = namaDariDisposisi(disposisi) || s.petunjuk || decodeURIComponentAman(jalur(s.alamat).split("/").filter(Boolean).pop() || "");
    const bentuk = kenaliBentuk(bita, nama0, tipe || blob.type);
    if (bentuk === "lain" && /text\/html/i.test(tipe) && !/\.html?$/i.test(nama0)) {
      return { ok: false, pesan: "SIPP menjawab halaman web, bukan berkas. Masuk ke SIPP lagi lalu ulangi." };
    }
    const nama = pilihNama(
      [namaDariDisposisi(disposisi), s.petunjuk, decodeURIComponentAman(jalur(s.alamat).split("/").filter(Boolean).pop() || "")],
      s.jenis,
      bentuk,
      bita,
      tipe || blob.type
    );
    return { ok: true, blob, bita, bentuk, nama, ukuran: bita.length };
  }

  // --------------------------------------------------------------------------
  // RTF / DOCX / DOC -> PDF di server (rute konversi-naskah yang sudah ada)
  // --------------------------------------------------------------------------
  /** @returns {Promise<{ok:true, blob} | {ok:false, pesan:string}>} tidak pernah melempar */
  async function ubahKePdf(info) {
    if (typeof alatAmbil !== "function") return { ok: false, pesan: "Konversi tidak tersedia di halaman ini." };
    if (info.ukuran > BATAS_KONVERSI_BAJT) return { ok: false, pesan: "Berkas terlalu besar untuk diubah ke PDF." };
    const namaKirim = `${String(info.nama).replace(/\.[^.\\/]+$/, "") || "naskah"}.${info.bentuk}`;
    const badan = new FormData();
    badan.append("berkas", new Blob([info.bita], { type: "application/octet-stream" }), namaKirim);
    badan.append("ke", "pdf");
    let respons;
    try {
      respons = await alatAmbil(API_KONVERSI, { method: "POST", body: badan, credentials: "include", batasMs: BATAS_KONVERSI_MS }, "Menyiapkan pratinjau");
    } catch (g) {
      return { ok: false, pesan: String((g && g.message) || g).slice(0, 160) };
    }
    let luar = null;
    try {
      luar = await respons.json();
    } catch {
      luar = null;
    }
    if (respons.status === 401) return { ok: false, pesan: "Sesi portal habis. Masuk ke portal lagi untuk pratinjau lengkap." };
    if (respons.status === 423) return { ok: false, pesan: "Pengubahan ke PDF ditahan mode kering/latihan." };
    if (respons.status === 404) return { ok: false, pesan: "Pengubah PDF belum tersedia di server." };
    if (!respons.ok) {
      const kalimat = luar && luar.error && luar.error.message ? String(luar.error.message) : "";
      return { ok: false, pesan: kalimat || `Server menjawab kode ${respons.status}.` };
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    if (!data || !data.berkasBase64) return { ok: false, pesan: "Server tidak memulangkan PDF." };
    try {
      const biner = atob(String(data.berkasBase64));
      const bita = new Uint8Array(biner.length);
      for (let i = 0; i < biner.length; i += 1) bita[i] = biner.charCodeAt(i);
      if (String.fromCharCode.apply(null, Array.from(bita.subarray(0, 5))) !== "%PDF-") return { ok: false, pesan: "Hasil konversi bukan PDF." };
      return { ok: true, blob: new Blob([bita], { type: "application/pdf" }) };
    } catch {
      return { ok: false, pesan: "Hasil konversi tidak terbaca." };
    }
  }

  /** Cadangan: paragraf teks dari RTF/DOCX memakai pengurai deteksi-sisa-blangko.js. null bila tak bisa. */
  async function paragrafCadangan(info) {
    const D = globalThis.aletaDeteksiSisa;
    if (!D) return null;
    try {
      if (info.bentuk === "rtf" && typeof D.bacaRtfParagraf === "function") {
        return D.bacaRtfParagraf(new TextDecoder("windows-1252").decode(info.bita));
      }
      if (info.bentuk === "docx" && typeof D.ambilDariZip === "function" && typeof D.bacaDocxXml === "function") {
        const isi = await D.ambilDariZip(info.bita, "word/document.xml");
        return isi ? D.bacaDocxXml(new TextDecoder("utf-8").decode(isi)) : null;
      }
    } catch {
      /* tak terbaca: pesan saja */
    }
    return null;
  }

  /** Deteksi sisa blangko atas RTF/DOCX (PDF/DOC tidak terbaca - dilewati diam-diam). */
  async function periksaSisa(info, jenis) {
    const D = globalThis.aletaDeteksiSisa;
    if (!D || typeof D.periksaBita !== "function" || (info.bentuk !== "rtf" && info.bentuk !== "docx")) return null;
    try {
      const h = await D.periksaBita(info.bita, info.nama);
      if (!h || !h.dibaca || !h.hasil || !h.hasil.temuan || !h.hasil.temuan.length) return null;
      return { temuan: h.hasil.temuan, terpotong: h.hasil.terpotong || 0, jenis };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Kotak pratinjau (Shadow DOM)
  // --------------------------------------------------------------------------
  const GAYA = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .latar { --bg:#111827; --fg:#f1f5f9; --muted:#94a3b8; --garis:#334155; --kertas:#0b1220; --aksen:#3b82f6; --aksen-fg:#fff;
      --sekunder:#1e293b; --sekunder-fg:#e2e8f0; --pb:#422006; --pf:#fde68a; --pg:#a16207; --galat:#f87171; --tandai:#7f1d1d;
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(2,6,23,.66);
      font:14px/1.5 system-ui,"Segoe UI",Arial,sans-serif; color:var(--fg); animation:masuk .16s ease-out; }
    .latar[data-tema="terang"] { --bg:#ffffff; --fg:#0f172a; --muted:#475569; --garis:#e2e8f0; --kertas:#cbd5e1; --aksen:#1d4ed8; --aksen-fg:#fff;
      --sekunder:#f1f5f9; --sekunder-fg:#0f172a; --pb:#fffbeb; --pf:#78350f; --pg:#f59e0b; --galat:#b91c1c; --tandai:#fecaca; }
    @keyframes masuk { from { opacity:0; } to { opacity:1; } }
    @media (prefers-reduced-motion: reduce) { .latar { animation:none; } .putar { animation:none !important; } }
    .kotak { display:flex; flex-direction:column; width:min(1100px,100%); height:min(94vh,980px); background:var(--bg); color:var(--fg);
      border:1px solid var(--garis); border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,.45); overflow:hidden; outline:none; }
    header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--garis); flex-wrap:wrap; }
    h2 { margin:0; font-size:15px; font-weight:650; flex:1 1 220px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chip { display:inline-block; padding:2px 10px; border-radius:999px; background:var(--sekunder); color:var(--sekunder-fg); font-size:12px; font-weight:600; border:1px solid var(--garis); }
    .chip.jenis { background:var(--aksen); color:var(--aksen-fg); border-color:var(--aksen); }
    .info { color:var(--muted); font-size:12px; }
    button { font:inherit; cursor:pointer; border-radius:9px; min-height:40px; padding:0 16px; border:1px solid var(--garis); background:var(--sekunder); color:var(--sekunder-fg); }
    button:hover:not(:disabled) { filter:brightness(1.08); }
    button:focus-visible { outline:2px solid var(--aksen); outline-offset:2px; }
    button:disabled { opacity:.55; cursor:default; }
    button.utama { background:var(--aksen); border-color:var(--aksen); color:var(--aksen-fg); font-weight:650; }
    button.ikon { min-width:40px; padding:0 10px; }
    .peringatan { padding:10px 16px; background:var(--pb); color:var(--pf); border-bottom:1px solid var(--pg); font-size:13px; }
    .peringatan b { font-weight:650; }
    .peringatan ul { margin:6px 0 0; padding-left:18px; }
    .peringatan li { margin:2px 0; word-break:break-word; }
    .peringatan mark { background:var(--tandai); color:inherit; padding:0 2px; border-radius:3px; }
    .peringatan .aksi { margin-top:8px; }
    .peringatan button { min-height:32px; padding:0 12px; font-size:13px; }
    .badan { position:relative; flex:1; min-height:0; background:var(--kertas); display:flex; overflow:auto; }
    iframe.isi { width:100%; height:100%; border:0; background:#fff; flex:1; }
    img.isi { max-width:100%; max-height:100%; margin:auto; object-fit:contain; background:#fff; }
    .tengah { margin:auto; text-align:center; padding:24px; max-width:520px; color:var(--fg); }
    .tengah .kecil { color:var(--muted); font-size:13px; margin-top:6px; }
    .tengah.galat b { color:var(--galat); }
    .putar { width:34px; height:34px; margin:0 auto 12px; border-radius:50%; border:3px solid var(--garis); border-top-color:var(--aksen); animation:putar .8s linear infinite; }
    @keyframes putar { to { transform:rotate(360deg); } }
    .teks { margin:16px auto; width:min(794px,calc(100% - 24px)); background:#fff; color:#111827; padding:36px 44px; border-radius:4px; box-shadow:0 2px 14px rgba(0,0,0,.25); font:14px/1.6 "Times New Roman",Times,serif; }
    .teks p { margin:0 0 8px; text-align:justify; }
    .teks mark { background:#fecaca; color:#7f1d1d; padding:0 1px; border-radius:2px; }
    .catatan { margin:12px auto 0; width:min(794px,calc(100% - 24px)); font-size:12px; color:var(--fg); background:var(--sekunder); border:1px solid var(--garis); border-radius:8px; padding:6px 10px; }
    footer { display:flex; align-items:center; gap:8px; padding:10px 16px; border-top:1px solid var(--garis); flex-wrap:wrap; }
    .petunjuk { color:var(--muted); font-size:12px; flex:1 1 220px; }
    .pesan { font-size:13px; color:var(--muted); }
    .pesan.ok { color:#22c55e; } .pesan.salah { color:var(--galat); }
    @media (max-width:640px) {
      .latar { padding:0; } .kotak { height:100%; border-radius:0; width:100%; }
      header { display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:center; }
      header .chip.jenis { grid-column:1; grid-row:1; justify-self:start; }
      header [data-p="tema"] { grid-column:2; grid-row:1; } header [data-p="x"] { grid-column:3; grid-row:1; }
      h2 { grid-column:1 / -1; grid-row:2; white-space:normal; word-break:break-all; font-size:14px; flex:none; }
      header .info { grid-column:1 / -1; grid-row:3; }
      footer button { flex:1 1 30%; } .teks { padding:20px 18px; margin:8px auto; } .petunjuk { display:none; }
    }`;

  const KERANGKA = `
    <div class="latar" data-p="latar" data-tema="gelap">
      <section class="kotak" role="dialog" aria-modal="true" aria-labelledby="jdl" tabindex="-1" data-p="kotak">
        <header>
          <span class="chip jenis" data-p="jenis"></span>
          <h2 id="jdl" data-p="nama"></h2>
          <span class="info" data-p="info"></span>
          <button type="button" class="ikon" data-p="tema" aria-label="Ganti tema gelap atau terang" title="Ganti tema">&#9728;</button>
          <button type="button" class="ikon" data-p="x" aria-label="Tutup pratinjau" title="Tutup (Esc)">&#10005;</button>
        </header>
        <div class="peringatan" data-p="peringatan" role="alert" hidden></div>
        <div class="badan" data-p="badan" aria-live="polite"></div>
        <footer>
          <span class="petunjuk" data-p="petunjuk">Shift atau Ctrl-klik tombol unduh di SIPP = unduh langsung tanpa pratinjau.</span>
          <span class="pesan" data-p="pesan" role="status" aria-live="polite"></span>
          <button type="button" data-p="tutup">Tutup</button>
          <button type="button" data-p="cetak" disabled>Cetak</button>
          <button type="button" class="utama" data-p="unduh" disabled>Unduh</button>
        </footer>
      </section>
    </div>`;

  /** Membuka kotak (tahap memuat). Mengembalikan pengendali; tidak pernah melempar. */
  function susunKotak(jenis, awal) {
    tutupKotak();
    const host = document.createElement("div");
    host.id = ID_KOTAK;
    host.className = "aleta-sisip";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483200;";
    const akar = host.attachShadow({ mode: "open" });
    const gaya = document.createElement("style");
    gaya.textContent = GAYA;
    const wadah = document.createElement("div");
    wadah.innerHTML = KERANGKA;
    akar.appendChild(gaya);
    akar.appendChild(wadah);
    const q = (p) => akar.querySelector(`[data-p="${p}"]`);
    const sebelumFokus = document.activeElement;
    const urlBlob = [];
    let tertutup = false;
    let onUnduh = null;
    let onCetak = null;
    let pesanJam = 0;

    q("jenis").textContent = NAMA_JENIS[jenis] || "Dokumen";
    q("nama").textContent = awal && awal.nama ? awal.nama : "Menyiapkan dokumen...";

    function tema(nilai) {
      const t = nilai === "terang" ? "terang" : "gelap";
      q("latar").setAttribute("data-tema", t);
      q("tema").innerHTML = t === "gelap" ? "&#9728;" : "&#9790;";
      q("tema").setAttribute("title", t === "gelap" ? "Pakai tema terang" : "Pakai tema gelap");
    }
    tema("gelap");
    (async () => {
      try {
        const s = await chrome.storage.local.get([KUNCI_TEMA]);
        if (!tertutup) tema(s && s[KUNCI_TEMA] === "terang" ? "terang" : "gelap");
      } catch {
        /* tema bawaan */
      }
    })();
    q("tema").addEventListener("click", () => {
      const baru = q("latar").getAttribute("data-tema") === "terang" ? "gelap" : "terang";
      tema(baru);
      try {
        void chrome.storage.local.set({ [KUNCI_TEMA]: baru });
      } catch {
        /* berlaku untuk kotak ini saja */
      }
    });

    function badan(isi) {
      const b = q("badan");
      b.textContent = "";
      if (isi) b.appendChild(isi);
      return b;
    }
    function pesan(teks, nada) {
      const p = q("pesan");
      p.textContent = teks || "";
      p.className = `pesan${nada ? ` ${nada}` : ""}`;
      clearTimeout(pesanJam);
      if (teks && nada === "ok") pesanJam = setTimeout(() => (p.textContent = ""), 4000);
    }
    function tengah(kelas, html) {
      const d = el("div", `tengah ${kelas || ""}`);
      d.innerHTML = html;
      return d;
    }
    function blobUrl(blob) {
      const u = URL.createObjectURL(blob);
      urlBlob.push(u);
      return u;
    }

    const kendali = {
      host,
      akar,
      q,
      /** Ganti isi kepala sesudah berkasnya diketahui. */
      info(i) {
        q("nama").textContent = i.nama;
        q("nama").setAttribute("title", i.nama);
        q("info").textContent = [LABEL_BENTUK[i.bentuk] || "Berkas", ukuranTeks(i.ukuran)].join(" - ");
      },
      memuat(teks, kecil) {
        const d = tengah("", `<div class="putar" aria-hidden="true"></div><div data-t="t"></div><div class="kecil" data-t="k"></div>`);
        d.querySelector('[data-t="t"]').textContent = teks;
        d.querySelector('[data-t="k"]').textContent = kecil || "";
        badan(d);
      },
      galat(teks, pilihan) {
        const d = tengah("galat", `<div><b>Pratinjau tidak dapat ditampilkan</b></div><div class="kecil" data-t="t"></div>`);
        d.querySelector('[data-t="t"]').textContent = teks;
        if (pilihan && pilihan.cobaAsli) {
          const b = el("button", "", "Unduh seperti biasa");
          b.type = "button";
          b.style.marginTop = "12px";
          b.addEventListener("click", () => {
            tutupKotak();
            pilihan.cobaAsli();
          });
          d.appendChild(b);
        }
        badan(d);
      },
      pdf(blob) {
        const f = el("iframe", "isi");
        f.title = "Isi dokumen";
        f.src = `${blobUrl(blob)}#navpanes=0&view=FitH`;
        badan(f);
        q("cetak").disabled = false;
        onCetak = () => {
          f.contentWindow.focus();
          f.contentWindow.print();
        };
      },
      gambar(blob) {
        const url = blobUrl(blob);
        const g = el("img", "isi");
        g.alt = "Isi dokumen";
        g.src = url;
        badan(g);
        q("cetak").disabled = false;
        onCetak = () => cetakHtml(`<img src="${url}" style="max-width:100%">`);
      },
      /** Teks berformat sederhana. paragraf: [{teks, merah:[[dari,sampai]]}] */
      teks(paragraf, catatan) {
        const d = el("div");
        if (catatan) d.appendChild(el("div", "catatan", catatan));
        const kertas = el("div", "teks");
        for (const p of paragraf) {
          const pe = el("p");
          const s = String(p.teks || "");
          let akhir = 0;
          for (const [dari, sampai] of p.merah || []) {
            if (dari > akhir) pe.appendChild(document.createTextNode(s.slice(akhir, dari)));
            const m = el("mark", "", s.slice(dari, sampai));
            pe.appendChild(m);
            akhir = sampai;
          }
          if (akhir < s.length) pe.appendChild(document.createTextNode(s.slice(akhir)));
          kertas.appendChild(pe);
        }
        d.appendChild(kertas);
        const b = badan(d);
        b.style.display = "block";
        q("cetak").disabled = false;
        onCetak = () => cetakHtml(kertas.innerHTML);
      },
      peringatan(hasil) {
        const D = globalThis.aletaDeteksiSisa;
        const wadahP = q("peringatan");
        wadahP.textContent = "";
        const total = hasil.temuan.length + (hasil.terpotong || 0);
        const judul = el("div");
        const tebal = el("b", "", `Naskah ini masih memuat ${total}${hasil.terpotong ? "+" : ""} sisa blangko`);
        judul.appendChild(tebal);
        const ringkas = D && typeof D.ringkasJenis === "function" ? D.ringkasJenis(hasil.temuan) : [];
        if (ringkas.length) judul.appendChild(document.createTextNode(` - ${ringkas.map((r) => `${r.label}: ${r.jumlah}`).join("; ")}`));
        wadahP.appendChild(judul);
        const ul = el("ul");
        for (const t of hasil.temuan.slice(0, 5)) {
          const li = el("li");
          li.appendChild(document.createTextNode(`${t.sebelum ? `${t.sebelum} ` : ""}`));
          li.appendChild(el("mark", "", t.cocok));
          li.appendChild(document.createTextNode(`${t.sesudah ? ` ${t.sesudah}` : ""}`));
          ul.appendChild(li);
        }
        wadahP.appendChild(ul);
        if (D && typeof D.susunDaftarTxt === "function") {
          const aksi = el("div", "aksi");
          const b = el("button", "", "Unduh daftar masalah (.txt)");
          b.type = "button";
          b.setAttribute("data-p", "daftar");
          b.addEventListener("click", async () => {
            const nama = typeof D.namaTxt === "function" ? D.namaTxt(hasil.nama) : "Daftar masalah.txt";
            const isi = D.susunDaftarTxt(hasil.temuan, { nama: hasil.nama, jenis: hasil.jenis, terpotong: hasil.terpotong });
            try {
              await alatUnduh(new Blob([`﻿${isi}`], { type: "text/plain;charset=utf-8" }), nama, { tanpaPeriksaSisa: true });
            } catch {
              pesan("Daftar masalah tidak dapat diunduh.", "salah");
            }
          });
          aksi.appendChild(b);
          wadahP.appendChild(aksi);
        }
        wadahP.hidden = false;
      },
      /** Tombol Unduh: fungsi () => Promise<{ok}>. */
      siapUnduh(fn) {
        onUnduh = fn;
        q("unduh").disabled = false;
      },
      pesan,
      tutup() {
        tutupKotak();
      },
      get tertutup() {
        return tertutup;
      },
    };

    function cetakHtml(html) {
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;";
      f.srcdoc = `<!doctype html><meta charset="utf-8"><body style="margin:24px;font:14px/1.6 'Times New Roman',serif">${html}</body>`;
      f.addEventListener("load", () => {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch {
          pesan("Peramban tidak mengizinkan mencetak dari sini. Unduh lalu cetak dari berkasnya.", "salah");
        }
        setTimeout(() => f.remove(), 60000);
      });
      akar.appendChild(f);
    }

    q("unduh").addEventListener("click", async () => {
      if (!onUnduh) return;
      const b = q("unduh");
      b.disabled = true;
      pesan("Mengunduh...");
      try {
        const h = await onUnduh();
        if (h && h.ok) pesan("Berkas terunduh.", "ok");
        else pesan((h && h.pesan) || "Unduhan tidak berhasil.", "salah");
      } catch (g) {
        pesan(String((g && g.message) || g).slice(0, 140), "salah");
      }
      b.disabled = false;
    });
    q("cetak").addEventListener("click", () => {
      if (!onCetak) return;
      try {
        onCetak();
      } catch {
        pesan("Peramban tidak mengizinkan mencetak dari sini. Unduh lalu cetak dari berkasnya.", "salah");
      }
    });
    q("tutup").addEventListener("click", () => tutupKotak());
    q("x").addEventListener("click", () => tutupKotak());
    q("latar").addEventListener("mousedown", (e) => {
      if (e.target === q("latar")) tutupKotak();
    });

    function dengarTombol(e) {
      if (tertutup) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        tutupKotak();
      } else if (e.key === "Tab") {
        const bisa = Array.from(akar.querySelectorAll("button:not(:disabled), iframe, a[href]")).filter((x) => !x.hidden);
        if (!bisa.length) return;
        const aktif = akar.activeElement;
        const i = bisa.indexOf(aktif);
        const ke = e.shiftKey ? (i <= 0 ? bisa.length - 1 : i - 1) : i === bisa.length - 1 ? 0 : i + 1;
        if (aktif && bisa.includes(aktif) && bisa[ke]) {
          e.preventDefault();
          bisa[ke].focus();
        } else if (!aktif) {
          e.preventDefault();
          bisa[0].focus();
        }
      }
    }
    window.addEventListener("keydown", dengarTombol, true);

    kendali.bersihkan = () => {
      tertutup = true;
      window.removeEventListener("keydown", dengarTombol, true);
      clearTimeout(pesanJam);
      for (const u of urlBlob) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* sudah dilepas */
        }
      }
      host.remove();
      try {
        if (sebelumFokus && typeof sebelumFokus.focus === "function") sebelumFokus.focus();
      } catch {
        /* fokus tidak dapat dikembalikan */
      }
    };

    (document.body || document.documentElement).appendChild(host);
    try {
      q("kotak").focus();
    } catch {
      /* fokus awal hanya kemudahan */
    }
    kendali.memuat("Mengambil dokumen dari SIPP...");
    kotakAktif = kendali;
    return kendali;
  }

  function tutupKotak() {
    const k = kotakAktif;
    kotakAktif = null;
    if (k && k.bersihkan) k.bersihkan();
  }

  // --------------------------------------------------------------------------
  // Alur utama
  // --------------------------------------------------------------------------
  async function unduhAsli(info) {
    // Berkas ASLI dari SIPP (bukan hasil konversi); nama sama dengan jalur unduhan sekarang.
    return alatUnduh(info.blob, info.nama, { tanpaPeriksaSisa: true });
  }

  async function tampilkan(kotak, s, info) {
    kotak.info(info);
    kotak.siapUnduh(() => unduhAsli(info));
    // Deteksi sisa blangko jalan di latar; peringatannya menyusul di atas pratinjau.
    void periksaSisa(info, s.jenis).then((hasil) => {
      if (hasil && !kotak.tertutup) kotak.peringatan({ ...hasil, nama: info.nama });
    });
    if (info.bentuk === "pdf") {
      kotak.pdf(new Blob([info.bita], { type: "application/pdf" }));
      return;
    }
    if (info.bentuk === "gambar") {
      kotak.gambar(new Blob([info.bita], { type: mimeBentuk("gambar", info.bita) }));
      return;
    }
    // RTF / DOCX / DOC
    kotak.memuat("Menyiapkan pratinjau...", "Dokumen diubah ke PDF dulu supaya tata letaknya sama dengan aslinya.");
    const hasil = await ubahKePdf(info);
    if (kotak.tertutup) return;
    if (hasil.ok) {
      kotak.pdf(hasil.blob);
      return;
    }
    catat("pratinjau-bas-relaas", `konversi ke PDF gagal: ${hasil.pesan}`, info.nama);
    const paragraf = await paragrafCadangan(info);
    if (kotak.tertutup) return;
    if (paragraf && paragraf.length) {
      kotak.teks(paragraf, `Tampilan teks sederhana (${hasil.pesan}). Tata letak aslinya ada pada berkas yang diunduh. Tulisan bertanda merah = sisa isian.`);
    } else {
      kotak.galat(`${hasil.pesan} Berkas ini belum dapat ditampilkan, tetapi tetap dapat diunduh.`);
    }
  }

  /**
   * @param s sasaran { jenis, metode, alamat, badan?, petunjuk, asli }
   * @param langsung true = unduh langsung tanpa pratinjau (Shift/Ctrl/Alt-klik)
   */
  async function mulai(s, langsung) {
    sibuk = true;
    let kotak = null;
    try {
      if (!langsung) kotak = susunKotak(s.jenis);
      const info = await ambilBerkas(s);
      if (kotak && kotak.tertutup) return; // petugas menutup sebelum selesai
      if (!info.ok) {
        catat("pratinjau-bas-relaas", `berkas tidak diambil: ${info.pesan}`, s.alamat.slice(0, 120));
        if (info.pakaiAsli || !kotak) {
          tutupKotak();
          s.asli();
        } else {
          kotak.galat(info.pesan, { cobaAsli: s.asli });
        }
        return;
      }
      if (langsung || (info.bentuk !== "pdf" && info.bentuk !== "gambar" && info.bentuk !== "rtf" && info.bentuk !== "docx" && info.bentuk !== "doc")) {
        tutupKotak();
        const u = await alatUnduh(info.blob, info.nama);
        if (!u || (u.ok === false && !u.dibatalkan)) s.asli(); // tidak ada unduhan yang hilang
        return;
      }
      await tampilkan(kotak, s, info);
    } catch (g) {
      catat("pratinjau-bas-relaas", `pratinjau gagal: ${String((g && g.message) || g).slice(0, 120)}`, "");
      tutupKotak();
      try {
        s.asli();
      } catch {
        /* tidak ada yang bisa dilakukan lagi */
      }
    } finally {
      sibuk = false;
    }
  }

  // --------------------------------------------------------------------------
  // Pendengar halaman
  // --------------------------------------------------------------------------
  function dengarKlik(e) {
    try {
      if (!nyala || !halamanSipp()) return;
      if (e.defaultPrevented || (e.button !== undefined && e.button !== 0)) return;
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      const tombol = t.closest("button, input[type=submit], input[type=image]");
      if (tombol && tombol.form) ujungKlik = { form: tombol.form, langsung: langsungKah(e), saat: Date.now(), pengirim: tombol };
      const a = t.closest("a");
      if (!a || lewatiSekali === a) return;
      if (typeof alatTautanAsli === "function" && alatTautanAsli(a)) return;
      const s = sasaranDariTautan(a);
      if (!s) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (sibuk || kotakAktif) return;
      void mulai(s, langsungKah(e));
    } catch {
      /* gagal memeriksa: tautan berjalan seperti biasa */
    }
  }

  function dengarKirim(e) {
    try {
      if (!nyala || !halamanSipp()) return;
      // Fase gelembung: penangan submit milik borang SIPP (validasi) sudah berjalan.
      if (e.defaultPrevented) return;
      const form = e.target;
      if (!form || lewatiSekali === form) return;
      const baru = ujungKlik && ujungKlik.form === form && Date.now() - ujungKlik.saat < KADALUARSA_UJUNG_MS ? ujungKlik : null;
      const s = sasaranDariBorang(form, (e.submitter && e.submitter.form === form ? e.submitter : null) || (baru && baru.pengirim) || undefined);
      if (!s) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (sibuk || kotakAktif) return;
      void mulai(s, Boolean(baru && baru.langsung));
    } catch {
      /* gagal memeriksa: borang terkirim seperti biasa */
    }
  }

  function dengarPilih(e) {
    try {
      if (!nyala || !halamanSipp()) return;
      const s = sasaranDariPilihan(e.target);
      if (!s) return;
      e.stopImmediatePropagation();
      try {
        s.pilih.selectedIndex = 0;
      } catch {
        /* pilihan tetap */
      }
      if (sibuk || kotakAktif) return;
      void mulai(s, false);
    } catch {
      /* pilihan berjalan seperti biasa */
    }
  }

  window.addEventListener("click", dengarKlik, true);
  window.addEventListener("submit", dengarKirim, false);
  window.addEventListener("change", dengarPilih, true);
  void bacaSaklar();

  globalThis.aletaPratinjauBasRelaas = {
    KUNCI,
    nyalaKini: () => nyala,
    atur(nilai) {
      nyala = nilai !== false;
    },
    muatSaklar: bacaSaklar,
    jenisCetak,
    jenisBerkas,
    kenaliBentuk,
    sasaranDariTautan,
    sasaranDariBorang,
    ambilBerkas,
    namaDariDisposisi,
    ubahKePdf,
    tutup: tutupKotak,
    kotakAktif: () => kotakAktif,
    /** Untuk pemanggil lain: tampilkan blob yang sudah ada. */
    async bukaBerkas(opsi) {
      const bita = await bitaDari(opsi.blob);
      const bentuk = kenaliBentuk(bita, opsi.nama, opsi.blob.type);
      const info = { ok: true, blob: opsi.blob, bita, bentuk, nama: opsi.nama, ukuran: bita.length };
      const kotak = susunKotak(opsi.jenis === "relaas" ? "relaas" : "bas", info);
      await tampilkan(kotak, { jenis: opsi.jenis }, info);
      return kotak;
    },
  };
})();
