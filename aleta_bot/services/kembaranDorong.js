"use strict";

/**
 * ============================================================================
 * DORONG ANTREAN KE SERVER - HANYA YANG AMAN, HANYA YANG DISETUJUI
 * ============================================================================
 *
 * Alur satu baris antrean:
 *
 *   dicatat (menunggu)
 *     -> periksa : dibandingkan dengan nilai TERKINI di server (kembaranBentrok)
 *                  hasil aman | bentrok | ditahan | tak_dapat_diperiksa
 *     -> setujui : Super Admin, per baris atau per kelompok; hanya yang "aman"
 *     -> kirim   : diperiksa LAGI saat itu juga, lalu dijalankan di server
 *                  - SATU TRANSAKSI per kelompok per basis data;
 *                  - SQL persis seperti yang dicatat (aktor dan jam aslinya tidak
 *                    disentuh); satu-satunya penggantian: nomor urut "semu"
 *                    insertId -> nomor sungguhan dari baris induk di kelompok yang sama;
 *                  - UPDATE/DELETE wajib mengenai TEPAT sebanyak baris yang dicuplik,
 *                    kalau tidak transaksi dibatalkan;
 *                  - berkas tiba lebih dulu dari barisnya dan tidak pernah menimpa.
 *
 * Tidak ada tombol "paksa": baris bentrok atau ditahan tidak punya jalan keluar
 * selain ditolak (disingkirkan) atau diperbaiki dengan tangan di server.
 *
 * Semua kemampuan server disuntikkan (`server`) sehingga logikanya dapat diuji
 * tanpa server sungguhan. serverNyata() di bawah adalah satu-satunya bagian yang
 * menyentuh MySQL server dan ssh - dan ia menolak bekerja bila tujuannya ternyata
 * basis data laptop sendiri.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const mysql = require("mysql");

const B = require("./kembaranBentrok");
const antreanModul = require("./kembaranAntrean");

// ---------------------------------------------------------------------------
// Inti (tanpa I/O langsung)
// ---------------------------------------------------------------------------

function sekarangIso() {
  return new Date().toISOString();
}

/** Mengganti nomor urut semu insertId dengan nomor sungguhan pada SQL baris berikutnya di kelompok yang sama. */
function gantiIdSemu(sql, peta) {
  let hasil = String(sql);
  for (const [semu, nyata] of peta) {
    hasil = hasil.replace(new RegExp(`(?<![0-9A-Za-z_.])${semu}(?![0-9A-Za-z_.])`, "g"), String(nyata));
  }
  return hasil;
}

function urutkanKelompok(baris) {
  return [...baris].sort((a, b) => (a.urutan - b.urutan) || (a.id - b.id));
}

function kelompokkan(baris) {
  const peta = new Map();
  for (const b of baris) {
    if (!peta.has(b.kelompok)) peta.set(b.kelompok, []);
    peta.get(b.kelompok).push(b);
  }
  return [...peta.values()].sort((x, y) => Math.min(...x.map((b) => b.id)) - Math.min(...y.map((b) => b.id)));
}

