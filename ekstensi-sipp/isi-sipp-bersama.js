"use strict";

/**
 * ============================================================================
 * ISI DARI SIPP - MESIN BERSAMA (19 Okt 2026)
 * ============================================================================
 *
 * Satu mesin untuk dua tempat:
 *   - panel "Isi dari SIPP & input ke ABT" (hakim) dan "(BAS)" (panitera) di abt.js,
 *   - "Isi otomatis dari SIPP" di Blangko ABT by Derry Briantono (blangko-derry-isian.js).
 *
 * Yang dipakai bersama (bukan disalin ke rumus lain):
 *   - rute bacaan yang sama: POST aleta-bot/abt/usulan (sumber "sipp"), GET aleta-ecourt/isi-gugatan,
 *     GET aleta-ecourt/kuasa-gugatan, GET aleta-ecourt/ktp-pihak;
 *   - pembobotan usulan (terdeteksi, bobot, pangkat keyakinan) - berkas abt.js memakai bentuk yang
 *     sama persis (soreTerdeteksi/soreBobot/SORE_PANGKAT_YAKIN); uji isi-sipp-bersama-19okt menjaga
 *     keduanya tetap sama;
 *   - petunjuk tanggal KTP per variabel (KTP_KODE_PIHAK).
 *
 * Aturan menulis sendiri (hakim dan panitera: semua isian, bukan usulan bercentang - keputusan pengguna):
 *   - usulan berkeyakinan "pasti" atau "cukup", bernilai, dan isiannya KOSONG -> ditulis;
 *   - isian yang sudah ada isinya (diketik petugas atau tersimpan di ABT) TIDAK PERNAH ditimpa;
 *   - usulan "ragu", "bentrok", "ocr", atau yang hanya berupa pilihan -> hanya SARAN samar;
 *   - yang dihitung ABT sendiri, huruf alasan perceraian (8503) dan uraian turunan keterangan saksi
 *     tidak ditulis sendiri (dipertimbangkan hakim); nilai yang memuat kata "ALETA" tidak pernah ditulis.
 *
 * Murni (tanpa DOM): seluruh akses jaringan lewat fungsi `ambil` yang diberikan pemanggil.
 */
