import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { dalamJendela, isoDariMs, msDariIso } from "@/lib/putusan-terjadwal";
import {
  BATAS_SIDANG,
  NAMA_JENIS,
  basKedaluwarsa,
  tanggalWita,
  tundaKedaluwarsa,
  tungguUlang,
  type JenisSidang,
} from "@/lib/sidang-terjadwal";
import { type AletaDatabase, getDatabase } from "@/server/db/client";
import { nilaiMilikPerkara } from "@/server/modules/aleta-ecourt/hak-milik-perkara";
import { periksaBerkasBas } from "@/server/modules/aleta-ecourt/unggah-massal";
import { sha256 } from "@/server/modules/putusan-terjadwal/berkas";
import { ApiError } from "@/server/shared/errors";

import { PELAKU_SERVER, type BarisSidang, catatJejak, muatanDariBaris, sebaris, ubahButir } from "./dasar";
import { type DepsSidang, depsAsli, type HakSidang } from "./deps";
import { badanTunda, kendalaKeadaanTunda } from "./layanan";

/**
 * ============================================================================
 * PELAKSANA SERVER UNGGAH BAS & TUNDAAN TERJADWAL (27 Okt 2026)
 * ============================================================================
 *
 * Berjalan di server portal (detak 30 detik, dinyalakan instrumentation.ts) sehingga
 * laptop petugas tidak perlu menyala. Satu detak = pulihkan yang macet, kedaluwarsakan
 * yang terlambat, bersihkan berkas usang, lalu kerjakan paling banyak SATU pekerjaan
 * yang jatuh tempo.
 *
 * URUTAN PENGAMAN sebelum apa pun ditulis ke SIPP (semuanya dinilai ULANG di sini,
 * dengan aturan yang sama dengan saat menjadwalkan):
 *   1. akun ALETA penjadwal masih aktif dan masih berhak (deps.hak: sama dengan rute
 *      langsung - kapabilitas "panel", sidang.tunda-putus / golongan BAS);
 *   2. tunda: hari sidangnya belum lewat (WITA) - yang terlambat KEDALUWARSA, tidak
 *      pernah ditulis keesokan harinya (JENIS_HARI_SAMA, keputusan 22 Okt);
 *   3. keadaan SIPP dibaca ulang tepat sebelum menulis: tanggal sidang tidak berubah,
 *      belum ditunda/diputus/diberi hasil (tunda) atau e-Doc BAS belum ada (BAS) -
 *      yang sudah ada DILEWATI dan tidak pernah ditimpa; BAS tanpa centang "ganti"
 *      tidak pernah mengganti;
 *   4. BAS: berkas utuh (sha256 sama), isi diperiksa lagi (berita acara perkara ini),
 *      PP hanya perkaranya sendiri;
 *   5. tulis lewat bot: tunda = kering:false + jamKerja:"sekarang" atas PP perkara;
 *      BAS = gatewayUnggahBasSipp atas akun SIPP penjadwal.
 *
 * Galat sementara (bot mati, SIPP terputus) diulang paling banyak 4 kali dengan tunggu
 * yang makin panjang; penolakan tetap = gagal dengan kalimat sebab. Percobaan ulang
 * aman: pemeriksaan (3) menangkap tulisan yang ternyata sudah masuk pada percobaan
 * sebelumnya. Jejak tiap peristiwa ke aleta_sidang_terjadwal_jejak. Tidak ada kata
 * "ALETA" di muatan yang dikirim ke SIPP.
 */

export type HasilButir =
  | { akhir: "selesai" | "dilewati" | "gagal" | "kedaluwarsa"; ringkas: string; rinci?: Record<string, unknown> }
  | { ulang: true; sebab: string };

const akhir = (status: "selesai" | "dilewati" | "gagal" | "kedaluwarsa", ringkas: string, rinci?: Record<string, unknown>): HasilButir => ({ akhir: status, ringkas, rinci });
const ulang = (sebab: string): HasilButir => ({ ulang: true, sebab });

// ──────────────────────────────────────────────────────────────────────────
// Menjalankan satu pekerjaan yang SUDAH diklaim
// ──────────────────────────────────────────────────────────────────────────

