import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { awalJendelaBerikut, dalamJendela, isoDariMs, msDariIso, msKeWita, sebutWaktuWita, witaKeMs } from "@/lib/putusan-terjadwal";
import {
  BATAS_SIDANG,
  NAMA_JENIS,
  STATUS_AKTIF,
  type JenisSidang,
  type MuatanTersimpan,
  bersihkanMuatanTunda,
  jenisSah,
  namaStatus,
  periksaWaktu,
  periksaWaktuTunda,
  ringkasMuatan,
  susunWaktuSidang,
  tanggalSah,
  tanggalWita,
} from "@/lib/sidang-terjadwal";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { nilaiMilikPerkara } from "@/server/modules/aleta-ecourt/hak-milik-perkara";
import { periksaBerkasBas } from "@/server/modules/aleta-ecourt/unggah-massal";
import { sha256 } from "@/server/modules/putusan-terjadwal/berkas";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import { type BarisSidang, bacaButir, catatJejak, muatanDariBaris, sebaris, ubahButir } from "./dasar";
import { type DepsSidang, depsAsli } from "./deps";

/**
 * ============================================================================
 * UNGGAH BAS & TUNDAAN TERJADWAL - LAYANAN (27 Okt 2026)
 * ============================================================================
 *
 * Sisi "menjadwalkan dan mengelola". Yang MENJALANKAN ada di pelaksana.ts (server,
 * detak 30 detik). Menjadwalkan TIDAK menulis ke SIPP.
 *
 * ATURAN YANG DIJAGA
 *   - Hak sama ketatnya dengan rute langsung (sidang-tunda: panel + sidang.tunda-putus;
 *     bas/unggah-sipp: panel + golongan BAS, PP hanya perkaranya sendiri), dinilai
 *     lagi oleh pelaksana saat dijalankan.
 *   - SEMUA diperiksa dulu; satu yang tidak sah menolak seluruh permintaan (tidak ada
 *     jadwal separuh jadi). Tunda: satu kali kering lewat bot per butir (rencana dan
 *     penolakan SIPP dibaca sebelum apa pun dijadwalkan).
 *   - BAS dicatat atas akun SIPP milik penjadwal (Manajemen Akun), tidak pernah atas
 *     nama yang diketik; tanpa akun tertaut ditolak. Tunda ditulis atas PP perkara
 *     (diturunkan bot), penekan sebenarnya hanya untuk jejak.
 *   - Satu sidang satu pekerjaan aktif per jenis.
 *   - Tidak ada kata ALETA yang dikirim ke SIPP; catatan di sini hanya untuk petugas.
 */

export type BerkasMasuk = { nama: string; bita: Uint8Array };

export type MasukanBuat = {
  jenis: unknown;
  /** "YYYY-MM-DD HH:mm" WITA. */
  mulai: unknown;
  jedaMin?: unknown;
  jedaMaks?: unknown;
  /** Username SIPP; hanya perlu bila penjadwal menyimpan lebih dari satu akun SIPP. */
  akunSipp?: unknown;
  butir: unknown;
  /** BAS: berkas per nama field (butir[].berkas). */
  berkas?: Record<string, BerkasMasuk | undefined>;
};

export type Tolak = { nomorPerkara: string; sebab: string };

export type HasilBuat =
  | { ok: true; butir: Array<{ id: string; nomorPerkara: string; waktuWita: string }>; perkiraanSelesai: string; peringatan: string[] }
  | { ok: false; sebab: string; tolak: Tolak[] };

const POLA_ID = /^\d{1,12}$/;
const gagalUmum = (sebab: string, tolak: Tolak[] = []): HasilBuat => ({ ok: false, sebab, tolak });
const num = (v: unknown) => Math.round(Number(v));

type Siap = {
  perkaraId: string;
  nomor: string;
  jadwalId: string;
  tanggal: string;
  tunda?: Extract<MuatanTersimpan["tunda"], object>;
  bas?: { ganti: boolean; nama: string; bentuk: string; bita: Uint8Array; sha: string };
};

