import { randomUUID } from "node:crypto";

import {
  biayaUsd,
  biayaUsdBanyak,
  bulatkanKeAtas,
  hitungHarga,
  jumlahkanPenggunaan,
  PENGGUNAAN_NOL,
  perkirakanTokenDariKarakter,
  type ParameterHarga,
  type PenggunaanToken,
  type Tarif,
} from "@/lib/aleta-ai/biaya";
import { cariPemicuDiAwalTeks, pilihModul, type PemicuMenu } from "@/lib/aleta-ai/proyek";
import {
  hitungKarakterPermintaan,
  susunPermintaan,
  susunPermintaanKlasifikasi,
  BATAS_KARAKTER_PESAN_PENGGUNA,
  type PermintaanAi,
} from "@/lib/aleta-ai/penyusun";
import {
  klasifikasiKataKunci,
  naikSatuTingkat,
  pilihRute,
  tabelRuteDari,
  tafsirKeluaranPengklasifikasi,
  terlaluRagu,
  type HasilKlasifikasi,
  type RuteKelompok,
} from "@/lib/aleta-ai/rute";
import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { ambilKlienAi, GalatKlienAi, jinakkanGalat, type HasilAi, type KlienAi } from "@/server/modules/aleta-ai/klien";
import { kursBerlaku, segarkanKursBilaPerlu, tanggalLokal, type PengambilKurs } from "@/server/modules/aleta-ai/kurs";
import { ambilMilik, bukaIsi, JUDUL_BAWAAN, riwayatUntukPermintaan, sandiIsi } from "@/server/modules/aleta-ai/percakapan";
import { bacaPengaturan, bacaRute, bacaTarif, catatJejak, type PengaturanAi } from "@/server/modules/aleta-ai/pengaturan";
import { proyekAktif } from "@/server/modules/aleta-ai/proyek";
import { saldoPengguna, selesaikanTahanan, tahanDana, tambahTahanan } from "@/server/modules/aleta-ai/saldo";

/**
 * ============================================================================
 * ALETA Ai - MESIN SATU GILIRAN (pesan pengguna -> jawaban streaming)
 * ============================================================================
 *
 * kirimPesan() adalah generator yang menghasilkan peristiwa untuk SSE:
 *
 *   perkiraan -> teks* -> selesai          (jalan normal)
 *   gagal                                   (di titik mana pun; sesudahnya berhenti)
 *
 * URUTAN KERJA
 *   1. periksa masukan, saklar, kunci API, proyek, batas laju & harian, saldo
 *   2. rute: pemicu (langsung) | pengklasifikasi ringan | kata kunci; ragu -> naik;
 *      batas peran
 *   3. susun permintaan, hitung token (count_tokens atau karakter/4), perkirakan
 *      biaya, TAHAN dana (mutasi tahan)
 *   4. alirkan jawaban; refusal sebelum keluaran -> naik satu tingkat sekali
 *   5. biaya aktual = usage x tarif x kurs; LEPAS tahanan dan POTONG biaya aktual
 *      (tidak lebih dari saldo; giliran gagal tidak dipotong)
 *   6. simpan pesan terenkripsi, pemakaian per panggilan, jejak audit
 *
 * Penyelesaian (langkah 5-6) ada di blok finally: pelanggan yang memutus
 * sambungan atau galat di tengah jalan tetap melepas tahanannya.
 */

const teks = (n: unknown) => String(n ?? "").trim();

export type EventAi =
  | { jenis: "perkiraan"; mode: string; label: string; perkiraanRp: number }
  | { jenis: "teks"; delta: string }
  | { jenis: "selesai"; pesanId: string; mode: string; label: string; biayaRp: number; saldoRp: number }
  | { jenis: "gagal"; pesan: string };

export type MasukanPesan = { teks?: string; pemicu?: string };

export type OpsiMesin = {
  sinyal?: AbortSignal;
  sekarang?: Date;
  /** Uji: pengambil kurs tiruan. Tanpa ini, kurs hanya diambil di luar NODE_ENV=test. */
  pengambilKurs?: PengambilKurs;
};

