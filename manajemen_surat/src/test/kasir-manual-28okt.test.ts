// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * KASIR ALETA 28 Okt 2026 - Kasir Manual (satu hari), lipatan, akun kasir, Riwayat
 * ============================================================================
 *
 *   1. USURAN     uraian "Biaya Panggilan Tergugat" tanpa resi tidak lagi berakhir "/"
 *   2. AKUN KASIR akun tulis = pengguna grup Kasir SIPP (satu / banyak / tidak ada / diblokir);
 *                 jurnal dan audit memakai akun kasir walau pemanggil "admin"; tanpa akun = nol tulisan
 *   3. RIWAYAT    jejak Kasir (format keterangan SAMA dengan yang ditulis susunRencana) -> baris riwayat
 *   4. PORTAL     rute: akun kasir ditampilkan, hanya Super Admin/admin memilih, Kasir Manual tanpa akun petugas
 *   5. EKSTENSI   lipatan bawaan + diingat + 0 -> ada dibuka lagi; tautan jurnal; Kasir Manual dapat disunting;
 *                 ikon (i) menggantikan keterangan teknis; Riwayat
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const otomatis = requireBot(path.join(AKAR, "aleta_bot/services/kasirOtomatisService.js"));
const akunKasirService = requireBot(path.join(AKAR, "aleta_bot/services/kasirAkunService.js"));
const NYATA = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-keadaan-nyata.json"), "utf8"));
const salin = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const keadaan = (kunci: string) => salin(NYATA.contoh[kunci][0].keadaan);
type Baris = Record<string, any>;

