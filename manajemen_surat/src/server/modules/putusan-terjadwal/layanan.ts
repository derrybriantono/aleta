import { hariLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  BATAS,
  LANGKAH_TERJADWAL,
  NAMA_LANGKAH,
  acakBenih,
  awalJendelaBerikut,
  benihBaru,
  bersihkanPilihanForm,
  dalamJendela,
  hhmmSah,
  isoDariMs,
  msDariIso,
  msKeWita,
  ringkasPilihanForm,
  sebutWaktuWita,
  susunJadwal,
  witaKeMs,
  type HasilJadwal,
  type PilihanForm,
  type PilihanJamKerja,
  type StatusLangkah,
} from "@/lib/putusan-terjadwal";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { PERAN_PENGAWAS_PUTUSAN } from "@/server/modules/aleta-ecourt/hak-milik-perkara";
import { pastikanBolehUnggahPutusan, pastikanMajelisPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import {
  bacaButir,
  bacaPengaturan,
  catatJejak,
  langkahDariBaris,
  pilihanDariBaris,
  sebaris,
  ubahButir,
  type BarisBerkas,
  type BarisButir,
  type BarisJadwal,
} from "./dasar";
import { akarPenyimpanan, hapusBerkas, isiCocokPerkara, periksaBerkas, simpanBerkas } from "./berkas";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - LAYANAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Permintaan hakim: pilih perkara, seret berkas putusannya, pilih jam, lalu
 * ALETA yang mengerjakan pada waktunya. Layanan ini memegang sisi "menjadwalkan
 * dan mengelola": menerima berkas (diperiksa dan disimpan di folder yang
 * di-mount), memasangkannya ke perkara, menyusun jam dengan jeda manusiawi,
 * lalu mencatat butir-butirnya. Yang MENJALANKAN ada di pelaksana.ts (e-Doc,
 * server) dan peramban.ts (isi & simpan Putusan Akhir, ekstensi).
 *
 * ATURAN YANG DIJAGA
 *   - Hak: hanya Super Admin, Admin, dan Hakim (termasuk Ketua/Wakil) - keputusan
 *     9 Okt; hakim hanya perkara majelisnya (keputusan 16 Okt, pastikanMajelisPutusan).
 *   - Dicatat atas akun SIPP milik penjadwal (Manajemen Akun), tidak pernah atas
 *     nama orang lain; tanpa akun yang tertaut jadwal DITOLAK.
 *   - Berkas dari orang lain tidak dapat dipasang; berkas yang isinya menyebut
 *     perkara LAIN tidak dipasang; berkas dipasang ke satu butir saja.
 *   - Satu perkara satu jadwal aktif: perkara yang sudah dijadwalkan (menunggu /
 *     sedang dikerjakan) tidak dijadwalkan lagi.
 *   - Tidak menimpa apa pun: pelaksana memeriksa SIPP tepat sebelum menulis dan
 *     melewati putusan/e-Doc yang sudah ada.
 *   - Tidak ada kata ALETA yang ditulis ke SIPP; di sini hanya catatan ALETA.
 */

export const PERAN_KELOLA_SEMUA: ReadonlySet<string> = new Set(["super-admin", "admin"]);

export type Pelaku = Awaited<ReturnType<typeof pastikanBolehUnggahPutusan>>;

export type DepsLayanan = {
  sekarang?: () => Date;
  periksaMilik?: (pelaku: Pelaku, perkaraId: string) => Promise<void>;
  akunSipp?: (db: AletaDatabase, aktorId: string, diminta?: string) => Promise<{ ok: true; username: string } | { ok: false; pesan: string; kode?: string; milik?: string[] }>;
  muatLibur?: (db: AletaDatabase) => Promise<(iso: string) => boolean>;
};

const SEKARANG = () => new Date();

async function liburBawaan(db: AletaDatabase): Promise<(iso: string) => boolean> {
  try {
    await bacaHariLibur(db);
  } catch {
    /* daftar SKB tetap berlaku */
  }
  const peta = petaLiburBerlaku();
  return (iso) => hariLibur(iso, peta);
}

async function akunBawaan(db: AletaDatabase, aktorId: string, diminta?: string) {
  const r = await akunSippPengguna(db, aktorId, diminta);
  return r.ok ? ({ ok: true, username: r.username } as const) : ({ ok: false, pesan: r.pesan, kode: r.alasan, milik: r.milik } as const);
}

