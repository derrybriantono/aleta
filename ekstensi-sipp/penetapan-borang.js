"use strict";

/**
 * ============================================================================
 * ISI OTOMATIS DI BORANG PENETAPAN SIPP (19 Okt 2026, permintaan hakim no. 1)
 * ============================================================================
 *
 * Tombol kecil "Isi otomatis" DI DALAM jendela SIPP sendiri - Penetapan
 * Majelis Hakim (form#frm_majelis), Penunjukan Panitera Pengganti
 * (form#frm_panitera), Penunjukan Juru Sita (form#frm_juru_sita), dan
 * Penetapan Hari Sidang (form#frm_sidang_pertama). Ditekan: muncul panel
 * saran ringkas - majelis (yang ber-kode SK lebih dulu), ketua/anggota,
 * panitera pengganti, juru sita, tanggal sidang (hari libur tidak dapat
 * dipilih), jam, ruang, dan sidang keliling - tiap pejabat dengan "Ganti".
 *
 * SATU SUMBER DENGAN PANEL. Tidak ada rumus saran di berkas ini:
 *   - usulan          ambilUsulanPenunjukan (konten.js) -> bot penunjukan,
 *                     sumber yang sama dengan kartu Penetapan di panel;
 *   - majelis dipilih ambilUsulanPenunjukan(nomor, hakimId) - PP menurut SK
 *                     dan JS menurut beban dihitung ulang bot (muatUlangUsulan
 *                     panel memakai jalan yang sama);
 *   - nilai kolom     idUntukTulis (urutan menang: susunan > per orang >
 *                     usulan) dan susunanTerpilih/pilihanDari;
 *   - hari libur      masalahTanggalSidang + ccBukanHariKerja (SKB + libur
 *                     tambahan Pengaturan);
 *   - ruang sidang    muatRuangan (sifat dalam gedung/keliling/terpadu).
 *
 * TIDAK MENULIS. "Terapkan ke borang" hanya MENGISI kolom borang SIPP lewat
 * kirimKeJembatan (satu pintu: penjaga tanda ALETA, mode latihan/kering,
 * jejak + pulihkan). Tidak ada tekanan Simpan, tidak ada jalur tulis baru;
 * petugas sendiri yang menekan Simpan SIPP. Kolom yang dikunci SIPP (Smart
 * Majelis MA) dilewati dan disebutkan - tombol Tinjau tetap ditekan petugas.
 *
 * Tidak ada kata ALETA di nilai yang diisikan (diperiksa dua kali: di sini dan
 * di kirimKeJembatan). Teks di layar panel boleh.
 *
 * Sisipan berkelas aleta-sisip (diabaikan pengamat konten.js), semua tombol
 * type="button", dan panelnya berdiri DI LUAR <form> sehingga tidak ikut
 * terkirim. Tampilan Lama tidak berubah (alatUjiMode() === "lama").
 */