(function isiSippBersamaModul(akar) {
  if (!akar || akar.AletaIsiSipp) return;

  const API = Object.freeze({
    usulan: "/aleta/api/aleta-bot/abt/usulan",
    gugatan: "/aleta/api/aleta-ecourt/isi-gugatan",
    kuasa: "/aleta/api/aleta-ecourt/kuasa-gugatan",
    ktp: "/aleta/api/aleta-ecourt/ktp-pihak",
  });

  /** Pangkat keyakinan usulan - yang lebih yakin menang bila dua sumber mengusulkan variabel yang sama. */
  const PANGKAT_YAKIN = Object.freeze({ pasti: 5, cukup: 4, ragu: 2, bentrok: 2, kosong: 0, tidak_ada_sumber: 0 });
  /** Keyakinan yang boleh ditulis sendiri. */
  const YAKIN_OTOMATIS = Object.freeze(["pasti", "cukup"]);
  /** Variabel tanggal KTP per pihak (sama dengan KTP_KODE_PIHAK di abt.js). */
  const KTP_KODE_PIHAK = Object.freeze({
    2222: Object.freeze({ cabang: 1, urutan: 1, sebutan: "Penggugat/Pemohon" }),
    "0364": Object.freeze({ cabang: 1, urutan: 1, sebutan: "Penggugat/Pemohon" }),
    "0365": Object.freeze({ cabang: 2, urutan: 1, sebutan: "Tergugat/Termohon" }),
    "0366": Object.freeze({ cabang: 1, urutan: 2, sebutan: "Pemohon II" }),
  });
  /** Isian yang tidak pernah ditulis sendiri: keputusan hakim atas keterangan saksi (huruf alasan dan uraian turunannya). */
  const HANYA_SARAN = Object.freeze(["8503", "0222", "5227", "0246", "9944", "7035", "1268"]);
  /** Variabel yang memicu bacaan berkas bukti e-Court (P4_VAR_BUKTI di abt.js). */
  const VAR_BUKTI = Object.freeze(["9470", "9488", "9489", "9492", "9493", "9951", "9952", "0654", "0655"]);
  /** Variabel yang diisi dari berkas e-Court (P4_VAR_ECOURT + K5_VAR_KONTAK di abt.js): bacaan e-Court hanya diminta bila blangko memuatnya. */
  const VAR_ECOURT = Object.freeze([
    "6055", "6054", "7120", "6071", "6072", "7778", "5110", "5111", "0007", "2004", "7084", "9881", "5227", "8436", "8437", "9355", "9491", "9681", "9164", "9283", "9470", "9488", "9489", "9492", "9493", "9951", "9952", "0654", "0655",
    "0027", "0045", "8175", "8179", "8180", "0370", "0372", "0123", "7139", "8548", "8549", "8800", "8801", "8802", "8803", "8804", "8805", "8806", "8807", "8808", "8809", "8810", "8811", "8813",
  ]);
  /** Variabel kuasa dari surat gugatan (A3_VAR_KUASA di abt.js). */
  const VAR_KUASA = Object.freeze(["0156", "0184", "8538", "8537"]);

  const teks = (v) => (v === null || v === undefined ? "" : String(v));

  /** Usulan punya nilai, atau sekurang-kurangnya satu pilihan bernilai? (sama dengan soreTerdeteksi di abt.js) */
  function terdeteksi(u) {
    if (teks(u && u.nilai).trim()) return true;
    return Array.isArray(u && u.pilihan) && u.pilihan.some((p) => (p && typeof p === "object" ? teks(p.nilai).trim() : teks(p).trim()));
  }
  /** Bobot usulan (sama dengan soreBobot di abt.js). */
  function bobot(u) {
    return (terdeteksi(u) ? 10 : 0) + (PANGKAT_YAKIN[u.keyakinan] || 1);
  }

  /** Teks memuat kata ALETA (juga yang direnggangkan/disamarkan)? Pakai penjaga ekstensi bila ada. */
  function menyebutAleta(t) {
    const penjaga = akar.AletaPenjagaTanda;
    if (penjaga && typeof penjaga.menyebutAleta === "function") {
      try {
        if (penjaga.menyebutAleta(t)) return true;
      } catch {
        /* jatuh ke pemeriksaan dasar */
      }
    }
    const dasar = teks(t).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return dasar.includes("aleta") || /(?<![a-z0-9])a[\s._\-*·•/\\|,:;'"`~+]*l[\s._\-*·•/\\|,:;'"`~+]*e[\s._\-*·•/\\|,:;'"`~+]*t[\s._\-*·•/\\|,:;'"`~+]*a(?![a-z0-9])/i.test(dasar);
  }

  /** Usulan terbaik per kode dari beberapa sumber (Map kode -> usulan); hanya kode yang ada di `kodeBoleh` (Set) bila diberikan. */
  function pilihPerKode(sumber, kodeBoleh) {
    const perKode = new Map();
    for (const daftar of sumber || []) {
      for (const u of Array.isArray(daftar) ? daftar : []) {
        if (!u || !u.kode) continue;
        const kode = teks(u.kode);
        if (kodeBoleh && !kodeBoleh.has(kode)) continue;
        const lama = perKode.get(kode);
        if (!lama || bobot(u) > bobot(lama)) perKode.set(kode, u);
      }
    }
    return perKode;
  }

  /** Nilai usulan yang akan dipakai: nilai, atau pilihan pertama bernilai (hanya untuk saran). */
  function nilaiUsulan(u) {
    const n = teks(u && u.nilai).trim();
    if (n) return { nilai: n, dariPilihan: false };
    const p = (Array.isArray(u && u.pilihan) ? u.pilihan : []).map((x) => (x && typeof x === "object" ? teks(x.nilai) : teks(x)).trim()).find(Boolean);
    return { nilai: p || "", dariPilihan: Boolean(p) };
  }

  /** Asal usulan untuk catatan jejak: kalimat awam. */
  function asalUsulan(u) {
    const a = u && Array.isArray(u.sumber) && u.sumber[0] ? teks(u.sumber[0].asal) : "";
    if (a === "ktp-ecourt") return "berkas KTP e-Court";
    if (a === "gugatan-ecourt") return "surat gugatan e-Court";
    if (a === "posita") return "posita";
    return "SIPP";
  }

  /**
   * Menentukan nasib satu usulan untuk satu isian.
   *   ctx: { kosong: boolean, jenis: "teks"|"tanggal", opsi: [{nilai,label}], keIso: fn }
   * -> { golongan: "tulis" | "saran" | "lewati", nilai, sebab }
   */
  function putuskan(u, ctx) {
    const c = ctx || {};
    const kode = teks(u && u.kode);
    if (!u || !kode) return { golongan: "lewati", nilai: "", sebab: "tidak ada usulan" };
    if (u.dihitung === true) return { golongan: "lewati", nilai: "", sebab: "dihitung ABT sendiri" };
    if (!terdeteksi(u)) return { golongan: "lewati", nilai: "", sebab: "tidak terdeteksi" };
    const { nilai: mentah, dariPilihan } = nilaiUsulan(u);
    let nilai = mentah;
    if (!nilai) return { golongan: "lewati", nilai: "", sebab: "kosong" };
    if (menyebutAleta(nilai)) return { golongan: "lewati", nilai: "", sebab: "memuat nama aplikasi" };
    if (c.jenis === "tanggal") {
      const iso = typeof c.keIso === "function" ? c.keIso(nilai) : "";
      if (!iso) return { golongan: "lewati", nilai: "", sebab: "tanggal tidak terbaca" };
      nilai = iso;
    } else if (Array.isArray(c.opsi) && c.opsi.length) {
      const cocok = c.opsi.find((o) => o && (teks(o.nilai) === nilai || teks(o.label).trim().toLowerCase() === nilai.toLowerCase()));
      if (!cocok) return { golongan: "lewati", nilai: "", sebab: "bukan salah satu pilihan isian" };
      nilai = teks(cocok.nilai);
    }
    if (c.kosong === false) return { golongan: "lewati", nilai, sebab: "sudah ada isinya" };
    const yakin = teks(u.keyakinan);
    const yakinOto = YAKIN_OTOMATIS.includes(yakin) && !teks(u.bentrok).trim();
    if (!yakinOto || dariPilihan || HANYA_SARAN.includes(kode)) return { golongan: "saran", nilai, sebab: dariPilihan ? "pilihan" : HANYA_SARAN.includes(kode) ? "keputusan hakim" : yakin || "belum pasti" };
    return { golongan: "tulis", nilai, sebab: yakin };
  }

  /**
   * Rencana isian untuk satu blangko.
   *   usulan  : Map kode -> usulan (pilihPerKode)
   *   katalog : [{ kode, jenis: "teks"|"tanggal", opsi?, kosong: boolean }]
   * -> { tulis: [{kode,nilai,keyakinan,asal}], saran: [{kode,nilai,keyakinan,asal}], lewati: [{kode,sebab}] }
   */
  function rencanakan(usulan, katalog, keIso) {
    const hasil = { tulis: [], saran: [], lewati: [] };
    for (const b of katalog || []) {
      const u = usulan.get(teks(b.kode));
      if (!u) continue;
      const h = putuskan(u, { kosong: b.kosong !== false, jenis: b.jenis, opsi: b.opsi, keIso });
      const butir = { kode: teks(b.kode), nilai: h.nilai, keyakinan: teks(u.keyakinan), asal: asalUsulan(u) };
      if (h.golongan === "tulis") hasil.tulis.push(butir);
      else if (h.golongan === "saran") hasil.saran.push(butir);
      else hasil.lewati.push({ kode: butir.kode, sebab: h.sebab });
    }
    return hasil;
  }

  /** Usulan tanggal KTP per variabel dari pihak e-Court (ktp-pihak). Yang "ragu" menjadi saran; selain itu "cukup". */
  function usulanTanggalKtp(pihak, kodeAda) {
    const hasil = [];
    for (const kode of Object.keys(KTP_KODE_PIHAK)) {
      if (kodeAda && !kodeAda.has(kode)) continue;
      const peran = KTP_KODE_PIHAK[kode];
      const p = (Array.isArray(pihak) ? pihak : []).find((x) => Number(x.cabang) === peran.cabang && Number(x.urutan) === peran.urutan);
      if (!p || !p.tanggalKtp) continue;
      const pasti = p.yakin === "pasti";
      const ragu = p.yakin === "ragu";
      hasil.push({ kode, nama: `Tanggal KTP ${p.peran || peran.sebutan}`, nilai: teks(p.tanggalKtp), keyakinan: ragu ? "ragu" : pasti ? "pasti" : "cukup", sumber: [{ asal: "ktp-ecourt", keterangan: "berkas KTP e-Court" }] });
    }
    return hasil;
  }

  const kepala = { "Content-Type": "application/json" };

  /**
   * Membaca semua sumber usulan untuk satu perkara. Satu sumber gagal tidak menggagalkan yang lain;
   * kegagalannya masuk `catatan` (untuk konsol/jejak, bukan untuk layar petugas).
   *   o: { ambil(alamat, opsi, yang) -> data JSON, nomor, kodeAda: Set, pelaku, lawan, ktp: boolean, batasKtpMs, hanyaKtp: boolean }
   *   ktp = baca juga berkas KTP e-Court (lambat: menunggu pemindaian); hanyaKtp = HANYA itu, tanpa sumber lain.
   * -> { usulan: [daftar usulan per sumber], info: { jumlahKuasa, prodeo, kontak }, pihakKtp: [], catatan: [] }
   */
  async function kumpulkan(o) {
    const nomor = teks(o && o.nomor).trim();
    const hasil = { usulan: [], info: { jumlahKuasa: 0, prodeo: false, kontak: null }, pihakKtp: [], catatan: [] };
    if (!nomor || !o || typeof o.ambil !== "function") return hasil;
    const catat = (sumber, galat) => hasil.catatan.push(`${sumber}: ${teks((galat && galat.message) || galat)}`);
    const kodeAda = o.kodeAda instanceof Set ? o.kodeAda : new Set();
    const tugas = [];
    const lain = o.hanyaKtp !== true;
    if (lain) tugas.push(
      (async () => {
        const isi = await o.ambil(API.usulan, { method: "POST", headers: kepala, body: JSON.stringify({ nomorPerkara: nomor, sumber: "sipp" }) }, "Membaca usulan");
        if (!isi || isi.available === false) throw new Error((isi && isi.message) || "bot tidak menjawab");
        const s = isi.sipp || {};
        if (s.ok === false) throw new Error(s.alasan || "SIPP tidak menjawab");
        hasil.usulan.push(Array.isArray(s.usulan) ? s.usulan : []);
        hasil.info.jumlahKuasa = Number(s.jumlahKuasa) || 0;
        hasil.info.prodeo = Boolean(s.prodeo);
      })().catch((g) => catat("SIPP", g))
    );
    if (lain && VAR_ECOURT.some((k) => kodeAda.has(k))) {
      tugas.push(
        (async () => {
          const q = new URLSearchParams({ nomor, lawan: teks(o.lawan), pelaku: teks(o.pelaku) });
          if (VAR_BUKTI.some((k) => kodeAda.has(k))) q.set("bukti", "1");
          const isi = await o.ambil(`${API.gugatan}?${q.toString()}`, {}, "Membaca berkas e-Court");
          hasil.usulan.push(Array.isArray(isi && isi.usulan) ? isi.usulan : []);
          if (isi && isi.kontak && typeof isi.kontak === "object") hasil.info.kontak = isi.kontak;
        })().catch((g) => catat("berkas e-Court", g))
      );
    }
    if (lain && VAR_KUASA.some((k) => kodeAda.has(k))) {
      tugas.push(
        (async () => {
          const isi = await o.ambil(`${API.kuasa}?nomor=${encodeURIComponent(nomor)}`, {}, "Membaca kuasa dari gugatan");
          hasil.usulan.push(Array.isArray(isi && isi.usulan) ? isi.usulan : []);
        })().catch((g) => catat("kuasa", g))
      );
    }
    if (o.ktp === true) {
      tugas.push(
        (async () => {
          const isi = await o.ambil(`${API.ktp}?nomor=${encodeURIComponent(nomor)}&tunggu=1`, { batasMs: Number(o.batasKtpMs) || undefined }, "Membaca tanggal KTP");
          hasil.pihakKtp = Array.isArray(isi && isi.pihak) ? isi.pihak : [];
          hasil.usulan.push(usulanTanggalKtp(hasil.pihakKtp, kodeAda));
        })().catch((g) => catat("tanggal KTP", g))
      );
    }
    await Promise.all(tugas);
    return hasil;
  }

  akar.AletaIsiSipp = Object.freeze({
    API,
    PANGKAT_YAKIN,
    YAKIN_OTOMATIS,
    KTP_KODE_PIHAK,
    HANYA_SARAN,
    VAR_BUKTI,
    VAR_ECOURT,
    VAR_KUASA,
    terdeteksi,
    bobot,
    menyebutAleta,
    pilihPerKode,
    nilaiUsulan,
    asalUsulan,
    putuskan,
    rencanakan,
    usulanTanggalKtp,
    kumpulkan,
  });
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null);
