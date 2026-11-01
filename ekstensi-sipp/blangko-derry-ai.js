"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - ALETA Ai: PEMUAT RINGAN + SAKLAR (1 Nov 2026)
 * ============================================================================
 *
 * Arahan KINERJA Derry: saat saklar MATI tidak boleh ada beban. Berkas ini satu-satunya bagian ALETA Ai yang dimuat bersama
 * panel, dan sengaja kecil: hanya saklar di kepala panel, pilihan tersimpan akun, dan logika kunci saklar. Seluruh fitur
 * (bilah, saldo, jendela usulan, menu proyek, panduan) ada di blangko-derry-ai-inti.js yang dimuat MALAS lewat AletaModul
 * ("ai-blangko") hanya bila saklar menyala. Saat MATI:
 *   - tidak ada panggilan jaringan sama sekali (ringkasan saldo tidak dibaca);
 *   - tidak ada berkas inti yang dimuat, tidak ada pendengar peristiwa, tidak ada elemen bilah/saldo di halaman;
 *   - kunci saklar ("saldo habis", "belum dibuka untuk peran Anda") digambar dari ringkasan yang DISIMPAN di chrome.storage
 *     (paling lama 10 menit) bila ada; tanpa simpanan, saklar tampil biasa dan alasannya diberitahu begitu diklik.
 * POJOK SALDO kiri bawah (permintaan Derry) TETAP tampil walau saklar mati, dari ringkasan simpanan itu, tanpa memuat inti. Ringkasan
 * dibaca ulang (satu panggilan ringan) paling sering 10 menit sekali, hanya bila panel terbuka dan tab terlihat; klik saldo tetap
 * berganti saldo pengguna / satker. Saat saklar menyala, penyegaran dipegang inti.
 *
 * Keputusan 77-78: ALETA Ai alat bantu; bawaan MATI; diingat per akun (kunci memuat id akun), bukan per perkara.
 * Murni (dapat diuji tanpa DOM): globalThis.AletaBdAi.murni.
 */
