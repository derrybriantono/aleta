"use strict";

/**
 * ============================================================================
 * PANDUAN LANGKAH KERJA KASIR BERSOROT DI HALAMAN SIPP (T5)
 * ============================================================================
 *
 * Skrip konten TERSENDIRI, dimuat sesudah sipp-ide-m1.js di halaman SIPP.
 * Kasir diberi tahu APA yang dikerjakan dan URUTANNYA dengan menyorot satu per
 * satu elemen SIPP yang bersangkutan, disertai kartu penjelasan kecil:
 *
 *   Jurnal per perkara (detil_biaya)   nomor perkara -> usulan Kasir ALETA ->
 *                                      tombol Tambah Biaya -> tabel jurnal
 *   Daftar jurnal keuangan             daftar perkara -> Kasir harian ALETA
 *   Jendela Tambah Biaya (frm_add_biaya) Isi dengan ALETA -> tanggal -> pihak ->
 *                                      pembayar -> kategori -> jenis -> jurusita
 *                                      -> jumlah -> Simpan
 *
 * Tombol "Kasir ALETA" (kasir-jurnal-popup.js, T3, #aleta-kj-tombol) ikut disorot bila ada di halaman;
 * bila belum ada (cabang T3 belum digabung / bukan haknya) langkahnya dilewati tanpa galat.
 *
 * Hanya elemen yang TAMPAK disorot (SIPP menyembunyikan medan dengan .hide() -
 * display:none, elemennya tetap ada): langkah yang elemennya tersembunyi atau
 * tidak ada dilewati, jadi urutannya selalu cocok dengan yang dilihat kasir.
 * Selama jendela Tambah Biaya terbuka, hanya langkah jendela itu yang berlaku.
 *
 * Hanya tampil untuk kasir, Admin, dan Super Admin: golongan menu ekstensi dari
 * matriks peran portal (golonganMenu, matriks-peran.ts bolehPanduanKasir) atau,
 * bila portal belum mengirimnya, nama peran. Tampilan Lama tidak berubah.
 *
 * Berkas ini TIDAK menulis apa pun ke SIPP: tidak mengisi kolom, tidak menekan
 * tombol, tidak memasukkan tanda ALETA ke isian. Satu-satunya perubahan pada
 * elemen SIPP adalah kelas penyorot (dilepas saat langkah berganti/ditutup).
 * Warna dari token --s-* (diisi tema gelap) dengan cadangan di dalam var().
 */