/** TIDAK PERNAH melempar; pulang hasil akhir atau permintaan ulang. */
export async function jalankanButir(db: AletaDatabase, deps: DepsSidang, b: BarisSidang): Promise<HasilButir> {
  try {
    const jenis: JenisSidang = b.jenis === "tunda" ? "tunda" : "bas";
    // 1. Akun ALETA penjadwal: masih aktif dan masih berhak (aturan rute langsung).
    let hak: HakSidang;
    try {
      hak = await deps.hak(db, jenis, b.dibuat_oleh);
    } catch (galat) {
      if (galat instanceof ApiError) return akhir("gagal", `Hak penjadwal sudah tidak berlaku: ${galat.message} Tidak ada yang dikirim ke SIPP.`);
      return ulang(`Hak penjadwal belum dapat dipastikan (${sebaris((galat as Error)?.message, 120)}).`);
    }
    return jenis === "tunda" ? await jalankanTunda(db, deps, b, hak) : await jalankanBas(deps, b, hak);
  } catch (galat) {
    return akhir("gagal", `Error tak terduga: ${sebaris((galat as Error)?.message ?? galat, 200)}`);
  }
}

const SAMA_ATAU_LEWAT_TEKS = "e-Doc yang sudah ada tidak diganti";

async function jalankanTunda(db: AletaDatabase, deps: DepsSidang, b: BarisSidang, hak: HakSidang): Promise<HasilButir> {
  const muatan = muatanDariBaris(b).tunda;
  if (!muatan) return akhir("gagal", "Isian penundaan tersimpan rusak; jadwalkan ulang dari awal.");
  const kini = deps.sekarang().getTime();
  // 2. Tunda tidak pernah pindah hari.
  if (tundaKedaluwarsa(b.tanggal_sidang, kini)) {
    return akhir("kedaluwarsa", `Hari sidang (${b.tanggal_sidang}) sudah lewat sebelum penundaan sempat ditulis; tidak ditulis di hari lain.`);
  }
  let libur: string | null;
  try {
    libur = await deps.tolakLibur(db, muatan.tanggalBerikut);
  } catch (galat) {
    return ulang(`Daftar hari libur belum terbaca (${sebaris((galat as Error)?.message, 120)}).`);
  }
  if (libur) return akhir("gagal", libur);

  // 3. Keadaan SIPP sekarang.
  const keadaan = await deps.keadaanSidang(b.jadwal_id);
  if (!keadaan.ok) {
    return keadaan.sementara ? ulang(`Keadaan sidang di SIPP belum terbaca (${sebaris(keadaan.sebab, 160)}).`) : akhir("gagal", keadaan.sebab);
  }
  const kendala = kendalaKeadaanTunda(keadaan.data, b.perkara_id, b.nomor_perkara, b.tanggal_sidang);
  if (kendala) {
    return kendala.lewati
      ? akhir("dilewati", `${kendala.sebab}${b.percobaan > 0 ? " (kemungkinan tertulis pada percobaan sebelumnya)" : ""} Tidak ditulis ulang.`)
      : akhir("gagal", kendala.sebab);
  }

  // 5. Tulis sekarang, atas PP perkara (diturunkan bot); penekan sebenarnya hanya untuk jejak.
  const tulis = await deps.tulisTunda(
    badanTunda({
      jadwalId: b.jadwal_id,
      perkaraId: b.perkara_id,
      muatan,
      aktorId: hak.aktor.id,
      aktorNama: sebaris(hak.aktor.name || hak.aktor.email || hak.aktor.id, 160),
      akunSipp: b.akun_sipp,
      ip: b.ip,
      kering: false,
    })
  );
  if (tulis.ok) {
    const d = tulis.data;
    const berikut = (d.sidangBerikutnya ?? {}) as { tanggal?: unknown; jam?: unknown };
    return akhir("selesai", `Sidang ditunda ke ${muatan.tanggalBerikut} pukul ${muatan.jamBerikut}.`, {
      sidangBerikutnya: { tanggal: sebaris(berikut.tanggal, 20), jam: sebaris(berikut.jam, 10) },
      atasNama: sebaris((d.atasNama as { username?: unknown } | undefined)?.username, 60),
    });
  }
  if (tulis.kode === "sidang_sudah_ditunda" || tulis.kode === "sidang_sudah_diberi_hasil" || tulis.kode === "perkara_sudah_diputus") {
    return akhir("dilewati", `${sebaris(tulis.sebab, 300)} Tidak ditulis ulang.`);
  }
  if (tulis.sementara) return ulang(tulis.sebab);
  return akhir("gagal", tulis.dipulihkan === false ? sebaris(tulis.sebab, 400) : sebaris(tulis.sebab, 300));
}