async function milikBawaan(pelaku: Pelaku, perkaraId: string) {
  await pastikanMajelisPutusan(pelaku.actor, pelaku.peran, perkaraId);
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Berkas: diterima, diperiksa, disimpan (belum dipasang)
// ──────────────────────────────────────────────────────────────────────────

export type BerkasTampil = {
  id: string;
  nama: string;
  bentuk: string;
  ukuran: number;
  nomorIsi: string;
  peringatan: string[];
};

const MAKS_BERKAS_TAHAP = 300;

export async function tahapkanBerkas(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { nama: string; bita: Uint8Array },
  deps: { sekarang?: () => Date; akar?: string } = {}
): Promise<{ ok: true; berkas: BerkasTampil } | { ok: false; sebab: string; kode: string }> {
  const kini = (deps.sekarang ?? SEKARANG)();
  const nama = sebaris(String(masukan.nama ?? "").replace(/[\\/]/g, "_"), 200) || "putusan";
  const periksa = await periksaBerkas(masukan.bita, nama);
  if (!periksa.ok) return { ok: false, sebab: periksa.tolak, kode: "berkas_ditolak" };

  const tahap = await db.queryOne<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM aleta_putusan_jadwal_berkas WHERE pemilik_id = ? AND dipakai_butir = '' AND dihapus_pada = ''",
    [pelaku.actor.id]
  );
  if (Number(tahap?.n ?? 0) >= MAKS_BERKAS_TAHAP) {
    return { ok: false, sebab: `Terlalu banyak berkas yang belum dijadwalkan (${MAKS_BERKAS_TAHAP}). Jadwalkan atau buang sebagian dulu.`, kode: "terlalu_banyak" };
  }
  const id = await nextPrefixedId(db, "aleta_putusan_jadwal_berkas", "ptf");
  const jalur = await simpanBerkas(id, periksa.bentuk, masukan.bita, { akar: deps.akar ?? akarPenyimpanan(), kini });
  await db.run(
    `INSERT INTO aleta_putusan_jadwal_berkas
       (id, pemilik_id, nama, bentuk, ukuran, sha256, jalur, nomor_isi, peringatan_json, dipakai_butir, dibuat_pada, dihapus_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, '')`,
    [id, pelaku.actor.id, nama, periksa.bentuk, periksa.ukuran, periksa.sha256, jalur, periksa.nomorIsi, JSON.stringify(periksa.peringatan), kini.toISOString()]
  );
  return { ok: true, berkas: { id, nama, bentuk: periksa.bentuk, ukuran: periksa.ukuran, nomorIsi: periksa.nomorIsi, peringatan: periksa.peringatan } };
}

export async function buangBerkasTahap(
  db: AletaDatabase,
  pelaku: Pelaku,
  id: string,
  deps: { sekarang?: () => Date; akar?: string } = {}
): Promise<{ ok: boolean; sebab?: string }> {
  const b = await db.queryOne<BarisBerkas>("SELECT * FROM aleta_putusan_jadwal_berkas WHERE id = ?", [id]);
  if (!b || b.dihapus_pada) return { ok: true };
  if (b.pemilik_id !== pelaku.actor.id && !isPrivilegedAdmin(pelaku.actor)) throw new ApiError(403, "Berkas ini bukan milik Anda.");
  if (b.dipakai_butir) return { ok: false, sebab: "Berkas ini sudah dipasang ke sebuah jadwal; batalkan perkaranya dulu." };
  await hapusBerkas(b.jalur, deps.akar ?? akarPenyimpanan());
  await db.run("UPDATE aleta_putusan_jadwal_berkas SET dihapus_pada = ?, jalur = '' WHERE id = ?", [((deps.sekarang ?? SEKARANG)()).toISOString(), id]);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Pratinjau dan pembuatan jadwal
// ──────────────────────────────────────────────────────────────────────────

export type MasukanJamKerja = {
  mulai: string;
  batasAkhir?: string;
  jedaMin?: number;
  jedaMaks?: number;
  jamDari?: string;
  jamSampai?: string;
  malamBoleh?: boolean;
  lintasHari?: boolean;
};

export function pilihanJamKerja(m: MasukanJamKerja): PilihanJamKerja {
  return {
    ...(m.jamDari && hhmmSah(m.jamDari) ? { dari: m.jamDari } : {}),
    ...(m.jamSampai && hhmmSah(m.jamSampai) ? { sampai: m.jamSampai } : {}),
    malamBoleh: m.malamBoleh === true,
  };
}

export async function pratinjauJadwal(
  db: AletaDatabase,
  masukan: MasukanJamKerja & { jumlah: number; benih?: number },
  deps: DepsLayanan = {}
): Promise<HasilJadwal & { benih: number }> {
  const libur = await (deps.muatLibur ?? liburBawaan)(db);
  const benih = Number.isFinite(Number(masukan.benih)) && Number(masukan.benih) > 0 ? Math.floor(Number(masukan.benih)) : benihBaru();
  const hasil = susunJadwal({
    jumlah: masukan.jumlah,
    mulai: String(masukan.mulai ?? ""),
    batasAkhir: masukan.batasAkhir ? String(masukan.batasAkhir) : undefined,
    jedaMinDetik: masukan.jedaMin,
    jedaMaksDetik: masukan.jedaMaks,
    jamKerja: pilihanJamKerja(masukan),
    lintasHari: masukan.lintasHari === true,
    libur,
    acak: acakBenih(benih),
  });
  return { ...hasil, benih };
}

export type MasukanButir = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  berkasId?: string;
  langkah: { isi?: boolean; putusan?: boolean; anonim?: boolean };
  pilihan?: unknown;
};

