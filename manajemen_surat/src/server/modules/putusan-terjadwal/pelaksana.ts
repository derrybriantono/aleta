import { anonimkanRtfBita, type SisaAnonim } from "@/lib/anonimisasi-putusan";
import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { hariLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import {
  BATAS,
  LANGKAH_TERJADWAL,
  NAMA_LANGKAH,
  dalamJendela,
  hhmmSah,
  isoDariMs,
  msDariIso,
  type PilihanJamKerja,
  type StatusLangkah,
} from "@/lib/putusan-terjadwal";
import { samarkanSisaBilaTersamar } from "@/lib/samarkan-sisa-rtf";
import { type AletaDatabase, getDatabase } from "@/server/db/client";
import {
  ambilKunciPenetapanGateway,
  gatewayUnggahPutusanSipp,
  getGatewaySippEntitasAnonim,
  getGatewaySippKonteks,
  getGatewayUnggahMassalCek,
  lepasKunciPenetapanGateway,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { PESAN_TOLAK_UNGGAH_PUTUSAN, pastikanMajelisPutusan, peranUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { konversiNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { kenaliBentuk, periksaBerkasUnggahSipp } from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

import { bacaBerkas, hapusBerkas, sha256 } from "./berkas";
import {
  bacaPengaturan,
  catatJejak,
  langkahDariBaris,
  sebaris,
  ubahButir,
  type BarisButir,
  type BarisJadwal,
  type PengaturanTerjadwal,
  type PerubahanButir,
} from "./dasar";

/**
 * ============================================================================
 * PELAKSANA SERVER UNGGAH PUTUSAN TERJADWAL - e-DOC PADA WAKTUNYA (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Berjalan di server portal (detak 30 detik, dinyalakan instrumentation.ts)
 * sehingga laptop petugas tidak perlu menyala untuk e-Doc. Satu detak
 * mengerjakan paling banyak SATU butir - itulah yang membuat jeda antar
 * perkara manusiawi walau banyak yang jatuh tempo bersamaan.
 *
 * BATAS JUJUR: yang dikerjakan di sini HANYA e-Doc putusan dan e-Doc
 * anonimisasi, lewat jalur tulis yang SAMA dengan unggah putusan ke SIPP
 * (gatewayUnggahPutusanSipp -> putusanUnggahService di bot). Mengisi dan
 * menyimpan formulir Putusan Akhir TIDAK dikerjakan di sini: bot tidak
 * menulis borang itu dengan aman (borang SIPP punya pilihan, praperiksa, dan
 * bukti simpan yang hanya hidup di halamannya), jadi langkah itu dikerjakan
 * ekstensi di peramban petugas yang terbuka (peramban.ts). Butir yang
 * memilih langkah itu menunggu sampai langkah isi tercatat selesai.
 *
 * URUTAN PENGAMAN sebelum satu berkas pun dikirim ke SIPP:
 *   1. akun ALETA pemilik jadwal masih aktif dan masih berhak (Super Admin,
 *      Admin, Hakim; hakim hanya perkara majelisnya);
 *   2. kunci perkara bersama penetapan/putusan (perkara dikerjakan pekerjaan
 *      lain = ditunda, tidak ditulis);
 *   3. cek ulang SIPP: Putusan Akhir sudah terisi; e-Doc yang SUDAH ada
 *      DILEWATI dan tidak pernah diganti (cek gagal = tidak mengunggah apa pun);
 *   4. berkas di penyimpanan utuh (sha256 sama dengan saat diunggah);
 *   5. pemeriksaan isi yang sama dengan rute unggah-sipp (nomor perkara di isi,
 *      bukan BAS/PHS/relaas, anonimisasi tidak memuat nama pihak);
 *   6. anonimisasi: penyamar ALETA (RTF; DOCX/DOC/PDF diubah dulu). Bila masih
 *      tersisa data pribadi, langkah anonimisasi TERTAHAN - tidak pernah
 *      diunggah diam-diam, dan tidak ada petugas di sini untuk menjawab
 *      "Tetap unggah". Cadangan anonimisasi ABT butuh sesi ABT petugas di
 *      peramban, jadi tidak tersedia di server.
 *   7. SESUDAH unggah, SIPP dibaca lagi: langkah baru dinyatakan selesai bila
 *      SIPP memang memuat e-Doc-nya (bukti dari SIPP, bukan dari jawaban bot).
 *
 * Tercatat atas akun SIPP milik penjadwal (butir.akun_sipp), peran penjadwal,
 * dan alamat peramban saat menjadwalkan (kolom ipaddress audit SIPP tidak
 * pernah diisi alamat server). Jejak jujur ke aleta_putusan_jadwal_jejak dan
 * audit_logs: pelaku "pelaksana server".
 */

export type SlotEdoc = "putusan" | "anonimisasi";

export type DepsPelaksana = {
  sekarang: () => Date;
  acak: () => number;
  bacaBerkas: (jalur: string) => Promise<Uint8Array | null>;
  hapusBerkas: (jalur: string) => Promise<boolean>;
  muatPengguna: (db: AletaDatabase, id: string) => Promise<{ id: string; name?: string | null; email?: string | null; isActive?: boolean; roleId?: string } | null>;
  periksaMilik: (actor: unknown, peran: string, perkaraId: string) => Promise<void>;
  ambilKunci: (p: { perkaraId: number; operator: string; tujuan: string }) => Promise<
    { ok: true; token: string } | { ok: false; alasan: "sedang_dikerjakan" | "kunci_tidak_tersedia"; oleh?: string; pesan?: string }
  >;
  lepasKunci: (perkaraId: number, token: string) => Promise<void>;
  cekSlot: (perkaraId: string) => Promise<{ ok: true; adaBaris: boolean; adaPutusan: boolean; adaAnonim: boolean } | { ok: false; sebab: string }>;
  konteksPihak: (nomor: string) => Promise<{ namaPihak: string[] | null; sebab: string }>;
  ubahKeRtf: (bita: Uint8Array, nama: string) => Promise<{ ok: true; bita: Uint8Array } | { ok: false; sebab: string }>;
  anonimkan: (rtf: Uint8Array, nomor: string) => Promise<{ ok: true; bita: Uint8Array; sisa: SisaAnonim[] } | { ok: false; sebab: string }>;
  unggah: (m: {
    perkaraId: string;
    nomorPerkara: string;
    putusan?: Uint8Array;
    anonimisasi?: Uint8Array;
    olehUsername: string;
    operator: string;
    peranPenekan: string;
    ip: string;
  }) => Promise<{ ok: boolean; sebab?: string; berkas: Array<{ jenis: string; ok: boolean; alasan?: string; pesan?: string }> }>;
  muatLibur: (db: AletaDatabase) => Promise<(iso: string) => boolean>;
};

// ──────────────────────────────────────────────────────────────────────────
// Dependensi asli
// ──────────────────────────────────────────────────────────────────────────

async function liburAsli(db: AletaDatabase) {
  try {
    await bacaHariLibur(db);
  } catch {
    /* daftar SKB tetap berlaku */
  }
  const peta = petaLiburBerlaku();
  return (iso: string) => hariLibur(iso, peta);
}

export function depsAsli(): DepsPelaksana {
  return {
    sekarang: () => new Date(),
    acak: Math.random,
    bacaBerkas: (jalur) => bacaBerkas(jalur),
    hapusBerkas: (jalur) => hapusBerkas(jalur),
    muatPengguna: async (db, id) => (await getUserByIdFromDb(db, id)) ?? null,
    periksaMilik: async (actor, peran, perkaraId) => {
      await pastikanMajelisPutusan(actor as { name?: string | null }, peran as Parameters<typeof pastikanMajelisPutusan>[1], perkaraId);
    },
    ambilKunci: async (p) => {
      // Masa pegang 5 menit: konversi + penyamaran + unggah dapat lebih dari bawaan 3 menit.
      const r = await ambilKunciPenetapanGateway({ ...p, ttlDetik: 300 });
      if (r.ok) {
        const d = r.data as { ok?: boolean; token?: string };
        if (d.ok !== false && d.token) return { ok: true, token: String(d.token) };
        return { ok: false, alasan: "kunci_tidak_tersedia", pesan: "bot tidak memberi kunci" };
      }
      const sibuk = r.error === "sedang_dikerjakan" || (r.badan as { alasan?: string } | undefined)?.alasan === "sedang_dikerjakan";
      return {
        ok: false,
        alasan: sibuk ? "sedang_dikerjakan" : "kunci_tidak_tersedia",
        pesan: r.error,
        ...(r.badan ? { oleh: String((r.badan as { oleh?: string }).oleh ?? "") } : {}),
      };
    },
    lepasKunci: async (perkaraId, token) => {
      try {
        await lepasKunciPenetapanGateway({ perkaraId, token });
      } catch {
        /* kunci kedaluwarsa sendiri */
      }
    },
    cekSlot: async (perkaraId) => {
      const r = await getGatewayUnggahMassalCek({ jenis: "putusan", perkaraId });
      if (!r.ok) return { ok: false, sebab: r.error || "SIPP belum dapat dibaca." };
      const d = r.data as { adaBaris?: boolean; adaPutusan?: boolean; adaAnonim?: boolean };
      return { ok: true, adaBaris: d.adaBaris !== false, adaPutusan: Boolean(d.adaPutusan), adaAnonim: Boolean(d.adaAnonim) };
    },
    konteksPihak: async (nomor) => {
      const k = await getGatewaySippKonteks(nomor);
      if (!k.ok) return { namaPihak: null, sebab: k.error || "SIPP tidak terbaca." };
      // Kuasa hukum TIDAK dipakai sebagai penanda: nama advokat lazim tetap tertulis (sama dengan rute unggah-sipp).
      const nama = (k.data?.nomorPihak ?? []).filter((satu) => satu.jenis !== "kuasa").map((satu) => satu.nama);
      return { namaPihak: nama, sebab: "" };
    },
    ubahKeRtf: async (bita, nama) => {
      try {
        const h = await konversiNaskah({ bita, namaBerkas: nama, ke: "rtf" });
        return { ok: true, bita: new Uint8Array(Buffer.from(h.berkasBase64, "base64")) };
      } catch (galat) {
        return { ok: false, sebab: galat instanceof Error ? galat.message : String(galat) };
      }
    },
    anonimkan: async (rtf, nomor) => {
      const entitas = await getGatewaySippEntitasAnonim(nomor);
      if (!entitas.ok) return { ok: false, sebab: `Data para pihak di SIPP belum terbaca (${entitas.error}).` };
      if (!entitas.data.pihak || entitas.data.pihak.length === 0) return { ok: false, sebab: "Nama para pihak perkara ini tidak terbaca di SIPP." };
      const h = anonimkanRtfBita(rtf, entitas.data, {});
      return { ok: true, bita: h.bita, sisa: h.sisa };
    },
    unggah: async (m) => {
      const r = await gatewayUnggahPutusanSipp({
        perkaraId: m.perkaraId,
        nomorPerkara: m.nomorPerkara,
        ...(m.putusan ? { putusanBase64: Buffer.from(m.putusan).toString("base64") } : {}),
        ...(m.anonimisasi ? { anonimisasiBase64: Buffer.from(m.anonimisasi).toString("base64") } : {}),
        olehUsername: m.olehUsername,
        operator: m.operator,
        peranPenekan: m.peranPenekan,
        ip: m.ip,
      });
      if (!r.ok) return { ok: false, sebab: r.error || "ALETA Bot belum dapat dihubungi.", berkas: [] };
      return { ok: r.data.ok !== false, sebab: r.data.alasan, berkas: r.data.berkas ?? [] };
    },
    muatLibur: liburAsli,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Hasil satu butir
// ──────────────────────────────────────────────────────────────────────────

type HasilLangkah = { status: StatusLangkah; catatan: string };
export type HasilEdocButir = {
  putusan?: HasilLangkah;
  anonim?: HasilLangkah;
  /** Ditunda sementara: langkah kembali "menunggu", jalan lagi sesudah detik ini. */
  tunda?: { detik: number; sebab: string };
};

const SEBAB_TERTAHAN = (n: number, daftar: SisaAnonim[]) =>
  `Anonimisasi masih memuat ${n} bagian yang tampak data pribadi (${daftar
    .slice(0, 4)
    .map((s) => `${s.jenis} "${String(s.kata).slice(0, 24)}"`)
    .join(", ")}${n > 4 ? ", ..." : ""}) dan tidak dapat disamarkan otomatis. Tidak diunggah: samarkan lalu unggah lewat Unggah putusan ke SIPP.`;

function jendelaPilihan(j: BarisJadwal | undefined): PilihanJamKerja {
  return {
    ...(j?.jam_dari && hhmmSah(j.jam_dari) ? { dari: j.jam_dari } : {}),
    ...(j?.jam_sampai && hhmmSah(j.jam_sampai) ? { sampai: j.jam_sampai } : {}),
    malamBoleh: j?.malam_boleh === 1,
  };
}

/**
 * Mengerjakan e-Doc satu butir yang SUDAH diklaim. TIDAK PERNAH melempar;
 * pulang hasil per langkah. Hanya langkah yang berstatus "jalan" dikerjakan.
 */
export async function jalankanEdocButir(db: AletaDatabase, deps: DepsPelaksana, b: BarisButir): Promise<HasilEdocButir> {
  const mau = { putusan: b.langkah_putusan === 1 && b.status_putusan === "jalan", anonim: b.langkah_anonim === 1 && b.status_anonim === "jalan" };
  const semuaGagal = (sebab: string, status: StatusLangkah = "gagal"): HasilEdocButir => ({
    ...(mau.putusan ? { putusan: { status, catatan: sebab } } : {}),
    ...(mau.anonim ? { anonim: { status, catatan: sebab } } : {}),
  });
  try {
    // 1. Akun ALETA pemilik jadwal: masih aktif dan masih berhak.
    const aktor = await deps.muatPengguna(db, b.pemilik_id);
    if (!aktor || aktor.isActive === false) return semuaGagal("Akun ALETA yang menjadwalkan tidak ditemukan atau sudah nonaktif; tidak ada yang dikirim ke SIPP.");
    const peran = peranUnggahPutusan(aktor as Parameters<typeof peranUnggahPutusan>[0]);
    if (!peran) return semuaGagal(PESAN_TOLAK_UNGGAH_PUTUSAN);
    try {
      await deps.periksaMilik(aktor, String(peran), b.perkara_id);
    } catch (galat) {
      return semuaGagal(galat instanceof ApiError ? galat.message : `Kewenangan atas perkara ini tidak dapat dipastikan (${sebaris((galat as Error)?.message, 120)}).`);
    }
    if (!b.akun_sipp) return semuaGagal("Akun SIPP penanggung jawab jadwal tidak tercatat; tidak ada yang dikirim ke SIPP.");

    // 2. Berkas utuh.
    const bita = b.berkas_jalur ? await deps.bacaBerkas(b.berkas_jalur) : null;
    if (!bita) return semuaGagal("Berkas putusan tidak ada lagi di penyimpanan (sudah dihapus atau hilang); jadwalkan ulang dengan berkas yang diseret lagi.");
    if (b.berkas_sha256 && sha256(bita) !== b.berkas_sha256) return semuaGagal("Isi berkas berubah sejak diunggah (sidik jari tidak sama); tidak dikirim ke SIPP.");

    // 3. Kunci perkara bersama penetapan/putusan.
    const operator = sebaris(`jadwal: ${aktor.name || aktor.email || aktor.id}`, 120);
    const kunci = await deps.ambilKunci({ perkaraId: Number(b.perkara_id), operator, tujuan: "putusan-terjadwal" });
    if (!kunci.ok) {
      return {
        tunda: {
          detik: 120,
          sebab:
            kunci.alasan === "sedang_dikerjakan"
              ? `Perkara sedang dikerjakan${kunci.oleh ? ` oleh ${kunci.oleh}` : ""}; diulang beberapa saat lagi supaya tidak tertulis ganda.`
              : `Kunci perkara belum dapat diambil (${sebaris(kunci.pesan, 120) || "tidak ada jawaban"}); penulisan ditahan, diulang sebentar lagi.`,
        },
      };
    }
    try {
      return await edocDenganKunci(db, deps, b, aktor, String(peran), bita, mau);
    } finally {
      await deps.lepasKunci(Number(b.perkara_id), kunci.token);
    }
  } catch (galat) {
    return semuaGagal(`Error tak terduga: ${sebaris((galat as Error)?.message ?? galat, 200)}`);
  }
}

async function edocDenganKunci(
  db: AletaDatabase,
  deps: DepsPelaksana,
  b: BarisButir,
  aktor: { id: string; name?: string | null; email?: string | null },
  peran: string,
  bita: Uint8Array,
  mau: { putusan: boolean; anonim: boolean }
): Promise<HasilEdocButir> {
  void db;
  const hasil: HasilEdocButir = {};
  // 4. Cek SIPP: Putusan Akhir sudah ada; e-Doc yang ada tidak diganti.
  const cek = await deps.cekSlot(b.perkara_id);
  if (!cek.ok) return { tunda: { detik: 180, sebab: `e-Doc yang sudah ada belum dapat diperiksa (${sebaris(cek.sebab, 160)}); tidak ada yang diunggah supaya tidak menimpa.` } };
  if (!cek.adaBaris) {
    return { tunda: { detik: 300, sebab: "Putusan Akhir belum terisi di SIPP, jadi e-Doc belum dapat diunggah; diperiksa lagi beberapa saat lagi." } };
  }
  let perluPutusan = mau.putusan;
  let perluAnonim = mau.anonim;
  if (mau.putusan && cek.adaPutusan) {
    hasil.putusan = { status: "dilewati", catatan: "e-Doc putusan sudah ada di SIPP - tidak diganti." };
    perluPutusan = false;
  }
  if (mau.anonim && cek.adaAnonim) {
    hasil.anonim = { status: "dilewati", catatan: "e-Doc anonimisasi sudah ada di SIPP - tidak diganti." };
    perluAnonim = false;
  }
  if (!perluPutusan && !perluAnonim) return hasil;

  // 5. Nama pihak (penjaga isi) dari SIPP.
  const ktx = await deps.konteksPihak(b.nomor_perkara);
  const namaPihak = ktx.namaPihak;

  // 6. Berkas yang dikirim. Grup RTF tersembunyi dibuang seperti rute unggah-sipp (18 Okt, butir 18).
  const putusanBita = buangGrupTersembunyiRtf(bita);
  let anonimBita: Uint8Array | null = null;
  if (perluAnonim) {
    let rtf: Uint8Array | null = null;
    if (kenaliBentuk(bita) === "rtf") rtf = bita;
    else {
      const u = await deps.ubahKeRtf(bita, b.berkas_nama || "putusan");
      if (u.ok) rtf = u.bita;
      else hasil.anonim = { status: "gagal", catatan: `Berkas ${b.berkas_bentuk.toUpperCase()} tidak dapat diubah menjadi RTF untuk disamarkan (${sebaris(u.sebab, 160)}). Samarkan lalu unggah lewat Unggah putusan ke SIPP.` };
    }
    if (rtf) {
      const a = await deps.anonimkan(rtf, b.nomor_perkara);
      if (!a.ok) {
        hasil.anonim = { status: "gagal", catatan: `Penyamar ALETA belum dapat bekerja (${sebaris(a.sebab, 160)}). Cadangan anonimisasi ABT memerlukan sesi ABT di peramban; unggah anonimisasi lewat Unggah putusan ke SIPP.` };
      } else if (a.sisa.length > 0) {
        hasil.anonim = { status: "tertahan", catatan: SEBAB_TERTAHAN(a.sisa.length, a.sisa) };
      } else {
        let kandidat = a.bita;
        // Sisa nama pihak/NIK yang ditinggalkan penyamar disamarkan pada SALINAN anonimisasi (putusan asli tidak diubah).
        if (namaPihak && namaPihak.length > 0) {
          const samar = samarkanSisaBilaTersamar({ anonim: kandidat, putusan: rtf, namaPihak });
          if (samar.diganti.length > 0) kandidat = samar.bita;
        }
        anonimBita = buangGrupTersembunyiRtf(kandidat);
      }
    }
    if (!anonimBita) perluAnonim = false;
  }

  // 7. Pemeriksaan isi - sama dengan rute unggah-sipp, tetapi satu slot yang ditolak tidak menahan slot lain.
  const kirim: { putusan?: Uint8Array; anonimisasi?: Uint8Array } = {};
  if (perluPutusan) kirim.putusan = putusanBita;
  if (perluAnonim && anonimBita) kirim.anonimisasi = anonimBita;
  const periksaSemua = () =>
    periksaBerkasUnggahSipp({
      nomorPerkara: b.nomor_perkara,
      berkas: [
        ...(kirim.putusan ? [{ slot: "putusan" as const, bita: kirim.putusan }] : []),
        ...(kirim.anonimisasi ? [{ slot: "anonimisasi" as const, bita: kirim.anonimisasi }] : []),
      ],
      namaPihak,
      sebabPihak: ktx.sebab,
      tetapUnggah: null,
    });
  for (let putaran = 0; putaran < 2; putaran += 1) {
    if (!kirim.putusan && !kirim.anonimisasi) break;
    const p = periksaSemua();
    if (!p.tolak) break;
    const slot = p.tolak.slot;
    if (slot === "putusan") {
      hasil.putusan = { status: "gagal", catatan: p.tolak.sebab };
      delete kirim.putusan;
    } else {
      hasil.anonim = { status: p.tolak.alasan === "slot_anonim_memuat_nama" ? "tertahan" : "gagal", catatan: p.tolak.sebab };
      delete kirim.anonimisasi;
    }
  }
  if (!kirim.putusan && !kirim.anonimisasi) return hasil;

  // 8. SATU kiriman lewat jalur tulis yang sama dengan rute unggah-sipp.
  const u = await deps.unggah({
    perkaraId: b.perkara_id,
    nomorPerkara: b.nomor_perkara,
    ...(kirim.putusan ? { putusan: kirim.putusan } : {}),
    ...(kirim.anonimisasi ? { anonimisasi: kirim.anonimisasi } : {}),
    olehUsername: b.akun_sipp,
    operator: sebaris(aktor.name || aktor.email || aktor.id, 120),
    peranPenekan: peran,
    ip: b.ip,
  });
  const dari = (jenis: SlotEdoc) => u.berkas.find((x) => x.jenis === jenis);
  const gagalSebab = (jenis: SlotEdoc) => {
    const x = dari(jenis);
    return sebaris(x?.pesan || x?.alasan || u.sebab || "ditolak bot", 200);
  };

  // 9. Bukti dari SIPP: baca lagi. Berhasil hanya bila SIPP memang memuat e-Doc-nya.
  const sesudah = await deps.cekSlot(b.perkara_id);
  const ada = (jenis: SlotEdoc) => (sesudah.ok ? (jenis === "putusan" ? sesudah.adaPutusan : sesudah.adaAnonim) : null);
  const tetapkan = (slot: "putusan" | "anonim", jenis: SlotEdoc) => {
    const x = dari(jenis);
    const dikirim = jenis === "putusan" ? Boolean(kirim.putusan) : Boolean(kirim.anonimisasi);
    if (!dikirim) return;
    if (x && !x.ok) hasil[slot] = { status: "gagal", catatan: `Ditolak: ${gagalSebab(jenis)}` };
    else if (!x && !u.ok) hasil[slot] = { status: "gagal", catatan: `Tidak terkirim: ${gagalSebab(jenis)}` };
    else if (ada(jenis) === false) hasil[slot] = { status: "gagal", catatan: "Bot menjawab berhasil tetapi SIPP belum memuat e-Doc-nya; diperiksa manual." };
    else
      hasil[slot] = {
        status: "selesai",
        catatan: ada(jenis) === true ? "Terunggah dan terbukti ada di SIPP." : "Terunggah (pembacaan ulang SIPP tidak tersedia; diperiksa manual bila ragu).",
      };
  };
  tetapkan("putusan", "putusan");
  tetapkan("anonim", "anonimisasi");
  return hasil;
}

// ──────────────────────────────────────────────────────────────────────────
// Detak: pilih satu butir, klaim, kerjakan, catat
// ──────────────────────────────────────────────────────────────────────────

export type HasilDetak =
  | { jalan: false; alasan: "dimatikan" | "sedang_berjalan" | "tidak_ada" | "galat"; galat?: string }
  | { jalan: true; butirId: string; nomorPerkara: string; status: string; ringkas: string };

type WadahDetak = { berjalan: boolean; detak: ReturnType<typeof setInterval> | null };
const wadah = (): WadahDetak => {
  const g = globalThis as unknown as { __aletaPutusanTerjadwal?: WadahDetak };
  g.__aletaPutusanTerjadwal ??= { berjalan: false, detak: null };
  return g.__aletaPutusanTerjadwal;
};

/** Butir yang masih "jalan" padahal masa pegangnya habis (proses mati / peramban ditutup) dikembalikan ke menunggu. */
export async function pulihkanMacet(db: AletaDatabase, kini: Date): Promise<number> {
  const iso = kini.toISOString();
  const macet = await db.queryAll<BarisButir>("SELECT * FROM aleta_putusan_jadwal_butir WHERE status = 'jalan' AND klaim_sampai <> '' AND klaim_sampai < ?", [iso]);
  let n = 0;
  for (const b of macet) {
    const perubahan: PerubahanButir = { lain: { klaim_oleh: "", klaim_sampai: "", percobaan: b.percobaan + 1 } };
    for (const k of LANGKAH_TERJADWAL) {
      if (langkahDariBaris(b)[k] !== "jalan") continue;
      const lewat = b.percobaan + 1 >= BATAS.percobaanMaks;
      perubahan[k] = {
        status: lewat ? "gagal" : "menunggu",
        catatan: lewat
          ? "Terputus berkali-kali di tengah jalan; dihentikan. Periksa SIPP, lalu ulangi."
          : k === "isi"
            ? "Pengerjaan sebelumnya terputus; keadaan SIPP diperiksa dulu sebelum diulang."
            : "Pengerjaan sebelumnya terputus; e-Doc yang sudah ada di SIPP tidak diganti saat diulang.",
      };
    }
    const baru = await ubahButir(db, b.id, perubahan, { kini, syaratStatus: ["jalan"] });
    if (baru) {
      n += 1;
      await catatJejak(db, {
        jadwalId: b.jadwal_id,
        butirId: b.id,
        nomorPerkara: b.nomor_perkara,
        peristiwa: "pulih",
        pelaku: "pelaksana server",
        hasil: "tertahan",
        ringkas: `${b.nomor_perkara}: masa pegang habis (${b.klaim_oleh || "tanpa pemegang"}); dikembalikan ke antrean`,
        kini,
      });
    }
  }
  return n;
}

/**
 * Butir yang jam rencananya sudah lewat BATAS.kedaluwarsaHari hari tetapi belum dikerjakan (peramban penjadwal tidak
 * membuka SIPP, server mati lama): langkah yang masih menunggu dinyatakan gagal beserta sebabnya. Pekerjaan setua itu
 * tidak boleh tiba-tiba berjalan sendiri pada hari yang tidak diduga penjadwalnya; "Ulangi" menjadwalkannya kembali.
 */
export async function kedaluwarsakan(db: AletaDatabase, kini: Date, pengaturan: PengaturanTerjadwal): Promise<number> {
  const batas = new Date(kini.getTime() - BATAS.kedaluwarsaHari * 24 * 3600_000).toISOString();
  const lama = await db.queryAll<BarisButir>("SELECT * FROM aleta_putusan_jadwal_butir WHERE status = 'menunggu' AND waktu_rencana < ? LIMIT 25", [batas]);
  let n = 0;
  for (const b of lama) {
    const perubahan: PerubahanButir = { lain: { klaim_oleh: "", klaim_sampai: "" } };
    const langkah = langkahDariBaris(b);
    for (const k of LANGKAH_TERJADWAL) {
      if (langkah[k] === "menunggu") {
        perubahan[k] = {
          status: "gagal",
          catatan: `Tidak dikerjakan dalam ${BATAS.kedaluwarsaHari} hari sesudah jam rencana (${k === "isi" ? "SIPP tidak dibuka di peramban penjadwal" : "pelaksana server tidak berjalan atau menunggu pengisian Putusan Akhir"}). Tekan Ulangi bila masih perlu.`,
        };
      }
    }
    const baru = await ubahButir(db, b.id, perubahan, { kini, syaratStatus: ["menunggu"] });
    if (!baru) continue;
    n += 1;
    await akhiriBilaSelesai(db, baru, { kini, pelaku: "pelaksana server", pengaturan });
  }
  return n;
}

/** Berkas yang waktunya habis (butir selesai + N hari, atau dibatalkan) dan berkas tahap yang tak pernah dipasang. */
export async function bersihkanBerkas(db: AletaDatabase, deps: DepsPelaksana, kini: Date): Promise<number> {
  const iso = kini.toISOString();
  let n = 0;
  const usang = await db.queryAll<BarisButir>(
    "SELECT * FROM aleta_putusan_jadwal_butir WHERE berkas_jalur <> '' AND berkas_hapus_pada <> '' AND berkas_hapus_pada <= ? AND status NOT IN ('menunggu', 'jalan') LIMIT 25",
    [iso]
  );
  for (const b of usang) {
    await deps.hapusBerkas(b.berkas_jalur);
    await db.run("UPDATE aleta_putusan_jadwal_butir SET berkas_jalur = '', berkas_hapus_pada = '' WHERE id = ?", [b.id]);
    await db.run("UPDATE aleta_putusan_jadwal_berkas SET dihapus_pada = ?, jalur = '' WHERE id = ?", [iso, b.berkas_id]);
    n += 1;
  }
  const batasTahap = new Date(kini.getTime() - BATAS.tahapJam * 3600_000).toISOString();
  const tahap = await db.queryAll<{ id: string; jalur: string }>(
    "SELECT id, jalur FROM aleta_putusan_jadwal_berkas WHERE dipakai_butir = '' AND dihapus_pada = '' AND dibuat_pada < ? LIMIT 25",
    [batasTahap]
  );
  for (const t of tahap) {
    if (t.jalur) await deps.hapusBerkas(t.jalur);
    await db.run("UPDATE aleta_putusan_jadwal_berkas SET dihapus_pada = ?, jalur = '' WHERE id = ?", [iso, t.id]);
    n += 1;
  }
  return n;
}

/** Butir e-Doc yang boleh dikerjakan SEKARANG (satu), atau null. Memeriksa jendela kerja dan jeda antar butir pemilik. */
export async function pilihButirServer(db: AletaDatabase, deps: DepsPelaksana, kini: Date): Promise<BarisButir | null> {
  const iso = kini.toISOString();
  const kandidat = await db.queryAll<BarisButir>(
    `SELECT * FROM aleta_putusan_jadwal_butir
      WHERE status = 'menunggu'
        AND waktu_rencana <= ?
        AND (tunggu_sampai = '' OR tunggu_sampai <= ?)
        AND (edoc_sesudah = '' OR edoc_sesudah <= ?)
        AND ((langkah_putusan = 1 AND status_putusan = 'menunggu') OR (langkah_anonim = 1 AND status_anonim = 'menunggu'))
        AND status_isi IN ('tidak', 'selesai', 'dilewati')
      ORDER BY waktu_rencana ASC, urut ASC
      LIMIT 20`,
    [iso, iso, iso]
  );
  if (kandidat.length === 0) return null;
  const libur = await deps.muatLibur(db);
  for (const b of kandidat) {
    const j = await db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [b.jadwal_id]);
    if (!j || j.status === "dibatalkan") continue;
    // Di luar jendela kerja pilihan petugas: menunggu jendela berikutnya, tidak menulis di malam hari.
    if (!dalamJendela(kini.getTime(), jendelaPilihan(j), libur)) continue;
    if (await masihDalamJeda(db, b.pemilik_id, j.jeda_min, kini)) continue;
    return b;
  }
  return null;
}

/** Pemilik ini baru saja menyelesaikan satu perkara (kurang dari jeda minimum jadwalnya)? */
export async function masihDalamJeda(db: AletaDatabase, pemilikId: string, jedaMinDetik: number, kini: Date): Promise<boolean> {
  const t = await db.queryOne<{ t: string | null }>("SELECT MAX(selesai_pada) AS t FROM aleta_putusan_jadwal_butir WHERE pemilik_id = ? AND selesai_pada <> ''", [pemilikId]);
  const terakhir = msDariIso(String(t?.t ?? ""));
  return Number.isFinite(terakhir) && kini.getTime() - terakhir < jedaMinDetik * 1000;
}

/** Menetapkan status akhir dan jejak sesudah langkah-langkah dikerjakan (dipakai pelaksana server dan peramban). */
export async function terapkanHasil(
  db: AletaDatabase,
  b: BarisButir,
  hasil: HasilEdocButir,
  opsi: { kini: Date; pelaku: string; pelakuId?: string; pengaturan: PengaturanTerjadwal }
): Promise<BarisButir | null> {
  const { kini } = opsi;
  const perubahan: PerubahanButir = { lain: { klaim_oleh: "", klaim_sampai: "" } };
  const jejakLangkah: Array<{ k: "putusan" | "anonim"; h: HasilLangkah }> = [];
  if (hasil.tunda) {
    const percobaan = b.percobaan + 1;
    const lewat = percobaan >= BATAS.percobaanMaks;
    for (const k of ["putusan", "anonim"] as const) {
      if (langkahDariBaris(b)[k] !== "jalan") continue;
      perubahan[k] = { status: lewat ? "gagal" : "menunggu", catatan: lewat ? `Gagal setelah ${percobaan} percobaan: ${hasil.tunda.sebab}` : hasil.tunda.sebab };
    }
    perubahan.lain = { ...perubahan.lain, percobaan, tunggu_sampai: new Date(kini.getTime() + hasil.tunda.detik * 1000).toISOString() };
  } else {
    for (const k of ["putusan", "anonim"] as const) {
      const h = hasil[k];
      if (!h) continue;
      perubahan[k] = { status: h.status, catatan: h.catatan };
      jejakLangkah.push({ k, h });
    }
    // Langkah yang tetap "jalan" tanpa hasil (tidak seharusnya terjadi) dibuka lagi supaya tidak macet.
    for (const k of ["putusan", "anonim"] as const) {
      if (!hasil[k] && langkahDariBaris(b)[k] === "jalan") perubahan[k] = { status: "menunggu", catatan: "Tidak ada hasil; diulang." };
    }
  }
  const baru = await ubahButir(db, b.id, perubahan, { kini, syaratStatus: ["jalan"] });
  if (!baru) return null;
  for (const { k, h } of jejakLangkah) {
    await catatJejak(db, {
      jadwalId: b.jadwal_id,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      peristiwa: k === "putusan" ? "edoc-putusan" : "edoc-anonim",
      pelaku: opsi.pelaku,
      pelakuId: opsi.pelakuId,
      akunSipp: b.akun_sipp,
      hasil: h.status === "selesai" ? "ok" : h.status === "dilewati" ? "dilewati" : h.status === "tertahan" ? "tertahan" : "gagal",
      ringkas: `${b.nomor_perkara}: ${NAMA_LANGKAH[k]} - ${h.catatan}`,
      rinci: { status: h.status, ip: b.ip },
      kini,
    });
  }
  if (hasil.tunda) {
    await catatJejak(db, {
      jadwalId: b.jadwal_id,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      peristiwa: "ditunda-pelaksana",
      pelaku: opsi.pelaku,
      akunSipp: b.akun_sipp,
      hasil: "tertahan",
      ringkas: `${b.nomor_perkara}: ${hasil.tunda.sebab}`,
      kini,
    });
  }
  return akhiriBilaSelesai(db, baru, opsi);
}

/** Butir yang tidak punya langkah menunggu/jalan lagi: catat saat selesai, jadwalkan penghapusan berkas, jejak + audit. */
export async function akhiriBilaSelesai(
  db: AletaDatabase,
  b: BarisButir,
  opsi: { kini: Date; pelaku: string; pelakuId?: string; pengaturan: PengaturanTerjadwal }
): Promise<BarisButir> {
  if (!["selesai", "sebagian", "gagal"].includes(b.status) || b.selesai_pada) return b;
  const { kini } = opsi;
  const hapus = new Date(kini.getTime() + opsi.pengaturan.hapusHari * 24 * 3600_000).toISOString();
  const baru = await ubahButir(db, b.id, { lain: { selesai_pada: kini.toISOString(), berkas_hapus_pada: b.berkas_jalur ? hapus : "" } }, { kini });
  const akhir = baru ?? b;
  const langkah = langkahDariBaris(akhir);
  const ringkas = LANGKAH_TERJADWAL.filter((k) => langkah[k] !== "tidak" && langkah[k] !== "batal")
    .map((k) => `${NAMA_LANGKAH[k]}: ${langkah[k]}`)
    .join("; ");
  await catatJejak(db, {
    jadwalId: b.jadwal_id,
    butirId: b.id,
    nomorPerkara: b.nomor_perkara,
    peristiwa: "butir-" + akhir.status,
    pelaku: opsi.pelaku,
    pelakuId: opsi.pelakuId,
    akunSipp: b.akun_sipp,
    hasil: akhir.status === "selesai" ? "ok" : akhir.status === "gagal" ? "gagal" : "tertahan",
    ringkas: `${b.nomor_perkara} ${akhir.status}: ${ringkas}`,
    audit: { aksi: `PUTUSAN_TERJADWAL_BUTIR_${akhir.status.toUpperCase()}`, aktorId: b.pemilik_id, entitas: b.id },
    kini,
  });
  // Jadwal selesai bila tak ada butir aktif tersisa.
  const sisa = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_putusan_jadwal_butir WHERE jadwal_id = ? AND status IN ('menunggu', 'jalan')", [b.jadwal_id]);
  if (Number(sisa?.n ?? 0) === 0) {
    await db.run("UPDATE aleta_putusan_jadwal SET status = 'selesai', diubah_pada = ? WHERE id = ? AND status = 'aktif'", [kini.toISOString(), b.jadwal_id]);
  }
  return akhir;
}

/**
 * Satu detak pelaksana: pulihkan yang macet, bersihkan berkas usang, lalu
 * kerjakan paling banyak SATU butir e-Doc yang jatuh tempo. Tidak pernah melempar.
 */
export async function detakPelaksana(db: AletaDatabase, deps: DepsPelaksana = depsAsli()): Promise<HasilDetak> {
  const w = wadah();
  if (w.berjalan) return { jalan: false, alasan: "sedang_berjalan" };
  w.berjalan = true;
  try {
    const kini = deps.sekarang();
    const pengaturan = await bacaPengaturan(db);
    if (!pengaturan.pelaksanaNyala) return { jalan: false, alasan: "dimatikan" };
    await pulihkanMacet(db, kini);
    await kedaluwarsakan(db, kini, pengaturan);
    await bersihkanBerkas(db, deps, kini);
    const b = await pilihButirServer(db, deps, kini);
    if (!b) return { jalan: false, alasan: "tidak_ada" };

    // Klaim: langkah e-Doc yang menunggu menjadi "jalan" dalam SATU pembaruan bersyarat (status masih menunggu).
    const klaim: PerubahanButir = {
      lain: { klaim_oleh: "server", klaim_sampai: isoDariMs(kini.getTime() + BATAS.masaPegangDetik * 1000), mulai_pada: b.mulai_pada || kini.toISOString(), tunggu_sampai: "", edoc_sesudah: "" },
    };
    if (b.langkah_putusan === 1 && b.status_putusan === "menunggu") klaim.putusan = { status: "jalan" };
    if (b.langkah_anonim === 1 && b.status_anonim === "menunggu") klaim.anonim = { status: "jalan" };
    const diklaim = await ubahButir(db, b.id, klaim, { kini, syaratStatus: ["menunggu"] });
    if (!diklaim) return { jalan: false, alasan: "tidak_ada" };
    await catatJejak(db, {
      jadwalId: b.jadwal_id,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      peristiwa: "dimulai",
      pelaku: "pelaksana server",
      akunSipp: b.akun_sipp,
      hasil: "",
      ringkas: `${b.nomor_perkara}: e-Doc dimulai pada waktunya (jadwal ${b.waktu_rencana})`,
      kini,
    });

    const hasil = await jalankanEdocButir(db, deps, diklaim);
    const akhir = await terapkanHasil(db, diklaim, hasil, { kini: deps.sekarang(), pelaku: "pelaksana server", pengaturan });
    return {
      jalan: true,
      butirId: b.id,
      nomorPerkara: b.nomor_perkara,
      status: akhir?.status ?? "tidak diketahui",
      ringkas: hasil.tunda ? hasil.tunda.sebab : `putusan: ${hasil.putusan?.status ?? "-"}; anonimisasi: ${hasil.anonim?.status ?? "-"}`,
    };
  } catch (galat) {
    console.error("[PUTUSAN TERJADWAL] detak gagal:", galat);
    return { jalan: false, alasan: "galat", galat: sebaris((galat as Error)?.message ?? galat, 200) };
  } finally {
    w.berjalan = false;
  }
}

export const JEDA_DETAK_MS = 30_000;

/** Dinyalakan instrumentation.ts. Matikan dengan ALETA_PUTUSAN_TERJADWAL=0 (atau saklar di pengaturan). */
export function mulaiPelaksanaBerkala(getDb: () => Promise<AletaDatabase> = getDatabase, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PUTUSAN_TERJADWAL === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakPelaksana(await getDb());
    } catch (galat) {
      console.error("[PUTUSAN TERJADWAL] detak gagal:", galat);
    }
  };
  w.detak = setInterval(() => void detak(), JEDA_DETAK_MS);
  (w.detak as { unref?: () => void }).unref?.();
  // Detak pertama sesudah portal tenang (sembilan puluh detik), bukan saat berdiri.
  setTimeout(() => void detak(), 90_000).unref?.();
}
