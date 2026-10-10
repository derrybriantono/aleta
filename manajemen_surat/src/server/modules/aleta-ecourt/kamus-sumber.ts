import {
  CERMIN_SIPP,
  STATUS_VARIABEL,
  SUMBER_VARIABEL,
  kunciCerminSah,
  pilihAcuan,
  rekapUraian,
  rujukanVariabel,
  tipeVariabel,
  uraiVariabel,
  type DefinisiAbt,
  type RekapKamus,
  type StatusVariabel,
  type SumberVariabel,
} from "@/lib/kamus-sumber-abt";
import { golongkan, variabelBersarang } from "@/lib/kelas-variabel";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { selesaikanPenanda } from "@/server/modules/aleta-ecourt/penyelesai";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import benihBawaan from "./kamus-variabel-awal.json";

/**
 * ============================================================================
 * D1 KAMUS VARIABEL ABT - URAIAN, SUNTINGAN ADMIN, DAN NILAI SIPP UNTUK B1
 * ============================================================================
 *
 * Satu-satunya jalan SQL ke kolom 0059 aleta_kamus_variabel (sumber, arti,
 * blangko pemakai, status, cermin_sipp). Penyalinan definisinya tetap milik
 * kamus-variabel.ts (0033).
 *
 *   membaca      semua pegawai yang memegang panel (layar admin, ekstensi)
 *   menyunting   Super Admin - arti, sumber, rincian sumber, cermin SIPP
 *
 * ============================================================================
 * ISI AWAL TANPA MENUNGGU ABT
 * ============================================================================
 *
 * Server baru belum tentu tersambung ke APS Badilag saat pertama menyala.
 * Bila kamus masih kosong, isinya ditanam dari kamus-variabel-awal.json -
 * salinan aps_badilag.abt_variabel lokal (salinan server 9 Okt 2026) beserta
 * pindaian blangko RTF yang memakainya. "Salin ulang dari ABT" (0033) tetap
 * dapat dijalankan kapan saja; sesudahnya uraian dihitung ulang, dan yang
 * disunting Super Admin tidak ditimpa.
 *
 * ============================================================================
 * NILAI SIPP UNTUK PENGINGAT SEBELUM CETAK (B1) - HANYA MEMBACA
 * ============================================================================
 *
 * Untuk variabel bercermin yang tergambar di halaman blangko, nilai SIPP
 * TERKINI dihitung dengan definisi ABT yang SAMA (data_sipp: kueri yang sama
 * persis dengan Abt_model::get_data_variabel, termasuk urutan pihak; data_sql:
 * kuerinya sendiri) lewat jembatan bot baca-saja. Isian manual yang meniru
 * SIPP dibandingkan dengan variabel otomatis acuannya. Perbandingannya sendiri
 * terjadi di ekstensi - nilai di halaman ABT tidak dikirim ke mana pun.
 */

type BenihButir = {
  k: string;
  n?: string;
  j?: string;
  t?: string;
  c?: string;
  u?: number | string | null;
  r?: string;
  q?: string;
  d?: string;
  b?: number;
  bl?: number[];
};

export type BenihKamus = {
  asal: string;
  jumlahBlangkoDipindai?: number;
  blangko: string[];
  variabel: BenihButir[];
};

const BENIH = benihBawaan as unknown as BenihKamus;

type BarisDb = Record<string, unknown>;

const teks = (x: unknown) => String(x ?? "").trim();

function blangkoDariBenih(benih: BenihKamus, b: BenihButir): string[] {
  return (b.bl ?? []).map((i) => benih.blangko[i]).filter((x): x is string => typeof x === "string");
}

const sudahSiap = new WeakSet<AletaDatabase>();

/**
 * Kamus kosong -> ditanam dari benih; baris yang belum berurai -> diurai.
 * Dipanggil rute kamus-sumber dan abt-cek-sipp sebelum membaca.
 */
