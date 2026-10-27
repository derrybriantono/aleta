"use strict";

/**
 * ============================================================================
 * UNGGAH BAS TERJADWAL DAN TUNDAAN TERJADWAL - TOMBOL DAN PANELNYA (27 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "Buatkan juga upload BAS terjadwal dan tundaan terjadwal (seperti putusan
 * terjadwal)". Modul ini = SISI LAYAR, saudara putusan-terjadwal.js. Ia hanya MENYUSUN jadwal: memilih
 * sidang menurut tanggal, menerima berkas BAS yang diseret dan memasangkannya ke sidang menurut nomor
 * perkara, mengisi form tunda tiap sidang, memilih jam dengan jeda manusiawi, lalu mengirim jadwalnya
 * ke server. TIDAK ADA tulisan ke SIPP dari sini: server yang menulisnya pada waktunya (laptop tidak
 * perlu menyala).
 *
 * Tempat tombol (di samping "Jadwalkan Putusan", yang tidak diubah):
 *   - halaman perkara SIPP: tombol "Jadwalkan BAS" / "Jadwalkan Tunda" di deretan tombol; panel untuk
 *     sidang perkara itu saja;
 *   - MASSAL: dashboard SIPP dan daftar perkara gugatan/permohonan; panel per tanggal sidang.
 * Panel bawaannya TERLIPAT dan terbuka sebagai pop-up (popup-aksi.js), warnanya mengikuti tema SIPP.
 *
 * Hak (server menegakkannya lagi di tiap rute):
 *   - Jadwalkan BAS  : golongan BAS massal (PP, Panitera, Panmud, Analis, Admin, Super Admin);
 *   - Jadwalkan Tunda: yang boleh menunda/memutus sidang (pimpinan, hakim, panitera, panmud, PP, admin).
 * Tampilan Lama tidak berubah. Tidak ada kata ALETA yang ditulis ke SIPP: teks di layar ini untuk petugas.
 */