/** Badan permintaan /sidang/tunda: sama untuk percobaan kering (saat menjadwalkan) dan tulisan sungguhan (saat dijalankan). */
export function badanTunda(p: {
  jadwalId: string;
  perkaraId: string;
  muatan: NonNullable<MuatanTersimpan["tunda"]>;
  aktorId: string;
  aktorNama: string;
  akunSipp: string;
  ip: string;
  kering: boolean;
}): Record<string, unknown> {
  const m = p.muatan;
  return {
    jadwalId: p.jadwalId,
    perkaraId: p.perkaraId,
    alasanTunda: m.alasanTunda,
    tanggalBerikut: m.tanggalBerikut,
    jamBerikut: m.jamBerikut,
    agendaBerikut: m.agendaBerikut,
    jenisPengadilan: m.jenisPengadilan,
    ruangId: m.ruangId,
    ruanganIdBerikut: m.ruanganIdBerikut,
    sidangKelilingBerikut: m.sidangKelilingBerikut,
    dihadiriOleh: m.dihadiriOleh,
    // Penekan sebenarnya - HANYA untuk jejak; yang tercatat di SIPP PP perkara (diturunkan bot).
    operator: p.aktorId || "portal",
    operatorNama: p.aktorNama,
    operatorAkunSipp: p.akunSipp,
    // Alamat PERAMBAN penjadwal untuk audit SIPP (bukan alamat peti portal).
    ip: p.ip,
    kering: p.kering,
    // Tunda hari sama (22 Okt): ditulis SEKARANG pada waktunya, tidak pernah diantrekan ke jam kerja berikutnya.
    ...(p.kering ? {} : { jamKerja: "sekarang" }),
  };
}

/**
 * Membuat pekerjaan terjadwal (satu baris per sidang). Semua diperiksa SEBELUM satu baris pun ditulis; bila
 * ada yang tidak sah seluruh permintaan ditolak dengan kalimat yang menyebut perkaranya.
 * Melempar ApiError hanya untuk hak (401/403); selebihnya pulang { ok:false, sebab, tolak }.
 */