function buatDorong({ penyimpan, server, catat = () => {}, mengandungAleta = null }) {
  let sedangKirim = false;

  const ctx = () => ({
    bacaServer: (sumber, sql) => server.bacaServer(sumber, sql),
    kunciServer: (sumber, skema, tabel) => server.kunciServer(sumber, skema, tabel),
    mengandungAleta,
    skemaSah: server.skemaSah ? (sumber, skema) => server.skemaSah(sumber, skema) : undefined,
    periksaBerkas: server.periksaBerkas ? (b) => server.periksaBerkas(b) : undefined,
  });

  async function periksaSatu(b) {
    let h;
    try {
      h = await B.periksaBaris(b, ctx());
    } catch (g) {
      h = { hasil: "tak_dapat_diperiksa", alasan: [`Pemeriksaan gagal: ${String((g && g.message) || g).slice(0, 160)}`], catatan: [] };
    }
    // Tulisan tanpa permintaan HTTP (pekerjaan terjadwal, atau konteks permintaan hilang di callback murni):
    // tetap dapat disetujui, tetapi penyetuju diingatkan memeriksa maksudnya.
    if (h.hasil === "aman" && !b.operasi && b.jenis !== "BERKAS_TULIS" && b.jenis !== "BERKAS_PINDAH") {
      h.catatan = [...(h.catatan || []), "Dicatat di luar permintaan petugas (pekerjaan terjadwal atau konteks permintaan hilang): periksa maksudnya sebelum menyetujui."];
    }
    return h;
  }

  /** Periksa baris yang belum selesai (menunggu / disetujui), atau hanya `ids`. */
  async function periksa({ ids = null } = {}) {
    let baris;
    if (ids && ids.length) baris = (await penyimpan.ambil(ids.map(Number))).filter((b) => b.status === "menunggu" || b.status === "disetujui");
    else baris = await penyimpan.daftar({ status: ["menunggu", "disetujui"], batas: 2000 });
    const ringkas = { aman: 0, bentrok: 0, ditahan: 0, tak_dapat_diperiksa: 0 };
    for (const b of baris) {
      const h = await periksaSatu(b);
      ringkas[h.hasil] = (ringkas[h.hasil] || 0) + 1;
      const patch = { hasil: h.hasil, periksa: { pada: sekarangIso(), alasan: h.alasan, catatan: h.catatan } };
      // Persetujuan yang dasarnya sudah tidak aman gugur.
      if (b.status === "disetujui" && h.hasil !== "aman") {
        patch.status = "menunggu";
        patch.disetujuiOleh = null;
        patch.disetujuiPada = null;
      }
      await penyimpan.ubah(b.id, patch);
    }
    return { diperiksa: baris.length, ringkas };
  }

  /** Menyetujui baris (ids) dan/atau semua baris satu kelompok. Hanya yang menunggu dan "aman". */
  async function setujui({ ids = [], kelompok = null, oleh }) {
    if (!oleh) throw new Error("Penyetuju harus disebut.");
    let baris = [];
    if (ids.length) baris = baris.concat(await penyimpan.ambil(ids.map(Number)));
    if (kelompok) baris = baris.concat(await penyimpan.daftar({ kelompok, batas: 5000 }));
    const unik = new Map(baris.map((b) => [b.id, b]));
    const dipilih = [...unik.values()];
    const ditolak = [];
    const disetujui = [];
    // Per kelompok: bila yang dipilih satu kelompok utuh, semuanya harus aman (tidak sebagian).
    for (const b of dipilih) {
      if (b.status !== "menunggu") {
        ditolak.push({ id: b.id, alasan: `Status ${b.status}, bukan menunggu.` });
        continue;
      }
      if (b.hasil !== "aman") {
        ditolak.push({ id: b.id, alasan: b.hasil ? `Hasil pemeriksaan: ${b.hasil}.` : "Belum diperiksa terhadap server." });
        continue;
      }
      disetujui.push(b);
    }
    if (kelompok && ditolak.length) {
      // Persetujuan per kelompok bersifat semua-atau-tidak sama sekali.
      return { disetujui: 0, ditolak, kelompokUtuh: false };
    }
    for (const b of disetujui) {
      await penyimpan.ubah(b.id, { status: "disetujui", disetujuiOleh: oleh, disetujuiPada: sekarangIso() });
    }
    catat("kembaran_disetujui", { oleh, jumlah: disetujui.length, kelompok: kelompok || null, ids: disetujui.map((b) => b.id).slice(0, 50) });
    return { disetujui: disetujui.length, ditolak };
  }

  /** Menyingkirkan baris (tidak akan dikirim). Boleh dari status menunggu / disetujui / gagal. */
  async function tolak({ ids = [], kelompok = null, oleh, alasan = "" }) {
    if (!oleh) throw new Error("Pelaku harus disebut.");
    let baris = [];
    if (ids.length) baris = baris.concat(await penyimpan.ambil(ids.map(Number)));
    if (kelompok) baris = baris.concat(await penyimpan.daftar({ kelompok, batas: 5000 }));
    const unik = new Map(baris.map((b) => [b.id, b]));
    let n = 0;
    for (const b of unik.values()) {
      if (b.status === "terkirim" || b.status === "ditolak") continue;
      await penyimpan.ubah(b.id, { status: "ditolak", ditolakOleh: oleh, ditolakPada: sekarangIso(), alasanTolak: String(alasan).slice(0, 300) });
      n += 1;
    }
    catat("kembaran_ditolak", { oleh, jumlah: n, kelompok: kelompok || null });
    return { ditolak: n };
  }

  async function kirimKelompok(baris, oleh) {
    const urut = urutkanKelompok(baris);
    // 1. Pemeriksaan ulang di saat kirim - semuanya, sebelum satu pun ditulis.
    const gagalPeriksa = [];
    for (const b of urut) {
      const h = await periksaSatu(b);
      await penyimpan.ubah(b.id, { hasil: h.hasil, periksa: { pada: sekarangIso(), alasan: h.alasan, catatan: h.catatan } });
      if (h.hasil !== "aman") gagalPeriksa.push({ id: b.id, hasil: h.hasil, alasan: h.alasan });
    }
    if (gagalPeriksa.length) {
      for (const b of urut) {
        await penyimpan.ubah(b.id, { status: "menunggu", disetujuiOleh: null, disetujuiPada: null });
      }
      return { kelompok: urut[0].kelompok, terkirim: 0, dibatalkan: true, sebab: gagalPeriksa };
    }

    // 2. Jalankan.
    const sesi = new Map(); // sumber -> sesi transaksi
    const peta = new Map(); // nomor semu -> nomor sungguhan
    const berkasDibuat = [];
    const berkasDipindah = [];
    let barisSekarang = null;
    try {
      for (const b of urut) {
        barisSekarang = b;
        if (b.jenis === "BERKAS_TULIS") {
          await server.kirimBerkas(b);
          berkasDibuat.push(b);
          continue;
        }
        if (b.jenis === "BERKAS_PINDAH") {
          await server.pindahBerkas(b);
          berkasDipindah.push(b);
          continue;
        }
        if (!sesi.has(b.sumber)) {
          const s = await server.mulaiTransaksi(b.sumber);
          sesi.set(b.sumber, s);
        }
        const sql = gantiIdSemu(b.sql, peta);
        const hasil = await sesi.get(b.sumber).query(sql);
        if ((b.jenis === "UPDATE" || b.jenis === "DELETE") && b.cuplikan && b.cuplikan.status === "lengkap") {
          const harapan = (b.cuplikan.baris || []).length;
          if (Number(hasil && hasil.affectedRows) !== harapan) {
            throw new Error(`Mengenai ${hasil && hasil.affectedRows} baris, seharusnya ${harapan}. Dibatalkan.`);
          }
        }
        if ((b.jenis === "INSERT" || b.jenis === "REPLACE") && b.insertIdSemu && hasil && Number(hasil.insertId) > 0) {
          peta.set(b.insertIdSemu, Number(hasil.insertId));
        }
      }
      for (const s of sesi.values()) await s.komit();
    } catch (g) {
      for (const s of sesi.values()) await s.batal().catch(() => undefined);
      for (const b of berkasDipindah.reverse()) await server.batalkanPindah(b).catch(() => undefined);
      for (const b of berkasDibuat.reverse()) await server.batalkanBerkas(b).catch(() => undefined);
      const pesan = String((g && g.message) || g).slice(0, 300);
      for (const b of urut) {
        if (barisSekarang && b.id === barisSekarang.id) {
          await penyimpan.ubah(b.id, { status: "gagal", galat: pesan, disetujuiOleh: null });
        } else {
          await penyimpan.ubah(b.id, { status: "menunggu", hasil: null, disetujuiOleh: null, disetujuiPada: null, catatan: `Kelompok dibatalkan karena baris #${barisSekarang ? barisSekarang.id : "?"} gagal.` });
        }
      }
      catat("kembaran_kirim_gagal", { oleh, kelompok: urut[0].kelompok, barisGagal: barisSekarang && barisSekarang.id, pesan });
      return { kelompok: urut[0].kelompok, terkirim: 0, gagal: true, galat: pesan, barisGagal: barisSekarang && barisSekarang.id };
    } finally {
      for (const s of sesi.values()) await Promise.resolve(s.tutup()).catch(() => undefined);
    }

    const waktu = sekarangIso();
    for (const b of urut) {
      await penyimpan.ubah(b.id, { status: "terkirim", dikirimPada: waktu, dikirimOleh: oleh, galat: null });
    }
    catat("kembaran_terkirim", { oleh, kelompok: urut[0].kelompok, jumlah: urut.length, aktorAsli: [...new Set(urut.map((b) => b.aktor).filter(Boolean))] });
    return { kelompok: urut[0].kelompok, terkirim: urut.length };
  }

  /** Mengirim SEMUA baris berstatus disetujui, kelompok demi kelompok. */
  async function kirim({ oleh }) {
    if (!oleh) throw new Error("Pengirim harus disebut.");
    if (sedangKirim) throw new Error("Pengiriman lain sedang berjalan.");
    sedangKirim = true;
    try {
      const baris = await penyimpan.daftar({ status: "disetujui", batas: 5000 });
      const hasil = [];
      for (const kel of kelompokkan(baris)) {
        hasil.push(await kirimKelompok(kel, oleh));
      }
      return {
        kelompok: hasil.length,
        terkirim: hasil.reduce((n, h) => n + (h.terkirim || 0), 0),
        dibatalkan: hasil.filter((h) => h.dibatalkan || h.gagal).length,
        rincian: hasil,
      };
    } finally {
      sedangKirim = false;
    }
  }

  return { periksa, setujui, tolak, kirim, _kirimKelompok: kirimKelompok };
}

