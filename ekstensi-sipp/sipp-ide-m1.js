"use strict";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 2, JENDELA-JENDELA SIPP LAINNYA (TAHAP M1)
 * ============================================================================
 *
 * Skrip konten TERSENDIRI, dimuat sesudah sipp-ide-l1.js di halaman SIPP.
 * Memperluas pola gelombang 1 (pita "Isi dengan ALETA", penghitung kolom
 * kosong, pengenal jendela lewat alamat simpan) ke jendela SIPP 7.0.4 yang
 * belum dibantu: Rekonvensi, Putusan Sela, Relaas (daftar pelaksanaan + isi
 * pelaksanaan), Edit/Tunda Jadwal Sidang, Saksi (pilihan "Saksi Putusan" baru
 * di 7.0.4), Tambah Biaya Jurnal, dan Arsip. Rancangan: sipp-dengan-ide.html
 * v3 (I06-I11, I13, I15, W92, W93) dan peta K-PETA-SIPP.md.
 *
 * DIPAKAI ULANG, TIDAK DIGANDAKAN: penghitung kolom (hitungKolom/
 * kalimatHitung), pemeriksa tampak (.hide() SIPP), dan pembaca nomor perkara
 * halaman detil diambil dari globalThis.aletaSippIdeL1.murni. Tanpa L1 pita
 * tetap jalan, hanya penghitungnya diam.
 *
 * SUMBER USULAN - mesin dan data yang SUDAH ada, tidak ada aturan isi baru:
 *   Tunda/Edit    usulanTundaSidang portal (sama dengan Jadwal Sidang & Hasil
 *                 Sidang ALETA) + kehadiran antrian sidang + Court Calendar,
 *                 lewat GET /aleta/api/aleta-ecourt/sipp-ide/jendela
 *   Relaas        kepatutan panggilan tiap pihak (kesiapan sidang bot) dan
 *                 e-Summons yang tercatat
 *   Putusan Sela  jadwal sidang perkara (agenda putusan sela) - tanggal saja,
 *                 amar tetap lewat "Pilih amar" SIPP
 *   Rekonvensi    dokumen jawaban e-Court di arsip ALETA + susunan bersilang
 *                 yang sudah digambar SIPP sendiri
 *   Saksi         jadwal sidang (ada acara putusan sela atau tidak)
 *   Jurnal        usulan Kasir yang sudah ada (GET .../sidang/kasir) - aturan
 *                 Kasir tidak diubah, hanya dipindahkan ke jendela Tambah Biaya
 *   Arsip         rincian putusan (BHT/minutasi) dan Panitera Pengganti
 *
 * ISIAN "PASTI" diisikan ke kolom yang MASIH KOSONG saat petugas menekan "Isi
 * dengan ALETA"; yang ragu, yang berbeda dari isian petugas, dan yang hari
 * libur hanya ditawarkan (tombol Pakai). Simpan SIPP tetap ditekan petugas -
 * berkas ini tidak pernah menekan Simpan, tidak menulis ke SIPP lewat jalan
 * lain, dan tidak memasukkan tanda ALETA ke isian SIPP. Satu-satunya
 * penjagaan saat Simpan: jendela Saksi dengan "Saksi Putusan" masih "- Pilih
 * Salah Satu -" (SIPP menyimpannya NULL = dihitung saksi akhir) ditanyakan
 * dulu.
 *
 * Semua sisipan berkelas aleta-sisip (diabaikan pengamat konten.js dan alat
 * rekam), tombol di dalam form type="button" tanpa name. Tampilan Lama tidak
 * berubah sama sekali (alatUjiMode() === "lama"); permintaan jaringan hanya
 * terjadi saat petugas menekan tombol ALETA.
 */