export async function pastikanKamusAwal(
  db: AletaDatabase,
  benih: BenihKamus = BENIH
): Promise<{ ditanam: number; diurai: number }> {
  if (sudahSiap.has(db)) return { ditanam: 0, diurai: 0 };
  const jumlah = Number((await db.queryOne<BarisDb>(`SELECT COUNT(*) AS jumlah FROM aleta_kamus_variabel`))?.jumlah ?? 0) || 0;
  let ditanam = 0;
  if (jumlah === 0 && benih.variabel.length) {
    const pada = new Date().toISOString();
    const salinId = `isi-awal-${Date.now()}`;
    await withTransaction(db, async (tx) => {
      for (const b of benih.variabel) {
        const def = { noVar: b.k, nama: b.n ?? "", jenis: b.j ?? "", sqlQuery: b.q ?? "", dataTabel: b.t ?? "", dataKolom: b.c ?? "" };
        const kelas = golongkan(def);
        await tx.run(
          `INSERT INTO aleta_kamus_variabel
             (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data, kelas, sebab_kelas, bersarang,
              jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at, urutan_data, referensi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            def.noVar,
            def.nama,
            def.jenis,
            def.sqlQuery,
            def.dataTabel,
            def.dataKolom,
            b.d ?? "",
            kelas.kelas,
            kelas.sebab,
            variabelBersarang(def).join(","),
            Number(b.b ?? 0) || 0,
            "isi awal: " + benih.asal,
            salinId,
            pada,
            pada,
            b.u === null || b.u === undefined ? "" : String(b.u),
            b.r ?? "",
          ]
        );
        ditanam += 1;
      }
      await tx.run(
        `INSERT INTO aleta_kamus_salin
           (id, asal_skema, jumlah_baris, jumlah_kelas_a, jumlah_kelas_b, jumlah_kelas_c, keadaan, sebab, oleh, dijalankan_at)
         VALUES (?, ?, ?, 0, 0, 0, 'selesai', '', 'isi-awal', ?)`,
        [salinId, "isi awal: " + benih.asal, ditanam, pada]
      );
    });
  }
  const belum = Number(
    (await db.queryOne<BarisDb>(`SELECT COUNT(*) AS jumlah FROM aleta_kamus_variabel WHERE status = ''`))?.jumlah ?? 0
  );
  const diurai = belum > 0 ? (await uraiUlangKamus(db, { benih })).diurai : 0;
  sudahSiap.add(db);
  return { ditanam, diurai };
}

/** Lupakan tanda siap - dipanggil sesudah salin ulang supaya uraian dihitung lagi. */
export function lupakanKamusSiap(db: AletaDatabase) {
  sudahSiap.delete(db);
}

function keDefinisi(b: BarisDb, cadangan?: BenihButir): DefinisiAbt {
  return {
    noVar: teks(b.no_var),
    nama: teks(b.nama),
    jenis: teks(b.jenis),
    sqlQuery: String(b.sql_query ?? ""),
    dataTabel: teks(b.data_tabel),
    dataKolom: teks(b.data_kolom),
    urutanData: teks(b.urutan_data) || (cadangan?.u === null || cadangan?.u === undefined ? "" : String(cadangan.u)),
    referensi: teks(b.referensi) || teks(cadangan?.r),
  };
}

/**
 * Menghitung ulang uraian seluruh kamus. Arti, sumber, rincian sumber, dan
 * cermin yang disunting Super Admin (disunting_at terisi) TIDAK ditimpa;
 * status dan tabel selalu dihitung dari definisinya.
 */
export async function uraiUlangKamus(
  db: AletaDatabase,
  opsi: { benih?: BenihKamus } = {}
): Promise<{ diurai: number; rekap: RekapKamus }> {
  const benih = opsi.benih ?? BENIH;
  const petaBenih = new Map(benih.variabel.map((b) => [b.k, b]));
  const baris = await db.queryAll<BarisDb>(`SELECT * FROM aleta_kamus_variabel`);
  const peta = new Map(baris.map((b) => [teks(b.no_var), keDefinisi(b, petaBenih.get(teks(b.no_var)))]));
  const hasil: Array<{ status: StatusVariabel; sumber: SumberVariabel; cermin: string }> = [];

  await withTransaction(db, async (tx) => {
    for (const b of baris) {
      const kode = teks(b.no_var);
      const def = peta.get(kode)!;
      const u = uraiVariabel(def, peta);
      const dipegang = Boolean(teks(b.disunting_at));
      const cb = petaBenih.get(kode);
      const blangko = cb ? blangkoDariBenih(benih, cb) : safeJsonArray(b.blangko_pakai);
      const jumlahBlangko = cb ? Number(cb.b ?? 0) || 0 : Number(b.jumlah_blangko ?? 0) || 0;
      const sumber = dipegang ? (teks(b.sumber) as SumberVariabel) : u.sumber;
      const cermin = dipegang ? teks(b.cermin_sipp) : u.cermin;
      await tx.run(
        `UPDATE aleta_kamus_variabel
            SET urutan_data = ?, referensi = ?, sumber = ?, sumber_rinci = ?, tabel_sipp = ?, arti = ?,
                blangko_pakai = ?, jumlah_blangko = ?, status = ?, cermin_sipp = ?
          WHERE no_var = ?`,
        [
          teks(def.urutanData),
          teks(def.referensi),
          sumber,
          dipegang ? teks(b.sumber_rinci) : u.sumberRinci,
          u.tabelSipp.join(","),
          dipegang ? teks(b.arti) : u.arti,
          JSON.stringify(blangko),
          jumlahBlangko,
          u.status,
          cermin,
          kode,
        ]
      );
      hasil.push({ status: u.status, sumber, cermin });
    }
  });
  return { diurai: baris.length, rekap: rekapUraian(hasil) };
}

function safeJsonArray(x: unknown): string[] {
  try {
    const v = JSON.parse(String(x ?? "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export type ButirKamusSumber = {
  noVar: string;
  nama: string;
  jenis: string;
  tipe: string;
  sumber: SumberVariabel;
  sumberRinci: string;
  tabelSipp: string[];
  arti: string;
  status: StatusVariabel;
  cermin: string;
  cerminLabel: string;
  blangko: string[];
  jumlahBlangko: number;
  rujukan: string[];
  sqlQuery: string;
  dataTabel: string;
  dataKolom: string;
  disunting: boolean;
  disuntingOleh: string;
  disuntingAt: string;
};

function keButir(b: BarisDb): ButirKamusSumber {
  const cermin = teks(b.cermin_sipp);
  const status = teks(b.status) as StatusVariabel;
  const sumber = teks(b.sumber) as SumberVariabel;
  const bersarang = teks(b.bersarang);
  return {
    noVar: teks(b.no_var),
    nama: teks(b.nama),
    jenis: teks(b.jenis),
    tipe: tipeVariabel(b.jenis),
    sumber: SUMBER_VARIABEL.includes(sumber) ? sumber : "tanpa",
    sumberRinci: teks(b.sumber_rinci),
    tabelSipp: teks(b.tabel_sipp).split(",").filter(Boolean),
    arti: teks(b.arti),
    status: STATUS_VARIABEL.includes(status) ? status : "tanpa-sumber",
    cermin,
    cerminLabel: kunciCerminSah(cermin) ? CERMIN_SIPP[kunciCerminSah(cermin) as keyof typeof CERMIN_SIPP] : "",
    blangko: safeJsonArray(b.blangko_pakai),
    jumlahBlangko: Number(b.jumlah_blangko ?? 0) || 0,
    rujukan: bersarang ? bersarang.split(",").filter(Boolean) : [],
    sqlQuery: String(b.sql_query ?? ""),
    dataTabel: teks(b.data_tabel),
    dataKolom: teks(b.data_kolom),
    disunting: Boolean(teks(b.disunting_at)),
    disuntingOleh: teks(b.disunting_oleh),
    disuntingAt: teks(b.disunting_at),
  };
}

export type SaringKamus = {
  cari?: string;
  status?: string;
  sumber?: string;
  hanyaDipakai?: boolean;
  hanyaCermin?: boolean;
  mulai?: number;
  batas?: number;
};

export type DaftarKamusSumber = {
  rekap: RekapKamus;
  rekapDipakai: RekapKamus;
  jumlahCocok: number;
  butir: ButirKamusSumber[];
  asal: string;
};

/** Daftar untuk layar admin - disaring di sini, bukan di SQL (pg-mem dan Postgres berbeda soal LIKE/ILIKE). */
export async function daftarKamusSumber(db: AletaDatabase, saring: SaringKamus = {}): Promise<DaftarKamusSumber> {
  const semua = (await db.queryAll<BarisDb>(`SELECT * FROM aleta_kamus_variabel ORDER BY no_var`)).map(keButir);
  const cari = teks(saring.cari).toLowerCase();
  const cocok = semua.filter((b) => {
    if (saring.status && b.status !== saring.status) return false;
    if (saring.sumber && b.sumber !== saring.sumber) return false;
    if (saring.hanyaDipakai && b.jumlahBlangko === 0) return false;
    if (saring.hanyaCermin && !b.cermin) return false;
    if (!cari) return true;
    const kode = cari.replace(/#/g, "");
    return b.noVar.includes(kode) || b.nama.toLowerCase().includes(cari) || b.arti.toLowerCase().includes(cari) || b.sumberRinci.toLowerCase().includes(cari);
  });
  const mulai = Math.max(0, Number(saring.mulai ?? 0) || 0);
  const batas = Math.max(1, Math.min(200, Number(saring.batas ?? 50) || 50));
  const salin = await db.queryOne<BarisDb>(`SELECT asal_skema FROM aleta_kamus_salin WHERE keadaan = 'selesai' ORDER BY dijalankan_at DESC LIMIT 1`);
  return {
    rekap: rekapUraian(semua),
    rekapDipakai: rekapUraian(semua.filter((b) => b.jumlahBlangko > 0)),
    jumlahCocok: cocok.length,
    butir: cocok.slice(mulai, mulai + batas),
    asal: teks(salin?.asal_skema),
  };
}

/** Super Admin menyunting arti/sumber/rincian/cermin; `kembalikan` membuang suntingan dan mengurai ulang. */
export async function suntingKamusSumber(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { noVar?: unknown; arti?: unknown; sumber?: unknown; sumberRinci?: unknown; cermin?: unknown; kembalikan?: unknown }
): Promise<ButirKamusSumber> {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Hanya Super Admin yang dapat menyunting kamus variabel.");
  const noVar = teks(masukan.noVar).replace(/#/g, "");
  if (!/^\d{4,5}$/.test(noVar)) throw new ApiError(400, "Kode variabel harus 4-5 angka.");
  const ada = await db.queryOne<BarisDb>(`SELECT * FROM aleta_kamus_variabel WHERE no_var = ?`, [noVar]);
  if (!ada) throw new ApiError(404, `#${noVar}# tidak ada di kamus.`);
  const pada = new Date().toISOString();

  if (masukan.kembalikan === true) {
    const semua = await db.queryAll<BarisDb>(`SELECT * FROM aleta_kamus_variabel`);
    const petaBenih = new Map(BENIH.variabel.map((b) => [b.k, b]));
    const peta = new Map(semua.map((b) => [teks(b.no_var), keDefinisi(b, petaBenih.get(teks(b.no_var)))]));
    const u = uraiVariabel(peta.get(noVar)!, peta);
    await withTransaction(db, async (tx) => {
      await tx.run(
        `UPDATE aleta_kamus_variabel
            SET sumber = ?, sumber_rinci = ?, arti = ?, cermin_sipp = ?, status = ?, disunting_oleh = '', disunting_at = ''
          WHERE no_var = ?`,
        [u.sumber, u.sumberRinci, u.arti, u.cermin, u.status, noVar]
      );
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "RESET_ABT_VARIABLE_DICTIONARY_ENTRY",
        entityType: "aleta_kamus_variabel",
        entityId: noVar,
        payload: { noVar },
      });
    });
  } else {
    const arti = teks(masukan.arti);
    const sumber = teks(masukan.sumber) as SumberVariabel;
    const sumberRinci = teks(masukan.sumberRinci);
    const cerminMentah = teks(masukan.cermin);
    const cermin = kunciCerminSah(cerminMentah);
    if (!arti) throw new ApiError(400, "Arti tidak boleh kosong.");
    if (arti.length > 600) throw new ApiError(400, "Arti paling panjang 600 huruf.");
    if (!SUMBER_VARIABEL.includes(sumber)) throw new ApiError(400, `Sumber harus salah satu dari: ${SUMBER_VARIABEL.join(", ")}.`);
    if (sumberRinci.length > 400) throw new ApiError(400, "Rincian sumber paling panjang 400 huruf.");
    if (cerminMentah && !cermin) throw new ApiError(400, `Cermin SIPP "${cerminMentah}" tidak dikenal.`);
    await withTransaction(db, async (tx) => {
      await tx.run(
        `UPDATE aleta_kamus_variabel
            SET arti = ?, sumber = ?, sumber_rinci = ?, cermin_sipp = ?, disunting_oleh = ?, disunting_at = ?
          WHERE no_var = ?`,
        [arti, sumber, sumberRinci, cermin, String(actor.id), pada, noVar]
      );
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "UPDATE_ABT_VARIABLE_DICTIONARY_ENTRY",
        entityType: "aleta_kamus_variabel",
        entityId: noVar,
        payload: { noVar, arti, sumber, sumberRinci, cermin },
      });
    });
  }
  const baru = await db.queryOne<BarisDb>(`SELECT * FROM aleta_kamus_variabel WHERE no_var = ?`, [noVar]);
  return keButir(baru!);
}

// ============================================================================
// B1 - NILAI SIPP TERKINI UNTUK VARIABEL BERCERMIN DI HALAMAN BLANGKO
// ============================================================================

export type ButirCekSipp = {
  kode: string;
  nama: string;
  jenis: string;
  status: StatusVariabel;
  cermin: string;
  label: string;
  /** Variabel otomatis yang menjadi acuan isian manual ("" = dirinya sendiri). */
  acuan: string;
  terbaca: boolean;
  nilaiSipp: string;
  sebab: string;
};

const BULAN_INGGRIS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Jembatan bot mengubah kolom DATE menjadi String(Date) ("Mon Oct 12 2026
 * 00:00:00 GMT+0800 (...)"). Tanggalnya diambil dari tulisannya sendiri -
 * bukan lewat new Date() - supaya zona waktu portal tidak menggesernya.
 */
export function rapikanNilaiJembatan(nilai: unknown): string {
  const t = String(nilai ?? "").trim();
  const m = t.match(/^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT/);
  if (!m) return t;
  const bulan = BULAN_INGGRIS[m[1].toLowerCase()];
  if (!bulan) return t;
  const tanggal = `${m[3]}-${bulan}-${m[2]}`;
  return m[4] === "00" && m[5] === "00" && m[6] === "00" ? tanggal : `${tanggal} ${m[4]}:${m[5]}:${m[6]}`;
}

const NAMA_SAH = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const KOLOM_SAH = /^(?:[A-Za-z_][A-Za-z0-9_]{0,63}|(?:max|min|sum|count)\([A-Za-z_][A-Za-z0-9_]{0,63}\))$/i;

/** Kueri data_sipp persis seperti Abt_model::get_data_variabel - termasuk urutan pihak. */
export function kueriDataSipp(tabel: string, kolom: string, urutan: string): string | null {
  if (!NAMA_SAH.test(tabel) || !KOLOM_SAH.test(kolom)) return null;
  const u = /^\d{1,3}$/.test(urutan) ? ` and urutan=${urutan}` : "";
  return `select ${kolom} as data from ${tabel} where perkara_id=#perkara_id#${u} limit 1`;
}

type JawabanKueri = { ada?: boolean; kosong?: boolean; nilai?: unknown; sebab?: string };

const BATAS_KUERI_CEK = 40;

export async function nilaiSippUntukCek(
  db: AletaDatabase,
  masukan: { perkaraId: unknown; kode: unknown }
): Promise<{ perkaraId: string; butir: ButirCekSipp[]; jumlahKueri: number }> {
  const perkaraId = teks(masukan.perkaraId);
  if (!/^\d{1,12}$/.test(perkaraId)) throw new ApiError(400, "perkaraId harus angka.");
  const daftarKode = [
    ...new Set(
      String(masukan.kode ?? "")
        .split(",")
        .map((x) => x.trim().replace(/#/g, ""))
        .filter((x) => /^\d{4,5}$/.test(x))
    ),
  ].slice(0, 400);
  if (!daftarKode.length) return { perkaraId, butir: [], jumlahKueri: 0 };

  const bercermin = await db.queryAll<BarisDb>(`SELECT * FROM aleta_kamus_variabel WHERE cermin_sipp <> ''`);
  const peta = new Map(bercermin.map((b) => [teks(b.no_var), b]));
  const kandidat = bercermin.map((b) => ({
    noVar: teks(b.no_var),
    jenis: teks(b.jenis).toLowerCase(),
    status: teks(b.status),
    cermin: teks(b.cermin_sipp),
    // Sarang dari KUERI saja: kolom bersarang 0033 ikut menyebut penanda di
    // NAMA ("Nama Kuasa #0046#"), yang tidak pernah dijalankan.
    bersarang: rujukanVariabel(String(b.sql_query ?? ""), teks(b.no_var)),
  }));

  const nilai = new Map<string, { terbaca: boolean; nilai: string; sebab: string }>();
  let jumlahKueri = 0;

  async function hitung(kode: string): Promise<{ terbaca: boolean; nilai: string; sebab: string }> {
    const ada = nilai.get(kode);
    if (ada) return ada;
    const b = peta.get(kode);
    let hasil: { terbaca: boolean; nilai: string; sebab: string };
    if (!b) hasil = { terbaca: false, nilai: "", sebab: "tidak ada di kamus" };
    else if (jumlahKueri >= BATAS_KUERI_CEK) hasil = { terbaca: false, nilai: "", sebab: "batas pembacaan SIPP sekali periksa tercapai" };
    else {
      const jenis = teks(b.jenis).toLowerCase();
      const bersarang = rujukanVariabel(String(b.sql_query ?? ""), kode);
      let sql: string | null = null;
      if (jenis === "data_sipp") sql = kueriDataSipp(teks(b.data_tabel), teks(b.data_kolom), teks(b.urutan_data));
      else if (jenis === "data_sql" && !bersarang.length) sql = String(b.sql_query ?? "").trim() || null;

      if (jenis === "data_sql" && bersarang.length) {
        const s = await selesaikanPenanda(db, { perkaraId, penanda: [kode] });
        jumlahKueri += s.jumlahKueri;
        const v = s.nilai.get(kode);
        hasil = v
          ? { terbaca: true, nilai: rapikanNilaiJembatan(v.nilai), sebab: "" }
          : { terbaca: false, nilai: "", sebab: s.gagal.find((g) => g.noVar === kode)?.sebab || "variabel turunannya belum dapat dihitung" };
      } else if (!sql) {
        hasil = { terbaca: false, nilai: "", sebab: "definisinya tidak dapat dijalankan ulang" };
      } else {
        jumlahKueri += 1;
        const j = await callAletaBotSippBridge<JawabanKueri>("kamus.jalankanKueri", { sql, perkaraId });
        if (!j.ok || !j.data?.ada) hasil = { terbaca: false, nilai: "", sebab: teks(j.data?.sebab) || teks(j.error) || "SIPP tidak terbaca" };
        else hasil = { terbaca: true, nilai: rapikanNilaiJembatan(j.data?.nilai), sebab: "" };
      }
    }
    nilai.set(kode, hasil);
    return hasil;
  }

  const butir: ButirCekSipp[] = [];
  for (const kode of daftarKode) {
    const b = peta.get(kode);
    if (!b) continue;
    const jenis = teks(b.jenis).toLowerCase();
    const status = teks(b.status) as StatusVariabel;
    const cermin = teks(b.cermin_sipp);
    const label = kunciCerminSah(cermin) ? CERMIN_SIPP[kunciCerminSah(cermin) as keyof typeof CERMIN_SIPP] : cermin;
    const otomatis = (status === "otomatis" || status === "rawan-petik") && (jenis === "data_sipp" || jenis === "data_sql");
    const manual = status === "manual" && (jenis === "data_teks" || jenis === "data_tanggal");
    if (!otomatis && !manual) continue;
    let acuan = "";
    if (manual) {
      acuan = pilihAcuan(kandidat, cermin);
      if (!acuan) {
        butir.push({ kode, nama: teks(b.nama), jenis, status, cermin, label, acuan: "", terbaca: false, nilaiSipp: "", sebab: "belum ada variabel otomatis acuan untuk cermin ini" });
        continue;
      }
    }
    const h = await hitung(acuan || kode);
    butir.push({ kode, nama: teks(b.nama), jenis, status, cermin, label, acuan, terbaca: h.terbaca, nilaiSipp: h.nilai, sebab: h.sebab });
  }
  return { perkaraId, butir, jumlahKueri };
}