export type MasukanJadwalBaru = MasukanJamKerja & {
  sumber?: "perkara" | "tanggal";
  tanggalAcuan?: string;
  /** Username SIPP; hanya perlu bila penjadwal menyimpan lebih dari satu akun SIPP. */
  akunSipp?: string;
  /** Nama tampil akun SIPP yang sedang masuk di peramban ("Selamat Datang ...") - pembanding saat pengisian dari peramban. */
  namaSipp?: string;
  benih?: number;
  catatan?: string;
  butir: MasukanButir[];
};

export type RingkasButirBaru = {
  id: string;
  urut: number;
  nomorPerkara: string;
  waktuWita: string;
  waktuIso: string;
  langkah: string[];
  ringkasForm: string;
};

export type HasilBuat = {
  jadwalId: string;
  akunSipp: string;
  butir: RingkasButirBaru[];
  peringatan: string[];
};

const POLA_PERKARA_ID = /^\d{1,12}$/;

/**
 * Membuat satu jadwal berisi banyak butir. Semua diperiksa SEBELUM satu baris
 * pun ditulis; bila ada yang tidak sah seluruh jadwal ditolak dengan kalimat
 * yang menyebut perkaranya (tidak ada jadwal separuh jadi).
 */
export async function buatJadwal(
  db: AletaDatabase,
  pelaku: Pelaku,
  ip: string,
  masukan: MasukanJadwalBaru,
  deps: DepsLayanan = {}
): Promise<HasilBuat> {
  const kini = (deps.sekarang ?? SEKARANG)();
  const daftar = Array.isArray(masukan.butir) ? masukan.butir : [];
  if (daftar.length === 0) throw new ApiError(400, "Belum ada perkara yang dipilih.");
  if (daftar.length > BATAS.butirPerJadwal) throw new ApiError(400, `Satu jadwal paling banyak ${BATAS.butirPerJadwal} perkara.`);

  // Akun SIPP penjadwal: tidak pernah menebak (keputusan 2 Okt butir 39).
  const akun = await (deps.akunSipp ?? akunBawaan)(db, pelaku.actor.id, masukan.akunSipp);
  if (!akun.ok) throw new ApiError(400, akun.pesan, { kode: akun.kode ?? "akun_sipp", milik: akun.milik ?? [] });
  const namaSipp = sebaris(masukan.namaSipp, 160);

  // Pemeriksaan per butir (berkas, perkara ganda, hak majelis).
  const sudahDipilih = new Set<string>();
  const berkasDipakai = new Set<string>();
  const barisBerkas = new Map<string, BarisBerkas>();
  const bersih: Array<{ m: MasukanButir; id: string; berkas: BarisBerkas | null; langkah: Record<"isi" | "putusan" | "anonim", boolean>; pilihan: PilihanForm }> = [];
  for (const [i, m] of daftar.entries()) {
    const perkaraId = String(m.perkaraId ?? "").trim();
    const nomor = sebaris(m.nomorPerkara, 120);
    const sebut = nomor || `perkara ke-${i + 1}`;
    if (!POLA_PERKARA_ID.test(perkaraId) || !nomor) throw new ApiError(400, `${sebut}: nomor perkara atau nomor induknya belum terbaca.`);
    if (sudahDipilih.has(perkaraId)) throw new ApiError(400, `${sebut} terpilih dua kali dalam jadwal ini.`);
    sudahDipilih.add(perkaraId);
    const langkah = { isi: m.langkah?.isi === true, putusan: m.langkah?.putusan === true, anonim: m.langkah?.anonim === true };
    if (!langkah.isi && !langkah.putusan && !langkah.anonim) throw new ApiError(400, `${sebut}: belum ada langkah yang dipilih.`);

    const aktif = await db.queryOne<{ id: string; waktu_rencana: string }>(
      "SELECT id, waktu_rencana FROM aleta_putusan_jadwal_butir WHERE perkara_id = ? AND status IN ('menunggu', 'jalan') LIMIT 1",
      [perkaraId]
    );
    if (aktif) {
      throw new ApiError(409, `${sebut} sudah dijadwalkan (${sebutWaktuWita(msDariIso(aktif.waktu_rencana))}). Batalkan jadwal itu dulu bila ingin menggantinya.`);
    }

    let berkas: BarisBerkas | null = null;
    const berkasId = String(m.berkasId ?? "").trim();
    if ((langkah.putusan || langkah.anonim) && !berkasId) {
      throw new ApiError(400, `${sebut}: e-Doc putusan/anonimisasi dipilih tetapi berkas putusannya belum dipasang.`);
    }
    if (berkasId) {
      if (berkasDipakai.has(berkasId)) throw new ApiError(400, `Satu berkas tidak dapat dipasang ke dua perkara (${sebut}).`);
      berkasDipakai.add(berkasId);
      berkas = (await db.queryOne<BarisBerkas>("SELECT * FROM aleta_putusan_jadwal_berkas WHERE id = ?", [berkasId])) ?? null;
      if (!berkas || berkas.dihapus_pada || !berkas.jalur) throw new ApiError(400, `${sebut}: berkas yang dipasang sudah tidak ada. Seret ulang berkasnya.`);
      if (berkas.pemilik_id !== pelaku.actor.id) throw new ApiError(403, `${sebut}: berkas itu diunggah orang lain dan tidak dapat Anda pasang.`);
      if (berkas.dipakai_butir) throw new ApiError(409, `${sebut}: berkas "${berkas.nama}" sudah dipasang ke jadwal lain.`);
      if (!isiCocokPerkara(berkas.nomor_isi, nomor)) {
        throw new ApiError(
          409,
          `${sebut}: isi berkas "${berkas.nama}" menyebut nomor ${berkas.nomor_isi}, bukan ${nomor}. Berkasnya kemungkinan milik perkara lain, jadi tidak dipasang.`
        );
      }
      barisBerkas.set(berkasId, berkas);
    }
    // Hakim hanya perkara majelisnya; satu-satunya penjaga (sama dengan rute unggah).
    try {
      await (deps.periksaMilik ?? milikBawaan)(pelaku, perkaraId);
    } catch (galat) {
      if (galat instanceof ApiError) throw new ApiError(galat.status, `${sebut}: ${galat.message}`);
      throw galat;
    }
    bersih.push({ m, id: perkaraId, berkas, langkah, pilihan: bersihkanPilihanForm(m.pilihan) });
  }

  // Jam: server menghitung dengan benih yang sama dengan pratinjau.
  const jadwal = await pratinjauJadwal(db, { ...masukan, jumlah: bersih.length }, deps);
  if (!jadwal.ok) throw new ApiError(400, jadwal.sebab || "Jadwal tidak dapat disusun.");
  const awal = witaKeMs(String(masukan.mulai));
  if (Number.isFinite(awal) && jadwal.butir[0] && jadwal.butir[0].ms < kini.getTime() - 60_000) {
    throw new ApiError(400, "Jam mulai sudah lewat. Pilih jam mulai yang akan datang.");
  }

  const jadwalId = await nextPrefixedId(db, "aleta_putusan_jadwal", "ptj");
  const sekarangIso = kini.toISOString();
  const ringkas: RingkasButirBaru[] = [];
  await withTransaction(db, async (tx) => {
    await tx.run(
      `INSERT INTO aleta_putusan_jadwal
         (id, dibuat_oleh, dibuat_nama, peran, akun_sipp, nama_sipp, ip, sumber, tanggal_acuan, mulai_wita, batas_akhir_wita,
          jeda_min, jeda_maks, jam_dari, jam_sampai, malam_boleh, lintas_hari, status, catatan, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?)`,
      [
        jadwalId,
        pelaku.actor.id,
        sebaris(pelaku.actor.name, 160),
        String(pelaku.peran),
        akun.username,
        namaSipp,
        sebaris(ip, 45),
        masukan.sumber === "tanggal" ? "tanggal" : "perkara",
        sebaris(masukan.tanggalAcuan, 10),
        sebaris(masukan.mulai, 16),
        sebaris(masukan.batasAkhir, 16),
        jadwal.jedaMinDetik,
        jadwal.jedaMaksDetik,
        masukan.jamDari && hhmmSah(masukan.jamDari) ? masukan.jamDari : "",
        masukan.jamSampai && hhmmSah(masukan.jamSampai) ? masukan.jamSampai : "",
        masukan.malamBoleh === true ? 1 : 0,
        masukan.lintasHari === true ? 1 : 0,
        sebaris(masukan.catatan, 300),
        sekarangIso,
        sekarangIso,
      ]
    );
    for (const [i, b] of bersih.entries()) {
      const butirId = await nextPrefixedId(tx, "aleta_putusan_jadwal_butir", "ptb");
      const waktu = jadwal.butir[i];
      const st = (dipilih: boolean): StatusLangkah => (dipilih ? "menunggu" : "tidak");
      await tx.run(
        `INSERT INTO aleta_putusan_jadwal_butir
           (id, jadwal_id, urut, perkara_id, nomor_perkara, jenis_perkara, pemilik_id, akun_sipp, nama_sipp, peran, ip, waktu_rencana,
            langkah_isi, langkah_putusan, langkah_anonim, status_isi, status_putusan, status_anonim, status, pilihan_json,
            berkas_id, berkas_nama, berkas_bentuk, berkas_ukuran, berkas_sha256, berkas_jalur, dibuat_pada, diubah_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          butirId,
          jadwalId,
          i + 1,
          b.id,
          sebaris(b.m.nomorPerkara, 120),
          sebaris(b.m.jenisPerkara, 120),
          pelaku.actor.id,
          akun.username,
          namaSipp,
          String(pelaku.peran),
          sebaris(ip, 45),
          waktu.iso,
          b.langkah.isi ? 1 : 0,
          b.langkah.putusan ? 1 : 0,
          b.langkah.anonim ? 1 : 0,
          st(b.langkah.isi),
          st(b.langkah.putusan),
          st(b.langkah.anonim),
          JSON.stringify(b.pilihan),
          b.berkas?.id ?? "",
          b.berkas?.nama ?? "",
          b.berkas?.bentuk ?? "",
          b.berkas?.ukuran ?? 0,
          b.berkas?.sha256 ?? "",
          b.berkas?.jalur ?? "",
          sekarangIso,
          sekarangIso,
        ]
      );
      if (b.berkas) {
        const r = await tx.run("UPDATE aleta_putusan_jadwal_berkas SET dipakai_butir = ? WHERE id = ? AND dipakai_butir = ''", [butirId, b.berkas.id]);
        if (r.changes !== 1) throw new ApiError(409, `Berkas "${b.berkas.nama}" baru saja dipasang ke jadwal lain.`);
      }
      const nama = LANGKAH_TERJADWAL.filter((k) => b.langkah[k]).map((k) => NAMA_LANGKAH[k]);
      ringkas.push({
        id: butirId,
        urut: i + 1,
        nomorPerkara: sebaris(b.m.nomorPerkara, 120),
        waktuWita: waktu.wita.slice(0, 16),
        waktuIso: waktu.iso,
        langkah: nama,
        ringkasForm: ringkasPilihanForm(b.pilihan),
      });
    }
  });

  // Jejak jujur: siapa menjadwalkan, kapan, untuk perkara apa, jam berapa.
  const pelakuTeks = `pengguna: ${sebaris(pelaku.actor.name, 120)}`;
  await catatJejak(db, {
    jadwalId,
    peristiwa: "dijadwalkan",
    pelaku: pelakuTeks,
    pelakuId: pelaku.actor.id,
    akunSipp: akun.username,
    hasil: "ok",
    ringkas: `${ringkas.length} perkara dijadwalkan, ${ringkas[0].waktuWita} sampai ${ringkas[ringkas.length - 1].waktuWita} WITA`,
    rinci: { ip: sebaris(ip, 45), peran: String(pelaku.peran), sumber: masukan.sumber ?? "perkara", jeda: [jadwal.jedaMinDetik, jadwal.jedaMaksDetik] },
    audit: { aksi: "PUTUSAN_TERJADWAL_DIBUAT", aktorId: pelaku.actor.id, entitas: jadwalId },
    kini,
  });
  for (const r of ringkas) {
    await catatJejak(db, {
      jadwalId,
      butirId: r.id,
      nomorPerkara: r.nomorPerkara,
      peristiwa: "dijadwalkan",
      pelaku: pelakuTeks,
      pelakuId: pelaku.actor.id,
      akunSipp: akun.username,
      hasil: "ok",
      ringkas: `${r.nomorPerkara}: ${r.langkah.join(", ")} pada ${r.waktuWita} WITA`,
      kini,
    });
  }
  return { jadwalId, akunSipp: akun.username, butir: ringkas, peringatan: jadwal.peringatan };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Daftar dan pengelolaan
// ──────────────────────────────────────────────────────────────────────────

export type ButirTampil = {
  id: string;
  jadwalId: string;
  urut: number;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  waktuIso: string;
  waktuWita: string;
  waktuSebut: string;
  langkah: Record<"isi" | "putusan" | "anonim", boolean>;
  status: string;
  statusLangkah: Record<"isi" | "putusan" | "anonim", StatusLangkah>;
  catatan: Record<"isi" | "putusan" | "anonim", string>;
  statusButir: string;
  pilihan: PilihanForm;
  ringkasForm: string;
  berkasNama: string;
  berkasBentuk: string;
  berkasAda: boolean;
  menungguPeramban: boolean;
  dapatBatal: boolean;
  dapatUlang: boolean;
  dilihat: boolean;
  pemilikId: string;
  akunSipp: string;
  selesaiPada: string;
};

export type JadwalTampil = {
  id: string;
  dibuatNama: string;
  dibuatPada: string;
  sumber: string;
  tanggalAcuan: string;
  mulaiWita: string;
  batasAkhirWita: string;
  jedaMin: number;
  jedaMaks: number;
  status: string;
  akunSipp: string;
  butir: ButirTampil[];
};

export function petakanButir(b: BarisButir, kini: Date): ButirTampil {
  const langkah = langkahDariBaris(b);
  const pilihan = pilihanDariBaris(b);
  const waktu = msDariIso(b.waktu_rencana);
  const lewatKlaim = b.status === "jalan" && b.klaim_sampai !== "" && msDariIso(b.klaim_sampai) < kini.getTime();
  const selesaiAkhir = ["selesai", "sebagian", "gagal", "dibatalkan"].includes(b.status);
  return {
    id: b.id,
    jadwalId: b.jadwal_id,
    urut: b.urut,
    perkaraId: b.perkara_id,
    nomorPerkara: b.nomor_perkara,
    jenisPerkara: b.jenis_perkara,
    waktuIso: b.waktu_rencana,
    waktuWita: Number.isFinite(waktu) ? msKeWita(waktu).slice(0, 16) : "",
    waktuSebut: Number.isFinite(waktu) ? sebutWaktuWita(waktu) : "",
    langkah: { isi: b.langkah_isi === 1, putusan: b.langkah_putusan === 1, anonim: b.langkah_anonim === 1 },
    status: b.status,
    statusLangkah: langkah,
    catatan: { isi: b.catatan_isi, putusan: b.catatan_putusan, anonim: b.catatan_anonim },
    statusButir: b.status,
    pilihan,
    ringkasForm: ringkasPilihanForm(pilihan),
    berkasNama: b.berkas_nama,
    berkasBentuk: b.berkas_bentuk,
    berkasAda: b.berkas_jalur !== "",
    // Pengisian Putusan Akhir menunggu ekstensi di SIPP yang terbuka; sudah lewat waktunya tetapi belum diambil.
    menungguPeramban: b.status === "menunggu" && langkah.isi === "menunggu" && Number.isFinite(waktu) && waktu <= kini.getTime() - 3 * 60_000,
    dapatBatal: b.status === "menunggu" || lewatKlaim,
    dapatUlang: (b.status === "sebagian" || b.status === "gagal") && b.berkas_jalur !== "" || (b.status === "gagal" && b.langkah_isi === 1 && b.berkas_jalur === ""),
    dilihat: !selesaiAkhir || b.dilihat_pada !== "",
    pemilikId: b.pemilik_id,
    akunSipp: b.akun_sipp,
    selesaiPada: b.selesai_pada,
  };
}

export type RingkasanDaftar = Record<"menunggu" | "jalan" | "selesai" | "sebagian" | "gagal" | "dibatalkan", number> & { belumDilihat: number; menungguPeramban: number };

export function bolehLihatSemua(peran: string): boolean {
  return PERAN_PENGAWAS_PUTUSAN.has(String(peran));
}

export async function daftarJadwal(
  db: AletaDatabase,
  pelaku: Pelaku,
  opsi: { semua?: boolean; batas?: number; hanyaAktif?: boolean } = {},
  deps: { sekarang?: () => Date } = {}
): Promise<{ jadwal: JadwalTampil[]; ringkasan: RingkasanDaftar }> {
  const kini = (deps.sekarang ?? SEKARANG)();
  const batas = Math.min(Math.max(Math.floor(Number(opsi.batas) || 30), 1), 100);
  const lihatSemua = opsi.semua === true && bolehLihatSemua(String(pelaku.peran));
  const baris = await db.queryAll<BarisJadwal>(
    lihatSemua
      ? "SELECT * FROM aleta_putusan_jadwal ORDER BY dibuat_pada DESC LIMIT ?"
      : "SELECT * FROM aleta_putusan_jadwal WHERE dibuat_oleh = ? ORDER BY dibuat_pada DESC LIMIT ?",
    lihatSemua ? [batas] : [pelaku.actor.id, batas]
  );
  const ringkasan: RingkasanDaftar = { menunggu: 0, jalan: 0, selesai: 0, sebagian: 0, gagal: 0, dibatalkan: 0, belumDilihat: 0, menungguPeramban: 0 };
  const hasil: JadwalTampil[] = [];
  for (const j of baris) {
    const butir = (await db.queryAll<BarisButir>("SELECT * FROM aleta_putusan_jadwal_butir WHERE jadwal_id = ? ORDER BY urut ASC", [j.id])).map((b) => petakanButir(b, kini));
    if (opsi.hanyaAktif && !butir.some((b) => ["menunggu", "jalan"].includes(b.status) || !b.dilihat)) continue;
    for (const b of butir) {
      const kunci = b.status as keyof RingkasanDaftar;
      if (kunci in ringkasan && typeof ringkasan[kunci] === "number") ringkasan[kunci] += 1;
      if (!b.dilihat) ringkasan.belumDilihat += 1;
      if (b.menungguPeramban) ringkasan.menungguPeramban += 1;
    }
    hasil.push({
      id: j.id,
      dibuatNama: j.dibuat_nama,
      dibuatPada: j.dibuat_pada,
      sumber: j.sumber,
      tanggalAcuan: j.tanggal_acuan,
      mulaiWita: j.mulai_wita,
      batasAkhirWita: j.batas_akhir_wita,
      jedaMin: j.jeda_min,
      jedaMaks: j.jeda_maks,
      status: j.status,
      akunSipp: j.akun_sipp,
      butir,
    });
  }
  return { jadwal: hasil, ringkasan };
}

export type AksiKelola = "batal" | "batal-jadwal" | "tunda" | "jadwal-ulang" | "ulang" | "lihat";

function bolehKelola(pelaku: Pelaku, pemilikId: string) {
  return pemilikId === pelaku.actor.id || PERAN_KELOLA_SEMUA.has(String(pelaku.peran)) || isPrivilegedAdmin(pelaku.actor);
}

async function jendelaJadwal(db: AletaDatabase, jadwalId: string) {
  const j = await db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [jadwalId]);
  const pil: PilihanJamKerja = {
    ...(j?.jam_dari && hhmmSah(j.jam_dari) ? { dari: j.jam_dari } : {}),
    ...(j?.jam_sampai && hhmmSah(j.jam_sampai) ? { sampai: j.jam_sampai } : {}),
    malamBoleh: j?.malam_boleh === 1,
  };
  return { j, pil };
}

/** Mengelola satu butir / satu jadwal. Melempar ApiError berkalimat awam. */
export async function kelola(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { aksi: AksiKelola; id: string; menit?: number; wita?: string },
  deps: DepsLayanan & { akar?: string } = {}
): Promise<{ ok: true; ringkas: string; butir?: ButirTampil }> {
  const kini = (deps.sekarang ?? SEKARANG)();
  const libur = await (deps.muatLibur ?? liburBawaan)(db);
  const pelakuTeks = `pengguna: ${sebaris(pelaku.actor.name, 120)}`;
  const jejak = (b: BarisButir, peristiwa: string, ringkas: string) =>
    catatJejak(db, {
      jadwalId: b.jadwal_id,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      peristiwa,
      pelaku: pelakuTeks,
      pelakuId: pelaku.actor.id,
      akunSipp: b.akun_sipp,
      hasil: "ok",
      ringkas,
      audit: { aksi: `PUTUSAN_TERJADWAL_${peristiwa.toUpperCase().replace(/-/g, "_")}`, aktorId: pelaku.actor.id, entitas: b.id },
      kini,
    });

  if (masukan.aksi === "batal-jadwal") {
    const j = await db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [masukan.id]);
    if (!j) throw new ApiError(404, "Jadwal tidak ditemukan.");
    if (!bolehKelola(pelaku, j.dibuat_oleh)) throw new ApiError(403, "Jadwal ini bukan milik Anda.");
    const butir = await db.queryAll<BarisButir>("SELECT * FROM aleta_putusan_jadwal_butir WHERE jadwal_id = ? ORDER BY urut ASC", [j.id]);
    let batal = 0;
    let sisa = 0;
    for (const b of butir) {
      if (b.status === "menunggu") {
        await batalkanButir(db, b, kini, deps.akar);
        await jejak(b, "dibatalkan", `${b.nomor_perkara} dibatalkan bersama seluruh jadwal`);
        batal += 1;
      } else if (b.status === "jalan") sisa += 1;
    }
    if (sisa === 0) await db.run("UPDATE aleta_putusan_jadwal SET status = 'dibatalkan', diubah_pada = ? WHERE id = ?", [kini.toISOString(), j.id]);
    return { ok: true, ringkas: `${batal} perkara dibatalkan${sisa ? `; ${sisa} sedang dikerjakan dan dibiarkan selesai` : ""}.` };
  }

  const b = await bacaButir(db, masukan.id);
  if (!b) throw new ApiError(404, "Perkara dalam jadwal tidak ditemukan.");
  if (!bolehKelola(pelaku, b.pemilik_id)) throw new ApiError(403, "Jadwal ini bukan milik Anda.");
  const lewatKlaim = b.status === "jalan" && b.klaim_sampai !== "" && msDariIso(b.klaim_sampai) < kini.getTime();

  switch (masukan.aksi) {
    case "lihat": {
      await ubahButir(db, b.id, { lain: { dilihat_pada: kini.toISOString() } }, { kini });
      return { ok: true, ringkas: "Ditandai sudah dilihat." };
    }
    case "batal": {
      if (b.status === "jalan" && !lewatKlaim) throw new ApiError(409, `${b.nomor_perkara} sedang dikerjakan; tunggu selesai.`);
      if (b.status !== "menunggu" && !lewatKlaim) throw new ApiError(409, `${b.nomor_perkara} sudah ${b.status}, tidak dapat dibatalkan.`);
      await batalkanButir(db, b, kini, deps.akar);
      await jejak(b, "dibatalkan", `${b.nomor_perkara} dibatalkan sebelum dijalankan`);
      return { ok: true, ringkas: `${b.nomor_perkara} dibatalkan.` };
    }
    case "tunda":
    case "jadwal-ulang": {
      if (b.status !== "menunggu") throw new ApiError(409, `${b.nomor_perkara} tidak sedang menunggu, jamnya tidak dapat diubah.`);
      const { pil } = await jendelaJadwal(db, b.jadwal_id);
      let tujuan: number;
      if (masukan.aksi === "tunda") {
        const menit = Math.min(Math.max(Math.round(Number(masukan.menit) || 60), 5), 24 * 60);
        tujuan = Math.max(msDariIso(b.waktu_rencana), kini.getTime()) + menit * 60_000;
      } else {
        tujuan = witaKeMs(String(masukan.wita ?? ""));
        if (!Number.isFinite(tujuan)) throw new ApiError(400, "Jam baru belum sah (YYYY-MM-DD HH:mm).");
        if (tujuan < kini.getTime() - 60_000) throw new ApiError(400, "Jam baru sudah lewat.");
      }
      if (!dalamJendela(tujuan, pil, libur)) {
        if (masukan.aksi === "jadwal-ulang") throw new ApiError(400, "Jam baru di luar jam kerja (atau istirahat/hari libur). Pilih jam di dalam jam kerja.");
        const geser = awalJendelaBerikut(tujuan, pil, libur);
        if (!Number.isFinite(geser)) throw new ApiError(409, "Tidak ada jam kerja dalam 30 hari ke depan.");
        tujuan = geser;
      }
      await ubahButir(db, b.id, { lain: { waktu_rencana: isoDariMs(tujuan), tunggu_sampai: "" } }, { kini, syaratStatus: ["menunggu"] });
      await jejak(b, masukan.aksi === "tunda" ? "ditunda" : "jam-diubah", `${b.nomor_perkara}: jam dipindah ke ${msKeWita(tujuan).slice(0, 16)} WITA`);
      return { ok: true, ringkas: `Jam ${b.nomor_perkara} dipindah ke ${sebutWaktuWita(tujuan)}.` };
    }
    case "ulang": {
      if (b.status !== "sebagian" && b.status !== "gagal") throw new ApiError(409, `${b.nomor_perkara} tidak perlu diulang.`);
      const langkah = langkahDariBaris(b);
      const perlu = LANGKAH_TERJADWAL.filter((k) => langkah[k] === "gagal" || langkah[k] === "tertahan");
      if (perlu.length === 0) throw new ApiError(409, "Tidak ada langkah yang perlu diulang.");
      if ((perlu.includes("putusan") || perlu.includes("anonim")) && b.berkas_jalur === "") {
        throw new ApiError(409, `Berkas ${b.nomor_perkara} sudah dihapus dari penyimpanan; jadwalkan ulang dengan berkas yang diseret lagi.`);
      }
      const { pil } = await jendelaJadwal(db, b.jadwal_id);
      let tujuan = kini.getTime() + 90_000;
      if (!dalamJendela(tujuan, pil, libur)) tujuan = awalJendelaBerikut(tujuan, pil, libur);
      if (!Number.isFinite(tujuan)) throw new ApiError(409, "Tidak ada jam kerja dalam 30 hari ke depan.");
      const perubahan: Parameters<typeof ubahButir>[2] = { lain: { waktu_rencana: isoDariMs(tujuan), percobaan: 0, tunggu_sampai: "", edoc_sesudah: "", selesai_pada: "", klaim_oleh: "", klaim_sampai: "", dilihat_pada: "", berkas_hapus_pada: "" } };
      for (const k of perlu) perubahan[k] = { status: "menunggu", catatan: "diulang atas permintaan petugas" };
      await ubahButir(db, b.id, perubahan, { kini });
      await jejak(b, "diulang", `${b.nomor_perkara}: ${perlu.map((k) => NAMA_LANGKAH[k]).join(", ")} diulang pada ${msKeWita(tujuan).slice(0, 16)} WITA`);
      return { ok: true, ringkas: `${perlu.length} langkah ${b.nomor_perkara} diulang.` };
    }
    default:
      throw new ApiError(400, "Aksi tidak dikenal.");
  }
}

async function batalkanButir(db: AletaDatabase, b: BarisButir, kini: Date, akar?: string) {
  const langkah = langkahDariBaris(b);
  const batal: Partial<Record<"isi" | "putusan" | "anonim", { status: StatusLangkah }>> = {};
  for (const k of LANGKAH_TERJADWAL) if (langkah[k] === "menunggu" || langkah[k] === "jalan") batal[k] = { status: "batal" };
  await ubahButir(
    db,
    b.id,
    { ...batal, dibatalkan: true, lain: { selesai_pada: kini.toISOString(), klaim_oleh: "", klaim_sampai: "", berkas_hapus_pada: new Date(kini.getTime() + 24 * 3600_000).toISOString() } },
    { kini }
  );
  // Berkas yang belum dipakai langkah mana pun tidak perlu ditahan sampai besok - dihapus oleh pembersih terjadwal.
  void akar;
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Pengaturan (Admin / Super Admin)
// ──────────────────────────────────────────────────────────────────────────

export async function simpanPengaturan(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { hapusHari?: unknown; pelaksanaNyala?: unknown },
  deps: { sekarang?: () => Date } = {}
) {
  if (!PERAN_KELOLA_SEMUA.has(String(pelaku.peran)) && !isPrivilegedAdmin(pelaku.actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang mengubah pengaturan unggah putusan terjadwal.");
  }
  const kini = (deps.sekarang ?? SEKARANG)().toISOString();
  const lama = await bacaPengaturan(db);
  const hari = Math.round(Number(masukan.hapusHari ?? lama.hapusHari));
  if (!Number.isFinite(hari) || hari < 1 || hari > BATAS.hapusHariTerlama) {
    throw new ApiError(400, `Hapus berkas harus 1-${BATAS.hapusHariTerlama} hari.`);
  }
  const baru = { hapusHari: hari, pelaksanaNyala: masukan.pelaksanaNyala === undefined ? lama.pelaksanaNyala : masukan.pelaksanaNyala !== false, diubahOleh: sebaris(pelaku.actor.name, 120), diubahPada: kini };
  await db.run(
    "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada",
    ["*sistem*", "sistem:putusan-terjadwal", JSON.stringify(baru), kini]
  );
  await catatJejak(db, {
    peristiwa: "pengaturan",
    pelaku: `pengguna: ${sebaris(pelaku.actor.name, 120)}`,
    pelakuId: pelaku.actor.id,
    hasil: "ok",
    ringkas: `hapus berkas ${baru.hapusHari} hari sesudah selesai; pelaksana server ${baru.pelaksanaNyala ? "menyala" : "dimatikan"}`,
    audit: { aksi: "PUTUSAN_TERJADWAL_PENGATURAN", aktorId: pelaku.actor.id, entitas: "*sistem*:sistem:putusan-terjadwal" },
  });
  return baru;
}
