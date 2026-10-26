"use strict";

/**
 * ============================================================================
 * PENGAMAT BERSAMA - SATU MUTATIONOBSERVER, KEJADIAN GANTI INTERVAL (K12, 25 Okt 2026)
 * ============================================================================
 *
 * Masalah (PC tua): belasan skrip konten masing-masing memasang MutationObserver
 * atas seluruh <body> dan puluhan setInterval 0,25-1,5 detik, yang tetap
 * berdetak di tab yang tersembunyi. CPU latar tidak pernah nol.
 *
 * Modul ini dimuat PALING AWAL di tiap kelompok skrip konten dan menyediakan
 * (global ALETA_PENGAMAT):
 *
 *   Pengamat           pengganti langsung `MutationObserver` (observe/disconnect/
 *                      takeRecords). Mode tunggal: SEMUA pengamat memakai SATU
 *                      MutationObserver asli; tiap pelanggan hanya menerima catatan
 *                      yang memang miliknya. Selama tab tersembunyi catatan ditahan
 *                      lalu dikirim sekali begitu tab terlihat.
 *   setiap(fn, ms)     pengganti `setInterval`: dilewati selama tab tersembunyi
 *                      (dijalankan sekali saat terlihat kembali).
 *   saatBerubah(fn)    pengganti pemantau berinterval yang sebenarnya menunggu
 *                      DOM berubah: fn dijalankan oleh kejadian (perubahan DOM
 *                      selain buatan kita sendiri), dengan jeda minimum dan satu
 *                      denyut cadangan yang lambat.
 *   pemimpin(kunci)    satu tab per PC (lewat pekerja latar) untuk kerja yang
 *                      cukup dikerjakan sekali, mis. memeriksa putusan terjadwal.
 *   sibuk(nama)        selama ada pekerjaan otomatis berjalan, tab tersembunyi
 *                      tidak ditahan sama sekali.
 *
 * SAKLAR (Super Admin, MATI bawaan): kinerja.pengamatTunggal pada GET
 * /ekstensi/tampilan, disinggahkan panel-alat.js di chrome.storage.local
 * "tampilanServer". Mati = SETIAP pemanggil mendapat MutationObserver / setInterval
 * asli dengan argumen yang sama - perilaku lama persis. Saklar yang berubah
 * berlaku pada tab yang sedang terbuka tanpa memuat ulang: pelanggan dipindahkan
 * di tempat.
 *
 * Tidak ada fitur yang dikurangi: pelanggan tetap mendapat catatan perubahan yang
 * sama (hanya bisa tertunda sampai tab terlihat), pemantau tetap berjalan.
 */