async function jalankanBas(deps: DepsSidang, b: BarisSidang, hak: HakSidang): Promise<HasilButir> {
  const ganti = muatanDariBaris(b).bas?.ganti === true;
  // 4. Berkas utuh dan isinya diperiksa lagi (sama dengan rute langsung).
  if (!b.berkas_jalur) return akhir("gagal", "Berkas BAS tidak ada lagi di penyimpanan (sudah dihapus); jadwalkan ulang dengan berkas yang diseret lagi.");
  const berkas = await deps.bacaBerkas(b.berkas_jalur);
  if (!berkas) return akhir("gagal", "Berkas BAS tidak ditemukan di penyimpanan (hilang); jadwalkan ulang dengan berkas yang diseret lagi.");
  if (b.berkas_sha256 && sha256(berkas) !== b.berkas_sha256) return akhir("gagal", "Isi berkas berubah sejak diunggah (sidik jari tidak sama); tidak dikirim ke SIPP.");
  const bita = buangGrupTersembunyiRtf(berkas);
  const periksa = periksaBerkasBas(bita, b.nomor_perkara);
  if (periksa.tolak) return akhir("gagal", periksa.tolak);

  // 3. Keadaan SIPP sekarang (dan hak PP atas perkara ini).
  const cek = await deps.cekBas(b.perkara_id, b.jadwal_id);
  if (!cek.ok) {
    return cek.sementara ? ulang(`Keadaan BAS di SIPP belum terbaca (${sebaris(cek.sebab, 160)}).`) : akhir("gagal", "Sidang ini tidak ditemukan pada perkara tersebut di SIPP.");
  }
  if (cek.data.tanggalSidang && cek.data.tanggalSidang !== b.tanggal_sidang) {
    return akhir("gagal", `Tanggal sidang di SIPP ${cek.data.tanggalSidang}, bukan ${b.tanggal_sidang} (jadwalnya sudah diubah); tidak dikirim.`);
  }
  const milik = nilaiMilikPerkara({ jenis: "bas", namaAkun: String(hak.aktor.name || ""), pengawas: hak.pengawas, petugas: cek.data.panitera });
  if (!milik.ok) return milik.status === 502 ? ulang(milik.pesan) : akhir("gagal", milik.pesan);
  if (cek.data.adaBas && !ganti) {
    return akhir("dilewati", `e-Doc BAS sidang ini sudah ada di SIPP${cek.data.jalur ? ` (${cek.data.jalur})` : ""}${b.percobaan > 0 ? " (kemungkinan tertulis pada percobaan sebelumnya)" : ""}; ${SAMA_ATAU_LEWAT_TEKS}.`);
  }

  // 5. Unggah lewat bot atas akun SIPP penjadwal.
  const r = await deps.unggahBas({
    perkaraId: b.perkara_id,
    sidangId: b.jadwal_id,
    nomorPerkara: b.nomor_perkara,
    basBase64: Buffer.from(bita).toString("base64"),
    olehUsername: b.akun_sipp,
    operator: sebaris(hak.aktor.name || hak.aktor.email || hak.aktor.id, 120),
    ip: b.ip,
    peranPenekan: hak.peran,
    // Lapis kedua di bot: PP diterima hanya bila portal sudah memastikan ia PP perkara ini (dinilai di atas).
    milikPerkara: true,
    ganti,
  });
  if (r.ok) {
    const d = r.data;
    const urutan = Number(d.urutan) || 0;
    return akhir("selesai", `BAS${urutan ? ` sidang ke-${urutan}` : ""} terunggah ke SIPP${d.diganti === true ? " (menggantikan yang lama)" : ""}.`, {
      nama: sebaris(d.nama, 120),
      urutan,
      bentuk: sebaris(d.bentuk, 10),
      diganti: d.diganti === true,
    });
  }
  if (r.kode === "sudah_ada") return akhir("dilewati", `${sebaris(r.sebab, 300)}${b.percobaan > 0 ? " (kemungkinan tertulis pada percobaan sebelumnya)" : ""}`);
  if (r.sementara) return ulang(r.sebab);
  return akhir("gagal", sebaris(r.sebab, 300));
}

// ──────────────────────────────────────────────────────────────────────────
// Menutup satu pekerjaan
// ──────────────────────────────────────────────────────────────────────────

