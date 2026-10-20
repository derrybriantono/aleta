"use strict";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS DI HALAMAN PERKARA SIPP (20 Okt 2026, agen B2)
 * ============================================================================
 *
 * Tombol "Putusan Otomatis" (tebal) di deretan tombol halaman perkara - tepat
 * di sebelah "Penetapan Otomatis", sebelum "Buka di ABT" / "Buka di ALETA" -
 * dan panel terbentang di bawahnya:
 *
 *   - tiga langkah dengan kotak centang (semua tercentang): isi & simpan
 *     Putusan Akhir dari draf, e-Doc putusan, e-Doc anonimisasi;
 *   - keadaan tiap langkah dibaca dari SIPP (putusan sudah terisi / e-Doc sudah
 *     ada = dilewati, tidak ditimpa);
 *   - SATU tombol dengan konfirmasi di halaman (bukan window.confirm) yang
 *     menyebut berapa Putusan Akhir diisi dan berapa e-Doc diunggah;
 *   - laporan per langkah (tercatat / dilewati karena sudah ada / gagal+sebab)
 *     dan muat ulang tetap di perkara ini (muat-ulang-sipp.js).
 *
 * TIDAK ADA ATURAN DAN JALAN TULIS BARU DI SINI - satu sumber kode dengan
 * Putusan otomatis di panel ekstensi:
 *
 *   isi & simpan   bagian "Putusan otomatis" panel (konten.js bagianIsiPutusan)
 *                  dibuka lewat s1BukaBlangkoPutusan, lalu kotak.otomatis()
 *                  menekan tombol-tombolnya sendiri: Ambil usulan -> praperiksa
 *                  -> Isikan -> Simpan (bukti dari SIPP) -> e-Doc. Yang menahan
 *                  (praperiksa) tetap menahan; putusan yang sudah terisi tidak
 *                  ditimpa dari sini;
 *   e-Doc          aletaPutusanEdoc.jalankan (putusan-edoc-sekaligus.js): cek
 *                  yang sudah ada, berkas dari Blangko Derry di ABT, anonimisasi,
 *                  satu kiriman ke unggah-sipp;
 *   kunci          kunci per perkara yang sama dengan penetapan
 *                  (aletaPenetapanKerja.ambilKunci): dua pekerjaan atas satu
 *                  perkara - dari panel ekstensi atau dari tombol ini - tidak
 *                  berjalan bersamaan.
 *
 * Hak: hanya Super Admin, Admin, dan Hakim (termasuk Ketua/Wakil) -
 * alatBolehUnggahPutusan, sama dengan bagian Putusan otomatis di panel.
 * Tampilan Lama tidak berubah. Tidak ada kata ALETA yang ditulis ke SIPP:
 * teks di layar ini hanya untuk petugas.
 */
