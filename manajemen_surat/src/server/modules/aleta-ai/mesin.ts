import { randomUUID } from "node:crypto";

import {
  biayaUsd,
  biayaUsdBanyak,
  hitungHarga,
  jumlahkanPenggunaan,
  PENGGUNAAN_NOL,
  perkirakanTokenDariKarakter,
  type PenggunaanToken,
  type Tarif,
} from "@/lib/aleta-ai/biaya";
import { cariPemicuDiAwalTeks, pilihModul, type PemicuMenu } from "@/lib/aleta-ai/proyek";
import {
  hitungKarakterPermintaan,
  susunPermintaan,
  susunPermintaanKlasifikasi,
  BATAS_KARAKTER_PESAN_PENGGUNA,
  type BlokPesan,
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
import { kemampuanDiminta } from "@/lib/aleta-ai/kemampuan";
import { PemulihAliran } from "@/lib/aleta-ai/samaran";
import { bolehDrafPenetapanAi, bolehKemampuanAi, pesanTolakKemampuanAi } from "@/lib/matriks-peran";
import { golonganPelakuAi, type PelakuAi } from "@/server/modules/aleta-ai/akses";
import { alatApiUntukPelaku, jalankanAlat } from "@/server/modules/aleta-ai/alat";
import { ambilKlienAi, GalatKlienAi, jinakkanGalat, type HasilAi, type KlienAi } from "@/server/modules/aleta-ai/klien";
import { bacaTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { muatPenyamar, simpanPenyamar } from "@/server/modules/aleta-ai/samaran";
import { kursBerlaku, segarkanKursBilaPerlu, tanggalLokal, type PengambilKurs } from "@/server/modules/aleta-ai/kurs";
import { pastikanKuotaBulanIni } from "@/server/modules/aleta-ai/kuota";
import { periksaBatas } from "@/server/modules/aleta-ai/batas";
import { ambilMilik, bukaIsi, JUDUL_BAWAAN, riwayatUntukPermintaan, sandiIsi } from "@/server/modules/aleta-ai/percakapan";
import { bacaPengaturan, bacaRute, bacaTarif, catatJejak, type PengaturanAi } from "@/server/modules/aleta-ai/pengaturan";
import { nilaiPerkiraan, parameterHarga, rupiahPerkiraan, type PerkiraanBiaya } from "@/server/modules/aleta-ai/perkiraan";
import { proyekAktif } from "@/server/modules/aleta-ai/proyek";
import { dibatalkanSaklar, pantauSaklar } from "@/server/modules/aleta-ai/saklar";
import { saldoPengguna, selesaikanTahanan, tahanDana, tambahTahanan } from "@/server/modules/aleta-ai/saldo";
import { ApiError } from "@/server/shared/errors";

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
 * TAHAP 2a (23 Okt 2026)
 *   - matriks kemampuan per peran (matriks-peran.ts KEMAMPUAN_AI) diperiksa
 *     sesudah rute: permintaan membuat naskah yang tidak berhak = ditolak sopan
 *     tanpa panggilan API, dicatat di jejak ("tolak-kemampuan");
 *   - PENYAMARAN DUA ARAH: semua teks yang keluar (pengklasifikasi, riwayat,
 *     pesan, hasil alat) lewat Penyamar percakapan ini; jawaban model
 *     dipulihkan (PemulihAliran) sebelum dialirkan dan disimpan;
 *   - ALAT DATA BACA-SAJA: alat yang ditawarkan sudah disaring hak peran;
 *     stop_reason tool_use -> jalankanAlat (hak diperiksa ULANG di sana) ->
 *     tool_result -> panggilan lanjut, paling banyak BATAS_PUTARAN_ALAT kali.
 *
 * Penyelesaian (langkah 5-6) ada di blok finally: pelanggan yang memutus
 * sambungan atau galat di tengah jalan tetap melepas tahanannya.
 */

const teks = (n: unknown) => String(n ?? "").trim();

export type EventAi =
  | { jenis: "perkiraan"; mode: string; label: string; perkiraanRp: number }
  | { jenis: "teks"; delta: string }
  | { jenis: "alat"; nama: string; label: string }
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
/** Putaran alat paling banyak per giliran (tiap putaran = satu panggilan API berbayar). */
export const BATAS_PUTARAN_ALAT = 5;
export const CATATAN_BATAS_ALAT = "\n\n[Pembacaan data dihentikan karena mencapai batas putaran alat. Persempit pertanyaannya bila perlu.]";

const LABEL_ALAT: Record<string, string> = {
  rekap_relaas_retur: "rekap relaas retur",
  rekap_sisa_perkara: "rekap sisa perkara",
  rekap_perkara_lewat_5_bulan: "perkara lewat 5 bulan",
  rekap_bht_tertunda: "BHT tertunda",
  rekap_beban_majelis: "beban majelis",
  rekap_jadwal_sidang: "jadwal sidang",
  data_perkara: "data perkara",
  rekap_keuangan_perkara: "rekap keuangan perkara",
  data_keuangan_perkara: "jurnal keuangan perkara",
};

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

type Perkiraan = { tokenMasuk: number; usd: number; perkiraanRp: number; tahanRp: number; biayaApiRp: number };

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
  return { tokenMasuk, usd, ...rupiahPerkiraan(usd, kursDasar, pengaturan, gratis) };
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
  const klien = await ambilKlienAi(db);
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
  const batasAwal = await periksaBatas(db, pelaku, pengaturan, sekarang);
  if (!batasAwal.ok) {
    yield gagal(batasAwal.alasan);
    return;
  }
  // Kuota hibah per peran (bila diatur Super Admin): sekali per bulan, tercatat sebagai mutasi "kuota".
  await pastikanKuotaBulanIni(db, pelaku, sekarang);
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

  // Penyamaran dua arah: SEMUA teks yang keluar ke layanan AI lewat penyamar ini.
  const penyamar = await muatPenyamar(db, percakapanId);
  const timpaan = await bacaTimpaanKemampuan(db);

  // 2. Rute -------------------------------------------------------------------
  let pemicu: PemicuMenu | null = kodePemicu ? (proyek.menu.find((p) => p.kode === kodePemicu) ?? null) : null;
  if (!pemicu) pemicu = cariPemicuDiAwalTeks(proyek.menu, teksPengguna);
  const diawaliAlias = pemicu ? cariPemicuDiAwalTeks([pemicu], teksPengguna) !== null : false;
  const teksKerja = pemicu && !diawaliAlias ? `${pemicu.label}${teksPengguna ? `\n${teksPengguna}` : ""}` : teksPengguna;

  const percobaan: Percobaan[] = [];
  const catat = (p: Percobaan) => percobaan.push(p);

  let klas: HasilKlasifikasi = pemicu
    ? { kelompok: pemicu.kelompok, yakin: 1, sumber: "pemicu" }
    : await klasifikasikan(klien, tabel, tarif, penyamar.samarkan(teksKerja), opsi.sinyal, catat);
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

  // Matriks kemampuan per peran (rencana v2 10.3), ditegakkan di server.
  const golongan = golonganPelakuAi(pelaku);
  for (const diminta of kemampuanDiminta(teksKerja, rute.kelompok)) {
    const boleh =
      diminta.kemampuan === "draf-penetapan"
        ? bolehDrafPenetapanAi(golongan, diminta.jenisPenetapan ?? "", timpaan)
        : bolehKemampuanAi(golongan, diminta.kemampuan, timpaan);
    if (boleh) continue;
    await catatPemakaianTanpaPesan(db, pelaku, percakapanId, percobaan, kurs.kurs);
    await simpanPenyamar(db, percakapanId, penyamar);
    await catatJejak(db, {
      penggunaId: pelaku.id,
      peranId: pelaku.peranId,
      aksi: "tolak-kemampuan",
      percakapanId,
      hasil: "tolak",
      ringkas: `kemampuan=${diminta.kemampuan}${diminta.jenisPenetapan ? `; jenis=${diminta.jenisPenetapan}` : ""}`,
    });
    yield gagal(pesanTolakKemampuanAi(diminta.kemampuan, timpaan));
    return;
  }

  // 3. Permintaan, perkiraan, tahan dana --------------------------------------
  // Riwayat & pesan disamarkan; konteks perkara percakapan (bila ada) ikut sebagai catatan.
  const riwayat = (await riwayatUntukPermintaan(db, percakapanId)).map((p) => ({ ...p, isi: penyamar.samarkan(p.isi) }));
  const alatApi = alatApiUntukPelaku(pelaku, timpaan);
  const perkaraRef = teks(percakapan.perkara_ref);
  const teksKeluar = `${perkaraRef && alatApi.length ? `[Konteks perkara percakapan ini: ${perkaraRef}]\n` : ""}${penyamar.samarkan(teksKerja)}`;
  const buatPermintaan = (r: RuteKelompok): PermintaanAi => {
    const modul = pilihModul({ modul: proyek.modul, teks: teksKerja, pemicu, kelompok: r.kelompok, labelMode: r.label }).terpilih;
    const adaFallback = tarif.get(r.model)?.fallback === true;
    return susunPermintaan({ rute: r, corePrompt: proyek.corePrompt, modul, riwayat, teksPengguna: teksKeluar, fallback: adaFallback, alat: alatApi });
  };

  let permintaan = buatPermintaan(rute);
  let perkiraan = await perkirakanGiliran(klien, permintaan, rute, tarif, kurs.kurs, pengaturan, pelaku.superAdmin);

  const batasPerkiraan = await periksaBatas(db, pelaku, pengaturan, sekarang, {
    tambahanRp: perkiraan.perkiraanRp,
    tambahanToken: perkiraan.tokenMasuk + rute.perkiraanKeluaran,
    tambahanApiRp: perkiraan.biayaApiRp,
  });
  if (!batasPerkiraan.ok) {
    await catatPemakaianTanpaPesan(db, pelaku, percakapanId, percobaan, kurs.kurs);
    yield gagal(batasPerkiraan.alasan);
    return;
  }

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
  // Saklar darurat: dimatikan Super Admin -> giliran ini dihentikan seketika (tidak dipotong).
  const lepasPantau = pantauSaklar(db, kendali);

  let status: "selesai" | "terpotong" | "ditolak" | "gagal" = "gagal";
  let jawaban = "";
  let modelAkhir = rute.model;
  let pesanGagal = "";
  let hasilTutup: { biayaRp: number; saldoRp: number } | null = null;
  let ditutup = false;

  const tutup = async (): Promise<{ biayaRp: number; saldoRp: number }> => {
    if (hasilTutup) return hasilTutup;
    ditutup = true;
    try {
      await simpanPenyamar(db, percakapanId, penyamar);
    } catch {
      /* kode baru yang gagal disimpan hanya membuat kode lain di giliran berikutnya */
    }
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
    let putaranAlat = 0;
    for (;;) {
      percobaanKe += 1;
      const pemulih = new PemulihAliran(penyamar);
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
        const pulih = pemulih.dorong(delta);
        if (pulih) {
          jawaban += pulih;
          yield { jenis: "teks", delta: pulih };
        }
      }
      const sisaPulih = pemulih.akhir();
      if (sisaPulih) {
        jawaban += sisaPulih;
        yield { jenis: "teks", delta: sisaPulih };
      }
      const { h, galat } = await janji;

      if (galat || !h) {
        status = "gagal";
        pesanGagal = galat?.kode ?? "lain";
        if (dibatalkanSaklar(kendali.signal)) {
          pesanGagal = "saklar-darurat";
          await tutup();
          yield gagal(PESAN_NONAKTIF_SAKLAR);
        } else if (galat?.kode !== "dibatalkan") {
          const tutupHasil = await tutup();
          void tutupHasil;
          yield gagal(galat?.message ?? "Terjadi gangguan pada layanan AI.");
        }
        return;
      }

      const biaya = biayaPanggilan(tarif, rute.model, h);
      percobaan.push({ jenis: "jawaban", model: h.model || rute.model, effort: rute.effort, kelompok: rute.kelompok, penggunaan: biaya.penggunaan, usd: biaya.usd });
      modelAkhir = h.model || rute.model;

      // Putaran alat: jalankan (hak diperiksa ulang), kirim hasil TERSAMAR, panggil lagi.
      if (h.berhenti === "alat" && (h.alat?.length ?? 0) > 0 && alatApi.length > 0) {
        if (putaranAlat >= BATAS_PUTARAN_ALAT) {
          status = "terpotong";
          jawaban += CATATAN_BATAS_ALAT;
          yield { jenis: "teks", delta: CATATAN_BATAS_ALAT };
          const t = await tutup();
          yield { jenis: "selesai", pesanId, mode: rute.label, label: rute.label, biayaRp: t.biayaRp, saldoRp: t.saldoRp };
          return;
        }
        putaranAlat += 1;
        const hasilAlat: BlokPesan[] = [];
        for (const a of h.alat ?? []) {
          yield { jenis: "alat", nama: a.name, label: LABEL_ALAT[a.name] ?? "data" };
          const r = await jalankanAlat({ db, pelaku, timpaan, sekarang, penyamar, percakapanId, pesanId }, a.name, a.input);
          hasilAlat.push({
            type: "tool_result",
            tool_use_id: a.id,
            // Jaring pengaman: apa pun yang keluar lewat penyamar sekali lagi.
            content: penyamar.samarkan(JSON.stringify(r.isi)),
            ...(r.status === "ok" || r.status === "tidak-ditemukan" ? {} : { is_error: true }),
          });
        }
        permintaan = {
          ...permintaan,
          messages: [...permintaan.messages, { role: "assistant", content: (h.konten ?? []) as BlokPesan[] }, { role: "user", content: hasilAlat }],
        };
        if (jawaban && !/\n$/.test(jawaban)) {
          jawaban += "\n\n";
          yield { jenis: "teks", delta: "\n\n" };
        }
        continue;
      }

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
    lepasPantau();
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

// ----------------------------------------------------------------------------
// Perkiraan biaya SEBELUM giliran berjalan (tahap 4)
// ----------------------------------------------------------------------------

/**
 * Perkiraan rupiah untuk pesan yang BELUM dikirim: rute dari pemicu atau kata
 * kunci (pengklasifikasi berbayar TIDAK dipanggil di sini), token masuk dari
 * count_tokens (gratis) atau karakter/4, keluaran = perkiraan kelompok.
 * Tidak menahan dana, tidak mencatat apa pun, tidak memakai jatah batas laju.
 * Bila nanti pengklasifikasi memilih kelompok lain, peristiwa "perkiraan" di
 * awal giliran memuat angka barunya sebelum dana ditahan.
 */
export async function perkirakanPesan(
  db: AletaDatabase,
  pelaku: PelakuAi,
  percakapanId: string,
  masukan: MasukanPesan,
  opsi: { sekarang?: Date } = {}
): Promise<PerkiraanBiaya> {
  const sekarang = opsi.sekarang ?? new Date();
  const teksPengguna = teks(masukan.teks);
  const kodePemicu = teks(masukan.pemicu);
  if (!teksPengguna && !kodePemicu) throw new ApiError(400, "Tulis pertanyaan Anda dulu, atau pilih salah satu tombol cepat.");
  if (teksPengguna.length > BATAS_KARAKTER_PESAN_PENGGUNA) throw new ApiError(400, "Pesan terlalu panjang.");
  if (percakapanId && !(await ambilMilik(db, pelaku.id, percakapanId))) throw new ApiError(404, "Percakapan tidak ditemukan.");
  const proyek = await proyekAktif(db);
  if (!proyek) throw new ApiError(409, PESAN_NONAKTIF_PROYEK);

  const pengaturan = await bacaPengaturan(db);
  const kurs = await kursBerlaku(db, sekarang);
  const tarif = new Map((await bacaTarif(db)).map((t) => [t.model, t]));
  const tabel = tabelRuteDari(await bacaRute(db));

  let pemicu: PemicuMenu | null = kodePemicu ? (proyek.menu.find((p) => p.kode === kodePemicu) ?? null) : null;
  if (!pemicu) pemicu = cariPemicuDiAwalTeks(proyek.menu, teksPengguna);
  const diawaliAlias = pemicu ? cariPemicuDiAwalTeks([pemicu], teksPengguna) !== null : false;
  const teksKerja = pemicu && !diawaliAlias ? `${pemicu.label}${teksPengguna ? `\n${teksPengguna}` : ""}` : teksPengguna;
  let klas: HasilKlasifikasi = pemicu ? { kelompok: pemicu.kelompok, yakin: 1, sumber: "pemicu" } : klasifikasiKataKunci(teksKerja);
  if (klas.sumber !== "pemicu" && terlaluRagu(klas)) {
    const naik = naikSatuTingkat(tabel, klas.kelompok, pelaku.peranId);
    if (naik) klas = { ...klas, kelompok: naik.kelompok };
  }
  const pilihan = pilihRute(tabel, klas.kelompok, pelaku.peranId);
  if (!pilihan.ok) throw new ApiError(403, pilihan.alasan);
  const rute = pilihan.rute;

  const riwayat = percakapanId ? await riwayatUntukPermintaan(db, percakapanId) : [];
  const modul = pilihModul({ modul: proyek.modul, teks: teksKerja, pemicu, kelompok: rute.kelompok, labelMode: rute.label }).terpilih;
  const permintaan = susunPermintaan({ rute, corePrompt: proyek.corePrompt, modul, riwayat, teksPengguna: teksKerja, fallback: tarif.get(rute.model)?.fallback === true });
  const klienAsli = await ambilKlienAi(db);
  const klien = klienAsli ?? { alirkan: async () => Promise.reject(new Error("tanpa klien")) };
  const perkiraan = await perkirakanGiliran(klien, permintaan, rute, tarif, kurs.kurs, pengaturan, pelaku.superAdmin);
  const hasil = await nilaiPerkiraan(
    db,
    pelaku,
    pengaturan,
    { kelompok: rute.kelompok, label: rute.label, tokenMasuk: perkiraan.tokenMasuk, tokenKeluar: rute.perkiraanKeluaran, perkiraanRp: perkiraan.perkiraanRp, tahanRp: perkiraan.tahanRp, biayaApiRp: perkiraan.biayaApiRp, kurs },
    sekarang
  );
  if (!klienAsli && hasil.bolehJalan) return { ...hasil, bolehJalan: false, alasan: PESAN_NONAKTIF_KUNCI };
  return hasil;
}