// ---------------------------------------------------------------------------
// Server nyata (MySQL server kantor lewat terowongan ssh, dan ssh untuk berkas)
// ---------------------------------------------------------------------------

function konfigurasiServer(sumber, env = process.env) {
  const nama = {
    sipp: env.ALETA_KEMBARAN_SERVER_DB_SIPP_NAME || "SIPP",
    abt: env.ALETA_KEMBARAN_SERVER_DB_ABT_NAME || "aps_badilag",
    antrian: env.ALETA_KEMBARAN_SERVER_DB_ANTRIAN_NAME || "sipp_turunan_antrian",
  }[sumber];
  return {
    host: env.ALETA_KEMBARAN_SERVER_DB_HOST || "127.0.0.1",
    port: Number(env.ALETA_KEMBARAN_SERVER_DB_PORT || 33306),
    user: env.ALETA_KEMBARAN_SERVER_DB_USER || "",
    password: env.ALETA_KEMBARAN_SERVER_DB_PASSWORD || "",
    database: nama || "",
  };
}

/** Konfigurasi lokal (basis data laptop) untuk memastikan "server" bukan laptop sendiri. */
function konfigurasiLokal(sumber, env = process.env) {
  const host = env.ALETA_BOT_DB_SIPP_HOST || env.ALETA_BOT_DB_HOST || "localhost";
  const port = Number(env.ALETA_BOT_DB_SIPP_PORT || env.ALETA_BOT_DB_PORT || 3306);
  const nama = {
    sipp: env.ALETA_BOT_DB_SIPP_NAME || "SIPP",
    abt: env.ALETA_BOT_DB_APS_NAME || env.ALETA_BOT_DB5_NAME || "aps_badilag",
    antrian: env.ALETA_BOT_DB_ANTRIAN_NAME || env.ALETA_BOT_DB4_NAME || "sipp_turunan_antrian",
  }[sumber];
  return { host, port, database: nama };
}

