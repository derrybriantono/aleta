/**
 * ============================================================================
 * UNGGAH e-Doc DENGAN SERET-LEPAS DI HALAMAN SIPP (30 Okt 2026)
 * ============================================================================
 *
 * Tiap tombol/tautan unggah e-Doc SIPP (Unggah BAS, Unggah Relaas, Unggah E-Doc putusan / anonimisasi, Unggah penetapan PMH/PPP/PJS/PHS,
 * Unggah E-Doc gugatan/permohonan, Edit E-Dokumen, dan seterusnya) adalah SASARAN SERET-LEPAS: berkas dilepas di atasnya, lalu e-Doc itu
 * tersimpan di SIPP tanpa membuka jendela SIPP dan tanpa memilih berkas.
 *
 * JALAN PINTAS TAMBAHAN - KLIK TIDAK DISENTUH. Klik biasa tetap membuka jendela unggah SIPP persis seperti dulu, lengkap dengan fitur ALETA
 * di dalamnya (bas-word-pdf.js: BAS Word -> PDF bertanda tangan, peringatan sisa blangko, pemilih berkas). Berkas ini tidak memasang
 * pendengar klik apa pun dan TIDAK menduplikasi aturan: pengubah Word -> PDF = aletaBasWordPdf.mintaPdf (rute bas/word-ke-pdf yang sama),
 * pemeriksa sisa blangko = aletaDeteksiSisa (deteksi-sisa-blangko.js yang sama), jalur simpan = halaman unggah SIPP sendiri.
 *
 * ALUR (jenis dokumen ditentukan dari TOMBOL tempat berkas dilepas, bukan dari nama berkas):
 *   1. tombol dikenali dari onclick="popup_form('.../fileupload[_putusan|_publisitas]/<enc>/<jenis>/...')" - seluruh tombol e-Doc di
 *      SIPP 7.0.4 memakai bentuk ini (inventaris di edoc-seret-inventaris di bawah);
 *   2. halaman unggah SIPP dibuka di LATAR (GET alamat yang sama dengan popup_form) dan dibaca: kolom tersembunyinya, nama berkas yang
 *      sudah tersimpan, batas "hanya PDF", alamat simpan - dari kode halaman itu sendiri, bukan ditebak;
 *   3. sudah ada e-Doc jenis itu -> tanya "Ganti dokumen yang sudah ada?" (sama dengan perilaku SIPP: berkas lama diganti);
 *   4. PDF langsung. Word: bila jendela unggah SIPP membatasi "hanya PDF" (BAS, penetapan PMH/PPP/PJS/PHS, dst.) diubah ke PDF di server - BAS
 *      dengan tanda tangan scan Panitera Pengganti dan Ketua Majelis, jenis lain TANPA tanda tangan (aturannya belum pasti per jenis) dan
 *      petugas diberi tahu; bila SIPP MENERIMA Word (putusan, anonimisasi, relaas, dst.) Word diunggah APA ADANYA seperti bila dipilih lewat popup
 *      (nama dan tipe asli) - keputusan sementara 31 Okt 2026: pertahankan perilaku SIPP asli;
 *   5. isi diperiksa (sisa blangko: kurung siku, kode, "...", garis, tulisan merah; relaas: titik isian tangan jurusita dikecualikan) dan
 *      kesesuaian ringan (nomor perkara di berkas = perkara halaman ini; tanggal sidang BAS = baris sidang tempat dilepas). Ada temuan ->
 *      satu kotak konfirmasi "Tetap unggah / Batal" (Batal = tidak ada yang terkirim). Tanpa temuan -> langsung simpan;
 *   6. simpan: dua langkah yang SAMA dengan SubmitHandling halaman unggah SIPP (isian ke alamat form, lalu berkas ke alamat unggah),
 *      atas akun SIPP yang sedang masuk - SIPP yang mencatat dan menegakkan haknya. Tidak ada jalur tulis baru, tidak ada kata ALETA;
 *   7. kartu kecil di sudut layar: proses -> "Tersimpan di SIPP" / gagal beserta sebabnya; tampilan halaman disegarkan seperti penutupan popup.
 *
 * Bisa dinyalakan/dimatikan di Tampilan SIPP (elemen semua.seret-edoc). Mati -> tombol tidak menerima seret (perilaku SIPP asli).
 */