(function (akar) {
  if (!akar || akar.AletaBdAi) return;

  const KUNCI_SAKLAR = "blangkoDerryAi";
  const KUNCI_RINGKAS = "blangkoDerryAiRingkas";
  const ID_SAKLAR = "bd-ai-saklar";
  const ID_MODUL = "ai-blangko";
  const UMUR_SIMPANAN_MS = 10 * 60 * 1000;
  const ID_SALDO = "bd-ai-saldo";
  const API_RINGKAS = "/aleta/api/aleta-ai/ringkas";

  const teks = (v) => (v === null || v === undefined ? "" : String(v));
  const esc = (v) => teks(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

  // ──────────────────────────────────────────────────────────────────────────
  // Murni
  // ──────────────────────────────────────────────────────────────────────────

  /** Dompet mana yang dapat dipakai: saldo pengguna (atau gratis) dan/atau dompet satker (berhak, saldo cukup, batas bulanan ada). */
  function dompetTersedia(ringkas) {
    const r = ringkas || {};
    const minimum = Number(r.minimumRp) > 0 ? Number(r.minimumRp) : 1;
    const s = r.satker || {};
    const sisa = s.sisaBatasRp === null || s.sisaBatasRp === undefined ? null : Number(s.sisaBatasRp);
    return {
      pengguna: r.gratis === true || Number(r.saldoRp) >= minimum,
      satker: s.boleh === true && Number(s.saldoRp) >= minimum && (sisa === null || sisa >= minimum),
    };
  }

  /**
   * Keadaan saklar dari ringkasan server dan pilihan tersimpan.
   * @returns {{terkunci: boolean, aktif: boolean, alasan: string, jenis: "ok"|"habis"|"belum"|"peran"}}
   */
  function keadaanSaklar(ringkas, tersimpan) {
    if (!ringkas || ringkas.aktif !== true) return { terkunci: true, aktif: false, alasan: "belum tersedia", jenis: "belum" };
    // Peran yang aplikasinya belum dibuka (Akses Menu): tidak dapat dinyalakan; kalimat lengkap dari server jadi keterangan.
    if (ringkas.aplikasiDibuka === false) return { terkunci: true, aktif: false, alasan: "belum dibuka untuk peran Anda", jenis: "peran" };
    const d = dompetTersedia(ringkas);
    // Habis hanya bila KEDUA dompet tidak dapat dipakai: pengguna yang berhak atas saldo satker tetap bisa walau saldonya sendiri nol.
    const habis = ringkas.gratis !== true && !d.pengguna && !d.satker;
    if (habis) return { terkunci: true, aktif: false, alasan: "saldo habis", jenis: "habis" };
    return { terkunci: false, aktif: tersimpan === true, alasan: "", jenis: "ok" };
  }

  /** Isi pojok saldo: mode "pengguna" (bawaan) atau "satker". */
  function tampilSaldo(ringkas, mode) {
    if (!ringkas || ringkas.aktif !== true) return null;
    if (mode === "satker") {
      const s = ringkas.satker || {};
      const sisa = s.sisaBatasRp === null || s.sisaBatasRp === undefined ? null : Number(s.sisaBatasRp);
      const batas = s.boleh === true && sisa !== null ? ` (batas Anda bulan ini tersisa ${rupiah(sisa)})` : "";
      return {
        mode: "satker",
        ikon: "satker",
        teks: s.boleh === true ? `Satker: ${rupiah(s.saldoRp)}` : `Satker: ${rupiah(s.saldoRp)} (Anda belum berhak)`,
        judul: `Saldo bersama satker${batas}. Klik untuk kembali ke saldo Anda.`,
        habis: !dompetTersedia(ringkas).satker,
      };
    }
    const habis = ringkas.gratis !== true && !dompetTersedia(ringkas).pengguna;
    return {
      mode: "pengguna",
      ikon: "pengguna",
      teks: ringkas.gratis === true ? `Saldo: ${rupiah(ringkas.saldoRp)} (gratis dipakai)` : `Saldo: ${rupiah(ringkas.saldoRp)}${habis ? " (habis)" : ""}`,
      judul: "Sisa saldo ALETA Ai Anda. Klik untuk melihat saldo satker.",
      habis,
    };
  }

  const IKON = {
    pengguna: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>',
    satker: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M3 21V9l9-6 9 6v12h-6v-6H9v6z" fill="currentColor"/></svg>',
  };

  /** Bagian ringkasan yang cukup untuk menentukan kunci saklar (tanpa daftar menu/fitur/proyek yang besar). */
  function ringkasRingan(r) {
    if (!r || typeof r !== "object") return null;
    const s = r.satker || {};
    return {
      aktif: r.aktif === true,
      saldoRp: Number(r.saldoRp) || 0,
      minimumRp: Number(r.minimumRp) || 0,
      gratis: r.gratis === true,
      aplikasiDibuka: r.aplikasiDibuka === false ? false : true,
      alasanAplikasi: teks(r.alasanAplikasi),
      satker: { boleh: s.boleh === true, saldoRp: Number(s.saldoRp) || 0, sisaBatasRp: s.sisaBatasRp === null || s.sisaBatasRp === undefined ? null : Number(s.sisaBatasRp) },
    };
  }

  /** Simpanan ringkasan masih berlaku untuk akun ini? ({id, saat, ringkas}) */
  const simpananSegar = (c, id, kini) => Boolean(c && c.id === id && c.ringkas && Number.isFinite(c.saat) && kini - c.saat >= 0 && kini - c.saat < UMUR_SIMPANAN_MS);

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan dan penyimpanan
  // ──────────────────────────────────────────────────────────────────────────
  const L = { akar: null, idAkun: "", tersimpan: false, ringkas: null, ringkasSaat: 0, mode: "pengguna", janjiRingkas: null, pewaktu: null, siap: false, janjiSegar: null, janjiInti: null, muatInti: 0, fila: Promise.resolve() };

  const penyimpan = () => {
    try {
      return akar.chrome && akar.chrome.storage && akar.chrome.storage.local ? akar.chrome.storage.local : null;
    } catch {
      return null;
    }
  };
  async function bacaSimpan(kunci) {
    const p = penyimpan();
    if (!p) return {};
    try {
      return (await p.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  async function tulisSimpan(isi) {
    const p = penyimpan();
    if (!p) return;
    try {
      await p.set(isi);
    } catch {
      /* PC ini menolak menulis: saklar tetap bekerja untuk sesi ini */
    }
  }
  const kunciSaklar = (id) => `${KUNCI_SAKLAR}:${id || L.idAkun}`;
  const derry = () => akar.aletaBlangkoDerry || null;
  const akunSekarang = () => {
    try {
      const d = derry();
      const a = d && typeof d.akun === "function" ? d.akun() : null;
      return a && a.id ? String(a.id) : "";
    } catch {
      return "";
    }
  };
  const cari = (selektor) => (L.akar ? L.akar.querySelector(selektor) : null);

  // ──────────────────────────────────────────────────────────────────────────
  // Saklar
  // ──────────────────────────────────────────────────────────────────────────

  /** Menggambar saklar menurut keadaan (dari inti dengan ringkasan segar, atau dari simpanan saat mati). */
  function gambarSaklar(kead, ringkas) {
    const wadah = cari(`#${ID_SAKLAR}`);
    if (!wadah) return;
    const k = kead || { terkunci: false, aktif: L.tersimpan, alasan: "", jenis: "ok" };
    const cek = wadah.querySelector("input");
    cek.checked = k.aktif;
    cek.disabled = k.terkunci;
    wadah.classList.toggle("terkunci", k.terkunci);
    wadah.hidden = !L.idAkun;
    wadah.querySelector(".bd-ai-ket").textContent = k.terkunci ? `(${k.alasan})` : "";
    const pesanServer = k.jenis === "peran" && ringkas ? teks(ringkas.alasanAplikasi) : "";
    if (pesanServer) wadah.title = pesanServer;
    else wadah.removeAttribute("title");
    wadah.setAttribute("data-keadaan", k.jenis === "ok" ? (k.aktif ? "nyala" : "mati") : k.jenis);
  }

  /** Menyimpan keadaan dari inti: pilihan akun dan ringkasan ringan (dipakai menggambar kunci saat saklar mati). */
  async function sinkron(o) {
    if (o && typeof o.tersimpan === "boolean") {
      L.tersimpan = o.tersimpan;
      await tulisSimpan({ [kunciSaklar()]: o.tersimpan });
    }
    if (o && o.ringkas) {
      L.ringkas = ringkasRingan(o.ringkas);
      L.ringkasSaat = Date.now();
      gambarSaldo();
      await tulisSimpan({ [KUNCI_RINGKAS]: { id: L.idAkun, saat: L.ringkasSaat, ringkas: L.ringkas } });
    }
  }

  /** Memuat berkas inti (sekali) lewat pemuat modul malas; null bila gagal. */
  function muatInti() {
    if (akar.AletaBdAiInti) return Promise.resolve(akar.AletaBdAiInti);
    if (L.janjiInti) return L.janjiInti;
    const pemuat = akar.AletaModul;
    if (!pemuat || typeof pemuat.pastikan !== "function") return Promise.resolve(null);
    L.muatInti += 1;
    L.janjiInti = pemuat
      .pastikan(ID_MODUL)
      .then((ok) => (ok && akar.AletaBdAiInti ? akar.AletaBdAiInti : null))
      .catch(() => null)
      .then((inti) => {
        L.janjiInti = null;
        return inti;
      });
    return L.janjiInti;
  }

  // Klik berturut-turut diproses SATU-SATU (mati lalu nyala cepat tidak boleh saling menimpa).
  function saatSaklar(e) {
    const mau = Boolean(e.target.checked);
    L.fila = L.fila.then(() => prosesSaklar(e.target, mau)).catch(() => undefined);
    return L.fila;
  }

  async function prosesSaklar(cekEl, mau) {
    const e = { target: cekEl };
    if (!mau) {
      L.tersimpan = false;
      await tulisSimpan({ [kunciSaklar()]: false });
      if (akar.AletaBdAiInti) akar.AletaBdAiInti.matikan();
      gambarSaklar(L.ringkas ? keadaanSaklar(L.ringkas, false) : null, L.ringkas);
      return;
    }
    // Dinyalakan: inti dimuat, ringkasan dibaca SEKALI; inti memutuskan (kunci, panduan pertama) dan menggambar bilah/saldo.
    e.target.disabled = true;
    const inti = await muatInti();
    if (!inti) {
      e.target.checked = false;
      e.target.disabled = false;
      const ket = L.akar && L.akar.querySelector(`#${ID_SAKLAR} .bd-ai-ket`);
      if (ket) ket.textContent = "(belum dapat dimuat)";
      return;
    }
    await inti.nyalakan(L.akar, { idAkun: L.idAkun });
  }

  // ─── Pojok saldo (tetap tampil walau saklar mati) ──────────────────────────
  function gambarSaldo() {
    const tmb = cari(`#${ID_SALDO}`);
    if (!tmb) return;
    const t = L.idAkun ? tampilSaldo(L.ringkas, L.mode) : null;
    if (!t) {
      tmb.hidden = true;
      return;
    }
    tmb.hidden = false;
    tmb.innerHTML = `<span class="bd-ai-ikon" data-ikon="${t.ikon}">${IKON[t.ikon]}</span><span>${esc(t.teks)}</span>`;
    tmb.title = t.judul;
    tmb.setAttribute("aria-label", `${t.teks}. ${t.judul}`);
    tmb.setAttribute("data-mode", t.mode);
    tmb.classList.toggle("habis", t.habis === true);
    // Gelembung tanya jawab ALETA Ai (kiri bawah, bila ada) tidak boleh menutupi saldo.
    tmb.style.left = akar.__aletaAiGelembung ? "84px" : "";
  }

  function buatSaldo(akarEl) {
    if (akarEl.querySelector(`#${ID_SALDO}`)) return;
    const saldo = akar.document.createElement("button");
    saldo.type = "button";
    saldo.id = ID_SALDO;
    saldo.className = "bd-ai-saldo";
    saldo.hidden = true;
    saldo.addEventListener("click", () => {
      L.mode = L.mode === "pengguna" ? "satker" : "pengguna";
      gambarSaldo();
      if (akar.AletaBdAiInti) akar.AletaBdAiInti.modeBerubah();
    });
    akarEl.appendChild(saldo);
  }

  const panelTerbuka = () => Boolean(L.akar && L.akar.isConnected && !L.akar.hidden && akar.document && akar.document.visibilityState !== "hidden");

  /**
   * Saklar MATI: ringkasan dibaca ulang (satu panggilan ringan) paling sering tiap 10 menit, hanya bila panel terbuka dan tab terlihat.
   * Saklar menyala: inti yang memegang penyegaran (tidak ada panggilan ganda).
   */
  function segarkanRingkasMati() {
    if (L.tersimpan || !L.idAkun || L.janjiRingkas || !panelTerbuka()) return Promise.resolve();
    if (L.ringkas && Date.now() - L.ringkasSaat < UMUR_SIMPANAN_MS) return Promise.resolve();
    L.janjiRingkas = (async () => {
      const r = await akar.fetch(API_RINGKAS, { credentials: "include", cache: "no-store" });
      let isi = null;
      try {
        isi = await r.json();
      } catch {
        isi = null;
      }
      if (!r.ok || !isi || isi.ok === false || !isi.data) return;
      if (L.tersimpan) return;
      L.ringkas = ringkasRingan(isi.data);
      L.ringkasSaat = Date.now();
      await tulisSimpan({ [KUNCI_RINGKAS]: { id: L.idAkun, saat: L.ringkasSaat, ringkas: L.ringkas } });
      gambarSaldo();
      gambarSaklar(keadaanSaklar(L.ringkas, false), L.ringkas);
    })()
      .catch(() => undefined)
      .then(() => {
        L.janjiRingkas = null;
      });
    return L.janjiRingkas;
  }

  function jadwalkanPenyegar() {
    if (L.pewaktu || typeof akar.setTimeout !== "function") return;
    const tik = () => {
      L.pewaktu = akar.setTimeout(tik, UMUR_SIMPANAN_MS);
      void segarkanRingkasMati();
    };
    L.pewaktu = akar.setTimeout(tik, UMUR_SIMPANAN_MS);
    if (akar.document && typeof akar.document.addEventListener === "function") {
      akar.document.addEventListener("visibilitychange", () => void segarkanRingkasMati());
    }
  }

  function pasang(akarEl) {
    if (!akarEl || !akar.document) return;
    if (L.akar === akarEl && akarEl.querySelector(`#${ID_SAKLAR}`)) return;
    L.akar = akarEl;
    const siapa = akarEl.querySelector("#bd-siapa");
    if (siapa && !akarEl.querySelector(`#${ID_SAKLAR}`)) {
      const wadah = akar.document.createElement("span");
      wadah.id = ID_SAKLAR;
      wadah.className = "bd-ai-saklar";
      wadah.hidden = true; // tampil setelah akun terbaca
      wadah.innerHTML =
        `<label class="bd-ai-sak" title="Alat bantu ALETA Ai: usulan isi, perapian, dan pemeriksaan naskah. Mati = panel berjalan seperti biasa."><input type="checkbox" role="switch" id="${ID_SAKLAR}-cek" aria-label="ALETA Ai"><span class="bd-ai-geser" aria-hidden="true"></span><span class="bd-ai-nama">ALETA Ai</span></label>` +
        `<small class="bd-ai-ket" id="${ID_SAKLAR}-ket" role="status"></small>`;
      siapa.insertAdjacentElement("afterend", wadah);
      wadah.querySelector("input").addEventListener("change", saatSaklar);
    }
    buatSaldo(akarEl);
    void segarkan();
  }

  /**
   * Dipanggil panel saat akun terbaca / tampilan digambar ulang (sering). Murah: akun yang sama dan sudah diproses = langsung keluar.
   * Akun baru: baca pilihan tersimpan + ringkasan simpanan (satu pembacaan storage, tanpa jaringan). Menyala = inti dimuat.
   */
  function segarkan() {
    if (!L.akar) return Promise.resolve();
    const id = akunSekarang();
    if (!id || (id === L.idAkun && L.siap)) return Promise.resolve();
    if (L.janjiSegar) return L.janjiSegar;
    L.janjiSegar = (async () => {
      L.idAkun = id;
      const s = await bacaSimpan([kunciSaklar(id), KUNCI_RINGKAS]);
      L.tersimpan = s[kunciSaklar(id)] === true;
      const segar = simpananSegar(s[KUNCI_RINGKAS], id, Date.now());
      L.ringkas = segar ? s[KUNCI_RINGKAS].ringkas : null;
      L.ringkasSaat = segar ? s[KUNCI_RINGKAS].saat : 0;
      L.siap = true;
      // Keadaan awal dari simpanan; bila menyala, inti mengambil alih (ringkasan segar, bilah). Saldo tampil dari simpanan walau mati.
      gambarSaklar(L.ringkas ? keadaanSaklar(L.ringkas, L.tersimpan) : null, L.ringkas);
      gambarSaldo();
      jadwalkanPenyegar();
      if (!L.tersimpan) await segarkanRingkasMati(); // hanya bila simpanan tidak ada / lebih dari 10 menit
      if (L.tersimpan) {
        const inti = await muatInti();
        if (inti) await inti.aktifkan(L.akar, { idAkun: id, tersimpan: true });
      }
    })()
      .catch(() => undefined)
      .then(() => {
        L.janjiSegar = null;
      });
    return L.janjiSegar;
  }

  // Perubahan dari tab lain (saklar dinyalakan/dimatikan di tab ABT lain, atau pilihan proyek): hanya didengar bila akun sudah dikenal.
  try {
    if (akar.chrome && akar.chrome.storage && akar.chrome.storage.onChanged) {
      akar.chrome.storage.onChanged.addListener((ubah, tempat) => {
        if (tempat !== "local" || !L.idAkun || !ubah[kunciSaklar()]) return;
        const baru = ubah[kunciSaklar()].newValue === true;
        if (baru === L.tersimpan) return;
        L.tersimpan = baru;
        if (baru) {
          void muatInti().then((inti) => inti && inti.aktifkan(L.akar, { idAkun: L.idAkun, tersimpan: true }));
        } else if (akar.AletaBdAiInti) akar.AletaBdAiInti.matikan();
        gambarSaklar(L.ringkas ? keadaanSaklar(L.ringkas, baru) : null, L.ringkas);
      });
    }
  } catch {
    /* tanpa pendengar: berlaku saat panel dibuka ulang */
  }

  const inti = () => akar.AletaBdAiInti || null;
  akar.AletaBdAi = {
    pasang,
    segarkan,
    gambarSaklar,
    gambarSaldo,
    sinkron,
    /** Dompet yang dipilih lewat klik saldo ("pengguna" | "satker"); inti membacanya, bukan menyimpannya sendiri. */
    mode: () => L.mode,
    aturMode(m) {
      L.mode = m === "satker" ? "satker" : "pengguna";
      gambarSaldo();
    },
    bacaSimpan,
    tulisSimpan,
    /** Pilihan proyek / alat lain diteruskan ke inti bila sudah dimuat (saat mati: tidak ada yang dikerjakan). */
    bukaFitur: (kode) => (inti() ? inti().bukaFitur(kode) : Promise.resolve()),
    aturProyek: (id) => (inti() ? inti().aturProyek(id) : Promise.resolve()),
    proyekAktif: () => (inti() ? inti().proyekAktif() : ""),
    mulaiTur: () => (inti() ? inti().mulaiTur() : undefined),
    tutupTur: () => (inti() ? inti().tutupTur() : undefined),
    tutup: () => (inti() ? inti().tutup() : undefined),
    turTerbuka: () => (inti() ? inti().turTerbuka() : -1),
    get FITUR() {
      return inti() ? inti().FITUR : [];
    },
    /** Keadaan gabungan (uji/alat): akun, pilihan, jumlah pemuatan inti, dan keadaan inti bila dimuat. */
    keadaan: () => ({ idAkun: L.idAkun, tersimpan: L.tersimpan, mode: L.mode, inti: Boolean(inti()), pemuatanInti: L.muatInti, ringkasSimpanan: L.ringkas, ...(inti() ? inti().keadaan() : { nyala: false }) }),
    murni: { dompetTersedia, keadaanSaklar, ringkasRingan, simpananSegar, tampilSaldo },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = akar.AletaBdAi;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