// ============================================================================
// 1. URAIAN TANPA GARIS MIRING MENGGANTUNG
// ============================================================================
describe("1. uraian biaya panggilan/pemberitahuan tanpa resi", () => {
  it("tidak satu pun usulan berakhir dengan garis miring, pada semua keadaan contoh", () => {
    for (const kunci of Object.keys(NYATA.contoh)) {
      for (const c of NYATA.contoh[kunci]) {
        const hasil = kasir.susunUsulan(salin(c.keadaan));
        for (const u of hasil.usulan) expect(String(u.uraian), `${kunci}: ${u.uraian}`).not.toMatch(/\/\s*$/);
      }
    }
  });

  it("Biaya Panggilan Tergugat tanpa relaas: uraian polos dan perluResi menyala (resi diketik kasir)", () => {
    const k = keadaan("baru-gugatan");
    k.relaas = []; // relaas Pos belum tercatat -> nomor resi belum ada
    const hasil = kasir.susunUsulan(k);
    const biaya = hasil.usulan.find((u: Baris) => /^Biaya Panggilan Tergugat/.test(u.uraian));
    expect(biaya).toBeTruthy();
    expect(biaya.uraian).toBe("Biaya Panggilan Tergugat");
    expect(biaya.perluResi).toBe(true);
  });

  it("dengan relaas Pos: tetap 'Biaya Panggilan Tergugat/<resi>'", () => {
    const k = keadaan("verstek");
    const hasil = kasir.susunUsulan({ ...k, jurnal: k.jurnal.filter((b: Baris) => ![14, 236, 237].includes(Number(b.jenisBiayaId))) });
    const dariResi = hasil.usulan.filter((u: Baris) => /^Biaya Panggilan .*\/P\d+/.test(u.uraian));
    expect(dariResi.length + k.jurnal.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 2. AKUN KASIR SIPP
// ============================================================================
function sippAkun(anggota: Baris[], pilihanAwal = "") {
  let pilihan = pilihanAwal;
  const kueri = async (sql: string, params: any[] = []) => {
    if (/FROM sys_users su JOIN sys_user_group ug/.test(sql)) {
      expect(params).toEqual([702]);
      return anggota;
    }
    throw new Error(`kueri SIPP tak terduga: ${sql.slice(0, 70)}`);
  };
  const kueriAleta = async (sql: string, params: any[] = []) => {
    if (/CREATE TABLE IF NOT EXISTS aleta_bot_kasir_akun/.test(sql)) return {};
    if (/^SELECT username/.test(sql.trim())) return pilihan ? [{ username: pilihan, diubahOleh: "x" }] : [];
    if (/^INSERT INTO aleta_bot_kasir_akun/.test(sql.trim())) {
      pilihan = params[0];
      return {};
    }
    throw new Error(`kueri ALETA tak terduga: ${sql.slice(0, 70)}`);
  };
  return akunKasirService.buatLayanan({ kueri, kueriAleta });
}
const orang = (username: string, fullname: string, extra: Baris = {}) => ({ userid: username.length, username, fullname, block: "0", kedaluwarsa: null, ...extra });

describe("2a. kasirAkunService - akun kasir ditentukan dari SIPP (grup Kasir 702)", () => {
  it("tepat satu pengguna aktif di grup Kasir = akunnya", async () => {
    const a = await sippAkun([orang("kasir1", "Kasir Satu")]).tentukan();
    expect(a).toMatchObject({ ok: true, username: "kasir1", nama: "Kasir Satu" });
  });

  it("tidak ada anggota (atau semuanya diblokir/kedaluwarsa) = tidak ada akun, pesan jelas, tidak menebak", async () => {
    const kosong = await sippAkun([]).tentukan();
    expect(kosong).toMatchObject({ ok: false, alasan: "akun_kasir_tidak_ada" });
    expect(kosong.pesan).toMatch(/Belum ada akun kasir/);
    const mati = await sippAkun([orang("k1", "A", { block: "1" }), orang("k2", "B", { kedaluwarsa: "2020-01-01" })]).tentukan();
    expect(mati).toMatchObject({ ok: false, alasan: "akun_kasir_tidak_ada" });
  });

  it("lebih dari satu: tanpa pilihan = TIDAK ada akun (calon disebut); pilihan Super Admin sah hanya untuk anggota grup", async () => {
    const layanan = sippAkun([orang("kasir1", "Kasir Satu"), orang("kasir2", "Kasir Dua")]);
    const belum = await layanan.tentukan();
    expect(belum).toMatchObject({ ok: false, alasan: "akun_kasir_belum_dipilih" });
    expect(belum.calon.map((c: Baris) => c.username)).toEqual(["kasir1", "kasir2"]);
    const salah = await layanan.simpanPilihan({ username: "admin", operator: "Super Admin" });
    expect(salah).toMatchObject({ ok: false, alasan: "akun_bukan_kasir" });
    expect((await layanan.tentukan()).ok).toBe(false);
    const sah = await layanan.simpanPilihan({ username: "kasir2", operator: "Super Admin" });
    expect(sah.ok).toBe(true);
    expect(await layanan.tentukan()).toMatchObject({ ok: true, username: "kasir2", dipilih: "kasir2" });
  });

  it("pilihan lama yang akunnya tak lagi hidup diabaikan", async () => {
    const a = await sippAkun([orang("kasir1", "Kasir Satu"), orang("kasir2", "Kasir Dua", { block: "1" })], "kasir2").tentukan();
    expect(a).toMatchObject({ ok: true, username: "kasir1" });
  });
});

// SIPP tiruan di memori untuk menulis jurnal.
function sippTulis(hariKeadaan = "verstek") {
  const dasar = keadaan(hariKeadaan);
  const hari = dasar.hariIni;
  const biaya: Baris[] = salin(dasar.jurnal);
  const tulisan: Array<{ tabel: string; params: unknown[] }> = [];
  const KOLOM = kasir.KOLOM_BIAYA as string[];
  const keBaris = (b: Baris) => ({ ...b, tanggal: String(b.tanggal).slice(0, 10), jumlah: Number(b.jumlah) });
  const kueri = async (sql: string, params: any[] = []) => {
    if (/UTC_TIMESTAMP/.test(sql)) return [{ saat: `${hari} 09:00:00`, hari }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: `${hari} 10:00:00`, hari }];
    if (/FROM sys_users WHERE username/.test(sql)) {
      const ada: Record<string, Baris> = { kasir_sipp: { username: "kasir_sipp", fullname: "Kasir SIPP", block: "0" }, admin: { username: "admin", fullname: "Administrator", block: "0" } };
      return ada[params[0]] ? [ada[params[0]]] : [];
    }
    if (/COALESCE\(SUM\(jenis_transaksi \* jumlah\)/.test(sql)) return [{ saldo: biaya.reduce((s, b) => s + Number(b.jenisTransaksi) * Number(b.jumlah), 0) }];
    if (/COALESCE\(MAX\(id\), 0\) \+ 1/.test(sql)) return [{ maxid: Math.max(0, ...biaya.map((b) => Number(b.id))) + 1 }];
    if (/^SELECT id FROM perkara_biaya WHERE perkara_id/.test(sql.trim())) return [];
    if (/^INSERT INTO perkara_biaya/.test(sql.trim())) {
      const n: Baris = Object.fromEntries(KOLOM.map((k, i) => [k, params[i]]));
      biaya.push({ id: n.id, pembiayaan: n.id_pembiayaan, kategoriId: n.kategori_id, jenisBiayaId: n.jenis_biaya_id, pihakId: n.pihak_id, pihakKe: n.pihak_ke, urutan: n.urutan, jenisTransaksi: n.jenis_transaksi, tanggal: n.tanggal_transaksi, uraian: n.uraian, jumlah: n.jumlah, keterangan: n.keterangan, diinputOleh: n.diinput_oleh });
      tulisan.push({ tabel: "perkara_biaya", params });
      return { affectedRows: 1 };
    }
    if (/^INSERT INTO sys_audittrail/.test(sql.trim())) {
      tulisan.push({ tabel: "sys_audittrail", params });
      return { affectedRows: 1 };
    }
    if (/^(DELETE FROM|REPLACE INTO) perkara_biaya_jurusita/.test(sql.trim())) return { affectedRows: 1 };
    if (/FROM perkara_biaya pb/.test(sql)) return biaya.map((b) => ({ ...b, diinputTanggal: "", namaPihak: "", jurusita: "" }));
    throw new Error(`kueri SIPP tak terduga: ${sql.slice(0, 80)}`);
  };
  const bacaKeadaan = async () => ({ ok: true, keadaan: { ...salin(dasar), jurnal: salin(biaya.map(keBaris)) } });
  const jurnal = kasir.buatLayanan({ kueri, tabelAda: async () => true, jeda: async () => {}, bacaKeadaan });
  let setelan: Baris | null = null;
  const kueriAleta = async (sql: string, params: any[] = []) => {
    if (/CREATE TABLE IF NOT EXISTS/.test(sql)) return {};
    if (/^SELECT nyala/.test(sql.trim())) return setelan ? [setelan] : [];
    if (/^INSERT INTO aleta_bot_kasir_otomatis/.test(sql.trim())) {
      setelan = { nyala: params[0], butir: params[1], diubahOleh: params[2], diubah: `${hari} 09:00:00` };
      return {};
    }
    throw new Error(`kueri ALETA tak terduga: ${sql.slice(0, 60)}`);
  };
  const buat = (akunKasir: () => Promise<Baris>) => otomatis.buatLayanan({ jurnal: { ...jurnal, bacaKeadaan }, kueri, kueriAleta, akunKasir });
  return { biaya, tulisan, dasar, buat, jurnal, bacaKeadaan };
}

describe("2b. Kasir otomatis menulis atas AKUN KASIR walau pemanggil admin", () => {
  it("jurnal (diinput_oleh) dan audit (username) = akun kasir; akun yang dikirim pemanggil tidak dipakai", async () => {
    const s = sippTulis("verstek");
    const layanan = s.buat(async () => ({ ok: true, username: "kasir_sipp", nama: "Kasir SIPP", calon: [] }));
    await layanan.simpanSetelan({ nyala: true, operator: "Super Admin" });
    const h = await layanan.jalankanPerkara({ perkaraId: s.dasar.perkara.perkaraId, akunSipp: "admin", operator: "Super Admin", ip: "10.0.0.9", kering: false });
    expect(h.ok).toBe(true);
    const jurnal = s.tulisan.filter((t) => t.tabel === "perkara_biaya");
    const audit = s.tulisan.filter((t) => t.tabel === "sys_audittrail");
    expect(jurnal.length).toBeGreaterThan(0);
    expect(jurnal.every((t) => t.params[16] === "kasir_sipp")).toBe(true);
    expect(audit.length).toBe(jurnal.length);
    expect(audit.every((t) => t.params[2] === "kasir_sipp")).toBe(true);
    expect(JSON.stringify(s.tulisan)).not.toMatch(/"admin"|Super Admin/);
    expect(h.akunSipp).toMatchObject({ username: "kasir_sipp" });
  });

  it("belum ada akun kasir / belum dipilih: NOL tulisan, alasan dan pesan jelas", async () => {
    for (const alasan of ["akun_kasir_tidak_ada", "akun_kasir_belum_dipilih"]) {
      const s = sippTulis("verstek");
      const layanan = s.buat(async () => ({ ok: false, alasan, pesan: akunKasirService.PESAN[alasan], calon: [{ username: "a", nama: "A" }] }));
      await layanan.simpanSetelan({ nyala: true, operator: "Super Admin" });
      const h = await layanan.jalankanPerkara({ perkaraId: s.dasar.perkara.perkaraId, akunSipp: "admin", operator: "Super Admin", kering: false });
      expect(h).toMatchObject({ ok: false, alasan });
      expect(h.pesan).toMatch(/akun kasir/i);
      expect(s.tulisan).toEqual([]);
    }
  });

  it("tulisan Kasir Manual (susunRencana) atas akun kasir menghasilkan keterangan yang dibaca Riwayat", async () => {
    const s = sippTulis("verstek");
    const rencana = await s.jurnal.susunRencana({
      perkaraId: s.dasar.perkara.perkaraId,
      baris: [{ tanggal: s.dasar.hariIni, jenisBiayaId: 157, pihakKe: 1, pihakId: s.dasar.pihak[0].pihakId, uraian: "Redaksi", jumlah: 10000 }],
      akunSipp: "kasir_sipp",
      operator: "Super Admin",
      ip: "10.0.0.9",
    });
    expect(rencana.ok).toBe(true);
    const hasil = await s.jurnal.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(true);
    const datar = s.jurnal.langkahDatarDenganHasil(rencana, hasil.hasil);
    const biaya = datar.find((x: Baris) => x.tabel === "perkara_biaya");
    expect(biaya.keadaan).toBe("tersimpan");
    const jejak = requireBot(path.join(AKAR, "aleta_bot/services/jejakAletaService.js"));
    expect(jejak.uraikanKeteranganJurnal(biaya.keterangan)).toEqual({ tanggal: s.dasar.hariIni, uraian: "Redaksi", jumlah: 10000, arus: "pengeluaran" });
  });
});

describe("2c. rute bot: Kasir Manual dan Kasir otomatis memakai akun kasir (penjaga teks)", () => {
  const rute = readFileSync(path.join(AKAR, "aleta_bot/routes/jadwalSidangRoutes.js"), "utf8");
  it("POST /kasir (per perkara DAN massal) selalu memakai kasirAkunService.tentukan(); POST /kasir/otomatis tidak meneruskan akun petugas", () => {
    expect(rute).toMatch(/const kasirAkun = await require\("\.\.\/services\/kasirAkunService"\)\.tentukan\(\);\s*if \(!kasirAkun\.ok\) \{/);
    expect(rute).toMatch(/const akunSipp = kasirAkun\.username;/);
    expect(rute).not.toMatch(/if \(badan\.massal === true\) \{\s*const kasirAkun/);
    const blokKasir = rute.slice(rute.indexOf('"/kasir",') , rute.indexOf("KASIR OTOMATIS 1.189.x"));
    expect(blokKasir.length).toBeGreaterThan(500);
    expect(blokKasir).not.toMatch(/akunSipp: badan\.akunSipp/);
    const otomatisBlok = rute.slice(rute.indexOf('router.post("/kasir/otomatis"'), rute.indexOf('router.post("/kasir/otomatis"') + 1200);
    expect(otomatisBlok).not.toMatch(/akunSipp: badan\.akunSipp/);
    expect(rute).toContain('router.get("/kasir/riwayat"');
    expect(rute).toContain('router.post("/kasir/akun"');
  });
  it("jalur tulis SIPP tetap yang lama (tidak ada jalur tulis baru): tabel Kasir saja", () => {
    expect([...kasir.DAFTAR_TABEL_KASIR].sort()).toEqual(["perkara_biaya", "perkara_biaya_jurusita", "sys_audittrail"]);
  });
});

// ============================================================================
// 3. RIWAYAT KASIR (jejak ALETA)
// ============================================================================
describe("3. riwayatKasir - dari jejak ALETA", () => {
  it("catat -> baca: hanya jenis Kasir yang sungguhan; baris per jurnal; hasil, akun kasir, pengguna ALETA, saringan tanggal dan nomor", async () => {
    const jalurDb = path.join(AKAR, "aleta_bot/bot_db_config.js");
    const jalurBotDb = path.join(AKAR, "aleta_bot/services/botDbService.js");
    const jalurJejak = path.join(AKAR, "aleta_bot/services/jejakAletaService.js");
    const baris: Baris[] = [];
    const fakeDb = {
      query(sql: string, params: any[], cb: (e: unknown, h?: unknown) => void) {
        if (/^\s*CREATE TABLE/.test(sql)) return cb(null, {});
        if (/^SHOW COLUMNS/.test(sql)) return cb(null, [{ Field: "x" }]);
        if (/^\s*INSERT INTO aleta_bot_jejak_penetapan/.test(sql)) {
          baris.push({
            id: baris.length + 1,
            waktu: new Date(`${params[0].replace(" ", "T")}Z`),
            aksi: params[1],
            jenis: params[2],
            perkara_id: params[3],
            nomor_perkara: params[4],
            akun_sipp: params[6],
            nama_pejabat: params[7],
            operator: params[10],
            berhasil: params[13],
            kering: params[14],
            alasan: params[15],
            rincian: params[18],
          });
          return cb(null, { insertId: baris.length });
        }
        if (/^\s*SELECT id, waktu, jenis/.test(sql)) {
          let hasil = baris.filter((b) => b.aksi === "tulis" && b.kering === 0 && params.slice(0, 3).includes(b.jenis));
          let i = 3;
          if (/>= \?/.test(sql)) {
            const dari = params[i++];
            hasil = hasil.filter((b) => b.waktu.toISOString().slice(0, 10) >= dari);
          }
          if (/<= \?/.test(sql)) {
            const sampai = params[i++];
            hasil = hasil.filter((b) => b.waktu.toISOString().slice(0, 10) <= sampai);
          }
          if (/LIKE \?/.test(sql)) {
            const potong = String(params[i++]).replace(/^%|%$/g, "");
            hasil = hasil.filter((b) => b.nomor_perkara.includes(potong));
          }
          return cb(null, hasil.slice().reverse());
        }
        return cb(new Error(`kueri jejak tak terduga: ${sql.slice(0, 60)}`));
      },
    };
    const lama = { db: requireBot.cache[jalurDb], botDb: requireBot.cache[jalurBotDb], jejak: requireBot.cache[jalurJejak] };
    const isiCache = (jalur: string, exports: unknown) => {
      requireBot.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports, children: [], paths: [] } as never;
    };
    isiCache(jalurDb, fakeDb);
    isiCache(jalurBotDb, { pastikanUtc: async () => undefined });
    delete requireBot.cache[jalurJejak];
    try {
      const jejak = requireBot(jalurJejak);
      const langkah = (ket: string, keadaanBaris: string) => [
        { tabel: "perkara_biaya", aksi: "INSERT", keterangan: ket, keadaan: keadaanBaris },
        { tabel: "sys_audittrail", aksi: "INSERT", keterangan: "catatan audit" },
      ];
      const dasar = { aksi: "tulis", operator: "Super Admin", ip: "10.0.0.9", akunSipp: "kasir_sipp", namaPejabat: "Kasir SIPP" };
      await jejak.catat({ ...dasar, jenis: "kasir-otomatis", perkaraId: 7, nomorPerkara: "12/Pdt.G/2026/PA.Dgl", berhasil: true, kering: false, langkah: langkah("jurnal 2026-10-28 Redaksi Rp10.000 (pengeluaran)", "tersimpan") });
      await jejak.catat({
        ...dasar,
        jenis: "kasir-jurnal-massal",
        perkaraId: 8,
        nomorPerkara: "99/Pdt.G/2026/PA.Dgl",
        berhasil: false,
        kering: false,
        alasan: "sebagian tidak tersimpan",
        langkah: [...langkah("jurnal 2026-10-27 Meterai Rp10.000 (pengeluaran)", "tersimpan"), ...langkah("jurnal 2026-10-27 Biaya Panggilan Tergugat/P123 Rp48.000 (pengeluaran)", "gagal")],
      });
      await jejak.catat({ ...dasar, jenis: "kasir-otomatis", perkaraId: 9, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", berhasil: true, kering: true, langkah: langkah("jurnal 2026-10-28 Redaksi Rp10.000 (pengeluaran)", "") });
      await jejak.catat({ ...dasar, jenis: "penetapan", perkaraId: 10, nomorPerkara: "6/Pdt.G/2026/PA.Dgl", berhasil: true, kering: false, langkah: [] });

      const semua = await jejak.riwayatKasir({});
      expect(semua.ok).toBe(true);
      expect(semua.pekerjaan.map((k: Baris) => k.nomorPerkara)).toEqual(["99/Pdt.G/2026/PA.Dgl", "12/Pdt.G/2026/PA.Dgl"]);
      const [massal, otom] = semua.pekerjaan;
      expect(otom).toMatchObject({ cara: "Kasir otomatis", akunSipp: "kasir_sipp", namaAkun: "Kasir SIPP", operator: "Super Admin", berhasil: true });
      expect(otom.baris).toEqual([{ tanggal: "2026-10-28", uraian: "Redaksi", jumlah: 10000, arus: "pengeluaran", hasil: "berhasil" }]);
      expect(massal.cara).toBe("Kasir Manual (satu hari)");
      expect(massal.baris.map((b: Baris) => [b.uraian, b.jumlah, b.hasil])).toEqual([
        ["Meterai", 10000, "berhasil"],
        ["Biaya Panggilan Tergugat/P123", 48000, "gagal"],
      ]);
      const cari = await jejak.riwayatKasir({ nomor: "12/Pdt.G" });
      expect(cari.pekerjaan.map((k: Baris) => k.perkaraId)).toEqual([7]);
      const tanggal = await jejak.riwayatKasir({ dari: "2099-01-01" });
      expect(tanggal.pekerjaan).toEqual([]);
    } finally {
      for (const [jalur, asli] of [[jalurDb, lama.db], [jalurBotDb, lama.botDb], [jalurJejak, lama.jejak]] as const) {
        if (asli) requireBot.cache[jalur] = asli;
        else delete requireBot.cache[jalur];
      }
    }
  });
});

// ============================================================================
// 4. RUTE PORTAL
// ============================================================================
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({ panggilBotJadwalSidang: vi.fn() }));
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-analiskeu";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const { panggilBotJadwalSidang } = await import("@/server/modules/aleta-ecourt/jadwal-sidang-gateway");
const bot = vi.mocked(panggilBotJadwalSidang);

const AKUN_BOT = { ok: true, username: "kasir_sipp", nama: "Kasir SIPP", calon: [{ username: "kasir_sipp", nama: "Kasir SIPP" }, { username: "kasir_dua", nama: "Kasir Dua" }], dipilih: "kasir_sipp" };

describe("4. rute portal - akun kasir, Kasir Manual, Riwayat", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    bot.mockReset();
    bot.mockImplementation((async (jalur: string) => {
      if (jalur.startsWith("/kasir/akun")) return { ok: true, data: AKUN_BOT };
      if (jalur.startsWith("/kasir/otomatis?")) return { ok: true, data: { ok: true, tanggal: "2026-10-28", hariIni: "2026-10-28", setelan: { nyala: false, butir: [] }, perkara: [] } };
      if (jalur.startsWith("/kasir/riwayat")) return { ok: true, data: { ok: true, jumlah: 0, pekerjaan: [] } };
      return { ok: true, data: { ok: true, ringkas: {}, hasil: [] } };
    }) as never);
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("GET otomatis: akun = AKUN KASIR dari bot (bukan akun petugas); bolehPilih hanya Super Admin/admin", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-analiskeu";
    const kasirBiasa = (await (await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis"))).json()) as { data: Baris };
    expect(kasirBiasa.data.akun).toMatchObject({ akunKasir: true, ok: true, username: "kasir_sipp", nama: "Kasir SIPP", bolehPilih: false });
    aktor = "usr-super";
    const admin = (await (await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis"))).json()) as { data: Baris };
    expect(admin.data.akun).toMatchObject({ ok: true, bolehPilih: true });
    expect(admin.data.akun.milik).toEqual(["kasir_sipp", "kasir_dua"]);
  });

  it("GET otomatis tanpa akun kasir: ok false + pesan jelas (layar tidak menulis)", async () => {
    bot.mockImplementation((async (jalur: string) =>
      jalur.startsWith("/kasir/akun")
        ? { ok: true, data: { ok: false, alasan: "akun_kasir_tidak_ada", pesan: "Belum ada akun kasir di SIPP.", calon: [] } }
        : { ok: true, data: { ok: true, perkara: [], setelan: { nyala: true, butir: [] } } }) as never);
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-analiskeu";
    const j = (await (await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis"))).json()) as { data: Baris };
    expect(j.data.akun).toMatchObject({ ok: false, alasan: "akun_kasir_tidak_ada", pesan: "Belum ada akun kasir di SIPP." });
  });

  it("POST jalankan: akun petugas TIDAK dikirim ke bot (bot yang menentukan akun kasir)", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-analiskeu";
    await POST(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis", { method: "POST", body: JSON.stringify({ aksi: "jalankan", perkaraId: "12", akunSipp: "admin", kering: false }) }));
    const panggilan = bot.mock.calls.find((c) => c[0] === "/kasir/otomatis");
    expect(panggilan).toBeTruthy();
    expect((panggilan![1] as { body: Baris }).body).toMatchObject({ perkaraId: "12", kering: false });
    expect((panggilan![1] as { body: Baris }).body).not.toHaveProperty("akunSipp");
  });

  it("POST akun-kasir: hanya Super Admin/admin (kasir 403 tanpa memanggil bot)", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    const minta = () => new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis", { method: "POST", body: JSON.stringify({ aksi: "akun-kasir", username: "kasir_dua" }) });
    aktor = "usr-analiskeu";
    bot.mockClear();
    expect((await POST(minta())).status).toBe(403);
    expect(bot).not.toHaveBeenCalled();
    aktor = "usr-super";
    expect((await POST(minta())).status).toBe(200);
    expect(bot).toHaveBeenCalledWith("/kasir/akun", expect.objectContaining({ method: "POST", body: expect.objectContaining({ username: "kasir_dua" }) }));
  });

  it("POST /kasir: per perkara DAN massal tanpa akun petugas (tidak perlu tertaut, akun kiriman diabaikan)", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sidang/kasir/route");
    for (const aktorUji of ["usr-analiskeu", "usr-admin"]) {
      aktor = aktorUji;
      for (const massal of [true, false]) {
        bot.mockClear();
        const r = await POST(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir", { method: "POST", body: JSON.stringify({ perkaraId: "5", baris: [], massal, kering: true, akunSipp: "admin" }) }));
        expect(r.status).toBe(200);
        const panggilan = bot.mock.calls.find((c) => c[0] === "/kasir");
        expect(panggilan, `${aktorUji} massal=${massal}`).toBeTruthy();
        expect((panggilan![1] as { body: Baris }).body).toMatchObject({ massal });
        expect((panggilan![1] as { body: Baris }).body).not.toHaveProperty("akunSipp");
      }
    }
  });

  it("GET /kasir?perkaraId: akun di jawaban = AKUN KASIR dari bot (bukan akun petugas)", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/route");
    aktor = "usr-admin";
    const j = (await (await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir?perkaraId=5"))).json()) as { data: Baris };
    expect(j.data.akun).toMatchObject({ akunKasir: true, ok: true, username: "kasir_sipp", nama: "Kasir SIPP" });
  });

  it("GET riwayat: kasir boleh dan saringan diteruskan; hakim 403", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/riwayat/route");
    aktor = "usr-analiskeu";
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/riwayat?dari=2026-10-01&sampai=2026-10-28&nomor=12%2FPdt"));
    expect(r.status).toBe(200);
    const jalur = String(bot.mock.calls.find((c) => String(c[0]).startsWith("/kasir/riwayat"))![0]);
    expect(jalur).toContain("dari=2026-10-01");
    expect(jalur).toContain("sampai=2026-10-28");
    expect(decodeURIComponent(jalur)).toContain("nomor=12/Pdt");
    aktor = "usr-hakim";
    expect((await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/riwayat"))).status).toBe(403);
  });
});

// ============================================================================
// 5. EKSTENSI (jsdom)
// ============================================================================
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Pilihan = {
  akanDiisi?: boolean;
  pengingat?: Baris[];
  akun?: Baris;
  lipatan?: Record<string, unknown>;
  riwayat?: Baris[];
  usulan?: Baris[];
};
const HARI = "2026-10-28";
const usulanContoh = (): Baris[] => [
  { kunci: "u1", jenisBiayaId: 157, kategoriId: 13, jenisTransaksi: -1, pihakKe: 1, pihakId: 11, uraian: "Redaksi", jumlah: 10000, tanggal: HARI, keterangan: "", jurusitaId: 0, peristiwa: "Putusan", dasar: "kebiasaan kasir satker", yakin: "tinggi", pilih: true, perluResi: false, sisaOtomatis: false, tersedia: true },
  { kunci: "u2", jenisBiayaId: 29, kategoriId: 6, jenisTransaksi: -1, pihakKe: 2, pihakId: 12, uraian: "Biaya Panggilan Tergugat", jumlah: 48000, tanggal: HARI, keterangan: "", jurusitaId: 0, peristiwa: "Panggilan pertama", dasar: "tarif kecamatan", yakin: "tinggi", pilih: true, perluResi: true, sisaOtomatis: false, tersedia: true },
  { kunci: "u3", jenisBiayaId: 151, kategoriId: 9, jenisTransaksi: -1, pihakKe: 1, pihakId: 11, uraian: "Pengembalian Sisa Panjar", jumlah: 42000, tanggal: HARI, keterangan: "", jurusitaId: 0, peristiwa: "Putusan", dasar: "saldo habis", yakin: "tinggi", pilih: true, perluResi: false, sisaOtomatis: true, tersedia: true },
];

function bukaKasir(p: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru", modeKering: false };
  if (p.lipatan) simpanan.aletaKasirLipatan = p.lipatan;
  const tulis: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => Object.fromEntries((k == null ? Object.keys(simpanan) : [k].flat()).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (o: Record<string, unknown>) => {
          Object.assign(simpanan, o);
          tulis.push(o);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const rencana = otomatis.rencanaOtomatis(keadaan("cabut"), {});
  const rencanaKosong = { ...rencana, kirim: [], butir: rencana.butir.map((b: Baris) => ({ ...b, status: "tidak-berlaku" })) };
  const akun = p.akun ?? { akunKasir: true, ok: true, username: "kasir_sipp", nama: "Kasir SIPP", calon: [], milik: [], dipilih: "", bolehPilih: false };
  const minta: Array<{ url: string; cara: string; badan: any }> = [];
  const usulan = p.usulan ?? usulanContoh();
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi?.body ? JSON.parse(opsi.body) : null });
    const data = (isi: unknown) => Response.json({ ok: true, data: isi });
    if (/\/kasir\/otomatis\?tanggal=/.test(url)) {
      const ada = p.akanDiisi === true;
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, bolehUbah: true, pengawas: false,
        setelan: { nyala: false, butir: otomatis.BUTIR_BAWAAN, diubahOleh: "Kasir Satu", diubah: `${HARI} 08:00:00` },
        butirDaftar: otomatis.BUTIR_OTOMATIS, perkara: [ada ? rencana : rencanaKosong], gagal: [],
        ringkas: { perkara: 1, akanDiisi: ada ? 1 : 0, baris: ada ? rencana.kirim.length : 0 }, akun,
      });
    }
    if (/\/kasir\/otomatis$/.test(url) && cara === "POST") return data({ available: true, ok: true, ringkas: {}, hasil: [] });
    if (/\/kasir\/pengingat/.test(url)) {
      const butir = p.pengingat ?? [];
      return data({ available: true, ok: true, hariIni: HARI, butir, ringkas: {} });
    }
    if (/\/kasir\/harian\?/.test(url)) {
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, jumlahCalon: 1, lengkap: [], gagal: [], terpotong: false, akun,
        perkara: [{ perkaraId: 501, nomorPerkara: "501/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 100000, perluPeriksa: true, usulan: salin(usulan), catatan: [] }],
      });
    }
    if (/\/kasir\/riwayat\?/.test(url)) return data({ available: true, ok: true, jumlah: (p.riwayat ?? []).length, pekerjaan: p.riwayat ?? [] });
    if (/\/sipp-tautan\?/.test(url)) {
      const id = new URL(url, "http://x").searchParams.get("perkaraId");
      return data({ alamat: `http://192.168.10.10:8008/SIPP/perkara_detil/ENC${id}`, alasan: "" });
    }
    if (/\/sidang\/kasir$/.test(url) && cara === "POST") return data({ available: true, ok: true, kering: opsi?.body ? JSON.parse(opsi.body).kering : false, ringkas: { tersimpan: 3 }, hasil: [], ditolak: [], dilewati: [], rencana: [{ ke: 0, nilai: { tanggal: HARI, uraian: "Redaksi", jumlah: 10000 } }] });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false;`);
  return { w, minta, simpanan, tulis, wadah: w.document.getElementById("wadah") as HTMLElement, d: w.document as Document };
}
const bab = (h: ReturnType<typeof bukaKasir>, kunci: string) => h.wadah.querySelector(`details[data-kasir-bagian="${kunci}"]`) as HTMLDetailsElement;
async function pasang(h: ReturnType<typeof bukaKasir>) {
  await sampai(() => h.w.__mode() === "baru", "mode baru");
  expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
}
const pengingatContoh = (): Baris[] => [
  { jenis: "sisa-panjar", perkaraId: 21, nomorPerkara: "21/Pdt.G/2026/PA.Dgl", tenggat: "2026-10-27", jumlah: 50000, keterangan: "Saldo panjar Rp50.000 belum dikembalikan." },
  { jenis: "pnbp-belum-setor", perkaraId: 0, nomorPerkara: "", tanggal: "2026-10-26", tenggat: "2026-10-27", jumlah: 30000, keterangan: "PNBP 2026-10-26: Rp30.000." },
];

describe("5a. lipatan bab dan sub-bab", () => {
  it("tanpa pekerjaan: Kasir otomatis, Pengingat, Kasir Manual, Rekap, Riwayat terlipat bawaan; judul berangka", async () => {
    const h = bukaKasir({ akanDiisi: false, pengingat: [] });
    await pasang(h);
    await sampai(() => /\(mati\)/.test(bab(h, "otomatis").querySelector("summary")!.textContent || ""), "judul otomatis");
    await sampai(() => /Pengingat tugas kasir \(0\)/.test(h.wadah.textContent || ""), "pengingat 0");
    await tunggu(30);
    for (const d of Array.from(h.wadah.querySelectorAll("details.aleta-kasir-bagian")) as HTMLDetailsElement[]) expect(d.open, d.querySelector("summary")!.textContent || "").toBe(false);
    const judul = Array.from(h.wadah.querySelectorAll("details.aleta-kasir-bagian > summary")).map((s) => s.textContent);
    expect(judul.some((j) => /^Kasir Manual \(satu hari\)/.test(j || ""))).toBe(true);
    expect(judul.some((j) => /^Riwayat/.test(j || ""))).toBe(true);
    // Sub-bab perkara putus berangka dan terlipat (0 akan diisi).
    const subPerkara = h.wadah.querySelector('details[data-kasir-sub="otomatis.perkara"]') as HTMLDetailsElement;
    expect(subPerkara.querySelector("summary")!.textContent).toMatch(/Perkara putus 28\/10\/2026 \(1\)/);
    expect(subPerkara.open).toBe(false);
    // Tidak ada pengantar "N perkara putus ...: 0 punya baris yang akan diisi".
    expect(h.wadah.textContent).not.toMatch(/punya baris yang akan diisi/);
  });

  it("ada pekerjaan: bab terbuka, sub-bab berjudul jumlah (Setor PNBP ke kas negara (23))", async () => {
    const banyak = Array.from({ length: 23 }, (_, i) => ({ jenis: "pnbp-belum-setor", perkaraId: 0, nomorPerkara: "", tanggal: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`, tenggat: "2026-10-27", jumlah: 1000, keterangan: `PNBP ${i}` }));
    const h = bukaKasir({ akanDiisi: true, pengingat: [...pengingatContoh().slice(0, 1), ...banyak] });
    await pasang(h);
    await sampai(() => /Setor PNBP ke kas negara \(23\)/.test(h.wadah.textContent || ""), "sub-bab setor");
    expect(h.wadah.textContent).toContain("Kembalikan sisa panjar (1)");
    const pengingat = bab(h, "pengingat");
    await sampai(() => pengingat.open, "pengingat terbuka");
    expect(pengingat.querySelector("summary")!.textContent).toMatch(/Pengingat tugas kasir \(24\)/);
    await sampai(() => bab(h, "otomatis").open, "otomatis terbuka (1 perkara akan diisi)");
    expect(bab(h, "otomatis").querySelector("summary")!.textContent).toMatch(/1 perkara akan diisi/);
    const sub = h.wadah.querySelector('details[data-kasir-sub="pengingat.pnbp-belum-setor"]') as HTMLDetailsElement;
    expect(sub.open).toBe(true);
  });

  it("pilihan buka/lipat petugas diingat di penyimpanan ekstensi, dan dipakai pada pemasangan berikutnya", async () => {
    const h = bukaKasir({ akanDiisi: false, pengingat: pengingatContoh() });
    await pasang(h);
    const pengingat = bab(h, "pengingat");
    await sampai(() => pengingat.open, "pengingat terbuka");
    pengingat.open = false; // petugas melipat
    pengingat.dispatchEvent(new h.w.Event("toggle"));
    const rekap = bab(h, "rekap");
    rekap.open = true; // petugas membuka bab yang terlipat bawaan
    rekap.dispatchEvent(new h.w.Event("toggle"));
    await sampai(() => (h.simpanan.aletaKasirLipatan as Baris | undefined)?.rekap?.buka === true, "tersimpan");
    const tersimpan = h.simpanan.aletaKasirLipatan as Baris;
    expect(tersimpan.pengingat).toMatchObject({ buka: false, ada: true });
    expect(tersimpan.rekap).toMatchObject({ buka: true });

    // Pemasangan baru dengan pilihan itu: pengingat tetap terlipat walau ada pekerjaan, rekap terbuka walau kosong.
    const h2 = bukaKasir({ akanDiisi: false, pengingat: pengingatContoh(), lipatan: tersimpan });
    await pasang(h2);
    await sampai(() => /Kembalikan sisa panjar \(1\)/.test(h2.wadah.textContent || ""), "pengingat terbaca");
    expect(bab(h2, "pengingat").open).toBe(false);
    await sampai(() => bab(h2, "rekap").open, "rekap terbuka sesuai pilihan");
  });

  it("bagian yang berubah dari 0 menjadi ada pekerjaan dibuka lagi walau petugas pernah melipatnya", async () => {
    const h = bukaKasir({ akanDiisi: false, pengingat: pengingatContoh(), lipatan: { pengingat: { ada: false, buka: false } } });
    await pasang(h);
    await sampai(() => /Kembalikan sisa panjar \(1\)/.test(h.wadah.textContent || ""), "pengingat terbaca");
    await sampai(() => bab(h, "pengingat").open, "dibuka lagi karena dulu 0, kini ada");
  });
});

describe("5b. akun kasir, ikon (i), dan keterangan teknis", () => {
  it("menampilkan 'Akun kasir: <nama>' (bukan akun petugas); ikon (i): tooltip saat disorot, klik dua kali = pop-up dalam halaman; Esc menutup", async () => {
    const h = bukaKasir({ akanDiisi: true });
    await pasang(h);
    const otomatisBab = bab(h, "otomatis");
    await sampai(() => otomatisBab.querySelector("[data-akun-kasir]"), "akun");
    const akun = otomatisBab.querySelector("[data-akun-kasir]") as HTMLElement;
    expect(akun.getAttribute("data-akun-kasir")).toBe("kasir_sipp");
    expect(akun.textContent).toContain("Akun kasir: Kasir SIPP");
    expect(h.wadah.textContent).not.toContain("akun SIPP Anda");
    const ikon = akun.querySelector(".aleta-kasir-info") as HTMLElement;
    expect(ikon.title).toContain("Ditulis di SIPP atas akun kasir: Kasir SIPP.");
    expect(h.d.querySelector(".aleta-kasir-info-dialog")).toBeNull();
    ikon.dispatchEvent(new h.w.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(h.d.querySelector(".aleta-kasir-info-dialog")).toBeNull(); // satu klik tidak membuka
    ikon.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    const dialog = h.d.querySelector(".aleta-kasir-info-dialog") as HTMLElement;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.textContent).toContain("siapa pun yang menekan tombolnya");
    h.d.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(h.d.querySelector(".aleta-kasir-info-dialog")).toBeNull();
  });

  it("keterangan teknis tidak lagi berupa teks di layar: pindah ke ikon (i)", async () => {
    const h = bukaKasir({ akanDiisi: true, pengingat: pengingatContoh() });
    await pasang(h);
    await sampai(() => h.wadah.querySelector('tr[data-butir="pnbp-cabut"]'), "butir");
    await sampai(() => /Setor PNBP ke kas negara/.test(h.wadah.textContent || ""), "pengingat");
    const teks = h.wadah.textContent || "";
    for (const lama of ["Setoran dicatat di ALETA", "daftar di bawah hanya pratinjau", "Ditulis di SIPP atas akun", "Tiap perkara menurut keadaannya", "kejadian ·", "Hanya perkara yang putus HARI INI", "100% perkara putus"]) {
      expect(teks, lama).not.toContain(lama);
    }
    const judulIkon = Array.from(h.wadah.querySelectorAll(".aleta-kasir-info")).map((i) => (i as HTMLElement).title).join("\n");
    expect(judulIkon).toContain("Mati: tidak ada yang ditulis");
    expect(judulIkon).toContain("Setoran dicatat di ALETA saja.");
    expect(judulIkon).toContain("Terukur: 100% perkara putus");
  });

  it("lebih dari satu akun kasir: Super Admin memilih (POST aksi akun-kasir); akun belum ada -> pesan jelas dan Jalankan sekarang mati", async () => {
    const calon = [{ username: "kasir_sipp", nama: "Kasir SIPP" }, { username: "kasir_dua", nama: "Kasir Dua" }];
    const h = bukaKasir({ akanDiisi: true, akun: { akunKasir: true, ok: true, username: "kasir_sipp", nama: "Kasir SIPP", calon, milik: ["kasir_sipp", "kasir_dua"], dipilih: "kasir_sipp", bolehPilih: true } });
    await pasang(h);
    const kotak = await sampai(() => bab(h, "otomatis").querySelector("[data-akun-kasir]") as HTMLElement | null, "akun");
    const pilih = kotak.querySelector("select") as HTMLSelectElement;
    pilih.value = "kasir_dua";
    (Array.from(kotak.querySelectorAll("button")).find((b) => /Pakai akun ini/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST akun-kasir");
    expect(h.minta.find((m) => m.cara === "POST")!.badan).toEqual({ aksi: "akun-kasir", username: "kasir_dua" });

    const tanpa = bukaKasir({ akanDiisi: true, akun: { akunKasir: true, ok: false, alasan: "akun_kasir_tidak_ada", pesan: "Belum ada akun kasir di SIPP (pengguna grup Kasir yang aktif).", calon: [], milik: [], dipilih: "", bolehPilih: false } });
    await pasang(tanpa);
    const kotak2 = await sampai(() => bab(tanpa, "otomatis").querySelector("[data-akun-kasir]") as HTMLElement | null, "akun");
    expect(kotak2.textContent).toContain("Belum ada akun kasir di SIPP");
    expect(tanpa.minta.filter((m) => m.cara === "POST")).toEqual([]);
  });
});

describe("5c. pengingat: nomor perkara = tautan ke jurnal SIPP", () => {
  it("alamat disusun dari rute sipp-tautan, asal SIPP port bawaan (bukan :8008), tab Keuangan (11); setoran harian tanpa tautan", async () => {
    const h = bukaKasir({ akanDiisi: false, pengingat: pengingatContoh() });
    await pasang(h);
    const a = (await sampai(() => h.wadah.querySelector("a.aleta-kasir-nomor"), "tautan nomor")) as HTMLAnchorElement;
    expect(a.textContent).toBe("21/Pdt.G/2026/PA.Dgl");
    expect(h.wadah.querySelectorAll("a.aleta-kasir-nomor").length).toBe(1); // setoran PNBP tidak per perkara
    a.dispatchEvent(new h.w.MouseEvent("mouseenter"));
    await sampai(() => a.getAttribute("href") !== "#", "alamat tersusun");
    expect(a.getAttribute("href")).toBe("http://192.168.10.10/SIPP/perkara_detil_agama/ENC21/11#aleta-tab=11");
    expect(a.getAttribute("href")).not.toContain("8008");
    expect(a.target).toBe("_blank");
    const tautanMinta = h.minta.find((m) => /sipp-tautan/.test(m.url))!;
    expect(tautanMinta.url).toContain("perkaraId=21");
  });
});

describe("5d. Kasir Manual (satu hari) dapat disunting sebelum disimpan", () => {
  async function bukaManual(h: ReturnType<typeof bukaKasir>) {
    await pasang(h);
    const manual = bab(h, "manual");
    expect(manual.querySelector("summary")!.textContent).toMatch(/^Kasir Manual \(satu hari\)/);
    manual.open = true;
    manual.dispatchEvent(new h.w.Event("toggle"));
    await sampai(() => manual.querySelector('tr[data-usulan="u1"]'), "baris usulan");
    // Perkara yang perlu diperiksa tangan tidak tercentang bawaan: petugas mencentangnya setelah memeriksa.
    const cekPerkara = manual.querySelector(".aleta-basmassal-pilih-perkara input") as HTMLInputElement;
    expect(cekPerkara.checked).toBe(false);
    cekPerkara.checked = true;
    cekPerkara.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    return manual;
  }
  const baris = (m: HTMLElement, k: string) => m.querySelector(`tr[data-usulan="${k}"]`) as HTMLTableRowElement;
  const ubah = (h: ReturnType<typeof bukaKasir>, el: HTMLInputElement, nilai: string, peristiwa: "input" | "change") => {
    el.value = nilai;
    el.dispatchEvent(new h.w.Event(peristiwa, { bubbles: true }));
  };

  it("tanggal, uraian, nominal, centang, dan hapus: yang dikirim PERSIS yang tampil; sisa panjar mengikuti; tanpa akun petugas", async () => {
    const h = bukaKasir();
    const manual = await bukaManual(h);
    // Sisa awal 100.000 - 10.000 - 48.000 = 42.000
    expect(baris(manual, "u3").querySelector("td.aleta-kasir-angka")!.textContent).toBe("Rp42.000");
    // Peringatan resi menuntut tindakan: terlihat sampai diperbaiki.
    const peringat = baris(manual, "u2").querySelector(".aleta-basmassal-salah") as HTMLElement;
    expect(peringat.textContent).toContain("Nomor resi Pos belum ada");
    expect(peringat.hidden).toBe(false);
    const uraian = baris(manual, "u2").querySelector("input.aleta-kasir-uraian") as HTMLInputElement;
    expect(uraian.value).toBe("Biaya Panggilan Tergugat");
    ubah(h, uraian, "Biaya Panggilan Tergugat/P2610280001", "input");
    expect(peringat.hidden).toBe(true);
    ubah(h, baris(manual, "u2").querySelector('input[type="number"]') as HTMLInputElement, "40000", "change");
    expect(baris(manual, "u3").querySelector("td.aleta-kasir-angka")!.textContent).toBe("Rp50.000");
    ubah(h, baris(manual, "u1").querySelector('input[type="date"]') as HTMLInputElement, "2026-10-27", "change");
    ubah(h, baris(manual, "u1").querySelector("input.aleta-kasir-uraian") as HTMLInputElement, "Redaksi putusan", "input");
    // Hapus baris Redaksi? Tidak - lepas centang baris sisa lalu hapus baris lain untuk menguji keduanya.
    (baris(manual, "u3").querySelector('input[type="checkbox"]') as HTMLInputElement).checked = false;
    baris(manual, "u3").querySelector('input[type="checkbox"]')!.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(baris(manual, "u3").classList.contains("aleta-kasir-mati")).toBe(true);

    // Pratinjau: kering:true, baris suntingan, hasil ditampilkan.
    (Array.from(manual.querySelectorAll("button")).find((b) => b.textContent === "Pratinjau") as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST" && m.badan.kering === true), "POST pratinjau");
    const pratinjau = h.minta.find((m) => m.cara === "POST")!;
    expect(pratinjau.badan.baris.map((b: Baris) => [b.tanggal, b.uraian, b.jumlah])).toEqual([
      ["2026-10-27", "Redaksi putusan", 10000],
      [HARI, "Biaya Panggilan Tergugat/P2610280001", 40000],
    ]);
    await sampai(() => /Pratinjau: akan ditulis/.test(manual.textContent || ""), "hasil pratinjau tampil");

    // Simpan (dua tekanan): baris yang sama, massal:true, tanpa akunSipp.
    (Array.from(manual.querySelectorAll("button")).find((b) => /^Simpan 1 perkara ke SIPP$/.test(b.textContent || "")) as HTMLButtonElement).click();
    await tunggu(10);
    (Array.from(manual.querySelectorAll("button")).find((b) => /Tekan sekali lagi/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => h.minta.filter((m) => m.cara === "POST").length >= 2, "POST simpan");
    const simpan = h.minta.filter((m) => m.cara === "POST")[1];
    expect(simpan.badan).toMatchObject({ massal: true, kering: false, perkaraId: "501" });
    expect(simpan.badan).not.toHaveProperty("akunSipp");
    expect(simpan.badan.baris.map((b: Baris) => [b.tanggal, b.uraian, b.jumlah])).toEqual(pratinjau.badan.baris.map((b: Baris) => [b.tanggal, b.uraian, b.jumlah]));
    expect(JSON.stringify(simpan.badan)).not.toMatch(/aleta/i);
  });

  it("hapus baris: tidak ikut terkirim; nominal dikosongkan = 'jumlah?' dan tidak terkirim", async () => {
    const h = bukaKasir();
    const manual = await bukaManual(h);
    (baris(manual, "u1").querySelector("button.aleta-kasir-hapus") as HTMLButtonElement).click();
    expect(manual.querySelector('tr[data-usulan="u1"]')).toBeNull();
    const nominal = baris(manual, "u2").querySelector('input[type="number"]') as HTMLInputElement;
    ubah(h, nominal, "", "change");
    expect((baris(manual, "u2").querySelector(".aleta-basmassal-salah:not([hidden])") as HTMLElement)?.textContent || "").toMatch(/jumlah\?|Nomor resi/);
    (Array.from(manual.querySelectorAll("button")).find((b) => b.textContent === "Pratinjau") as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST pratinjau");
    expect(h.minta.find((m) => m.cara === "POST")!.badan.baris.map((b: Baris) => b.uraian)).toEqual(["Pengembalian Sisa Panjar"]);
  });

  it("tanpa akun kasir: Simpan dan Pratinjau mati", async () => {
    const h = bukaKasir({ akun: { akunKasir: true, ok: false, alasan: "akun_kasir_tidak_ada", pesan: "Belum ada akun kasir di SIPP.", calon: [], milik: [], dipilih: "", bolehPilih: false } });
    const manual = await bukaManual(h);
    for (const b of Array.from(manual.querySelectorAll(".aleta-basmassal-aksi button")) as HTMLButtonElement[]) expect(b.disabled).toBe(true);
    expect(manual.textContent).toContain("Belum ada akun kasir di SIPP.");
  });
});

describe("5g. Kasir per perkara (jendela satu perkara) atas akun kasir juga", () => {
  const DATA_PERKARA = (akun: Baris) => ({
    available: true, ok: true, hariIni: HARI, saldo: 100000, akun,
    perkara: { perkaraId: 501, nomorPerkara: "501/Pdt.G/2026/PA.Dgl" },
    keadaan: { nama: "Putus verstek", lazim: ["Redaksi", "Meterai"] },
    usulan: usulanContoh().slice(0, 1), catatan: ["Saldo panjar habis - tidak ada sisa yang dikembalikan."],
  });
  const AKUN_OK = { akunKasir: true, ok: true, username: "kasir_sipp", nama: "Kasir SIPP", calon: [], milik: [], dipilih: "", bolehPilih: false };
  async function bukaPerkara(akun: Baris) {
    const h = bukaKasir();
    const asli = h.w.fetch;
    h.w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
      if (/\/sidang\/kasir\?perkaraId=/.test(String(alamat))) {
        h.minta.push({ url: String(alamat), cara: "GET", badan: null });
        return Response.json({ ok: true, data: DATA_PERKARA(akun) });
      }
      return asli(alamat, opsi);
    };
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasang(h.wadah, { perkaraId: "501" });
    await sampai(() => h.wadah.querySelector(".aleta-kasir-keadaan"), "keadaan");
    return h;
  }

  it("menampilkan 'Akun kasir: <nama>' + ikon (i); lazim dan catatan biasa di balik ikon; simpan tidak mengirim akun petugas", async () => {
    const h = await bukaPerkara(AKUN_OK);
    const akun = h.wadah.querySelector("[data-akun-kasir]") as HTMLElement;
    expect(akun.textContent).toContain("Akun kasir: Kasir SIPP");
    expect((akun.querySelector(".aleta-kasir-info") as HTMLElement).title).toContain("Ditulis di SIPP atas akun kasir: Kasir SIPP.");
    expect(h.wadah.textContent).not.toContain("Lazim");
    expect(h.wadah.textContent).not.toContain("Saldo panjar habis");
    const titel = Array.from(h.wadah.querySelectorAll(".aleta-kasir-info")).map((i) => (i as HTMLElement).title).join(" ");
    expect(titel).toContain("Lazim pada keadaan ini");
    expect(titel).toContain("1 catatan tentang perkara ini");
    (Array.from(h.wadah.querySelectorAll("button")).find((b) => b.textContent === "Pratinjau") as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST pratinjau");
    const badan = h.minta.find((m) => m.cara === "POST")!.badan;
    expect(badan).toMatchObject({ perkaraId: "501", kering: true });
    expect(badan).not.toHaveProperty("akunSipp");
  });

  it("akun kasir belum ada / belum dipilih: tidak menulis, pesan jelas", async () => {
    const h = await bukaPerkara({ akunKasir: true, ok: false, alasan: "akun_kasir_belum_dipilih", pesan: "Ada lebih dari satu akun kasir di SIPP - Super Admin atau admin memilih dulu.", calon: [], milik: [], dipilih: "", bolehPilih: false });
    expect(h.wadah.querySelector("[data-akun-kasir]")!.textContent).toContain("Ada lebih dari satu akun kasir di SIPP");
    (Array.from(h.wadah.querySelectorAll("button")).find((b) => /^Simpan/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => /Ada lebih dari satu akun kasir/.test(h.wadah.querySelector("[data-aleta-kasir]")!.textContent || ""), "pesan");
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
  });
});

describe("5e. bab Riwayat", () => {
  const riwayat = (): Baris[] => [
    { id: 2, waktu: "2026-10-28T06:05:00.000Z", cara: "Kasir Manual (satu hari)", jenis: "kasir-jurnal-massal", perkaraId: 8, nomorPerkara: "99/Pdt.G/2026/PA.Dgl", akunSipp: "kasir_sipp", namaAkun: "Kasir SIPP", operator: "Super Admin", berhasil: false, alasan: "sebagian tidak tersimpan", baris: [{ tanggal: "2026-10-27", uraian: "Meterai", jumlah: 10000, arus: "pengeluaran", hasil: "berhasil" }, { tanggal: "2026-10-27", uraian: "Biaya Panggilan Tergugat/P1", jumlah: 48000, arus: "pengeluaran", hasil: "gagal" }] },
    { id: 1, waktu: "2026-10-28T01:00:00.000Z", cara: "Kasir otomatis", jenis: "kasir-otomatis", perkaraId: 7, nomorPerkara: "12/Pdt.G/2026/PA.Dgl", akunSipp: "kasir_sipp", namaAkun: "Kasir SIPP", operator: "Kasir Satu", berhasil: true, alasan: "", baris: [{ tanggal: "2026-10-28", uraian: "Redaksi", jumlah: 10000, arus: "pengeluaran", hasil: "berhasil" }] },
  ];

  it("dibaca saat dibuka: jam setempat, nomor perkara bertautan, uraian, nominal, akun kasir, pengguna ALETA, hasil; dapat disaring", async () => {
    const h = bukaKasir({ riwayat: riwayat() });
    await pasang(h);
    const rw = bab(h, "riwayat");
    expect(rw.open).toBe(false);
    expect(h.minta.some((m) => /\/kasir\/riwayat/.test(m.url))).toBe(false);
    rw.open = true;
    rw.dispatchEvent(new h.w.Event("toggle"));
    const tabel = (await sampai(() => rw.querySelector("table.aleta-kasir-tabel-riwayat"), "tabel riwayat")) as HTMLTableElement;
    const baris = Array.from(tabel.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
    expect(baris.length).toBe(3);
    const sel = (tr: HTMLTableRowElement) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent);
    // 06.05 UTC = 14.05 WITA
    expect(sel(baris[0])[0]).toMatch(/28\/10\/2026.*14[.:]05/);
    expect(sel(baris[0]).slice(1, 3)).toEqual(["99/Pdt.G/2026/PA.Dgl", "Kasir Manual (satu hari)"]);
    expect(baris[0].querySelector("a.aleta-kasir-nomor")).not.toBeNull();
    expect(sel(baris[0])[3]).toContain("Meterai");
    expect(sel(baris[0])[4]).toBe("Rp10.000");
    expect(sel(baris[0])[5]).toBe("Kasir SIPP");
    expect(sel(baris[0])[6]).toBe("Super Admin");
    expect(baris.map((tr) => tr.getAttribute("data-hasil"))).toEqual(["berhasil", "gagal", "berhasil"]);
    expect(rw.querySelector("summary")!.textContent).toMatch(/Riwayat \(3\)/);

    // Saring: tanggal dan nomor diteruskan.
    (rw.querySelector('input[type="search"]') as HTMLInputElement).value = "12/Pdt";
    (Array.from(rw.querySelectorAll("button")).find((b) => b.textContent === "Tampilkan") as HTMLButtonElement).click();
    await sampai(() => h.minta.filter((m) => /\/kasir\/riwayat/.test(m.url)).length >= 2, "GET kedua");
    const kedua = h.minta.filter((m) => /\/kasir\/riwayat/.test(m.url))[1].url;
    expect(decodeURIComponent(kedua)).toContain("nomor=12/Pdt");
    expect(kedua).toMatch(/dari=\d{4}-\d{2}-\d{2}/);
    expect(kedua).toMatch(/sampai=\d{4}-\d{2}-\d{2}/);
  });
});

describe("5f. nama dan penjaga teks lama", () => {
  it("'Kasir otomatis massal' tidak tersisa sebagai teks layar di ekstensi dan portal; nama baru Kasir Manual (satu hari)", () => {
    const bas = readFileSync(path.join(EKS, "basmassal.js"), "utf8");
    expect(bas).toContain('bagian("Kasir Manual (satu hari)", "manual")');
    const sisa = bas.split("\n").filter((l: string) => /otomatis massal/i.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    expect(sisa).toEqual([]);
    const portal = readFileSync(path.join(process.cwd(), "src/components/portal/kasir-otomatis.tsx"), "utf8");
    expect(portal).toContain('["massal", "Kasir Manual (satu hari)"]');
    expect(portal).not.toMatch(/Massal hari ini/);
    expect(portal).not.toMatch(/Ditulis di SIPP atas akun SIPP Anda/);
  });

  it("tipografi: bab 15px tebal, sub-bab 13.5px tebal, isi 12.5px; ikon (i) dan pop-up memakai token tema", () => {
    const css = readFileSync(path.join(EKS, "panel.css"), "utf8");
    const blok = css.slice(css.indexOf("/* === KASIR 28 Okt 2026"), css.indexOf("/* === AKHIR KASIR 28 Okt 2026"));
    expect(blok).toMatch(/\.aleta-kasir-harian > details\.aleta-kasir-bagian > summary \{[^}]*font-size: calc\(15px[^}]*font-weight: 700/);
    expect(blok).toMatch(/\.aleta-kasir \.aleta-kasir-subbagian > summary,[^{]*\{[^}]*font-size: calc\(13\.5px[^}]*font-weight: 700/);
    expect(blok).toMatch(/\.aleta-kasir \.aleta-kasir-tabel,[^{]*\{[^}]*font-size: calc\(12\.5px/);
    expect(blok).toMatch(/\.aleta-kasir-info \{[^}]*var\(--aleta-tulisan-lembut\)/);
    expect(blok).toMatch(/\.aleta-kasir-info-dialog \{[^}]*var\(--aleta-info-latar[^}]*var\(--aleta-info-tulisan/);
    // Satu-satunya angka warna tetap: cadangan pop-up bila jangkar tak bertema + latar redup.
    expect(blok.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual(["#fffdf8", "#2b2721"]);
  });
});
