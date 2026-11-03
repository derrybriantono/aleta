import { createHash, randomUUID } from "node:crypto";

import {
  berikanKode,
  hitungRencana,
  nomorBaku,
  petaRujukan,
  rencanaSinkron,
  type KeadaanBaris,
  type RingkasanPustaka,
  type RiwayatSinkron,
} from "@/lib/aleta-abt-pustaka";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { panggilBotPengaturanAbt } from "@/server/modules/pengaturan-abt/gateway";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PUSTAKA ALETA ABT (3 Nov 2026, Tahap 1, migrasi 0133) - salinan Blangko ABT by Derry Briantono di database ALETA
 * ============================================================================
 *
 * Sinkron SATU ARAH ABT -> ALETA ABT. Bot ALETA membaca ABT (MariaDB 5.5) dan folder blangko - HANYA MEMBACA
 * (aleta_bot/services/pustakaAbtDerryService.js, rute /internal/aleta-bot/abt-pengaturan/pustaka/*); berkas ini
 * membandingkan dan menyimpan di Postgres ALETA. Aturan tidak-menimpa ada di src/lib/aleta-abt-pustaka.ts.
 *
 *   variabel  kunci = kode ALETA ABT (AA + 5 angka) dari aleta_abt_peta_variabel(server, no_var). Nomor yang belum
 *             terpeta di server ini mendapat kode baru (berikanKode) - kode tidak pernah diturunkan ulang.
 *   menu      kunci = nama folder (direktori) abt_menu Derry.
 *   berkas    kunci = jalur relatif di folder derry_briantono; sidik = md5. Isi hanya diambil untuk yang baru/berubah,
 *             md5 diperiksa ulang sesudah diterima.
 *
 * Panel Blangko Derry TETAP memakai ABT (penggantian sumber = tahap berikut). Tidak satu baris pun ditulis ke ABT/SIPP.
 */

export type VariabelPotret = {
  no: string;
  nama: string;
  data_type: string | null;
  data_tabel: string | null;
  data_kolom: string | null;
  urutan_data: string | null;
  referensi: string | null;
  sql_query: string | null;
  default_data: string | null;
  multi_sidang: string | null;
  locked: number;
  modifier?: string;
  modified?: string;
  sumber: "blangko" | "turunan";
  jumlahBlangko: number;
  rujukan: string[];
};

export type MenuPotret = {
  id: string;
  nama: string | null;
  nama_alias: string | null;
  direktori: string;
  parent_direktori: string | null;
  user_grup_id: string | null;
  user_top_id: string | null;
  user_validator: string | null;
  user_cek: string | null;
  proses_id_min: string | null;
  proses_id_max: string | null;
  perkara_id_min: string | null;
  perkara_id_max: string | null;
  perkara_id_referensi: string | null;
  modified?: string;
};

export type BerkasPotret = { jalur: string; folder: string; nama: string; arsip: boolean; md5: string; ukuran: number; waktu: string; penanda: string[] };

export type PotretAbt = {
  server: string;
  waktu?: string;
  berkas: BerkasPotret[];
  variabel: VariabelPotret[];
  menu: MenuPotret[];
  takDikenal?: string[];
};

export type IsiBerkas = { jalur: string; md5: string; ukuran: number; isi: string };

export type DepsSinkron = {
  ambilPotret: () => Promise<PotretAbt>;
  ambilIsi: (jalur: string[]) => Promise<{ berkas: IsiBerkas[]; ditolak?: string[]; lewat?: string[] }>;
  /** Bawaan: withTransaction(db). Uji pg-mem memberi pelaksana langsung. */
  transaksi?: <T>(kerja: (tx: AletaDatabase) => Promise<T>) => Promise<T>;
  kini?: () => string;
};

const BATAS_BATCH_BYTE = 12 * 1024 * 1024;
const BATAS_BATCH_JUMLAH = 150;
const UMUR_JALAN_MS = 30 * 60 * 1000;

const sha1 = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex");
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const nul = (v: unknown) => (v === null || v === undefined ? null : String(v));
const json = (x: unknown) => JSON.stringify(x);
const bacaJson = <T>(t: unknown, cadangan: T): T => {
  try {
    return JSON.parse(String(t ?? "")) as T;
  } catch {
    return cadangan;
  }
};

/** Sidik definisi variabel ABT: kolom yang menentukan isi blangko (tanpa modifier/modified). */
export function sidikVariabel(v: Pick<VariabelPotret, "nama" | "data_type" | "data_tabel" | "data_kolom" | "urutan_data" | "referensi" | "sql_query" | "default_data" | "multi_sidang" | "locked">) {
  return sha1([v.nama, v.data_type, v.data_tabel, v.data_kolom, v.urutan_data, v.referensi === null ? null : nomorBaku(v.referensi), v.sql_query, v.default_data, v.multi_sidang, Number(v.locked) === 1 ? 1 : 0].map(nul));
}

/** Sidik hak satu folder (tanpa id/modified - id baris abt_menu milik server itu). */
export function sidikMenu(m: MenuPotret) {
  return sha1(
    [m.nama, m.nama_alias, m.parent_direktori, m.user_grup_id, m.user_top_id, m.user_validator, m.user_cek, m.proses_id_min, m.proses_id_max, m.perkara_id_min, m.perkara_id_max, m.perkara_id_referensi].map(nul)
  );
}

/** Isi RTF sebagai teks latin1 apa adanya; bita nol (tidak boleh di TEXT Postgres) -> base64. */
export function simpananIsi(bita: Buffer): { isi: string; pengkodean: "latin1" | "base64" } {
  return bita.includes(0) ? { isi: bita.toString("base64"), pengkodean: "base64" } : { isi: bita.toString("latin1"), pengkodean: "latin1" };
}

export function bitaIsi(isi: string, pengkodean: string): Buffer {
  return Buffer.from(isi, pengkodean === "base64" ? "base64" : "latin1");
}

type BarisKeadaanDb = {
  kunci: string;
  sidik_asal: string;
  diubah: number | string;
  asal: string;
  status: string;
  bentrok: string;
  asal_server: string;
};

const keadaan = (b: BarisKeadaanDb): KeadaanBaris => ({
  kunci: String(b.kunci),
  sidikAsal: String(b.sidik_asal ?? ""),
  diubah: Number(b.diubah) === 1,
  asal: b.asal === "aleta" ? "aleta" : "abt",
  status: b.status === "hilang" ? "hilang" : "aktif",
  bentrokSidik: String(b.bentrok ?? ""),
});

/** Baris yang ikut direncanakan: milik server ini, atau kuncinya memang datang dari server ini. */
function barisRencana(semua: BarisKeadaanDb[], server: string, masuk: Set<string>) {
  return semua.filter((b) => b.asal_server === server || masuk.has(String(b.kunci))).map(keadaan);
}

function validasiPotret(p: PotretAbt): PotretAbt {
  if (!p || !Array.isArray(p.berkas) || !Array.isArray(p.variabel) || !Array.isArray(p.menu)) throw new ApiError(502, "Data blangko dari ABT tidak lengkap.");
  if (!p.berkas.length) throw new ApiError(502, "Folder Blangko Derry di server kosong atau tidak terbaca - sinkron dibatalkan agar tidak ada yang ditandai hilang.");
  return p;
}

export type HasilSinkron = {
  server: string;
  berkas: ReturnType<typeof hitungRencana> & { gagal: number };
  variabel: ReturnType<typeof hitungRencana>;
  menu: ReturnType<typeof hitungRencana>;
  takDikenal: number;
  tulis: number;
  sidik: string;
};

/**
 * Satu putaran sinkron (dipanggil di latar oleh mulaiSinkron, langsung oleh uji). `id` = baris aleta_abt_sinkron yang
 * sudah dibuat; hasil dan galat dicatat di sana.
 */
export async function jalankanSinkron(db: AletaDatabase, id: string, deps: DepsSinkron): Promise<HasilSinkron> {
  const kini = deps.kini ?? (() => new Date().toISOString());
  const transaksi = deps.transaksi ?? (<T,>(kerja: (tx: AletaDatabase) => Promise<T>) => withTransaction(db, kerja));
  try {
    const hasil = await sinkronInti(db, deps, kini, transaksi);
    await db.run("UPDATE aleta_abt_sinkron SET status = 'berhasil', server = ?, sidik = ?, ringkasan = ?, selesai_at = ? WHERE id = ?", [
      hasil.server,
      hasil.sidik,
      json({ berkas: hasil.berkas, variabel: hasil.variabel, menu: hasil.menu, takDikenal: hasil.takDikenal, tulis: hasil.tulis }),
      kini(),
      id,
    ]);
    return hasil;
  } catch (galat) {
    const pesan = galat instanceof Error ? galat.message : String(galat);
    await db.run("UPDATE aleta_abt_sinkron SET status = 'gagal', galat = ?, selesai_at = ? WHERE id = ?", [pesan.slice(0, 500), kini(), id]).catch(() => undefined);
    throw galat;
  }
}

async function sinkronInti(
  db: AletaDatabase,
  deps: DepsSinkron,
  kini: () => string,
  transaksi: <T>(kerja: (tx: AletaDatabase) => Promise<T>) => Promise<T>
): Promise<HasilSinkron> {
  const p = validasiPotret(await deps.ambilPotret());
  const server = String(p.server || "setempat").trim().slice(0, 60) || "setempat";
  const sekarang = kini();
  let tulis = 0;

  // ---- peta & kode -------------------------------------------------------------------------------------------
  const petaDb = await db.queryAll<{ id: string; no_var: string; kode: string; sidik: string; status: string }>(
    "SELECT id, no_var, kode, sidik, status FROM aleta_abt_peta_variabel WHERE server = ?",
    [server]
  );
  const petaAda = new Map(petaDb.map((b) => [nomorBaku(b.no_var), b]));
  const kodeTerpakai = new Set<string>([
    ...(await db.queryAll<{ kode: string }>("SELECT kode FROM aleta_abt_variabel")).map((b) => b.kode),
    ...(await db.queryAll<{ kode: string }>("SELECT kode FROM aleta_abt_peta_variabel")).map((b) => b.kode),
  ]);
  const varMasuk = new Map<string, VariabelPotret>();
  for (const v of p.variabel) varMasuk.set(nomorBaku(v.no), { ...v, no: nomorBaku(v.no) });
  const kodeBaru = berikanKode([...varMasuk.keys()].filter((no) => !petaAda.has(no)), kodeTerpakai);
  const petaKini = new Map<string, string>();
  for (const [no, b] of petaAda) petaKini.set(no, b.kode);
  for (const [no, k] of kodeBaru) petaKini.set(no, k);
  const kodeKe = (no: string) => petaKini.get(nomorBaku(no)) as string;

  // ---- variabel ----------------------------------------------------------------------------------------------
  const varDb = await db.queryAll<BarisKeadaanDb & { sumber: string; jumlah_blangko: number | string; rujukan_kode: string; referensi_kode: string }>(
    "SELECT kode AS kunci, sidik_asal, diubah, asal, status, bentrok_sidik AS bentrok, asal_server, sumber, jumlah_blangko, rujukan_kode, referensi_kode FROM aleta_abt_variabel"
  );
  const varDbPeta = new Map(varDb.map((b) => [String(b.kunci), b]));
  const masukVar = [...varMasuk.values()].map((v) => ({ kunci: kodeKe(v.no), sidik: sidikVariabel(v) }));
  const rVar = rencanaSinkron(barisRencana(varDb, server, new Set(masukVar.map((m) => m.kunci))), masukVar);
  const varPerKode = new Map([...varMasuk.values()].map((v) => [kodeKe(v.no), v]));

  // ---- menu --------------------------------------------------------------------------------------------------
  const menuDb = await db.queryAll<BarisKeadaanDb>(
    "SELECT id AS kunci, sidik_asal, diubah, asal, status, bentrok_sidik AS bentrok, asal_server FROM aleta_abt_menu"
  );
  const menuMasuk = new Map<string, MenuPotret>();
  for (const m of p.menu) if (m.direktori && !menuMasuk.has(m.direktori)) menuMasuk.set(m.direktori, m);
  const rMenu = rencanaSinkron(
    barisRencana(menuDb, server, new Set(menuMasuk.keys())),
    [...menuMasuk.values()].map((m) => ({ kunci: m.direktori, sidik: sidikMenu(m) }))
  );

  // ---- tulis variabel + peta + menu (satu transaksi) ---------------------------------------------------------
  await transaksi(async (tx) => {
    const isiVar = (v: VariabelPotret) => {
      const r = petaRujukan(v.rujukan || [], petaKini);
      return {
        nilai: [
          v.nama ?? "",
          nul(v.data_type),
          nul(v.data_tabel),
          nul(v.data_kolom),
          nul(v.urutan_data),
          v.referensi === null || v.referensi === undefined ? null : nomorBaku(v.referensi),
          v.referensi ? petaKini.get(nomorBaku(v.referensi)) ?? "" : "",
          nul(v.sql_query),
          nul(v.default_data),
          nul(v.multi_sidang),
          Number(v.locked) === 1 ? 1 : 0,
          String(v.modifier ?? ""),
          String(v.modified ?? ""),
        ],
        turunan: [v.sumber === "turunan" ? "turunan" : "blangko", Number(v.jumlahBlangko) || 0, json((v.rujukan || []).map(nomorBaku)), json(r.kode)],
      };
    };
    for (const kode of rVar.baru) {
      const v = varPerKode.get(kode)!;
      const x = isiVar(v);
      await tx.run(
        `INSERT INTO aleta_abt_variabel
           (kode, nama, tipe, data_tabel, data_kolom, urutan_data, referensi_asal, referensi_kode, sql_query, default_data, multi_sidang, dikunci, pengubah_asal, waktu_asal,
            sumber, jumlah_blangko, rujukan_asal, rujukan_kode, asal, asal_server, asal_no, sidik_asal, diubah, status, disinkron_at, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'abt', ?, ?, ?, 0, 'aktif', ?, ?, ?)`,
        [kode, ...x.nilai, ...x.turunan, server, v.no, sidikVariabel(v), sekarang, sekarang, sekarang]
      );
      tulis += 1;
    }
    for (const kode of [...rVar.berubah, ...rVar.kembali]) {
      const v = varPerKode.get(kode)!;
      const ada = varDbPeta.get(kode)!;
      const terkunci = Number(ada.diubah) === 1 || ada.asal === "aleta";
      if (terkunci) {
        await tx.run("UPDATE aleta_abt_variabel SET status = 'aktif', hilang_at = '', disinkron_at = ? WHERE kode = ?", [sekarang, kode]);
      } else {
        const x = isiVar(v);
        await tx.run(
          `UPDATE aleta_abt_variabel SET nama = ?, tipe = ?, data_tabel = ?, data_kolom = ?, urutan_data = ?, referensi_asal = ?, referensi_kode = ?, sql_query = ?,
             default_data = ?, multi_sidang = ?, dikunci = ?, pengubah_asal = ?, waktu_asal = ?, sumber = ?, jumlah_blangko = ?, rujukan_asal = ?, rujukan_kode = ?,
             sidik_asal = ?, status = 'aktif', hilang_at = '', bentrok_sidik = '', bentrok_at = '', disinkron_at = ?, diubah_at = ? WHERE kode = ?`,
          [...x.nilai, ...x.turunan, sidikVariabel(v), sekarang, sekarang, kode]
        );
      }
      tulis += 1;
    }
    const bentrokVar = new Set(rVar.bentrok);
    for (const kode of rVar.sama) {
      const v = varPerKode.get(kode)!;
      const ada = varDbPeta.get(kode)!;
      if (Number(ada.diubah) === 1 || ada.asal === "aleta") {
        // Ubahan ALETA ABT dibiarkan utuh; hanya catatan bentrok lama yang sudah selaras yang dibersihkan.
        if (ada.bentrok) {
          await tx.run("UPDATE aleta_abt_variabel SET bentrok_sidik = '', bentrok_at = '' WHERE kode = ?", [kode]);
          tulis += 1;
        }
        continue;
      }
      const x = isiVar(v);
      const [sumber, jumlah, rujukanAsal, rujukanKode] = x.turunan;
      const berbeda =
        ada.sumber !== sumber || Number(ada.jumlah_blangko) !== jumlah || ada.rujukan_kode !== rujukanKode || String(ada.referensi_kode ?? "") !== String(x.nilai[6] ?? "") || (ada.bentrok && !bentrokVar.has(kode));
      if (!berbeda) continue;
      await tx.run(
        "UPDATE aleta_abt_variabel SET sumber = ?, jumlah_blangko = ?, rujukan_asal = ?, rujukan_kode = ?, referensi_kode = ?, bentrok_sidik = '', bentrok_at = '', disinkron_at = ? WHERE kode = ?",
        [sumber, jumlah, rujukanAsal, rujukanKode, x.nilai[6], sekarang, kode]
      );
      tulis += 1;
    }
    for (const kode of rVar.bentrokBaru) {
      const v = varPerKode.get(kode)!;
      await tx.run("UPDATE aleta_abt_variabel SET bentrok_sidik = ?, bentrok_at = ? WHERE kode = ?", [sidikVariabel(v), sekarang, kode]);
      tulis += 1;
    }
    for (const kode of rVar.hilang) {
      await tx.run("UPDATE aleta_abt_variabel SET status = 'hilang', hilang_at = ? WHERE kode = ?", [sekarang, kode]);
      tulis += 1;
    }
    // Peta nomor ABT server ini -> kode ALETA ABT.
    for (const [no, v] of varMasuk) {
      const kode = kodeKe(no);
      const s = sidikVariabel(v);
      const ada = petaAda.get(no);
      if (!ada) {
        await tx.run("INSERT INTO aleta_abt_peta_variabel (id, server, no_var, kode, sidik, status, dibuat_at, diubah_at) VALUES (?, ?, ?, ?, ?, 'aktif', ?, ?)", [
          `${server}|${no}`,
          server,
          no,
          kode,
          s,
          sekarang,
          sekarang,
        ]);
        tulis += 1;
      } else if (ada.sidik !== s || ada.status !== "aktif") {
        await tx.run("UPDATE aleta_abt_peta_variabel SET sidik = ?, status = 'aktif', diubah_at = ? WHERE id = ?", [s, sekarang, ada.id]);
        tulis += 1;
      }
    }
    for (const [no, ada] of petaAda) {
      if (varMasuk.has(no) || ada.status === "hilang") continue;
      await tx.run("UPDATE aleta_abt_peta_variabel SET status = 'hilang', diubah_at = ? WHERE id = ?", [sekarang, ada.id]);
      tulis += 1;
    }

    // Menu.
    const nilaiMenu = (m: MenuPotret) =>
      [m.nama, m.nama_alias, m.parent_direktori, m.user_grup_id, m.user_top_id, m.user_validator, m.user_cek, m.proses_id_min, m.proses_id_max, m.perkara_id_min, m.perkara_id_max, m.perkara_id_referensi].map(nul);
    const menuDbPeta = new Map(menuDb.map((b) => [String(b.kunci), b]));
    for (const d of rMenu.baru) {
      const m = menuMasuk.get(d)!;
      await tx.run(
        `INSERT INTO aleta_abt_menu (id, nama, nama_alias, parent_direktori, user_grup_id, user_top_id, user_validator, user_cek, proses_id_min, proses_id_max,
           perkara_id_min, perkara_id_max, perkara_id_referensi, asal_id, waktu_asal, asal, asal_server, sidik_asal, diubah, status, disinkron_at, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'abt', ?, ?, 0, 'aktif', ?, ?, ?)`,
        [d, ...nilaiMenu(m), String(m.id ?? ""), String(m.modified ?? ""), server, sidikMenu(m), sekarang, sekarang, sekarang]
      );
      tulis += 1;
    }
    for (const d of [...rMenu.berubah, ...rMenu.kembali]) {
      const m = menuMasuk.get(d)!;
      const ada = menuDbPeta.get(d)!;
      if (Number(ada.diubah) === 1 || ada.asal === "aleta") {
        await tx.run("UPDATE aleta_abt_menu SET status = 'aktif', hilang_at = '', disinkron_at = ? WHERE id = ?", [sekarang, d]);
      } else {
        await tx.run(
          `UPDATE aleta_abt_menu SET nama = ?, nama_alias = ?, parent_direktori = ?, user_grup_id = ?, user_top_id = ?, user_validator = ?, user_cek = ?, proses_id_min = ?,
             proses_id_max = ?, perkara_id_min = ?, perkara_id_max = ?, perkara_id_referensi = ?, asal_id = ?, waktu_asal = ?, sidik_asal = ?, status = 'aktif', hilang_at = '',
             bentrok_sidik = '', bentrok_at = '', disinkron_at = ?, diubah_at = ? WHERE id = ?`,
          [...nilaiMenu(m), String(m.id ?? ""), String(m.modified ?? ""), sidikMenu(m), sekarang, sekarang, d]
        );
      }
      tulis += 1;
    }
    const bentrokMenu = new Set(rMenu.bentrok);
    for (const d of rMenu.sama) {
      if (!menuDbPeta.get(d)?.bentrok || bentrokMenu.has(d)) continue;
      await tx.run("UPDATE aleta_abt_menu SET bentrok_sidik = '', bentrok_at = '' WHERE id = ?", [d]);
      tulis += 1;
    }
    for (const d of rMenu.bentrokBaru) {
      await tx.run("UPDATE aleta_abt_menu SET bentrok_sidik = ?, bentrok_at = ? WHERE id = ?", [sidikMenu(menuMasuk.get(d)!), sekarang, d]);
      tulis += 1;
    }
    for (const d of rMenu.hilang) {
      await tx.run("UPDATE aleta_abt_menu SET status = 'hilang', hilang_at = ? WHERE id = ?", [sekarang, d]);
      tulis += 1;
    }
  });

  // ---- berkas ------------------------------------------------------------------------------------------------
  const berkasDb = await db.queryAll<BarisKeadaanDb & { penanda_kode: string; md5: string }>(
    "SELECT id AS kunci, md5_asal AS sidik_asal, diubah, asal, status, bentrok_md5 AS bentrok, asal_server, penanda_kode, md5 FROM aleta_abt_berkas"
  );
  const berkasDbPeta = new Map(berkasDb.map((b) => [String(b.kunci), b]));
  const berkasMasuk = new Map<string, BerkasPotret>();
  for (const b of p.berkas) if (b.jalur && !berkasMasuk.has(b.jalur)) berkasMasuk.set(b.jalur, b);
  const rBerkas = rencanaSinkron(
    barisRencana(berkasDb, server, new Set(berkasMasuk.keys())),
    [...berkasMasuk.values()].map((b) => ({ kunci: b.jalur, sidik: b.md5 }))
  );
  const penandaKode = (b: BerkasPotret) => json(petaRujukan(b.penanda || [], petaKini).kode);
  const terkunciBerkas = (j: string) => {
    const a = berkasDbPeta.get(j);
    return Boolean(a && (Number(a.diubah) === 1 || a.asal === "aleta"));
  };
  // Isi diambil untuk: baru, berubah, dan kembali yang belum diubah di ALETA ABT dan md5-nya lain.
  const perluIsi = [
    ...rBerkas.baru,
    ...rBerkas.berubah,
    ...rBerkas.kembali.filter((j) => !terkunciBerkas(j) && berkasDbPeta.get(j)?.md5 !== berkasMasuk.get(j)?.md5),
  ];
  const tanpaIsi = rBerkas.kembali.filter((j) => !perluIsi.includes(j));
  let gagal = 0;
  const kelompok: string[][] = [];
  let isiKelompok: string[] = [];
  let ukuran = 0;
  for (const j of perluIsi) {
    const u = Number(berkasMasuk.get(j)?.ukuran) || 0;
    if (isiKelompok.length && (ukuran + u > BATAS_BATCH_BYTE || isiKelompok.length >= BATAS_BATCH_JUMLAH)) {
      kelompok.push(isiKelompok);
      isiKelompok = [];
      ukuran = 0;
    }
    isiKelompok.push(j);
    ukuran += u;
  }
  if (isiKelompok.length) kelompok.push(isiKelompok);
  const baruSet = new Set(rBerkas.baru);
  for (let i = 0; i < kelompok.length; i += 1) {
    let sisa = kelompok[i];
    // Bot berhenti sebelum melewati batasnya; yang `lewat` diminta lagi sampai habis atau tidak maju.
    while (sisa.length) {
      const jawab = await deps.ambilIsi(sisa);
      const diterima = new Map((jawab.berkas || []).map((b) => [b.jalur, b]));
      await transaksi(async (tx) => {
        for (const j of sisa) {
          const b = berkasMasuk.get(j)!;
          const isi = diterima.get(j);
          if (!isi) continue;
          const bita = Buffer.from(String(isi.isi || ""), "base64");
          if (md5(bita) !== b.md5) {
            gagal += 1;
            continue;
          }
          const s = simpananIsi(bita);
          if (baruSet.has(j)) {
            await tx.run(
              `INSERT INTO aleta_abt_berkas (id, folder, nama, arsip, isi, pengkodean, md5, ukuran, waktu_berkas, penanda_asal, penanda_kode, asal, asal_server, md5_asal,
                 diubah, status, disinkron_at, dibuat_at, diubah_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'abt', ?, ?, 0, 'aktif', ?, ?, ?)`,
              [j, b.folder, b.nama, b.arsip ? 1 : 0, s.isi, s.pengkodean, b.md5, bita.length, String(b.waktu ?? ""), json(b.penanda || []), penandaKode(b), server, b.md5, sekarang, sekarang, sekarang]
            );
          } else {
            await tx.run(
              `UPDATE aleta_abt_berkas SET folder = ?, nama = ?, arsip = ?, isi = ?, pengkodean = ?, md5 = ?, ukuran = ?, waktu_berkas = ?, penanda_asal = ?, penanda_kode = ?,
                 md5_asal = ?, status = 'aktif', hilang_at = '', bentrok_md5 = '', bentrok_at = '', disinkron_at = ?, diubah_at = ? WHERE id = ?`,
              [b.folder, b.nama, b.arsip ? 1 : 0, s.isi, s.pengkodean, b.md5, bita.length, String(b.waktu ?? ""), json(b.penanda || []), penandaKode(b), b.md5, sekarang, sekarang, j]
            );
          }
          tulis += 1;
        }
      });
      const lewat = (jawab.lewat || []).filter((j) => sisa.includes(j));
      // Tidak diterima dan tidak disebut `lewat` (ditolak bot / tidak terbaca) = gagal; berkas lama tetap seperti semula.
      gagal += sisa.filter((j) => !diterima.has(j) && !lewat.includes(j)).length;
      if (lewat.length && lewat.length < sisa.length) sisa = lewat;
      else {
        gagal += lewat.length;
        sisa = [];
      }
    }
  }
  await transaksi(async (tx) => {
    for (const j of tanpaIsi) {
      await tx.run("UPDATE aleta_abt_berkas SET status = 'aktif', hilang_at = '', disinkron_at = ? WHERE id = ?", [sekarang, j]);
      tulis += 1;
    }
    const bentrok = new Set(rBerkas.bentrok);
    for (const j of rBerkas.sama) {
      const ada = berkasDbPeta.get(j)!;
      const pk = penandaKode(berkasMasuk.get(j)!);
      const bersihBentrok = Boolean(ada.bentrok) && !bentrok.has(j);
      // penanda_kode hanya disegarkan untuk salinan ABT yang belum diubah (ubahan ALETA ABT punya penandanya sendiri).
      const segarPenanda = !terkunciBerkas(j) && ada.penanda_kode !== pk;
      if (!bersihBentrok && !segarPenanda) continue;
      if (segarPenanda) await tx.run("UPDATE aleta_abt_berkas SET penanda_kode = ? WHERE id = ?", [pk, j]);
      if (bersihBentrok) await tx.run("UPDATE aleta_abt_berkas SET bentrok_md5 = '', bentrok_at = '' WHERE id = ?", [j]);
      tulis += 1;
    }
    for (const j of rBerkas.bentrokBaru) {
      await tx.run("UPDATE aleta_abt_berkas SET bentrok_md5 = ?, bentrok_at = ? WHERE id = ?", [berkasMasuk.get(j)!.md5, sekarang, j]);
      tulis += 1;
    }
    for (const j of rBerkas.hilang) {
      await tx.run("UPDATE aleta_abt_berkas SET status = 'hilang', hilang_at = ? WHERE id = ?", [sekarang, j]);
      tulis += 1;
    }
  });

  const sidik = sha1([
    [...berkasMasuk.values()].map((b) => `${b.jalur}:${b.md5}`).sort(),
    [...varMasuk.values()].map((v) => `${v.no}:${sidikVariabel(v)}`).sort(),
    [...menuMasuk.values()].map((m) => `${m.direktori}:${sidikMenu(m)}`).sort(),
  ]);
  const berkasHitung = hitungRencana(rBerkas);
  return {
    server,
    berkas: { ...berkasHitung, gagal },
    variabel: hitungRencana(rVar),
    menu: hitungRencana(rMenu),
    takDikenal: (p.takDikenal || []).length,
    tulis,
    sidik,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Mulai (latar) & ringkasan untuk layar
// ---------------------------------------------------------------------------------------------------------------

function depsBawaan(): DepsSinkron {
  return {
    ambilPotret: async () => {
      const r = await panggilBotPengaturanAbt<PotretAbt>("/pustaka/potret", { timeoutMs: 10 * 60 * 1000 });
      if (!r.ok) throw new ApiError(r.status && r.status < 500 ? 409 : 502, r.error);
      return r.data;
    },
    ambilIsi: async (jalur) => {
      const r = await panggilBotPengaturanAbt<{ berkas: IsiBerkas[]; ditolak: string[]; lewat: string[] }>("/pustaka/isi", {
        method: "POST",
        body: { jalur },
        timeoutMs: 5 * 60 * 1000,
      });
      if (!r.ok) throw new ApiError(502, r.error);
      return r.data;
    },
  };
}

let sedangJalanProses = false;

/** Mulai sinkron di latar; layar memantau lewat ringkasanPustaka. Satu sinkron sekaligus. */
export async function mulaiSinkron(db: AletaDatabase, oleh: string, deps: DepsSinkron = depsBawaan()) {
  const sekarang = Date.now();
  const jalan = await db.queryAll<{ id: string; mulai_at: string }>("SELECT id, mulai_at FROM aleta_abt_sinkron WHERE status = 'jalan'");
  for (const j of jalan) {
    if (sedangJalanProses && sekarang - Date.parse(j.mulai_at) < UMUR_JALAN_MS) throw new ApiError(409, "Sinkron dari ABT sedang berjalan. Tunggu sampai selesai.");
    await db.run("UPDATE aleta_abt_sinkron SET status = 'gagal', galat = ?, selesai_at = ? WHERE id = ?", ["Terhenti sebelum selesai (aplikasi dimulai ulang).", new Date().toISOString(), j.id]);
  }
  const id = randomUUID();
  await db.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES (?, 'jalan', ?, ?)", [id, String(oleh || "").slice(0, 120), new Date().toISOString()]);
  sedangJalanProses = true;
  void jalankanSinkron(db, id, deps)
    .catch((galat) => console.error("[pustaka-aleta-abt] sinkron gagal:", galat instanceof Error ? galat.message : galat))
    .finally(() => {
      sedangJalanProses = false;
    });
  return { id, mulai: true as const };
}

const barisRiwayat = (b: Record<string, unknown>): RiwayatSinkron => ({
  id: String(b.id),
  server: String(b.server ?? ""),
  status: b.status === "berhasil" ? "berhasil" : b.status === "gagal" ? "gagal" : "jalan",
  oleh: String(b.oleh ?? ""),
  mulaiAt: String(b.mulai_at ?? ""),
  selesaiAt: String(b.selesai_at ?? ""),
  galat: String(b.galat ?? ""),
  ringkasan: bacaJson(b.ringkasan, {}),
});

/** Jumlah per jenis + riwayat sinkron + daftar bentrok (baca saja). */
export async function ringkasanPustaka(db: AletaDatabase): Promise<RingkasanPustaka> {
  const [berkas, variabel, menu, peta, riwayat] = await Promise.all([
    db.queryAll<{ id: string; nama: string; status: string; arsip: number; diubah: number; bentrok_md5: string; bentrok_at: string; ukuran: number }>(
      "SELECT id, nama, status, arsip, diubah, bentrok_md5, bentrok_at, ukuran FROM aleta_abt_berkas"
    ),
    db.queryAll<{ kode: string; nama: string; status: string; sumber: string; diubah: number; bentrok_sidik: string; bentrok_at: string }>(
      "SELECT kode, nama, status, sumber, diubah, bentrok_sidik, bentrok_at FROM aleta_abt_variabel"
    ),
    db.queryAll<{ id: string; nama: string; status: string; diubah: number; bentrok_sidik: string; bentrok_at: string }>(
      "SELECT id, nama, status, diubah, bentrok_sidik, bentrok_at FROM aleta_abt_menu"
    ),
    db.queryAll<{ server: string; status: string }>("SELECT server, status FROM aleta_abt_peta_variabel"),
    db.queryAll<Record<string, unknown>>("SELECT id, server, status, oleh, ringkasan, galat, mulai_at, selesai_at FROM aleta_abt_sinkron ORDER BY mulai_at DESC LIMIT 8"),
  ]);
  const hitung = <T extends { status: string; diubah: number | string }>(rows: T[], bentrok: (b: T) => boolean) => ({
    aktif: rows.filter((b) => b.status !== "hilang").length,
    hilang: rows.filter((b) => b.status === "hilang").length,
    bentrok: rows.filter(bentrok).length,
    diubah: rows.filter((b) => Number(b.diubah) === 1).length,
  });
  const perServer = new Map<string, number>();
  for (const b of peta) if (b.status !== "hilang") perServer.set(b.server, (perServer.get(b.server) ?? 0) + 1);
  const daftarBentrok: RingkasanPustaka["bentrok"] = [
    ...berkas.filter((b) => b.bentrok_md5).map((b) => ({ jenis: "berkas" as const, kunci: b.id, nama: b.nama, pada: b.bentrok_at })),
    ...variabel.filter((b) => b.bentrok_sidik).map((b) => ({ jenis: "variabel" as const, kunci: b.kode, nama: b.nama, pada: b.bentrok_at })),
    ...menu.filter((b) => b.bentrok_sidik).map((b) => ({ jenis: "menu" as const, kunci: b.id, nama: b.nama || b.id, pada: b.bentrok_at })),
  ].slice(0, 30);
  const daftarRiwayat = riwayat.map(barisRiwayat);
  return {
    berkas: {
      ...hitung(berkas, (b) => Boolean(b.bentrok_md5)),
      arsip: berkas.filter((b) => Number(b.arsip) === 1 && b.status !== "hilang").length,
      ukuranByte: berkas.filter((b) => b.status !== "hilang").reduce((s, b) => s + (Number(b.ukuran) || 0), 0),
    },
    variabel: {
      ...hitung(variabel, (b) => Boolean(b.bentrok_sidik)),
      blangko: variabel.filter((b) => b.status !== "hilang" && b.sumber !== "turunan").length,
      turunan: variabel.filter((b) => b.status !== "hilang" && b.sumber === "turunan").length,
    },
    menu: hitung(menu, (b) => Boolean(b.bentrok_sidik)),
    peta: [...perServer.entries()].map(([server, jumlah]) => ({ server, jumlah })),
    terakhir: daftarRiwayat.find((r) => r.status !== "jalan") ?? null,
    sedangJalan: daftarRiwayat.some((r) => r.status === "jalan"),
    riwayat: daftarRiwayat,
    bentrok: daftarBentrok,
  };
}