/** Menetapkan status akhir (atau menjadwal ulang percobaan), jadwal penghapusan berkas, dan jejak. */
export async function terapkanHasil(
  db: AletaDatabase,
  b: BarisSidang,
  hasil: HasilButir,
  opsi: { kini: Date; pelaku?: string; syaratStatus?: string[] }
): Promise<BarisSidang | null> {
  const { kini } = opsi;
  const pelaku = opsi.pelaku ?? PELAKU_SERVER;
  const jenis: JenisSidang = b.jenis === "tunda" ? "tunda" : "bas";
  const syaratStatus = opsi.syaratStatus ?? ["jalan"];
  if ("ulang" in hasil) {
    const percobaan = b.percobaan + 1;
    if (percobaan >= BATAS_SIDANG.percobaanMaks) {
      return terapkanHasil(db, { ...b, percobaan }, akhir("gagal", `Gagal setelah ${percobaan} percobaan: ${hasil.sebab}`), { ...opsi, syaratStatus });
    }
    const baru = await ubahButir(
      db,
      b.id,
      {
        status: "menunggu",
        percobaan,
        klaim_oleh: "",
        klaim_sampai: "",
        tunggu_sampai: isoDariMs(kini.getTime() + tungguUlang(percobaan) * 1000),
        hasil_ringkas: sebaris(`Diulang otomatis (percobaan ${percobaan} dari ${BATAS_SIDANG.percobaanMaks}): ${hasil.sebab}`, 500),
      },
      { kini, syaratStatus }
    );
    if (baru) {
      await catatJejak(db, {
        butirId: b.id,
        jenis,
        nomorPerkara: b.nomor_perkara,
        peristiwa: "ditunda-pelaksana",
        pelaku,
        akunSipp: b.akun_sipp,
        hasil: "tertahan",
        ringkas: `${b.nomor_perkara}: ${hasil.sebab} (diulang, percobaan ${percobaan})`,
        kini,
      });
    }
    return baru;
  }
  const hapus = b.berkas_jalur ? { berkas_hapus_pada: new Date(kini.getTime() + BATAS_SIDANG.hapusHari * 24 * 3600_000).toISOString() } : {};
  const baru = await ubahButir(
    db,
    b.id,
    {
      status: hasil.akhir,
      percobaan: b.percobaan,
      klaim_oleh: "",
      klaim_sampai: "",
      tunggu_sampai: "",
      hasil_ringkas: sebaris(hasil.ringkas, 500),
      hasil_json: JSON.stringify(hasil.rinci ?? {}).slice(0, 4000),
      selesai_pada: kini.toISOString(),
      ...hapus,
    },
    { kini, syaratStatus }
  );
  if (!baru) return null;
  await catatJejak(db, {
    butirId: b.id,
    jenis,
    nomorPerkara: b.nomor_perkara,
    peristiwa: hasil.akhir,
    pelaku,
    akunSipp: b.akun_sipp,
    hasil: hasil.akhir === "selesai" ? "ok" : hasil.akhir === "dilewati" ? "dilewati" : hasil.akhir === "kedaluwarsa" ? "tertahan" : "gagal",
    ringkas: `${b.nomor_perkara} ${hasil.akhir}: ${hasil.ringkas}`,
    rinci: { ip: b.ip, ...hasil.rinci },
    audit: { aksi: `SIDANG_TERJADWAL_${hasil.akhir.toUpperCase()}`, aktorId: b.dibuat_oleh, entitas: b.id },
    kini,
  });
  return baru;
}

// ──────────────────────────────────────────────────────────────────────────
// Detak
// ──────────────────────────────────────────────────────────────────────────

export type HasilDetak =
  | { jalan: false; alasan: "dimatikan" | "sedang_berjalan" | "tidak_ada" | "galat"; galat?: string }
  | { jalan: true; butirId: string; nomorPerkara: string; status: string; ringkas: string };

type WadahDetak = { berjalan: boolean; detak: ReturnType<typeof setInterval> | null };
const wadah = (): WadahDetak => {
  const g = globalThis as unknown as { __aletaSidangTerjadwal?: WadahDetak };
  g.__aletaSidangTerjadwal ??= { berjalan: false, detak: null };
  return g.__aletaSidangTerjadwal;
};

/** Pelaksana menyala menurut konfigurasi (ALETA_SIDANG_TERJADWAL=0 mematikan). Dibaca layar untuk peringatan. */
export const pelaksanaNyala = (env: Record<string, string | undefined> = process.env) => env.ALETA_SIDANG_TERJADWAL !== "0";