(function penetapanBorangModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPenetapanBorang) return;

  const KELAS = "aleta-sisip aleta-pb";
  const ID_GAYA = "aleta-pb-gaya";
  const KUNCI_INGAT = "penetapanBorangIngat";
  const UMUR_INGAT_MS = 6 * 60 * 60 * 1000;
  // Bawaan jadwal sidang pertama mesin tulis bot (JADWAL_BAWAAN di
  // penetapanTulisService: ruang 1, 09:00, "Sidang Pertama"). Usulan bot belum
  // membawa jam/agenda; bila kelak membawanya (phs.jam / phs.agenda), itu yang
  // dipakai.
  const JAM_BAWAAN = "09:00";
  const AGENDA_BAWAAN = "Sidang Pertama";
  const RUANG_BAWAAN = "1";
  const PILIHAN_JAM = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00"];
  const POLA_NOMOR = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;
  const BUKAN_SIPP = ".aleta-sisip, #aleta-panel-sipp, [data-aleta-tanda], .aleta-panel";

  const BORANG = [
    { kode: "pmh", id: "frm_majelis", judul: "Penetapan Majelis Hakim", tanggal: "#tgl_penetapan_majelis" },
    { kode: "ppp", id: "frm_panitera", judul: "Penunjukan Panitera Pengganti", tanggal: "#tgl_penunjukan_panitera" },
    { kode: "pjs", id: "frm_juru_sita", judul: "Penunjukan Juru Sita", tanggal: "#tgl_penunjukan_juru_sita" },
    { kode: "phs", id: "frm_sidang_pertama", judul: "Penetapan Hari Sidang", tanggal: "#tgl_penetapan_sidang_pertama" },
  ];

  const GAYA = `
.aleta-sisip.aleta-pb{clear:both;margin:4px 0 8px;padding:6px 10px;border-left:3px solid #2f9e44;background:rgba(47,158,68,.10);color:#222;text-align:left;font-size:13px;line-height:1.5}
.aleta-pb-kepala{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.aleta-pb-tombol{font:inherit;padding:3px 12px;border:1px solid #c9d4ce;border-radius:3px;background:#fff;color:#222;cursor:pointer;line-height:1.4}
.aleta-pb-tombol.aleta-pb-utama{background:#007640;border-color:#007640;color:#fff;font-weight:600}
.aleta-pb-tombol:disabled{opacity:.55;cursor:default}
.aleta-pb-ganti{font:inherit;padding:0 8px;margin-left:6px;border:1px solid #9bb5a6;border-radius:999px;background:#fff;color:#14532d;cursor:pointer;font-size:12px}
.aleta-pb-isi{margin-top:6px;padding:6px 8px;background:#fff;border:1px solid #d6e4d8;border-radius:4px}
.aleta-pb-baris{display:grid;grid-template-columns:150px 1fr;gap:2px 8px;padding:3px 0;border-bottom:1px dotted #e1e8e3}
.aleta-pb-baris:last-child{border-bottom:0}
.aleta-pb-label{color:#555}
.aleta-pb-nilai{font-weight:600;color:#14532d}
.aleta-pb-sebab{grid-column:2;color:#666;font-size:12px}
.aleta-pb-pilih{grid-column:2;max-width:100%;font:inherit;padding:2px 4px}
.aleta-pb-awas{margin:4px 0;padding:3px 9px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.12);color:#5c3d00}
.aleta-pb-kabar{margin-top:6px;color:#333}
.aleta-pb-kabar:empty{display:none}
.aleta-pb-gagal{color:#b42318;font-weight:600}
.aleta-pb-kaki{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:8px}
`;

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, kelas) {
    const b = el("button", `aleta-pb-tombol${kelas ? ` ${kelas}` : ""}`, teks);
    b.type = "button";
    return b;
  }
  const milikAleta = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(BUKAN_SIPP));
  // Fungsi konten.js berada di lingkup global skrip konten yang sama; typeof
  // aman untuk nama yang belum ada.
  const sebutTgl = (iso) => (typeof sebutTanggal === "function" ? sebutTanggal(iso) : String(iso || ""));
  const sebutBbn = (x) => (typeof sebutBeban === "function" ? sebutBeban(x) : "");
  /** "2026-10-21" -> "21/10/2026", format kolom tanggal SIPP. */
  function keSipp(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").slice(0, 10));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  }
  function liburDari(iso) {
    const t = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
    return typeof ccBukanHariKerja === "function" ? ccBukanHariKerja(t) : "";
  }
  /** Teks ALETA tidak pernah diisikan - pemeriksaan kedua sesudah kirimKeJembatan. */
  const bertandaAleta = (x) => /aleta/i.test(String(x == null ? "" : x));

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  function kenali(form) {
    if (!form || form.nodeType !== 1 || String(form.tagName).toLowerCase() !== "form") return null;
    const b = BORANG.find((x) => x.id === form.id);
    if (!b) return null;
    // Hanya borang TAMBAH. Borang edit SIPP mengubah penetapan yang sudah
    // tercatat - itu bukan tempat saran penetapan baru.
    const aksi = String(form.getAttribute("action") || "");
    if (/f_validate_input_edit/i.test(aksi)) return null;
    const hAksi = form.querySelector("#action");
    if (hAksi && String(hAksi.value || "").toLowerCase() === "edit") return null;
    return b;
  }

  /** Nomor perkara dari baris "Nomor Perkara" borang itu sendiri. */
  function nomorDariBorang(form) {
    for (const td of Array.from(form.querySelectorAll("td"))) {
      if (!/^nomor\s+perkara$/i.test(sebaris(td.textContent))) continue;
      const sel = td.nextElementSibling;
      const m = POLA_NOMOR.exec(sebaris(sel && sel.textContent));
      if (m) return m[1];
    }
    const m = POLA_NOMOR.exec(sebaris(form.textContent));
    return m ? m[1] : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Ingatan antar-borang (PMH -> PPP/PJS/PHS) - per nomor, berumur pendek
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Borang SIPP dibuka satu per satu dan halaman dimuat ulang sesudah Simpan.
  // Pilihan PP/JS/hari yang diubah tangan di borang PMH karena itu diingat
  // per NOMOR perkara, paling lama 6 jam, dan hanya dipakai bila ketua
  // majelisnya masih sama - pilihan yang tertinggal dari majelis lain tidak
  // boleh menyelinap ke penunjukan berikutnya.
  const ingatan = new Map();
  async function bacaIngat(nomor) {
    if (ingatan.has(nomor)) return ingatan.get(nomor);
    try {
      const s = (await chrome.storage.local.get(KUNCI_INGAT)) || {};
      const semua = s[KUNCI_INGAT] || {};
      const satu = semua[nomor];
      if (satu && Date.now() - Number(satu.waktu || 0) < UMUR_INGAT_MS) return satu;
    } catch {
      /* ingatan hanya kenyamanan */
    }
    return null;
  }
  async function tulisIngat(nomor, isi) {
    const satu = { ...isi, waktu: Date.now() };
    ingatan.set(nomor, satu);
    try {
      const s = (await chrome.storage.local.get(KUNCI_INGAT)) || {};
      const semua = s[KUNCI_INGAT] || {};
      for (const k of Object.keys(semua)) {
        if (Date.now() - Number((semua[k] && semua[k].waktu) || 0) >= UMUR_INGAT_MS) delete semua[k];
      }
      semua[nomor] = satu;
      await chrome.storage.local.set({ [KUNCI_INGAT]: semua });
    } catch {
      /* ingatan hanya kenyamanan */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan satu borang
  // ──────────────────────────────────────────────────────────────────────────
  function ketuaUsulan(usulan) {
    const t = usulan && usulan.tercatat;
    if (t && t.ada && Number(t.ketuaHakimId) > 0) return Number(t.ketuaHakimId);
    const a = (usulan && usulan.pmh && usulan.pmh.anggota) || [];
    return Number(a[0] && (a[0].hakimId ?? a[0].id)) || 0;
  }

  async function muat(st, hakimId) {
    st.memuat = true;
    gambar(st);
    try {
      const data = await ambilUsulanPenunjukan(st.nomor, hakimId);
      st.usulan = data.usulan;
      st.galat = "";
      if (typeof muatRuangan === "function") {
        void Promise.resolve(muatRuangan()).then(() => gambar(st)).catch(() => undefined);
      }
    } catch (galat) {
      st.galat = String((galat && galat.message) || galat).slice(0, 200);
    } finally {
      st.memuat = false;
    }
    gambar(st);
  }

  async function bukaPanel(st) {
    st.buka = true;
    if (!st.nomor) st.nomor = nomorDariBorang(st.form);
    if (!st.nomor) {
      st.galat = "Nomor perkara tidak terbaca di formulir ini.";
      gambar(st);
      return;
    }
    if (!st.usulan) {
      const ingat = await bacaIngat(st.nomor);
      await muat(st, ingat && st.borang.kode === "pmh" && Array.isArray(ingat.majelisDipilih) ? ingat.majelisDipilih : undefined);
      if (ingat && st.usulan) {
        // Majelis yang dipilih di borang PMH tadi: hanya bila ketuanya masih
        // ketua usulan/tercatat sekarang.
        if (Number(ingat.ketuaId) > 0 && Number(ingat.ketuaId) === ketuaUsulan(st.usulan)) {
          for (const k of ["ppp", "pjs", "phs", "ruangan", "sidkel", "jam", "agenda"]) {
            if (ingat[k] !== undefined && ingat[k] !== "") st.pilihan[k] = ingat[k];
          }
          if (st.borang.kode === "pmh" && ingat.majelis) st.pilihan.majelis = ingat.majelis;
        }
      }
      gambar(st);
    } else {
      gambar(st);
    }
  }

  /** Majelis dipilih: PP (menurut SK) dan JS (menurut beban) disusun ulang bot. */
  async function pilihMajelis(st, kunci) {
    const pmh = (st.usulan && st.usulan.pmh) || {};
    const susunan = (pmh.susunanTerpakai || []).find((x) => String(x.kunci) === String(kunci));
    if (!susunan) return;
    st.pilihan.majelis = String(kunci);
    st.pilihan.pmhKursi = [];
    // Terpaut: PP dan JS kembali ke saran untuk majelis yang baru. Sesudahnya
    // tiap orang tetap dapat diganti satu per satu.
    st.pilihan.ppp = "";
    st.pilihan.pjs = "";
    st.majelisDipilih = susunan.hakimId;
    st.terbuka = {};
    await muat(st, susunan.hakimId);
  }

  /** Satu kursi diganti: susunannya menjadi pilihan per orang, PP/JS dipautkan ulang. */
  async function gantiKursi(st, urutan, hakimId) {
    const kini = kursiSekarang(st);
    if (!kini) return;
    const baru = kini.slice();
    baru[urutan] = Number(hakimId);
    if (new Set(baru.map(String)).size !== baru.length) {
      st.tolak = "Satu hakim tidak dapat menduduki dua kursi.";
      gambar(st);
      return;
    }
    st.pilihan.majelis = "";
    st.pilihan.pmhKursi = baru.map(String);
    st.pilihan.ppp = "";
    st.pilihan.pjs = "";
    st.majelisDipilih = baru;
    st.terbuka = {};
    await muat(st, baru);
  }

  function kursiSekarang(st) {
    const id = idUntukTulis("pmh", st.usulan || {}, st.pilihan);
    return id && Array.isArray(id.hakimId) ? id.hakimId : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Ruang sidang - dari pilihan borang SIPP sendiri, sifatnya dari portal
  // ──────────────────────────────────────────────────────────────────────────
  function daftarRuang(st) {
    const kotak = st.form.querySelector("#ruangan");
    if (!kotak || !kotak.options) return [];
    const sifatPortal = new Map(
      (Array.isArray(typeof ruanganTersimpan !== "undefined" ? ruanganTersimpan : null) ? ruanganTersimpan : []).map((r) => [String(r.id), r])
    );
    return Array.from(kotak.options)
      .map((o) => {
        const nilai = String(o.value || "");
        const id = nilai.split("|")[0];
        if (!/^\d+$/.test(id)) return null;
        const nama = sebaris(o.textContent);
        const p = sifatPortal.get(id);
        const sifat = (p && p.sifat) || (/keliling/i.test(nama) ? "keliling" : /terpadu/i.test(nama) ? "terpadu" : "dalam-gedung");
        return { id, nilai, nama, sifat, dipakai: p ? p.dipakai : undefined };
      })
      .filter(Boolean);
  }
  function ruangTerpilih(st, daftar) {
    const pilih = String(st.pilihan.ruangan || "");
    if (pilih && daftar.some((r) => r.id === pilih)) return pilih;
    if (st.pilihan.sidkel) {
      const keliling = daftar.find((r) => r.sifat === "keliling");
      if (keliling) return keliling.id;
    }
    if (daftar.some((r) => r.id === RUANG_BAWAAN)) return RUANG_BAWAAN;
    const dalam = daftar.find((r) => r.sifat === "dalam-gedung");
    return dalam ? dalam.id : daftar[0] ? daftar[0].id : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Nilai yang akan diisikan - dari idUntukTulis (urutan menang panel)
  // ──────────────────────────────────────────────────────────────────────────
  function rencanaIsi(st) {
    const usulan = st.usulan || {};
    const f = st.form;
    const kode = st.borang.kode;
    const isi = [];
    const masalah = [];
    const tambah = (penunjuk, jenisMedan, nilai, label) => {
      if (!f.querySelector(penunjuk)) return;
      isi.push({ penunjuk, jenisMedan, nilai: String(nilai), label });
    };

    const tglPenetapan = keSipp(usulan.tanggalPenetapan);
    if (tglPenetapan) tambah(st.borang.tanggal, "tanggal", tglPenetapan, "Tanggal penetapan");

    if (kode === "pmh") {
      const id = idUntukTulis("pmh", usulan, st.pilihan);
      if (!id) {
        masalah.push("Susunan majelis belum lengkap - pilih majelis atau ketiga hakimnya.");
      } else {
        const tunggal = ((usulan.pmh && usulan.pmh.bentuk) || "") === "tunggal" || id.hakimId.length === 1;
        tambah("#model_hakim", "pilih", tunggal ? "tunggal" : "majelis", "Majelis/Hakim tunggal");
        if (tunggal) {
          if (f.querySelector("#hakim_tunggal")) tambah("#hakim_tunggal", "pilih", id.hakimId[0], "Hakim tunggal");
          else tambah("#hakim_ketua", "pilih", id.hakimId[0], "Hakim tunggal");
        } else {
          tambah("#hakim_ketua", "pilih", id.hakimId[0], "Hakim ketua");
          tambah("#hakim_anggota1", "pilih", id.hakimId[1], "Hakim anggota 1");
          tambah("#hakim_anggota2", "pilih", id.hakimId[2], "Hakim anggota 2");
          // Kursi 3-4 sisa rekomendasi sebelumnya dikosongkan; tanpa itu
          // majelis tiga orang tersimpan berlima.
          for (const [p, l] of [["#hakim_anggota3", "Hakim anggota 3"], ["#hakim_anggota4", "Hakim anggota 4"]]) {
            const k = f.querySelector(p);
            if (k && String(k.value || "0") !== "0" && Array.from(k.options || []).some((o) => o.value === "0")) tambah(p, "pilih", "0", l);
          }
        }
      }
    } else if (kode === "ppp") {
      const id = idUntukTulis("ppp", usulan, st.pilihan);
      if (id) tambah("#panitera1", "pilih", id.petugasId, "Panitera pengganti");
      else masalah.push("Panitera pengganti belum dapat disarankan.");
    } else if (kode === "pjs") {
      const id = idUntukTulis("pjs", usulan, st.pilihan);
      if (id) tambah("#juru_sita1", "pilih", id.petugasId, "Juru sita");
      else masalah.push("Juru sita belum dapat disarankan.");
    } else if (kode === "phs") {
      const salah = typeof masalahTanggalSidang === "function" ? masalahTanggalSidang(usulan, st.pilihan) : "";
      const id = idUntukTulis("phs", usulan, st.pilihan);
      if (salah) masalah.push(salah);
      else if (!id) masalah.push("Tanggal sidang belum dapat disarankan - pilih tanggalnya.");
      else tambah("#tgl_sidang_pertama", "tanggal", keSipp(id.tanggalSidang), "Tanggal sidang");
      tambah("#jam_sidang_pertama", "teks", st.pilihan.jam || (usulan.phs && usulan.phs.jam) || JAM_BAWAAN, "Jam sidang");
      const daftar = daftarRuang(st);
      const ruang = daftar.find((r) => r.id === ruangTerpilih(st, daftar));
      if (ruang) tambah("#ruangan", "pilih", ruang.nilai, "Ruang sidang");
      const agenda = st.pilihan.agenda !== undefined ? st.pilihan.agenda : nilaiAgendaAwal(st);
      if (sebaris(agenda)) tambah("#isi_agenda_sidang", "teks", agenda, "Agenda sidang");
    }

    for (const x of isi) {
      if (bertandaAleta(x.nilai)) masalah.push(`${x.label}: teks ini tidak diisikan ke SIPP.`);
    }
    return { isi, masalah };
  }

  function nilaiAgendaAwal(st) {
    const kotak = st.form.querySelector("#isi_agenda_sidang");
    const kini = sebaris(kotak && kotak.value);
    return kini || (st.usulan && st.usulan.phs && st.usulan.phs.agenda) || AGENDA_BAWAAN;
  }

  /** Mengisi kolom borang. TIDAK menekan Simpan. */
  async function terapkan(st) {
    const { isi, masalah } = rencanaIsi(st);
    if (masalah.length) {
      st.kabar = { teks: masalah.join(" "), gagal: true };
      gambar(st);
      return { ok: false, terisi: 0, masalah };
    }
    st.menerapkan = true;
    gambar(st);
    let terisi = 0;
    const terkunci = [];
    const gagal = [];
    for (const x of isi) {
      const k = st.form.querySelector(x.penunjuk);
      if (!k) continue;
      // Kolom yang dikunci SIPP (mis. sesudah Smart Majelis MA merekomendasikan
      // majelis) tidak terkirim walau diisi. Dilewati dan disebutkan.
      if (k.disabled) {
        if (String(k.value) !== x.nilai) terkunci.push(x.label);
        continue;
      }
      if (String(k.value) === x.nilai) {
        terisi += 1;
        continue;
      }
      const jawab = await kirimKeJembatan({ jenis: "isi", penunjuk: x.penunjuk, jenisMedan: x.jenisMedan, nilai: x.nilai, label: x.label });
      if (jawab && jawab.ok) terisi += 1;
      else gagal.push(`${x.label} (${(jawab && jawab.alasan) || "gagal"})`);
    }
    st.menerapkan = false;
    const kalimat = [];
    kalimat.push(`${terisi} kolom terisi. Periksa formulir, lalu tekan Simpan SIPP sendiri.`);
    if (terkunci.length) {
      const ism = st.form.querySelector("#ism");
      kalimat.push(
        `${terkunci.join(", ")} dikunci SIPP${ism && String(ism.value) === "1" ? " (rekomendasi Smart Majelis)" : ""} - tekan Tinjau di formulir bila hendak mengganti, isi Keterangan, lalu Terapkan lagi.`
      );
    }
    if (gagal.length) kalimat.push(`Tidak terisi: ${gagal.join(", ")}.`);
    st.kabar = { teks: kalimat.join(" "), gagal: gagal.length > 0 };
    await tulisIngat(st.nomor, {
      ketuaId: (() => {
        const k = st.borang.kode === "pmh" ? kursiSekarang(st) : null;
        return k && k[0] ? Number(k[0]) : ketuaUsulan(st.usulan);
      })(),
      majelis: st.pilihan.majelis || "",
      majelisDipilih: st.majelisDipilih || null,
      ppp: st.pilihan.ppp || "",
      pjs: st.pilihan.pjs || "",
      phs: st.pilihan.phs || "",
      ruangan: st.pilihan.ruangan || "",
      sidkel: Boolean(st.pilihan.sidkel),
      jam: st.pilihan.jam || "",
      agenda: st.pilihan.agenda !== undefined ? st.pilihan.agenda : "",
    });
    gambar(st);
    return { ok: gagal.length === 0, terisi, terkunci, gagal };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar
  // ──────────────────────────────────────────────────────────────────────────
  function baris(induk, label, nilai, sebab) {
    const b = el("div", "aleta-pb-baris");
    b.appendChild(el("span", "aleta-pb-label", label));
    const n = el("span", "aleta-pb-nilai", nilai || "-");
    b.appendChild(n);
    if (sebab) b.appendChild(el("span", "aleta-pb-sebab", sebab));
    induk.appendChild(b);
    return { b, n };
  }

  /** Baris pejabat + tombol Ganti yang membuka pilihan. */
  function barisGanti(st, induk, kunci, label, nilai, sebab, pilihan, terpilih, saatPilih) {
    const { b, n } = baris(induk, label, nilai, sebab);
    b.setAttribute("data-pb", kunci);
    if (!pilihan || pilihan.length < 2) return b;
    const g = el("button", "aleta-pb-ganti", st.terbuka[kunci] ? "Tutup" : "Ganti");
    g.type = "button";
    g.setAttribute("data-pb-ganti", kunci);
    g.addEventListener("click", () => {
      st.terbuka[kunci] = !st.terbuka[kunci];
      gambar(st);
    });
    n.appendChild(g);
    if (st.terbuka[kunci]) {
      const s = el("select", "aleta-pb-pilih");
      s.setAttribute("data-pb-pilih", kunci);
      for (const x of pilihan) {
        const o = el("option", "", x.label);
        o.value = String(x.id);
        if (x.mati) o.disabled = true;
        if (String(x.id) === String(terpilih)) o.selected = true;
        s.appendChild(o);
      }
      s.disabled = false;
      s.addEventListener("change", () => void saatPilih(s.value));
      b.appendChild(s);
    }
    return b;
  }

  const namaOrang = (daftar, id) => {
    const x = (daftar || []).find((o) => String(o.hakimId ?? o.id) === String(id));
    return x ? x.nama : "";
  };

  function gambarPmh(st, isi) {
    const usulan = st.usulan;
    const pmh = usulan.pmh || {};
    const kursi = kursiSekarang(st) || [];
    const kolam = pmh.hitungan || [];
    const susunan = [...(pmh.susunanTerpakai || [])];
    // Yang ber-kode SK lebih dulu (bot sudah mengurutkan; diurut stabil lagi).
    susunan.sort((a, b) => (a.majelisKode ? 0 : 1) - (b.majelisKode ? 0 : 1));
    const kunciKini = st.pilihan.majelis || (typeof kunciSusunan === "function" ? kunciSusunan(kursi) : kursi.join("-"));
    const terpilih = susunan.find((x) => String(x.kunci) === String(kunciKini));
    const tunggal = (pmh.bentuk || "") === "tunggal" || kursi.length === 1;

    if (!tunggal && susunan.length) {
      barisGanti(
        st,
        isi,
        "majelis",
        "Majelis",
        terpilih
          ? `${terpilih.majelisKode ? `${terpilih.majelisKode} — ` : ""}${(terpilih.anggota || []).map((a) => a.nama).join(" · ")}`
          : (pmh.majelisKode ? `${pmh.majelisKode} — ` : "") + (pmh.anggota || []).map((a) => a.nama).join(" · "),
        [terpilih ? sebutBbn(terpilih.perkara) : "", terpilih && !terpilih.majelisKode ? "di luar SK" : pmh.sebab].filter(Boolean).join(" · "),
        susunan.map((x) => ({
          id: x.kunci,
          label:
            (x.majelisKode ? `${x.majelisKode} — ` : "") +
            `${(x.anggota || []).map((a) => a.nama).join(" · ")} — ${sebutBbn(x.perkara)}` +
            (x.majelisKode ? "" : " · di luar SK"),
        })),
        terpilih ? terpilih.kunci : "",
        (nilai) => pilihMajelis(st, nilai)
      );
    }

    const sebutan = tunggal ? ["Hakim tunggal"] : ["Ketua", "Anggota 1", "Anggota 2"];
    sebutan.forEach((label, urutan) => {
      const id = kursi[urutan];
      const lain = kursi.filter((_, i) => i !== urutan).map(String);
      barisGanti(
        st,
        isi,
        `kursi-${urutan}`,
        label,
        namaOrang(kolam, id) || namaOrang(pmh.anggota, id) || "",
        (() => {
          const x = kolam.find((o) => String(o.hakimId ?? o.id) === String(id));
          return x ? sebutBbn(x.jumlah) : "";
        })(),
        kolam
          .filter((x) => !lain.includes(String(x.hakimId ?? x.id)))
          .map((x) => ({ id: x.hakimId ?? x.id, label: `${x.nama} — ${sebutBbn(x.jumlah)}` })),
        id,
        (nilai) => gantiKursi(st, urutan, nilai)
      );
    });
    if (pmh.perluNilai) isi.appendChild(el("div", "aleta-pb-awas", "Nilai sengketa belum diisi di SIPP - isi dulu di Data Umum."));
    // PP dan JS terpaut pada majelis: ditampilkan di sini, diisikan di borang
    // masing-masing (pilihan diingat untuk perkara ini).
    gambarPp(st, isi, " (formulir Penunjukan PP)");
    gambarJs(st, isi, " (formulir Penunjukan JS)");
  }

  function gambarPp(st, isi, akhiran = "") {
    const ppp = st.usulan.ppp || {};
    const pp = pilihanDari(ppp.calon, st.pilihan.ppp) || ppp.usulan;
    barisGanti(
      st,
      isi,
      "ppp",
      `Panitera pengganti${akhiran}`,
      pp ? `${pp.kodeSk ? `${pp.kodeSk} — ` : ""}${pp.nama}` : "",
      [st.pilihan.ppp ? "dipilih tangan" : ppp.sebab, pp && pp.jumlah !== undefined ? sebutBbn(pp.jumlah) : ""].filter(Boolean).join(" · "),
      (ppp.calon || []).map((x) => ({
        id: x.id ?? x.paniteraId ?? x.nama,
        label:
          (x.kodeSk ? `${x.kodeSk} — ` : "") +
          `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBbn(x.jumlah)}` : ""}` +
          (x.dariSk ? " · panitera sidang majelis ini" : ""),
      })),
      pp ? pp.id ?? pp.paniteraId ?? pp.nama : "",
      (nilai) => {
        st.pilihan.ppp = nilai;
        st.terbuka.ppp = false;
        gambar(st);
      }
    );
  }

  function gambarJs(st, isi, akhiran = "") {
    const pjs = st.usulan.pjs || {};
    const js = pilihanDari(pjs.calon, st.pilihan.pjs) || pjs.usulan;
    barisGanti(
      st,
      isi,
      "pjs",
      `Juru sita${akhiran}`,
      js ? js.nama : "",
      [st.pilihan.pjs ? "dipilih tangan" : pjs.sebab, js && js.jumlah !== undefined ? sebutBbn(js.jumlah) : ""].filter(Boolean).join(" · "),
      (pjs.calon || []).map((x) => ({
        id: x.id ?? x.jurusitaId ?? x.nama,
        label: `${x.nama}${x.jumlah !== undefined ? ` — ${sebutBbn(x.jumlah)}` : ""}`,
      })),
      js ? js.id ?? js.jurusitaId ?? js.nama : "",
      (nilai) => {
        st.pilihan.pjs = nilai;
        st.terbuka.pjs = false;
        gambar(st);
      }
    );
    if (pjs.peringatan && !st.pilihan.pjs) isi.appendChild(el("div", "aleta-pb-awas", pjs.peringatan));
  }

  function gambarPhs(st, isi) {
    const usulan = st.usulan;
    const phs = usulan.phs || {};
    const id = idUntukTulis("phs", usulan, st.pilihan);
    const tanggal = id ? id.tanggalSidang : "";
    const calon = (phs.calon || []).map((x) => {
      const libur = liburDari(x.tanggal) || (x.libur ? `libur: ${x.libur}` : "");
      return {
        id: x.tanggal,
        mati: Boolean(libur),
        label: libur
          ? `${x.sebut || sebutTgl(x.tanggal)} — ${libur.replace(/^libur: /, "libur ")} · tidak dapat dipilih`
          : `${x.sebut || sebutTgl(x.tanggal)} — ${x.usulan ? "usulan" : `mundur ${x.pekan} pekan`}` +
            (x.jumlahSidang === null || x.jumlahSidang === undefined ? "" : ` · ${x.jumlahSidang} sidang`),
      };
    });
    if (tanggal && !calon.some((c) => c.id === tanggal)) calon.unshift({ id: tanggal, label: `${sebutTgl(tanggal)} — dipilih dari kalender` });
    const b = barisGanti(
      st,
      isi,
      "phs",
      "Tanggal sidang",
      tanggal ? sebutTgl(tanggal) : "",
      phs.sebab || "",
      calon,
      tanggal,
      (nilai) => {
        const cl = calon.find((c) => c.id === nilai);
        if (cl && cl.mati) {
          st.tolak = `${sebutTgl(nilai)} hari libur - tidak dapat dipilih.`;
        } else {
          st.tolak = "";
          st.pilihan.phs = nilai;
        }
        gambar(st);
      }
    );
    // Tanggal lain dari kalender: hari libur ditolak, pilihan lama tetap.
    if (st.terbuka.phs) {
      const kal = el("input", "aleta-pb-pilih");
      kal.type = "date";
      kal.setAttribute("data-pb-kalender", "phs");
      kal.min = new Date().toISOString().slice(0, 10);
      kal.value = tanggal || "";
      kal.addEventListener("change", () => {
        const coba = { ...st.pilihan, phs: kal.value };
        const salah = !kal.value
          ? ""
          : typeof masalahTanggalSidang === "function"
            ? masalahTanggalSidang(usulan, coba)
            : liburDari(kal.value);
        if (salah) st.tolak = salah;
        else {
          st.tolak = "";
          if (kal.value) st.pilihan.phs = kal.value;
        }
        gambar(st);
      });
      b.appendChild(kal);
    }
    const salah = typeof masalahTanggalSidang === "function" ? masalahTanggalSidang(usulan, st.pilihan) : "";
    if (salah) isi.appendChild(el("div", "aleta-pb-awas", salah));

    // Jam
    const jam = st.pilihan.jam || phs.jam || JAM_BAWAAN;
    const daftarJam = PILIHAN_JAM.includes(jam) ? PILIHAN_JAM : [jam, ...PILIHAN_JAM];
    barisGanti(st, isi, "jam", "Jam sidang", jam, "", daftarJam.map((j) => ({ id: j, label: j })), jam, (nilai) => {
      st.pilihan.jam = nilai;
      st.terbuka.jam = false;
      gambar(st);
    });

    // Sidang keliling + ruang
    const kotakSk = el("label", "aleta-pb-baris");
    kotakSk.setAttribute("data-pb", "sidkel");
    kotakSk.appendChild(el("span", "aleta-pb-label", "Sidang keliling"));
    const ws = el("span", "aleta-pb-nilai");
    const cek = document.createElement("input");
    cek.type = "checkbox";
    cek.setAttribute("data-pb-sidkel", "1");
    cek.checked = Boolean(st.pilihan.sidkel);
    cek.addEventListener("change", () => {
      st.pilihan.sidkel = cek.checked;
      // Mematikannya melepas ruang keliling; menyalakannya memilih ruang
      // keliling yang paling sering dipakai (urutan portal) bila belum ada.
      const daftar = daftarRuang(st);
      const kini = daftar.find((r) => r.id === String(st.pilihan.ruangan || ""));
      if (!cek.checked && kini && kini.sifat !== "dalam-gedung") st.pilihan.ruangan = "";
      if (cek.checked && (!kini || kini.sifat !== "keliling")) st.pilihan.ruangan = "";
      st.terbuka.ruangan = cek.checked;
      gambar(st);
    });
    ws.append(cek, document.createTextNode(" sidang di luar gedung (keliling)"));
    kotakSk.appendChild(ws);
    kotakSk.appendChild(el("span", "aleta-pb-sebab", "Tercatat sebagai sidang keliling di SIPP menurut ruang sidang yang dipilih."));
    isi.appendChild(kotakSk);

    const daftar = daftarRuang(st);
    if (daftar.length) {
      const SEBUT = { "dalam-gedung": "Dalam gedung", keliling: "Sidang keliling", terpadu: "Sidang terpadu" };
      const urut = st.pilihan.sidkel
        ? [...daftar].sort((a, b) => {
            const luar = (r) => (r.sifat === "keliling" ? 0 : r.sifat === "terpadu" ? 1 : 2);
            return luar(a) - luar(b);
          })
        : daftar;
      const rid = ruangTerpilih(st, daftar);
      const r = daftar.find((x) => x.id === rid);
      barisGanti(
        st,
        isi,
        "ruangan",
        "Ruang sidang",
        r ? r.nama : "",
        r ? SEBUT[r.sifat] || r.sifat : "",
        urut.map((x) => ({
          id: x.id,
          label: `${x.nama} — ${SEBUT[x.sifat] || x.sifat}${x.dipakai === undefined ? "" : x.dipakai > 0 ? ` · ${x.dipakai} sidang 2 tahun terakhir` : " · belum pernah dipakai"}`,
        })),
        rid,
        (nilai) => {
          st.pilihan.ruangan = nilai;
          st.terbuka.ruangan = false;
          gambar(st);
        }
      );
      if (st.pilihan.sidkel && r && r.sifat !== "keliling") isi.appendChild(el("div", "aleta-pb-awas", "Ruang yang dipilih bukan ruang sidang keliling."));
    }

    // Agenda - bawaan borang SIPP sendiri ("Sidang Pertama")
    if (st.form.querySelector("#isi_agenda_sidang")) {
      const ba = el("div", "aleta-pb-baris");
      ba.setAttribute("data-pb", "agenda");
      ba.appendChild(el("span", "aleta-pb-label", "Agenda sidang"));
      const t = el("input", "aleta-pb-pilih");
      t.type = "text";
      t.setAttribute("data-pb-agenda", "1");
      t.value = st.pilihan.agenda !== undefined ? st.pilihan.agenda : nilaiAgendaAwal(st);
      t.addEventListener("change", () => {
        st.pilihan.agenda = t.value;
      });
      ba.appendChild(t);
      isi.appendChild(ba);
    }
  }

  function gambar(st) {
    const w = st.wadah;
    if (!w) return;
    const isi = st.isi;
    isi.textContent = "";
    isi.hidden = !st.buka;
    st.tIsi.textContent = st.buka ? "Tutup isi otomatis" : "Isi otomatis";
    if (!st.buka) return;
    if (st.memuat) {
      isi.appendChild(el("div", "aleta-pb-kabar", "Menyusun saran…"));
      return;
    }
    if (st.galat) {
      isi.appendChild(el("div", "aleta-pb-kabar aleta-pb-gagal", st.galat));
      return;
    }
    const usulan = st.usulan;
    if (!usulan || usulan.ok === false) {
      isi.appendChild(el("div", "aleta-pb-kabar aleta-pb-gagal", "Saran penetapan belum dapat disusun untuk perkara ini."));
      return;
    }
    const kode = st.borang.kode;
    const p = usulan.penetapan || {};
    if (kode !== "pmh" && p.majelisNama) baris(isi, "Majelis tercatat", typeof bersihkanPemisahBr === "function" ? bersihkanPemisahBr(p.majelisNama) : String(p.majelisNama).replace(/<[^>]*>/g, ", "));
    if (kode === "pmh") gambarPmh(st, isi);
    else if (kode === "ppp") gambarPp(st, isi);
    else if (kode === "pjs") gambarJs(st, isi);
    else if (kode === "phs") gambarPhs(st, isi);
    if (usulan.tanggalPenetapan) baris(isi, "Tanggal penetapan", sebutTgl(usulan.tanggalPenetapan));
    if (st.tolak) isi.appendChild(el("div", "aleta-pb-awas", st.tolak));

    const kaki = el("div", "aleta-pb-kaki");
    const tTerap = tombol(st.menerapkan ? "Mengisi…" : "Terapkan ke formulir", "aleta-pb-utama");
    tTerap.setAttribute("data-pb-terapkan", "1");
    tTerap.disabled = Boolean(st.menerapkan);
    tTerap.addEventListener("click", () => void terapkan(st));
    kaki.appendChild(tTerap);
    kaki.appendChild(el("span", "aleta-pb-sebab", "Hanya mengisi kolom - Simpan tetap Anda yang menekan di SIPP."));
    isi.appendChild(kaki);
    if (st.kabar && st.kabar.teks) {
      const k = el("div", `aleta-pb-kabar${st.kabar.gagal ? " aleta-pb-gagal" : ""}`, st.kabar.teks);
      k.setAttribute("data-pb-kabar", "1");
      k.setAttribute("aria-live", "polite");
      isi.appendChild(k);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  const hidup = new Set();
  function sisipkanGaya(doc) {
    if (doc.getElementById(ID_GAYA)) return;
    const s = doc.createElement("style");
    s.id = ID_GAYA;
    s.className = "aleta-sisip";
    s.textContent = GAYA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function pasangSatu(form) {
    if (form.__aletaPb && form.__aletaPb.wadah.isConnected) return form.__aletaPb;
    const borang = kenali(form);
    if (!borang || !form.parentNode) return null;
    const wadah = el("div", KELAS);
    wadah.setAttribute("data-pb-borang", borang.kode);
    const kepala = el("div", "aleta-pb-kepala");
    const tIsi = tombol("Isi otomatis", "aleta-pb-utama");
    tIsi.setAttribute("data-pb-buka", "1");
    tIsi.title = "Saran majelis, panitera pengganti, juru sita, tanggal, jam, dan ruang sidang - hanya mengisi kolom; Simpan tetap Anda yang menekan";
    kepala.append(tIsi, el("span", "aleta-pb-sebab", borang.judul));
    const isi = el("div", "aleta-pb-isi");
    isi.hidden = true;
    wadah.append(kepala, isi);
    const st = { form, borang, wadah, isi, tIsi, nomor: "", usulan: null, pilihan: {}, terbuka: {}, buka: false, kabar: null, tolak: "" };
    tIsi.addEventListener("click", () => {
      if (st.buka) {
        st.buka = false;
        gambar(st);
      } else void bukaPanel(st);
    });
    form.parentNode.insertBefore(wadah, form);
    form.__aletaPb = st;
    hidup.add(st);
    return st;
  }

  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }
  function bersihkan(doc) {
    for (const e of Array.from((doc || document).querySelectorAll(".aleta-pb"))) e.remove();
    for (const f of Array.from((doc || document).querySelectorAll("form"))) f.__aletaPb = null;
    hidup.clear();
  }

  /** Satu putaran pemasangan. Pulang jumlah borang yang bertombol (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-pb")) bersihkan(d);
      return 0;
    }
    let n = 0;
    for (const f of Array.from(d.querySelectorAll("form"))) {
      if (milikAleta(f) || !kenali(f)) continue;
      sisipkanGaya(d);
      if (pasangSatu(f)) n += 1;
    }
    for (const st of Array.from(hidup)) if (!st.form.isConnected) hidup.delete(st);
    return n;
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
    }, 250);
  }
  const dariAletaSaja = (m) => {
    if (milikAleta(m.target)) return true;
    const n = [...Array.from(m.addedNodes || []), ...Array.from(m.removedNodes || [])];
    return n.length > 0 && n.every((x) => x.nodeType === 1 && x.classList && x.classList.contains("aleta-sisip"));
  };

  async function mulai() {
    try {
      if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      try {
        const s = (await chrome.storage.local.get(["aktif"])) || {};
        nyala = s.aktif !== false;
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
          jadwalkan();
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (!document.body) return;
      document.addEventListener("aleta-uji-berubah", () => jadwalkan());
      new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
        if (daftar.every(dariAletaSaja)) return;
        jadwalkan();
      }).observe(document.body, { childList: true, subtree: true });
      jadwalkan();
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaPenetapanBorang = {
    versi: "19-okt-2026",
    pasang,
    bersihkan,
    murni: { kenali, nomorDariBorang, rencanaIsi, keSipp, daftarRuang },
    KUNCI_INGAT,
  };
  void mulai();
})();
