"use strict";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 2: PENYATU & RAPIKAN DOBEL (TAHAP M2)
 * ============================================================================
 *
 * Skrip konten TERSENDIRI di SIPP (dimuat sesudah konten.js dan sipp-ide-l1.js),
 * dibungkus satu fungsi; yang keluar hanya globalThis.aletaSippIdeM2.
 * Rancangan: D:/aleta-dev/kerja/ide-meja-blangko/sipp-dengan-ide.html (J05,
 * J06, J07, J09, J12) dan peta SIPP 7.0.4 (K-PETA-SIPP.md).
 *
 *   PENYATU  kotak "Perkara ini di SIPP, ABT, dan ALETA" di halaman perkara
 *            (di atas deretan tab, #usual2): status blangko (penetapan, BAS,
 *            relaas, putusan), BAS yang belum diunggah ke SIPP, tugas peran
 *            akun ini, dan selisih tiga sumber. Datanya dari rute portal
 *            /aleta/api/aleta-ecourt/penyatu (baca saja); catatan cetak
 *            Blangko ABT by Derry Briantono di peramban ini ikut disebut.
 *            Tiap selisih dapat diklik: penjelasan + nilai per sumber +
 *            tombol ke tempat memperbaikinya (tab SIPP, ABT, ALETA).
 *   J06      di tab Jadwal Sidang, baris yang SIPP-nya "Dokumen Belum Ada"
 *            padahal BAS-nya sudah disusun (ABT/ALETA) diberi lencana.
 *   DOBEL    tombol/panel ALETA yang fungsinya 100% sama dengan yang lain
 *            disembunyikan di UI Baru - TIDAK dihapus: saklar popup "Tampilkan
 *            tombol ALETA yang dobel" (sippTampilDobel) memunculkannya lagi,
 *            dan di tempatnya ada tautan "Tampilkan" yang sama.
 *
 * Tidak satu pun yang ditulis ke SIPP/ABT/ALETA oleh berkas ini. Semua
 * sisipan berkelas aleta-sisip (dilewati pengamat konten.js dan L1) dan
 * aleta-m2; Tampilan Lama tidak berubah sama sekali (alatUjiMode() "lama").
 */