function samaTujuan(a, b) {
  const lokalHost = (h) => (h === "localhost" || h === "::1" ? "127.0.0.1" : h);
  return lokalHost(a.host) === lokalHost(b.host) && Number(a.port) === Number(b.port) && String(a.database).toLowerCase() === String(b.database).toLowerCase();
}

/** Penolakan dini: tujuan tidak lengkap, atau - yang berbahaya - sama dengan basis data laptop. */
function periksaTujuan(sumber, env = process.env) {
  const s = konfigurasiServer(sumber, env);
  if (!s.database) throw new Error(`Sumber "${sumber}" tidak punya tujuan di server (hanya sipp, abt, antrian).`);
  if (!s.user) throw new Error("ALETA_KEMBARAN_SERVER_DB_USER belum diisi - sambungan ke MySQL server belum diatur.");
  if (samaTujuan(s, konfigurasiLokal(sumber, env))) {
    throw new Error(
      `DITOLAK: tujuan server (${s.host}:${s.port}/${s.database}) sama dengan basis data laptop. Atur terowongan ssh ke MySQL server pada port berbeda (mis. 33306).`
    );
  }
  return s;
}

function kutipSh(teks) {
  return `'${String(teks).replace(/'/g, `'\\''`)}'`;
}

function jalurServerAman(relatif) {
  const r = String(relatif || "");
  if (!r || r.startsWith("/") || r.split("/").some((b) => b === ".." || b === "") || !/^[A-Za-z0-9_\-./ ]+$/.test(r)) {
    throw new Error(`Jalur berkas tidak aman: ${r}`);
  }
  return r;
}

function jalankanSsh(alias, perintah, { stdin = null, waktuMaks = 120000 } = {}) {
  return new Promise((ok, no) => {
    const anak = execFile(process.env.ALETA_KEMBARAN_SSH_EXE || "ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", alias, perintah], { timeout: waktuMaks, windowsHide: true, maxBuffer: 1 << 20 }, (g, out, err) => {
      if (g) return no(new Error(`ssh gagal: ${String(err || g.message).trim().slice(-300)}`));
      return ok(String(out).trim());
    });
    if (stdin && anak.stdin) {
      fs.createReadStream(stdin).on("error", no).pipe(anak.stdin);
    } else if (anak.stdin) {
      anak.stdin.end();
    }
  });
}

function serverNyata(env = process.env) {
  const kolam = new Map();
  const alias = env.ALETA_KEMBARAN_SSH_ALIAS || "aleta";
  const akarSipp = String(env.ALETA_KEMBARAN_SERVER_SIPP_ROOT || "/var/www/html/SIPP").replace(/\/+$/, "");
  const cacheKunci = new Map();

  function kolamUntuk(sumber) {
    if (kolam.has(sumber)) return kolam.get(sumber);
    const s = periksaTujuan(sumber, env);
    const p = mysql.createPool({
      host: s.host,
      port: s.port,
      user: s.user,
      password: s.password,
      database: s.database,
      charset: "utf8mb4",
      connectionLimit: 2,
      connectTimeout: 8000,
      multipleStatements: false,
    });
    kolam.set(sumber, p);
    return p;
  }

  function tanya(sumber, sql) {
    return new Promise((ok, no) => {
      kolamUntuk(sumber).query(sql, (g, r) => (g ? no(g) : ok(r)));
    });
  }

  function jalurPenuh(relatif) {
    return `${akarSipp}/${jalurServerAman(relatif)}`;
  }

  return {
    bacaServer(sumber, sql) {
      if (!/^\s*(SELECT|SHOW)\b/i.test(sql)) return Promise.reject(new Error("bacaServer hanya untuk SELECT/SHOW."));
      return tanya(sumber, sql);
    },
    async kunciServer(sumber, skema, tabel) {
      const k = `${sumber}|${skema}|${tabel}`.toLowerCase();
      const ada = cacheKunci.get(k);
      if (ada && Date.now() - ada.pada < 10 * 60 * 1000) return ada.nilai;
      const nilai = await B.kunciTabel((sql) => tanya(sumber, sql), skema, tabel);
      if (nilai.terbaca) cacheKunci.set(k, { pada: Date.now(), nilai });
      return nilai;
    },
    skemaSah(sumber, skema) {
      const s = konfigurasiServer(sumber, env);
      const l = konfigurasiLokal(sumber, env);
      const sah = new Set([s.database, l.database, "sipp_turunan_antrian"].map((x) => String(x).toLowerCase()));
      return sah.has(String(skema).toLowerCase());
    },
    async mulaiTransaksi(sumber) {
      const pool = kolamUntuk(sumber);
      const conn = await new Promise((ok, no) => pool.getConnection((g, c) => (g ? no(g) : ok(c))));
      const q = (sql) => new Promise((ok, no) => conn.query(sql, (g, r) => (g ? no(g) : ok(r))));
      await q("SET NAMES utf8mb4");
      await new Promise((ok, no) => conn.beginTransaction((g) => (g ? no(g) : ok())));
      return {
        query: (sql) => q(sql),
        komit: () => new Promise((ok, no) => conn.commit((g) => (g ? no(g) : ok()))),
        batal: () => new Promise((ok) => conn.rollback(() => ok())),
        tutup: () => conn.release(),
      };
    },
    async periksaBerkas(b) {
      const fileLokal = b.berkas && b.berkas.simpan;
      try {
        if (b.jenis === "BERKAS_TULIS") {
          if (!fileLokal || !fs.existsSync(fileLokal)) return { hasil: "ditahan", alasan: ["Berkas di folder antrean laptop hilang."], catatan: [] };
          const sha = crypto.createHash("sha256").update(fs.readFileSync(fileLokal)).digest("hex");
          if (sha !== b.berkas.sha256) return { hasil: "ditahan", alasan: ["Isi berkas di folder antrean laptop berubah dari yang dicatat (SHA-256 beda)."], catatan: [] };
          const p = jalurPenuh(b.berkas.relatif);
          const jawab = await jalankanSsh(alias, `test -e ${kutipSh(p)} && echo ADA || echo TIDAK`);
          if (jawab === "ADA") return { hasil: "bentrok", alasan: ["Berkas dengan nama yang sama sudah ada di folder SIPP server. Tidak ditimpa."], catatan: [] };
          return { hasil: "aman", alasan: [], catatan: [] };
        }
        const dari = jalurPenuh(b.berkas.dariRelatif);
        const ke = jalurPenuh(b.berkas.keRelatif);
        const jawab = await jalankanSsh(alias, `{ test -e ${kutipSh(dari)} && echo ADA; } ; { test -e ${kutipSh(ke)} && echo TUJUAN_ADA; } ; true`);
        if (!/ADA/.test(jawab) || /TUJUAN_ADA/.test(jawab)) {
          return { hasil: "bentrok", alasan: [/TUJUAN_ADA/.test(jawab) ? "Tujuan pemindahan sudah ada di server." : "Berkas yang akan dipindah tidak ada di server."], catatan: [] };
        }
        return { hasil: "aman", alasan: [], catatan: [] };
      } catch (g) {
        return { hasil: "tak_dapat_diperiksa", alasan: [`Server tidak terjangkau lewat ssh: ${String((g && g.message) || g).slice(0, 160)}`], catatan: [] };
      }
    },
    async kirimBerkas(b) {
      const p = jalurPenuh(b.berkas.relatif);
      const sha = b.berkas.sha256;
      if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error("SHA-256 berkas tidak sah.");
      const skrip = [
        "set -e",
        `P=${kutipSh(p)}`,
        'D=$(dirname "$P")',
        'mkdir -p "$D"',
        'T="$P.part-$$"',
        'cat > "$T"',
        `[ "$(sha256sum "$T" | cut -d' ' -f1)" = ${kutipSh(sha)} ] || { rm -f "$T"; echo SHA_BEDA; exit 3; }`,
        'chown --reference="$D" "$T" 2>/dev/null || true',
        'chmod "$(printf %o $(( 8#$(stat -c %a "$D") & 8#666 )))" "$T" 2>/dev/null || true',
        'ln "$T" "$P" || { rm -f "$T"; echo SUDAH_ADA; exit 4; }',
        'rm -f "$T"',
        "echo OK",
      ].join("; ");
      const jawab = await jalankanSsh(alias, `bash -c ${kutipSh(skrip)}`, { stdin: b.berkas.simpan, waktuMaks: 300000 });
      if (!/OK$/.test(jawab)) throw new Error(`Pengiriman berkas ${b.berkas.relatif} tidak selesai (${jawab.slice(-80)}).`);
    },
    async batalkanBerkas(b) {
      await jalankanSsh(alias, `rm -f ${kutipSh(jalurPenuh(b.berkas.relatif))}`);
    },
    async pindahBerkas(b) {
      const dari = jalurPenuh(b.berkas.dariRelatif);
      const ke = jalurPenuh(b.berkas.keRelatif);
      await jalankanSsh(alias, `mkdir -p ${kutipSh(path.posix.dirname(ke))} && mv -n ${kutipSh(dari)} ${kutipSh(ke)} && test -e ${kutipSh(ke)} && test ! -e ${kutipSh(dari)}`);
    },
    async batalkanPindah(b) {
      const dari = jalurPenuh(b.berkas.dariRelatif);
      const ke = jalurPenuh(b.berkas.keRelatif);
      await jalankanSsh(alias, `mv -n ${kutipSh(ke)} ${kutipSh(dari)}`);
    },
    async uji() {
      const hasil = {};
      for (const sumber of ["sipp", "abt", "antrian"]) {
        try {
          const r = await tanya(sumber, "SELECT 1 AS ok");
          hasil[sumber] = { ok: Boolean(r && r[0] && r[0].ok === 1) };
        } catch (g) {
          hasil[sumber] = { ok: false, galat: String((g && g.message) || g).slice(0, 160) };
        }
      }
      try {
        await jalankanSsh(alias, "echo ok", { waktuMaks: 20000 });
        hasil.ssh = { ok: true };
      } catch (g) {
        hasil.ssh = { ok: false, galat: String((g && g.message) || g).slice(0, 160) };
      }
      return hasil;
    },
    async tutup() {
      for (const p of kolam.values()) await new Promise((ok) => p.end(() => ok()));
      kolam.clear();
    },
  };
}

let bawaan = null;
/** Dorong bawaan: penyimpan MySQL laptop + server nyata + catatan sistem + jaring kata ALETA. */
function dorongBawaan() {
  if (!bawaan) {
    const logService = require("./logService");
    const penjagaTandaSipp = require("./penjagaTandaSipp");
    const server = serverNyata();
    bawaan = {
      server,
      dorong: buatDorong({
        penyimpan: antreanModul.dapatkan(),
        server,
        mengandungAleta: (sql) => penjagaTandaSipp.tulisanBocor(sql),
        catat: (aksi, metadata) => {
          void Promise.resolve(logService.logSystemEvent({ eventType: aksi, severity: "info", message: `Sinkron kembaran: ${aksi}`, metadata })).catch(() => undefined);
        },
      }),
    };
  }
  return bawaan;
}

module.exports = {
  buatDorong,
  gantiIdSemu,
  kelompokkan,
  urutkanKelompok,
  konfigurasiServer,
  konfigurasiLokal,
  periksaTujuan,
  jalurServerAman,
  serverNyata,
  dorongBawaan,
};