/** Yang masih "jalan" padahal masa pegangnya habis (proses mati) dikembalikan ke antrean; terlalu sering = gagal. */
export async function pulihkanMacet(db: AletaDatabase, kini: Date): Promise<number> {
  const macet = await db.queryAll<BarisSidang>("SELECT * FROM aleta_sidang_terjadwal WHERE status = 'jalan' AND klaim_sampai <> '' AND klaim_sampai < ?", [kini.toISOString()]);
  let n = 0;
  for (const b of macet) {
    const hasil = await terapkanHasil(
      db,
      b,
      ulang("Pengerjaan sebelumnya terputus di tengah jalan; keadaan SIPP diperiksa dulu sebelum diulang, yang sudah ada tidak ditimpa."),
      { kini }
    );
    if (hasil) n += 1;
  }
  return n;
}

/**
 * Tunda yang hari sidangnya sudah lewat (WITA) dan BAS yang jam rencananya sudah lewat BATAS_SIDANG.kedaluwarsaBasHari hari
 * tetapi belum dikerjakan (server mati lama): dinyatakan kedaluwarsa, TIDAK ditulis diam-diam pada hari yang tak diduga.
 */
export async function kedaluwarsakan(db: AletaDatabase, kini: Date): Promise<number> {
  const hariIni = tanggalWita(kini.getTime());
  const lama = await db.queryAll<BarisSidang>(
    "SELECT * FROM aleta_sidang_terjadwal WHERE status = 'menunggu' AND ((jenis = 'tunda' AND tanggal_sidang < ?) OR (jenis = 'bas' AND waktu_rencana < ?)) LIMIT 25",
    [hariIni, new Date(kini.getTime() - BATAS_SIDANG.kedaluwarsaBasHari * 24 * 3600_000).toISOString()]
  );
  let n = 0;
  for (const b of lama) {
    const tunda = b.jenis === "tunda";
    if (tunda ? !tundaKedaluwarsa(b.tanggal_sidang, kini.getTime()) : !basKedaluwarsa(msDariIso(b.waktu_rencana), kini.getTime())) continue;
    const ringkas = tunda
      ? `Hari sidang (${b.tanggal_sidang}) sudah lewat sebelum penundaan sempat ditulis (server tidak berjalan atau menunggu giliran); tidak ditulis di hari lain.`
      : `Tidak dikerjakan dalam ${BATAS_SIDANG.kedaluwarsaBasHari} hari sesudah jam rencana. Tekan Ulangi bila BAS ini masih perlu diunggah.`;
    if (await terapkanHasil(db, b, akhir("kedaluwarsa", ringkas), { kini, syaratStatus: ["menunggu"] })) n += 1;
  }
  return n;
}

/** Berkas yang waktunya habis (pekerjaan berakhir + N hari, atau dibatalkan + 1 hari). */
export async function bersihkanBerkas(db: AletaDatabase, deps: DepsSidang, kini: Date): Promise<number> {
  const usang = await db.queryAll<BarisSidang>(
    "SELECT * FROM aleta_sidang_terjadwal WHERE berkas_jalur <> '' AND berkas_hapus_pada <> '' AND berkas_hapus_pada <= ? AND status NOT IN ('menunggu', 'jalan') LIMIT 25",
    [kini.toISOString()]
  );
  let n = 0;
  for (const b of usang) {
    await deps.hapusBerkas(b.berkas_jalur);
    await db.run("UPDATE aleta_sidang_terjadwal SET berkas_jalur = '', berkas_hapus_pada = '' WHERE id = ?", [b.id]);
    n += 1;
  }
  return n;
}

/** Pemilik ini baru saja MENULIS satu pekerjaan sejenis ke SIPP (kurang dari jeda minimum yang ia pilih)? Yang dilewati/gagal tidak menulis, jadi tidak menahan. */
export async function masihDalamJeda(db: AletaDatabase, pemilikId: string, jenis: string, jedaMinDetik: number, kini: Date): Promise<boolean> {
  const t = await db.queryOne<{ t: string | null }>(
    "SELECT MAX(selesai_pada) AS t FROM aleta_sidang_terjadwal WHERE dibuat_oleh = ? AND jenis = ? AND selesai_pada <> '' AND status = 'selesai'",
    [pemilikId, jenis]
  );
  const terakhir = msDariIso(String(t?.t ?? ""));
  return Number.isFinite(terakhir) && kini.getTime() - terakhir < jedaMinDetik * 1000;
}