(function sippIdeM2Modul() {
  if (typeof globalThis === "undefined" || globalThis.aletaSippIdeM2) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const KELAS = "aleta-sisip aleta-m2";
  const ID_GAYA = "aleta-m2-gaya";
  const ID_DOBEL = "aleta-m2-dobel";
  const ID_PANEL = "aleta-panel-sipp";
  const API_PENYATU = "/aleta/api/aleta-ecourt/penyatu";
  /** Saklar popup (STATIS di ekstensi-saklar-widget-audit-12okt.test.ts). */
  const SAKLAR_PENYATU = "sippPenyatu"; // bawaan MENYALA
  const SAKLAR_DOBEL = "sippTampilDobel"; // bawaan MATI = yang dobel disembunyikan
  /** Catatan cetak Blangko ABT by Derry Briantono: `${K_CETAK}:<nomor>|put|bas|rel` -> jam. */
  const K_CETAK = "blangkoDerryCetak";
  /** html[data-aleta-lencana="rancangan"] = gaya lencana bersama rupa rancangan (panel.css) berlaku - UI Baru saja. */
  const ATR_LENCANA = "data-aleta-lencana";
  const BUKAN_SIPP = `.aleta-sisip, #${ID_PANEL}, [data-aleta-tanda], .aleta-panel`;
  const POLA_NOMOR_PENUH = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}$/;
  const SINGGAH_MS = 2 * 60 * 1000;

  /**
   * ==========================================================================
   * INVENTARIS DOBEL (tahap M2) - yang disembunyikan HANYA yang `sembunyi`.
   * ==========================================================================
   * Penilaian atas kode (konten.js, sipp-ide-l1.js, blangko-derry.js) dan
   * kode SIPP 7.0.4 (K-PETA-SIPP.md, cek dobel sipp-dengan-ide.html v3).
   * `selektor` = elemen yang disembunyikan; `syarat` = keadaan halaman yang
   * menjamin padanannya ADA di layar (tanpa padanan, tidak disembunyikan).
   */
  const DOBEL = [
    {
      kode: "edoc-penetapan-manual",
      apa: "Panel Penetapan > Upload edoc penetapan > lipatan \"Upload manual edoc penetapan\" (PMH/PPP/PJS/PHS)",
      padanan: "Tombol Unggah e-Doc di tiap baris tab Penetapan SIPP (fileupload/<enc>/dokpmh|dokppp|dokpjs|dokphs)",
      pilih: "sembunyi",
      selektor: '[data-s2-fitur="edoc-penetapan-manual"]',
      syarat: null,
      alasan:
        "Contoh pengguna 16 Okt: unggah manual e-Doc penetapan dobel dengan Unggah bawaan SIPP; unggah OTOMATIS dari blangko ABT dipertahankan. " +
        "Beda yang tersisa: ALETA membubuhkan TTE + cap sebelum mengunggah - masih dapat dipakai lewat saklar Tampilkan.",
    },
    {
      kode: "buka-di-aleta-panel",
      apa: "Panel ALETA > baris cepat > tautan \"Buka di ALETA ↗\" (sipp-16)",
      padanan: "Tombol \"Buka di ALETA\" di deretan tombol halaman perkara (tahap L1, J02) - alamat sama persis (t7AlamatAleta)",
      pilih: "sembunyi",
      selektor: 'a[data-t7-fitur="sipp-16"]',
      syarat: '.aleta-l1-submenu [data-l1="aleta"][href]',
      alasan: "Tujuan dan alamatnya identik; disembunyikan hanya selama tombol L1 tampil di halaman yang sama.",
    },
    {
      kode: "edoc-penetapan-dua-tempat",
      apa: "Upload edoc penetapan (Penetapan, Ketua) vs Edoc penetapan dari blangko ABT (PTSP)",
      padanan: "Mesin unggah sama (penetapan-edoc/unggah)",
      pilih: "biarkan",
      alasan: "Sebagian: PTSP hanya PMH/PHS dan berjalan otomatis sesudah Tetapkan; Ketua memuat keempat jenis + passphrase TTE. Peran dan pemicunya berbeda.",
    },
    {
      kode: "unggah-putusan-dua-cara",
      apa: "Unggah putusan ke SIPP: satu pemilih vs dua slot (putusan + anonimisasi)",
      padanan: "Rute unggah-sipp yang sama",
      pilih: "biarkan",
      alasan: "Bukan tampil bersamaan - cara lama/baru dipilih dengan tombol; menyembunyikan salah satu = menghapus pilihan.",
    },
    {
      kode: "unggah-putusan-vs-sipp",
      apa: "Unggah edoc putusan ALETA vs Unggah E-Doc di tab Putusan SIPP",
      padanan: "fileupload_putusan/<enc>/putusan|anonimisasi",
      pilih: "biarkan",
      alasan: "Sebagian: ALETA membuat salinan anonimisasi, memeriksanya, dan mengunggah keduanya sekaligus sesudah Simpan.",
    },
    {
      kode: "court-calendar",
      apa: "Court Calendar otomatis ALETA vs tab/borang Court Calendar SIPP",
      padanan: "court_calendar/<enc> (manual)",
      pilih: "biarkan",
      alasan: "Sebagian: SIPP manual, ALETA mengisinya dari jadwal.",
    },
    {
      kode: "unggah-bas",
      apa: "Unggah BAS ke e-Doc SIPP (Blangko Derry / BAS massal) vs Unggah BAS di tab Jadwal Sidang SIPP",
      padanan: "fileupload/<enc>/bas/<sidang>",
      pilih: "biarkan",
      alasan: "Sebagian: ALETA mencetak BAS dari blangko ABT lalu mengunggahnya; SIPP hanya menerima berkas jadi.",
    },
    {
      kode: "smart-majelis",
      apa: "Usulan penetapan ALETA (PMH/PPP/PJS/PHS setanggal) vs Smart Majelis SIPP (tombol Tinjau di PMH)",
      padanan: "edit_majelis_v.php #tinjau",
      pilih: "biarkan",
      alasan: "Sebagian: Smart Majelis hanya PMH; PPP, PJS, PHS dan penetapan setanggal tambahan ALETA.",
    },
    {
      kode: "cek-dobel-edoc",
      apa: "Cek dobel e-Doc di jendela e-Doc SIPP (L1) vs konfirmasi timpa e-Doc penetapan panel (butir 7)",
      padanan: "Keduanya bertanya sebelum menimpa",
      pilih: "biarkan",
      alasan: "Tempat berbeda: L1 menjaga tombol Simpan SIPP sendiri, butir 7 menjaga unggah lewat ALETA. Tidak tampil bersamaan.",
    },
    {
      kode: "lencana-non-ecourt-sisa-panjar",
      apa: "A15 lencana Non e-Court dan G04 sisa panjar belum dikembalikan (rancangan v2)",
      padanan: "Penanda (e-Court) SIPP; dasbor Sisa Panjar SIPP",
      pilih: "tidak-ada",
      alasan: "Dobel penuh, tetapi sudah dihapus dari rancangan v3 dan tidak pernah dibangun - tidak ada yang perlu disembunyikan.",
    },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, judul, kelas) {
    const b = el("button", `btn btn-default btn-sm aleta-m2-tombol${kelas ? ` ${kelas}` : ""}`, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  const milikAleta = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(BUKAN_SIPP));

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  async function bacaPenyimpanan(kunci) {
    try {
      return (await chrome.storage.local.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  async function tulisPenyimpanan(isi) {
    try {
      await chrome.storage.local.set(isi);
      return true;
    } catch {
      return false;
    }
  }

  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const BULAN_PENDEK = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  function tanggalAwam(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : String(iso || "-");
  }
  /** "Selasa, 29 Sep. 2026" / "29 September 2026" (sel tanggal tab Jadwal SIPP) -> "2026-09-29". */
  function tanggalSelSipp(teks) {
    const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})/.exec(String(teks || ""));
    if (!m) return "";
    const b = BULAN_PENDEK[m[2].toLowerCase()];
    return b ? `${m[3]}-${String(b).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}` : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gaya
  // ──────────────────────────────────────────────────────────────────────────
  // Rupa mengikuti rancangan sipp-dengan-ide.html: lencana bulat berwarna penuh dengan (i),
  // kotak bergaris kiri hijau ALETA, chip "Perlu diperiksa hari ini", huruf SIPP 13px (tidak lebih kecil),
  // tombol = tombol SIPP sendiri (btn btn-default btn-sm). Warna tema SIPP 7.0.4 hijau; tema gelap ALETA ikut.
  const GAYA = `
.aleta-m2-kotak{margin:6px 5px 10px;padding:6px 10px;border-left:3px solid #16a34a;border-radius:3px;background:rgba(22,163,74,.09);font-family:inherit;font-size:13px;line-height:1.7;color:#333;text-align:left;letter-spacing:0}
.aleta-m2-kepala{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;cursor:pointer;user-select:none}
.aleta-m2-logo{background:#007640;color:#fff;border-radius:999px;padding:0 9px;font-weight:700;font-size:13px;line-height:1.7}
.aleta-m2-judul{font-weight:700;margin-right:4px}
.aleta-m2-kotak .aleta-tanda{margin-left:0}
.aleta-m2-perlu{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
.aleta-m2-chip{display:inline-block;border:1px solid #ccc;background:#fff;color:#333;border-radius:999px;padding:0 9px;font-size:13px;line-height:1.7;cursor:pointer;font-family:inherit}
.aleta-m2-chip:hover{border-color:#008c4b;color:#008c4b}
.aleta-m2-badan{margin-top:6px;padding-top:4px;border-top:1px solid rgba(0,140,75,.25)}
.aleta-m2-badan[hidden]{display:none}
.aleta-m2-bagian{margin-top:8px}
.aleta-m2-bagian>b{display:block;margin-bottom:2px;color:#008c4b;font-size:13px}
.aleta-m2-baris{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;padding:4px 0;border-bottom:1px dotted rgba(0,140,75,.3)}
.aleta-m2-baris:last-child{border-bottom:0}
.aleta-m2-kecil{font-size:13px;color:#259fd3}
.aleta-m2-rinci{width:100%;margin:2px 0 2px 18px;padding:0;list-style:disc;font-size:13px;color:#555}
.aleta-m2-tombol{margin:1px 2px;font-size:12px}
.aleta-m2-tombol[aria-disabled="true"],.aleta-m2-tombol:disabled{opacity:.55;cursor:default}
.aleta-m2-selisih{width:100%;text-align:left;border:0;background:transparent;padding:4px 0;cursor:pointer;font:inherit;color:inherit;display:flex;gap:8px;align-items:center}
.aleta-m2-urai{margin:2px 0 8px 18px;padding:6px 8px;border-left:3px solid #f59e0b;border-radius:3px;background:#fff7e0;color:#4a3b00}
.aleta-m2-urai[hidden]{display:none}
.aleta-m2-tabel{border-collapse:collapse;margin:6px 0;background:#fff}
.aleta-m2-tabel td,.aleta-m2-tabel th{border:1px solid #c9e6c8;padding:3px 8px;font-size:13px;text-align:left;vertical-align:top;color:#333}
.aleta-m2-tabel th{background:#008c4b;color:#fff;font-weight:400}
.aleta-m2-gagal{color:#c70505}
.aleta-m2-lain>summary{cursor:pointer;color:#259fd3;font-size:13px}
.aleta-m2-chip-bas{margin:3px 0}
.aleta-m2-dobel-catat{margin:4px 0;font-size:13px;color:#555}
.aleta-m2-dobel-catat a{cursor:pointer;text-decoration:underline}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-kotak{background:rgba(22,163,74,.12);color:#dfe8e2}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-logo{background:#1c5539}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-chip{background:#17211c;color:#dfe8e2;border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-bagian>b{color:#7fd0a6}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-kecil,html[data-aleta-tema-sipp="gelap"] .aleta-m2-lain>summary{color:#7fd0a6}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-rinci,html[data-aleta-tema-sipp="gelap"] .aleta-m2-dobel-catat{color:#b3c2ba}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-urai{background:#3a2a0b;color:#f3e2b5}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-tabel{background:#101a16}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-tabel td{color:#dfe8e2;border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-tabel th{background:#143c29;border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-m2-gagal{color:#ff9d92}
`;
  function sisipkanGaya(doc) {
    if (doc.getElementById(ID_GAYA)) return;
    const s = doc.createElement("style");
    s.id = ID_GAYA;
    s.className = KELAS;
    s.textContent = GAYA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DOBEL - sembunyikan yang dobel penuh (UI Baru), dapat dimunculkan lagi
  // ──────────────────────────────────────────────────────────────────────────
  /** Aturan CSS untuk halaman `doc` sekarang: hanya butir `sembunyi` yang syaratnya terpenuhi. */
  function aturanDobel(doc) {
    const aturan = [];
    for (const d of DOBEL) {
      if (d.pilih !== "sembunyi" || !d.selektor) continue;
      if (d.syarat && !doc.querySelector(d.syarat)) continue;
      aturan.push(`${d.selektor}{display:none!important}`);
    }
    return aturan.join("\n");
  }

  function pasangDobel(doc) {
    let gaya = doc.getElementById(ID_DOBEL);
    if (tampilDobel) {
      if (gaya) gaya.remove();
      for (const c of Array.from(doc.querySelectorAll(".aleta-m2-dobel-catat"))) c.remove();
      return 0;
    }
    const isi = aturanDobel(doc);
    if (!gaya) {
      gaya = doc.createElement("style");
      gaya.id = ID_DOBEL;
      gaya.className = KELAS;
      (doc.head || doc.documentElement).appendChild(gaya);
    }
    if (gaya.textContent !== isi) gaya.textContent = isi;
    // Tautan "Tampilkan" di tempat yang disembunyikan (yang berwadah jelas saja).
    let catat = 0;
    const manual = doc.querySelector('[data-s2-fitur="edoc-penetapan-manual"]');
    if (manual && manual.parentNode) {
      const sudah = manual.nextElementSibling && manual.nextElementSibling.classList.contains("aleta-m2-dobel-catat");
      if (!sudah) {
        const c = el("div", `${KELAS} aleta-m2-dobel-catat`);
        c.appendChild(document.createTextNode("Unggah manual e-Doc penetapan disembunyikan karena sama dengan tombol Unggah di tab Penetapan SIPP. "));
        const a = el("a", "", "Tampilkan");
        a.setAttribute("role", "button");
        a.title = "Sama dengan saklar popup \"Tampilkan tombol ALETA yang dobel\"";
        a.addEventListener("click", () => {
          // Berlaku seketika di halaman ini; saklar tersimpan untuk halaman lain (onChanged).
          tampilDobel = true;
          jadwalkan();
          void tulisPenyimpanan({ [SAKLAR_DOBEL]: true });
        });
        c.appendChild(a);
        manual.parentNode.insertBefore(c, manual.nextSibling);
      }
      catat += 1;
    }
    return catat;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Nomor & alamat
  // ──────────────────────────────────────────────────────────────────────────
  function nomorHalaman(doc) {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      if (l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function") {
        const n = l1.murni.nomorHalamanDetil(doc);
        if (n) return n;
      }
    } catch {
      /* jatuh ke pembaca sendiri */
    }
    for (const sel of Array.from(doc.querySelectorAll("td"))) {
      if (milikAleta(sel) || !/^nomor\s+perkara\s*:?$/i.test(sebaris(sel.textContent))) continue;
      let isi = sel.nextElementSibling;
      if (isi && /^:?$/.test(sebaris(isi.textContent))) isi = isi.nextElementSibling || isi;
      const t = isi ? sebaris(isi.textContent).split(" ")[0] : "";
      if (POLA_NOMOR_PENUH.test(t)) return t;
    }
    return "";
  }
  function alamatAbt(nomor) {
    const l1 = globalThis.aletaSippIdeL1;
    if (l1 && l1.murni && typeof l1.murni.alamatAbtUntuk === "function") return l1.murni.alamatAbtUntuk(nomor);
    return `${location.origin}/aps_badilag/abt/main/beranda#aleta-bd=${encodeURIComponent(nomor)}`;
  }
  function alamatAleta(nomor) {
    const l1 = globalThis.aletaSippIdeL1;
    if (l1 && l1.murni && typeof l1.murni.alamatAleta === "function") return l1.murni.alamatAleta(nomor);
    return `${location.origin}/aleta/aleta-ecourt?perkara=${encodeURIComponent(nomor)}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Data
  // ──────────────────────────────────────────────────────────────────────────
  const singgah = new Map(); // nomor -> { saat, hasil }
  const sedang = new Map(); // nomor -> Promise

  async function ambilJson(alamat) {
    if (typeof t7AmbilJson === "function") return t7AmbilJson(alamat, "Membaca penyatu SIPP-ABT-ALETA");
    try {
      const r = await fetch(alamat, { credentials: "include", cache: "no-store" });
      let badan = null;
      try {
        badan = await r.json();
      } catch {
        badan = null;
      }
      if (r.status === 404) return { ok: false, status: 404, data: null, pesan: "Penyatu SIPP-ABT-ALETA belum tersedia di server." };
      if (!r.ok) return { ok: false, status: r.status, data: null, pesan: r.status === 401 ? "Masuk ke ALETA dulu." : `Portal menjawab ${r.status}.` };
      return { ok: true, status: r.status, data: badan && "data" in badan ? badan.data : badan, pesan: "" };
    } catch (e) {
      return { ok: false, status: 0, data: null, pesan: `Portal ALETA tidak terjangkau (${String((e && e.message) || e)}).` };
    }
  }

  /** { ok, data | pesan } untuk nomor; disinggahkan 2 menit (paksa = baca ulang). */
  async function muatPenyatu(nomor, paksa) {
    const ada = singgah.get(nomor);
    if (!paksa && ada && Date.now() - ada.saat < SINGGAH_MS) return ada.hasil;
    if (sedang.has(nomor)) return sedang.get(nomor);
    const kerja = (async () => {
      const j = await ambilJson(`${API_PENYATU}?nomor=${encodeURIComponent(nomor)}`);
      const hasil = !j.ok
        ? { ok: false, pesan: j.pesan || "Penyatu belum dapat dibaca." }
        : j.data && j.data.ok === false
          ? { ok: false, pesan: j.data.pesan || "Penyatu belum dapat dibaca." }
          : { ok: true, data: j.data };
      singgah.set(nomor, { saat: Date.now(), hasil });
      return hasil;
    })();
    sedang.set(nomor, kerja);
    try {
      return await kerja;
    } finally {
      sedang.delete(nomor);
    }
  }

  /** Catatan cetak Blangko Derry peramban ini untuk nomor: { put, bas, rel } -> jam. */
  async function cetakDerry(nomor) {
    const s = await bacaPenyimpanan(null);
    const hasil = {};
    for (const j of ["put", "bas", "rel"]) {
      const v = s && s[`${K_CETAK}:${nomor}|${j}`];
      if (v) hasil[j] = String(v);
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar kotak penyatu
  // ──────────────────────────────────────────────────────────────────────────
  const NADA = { lengkap: "hijau", "selesai-lama": "abu", kurang: "kuning", "belum-waktunya": "abu", "tidak-terbaca": "abu" };
  const ARTI_KEADAAN = {
    lengkap: "Sudah dibuat dan sudah ada di SIPP beserta e-Doc-nya.",
    "selesai-lama": "Perkara lama atau sudah putus; yang kurang tidak lagi menjadi tugas.",
    kurang: "Masih ada yang belum dibuat atau belum diunggah ke SIPP.",
    "belum-waktunya": "Belum ada yang perlu dibuat pada tahap ini.",
    "tidak-terbaca": "Datanya belum dapat dibaca saat ini.",
  };
  const TEKS_KEADAAN = { lengkap: "Lengkap", "selesai-lama": "Selesai", kurang: "Kurang", "belum-waktunya": "Belum waktunya", "tidak-terbaca": "Tidak terbaca" };
  const LABEL_CETAK = { put: "putusan", bas: "BAS", rel: "relaas" };
  const JENIS_CETAK = { putusan: "put", bas: "bas", relaas: "rel" };

  /** Tombol/tautan untuk satu tempat memperbaiki. */
  function tombolTempat(t, nomor, doc) {
    if (t.jenis === "tab") {
      const b = tombol(t.label, "Membuka tab ini di halaman perkara");
      b.setAttribute("data-m2-tab", t.tab);
      const a = doc.querySelector(`#usual2 a[href="#${t.tab}"]`);
      if (!a) {
        b.disabled = true;
        b.title = "Tab ini tidak ada di halaman perkara ini";
      }
      b.addEventListener("click", () => {
        const sasaran = document.querySelector(`#usual2 a[href="#${t.tab}"]`);
        if (!sasaran) return;
        sasaran.click();
        try {
          sasaran.scrollIntoView({ block: "start", behavior: "smooth" });
        } catch {
          /* gulir hanya kenyamanan */
        }
      });
      return b;
    }
    const a = el("a", "btn btn-default btn-sm aleta-m2-tombol", t.label);
    a.setAttribute("data-m2-tempat", t.jenis);
    a.target = "_blank";
    a.rel = "noopener";
    if (!nomor) {
      a.setAttribute("aria-disabled", "true");
      return a;
    }
    a.href = t.jenis === "abt" ? alamatAbt(nomor) : alamatAleta(nomor);
    a.title = t.jenis === "abt" ? "Blangko ABT by Derry Briantono langsung di perkara ini (tab baru)" : "Perkara ini di portal ALETA (tab baru)";
    if (t.jenis === "abt") {
      a.addEventListener("click", () => {
        const l1 = globalThis.aletaSippIdeL1;
        if (l1 && l1.KUNCI_SERAH) void tulisPenyimpanan({ [l1.KUNCI_SERAH]: { nomor, saat: Date.now() } });
      });
    }
    return a;
  }

  function barisTempat(daftar, nomor, doc) {
    const w = el("span", "aleta-m2-tempat");
    for (const t of daftar || []) {
      w.appendChild(tombolTempat(t, nomor, doc));
      w.appendChild(document.createTextNode(" "));
    }
    return w;
  }

  /**
   * Lencana bulat berwarna - GAYA BERSAMA semua lencana ALETA di SIPP (.aleta-tanda +
   * .aleta-tanda-<warna>, panel.css bagian "rupa rancangan"); (i) digambar CSS dari title.
   */
  function pil(teks, nada, arti) {
    const l = el("span", `aleta-tanda aleta-tanda-${nada || "abu"} aleta-m2-lencana`, teks);
    if (arti) {
      l.title = arti;
      l.setAttribute("aria-label", `${teks}. ${arti}`);
    }
    return l;
  }

  /** Kepala: ringkasan satu baris. */
  function ringkasKepala(d) {
    const anda = d.tugas.filter((t) => t.untukAnda).length;
    const merah = d.selisih.filter((s) => s.tingkat === "merah").length;
    return {
      blangko: d.ringkasBlangko,
      bas: d.basBelum.length,
      tugasAnda: anda,
      tugas: d.tugas.length,
      selisih: d.selisih.length,
      merah,
      perluPerhatian: d.basBelum.length > 0 || anda > 0 || d.selisih.length > 0,
    };
  }

  function gambarKotak(kotak, hasil, nomor, cetak, doc) {
    const kepala = kotak.querySelector(".aleta-m2-kepala");
    const badan = kotak.querySelector(".aleta-m2-badan");
    const perlu = kotak.querySelector(".aleta-m2-perlu");
    kepala.textContent = "";
    badan.textContent = "";
    perlu.textContent = "";
    perlu.hidden = true;
    kepala.appendChild(el("span", "aleta-m2-logo", "ALETA"));
    kepala.appendChild(el("span", "aleta-m2-judul", "Perkara ini di SIPP, ABT, dan ALETA"));
    if (!hasil) {
      kepala.appendChild(pil("Membaca…", "abu"));
      return;
    }
    if (!hasil.ok) {
      kepala.appendChild(pil("Belum terbaca", "abu"));
      badan.appendChild(el("div", "aleta-m2-gagal", hasil.pesan));
      if (nomor) {
        const ulang = tombol("Coba lagi");
        ulang.setAttribute("data-m2", "muat-ulang");
        ulang.addEventListener("click", () => void segarkan(true));
        badan.appendChild(ulang);
      }
      kotak.setAttribute("data-m2-keadaan", "gagal");
      return;
    }
    const d = hasil.data;
    const r = ringkasKepala(d);
    kotak.setAttribute("data-m2-keadaan", "siap");
    kepala.appendChild(
      pil(`Blangko ${r.blangko}`, /^(\d+) dari \1\b/.test(r.blangko) ? "hijau" : "kuning", "Penetapan, BAS, relaas, dan putusan: sudah dibuat dan sudah ada di SIPP beserta e-Doc-nya?")
    );
    kepala.appendChild(
      pil(r.bas ? `${r.bas} BAS belum diunggah` : "BAS sudah diunggah", r.bas ? "kuning" : "hijau", "Sidang yang sudah lewat tetapi e-Doc BAS-nya belum ada di SIPP.")
    );
    kepala.appendChild(
      pil(r.tugasAnda ? `${r.tugasAnda} tugas Anda` : "Tidak ada tugas Anda", r.tugasAnda ? "kuning" : "hijau", "Yang perlu Anda kerjakan untuk perkara ini, menurut peran akun Anda.")
    );
    kepala.appendChild(
      pil(
        r.selisih ? `${r.selisih} data berbeda` : "Data sama",
        r.merah ? "merah" : r.selisih ? "kuning" : "hijau",
        "Data yang tidak sama antara SIPP, ABT, dan ALETA/e-Court (tanggal sidang, penetapan, putusan, BHT, berkas e-Doc)."
      )
    );
    const semuaTerbaca = d.sumber.sipp && d.sumber.abt && d.sumber.aleta && d.sumber.portal;
    if (!semuaTerbaca) kepala.appendChild(pil("Sebagian belum terbaca", "abu", "Sebagian data SIPP, ABT, atau ALETA belum dapat dibaca. Lihat Catatan di bawah."));

    // "Perlu diperiksa hari ini" - chip yang membuka butirnya (rancangan: kotak Perlu diperiksa hari ini).
    const butirPerlu = [
      ...d.tugas.filter((t) => t.untukAnda).map((t) => ({ teks: t.judul, sasaran: `[data-m2-tugas="${t.kode}"]` })),
      ...d.basBelum.map((x) => ({ teks: `BAS ${tanggalAwam(x.tanggal)} belum diunggah`, sasaran: `[data-m2-sidang="${x.tanggal}"]` })),
      ...d.selisih.map((x) => ({ teks: x.judul, sasaran: `[data-m2-selisih="${x.kode}"]`, buka: true })),
    ];
    if (butirPerlu.length) {
      perlu.hidden = false;
      perlu.appendChild(el("b", "", `Perlu diperiksa hari ini (${butirPerlu.length})`));
      for (const p of butirPerlu.slice(0, 6)) {
        const c = el("button", "aleta-m2-chip", p.teks.length > 60 ? `${p.teks.slice(0, 58)}…` : p.teks);
        c.type = "button";
        c.title = p.teks;
        c.addEventListener("click", () => {
          badan.hidden = false;
          kotak.setAttribute("data-m2-dipilih", "");
          const t = badan.querySelector(p.sasaran);
          if (!t) return;
          if (p.buka && t.getAttribute("aria-expanded") === "false") t.click();
          try {
            t.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch {
            /* gulir hanya kenyamanan */
          }
        });
        perlu.appendChild(c);
      }
      if (butirPerlu.length > 6) perlu.appendChild(el("span", "aleta-m2-kecil", `dan ${butirPerlu.length - 6} lainnya`));
    }

    // 1. Status blangko
    const b1 = el("div", "aleta-m2-bagian");
    b1.setAttribute("data-m2-bagian", "blangko");
    b1.appendChild(el("b", "", "Status blangko"));
    for (const b of d.blangko) {
      const baris = el("div", "aleta-m2-baris");
      baris.setAttribute("data-m2-jenis", b.jenis);
      baris.appendChild(el("span", "", b.judul));
      baris.appendChild(pil(TEKS_KEADAAN[b.keadaan] || b.keadaan, NADA[b.keadaan] || "abu", ARTI_KEADAAN[b.keadaan]));
      baris.appendChild(el("span", "aleta-m2-kecil", b.ringkas));
      const rinci = [...b.rincian];
      const kunciCetak = JENIS_CETAK[b.jenis];
      if (kunciCetak && cetak[kunciCetak]) rinci.push(`Blangko ABT by Derry Briantono: ${LABEL_CETAK[kunciCetak]} dicetak ${cetak[kunciCetak]} (di komputer ini).`);
      if (rinci.length) {
        const ul = el("ul", "aleta-m2-rinci");
        for (const t of rinci) ul.appendChild(el("li", "", t));
        baris.appendChild(ul);
      }
      b1.appendChild(baris);
    }
    badan.appendChild(b1);

    // 2. BAS belum diunggah
    const b2 = el("div", "aleta-m2-bagian");
    b2.setAttribute("data-m2-bagian", "bas");
    b2.appendChild(el("b", "", "BAS yang belum diunggah ke SIPP"));
    if (!d.basBelum.length) {
      b2.appendChild(el("div", "aleta-m2-kecil", d.basLama ? `Tidak ada yang baru. ${d.basLama} sidang lama (lebih dari 120 hari) tanpa BAS di SIPP.` : "Tidak ada - semua sidang yang sudah lewat punya e-Doc BAS."));
    } else {
      for (const x of d.basBelum) {
        const baris = el("div", "aleta-m2-baris");
        baris.setAttribute("data-m2-sidang", x.tanggal);
        baris.appendChild(el("span", "", `Sidang ke-${x.urutan || "?"}, ${tanggalAwam(x.tanggal)}`));
        if (x.agenda) baris.appendChild(el("span", "aleta-m2-kecil", x.agenda));
        const adaAbt = x.bukti.some((t) => /^ABT/.test(t));
        baris.appendChild(
          pil(
            x.bukti.length ? "BAS sudah disusun" : "Belum ada jejak BAS",
            x.bukti.length ? "kuning" : "abu",
            x.bukti.length ? "BAS sidang ini sudah disusun di ABT atau ALETA - tinggal dicetak lalu diunggah ke SIPP." : "Belum terlihat BAS sidang ini di ABT maupun ALETA."
          )
        );
        const tempat = [{ jenis: "tab", tab: "tabs4", label: "Unggah di tab Jadwal Sidang" }];
        if (adaAbt || cetak.bas) tempat.push({ jenis: "abt", label: "Cetak di ABT" });
        baris.appendChild(barisTempat(tempat, nomor, doc));
        if (x.bukti.length) {
          const ul = el("ul", "aleta-m2-rinci");
          for (const t of x.bukti) ul.appendChild(el("li", "", t));
          baris.appendChild(ul);
        }
        b2.appendChild(baris);
      }
      if (d.basLama) b2.appendChild(el("div", "aleta-m2-kecil", `Ditambah ${d.basLama} sidang lama (lebih dari 120 hari) tanpa BAS di SIPP.`));
      /* === 17OKT-F41: unggah massal BAS (layar di ABT, aturan "BAS belum" yang sama) === */
      const massal = el("a", "btn btn-default btn-sm aleta-m2-tombol", "Unggah massal BAS di ABT");
      massal.setAttribute("data-m2-tempat", "unggah-massal");
      massal.target = "_blank";
      massal.rel = "noopener";
      massal.title = "Semua BAS Anda yang belum ada di SIPP - centang, periksa, unggah berurutan (tab baru)";
      massal.href = String(alamatAbt(nomor || "")).replace(/#.*$/, "") + "#aleta-unggah-massal=bas";
      const barisMassal = el("div", "aleta-m2-baris");
      barisMassal.appendChild(massal);
      b2.appendChild(barisMassal);
      /* === AKHIR 17OKT-F41 === */
    }
    badan.appendChild(b2);

    // 3. Tugas
    const b3 = el("div", "aleta-m2-bagian");
    b3.setAttribute("data-m2-bagian", "tugas");
    b3.appendChild(el("b", "", "Tugas perkara ini"));
    const anda = d.tugas.filter((t) => t.untukAnda);
    const lain = d.tugas.filter((t) => !t.untukAnda);
    const gambarTugas = (t, wadah) => {
      const baris = el("div", "aleta-m2-baris");
      baris.setAttribute("data-m2-tugas", t.kode);
      baris.appendChild(el("span", "", t.judul));
      baris.appendChild(pil(LABEL_PERAN[t.peran] || t.peran, t.untukAnda ? "kuning" : "abu", t.untukAnda ? "Tugas ini untuk Anda." : "Tugas ini untuk peran lain di perkara ini."));
      baris.appendChild(barisTempat(t.tempat, nomor, doc));
      baris.appendChild(el("div", "aleta-m2-kecil", t.sebab));
      wadah.appendChild(baris);
    };
    if (!d.tugas.length) b3.appendChild(el("div", "aleta-m2-kecil", "Tidak ada yang perlu dikerjakan untuk perkara ini menurut SIPP, ABT, dan ALETA."));
    else if (!anda.length) b3.appendChild(el("div", "aleta-m2-kecil", "Tidak ada tugas untuk akun Anda di perkara ini."));
    for (const t of anda) gambarTugas(t, b3);
    if (lain.length) {
      const lipat = document.createElement("details");
      lipat.className = "aleta-m2-lain";
      lipat.appendChild(el("summary", "aleta-m2-kecil", `Tugas peran lain di perkara ini (${lain.length})`));
      for (const t of lain) gambarTugas(t, lipat);
      b3.appendChild(lipat);
    }
    badan.appendChild(b3);

    // 4. Selisih 3 sumber
    const b4 = el("div", "aleta-m2-bagian");
    b4.setAttribute("data-m2-bagian", "selisih");
    b4.appendChild(el("b", "", "Selisih data SIPP, ABT, dan ALETA/e-Court"));
    if (!d.selisih.length) b4.appendChild(el("div", "aleta-m2-kecil", "Tidak ada selisih pada data yang terbaca (tanggal sidang, penetapan, status dan tanggal putusan, BHT, berkas e-Doc, isian ABT)."));
    for (const s of d.selisih) {
      const tombolS = el("button", "aleta-m2-selisih");
      tombolS.type = "button";
      tombolS.setAttribute("data-m2-selisih", s.kode);
      tombolS.setAttribute("aria-expanded", "false");
      tombolS.appendChild(pil(s.tingkat === "merah" ? "Berbeda" : "Periksa", s.tingkat === "merah" ? "merah" : "kuning", "Klik untuk penjelasan dan tempat memperbaikinya."));
      tombolS.appendChild(el("span", "", s.judul));
      const urai = el("div", "aleta-m2-urai");
      urai.hidden = true;
      urai.appendChild(el("div", "", s.penjelasan));
      const tabel = el("table", "aleta-m2-tabel");
      const kepalaT = el("tr");
      const isiT = el("tr");
      for (const [k, label] of [["sipp", "SIPP"], ["abt", "ABT"], ["aleta", "ALETA"], ["ecourt", "e-Court"]]) {
        if (s.nilai[k] == null) continue;
        kepalaT.appendChild(el("th", "", label));
        isiT.appendChild(el("td", "", s.nilai[k]));
      }
      tabel.append(kepalaT, isiT);
      urai.appendChild(tabel);
      const per = el("div", "");
      per.appendChild(el("span", "aleta-m2-kecil", "Perbaiki di: "));
      per.appendChild(barisTempat(s.perbaiki, nomor, doc));
      urai.appendChild(per);
      tombolS.addEventListener("click", () => {
        urai.hidden = !urai.hidden;
        tombolS.setAttribute("aria-expanded", String(!urai.hidden));
      });
      b4.append(tombolS, urai);
    }
    badan.appendChild(b4);

    // Catatan + muat ulang
    const kaki = el("div", "aleta-m2-bagian");
    if (d.catatan.length) {
      kaki.appendChild(el("b", "", "Catatan"));
      const ul = el("ul", "aleta-m2-rinci");
      for (const c of d.catatan) ul.appendChild(el("li", "", c));
      kaki.appendChild(ul);
    }
    const ulang = tombol("Muat ulang", "Membaca ulang SIPP, ABT, dan ALETA untuk perkara ini");
    ulang.setAttribute("data-m2", "muat-ulang");
    ulang.addEventListener("click", () => void segarkan(true));
    kaki.appendChild(ulang);
    kaki.appendChild(el("span", "aleta-m2-kecil", " Hanya membaca - tidak ada yang diubah di SIPP, ABT, maupun ALETA."));
    badan.appendChild(kaki);

    // Terbuka bila ada yang perlu perhatian, kecuali petugas sudah memilih sendiri.
    if (!kotak.hasAttribute("data-m2-dipilih")) badan.hidden = !r.perluPerhatian;
  }

  const LABEL_PERAN = {
    hakim: "Hakim",
    "panitera-pengganti": "Panitera Pengganti",
    jurusita: "Juru Sita",
    panitera: "Panitera",
    ketua: "Ketua / Wakil Ketua",
    ptsp: "PTSP",
    operator: "Operator",
  };

  function buatKotak() {
    const kotak = el("div", `${KELAS} aleta-m2-kotak`);
    kotak.setAttribute("data-m2", "penyatu");
    const kepala = el("div", "aleta-m2-kepala");
    kepala.setAttribute("role", "button");
    kepala.title = "Buka/tutup rincian";
    const badan = el("div", "aleta-m2-badan");
    badan.hidden = true;
    kepala.addEventListener("click", (e) => {
      if (e.target && e.target.closest && e.target.closest("a,button")) return;
      badan.hidden = !badan.hidden;
      kotak.setAttribute("data-m2-dipilih", "");
    });
    const perlu = el("div", "aleta-m2-perlu");
    perlu.hidden = true;
    kotak.append(kepala, perlu, badan);
    return kotak;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // J06 - lencana di tab Jadwal Sidang
  // ──────────────────────────────────────────────────────────────────────────
  function pasangLencanaJadwal(doc, d) {
    const wadah = doc.querySelector("#tabs4");
    if (!wadah) return 0;
    const peta = new Map((d && d.ok && d.data ? d.data.basBelum : []).filter((x) => x.bukti.length).map((x) => [x.tanggal, x]));
    let n = 0;
    for (const tr of Array.from(wadah.querySelectorAll("table#tableinfo tr"))) {
      const sel = Array.from(tr.children).filter((c) => c.tagName === "TD");
      if (sel.length < 6) continue;
      const tanggal = tanggalSelSipp(sel[1].textContent);
      const ada = tr.querySelector(".aleta-m2-chip-bas");
      const x = tanggal ? peta.get(tanggal) : null;
      if (!x) {
        if (ada) ada.remove();
        continue;
      }
      const belum = Array.from(tr.querySelectorAll("span")).find((s) => !milikAleta(s) && /dokumen\s+belum\s+ada/i.test(s.textContent || ""));
      if (!belum) continue;
      if (!ada) {
        const c = el("span", `${KELAS} aleta-m2-chip-bas aleta-tanda aleta-tanda-kuning`, "BAS sudah disusun, belum diunggah");
        c.title = x.bukti.join("\n");
        belum.parentNode.insertBefore(c, belum.nextSibling);
      }
      n += 1;
    }
    return n;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  let penyatuNyala = true;
  let tampilDobel = false;
  let nomorKotak = "";
  let hasilKotak = null;

  function aktifSekarang() {
    return nyala && !modeLama();
  }

  function bersihkan(doc) {
    const d = doc || document;
    for (const e of Array.from(d.querySelectorAll(".aleta-m2"))) e.remove();
    if (d.documentElement.hasAttribute(ATR_LENCANA)) d.documentElement.removeAttribute(ATR_LENCANA);
    nomorKotak = "";
    hasilKotak = null;
  }

  async function segarkan(paksa) {
    const doc = document;
    const kotak = doc.querySelector('.aleta-m2-kotak[data-m2="penyatu"]');
    const nomor = nomorKotak;
    if (!kotak || !nomor) return null;
    if (paksa) {
      hasilKotak = null;
      gambarKotak(kotak, null, nomor, {}, doc);
    }
    const [hasil, cetak] = await Promise.all([muatPenyatu(nomor, paksa), cetakDerry(nomor)]);
    if (nomorKotak !== nomor || !kotak.isConnected) return hasil;
    hasilKotak = hasil;
    gambarKotak(kotak, hasil, nomor, cetak, doc);
    pasangLencanaJadwal(doc, hasil);
    return hasil;
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-m2") || d.documentElement.hasAttribute(ATR_LENCANA)) bersihkan(d);
      return { penyatu: false, dobel: 0, lencana: 0 };
    }
    sisipkanGaya(d);
    if (d.documentElement.getAttribute(ATR_LENCANA) !== "rancangan") d.documentElement.setAttribute(ATR_LENCANA, "rancangan");
    const dobel = pasangDobel(d);
    let penyatu = false;
    const usual = d.querySelector("#usual2");
    // Nomor hanya berganti bersama halaman: dibaca sampai sekali terbaca (pembacaannya menyisir seluruh sel).
    const nomor = usual ? nomorKotak || nomorHalaman(d) : "";
    let kotak = d.querySelector('.aleta-m2-kotak[data-m2="penyatu"]');
    if (!penyatuNyala || !usual) {
      if (kotak) kotak.remove();
      nomorKotak = "";
    } else {
      if (!kotak) {
        kotak = buatKotak();
        usual.parentNode.insertBefore(kotak, usual);
      }
      penyatu = true;
      if (nomor && nomor !== nomorKotak) {
        nomorKotak = nomor;
        hasilKotak = null;
        kotak.removeAttribute("data-m2-dipilih");
        gambarKotak(kotak, null, nomor, {}, d);
        void segarkan(false);
      } else if (!nomor && !nomorKotak) {
        gambarKotak(kotak, { ok: false, pesan: "Nomor perkara belum terbaca (tunggu tab Data Umum termuat)." }, "", {}, d);
      }
    }
    const lencana = hasilKotak ? pasangLencanaJadwal(d, hasilKotak) : 0;
    return { penyatu, dobel, lencana };
  }

  let jeda = null;
  function jadwalkan() {
    if (jeda) return;
    jeda = setTimeout(() => {
      jeda = null;
      try {
        pasang(document);
      } catch {
        /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
      }
    }, 300);
  }
  function dariAletaSaja(m) {
    if (milikAleta(m.target) && !(m.target && m.target.closest && m.target.closest(`#${ID_PANEL}`))) return true;
    const n = [...Array.from(m.addedNodes || []), ...Array.from(m.removedNodes || [])];
    return n.length > 0 && n.every((x) => x.nodeType === 1 && x.classList && x.classList.contains("aleta-m2"));
  }

  async function mulai() {
    try {
      const s = await bacaPenyimpanan(["aktif", SAKLAR_PENYATU, SAKLAR_DOBEL]);
      nyala = s.aktif !== false;
      penyatuNyala = s[SAKLAR_PENYATU] !== false;
      tampilDobel = s[SAKLAR_DOBEL] === true;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah) return;
          if (ubah.aktif) nyala = ubah.aktif.newValue !== false;
          if (ubah[SAKLAR_PENYATU]) penyatuNyala = ubah[SAKLAR_PENYATU].newValue !== false;
          if (ubah[SAKLAR_DOBEL]) tampilDobel = ubah[SAKLAR_DOBEL].newValue === true;
          if (ubah.aktif || ubah[SAKLAR_PENYATU] || ubah[SAKLAR_DOBEL] || ubah.ujiTampilan) jadwalkan();
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (/\/aps_badilag\//i.test(String(location.pathname || "")) || !document.body) return;
      // Tampilan yang berganti tanpa kunci ujiTampilan (mis. tampilan dari server) juga diikuti.
      document.addEventListener("aleta-uji-berubah", () => jadwalkan());
      new MutationObserver((daftar) => {
        if (daftar.every(dariAletaSaja)) return;
        jadwalkan();
      }).observe(document.body, { childList: true, subtree: true });
      jadwalkan();
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  const api = {
    versi: "tahap-M2",
    pasang,
    bersihkan,
    segarkan,
    DOBEL,
    SAKLAR_PENYATU,
    SAKLAR_DOBEL,
    murni: { aturanDobel, tanggalSelSipp, tanggalAwam, nomorHalaman, ringkasKepala, cetakDerry, muatPenyatu },
    /** Untuk uji: setel saklar tanpa chrome.storage. */
    _setel(o) {
      if ("nyala" in o) nyala = o.nyala;
      if ("penyatu" in o) penyatuNyala = o.penyatu;
      if ("tampilDobel" in o) tampilDobel = o.tampilDobel;
      singgah.clear();
    },
  };
  globalThis.aletaSippIdeM2 = api;
  void mulai();
})();