(function sippIdeM1Modul() {
  if (typeof globalThis === "undefined" || globalThis.aletaSippIdeM1) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const KELAS = "aleta-sisip aleta-m1";
  const ID_GAYA = "aleta-m1-gaya";
  const ID_PANEL = "aleta-panel-sipp";
  const API_JENDELA = "/aleta/api/aleta-ecourt/sipp-ide/jendela";
  const API_KASIR = "/aleta/api/aleta-ecourt/sidang/kasir";
  const SINGGAH_MS = 30000;
  const BUKAN_SIPP = `.aleta-sisip, #${ID_PANEL}, [data-aleta-tanda], .aleta-panel`;
  const POLA_NOMOR = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;
  const POLA_NOMOR_PENUH = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}$/;
  /** Sandi dihadiri_oleh SIPP (jadwal_sidang_p_edit.php) - lihat sandi-kehadiran-sidang-sipp. */
  const KEHADIRAN = { 1: "Semua Pihak", 2: "Pihak pertama saja", 3: "Pihak kedua saja", 4: "Para Pihak Tidak Hadir", 7: "Pihak pertama dan Intervensi", 8: "Pihak kedua dan Intervensi", 9: "Pihak pertama dan kedua", 14: "Pihak pertama dan Turut Tergugat", 15: "Pihak kedua dan Turut Tergugat" };
  // Sebutan pilihan dropdown SIPP sendiri (nilai yang diusulkan ke borang) - BUKAN
  // hasil panggilan. Hasilnya (bertemu orang serumah, melalui kepala desa, retur
  // beserta sebabnya) dibaca dari rute jendela: kepatutan per relaas menurut
  // SEMA 1/2023 dan Pasal 718 RBg (aturan bersama portal/bot, W63 22 Okt).
  const CARA_RELAAS = { E: "Panggilan Elektronik", S: "Surat Tercatat POS", Y: "Bertemu", T: "Tidak Bertemu" };
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const BULAN_TEKS = {
    jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
    mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, ags: 8, agt: 8, agustus: 8, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
  };
  /** Batas penyelesaian perkara tingkat pertama: 5 bulan (SEMA 2/2014). */
  const BATAS_BULAN = 5;

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const aksiForm = (f) => String((f && f.getAttribute && f.getAttribute("action")) || "");
  const l1 = () => (globalThis.aletaSippIdeL1 && globalThis.aletaSippIdeL1.murni) || null;
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, judul, kelas) {
    const b = el("button", `aleta-m1-tombol${kelas ? ` ${kelas}` : ""}`, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  /** Lencana bulat berwarna dengan ⓘ (arti singkat di kursor) - seperti rancangan. */
  function lencana(teks, nada, arti) {
    const s = el("span", `aleta-m1-tanda aleta-m1-tanda-${nada || "abu"}`, teks);
    const i = el("i", "aleta-m1-i");
    if (arti) {
      i.title = arti;
      s.title = arti;
    }
    s.appendChild(i);
    return s;
  }
  const milikAleta = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(BUKAN_SIPP));
  /** Teks hanya ditulis bila berbeda - simpul teks baru dibaca konten.js sebagai perubahan SIPP (lihat sipp-ide-l1.js setelTeks). */
  function setelTeks(e, teks) {
    const t = String(teks == null ? "" : teks);
    if (e && e.textContent !== t) e.textContent = t;
  }
  function tampak(e) {
    const m = l1();
    if (m && typeof m.tampak === "function") return m.tampak(e);
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) if (n.hidden || (n.style && n.style.display === "none")) return false;
    return Boolean(e);
  }
  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tanggal
  // ──────────────────────────────────────────────────────────────────────────
  const dua = (n) => String(n).padStart(2, "0");
  function isoSah(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  /** "dd/mm/yyyy", "yyyy-mm-dd", "Senin, 05 Okt. 2026", "5 Oktober 2026" -> "yyyy-mm-dd" ("" bila tidak terbaca). */
  function isoDariTeks(teks) {
    const t = sebaris(teks);
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m && isoSah(`${m[1]}-${m[2]}-${m[3]}`)) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (m) {
      const iso = `${m[3]}-${dua(m[2])}-${dua(m[1])}`;
      return isoSah(iso) ? iso : "";
    }
    m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
    if (m) {
      const b = BULAN_TEKS[m[2].toLowerCase()];
      const iso = b ? `${m[3]}-${dua(b)}-${dua(m[1])}` : "";
      return isoSah(iso) ? iso : "";
    }
    return "";
  }
  /** "yyyy-mm-dd" -> "dd/mm/yyyy" (bentuk isian tanggal SIPP). */
  const keInput = (iso) => (isoSah(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  function hariKe(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function teksTanggal(iso) {
    if (!isoSah(iso)) return "-";
    return `${NAMA_HARI[hariKe(iso)]}, ${Number(iso.slice(8, 10))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  }
  function tambahHari(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  /** Tambah bulan kalender; tanggal 31 -> akhir bulan tujuan. */
  function tambahBulan(iso, n) {
    if (!isoSah(iso)) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const akhir = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + n, Math.min(d, akhir))).toISOString().slice(0, 10);
  }
  function isoHariIni() {
    const n = new Date();
    return `${n.getFullYear()}-${dua(n.getMonth() + 1)}-${dua(n.getDate())}`;
  }
  /** Sebab tanggal ini bukan hari sidang ("" = hari kerja). Libur nasional dari konten.js (ccBukanHariKerja) bila termuat. */
  function bukanHariKerja(iso) {
    if (!isoSah(iso)) return "";
    try {
      if (typeof ccBukanHariKerja === "function") return String(ccBukanHariKerja(iso) || "");
    } catch {
      /* jatuh ke Sabtu/Minggu */
    }
    const h = hariKe(iso);
    return h === 0 ? "hari Minggu" : h === 6 ? "hari Sabtu" : "";
  }
  /** Hari kerja di ANTARA dua tanggal (keduanya tidak dihitung). */
  function hariKerjaAntara(dari, sampai) {
    if (!isoSah(dari) || !isoSah(sampai) || dari >= sampai) return 0;
    let n = 0;
    for (let t = tambahHari(dari, 1), i = 0; t < sampai && i < 400; t = tambahHari(t, 1), i += 1) if (!bukanHariKerja(t)) n += 1;
    return n;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Membaca halaman SIPP
  // ──────────────────────────────────────────────────────────────────────────
  /** Wadah jendela (popup SIPP) tempat form berada - #form_pop, #form_pop_2nd, ... atau dokumen. */
  const wadahJendela = (n) => (n && n.closest && n.closest('[id^="form_pop"], [id^="popup_form"]')) || null;

  /** Nilai sel sesudah label (td label -> td isi), dicari di `akar`. */
  function nilaiLabel(akar, pola) {
    if (!akar) return "";
    for (const sel of Array.from(akar.querySelectorAll("td, th"))) {
      if (milikAleta(sel) || !pola.test(sebaris(sel.textContent))) continue;
      let isi = sel.nextElementSibling;
      if (isi && /^:?$/.test(sebaris(isi.textContent))) isi = isi.nextElementSibling || isi;
      if (isi) return sebaris(isi.textContent);
    }
    return "";
  }

  /** Nomor perkara jendela: kepala jendela, lalu halaman perkara (L1), lalu konteks panel. */
  function nomorJendela(form) {
    const wadah = wadahJendela(form);
    const dekat = nilaiLabel(wadah, /^nomor\s+perkara$/i);
    const m = POLA_NOMOR.exec(dekat);
    if (m) return m[1];
    const L = l1();
    if (L && typeof L.nomorHalamanDetil === "function") {
      const n = L.nomorHalamanDetil(form.ownerDocument);
      if (n) return n;
    }
    try {
      if (typeof konteksTerakhir !== "undefined" && konteksTerakhir && POLA_NOMOR_PENUH.test(String(konteksTerakhir.nomorPerkara || ""))) {
        return String(konteksTerakhir.nomorPerkara);
      }
    } catch {
      /* konten.js belum siap */
    }
    return "";
  }

  /** Tanggal pendaftaran perkara (yyyy-mm-dd) dari halaman: isian tersembunyi, tab Data Umum, kepala jendela, atau penanda panel. */
  function tanggalDaftar(doc, form) {
    const d = doc || document;
    for (const sel of ["#tglPendaftaran", "#tanggal_pendaftaran"]) {
      const e = (form && form.querySelector(sel)) || d.querySelector(sel);
      const iso = e ? isoDariTeks(e.value) : "";
      if (iso) return iso;
    }
    const iso = isoDariTeks(nilaiLabel(wadahJendela(form), /^tanggal\s+pendaftaran$/i)) || isoDariTeks(nilaiLabel(d, /^tanggal\s+pendaftaran$/i));
    if (iso) return iso;
    try {
      const t = typeof konteksTerakhir !== "undefined" && konteksTerakhir && konteksTerakhir.penandaLain && konteksTerakhir.penandaLain.berjalanLama;
      return t ? isoDariTeks(t.tanggalDaftar) : "";
    } catch {
      return "";
    }
  }

  const medan = (form, nama) => form.querySelector(`[name="${nama}"]`);
  function nilaiMedan(e) {
    if (!e) return "";
    if (e.tagName === "SELECT") return String(e.value == null ? "" : e.value);
    return String(e.value == null ? "" : e.value).trim();
  }
  function teksPilihan(e) {
    if (!e || e.tagName !== "SELECT" || e.selectedIndex < 0) return "";
    return sebaris(e.options[e.selectedIndex].textContent);
  }
  function kosong(e) {
    if (!e) return true;
    if (e.tagName === "SELECT") {
      const v = String(e.value == null ? "" : e.value).trim();
      if (v === "" || v === "-1") return true;
      return /^\s*(?:-+\s*)?pilih\b/i.test(teksPilihan(e));
    }
    return sebaris(e.value) === "";
  }
  /** Kalimat penolakan penjaga batas terakhir (isian yang memuat kata ALETA) - ditampilkan pada kabar. */
  let ditahanPenjaga = "";
  /** Mengisi satu kolom SIPP seperti petugas: nilai lalu peristiwa input+change (penangan jQuery SIPP ikut berjalan). */
  function setel(e, nilai) {
    if (!e) return false;
    const v = String(nilai == null ? "" : nilai);
    // 17 Okt 2026 (penjaga batas): tidak ada kata ALETA yang diisikan ke kolom SIPP;
    // nama pihak "Aleta" dari halaman SIPP itu sendiri tidak dihitung.
    if (typeof AletaPenjagaTanda !== "undefined" && e.tagName !== "SELECT" && e.type !== "checkbox" && e.type !== "radio") {
      const tahan = AletaPenjagaTanda.periksaTeks(v, e.name || e.id || "kolom ini");
      if (!tahan.ok) {
        ditahanPenjaga = tahan.pesan;
        return false;
      }
    }
    if (e.tagName === "SELECT") {
      if (!Array.from(e.options).some((o) => o.value === v)) return false;
      e.value = v;
    } else if (e.type === "checkbox" || e.type === "radio") {
      if (!e.checked) e.click();
      return true;
    } else e.value = v;
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  const kunciNama = (t) =>
    sebaris(t)
      .toLowerCase()
      .replace(/\b(bin|binti|als|alias)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  function cocokNama(a, b) {
    const x = kunciNama(a);
    const y = kunciNama(b);
    if (!x || !y) return false;
    return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Data ALETA (hanya saat tombol ditekan; disinggahkan 30 detik)
  // ──────────────────────────────────────────────────────────────────────────
  const singgahan = new Map();
  async function ambilJson(alamat) {
    const opsi = { credentials: "include", cache: "no-store" };
    const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, "SIPP dengan Ide ALETA") : await fetch(alamat, opsi);
    if (r.status === 401 || r.status === 403) {
      return { ok: false, alasan: r.status === 401 ? "Masuk ke ALETA dulu (portal) supaya usulan dapat dibaca." : "Akun ALETA ini tidak berwenang membaca usulan jendela ini." };
    }
    const luar = await r.json().catch(() => ({}));
    const isi = luar && luar.data ? luar.data : luar;
    // Pesan galat portal (bisa memuat kode/jalur) tidak ditampilkan apa adanya.
    if (!r.ok) return { ok: false, alasan: "Portal ALETA belum dapat menjawab. Coba lagi sebentar lagi; bila tetap begini, beri tahu admin ALETA." };
    if (!isi || isi.available === false || isi.ok === false) return { ok: false, alasan: String((isi && (isi.alasan || isi.message)) || "ALETA belum dapat membaca data perkara ini.") };
    return { ok: true, data: isi };
  }
  async function singgah(kunci, buat) {
    const lama = singgahan.get(kunci);
    if (lama && Date.now() - lama.saat < SINGGAH_MS) return lama.janji;
    const janji = buat();
    singgahan.set(kunci, { saat: Date.now(), janji });
    janji.then((h) => (!h || !h.ok) && singgahan.delete(kunci)).catch(() => singgahan.delete(kunci));
    return janji;
  }
  function ambilJendela(jendela, nomor, tanggal) {
    if (!POLA_NOMOR_PENUH.test(String(nomor || ""))) return Promise.resolve({ ok: false, alasan: "Nomor perkara belum terbaca di halaman ini." });
    const q = new URLSearchParams({ jendela, nomor });
    if (isoSah(tanggal)) q.set("tanggal", tanggal);
    return singgah(`j|${q.toString()}`, () => ambilJson(`${API_JENDELA}?${q.toString()}`));
  }
  function ambilKasir(nomor) {
    if (!POLA_NOMOR_PENUH.test(String(nomor || ""))) return Promise.resolve({ ok: false, alasan: "Nomor perkara belum terbaca di jendela ini." });
    return singgah(`k|${nomor}`, async () => {
      const cari = await ambilJson(`${API_KASIR}?cari=${encodeURIComponent(nomor)}`);
      if (!cari.ok) return cari;
      const daftar = Array.isArray(cari.data.perkara) ? cari.data.perkara : [];
      const satu = daftar.find((x) => String(x.nomorPerkara || x.nomor || "") === nomor) || (daftar.length === 1 ? daftar[0] : null);
      const id = satu ? String(satu.perkaraId || satu.id || "") : "";
      if (!/^\d+$/.test(id)) return { ok: false, alasan: "Perkara ini tidak ditemukan di Kasir ALETA." };
      return ambilJson(`${API_KASIR}?perkaraId=${encodeURIComponent(id)}`);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Usulan per jendela (MURNI: data ALETA + form -> daftar usulan)
  //
  // Satu usulan: { kunci, label, nama (name kolom SIPP) | terap(form), nilai,
  //   tampil, pasti, sumber, catatan, kosong(form) }
  // ──────────────────────────────────────────────────────────────────────────
  const kalimatKehadiran = (n) => KEHADIRAN[n] || "pilihan lain";

  /**
   * F3.2 (17 Okt 2026): usulan "Dihadiri oleh" - kehadiran RINCI per orang
   * (siapa, jam datang, pribadi/kuasa; disusun portal) lebih dulu, lalu kolom
   * antrian sidang. Hanya 1-3 yang ditawarkan, sama seperti sebelumnya; sandi
   * SIPP yang lebih rinci (14, 9, 10 ...) hanya disebut di catatan.
   */
  function usulanHadir(t, form, nama, label) {
    const r = t && t.kehadiranRinci;
    const dariRinci = r ? Number(r.sandi) : NaN;
    const hadir = dariRinci >= 1 && dariRinci <= 3 ? dariRinci : Number(t && t.kehadiranAntrian);
    if (!(hadir >= 1 && hadir <= 3) || !medan(form, nama)) return null;
    // "Tercatat di antrian ALETA" hanya bila memang ada orang yang tercatat rinci.
    const pakaiRinci = dariRinci === hadir && Array.isArray(r.orang) && r.orang.length > 0;
    return {
      kunci: "hadir",
      label,
      nama,
      nilai: String(hadir),
      tampil: kalimatKehadiran(hadir),
      // Kolom ini selalu bernilai (SIPP memilih baris pertama) - tidak pernah "kosong", jadi hanya ditawarkan.
      pasti: false,
      sumber: pakaiRinci ? `kehadiran tercatat di antrian ALETA - ${sebaris(r.alasan)}` : "antrian sidang (nomor antrian yang diambil para pihak)",
      catatan: r
        ? [sebaris(r.ringkas), r.sandiRinci ? `pilihan SIPP lebih rinci: ${sebaris(r.labelRinci)}` : ""].filter(Boolean).join("; ")
        : "",
    };
  }

  /** Tunda (#frm_tunda_jadwal_sidang). */
  function usulanTunda(data, form) {
    const t = (data && data.tunda) || {};
    const u = t.usulan;
    const daftar = [];
    if (u) {
      daftar.push({ kunci: "alasan", label: "Alasan Penundaan", nama: "alasan_tunda", nilai: u.alasan, tampil: u.alasan, pasti: Boolean(u.alasan), sumber: u.penjelasan || "riwayat sidang perkara" });
      daftar.push({ kunci: "agenda", label: "Agenda sidang berikutnya", nama: "agenda", nilai: u.agenda, tampil: u.agenda, pasti: Boolean(u.agenda), sumber: u.penjelasan || "riwayat sidang perkara" });
      const cek = t.cek || {};
      const bentrok = Boolean(cek.bentrokPerkara);
      const pasti = Boolean(u.tanggalPasti) && !bentrok;
      daftar.push({
        kunci: "tanggal",
        label: "Tanggal sidang berikutnya",
        nama: "tgl_sidang",
        nilai: keInput(u.tanggal),
        tampil: teksTanggal(u.tanggal),
        pasti,
        sumber: u.penjelasanTanggal || "aturan tunda ALETA",
        catatan: [
          cek.libur ? `jatuh pada ${cek.libur} - hari kerja terdekat ${teksTanggal(cek.hariKerjaTerdekat)}` : "",
          bentrok ? "perkara ini sudah punya sidang lain pada tanggal itu" : "",
          Number.isFinite(cek.jumlahSidangHariItu) && cek.jumlahSidangHariItu !== null ? `${cek.jumlahSidangHariItu} sidang sudah terjadwal di pengadilan pada tanggal itu` : "",
        ]
          .filter(Boolean)
          .join("; "),
      });
      daftar.push({ kunci: "jam", label: "Jam sidang berikutnya", nama: "jammulai", nilai: u.jam, tampil: u.jam, pasti: /^\d{2}:\d{2}$/.test(String(u.jam || "")), sumber: "jam menurut agenda (aturan tunda ALETA)" });
    }
    const hadir = usulanHadir(t, form, "dihadiri_olehsblm", "Dihadiri oleh (sidang ini)");
    if (hadir) daftar.push(hadir);
    return daftar;
  }

  /** Edit Jadwal (#frm_edit_jadwal_sidang): kehadiran menurut antrian sidang. */
  function usulanEdit(data, form) {
    const t = (data && data.tunda) || {};
    const daftar = [];
    const hadir = usulanHadir(t, form, "dihadiri_oleh", "Dihadiri Oleh");
    if (hadir) daftar.push(hadir);
    const s = data && data.sidang;
    if (s && s.agenda && medan(form, "agenda")) {
      daftar.push({ kunci: "agenda", label: "Agenda", nama: "agenda", nilai: s.agenda, tampil: s.agenda, pasti: true, sumber: "jadwal sidang perkara di SIPP" });
    }
    return daftar;
  }

  /**
   * Pihak (tgl_pihakN: 1 pihak pertama, 2 pihak kedua) yang hadir menurut sandi
   * dihadiri_oleh SIPP: 1 semua, 2 pertama saja, 3 kedua saja, 7 P+Intervensi,
   * 8 T+Intervensi, 9 P+T, 14 P+Turut, 15 T+Turut.
   */
  const HADIR_SELA = { 1: [1, 2], 2: [1], 3: [2], 7: [1], 8: [2], 9: [1, 2], 14: [1], 15: [2] };

  /** Sidang yang berbunyi putusan sela (agenda atau alasan tunda). */
  const sidangSela = (jadwal) => (Array.isArray(jadwal) ? jadwal : []).filter((s) => /putusan\s+sela/i.test(`${s.agenda || ""} ${s.alasan || ""}`));

  /**
   * Putusan Sela (#frm_sela): tanggal dari jadwal. Pemberitahuan untuk pihak
   * yang HADIR saat dibacakan (kehadiran sidang itu) = tanggal putusan sela -
   * keputusan pengguna 16 Okt malam: isian PASTI (diisi bila kolomnya kosong).
   * Pihak yang tidak hadir, Intervensi, dan Turut Tergugat dibiarkan kosong
   * (diisi dari relaas pemberitahuannya). "Sebagian" (10/11) tidak diisi.
   * Keputusan 17 Okt butir 58: berlaku untuk SEMUA perkara - e-Court maupun
   * bukan. Pihak yang hadir mendengar putusan sela dibacakan di ruang sidang,
   * jadi tanggal bacanya juga tanggal pemberitahuannya; jalur pendaftaran
   * tidak ikut menentukan (sengaja tidak membaca lewatEcourt).
   */
  function usulanSela(data, form) {
    const calon = sidangSela(data && data.jadwal).filter((s) => /putusan\s+sela/i.test(s.agenda || ""));
    if (!calon.length) return [];
    const s = calon[calon.length - 1];
    const hadir = Number(s.dihadiriOleh);
    const pihakHadir = HADIR_SELA[hadir] || [];
    const pemberitahuan = pihakHadir
      .filter((i) => medan(form, `tgl_pihak${i}`))
      .map((i) => ({
        kunci: `tgl_pihak${i}`,
        label: labelSebelum(medan(form, `tgl_pihak${i}`)) || `Pemberitahuan kepada pihak ${i}`,
        nama: `tgl_pihak${i}`,
        nilai: keInput(s.tanggal),
        tampil: teksTanggal(s.tanggal),
        pasti: true,
        sumber: `hadir saat putusan sela dibacakan (${kalimatKehadiran(hadir)})`,
      }));
    return [
      {
        kunci: "tgl_sela",
        label: "Tanggal Putusan Sela",
        nama: "tgl_sela",
        nilai: keInput(s.tanggal),
        tampil: teksTanggal(s.tanggal),
        // SIPP mengisi kolom ini dengan HARI INI pada jendela baru - tidak pernah kosong; ditawarkan saja.
        pasti: false,
        sumber: `jadwal sidang: agenda "${sebaris(s.agenda)}"`,
        catatan: calon.length > 1 ? `${calon.length} sidang berbunyi putusan sela - dipilih yang terakhir` : "",
      },
      ...pemberitahuan,
    ];
  }

  /** Rekonvensi (#frm_rekonvensi): tanggal pendaftaran + pihak bersilang (hanya bila satu-satunya). */
  function usulanRekonvensi(data, form) {
    const daftar = [];
    const jawaban = Array.isArray(data && data.jawabanEcourt) ? data.jawabanEcourt : [];
    const rek = jawaban.find((d) => d.rekonvensi && (d.tanggalSidang || d.diunggahPada));
    const jwb = jawaban.find((d) => d.tanggalSidang || d.diunggahPada);
    const jadwal = Array.isArray(data && data.jadwal) ? data.jadwal : [];
    // Agenda yang menyebut jawaban DAN rekonvensi lebih dulu, lalu jawaban pertama.
    const sidangJawaban = jadwal.find((s) => /jawaban/i.test(s.agenda || "") && /rekonvensi/i.test(s.agenda || "")) || jadwal.find((s) => /jawaban/i.test(s.agenda || ""));
    const pilih = rek || jwb;
    if (pilih) {
      const iso = pilih.tanggalSidang || pilih.diunggahPada;
      daftar.push({
        kunci: "tgl",
        label: "Tanggal Pendaftaran Rekonvensi",
        nama: "tgl_pendaftaran",
        nilai: keInput(iso),
        tampil: teksTanggal(iso),
        pasti: Boolean(rek),
        sumber: `e-Court: ${pilih.judul}${pilih.tanggalSidang ? " (sidang)" : " (diunggah)"}`,
        catatan: rek ? "" : "dokumennya jawaban - pastikan memuat gugatan rekonvensi",
      });
    } else if (sidangJawaban) {
      daftar.push({ kunci: "tgl", label: "Tanggal Pendaftaran Rekonvensi", nama: "tgl_pendaftaran", nilai: keInput(sidangJawaban.tanggal), tampil: teksTanggal(sidangJawaban.tanggal), pasti: false, sumber: `jadwal sidang: agenda "${sebaris(sidangJawaban.agenda)}"`, catatan: "tanggal sidang jawaban - pastikan rekonvensi diajukan di sidang itu" });
    }
    for (const [nama, label] of [
      ["para_pihak2[]", "Penggugat Rekonvensi (Tergugat konvensi)"],
      ["para_pihak1[]", "Tergugat Rekonvensi (Penggugat konvensi)"],
    ]) {
      const kotak = Array.from(form.querySelectorAll(`input[type="checkbox"][name="${nama}"]`)).filter((c) => !/_4$/.test(c.value));
      if (kotak.length !== 1) continue;
      const c = kotak[0];
      const namaPihak = sebaris(c.nextSibling && c.nextSibling.nodeType === 3 ? c.nextSibling.nodeValue : c.parentElement && c.parentElement.textContent);
      daftar.push({
        kunci: nama,
        label,
        terap: () => setel(c, true),
        sama: () => c.checked,
        kosongkah: () => !Array.from(form.querySelectorAll(`input[type="checkbox"][name="${nama}"]`)).some((x) => x.checked),
        tampil: `dicentang: ${namaPihak || "satu-satunya pihak"}`,
        pasti: true,
        sumber: "susunan bersilang SIPP (satu-satunya pihak di sisi itu)",
      });
    }
    return daftar;
  }

  /**
   * Saksi (#frm_user): "Saksi Putusan". Tanpa acara putusan sela -> Akhir
   * (pasti). Ada acara putusan sela: sudah dibacakan -> Akhir, belum -> Sela;
   * keduanya hanya ditawarkan, karena saksi bisa saja diinput belakangan.
   */
  function usulanSaksi(data, form, konteks) {
    const jadwal = Array.isArray(data && data.jadwal) ? data.jadwal : null;
    if (!jadwal) return [];
    const sela = sidangSela(jadwal).filter((s) => /putusan\s+sela/i.test(s.agenda || ""));
    if (!sela.length) {
      return [{ kunci: "is_sela", label: "Saksi Putusan", nama: "is_sela", nilai: "0", tampil: "Akhir", pasti: true, sumber: `tidak ada acara putusan sela di ${jadwal.length} sidang perkara ini` }];
    }
    const hariIni = (konteks && konteks.hariIni) || isoHariIni();
    const s = sela[sela.length - 1];
    const sudah = s.tanggal < hariIni;
    return [
      {
        kunci: "is_sela",
        label: "Saksi Putusan",
        nama: "is_sela",
        nilai: sudah ? "0" : "1",
        tampil: sudah ? "Akhir" : "Sela",
        pasti: false,
        sumber: `putusan sela ${sudah ? "sudah dibacakan" : "dijadwalkan"} ${teksTanggal(s.tanggal)}`,
        catatan: sudah ? "saksi yang diperiksa SEBELUM putusan sela dibacakan: pilih Sela" : "pilih Akhir bila saksi ini untuk pokok perkara",
      },
    ];
  }

  /** Arsip (#frm_add_arsip): Panitera Pengganti penyerah + tanggal BHT/minutasi. */
  function usulanArsip(data) {
    const daftar = [];
    const pp = Array.isArray(data && data.panitera) ? data.panitera.filter((p) => p && p.nama) : [];
    if (pp.length) {
      daftar.push({ kunci: "penyerah", label: "Staff yang Menyerahkan Berkas", nama: "nama_penyerah", nilai: pp[pp.length - 1].nama, tampil: pp[pp.length - 1].nama, pasti: pp.length === 1, sumber: "Panitera Pengganti perkara (PPP SIPP)", catatan: pp.length > 1 ? `${pp.length} PP tercatat - dipakai yang terakhir` : "" });
    }
    const pt = (data && data.putusan) || {};
    const iso = isoSah(pt.tanggalBht) ? pt.tanggalBht : isoSah(pt.tanggalMinutasi) ? pt.tanggalMinutasi : "";
    if (iso) {
      daftar.push({ kunci: "tgl_masuk", label: "Tanggal Masuk", nama: "tgl_masuk_berkas", nilai: keInput(iso), tampil: teksTanggal(iso), pasti: false, sumber: isoSah(pt.tanggalBht) ? "tanggal BHT" : "tanggal minutasi", catatan: "tanggal berkas diserahkan ke arsip bisa lebih lambat - periksa" });
    }
    return daftar;
  }

  /** Isi/Edit Pelaksanaan Relaas (#frm_relaas): e-Summons yang tercatat. */
  function usulanRelaasEdit(data, form, konteks) {
    const p = pihakRelaas(data, konteks && konteks.pihak);
    if (!p) return [];
    const daftar = [];
    if (p.seharusnya === "elektronik" && p.eSummonsTerkirim === true) {
      daftar.push({ kunci: "bertemu", label: "Bertemu/tidak", nama: "bertemu", nilai: "E", tampil: CARA_RELAAS.E, pasti: true, sumber: "e-Summons tercatat di e-Court untuk sidang ini" });
      if (isoSah(p.tanggalPanggilan)) {
        daftar.push({ kunci: "tgl_relaas", label: "Tanggal Pelaksanaan Relaas", nama: "tgl_relaas", nilai: keInput(p.tanggalPanggilan), tampil: teksTanggal(p.tanggalPanggilan), pasti: true, sumber: "tanggal e-Summons" });
      }
    } else if (p.seharusnya === "surat_tercatat") {
      daftar.push({ kunci: "bertemu", label: "Bertemu/tidak", nama: "bertemu", nilai: "S", tampil: CARA_RELAAS.S, pasti: false, sumber: "saluran seharusnya menurut ALETA: surat tercatat" });
    }
    return daftar;
  }
  function pihakRelaas(data, nama) {
    const daftar = Array.isArray(data && data.panggilan) ? data.panggilan : [];
    return daftar.find((p) => cocokNama(p.nama, nama)) || null;
  }

  /** Tambah Biaya (#frm_add_biaya): usulan Kasir yang masih terbuka. */
  function usulanKasir(data, form) {
    const usulan = (Array.isArray(data && data.usulan) ? data.usulan : []).filter(
      (u) => u && u.pilih !== false && u.hasil !== "tersimpan" && Number(u.jumlah) > 0 && Number(u.jenisBiayaId) > 0
    );
    const baru = !String(nilaiMedan(medan(form, "idbiayaperkara")) || "").trim() && kosong(medan(form, "jenis_biaya"));
    let pastiDipakai = false;
    return usulan.map((u) => {
      const pasti = baru && !pastiDipakai && String(u.yakin || "tinggi") === "tinggi";
      if (pasti) pastiDipakai = true;
      return {
        kunci: `kasir-${u.kunci || u.jenisBiayaId}`,
        label: u.peristiwa || "Transaksi",
        terap: () => terapKasir(form, u),
        sama: () =>
          nilaiMedan(medan(form, "jenis_biaya")) === String(u.jenisBiayaId) &&
          angka(nilaiMedan(medan(form, "jumlah"))) === Number(u.jumlah) &&
          isoDariTeks(nilaiMedan(medan(form, "tgl_transaksi"))) === String(u.tanggal || ""),
        kosongkah: () => baru,
        tampil: `${teksTanggal(u.tanggal)} · ${sebaris(u.uraian)} · Rp${Number(u.jumlah).toLocaleString("id-ID")}`,
        pasti,
        sumber: `Kasir ALETA${u.dasar ? ` - ${u.dasar}` : ""}`,
        catatan: String(u.yakin || "tinggi") === "tinggi" ? "" : `keyakinan Kasir: ${u.yakin}`,
      };
    });
  }
  const angka = (t) => Number(String(t || "").replace(/[^\d]/g, "")) || 0;
  /** Satu transaksi Kasir ke borang Tambah Biaya, urut seperti petugas (pihak -> pembayar -> kategori -> jenis -> uraian/jumlah). */
  function terapKasir(form, u) {
    const kePihak = medan(form, "fpihak_ke");
    if (kePihak && !kePihak.disabled && u.pihakKe) setel(kePihak, String(u.pihakKe));
    const pembayar = medan(form, "pihak_pembayar");
    if (pembayar && u.pihakId) setel(pembayar, String(u.pihakId));
    const jenis = medan(form, "jenis_biaya");
    const opsiJenis = jenis ? Array.from(jenis.options).find((o) => o.value === String(u.jenisBiayaId)) : null;
    if (!opsiJenis) return false;
    const kategori = medan(form, "kategori_biaya");
    const kat = String(u.kategoriId || opsiJenis.id || "");
    if (kategori && kat) setel(kategori, kat);
    setel(jenis, String(u.jenisBiayaId));
    if (u.uraian) setel(medan(form, "uraian"), sebaris(u.uraian));
    setel(medan(form, "jumlah"), String(Math.round(Number(u.jumlah))));
    if (isoSah(u.tanggal)) setel(medan(form, "tgl_transaksi"), keInput(u.tanggal));
    const js = medan(form, "jurusita");
    if (js && Number(u.jurusitaId) > 0) setel(js, String(u.jurusitaId));
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemeriksaan lokal (tanpa jaringan): urutan tanggal, libur, 5 bulan, bersilang
  // ──────────────────────────────────────────────────────────────────────────
  /** Tanggal sidang berikutnya / sidang yang diedit. */
  function cekTanggalSidang(iso, o) {
    const hasil = [];
    if (!isoSah(iso)) return hasil;
    const libur = bukanHariKerja(iso);
    if (libur) hasil.push({ nada: "merah", teks: `${teksTanggal(iso)} jatuh pada ${libur}.` });
    if (isoSah(o.sebelum) && iso <= o.sebelum) hasil.push({ nada: "merah", teks: `Tidak sesudah sidang sebelumnya (${teksTanggal(o.sebelum)}).` });
    const jadwal = Array.isArray(o.jadwal) ? o.jadwal : [];
    const lain = jadwal.filter((s) => s.tanggal === iso && s.sidangId !== o.kecuali);
    if (lain.length) hasil.push({ nada: "kuning", teks: `Perkara ini sudah punya sidang pada ${teksTanggal(iso)} (${sebaris(lain[0].agenda) || "tanpa agenda"}).` });
    if (isoSah(o.daftar)) {
      const batas = tambahBulan(o.daftar, BATAS_BULAN);
      if (iso > batas) hasil.push({ nada: "kuning", teks: `Melewati ${BATAS_BULAN} bulan sejak pendaftaran (${teksTanggal(o.daftar)}; batas ${teksTanggal(batas)}) - batas penyelesaian perkara tingkat pertama (SEMA 2/2014).` });
    }
    return hasil;
  }

  function cekJendela(p) {
    const f = p.form;
    const j = p.jendela.kode;
    const data = p.bahan;
    const jadwal = data && Array.isArray(data.jadwal) ? data.jadwal : [];
    const daftar = tanggalDaftar(f.ownerDocument, f);
    if (j === "tunda") {
      const iso = isoDariTeks(nilaiMedan(medan(f, "tgl_sidang")));
      return cekTanggalSidang(iso, { sebelum: isoDariTeks(nilaiMedan(medan(f, "tglsidangsblm"))), jadwal, daftar });
    }
    if (j === "edit") {
      const e = medan(f, "tgl_sidang");
      if (!e || e.type === "hidden") return [];
      const iso = isoDariTeks(nilaiMedan(e));
      return cekTanggalSidang(iso, { sebelum: isoDariTeks(nilaiMedan(medan(f, "tgljsidangsblm"))), jadwal, daftar, kecuali: data && data.sidang ? data.sidang.sidangId : "" }).filter((c) => iso !== f.__aletaM1TanggalAwal || !/sudah punya sidang/.test(c.teks));
    }
    if (j === "sela") {
      const hasil = [];
      const tSela = isoDariTeks(nilaiMedan(medan(f, "tgl_sela")));
      // Tanggal putusan sela yang diusulkan ALETA (jadwal berangenda putusan sela) - ada sesudah "Isi dengan ALETA".
      const calon = sidangSela(jadwal).filter((x) => /putusan\s+sela/i.test(x.agenda || ""));
      const usul = calon.length ? calon[calon.length - 1].tanggal : "";
      const bawaanSipp = Boolean(f.__aletaM1HariIni && tSela === f.__aletaM1HariIni);
      // Belum dipakai: kolom masih tanggal bawaan SIPP (hari ini) atau kosong -> acuan = usulan ALETA.
      const belumDipakai = Boolean(usul && tSela !== usul && (bawaanSipp || !tSela));
      saranSela(f, belumDipakai ? usul : "");
      if (tSela && !belumDipakai) {
        const libur = bukanHariKerja(tSela);
        if (libur) hasil.push({ nada: "merah", teks: `Tanggal Putusan Sela jatuh pada ${libur}.` });
        if (jadwal.length && !jadwal.some((x) => x.tanggal === tSela)) hasil.push({ nada: "kuning", teks: `Tidak ada sidang perkara ini pada ${teksTanggal(tSela)}.` });
        if (bawaanSipp && !usul && !jadwal.some((x) => x.tanggal === tSela)) {
          hasil.push({ nada: "kuning", teks: "Tanggal Putusan Sela masih bawaan SIPP (hari ini) - periksa." });
        }
      }
      const acuan = belumDipakai ? usul : tSela;
      for (let i = 1; i <= 4; i += 1) {
        const e = medan(f, `tgl_pihak${i}`);
        if (!e || !tampak(e)) continue;
        const t = isoDariTeks(nilaiMedan(e));
        // Merah hanya bila BENAR-BENAR lebih awal dari tanggal putusan sela yang dipakai/diusulkan.
        if (t && acuan && t < acuan) hasil.push({ nada: "merah", teks: `${labelSebelum(e) || `Pemberitahuan pihak ${i}`}: lebih awal dari tanggal putusan sela.` });
      }
      return hasil;
    }
    if (j === "rekonvensi") {
      const hasil = [];
      const ada = (n) => Array.from(f.querySelectorAll(`input[type="checkbox"][name="${n}"]`));
      const p2 = ada("para_pihak2[]");
      const p1 = ada("para_pihak1[]");
      if (p2.length && !p2.some((c) => c.checked)) hasil.push({ nada: "kuning", teks: "Belum ada Penggugat Rekonvensi yang dicentang (Tergugat konvensi menjadi Penggugat rekonvensi)." });
      if (p1.length && !p1.some((c) => c.checked)) hasil.push({ nada: "kuning", teks: "Belum ada Tergugat Rekonvensi yang dicentang (Penggugat konvensi menjadi Tergugat rekonvensi)." });
      const t = isoDariTeks(nilaiMedan(medan(f, "tgl_pendaftaran")));
      if (t && isoSah(daftar) && t < daftar) hasil.push({ nada: "merah", teks: `Tanggal pendaftaran rekonvensi mendahului pendaftaran perkara (${teksTanggal(daftar)}).` });
      return hasil;
    }
    if (j === "saksi") {
      const s = medan(f, "is_sela");
      return s && tampak(s) && nilaiMedan(s) === "-1"
        ? [{ nada: "kuning", teks: "Saksi Putusan belum dipilih. Bila disimpan begini SIPP mencatatnya kosong (dihitung saksi putusan akhir)." }]
        : [];
    }
    if (j === "relaas") {
      const t = isoDariTeks(nilaiMedan(medan(f, "tgl_relaas")));
      const sidang = p.konteks && p.konteks.tanggal;
      if (!t || !isoSah(sidang)) return [];
      if (t > sidang) return [{ nada: "merah", teks: `Tanggal pelaksanaan sesudah hari sidang (${teksTanggal(sidang)}).` }];
      const n = hariKerjaAntara(t, sidang);
      const pihak = pihakRelaas(data, p.konteks.pihak);
      const ambang = pihak && Number.isFinite(pihak.ambang) && pihak.ambang !== null ? pihak.ambang : null;
      if (ambang !== null && pihak.hariKerja && n < ambang) {
        return [{ nada: "merah", teks: `${n} hari kerja sebelum sidang - kurang dari ${ambang} hari kerja${pihak.dasarHukum ? ` (${pihak.dasarHukum})` : ""}.` }];
      }
      return [{ nada: "info", teks: `${n} hari kerja di antara pelaksanaan dan hari sidang.` }];
    }
    if (j === "arsip") {
      const t = isoDariTeks(nilaiMedan(medan(f, "tgl_masuk_berkas")));
      const pt = data && data.putusan;
      if (!pt) return [];
      if (!pt.sudahPutus) return [{ nada: "kuning", teks: "Menurut SIPP perkara ini belum putus." }];
      if (t && isoSah(pt.tanggalPutusan) && t < pt.tanggalPutusan) return [{ nada: "merah", teks: `Tanggal masuk arsip mendahului tanggal putusan (${teksTanggal(pt.tanggalPutusan)}).` }];
      if (!isoSah(pt.tanggalBht)) return [{ nada: "kuning", teks: "Perkara belum BHT menurut SIPP." }];
      return [];
    }
    return [];
  }
  /**
   * Tanda kuning lembut tepat di samping kolom Tanggal Putusan Sela: "ALETA
   * mengusulkan <tanggal> - tekan Pakai" (dengan tombol Pakai). Hilang begitu
   * tanggalnya dipakai. usul "" = lepas tanda.
   */
  function saranSela(f, usul) {
    const kolom = medan(f, "tgl_sela");
    if (!kolom || !kolom.parentNode) return;
    let tanda = kolom.parentNode.querySelector(".aleta-m1-saran");
    if (!usul) {
      if (tanda) tanda.remove();
      return;
    }
    if (!tanda) {
      tanda = el("span", `${KELAS} aleta-m1-saran`);
      tanda.setAttribute("data-m1", "saran-sela");
      kolom.insertAdjacentElement("afterend", tanda);
    }
    if (tanda.getAttribute("data-usul") === usul) return;
    tanda.setAttribute("data-usul", usul);
    tanda.textContent = `ALETA mengusulkan ${teksTanggal(usul)} - tekan Pakai `;
    const b = tombol("Pakai", "Isikan tanggal putusan sela usulan ALETA (Simpan tetap Anda yang menekan)");
    b.setAttribute("data-m1", "pakai-saran");
    b.addEventListener("click", () => setel(kolom, keInput(usul)));
    tanda.appendChild(b);
  }
  function labelSebelum(e) {
    const tr = e.closest("tr");
    const td = tr && tr.querySelector("td");
    return td && td !== e.closest("td") ? sebaris(td.textContent).replace(/\*\s*$/, "") : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Jendela yang dikenali (pengenal lewat ALAMAT SIMPAN, bukan id saja - #frm_putusan
  // dan kawan-kawan dipakai lebih dari satu jendela)
  // ──────────────────────────────────────────────────────────────────────────
  const JENDELA = [
    {
      kode: "tunda",
      judul: "Tunda Jadwal Sidang",
      cocok: (f) => f.id === "frm_tunda_jadwal_sidang" && /jadwal_sidang_c\/validateTunda(?:[/?#]|$)/i.test(aksiForm(f)),
      api: "tunda",
      tanggal: (f) => isoDariTeks(nilaiMedan(medan(f, "tglsidangsblm"))),
      usulan: usulanTunda,
    },
    {
      kode: "edit",
      judul: "Edit Jadwal Sidang",
      cocok: (f) => f.id === "frm_edit_jadwal_sidang" && /jadwal_sidang_c\/validateEdit(?:[/?#]|$)/i.test(aksiForm(f)),
      api: "edit",
      tanggal: (f) => f.__aletaM1TanggalAwal || isoDariTeks(nilaiMedan(medan(f, "tgl_sidang"))),
      usulan: usulanEdit,
    },
    {
      kode: "sela",
      judul: "Putusan Sela",
      cocok: (f) => f.id === "frm_sela" && /managePutusanSela\/validateInput(?:[/?#]|$)/i.test(aksiForm(f)),
      api: "sela",
      usulan: usulanSela,
      penjelas: "Amar tetap dipilih lewat \"Pilih amar\" SIPP. Tanggal pemberitahuan diisi dari relaas pemberitahuan tiap pihak - yang belum diberitahu dibiarkan kosong.",
    },
    {
      kode: "rekonvensi",
      judul: "Rekonvensi",
      cocok: (f) => f.id === "frm_rekonvensi" && /rekonv_validate_input\/val(?:[/?#]|$)/i.test(aksiForm(f)),
      api: "rekonvensi",
      usulan: usulanRekonvensi,
      penjelas: "Bersilang: Tergugat konvensi menjadi Penggugat rekonvensi, Penggugat konvensi menjadi Tergugat rekonvensi. Isi Petitum disalin dari petitum rekonvensi di jawaban.",
    },
    {
      kode: "relaas",
      judul: "Pelaksanaan Relaas",
      // Form ini tanpa action (dikirim $.ajax) - dikenali dari kolom khasnya.
      cocok: (f) => f.id === "frm_relaas" && Boolean(f.querySelector('select[name="bertemu"]')) && Boolean(f.querySelector('input[name="encsidang"]')),
      api: "relaas",
      konteks: (f) => {
        const kepala = sebaris((f.querySelector("#tableDetilPerkara td") || {}).textContent || "");
        const pihak = (kepala.match(/Pihak\s*:\s*(.*?)\s*Tanggal\s+Sidang/i) || [])[1] || "";
        return { pihak, tanggal: isoDariTeks((kepala.match(/Tanggal\s+Sidang\s*:\s*(.*)$/i) || [])[1] || "") };
      },
      tanggal: (f, k) => (k && k.tanggal) || "",
      usulan: usulanRelaasEdit,
    },
    {
      kode: "saksi",
      judul: "Saksi Putusan",
      lipat: true, // T6 (23 Okt): pita bawaan terlipat, dibuka dengan klik pada kepalanya
      cocok: (f) => f.id === "frm_user" && /addPihak\/validateInput(?:[/?#]|$)/i.test(aksiForm(f)) && Boolean(f.querySelector('select[name="is_sela"]')),
      api: "saksi",
      usulan: usulanSaksi,
      syarat: (f) => tampak(f.querySelector('select[name="is_sela"]')),
    },
    {
      kode: "jurnal",
      judul: "Tambah Biaya (Kasir)",
      cocok: (f) => f.id === "frm_add_biaya" && /detil_biaya\/validateInput(?:[/?#]|$)/i.test(aksiForm(f)),
      kasir: true,
      usulan: usulanKasir,
    },
    {
      kode: "arsip",
      judul: "Arsip",
      cocok: (f) => f.id === "frm_add_arsip" && /manage_arsip_c\/validateInputAddArsip(?:[/?#]|$)/i.test(aksiForm(f)),
      api: "arsip",
      nomor: (f) => {
        const v = sebaris(nilaiMedan(medan(f, "nomor_perkara")));
        return POLA_NOMOR_PENUH.test(v) ? v : "";
      },
      usulan: usulanArsip,
    },
  ];
  function kenaliJendela(form) {
    for (const j of JENDELA) {
      try {
        if (j.cocok(form)) return j;
      } catch {
        /* lanjut */
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gaya
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Rupa mengikuti rancangan "SIPP dengan Ide ALETA" (pita .ide-isi, lencana
   * .aleta-tanda bulat berwarna dengan ikon i) dan tema SIPP 7.0.4 (hijau
   * #008C4B / #007640). Huruf mengikuti SIPP (font-family & ukuran inherit) -
   * tidak ada teks yang lebih kecil dari teks SIPP di sekitarnya.
   */
  const GAYA = `
.aleta-m1-pita{clear:both;display:block;margin:4px 0 8px;padding:6px 10px;background:rgba(47,158,68,.12);border-left:3px solid #2f9e44;font-family:inherit;font-size:inherit;color:#333;text-align:left;line-height:1.5;letter-spacing:0}
.aleta-m1-baris{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.aleta-m1-logo{display:inline-block;background:#007640;color:#fff;border-radius:999px;padding:0 9px;font-weight:700}
.aleta-m1-judul{font-weight:600;color:#008c4b;margin-right:2px}
.aleta-m1-tombol{font-family:inherit;font-size:inherit;padding:3px 12px;border:1px solid #c9d4ce;border-radius:999px;background:#fff;color:#333;cursor:pointer;line-height:1.4}
.aleta-m1-tombol.aleta-m1-utama{background:#007640;border-color:#007640;color:#fff;border-radius:3px;font-weight:600}
.aleta-m1-tombol:hover{filter:brightness(1.08)}
.aleta-m1-tombol:disabled{opacity:.55;cursor:default}
.aleta-m1-hitung{display:inline-block;padding:1px 10px;border-radius:999px;background:#16704a;border:1px solid #235b3e;color:#fff;font-weight:600;cursor:pointer}
.aleta-m1-hitung.aleta-m1-ada-kosong{background:#9a5b06;border-color:#74440a}
.aleta-m1-hitung:empty{display:none}
.aleta-m1-kabar{margin-top:4px;color:#333}
.aleta-m1-kabar:empty,.aleta-m1-cek:empty,.aleta-m1-usulan:empty{display:none}
.aleta-m1-gagal{color:#b42318;font-weight:600}
.aleta-m1-penjelas{margin-top:3px;color:#555}
.aleta-m1-cek div{margin:4px 0;padding:3px 9px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.12);color:#5c3d00}
.aleta-m1-cek div.aleta-m1-merah{border-color:#b42318;background:rgba(180,35,24,.10);color:#8a1c13}
.aleta-m1-cek div.aleta-m1-info{border-color:#2f9e44;background:rgba(47,158,68,.08);color:#1f3d27}
.aleta-m1-tabel{width:100%;border-collapse:collapse;margin-top:6px;background:#fff;font-family:inherit;font-size:inherit}
.aleta-m1-tabel td,.aleta-m1-tabel th{border:1px solid #d6e4d8;padding:3px 6px;vertical-align:top;text-align:left;font-size:inherit}
.aleta-m1-tabel th{background:#008c4b;color:#fff;font-weight:400}
.aleta-m1-lembut{color:#555}
.aleta-m1-tanda{display:inline-flex;align-items:center;gap:5px;padding:1px 9px;border-radius:999px;font-weight:600;white-space:nowrap;line-height:1.6;color:#fff;background:#6b7a72;border:1px solid #6b7a72;vertical-align:middle}
.aleta-m1-tanda-hijau{background:#16704a;border-color:#235b3e}
.aleta-m1-tanda-kuning{background:#9a5b06;border-color:#74440a}
.aleta-m1-tanda-merah{background:#b42318;border-color:#8a1c13}
.aleta-m1-i{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid currentColor;font:italic 700 10px/12px Georgia,serif;text-align:center;opacity:.9;cursor:help}
.aleta-m1-i::before{content:"i"}
.aleta-m1-kosong-chip{margin-right:6px;font-family:inherit;font-size:inherit;padding:2px 10px;border:1px solid #74440a;border-radius:999px;background:#9a5b06;color:#fff;font-weight:600;cursor:pointer}
.aleta-m1-relaas{display:block;margin-top:4px;white-space:normal}
.aleta-m1-relaas .aleta-m1-tanda{margin-right:6px}
.aleta-m1-lipat-kepala{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.aleta-m1-lipat-kepala:focus-visible{outline:2px solid var(--aleta-merek,#007640);outline-offset:1px}
html:not([data-aleta-kulit="modern"]) .aleta-m1-lipat-kepala>.aleta-lipat-panah{color:var(--aleta-tulisan-lembut,inherit)}
html:not([data-aleta-kulit="modern"]) .aleta-m1-lipat-kepala>.aleta-lipat-panah::before{content:"▸"}
html:not([data-aleta-kulit="modern"]) .aleta-m1-lipat-kepala[aria-expanded="true"]>.aleta-lipat-panah::before{content:"▾"}
.aleta-m1-saran{display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:1px 8px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.12);color:#5c3d00}
.aleta-m1-sorot{outline:2px solid #e0a800!important;outline-offset:1px}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-pita{background:rgba(47,158,68,.10);color:#dfe8e2}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-logo,html[data-aleta-tema-sipp="gelap"] .aleta-m1-tombol.aleta-m1-utama{background:#1c5539;border-color:#1c5539}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-judul{color:#7fd0a6}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-tombol{background:#17211c;color:#dfe8e2;border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-kabar,html[data-aleta-tema-sipp="gelap"] .aleta-m1-penjelas,html[data-aleta-tema-sipp="gelap"] .aleta-m1-lembut{color:#c9d8e6}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-tabel{background:#17211c;color:#dfe8e2}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-tabel td,html[data-aleta-tema-sipp="gelap"] .aleta-m1-tabel th{border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-tabel th{background:#143c29}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-cek div,html[data-aleta-tema-sipp="gelap"] .aleta-m1-saran{color:#f3e2b5}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-cek div.aleta-m1-merah{color:#ffb4ab}
html[data-aleta-tema-sipp="gelap"] .aleta-m1-cek div.aleta-m1-info{color:#bfe6cc}
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
  // Pita di jendela
  // ──────────────────────────────────────────────────────────────────────────
  function kabar(p, teks, gagal) {
    setelTeks(p.kabar, teks || "");
    p.kabar.classList.toggle("aleta-m1-gagal", Boolean(gagal));
  }

  /** L1 sudah memasang pita + penghitung di form ini (jendela Saksi) -> pita M1 tanpa penghitung kedua. */
  const adaPitaL1 = (form) => Boolean(form.__aletaL1 && form.__aletaL1.pita && form.__aletaL1.pita.isConnected && !form.__aletaL1.pita.hidden);

  function segarkan(p) {
    const L = l1();
    if (L && typeof L.hitungKolom === "function" && !adaPitaL1(p.form)) {
      const h = L.hitungKolom(p.form);
      setelTeks(p.hitung, L.kalimatHitung(h));
      p.hitung.classList.toggle("aleta-m1-ada-kosong", h.wajib ? h.wajibTerisi < h.wajib : h.terisi < h.jumlah);
      p.kosongTerakhir = h.kosong;
      if (p.chip) {
        const n = h.kosong.filter((k) => k.wajib).length;
        p.chip.hidden = n === 0;
        setelTeks(p.chip, n ? `${n} kolom wajib kosong` : "");
      }
    } else {
      setelTeks(p.hitung, "");
      if (p.chip) p.chip.hidden = true;
    }
    const cek = cekJendela(p);
    // Digambar ulang hanya bila isinya berubah (tiap ketikan memanggil ini).
    const sidik = JSON.stringify(cek.map((c) => [c.nada, c.teks]));
    if (p.cekSidik !== sidik) {
      p.cekSidik = sidik;
      p.cek.textContent = "";
      for (const c of cek) p.cek.appendChild(el("div", c.nada === "merah" ? "aleta-m1-merah" : c.nada === "info" ? "aleta-m1-info" : "", c.teks));
    }
    return cek;
  }

  function loncatKosong(p) {
    const k = (p.kosongTerakhir || []).slice().sort((a, b) => Number(b.wajib) - Number(a.wajib));
    if (!k.length) {
      kabar(p, "Semua kolom yang tampak sudah terisi.");
      return;
    }
    for (const x of k) {
      x.el.classList.add("aleta-m1-sorot");
      setTimeout(() => x.el.classList.remove("aleta-m1-sorot"), 2600);
    }
    try {
      k[0].el.scrollIntoView({ block: "center" });
      if (typeof k[0].el.focus === "function") k[0].el.focus();
    } catch {
      /* kenyamanan */
    }
    kabar(p, `Masih kosong: ${k.slice(0, 8).map((x) => `${x.label}${x.wajib ? " (wajib)" : ""}`).join(", ")}${k.length > 8 ? `, dan ${k.length - 8} lagi` : ""}.`);
  }

  function bangunPita(form, j) {
    const pita = el("div", `${KELAS} aleta-m1-pita`);
    pita.setAttribute("data-m1-jendela", j.kode);
    const baris = el("div", "aleta-m1-baris");
    const hitung = el("span", "aleta-m1-hitung", "");
    hitung.setAttribute("data-m1", "hitung");
    hitung.title = "Klik untuk melompat ke kolom yang masih kosong";
    const tIsi = tombol("Isi dengan ALETA", "Kolom yang pasti diisi bila masih kosong; yang ragu ditawarkan. Simpan tetap Anda yang menekan.", "aleta-m1-utama");
    tIsi.setAttribute("data-m1", "isi");
    const tKosong = tombol("Loncat ke yang kosong", "Sorot dan lompat ke kolom yang masih kosong (wajib lebih dulu)");
    tKosong.setAttribute("data-m1", "kosong");
    if (j.lipat) {
      // Kepala lipatan = logo + judul; tombol, hitungan, dan sisanya jadi isi.
      const kepalaLipat = el("div", "aleta-m1-lipat-kepala");
      kepalaLipat.append(el("span", "aleta-m1-logo", "ALETA"), el("span", "aleta-m1-judul", j.judul));
      pita.append(kepalaLipat);
      baris.append(tIsi, hitung, tKosong);
    } else {
      baris.append(el("span", "aleta-m1-logo", "ALETA"), el("span", "aleta-m1-judul", j.judul), tIsi, hitung, tKosong);
    }
    const cek = el("div", "aleta-m1-cek");
    cek.setAttribute("data-m1", "cek");
    const kabarEl = el("div", "aleta-m1-kabar");
    kabarEl.setAttribute("data-m1", "kabar");
    kabarEl.setAttribute("aria-live", "polite");
    const usulanEl = el("div", "aleta-m1-usulan");
    usulanEl.setAttribute("data-m1", "usulan");
    pita.append(baris);
    if (j.penjelas) {
      const pj = el("div", "aleta-m1-penjelas", j.penjelas);
      pj.setAttribute("data-m1", "penjelas");
      pita.append(pj);
    }
    pita.append(cek, kabarEl, usulanEl);

    const p = { form, jendela: j, pita, hitung, cek, kabar: kabarEl, usulanEl, tIsi, chip: null, bahan: null, daftar: [], konteks: j.konteks ? j.konteks(form) : null, kosongTerakhir: [] };
    tIsi.addEventListener("click", () => void isiDenganAleta(p));
    tKosong.addEventListener("click", () => loncatKosong(p));
    hitung.addEventListener("click", () => loncatKosong(p));

    // Penghitung kecil tepat sebelum Simpan - kecuali L1 sudah memasangnya.
    const simpan = form.querySelector("#simpan, #simpan_btn");
    if (simpan && simpan.parentNode && !form.querySelector('[data-l1="chip"]')) {
      const chip = el("button", `${KELAS} aleta-m1-kosong-chip`, "");
      chip.type = "button";
      chip.setAttribute("data-m1", "chip");
      chip.title = "Kolom wajib yang masih kosong - klik untuk melompat ke sana";
      chip.hidden = true;
      chip.addEventListener("click", () => loncatKosong(p));
      simpan.parentNode.insertBefore(chip, simpan);
      p.chip = chip;
    }
    if (!form.__aletaM1Dengar) {
      form.__aletaM1Dengar = true;
      const segar = () => {
        const kini = form.__aletaM1;
        if (kini && kini.pita.isConnected) segarkan(kini);
      };
      form.addEventListener("input", segar);
      form.addEventListener("change", segar);
    }
    return p;
  }

  async function ambilBahan(p) {
    const j = p.jendela;
    const nomor = j.nomor ? j.nomor(p.form) : nomorJendela(p.form);
    if (j.kasir) return ambilKasir(nomor);
    if (!nomor) return { ok: false, alasan: j.kode === "arsip" ? "Isi Nomor Perkara dulu, lalu tekan Isi dengan ALETA." : "Nomor perkara belum terbaca di halaman ini." };
    return ambilJendela(j.api, nomor, j.tanggal ? j.tanggal(p.form, p.konteks) : "");
  }

  /** Menerapkan daftar usulan ke form: pasti + kosong -> diisi; sisanya ditawarkan. Pulang ringkasan. */
  function terapkanUsulan(form, daftar) {
    const r = { diisi: 0, sama: 0, tawar: 0, gagal: 0 };
    for (const u of daftar) {
      const e = u.nama ? medan(form, u.nama) : null;
      if (u.nama && !e) {
        u.keadaan = "tidak-ada";
        continue;
      }
      const sama = u.sama ? u.sama() : nilaiMedan(e) === String(u.nilai);
      if (sama) {
        u.keadaan = "sama";
        r.sama += 1;
        continue;
      }
      const kos = u.kosongkah ? u.kosongkah() : kosong(e);
      // Kolom yang disembunyikan SIPP (.hide()) tidak diisi - kecuali input type=hidden milik borangnya.
      if (u.pasti && kos && (!e || e.type === "hidden" || tampak(e))) {
        const ok = u.terap ? u.terap() : setel(e, u.nilai);
        u.keadaan = ok ? "diisi" : "gagal";
        r[ok ? "diisi" : "gagal"] += 1;
        continue;
      }
      u.keadaan = "tawar";
      r.tawar += 1;
    }
    return r;
  }

  const SEBUT_KEADAAN = {
    diisi: ["Diisi ALETA", "hijau", "Kolom ini tadinya kosong dan sudah diisi usulan ALETA. Periksa sebelum menekan Simpan."],
    sama: ["Sudah sama", "hijau", "Isian di kolom ini sudah sama dengan usulan ALETA."],
    tawar: ["Periksa", "kuning", "Usulan ini tidak diisikan sendiri: kolomnya sudah berisi, atau ALETA belum yakin. Tekan Pakai bila sesuai."],
    gagal: ["Tidak dapat diisi", "merah", "Pilihan ini tidak tersedia di kolom SIPP. Isi sendiri."],
    "tidak-ada": ["Kolom tidak ada", "merah", "Kolom ini tidak ada di jendela SIPP ini."],
    dipakai: ["Dipakai", "hijau", "Usulan sudah diisikan ke kolomnya. Periksa sebelum menekan Simpan."],
  };

  function gambarUsulan(p) {
    p.usulanEl.textContent = "";
    if (!p.daftar.length) return;
    const t = el("table", "aleta-m1-tabel");
    const kepala = el("tr");
    for (const h of ["Kolom", "Usulan ALETA", "Sumber", ""]) kepala.appendChild(el("th", "", h));
    t.appendChild(kepala);
    for (const u of p.daftar) {
      const tr = el("tr");
      tr.setAttribute("data-m1-usulan", u.kunci);
      tr.appendChild(el("td", "", u.label));
      const tdU = el("td", "", u.tampil || String(u.nilai || ""));
      if (u.catatan) tdU.appendChild(el("div", "aleta-m1-lembut", u.catatan));
      tr.appendChild(tdU);
      tr.appendChild(el("td", "aleta-m1-lembut", u.sumber || ""));
      const tdA = el("td");
      const [teks, nada, arti] = SEBUT_KEADAAN[u.keadaan] || ["", "", ""];
      if (teks) tdA.appendChild(lencana(teks, nada, arti));
      if (u.keadaan === "tawar" || u.keadaan === "gagal") {
        const b = tombol("Pakai", "Isikan usulan ini ke kolomnya (Simpan tetap Anda yang menekan)");
        b.setAttribute("data-m1", "pakai");
        b.addEventListener("click", () => {
          const ok = u.terap ? u.terap() : setel(medan(p.form, u.nama), u.nilai);
          u.keadaan = ok ? "dipakai" : "gagal";
          gambarUsulan(p);
          segarkan(p);
        });
        tdA.appendChild(b);
      }
      tr.appendChild(tdA);
      t.appendChild(tr);
    }
    p.usulanEl.appendChild(t);
  }

  async function isiDenganAleta(p) {
    ditahanPenjaga = "";
    p.tIsi.disabled = true;
    kabar(p, "Membaca data ALETA untuk jendela ini…");
    try {
      const b = await ambilBahan(p);
      if (!b || !b.ok) {
        kabar(p, (b && b.alasan) || "Usulan ALETA belum dapat dibaca.", true);
        return null;
      }
      p.bahan = b.data;
      p.daftar = p.jendela.usulan(b.data, p.form, p.konteks) || [];
      const r = terapkanUsulan(p.form, p.daftar);
      gambarUsulan(p);
      segarkan(p);
      if (!p.daftar.length) kabar(p, kalimatTanpaUsulan(p));
      else {
        const bagian = [];
        if (r.diisi) bagian.push(p.jendela.kasir ? `${r.diisi} transaksi Kasir diisikan ke jendela` : `${r.diisi} kolom diisi ALETA`);
        if (r.sama) bagian.push(`${r.sama} sudah sama`);
        if (r.tawar) bagian.push(`${r.tawar} usulan perlu Anda periksa (tombol Pakai)`);
        if (r.gagal) bagian.push(`${r.gagal} tidak dapat diisi`);
        if (ditahanPenjaga) bagian.push(ditahanPenjaga);
        kabar(p, `${bagian.join(" · ")}. Simpan tetap Anda yang menekan.`);
      }
      return r;
    } catch (e) {
      void e;
      kabar(p, "Usulan ALETA belum dapat dibaca. Periksa sambungan ke ALETA lalu coba lagi.", true);
      return null;
    } finally {
      p.tIsi.disabled = false;
    }
  }
  function kalimatTanpaUsulan(p) {
    const k = p.jendela.kode;
    if (k === "jurnal") return "Kasir ALETA tidak punya usulan transaksi yang masih terbuka untuk perkara ini.";
    if (k === "relaas") return "Tidak ada usulan pasti untuk pihak ini (e-Summons tidak tercatat). Kepatutannya tetap diperiksa di atas.";
    if (k === "tunda" && p.bahan && p.bahan.tunda && p.bahan.tunda.alasan) return p.bahan.tunda.alasan;
    if (k === "tunda" && p.bahan && !p.bahan.sidang) return "Sidang ini tidak ditemukan di jadwal perkara menurut ALETA.";
    return "Tidak ada usulan ALETA untuk jendela ini.";
  }

  const pitaHidup = new Set();
  /**
   * Pita bawaan terlipat lewat lipat seragam panel (alatJadikanLipat, asal
   * "kartu"); buka/tutup diingat per jendela. Tanpa fungsinya pita tetap
   * terbuka - fungsi tidak pernah hilang.
   */
  function lipatkanPita(pita, kode) {
    if (typeof alatJadikanLipat !== "function") return null;
    try {
      return alatJadikanLipat(pita, { kunci: `sipp-ide-m1:${kode}`, terbuka: false, kepala: pita.querySelector(":scope > .aleta-m1-lipat-kepala") });
    } catch {
      return null;
    }
  }

  function pasangPita(form) {
    if (form.__aletaM1 && form.__aletaM1.pita.isConnected) return form.__aletaM1;
    const j = kenaliJendela(form);
    if (!j || !form.parentNode) return null;
    if (j.syarat && !j.syarat(form)) return null;
    if (j.kode === "edit" && !form.__aletaM1TanggalAwal) form.__aletaM1TanggalAwal = isoDariTeks(nilaiMedan(medan(form, "tgl_sidang")));
    if (j.kode === "sela" && !form.__aletaM1HariIni) form.__aletaM1HariIni = isoHariIni();
    const p = bangunPita(form, j);
    form.parentNode.insertBefore(p.pita, form);
    if (j.lipat) lipatkanPita(p.pita, j.kode);
    form.__aletaM1 = p;
    pitaHidup.add(p);
    segarkan(p);
    return p;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Daftar Pelaksanaan Relaas (tabel #pelaks_relaas, tanpa form)
  // ──────────────────────────────────────────────────────────────────────────
  /** Tanggal sidang dari kepala jendela relaas. 7.0.4: "Tanggal Sidang : Senin, 05 Okt. 2026|1" (berekor |alur). */
  function tanggalKepalaRelaas(akar) {
    const t = sebaris(akar && akar.textContent);
    const m = t.match(/Tanggal\s+Sidang\s*:\s*([^|]*?)(?:\||Agenda|$)/i);
    return m ? isoDariTeks(m[1]) : "";
  }

  function barisRelaas(tabel) {
    return Array.from(tabel.querySelectorAll("tr"))
      .map((tr) => ({ tr, nama: tr.querySelector('td[id^="r_pihak"]'), sel: tr.querySelector('td[id^="r_pelaks"]') }))
      .filter((x) => x.nama && x.sel);
  }

  /** Lencana kepatutan satu pihak: { teks, nada, rinci, arti }. Bahasa awam; dasar hukum disebut. */
  function kalimatPatut(p) {
    const saluran = { elektronik: "elektronik", surat_tercatat: "surat tercatat", biasa: "biasa (juru sita)" }[p.seharusnya] || p.seharusnya || "-";
    if (!p.dinilai) {
      return { teks: "Belum dapat dinilai", nada: "kuning", rinci: `saluran seharusnya ${saluran}${p.alasanPatut ? `; ${p.alasanPatut}` : ""}`, arti: "ALETA belum dapat menilai kepatutan panggilan pihak ini." };
    }
    if (p.patut) {
      return { teks: "Patut", nada: "hijau", rinci: `${p.selisih !== null ? `${p.selisih} ${p.hariKerja ? "hari kerja" : "hari"} sebelum sidang; ` : ""}saluran ${saluran}`, arti: "Menurut ALETA panggilan pihak ini patut." };
    }
    return {
      teks: "Tidak patut",
      nada: "merah",
      rinci: `${p.alasanPatut || "tenggang kurang"}${p.dasarHukum ? ` (${p.dasarHukum})` : ""}; saluran seharusnya ${saluran}`,
      arti: "Menurut ALETA panggilan pihak ini tidak patut - periksa sebelum sidang dilanjutkan.",
    };
  }


  /**
   * Lencana HASIL panggilan satu relaas dari rute jendela (kepatutan bersama):
   * mis. "Bertemu orang serumah (ayah kandung)" (SEMA 1/2023 angka 12 huruf c),
   * "Melalui kepala desa" (Pasal 718 ayat (1) RBg), dan retur beserta sebabnya.
   * Rute lama tanpa ruas kepatutan: tidak ada lencana (bukan tebakan).
   */
  function lencanaHasilRelaas(relaas) {
    const k = relaas && relaas.kepatutan;
    if (!k || !k.label) return [];
    const arti = [k.keterangan, k.dasar ? `Dasar: ${k.dasar}.` : ""].filter(Boolean).join(" ");
    // Retur: satu lencana merah yang sudah menyebut sebabnya.
    if (k.retur) return [lencana(k.labelRetur || "Retur", "merah", arti)];
    return [lencana(k.label, k.warna || "abu", arti)];
  }

  function tandaiRelaas(tabel, panggilan, relaasSidang) {
    let n = 0;
    const ringkas = { patut: 0, tidak: 0, belum: 0, lain: 0 };
    for (const b of barisRelaas(tabel)) {
      const lama = b.sel.querySelector(".aleta-m1-relaas");
      if (lama) lama.remove();
      const p = (panggilan || []).find((x) => cocokNama(x.nama, b.nama.textContent)) || null;
      const hasilRelaas = (relaasSidang || []).find((x) => cocokNama(x.namaPihak, b.nama.textContent)) || null;
      // Baris yang tidak ada di kesiapan sidang (kuasa, saksi ahli) tidak diberi keterangan.
      if (!p) {
        ringkas.lain += 1;
        continue;
      }
      const k = kalimatPatut(p);
      const s = el("div", `${KELAS} aleta-m1-relaas`);
      s.append(...lencanaHasilRelaas(hasilRelaas));
      s.append(lencana(`${k.teks} menurut ALETA`, k.nada, k.arti), document.createTextNode(k.rinci));
      b.sel.appendChild(s);
      n += 1;
      if (p.dinilai) ringkas[p.patut ? "patut" : "tidak"] += 1;
      else ringkas.belum += 1;
    }
    return { n, ...ringkas };
  }

  function pasangRelaasDaftar(tabel) {
    if (tabel.__aletaM1 && tabel.__aletaM1.pita.isConnected) return tabel.__aletaM1;
    const wadah = tabel.closest("#divpelaks_relaas") || tabel;
    if (!wadah.parentNode) return null;
    const pita = el("div", `${KELAS} aleta-m1-pita`);
    pita.setAttribute("data-m1-jendela", "relaas-daftar");
    const baris = el("div", "aleta-m1-baris");
    const tPeriksa = tombol("Periksa kepatutan (ALETA)", "Bandingkan pelaksanaan relaas tiap pihak dengan kepatutan panggilan menurut ALETA", "aleta-m1-utama");
    tPeriksa.setAttribute("data-m1", "isi");
    baris.append(el("span", "aleta-m1-logo", "ALETA"), el("span", "aleta-m1-judul", "Pelaksanaan Relaas"), tPeriksa);
    const kabarEl = el("div", "aleta-m1-kabar");
    kabarEl.setAttribute("data-m1", "kabar");
    pita.append(baris, kabarEl);
    wadah.parentNode.insertBefore(pita, wadah);
    const p = { tabel, pita, kabar: kabarEl, tIsi: tPeriksa };
    tPeriksa.addEventListener("click", () => void periksaRelaas(p));
    tabel.__aletaM1 = p;
    return p;
  }

  async function periksaRelaas(p) {
    const akar = p.tabel.closest('[id^="form_pop"]') || p.tabel.ownerDocument.body;
    const tanggal = tanggalKepalaRelaas(akar);
    const nomor = nomorJendela(p.tabel);
    p.tIsi.disabled = true;
    kabar(p, "Membaca kepatutan panggilan…");
    try {
      if (!tanggal) {
        kabar(p, "Tanggal sidang tidak terbaca di jendela ini.", true);
        return null;
      }
      const b = await ambilJendela("relaas", nomor, tanggal);
      if (!b.ok) {
        kabar(p, b.alasan, true);
        return null;
      }
      if (!Array.isArray(b.data.panggilan)) {
        kabar(p, b.data.sidang ? "Kesiapan sidang ini belum dapat dibaca ALETA." : `Sidang ${teksTanggal(tanggal)} tidak ditemukan di jadwal perkara menurut ALETA.`, true);
        return null;
      }
      const idSidang = b.data.sidang && b.data.sidang.sidangId ? String(b.data.sidang.sidangId) : "";
      const relaasSidang = (Array.isArray(b.data.relaas) ? b.data.relaas : []).filter((x) => !idSidang || !x.sidangId || String(x.sidangId) === idSidang);
      const r = tandaiRelaas(p.tabel, b.data.panggilan, relaasSidang);
      kabar(
        p,
        `${r.n} pihak diperiksa: ${r.patut} patut, ${r.tidak} tidak patut, ${r.belum} belum dapat dinilai` +
          `${r.lain ? `; ${r.lain} baris lain (kuasa/saksi ahli) tidak dinilai` : ""}. Isian relaas tetap lewat tombol Isi/Edit SIPP.`
      );
      return r;
    } catch (e) {
      void e;
      kabar(p, "Kepatutan belum dapat dibaca. Periksa sambungan ke ALETA lalu coba lagi.", true);
      return null;
    } finally {
      p.tIsi.disabled = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Penjaga Simpan jendela Saksi: "Saksi Putusan" belum dipilih (R1 K-PETA)
  // ──────────────────────────────────────────────────────────────────────────
  function saatKirim(e) {
    const form = e.target;
    if (!form || form.id !== "frm_user" || !aktifSekarang()) return;
    const s = form.querySelector('select[name="is_sela"]');
    if (!s || !tampak(s) || String(s.value) !== "-1") return;
    let ya = false;
    try {
      ya = window.confirm("Saksi Putusan belum dipilih (Akhir atau Sela).\n\nBila disimpan begini, SIPP mencatatnya kosong dan saksi ini dihitung saksi putusan akhir. Tetap simpan?") === true;
    } catch {
      ya = false;
    }
    if (ya) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    s.classList.add("aleta-m1-sorot");
    setTimeout(() => s.classList.remove("aleta-m1-sorot"), 2600);
    try {
      s.focus();
    } catch {
      /* kenyamanan */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }
  function bersihkan(doc) {
    const d = doc || document;
    for (const e of Array.from(d.querySelectorAll(".aleta-m1"))) e.remove();
    for (const f of Array.from(d.querySelectorAll("form, table"))) f.__aletaM1 = null;
    pitaHidup.clear();
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-m1")) bersihkan(d);
      return { pita: 0, relaas: 0 };
    }
    let pita = 0;
    let relaas = 0;
    const forms = Array.from(d.querySelectorAll("form")).filter((f) => !milikAleta(f));
    const tabel = Array.from(d.querySelectorAll("table#pelaks_relaas")).filter((t) => !milikAleta(t));
    if (!forms.some((f) => kenaliJendela(f)) && !tabel.length) return { pita, relaas };
    sisipkanGaya(d);
    for (const f of forms) if (pasangPita(f)) pita += 1;
    for (const t of tabel) if (pasangRelaasDaftar(t)) relaas += 1;
    for (const p of Array.from(pitaHidup)) if (!p.pita.isConnected || !p.form.isConnected) pitaHidup.delete(p);
    return { pita, relaas };
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
    if (milikAleta(m.target)) return true;
    const n = [...Array.from(m.addedNodes || []), ...Array.from(m.removedNodes || [])];
    return n.length > 0 && n.every((x) => x.nodeType === 1 && x.classList && (x.classList.contains("aleta-sisip") || x.id === ID_PANEL));
  }
  const diAbt = () => /\/aps_badilag\//i.test(String(location.pathname || ""));

  async function mulai() {
    try {
      if (diAbt()) return;
      let s = {};
      try {
        s = (await chrome.storage.local.get(["aktif"])) || {};
      } catch {
        s = {};
      }
      nyala = s.aktif !== false;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
          jadwalkan();
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (!document.body) return;
      // Dipasang SELALU (juga saat ALETA mati ketika halaman dibuka) - pasang()
      // dan saatKirim() memeriksa aktifSekarang() sendiri (audit 17 Okt).
      document.addEventListener("submit", saatKirim, true);
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

  globalThis.aletaSippIdeM1 = {
    versi: "tahap-M1",
    pasang,
    bersihkan,
    isiDenganAleta,
    periksaRelaas,
    saatKirim,
    murni: {
      kenaliJendela,
      isoDariTeks,
      keInput,
      tambahBulan,
      hariKerjaAntara,
      cocokNama,
      tanggalKepalaRelaas,
      tanggalDaftar,
      nomorJendela,
      cekTanggalSidang,
      usulanTunda,
      usulanEdit,
      usulanSela,
      usulanRekonvensi,
      usulanSaksi,
      usulanArsip,
      usulanRelaasEdit,
      usulanKasir,
      terapkanUsulan,
    },
  };
  void mulai();
})();
