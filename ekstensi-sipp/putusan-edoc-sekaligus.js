"use strict";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS + e-DOC PUTUSAN + e-DOC ANONIMISASI - SATU KALI KERJA (20 Okt 2026, agen B2)
 * ============================================================================
 *
 * Permintaan hakim: "waktu saya pakai putusan otomatis masih belum upload
 * sekaligus e-Doc putusan dan e-Doc anonimisasi, buat bisa langsung saat
 * upload putusan otomatis".
 *
 * Sebabnya: unggah e-Doc sesudah Putusan otomatis (a30BarisSekaligus di
 * konten.js) hanya hidup bila petugas MEMILIH berkas naskah di panel. Putusan
 * otomatis yang berangkat dari draf (Blangko Derry di ABT, draf H-7, mode
 * otomatis saat blangko Putusan Akhir dibuka) tidak membawa berkas apa pun,
 * jadi sesudah Simpan tidak ada yang diunggah.
 *
 * Modul ini menutup celah itu. Begitu Putusan Akhir TERBUKTI tersimpan (bukti
 * dari SIPP, bukan dari tombol yang ditekan - simpanPutusanLaluBuka), alurnya
 * lanjut di tempat yang sama:
 *
 *   1. cek       e-Doc apa yang SUDAH ada di SIPP (rute unggah-massal/cek);
 *                yang sudah ada TIDAK diganti, hanya dilaporkan "sudah ada";
 *   2. putusan   berkas putusan: berkas yang dipilih petugas di panel bila ada;
 *                bila tidak, RTF yang dicetak ABT dari Blangko Derry putusan
 *                perkara ini (blangko dipilih menurut jenis, status, verstek,
 *                kumulasi, dan keadaan putusan - pemilih yang sama dengan
 *                Unggah massal di ABT; hak buka blangko diperiksa ABT);
 *   3. anonim    penyamar ALETA (rute anonim-mandiri), cadangan anonimisasi
 *                ABT dengan akun ABT petugas di peramban ini; sisa data pribadi
 *                yang tidak dapat disamarkan ditanyakan, tidak ditelan;
 *   4. unggah    SATU kiriman ke rute unggah-sipp (putusan + anonimisasi) -
 *                rute itu yang menegakkan hak (Super Admin, Admin, Hakim) dan
 *                memeriksa isinya sebelum apa pun ditulis;
 *   5. laporan   satu baris per langkah: tercatat / dilewati karena sudah ada /
 *                gagal beserta sebabnya.
 *
 * ATURAN YANG DIJAGA
 *   - Putusan Akhir yang SUDAH tersimpan tidak pernah dibatalkan oleh langkah
 *     e-Doc mana pun. Anonimisasi yang gagal tidak menahan e-Doc putusan.
 *   - Tidak ada e-Doc yang ditimpa. Cek gagal terbaca = tidak mengunggah apa
 *     pun (lebih baik berhenti daripada menimpa), dengan tombol mengulang.
 *   - Berkas putusan/anonimisasi belum tersedia (blangko belum dipetakan,
 *     token ABT belum tercatat, sesi ABT habis, ...) = disebut sebabnya, dan
 *     tombol "Ulangi unggah e-Doc saja" mengulang LANGKAH e-Doc tanpa
 *     menyentuh Putusan Akhir.
 *   - Saklar: bawaan menyala, dapat dimatikan petugas (tersimpan di
 *     chrome.storage.local, kunci putusanEdocSekaligus).
 *   - Tidak satu pun nama berkas memuat kata ALETA (dibersihkan di sini juga).
 *   - Modul ini tidak menulis ke SIPP sendiri: semua tulisan lewat rute
 *     unggah-sipp portal -> bot.
 *
 * Kebergantungan (dari skrip konten lain, dicari saat dipakai): alatAmbil,
 * alatMuatPetaBlangkoLengkap, alatPetaUntukPerkara, alatBlangkoLengkap,
 * alatBlangkoTerpetakan, alatNamaUnduhanBlangko, alatBolehUnggahPutusanKini
 * (panel-alat.js); abtKlienBuat (abt-klien.js); a30PerkaraIdUntukAbt,
 * a30SiapkanAnonimisasi, a30UnggahEdoc, a30Tanya (konten.js).
 */