(function panduanKasirModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPanduanKasir) return;

  const KELAS = "aleta-sisip aleta-pk";
  const ID_GAYA = "aleta-pk-gaya";
  const KELAS_SOROT = "aleta-pk-sorot";
  const BUKAN_SIPP = ".aleta-sisip, #aleta-panel-sipp, [data-aleta-tanda], .aleta-panel";
  const POLA_JURNAL_PERKARA = /\/detil_biaya(?:_ht|_teguran)?(?:\/|$)/i;
  const POLA_JURNAL_DAFTAR = /\/(?:jurnal_perkara_list|all_jurnal_perkara|jurnal_all_perkara)(?:\/|$)/i;

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const milikAleta = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(BUKAN_SIPP));
  const l1 = () => (globalThis.aletaSippIdeL1 && globalThis.aletaSippIdeL1.murni) || null;

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  /** Tampak di layar? .hide() SIPP = display:none; tanpa tata letak (uji) hanya gaya yang diperiksa. */
  function tampak(e) {
    const m = l1();
    if (m && typeof m.tampak === "function") return m.tampak(e);
    if (!e || !e.ownerDocument) return false;
    const w = e.ownerDocument.defaultView;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      const gaya = w && typeof w.getComputedStyle === "function" ? w.getComputedStyle(n) : null;
      if (gaya && (gaya.display === "none" || gaya.visibility === "hidden")) return false;
    }
    return true;
  }

  /** Elemen SIPP pertama dari daftar pemilih yang tampak (sisipan ALETA dikecualikan). */
  function pertama(doc, ...pemilih) {
    return cari(doc, pemilih, false);
  }

  /** Sisipan ALETA sendiri (tab Kasir, pita Isi dengan ALETA, Kasir harian) yang tampak - pemilihnya khas ALETA. */
  function pertamaAleta(doc, ...pemilih) {
    return cari(doc, pemilih, true);
  }

  function cari(doc, pemilih, milikAletaSaja) {
    for (const s of pemilih) {
      let daftar;
      try {
        daftar = doc.querySelectorAll(s);
      } catch {
        continue;
      }
      for (const e of daftar) if ((milikAletaSaja || !milikAleta(e)) && tampak(e)) return e;
    }
    return null;
  }

  /** Tombol/tautan SIPP bertulisan (atau bernilai) sesuai pola. */
  function cariTeks(doc, pola) {
    for (const e of doc.querySelectorAll("a, button, input[type=button], input[type=submit]")) {
      if (milikAleta(e) || !tampak(e)) continue;
      const t = sebaris(e.tagName === "INPUT" ? e.value : e.textContent);
      if (pola.test(t)) return e;
    }
    return null;
  }

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Hak: kasir + Admin/Super Admin
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Kembaran manajemen_surat/src/lib/matriks-peran.ts bolehPanduanKasir. Bila
   * portal mengirim golonganMenu, itulah yang berlaku (satu sumber); bila tidak
   * (portal lama), nama peran dan peran tambahan. Tanpa keterangan sama sekali:
   * tidak boleh (panduan bukan fitur yang boleh bocor ke peran lain).
   */
  function bolehPanduan(pengguna) {
    if (!pengguna || typeof pengguna !== "object") return false;
    if (Array.isArray(pengguna.golonganMenu)) return pengguna.golonganMenu.some((g) => g === "kasir" || g === "admin");
    const p = String(pengguna.peran || "").toLowerCase().replace(/[-_]+/g, " ").trim();
    if (/super|\badmin\b|administrator/.test(p)) return true;
    if (/kasir|keuangan|bendahara/.test(p)) return true;
    return Array.isArray(pengguna.peranTambahan) && pengguna.peranTambahan.some((x) => /kasir/i.test(String(x)));
  }

  async function bacaPengguna() {
    try {
      if (typeof muatPenggunaAleta === "function") {
        const p = await muatPenggunaAleta();
        if (p) return p;
      }
    } catch {
      /* tanpa akun = tanpa panduan */
    }
    try {
      if (typeof penggunaTerakhir !== "undefined") return penggunaTerakhir;
    } catch {
      /* belum ada */
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Langkah (urutan = urutan kerja kasir)
  // ──────────────────────────────────────────────────────────────────────────
  const LANGKAH = [
    // ── Jurnal keuangan per perkara ───────────────────────────────────────
    {
      kunci: "nomor",
      lingkup: "perkara",
      judul: "Pastikan perkaranya",
      teks: "Baca nomor perkara pada judul Buku Jurnal. Pastikan sama dengan perkara yang hendak dicatat sebelum menyimpan apa pun.",
      cari: (d) => judulJurnal(d),
    },
    {
      kunci: "kasir-aleta",
      lingkup: "perkara",
      judul: "Tombol Kasir ALETA",
      teks: "Tombol ini membuka tampilan Kasir perkara ini di jendela tengah layar: usulan baris jurnal dari keadaan perkara. Mulailah dari sini bila tidak ingin mencari tab Kasir di panel.",
      cari: (d) => pertamaAleta(d, "#aleta-kj-tombol"),
    },
    {
      kunci: "usulan",
      lingkup: "perkara",
      judul: "Baca usulan Kasir ALETA",
      teks: "Tab Kasir menyusun usulan baris jurnal dari keadaan perkara, per kejadian (panggilan, sidang ditunda, putusan, ikrar talak, tambahan panjar). Tiap kejadian bertanda sudah atau belum dicatat. Usulan hanya saran - Anda yang memutuskan.",
      cari: (d) => pertamaAleta(d, '[data-a30-fitur="kasir"]', '#aleta-panel-sipp [data-t7-tab="kasirKel"]'),
    },
    {
      kunci: "tambah",
      lingkup: "perkara",
      judul: "Tekan Tambah Biaya",
      teks: "Satu transaksi dicatat lewat satu jendela Tambah Biaya. Tekan tombol ini untuk membukanya; langkah berikutnya menyorot isian jendela itu.",
      cari: (d) => cariTeks(d, /^\s*\+?\s*tambah\s+biaya\s*$/i) || pertama(d, 'a[href*="add_biaya"], a[onclick*="add_biaya"], button[onclick*="add_biaya"]'),
    },
    {
      kunci: "tabel",
      lingkup: "perkara",
      judul: "Periksa baris jurnal",
      teks: "Sesudah disimpan, baris baru muncul di tabel Buku Jurnal. Periksa tanggal, uraian, jumlah, dan sisa; sunting lewat SIPP bila ada yang keliru.",
      cari: (d) => tabelJurnal(d),
    },
    // ── Daftar jurnal keuangan ────────────────────────────────────────────
    {
      kunci: "daftar",
      lingkup: "daftar",
      judul: "Pilih perkara",
      teks: "Daftar perkara yang punya jurnal keuangan. Buka perkara yang hendak dicatat; di dalamnya Anda dibawa ke Buku Jurnal perkara itu.",
      cari: (d) => tabelDaftar(d),
    },
    {
      kunci: "kasir-aleta-daftar",
      lingkup: "daftar",
      judul: "Tombol Kasir ALETA",
      teks: "Tombol ini membuka Kasir harian di jendela tengah layar: perkara yang bergerak pada satu tanggal, rekap, dan pengingat.",
      cari: (d) => pertamaAleta(d, "#aleta-kj-tombol"),
    },
    {
      kunci: "harian",
      lingkup: "daftar",
      judul: "Kasir harian untuk banyak perkara",
      teks: "Untuk banyak perkara sekaligus: lihat perkara yang bergerak pada satu tanggal, centang yang benar, lalu simpan berurutan. Rekap dan pengingat (sisa panjar, setor PNBP) ada di sini juga.",
      cari: (d) => pertamaAleta(d, '[data-mps-massal="kasir-harian"]'),
    },
    // ── Jendela Tambah Biaya ──────────────────────────────────────────────
    {
      kunci: "isi",
      lingkup: "borang",
      judul: "Isi dengan ALETA",
      teks: "Tekan Isi dengan ALETA: kolom yang masih kosong diisi dari usulan Kasir, yang ragu hanya ditawarkan. Anda tetap memeriksa tiap kolom - ALETA tidak pernah menekan Simpan.",
      cari: (d) => pertamaAleta(d, '.aleta-m1-pita[data-m1-jendela="jurnal"] [data-m1="isi"]', '.aleta-m1-pita[data-m1-jendela="jurnal"]'),
    },
    {
      kunci: "tanggal",
      lingkup: "borang",
      judul: "Tanggal transaksi",
      teks: "Tanggal uang diterima atau dikeluarkan, bukan tanggal hari ini bila berbeda.",
      cari: (d) => pertama(d, "#frm_add_biaya #tgl_transaksi", '#frm_add_biaya [name="tgl_transaksi"]'),
    },
    {
      kunci: "pihak",
      lingkup: "borang",
      judul: "Pihak",
      teks: "Pilih pihak yang membayar atau yang biayanya dicatat (Penggugat/Tergugat, Pemohon/Termohon).",
      cari: (d) => pertama(d, "#frm_add_biaya #fpihak_ke", '#frm_add_biaya [name="fpihak_ke"]'),
    },
    {
      kunci: "pembayar",
      lingkup: "borang",
      judul: "Nama pihak pembayar",
      teks: "Pilih nama orangnya sesuai bukti pembayaran. Kolom ini baru terisi pilihannya setelah pihak dipilih.",
      cari: (d) => pertama(d, "#frm_add_biaya #pihak_pembayar", '#frm_add_biaya [name="pihak_pembayar"]'),
    },
    {
      kunci: "kategori",
      lingkup: "borang",
      judul: "Kategori biaya",
      teks: "Panjar, panggilan, redaksi, meterai, dan sebagainya. Kategori menyempitkan pilihan Jenis Biaya di bawahnya.",
      cari: (d) => pertama(d, "#frm_add_biaya #kategori_biaya", '#frm_add_biaya [name="kategori_biaya"]'),
    },
    {
      kunci: "jenis",
      lingkup: "borang",
      judul: "Jenis biaya",
      teks: "Pilih jenis yang tepat; tarifnya bisa terisi sendiri oleh SIPP. Bila tarif tidak sesuai bukti, ubah jumlahnya.",
      cari: (d) => pertama(d, "#frm_add_biaya #jenis_biaya", '#frm_add_biaya [name="jenis_biaya"]'),
    },
    {
      kunci: "jurusita",
      lingkup: "borang",
      judul: "Jurusita (biaya panggilan)",
      teks: "Muncul hanya untuk biaya panggilan: pilih jurusita yang menyampaikan panggilan itu.",
      cari: (d) => pertama(d, "#frm_add_biaya #jurusita", '#frm_add_biaya [name="jurusita"]'),
    },
    {
      kunci: "jumlah",
      lingkup: "borang",
      judul: "Uraian dan jumlah",
      teks: "Isi jumlah rupiah persis seperti bukti. Uraian di atasnya menjelaskan transaksi untuk pembaca jurnal.",
      cari: (d) => pertama(d, "#frm_add_biaya #jumlah", '#frm_add_biaya [name="jumlah"]'),
    },
    {
      kunci: "simpan",
      lingkup: "borang",
      judul: "Simpan",
      teks: "Periksa sekali lagi nomor perkara dan jumlah, lalu tekan Simpan. Tombol ini hanya Anda yang menekan.",
      cari: (d) => pertama(d, "#frm_add_biaya #simpan_btn", '#frm_add_biaya input[type="submit"]', "#frm_add_biaya button[type=submit]"),
    },
  ];

  function judulJurnal(d) {
    for (const e of d.querySelectorAll("h1, h2, h3, h4, h5, caption")) {
      if (!milikAleta(e) && tampak(e) && /jurnal\s+keuangan\s+perkara/i.test(sebaris(e.textContent))) return e;
    }
    return null;
  }

  function tabelJurnal(d) {
    for (const t of d.querySelectorAll("table")) {
      if (milikAleta(t) || !tampak(t) || t.closest("#frm_add_biaya")) continue;
      if (/pemasukan|pengeluaran|saldo|sisa/i.test(sebaris(t.textContent))) return t;
    }
    return null;
  }

  function tabelDaftar(d) {
    for (const t of d.querySelectorAll("table")) {
      if (milikAleta(t) || !tampak(t) || t.closest("#frm_add_biaya")) continue;
      if (/nomor\s+perkara/i.test(sebaris(t.textContent)) || /\d+\/Pdt\.[A-Za-z]+\/\d{4}\//.test(t.textContent)) return t;
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lingkup & susunan langkah yang berlaku sekarang
  // ──────────────────────────────────────────────────────────────────────────
  /** "borang" selama jendela Tambah Biaya terbuka dan tampak; selain itu menurut alamat halaman; lainnya null. */
  function lingkup(doc) {
    const d = doc || document;
    const f = d.getElementById("frm_add_biaya");
    if (f && !milikAleta(f) && tampak(f)) return "borang";
    const jalur = String((d.defaultView && d.defaultView.location && d.defaultView.location.pathname) || (typeof location !== "undefined" ? location.pathname : ""));
    if (POLA_JURNAL_PERKARA.test(jalur)) return "perkara";
    if (POLA_JURNAL_DAFTAR.test(jalur)) return "daftar";
    return null;
  }

  /** Langkah yang elemennya tampak sekarang, urut kerja: [{ def, urutan, el }]. */
  function susunLangkah(doc) {
    const d = doc || document;
    const ling = lingkup(d);
    if (!ling) return [];
    const hasil = [];
    LANGKAH.forEach((def, urutan) => {
      if (def.lingkup !== ling) return;
      let e = null;
      try {
        e = def.cari(d);
      } catch {
        e = null;
      }
      if (e && tampak(e)) hasil.push({ def, urutan, el: e });
    });
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gaya (token --s-* dengan cadangan di dalam var(); tanpa aturan tema gelap)
  // ──────────────────────────────────────────────────────────────────────────
  const GAYA = `
.aleta-pk-peluncur{position:fixed;left:14px;bottom:14px;z-index:2147482000;font:600 13px/1.4 inherit;padding:6px 14px;border:1px solid var(--s-hijau,#007640);border-radius:999px;background:var(--s-hijau,#007640);color:var(--s-tulisan-atas,#fff);cursor:pointer}
.aleta-pk-peluncur:hover{filter:brightness(1.1)}
.aleta-pk-peluncur[hidden],.aleta-pk-kartu[hidden]{display:none}
.aleta-pk-kartu{position:fixed;left:14px;bottom:56px;z-index:2147482000;box-sizing:border-box;width:min(340px,calc(100vw - 28px));padding:10px 12px;border:1px solid var(--s-garis-hijau,#9fc9b2);border-left:4px solid var(--s-hijau,#007640);border-radius:6px;background:var(--s-permukaan,#fff);color:var(--s-tulisan,#1f2a24);font:13px/1.5 inherit;text-align:left;box-shadow:0 6px 24px rgba(0,0,0,.28)}
.aleta-pk-kepala{font-size:12px;color:var(--s-tulisan-lembut,#55655c);margin-bottom:2px}
.aleta-pk-judul{font-weight:700;font-size:14px;color:var(--s-hijau-terang,#008c4b);margin-bottom:4px}
.aleta-pk-teks{margin:0 0 8px;color:var(--s-tulisan,#1f2a24)}
.aleta-pk-baris{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.aleta-pk-tombol{font:inherit;font-size:13px;padding:3px 12px;border:1px solid var(--s-garis,#c9d4ce);border-radius:999px;background:var(--s-permukaan-2,#fff);color:var(--s-tulisan,#1f2a24);cursor:pointer}
.aleta-pk-tombol.aleta-pk-utama{background:var(--s-hijau,#007640);border-color:var(--s-hijau,#007640);color:var(--s-tulisan-atas,#fff);font-weight:600}
.aleta-pk-tombol:disabled{opacity:.5;cursor:default}
.aleta-pk-tutup{margin-left:auto}
.${KELAS_SOROT}{outline:3px solid var(--s-kuning,#e0a800)!important;outline-offset:2px!important}
`;

  function pasangGaya(doc) {
    if (doc.getElementById(ID_GAYA)) return;
    const s = doc.createElement("style");
    s.id = ID_GAYA;
    s.className = KELAS;
    s.textContent = GAYA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan & tampilan
  // ──────────────────────────────────────────────────────────────────────────
  const S = { diizinkan: false, aktif: false, urutan: -1, ling: null, sorot: null, peluncur: null, kartu: null, pengamat: null, jadwal: null };

  function lepasSorot() {
    if (S.sorot && S.sorot.classList) {
      S.sorot.classList.remove(KELAS_SOROT);
      // Elemen SIPP kembali persis seperti semula: tanpa atribut class kosong sisa penyorot.
      if (!S.sorot.getAttribute("class")) S.sorot.removeAttribute("class");
    }
    S.sorot = null;
  }

  function gambarKartu(daftar, indeks) {
    const k = S.kartu;
    const l = daftar[indeks];
    k.textContent = "";
    k.appendChild(el("div", "aleta-pk-kepala", `Panduan kasir · langkah ${indeks + 1} dari ${daftar.length}`));
    k.appendChild(el("div", "aleta-pk-judul", l.def.judul));
    k.appendChild(el("p", "aleta-pk-teks", l.def.teks));
    const baris = el("div", "aleta-pk-baris");
    const sebelum = el("button", "aleta-pk-tombol", "Sebelumnya");
    sebelum.type = "button";
    sebelum.setAttribute("data-pk", "sebelum");
    sebelum.disabled = indeks === 0;
    sebelum.addEventListener("click", () => pindah(-1));
    const berikut = el("button", "aleta-pk-tombol aleta-pk-utama", indeks === daftar.length - 1 ? "Selesai" : "Berikut");
    berikut.type = "button";
    berikut.setAttribute("data-pk", "berikut");
    berikut.addEventListener("click", () => pindah(1));
    const tutup = el("button", "aleta-pk-tombol aleta-pk-tutup", "Tutup");
    tutup.type = "button";
    tutup.setAttribute("data-pk", "tutup");
    tutup.addEventListener("click", () => tutupPanduan());
    baris.append(sebelum, berikut, tutup);
    k.appendChild(baris);
  }

  /** Sorot langkah `l` dan gambar kartunya. */
  function tampilkan(daftar, indeks) {
    lepasSorot();
    const l = daftar[indeks];
    S.urutan = l.urutan;
    S.sorot = l.el;
    l.el.classList.add(KELAS_SOROT);
    try {
      if (typeof l.el.scrollIntoView === "function") l.el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      /* kenyamanan */
    }
    gambarKartu(daftar, indeks);
    S.kartu.hidden = false;
  }

  function pastikanWadah(doc) {
    pasangGaya(doc);
    if (!S.peluncur || !S.peluncur.isConnected) {
      const b = el("button", `${KELAS} aleta-pk-peluncur`, "Panduan kasir");
      b.type = "button";
      b.title = "Sorot langkah kerja kasir di halaman ini, satu per satu";
      b.setAttribute("data-pk", "peluncur");
      b.addEventListener("click", () => (S.aktif ? tutupPanduan() : mulai()));
      (doc.body || doc.documentElement).appendChild(b);
      S.peluncur = b;
    }
    if (!S.kartu || !S.kartu.isConnected) {
      const k = el("div", `${KELAS} aleta-pk-kartu`);
      k.setAttribute("role", "dialog");
      k.setAttribute("aria-label", "Panduan kasir");
      k.setAttribute("data-pk", "kartu");
      k.hidden = true;
      (doc.body || doc.documentElement).appendChild(k);
      S.kartu = k;
    }
  }

  function bongkarWadah() {
    lepasSorot();
    if (S.kartu) S.kartu.remove();
    if (S.peluncur) S.peluncur.remove();
    S.kartu = null;
    S.peluncur = null;
    S.aktif = false;
    S.urutan = -1;
    S.ling = null;
  }

  function tutupPanduan() {
    S.aktif = false;
    S.urutan = -1;
    S.ling = null;
    lepasSorot();
    if (S.kartu) S.kartu.hidden = true;
  }

  /** Buka panduan dari langkah pertama yang tampak. Mengembalikan jumlah langkah (0 = tidak ada yang bisa disorot). */
  function mulai(doc) {
    const d = doc || document;
    if (!S.diizinkan) return 0;
    const daftar = susunLangkah(d);
    if (!daftar.length) return 0;
    pastikanWadah(d);
    S.aktif = true;
    S.ling = lingkup(d);
    tampilkan(daftar, 0);
    return daftar.length;
  }

  /** arah +1 / -1 menurut URUTAN kerja; langkah yang kini tersembunyi dilewati. +1 di langkah terakhir = selesai. */
  function pindah(arah) {
    if (!S.aktif) return;
    const d = document;
    const daftar = susunLangkah(d);
    if (!daftar.length) return tutupPanduan();
    let indeks;
    if (arah > 0) {
      indeks = daftar.findIndex((x) => x.urutan > S.urutan);
      if (indeks < 0) return tutupPanduan();
    } else {
      indeks = -1;
      daftar.forEach((x, i) => {
        if (x.urutan < S.urutan) indeks = i;
      });
      if (indeks < 0) indeks = 0;
    }
    tampilkan(daftar, indeks);
  }

  /**
   * Dipanggil saat halaman berubah (jendela Tambah Biaya dibuka/ditutup, tabel
   * termuat, medan disembunyikan): peluncur ikut ada/tidaknya langkah; panduan
   * yang berjalan pindah ke langkah pertama bila lingkupnya berganti, atau ke
   * langkah terdekat bila yang disorot menghilang.
   */
  function segarkan(doc) {
    const d = doc || document;
    if (!S.diizinkan) return;
    const daftar = susunLangkah(d);
    if (!daftar.length) {
      if (S.aktif) tutupPanduan();
      if (S.peluncur) S.peluncur.hidden = true;
      return;
    }
    pastikanWadah(d);
    S.peluncur.hidden = false;
    if (!S.aktif) return;
    const ling = lingkup(d);
    if (ling !== S.ling) {
      S.ling = ling;
      tampilkan(daftar, 0);
      return;
    }
    const i = daftar.findIndex((x) => x.urutan === S.urutan);
    if (i >= 0) {
      if (daftar[i].el !== S.sorot) tampilkan(daftar, i);
      else gambarKartu(daftar, i);
      return;
    }
    const j = daftar.findIndex((x) => x.urutan > S.urutan);
    tampilkan(daftar, j >= 0 ? j : daftar.length - 1);
  }

  /** Hanya sisipan panduan sendiri yang diabaikan: sisipan ALETA lain (tombol Kasir, pita Isi) mengubah langkah yang tersedia. */
  const milikSendiri = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(".aleta-pk"));

  function relevan(m) {
    if (milikSendiri(m.target)) return false;
    if (m.type === "childList") {
      const n = [...m.addedNodes, ...m.removedNodes];
      if (n.length && n.every((x) => x.nodeType !== 1 || milikSendiri(x))) return false;
    }
    return true;
  }

  function awasi(doc) {
    if (S.pengamat || typeof MutationObserver !== "function") return;
    S.pengamat = new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
      if (!daftar.some(relevan)) return;
      if (S.jadwal) clearTimeout(S.jadwal);
      S.jadwal = setTimeout(() => {
        S.jadwal = null;
        segarkan(doc);
      }, 150);
    });
    S.pengamat.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
  }

  async function pasang(doc) {
    const d = doc || document;
    if (modeLama()) return false;
    const pengguna = await bacaPengguna();
    S.diizinkan = bolehPanduan(pengguna);
    if (!S.diizinkan) {
      bongkarWadah();
      return false;
    }
    awasi(d);
    segarkan(d);
    return true;
  }

  const api = {
    pasang,
    mulai,
    tutup: tutupPanduan,
    berikut: () => pindah(1),
    sebelumnya: () => pindah(-1),
    segarkan,
    keadaan: () => ({ aktif: S.aktif, diizinkan: S.diizinkan, langkah: S.urutan >= 0 ? LANGKAH[S.urutan].kunci : null }),
    murni: { bolehPanduan, lingkup, susunLangkah, tampak, LANGKAH },
  };
  globalThis.aletaPanduanKasir = api;

  if (typeof document !== "undefined" && document.readyState !== "loading") void pasang(document);
  else if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => void pasang(document), { once: true });
})();