export async function buatTerjadwal(
  db: AletaDatabase,
  userId: string,
  ip: string,
  masukan: MasukanBuat,
  deps: DepsSidang = depsAsli()
): Promise<HasilBuat> {
  const kini = deps.sekarang();
  if (!jenisSah(masukan.jenis)) return gagalUmum("Jenis pekerjaan belum dikenal (unggah BAS atau tunda sidang).");
  const jenis: JenisSidang = masukan.jenis;

  const hak = await deps.hak(db, jenis, userId);
  const aktor = hak.aktor;
  const daftar = Array.isArray(masukan.butir) ? masukan.butir : [];
  if (daftar.length === 0) return gagalUmum("Belum ada sidang yang dipilih.");
  if (daftar.length > BATAS_SIDANG.butirPerPermintaan) return gagalUmum(`Satu permintaan paling banyak ${BATAS_SIDANG.butirPerPermintaan} sidang.`);
  const mulai = sebaris(masukan.mulai, 16);
  if (!Number.isFinite(witaKeMs(mulai))) return gagalUmum("Tanggal dan jam mulai belum sah (YYYY-MM-DD HH:mm).");
  if (witaKeMs(mulai) < kini.getTime() - 60_000) return gagalUmum("Jam mulai sudah lewat. Pilih jam mulai yang akan datang.");

  // Akun SIPP penjadwal: tidak pernah menebak (keputusan 2 Okt butir 39). BAS ditulis atas akun ini; tunda hanya untuk jejak.
  const akun = await deps.akunSipp(db, aktor.id, sebaris(masukan.akunSipp, 64) || undefined);
  if (jenis === "bas" && !akun.ok) return gagalUmum(akun.pesan);
  const akunSippTeks = akun.ok ? akun.username : akun.milik.join(", ");
  const namaAktor = sebaris(aktor.name || aktor.email || aktor.id, 160);

  const tolak: Tolak[] = [];
  const siap: Siap[] = [];
  const peringatan: string[] = [];
  const dipilih = new Set<string>();
  let abort = "";
  let totalBerkas = 0;
  const berkasMasuk = masukan.berkas ?? {};

  for (const [i, mentah] of daftar.entries()) {
    if (abort) break;
    const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
    const nomor = sebaris(m.nomorPerkara, 120);
    const sebut = nomor || `sidang ke-${i + 1}`;
    const tolakIni = (sebab: string) => void tolak.push({ nomorPerkara: sebut, sebab });
    const perkaraId = sebaris(m.perkaraId, 20);
    const jadwalId = sebaris(jenis === "tunda" ? m.jadwalId : m.sidangId, 20);
    const tanggal = sebaris(m.tanggalSidang, 10);
    if (!POLA_ID.test(perkaraId) || !POLA_ID.test(jadwalId) || !nomor) {
      tolakIni("Nomor perkara atau nomor sidangnya belum terbaca.");
      continue;
    }
    if (!tanggalSah(tanggal)) {
      tolakIni("Tanggal sidang belum sah (YYYY-MM-DD).");
      continue;
    }
    if (dipilih.has(jadwalId)) {
      tolakIni("Sidang ini terpilih dua kali dalam permintaan yang sama.");
      continue;
    }
    dipilih.add(jadwalId);
    const aktif = await db.queryOne<{ waktu_rencana: string }>(
      "SELECT waktu_rencana FROM aleta_sidang_terjadwal WHERE jenis = ? AND jadwal_id = ? AND status IN ('menunggu', 'jalan') LIMIT 1",
      [jenis, jadwalId]
    );
    if (aktif) {
      tolakIni(`Sidang ini sudah dijadwalkan (${sebutWaktuWita(msDariIso(aktif.waktu_rencana))}). Batalkan jadwal itu dulu bila ingin menggantinya.`);
      continue;
    }

    if (jenis === "tunda") {
      const bersih = bersihkanMuatanTunda(m, tanggal);
      if (!bersih.ok) {
        tolakIni(bersih.sebab);
        continue;
      }
      const libur = await deps.tolakLibur(db, bersih.muatan.tanggalBerikut);
      if (libur) {
        tolakIni(libur);
        continue;
      }
      // Keadaan SIPP sekarang: perkara/jadwal cocok, belum ditunda/diputus/diberi hasil.
      const keadaan = await deps.keadaanSidang(jadwalId);
      if (!keadaan.ok) {
        if (keadaan.sementara) abort = `Keadaan sidang di SIPP belum dapat dibaca (${sebaris(keadaan.sebab, 160)}). Tidak ada yang dijadwalkan; coba lagi sebentar lagi.`;
        else tolakIni(keadaan.sebab);
        continue;
      }
      const k = keadaan.data;
      const kendala = kendalaKeadaanTunda(k, perkaraId, nomor, tanggal);
      if (kendala) {
        tolakIni(kendala.sebab);
        continue;
      }
      // Satu kali kering lewat bot: rencana dan penolakan SIPP (hari libur, akhir pekan, PP tak tercatat, dst.) dibaca sekarang.
      const kering = await deps.tulisTunda(
        badanTunda({ jadwalId, perkaraId, muatan: bersih.muatan, aktorId: aktor.id, aktorNama: namaAktor, akunSipp: akunSippTeks, ip, kering: true })
      );
      if (!kering.ok) {
        if (kering.sementara) abort = `Rencana penundaan belum dapat diperiksa ke SIPP (${sebaris(kering.sebab, 160)}). Tidak ada yang dijadwalkan; coba lagi sebentar lagi.`;
        else tolakIni(kering.sebab);
        continue;
      }
      siap.push({ perkaraId, nomor, jadwalId, tanggal, tunda: bersih.muatan });
      continue;
    }

    // ── BAS ────────────────────────────────────────────────────────────────
    const namaField = sebaris(m.berkas, 120);
    const berkas = namaField ? berkasMasuk[namaField] : undefined;
    if (!berkas || !berkas.bita || berkas.bita.length === 0) {
      tolakIni("Berkas BAS belum dipilih.");
      continue;
    }
    if (berkas.bita.length > BATAS_SIDANG.ukuranBerkas) {
      tolakIni("Berkas BAS melampaui 10 MB.");
      continue;
    }
    totalBerkas += berkas.bita.length;
    if (totalBerkas > BATAS_SIDANG.ukuranTotal) {
      abort = `Seluruh berkas dalam satu permintaan melampaui ${Math.round(BATAS_SIDANG.ukuranTotal / 1024 / 1024)} MB. Jadwalkan dalam beberapa kali.`;
      continue;
    }
    // 18 Okt 2026 (butir 18): grup RTF tersembunyi tidak ikut ke SIPP - berkas yang DISIMPAN sudah bersih.
    const bita = buangGrupTersembunyiRtf(berkas.bita);
    const periksa = periksaBerkasBas(bita, nomor);
    if (periksa.tolak) {
      tolakIni(periksa.tolak);
      continue;
    }
    for (const p of periksa.peringatan) peringatan.push(`${nomor}: ${p}`);
    const cek = await deps.cekBas(perkaraId, jadwalId);
    if (!cek.ok) {
      if (cek.sementara) abort = `Keadaan BAS di SIPP belum dapat dibaca (${sebaris(cek.sebab, 160)}). Tidak ada yang dijadwalkan; coba lagi sebentar lagi.`;
      else tolakIni("Sidang ini tidak ditemukan pada perkara tersebut di SIPP.");
      continue;
    }
    if (cek.data.tanggalSidang && cek.data.tanggalSidang !== tanggal) {
      tolakIni(`Tanggal sidang di SIPP ${cek.data.tanggalSidang}, bukan ${tanggal}. Muat ulang daftarnya.`);
      continue;
    }
    // 17 Okt (A4): PP hanya BAS perkaranya sendiri; yang mengawasi tidak dibatasi.
    const milik = nilaiMilikPerkara({ jenis: "bas", namaAkun: String(aktor.name || ""), pengawas: hak.pengawas, petugas: cek.data.panitera });
    if (!milik.ok) {
      tolakIni(milik.pesan);
      continue;
    }
    const ganti = m.ganti === true;
    if (cek.data.adaBas && !ganti) {
      tolakIni(`e-Doc BAS sidang ini sudah ada di SIPP${cek.data.jalur ? ` (${cek.data.jalur})` : ""}. Tidak diganti kecuali kotak "Ganti" dicentang dengan sadar.`);
      continue;
    }
    siap.push({
      perkaraId,
      nomor,
      jadwalId,
      tanggal,
      bas: { ganti, nama: sebaris(String(berkas.nama ?? "").replace(/[\\/]/g, "_"), 200) || "bas", bentuk: periksa.bentuk, bita, sha: sha256(bita) },
    });
  }

  const ringkasTolak = (): HasilBuat =>
    gagalUmum(
      tolak.length === 1 ? `${tolak[0].nomorPerkara}: ${tolak[0].sebab}` : `${tolak.length} dari ${daftar.length} sidang tidak sah; tidak ada yang dijadwalkan.`,
      tolak
    );
  if (abort) return gagalUmum(abort, tolak);
  if (tolak.length > 0) return ringkasTolak();

  // Jam: jeda manusiawi antar butir (susunJadwal), lalu aturan waktu jenisnya per butir.
  const libur = await deps.muatLibur(db);
  const jadwal = susunWaktuSidang({ jenis, jumlah: siap.length, mulai, jedaMin: num(masukan.jedaMin) || undefined, jedaMaks: num(masukan.jedaMaks) || undefined, libur, acak: deps.acak });
  if (!jadwal.ok) return gagalUmum(jadwal.sebab || "Jadwal tidak dapat disusun.");
  for (const [i, s] of siap.entries()) {
    const sebab = periksaWaktu(jenis, jadwal.butir[i].ms, s.tanggal, kini.getTime());
    if (sebab) tolak.push({ nomorPerkara: s.nomor, sebab });
  }
  if (tolak.length > 0) return ringkasTolak();
  peringatan.push(...jadwal.peringatan);

  // Simpan: berkas BAS dulu (di folder yang di-mount), lalu baris dalam satu transaksi; gagal = berkas dibuang lagi.
  const sekarangIso = kini.toISOString();
  const rencana: Array<{ id: string; s: Siap; waktu: (typeof jadwal.butir)[number]; jalur: string }> = [];
  const tersimpan: string[] = [];
  try {
    for (const [i, s] of siap.entries()) {
      const id = await nextPrefixedId(db, "aleta_sidang_terjadwal", "sdt");
      let jalur = "";
      if (s.bas) {
        jalur = await deps.simpanBerkas(id, s.bas.bentuk, s.bas.bita, kini);
        tersimpan.push(jalur);
      }
      rencana.push({ id, s, waktu: jadwal.butir[i], jalur });
    }
    await withTransaction(db, async (tx) => {
      for (const r of rencana) {
        const muatan: MuatanTersimpan = {
          jedaMin: jadwal.jedaMinDetik,
          jedaMaks: jadwal.jedaMaksDetik,
          ...(r.s.tunda ? { tunda: r.s.tunda } : {}),
          ...(r.s.bas ? { bas: { ganti: r.s.bas.ganti } } : {}),
        };
        await tx.run(
          `INSERT INTO aleta_sidang_terjadwal
             (id, jenis, dibuat_oleh, dibuat_nama, peran, akun_sipp, ip, perkara_id, nomor_perkara, jadwal_id, tanggal_sidang,
              waktu_rencana, waktu_rencana_wita, muatan_json, berkas_nama, berkas_bentuk, berkas_ukuran, berkas_sha256, berkas_jalur,
              status, dibuat_pada, diubah_pada)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?)`,
          [
            r.id,
            jenis,
            aktor.id,
            namaAktor,
            sebaris(hak.peran, 40),
            sebaris(akunSippTeks, 160),
            sebaris(ip, 45),
            r.s.perkaraId,
            r.s.nomor,
            r.s.jadwalId,
            r.s.tanggal,
            r.waktu.iso,
            r.waktu.wita.slice(0, 16),
            JSON.stringify(muatan),
            r.s.bas?.nama ?? "",
            r.s.bas?.bentuk ?? "",
            r.s.bas?.bita.length ?? 0,
            r.s.bas?.sha ?? "",
            r.jalur,
            sekarangIso,
            sekarangIso,
          ]
        );
      }
    });
  } catch (galat) {
    for (const jalur of tersimpan) await deps.hapusBerkas(jalur).catch(() => false);
    throw galat;
  }

  // Jejak jujur: siapa menjadwalkan, kapan, untuk perkara apa, jam berapa, dari alamat mana.
  const pelaku = `pengguna: ${namaAktor}`;
  for (const r of rencana) {
    await catatJejak(db, {
      butirId: r.id,
      jenis,
      nomorPerkara: r.s.nomor,
      peristiwa: "dijadwalkan",
      pelaku,
      pelakuId: aktor.id,
      akunSipp: akunSippTeks,
      hasil: "ok",
      ringkas: `${r.s.nomor}: ${NAMA_JENIS[jenis]} dijadwalkan pada ${r.waktu.wita.slice(0, 16)} WITA`,
      rinci: { ip: sebaris(ip, 45), peran: hak.peran, tanggalSidang: r.s.tanggal, jeda: [jadwal.jedaMinDetik, jadwal.jedaMaksDetik] },
      audit: { aksi: "SIDANG_TERJADWAL_DIBUAT", aktorId: aktor.id, entitas: r.id },
      kini,
    });
  }
  return {
    ok: true,
    butir: rencana.map((r) => ({ id: r.id, nomorPerkara: r.s.nomor, waktuWita: r.waktu.wita.slice(0, 16) })),
    perkiraanSelesai: rencana[rencana.length - 1].waktu.wita.slice(0, 16),
    peringatan,
  };
}