/** Pekerjaan yang boleh dikerjakan SEKARANG (satu), atau null. BAS hanya di dalam jam kerja satker; tunda kapan saja pada hari sidangnya. */
export async function pilihButir(db: AletaDatabase, deps: DepsSidang, kini: Date): Promise<BarisSidang | null> {
  const iso = kini.toISOString();
  const kandidat = await db.queryAll<BarisSidang>(
    `SELECT * FROM aleta_sidang_terjadwal
      WHERE status = 'menunggu' AND waktu_rencana <= ? AND (tunggu_sampai = '' OR tunggu_sampai <= ?)
      ORDER BY waktu_rencana ASC
      LIMIT 20`,
    [iso, iso]
  );
  if (kandidat.length === 0) return null;
  const libur = await deps.muatLibur(db);
  for (const b of kandidat) {
    if (b.jenis === "bas" && !dalamJendela(kini.getTime(), {}, libur)) continue;
    if (await masihDalamJeda(db, b.dibuat_oleh, b.jenis, muatanDariBaris(b).jedaMin, kini)) continue;
    return b;
  }
  return null;
}

/**
 * Satu detak: pulihkan yang macet, kedaluwarsakan yang terlambat, bersihkan berkas usang, lalu kerjakan paling banyak
 * SATU pekerjaan yang jatuh tempo. Tidak pernah melempar.
 */
export async function detakPelaksana(db: AletaDatabase, deps: DepsSidang = depsAsli(), env: Record<string, string | undefined> = process.env): Promise<HasilDetak> {
  const w = wadah();
  if (w.berjalan) return { jalan: false, alasan: "sedang_berjalan" };
  w.berjalan = true;
  try {
    if (!pelaksanaNyala(env)) return { jalan: false, alasan: "dimatikan" };
    const kini = deps.sekarang();
    await pulihkanMacet(db, kini);
    await kedaluwarsakan(db, kini);
    await bersihkanBerkas(db, deps, kini);
    const b = await pilihButir(db, deps, kini);
    if (!b) return { jalan: false, alasan: "tidak_ada" };

    // Klaim: SATU pembaruan bersyarat (status masih menunggu) - dua detak tidak pernah memegang yang sama.
    const diklaim = await ubahButir(
      db,
      b.id,
      {
        status: "jalan",
        klaim_oleh: "server",
        klaim_sampai: isoDariMs(kini.getTime() + BATAS_SIDANG.masaPegangDetik * 1000),
        mulai_pada: b.mulai_pada || kini.toISOString(),
        tunggu_sampai: "",
      },
      { kini, syaratStatus: ["menunggu"] }
    );
    if (!diklaim) return { jalan: false, alasan: "tidak_ada" };
    const jenis: JenisSidang = b.jenis === "tunda" ? "tunda" : "bas";
    await catatJejak(db, {
      butirId: b.id,
      jenis,
      nomorPerkara: b.nomor_perkara,
      peristiwa: "dimulai",
      pelaku: PELAKU_SERVER,
      akunSipp: b.akun_sipp,
      hasil: "",
      ringkas: `${b.nomor_perkara}: ${NAMA_JENIS[jenis]} dimulai pada waktunya (jadwal ${b.waktu_rencana_wita} WITA)`,
      kini,
    });

    const hasil = await jalankanButir(db, deps, diklaim);
    const tutup = await terapkanHasil(db, diklaim, hasil, { kini: deps.sekarang() });
    return {
      jalan: true,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      status: tutup?.status ?? "tidak diketahui",
      ringkas: "ulang" in hasil ? hasil.sebab : hasil.ringkas,
    };
  } catch (galat) {
    console.error("[SIDANG TERJADWAL] detak gagal:", galat);
    return { jalan: false, alasan: "galat", galat: sebaris((galat as Error)?.message ?? galat, 200) };
  } finally {
    w.berjalan = false;
  }
}

export const JEDA_DETAK_MS = 30_000;

/** Dinyalakan instrumentation.ts. Matikan dengan ALETA_SIDANG_TERJADWAL=0. */
export function mulaiPelaksanaBerkala(getDb: () => Promise<AletaDatabase> = getDatabase, env: Record<string, string | undefined> = process.env) {
  if (!pelaksanaNyala(env)) return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakPelaksana(await getDb());
    } catch (galat) {
      console.error("[SIDANG TERJADWAL] detak gagal:", galat);
    }
  };
  w.detak = setInterval(() => void detak(), JEDA_DETAK_MS);
  (w.detak as { unref?: () => void }).unref?.();
  // Detak pertama sesudah portal tenang (sembilan puluh detik), bukan saat berdiri.
  setTimeout(() => void detak(), 90_000).unref?.();
}
