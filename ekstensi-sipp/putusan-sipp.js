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
 *   - keadaan tiap langkah dibaca dari SIPP. Yang SUDAH ada tetap tampil dan dapat
 *     dicentang untuk DIGANTI (5 Nov 2026): bawaan centangnya mati - mencentang adalah
 *     keputusan petugas - dan yang tercentang menimpa tanpa langkah hapus lebih dulu,
 *     lewat jalur yang sama dengan SIPP (borang Edit Putusan Akhir, unggah e-Doc ulang).
 *     Tiga langkah berdiri sendiri: boleh hanya mengganti salah satu;
 *   - centang keempat "Ubah jadi PDF salinan" (5 Nov 2026, bawaan MATI, di luar "Centang semua"): dari BERKAS PUTUSAN yang dipilih
 *     di kotak "Berkas putusan" dibuat PDF SALINAN lewat metode yang SAMA dengan Blangko Derry (panel-alat.js: RTF/DOCX/DOC lewat
 *     rute PDF salinan, PDF yang masih kosong lewat rute salinan-dari-pdf) lalu langsung diunduh ke komputer ini. Berjalan bersamaan
 *     dengan langkah SIPP tetapi berdiri sendiri (gagalnya tidak membatalkan isi form/unggah, dan sebaliknya); TIDAK diunggah ke SIPP;
 *     berkas anonimisasi tidak pernah dipakai sebagai dasar. Tanpa centang ini tidak ada permintaan tambahan sama sekali;
 *   - SATU tombol yang LANGSUNG menjalankan semua langkah yang dicentang (30 Okt
 *     2026, permintaan pengguna: tanpa tombol kedua/konfirmasi); apa yang sedang
 *     dikerjakan tampil sebagai kemajuan. Yang benar-benar menahan (praperiksa,
 *     data pribadi tersisa di anonimisasi) tetap bertanya/menahan di langkahnya;
 *   - laporan per langkah (tercatat / diganti / dilewati karena sudah ada / gagal+sebab)
 *     dan muat ulang tetap di perkara ini (muat-ulang-sipp.js).
 *
 * TIDAK ADA ATURAN DAN JALAN TULIS BARU DI SINI - satu sumber kode dengan
 * Putusan otomatis di panel ekstensi:
 *
 *   isi & simpan   bagian "Putusan otomatis" panel (konten.js bagianIsiPutusan)
 *                  dibuka lewat s1BukaBlangkoPutusan, lalu kotak.otomatis()
 *                  menekan tombol-tombolnya sendiri: Ambil usulan -> praperiksa
 *                  -> Isikan -> Simpan (bukti dari SIPP) -> e-Doc. Yang menahan
 *                  (praperiksa) tetap menahan; putusan yang sudah terisi hanya
 *                  diganti bila "ganti" dicentang (opsi timpaIsi);
 *   e-Doc          aletaPutusanEdoc.jalankan (putusan-edoc-sekaligus.js): cek
 *                  yang sudah ada, berkas dari Blangko Derry di ABT, anonimisasi,
 *                  satu kiriman ke unggah-sipp;
 *   kunci          kunci per perkara yang sama dengan penetapan
 *                  (aletaPenetapanKerja.ambilKunci): dua pekerjaan atas satu
 *                  perkara - dari panel ekstensi atau dari tombol ini - tidak
 *                  berjalan bersamaan.
 *
 * Hak: HANYA Ketua, Wakil Ketua, dan Hakim; Super Admin (golongan admin) tetap boleh
 * semua - alatBolehTombolPutusanSipp (21 Okt 2026) di atas alatBolehUnggahPutusan.
 * BAWAAN TERLIPAT (21 Okt 2026); warna mengikuti tema terang/gelap seperti Penetapan Otomatis.
 * Berkas putusan boleh diseret/dipilih di panel ini (RTF, DOCX, DOC, PDF): dipakai untuk e-Doc
 * putusan dan e-Doc anonimisasi lewat jalur e-Doc yang sama (putusan-edoc-sekaligus.js).
 * Tampilan Lama tidak berubah. Tidak ada kata ALETA yang ditulis ke SIPP:
 * teks di layar ini hanya untuk petugas.
 */