(function putusanSippModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanSipp) return;

  const KELAS = "aleta-sisip aleta-pusipp";
  const ID_PANEL = "aleta-pusipp-panel";
  const KUNCI_LIPAT = "lipatanBagian";
  const KUNCI_LIPAT_PANEL = "putusanSipp";
  const LANGKAH = ["isi", "putusan", "anonim"];
  const NAMA = { isi: "Isi & simpan Putusan Akhir", putusan: "e-Doc putusan", anonim: "e-Doc anonimisasi" };
  const STATUS = {
    tunggu: { teks: "akan dikerjakan", nada: "tunggu" },
    lewat: { teks: "sudah ada · dilewati", nada: "lewat" },
    jalan: { teks: "mengerjakan…", nada: "jalan" },
    ok: { teks: "tercatat", nada: "ok" },
    gagal: { teks: "gagal", nada: "salah" },
    tidak: { teks: "tidak dicentang", nada: "lewat" },
    baca: { teks: "memeriksa…", nada: "jalan" },
  };

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, kelas, judul) {
    const b = el("button", kelas, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  async function tungguSampai(cari, batasMs, jedaMs) {
    const mulai = Date.now();
    for (;;) {
      let h = null;
      try {
        h = cari();
      } catch {
        h = null;
      }
      if (h) return h;
      if (Date.now() - mulai > batasMs) return null;
      await tunggu(jedaMs || 100);
    }
  }

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
    } catch {
      /* ingatan lipatan hanya kenyamanan */
    }
  }

  /** Hanya Super Admin, Admin, Hakim (termasuk Ketua/Wakil) - keputusan 9 Okt 2026; peran yang belum terbaca = tidak tampil. */
  function berhak() {
    try {
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      if (typeof alatBolehUnggahPutusan !== "function" || alatBolehUnggahPutusan(penggunaTerakhir) !== true) return false;
      return typeof boleh === "function" ? boleh("data-umum") === true : true;
    } catch {
      return false;
    }
  }

  function barisTombol(doc) {
    const kembali = (doc || document).querySelector("#submenus td#backlist");
    return kembali && kembali.parentElement ? kembali.parentElement : null;
  }

  function nomorHalaman(doc) {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      const n = l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function" ? l1.murni.nomorHalamanDetil(doc || document) : "";
      if (n) return n;
    } catch {
      /* jatuh ke konten.js */
    }
    try {
      return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
    } catch {
      return "";
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan satu panel
  // ──────────────────────────────────────────────────────────────────────────
  let ctx = null;

  function buatCtx(nomor) {
    return {
      nomor,
      terbuka: true,
      lipatDibaca: false,
      sibuk: false,
      memuat: false,
      dibaca: false,
      konfirm: false,
      pilih: { isi: true, putusan: true, anonim: true },
      keadaan: { terisi: null, adaPutusan: null, adaAnonim: null, galatEdoc: "" },
      status: { isi: "tunggu", putusan: "tunggu", anonim: "tunggu" },
      catatan: { isi: "", putusan: "", anonim: "" },
      info: "",
      akar: null,
      dirender: false,
    };
  }

  /** Apa yang akan dikerjakan menurut keadaan SIPP dan centang. Murni terhadap ctx. */
  function rencana() {
    const k = ctx.keadaan;
    const isi = ctx.pilih.isi && k.terisi !== true ? 1 : 0;
    const putusan = ctx.pilih.putusan && k.adaPutusan !== true ? 1 : 0;
    const anonim = ctx.pilih.anonim && k.adaAnonim !== true ? 1 : 0;
    return { isi, putusan, anonim, edoc: putusan + anonim, total: isi + putusan + anonim };
  }

  /** Status awal tiap langkah dari keadaan SIPP (sebelum dijalankan). */
  function segarkanStatusAwal() {
    const k = ctx.keadaan;
    const awal = (kunci, sudah) => {
      // Putusan yang sudah terisi tidak dapat dicentang (tidak ditimpa dari sini): selalu "sudah ada".
      if (kunci === "isi" && sudah === true) return ["lewat", ""];
      if (!ctx.pilih[kunci]) return ["tidak", ""];
      if (sudah === true) return ["lewat", ""];
      return ["tunggu", ""];
    };
    let [s, c] = awal("isi", k.terisi);
    ctx.status.isi = s;
    ctx.catatan.isi = k.terisi === true ? `Putusan sudah terisi di SIPP${k.rincianTerisi || ""} - tidak ditimpa dari sini.` : c;
    [s, c] = awal("putusan", k.adaPutusan);
    ctx.status.putusan = s;
    ctx.catatan.putusan = k.adaPutusan === true ? "Sudah ada di SIPP - tidak diganti." : c;
    [s, c] = awal("anonim", k.adaAnonim);
    ctx.status.anonim = s;
    ctx.catatan.anonim = k.adaAnonim === true ? "Sudah ada di SIPP - tidak diganti." : c;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Membaca keadaan SIPP - fungsi yang SAMA dengan panel ekstensi
  // ──────────────────────────────────────────────────────────────────────────
  async function muat() {
    if (!ctx || ctx.memuat) return;
    ctx.memuat = true;
    ctx.info = "Memeriksa keadaan putusan dan e-Doc di SIPP…";
    render();
    const nomor = ctx.nomor;
    try {
      const baca = fungsi("b6KeadaanPutusanTerisi");
      const k = baca ? await baca(nomor) : null;
      if (!ctx || ctx.nomor !== nomor) return;
      if (k && k.terisi) {
        const rinci = fungsi("b6RincianPutusan");
        ctx.keadaan.terisi = true;
        ctx.keadaan.rincianTerisi = rinci ? rinci(k) : "";
        ctx.pilih.isi = false;
      } else {
        ctx.keadaan.terisi = k ? false : null;
      }
      const mod = globalThis.aletaPutusanEdoc;
      const cariId = fungsi("a30PerkaraIdUntukAbt");
      const perkaraId = cariId ? String((await cariId(nomor)) || "") : "";
      if (mod && /^\d+$/.test(perkaraId)) {
        const c = await mod.cekSlot(perkaraId);
        if (!ctx || ctx.nomor !== nomor) return;
        if (c.ok) {
          ctx.keadaan.adaPutusan = Boolean(c.adaPutusan);
          ctx.keadaan.adaAnonim = Boolean(c.adaAnonim);
          ctx.keadaan.galatEdoc = "";
        } else {
          ctx.keadaan.galatEdoc = c.sebab || "tidak terbaca";
        }
      } else {
        ctx.keadaan.galatEdoc = "nomor induk perkara belum terbaca";
      }
      ctx.dibaca = true;
      ctx.info = "";
    } catch (galat) {
      ctx.info = `Keadaan belum terbaca: ${sebaris((galat && galat.message) || galat)}`;
    } finally {
      if (ctx) ctx.memuat = false;
      if (ctx && !ctx.sibuk) segarkanStatusAwal();
      render();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar
  // ──────────────────────────────────────────────────────────────────────────
  function buatKerangka() {
    const akar = el("section", `${KELAS} aleta-pusipp-panel`);
    akar.id = ID_PANEL;
    akar.setAttribute("role", "region");
    akar.setAttribute("aria-label", "Putusan Otomatis");
    akar.setAttribute("data-pusipp", "panel");

    const kepala = el("div", "aleta-pusipp-kepala");
    const h = el("h2", "aleta-pusipp-judul");
    h.append("Putusan Otomatis · ", el("span", "aleta-pusipp-mono", ctx.nomor));
    kepala.append(h, el("div", "aleta-pusipp-catatan", "Sama dengan Putusan otomatis di ekstensi ALETA · atas akun SIPP yang sedang masuk"));

    const badan = el("div", "aleta-pusipp-badan");
    const info = el("div", "aleta-pusipp-info");
    info.setAttribute("aria-live", "polite");
    const konfirm = el("div", "aleta-pusipp-konfirm-wadah");
    const daftar = el("div", "aleta-pusipp-daftar");
    badan.append(info, konfirm, daftar);

    const kaki = el("div", "aleta-pusipp-kaki");
    const ringkas = el("div", "aleta-pusipp-ringkas");
    ringkas.setAttribute("aria-live", "polite");
    const aksi = el("div", "aleta-pusipp-aksi");
    const semuaLabel = el("label", "aleta-pusipp-semua");
    const semua = document.createElement("input");
    semua.type = "checkbox";
    semua.setAttribute("data-pusipp", "semua");
    semua.addEventListener("change", () => {
      if (ctx.sibuk) return;
      for (const j of LANGKAH) {
        // Putusan yang sudah terisi tidak ikut dicentang: tidak ditimpa dari sini.
        ctx.pilih[j] = j === "isi" && ctx.keadaan.terisi === true ? false : semua.checked;
      }
      segarkanStatusAwal();
      render();
    });
    semuaLabel.append(semua, " Centang semua langkah");
    const utama = tombol("Putusan & unggah e-Doc", "aleta-pusipp-utama");
    utama.setAttribute("data-pusipp", "utama");
    utama.addEventListener("click", () => mintaKonfirmasi());
    aksi.append(semuaLabel, utama);
    kaki.append(ringkas, aksi);

    const laporan = el("div", "aleta-pusipp-laporan");
    laporan.setAttribute("aria-live", "polite");
    laporan.setAttribute("data-pusipp", "laporan");
    akar.append(kepala, badan, kaki, laporan);
    ctx.akar = akar;
    ctx.laporan = laporan;
    return akar;
  }

  function render() {
    if (!ctx || !ctx.akar) return;
    ctx.dirender = true;
    const akar = ctx.akar;
    const info = akar.querySelector(".aleta-pusipp-info");
    info.textContent = ctx.info || (ctx.keadaan.galatEdoc && ctx.dibaca ? `e-Doc yang sudah ada belum terbaca (${ctx.keadaan.galatEdoc}) - e-Doc tidak akan diunggah sebelum terbaca.` : "");
    info.hidden = !info.textContent;

    const daftar = akar.querySelector(".aleta-pusipp-daftar");
    daftar.textContent = "";
    for (const j of LANGKAH) {
      const baris = el("div", `aleta-pusipp-baris aleta-pusipp-${STATUS[ctx.status[j]].nada}`);
      baris.setAttribute("data-pusipp-langkah", j);
      const label = el("label", "aleta-pusipp-pilih");
      const cek = document.createElement("input");
      cek.type = "checkbox";
      cek.checked = ctx.pilih[j];
      cek.disabled = ctx.sibuk || (j === "isi" && ctx.keadaan.terisi === true);
      cek.setAttribute("data-pusipp-cek", j);
      cek.addEventListener("change", () => {
        ctx.pilih[j] = cek.checked;
        segarkanStatusAwal();
        render();
      });
      label.append(cek, ` ${NAMA[j]}`);
      const st = el("span", `aleta-pusipp-status aleta-pusipp-s-${STATUS[ctx.status[j]].nada}`, STATUS[ctx.status[j]].teks);
      st.setAttribute("data-pusipp-status", ctx.status[j]);
      baris.append(label, st);
      if (ctx.catatan[j]) baris.appendChild(el("div", "aleta-pusipp-ket", ctx.catatan[j]));
      daftar.appendChild(baris);
    }

    const r = rencana();
    const semua = akar.querySelector("[data-pusipp='semua']");
    if (semua) {
      semua.checked = LANGKAH.every((j) => ctx.pilih[j] || (j === "isi" && ctx.keadaan.terisi === true));
      semua.disabled = ctx.sibuk;
    }
    const ringkas = akar.querySelector(".aleta-pusipp-ringkas");
    ringkas.textContent = ctx.sibuk
      ? "Sedang bekerja - jangan menutup atau memuat ulang halaman ini."
      : r.total === 0
        ? "Tidak ada yang perlu dikerjakan - yang dicentang sudah ada di SIPP."
        : `${r.isi ? "1 Putusan Akhir akan diisi dan disimpan" : "Putusan Akhir tidak diisi"} · ${r.edoc} e-Doc akan diunggah`;
    const utama = akar.querySelector("[data-pusipp='utama']");
    utama.disabled = ctx.sibuk || r.total === 0 || !ctx.dibaca;

    const wadahKonfirm = akar.querySelector(".aleta-pusipp-konfirm-wadah");
    wadahKonfirm.textContent = "";
    if (ctx.konfirm && !ctx.sibuk && r.total > 0) {
      const kotak = el("div", "aleta-pusipp-konfirm");
      kotak.setAttribute("role", "alertdialog");
      kotak.setAttribute("aria-label", "Konfirmasi");
      const bagian = [];
      if (r.isi) bagian.push("mengisi dan menyimpan 1 Putusan Akhir dari draf");
      if (r.edoc) bagian.push(`mengunggah ${r.edoc} e-Doc (${[r.putusan ? "putusan" : "", r.anonim ? "anonimisasi" : ""].filter(Boolean).join(" dan ")})`);
      kotak.appendChild(el("p", "aleta-pusipp-konfirm-teks", `Akan ${bagian.join(", lalu ")} untuk perkara ${ctx.nomor}.`));
      kotak.appendChild(
        el(
          "p",
          "aleta-pusipp-konfirm-ket",
          "Dicatat atas akun SIPP yang sedang masuk. Yang sudah ada di SIPP tidak diganti; bila praperiksa menahan, pengisian berhenti dan tidak disimpan."
        )
      );
      const aksi = el("div", "aleta-pusipp-konfirm-aksi");
      const ya = tombol("Ya, jalankan", "aleta-pusipp-ya");
      ya.setAttribute("data-pusipp", "ya");
      ya.addEventListener("click", () => void jalankan());
      const batal = tombol("Batal", "aleta-pusipp-batal");
      batal.setAttribute("data-pusipp", "batal");
      batal.addEventListener("click", () => {
        ctx.konfirm = false;
        render();
      });
      aksi.append(ya, batal);
      kotak.appendChild(aksi);
      wadahKonfirm.appendChild(kotak);
    }
  }

  function mintaKonfirmasi() {
    if (!ctx || ctx.sibuk || !ctx.dibaca) return;
    if (rencana().total === 0) return;
    ctx.konfirm = true;
    render();
    const ya = ctx.akar && ctx.akar.querySelector("[data-pusipp='ya']");
    if (ya && typeof ya.focus === "function") ya.focus();
  }

  function setStatus(j, status, catatan) {
    if (!ctx) return;
    ctx.status[j] = status;
    ctx.catatan[j] = catatan == null ? ctx.catatan[j] : sebaris(catatan);
    render();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Menjalankan - satu klik, berurutan
  // ──────────────────────────────────────────────────────────────────────────
  const dariLangkah = { putusan: "putusan", anonimisasi: "anonim" };

  /** Langkah e-Doc dari modul bersama -> status baris panel. */
  function terapkanLangkahEdoc(langkah) {
    for (const l of langkah || []) {
      const j = dariLangkah[l.kunci];
      if (!j) continue;
      setStatus(j, l.nada === "salah" ? "gagal" : l.nada === "lewat" ? "lewat" : "ok", l.teks);
    }
  }

  async function jalankan() {
    if (!ctx || ctx.sibuk || !ctx.dibaca) return;
    const r = rencana();
    if (r.total === 0) return;
    const nomor = ctx.nomor;
    ctx.sibuk = true;
    ctx.konfirm = false;
    if (ctx.laporan) ctx.laporan.textContent = "";
    for (const j of LANGKAH) if (ctx.status[j] === "tunggu") ctx.status[j] = "jalan";
    render();

    const mod = globalThis.aletaPutusanEdoc;
    const akhir = [];
    try {
      if (!mod) throw new Error("Pengunggah e-Doc belum termuat di halaman ini");
      if (r.isi) {
        // Isi & simpan: alur panel ekstensi yang SAMA.
        setStatus("isi", "jalan", "Membuka blangko Putusan Akhir…");
        const buka = fungsi("s1BukaBlangkoPutusan");
        if (!buka) throw new Error("Pembuka blangko Putusan Akhir belum termuat");
        const b = await buka();
        if (!b.ok) {
          setStatus("isi", "gagal", b.pesan);
          if (r.putusan) setStatus("putusan", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          if (r.anonim) setStatus("anonim", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          return;
        }
        const gambarUlang = fungsi("gambarUlangSesudahBlangko");
        if (gambarUlang) await gambarUlang(nomor).catch(() => false);
        const bagianOto = await tungguSampai(
          () => {
            for (const k of Array.from(document.querySelectorAll('.aleta-bagian[data-kunci="isiPutusan"]'))) {
              if (typeof k.otomatis === "function") return k;
            }
            return null;
          },
          15000,
          100
        );
        if (!bagianOto) {
          setStatus("isi", "gagal", "Blangko terbuka, tetapi bagian Putusan otomatis di panel tidak termuat (tampilan, kewenangan peran, atau putusan sudah terisi).");
          if (r.putusan) setStatus("putusan", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          if (r.anonim) setStatus("anonim", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          return;
        }
        setStatus("isi", "jalan", "Mengambil draf, memeriksa, mengisi, dan menyimpan…");
        const h = await bagianOto.otomatis({
          edoc: r.edoc > 0,
          denganPutusan: r.putusan > 0,
          denganAnonim: r.anonim > 0,
          // Kotak muat ulang melayang di halaman: panel ini dapat tergambar ulang saat SIPP menyegarkan isinya.
          melayang: true,
        });
        if (!h || !h.tersimpan) {
          setStatus("isi", "gagal", sebaris((h && h.pesan) || (h && h.bunyi) || "Pengisian berhenti sebelum Simpan."));
          if (r.putusan) setStatus("putusan", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          if (r.anonim) setStatus("anonim", "gagal", "Tidak dikerjakan - Putusan Akhir belum tersimpan.");
          return;
        }
        setStatus("isi", "ok", "Tersimpan di SIPP.");
        if (r.edoc > 0) {
          const langkah = h.edoc && Array.isArray(h.edoc.langkah) ? h.edoc.langkah : [];
          if (langkah.length) terapkanLangkahEdoc(langkah);
          else {
            const ok = Boolean(h.edoc && h.edoc.ok);
            if (r.putusan) setStatus("putusan", ok ? "ok" : "gagal", ok ? "terunggah" : (h.edoc && h.edoc.bunyi) || "tidak terunggah");
            if (r.anonim) setStatus("anonim", ok ? "ok" : "gagal", ok ? "terunggah" : (h.edoc && h.edoc.bunyi) || "tidak terunggah");
          }
        }
        // Muat ulang tetap di perkara: sudah dijadwalkan alur panel (kotak melayang) bersama laporannya.
        return;
      }

      // Putusan sudah terisi: hanya e-Doc (juga untuk mengulang unggah saja).
      const kunci = await mod.ambilKunci(nomor);
      if (!kunci.ok) {
        if (r.putusan) setStatus("putusan", "gagal", kunci.pesan);
        if (r.anonim) setStatus("anonim", "gagal", kunci.pesan);
        return;
      }
      let hasil;
      try {
        hasil = await mod.jalankan({
          nomorPerkara: nomor,
          kabar: ctx.laporan,
          wadah: ctx.laporan,
          denganPutusan: r.putusan > 0,
          denganAnonim: r.anonim > 0,
        });
      } finally {
        await kunci.lepas();
      }
      terapkanLangkahEdoc(hasil.langkah);
      akhir.push(...(hasil.langkah || []));
      const ringkasan = fungsi("muatUlangSesudahTulis");
      if (ringkasan) {
        ringkasan({
          nomor,
          judulOk: "e-Doc selesai.",
          judulGagal: "e-Doc belum selesai seluruhnya.",
          baris: (hasil.langkah || []).map((l) => ({ jenis: l.judul, teks: l.teks, ok: l.nada !== "salah" })),
        });
      }
    } catch (galat) {
      const pesan = sebaris((galat && galat.message) || galat);
      for (const j of LANGKAH) if (ctx && ctx.status[j] === "jalan") setStatus(j, "gagal", pesan);
    } finally {
      if (ctx) {
        ctx.sibuk = false;
        for (const j of LANGKAH) if (ctx.status[j] === "jalan") ctx.status[j] = "gagal";
        // Keadaan SIPP dibaca lagi: yang baru tercatat tampil sebagai "sudah ada" pada putaran berikutnya.
        ctx.dibaca = false;
        ctx.memuat = false;
        const sisaStatus = { ...ctx.status };
        const sisaCatatan = { ...ctx.catatan };
        void muat().then(() => {
          // Hasil putaran ini tetap terbaca di barisnya sampai petugas mengubah centang.
          if (!ctx) return;
          for (const j of LANGKAH) {
            if (sisaStatus[j] === "ok" || sisaStatus[j] === "gagal") {
              ctx.status[j] = sisaStatus[j];
              ctx.catatan[j] = sisaCatatan[j];
            }
          }
          render();
        });
        render();
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan di halaman
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }

  /**
   * Tombol tepat di sebelah "Penetapan Otomatis" (P2) bila ada - Penetapan tetap paling kiri -
   * dan selalu sebelum tombol "Buka di ABT" / "Buka di ALETA".
   */
  function pasangTombol(tr) {
    let td = tr.querySelector(":scope > .aleta-pusipp-sel");
    if (!td) {
      td = el("td", `${KELAS} aleta-pusipp-sel`);
      const b = tombol("", "btn btn-sm aleta-pusipp-tombol");
      b.setAttribute("data-pusipp", "tombol");
      b.setAttribute("aria-controls", ID_PANEL);
      b.append(el("span", "aleta-pusipp-ikon", "⚖"), " Putusan Otomatis");
      b.addEventListener("click", () => {
        if (!ctx) return;
        ctx.terbuka = !ctx.terbuka;
        ctx.lipatDibaca = true;
        void bacaPenyimpanan([KUNCI_LIPAT]).then((s) => {
          const lip = s && s[KUNCI_LIPAT] && typeof s[KUNCI_LIPAT] === "object" ? s[KUNCI_LIPAT] : {};
          void tulisPenyimpanan({ [KUNCI_LIPAT]: { ...lip, [KUNCI_LIPAT_PANEL]: !ctx.terbuka } });
        });
        pasangPanel(tr);
      });
      td.appendChild(b);
    }
    const penetapan = tr.querySelector(":scope > .aleta-pensipp-sel");
    const l1 = tr.querySelector(":scope > .aleta-l1-submenu");
    if (penetapan) {
      if (td.previousElementSibling !== penetapan) tr.insertBefore(td, penetapan.nextSibling);
    } else if (l1) {
      if (td.nextElementSibling !== l1 || td.parentElement !== tr) tr.insertBefore(td, l1);
    } else if (td.parentElement !== tr) {
      tr.appendChild(td);
    }
    const b = td.querySelector("button");
    if (b) b.setAttribute("aria-expanded", ctx && ctx.terbuka ? "true" : "false");
    return td;
  }

  function pasangPanel(tr) {
    const tabel = tr.closest("table#submenus") || (tr.closest("table") && tr.closest("table").closest("table#submenus")) || tr.closest("table");
    const ada = document.getElementById(ID_PANEL);
    if (!ctx.akar || !ada) {
      const akar = buatKerangka();
      if (ada) ada.remove();
      // Di bawah panel Penetapan Otomatis bila ada, kalau tidak langsung di bawah deretan tombol.
      const penetapanPanel = document.getElementById("aleta-pensipp-panel");
      const jangkar = penetapanPanel && penetapanPanel.parentNode ? penetapanPanel : tabel;
      if (jangkar && jangkar.parentNode) jangkar.parentNode.insertBefore(akar, jangkar.nextSibling);
      else document.body.appendChild(akar);
      ctx.dirender = false;
    }
    ctx.akar.hidden = !ctx.terbuka;
    const tb = tr.querySelector(".aleta-pusipp-tombol");
    if (tb) tb.setAttribute("aria-expanded", ctx.terbuka ? "true" : "false");
    if (ctx.terbuka && !ctx.dibaca && !ctx.memuat && !ctx.sibuk) void muat();
    else if (ctx.dirender === false) render();
  }

  function bersihkan(doc) {
    const d = doc || document;
    for (const e of Array.from(d.querySelectorAll(".aleta-pusipp"))) e.remove();
    ctx = null;
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-pusipp")) bersihkan(d);
      return { tombol: false, panel: false };
    }
    const tr = barisTombol(d);
    if (!tr) return { tombol: false, panel: false };
    const nomor = nomorHalaman(d);
    if (!berhak() || !nomor) {
      if (d.querySelector(".aleta-pusipp") && !(ctx && ctx.sibuk)) bersihkan(d);
      return { tombol: false, panel: false };
    }
    if (!ctx || ctx.nomor !== nomor) {
      if (d.querySelector(".aleta-pusipp")) bersihkan(d);
      ctx = buatCtx(nomor);
      void bacaPenyimpanan([KUNCI_LIPAT]).then((simpan) => {
        if (!ctx || ctx.nomor !== nomor) return;
        const lip = simpan && simpan[KUNCI_LIPAT] && typeof simpan[KUNCI_LIPAT] === "object" ? simpan[KUNCI_LIPAT] : {};
        // Bawaan TERBENTANG; hanya yang sengaja dilipat petugas yang tetap terlipat.
        if (lip[KUNCI_LIPAT_PANEL] === true && !ctx.lipatDibaca) {
          ctx.terbuka = false;
          const baris = barisTombol(document);
          if (baris) pasangPanel(baris);
        }
        ctx.lipatDibaca = true;
      });
    }
    pasangTombol(tr);
    pasangPanel(tr);
    return { tombol: true, panel: Boolean(ctx.akar && !ctx.akar.hidden) };
  }

  let detak = null;
  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      try {
        pasang(document);
      } catch {
        /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
      }
    }, 1000);
  }

  async function mulai() {
    try {
      const s = await bacaPenyimpanan(["aktif"]);
      nyala = s.aktif !== false;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      if (!document.body) return;
      document.addEventListener("aleta-uji-berubah", () => pasang(document));
      pasang(document);
      mulaiDetak();
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaPutusanSipp = {
    versi: "b2-20okt",
    pasang,
    bersihkan,
    muat,
    jalankan,
    mintaKonfirmasi,
    keadaan: () => ctx,
    murni: { berhak, barisTombol, nomorHalaman, STATUS, LANGKAH },
  };
  void mulai();
})();