export const CATATAN_TERPOTONG = "\n\n[Jawaban terhenti karena mencapai batas panjang. Ketik LJ untuk melanjutkan.]";
export const PESAN_DITOLAK = "Permintaan ini ditolak oleh pengaman layanan AI. Coba rumuskan ulang dengan lebih umum, tanpa rincian yang tidak diperlukan.";
export const PESAN_NONAKTIF_KUNCI = "ALETA Ai belum diaktifkan.";
export const PESAN_NONAKTIF_SAKLAR = "ALETA Ai sedang dimatikan oleh admin.";
export const PESAN_NONAKTIF_PROYEK = "ALETA Ai belum diaktifkan: proyek ALETA AI PA V4.5 belum dipasang oleh Super Admin.";

// ----------------------------------------------------------------------------
// Batas laju (dalam ingatan, per pengguna)
// ----------------------------------------------------------------------------

const catatanLaju = new Map<string, number[]>();

/** true = boleh; false = terlalu sering. Mencatat percobaan yang diizinkan. */
export function izinkanLaju(penggunaId: string, batasPerMenit: number, sekarangMs: number = Date.now()): boolean {
  const jendela = (catatanLaju.get(penggunaId) ?? []).filter((t) => sekarangMs - t < 60_000);
  if (jendela.length >= batasPerMenit) {
    catatanLaju.set(penggunaId, jendela);
    return false;
  }
  jendela.push(sekarangMs);
  catatanLaju.set(penggunaId, jendela);
  return true;
}

export function ulangiBatasLaju() {
  catatanLaju.clear();
}

// ----------------------------------------------------------------------------
// Antrian penghubung callback -> generator
// ----------------------------------------------------------------------------

class Antrian<T> implements AsyncIterable<T> {
  private isi: T[] = [];
  private tutupnya = false;
  private menunggu: (() => void) | null = null;

  dorong(x: T) {
    this.isi.push(x);
    this.bangun();
  }

  tutup() {
    this.tutupnya = true;
    this.bangun();
  }

  private bangun() {
    const m = this.menunggu;
    this.menunggu = null;
    m?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (;;) {
      if (this.isi.length) {
        yield this.isi.shift() as T;
        continue;
      }
      if (this.tutupnya) return;
      await new Promise<void>((lanjut) => {
        this.menunggu = lanjut;
      });
    }
  }
}

// ----------------------------------------------------------------------------
// Pembantu biaya
// ----------------------------------------------------------------------------

type Percobaan = {
  jenis: "jawaban" | "klasifikasi";
  model: string;
  effort: string;
  kelompok: string;
  penggunaan: PenggunaanToken;
  usd: number;
};

function parameterHarga(p: PengaturanAi): ParameterHarga {
  return { marginPersen: p.marginPersen, penyanggaKursPersen: p.penyanggaKursPersen, minimumRp: p.minimumRp, pembulatanRp: p.pembulatanRp, mdrPersen: p.mdrPersen };
}

/** Biaya satu panggilan; tarif model yang tak dikenal (mis. model fallback) memakai tarif model yang diminta. */
export function biayaPanggilan(tarif: ReadonlyMap<string, Tarif>, modelDiminta: string, h: HasilAi): { usd: number; penggunaan: PenggunaanToken } {
  if (h.iterasi.length > 0) {
    return {
      usd: biayaUsdBanyak(tarif, modelDiminta, h.iterasi),
      penggunaan: h.iterasi.reduce<PenggunaanToken>((a, it) => jumlahkanPenggunaan(a, it), PENGGUNAAN_NOL),
    };
  }
  const t = tarif.get(h.model) ?? tarif.get(modelDiminta);
  return { usd: t ? biayaUsd(t, h.penggunaan) : 0, penggunaan: h.penggunaan };
}

type Perkiraan = { tokenMasuk: number; usd: number; perkiraanRp: number; tahanRp: number };

async function perkirakanGiliran(
  klien: KlienAi,
  permintaan: PermintaanAi,
  rute: RuteKelompok,
  tarif: ReadonlyMap<string, Tarif>,
  kursDasar: number,
  pengaturan: PengaturanAi,
  gratis: boolean
): Promise<Perkiraan> {
  const { sistem, pesan } = hitungKarakterPermintaan(permintaan);
  let tokenMasuk = perkirakanTokenDariKarakter(sistem + pesan);
  if (klien.hitungToken) {
    try {
      const n = await klien.hitungToken(permintaan);
      if (Number.isFinite(n) && n > 0) tokenMasuk = Math.trunc(n);
    } catch {
      /* tetap perkiraan karakter */
    }
  }
  // Bagian system dihitung sebagai TULIS cache (kemungkinan terburuk: cache kosong).
  const bagianSistem = sistem + pesan > 0 ? sistem / (sistem + pesan) : 0;
  const tokenSistem = Math.round(tokenMasuk * bagianSistem);
  const t = tarif.get(rute.model);
  const usd = t ? biayaUsd(t, { masuk: tokenMasuk - tokenSistem, cacheTulis: tokenSistem, cacheBaca: 0, keluar: rute.perkiraanKeluaran }) : 0;
  const harga = hitungHarga(usd, kursDasar, parameterHarga(pengaturan), { gratis });
  const tahanRp = gratis ? 0 : bulatkanKeAtas(harga.hargaRp * pengaturan.faktorTahan, pengaturan.pembulatanRp);
  return { tokenMasuk, usd, perkiraanRp: harga.tagihRp, tahanRp };
}