(function pengamatBersamaModul(akar) {
  if (!akar || akar.ALETA_PENGAMAT) return;

  const KUNCI_SERVER = "tampilanServer";
  const KUNCI_RINGAN = "modeRingan";
  const BATAS_ANTRI = 400;
  const CADANGAN_MIN_MS = 1500;

  const stat = { pengamatAsli: 0, kirim: 0, tahan: 0, dilewati: 0, jalankanKejadian: 0, jalankanCadangan: 0 };
  const sibukSet = new Set();
  let tunggal = false;
  let faktorRingan = 1;
  let ringanNyala = false;

  const doc = () => akar.document;
  const terlihat = () => {
    try {
      const d = doc();
      return !d || d.visibilityState !== "hidden";
    } catch {
      return true;
    }
  };
  const tahanBoleh = () => tunggal && !terlihat() && sibukSet.size === 0;
  const aman = (fn, ...arg) => {
    try {
      return fn(...arg);
    } catch {
      /* satu pelanggan yang galat tidak boleh mematikan yang lain */
      return undefined;
    }
  };

  const bagian = new Set(); // semua pelanggan hidup: { lama(), tunggal(), henti() }

  // ------------------------------------------------------------------------
  // Pengamat tunggal
  // ------------------------------------------------------------------------
  const langganan = new Set(); // { target, opsi, pelanggan }
  let bersama = null;
  let sidikBersama = "";

  function dalamDokumen(target) {
    const d = doc();
    return Boolean(d && d.documentElement && target && target.nodeType && (target === d || d.documentElement.contains(target)));
  }

  function cocok(l, rec) {
    const o = l.opsi;
    if (rec.type === "childList") {
      if (!o.childList) return false;
    } else if (rec.type === "attributes") {
      if (!o.attributes && !o.attributeFilter) return false;
      if (o.attributeFilter && !o.attributeFilter.includes(rec.attributeName)) return false;
    } else if (rec.type === "characterData") {
      if (!o.characterData) return false;
    }
    const t = l.target;
    if (rec.target === t) return true;
    if (!o.subtree) return false;
    return t.contains(rec.target);
  }

  function opsiGabungan() {
    let childList = false;
    let characterData = false;
    let atribut = false;
    let semuaAtribut = false;
    const filter = new Set();
    for (const l of langganan) {
      const o = l.opsi;
      if (o.childList) childList = true;
      if (o.characterData) characterData = true;
      if (o.attributes || o.attributeFilter) {
        atribut = true;
        if (o.attributeFilter) o.attributeFilter.forEach((a) => filter.add(a));
        else semuaAtribut = true;
      }
    }
    const hasil = { subtree: true, childList, characterData };
    if (atribut) {
      hasil.attributes = true;
      if (!semuaAtribut) hasil.attributeFilter = [...filter].sort();
    }
    return hasil;
  }

  function sebar(catatan) {
    if (!catatan || !catatan.length) return;
    const per = new Map();
    for (const rec of catatan) {
      for (const l of langganan) {
        if (!cocok(l, rec)) continue;
        let a = per.get(l.pelanggan);
        if (!a) per.set(l.pelanggan, (a = []));
        a.push(rec);
      }
    }
    for (const [p, daftar] of per) p.terima(daftar);
  }

  function susunBersama() {
    if (!langganan.size) {
      if (bersama) {
        sebar(bersama.takeRecords());
        bersama.disconnect();
      }
      bersama = null;
      sidikBersama = "";
      return;
    }
    const opsi = opsiGabungan();
    const sidik = JSON.stringify(opsi);
    if (bersama && sidik === sidikBersama) return;
    const MO = akar.MutationObserver;
    if (!bersama) {
      bersama = new MO((catatan) => sebar(catatan));
      stat.pengamatAsli += 1;
    } else {
      sebar(bersama.takeRecords());
      bersama.disconnect();
    }
    const d = doc();
    bersama.observe(d.documentElement, opsi);
    sidikBersama = sidik;
  }

  /** Satu pelanggan = satu objek Pengamat (bisa banyak observe). */
  class Pengamat {
    constructor(fn) {
      this._fn = typeof fn === "function" ? fn : () => undefined;
      this._daftar = []; // [{target, opsi}]
      this._asli = []; // pengamat asli (mode lama / target di luar dokumen)
      this._antri = [];
      this._tunggalAktif = [];
      this._bagian = {
        lama: () => this._pindah(false),
        tunggal: () => this._pindah(true),
        henti: () => this._lepasSemua(),
      };
      bagian.add(this._bagian);
    }

    observe(target, opsi) {
      const o = opsi || {};
      this._daftar.push({ target, opsi: o });
      this._pasang({ target, opsi: o }, tunggal);
    }

    disconnect() {
      this._lepasSemua();
      this._daftar = [];
      this._antri = [];
    }

    takeRecords() {
      const a = this._antri.slice();
      this._antri = [];
      for (const p of this._asli) a.push(...p.takeRecords());
      return a;
    }

    _pasang(entri, pakaiTunggal) {
      const o = entri.opsi;
      const sah = Boolean(o.childList || o.attributes || o.characterData || o.attributeFilter);
      if (pakaiTunggal && sah && dalamDokumen(entri.target) && !(entri.target.nodeType === 9)) {
        const l = {
          target: entri.target,
          opsi: { childList: Boolean(o.childList), subtree: Boolean(o.subtree), characterData: Boolean(o.characterData), attributes: Boolean(o.attributes), attributeFilter: Array.isArray(o.attributeFilter) ? o.attributeFilter.slice() : null },
          pelanggan: this,
        };
        if (!l.opsi.attributes && !l.opsi.attributeFilter) delete l.opsi.attributes;
        langganan.add(l);
        this._tunggalAktif.push(l);
        susunBersama();
        return;
      }
      const MO = akar.MutationObserver;
      const asli = new MO((c, p) => this._fn(c, this));
      stat.pengamatAsli += 1;
      asli.observe(entri.target, o);
      this._asli.push(asli);
    }

    _lepasSemua() {
      for (const l of this._tunggalAktif) langganan.delete(l);
      this._tunggalAktif = [];
      for (const a of this._asli) a.disconnect();
      this._asli = [];
      susunBersama();
    }

    _pindah(keTunggal) {
      const antri = this._antri;
      for (const a of this._asli) antri.push(...a.takeRecords());
      this._lepasSemua();
      for (const e of this._daftar) this._pasang(e, keTunggal);
      if (antri.length && !tahanBoleh()) this._lepas();
    }

    /** Dipanggil pengamat bersama. */
    terima(daftar) {
      stat.kirim += 1;
      this._antri.push(...daftar);
      if (this._antri.length > BATAS_ANTRI) this._antri.splice(0, this._antri.length - BATAS_ANTRI);
      if (tahanBoleh()) {
        stat.tahan += 1;
        return;
      }
      this._lepas();
    }

    _lepas() {
      if (!this._antri.length) return;
      const a = this._antri;
      this._antri = [];
      aman(this._fn, a, this);
    }

    _bilaTerlihat() {
      this._lepas();
    }
  }

  // ------------------------------------------------------------------------
  // setiap (pengganti setInterval)
  // ------------------------------------------------------------------------
  function setiap(fn, ms, opsi) {
    const o = opsi || {};
    const h = {
      id: null,
      terlewat: false,
      mati: false,
      pasang(mode) {
        if (h.id != null) clearInterval(h.id);
        const jeda = o.ringan !== false && faktorRingan > 1 ? Math.round(ms * faktorRingan) : ms;
        h.id = setInterval(() => {
          if (mode && !o.tetap && tahanBoleh()) {
            h.terlewat = true;
            stat.dilewati += 1;
            return;
          }
          h.terlewat = false;
          fn();
        }, jeda);
      },
      jalankanBilaTerlewat() {
        if (h.terlewat && !h.mati) {
          h.terlewat = false;
          aman(fn);
        }
      },
    };
    const b = {
      lama: () => h.pasang(false),
      tunggal: () => h.pasang(true),
      henti: () => {
        if (h.id != null) clearInterval(h.id);
        h.id = null;
      },
      setiapHandle: h,
    };
    bagian.add(b);
    h.pasang(tunggal);
    return {
      batal() {
        h.mati = true;
        b.henti();
        bagian.delete(b);
      },
    };
  }

  // ------------------------------------------------------------------------
  // saatBerubah (kejadian + denyut cadangan)
  // ------------------------------------------------------------------------
  function dariAleta(simpul) {
    let n = simpul;
    if (n && n.nodeType === 3) n = n.parentNode;
    if (!n || !n.closest) return false;
    try {
      return Boolean(n.closest('[id^="aleta"],[class*="aleta"],[data-aleta]'));
    } catch {
      return false;
    }
  }

  function perubahanAsing(daftar) {
    for (const rec of daftar) {
      if (rec.type !== "childList") return true;
      if (dariAleta(rec.target)) {
        // simpul tambahan/terhapus buatan kita saja tidak dihitung
        const simpul = [...rec.addedNodes, ...rec.removedNodes];
        if (simpul.length && simpul.every((n) => dariAleta(n) || (n.nodeType === 3 && !String(n.nodeValue || "").trim()))) continue;
      }
      const simpul = [...rec.addedNodes, ...rec.removedNodes];
      if (simpul.length && simpul.every((n) => (n.nodeType === 1 && dariAleta(n)) || (n.nodeType === 3 && !String(n.nodeValue || "").trim()))) continue;
      return true;
    }
    return false;
  }

  function saatBerubah(fn, opsi) {
    const o = opsi || {};
    const jedaLama = Math.max(1, Number(o.jedaMs) || 1000); // mode lama: jeda semula PERSIS
    const jedaMin = Math.max(50, Number(o.jedaMinMs) || 250);
    const cadangan = Math.max(CADANGAN_MIN_MS, Number(o.cadanganMs) || jedaLama * 3);
    const s = { idLama: null, pengamat: null, idCadangan: null, tertunda: null, terakhir: 0, mati: false, perluJalan: false };

    function jalan(dari) {
      if (s.mati) return;
      if (tahanBoleh()) {
        s.perluJalan = true;
        stat.dilewati += 1;
        return;
      }
      s.perluJalan = false;
      s.terakhir = Date.now();
      stat[dari === "kejadian" ? "jalankanKejadian" : "jalankanCadangan"] += 1;
      aman(fn);
    }
    function jadwalkan() {
      if (s.tertunda != null || s.mati) return;
      const tunggu = Math.max(0, jedaMin - (Date.now() - s.terakhir));
      s.tertunda = setTimeout(() => {
        s.tertunda = null;
        jalan("kejadian");
      }, tunggu);
    }
    function bersihkan() {
      if (s.idLama != null) clearInterval(s.idLama);
      s.idLama = null;
      if (s.idCadangan != null) clearInterval(s.idCadangan);
      s.idCadangan = null;
      if (s.tertunda != null) clearTimeout(s.tertunda);
      s.tertunda = null;
      if (s.pengamat) s.pengamat.disconnect();
      s.pengamat = null;
    }
    const b = {
      lama: () => {
        bersihkan();
        s.idLama = setInterval(fn, o.ringan !== false && faktorRingan > 1 ? Math.round(jedaLama * faktorRingan) : jedaLama);
      },
      tunggal: () => {
        bersihkan();
        const d = doc();
        if (!d || !d.body) {
          s.idLama = setInterval(fn, jedaLama);
          return;
        }
        s.pengamat = new Pengamat((daftar) => {
          if (perubahanAsing(daftar)) jadwalkan();
        });
        s.pengamat.observe(d.body, { childList: true, subtree: true });
        s.idCadangan = setInterval(() => jalan("cadangan"), Math.round(cadangan * faktorRingan));
      },
      henti: () => bersihkan(),
      jalanTertinggal: () => {
        if (s.perluJalan) jalan("cadangan");
      },
    };
    bagian.add(b);
    (tunggal ? b.tunggal : b.lama)();
    return {
      batal() {
        s.mati = true;
        b.henti();
        bagian.delete(b);
      },
      jalankanSekarang: () => jalan("kejadian"),
    };
  }

  // Bentuk setInterval/clearInterval: pengenal angka, supaya kode lama cukup
  // mengganti dua nama. Pengenal bukan milik kita diteruskan ke clearInterval asli.
  let nomorPengenal = 1000000000;
  const tabel = new Map();
  function daftarkan(h) {
    const id = ++nomorPengenal;
    tabel.set(id, h);
    return id;
  }
  const interval = (fn, ms, opsi) => daftarkan(setiap(fn, ms, opsi));
  const denyut = (fn, ms, opsi) => daftarkan(saatBerubah(fn, { ...(opsi || {}), jedaMs: ms }));
  function hapus(id) {
    const h = tabel.get(id);
    if (h) {
      tabel.delete(id);
      h.batal();
      return;
    }
    clearInterval(id);
  }

  // ------------------------------------------------------------------------
  // Pemimpin satu tab per PC
  // ------------------------------------------------------------------------
  const ID_TAB = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  async function pemimpin(kunci, ttlMs) {
    if (!tunggal) return true;
    try {
      const r = akar.chrome && akar.chrome.runtime && akar.chrome.runtime.sendMessage;
      if (typeof r !== "function") return true;
      const jawab = await akar.chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis: "aleta-pemimpin", kunci: String(kunci), ttlMs: Number(ttlMs) || 60000, terlihat: terlihat(), idHalaman: ID_TAB });
      if (!jawab || typeof jawab.pemimpin !== "boolean") return true;
      return jawab.pemimpin;
    } catch {
      return true;
    }
  }

  function sibuk(nama) {
    const tanda = { nama: String(nama || "") };
    sibukSet.add(tanda);
    return () => {
      sibukSet.delete(tanda);
    };
  }

  // ------------------------------------------------------------------------
  // Mode dan saklar
  // ------------------------------------------------------------------------
  function terapkanMode() {
    for (const b of [...bagian]) {
      if (tunggal) b.tunggal();
      else b.lama();
    }
  }
  function atur(opsi) {
    const o = opsi || {};
    let berubah = false;
    if (typeof o.tunggal === "boolean" && o.tunggal !== tunggal) {
      tunggal = o.tunggal;
      berubah = true;
    }
    if (typeof o.faktorRingan === "number" && o.faktorRingan >= 1 && o.faktorRingan !== faktorRingan) {
      faktorRingan = o.faktorRingan;
      berubah = true;
    }
    if (typeof o.ringan === "boolean") ringanNyala = o.ringan;
    if (berubah) terapkanMode();
  }

  function bacaSaklar(s) {
    const x = s && s[KUNCI_SERVER];
    const k = x && typeof x === "object" ? x.kinerja : null;
    return Boolean(k && k.pengamatTunggal === true);
  }

  function bilaTerlihat() {
    if (!terlihat()) return;
    for (const b of [...bagian]) {
      if (b.setiapHandle) b.setiapHandle.jalankanBilaTerlewat();
      if (b.jalanTertinggal) b.jalanTertinggal();
    }
    for (const l of [...langganan]) l.pelanggan._bilaTerlihat();
  }

  const api = {
    versi: "k12-25okt",
    Pengamat,
    setiap,
    saatBerubah,
    interval,
    denyut,
    hapus,
    pemimpin,
    sibuk,
    atur,
    terlihat,
    nyala: () => tunggal,
    ringan: () => ringanNyala,
    faktor: () => faktorRingan,
    ukur: () => ({ tunggal, pengamatAsli: stat.pengamatAsli, pelanggan: new Set([...langganan].map((l) => l.pelanggan)).size, langganan: langganan.size, bagian: bagian.size, ...stat, bersamaHidup: Boolean(bersama) }),
    murni: { bacaSaklar, cocok, perubahanAsing },
    idHalaman: ID_TAB,
  };
  akar.ALETA_PENGAMAT = api;

  try {
    const d = doc();
    if (d && typeof d.addEventListener === "function") {
      d.addEventListener("visibilitychange", bilaTerlihat);
    }
  } catch {
    /* di luar halaman */
  }

  // Saklar dari singgahan tampilan server (ditulis panel-alat.js).
  try {
    const ch = akar.chrome;
    const st = ch && ch.storage && ch.storage.local;
    if (st && typeof st.get === "function") {
      const hasil = st.get([KUNCI_SERVER]);
      if (hasil && typeof hasil.then === "function") {
        hasil.then((s) => atur({ tunggal: bacaSaklar(s || {}) })).catch(() => undefined);
      }
      if (ch.storage.onChanged && typeof ch.storage.onChanged.addListener === "function") {
        ch.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah) return;
          if (ubah[KUNCI_SERVER]) atur({ tunggal: bacaSaklar({ [KUNCI_SERVER]: ubah[KUNCI_SERVER].newValue }) });
        });
      }
    }
  } catch {
    /* tanpa saklar = perilaku lama */
  }

  void KUNCI_RINGAN;
})(typeof globalThis !== "undefined" ? globalThis : this);