(function putusanEdocSekaligusModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPutusanEdoc) return;

  const KUNCI_SAKLAR = "putusanEdocSekaligus";
  const API = {
    daftar: "/aleta/api/aleta-ecourt/unggah-massal",
    cek: "/aleta/api/aleta-ecourt/unggah-massal/cek",
    anonim: "/aleta/api/aleta-ecourt/putusan/anonim-mandiri",
  };
  const BATAS_ANONIM_MANDIRI_MS = 90000;

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  /** Nama berkas yang dikirim ke SIPP: tanpa kata ALETA (aturan tetap). */
  function bersihNama(nama) {
    return String(nama || "")
      .replace(/aleta/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+(\.[A-Za-z0-9]{2,5})$/, "$1")
      .trim();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Saklar
  // ───────────────────────────────────────────────────────────────────────
  async function bacaSaklar() {
    try {
      const s = await chrome.storage.local.get([KUNCI_SAKLAR]);
      return !(s && s[KUNCI_SAKLAR] === false);
    } catch {
      return true;
    }
  }

  function simpanSaklar(nyala) {
    try {
      Promise.resolve(chrome.storage.local.set({ [KUNCI_SAKLAR]: Boolean(nyala) })).catch(() => undefined);
    } catch {
      /* berlaku untuk halaman ini saja */
    }
  }

  /**
   * Baris centang "sekali jalan" untuk Putusan otomatis TANPA berkas yang dipilih.
   * Bawaan menyala; pilihan petugas diingat. tampilkan(false) menyembunyikannya
   * (berkas dipilih di panel: baris berkas yang lama yang berlaku).
   */
  function barisSaklar() {
    const baris = el("label", "aleta-a30-pilihan aleta-b2-sekaligus");
    baris.setAttribute("data-b2-fitur", "sekaligus-abt");
    const cek = document.createElement("input");
    cek.type = "checkbox";
    cek.checked = true;
    cek.className = "aleta-abt-centang";
    const teks = el(
      "span",
      "aleta-a30-pilihan-teks",
      "Sekali jalan: sesudah Putusan Akhir TERBUKTI tersimpan, e-Doc putusan (dicetak dari Blangko Derry di ABT) dan e-Doc anonimisasinya " +
        "(dibuat otomatis) langsung diunggah ke SIPP. Yang sudah ada di SIPP tidak diganti. Perlu sesi ABT di peramban ini; lepas centang untuk menyimpan putusan saja."
    );
    baris.append(cek, teks);
    let tampil = true;
    void bacaSaklar().then((nyala) => {
      cek.checked = nyala;
    });
    cek.addEventListener("change", () => simpanSaklar(cek.checked));
    return {
      baris,
      centang: cek,
      tampilkan(ya) {
        tampil = Boolean(ya);
        baris.style.display = tampil ? "" : "none";
      },
      dipakai: () => tampil && cek.checked,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Jaringan ke portal
  // ───────────────────────────────────────────────────────────────────────
  /** Satu permintaan ke portal. Pulang { ok, status, data, pesan }; TIDAK PERNAH melempar. */
  async function ambilJson(alamat, opsi, sebut) {
    const ambil = fungsi("alatAmbil");
    let r;
    try {
      r = ambil ? await ambil(alamat, opsi, sebut) : await fetch(alamat, opsi);
    } catch (galat) {
      return { ok: false, status: 0, data: null, pesan: sebaris((galat && galat.message) || galat) || `${sebut} gagal.` };
    }
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    const galatPortal = luar && luar.error ? (typeof luar.error === "object" ? luar.error.message : luar.error) : "";
    const pesan = sebaris(
      (data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) || galatPortal || (luar && luar.alasan) || ""
    );
    const okHttp = Boolean(r.ok);
    return { ok: okHttp && !(data && typeof data === "object" && data.ok === false), status: r.status, data, pesan };
  }

  /** Apa yang SUDAH ada di SIPP. Pulang { ok, adaBaris, adaPutusan, adaAnonim, jalurPutusan, jalurAnonim } | { ok:false, sebab }. */
  async function cekSlot(perkaraId) {
    const r = await ambilJson(
      `${API.cek}?jenis=putusan&perkaraId=${encodeURIComponent(String(perkaraId))}`,
      { credentials: "include", cache: "no-store" },
      "Memeriksa e-Doc di SIPP"
    );
    if (!r.ok || !r.data || typeof r.data !== "object") {
      return { ok: false, sebab: r.pesan || `portal menjawab ${r.status || "tidak ada"}` };
    }
    const d = r.data;
    return {
      ok: true,
      adaBaris: d.adaBaris !== false,
      adaPutusan: Boolean(d.adaPutusan),
      adaAnonim: Boolean(d.adaAnonim),
      jalurPutusan: sebaris(d.jalurPutusan),
      jalurAnonim: sebaris(d.jalurAnonim),
    };
  }

  /** Baris perkara ini di daftar unggah (jenis, status putusan, verstek, kumulasi, keadaan) - bahan pemilih blangko. */
  async function barisDaftar(perkaraId, nomorPerkara) {
    const r = await ambilJson(`${API.daftar}?putusan=semua`, { credentials: "include", cache: "no-store" }, "Membaca daftar putusan");
    if (!r.ok || !r.data || !Array.isArray(r.data.putusan)) {
      return { ok: false, sebab: `daftar putusan tidak terbaca (${r.pesan || `portal menjawab ${r.status || "tidak ada"}`})` };
    }
    const rapat = (x) => String(x || "").replace(/\s+/g, "").toLowerCase();
    const baris = r.data.putusan.find((x) => String(x.perkaraId) === String(perkaraId)) || r.data.putusan.find((x) => rapat(x.nomorPerkara) === rapat(nomorPerkara));
    if (!baris) {
      return { ok: false, sebab: "perkara ini tidak ada di daftar putusan yang menunggu e-Doc (jenis dan status putusannya tidak terbaca)" };
    }
    return { ok: true, baris };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Berkas putusan dari ABT (Blangko Derry putusan perkara ini)
  // ───────────────────────────────────────────────────────────────────────
  function asalAbt() {
    return `${location.origin}/aps_badilag/abt`;
  }

  /**
   * RTF putusan yang dicetak ABT untuk perkara ini. Pulang { ok, berkas: File, blangko } atau { ok:false, sebab }.
   * Tidak menulis apa pun ke SIPP; hanya membaca dari ABT dengan sesi ABT petugas di peramban ini.
   */
  async function putusanDariAbt(p) {
    const muatPeta = fungsi("alatMuatPetaBlangkoLengkap");
    const pilih = fungsi("alatPetaUntukPerkara");
    const lengkap = fungsi("alatBlangkoLengkap");
    const terpetakan = fungsi("alatBlangkoTerpetakan");
    const buatKlien = fungsi("abtKlienBuat");
    if (!muatPeta || !pilih || !lengkap || !terpetakan) return { ok: false, sebab: "pemetaan blangko putusan belum termuat di halaman ini" };
    if (!buatKlien) return { ok: false, sebab: "penghubung ABT belum termuat di halaman ini" };

    const d = await (p.deps.barisDaftar || barisDaftar)(p.perkaraId, p.nomorPerkara);
    if (!d.ok) return { ok: false, sebab: d.sebab };
    const x = d.baris;

    let peta;
    try {
      peta = await muatPeta();
    } catch (galat) {
      return { ok: false, sebab: `pemetaan blangko tidak terbaca (${sebaris((galat && galat.message) || galat)})` };
    }
    const h = pilih(peta, x.jenisPerkara, x.statusPutusan || "", Boolean(x.verstek), x.kumulasi || null, Array.isArray(x.keadaanPutusan) ? x.keadaanPutusan : []);
    const b = h && h.baris ? h.baris : null;
    if (!b || !terpetakan(b)) {
      return { ok: false, sebab: `blangko putusan untuk ${x.jenisPerkara || "jenis perkara ini"} belum dipetakan (Pemetaan blangko putusan)` };
    }
    if (!lengkap(b)) {
      return {
        ok: false,
        sebab: `blangko "${b.berkas}" belum tercatat tokennya di peramban ini - buka halaman blangko putusan di ABT sekali, lalu ulangi`,
      };
    }

    const klien = buatKlien({ ambil: (u, i) => fetch(u, i), asal: asalAbt() });
    let hak;
    try {
      hak = await klien.periksaHakBuka({ a: b.a, b: b.b, perkaraId: p.perkaraId });
    } catch (galat) {
      return { ok: false, sebab: `ABT tidak terjangkau (${sebaris((galat && galat.message) || galat)})` };
    }
    if (!hak || hak.ok === false) {
      return { ok: false, sebab: `ABT menolak membuka blangko ini: ${sebaris((hak && (hak.pesan || hak.sebab)) || "alasan tidak terbaca")}` };
    }
    let cetak;
    try {
      cetak = await klien.cetak({ a: b.a, b: b.b, perkaraId: p.perkaraId });
    } catch (galat) {
      return { ok: false, sebab: `ABT tidak terjangkau (${sebaris((galat && galat.message) || galat)})` };
    }
    if (!cetak || !cetak.ok || !cetak.rtf) {
      return { ok: false, sebab: `ABT tidak mengembalikan berkas: ${sebaris((cetak && (cetak.pesan || cetak.sebab)) || "tanpa keterangan")}` };
    }
    const baku = fungsi("alatNamaUnduhanBlangko");
    let nama = (baku && baku(p.nomorPerkara, b.berkas, "rtf")) || `${String(p.nomorPerkara || "putusan").replace(/[\\/:*?"<>|]+/g, "_")} - ${b.berkas}.rtf`;
    nama = bersihNama(nama) || "putusan.rtf";
    if (!/\.rtf$/i.test(nama)) nama = `${nama.replace(/\.[A-Za-z0-9]{2,5}$/, "")}.rtf`;
    return { ok: true, berkas: new File([cetak.rtf], nama, { type: "application/rtf" }), blangko: b.berkas };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Anonimisasi: penyamar lebih dulu, ABT cadangan
  // ───────────────────────────────────────────────────────────────────────
  function keBase64(buf) {
    const b = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
    return btoa(s);
  }
  function dariBase64(b64) {
    const s = atob(String(b64 || ""));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i);
    return b;
  }

  /** Penyamar di portal. Pulang { ok, berkas: File, sisa[] } atau { ok:false, sebab }. */
  async function anonimDenganPenyamar(p, putusan) {
    let bita;
    try {
      bita = await putusan.arrayBuffer();
    } catch (galat) {
      return { ok: false, sebab: `berkas putusan tidak terbaca (${sebaris((galat && galat.message) || galat)})` };
    }
    const r = await ambilJson(
      API.anonim,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtfBase64: keBase64(bita), nomorPerkara: String(p.nomorPerkara || "") }),
        batasMs: BATAS_ANONIM_MANDIRI_MS,
      },
      "Menyamarkan putusan"
    );
    if (!r.ok || !r.data || !r.data.rtfBase64) return { ok: false, sebab: r.pesan || `portal menjawab ${r.status || "tidak ada"}` };
    const nama = bersihNama(String(putusan.name || "putusan.rtf").replace(/\.[A-Za-z0-9]{2,5}$/, "")) + " - anonimisasi.rtf";
    return {
      ok: true,
      berkas: new File([dariBase64(r.data.rtfBase64)], nama, { type: "application/rtf" }),
      sisa: Array.isArray(r.data.sisa) ? r.data.sisa : [],
    };
  }

  /**
   * Menyiapkan berkas anonimisasi (belum mengirim apa pun). Pulang
   * { ok, berkas, tetapUnggah?, samarkanSisa? } atau { ok:false, sebab }.
   */
  async function siapkanAnonim(p, putusan, lapor) {
    // Penyamar bekerja atas RTF dan menghasilkan RTF; berkas pilihan petugas berbentuk lain (DOCX/DOC/PDF)
    // langsung ke jalur cadangan, yang mengubah bentuknya dan mengembalikan anonimisasi dalam bentuk yang sama.
    const bentukRtf = /\.rtf$/i.test(String((putusan && putusan.name) || ""));
    if (bentukRtf) lapor("Anonimisasi: menyamarkan naskah putusan…");
    const mandiri = bentukRtf ? await (p.deps.penyamar || anonimDenganPenyamar)(p, putusan) : { ok: false, sebab: "berkas putusan bukan RTF" };
    if (mandiri.ok) {
      const sisa = mandiri.sisa || [];
      if (!sisa.length) return { ok: true, berkas: mandiri.berkas, samarkanSisa: true };
      // Masih ada yang tampak data pribadi: petugas yang memutuskan, bukan kami.
      const tanya = p.deps.tanya || fungsi("a30Tanya");
      const ya =
        p.wadah && tanya
          ? await tanya(p.wadah, {
              judul: "Pemeriksaan anonimisasi sebelum unggah ke SIPP",
              baris: [
                `Masih ada ${sisa.length} bagian yang tampaknya data pribadi di anonimisasi dan tidak dapat disamarkan otomatis.`,
                "Bila tetap diunggah, berkas anonimisasi ini TERBIT apa adanya di Direktori Putusan, dan keputusan Anda tercatat di jejak.",
              ],
              daftar: sisa.slice(0, 12).map((s) => `${s.jenis} "${s.kata}"${s.konteks ? `: …${s.konteks}…` : ""}`),
              centang: "Sudah saya periksa",
              ya: "Tetap unggah",
              tidak: "Jangan unggah anonimisasi",
            })
          : false;
      if (!ya) {
        return { ok: false, sebab: `anonimisasi masih memuat ${sisa.length} data pribadi dan tidak diunggah (samarkan lalu unggah lewat bagian "Unggah putusan ke SIPP")` };
      }
      const nama = Array.from(new Set(sisa.filter((s) => s.jenis === "nama pihak").map((s) => String(s.kata))));
      return { ok: true, berkas: mandiri.berkas, samarkanSisa: true, ...(nama.length ? { tetapUnggah: { nama } } : {}) };
    }
    // Cadangan: anonimisasi ABT dengan akun ABT petugas, lalu pemeriksa yang sudah ada di konten.js.
    const abt = p.deps.anonimAbt || fungsi("a30SiapkanAnonimisasi");
    if (!abt) return { ok: false, sebab: `${bentukRtf ? `penyamar gagal (${mandiri.sebab}) dan ` : ""}anonimisasi ABT belum termuat` };
    lapor(bentukRtf ? "Anonimisasi: penyamar tidak tersedia, meminta ABT menganonimkan…" : "Anonimisasi: meminta ABT menganonimkan…");
    const c = await abt({ berkas: putusan, rtf: bentukRtf ? putusan : p.putusanRtf || null, nomorPerkara: p.nomorPerkara, kabar: p.kabar, wadahTanya: p.wadah });
    if (c && c.ok && c.berkas) {
      return { ok: true, berkas: c.berkas, ...(c.tetapUnggah ? { tetapUnggah: c.tetapUnggah } : {}) };
    }
    return { ok: false, sebab: `${sebaris((c && c.pesan) || "anonimisasi ABT gagal")}${bentukRtf ? ` (penyamar: ${mandiri.sebab})` : ""}` };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Laporan per langkah
  // ───────────────────────────────────────────────────────────────────────
  const JUDUL = { putusan: "e-Doc putusan", anonimisasi: "e-Doc anonimisasi" };
  const langkah = (kunci, teks, nada) => ({ kunci, judul: JUDUL[kunci], teks: sebaris(teks), nada });

  /** Kalimat ringkas seluruh langkah, untuk kabar panel dan hasil. */
  function bunyiLangkah(daftar) {
    return (daftar || []).map((l) => `${l.judul}: ${l.teks}`).join(". ").replace(/\.\.+/g, ".") + ((daftar || []).length ? "." : "");
  }

  /** Hasil a30UnggahEdoc -> langkah per berkas. */
  function langkahDariUnggah(hasil, kirim) {
    const hasilLangkah = [];
    const berkas = Array.isArray(hasil && hasil.berkas) ? hasil.berkas : [];
    const dari = (jenis) => berkas.find((b) => b && b.jenis === jenis);
    for (const kunci of ["putusan", "anonimisasi"]) {
      if (!kirim[kunci]) continue;
      const b = dari(kunci);
      if (b && b.ok) {
        hasilLangkah.push(langkah(kunci, `terunggah${b.jalur ? ` (${b.jalur})` : ""}`, "ok"));
      } else if (b) {
        const pesanGagal = fungsi("pesanGagalUnggah");
        hasilLangkah.push(langkah(kunci, `gagal - ${pesanGagal ? pesanGagal(b) : sebaris(b.alasan || b.pesan || "ditolak")}`, "salah"));
      } else if (hasil && hasil.ok && !berkas.length) {
        // Pengunggah lama tanpa rincian per berkas: berhasil berarti semua yang dikirim masuk.
        hasilLangkah.push(langkah(kunci, "terunggah", "ok"));
      } else if (kunci === "anonimisasi" && hasil && hasil.anonimDitolak) {
        hasilLangkah.push(langkah(kunci, `tidak diunggah - ${hasil.anonimDitolak}`, "salah"));
      } else {
        hasilLangkah.push(langkah(kunci, `gagal - ${sebaris((hasil && hasil.bunyi) || "tidak ada jawaban untuk berkas ini")}`, "salah"));
      }
    }
    return hasilLangkah;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Alur utama
  // ───────────────────────────────────────────────────────────────────────
  /**
   * Menjalankan langkah e-Doc SESUDAH Putusan Akhir tersimpan (atau diulang sendirian).
   *
   * @param {{nomorPerkara:string, kabar?:HTMLElement, wadah?:HTMLElement, putusan?:File|null,
   *          anonim?:File|null, denganAnonim?:boolean, perkaraId?:string, deps?:object}} p
   *   putusan  berkas pilihan petugas (bila ada); kosong = dicetak dari ABT
   *   anonim   berkas anonimisasi pilihan petugas (bila ada); kosong = dibuat
   * @returns {Promise<{ok:boolean, bunyi:string, langkah:Array, perluBerkas?:boolean}>} TIDAK PERNAH melempar
   */
  async function jalankan(p) {
    const arg = { ...(p || {}) };
    arg.deps = arg.deps || {};
    const hasil = [];
    const lapor = (teks) => {
      if (arg.kabar) {
        arg.kabar.className = "aleta-abt-kabar";
        arg.kabar.textContent = teks;
      }
    };
    const selesai = (ok, ekstra) => ({ ok, bunyi: bunyiLangkah(hasil), langkah: hasil, ...(ekstra || {}) });
    try {
      // Hak peran: portal menegakkannya lagi (403), ini hanya mencegah perjalanan sia-sia.
      const boleh = arg.deps.bolehUnggah ? arg.deps.bolehUnggah() : fungsi("alatBolehUnggahPutusanKini") ? fungsi("alatBolehUnggahPutusanKini")() : null;
      if (boleh === false) {
        hasil.push(langkah("putusan", "dilewati - peran akun ini tidak berhak mengunggah putusan", "lewat"));
        hasil.push(langkah("anonimisasi", "dilewati - peran akun ini tidak berhak mengunggah putusan", "lewat"));
        return selesai(true);
      }
      const denganAnonim = arg.denganAnonim !== false;
      const denganPutusan = arg.denganPutusan !== false;
      if (!denganPutusan && !denganAnonim) return selesai(true);

      let perkaraId = String(arg.perkaraId || "");
      if (!perkaraId) {
        const cari = arg.deps.perkaraId || fungsi("a30PerkaraIdUntukAbt");
        perkaraId = cari ? String((await cari(arg.nomorPerkara)) || "") : "";
      }
      if (!/^\d+$/.test(perkaraId)) {
        if (denganPutusan) hasil.push(langkah("putusan", "gagal - nomor induk perkara tidak terbaca, jadi e-Doc yang sudah ada tidak dapat diperiksa", "salah"));
        if (denganAnonim) hasil.push(langkah("anonimisasi", "tidak dikerjakan - nomor induk perkara tidak terbaca", "salah"));
        return selesai(false);
      }
      arg.perkaraId = perkaraId;

      // 1. Yang sudah ada di SIPP tidak diganti.
      lapor("Memeriksa e-Doc yang sudah ada di SIPP…");
      const c = await (arg.deps.cek || cekSlot)(perkaraId);
      if (!c.ok) {
        const sebab = `gagal - e-Doc yang sudah ada tidak dapat diperiksa (${c.sebab}); tidak ada yang diunggah supaya tidak menimpa`;
        if (denganPutusan) hasil.push(langkah("putusan", sebab, "salah"));
        if (denganAnonim) hasil.push(langkah("anonimisasi", denganPutusan ? "tidak dikerjakan - e-Doc yang sudah ada belum dapat diperiksa" : sebab, "salah"));
        return selesai(false);
      }
      if (c.adaBaris === false) {
        if (denganPutusan) hasil.push(langkah("putusan", "gagal - Putusan Akhir belum terbaca di SIPP, jadi e-Doc belum dapat diunggah", "salah"));
        if (denganAnonim) hasil.push(langkah("anonimisasi", denganPutusan ? "tidak dikerjakan - Putusan Akhir belum terbaca di SIPP" : "gagal - Putusan Akhir belum terbaca di SIPP, jadi e-Doc belum dapat diunggah", "salah"));
        return selesai(false);
      }
      const perluPutusan = denganPutusan && !c.adaPutusan;
      const perluAnonim = denganAnonim && !c.adaAnonim;
      if (denganPutusan && !perluPutusan) hasil.push(langkah("putusan", `sudah ada di SIPP${c.jalurPutusan ? ` (${c.jalurPutusan})` : ""}, dilewati - tidak diganti`, "lewat"));
      if (denganAnonim && !perluAnonim) {
        hasil.push(langkah("anonimisasi", `sudah ada di SIPP${c.jalurAnonim ? ` (${c.jalurAnonim})` : ""}, dilewati - tidak diganti`, "lewat"));
      }
      if (!perluPutusan && !perluAnonim) return selesai(true);

      // 2. Berkas putusan: pilihan petugas, atau dicetak ABT dari Blangko Derry.
      let sumber = arg.putusan || null;
      if (!sumber) {
        lapor("Mengambil berkas putusan dari ABT (Blangko Derry)…");
        const a = await (arg.deps.putusanDariAbt || putusanDariAbt)(arg);
        if (!a.ok) {
          if (perluPutusan) hasil.push(langkah("putusan", `berkas putusan belum tersedia - ${a.sebab}`, "salah"));
          if (perluAnonim) hasil.push(langkah("anonimisasi", perluPutusan ? "tidak dikerjakan - berkas putusan belum tersedia" : `berkas putusan (bahan anonimisasi) belum tersedia - ${a.sebab}`, "salah"));
          return selesai(false, { perluBerkas: true });
        }
        sumber = a.berkas;
      }

      // 3. Anonimisasi (kegagalannya tidak menahan e-Doc putusan).
      let anonim = null;
      let sebabAnonim = "";
      if (perluAnonim) {
        if (arg.anonim) {
          anonim = { berkas: arg.anonim };
        } else {
          const s = await siapkanAnonim(arg, sumber, lapor);
          if (s.ok) anonim = s;
          else sebabAnonim = s.sebab;
        }
      }
      if (perluAnonim && !anonim) hasil.push(langkah("anonimisasi", `tidak diunggah - ${sebabAnonim}`, "salah"));

      const kirim = { putusan: perluPutusan, anonimisasi: Boolean(anonim) };
      if (!kirim.putusan && !kirim.anonimisasi) return selesai(false);

      // 4. Satu kiriman.
      lapor(`Mengunggah ${kirim.putusan && kirim.anonimisasi ? "e-Doc putusan dan e-Doc anonimisasi sekaligus" : kirim.putusan ? "e-Doc putusan" : "e-Doc anonimisasi"} ke SIPP…`);
      const unggah = arg.deps.unggah || fungsi("a30UnggahEdoc");
      if (!unggah) {
        if (kirim.putusan) hasil.push(langkah("putusan", "gagal - pengunggah e-Doc belum termuat di halaman ini", "salah"));
        if (kirim.anonimisasi) hasil.push(langkah("anonimisasi", "gagal - pengunggah e-Doc belum termuat di halaman ini", "salah"));
        return selesai(false);
      }
      const r = await unggah({
        nomorPerkara: arg.nomorPerkara,
        putusan: kirim.putusan ? sumber : null,
        anonimisasi: kirim.anonimisasi ? anonim.berkas : null,
        kabar: arg.kabar,
        wadah: arg.wadah || null,
        tetapUnggah: (anonim && anonim.tetapUnggah) || null,
        samarkanSisa: Boolean(anonim && anonim.samarkanSisa),
      });
      hasil.push(...langkahDariUnggah(r, kirim));
      return selesai(hasil.every((l) => l.nada !== "salah"));
    } catch (galat) {
      hasil.push(langkah("putusan", `gagal - ${sebaris((galat && galat.message) || galat)}`, "salah"));
      return selesai(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Kunci per perkara (dibagi dengan penetapan dan tombol "Putusan Otomatis" di halaman SIPP)
  // ───────────────────────────────────────────────────────────────────────
  const KUNCI_TUJUAN = "putusan-otomatis";
  const TANPA_KUNCI = { ok: true, tanpaKunci: true, lepas: async () => undefined };

  /**
   * Mengambil kunci perkara yang SAMA dengan penetapan (penetapan-kerja.js -> rute penunjukan/kunci).
   * Pulang { ok, lepas() }. ok:false HANYA bila pekerjaan lain memegang perkara ini (sedang_dikerjakan) -
   * kunci yang tidak dapat diminta karena sebab lain (rute belum ada, akses) tidak menahan pekerjaan,
   * sebab kuncinya pagar tambahan; Putusan Akhir tetap dijaga bukti simpan dan cek e-Doc.
   */
  async function ambilKunci(nomorPerkara, perkaraIdTahu) {
    const k = globalThis.aletaPenetapanKerja;
    if (!k || typeof k.ambilKunci !== "function") return TANPA_KUNCI;
    try {
      let perkaraId = String(perkaraIdTahu || "");
      if (!/^\d+$/.test(perkaraId)) {
        const cari = fungsi("a30PerkaraIdUntukAbt");
        perkaraId = cari ? String((await cari(nomorPerkara)) || "") : "";
      }
      if (!/^\d+$/.test(perkaraId)) return TANPA_KUNCI;
      const r = await k.ambilKunci(Number(perkaraId), KUNCI_TUJUAN);
      if (r && r.ok === true && r.token) {
        const token = String(r.token);
        return { ok: true, token, lepas: async () => { try { await k.lepasKunci(Number(perkaraId), token); } catch { /* kunci kedaluwarsa sendiri */ } } };
      }
      if (r && r.alasan === "sedang_dikerjakan") {
        const oleh = sebaris(r.oleh);
        return {
          ok: false,
          pesan: `Perkara ini sedang dikerjakan${oleh ? ` oleh ${oleh}` : ""}${r.tujuan ? ` (${sebaris(r.tujuan)})` : ""} - tunggu selesai supaya tidak tertulis ganda, lalu ulangi.`,
          lepas: async () => undefined,
        };
      }
    } catch {
      /* kunci hanya pagar tambahan */
    }
    return TANPA_KUNCI;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Tombol mengulang (satu klik) dan laporan
  // ───────────────────────────────────────────────────────────────────────
  /** Daftar langkah dalam panel, dipakai hanya bila kotak muat ulang bersama tidak ada. */
  function gambarLangkah(induk, judul, daftar) {
    if (!induk) return null;
    const lama = induk.querySelector("[data-b2-laporan]");
    if (lama) lama.remove();
    const kotak = el("div", "aleta-abt-kabar aleta-b2-laporan");
    kotak.setAttribute("data-b2-laporan", "1");
    kotak.appendChild(el("b", "", judul));
    const ul = el("ul", "aleta-b2-langkah");
    for (const l of daftar) {
      const li = el("li", `aleta-b2-langkah-${l.nada}`, `${l.judul}: ${l.teks}`);
      li.setAttribute("data-b2-langkah", l.kunci);
      ul.appendChild(li);
    }
    kotak.appendChild(ul);
    induk.appendChild(kotak);
    return kotak;
  }

  /**
   * Tombol "Ulangi unggah e-Doc saja": mengulang HANYA langkah e-Doc (Putusan Akhir tidak disentuh).
   * Tombol ini membawa dirinya sendiri keluar bila semua langkah beres.
   *
   * @param {{induk:HTMLElement, ulangi:()=>Promise<{ok:boolean,langkah:Array,bunyi:string}>, sesudah?:(hasil)=>void}} o
   */
  function pasangUlang(o) {
    if (!o || !o.induk) return null;
    const lama = o.induk.querySelector("[data-b2-ulangi]");
    if (lama) lama.remove();
    const tombol = el("button", "aleta-permintaan-tombol aleta-b2-ulangi", "Ulangi unggah e-Doc saja");
    tombol.type = "button";
    tombol.setAttribute("data-b2-ulangi", "1");
    tombol.title = "Mengulang hanya unggah e-Doc putusan dan anonimisasi. Putusan Akhir yang sudah tersimpan tidak disentuh; e-Doc yang sudah ada tidak diganti.";
    tombol.addEventListener("click", async () => {
      if (tombol.disabled) return;
      tombol.disabled = true;
      let h;
      try {
        h = await o.ulangi();
      } catch (galat) {
        h = { ok: false, bunyi: sebaris((galat && galat.message) || galat), langkah: [] };
      }
      tombol.disabled = false;
      if (h && h.ok) tombol.remove();
      if (typeof o.sesudah === "function") o.sesudah(h);
    });
    o.induk.appendChild(tombol);
    return tombol;
  }

  globalThis.aletaPutusanEdoc = {
    KUNCI_SAKLAR,
    barisSaklar,
    bacaSaklar,
    jalankan,
    ambilKunci,
    cekSlot,
    putusanDariAbt,
    siapkanAnonim,
    langkahDariUnggah,
    bunyiLangkah,
    gambarLangkah,
    pasangUlang,
    bersihNama,
  };
})();