async function pemakaianHariIni(db: AletaDatabase, penggunaId: string, sekarang: Date): Promise<{ rp: number; token: number }> {
  const awalHari = new Date(`${tanggalLokal(sekarang)}T00:00:00+08:00`).toISOString();
  const baris = await db.queryOne<{ rp: number | string | null; tok: number | string | null }>(
    `SELECT COALESCE(SUM(biaya_rp), 0) AS rp, COALESCE(SUM(token_masuk + token_keluar + token_cache_tulis + token_cache_baca), 0) AS tok
     FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai' AND dibuat_at >= ?`,
    [penggunaId, awalHari]
  );
  return { rp: Number(baris?.rp ?? 0), token: Number(baris?.tok ?? 0) };
}

// ----------------------------------------------------------------------------
// Pengklasifikasi
// ----------------------------------------------------------------------------

async function klasifikasikan(
  klien: KlienAi,
  tabel: ReadonlyMap<string, RuteKelompok>,
  tarif: ReadonlyMap<string, Tarif>,
  teksKerja: string,
  sinyal: AbortSignal | undefined,
  catat: (p: Percobaan) => void
): Promise<HasilKlasifikasi> {
  const cadangan = klasifikasiKataKunci(teksKerja);
  const model = tabel.get("cepat-bantuan")?.model;
  if (!model || sinyal?.aborted) return cadangan;
  try {
    const permintaan = susunPermintaanKlasifikasi(tabel, teksKerja, model);
    const hasil = await klien.alirkan(permintaan, { sinyal });
    const biaya = biayaPanggilan(tarif, model, hasil);
    catat({ jenis: "klasifikasi", model: hasil.model || model, effort: permintaan.effort, kelompok: "klasifikasi", penggunaan: biaya.penggunaan, usd: biaya.usd });
    const tafsir = hasil.berhenti === "selesai" ? tafsirKeluaranPengklasifikasi(hasil.teks, new Set(tabel.keys())) : null;
    return tafsir ?? cadangan;
  } catch {
    return cadangan;
  }
}

// ----------------------------------------------------------------------------
// Mesin
// ----------------------------------------------------------------------------