(function putusanSippModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanSipp) return;

  const KELAS = "aleta-sisip aleta-pusipp";
  const ID_PANEL = "aleta-pusipp-panel";
  // 21 Okt 2026 (perbaikan): BAWAAN TERLIPAT di SETIAP kunjungan. Pilihan buka-tutup petugas hanya diingat
  // selama halaman ini terbuka (aturan bersama alatPanelTerbuka/alatIngatPanel di panel-alat.js); dulu
  // diingat di chrome.storage.local, sehingga panel yang sekali dibuka terbuka lagi di setiap perkara dan
  // sesudah tiap muat ulang.
  const KUNCI_PANEL = "putusan-otomatis-sipp";
  const BATAS_BERKAS = 10 * 1024 * 1024;
  const BENTUK_BERKAS = /\.(rtf|docx|doc|pdf)$/i;
  const LANGKAH = ["isi", "putusan", "anonim"];
  const NAMA = { isi: "Isi & simpan Putusan Akhir", putusan: "e-Doc putusan", anonim: "e-Doc anonimisasi" };
  const STATUS = {
    tunggu: { teks: "akan dikerjakan", nada: "tunggu" },
    lewat: { teks: "sudah ada · dilewati", nada: "lewat" },
    jalan: { teks: "mengerjakan…", nada: "jalan" },
    ok: { teks: "tercatat", nada: "ok" },
    // 5 Nov 2026: yang sudah ada tidak lagi mati - "ada" (belum dicentang), "timpa" (dicentang, akan diganti), "ditimpa" (sudah diganti).
    ada: { teks: "sudah ada di SIPP", nada: "lewat" },
    timpa: { teks: "akan diganti", nada: "tunggu" },
    ditimpa: { teks: "diganti", nada: "ok" },
    gagal: { teks: "gagal", nada: "salah" },
    // 5 Nov 2026: PDF salinan - dibuat dari berkas putusan yang dipilih, langsung diunduh ke komputer ini (tidak diunggah ke SIPP).
    unduh: { teks: "diunduh", nada: "ok" },
    tidak: { teks: "tidak dicentang", nada: "lewat" },
    baca: { teks: "memeriksa…", nada: "jalan" },
    perlu: { teks: "perlu berkas putusan", nada: "salah" },
  };
  const NAMA_SALINAN = "Ubah jadi PDF salinan";
  const KET_SALINAN = "Dibuat dari berkas putusan yang dipilih di bawah (RTF, DOCX, DOC, atau PDF), lalu langsung diunduh ke komputer ini. Tidak diunggah ke SIPP.";
  const TIDAK_DIKERJAKAN ="Tidak dikerjakan: Putusan Akhir belum tersimpan (sebabnya tertulis di langkah pertama).";

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

  /** Ketua, Wakil Ketua, Hakim, dan Super Admin (golongan admin); peran yang belum terbaca = tidak tampil. */
  function berhak() {
    try {
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      if (typeof alatBolehUnggahPutusan !== "function" || alatBolehUnggahPutusan(penggunaTerakhir) !== true) return false;
      if (typeof alatBolehTombolPutusanSipp === "function" && alatBolehTombolPutusanSipp(penggunaTerakhir) !== true) return false;
      return typeof boleh === "function" ? boleh("data-umum") === true : true;
    } catch {
      return false;
    }
  }

  /** Pilihan buka-tutup panel ini pada kunjungan halaman yang sama (bawaan: terlipat). */
  function terbukaTersimpan(nomor) {
    try {
      return typeof alatPanelTerbuka === "function" ? alatPanelTerbuka(`${KUNCI_PANEL}:${nomor}`) : false;
    } catch {
      return false;
    }
  }
  function ingatTerbuka(nomor, buka) {
    try {
      if (typeof alatIngatPanel === "function") alatIngatPanel(`${KUNCI_PANEL}:${nomor}`, buka);
    } catch {
      /* ingatan lipatan hanya kenyamanan */
    }
  }

  /**
   * Draf putusan ALETA perkara ini (baca saja). Pulang { ada:true, versi } | { ada:false, sebab } |
   * { ada:null, sebab } (tidak terbaca - pengisian tetap boleh dicoba, alurnya yang akan menyebut sebabnya).
   */
  async function cekDraf(nomor) {
    // Pembacanya di konten.js (cekDrafPutusanAleta) - satu sumber dengan "Ambil usulan dari ALETA";
    // berkas ini tidak memanggil portal sendiri.
    const baca = fungsi("cekDrafPutusanAleta");
    if (!baca) return { ada: null, sebab: "pembaca draf belum termuat" };
    try {
      const h = await baca(nomor);
      if (h && h.ada === true) return { ada: true, versi: h.versi };
      if (h && h.ada === false) return { ada: false, sebab: sebaris(h.sebab || "Belum ada draf putusan ALETA untuk perkara ini.") };
      return { ada: null, sebab: sebaris((h && h.sebab) || "draf belum terbaca") };
    } catch (galat) {
      return { ada: null, sebab: sebaris((galat && galat.message) || galat) };
    }
  }

  /** Kalimat sebab bila Putusan Akhir hendak diisi tanpa draf dan tanpa berkas. */
  function sebabTanpaSumber() {
    return (
      "Belum ada draf putusan ALETA untuk perkara ini dan belum ada berkas putusan yang dipilih, jadi tidak ada yang dapat diisikan. " +
      "Seret berkas putusan (RTF, DOCX, DOC, atau PDF) ke kotak \"Berkas putusan\" di panel ini, lalu jalankan lagi - " +
      "berkas itu dibaca untuk mengisi Putusan Akhir dan dipakai juga untuk e-Doc."
    );
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
      terbuka: false,
      berkas: null,
      sibuk: false,
      memuat: false,
      dibaca: false,
      konfirm: false,
      // salinan (5 Nov 2026): bawaan MATI, berdiri sendiri di luar tiga langkah SIPP; tidak ikut "Centang semua langkah".
      pilih: { isi: true, putusan: true, anonim: true, salinan: false },
      salinan: { status: "tidak", catatan: KET_SALINAN, hasil: false },
      keadaan:{ terisi: null, adaPutusan: null, adaAnonim: null, galatEdoc: "", draf: null, versiDraf: null, sebabDraf: "" },
      status: { isi: "tunggu", putusan: "tunggu", anonim: "tunggu" },
      catatan: { isi: "", putusan: "", anonim: "" },
      info: "",
      akar: null,
      dirender: false,
    };
  }

  /** Isi Putusan Akhir dicentang, tetapi draf ALETA terbukti tidak ada dan tidak ada berkas yang siap. */
  function tanpaSumberIsi() {
    return Boolean(ctx && ctx.pilih.isi && ctx.keadaan.draf === false && !berkasSiap());
  }

  /** Apa yang akan dikerjakan menurut keadaan SIPP dan centang. Murni terhadap ctx. */
  function rencana() {
    const k = ctx.keadaan;
    // Yang dicentang dikerjakan, juga yang sudah ada di SIPP (itu berarti MENGGANTI - keputusan petugas).
    const isi = ctx.pilih.isi ? 1 : 0;
    const putusan = ctx.pilih.putusan ? 1 : 0;
    const anonim = ctx.pilih.anonim ? 1 : 0;
    // Tanda timpa eksplisit per langkah: hanya untuk yang dicentang DAN terbukti sudah ada di SIPP.
    const timpa = { isi: isi === 1 && k.terisi === true, putusan: putusan === 1 && k.adaPutusan === true, anonim: anonim === 1 && k.adaAnonim === true };
    // salinan: tidak menulis ke SIPP, jadi tidak masuk total langkah SIPP; tombol utama tetap hidup bila hanya ini yang dicentang.
    return { isi, putusan, anonim, edoc: putusan + anonim, total: isi + putusan + anonim, timpa, salinan: ctx.pilih.salinan ? 1 : 0 };
  }

  /** Berapa e-Doc yang dicentang untuk DIGANTI (sudah ada di SIPP). */
  function jumlahGanti(r) {
    return (r.timpa.putusan ? 1 : 0) + (r.timpa.anonim ? 1 : 0);
  }

  /** Status awal tiap langkah dari keadaan SIPP (sebelum dijalankan). */
  function segarkanStatusAwal() {
    const k = ctx.keadaan;
    const awal = (kunci, sudah) => {
      // Yang sudah ada tetap dapat dicentang: tidak dicentang = "sudah ada", dicentang = "akan diganti".
      if (sudah === true) return [ctx.pilih[kunci] ? "timpa" : "ada", ""];
      if (!ctx.pilih[kunci]) return ["tidak", ""];
      return ["tunggu", ""];
    };
    let [s, c] = awal("isi", k.terisi);
    const sumberIsi = () => {
      const b = berkasSiap();
      return b ? `dari berkas ${b.nama}` : k.draf === true ? `dari draf putusan ALETA${k.versiDraf ? ` versi ${k.versiDraf}` : ""}` : "";
    };
    if ((s === "tunggu" || s === "timpa") && tanpaSumberIsi()) {
      s = "perlu";
      c = sebabTanpaSumber();
    } else if (s === "tunggu") {
      c = sumberIsi() ? `Diisi ${sumberIsi()}.` : c;
    }
    ctx.status.isi = s;
    ctx.catatan.isi =
      s === "perlu"
        ? c
        : k.terisi === true
          ? ctx.pilih.isi
            ? `Sudah ada di SIPP${k.rincianTerisi || ""}. Akan diganti${sumberIsi() ? ` ${sumberIsi()}` : ""}.`
            : `Sudah ada di SIPP${k.rincianTerisi || ""}. Centang untuk mengganti.`
          : c;
    [s, c] = awal("putusan", k.adaPutusan);
    ctx.status.putusan = s;
    ctx.catatan.putusan = k.adaPutusan === true ? (ctx.pilih.putusan ? "Sudah ada di SIPP. Akan diganti." : "Sudah ada di SIPP. Centang untuk mengganti.") : c;
    [s, c] = awal("anonim", k.adaAnonim);
    ctx.status.anonim = s;
    ctx.catatan.anonim = k.adaAnonim === true ? (ctx.pilih.anonim ? "Sudah ada di SIPP. Akan diganti." : "Sudah ada di SIPP. Centang untuk mengganti.") : c;
    segarkanSalinan();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PDF salinan (5 Nov 2026) - centang tambahan, tidak menulis apa pun ke SIPP
  // ──────────────────────────────────────────────────────────────────────────
  /** Keadaan baris salinan sebelum dijalankan (hasil putaran terakhir bertahan sampai centang atau berkas berubah). */
  function segarkanSalinan() {
    const sl = ctx.salinan;
    if (sl.hasil || ctx.sibuk) return;
    if (!ctx.pilih.salinan) {
      sl.status = "tidak";
      sl.catatan = KET_SALINAN;
      return;
    }
    const b = ctx.berkas;
    if (!b) {
      sl.status = "perlu";
      sl.catatan = "Seret berkas putusan (RTF, DOCX, DOC, atau PDF) ke kotak \"Berkas putusan\" di bawah; salinan dibuat dari berkas itu.";
    } else if (b.status === "ditolak") {
      sl.status = "perlu";
      sl.catatan = `Berkas ${b.nama} ditolak (${b.tolak}), jadi belum ada berkas untuk dibuat salinannya.`;
    } else {
      sl.status = "tunggu";
      sl.catatan =
        b.bentuk === "pdf"
          ? `Dibuat dari PDF ${b.nama}: tulisan SALINAN, ttd, dan blok Untuk Salinan ditambahkan di atas halamannya, lalu langsung diunduh ke komputer ini. Tidak diunggah ke SIPP.`
          : `Dibuat dari berkas ${b.nama}, lalu langsung diunduh ke komputer ini. Tidak diunggah ke SIPP.`;
    }
  }

  /** Nama dasar salinan dari nama berkas yang dipilih: tanpa ekstensi, tanpa kata ALETA (nama berkas tidak boleh memuatnya). */
  function namaDasarSalinan(namaBerkas) {
    const batang = String(namaBerkas || "")
      .replace(/\.[A-Za-z0-9]{2,5}$/, "")
      .replace(/a[\s._-]*l[\s._-]*e[\s._-]*t[\s._-]*a/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return batang || "Putusan";
  }

  async function bacaBita(berkas) {
    if (berkas && typeof berkas.arrayBuffer === "function") return new Uint8Array(await berkas.arrayBuffer());
    return await new Promise((selesai, gagal) => {
      const r = new FileReader();
      r.onload = () => selesai(new Uint8Array(r.result));
      r.onerror = () => gagal(new Error("berkas tidak terbaca"));
      r.readAsArrayBuffer(berkas);
    });
  }

  /**
   * Membuat PDF SALINAN dari berkas putusan yang dipilih lalu mengunduhnya. Metodenya SATU SUMBER dengan Blangko Derry
   * (panel-alat.js: alatMintaPdf, alatTerbitkanSalinan, alatKetSalinanPutusan) - panel Blangko Derry tidak dibuka.
   * TIDAK PERNAH melempar. Pulang { status: "unduh"|"gagal"|"perlu", catatan }.
   */
  async function buatSalinan(nomor) {
    const b = berkasSiap();
    if (!b) return { status: "perlu", catatan: "Belum ada berkas putusan yang siap dipakai, jadi salinan tidak dibuat. Pilih berkas putusan RTF, DOCX, DOC, atau PDF." };
    const minta = fungsi("alatMintaPdf");
    const mintaDariPdf = fungsi("alatMintaSalinanDariPdf");
    const terbit = fungsi("alatTerbitkanSalinan");
    const ketSalinan = fungsi("alatKetSalinanPutusan");
    const kenali = fungsi("alatKenaliBentukBerkas");
    const namaUnduhan = fungsi("alatNamaUnduhanBlangko");
    if (!minta || !mintaDariPdf || !terbit || !ketSalinan || !kenali || !namaUnduhan) return { status: "gagal", catatan: "Pembuat PDF salinan belum termuat di halaman ini. Muat ulang halaman, lalu ulangi." };
    try {
      // Bentuk dikenali dari ISI berkas yang dipilih (bukan nama).
      const bentukAsli = kenali((await bacaBita(b.file)).subarray(0, 8));
      if (!bentukAsli) return { status: "gagal", catatan: `Isi berkas ${b.nama} bukan RTF, DOCX, DOC, maupun PDF, jadi salinan tidak dibuat.` };
      // PDF yang masih kosong: tambahan digambar langsung di atas halaman PDF di server (satu metode dengan Blangko Derry dan ALETA ABT).
      if (bentukAsli === "pdf") {
        const dariPdf = await mintaDariPdf(await bacaBita(b.file));
        const namaPdf = namaUnduhan(nomor, `${namaDasarSalinan(b.nama)} - SALINAN`, "pdf");
        const tp = await terbit(dariPdf.blob, namaPdf, ketSalinan(dariPdf.d.salinan || null), !(dariPdf.d.salinan && dariPdf.d.salinan.gambarTtdPanitera));
        return { status: tp.ok ? "unduh" : "gagal", catatan: sebaris(tp.kalimat) };
      }
      // RTF dipakai apa adanya; DOCX/DOC sudah diubah ke RTF di server saat berkas dipilih (jalur konversi naskah yang sama dengan Blangko Derry).
      if (!b.rtf) {
        const sebab = (b.peringatan && b.peringatan[0]) || "";
        return { status: "gagal", catatan: `Berkas ${b.nama} belum dapat diubah menjadi RTF di server, jadi salinan tidak dibuat.${sebab ? ` ${sebab}` : ""}` };
      }
      let bita = await bacaBita(b.rtf);
      if (kenali(bita.subarray(0, 8)) !== "rtf") return { status: "gagal", catatan: `Hasil ubahan ${b.nama} bukan RTF, jadi salinan tidak dibuat.` };
      // Jejak sistem di RTF (grup tersembunyi, properti info) dibuang seperti pada RTF unduhan lain: tidak boleh sampai ke metadata PDF.
      const penjaga = globalThis.AletaPenjagaTanda;
      if (penjaga && typeof penjaga.bersihkanRtf === "function") {
        let teks = "";
        for (let k = 0; k < bita.length; k += 8192) teks += String.fromCharCode.apply(null, bita.subarray(k, k + 8192));
        const bersih = penjaga.bersihkanRtf(teks);
        if (bersih !== teks) {
          bita = new Uint8Array(bersih.length);
          for (let k = 0; k < bersih.length; k += 1) bita[k] = bersih.charCodeAt(k) & 255;
        }
      }
      let biner = "";
      for (let k = 0; k < bita.length; k += 0x8000) biner += String.fromCharCode.apply(null, bita.subarray(k, k + 0x8000));
      const hasil = await minta({ rtfBase64: btoa(biner), salinan: true });
      const nama = namaUnduhan(nomor, `${namaDasarSalinan(b.nama)} - SALINAN`, "pdf");
      const ket = ketSalinan(hasil.d.salinan || null);
      const t = await terbit(hasil.blob, nama, ket, !(hasil.d.salinan && hasil.d.salinan.gambarTtdPanitera));
      return { status: t.ok ? "unduh" : "gagal", catatan: sebaris(t.kalimat) };
    } catch (galat) {
      return { status: "gagal", catatan: `PDF salinan belum dapat dibuat: ${sebaris((galat && galat.message) || galat)}` };
    }
  }

  /** Menjalankan salinan di latar langkah SIPP: hasilnya masuk baris salinan; kegagalannya tidak menyentuh langkah lain. TIDAK PERNAH melempar. */
  async function kerjakanSalinan(nomor) {
    const sl = ctx.salinan;
    sl.hasil = false;
    sl.status = "jalan";
    sl.catatan = "Membuat PDF salinan…";
    render();
    let h;
    try {
      h = await buatSalinan(nomor);
    } catch (galat) {
      h = { status: "gagal", catatan: sebaris((galat && galat.message) || galat) };
    }
    if (!ctx || ctx.nomor !== nomor) return;
    ctx.salinan.status = h.status;
    ctx.salinan.catatan = h.catatan;
    ctx.salinan.hasil = true;
    render();
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
        // Bawaan centang MATI untuk yang sudah ada: mengganti adalah keputusan petugas, bukan bawaan.
        ctx.pilih.isi = false;
      } else {
        ctx.keadaan.terisi = k ? false : null;
      }
      // Sumber isian Putusan Akhir (baca saja): tanpa draf ALETA, berkas putusan di panel ini yang dibaca.
      // Dibaca juga bila putusan sudah terisi - petugas dapat mencentang untuk menggantinya.
      {
        const dr = await cekDraf(nomor);
        if (!ctx || ctx.nomor !== nomor) return;
        ctx.keadaan.draf = dr.ada;
        ctx.keadaan.versiDraf = dr.ada ? dr.versi : null;
        ctx.keadaan.sebabDraf = dr.ada ? "" : dr.sebab || "";
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
          // Bawaan centang mati untuk e-Doc yang sudah ada (keputusan petugas bila hendak diganti).
          if (c.adaPutusan) ctx.pilih.putusan = false;
          if (c.adaAnonim) ctx.pilih.anonim = false;
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
  // Berkas putusan yang diseret/dipilih (dipakai untuk e-Doc putusan dan anonimisasi)
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Satu berkas untuk perkara ini. Diperiksa seperti di Jadwalkan Putusan (bentuk, ukuran, bukan
   * naskah lain, bukan anonimisasi, sisa blangko); DOCX/DOC/PDF diubah server menjadi RTF supaya
   * anonimisasi mandiri dapat bekerja (jalur konversi yang sama dengan bagian Putusan otomatis).
   * Tidak ada yang ditulis ke SIPP dari sini: berkas baru dipakai ketika tombol utama ditekan.
   */
  async function terimaBerkas(daftar) {
    if (!ctx || ctx.sibuk) return;
    const file = Array.from(daftar || [])[0];
    if (!file) return;
    const nama = String(file.name || "");
    const e = { file, nama, ukuran: file.size || 0, status: "periksa", tolak: "", rtf: null, peringatan: [], bentuk: (/\.([a-z]+)$/i.exec(nama) || [, ""])[1].toLowerCase() };
    const pasangan = globalThis.aletaPutusanTerjadwalPasangan;
    const bukanNaskah = pasangan && typeof pasangan.tandaBukanNaskah === "function" ? pasangan.tandaBukanNaskah(nama) : "";
    if (!BENTUK_BERKAS.test(nama)) e.tolak = "bukan RTF, DOCX, DOC, atau PDF";
    else if (bukanNaskah) e.tolak = `bukan naskah putusan: ${bukanNaskah}`;
    else if (pasangan && typeof pasangan.namaAnonim === "function" && pasangan.namaAnonim(nama)) e.tolak = "anonimisasi dibuat otomatis dari putusan, jadi berkas ini tidak dipakai";
    else if (e.ukuran > BATAS_BERKAS) e.tolak = "lebih dari 10 MB";
    else if (e.ukuran === 0) e.tolak = "berkas kosong";
    if (e.tolak) {
      e.status = "ditolak";
      ctx.berkas = e;
      segarkanStatusAwal();
      render();
      return;
    }
    ctx.berkas = e;
    ctx.salinan.hasil = false;
    segarkanStatusAwal();
    render();
    const nomor = ctx.nomor;
    const deteksi = globalThis.aletaDeteksiSisa;
    if (deteksi && typeof deteksi.tinjau === "function") {
      let lanjut = true;
      try {
        const h = await deteksi.tinjau(file, { nama, jenis: "putusan", aksi: "unggah", massal: false });
        lanjut = !h || h.lanjut !== false;
      } catch {
        lanjut = true;
      }
      if (!ctx || ctx.nomor !== nomor || ctx.berkas !== e) return;
      if (!lanjut) {
        e.status = "ditolak";
        e.tolak = "dibatalkan karena masih ada sisa blangko";
        segarkanStatusAwal();
        render();
        return;
      }
    }
    const perlu = fungsi("a30PerluKeRtf");
    const ubah = fungsi("a30KonversiNaskah");
    if (perlu && ubah && perlu(nama)) {
      e.status = "ubah";
      render();
      let hasil = null;
      try {
        hasil = await ubah(file, "rtf");
      } catch (galat) {
        hasil = { ok: false, pesan: sebaris((galat && galat.message) || galat) };
      }
      if (!ctx || ctx.nomor !== nomor || ctx.berkas !== e) return;
      if (hasil && hasil.ok && hasil.berkas) {
        e.rtf = hasil.berkas;
        e.peringatan = Array.isArray(hasil.peringatan) ? hasil.peringatan.map(String) : [];
      } else {
        e.peringatan = [`Belum dapat diubah menjadi RTF (${sebaris((hasil && hasil.pesan) || "tanpa keterangan")}); anonimisasi memakai pembuat anonimisasi ABT.`];
      }
    } else if (e.bentuk === "rtf") {
      e.rtf = file;
    }
    e.status = "ok";
    if (!ctx.sibuk) segarkanStatusAwal();
    render();
  }

  function buangBerkas() {
    if (!ctx || ctx.sibuk) return;
    ctx.berkas = null;
    ctx.salinan.hasil = false;
    segarkanStatusAwal();
    render();
  }

  /** Berkas yang siap dipakai e-Doc (status ok), atau null. */
  function berkasSiap() {
    return ctx && ctx.berkas && ctx.berkas.status === "ok" ? ctx.berkas : null;
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
    // Tempat unggah berkas putusan (opsional): seret atau pilih; dipakai untuk e-Doc putusan dan anonimisasi.
    const berkasWadah = el("div", "aleta-pusipp-berkas");
    berkasWadah.setAttribute("data-pusipp", "berkas");
    berkasWadah.append(el("h3", "aleta-pusipp-berkas-judul", "Berkas putusan"));
    const zona = el("div", "aleta-pusipp-zona");
    zona.setAttribute("data-pusipp", "zona");
    zona.append(
      el("strong", "", "Seret berkas putusan ke sini, atau pilih"),
      el(
        "span",
        "aleta-pusipp-zona-bantu",
        "RTF, DOCX, DOC, atau PDF · paling besar 10 MB · dibaca untuk mengisi Putusan Akhir dan dipakai untuk e-Doc putusan dan e-Doc anonimisasi. " +
          "Tanpa berkas: isian dari draf putusan ALETA, e-Doc dicetak dari Blangko Derry di ABT."
      )
    );
    const pilihBerkas = document.createElement("input");
    pilihBerkas.type = "file";
    pilihBerkas.accept = ".rtf,.docx,.doc,.pdf";
    pilihBerkas.setAttribute("data-pusipp", "pilih-berkas");
    pilihBerkas.setAttribute("aria-label", "Pilih berkas putusan");
    pilihBerkas.addEventListener("change", () => {
      void terimaBerkas(pilihBerkas.files);
      pilihBerkas.value = "";
    });
    zona.appendChild(pilihBerkas);
    const sorot = (ya) => zona.setAttribute("data-sorot", ya ? "1" : "0");
    zona.addEventListener("dragenter", (e) => {
      e.preventDefault();
      sorot(true);
    });
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      sorot(true);
    });
    zona.addEventListener("dragleave", () => sorot(false));
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      sorot(false);
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) void terimaBerkas(dt.files);
    });
    const terpilih = el("div", "aleta-pusipp-berkas-terpilih");
    terpilih.setAttribute("data-pusipp", "berkas-terpilih");
    terpilih.setAttribute("aria-live", "polite");
    berkasWadah.append(zona, terpilih);
    badan.append(info, konfirm, daftar, berkasWadah);

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
      // "Centang semua" juga mencentang yang sudah ada di SIPP (itu berarti mengganti) - petugas yang memilih.
      for (const j of LANGKAH) ctx.pilih[j] = semua.checked;
      segarkanStatusAwal();
      render();
    });
    semuaLabel.append(semua, " Centang semua langkah");
    const utama = tombol("Putusan & unggah e-Doc", "aleta-pusipp-utama");
    utama.setAttribute("data-pusipp", "utama");
    // 30 Okt 2026: satu klik langsung bekerja (tanpa kotak "Akan ... Lanjutkan/Batal"); klik ganda ditolak jalankan() (ctx.sibuk).
    utama.addEventListener("click", () => void jalankan());
    aksi.append(semuaLabel, utama);
    kaki.append(ringkas, aksi);

    const laporan = el("div", "aleta-pusipp-laporan");
    laporan.setAttribute("aria-live", "polite");
    laporan.setAttribute("data-pusipp", "laporan");
    akar.append(kepala, badan, kaki, laporan);
    ctx.akar = akar;
    ctx.zona = zona;
    ctx.berkasTerpilih = terpilih;
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
      cek.disabled = ctx.sibuk;
      cek.setAttribute("data-pusipp-cek", j);
      cek.addEventListener("change", () => {
        ctx.pilih[j] = cek.checked;
        segarkanStatusAwal();
        render();
      });
      label.append(cek, ` ${NAMA[j]}`);
      const st = el("span", `aleta-pusipp-status aleta-pusipp-s-${STATUS[ctx.status[j]].nada}`, STATUS[ctx.status[j]].teks);
      st.setAttribute("data-pusipp-status", ctx.status[j]);
      // Penanda tulisan biasa per slot: Sudah terisi / Belum terisi / Sudah diunggah / Belum diunggah / Belum terbaca.
      const ada = j === "isi" ? ctx.keadaan.terisi : ctx.dibaca && !ctx.keadaan.galatEdoc ? (j === "putusan" ? ctx.keadaan.adaPutusan : ctx.keadaan.adaAnonim) : null;
      const penanda = el("span", "aleta-pusipp-penanda", typeof alatPenandaSlot === "function" ? alatPenandaSlot(j === "isi" ? "form" : j, ada) : "");
      penanda.setAttribute("data-pusipp-penanda", j);
      baris.append(label, penanda, st);
      if (ctx.catatan[j]) baris.appendChild(el("div", "aleta-pusipp-ket", ctx.catatan[j]));
      daftar.appendChild(baris);
    }

    // Baris tambahan "Ubah jadi PDF salinan" (5 Nov 2026): centang sendiri di luar tiga langkah SIPP, tidak menulis apa pun ke SIPP.
    {
      const sl = ctx.salinan;
      const st0 = STATUS[sl.status] || STATUS.tidak;
      const barisS = el("div", `aleta-pusipp-baris aleta-pusipp-${st0.nada}`);
      barisS.setAttribute("data-pusipp-salinan", "baris");
      const labelS = el("label", "aleta-pusipp-pilih");
      labelS.title = KET_SALINAN;
      const cekS = document.createElement("input");
      cekS.type = "checkbox";
      cekS.checked = ctx.pilih.salinan;
      cekS.disabled = ctx.sibuk;
      cekS.setAttribute("data-pusipp-cek", "salinan");
      cekS.addEventListener("change", () => {
        ctx.pilih.salinan = cekS.checked;
        ctx.salinan.hasil = false;
        segarkanStatusAwal();
        render();
      });
      labelS.append(cekS, ` ${NAMA_SALINAN}`);
      const stS = el("span", `aleta-pusipp-status aleta-pusipp-s-${st0.nada}`, st0.teks);
      stS.setAttribute("data-pusipp-status", sl.status);
      barisS.append(labelS, stS);
      if (sl.catatan) barisS.appendChild(el("div", "aleta-pusipp-ket", sl.catatan));
      daftar.appendChild(barisS);
    }

    // Berkas yang dipilih
    if (ctx.berkasTerpilih) {
      const k = ctx.berkasTerpilih;
      k.textContent = "";
      const b = ctx.berkas;
      if (ctx.zona) ctx.zona.setAttribute("aria-disabled", ctx.sibuk ? "true" : "false");
      const masuk = ctx.zona && ctx.zona.querySelector("input[type=file]");
      if (masuk) masuk.disabled = ctx.sibuk;
      if (b) {
        const baris = el("div", `aleta-pusipp-berkas-baris aleta-pusipp-berkas-${b.status}`);
        baris.setAttribute("data-status", b.status);
        const kiri = el("div", "aleta-pusipp-berkas-isi");
        kiri.append(
          el("div", "aleta-pusipp-berkas-nama", b.nama),
          el("div", "aleta-pusipp-berkas-ket", `${b.bentuk ? b.bentuk.toUpperCase() + " · " : ""}${Math.max(1, Math.round(b.ukuran / 1024))} KB`)
        );
        const chip =
          b.status === "ditolak"
            ? el("span", "aleta-pusipp-status aleta-pusipp-s-salah", `ditolak · ${b.tolak}`)
            : b.status === "ok"
              ? el("span", "aleta-pusipp-status aleta-pusipp-s-ok", "siap dipakai")
              : el("span", "aleta-pusipp-status aleta-pusipp-s-jalan", b.status === "ubah" ? "diubah menjadi RTF…" : "memeriksa…");
        const buang = tombol("Buang", "aleta-pusipp-kecil");
        buang.setAttribute("data-pusipp", "buang-berkas");
        buang.setAttribute("aria-label", `Buang ${b.nama}`);
        buang.disabled = ctx.sibuk;
        buang.addEventListener("click", buangBerkas);
        baris.append(kiri, chip, buang);
        k.appendChild(baris);
        for (const w of b.peringatan || []) k.appendChild(el("div", "aleta-pusipp-ket", w));
      }
    }

    const r = rencana();
    const semua = akar.querySelector("[data-pusipp='semua']");
    if (semua) {
      semua.checked = LANGKAH.every((j) => ctx.pilih[j]);
      semua.disabled = ctx.sibuk;
    }
    const ringkas = akar.querySelector(".aleta-pusipp-ringkas");
    const tanpaSumber = tanpaSumberIsi();
    const tanpaBerkasSalinan = r.salinan === 1 && r.total === 0 && !berkasSiap();
    const kalimatSalinan = ctx.salinan.hasil && ctx.salinan.status !== "tidak" ? ` · PDF salinan: ${ctx.salinan.catatan}` : r.salinan ? " · 1 PDF salinan akan diunduh ke komputer ini (tidak diunggah ke SIPP)" : "";
    ringkas.textContent = ctx.sibuk
      ? "Sedang bekerja - jangan menutup atau memuat ulang halaman ini."
      : r.total === 0 && r.salinan
        ? tanpaBerkasSalinan
          ? "Pilih berkas putusan lebih dulu: PDF salinan dibuat dari berkas itu."
          : kalimatSalinan.replace(/^ · /, "")
      : r.total === 0
        ? "Tidak ada yang dicentang. Yang sudah ada di SIPP dapat dicentang untuk diganti."
        : tanpaSumber
          ? "Pilih berkas putusan lebih dulu: belum ada draf putusan ALETA untuk mengisi Putusan Akhir."
          : `${r.isi ? `1 Putusan Akhir akan ${r.timpa.isi ? "diganti" : "diisi"} dan disimpan${berkasSiap() ? " dari berkas yang dipilih" : ""}` : "Putusan Akhir tidak diisi"} · ${r.edoc} e-Doc akan diunggah${berkasSiap() && r.edoc ? " dari berkas yang dipilih" : ""}${jumlahGanti(r) ? ` (${jumlahGanti(r)} di antaranya mengganti yang sudah ada)` : ""}${kalimatSalinan}`;
    const utama = akar.querySelector("[data-pusipp='utama']");
    const berkasBelum = Boolean(ctx.berkas && (ctx.berkas.status === "periksa" || ctx.berkas.status === "ubah"));
    utama.disabled = ctx.sibuk || Boolean(ctx.menungguTimpa) || (r.total === 0 && !r.salinan) || tanpaBerkasSalinan || !ctx.dibaca || berkasBelum || tanpaSumber;

    // 30 Okt 2026: bukan pertanyaan lagi - selama bekerja, apa yang sedang dikerjakan tampil sebagai kemajuan.
    const wadahKonfirm = akar.querySelector(".aleta-pusipp-konfirm-wadah");
    // Pertanyaan "Anda yakin menimpa?" yang sedang menunggu jawaban tidak boleh terhapus oleh gambar ulang.
    if (!ctx.menungguTimpa) wadahKonfirm.textContent = "";
    if (ctx.sibuk && ctx.kerjaTeks) {
      const kotak = el("div", "aleta-pusipp-kerja");
      kotak.setAttribute("role", "status");
      kotak.appendChild(el("p", "aleta-pusipp-konfirm-teks", ctx.kerjaTeks));
      kotak.appendChild(el("p", "aleta-pusipp-konfirm-ket", "Dicatat atas akun SIPP yang sedang masuk. Yang sudah ada di SIPP hanya diganti bila Anda mencentangnya; bila praperiksa menahan, pengisian berhenti dan tidak disimpan."));
      wadahKonfirm.appendChild(kotak);
    }
  }

  /** Nama lama (sebelum 30 Okt 2026) - kini satu klik langsung menjalankan, tanpa kotak konfirmasi. */
  function mintaKonfirmasi() {
    return jalankan();
  }

  /** Kalimat kemajuan: apa yang dikerjakan sekarang (dulu bunyi kotak konfirmasi). */
  function teksKerja(r) {
    const bagian = [];
    if (r.isi) bagian.push(`${r.timpa.isi ? "mengganti" : "mengisi"} dan menyimpan 1 Putusan Akhir dari ${berkasSiap() ? `berkas ${berkasSiap().nama}` : "draf putusan ALETA"}`);
    if (r.edoc) bagian.push(`${jumlahGanti(r) ? "mengunggah (sebagian mengganti)" : "mengunggah"} ${r.edoc} e-Doc (${[r.putusan ? "putusan" : "", r.anonim ? "anonimisasi" : ""].filter(Boolean).join(" dan ")})`);
    const t = bagian.join(", lalu ");
    return `Sedang ${t} untuk perkara ${ctx.nomor}.`;
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
      setStatus(j, l.nada === "salah" ? "gagal" : l.nada === "lewat" ? "lewat" : l.ditimpa ? "ditimpa" : "ok", l.teks);
    }
  }

  async function jalankan() {
    if (!ctx || ctx.sibuk || ctx.menungguTimpa || !ctx.dibaca) return;
    const r = rencana();
    if ((r.total === 0 && !r.salinan) || tanpaSumberIsi()) return;
    const nomor = ctx.nomor;
    // Konfirmasi SEBARIS hanya bila ada yang ditimpa. "Tidak" = kembali ke pilihan: tidak ada satu pun tulisan, dan
    // langkah lain yang bukan timpa juga belum berjalan. Tanpa yang ditimpa tidak ada pertanyaan sama sekali.
    const ditimpa = [r.timpa.isi ? "form" : "", r.timpa.putusan ? "putusan" : "", r.timpa.anonim ? "anonim" : ""].filter(Boolean);
    if (ditimpa.length && typeof alatKonfirmasiTimpa === "function") {
      const wadahTanya = ctx.akar && ctx.akar.querySelector(".aleta-pusipp-konfirm-wadah");
      ctx.menungguTimpa = true;
      render();
      let setuju = false;
      try {
        setuju = await alatKonfirmasiTimpa(wadahTanya, alatDaftarTimpa([{ nomor, slot: ditimpa }]));
      } finally {
        if (ctx) ctx.menungguTimpa = false;
      }
      if (!ctx || ctx.nomor !== nomor) return;
      if (!setuju) {
        render();
        return;
      }
    }
    ctx.sibuk = true;
    ctx.konfirm = false;
    ctx.kerjaTeks = teksKerja(r);
    if (ctx.laporan) ctx.laporan.textContent = "";
    for (const j of LANGKAH) if (ctx.status[j] === "tunggu" || ctx.status[j] === "timpa") ctx.status[j] = "jalan";
    // PDF salinan (5 Nov 2026) berjalan bersamaan dengan langkah SIPP dan berdiri sendiri: gagalnya tidak membatalkan isi form
    // atau unggah e-Doc, dan gagalnya unggah tidak membatalkan salinan (selama berkasnya ada). Tidak ada tulisan ke SIPP darinya.
    const janjiSalinan = r.salinan ? kerjakanSalinan(nomor) : null;
    render();

    const mod = globalThis.aletaPutusanEdoc;
    const akhir = [];
    try {
      if (r.total === 0) return; // hanya salinan yang dicentang: tidak ada langkah SIPP
      if (!mod) throw new Error("Pengunggah e-Doc belum termuat di halaman ini");
      if (r.isi) {
        // Isi & simpan: alur panel ekstensi yang SAMA.
        const gagalSemua = (sebab) => {
          setStatus("isi", "gagal", sebab);
          if (r.putusan) setStatus("putusan", "gagal", TIDAK_DIKERJAKAN);
          if (r.anonim) setStatus("anonim", "gagal", TIDAK_DIKERJAKAN);
        };
        const berkasIsi = berkasSiap();
        // 21 Okt 2026: sumber isian diperiksa SEBELUM blangko dibuka. Dulu blangko dibuka lebih dulu, lalu alur
        // berhenti di "Belum ada draf" tanpa mengisi apa pun (yang terlihat petugas: borang terbuka, kosong).
        if (!berkasIsi) {
          setStatus("isi", "jalan", "Memeriksa draf putusan ALETA…");
          const dr = await cekDraf(nomor);
          if (!ctx || ctx.nomor !== nomor) return;
          ctx.keadaan.draf = dr.ada;
          ctx.keadaan.versiDraf = dr.ada ? dr.versi : null;
          if (dr.ada === false) {
            gagalSemua(sebabTanpaSumber());
            return;
          }
        }
        setStatus("isi", "jalan", "Membuka blangko Putusan Akhir…");
        const buka = fungsi("s1BukaBlangkoPutusan");
        if (!buka) throw new Error("Pembuka blangko Putusan Akhir belum termuat");
        const b = await buka();
        if (!b.ok) {
          gagalSemua(b.pesan);
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
          gagalSemua(
            "Blangko Putusan Akhir terbuka, tetapi bagian Putusan otomatis di panel ALETA tidak termuat dalam 15 detik, jadi tidak ada yang diisikan. " +
              "Muat ulang data perkara dari menu ⋯ panel ALETA (atau muat ulang halaman), lalu jalankan lagi - blangko yang sudah terbuka dipakai."
          );
          return;
        }
        setStatus(
          "isi",
          "jalan",
          berkasIsi ? `Membaca berkas ${berkasIsi.nama}, memeriksa, mengisi, dan menyimpan…` : "Mengambil draf, memeriksa, mengisi, dan menyimpan…"
        );
        const h = await bagianOto.otomatis({
          edoc: r.edoc > 0,
          denganPutusan: r.putusan > 0,
          denganAnonim: r.anonim > 0,
          // Tanda timpa EKSPLISIT per langkah (hanya yang dicentang dan terbukti sudah ada di SIPP).
          timpaIsi: r.timpa.isi,
          timpaPutusan: r.timpa.putusan,
          timpaAnonim: r.timpa.anonim,
          // 21 Okt 2026: berkas yang dipilih di panel ini DIBACA untuk mengisi Putusan Akhir (naskah) dan menjadi
          // e-Doc putusan serta bahan anonimisasi. Tanpa berkas: isian dari draf ALETA, e-Doc dicetak dari ABT.
          naskah: berkasIsi ? berkasIsi.file : null,
          naskahRtf: berkasIsi ? berkasIsi.rtf : null,
          putusan: berkasIsi ? berkasIsi.file : null,
          putusanRtf: berkasIsi ? berkasIsi.rtf : null,
          // Kotak muat ulang melayang di halaman: panel ini dapat tergambar ulang saat SIPP menyegarkan isinya.
          melayang: true,
        });
        if (!h || !h.tersimpan) {
          gagalSemua(sebaris((h && h.pesan) || (h && h.bunyi) || "Pengisian berhenti sebelum Simpan."));
          return;
        }
        setStatus("isi", r.timpa.isi ? "ditimpa" : "ok", r.timpa.isi ? "Disimpan ulang di SIPP (menimpa isi lama)." : "Tersimpan di SIPP.");
        if (r.edoc > 0) {
          const langkah = h.edoc && Array.isArray(h.edoc.langkah) ? h.edoc.langkah : [];
          if (langkah.length) terapkanLangkahEdoc(langkah);
          else {
            const ok = Boolean(h.edoc && h.edoc.ok);
            const sebab = (h.edoc && h.edoc.bunyi) || "tidak ada laporan dari pengunggah e-Doc (Putusan Akhir sudah tersimpan; ulangi unggah e-Doc saja dari panel ini)";
            if (r.putusan) setStatus("putusan", ok ? (r.timpa.putusan ? "ditimpa" : "ok") : "gagal", ok ? (r.timpa.putusan ? "diganti" : "terunggah") : sebab);
            if (r.anonim) setStatus("anonim", ok ? (r.timpa.anonim ? "ditimpa" : "ok") : "gagal", ok ? (r.timpa.anonim ? "diganti" : "terunggah") : sebab);
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
      if (kunci.catatan && ctx.laporan) ctx.laporan.textContent = kunci.catatan;
      let hasil;
      try {
        hasil = await mod.jalankan({
          nomorPerkara: nomor,
          kabar: ctx.laporan,
          wadah: ctx.laporan,
          denganPutusan: r.putusan > 0,
          denganAnonim: r.anonim > 0,
          timpaPutusan: r.timpa.putusan,
          timpaAnonim: r.timpa.anonim,
          putusan: berkasSiap() ? berkasSiap().file : null,
          putusanRtf: berkasSiap() ? berkasSiap().rtf : null,
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
      if (janjiSalinan) await janjiSalinan;
      if (ctx && r.total === 0) {
        // Hanya salinan: keadaan SIPP tidak berubah, jadi tidak dibaca ulang.
        ctx.sibuk = false;
        render();
      } else if (ctx) {
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
            if (sisaStatus[j] === "ok" || sisaStatus[j] === "gagal" || sisaStatus[j] === "ditimpa") {
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
      b.id = "aleta-pusipp-tombol";
      b.setAttribute("data-pusipp", "tombol");
      b.setAttribute("aria-controls", ID_PANEL);
      b.append(el("span", "aleta-pusipp-ikon", "⚖"), " Putusan Otomatis");
      b.addEventListener("click", () => {
        if (!ctx) return;
        ctx.terbuka = !ctx.terbuka;
        ingatTerbuka(ctx.nomor, ctx.terbuka);
        const baris = barisTombol(document) || tr;
        pasangPanel(baris);
      });
      td.appendChild(b);
    }
    // Urutan tetap (Penetapan, Putusan, Jadwalkan, Buka di ABT/ALETA) dijaga SATU pengurut bersama (panel-alat.js).
    if (td.parentElement !== tr) {
      const l1 = tr.querySelector(":scope > .aleta-l1-submenu");
      tr.insertBefore(td, l1 || null);
    }
    if (typeof alatUrutkanTombolSipp === "function") alatUrutkanTombolSipp(tr);
    const b = td.querySelector("button");
    if (b) b.setAttribute("aria-expanded", ctx && ctx.terbuka ? "true" : "false");
    return td;
  }

  /**
   * 22 Okt 2026: panel dibuka sebagai POP-UP di tengah layar (popup-aksi.js), bukan menurunkan tabel di halaman.
   * Isi panel, hak peran, dan tombol jalankannya tidak berubah. Ditutup petugas (x, klik dua kali di luar,
   * Escape) = terlipat lagi; selama putusan sedang ditulis ke SIPP, penutupan ditahan.
   */
  function sinkronModal() {
    const m = globalThis.aletaPopupAksi;
    if (!m || !ctx || !ctx.akar) return;
    const nomor = ctx.nomor;
    m.atur(`putusan:${nomor}`, ctx.akar, ctx.terbuka, {
      judul: `Putusan Otomatis · ${nomor}`,
      sibuk: () => Boolean(ctx && ctx.sibuk),
      saatTutup: () => {
        if (!ctx || ctx.nomor !== nomor) return;
        ctx.terbuka = false;
        ingatTerbuka(nomor, false);
        const tb = document.getElementById("aleta-pusipp-tombol");
        if (tb) tb.setAttribute("aria-expanded", "false");
      },
    });
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
    sinkronModal();
    const tb = tr.querySelector(".aleta-pusipp-tombol");
    if (tb) tb.setAttribute("aria-expanded", ctx.terbuka ? "true" : "false");
    if (ctx.terbuka && !ctx.dibaca && !ctx.memuat && !ctx.sibuk) void muat();
    else if (ctx.dirender === false) render();
  }

  function bersihkan(doc) {
    const d = doc || document;
    if (globalThis.aletaPopupAksi) globalThis.aletaPopupAksi.lepas("putusan:");
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
      // Bawaan TERLIPAT; terbuka lagi HANYA bila petugas membukanya pada kunjungan halaman yang sama
      // (mis. SIPP menyegarkan isi halaman tanpa berpindah). Muat ulang / kembali ke halaman = terlipat.
      ctx.terbuka = terbukaTersimpan(nomor);
    }
    pasangTombol(tr);
    pasangPanel(tr);
    return { tombol: true, panel: Boolean(ctx.akar && !ctx.akar.hidden) };
  }

  let detak = null;
  function mulaiDetak() {
    if (detak) return;
    detak = (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.denyut : (f, m) => setInterval(f, m))(() => {
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
    versi: "b2-21okt",
    pasang,
    bersihkan,
    muat,
    jalankan,
    mintaKonfirmasi,
    keadaan: () => ctx,
    terimaBerkas,
    buangBerkas,
    berkasSiap,
    murni: { berhak, barisTombol, nomorHalaman, STATUS, LANGKAH },
  };
  void mulai();
})();