(function sidangTerjadwalModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaSidangTerjadwal) return;

  const KELAS = "aleta-sisip aleta-stj";
  const ID_PANEL = "aleta-stj-panel";
  const ID_MASSAL = "aleta-stj-massal";
  const KUNCI_PANEL = "jadwalkan-sidang";
  const kunciPanel = (mode, nomor, tempat) => `${KUNCI_PANEL}:${mode}:${mode === "perkara" ? nomor : tempat}`;
  function terbukaTersimpan(kunci) {
    try {
      return typeof alatPanelTerbuka === "function" ? alatPanelTerbuka(kunci) : false;
    } catch {
      return false;
    }
  }
  function ingatTerbuka(kunci, buka) {
    try {
      if (typeof alatIngatPanel === "function") alatIngatPanel(kunci, buka);
    } catch {
      /* ingatan lipatan hanya kenyamanan */
    }
  }
  const API = {
    dasar: "/aleta/api/aleta-ecourt/sidang-terjadwal",
    sidang: "/aleta/api/aleta-ecourt/sidang",
    jendela: "/aleta/api/aleta-ecourt/sipp-ide/jendela",
  };
  const POLA_DASHBOARD = /DASHBOARD\s+PERKARA/i;
  const POLA_DAFTAR = /DAFTAR\s+PERKARA\s+(?:PERDATA\s+)?(?:GUGATAN|PERMOHONAN)\b/i;
  const BATAS_BERKAS = 10 * 1024 * 1024;
  const BENTUK = /\.(rtf|docx|doc|pdf)$/i;
  const GOLONGAN_TUNDA = ["admin", "ketua", "pimpinan", "hakim", "panitera", "panitera-utama", "panmud", "pp"];
  const NAMA_STATUS = {
    menunggu: "menunggu",
    jalan: "sedang dikerjakan",
    selesai: "sudah ditulis ke SIPP",
    dilewati: "dilewati (sudah ada di SIPP)",
    gagal: "gagal",
    dibatalkan: "dibatalkan",
    kedaluwarsa: "lewat waktunya",
  };
  const NADA_STATUS = { menunggu: "tunggu", jalan: "jalan", selesai: "ok", dilewati: "lewat", gagal: "salah", dibatalkan: "lewat", kedaluwarsa: "salah" };

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  const p2 = (n) => String(n).padStart(2, "0");
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
  function masukan(tipe, nilai, atribut) {
    const i = document.createElement("input");
    i.type = tipe;
    if (nilai != null) i.value = nilai;
    for (const [k, v] of Object.entries(atribut || {})) i.setAttribute(k, v);
    return i;
  }
  function berlabel(teks, kontrol, kelas) {
    const l = el("label", kelas || "");
    l.append(teks ? `${teks} ` : "", kontrol);
    return l;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Waktu (WITA) dan nomor perkara
  // ──────────────────────────────────────────────────────────────────────────
  function witaDari(ms) {
    const b = {};
    for (const x of new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms))) {
      b[x.type] = x.value;
    }
    return `${b.year}-${b.month}-${b.day} ${b.hour}:${b.minute}:${b.second}`;
  }
  function tambahHari(tanggal, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  }
  function hariKerjaBerikut(tanggal) {
    let t = tanggal;
    for (let i = 0; i < 10; i += 1) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
      const h = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
      if (h !== 0 && h !== 6) return t;
      t = tambahHari(t, 1);
    }
    return tanggal;
  }
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  function sebutTanggal(tanggal) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
    if (!m) return tanggal;
    return `${NAMA_HARI[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]}, ${+m[3]}-${m[2]}-${m[1]}`;
  }
  const hariIni = () => witaDari(Date.now()).slice(0, 10);
  /** Jam bulat 5 menit, 15 menit dari sekarang; "" bila sudah lewat tengah malam. */
  function jamBawaanHariIni() {
    const w = witaDari(Date.now());
    const bulat = Math.ceil((Number(w.slice(11, 13)) * 60 + Number(w.slice(14, 16)) + 15) / 5) * 5;
    return bulat >= 24 * 60 ? "" : `${p2(Math.floor(bulat / 60))}:${p2(bulat % 60)}`;
  }
  function jadwalBawaan() {
    const sekarang = witaDari(Date.now());
    const hari = sekarang.slice(0, 10);
    const lewatSore = sekarang.slice(11, 13) >= "15";
    const tanggal = hariKerjaBerikut(lewatSore ? tambahHari(hari, 1) : hari);
    return { tanggal, jam: tanggal === hari ? jamBawaanHariIni() || "08:00" : "08:00" };
  }

  const pasangan = () => globalThis.aletaPutusanTerjadwalPasangan;
  const baku = (n) => (pasangan() ? pasangan().baku(n) : String(n || "").replace(/[\s.]+/g, "").replace(/^0+(?=\d)/, "").toLowerCase());
  const POLA_NOMOR = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/g;
  /** Nomor perkara dari nama berkas BAS; "" bila tidak ada atau lebih dari satu yang berbeda. */
  function nomorDariNama(nama) {
    if (pasangan() && typeof pasangan().nomorDariNama === "function") return pasangan().nomorDariNama(nama);
    const temu = new Set();
    POLA_NOMOR.lastIndex = 0;
    let m;
    while ((m = POLA_NOMOR.exec(String(nama || ""))) !== null) temu.add(m[1]);
    return temu.size === 1 ? [...temu][0] : "";
  }
  /** Alasan berkas ini jelas BUKAN BAS (relaas, sampul, putusan, ...), atau "". */
  function tandaBukanBas(nama) {
    const n = String(nama || "");
    if (/^~\$/.test(n)) return "berkas kunci sementara Word (~$)";
    if (/(?:^|[^A-Za-z])putusan(?:[^A-Za-z]|$)/i.test(n) && !/(?:^|[^A-Za-z0-9])(?:BAS|berita[\s_.-]*acara)(?=[^A-Za-z0-9]|$)/i.test(n)) return "tampaknya putusan, bukan BAS";
    if (pasangan() && typeof pasangan().tandaBukanNaskah === "function") {
      const t = pasangan().tandaBukanNaskah(n);
      if (t && !/berita acara/i.test(t)) return t;
    }
    return "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Jaringan, hak, dan tampilan
  // ──────────────────────────────────────────────────────────────────────────
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
    const pesan = sebaris((data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) || galatPortal || (luar && luar.alasan) || "");
    return { ok: Boolean(r.ok) && !(data && typeof data === "object" && data.ok === false), status: r.status, data, pesan };
  }
  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }
  function pengguna() {
    try {
      return typeof penggunaTerakhir !== "undefined" && penggunaTerakhir ? penggunaTerakhir : null;
    } catch {
      return null;
    }
  }
  function golonganPengguna() {
    try {
      return typeof alatGolonganMenuSemua === "function" ? alatGolonganMenuSemua(pengguna()) : [];
    } catch {
      return [];
    }
  }
  function dasarBoleh() {
    try {
      return typeof boleh === "function" ? boleh("data-umum") === true : true;
    } catch {
      return false;
    }
  }
  /** BAS: golongan BAS massal (matriks menu "bas-massal"); peran yang belum terbaca = tidak tampil. */
  function bolehBas() {
    const p = pengguna();
    if (!p || !dasarBoleh()) return false;
    try {
      if (typeof alatMenuPeran === "function") {
        const menu = alatMenuPeran("sipp", "daftar", p);
        if (Array.isArray(menu)) return menu.includes("bas-massal");
      }
    } catch {
      /* jatuh ke golongan */
    }
    const g = golonganPengguna();
    return g.includes("admin") || g.includes("panitera");
  }
  /** Tunda: yang boleh menunda/memutus sidang (aksi "sidang.tunda-putus"). */
  function bolehTunda() {
    if (!pengguna() || !dasarBoleh()) return false;
    return golonganPengguna().some((g) => GOLONGAN_TUNDA.includes(g));
  }
  function pengawas() {
    return golonganPengguna().includes("admin");
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
  function judulDashboard(d) {
    const h1 = d.querySelector("section.content-header h1, .content-header h1");
    if (h1 && POLA_DASHBOARD.test(String(h1.textContent || ""))) return h1;
    for (const h2 of Array.from(d.querySelectorAll("h2"))) {
      if (/STATISTIK\s+PERKARA\s+DAN\s+REMINDER/i.test(String(h2.textContent || ""))) return h2;
    }
    return null;
  }
  /** "perkara" | "dashboard" | "daftar" | "" - tempat yang sama dengan Jadwalkan Putusan. */
  function tempatHalaman(doc) {
    const d = doc || document;
    if (barisTombol(d) && nomorHalaman(d)) return "perkara";
    if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return "";
    if (judulDashboard(d)) return "dashboard";
    const judul = d.getElementById("pageTitle");
    if (judul && POLA_DAFTAR.test(String(judul.textContent || "")) && d.getElementById("cetak_perkara_list")) return "daftar";
    return "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan
  // ──────────────────────────────────────────────────────────────────────────
  let S = null;
  let urutBerkas = 0;

  function keadaanBaru(mode, nomor, tempat) {
    const b = jadwalBawaan();
    return {
      mode,
      nomor,
      tempat,
      terbuka: false,
      tab: "bas",
      tanggal: hariIni(),
      sidang: [], // { kunci, sidangId, perkaraId, nomor, jam, agenda, sudahPutus, ditunda, adaBas, tanggalSidang }
      sidangDimuat: false,
      memuat: false,
      terpilihBas: new Set(),
      terpilihTunda: new Set(),
      berkas: [], // { kunci, file, nama, ukuran, status, tolak, ganti }
      manual: {}, // kunci berkas -> kunci sidang | ""
      tunda: new Map(), // kunci sidang -> { alasanTunda, tanggalBerikut, jamBerikut, agendaBerikut, dihadiriOleh, catatan, memuat }
      jamBas: { tanggal: b.tanggal, jam: b.jam, jedaMin: 2, jedaMaks: 7 },
      jamTunda: { jam: jamBawaanHariIni(), jedaMin: 1, jedaMaks: 3 },
      konfirm: false,
      pesan: null,
      sibuk: false,
      antrean: null,
      hanyaAktif: false,
      jadwalUlang: null, // id butir yang sedang dijadwalkan ulang
      akar: null,
      r: null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sidang pada tanggal
  // ──────────────────────────────────────────────────────────────────────────
  function sidangDenganKunci(kunci) {
    return S.sidang.find((s) => s.kunci === kunci) || null;
  }
  async function muatSidang() {
    if (!S || S.memuat) return;
    const tgl = S.tanggal;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      S.pesan = { jenis: "galat", teks: "Tanggal sidang belum sah." };
      gambarPesan();
      return;
    }
    S.memuat = true;
    S.pesan = { jenis: "awas", teks: `Membaca sidang ${sebutTanggal(tgl)}…` };
    gambarPesan();
    const q = new URLSearchParams({ dari: tgl, sampai: tgl, batas: "300" });
    const r = await ambilJson(`${API.sidang}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca jadwal sidang");
    S.memuat = false;
    const d = r.data && typeof r.data === "object" ? r.data : {};
    if (!r.ok || d.available === false) {
      S.pesan = { jenis: "galat", teks: r.pesan || d.message || "Jadwal sidang belum dapat dibaca." };
      gambarSemua();
      return;
    }
    const per = new Map();
    for (const s of Array.isArray(d.sidang) ? d.sidang : []) {
      const nomor = sebaris(s.nomorPerkara);
      const kunci = baku(nomor);
      if (!kunci || per.has(kunci)) continue;
      per.set(kunci, {
        kunci,
        sidangId: String(s.sidangId || ""),
        perkaraId: String(s.perkaraId || ""),
        nomor,
        jam: sebaris(s.jamSidang),
        agenda: sebaris(s.agenda),
        sudahPutus: Boolean(s.sudahPutus),
        ditunda: Boolean(s.ditunda),
        adaBas: Boolean(s.adaBas),
        tanggalSidang: sebaris(s.tanggalSidang) || tgl,
      });
    }
    let daftar = [...per.values()];
    if (S.mode === "perkara") daftar = daftar.filter((s) => s.kunci === baku(S.nomor));
    S.sidang = daftar;
    S.sidangDimuat = true;
    for (const k of [...S.terpilihBas]) if (!sidangDenganKunci(k)) S.terpilihBas.delete(k);
    for (const k of [...S.terpilihTunda]) if (!sidangDenganKunci(k)) S.terpilihTunda.delete(k);
    if (S.mode === "perkara") for (const s of daftar) if (!s.ditunda && !s.sudahPutus) S.terpilihTunda.add(s.kunci);
    S.pesan = daftar.length
      ? { jenis: "sukses", teks: `${daftar.length} sidang pada ${sebutTanggal(tgl)}.` }
      : { jenis: "awas", teks: S.mode === "perkara" ? `Perkara ini tidak bersidang pada ${sebutTanggal(tgl)}.` : `Tidak ada sidang pada ${sebutTanggal(tgl)}.` };
    pasangkanBas();
    gambarSemua();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BAS: berkas diseret dan dipasangkan menurut nomor perkara
  // ──────────────────────────────────────────────────────────────────────────
  function tambahBerkas(daftar) {
    if (!S) return [];
    const baru = [];
    for (const file of Array.from(daftar || [])) {
      const nama = String((file && file.name) || "");
      const e = { kunci: `b${(urutBerkas += 1)}`, file, nama, ukuran: file.size || 0, status: "antre", tolak: "", ganti: false, perkaraKunci: "", sebab: "" };
      const bukan = tandaBukanBas(nama);
      if (!BENTUK.test(nama)) {
        e.status = "ditolak";
        e.tolak = "bukan RTF, DOCX, DOC, atau PDF";
      } else if (bukan) {
        e.status = "ditolak";
        e.tolak = `bukan BAS: ${bukan}`;
      } else if (e.ukuran > BATAS_BERKAS) {
        e.status = "ditolak";
        e.tolak = "lebih dari 10 MB";
      } else if (e.ukuran === 0) {
        e.status = "ditolak";
        e.tolak = "berkas kosong";
      } else if (S.berkas.some((x) => x.nama === nama && x.ukuran === e.ukuran && x.status !== "ditolak")) {
        e.status = "ditolak";
        e.tolak = "sudah ada dalam daftar";
      }
      S.berkas.push(e);
      baru.push(e);
    }
    pasangkanBas();
    gambarBerkas();
    gambarKaki();
    return baru;
  }

  /**
   * Memasangkan berkas ke sidang: pilihan manual menang; lalu nomor di nama berkas; di halaman perkara, satu
   * berkas tanpa nomor dipasang ke perkara itu. Dua berkas ke satu sidang = keduanya "ganda". Yang meragukan
   * DITANDAI, tidak ditebak.
   */
  function pasangkanBas() {
    if (!S) return;
    const per = new Map();
    for (const b of S.berkas) {
      b.perkaraKunci = "";
      b.sebab = "";
      if (b.status === "ditolak") continue;
      let kunci = "";
      let status = "tanpa-nomor";
      let sebab = "nomor perkara tidak terbaca dari nama berkas; pilih sidangnya";
      if (Object.prototype.hasOwnProperty.call(S.manual, b.kunci)) {
        const m = S.manual[b.kunci];
        if (m && sidangDenganKunci(m)) {
          kunci = m;
          status = "cocok";
          sebab = "dipasang petugas";
        } else sebab = "belum dipasang";
      } else {
        const nomor = nomorDariNama(b.nama);
        if (nomor) {
          if (sidangDenganKunci(baku(nomor))) {
            kunci = baku(nomor);
            status = "cocok";
            sebab = "";
          } else {
            status = "tidak-cocok";
            sebab = `menyebut ${nomor}, yang tidak bersidang pada tanggal ini`;
          }
        } else if (S.mode === "perkara" && S.sidang.length === 1 && S.berkas.filter((x) => x.status !== "ditolak").length === 1) {
          kunci = S.sidang[0].kunci;
          status = "cocok";
          sebab = "satu-satunya berkas untuk perkara di halaman ini";
        }
      }
      b.status = status;
      b.sebab = sebab;
      b.perkaraKunci = kunci;
      if (kunci) per.set(kunci, [...(per.get(kunci) || []), b]);
    }
    for (const [, daftar] of per) {
      if (daftar.length < 2) continue;
      const manual = daftar.filter((x) => Object.prototype.hasOwnProperty.call(S.manual, x.kunci));
      for (const b of daftar) {
        if (manual.length === 1 && b === manual[0]) continue;
        b.status = "ganda";
        b.sebab = `ada ${daftar.length} berkas untuk satu sidang - pilih satu`;
        b.perkaraKunci = "";
      }
    }
    // Yang cocok otomatis ikut tercentang.
    for (const b of S.berkas) if (b.status === "cocok" && b.perkaraKunci) S.terpilihBas.add(b.perkaraKunci);
  }

  /** Berkas yang akan dijadwalkan: cocok, sidangnya tercentang, dan BAS yang sudah ada hanya bila "ganti" dicentang. */
  function berkasSiap() {
    const hasil = [];
    for (const b of S.berkas) {
      if (b.status !== "cocok" || !b.perkaraKunci || !S.terpilihBas.has(b.perkaraKunci)) continue;
      const s = sidangDenganKunci(b.perkaraKunci);
      if (!s) continue;
      if (s.adaBas && !b.ganti) continue;
      hasil.push({ berkas: b, sidang: s });
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tunda: isian form tiap sidang
  // ──────────────────────────────────────────────────────────────────────────
  function isianTunda(kunci) {
    let t = S.tunda.get(kunci);
    if (!t) {
      t = { alasanTunda: "", tanggalBerikut: "", jamBerikut: "", agendaBerikut: "", dihadiriOleh: null, catatan: "", memuat: false };
      S.tunda.set(kunci, t);
    }
    return t;
  }
  function tundaBisa(s) {
    if (s.sudahPutus) return "sudah diputus di SIPP";
    if (s.ditunda) return "sudah ditunda di SIPP";
    return "";
  }
  function tundaLengkap(t) {
    return Boolean(sebaris(t.alasanTunda) && /^\d{4}-\d{2}-\d{2}$/.test(t.tanggalBerikut) && /^\d{2}:\d{2}$/.test(t.jamBerikut) && sebaris(t.agendaBerikut));
  }

  /**
   * Usulan bawaan dari sumber yang sama dengan jendela Tunda SIPP (riwayat sidang, kehadiran antrian).
   * Hanya mengisi kolom yang masih KOSONG; yang tidak tersedia dibiarkan kosong, tidak dikarang.
   */
  async function muatUsulan(kunci) {
    const s = sidangDenganKunci(kunci);
    if (!s || !S) return;
    const t = isianTunda(kunci);
    t.memuat = true;
    gambarTunda();
    const q = new URLSearchParams({ jendela: "tunda", nomor: s.nomor, tanggal: s.tanggalSidang });
    const r = await ambilJson(`${API.jendela}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca usulan tunda");
    t.memuat = false;
    const bahan = r.data && r.data.tunda ? r.data.tunda : null;
    const u = bahan && bahan.usulan;
    if (!r.ok || !u) {
      t.catatan = (bahan && bahan.alasan) || r.pesan || "Usulan belum tersedia untuk sidang ini; isi sendiri.";
      gambarTunda();
      return;
    }
    if (!sebaris(t.alasanTunda) && u.alasan) t.alasanTunda = sebaris(u.alasan);
    if (!sebaris(t.agendaBerikut) && u.agenda) t.agendaBerikut = sebaris(u.agenda);
    const tgl = /^\d{4}-\d{2}-\d{2}/.exec(String(u.tanggal || ""));
    if (!t.tanggalBerikut && tgl) t.tanggalBerikut = tgl[0];
    if (!t.jamBerikut && /^\d{2}:\d{2}$/.test(String(u.jam || ""))) t.jamBerikut = u.jam;
    const rinci = bahan.kehadiranRinci ? Number(bahan.kehadiranRinci.sandi) : NaN;
    const hadir = rinci >= 1 && rinci <= 3 ? rinci : Number(bahan.kehadiranAntrian);
    if (hadir >= 1 && hadir <= 3) t.dihadiriOleh = hadir;
    t.catatan = sebaris(u.penjelasan || "Usulan dari riwayat sidang perkara; periksa sebelum dijadwalkan.");
    gambarTunda();
    gambarKaki();
  }
  async function muatUsulanSemua() {
    for (const k of [...S.terpilihTunda]) {
      const s = sidangDenganKunci(k);
      if (s && !tundaBisa(s)) await muatUsulan(k);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mengirim jadwal
  // ──────────────────────────────────────────────────────────────────────────
  function sebabJamBas() {
    const j = S.jamBas;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j.tanggal)) return "Tanggal mulai belum sah.";
    if (!/^\d{2}:\d{2}$/.test(j.jam)) return "Jam mulai belum sah.";
    if (j.tanggal < S.tanggal) return "Penulisan BAS tidak boleh sebelum tanggal sidangnya.";
    if (`${j.tanggal} ${j.jam}` < witaDari(Date.now()).slice(0, 16)) return "Waktu mulai sudah lewat; pilih waktu yang masih akan datang.";
    if (!(Number(j.jedaMin) >= 1 && Number(j.jedaMaks) >= Number(j.jedaMin))) return "Jeda antar berkas belum sah (paling cepat 1 menit, batas atas tidak boleh lebih kecil).";
    return "";
  }
  function sebabJamTunda() {
    const j = S.jamTunda;
    if (S.tanggal !== hariIni()) return S.tanggal < hariIni() ? "Sidang ini sudah lewat harinya, jadi penundaannya tidak dapat dijadwalkan." : "Penundaan hanya dapat dijadwalkan pada hari sidangnya sendiri.";
    if (!/^\d{2}:\d{2}$/.test(j.jam)) return "Pilih jam penulisan.";
    if (j.jam < witaDari(Date.now()).slice(11, 16)) return "Jam yang dipilih sudah lewat; pilih jam yang masih akan datang hari ini.";
    if (!(Number(j.jedaMin) >= 1 && Number(j.jedaMaks) >= Number(j.jedaMin))) return "Jeda antar sidang belum sah.";
    return "";
  }
  function tundaTerpilih() {
    return S.sidang.filter((s) => S.terpilihTunda.has(s.kunci) && !tundaBisa(s));
  }
  /** Alasan tombol Jadwalkan belum dapat dipakai pada tab ini, atau "". */
  function sebabBelumSiap() {
    if (!S) return "";
    if (S.tab === "bas") {
      if (!S.sidangDimuat) return "Muat sidang pada tanggal itu lebih dahulu.";
      if (!berkasSiap().length) return "Belum ada berkas BAS yang cocok dengan sidang yang dicentang.";
      return sebabJamBas();
    }
    if (S.tab === "tunda") {
      const pilih = tundaTerpilih();
      if (!pilih.length) return "Centang sidang yang akan ditunda.";
      const belum = pilih.filter((s) => !tundaLengkap(isianTunda(s.kunci)));
      if (belum.length) return `Isian tunda ${belum.map((s) => s.nomor).join(", ")} belum lengkap.`;
      return sebabJamTunda();
    }
    return "";
  }

  async function kirimJadwal() {
    if (!S || S.sibuk || sebabBelumSiap()) return;
    S.sibuk = true;
    S.konfirm = false;
    S.pesan = null;
    gambarPesan();
    gambarKaki();
    try {
      if (S.tab === "bas") await kirimBas();
      else await kirimTunda();
    } catch (galat) {
      S.pesan = { jenis: "galat", teks: sebaris((galat && galat.message) || galat) };
    } finally {
      if (S) {
        S.sibuk = false;
        gambarSemua();
      }
    }
  }
  function pesanTolak(r) {
    const d = r.data && typeof r.data === "object" ? r.data : {};
    const tolak = Array.isArray(d.tolak) ? d.tolak.map((t) => `${t.nomorPerkara || ""}: ${t.sebab || ""}`.trim()).filter(Boolean) : [];
    return [r.pesan || "Jadwal tidak dapat dibuat.", ...tolak].join(" ");
  }
  function susulSukses(d, jenis) {
    const butir = Array.isArray(d.butir) ? d.butir : [];
    const pertama = butir[0] ? butir[0].waktuWita : "";
    const terakhir = butir.length ? butir[butir.length - 1].waktuWita : "";
    S.pesan = {
      jenis: "sukses",
      teks: `${butir.length} ${jenis} dijadwalkan${pertama ? ` (${String(pertama).slice(-5)}${butir.length > 1 ? ` sampai ${String(terakhir).slice(-5)}` : ""} WITA)` : ""}. Server yang menuliskannya ke SIPP pada waktunya. Pantau di Antrean.`,
    };
    S.tab = "antrean";
    gambarTab();
  }

  async function kirimBas() {
    const siap = berkasSiap();
    const j = S.jamBas;
    const badan = new FormData();
    badan.append("jenis", "bas");
    badan.append("mulai", `${j.tanggal} ${j.jam}`);
    badan.append("jedaMin", String(Math.round(Number(j.jedaMin) * 60)));
    badan.append("jedaMaks", String(Math.round(Number(j.jedaMaks) * 60)));
    // Pemeriksaan sisa blangko yang sama dengan unggah BAS langsung: ada sisa -> peringatan; Batal -> tidak dijadwalkan.
    const deteksi = globalThis.aletaDeteksiSisa;
    if (deteksi && typeof deteksi.tinjau === "function") {
      for (const p of siap) {
        const t = await deteksi.tinjau(p.berkas.file, { nama: p.berkas.nama, jenis: "bas", aksi: "unggah", massal: siap.length > 1 });
        if (t && t.lanjut === false) {
          S.pesan = { jenis: "awas", teks: `Dibatalkan atas permintaan Anda: ${p.berkas.nama} masih memuat sisa blangko. Perbaiki berkasnya, lalu jadwalkan lagi.` };
          return;
        }
      }
    }
    const meta = [];
    siap.forEach((p, i) => {
      if (!/^\d+$/.test(p.sidang.perkaraId) || !/^\d+$/.test(p.sidang.sidangId)) throw new Error(`Nomor induk sidang ${p.sidang.nomor} belum terbaca dari SIPP, jadi tidak dapat dijadwalkan.`);
      meta.push({
        perkaraId: p.sidang.perkaraId,
        sidangId: p.sidang.sidangId,
        nomorPerkara: p.sidang.nomor,
        tanggalSidang: p.sidang.tanggalSidang,
        berkas: `berkas${i}`,
        ...(p.berkas.ganti ? { ganti: true } : {}),
      });
      badan.append(`berkas${i}`, p.berkas.file, p.berkas.nama);
    });
    badan.append("butir", JSON.stringify(meta));
    let kirim = badan;
    const bersihkan = fungsi("alatBuangGrupTersembunyiBadan");
    if (bersihkan) {
      try {
        kirim = await bersihkan(badan);
      } catch {
        kirim = badan; /* server membuangnya lagi */
      }
    }
    const r = await ambilJson(API.dasar, { method: "POST", credentials: "include", body: kirim, batasMs: 120000 }, "Menjadwalkan BAS");
    const d = r.data && typeof r.data === "object" ? r.data : {};
    if (!r.ok) {
      S.pesan = { jenis: "galat", teks: pesanTolak(r) };
      return;
    }
    susulSukses(d, "BAS");
    S.berkas = [];
    S.manual = {};
    S.terpilihBas.clear();
    await muatAntrean();
    void bacaLencana();
  }

  async function kirimTunda() {
    const j = S.jamTunda;
    const butir = [];
    for (const s of tundaTerpilih()) {
      if (!/^\d+$/.test(s.perkaraId) || !/^\d+$/.test(s.sidangId)) throw new Error(`Nomor induk sidang ${s.nomor} belum terbaca dari SIPP, jadi tidak dapat dijadwalkan.`);
      const t = isianTunda(s.kunci);
      butir.push({
        jadwalId: s.sidangId,
        perkaraId: s.perkaraId,
        nomorPerkara: s.nomor,
        tanggalSidang: s.tanggalSidang,
        alasanTunda: sebaris(t.alasanTunda),
        tanggalBerikut: t.tanggalBerikut,
        jamBerikut: t.jamBerikut,
        agendaBerikut: sebaris(t.agendaBerikut),
        ...(t.dihadiriOleh != null ? { dihadiriOleh: t.dihadiriOleh } : {}),
      });
    }
    const badan = { jenis: "tunda", mulai: `${S.tanggal} ${j.jam}`, jedaMin: Math.round(Number(j.jedaMin) * 60), jedaMaks: Math.round(Number(j.jedaMaks) * 60), butir };
    const r = await ambilJson(API.dasar, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan), batasMs: 60000 }, "Menjadwalkan tundaan");
    const d = r.data && typeof r.data === "object" ? r.data : {};
    if (!r.ok) {
      S.pesan = { jenis: "galat", teks: pesanTolak(r) };
      return;
    }
    susulSukses(d, "tundaan");
    S.terpilihTunda.clear();
    S.tunda.clear();
    await muatAntrean();
    void bacaLencana();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Antrean
  // ──────────────────────────────────────────────────────────────────────────
  async function muatAntrean() {
    if (!S) return;
    const q = new URLSearchParams();
    if (S.hanyaAktif) q.set("aktif", "1");
    if (pengawas()) q.set("semua", "1");
    const r = await ambilJson(`${API.dasar}${q.toString() ? `?${q.toString()}` : ""}`, { credentials: "include", cache: "no-store" }, "Membaca antrean");
    if (!S) return;
    const d = r.data && typeof r.data === "object" ? r.data : {};
    S.antrean = r.ok ? { butir: Array.isArray(d.butir) ? d.butir : [], pelaksanaNyala: d.pelaksanaNyala !== false, galat: "" } : { butir: [], pelaksanaNyala: true, galat: r.pesan || "Antrean belum dapat dibaca." };
    gambarAntrean();
  }
  async function aksiButir(aksi, id, tambahan) {
    if (!S || S.sibuk) return;
    S.sibuk = true;
    const r = await ambilJson(API.dasar, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, id, ...(tambahan || {}) }) }, "Mengubah jadwal");
    if (!S) return;
    S.sibuk = false;
    S.jadwalUlang = null;
    S.pesan = r.ok ? { jenis: "sukses", teks: aksi === "batal" ? "Jadwal dibatalkan." : aksi === "ulang" ? "Akan dicoba lagi." : "Jadwal diubah." } : { jenis: "galat", teks: r.pesan || "Jadwal belum dapat diubah." };
    gambarPesan();
    await muatAntrean();
    void bacaLencana();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gambar
  // ──────────────────────────────────────────────────────────────────────────
  function buatKerangka() {
    const akar = el("section", `${KELAS} aleta-ptj-panel aleta-stj-panel`);
    akar.id = ID_PANEL;
    akar.setAttribute("role", "region");
    akar.setAttribute("aria-label", "Jadwalkan BAS dan Tunda");
    akar.setAttribute("data-stj", "panel");

    const kepala = el("div", "aleta-ptj-kepala");
    const h = el("h2", "aleta-ptj-judul", S.mode === "perkara" ? "Jadwalkan BAS / Tunda" : "Jadwalkan BAS / Tunda Massal");
    if (S.nomor) h.append(" · ", el("span", "aleta-ptj-mono", S.nomor));
    kepala.append(
      h,
      el(
        "div",
        "aleta-ptj-catatan",
        "Disusun di sini, ditulis ke SIPP oleh server pada jam yang dipilih (laptop tidak perlu menyala), dengan jeda antar sidang yang wajar."
      )
    );
    const tab = el("div", "aleta-ptj-tab");
    tab.setAttribute("role", "tablist");
    const daftarTab = [];
    if (bolehBas()) daftarTab.push(["bas", "BAS"]);
    if (bolehTunda()) daftarTab.push(["tunda", "Tunda"]);
    daftarTab.push(["antrean", "Antrean terjadwal"]);
    for (const [kunci, teks] of daftarTab) {
      const b = tombol(teks, "");
      b.setAttribute("role", "tab");
      b.setAttribute("data-stj", `tab-${kunci}`);
      b.addEventListener("click", () => bukaTab(kunci));
      tab.appendChild(b);
    }
    const pesan = el("div", "aleta-ptj-pesan");
    pesan.setAttribute("aria-live", "polite");
    pesan.setAttribute("data-stj", "pesan");
    const badan = el("div", "aleta-ptj-badan");
    badan.setAttribute("data-stj", "badan");
    const sidang = el("div", "aleta-ptj-bagian");
    sidang.setAttribute("data-stj", "bagian-sidang");
    const berkas = el("div", "aleta-ptj-bagian");
    berkas.setAttribute("data-stj", "bagian-berkas");
    const tunda = el("div", "aleta-ptj-bagian");
    tunda.setAttribute("data-stj", "bagian-tunda");
    const jam = el("div", "aleta-ptj-bagian");
    jam.setAttribute("data-stj", "bagian-jam");
    badan.append(sidang, berkas, tunda, jam);
    const antrean = el("div", "aleta-ptj-badan");
    antrean.setAttribute("data-stj", "badan-antrean");
    const kaki = el("div", "aleta-ptj-kaki");
    kaki.setAttribute("data-stj", "kaki");
    akar.append(kepala, tab, pesan, badan, antrean, kaki);
    S.akar = akar;
    S.r = { tab, pesan, badan, sidang, berkas, tunda, jam, antrean, kaki };
    return akar;
  }

  function bukaTab(kunci) {
    if (!S) return;
    S.tab = kunci;
    S.konfirm = false;
    gambarSemua();
    if (kunci === "antrean") void muatAntrean();
    else if (!S.sidangDimuat) void muatSidang();
  }

  function gambarSemua() {
    if (!S || !S.akar) return;
    gambarTab();
    gambarPesan();
    gambarSidang();
    gambarBerkas();
    gambarTunda();
    gambarJam();
    gambarAntrean();
    gambarKaki();
  }
  function gambarTab() {
    if (!S || !S.r) return;
    for (const b of S.r.tab.querySelectorAll("button")) b.setAttribute("aria-selected", b.getAttribute("data-stj") === `tab-${S.tab}` ? "true" : "false");
    const antrean = S.tab === "antrean";
    S.r.badan.hidden = antrean;
    S.r.antrean.hidden = !antrean;
    S.r.berkas.hidden = S.tab !== "bas";
    S.r.tunda.hidden = S.tab !== "tunda";
    S.r.kaki.hidden = antrean;
  }
  function gambarPesan() {
    if (!S || !S.r) return;
    S.r.pesan.textContent = "";
    if (S.pesan) {
      const k = el("div", `aleta-ptj-${S.pesan.jenis === "galat" ? "galat" : S.pesan.jenis === "awas" ? "awas" : "sukses"}`, S.pesan.teks);
      k.setAttribute("role", S.pesan.jenis === "galat" ? "alert" : "status");
      S.r.pesan.appendChild(k);
    }
  }

  function gambarSidang() {
    if (!S || !S.r) return;
    const w = S.r.sidang;
    w.textContent = "";
    const sidangBas = S.tab === "bas";
    w.appendChild(el("h3", "", sidangBas ? "Sidang yang BAS-nya dijadwalkan" : "Sidang yang ditunda"));
    const baris = el("div", "aleta-ptj-baris-aksi");
    const tgl = masukan("date", S.tanggal, { "aria-label": "Tanggal sidang", "data-stj": "tanggal-sidang" });
    tgl.addEventListener("change", () => {
      S.tanggal = tgl.value;
      S.sidangDimuat = false;
      S.sidang = [];
      S.terpilihBas.clear();
      S.terpilihTunda.clear();
      pasangkanBas();
      void muatSidang();
    });
    const muat = tombol("Muat sidang", "aleta-ptj-sekunder");
    muat.setAttribute("data-stj", "muat-sidang");
    muat.addEventListener("click", () => {
      S.sidangDimuat = false;
      void muatSidang();
    });
    baris.append(berlabel("Tanggal sidang", tgl), muat);
    w.appendChild(baris);
    if (!S.sidang.length) {
      w.appendChild(el("div", "aleta-ptj-ket", S.memuat ? "Membaca sidang…" : S.sidangDimuat ? "Tidak ada sidang." : "Sidang belum dimuat."));
      return;
    }
    const daftar = el("div", "aleta-ptj-kandidat");
    const himpunan = sidangBas ? S.terpilihBas : S.terpilihTunda;
    for (const s of S.sidang) {
      const alasanTunda = sidangBas ? "" : tundaBisa(s);
      const l = el("label", "");
      const cek = masukan("checkbox");
      cek.checked = himpunan.has(s.kunci);
      cek.disabled = Boolean(alasanTunda);
      cek.setAttribute("data-stj-sidang", s.kunci);
      cek.addEventListener("change", () => {
        if (cek.checked) himpunan.add(s.kunci);
        else himpunan.delete(s.kunci);
        gambarTunda();
        gambarBerkas();
        gambarKaki();
      });
      const ket = [s.jam, s.agenda || "tanpa agenda"].filter(Boolean).join(" · ");
      const tanda = sidangBas ? (s.adaBas ? " · BAS sudah ada di SIPP" : "") : alasanTunda ? ` · ${alasanTunda}` : "";
      l.append(cek, el("span", "aleta-ptj-nomor", s.nomor), el("span", "aleta-ptj-ket", `${ket}${tanda}`));
      daftar.appendChild(l);
    }
    w.appendChild(daftar);
  }

  function gambarBerkas() {
    if (!S || !S.r) return;
    const w = S.r.berkas;
    w.textContent = "";
    w.appendChild(el("h3", "", "Berkas BAS"));
    w.appendChild(el("div", "aleta-ptj-bantu", "RTF, DOCX, DOC, atau PDF (paling besar 10 MB). Dipasangkan ke sidang menurut nomor perkara di nama berkas; yang tidak terbaca dapat dipasang sendiri."));
    const zona = el("div", "aleta-ptj-zona");
    zona.setAttribute("data-stj", "zona");
    zona.append(el("strong", "", "Seret berkas BAS ke sini"), el("span", "", "atau"));
    const pilih = masukan("file", null, { multiple: "", accept: ".rtf,.docx,.doc,.pdf", "data-stj": "pilih-berkas" });
    pilih.addEventListener("change", () => {
      tambahBerkas(pilih.files);
      pilih.value = "";
    });
    zona.appendChild(pilih);
    for (const nama of ["dragenter", "dragover"]) {
      zona.addEventListener(nama, (e) => {
        e.preventDefault();
        zona.setAttribute("data-sorot", "1");
      });
    }
    zona.addEventListener("dragleave", () => zona.removeAttribute("data-sorot"));
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      zona.removeAttribute("data-sorot");
      tambahBerkas(e.dataTransfer && e.dataTransfer.files);
    });
    w.appendChild(zona);
    if (!S.berkas.length) return;
    const daftar = el("div", "aleta-ptj-berkas-daftar");
    for (const b of S.berkas) {
      const k = el("div", "aleta-ptj-berkas");
      k.setAttribute("data-status", b.status === "antre" ? "tanpa-nomor" : b.status);
      k.setAttribute("data-stj-berkas", b.nama);
      const kiri = el("div", "");
      kiri.append(el("div", "aleta-ptj-nama", b.nama), el("div", "aleta-ptj-ket", `${Math.max(1, Math.round(b.ukuran / 1024))} KB`));
      const tengah = el("div", "");
      if (b.status === "ditolak") tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-salah", `ditolak: ${b.tolak}`));
      else {
        const s = b.perkaraKunci ? sidangDenganKunci(b.perkaraKunci) : null;
        if (s) tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-ok", `untuk ${s.nomor}`));
        else tengah.appendChild(el("span", "aleta-ptj-chip aleta-ptj-c-tunggu", b.sebab || "belum dipasang"));
        const pil = document.createElement("select");
        pil.setAttribute("aria-label", `Pasangkan ${b.nama} ke sidang`);
        pil.setAttribute("data-stj", "pasang-manual");
        pil.appendChild(new Option("— pasang ke sidang —", ""));
        for (const sd of S.sidang) pil.appendChild(new Option(sd.nomor, sd.kunci));
        pil.value = b.perkaraKunci || "";
        pil.addEventListener("change", () => {
          S.manual[b.kunci] = pil.value;
          pasangkanBas();
          gambarSidang();
          gambarBerkas();
          gambarKaki();
        });
        tengah.appendChild(pil);
        if (s && s.adaBas) {
          const ganti = masukan("checkbox");
          ganti.checked = b.ganti;
          ganti.setAttribute("data-stj", "ganti");
          ganti.addEventListener("change", () => {
            b.ganti = ganti.checked;
            gambarKaki();
          });
          tengah.appendChild(berlabel("BAS di SIPP sudah ada: ganti dengan berkas ini", ganti));
        }
      }
      const kanan = el("div", "");
      const buang = tombol("Buang", "aleta-ptj-sekunder");
      buang.setAttribute("data-stj", "buang-berkas");
      buang.addEventListener("click", () => {
        S.berkas = S.berkas.filter((x) => x.kunci !== b.kunci);
        delete S.manual[b.kunci];
        pasangkanBas();
        gambarSidang();
        gambarBerkas();
        gambarKaki();
      });
      kanan.appendChild(buang);
      k.append(kiri, tengah, kanan);
      daftar.appendChild(k);
    }
    w.appendChild(daftar);
  }

  function gambarTunda() {
    if (!S || !S.r) return;
    const w = S.r.tunda;
    w.textContent = "";
    if (S.tab !== "tunda") return;
    w.appendChild(el("h3", "", "Isian tunda tiap sidang"));
    const pilih = tundaTerpilih();
    if (!pilih.length) {
      w.appendChild(el("div", "aleta-ptj-ket", "Centang sidang di atas yang akan ditunda."));
      return;
    }
    w.appendChild(el("div", "aleta-ptj-bantu", "Isian ini ditulis persis seperti form Tunda sidang. Usulan hanya mengisi kolom yang masih kosong; yang tidak ada usulannya diisi sendiri."));
    const semua = tombol("Isi usulan semua", "aleta-ptj-sekunder");
    semua.setAttribute("data-stj", "usulan-semua");
    semua.addEventListener("click", () => void muatUsulanSemua());
    w.appendChild(semua);
    for (const s of pilih) {
      const t = isianTunda(s.kunci);
      const kotak = el("div", "aleta-ptj-bagian");
      kotak.setAttribute("data-stj-tunda", s.nomor);
      const kepala = el("div", "aleta-ptj-baris-aksi");
      kepala.append(el("strong", "aleta-ptj-nomor", s.nomor), el("span", "aleta-ptj-ket", [s.jam, s.agenda].filter(Boolean).join(" · ")));
      const usul = tombol(t.memuat ? "Membaca…" : "Isi usulan", "aleta-ptj-sekunder");
      usul.disabled = t.memuat;
      usul.setAttribute("data-stj", "usulan");
      usul.addEventListener("click", () => void muatUsulan(s.kunci));
      kepala.appendChild(usul);
      kotak.appendChild(kepala);
      const alasan = masukan("text", t.alasanTunda, { "aria-label": `Alasan penundaan ${s.nomor}`, "data-stj": "alasan", placeholder: "Alasan penundaan" });
      alasan.addEventListener("input", () => {
        t.alasanTunda = alasan.value;
        gambarKaki();
      });
      const agenda = masukan("text", t.agendaBerikut, { "aria-label": `Agenda sidang berikutnya ${s.nomor}`, "data-stj": "agenda", placeholder: "Agenda sidang berikutnya" });
      agenda.addEventListener("input", () => {
        t.agendaBerikut = agenda.value;
        gambarKaki();
      });
      const tglB = masukan("date", t.tanggalBerikut, { "aria-label": `Tanggal sidang berikutnya ${s.nomor}`, "data-stj": "tanggal-berikut" });
      tglB.addEventListener("change", () => {
        t.tanggalBerikut = tglB.value;
        gambarKaki();
      });
      const jamB = masukan("time", t.jamBerikut, { "aria-label": `Jam sidang berikutnya ${s.nomor}`, "data-stj": "jam-berikut" });
      jamB.addEventListener("change", () => {
        t.jamBerikut = jamB.value;
        gambarKaki();
      });
      const baris1 = el("div", "aleta-ptj-baris-aksi");
      baris1.append(berlabel("Alasan", alasan), berlabel("Agenda berikutnya", agenda));
      const baris2 = el("div", "aleta-ptj-baris-aksi");
      baris2.append(berlabel("Tanggal berikutnya", tglB), berlabel("Jam berikutnya", jamB));
      kotak.append(baris1, baris2);
      if (t.dihadiriOleh != null) kotak.appendChild(el("div", "aleta-ptj-ket", `Kehadiran pihak mengikuti catatan antrian sidang (pilihan ${t.dihadiriOleh}).`));
      if (t.catatan) kotak.appendChild(el("div", "aleta-ptj-ket", t.catatan));
      w.appendChild(kotak);
    }
  }

  function gambarJam() {
    if (!S || !S.r) return;
    const w = S.r.jam;
    w.textContent = "";
    if (S.tab === "antrean") return;
    const bas = S.tab === "bas";
    w.appendChild(el("h3", "", bas ? "Jam penulisan BAS ke SIPP" : "Jam penulisan tundaan ke SIPP"));
    const j = bas ? S.jamBas : S.jamTunda;
    const baris = el("div", "aleta-ptj-baris-aksi");
    if (bas) {
      const tgl = masukan("date", j.tanggal, { "aria-label": "Tanggal mulai", "data-stj": "mulai-tanggal" });
      tgl.addEventListener("change", () => {
        j.tanggal = tgl.value;
        gambarKaki();
      });
      baris.appendChild(berlabel("Mulai tanggal", tgl));
    } else baris.appendChild(el("span", "aleta-ptj-ket", `Hari ini (${sebutTanggal(S.tanggal)}), karena penundaan hanya ditulis pada hari sidangnya.`));
    const jam = masukan("time", j.jam, { "aria-label": "Jam mulai", "data-stj": "mulai-jam" });
    jam.addEventListener("change", () => {
      j.jam = jam.value;
      gambarKaki();
    });
    const jMin = masukan("number", String(j.jedaMin), { min: "1", max: "60", "aria-label": "Jeda paling cepat (menit)", "data-stj": "jeda-min" });
    jMin.addEventListener("input", () => {
      j.jedaMin = Number(jMin.value);
      gambarKaki();
    });
    const jMaks = masukan("number", String(j.jedaMaks), { min: "1", max: "60", "aria-label": "Jeda paling lambat (menit)", "data-stj": "jeda-maks" });
    jMaks.addEventListener("input", () => {
      j.jedaMaks = Number(jMaks.value);
      gambarKaki();
    });
    baris.append(berlabel("Jam mulai (WITA)", jam), berlabel("Jeda antar sidang", jMin), berlabel("sampai", jMaks), el("span", "aleta-ptj-ket", "menit"));
    w.appendChild(baris);
    if (bas) w.appendChild(el("div", "aleta-ptj-bantu", "Dikerjakan pada jam kerja dan hari kerja; bila waktu yang dipilih di luar itu, server menggesernya ke jam kerja berikutnya."));
  }

  function ringkasanRencana() {
    if (S.tab === "bas") {
      const n = berkasSiap().length;
      return `${n} BAS akan diunggah ke SIPP mulai ${sebutTanggal(S.jamBas.tanggal)} pukul ${S.jamBas.jam} WITA, dengan jeda ${S.jamBas.jedaMin}-${S.jamBas.jedaMaks} menit antar sidang.`;
    }
    return `${tundaTerpilih().length} sidang akan ditunda di SIPP hari ini mulai pukul ${S.jamTunda.jam} WITA, dengan jeda ${S.jamTunda.jedaMin}-${S.jamTunda.jedaMaks} menit antar sidang.`;
  }
  function gambarKaki() {
    if (!S || !S.r) return;
    const w = S.r.kaki;
    w.textContent = "";
    if (S.tab === "antrean") return;
    const sebab = sebabBelumSiap();
    if (S.konfirm && !sebab) {
      w.appendChild(el("div", "aleta-ptj-awas", `${ringkasanRencana()} Lanjutkan?`));
      const ya = tombol("Ya, jadwalkan", "aleta-ptj-ya");
      ya.setAttribute("data-stj", "ya");
      ya.disabled = S.sibuk;
      ya.addEventListener("click", () => void kirimJadwal());
      const kembali = tombol("Kembali", "aleta-ptj-batal");
      kembali.setAttribute("data-stj", "kembali");
      kembali.addEventListener("click", () => {
        S.konfirm = false;
        gambarKaki();
      });
      w.append(ya, kembali);
      return;
    }
    if (sebab) w.appendChild(el("div", "aleta-ptj-ket", sebab));
    const b = tombol(S.tab === "bas" ? "Jadwalkan BAS" : "Jadwalkan tundaan", "aleta-ptj-utama");
    b.setAttribute("data-stj", "jadwalkan");
    b.disabled = Boolean(sebab) || S.sibuk;
    b.addEventListener("click", () => {
      S.konfirm = true;
      gambarKaki();
    });
    w.appendChild(b);
  }

  function gambarAntrean() {
    if (!S || !S.r) return;
    const w = S.r.antrean;
    w.textContent = "";
    const a = S.antrean;
    const atas = el("div", "aleta-ptj-baris-aksi");
    const segar = tombol("Segarkan", "aleta-ptj-sekunder");
    segar.setAttribute("data-stj", "segarkan");
    segar.addEventListener("click", () => void muatAntrean());
    const aktif = masukan("checkbox");
    aktif.checked = S.hanyaAktif;
    aktif.setAttribute("data-stj", "hanya-aktif");
    aktif.addEventListener("change", () => {
      S.hanyaAktif = aktif.checked;
      void muatAntrean();
    });
    atas.append(segar, berlabel("Hanya yang belum selesai", aktif));
    w.appendChild(atas);
    if (a && a.pelaksanaNyala === false) w.appendChild(el("div", "aleta-ptj-galat", "Pengerjaan terjadwal di server sedang dimatikan, jadi jadwal belum dikerjakan sampai dinyalakan lagi."));
    if (a && a.galat) w.appendChild(el("div", "aleta-ptj-galat", a.galat));
    if (!a || !a.butir.length) {
      w.appendChild(el("div", "aleta-ptj-ket", a ? "Belum ada BAS atau tundaan terjadwal." : "Membaca antrean…"));
      return;
    }
    const tabel = el("table", "aleta-ptj-tabel");
    const tb = el("tbody");
    for (const b of a.butir) {
      const tr = el("tr");
      tr.setAttribute("data-stj-butir", b.id);
      const td1 = el("td");
      td1.append(el("div", "aleta-ptj-nomor", b.nomorPerkara), el("div", "aleta-ptj-ket", `${b.jenis === "bas" ? "BAS" : "Tunda"} · ${sebutTanggal(String(b.waktuWita || "").slice(0, 10))} ${String(b.waktuWita || "").slice(11, 16)} WITA`));
      const td2 = el("td");
      const st = String(b.status || "");
      const chip = el("span", `aleta-ptj-chip aleta-ptj-c-${NADA_STATUS[st] || "lewat"}`, b.namaStatus || NAMA_STATUS[st] || st);
      chip.setAttribute("data-stj-status", st);
      td2.appendChild(chip);
      const ket = [b.hasilRingkas, b.berkasNama, b.ringkasMuatan, b.dibuatNama ? `oleh ${b.dibuatNama}` : ""].filter(Boolean).join(" · ");
      if (ket) td2.appendChild(el("div", "aleta-ptj-ket", ket));
      const td3 = el("td");
      const aksi = el("div", "aleta-ptj-aksi-baris");
      if (b.bolehBatal && st === "menunggu") {
        const batal = tombol("Batal", "aleta-ptj-sekunder");
        batal.setAttribute("data-stj-aksi", `batal:${b.id}`);
        batal.addEventListener("click", () => void aksiButir("batal", b.id));
        aksi.appendChild(batal);
      }
      if (b.bolehBatal && ["menunggu", "gagal", "kedaluwarsa", "dibatalkan"].includes(st)) {
        const ulang = tombol("Jadwal ulang", "aleta-ptj-sekunder");
        ulang.setAttribute("data-stj-aksi", `jadwal-ulang:${b.id}`);
        ulang.addEventListener("click", () => {
          S.jadwalUlang = S.jadwalUlang === b.id ? null : b.id;
          gambarAntrean();
        });
        aksi.appendChild(ulang);
      }
      if (b.bolehBatal && st === "gagal") {
        const coba = tombol("Ulangi", "aleta-ptj-sekunder");
        coba.setAttribute("data-stj-aksi", `ulang:${b.id}`);
        coba.addEventListener("click", () => void aksiButir("ulang", b.id));
        aksi.appendChild(coba);
      }
      td3.appendChild(aksi);
      if (S.jadwalUlang === b.id) {
        const tgl = masukan("date", String(b.waktuWita || "").slice(0, 10), { "aria-label": "Tanggal baru", "data-stj": "ulang-tanggal" });
        const jam = masukan("time", String(b.waktuWita || "").slice(11, 16), { "aria-label": "Jam baru", "data-stj": "ulang-jam" });
        const simpan = tombol("Simpan jadwal baru", "aleta-ptj-utama");
        simpan.setAttribute("data-stj-aksi", `simpan-ulang:${b.id}`);
        simpan.addEventListener("click", () => void aksiButir("jadwal-ulang", b.id, { wita: `${tgl.value} ${jam.value}` }));
        const baris = el("div", "aleta-ptj-baris-aksi");
        baris.append(tgl, jam, simpan);
        td3.appendChild(baris);
      }
      tr.append(td1, td2, td3);
      tb.appendChild(tr);
    }
    tabel.appendChild(tb);
    w.appendChild(tabel);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tombol dan pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  function aktifSekarang() {
    return nyala && !modeLama();
  }
  let nyala = true;

  function tabTersedia() {
    const hasil = [];
    if (bolehBas()) hasil.push("bas");
    if (bolehTunda()) hasil.push("tunda");
    return hasil;
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Lencana: butir yang menunggu atau sedang dikerjakan, per tombol
  // ──────────────────────────────────────────────────────────────────────────
  const lencanaTerakhir = { bas: 0, tunda: 0 };
  function judulLencana(tab) {
    const n = lencanaTerakhir[tab] || 0;
    return n ? `${n} ${tab === "bas" ? "unggah BAS" : "penundaan"} menunggu atau sedang dikerjakan server` : "";
  }
  /** Murni: ringkasan server -> { bas, tunda } (menunggu + sedang dikerjakan). */
  function hitungLencana(ringkasan) {
    const dari = (j) => (ringkasan && ringkasan[j] ? (Number(ringkasan[j].menunggu) || 0) + (Number(ringkasan[j].jalan) || 0) : 0);
    return { bas: dari("bas"), tunda: dari("tunda") };
  }
  function perbaruiLencana(ringkasan) {
    const n = hitungLencana(ringkasan);
    lencanaTerakhir.bas = n.bas;
    lencanaTerakhir.tunda = n.tunda;
    for (const e of Array.from(document.querySelectorAll(".aleta-stj-lencana"))) {
      const tab = e.getAttribute("data-stj-lencana") === "tunda" ? "tunda" : "bas";
      e.textContent = String(lencanaTerakhir[tab]);
      e.hidden = lencanaTerakhir[tab] === 0;
      e.title = judulLencana(tab);
    }
  }
  /** Satu GET ringan (hanya hitungan, satu baris daftar); tidak dikerjakan bila tombolnya tidak ada di halaman. */
  async function bacaLencana() {
    if (!aktifSekarang() || !document.querySelector(".aleta-stj-tombol")) return;
    const r = await ambilJson(`${API.dasar}?aktif=1&batas=1&ringkas=1`, { credentials: "include", cache: "no-store" }, "Membaca antrean");
    if (r.ok && r.data && r.data.ringkasan) perbaruiLencana(r.data.ringkasan);
  }
  function klikTombol(tab, tempat) {
    if (!S) return;
    if (S.terbuka && S.tab === tab) S.terbuka = false;
    else {
      S.terbuka = true;
      S.tab = tab;
      S.konfirm = false;
      if (!S.sidangDimuat && !S.memuat) void muatSidang();
    }
    ingatTerbuka(kunciPanel(S.mode, S.nomor, S.tempat), S.terbuka);
    pasangPanel(tempat);
    gambarSemua();
  }
  function buatTombol(tab) {
    const b = tombol("", "btn btn-sm aleta-stj-tombol");
    b.id = `aleta-stj-tombol-${tab}`;
    b.setAttribute("data-stj", `tombol-${tab}`);
    b.setAttribute("aria-controls", ID_PANEL);
    b.append(el("span", "aleta-stj-ikon", "⏱"), tab === "bas" ? " Jadwalkan BAS " : " Jadwalkan Tunda ");
    // Lencana jumlah butir menunggu/sedang dikerjakan; kelasnya SENDIRI (bukan aleta-ptj-lencana milik Jadwalkan Putusan).
    const lencana = el("span", "aleta-stj-lencana", String(lencanaTerakhir[tab] || 0));
    lencana.setAttribute("data-stj-lencana", tab);
    lencana.hidden = !lencanaTerakhir[tab];
    lencana.title = judulLencana(tab);
    b.appendChild(lencana);
    return b;
  }
  /** Mengisi wadah dengan tombol sesuai hak; pulang daftar tab yang tampil. */
  function isiTombol(wadah, tempat) {
    const tab = tabTersedia();
    for (const t of ["bas", "tunda"]) {
      const ada = wadah.querySelector(`[data-stj="tombol-${t}"]`);
      if (tab.includes(t) && !ada) {
        const b = buatTombol(t);
        b.addEventListener("click", () => klikTombol(t, tempat));
        wadah.appendChild(b);
      } else if (!tab.includes(t) && ada) ada.remove();
    }
    for (const b of wadah.querySelectorAll("button")) b.setAttribute("aria-expanded", S && S.terbuka && b.getAttribute("data-stj") === `tombol-${S.tab}` ? "true" : "false");
    return tab;
  }

  function pasangTombolPerkara(tr) {
    let td = tr.querySelector(":scope > .aleta-stj-sel");
    if (!td) td = el("td", `${KELAS} aleta-stj-sel`);
    const tab = isiTombol(td, "perkara");
    if (!tab.length) {
      td.remove();
      return false;
    }
    if (td.parentElement !== tr) {
      const l1 = tr.querySelector(":scope > .aleta-l1-submenu");
      tr.insertBefore(td, l1 || null);
    }
    if (typeof alatUrutkanTombolSipp === "function") alatUrutkanTombolSipp(tr);
    return true;
  }
  function pasangPanel(tempat) {
    const ada = document.getElementById(ID_PANEL);
    if (!S.akar || !ada) {
      if (ada) ada.remove();
      const akar = buatKerangka();
      if (tempat === "perkara") {
        const tr = barisTombol(document);
        const tabel = tr && (tr.closest("table#submenus") || tr.closest("table"));
        const jangkar = document.getElementById("aleta-ptj-panel") || document.getElementById("aleta-pusipp-panel") || document.getElementById("aleta-pensipp-panel") || tabel;
        if (jangkar && jangkar.parentNode) jangkar.parentNode.insertBefore(akar, jangkar.nextSibling);
        else document.body.appendChild(akar);
      } else {
        const j = jangkarMassal(S.tempat);
        if (j && j.panelSebelum) j.panelSebelum.parentNode.insertBefore(akar, j.panelSebelum);
        else if (j && j.panelSesudah && j.panelSesudah.parentNode) j.panelSesudah.parentNode.insertBefore(akar, j.panelSesudah.nextSibling);
        else document.body.appendChild(akar);
      }
      gambarSemua();
      if (!S.sidangDimuat && !S.memuat && S.terbuka && S.tab !== "antrean") void muatSidang();
    }
    S.akar.hidden = !S.terbuka;
    sinkronModal();
  }
  /** Pop-up di tengah layar (popup-aksi.js); awalan kunci "sidangjadwal:" berbeda dari "jadwal:" milik Jadwalkan Putusan. */
  function sinkronModal() {
    const m = globalThis.aletaPopupAksi;
    if (!m || !S || !S.akar) return;
    const kunci = kunciPanel(S.mode, S.nomor, S.tempat);
    m.atur(`sidangjadwal:${kunci}`, S.akar, S.terbuka, {
      judul: S.mode === "perkara" ? `Jadwalkan BAS / Tunda · ${S.nomor}` : "Jadwalkan BAS / Tunda Massal",
      sibuk: () => Boolean(S && S.sibuk),
      saatTutup: () => {
        if (!S || kunciPanel(S.mode, S.nomor, S.tempat) !== kunci) return;
        S.terbuka = false;
        ingatTerbuka(kunci, false);
        for (const b of document.querySelectorAll(".aleta-stj-tombol")) b.setAttribute("aria-expanded", "false");
      },
    });
  }

  function jangkarMassal(tempat) {
    if (tempat === "dashboard") {
      const h1 = judulDashboard(document);
      return h1 ? { tombol: h1, tombolDi: "dalam", panelSesudah: h1.closest("section") || h1 } : null;
    }
    const cetak = document.getElementById("cetak_perkara_list");
    if (!cetak) return null;
    const halaman = document.getElementById("pages");
    return { tombol: cetak, tombolDi: "sesudah", panelSebelum: halaman && halaman.parentNode ? halaman : null, panelSesudah: cetak.closest("#left") || cetak };
  }
  function pasangTombolMassal(tempat) {
    const j = jangkarMassal(tempat);
    if (!j) return false;
    let wadah = document.getElementById(ID_MASSAL);
    if (!wadah) {
      wadah = el("span", `${KELAS} aleta-ptj-massal aleta-stj-massal`);
      wadah.id = ID_MASSAL;
    }
    if (!isiTombol(wadah, tempat).length) {
      wadah.remove();
      return false;
    }
    // Letak: sesudah tombol Jadwalkan Putusan Massal bila ada, kalau tidak langsung sesudah tombol Cetak / di dalam judul dashboard.
    const putusan = document.getElementById("aleta-ptj-massal");
    if (j.tombolDi === "dalam") {
      if (wadah.parentNode !== j.tombol) j.tombol.appendChild(wadah);
    } else {
      const acuan = putusan && putusan.parentNode === j.tombol.parentNode ? putusan : j.tombol;
      if (wadah.previousElementSibling !== acuan || wadah.parentNode !== acuan.parentNode) acuan.parentNode.insertBefore(wadah, acuan.nextSibling);
    }
    return true;
  }

  function bersihkan(doc) {
    const d = doc || document;
    if (globalThis.aletaPopupAksi) globalThis.aletaPopupAksi.lepas("sidangjadwal:");
    for (const e of Array.from(d.querySelectorAll(".aleta-stj"))) e.remove();
    S = null;
  }

  /** Satu putaran pemasangan. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang() || !tabTersedia().length) {
      if (d.querySelector(".aleta-stj") && !(S && S.sibuk)) bersihkan(d);
      return { tombol: false, panel: false, mode: "", tab: [] };
    }
    const tempat = tempatHalaman(d);
    const mode = tempat === "perkara" ? "perkara" : tempat ? "daftar" : "";
    if (!mode) {
      if (d.querySelector(".aleta-stj") && !(S && S.sibuk)) bersihkan(d);
      return { tombol: false, panel: false, mode: "", tab: [] };
    }
    const nomor = mode === "perkara" ? nomorHalaman(d) : "";
    if (!S || S.mode !== mode || S.nomor !== nomor || S.tempat !== tempat) {
      if (d.querySelector(".aleta-stj")) bersihkan(d);
      S = keadaanBaru(mode, nomor, tempat);
      S.tab = tabTersedia()[0];
      S.terbuka = terbukaTersimpan(kunciPanel(mode, nomor, tempat));
    }
    let ada;
    if (mode === "perkara") {
      const tr = barisTombol(d);
      ada = tr ? pasangTombolPerkara(tr) : false;
    } else ada = pasangTombolMassal(tempat);
    if (!ada) return { tombol: false, panel: false, mode, tempat, tab: [] };
    if (S.terbuka || S.akar) pasangPanel(mode === "perkara" ? "perkara" : tempat);
    return { tombol: true, panel: Boolean(S.akar && !S.akar.hidden), mode, tempat, tab: tabTersedia() };
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
    }, 1500);
    // Lencana tombol: satu GET ringan tiap 60 detik (pola yang sama dengan Jadwalkan Putusan) dan sekali di awal.
    (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.interval : (f, m) => setInterval(f, m))(() => void bacaLencana(), 60000);
    setTimeout(() => void bacaLencana(), 4000);
    // Antrean yang terbuka disegarkan tiap 30 detik agar status terbaru tampak tanpa menekan apa pun.
    (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.interval : (f, m) => setInterval(f, m))(() => {
      if (S && S.akar && !S.akar.hidden && S.tab === "antrean" && !S.sibuk) void muatAntrean();
    }, 30000);
  }

  async function mulai() {
    try {
      try {
        const s = await chrome.storage.local.get(["aktif"]);
        nyala = !s || s.aktif !== false;
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

  globalThis.aletaSidangTerjadwal = {
    versi: "sidang-terjadwal-27okt-1",
    pasang,
    bersihkan,
    keadaan: () => S,
    muatSidang,
    muatAntrean,
    bacaLencana,
    lencana: () => ({ ...lencanaTerakhir }),
    muatUsulan,
    tambahBerkas,
    kirimJadwal,
    murni: { hitungLencana, bolehBas, bolehTunda, tempatHalaman, nomorDariNama, tandaBukanBas, witaDari },
  };
  void mulai();
})();