export async function* kirimPesan(
  db: AletaDatabase,
  pelaku: PelakuAi,
  percakapanId: string,
  masukan: MasukanPesan,
  opsi: OpsiMesin = {}
): AsyncGenerator<EventAi, void, void> {
  const sekarang = opsi.sekarang ?? new Date();
  const gagal = (pesan: string): EventAi => ({ jenis: "gagal", pesan });

  // 1. Masukan dan prasyarat -------------------------------------------------
  const teksPengguna = teks(masukan.teks);
  const kodePemicu = teks(masukan.pemicu);
  if (!teksPengguna && !kodePemicu) {
    yield gagal("Tulis pertanyaan Anda dulu, atau pilih salah satu tombol cepat.");
    return;
  }
  if (teksPengguna.length > BATAS_KARAKTER_PESAN_PENGGUNA) {
    yield gagal(`Pesan terlalu panjang (maksimal ${BATAS_KARAKTER_PESAN_PENGGUNA.toLocaleString("id-ID")} karakter). Bagi menjadi beberapa pesan.`);
    return;
  }
  const percakapan = await ambilMilik(db, pelaku.id, percakapanId);
  if (!percakapan) {
    yield gagal("Percakapan tidak ditemukan.");
    return;
  }

  const pengaturan = await bacaPengaturan(db);
  if (!pengaturan.aktif) {
    yield gagal(PESAN_NONAKTIF_SAKLAR);
    return;
  }
  const klien = ambilKlienAi();
  if (!klien) {
    yield gagal(PESAN_NONAKTIF_KUNCI);
    return;
  }
  const proyek = await proyekAktif(db);
  if (!proyek) {
    yield gagal(PESAN_NONAKTIF_PROYEK);
    return;
  }
  if (!izinkanLaju(pelaku.id, pengaturan.batasLajuPerMenit, sekarang.getTime())) {
    yield gagal("Terlalu banyak pesan dalam satu menit. Tunggu sebentar lalu kirim lagi.");
    return;
  }
  const hariIni = await pemakaianHariIni(db, pelaku.id, sekarang);
  if (hariIni.token >= pengaturan.batasHarianToken || (!pelaku.superAdmin && hariIni.rp >= pengaturan.batasHarianRp)) {
    yield gagal("Batas pemakaian harian ALETA Ai Anda sudah tercapai. Coba lagi besok.");
    return;
  }
  if (!pelaku.superAdmin) {
    const saldo = await saldoPengguna(db, pelaku.id);
    if (saldo < pengaturan.minimumRp) {
      yield gagal(`Saldo ALETA Ai Anda (Rp${saldo.toLocaleString("id-ID")}) tidak cukup. Hubungi Super Admin untuk mengisi saldo.`);
      return;
    }
  }

  if (opsi.pengambilKurs || process.env.NODE_ENV !== "test") {
    // Jangan menahan giliran lebih dari 3 detik demi kurs; pengambilan lanjut di latar.
    await Promise.race([segarkanKursBilaPerlu(db, { pengambil: opsi.pengambilKurs, sekarang }), new Promise((r) => setTimeout(r, 3000))]);
  }
  const kurs = await kursBerlaku(db, sekarang);
  const tarifDaftar = await bacaTarif(db);
  const tarif = new Map(tarifDaftar.map((t) => [t.model, t]));
  const tabel = tabelRuteDari(await bacaRute(db));

  // 2. Rute -------------------------------------------------------------------
  let pemicu: PemicuMenu | null = kodePemicu ? (proyek.menu.find((p) => p.kode === kodePemicu) ?? null) : null;
  if (!pemicu) pemicu = cariPemicuDiAwalTeks(proyek.menu, teksPengguna);
  const diawaliAlias = pemicu ? cariPemicuDiAwalTeks([pemicu], teksPengguna) !== null : false;
  const teksKerja = pemicu && !diawaliAlias ? `${pemicu.label}${teksPengguna ? `\n${teksPengguna}` : ""}` : teksPengguna;

  const percobaan: Percobaan[] = [];
  const catat = (p: Percobaan) => percobaan.push(p);

  let klas: HasilKlasifikasi = pemicu
    ? { kelompok: pemicu.kelompok, yakin: 1, sumber: "pemicu" }
    : await klasifikasikan(klien, tabel, tarif, teksKerja, opsi.sinyal, catat);
  if (klas.sumber !== "pemicu" && terlaluRagu(klas)) {
    const naik = naikSatuTingkat(tabel, klas.kelompok, pelaku.peranId);
    if (naik) klas = { ...klas, kelompok: naik.kelompok };
  }
  const pilihan = pilihRute(tabel, klas.kelompok, pelaku.peranId);
  if (!pilihan.ok) {
    await catatPemakaianTanpaPesan(db, pelaku, percakapanId, percobaan, kurs.kurs);
    yield gagal(pilihan.alasan);
    return;
  }
  let rute = pilihan.rute;

  // 3. Permintaan, perkiraan, tahan dana --------------------------------------
  const riwayat = await riwayatUntukPermintaan(db, percakapanId);
  const buatPermintaan = (r: RuteKelompok): PermintaanAi => {
    const modul = pilihModul({ modul: proyek.modul, teks: teksKerja, pemicu, kelompok: r.kelompok, labelMode: r.label }).terpilih;
    const adaFallback = tarif.get(r.model)?.fallback === true;
    return susunPermintaan({ rute: r, corePrompt: proyek.corePrompt, modul, riwayat, teksPengguna: teksKerja, fallback: adaFallback });
  };

  let permintaan = buatPermintaan(rute);
  let perkiraan = await perkirakanGiliran(klien, permintaan, rute, tarif, kurs.kurs, pengaturan, pelaku.superAdmin);

  const pesanId = `aip-${randomUUID()}`;
  let ditahan = 0;
  if (!pelaku.superAdmin) {
    const saldo = await saldoPengguna(db, pelaku.id);
    if (saldo < perkiraan.perkiraanRp) {
      await catatPemakaianTanpaPesan(db, pelaku, percakapanId, percobaan, kurs.kurs);
      yield gagal(`Saldo ALETA Ai Anda (Rp${saldo.toLocaleString("id-ID")}) tidak cukup untuk giliran ini (perkiraan Rp${perkiraan.perkiraanRp.toLocaleString("id-ID")}). Hubungi Super Admin untuk mengisi saldo.`);
      return;
    }
    ditahan = Math.min(saldo, Math.max(perkiraan.tahanRp, perkiraan.perkiraanRp));
    if (!(await tahanDana(db, pelaku.id, ditahan, pesanId))) {
      await catatPemakaianTanpaPesan(db, pelaku, percakapanId, percobaan, kurs.kurs);
      yield gagal("Saldo ALETA Ai Anda tidak cukup. Hubungi Super Admin untuk mengisi saldo.");
      return;
    }
  }

  // Simpan pesan pengguna dan tempat jawaban (status berjalan).
  const t0 = sekarang.getTime();
  const waktuPengguna = new Date(t0).toISOString();
  const waktuAi = new Date(t0 + 1).toISOString();
  const idPengguna = `aip-${randomUUID()}`;
  await db.run(
    `INSERT INTO aleta_ai_obrolan_pesan (id, percakapan_id, pemilik_id, peran, isi, pemicu, status, dibuat_at) VALUES (?, ?, ?, 'pengguna', ?, ?, 'selesai', ?)`,
    [idPengguna, percakapanId, pelaku.id, sandiIsi(teksKerja), pemicu?.kode ?? "", waktuPengguna]
  );
  await db.run(
    `INSERT INTO aleta_ai_obrolan_pesan (id, percakapan_id, pemilik_id, peran, isi, kelompok, model, effort, mode_label, status, perkiraan_rp, gratis, dibuat_at)
     VALUES (?, ?, ?, 'ai', '', ?, ?, ?, ?, 'berjalan', ?, ?, ?)`,
    [pesanId, percakapanId, pelaku.id, rute.kelompok, rute.model, rute.effort, rute.label, perkiraan.perkiraanRp, pelaku.superAdmin ? 1 : 0, waktuAi]
  );

  // Dari sini setiap jalan keluar HARUS melewati penyelesaian (blok finally).
  const kendali = new AbortController();
  const putus = () => kendali.abort();
  opsi.sinyal?.addEventListener("abort", putus, { once: true });

  let status: "selesai" | "terpotong" | "ditolak" | "gagal" = "gagal";
  let jawaban = "";
  let modelAkhir = rute.model;
  let pesanGagal = "";
  let hasilTutup: { biayaRp: number; saldoRp: number } | null = null;
  let ditutup = false;

  const tutup = async (): Promise<{ biayaRp: number; saldoRp: number }> => {
    if (hasilTutup) return hasilTutup;
    ditutup = true;
    const totalUsd = percobaan.reduce((n, p) => n + p.usd, 0);
    const totalToken = percobaan.reduce<PenggunaanToken>((a, p) => jumlahkanPenggunaan(a, p.penggunaan), PENGGUNAAN_NOL);
    const harga = hitungHarga(totalUsd, kurs.kurs, parameterHarga(pengaturan), { gratis: pelaku.superAdmin });
    // Giliran gagal tidak dipotong; ditolak tanpa satu kata pun keluaran juga tidak (biaya
    // pengklasifikasi yang sangat kecil ditanggung pengelola, tetap tercatat di penggunaan).
    const tagih = status === "gagal" || (status === "ditolak" && !jawaban) ? 0 : harga.tagihRp;

    let potong = { dipotongRp: 0, tidakTertagihRp: 0, saldoSetelah: 0 };
    if (pelaku.superAdmin) {
      potong.saldoSetelah = await saldoPengguna(db, pelaku.id);
    } else {
      const s = await selesaikanTahanan(db, pelaku.id, pesanId, tagih);
      potong = { dipotongRp: s.dipotongRp, tidakTertagihRp: s.tidakTertagihRp, saldoSetelah: s.saldoSetelah };
    }

    await db.run(
      `UPDATE aleta_ai_obrolan_pesan SET isi = ?, kelompok = ?, model = ?, effort = ?, mode_label = ?, status = ?, token_masuk = ?, token_keluar = ?, token_cache_tulis = ?, token_cache_baca = ?,
         biaya_usd = ?, kurs_dasar = ?, kurs = ?, kurs_tanggal = ?, kurs_sumber = ?, biaya_api_rp = ?, biaya_mdr_rp = ?, biaya_rp = ?, perkiraan_rp = ?, gratis = ? WHERE id = ?`,
      [
        sandiIsi(jawaban),
        rute.kelompok,
        modelAkhir,
        rute.effort,
        rute.label,
        status,
        totalToken.masuk,
        totalToken.keluar,
        totalToken.cacheTulis,
        totalToken.cacheBaca,
        totalUsd,
        harga.kursDasar,
        harga.kurs,
        kurs.tanggal,
        kurs.sumber.slice(0, 120),
        harga.biayaApiRp,
        // MDR mengikuti yang benar-benar terpotong (giliran gagal/gratis = 0).
        potong.dipotongRp > 0 ? harga.biayaMdrRp * (potong.dipotongRp / Math.max(1, harga.tagihRp)) : 0,
        potong.dipotongRp,
        perkiraan.perkiraanRp,
        pelaku.superAdmin ? 1 : 0,
        pesanId,
      ]
    );
    for (const p of percobaan) {
      await db.run(
        `INSERT INTO aleta_ai_penggunaan (id, pesan_id, percakapan_id, pengguna_id, peran_id, jenis, model, effort, kelompok, token_masuk, token_keluar, token_cache_tulis, token_cache_baca, biaya_usd, kurs_dasar, biaya_api_rp, dibuat_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`aiu-${randomUUID()}`, pesanId, percakapanId, pelaku.id, pelaku.peranId, p.jenis, p.model, p.effort, p.kelompok, p.penggunaan.masuk, p.penggunaan.keluar, p.penggunaan.cacheTulis, p.penggunaan.cacheBaca, p.usd, kurs.kurs, p.usd * kurs.kurs, new Date().toISOString()]
      );
    }

    const judulSekarang = bukaIsi(percakapan.judul);
    const judulBaru = !judulSekarang || judulSekarang === JUDUL_BAWAAN ? ringkasJudul(teksKerja) : null;
    await db.run(
      `UPDATE aleta_ai_obrolan SET jumlah_pesan = jumlah_pesan + 2, proyek_versi = ?, diperbarui_at = ?${judulBaru ? ", judul = ?" : ""} WHERE id = ?`,
      [proyek.versi, new Date().toISOString(), ...(judulBaru ? [sandiIsi(judulBaru)] : []), percakapanId]
    );
    await catatJejak(db, {
      penggunaId: pelaku.id,
      peranId: pelaku.peranId,
      aksi: "pesan",
      percakapanId,
      pesanId,
      model: modelAkhir,
      tokenTotal: totalToken.masuk + totalToken.keluar + totalToken.cacheTulis + totalToken.cacheBaca,
      biayaUsd: totalUsd,
      biayaRp: potong.dipotongRp,
      hasil: status,
      ringkas: `kelompok=${rute.kelompok}; sumber=${klas.sumber}${pemicu ? `; pemicu=${pemicu.kode}` : ""}${potong.tidakTertagihRp ? `; tak tertagih Rp${potong.tidakTertagihRp}` : ""}${pesanGagal ? `; ${pesanGagal}` : ""}`,
    });

    hasilTutup = { biayaRp: potong.dipotongRp, saldoRp: potong.saldoSetelah };
    return hasilTutup;
  };

  try {
    yield { jenis: "perkiraan", mode: rute.label, label: rute.label, perkiraanRp: perkiraan.perkiraanRp };

    let percobaanKe = 0;
    for (;;) {
      percobaanKe += 1;
      const antrian = new Antrian<string>();
      const janji = klien.alirkan(permintaan, { onTeks: (d) => antrian.dorong(d), sinyal: kendali.signal }).then(
        (h) => {
          antrian.tutup();
          return { h, galat: null as GalatKlienAi | null };
        },
        (e: unknown) => {
          antrian.tutup();
          return { h: null as HasilAi | null, galat: jinakkanGalat(e) };
        }
      );

      let teksPercobaan = "";
      for await (const delta of antrian) {
        teksPercobaan += delta;
        jawaban += delta;
        yield { jenis: "teks", delta };
      }
      const { h, galat } = await janji;

      if (galat || !h) {
        status = "gagal";
        pesanGagal = galat?.kode ?? "lain";
        if (galat?.kode !== "dibatalkan") {
          const tutupHasil = await tutup();
          void tutupHasil;
          yield gagal(galat?.message ?? "Terjadi gangguan pada layanan AI.");
        }
        return;
      }

      const biaya = biayaPanggilan(tarif, rute.model, h);
      percobaan.push({ jenis: "jawaban", model: h.model || rute.model, effort: rute.effort, kelompok: rute.kelompok, penggunaan: biaya.penggunaan, usd: biaya.usd });
      modelAkhir = h.model || rute.model;

      if (h.berhenti === "ditolak") {
        // Ditolak sebelum keluaran apa pun: coba sekali pada tingkat di atasnya.
        const naik = !teksPercobaan && percobaanKe < 2 ? naikSatuTingkat(tabel, rute.kelompok, pelaku.peranId) : null;
        if (naik) {
          const permintaanBaru = buatPermintaan(naik);
          const perkiraanBaru = await perkirakanGiliran(klien, permintaanBaru, naik, tarif, kurs.kurs, pengaturan, pelaku.superAdmin);
          if (!pelaku.superAdmin) {
            const perlu = Math.max(0, perkiraanBaru.tahanRp - ditahan);
            if (perlu > 0) {
              if (!(await tambahTahanan(db, pelaku.id, perlu, pesanId))) {
                status = "ditolak";
                yield gagal(PESAN_DITOLAK);
                return;
              }
              ditahan += perlu;
            }
          }
          rute = naik;
          permintaan = permintaanBaru;
          perkiraan = perkiraanBaru;
          modelAkhir = rute.model;
          yield { jenis: "perkiraan", mode: rute.label, label: rute.label, perkiraanRp: perkiraan.perkiraanRp };
          continue;
        }
        status = "ditolak";
        if (jawaban) {
          const catatan = `\n\n[${PESAN_DITOLAK}]`;
          jawaban += catatan;
          yield { jenis: "teks", delta: catatan };
          const t = await tutup();
          yield { jenis: "selesai", pesanId, mode: rute.label, label: rute.label, biayaRp: t.biayaRp, saldoRp: t.saldoRp };
        } else {
          await tutup();
          yield gagal(PESAN_DITOLAK);
        }
        return;
      }

      if (h.berhenti === "batas") {
        status = "terpotong";
        jawaban += CATATAN_TERPOTONG;
        yield { jenis: "teks", delta: CATATAN_TERPOTONG };
      } else {
        status = "selesai";
      }
      const t = await tutup();
      yield { jenis: "selesai", pesanId, mode: rute.label, label: rute.label, biayaRp: t.biayaRp, saldoRp: t.saldoRp };
      return;
    }
  } finally {
    opsi.sinyal?.removeEventListener("abort", putus);
    // Putus tengah jalan (pelanggan menutup SSE) atau galat tak terduga: hentikan
    // panggilan dan tetap lepaskan tahanan.
    kendali.abort();
    if (!ditutup) {
      status = status === "selesai" || status === "terpotong" || status === "ditolak" ? status : "gagal";
      try {
        await tutup();
      } catch {
        /* penutupan darurat tidak boleh melempar dari finally */
      }
    }
  }
}

function ringkasJudul(teksPesan: string): string {
  const bersih = teksPesan.replace(/\s+/g, " ").trim();
  return bersih.length > 60 ? `${bersih.slice(0, 57)}...` : bersih;
}

/** Pemakaian (mis. pengklasifikasi) yang terjadi tanpa giliran jawaban: dicatat, tidak ditagih. */
async function catatPemakaianTanpaPesan(db: AletaDatabase, pelaku: PelakuAi, percakapanId: string, percobaan: Percobaan[], kurs: number) {
  for (const p of percobaan) {
    await db.run(
      `INSERT INTO aleta_ai_penggunaan (id, pesan_id, percakapan_id, pengguna_id, peran_id, jenis, model, effort, kelompok, token_masuk, token_keluar, token_cache_tulis, token_cache_baca, biaya_usd, kurs_dasar, biaya_api_rp, dibuat_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`aiu-${randomUUID()}`, percakapanId, pelaku.id, pelaku.peranId, p.jenis, p.model, p.effort, p.kelompok, p.penggunaan.masuk, p.penggunaan.keluar, p.penggunaan.cacheTulis, p.penggunaan.cacheBaca, p.usd, kurs, p.usd * kurs, new Date().toISOString()]
    );
  }
}