(function (akar) {
  "use strict";

  if (!akar || typeof akar.document === "undefined" || akar.aletaEdocSeret) return;
  // Hanya halaman SIPP: bukan ABT dan bukan portal.
  try {
    const jalur = akar.location && akar.location.pathname ? String(akar.location.pathname) : "";
    if (/\/aps_badilag\//i.test(jalur) || /^\/aleta(?:\/|$)/i.test(jalur)) return;
  } catch {
    /* tanpa lokasi (uji): lanjut */
  }

  const doc = akar.document;
  const KUNCI_TAMPILAN = "semua.seret-edoc";
  const API_BACA_PDF = "/aleta/api/aleta-ecourt/edoc/baca-pdf";
  const BATAS_BYTE = 20 * 1024 * 1024;
  const KELAS_PETUNJUK = "aleta-seret-petunjuk";
  const KELAS_SOROT = "aleta-seret-sorot";
  const KELAS_SIAP = "aleta-seret-siap";
  const ID_GAYA = "aleta-seret-gaya";
  const ID_WADAH = "aleta-seret-wadah";
  const TUTUP_OTOMATIS_MS = 9000;
  const JEDA_SEPI_MS = 700;
  const HASIL_BATAS_TEMUAN = 6;

  // --------------------------------------------------------------------------
  // INVENTARIS: kode e-Doc SIPP 7.0.4 -> nama tampil + kelompok pemeriksaan isi.
  //   bas / relaas / putusan : aturan deteksi sisa blangko lengkap (relaas: isian tangan jurusita dikecualikan);
  //   umum                   : penetapan - hanya sinyal kuat (kurung siku, kode, catatan perbaikan, tulisan merah);
  //   ""                     : dokumen pihak/lain (gugatan, permohonan, dst.) - tidak diperiksa isinya.
  //   nomor / tanggal        : pemeriksaan kesesuaian nomor perkara / tanggal sidang.
  // Kode tak dikenal tetap dapat diunggah (nama umum "e-Doc"), tanpa pemeriksaan isi.
  // --------------------------------------------------------------------------
  const J = (nama, kelompok, nomor, tanggal) => Object.freeze({ nama, kelompok, nomor: Boolean(nomor), tanggal: Boolean(tanggal) });
  const JENIS = Object.freeze({
    bas: J("BAS", "bas", true, true),
    relaas: J("relaas", "relaas", true, false),
    put: J("putusan", "putusan", true, false),
    putusan: J("putusan", "putusan", true, false),
    anonimisasi: J("putusan anonimisasi", "putusan", true, false),
    putsela: J("putusan sela", "umum", true, false),
    dokpmh: J("penetapan PMH", "umum", true, false),
    dokppp: J("penetapan PPP", "umum", true, false),
    dokpjs: J("penetapan PJS", "umum", true, false),
    dokphs: J("penetapan PHS", "umum", true, false),
    penetapan_persiapan: J("penetapan pemeriksaan persiapan", "umum", true, false),
    penetapan_dismissal_lolos: J("penetapan dismissal", "umum", true, false),
    panggil_paksa: J("penetapan panggilan paksa", "umum", true, false),
    pencegahan_keluar: J("penetapan pencegahan keluar negeri", "umum", true, false),
    bantuan_hukum: J("dokumen bantuan hukum", "", false, false),
    datum: J("gugatan/permohonan", "", false, false),
    datumpdt: J("gugatan/permohonan", "", false, false),
    datum_pb: J("gugatan/permohonan", "", false, false),
    datum_pb_perjanjian_tertulis: J("perjanjian tertulis", "", false, false),
    kppu: J("permohonan keberatan", "", false, false),
    kewenangan_kppu: J("permohonan keberatan", "", false, false),
    tuntut: J("surat tuntutan", "", false, false),
    persiapan: J("dokumen pemeriksaan persiapan", "", false, false),
    persiapan_proses: J("BAS pemeriksaan persiapan", "", false, false),
    perbaikangugatan: J("perbaikan gugatan", "", false, false),
    aktarujuk: J("akta rujuk", "", false, false),
    aktacerai: J("akta cerai", "", false, false),
    penikrar: J("dokumen ikrar", "", false, false),
    verzet: J("dokumen verzet", "", false, false),
    keberatan: J("dokumen keberatan", "", false, false),
    kalender: J("dokumen court calendar", "", false, false),
    mediasi: J("dokumen mediasi", "", false, false),
    pengakuan_bersalah: J("dokumen pengakuan bersalah", "", false, false),
    mkr: J("dokumen e-Doc", "", false, false),
    reskom: J("dokumen e-Doc", "", false, false),
    baspemtambah_20: J("BAS pemeriksaan tambahan", "", false, false),
    baspemtambah_30: J("BAS pemeriksaan tambahan", "", false, false),
    bapemtambah: J("BAP pemeriksaan tambahan", "", false, false),
    pascapailit_pengumuman: J("pengumuman pailit", "", false, false),
    pascapailit_laporankurator: J("laporan kurator", "", false, false),
    penetapan_publisitas: J("penetapan publisitas", "", false, false),
    permohonan_tahanan: J("permohonan tahanan", "", false, false),
  });
  const JENIS_UMUM = J("e-Doc", "", false, false);

  /** Info jenis dari kode e-Doc SIPP; kode asing -> jenis umum. Murni. */
  function infoJenis(kode) {
    const k = String(kode == null ? "" : kode).toLowerCase();
    return JENIS[k] || JENIS_UMUM;
  }

  // --------------------------------------------------------------------------
  // Murni: tautan e-Doc, tanggal, nomor, kesesuaian
  // --------------------------------------------------------------------------
  const POLA_ONCLICK = /popup_form\(\s*(['"])(.*?)\1\s*\)/i;
  const POLA_ALAMAT = /(?:^|\/)(fileupload(?:_putusan|_publisitas)?)\/([^/?#]+)\/([^/?#]+)(?:\/([^?#]*))?(?:[?#].*)?$/i;

  /** onclick="popup_form('...fileupload/<enc>/<kode>/...')" -> { dialog, enc, kode, sisa[], url } atau null. Murni. */
  function bacaTautan(teksOnclick) {
    const m = POLA_ONCLICK.exec(String(teksOnclick || ""));
    if (!m) return null;
    const url = m[2];
    const a = POLA_ALAMAT.exec(url);
    if (!a) return null;
    return { dialog: a[1].toLowerCase(), enc: a[2], kode: a[3], sisa: a[4] ? a[4].split("/").filter(Boolean) : [], url };
  }

  const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  const POLA_TANGGAL = /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b/gi;
  const iso = (h, b, t) => `${t}-${String(b).padStart(2, "0")}-${String(h).padStart(2, "0")}`;

  /** Semua tanggal "29 Oktober 2026" dalam teks -> ["2026-10-29", ...]. Murni. */
  function tanggalDalamTeks(teks) {
    const hasil = [];
    for (const m of String(teks || "").matchAll(POLA_TANGGAL)) hasil.push(iso(Number(m[1]), BULAN.indexOf(m[2].toLowerCase()) + 1, m[3]));
    return hasil;
  }
  const namaTanggal = (isoTgl) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoTgl);
    return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1].replace(/^./, (c) => c.toUpperCase())} ${m[1]}` : isoTgl;
  };

  /** Inti nomor perkara "12/Pdt.G/2026" dari teks (akhiran PA.xxx diabaikan). Murni. */
  const POLA_NOMOR = /\b(\d{1,6})\s*\/\s*(Pdt\s*\.\s*[A-Za-z]{1,6}(?:\s*\.\s*[A-Za-z]{1,6})?)\s*\/\s*(\d{4})\b/g;
  function nomorDalamTeks(teks) {
    const hasil = [];
    for (const m of String(teks || "").matchAll(POLA_NOMOR)) hasil.push(`${Number(m[1])}/${m[2].replace(/\s+/g, "").toLowerCase()}/${m[3]}`);
    return hasil;
  }
  const inti = (nomor) => nomorDalamTeks(nomor)[0] || "";
  /** Nomor pertama dalam teks sebagaimana tertulis (untuk ditampilkan), tanpa akhiran PA.xxx. */
  const nomorAsli = (teks) => {
    const m = new RegExp(POLA_NOMOR.source).exec(String(teks || ""));
    return m ? m[0].replace(/\s+/g, "") : "";
  };

  /**
   * Kesesuaian ringan antara isi berkas dan halaman tempat berkas dilepas. Mengembalikan temuan berbentuk Temuan deteksi-sisa-blangko
   * (jenis "sesuai"). Hanya bila kedua sisi diketahui; tidak tahu = tidak ada temuan. Murni.
   *   nomor  : berkas memuat nomor perkara tetapi TIDAK satu pun sama dengan perkara halaman ini;
   *   tanggal: BAS menyebut tanggal sidang (kalimat "tanggal 29 Oktober 2026" di awal naskah) yang beda dengan baris sidang tempat dilepas.
   */
  function temuanKesesuaian(o) {
    const hasil = [];
    const paragraf = Array.isArray(o.paragraf) ? o.paragraf : [];
    const butir = (cocok, p) => ({ jenis: "sesuai", label: "Tidak sesuai dengan perkara atau sidang ini", sebelum: "", cocok, sesudah: "", paragraf: p ? p.nomor : 0, halaman: p ? p.halaman : 1 });
    if (o.periksaNomor) {
      const halaman = inti(o.nomorHalaman);
      if (halaman) {
        let pertama = null;
        let ada = false;
        for (const p of paragraf) {
          const ns = nomorDalamTeks(p.teks);
          if (!ns.length) continue;
          if (!pertama) pertama = { n: nomorAsli(p.teks) || ns[0], p };
          if (ns.includes(halaman)) {
            ada = true;
            break;
          }
        }
        if (!ada && pertama) hasil.push(butir(`Nomor perkara di berkas ${pertama.n} berbeda dengan perkara di halaman ini (${o.nomorHalaman})`, pertama.p));
      }
    }
    if (o.periksaTanggal && o.tanggalBaris) {
      for (const p of paragraf.slice(0, 12)) {
        const m = /\btanggal\s+(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b/i.exec(p.teks);
        if (!m) continue;
        const tgl = iso(Number(m[1]), BULAN.indexOf(m[2].toLowerCase()) + 1, m[3]);
        if (tgl !== o.tanggalBaris) hasil.push(butir(`Tanggal sidang di berkas ${namaTanggal(tgl)} berbeda dengan sidang tempat berkas dilepas (${namaTanggal(o.tanggalBaris)})`, p));
        break;
      }
    }
    return hasil;
  }

  /** Teks satu baris tabel jadwal sidang -> tanggal sidangnya ("2026-10-29") atau "". Murni. */
  function tanggalBarisSidang(teksBaris) {
    const t = tanggalDalamTeks(teksBaris);
    return t[0] || "";
  }

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const ukuranTeks = (byte) => {
    const n = Number(byte) || 0;
    return n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  };
  /** Nama berkas tanpa jalur dan tanpa kata ALETA (nama ini ikut ke SIPP). Murni. */
  function namaAman(nama) {
    const bersih = String(nama == null ? "" : nama)
      .replace(/^.*[\\/]/, "")
      .replace(/a[\s._\-*]*l[\s._\-*]*e[\s._\-*]*t[\s._\-*]*a/gi, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 150);
    return bersih || "e-Doc";
  }

  // --------------------------------------------------------------------------
  // Halaman unggah SIPP (dibaca di latar)
  // --------------------------------------------------------------------------
  /**
   * HTML halaman unggah SIPP (isi popup_form) -> { ok, pesan, form, namaLama, hanyaPdf, urlUpload, divRef }.
   * `form` = elemen formulir di dokumen terurai (FormData(form) = isian bawaan SIPP sendiri, termasuk pilihan publikasi putusan).
   */
  function bacaHalamanUnggah(html) {
    let d;
    try {
      d = new akar.DOMParser().parseFromString(String(html || ""), "text/html");
    } catch {
      return { ok: false, pesan: "Halaman unggah SIPP tidak terbaca." };
    }
    const form = d.getElementById("frm_upload_file") || d.querySelector("form");
    const masuk = d.getElementById("fileform") || (form ? form.querySelector('input[type="file"]') : null);
    if (!form || !masuk) {
      return { ok: false, pesan: "Halaman unggah SIPP tidak terbaca (sesi SIPP habis atau tampilannya berubah). Masuk ke SIPP lagi lalu coba lagi." };
    }
    // "File Tersimpan": SIPP menulis namanya (jingga/abu), atau "Dokumen Belum Ada" / "E-Doc ... Belum Ada" (merah).
    let namaLama = "";
    for (const s of Array.from(d.querySelectorAll("td span"))) {
      if (s.querySelector("a")) continue;
      const t = sebaris(s.textContent);
      if (!t || /belum\s+ada|tidak\s+ada/i.test(t)) continue;
      if (/\.[a-z0-9]{2,5}$/i.test(t)) {
        namaLama = t;
        break;
      }
    }
    const aksep = String(masuk.getAttribute("accept") || "").toLowerCase();
    const hanyaPdf = Boolean(aksep) && /pdf/.test(aksep) && !/(?:\.rtf|\.doc|word|zip|image|\.png|\.jpe?g)/.test(aksep);
    const skrip = Array.from(d.querySelectorAll("script")).map((s) => s.textContent || "").join("\n");
    const upload = /urlUpload\s*:\s*["']([^"']+)["']/.exec(skrip);
    const divRef = /divRef\s*:\s*["']([^"']+)["']/.exec(skrip);
    return {
      ok: true,
      pesan: "",
      form,
      namaLama,
      hanyaPdf,
      urlUpload: upload ? upload[1] : "",
      divRef: divRef ? divRef[1] : "#konten",
      kode: sebaris((form.querySelector('[name="from"]') || form.querySelector('[name="form"]') || { value: "" }).value).toLowerCase(),
    };
  }

  function pesanSipp(j) {
    return sebaris(String((j && (j.msg || j.pesan)) || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "));
  }

  async function jawabJson(r) {
    let j = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    return j;
  }

  /**
   * Menyimpan ke SIPP lewat halaman unggah SIPP sendiri - dua langkah yang sama dengan SubmitHandling (jquery-sipp.js):
   *   1. isian formulir (tanpa berkas) -> alamat form; jawaban { st: 1 } = lanjut;
   *   2. FormData(formulir) + berkas -> alamat unggah (urlUpload); jawaban { st: 1 } = tersimpan.
   * Tanpa urlUpload (formulir biasa): FormData + berkas langsung ke alamat form.
   * Pulang { ok, pesan }. Tidak pernah melempar.
   */
  async function simpanKeSipp(hal, berkas, aksiAbsolut) {
    const ajax = { "X-Requested-With": "XMLHttpRequest" };
    try {
      const badan = new akar.FormData(hal.form);
      badan.delete("fileform");
      const isian = new akar.URLSearchParams();
      for (const [k, v] of badan.entries()) if (typeof v === "string") isian.append(k, v);
      badan.set("fileform", berkas, berkas.name);
      const alamatForm = aksiAbsolut(hal.form.getAttribute("action") || "");
      if (hal.urlUpload) {
        const r1 = await akar.fetch(alamatForm, { method: "POST", body: isian, credentials: "include", headers: { ...ajax, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } });
        const j1 = await jawabJson(r1);
        if (!r1.ok || !j1 || Number(j1.st) !== 1) return { ok: false, pesan: pesanSipp(j1) || `SIPP menolak (kode ${r1.status}).` };
        const r2 = await akar.fetch(aksiAbsolut(hal.urlUpload), { method: "POST", body: badan, credentials: "include", headers: ajax });
        const j2 = await jawabJson(r2);
        if (r2.ok && j2 && Number(j2.st) === 1) return { ok: true, pesan: pesanSipp(j2) };
        return { ok: false, pesan: pesanSipp(j2) || `SIPP menjawab kode ${r2.status}.` };
      }
      const r = await akar.fetch(alamatForm, { method: "POST", body: badan, credentials: "include", headers: ajax });
      const j = await jawabJson(r);
      if (r.ok && j && Number(j.st) === 1) return { ok: true, pesan: pesanSipp(j) };
      return { ok: false, pesan: pesanSipp(j) || `SIPP menjawab kode ${r.status}.` };
    } catch (galat) {
      return { ok: false, pesan: sebaris((galat && galat.message) || galat).slice(0, 160) };
    }
  }

  // --------------------------------------------------------------------------
  // Tampilan: gaya, petunjuk di atas tombol, kartu hasil, dialog tanya
  // --------------------------------------------------------------------------
  function pasangGaya() {
    if (doc.getElementById(ID_GAYA) || !doc.head) return;
    const g = doc.createElement("style");
    g.id = ID_GAYA;
    g.textContent = `
      :root { --aleta-seret-aksen:#1d4ed8; --aleta-seret-bg:#ffffff; --aleta-seret-fg:#0f172a; --aleta-seret-muted:#475569; --aleta-seret-garis:#cbd5e1; --aleta-seret-ok:#15803d; --aleta-seret-salah:#b91c1c; --aleta-seret-awas:#b45309; }
      html[data-aleta-tema="gelap"] { --aleta-seret-aksen:#60a5fa; --aleta-seret-bg:#111827; --aleta-seret-fg:#f1f5f9; --aleta-seret-muted:#94a3b8; --aleta-seret-garis:#334155; --aleta-seret-ok:#4ade80; --aleta-seret-salah:#f87171; --aleta-seret-awas:#fbbf24; }
      @media (prefers-color-scheme: dark) { html:not([data-aleta-tema]) { --aleta-seret-aksen:#60a5fa; --aleta-seret-bg:#111827; --aleta-seret-fg:#f1f5f9; --aleta-seret-muted:#94a3b8; --aleta-seret-garis:#334155; --aleta-seret-ok:#4ade80; --aleta-seret-salah:#f87171; --aleta-seret-awas:#fbbf24; } }
      .${KELAS_SIAP} { outline:2px dashed var(--aleta-seret-aksen) !important; outline-offset:3px !important; }
      .${KELAS_SOROT} { outline:3px solid var(--aleta-seret-aksen) !important; outline-offset:3px !important; box-shadow:0 0 0 6px color-mix(in srgb, var(--aleta-seret-aksen) 25%, transparent) !important; }
      .${KELAS_PETUNJUK} { position:fixed; z-index:2147483000; max-width:320px; padding:6px 10px; border-radius:8px; background:var(--aleta-seret-aksen); color:#fff; font:600 12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; pointer-events:none; box-shadow:0 4px 14px rgba(0,0,0,.3); }
      html[data-aleta-tema="gelap"] .${KELAS_PETUNJUK} { color:#0b1220; }
      #${ID_WADAH} { position:fixed; right:16px; bottom:16px; z-index:2147483200; display:flex; flex-direction:column; gap:8px; width:min(360px, calc(100vw - 32px)); font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
      .aleta-seret-kartu { background:var(--aleta-seret-bg); color:var(--aleta-seret-fg); border:1px solid var(--aleta-seret-garis); border-left:4px solid var(--aleta-seret-aksen); border-radius:10px; padding:10px 12px; box-shadow:0 8px 24px rgba(0,0,0,.28); }
      .aleta-seret-kartu.ok { border-left-color:var(--aleta-seret-ok); }
      .aleta-seret-kartu.awas { border-left-color:var(--aleta-seret-awas); }
      .aleta-seret-kartu.gagal { border-left-color:var(--aleta-seret-salah); }
      .aleta-seret-kartu .judul { font-weight:700; display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
      .aleta-seret-kartu .rinci { margin:4px 0 0 16px; padding:0; color:var(--aleta-seret-muted); font-size:12px; }
      .aleta-seret-kartu .rinci li { margin:1px 0; }
      .aleta-seret-kartu button { font:inherit; cursor:pointer; border:1px solid var(--aleta-seret-garis); background:transparent; color:var(--aleta-seret-fg); border-radius:6px; padding:0 8px; min-height:24px; }
      .aleta-seret-tirai { position:fixed; inset:0; z-index:2147483300; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.42); font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
      .aleta-seret-kotak { width:min(460px,100%); background:var(--aleta-seret-bg); color:var(--aleta-seret-fg); border:1px solid var(--aleta-seret-garis); border-radius:12px; padding:16px 18px; box-shadow:0 20px 50px rgba(0,0,0,.4); }
      .aleta-seret-kotak h2 { margin:0 0 6px; font-size:16px; }
      .aleta-seret-kotak p { margin:0 0 8px; color:var(--aleta-seret-muted); word-break:break-word; }
      .aleta-seret-kotak .baris { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
      .aleta-seret-kotak button { font:inherit; cursor:pointer; min-height:36px; padding:0 14px; border-radius:8px; border:1px solid var(--aleta-seret-garis); background:transparent; color:var(--aleta-seret-fg); }
      .aleta-seret-kotak button.utama { background:var(--aleta-seret-aksen); border-color:var(--aleta-seret-aksen); color:#fff; font-weight:600; }
      html[data-aleta-tema="gelap"] .aleta-seret-kotak button.utama { color:#0b1220; }
    `;
    doc.head.appendChild(g);
  }

  function wadah() {
    pasangGaya();
    let w = doc.getElementById(ID_WADAH);
    if (!w && doc.body) {
      w = doc.createElement("div");
      w.id = ID_WADAH;
      doc.body.appendChild(w);
    }
    return w;
  }

  /** Kartu hasil. Pulang { tulis(jenis, judul, baris[]), tutup() }. */
  function buatKartu(judulAwal) {
    const k = doc.createElement("div");
    k.className = "aleta-seret-kartu";
    k.setAttribute("role", "status");
    k.setAttribute("aria-live", "polite");
    const judul = doc.createElement("div");
    judul.className = "judul";
    const teks = doc.createElement("span");
    const x = doc.createElement("button");
    x.type = "button";
    x.textContent = "Tutup";
    x.setAttribute("aria-label", "Tutup keterangan");
    judul.append(teks, x);
    const rinci = doc.createElement("ul");
    rinci.className = "rinci";
    k.append(judul, rinci);
    const w = wadah();
    if (w) w.appendChild(k);
    let jam = null;
    const tutup = () => {
      if (jam) clearTimeout(jam);
      k.remove();
    };
    x.addEventListener("click", tutup);
    const tulis = (jenis, t, baris) => {
      k.className = `aleta-seret-kartu ${jenis || ""}`.trim();
      teks.textContent = t;
      rinci.textContent = "";
      for (const b of baris || []) {
        const li = doc.createElement("li");
        li.textContent = b;
        rinci.appendChild(li);
      }
      if (jam) clearTimeout(jam);
      jam = jenis === "ok" ? setTimeout(tutup, TUTUP_OTOMATIS_MS) : null;
    };
    tulis("", judulAwal, []);
    return { tulis, tutup, elemen: k };
  }

  /** Dialog dua pilihan. Pulang true (ya) / false (batal atau Esc). */
  function tanya(o) {
    return new Promise((selesai) => {
      pasangGaya();
      const tirai = doc.createElement("div");
      tirai.className = "aleta-seret-tirai";
      tirai.setAttribute("role", "dialog");
      tirai.setAttribute("aria-modal", "true");
      tirai.setAttribute("aria-label", o.judul);
      const kotak = doc.createElement("div");
      kotak.className = "aleta-seret-kotak";
      const h = doc.createElement("h2");
      h.textContent = o.judul;
      const p = doc.createElement("p");
      p.textContent = o.isi;
      const baris = doc.createElement("div");
      baris.className = "baris";
      const tidak = doc.createElement("button");
      tidak.type = "button";
      tidak.textContent = o.tidak || "Batal";
      const ya = doc.createElement("button");
      ya.type = "button";
      ya.className = "utama";
      ya.textContent = o.ya || "Ya";
      baris.append(tidak, ya);
      kotak.append(h, p, baris);
      tirai.appendChild(kotak);
      const tutup = (nilai) => {
        doc.removeEventListener("keydown", tombol, true);
        tirai.remove();
        selesai(nilai);
      };
      const tombol = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          tutup(false);
        }
      };
      doc.addEventListener("keydown", tombol, true);
      tidak.addEventListener("click", () => tutup(false));
      ya.addEventListener("click", () => tutup(true));
      (doc.body || doc.documentElement).appendChild(tirai);
      try {
        tidak.focus();
      } catch {
        /* fokus tidak wajib */
      }
    });
  }

  // --------------------------------------------------------------------------
  // Alur satu lepasan
  // --------------------------------------------------------------------------
  const fungsi = (nama) => (typeof akar[nama] === "function" ? akar[nama] : null);
  const mutlak = (alamat) => {
    try {
      return new akar.URL(String(alamat || ""), akar.location.href).href;
    } catch {
      return String(alamat || "");
    }
  };

  async function bacaBita(b) {
    if (b && typeof b.arrayBuffer === "function") return new Uint8Array(await b.arrayBuffer());
    return await new Promise((selesai, gagal) => {
      const r = new akar.FileReader();
      r.onload = () => selesai(new Uint8Array(r.result));
      r.onerror = () => gagal(new Error("berkas tidak terbaca"));
      r.readAsArrayBuffer(b);
    });
  }

  /** Membaca isi PDF di server menjadi paragraf (peramban tidak punya pembaca PDF). null bila gagal. */
  async function bacaPdfServer(pdf) {
    const ambil = fungsi("alatAmbil");
    if (!ambil) return null;
    try {
      const badan = new akar.FormData();
      badan.append("berkas", new akar.File([pdf], "berkas.pdf", { type: "application/pdf" }), "berkas.pdf");
      const r = await ambil(API_BACA_PDF, { method: "POST", body: badan, credentials: "include", batasMs: 120000 }, "Membaca isi PDF");
      if (!r.ok) return null;
      const luar = await r.json();
      const d = luar && luar.data !== undefined ? luar.data : luar;
      if (!d || d.ada === false || !Array.isArray(d.paragraf)) return null;
      return { paragraf: d.paragraf, kosong: Array.isArray(d.halamanKosong) && d.halamanKosong.length >= Math.max(1, Number(d.jumlahHalaman) || 0) };
    } catch {
      return null;
    }
  }

  /** Teks baris sidang (tabel Jadwal Sidang) tempat tombol berada, atau "". */
  function tanggalBarisDari(tautan) {
    try {
      const baris = tautan.closest ? tautan.closest("tr") : null;
      // Sel digabung dengan spasi: teks sel yang bersebelahan tanpa spasi tidak boleh menempel ("2026" + "Ikrar").
      return baris ? tanggalBarisSidang(Array.from(baris.children).map((c) => c.textContent).join(" ")) : "";
    } catch {
      return "";
    }
  }

  function nomorHalaman() {
    try {
      const f = fungsi("cariNomorPerkara");
      return f ? String(f() || "") : "";
    } catch {
      return "";
    }
  }

  function ringkasTemuan(temuan) {
    return temuan.slice(0, HASIL_BATAS_TEMUAN).map((t) => `${t.label}: ${sebaris(`${t.sebelum || ""} ${t.cocok} ${t.sesudah || ""}`).slice(0, 110)}`);
  }

  /**
   * Seluruh urutan untuk satu berkas yang dilepas di atas satu tombol. Tidak pernah melempar.
   * `tautan` = elemen tombol; `info` = hasil bacaTautan; `berkas` = File.
   */
  async function proses(tautan, info, berkas) {
    const jenis = infoJenis(info.kode);
    const kartu = buatKartu(`Menyiapkan unggahan ${jenis.nama}...`);
    const gagal = (sebab) => kartu.tulis("gagal", `Tidak tersimpan: ${sebab}`, [`${jenis.nama}: ${berkas.name}`]);
    try {
      if (berkas.size > BATAS_BYTE) return gagal(`${berkas.name} lebih dari ${BATAS_BYTE / 1024 / 1024} MB.`);
      const W = akar.aletaBasWordPdf;
      let bita;
      try {
        bita = await bacaBita(berkas);
      } catch {
        bita = null;
      }
      if (!bita) return gagal("berkas tidak terbaca.");
      const bentuk = W && typeof W.kenaliBerkasWord === "function" ? W.kenaliBerkasWord(bita) : "";

      // 2. halaman unggah SIPP di latar
      kartu.tulis("", `Membuka halaman unggah ${jenis.nama} di SIPP...`, []);
      let hal;
      try {
        const r = await akar.fetch(mutlak(info.url), { credentials: "include", cache: "no-store", headers: { "X-Requested-With": "XMLHttpRequest" } });
        if (!r.ok) return gagal(`SIPP menjawab kode ${r.status} untuk halaman unggah.`);
        hal = bacaHalamanUnggah(await r.text());
      } catch (galat) {
        return gagal(`halaman unggah SIPP tidak terjangkau (${sebaris((galat && galat.message) || galat).slice(0, 80)}).`);
      }
      if (!hal.ok) return gagal(hal.pesan);

      // Kode sebenarnya dari halaman unggah SIPP (kolom tersembunyi from/form) menang atas tebakan dari alamat.
      const jenisSah = hal.kode ? infoJenis(hal.kode) : jenis;

      // Bentuk berkas harus diterima halaman unggah SIPP: ditolak SEBELUM menanyakan penggantian.
      if (bentuk !== "pdf" && bentuk !== "rtf" && bentuk !== "docx" && bentuk !== "doc" && hal.hanyaPdf) {
        return gagal(`SIPP hanya menerima PDF untuk ${jenisSah.nama}; ${berkas.name} bukan PDF atau berkas Word.`);
      }

      // 3. sudah ada e-Doc -> ganti?
      if (hal.namaLama) {
        kartu.tulis("awas", `Menunggu jawaban Anda: ${jenisSah.nama} sudah ada di SIPP.`, []);
        const ganti = await tanya({
          judul: "Ganti dokumen yang sudah ada?",
          isi: `Di SIPP sudah ada ${jenisSah.nama}: "${hal.namaLama}". Dokumen itu akan diganti dengan "${berkas.name}".`,
          ya: "Ganti",
          tidak: "Batal",
        });
        if (!ganti) return kartu.tulis("awas", `Dibatalkan: ${jenisSah.nama} yang sudah ada tidak diganti.`, []);
      }

      // 4. PDF langsung. Word: jendela unggah SIPP yang membatasi "hanya PDF" (BAS dsb.) -> diubah ke PDF di server (BAS bertanda tangan scan);
      //    jendela yang MENERIMA Word (putusan, anonimisasi, dst.) -> Word diunggah APA ADANYA seperti bila dipilih lewat popup SIPP
      //    (nama dan tipe asli, tanpa konversi) - keputusan sementara 31 Okt 2026: pertahankan perilaku SIPP asli.
      const adaWord = bentuk === "rtf" || bentuk === "docx" || bentuk === "doc";
      const kirimWordAsli = adaWord && !hal.hanyaPdf;
      let isi = null; // yang dikirim ke SIPP (Uint8Array)
      let namaKirim = "";
      let tipeKirim = "";
      const catatan = [];
      if (bentuk === "pdf") {
        isi = bita;
        namaKirim = W && W.namaPdf ? W.namaPdf(berkas.name) : `${namaAman(berkas.name).replace(/\.pdf$/i, "")}.pdf`;
        tipeKirim = "application/pdf";
      } else if (kirimWordAsli) {
        isi = bita;
        namaKirim = namaAman(berkas.name);
        tipeKirim = berkas.type || (bentuk === "rtf" ? "application/rtf" : bentuk === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword");
        catatan.push(`${jenisSah.nama} diunggah sebagai berkas Word apa adanya (SIPP menerimanya), tanpa diubah ke PDF.`);
      } else if (adaWord) {
        if (!W || typeof W.mintaPdf !== "function") return gagal("pengubah Word ke PDF belum siap; muat ulang halaman.");
        const denganTtd = jenisSah.kelompok === "bas" && (typeof W.ttdDipilih === "function" ? W.ttdDipilih() : true);
        kartu.tulis("", `Mengubah ${berkas.name} ke PDF${denganTtd ? " dan membubuhkan tanda tangan scan" : ""}... mohon tunggu.`, []);
        let h;
        try {
          h = await W.mintaPdf(berkas, denganTtd);
        } catch (galat) {
          return gagal(`tidak dapat diubah ke PDF: ${sebaris((galat && galat.message) || galat).slice(0, 160)}`);
        }
        isi = h.pdf;
        namaKirim = h.nama;
        tipeKirim = "application/pdf";
        if (denganTtd) for (const b of W.barisPenandatangan(h)) catatan.push(b);
        else if (jenisSah.kelompok !== "bas") catatan.push(`Tanda tangan scan tidak dibubuhkan untuk ${jenisSah.nama} (hanya untuk BAS); PDF dibuat apa adanya dari berkas Anda.`);
        for (const p of h.peringatan) catatan.push(p);
      } else {
        // bukan PDF dan bukan Word: sampai di sini hanya bila halaman unggah SIPP tidak membatasi ke PDF (diperiksa di atas)
        isi = bita;
        namaKirim = namaAman(berkas.name);
        tipeKirim = berkas.type || "application/octet-stream";
      }
      const namaPdf = namaKirim; // nama yang tampil di kartu dan dialog

      // 5. periksa isi
      const D = akar.aletaDeteksiSisa;
      let temuan = [];
      let tidakDiperiksa = false;
      if (jenisSah.kelompok && D) {
        kartu.tulis("", `Memeriksa isi ${jenisSah.nama}...`, []);
        const opsiPeriksa = { jenis: jenisSah.kelompok };
        let paragraf = null;
        if (bentuk === "pdf" || (adaWord && !kirimWordAsli)) {
          // yang dikirim PDF (asli atau hasil ubahan): teksnya dibaca server; RTF/DOCX asli tetap diperiksa dari ASLINYA (tulisan merah hanya di sana)
          const baca = await bacaPdfServer(isi);
          paragraf = baca ? baca.paragraf : null;
          if (!baca) tidakDiperiksa = true;
          if (adaWord && (bentuk === "rtf" || bentuk === "docx") && typeof D.periksaBita === "function") {
            const h = await D.periksaBita(bita, berkas.name, opsiPeriksa);
            if (h && h.dibaca && h.hasil) temuan = temuan.concat(h.hasil.temuan);
            else if (paragraf) temuan = temuan.concat(D.periksaParagraf(paragraf, opsiPeriksa).temuan);
          } else if (paragraf) {
            temuan = temuan.concat(D.periksaParagraf(paragraf, opsiPeriksa).temuan);
          }
        } else if (kirimWordAsli) {
          // Word dikirim apa adanya: dibaca langsung di peramban (RTF dan DOCX); DOC biner tidak terbaca -> disimpan dengan catatan
          try {
            if (bentuk === "rtf") paragraf = D.bacaRtfParagraf(new akar.TextDecoder("windows-1252").decode(bita));
            else if (bentuk === "docx") {
              const xml = await D.ambilDariZip(bita, "word/document.xml");
              paragraf = xml ? D.bacaDocxXml(new akar.TextDecoder("utf-8").decode(xml)) : null;
            }
          } catch {
            paragraf = null;
          }
          if (paragraf) temuan = temuan.concat(D.periksaParagraf(paragraf, opsiPeriksa).temuan);
          else tidakDiperiksa = true;
        }
        if (paragraf) {
          temuan = temuan.concat(
            temuanKesesuaian({
              paragraf,
              periksaNomor: jenisSah.nomor,
              periksaTanggal: jenisSah.tanggal,
              nomorHalaman: nomorHalaman(),
              tanggalBaris: jenisSah.tanggal ? tanggalBarisDari(tautan) : "",
            })
          );
        }
        if (tidakDiperiksa) catatan.push(kirimWordAsli ? "Isi: berkas Word ini tidak dapat dibaca untuk diperiksa; berkas tetap disimpan." : "Isi berkas tidak dapat diperiksa (pembaca PDF tidak terjangkau); berkas tetap disimpan.");
      }
      if (temuan.length) {
        kartu.tulis("awas", `Menunggu jawaban Anda: ada ${temuan.length} temuan pada ${jenisSah.nama}.`, ringkasTemuan(temuan));
        const hanyaSesuai = temuan.every((t) => t.jenis === "sesuai");
        let pilihan = "lanjut";
        if (D && typeof D.tampilkanDialog === "function") {
          pilihan = await D.tampilkanDialog(temuan, {
            nama: namaPdf,
            jenis: jenisSah.kelompok,
            jenisTeks: jenisSah.nama,
            aksi: "unggah",
            judul: hanyaSesuai ? "Isi berkas perlu diperiksa dulu" : "Berkas ini masih memuat sisa blangko atau isian yang perlu diperiksa",
            labelLanjut: "Tetap unggah",
          });
        }
        if (pilihan !== "lanjut") return kartu.tulis("awas", "Dibatalkan: tidak ada yang dikirim ke SIPP.", [`${jenisSah.nama}: ${berkas.name}`]);
      }

      // 6. simpan lewat halaman unggah SIPP
      kartu.tulis("", `Menyimpan ${jenisSah.nama} ke SIPP...`, []);
      const berkasPdf = new akar.File([isi], namaKirim, { type: tipeKirim });
      const hasil = await simpanKeSipp(hal, berkasPdf, mutlak);
      if (!hasil.ok) return kartu.tulis("gagal", `Gagal menyimpan ${jenisSah.nama} ke SIPP: ${hasil.pesan || "SIPP menolak berkas"}`, catatan);
      kartu.tulis("ok", `Tersimpan di SIPP: ${jenisSah.nama} (${namaKirim}, ${ukuranTeks(isi.length)})`, catatan);
      segarkanHalaman(hal.divRef);
    } catch (galat) {
      gagal(sebaris((galat && galat.message) || galat).slice(0, 160));
    }
  }

  /** Seperti penutupan popup SIPP: pemicu change pada wadah (#konten) memuat ulang bagian halaman yang bersangkutan. */
  function segarkanHalaman(selektor) {
    try {
      const el = doc.querySelector(selektor || "#konten");
      if (el) el.dispatchEvent(new akar.Event("change", { bubbles: true }));
    } catch {
      /* halaman tetap benar; muat ulang bila perlu */
    }
  }

  // --------------------------------------------------------------------------
  // Seret-lepas: pendengar di tingkat dokumen (tombol dimuat belakangan oleh SIPP)
  // --------------------------------------------------------------------------
  /** Fitur dinyalakan di Tampilan SIPP (bawaan menyala). Mati = tombol tidak menerima seret. */
  function aktif() {
    try {
      const T = akar.AletaTampilanSipp;
      if (T && typeof T.tersembunyi === "function") return !T.tersembunyi(KUNCI_TAMPILAN);
    } catch {
      /* jatuh ke penanda */
    }
    try {
      const daftar = String(doc.documentElement.getAttribute("data-aleta-tampilan-sembunyi") || "").split(/\s+/);
      return !daftar.includes(KUNCI_TAMPILAN);
    } catch {
      return true;
    }
  }

  function bawaBerkas(e) {
    const dt = e && e.dataTransfer;
    if (!dt) return false;
    const t = dt.types;
    if (t && typeof t.length === "number") {
      for (let i = 0; i < t.length; i += 1) if (t[i] === "Files") return true;
      return false;
    }
    return Boolean(dt.files && dt.files.length);
  }

  /** Tombol e-Doc di bawah `el` atau null. */
  function tombolDari(el) {
    let n = el && el.nodeType === 1 ? el : el && el.parentElement;
    for (let i = 0; n && i < 6; i += 1, n = n.parentElement) {
      if (n.nodeType !== 1 || !n.getAttribute) continue;
      const oc = n.getAttribute("onclick");
      if (!oc || !/popup_form/i.test(oc)) continue;
      const info = bacaTautan(oc);
      if (info) return { el: n, info };
    }
    return null;
  }

  let sorotan = null;
  let petunjuk = null;
  let jamSepi = null;
  let tersiap = [];
  let sudahTandai = false;

  function letakkanPetunjuk(t) {
    pasangGaya();
    if (!petunjuk) {
      petunjuk = doc.createElement("div");
      petunjuk.className = KELAS_PETUNJUK;
      petunjuk.setAttribute("aria-hidden", "true");
      (doc.body || doc.documentElement).appendChild(petunjuk);
    }
    const jenis = infoJenis(t.info.kode);
    petunjuk.textContent = `Lepas di sini untuk unggah ${jenis.nama}`;
    const r = t.el.getBoundingClientRect();
    const lebarLayar = akar.innerWidth || 1024;
    petunjuk.style.left = `${Math.max(8, Math.min(r.left, lebarLayar - 330))}px`;
    petunjuk.style.top = `${r.top > 44 ? r.top - 34 : r.bottom + 8}px`;
  }

  function hapusSorotan() {
    if (sorotan) sorotan.classList.remove(KELAS_SOROT);
    sorotan = null;
    if (petunjuk) {
      petunjuk.remove();
      petunjuk = null;
    }
  }

  function bersihkanSemua() {
    hapusSorotan();
    for (const el of tersiap) el.classList.remove(KELAS_SIAP);
    tersiap = [];
    sudahTandai = false;
    if (jamSepi) clearTimeout(jamSepi);
    jamSepi = null;
  }

  /** Tandai semua tombol e-Doc yang tampak saat berkas mulai diseret, supaya jelas tempat melepasnya. */
  function tandaiSemua() {
    if (sudahTandai) return;
    sudahTandai = true;
    pasangGaya();
    for (const a of Array.from(doc.querySelectorAll("a[onclick], button[onclick], input[onclick]"))) {
      const oc = a.getAttribute("onclick");
      if (oc && /popup_form/i.test(oc) && bacaTautan(oc)) {
        a.classList.add(KELAS_SIAP);
        tersiap.push(a);
      }
    }
  }

  function saatSeret(e) {
    try {
      if (!aktif() || !bawaBerkas(e)) return;
      tandaiSemua();
      if (jamSepi) clearTimeout(jamSepi);
      jamSepi = setTimeout(bersihkanSemua, JEDA_SEPI_MS);
      const t = tombolDari(e.target);
      if (!t) {
        hapusSorotan();
        return;
      }
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (sorotan !== t.el) {
        hapusSorotan();
        sorotan = t.el;
        sorotan.classList.add(KELAS_SOROT);
      }
      letakkanPetunjuk(t);
    } catch {
      /* penanda visual tidak boleh mengganggu SIPP */
    }
  }

  function saatLepas(e) {
    try {
      if (!aktif() || !bawaBerkas(e)) return;
      const t = tombolDari(e.target);
      bersihkanSemua();
      if (!t) return; // di luar tombol e-Doc: perilaku peramban/SIPP seperti biasa
      e.preventDefault();
      e.stopPropagation();
      const daftar = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      if (!daftar.length) return;
      if (daftar.length > 1) {
        const k = buatKartu("");
        k.tulis("gagal", "Lepaskan satu berkas saja pada satu tombol.", [`${daftar.length} berkas dilepas bersamaan; tidak ada yang dikirim.`]);
        return;
      }
      void proses(t.el, t.info, daftar[0]);
    } catch {
      /* tidak mengganggu SIPP */
    }
  }

  function saatTinggalJendela(e) {
    // dragleave dari jendela (relatedTarget kosong): hapus penanda
    if (!e.relatedTarget) bersihkanSemua();
  }

  doc.addEventListener("dragenter", saatSeret, true);
  doc.addEventListener("dragover", saatSeret, true);
  doc.addEventListener("dragleave", saatTinggalJendela, true);
  doc.addEventListener("drop", saatLepas, true);

  akar.aletaEdocSeret = Object.freeze({
    aktif,
    bacaTautan,
    infoJenis,
    tanggalDalamTeks,
    nomorDalamTeks,
    tanggalBarisSidang,
    temuanKesesuaian,
    bacaHalamanUnggah,
    simpanKeSipp,
    namaAman,
    proses,
    daftarJenis: () => Object.keys(JENIS),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = akar.aletaEdocSeret;
})(typeof globalThis !== "undefined" ? globalThis : this);