/**
 * Keadaan sidang di SIPP yang menghalangi penundaan: sidang lain/perkara lain, tanggal berubah, sudah ditunda,
 * sudah diputus, atau sudah diberi hasil. null = bebas. `lewati` = SIPP sudah memuat hasilnya (dilewati, bukan gagal).
 */
export function kendalaKeadaanTunda(
  k: { perkaraId: string; nomorPerkara: string; tanggalSidang: string; ditunda: boolean; alasanDitunda: string; tanggalPutusan: string },
  perkaraId: string,
  nomor: string,
  tanggal: string
): { sebab: string; lewati: boolean } | null {
  if (k.perkaraId && k.perkaraId !== perkaraId) return { sebab: "Nomor sidang ini bukan milik perkara tersebut di SIPP. Muat ulang daftarnya.", lewati: false };
  const rapat = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  if (k.nomorPerkara && rapat(k.nomorPerkara) !== rapat(nomor)) {
    return { sebab: `Nomor perkara di SIPP ${k.nomorPerkara}, bukan ${nomor}. Muat ulang daftarnya.`, lewati: false };
  }
  if (k.tanggalSidang && k.tanggalSidang !== tanggal) {
    return { sebab: `Tanggal sidang di SIPP ${k.tanggalSidang}, bukan ${tanggal} (jadwalnya sudah diubah). Muat ulang daftarnya.`, lewati: false };
  }
  if (k.ditunda) return { sebab: "Sidang ini sudah ditunda di SIPP.", lewati: true };
  if (k.tanggalPutusan) return { sebab: `Perkara ini sudah diputus (${k.tanggalPutusan}); penundaan tidak berlaku.`, lewati: true };
  const hasil = k.alasanDitunda.trim();
  if (hasil !== "" && hasil !== "0") return { sebab: `Hasil sidang ini sudah dicatat di SIPP ("${sebaris(hasil, 80)}"); penundaan tidak menimpanya.`, lewati: true };
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Daftar
// ──────────────────────────────────────────────────────────────────────────

export type ButirTampil = {
  id: string;
  jenis: JenisSidang;
  perkaraId: string;
  nomorPerkara: string;
  jadwalId: string;
  tanggalSidang: string;
  waktuWita: string;
  status: string;
  namaStatus: string;
  hasilRingkas: string;
  berkasNama: string;
  ringkasMuatan: string;
  dibuatNama: string;
  bolehBatal: boolean;
  // Tambahan di luar kontrak minimal (layar boleh mengabaikan):
  namaJenis: string;
  waktuSebut: string;
  percobaan: number;
  akunSipp: string;
  dibuatPada: string;
  selesaiPada: string;
  bolehUlang: boolean;
  bolehJadwalUlang: boolean;
};

export function petakanButir(b: BarisSidang, kini: Date): ButirTampil {
  const jenis: JenisSidang = b.jenis === "tunda" ? "tunda" : "bas";
  const waktu = msDariIso(b.waktu_rencana);
  const lewatKlaim = b.status === "jalan" && b.klaim_sampai !== "" && msDariIso(b.klaim_sampai) < kini.getTime();
  // Tunda yang hari sidangnya sudah lewat tidak dapat diulang (tidak pernah ditulis di hari lain); BAS perlu berkasnya.
  const dapatUlangJenis = jenis === "tunda" ? !(tanggalSah(b.tanggal_sidang) && tanggalWita(kini.getTime()) > b.tanggal_sidang) : b.berkas_jalur !== "";
  return {
    id: b.id,
    jenis,
    perkaraId: b.perkara_id,
    nomorPerkara: b.nomor_perkara,
    jadwalId: b.jadwal_id,
    tanggalSidang: b.tanggal_sidang,
    waktuWita: b.waktu_rencana_wita || (Number.isFinite(waktu) ? msKeWita(waktu).slice(0, 16) : ""),
    status: b.status,
    namaStatus: namaStatus(b.status),
    hasilRingkas: b.hasil_ringkas,
    berkasNama: b.berkas_nama,
    ringkasMuatan: ringkasMuatan(jenis, muatanDariBaris(b), b.berkas_nama),
    dibuatNama: b.dibuat_nama,
    bolehBatal: b.status === "menunggu" || lewatKlaim,
    namaJenis: NAMA_JENIS[jenis],
    waktuSebut: Number.isFinite(waktu) ? sebutWaktuWita(waktu) : "",
    percobaan: b.percobaan,
    akunSipp: b.akun_sipp,
    dibuatPada: b.dibuat_pada,
    selesaiPada: b.selesai_pada,
    bolehUlang: (b.status === "gagal" || b.status === "kedaluwarsa") && dapatUlangJenis,
    bolehJadwalUlang: b.status === "menunggu",
  };
}

export async function daftarTerjadwal(
  db: AletaDatabase,
  userId: string,
  opsi: { jenis?: string; aktif?: boolean; semua?: boolean; jadwalId?: string; batas?: number } = {},
  deps: DepsSidang = depsAsli()
): Promise<{ butir: ButirTampil[] }> {
  const { aktor, pengawas } = await deps.aktorPanel(db, userId);
  const kini = deps.sekarang();
  const syarat: string[] = [];
  const nilai: Array<string | number> = [];
  if (!(opsi.semua === true && pengawas)) {
    syarat.push("dibuat_oleh = ?");
    nilai.push(aktor.id);
  }
  if (jenisSah(opsi.jenis)) {
    syarat.push("jenis = ?");
    nilai.push(opsi.jenis);
  }
  if (opsi.aktif) syarat.push(`status IN (${STATUS_AKTIF.map(() => "?").join(", ")})`), nilai.push(...STATUS_AKTIF);
  const jadwalId = sebaris(opsi.jadwalId, 20);
  if (jadwalId) {
    syarat.push("jadwal_id = ?");
    nilai.push(jadwalId);
  }
  const batas = Math.min(Math.max(Math.floor(Number(opsi.batas) || 100), 1), 300);
  const baris = await db.queryAll<BarisSidang>(
    `SELECT * FROM aleta_sidang_terjadwal ${syarat.length ? `WHERE ${syarat.join(" AND ")}` : ""} ORDER BY waktu_rencana ${opsi.aktif ? "ASC" : "DESC"} LIMIT ?`,
    [...nilai, batas]
  );
  return { butir: baris.map((b) => petakanButir(b, kini)) };
}

// ──────────────────────────────────────────────────────────────────────────
// Kelola: batal | jadwal-ulang | ulang
// ──────────────────────────────────────────────────────────────────────────

export type AksiKelola = "batal" | "jadwal-ulang" | "ulang";

export async function kelolaTerjadwal(
  db: AletaDatabase,
  userId: string,
  masukan: { aksi: unknown; id: unknown; wita?: unknown },
  deps: DepsSidang = depsAsli()
): Promise<{ ok: true; butir: ButirTampil; ringkas: string }> {
  const kini = deps.sekarang();
  const { aktor, pengawas } = await deps.aktorPanel(db, userId);
  const aksi = String(masukan.aksi ?? "");
  if (aksi !== "batal" && aksi !== "jadwal-ulang" && aksi !== "ulang") throw new ApiError(400, "Aksi tidak dikenal.");
  const b = await bacaButir(db, sebaris(masukan.id, 80));
  if (!b) throw new ApiError(404, "Pekerjaan terjadwal tidak ditemukan.");
  if (b.dibuat_oleh !== aktor.id && !pengawas) throw new ApiError(403, "Jadwal ini bukan milik Anda.");
  const jenis: JenisSidang = b.jenis === "tunda" ? "tunda" : "bas";
  const namaAktor = sebaris(aktor.name || aktor.email || aktor.id, 120);
  const pelaku = `pengguna: ${namaAktor}`;
  const jejak = (peristiwa: string, ringkas: string, audit = false) =>
    catatJejak(db, {
      butirId: b.id,
      jenis,
      nomorPerkara: b.nomor_perkara,
      peristiwa,
      pelaku,
      pelakuId: aktor.id,
      akunSipp: b.akun_sipp,
      hasil: "ok",
      ringkas,
      ...(audit ? { audit: { aksi: `SIDANG_TERJADWAL_${peristiwa.toUpperCase().replace(/-/g, "_")}`, aktorId: aktor.id, entitas: b.id } } : {}),
      kini,
    });
  const lewatKlaim = b.status === "jalan" && b.klaim_sampai !== "" && msDariIso(b.klaim_sampai) < kini.getTime();
  const berubah = () => new ApiError(409, `${b.nomor_perkara} baru saja berubah keadaannya. Muat ulang daftarnya.`);

  if (aksi === "batal") {
    if (b.status === "jalan" && !lewatKlaim) throw new ApiError(409, `${b.nomor_perkara} sedang dikerjakan; tunggu selesai.`);
    if (b.status !== "menunggu" && !lewatKlaim) throw new ApiError(409, `${b.nomor_perkara} sudah ${namaStatus(b.status)}, tidak dapat dibatalkan.`);
    const baru = await ubahButir(
      db,
      b.id,
      {
        status: "dibatalkan",
        hasil_ringkas: `Dibatalkan oleh ${namaAktor} sebelum dijalankan.`,
        selesai_pada: kini.toISOString(),
        klaim_oleh: "",
        klaim_sampai: "",
        // Berkas yang tak akan dipakai tidak perlu ditahan lama - dihapus pembersih terjadwal.
        ...(b.berkas_jalur ? { berkas_hapus_pada: new Date(kini.getTime() + 24 * 3600_000).toISOString() } : {}),
      },
      { kini, syaratStatus: [b.status] }
    );
    if (!baru) throw berubah();
    await jejak("dibatalkan", `${b.nomor_perkara} dibatalkan sebelum dijalankan`, true);
    return { ok: true, butir: petakanButir(baru, kini), ringkas: `${b.nomor_perkara} dibatalkan.` };
  }

  // Menjadwal ulang dan mengulang adalah MENULIS lagi: hak jenisnya dinilai ulang atas akun yang menekan.
  await deps.hak(db, jenis, aktor.id);
  const libur = await deps.muatLibur(db);

  if (aksi === "jadwal-ulang") {
    if (b.status !== "menunggu") throw new ApiError(409, `${b.nomor_perkara} tidak sedang menunggu, jamnya tidak dapat diubah.`);
    const tujuan = witaKeMs(sebaris(masukan.wita, 16));
    if (!Number.isFinite(tujuan)) throw new ApiError(400, "Jam baru belum sah (YYYY-MM-DD HH:mm).");
    const sebab = periksaWaktu(jenis, tujuan, b.tanggal_sidang, kini.getTime());
    if (sebab) throw new ApiError(400, sebab);
    if (jenis === "bas" && !dalamJendela(tujuan, {}, libur)) {
      throw new ApiError(400, "Jam baru di luar jam kerja (atau istirahat/hari libur). Pilih jam di dalam jam kerja.");
    }
    const baru = await ubahButir(
      db,
      b.id,
      { waktu_rencana: isoDariMs(tujuan), waktu_rencana_wita: msKeWita(tujuan).slice(0, 16), tunggu_sampai: "" },
      { kini, syaratStatus: ["menunggu"] }
    );
    if (!baru) throw berubah();
    await jejak("jam-diubah", `${b.nomor_perkara}: jam dipindah ke ${msKeWita(tujuan).slice(0, 16)} WITA`);
    return { ok: true, butir: petakanButir(baru, kini), ringkas: `Jam ${b.nomor_perkara} dipindah ke ${sebutWaktuWita(tujuan)}.` };
  }

  // ulang
  if (b.status !== "gagal" && b.status !== "kedaluwarsa") throw new ApiError(409, `${b.nomor_perkara} tidak perlu diulang.`);
  const ganda = await db.queryOne<{ id: string }>(
    "SELECT id FROM aleta_sidang_terjadwal WHERE jenis = ? AND jadwal_id = ? AND status IN ('menunggu', 'jalan') AND id <> ? LIMIT 1",
    [b.jenis, b.jadwal_id, b.id]
  );
  if (ganda) throw new ApiError(409, `${b.nomor_perkara} sudah punya jadwal lain yang masih menunggu.`);
  let tujuan = kini.getTime() + 90_000;
  if (jenis === "tunda") {
    const sebab = periksaWaktuTunda(tujuan, b.tanggal_sidang, kini.getTime());
    if (sebab) throw new ApiError(409, `Hari sidangnya (${b.tanggal_sidang}) sudah lewat atau tinggal sebentar; penundaan tidak ditulis di hari lain. Tunda lewat Jadwal Sidang.`);
  } else {
    if (b.berkas_jalur === "") throw new ApiError(409, `Berkas ${b.nomor_perkara} sudah dihapus dari penyimpanan; jadwalkan ulang dengan berkas yang diseret lagi.`);
    if (!dalamJendela(tujuan, {}, libur)) tujuan = awalJendelaBerikut(tujuan, {}, libur);
    if (!Number.isFinite(tujuan)) throw new ApiError(409, "Tidak ada jam kerja dalam 30 hari ke depan.");
  }
  const baru = await ubahButir(
    db,
    b.id,
    {
      status: "menunggu",
      percobaan: 0,
      waktu_rencana: isoDariMs(tujuan),
      waktu_rencana_wita: msKeWita(tujuan).slice(0, 16),
      tunggu_sampai: "",
      klaim_oleh: "",
      klaim_sampai: "",
      selesai_pada: "",
      berkas_hapus_pada: "",
      hasil_ringkas: `Diulang atas permintaan ${namaAktor}.`,
    },
    { kini, syaratStatus: ["gagal", "kedaluwarsa"] }
  );
  if (!baru) throw berubah();
  await jejak("diulang", `${b.nomor_perkara}: diulang pada ${msKeWita(tujuan).slice(0, 16)} WITA`, true);
  return { ok: true, butir: petakanButir(baru, kini), ringkas: `${b.nomor_perkara} dijadwalkan ulang.` };
}
