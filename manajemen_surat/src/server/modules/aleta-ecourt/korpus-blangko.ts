import { randomUUID } from "node:crypto";

import {
  alineaBergunaSaja,
  susunKorpus,
  susunUlang,
  type HasilKorpus,
} from "@/lib/blok-kalimat";
import { kelengkapanDimensi, kunciDimensi, uraikanDimensi } from "@/lib/taksonomi-blangko";
import { jalurBlangkoTerhapus } from "@/lib/tugas-blangko";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import type { AletaDatabase } from "@/server/db/client";

/**
 * KORPUS BLANGKO (Tahap 1 - Kemandirian Blangko).
 *
 * ============================================================================
 * PELAJARI SELURUHNYA SEKALI, LALU TINGGALKAN
 * ============================================================================
 *
 * Seluruh pustaka blangko ABT dibaca dan diuraikan menjadi bahan yang dapat
 * dipakai mesin: blok kalimat, susunan tiap blangko, dan dimensi keadaan yang
 * ditempatinya. Sejak korpus ini jadi, pengetahuan ABT sudah pindah - sisanya
 * tinggal dipakai, dan folder ABT boleh dicabut.
 *
 * Membaca korpus tidak pernah menyentuh ABT. Hanya pelajariKorpus() yang
 * menyentuhnya, dan ia dijalankan atas perintah - bukan saat naskah dibuat.
 *
 * ============================================================================
 * PENYUSUNAN ULANG DIPERIKSA SEBELUM KORPUS DISIMPAN
 * ============================================================================
 *
 * Korpus yang kehilangan atau menukar alinea akan menghasilkan blangko yang
 * berbunyi lain dari blangko yang sudah teruji bertahun-tahun - dan tidak ada
 * galat apa pun yang menandakannya. Karena itu tiap blangko disusun kembali
 * dari korpus dan dibandingkan dengan alinea aslinya SEBELUM apa pun ditulis.
 * Yang gagal dicatat namanya; bila ada yang gagal, korpus tidak disimpan.
 */

export type BerkasMentah = {
  jalur: string;
  alinea: string[];
  penanda?: string[];
  besarByte?: number;
  ada?: boolean;
  sebab?: string;
};

export type HasilPelajari = {
  ok: boolean;
  korpusId: string;
  jumlahBerkas: number;
  jumlahBlok: number;
  jumlahGeser: number;
  jumlahGagalSusun: number;
  gagalSusun: Array<{ jalur: string; sebab: string }>;
  sebab: string;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

/** Berapa berkas sekali minta ke jembatan. Jembatan sendiri membatasi 40. */
const SEKALI_MINTA = 30;

type JawabanPohon = { ada?: boolean; sebab?: string; jumlah?: number; berkas?: Array<{ jalur?: unknown; besarByte?: unknown }> };
type JawabanAlinea = { ada?: boolean; sebab?: string; berkas?: BerkasMentah[] };

/**
 * Menarik seluruh blangko dari ABT lewat jembatan bot.
 *
 * Dipisah dari pelajariKorpus() supaya pembelajarannya dapat diuji dengan
 * tarikan yang sudah ada di tangan, tanpa menyiapkan jembatan sama sekali.
 */
export async function tarikSeluruhBlangko(): Promise<{ ok: boolean; sebab: string; berkas: BerkasMentah[] }> {
  const pohon = await callAletaBotSippBridge<JawabanPohon>("blangko.pohon", {});
  if (!pohon.ok || !pohon.data?.ada) {
    return { ok: false, sebab: teks(pohon.data?.sebab) || "Pohon blangko tidak terbaca.", berkas: [] };
  }

  // I7 17 Okt: blangko yang dipindah paket ABT ke derry_briantono/terhapus bukan blangko aktif - tidak ikut dipelajari.
  const jalur = (pohon.data.berkas ?? []).map((b) => teks(b.jalur)).filter((j) => Boolean(j) && !jalurBlangkoTerhapus(j));
  if (jalur.length === 0) {
    return { ok: false, sebab: "Pohon blangko kosong - penarikan dibatalkan.", berkas: [] };
  }

  const berkas: BerkasMentah[] = [];
  for (let i = 0; i < jalur.length; i += SEKALI_MINTA) {
    const kelompok = jalur.slice(i, i + SEKALI_MINTA);
    const jawaban = await callAletaBotSippBridge<JawabanAlinea>("blangko.alinea", { jalur: kelompok });
    if (!jawaban.ok || !jawaban.data?.ada) {
      return {
        ok: false,
        sebab: `Alinea tidak terbaca pada kelompok ke-${Math.floor(i / SEKALI_MINTA) + 1}: ${teks(jawaban.data?.sebab) || "sebab tidak disebut"}.`,
        berkas: [],
      };
    }
    for (const b of jawaban.data.berkas ?? []) {
      berkas.push({
        jalur: teks(b.jalur),
        alinea: Array.isArray(b.alinea) ? b.alinea.map((x) => String(x)) : [],
        penanda: Array.isArray(b.penanda) ? b.penanda.map((x) => String(x)) : [],
        besarByte: Number(b.besarByte ?? 0) || 0,
        ada: b.ada !== false,
        sebab: teks(b.sebab),
      });
    }
  }

  return { ok: true, sebab: "", berkas };
}

/**
 * Memeriksa bahwa tiap blangko dapat disusun kembali dari korpus, tepat kata
 * demi kata. Inilah syarat sebelum korpus boleh disimpan.
 */
export function periksaSusunUlang(
  berkas: Array<{ jalur: string; alinea: string[] }>,
  korpus: HasilKorpus
): Array<{ jalur: string; sebab: string }> {
  const gagal: Array<{ jalur: string; sebab: string }> = [];

  for (let i = 0; i < berkas.length; i += 1) {
    const susun = korpus.susunan[i];
    const hasil = susunUlang(susun.urutan, korpus.blok);
    if (!hasil.berhasil) {
      gagal.push({ jalur: susun.jalur, sebab: `blok hilang: ${hasil.hilang.slice(0, 3).join(", ")}` });
      continue;
    }
    const harapan = alineaBergunaSaja(berkas[i].alinea);
    if (hasil.alinea.length !== harapan.length) {
      gagal.push({
        jalur: susun.jalur,
        sebab: `jumlah alinea berbeda: ${hasil.alinea.length} lawan ${harapan.length}`,
      });
      continue;
    }
    const beda = hasil.alinea.findIndex((baris, j) => baris !== harapan[j]);
    if (beda >= 0) gagal.push({ jalur: susun.jalur, sebab: `alinea ke-${beda} berbeda` });
  }

  return gagal;
}

/**
 * Mempelajari sekumpulan blangko menjadi korpus, lalu menyimpannya.
 *
 * `berkas` sudah berupa alinea - penguraian RTF dikerjakan jembatan bot, sebab
 * itu pekerjaan mekanis, bukan pembelajaran. Yang dipelajari di sini adalah
 * susunan dokumennya, blok kalimatnya, dan dimensi keadaannya.
 */
export async function pelajariKorpus(
  db: AletaDatabase,
  masukan: { berkas: BerkasMentah[]; oleh: string }
): Promise<HasilPelajari> {
  const korpusId = randomUUID();
  const sekarang = new Date().toISOString();
  const oleh = teks(masukan.oleh);

  const kosong: HasilPelajari = {
    ok: false,
    korpusId,
    jumlahBerkas: 0,
    jumlahBlok: 0,
    jumlahGeser: 0,
    jumlahGagalSusun: 0,
    gagalSusun: [],
    sebab: "",
  };

  const catatGagal = async (sebab: string, gagalSusun: Array<{ jalur: string; sebab: string }> = []) => {
    await db.run(
      `INSERT INTO aleta_korpus_jalan
         (id, jumlah_berkas, jumlah_blok, jumlah_geser, jumlah_gagal_susun, gagal_susun, keadaan, sebab, oleh, dijalankan_at)
       VALUES (?, 0, 0, 0, ?, ?, 'gagal', ?, ?, ?)`,
      [korpusId, gagalSusun.length, JSON.stringify(gagalSusun.slice(0, 50)), sebab, oleh, sekarang]
    );
    return { ...kosong, sebab, gagalSusun, jumlahGagalSusun: gagalSusun.length };
  };

  const terbaca = (masukan.berkas ?? []).filter((b) => b.ada !== false && b.jalur && b.alinea.length > 0);
  if (terbaca.length === 0) {
    return catatGagal("Tidak satu pun blangko terbaca - pembelajaran dibatalkan agar korpus tidak menjadi setengah jadi.");
  }

  const untukKorpus = terbaca.map((b) => ({ jalur: b.jalur, alinea: b.alinea }));
  const korpus = susunKorpus(untukKorpus);

  // Diperiksa SEBELUM disimpan. Korpus yang tidak dapat menyusun ulang
  // sumbernya sendiri tidak boleh dipakai menyusun apa pun.
  const gagal = periksaSusunUlang(untukKorpus, korpus);
  if (gagal.length > 0) {
    return catatGagal(
      `${gagal.length} blangko tidak dapat disusun kembali tepat kata demi kata - korpus tidak disimpan.`,
      gagal
    );
  }

  try {
    await db.run(
      `INSERT INTO aleta_korpus_jalan
         (id, jumlah_berkas, jumlah_blok, jumlah_geser, jumlah_gagal_susun, gagal_susun, keadaan, sebab, oleh, dijalankan_at)
       VALUES (?, ?, ?, ?, 0, '[]', 'berjalan', '', ?, ?)`,
      [korpusId, untukKorpus.length, korpus.blok.size, korpus.pergeseran.length, oleh, sekarang]
    );

    // Pembelajaran ulang MENGGANTI korpus sebelumnya. Korpus lama yang
    // bercampur korpus baru akan menyusun blangko dari dua kenyataan sekaligus.
    await db.run(`DELETE FROM aleta_blangko_sumber`);
    await db.run(`DELETE FROM aleta_blok_kalimat`);
    // Pergeseran yang SUDAH diputus manusia dipertahankan - keputusannya tidak
    // boleh hilang hanya karena korpusnya dipelajari ulang.
    await db.run(`DELETE FROM aleta_blok_geser WHERE keadaan <> 'diputus'`);

    for (const b of korpus.blok.values()) {
      await db.run(
        `INSERT INTO aleta_blok_kalimat
           (sidik, teks, bentuk, sidik_bentuk, penanda, panjang, jumlah_pakai, korpus_id, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.sidik, b.teks, b.bentuk, b.sidikBentuk, b.penanda.join(","), b.panjang, b.jumlahPakai, korpusId, sekarang, sekarang]
      );
    }

    for (let i = 0; i < untukKorpus.length; i += 1) {
      const asli = terbaca[i];
      const susun = korpus.susunan[i];
      const dimensi = uraikanDimensi(susun.jalur);
      const potong = susun.jalur.split("/");
      await db.run(
        `INSERT INTO aleta_blangko_sumber
           (id, jalur, folder, berkas, jenis, dimensi, kunci_dimensi, dimensi_terbaca, urutan,
            jumlah_alinea, jumlah_dibuang, penanda, besar_byte, korpus_id, dipelajari_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          susun.jalur,
          potong.slice(0, -1).join("/"),
          potong[potong.length - 1] ?? "",
          dimensi.jenis,
          JSON.stringify(dimensi),
          kunciDimensi(dimensi),
          kelengkapanDimensi(dimensi),
          susun.urutan.join(","),
          susun.urutan.length,
          susun.dibuang,
          (asli.penanda ?? []).join(","),
          Number(asli.besarByte ?? 0) || 0,
          korpusId,
          sekarang,
        ]
      );
    }

    for (const g of korpus.pergeseran) {
      const sudahDiputus = await db.queryOne<Record<string, unknown>>(
        `SELECT id FROM aleta_blok_geser WHERE sidik_bentuk = ?`,
        [g.sidikBentuk]
      );
      if (sudahDiputus) continue;
      await db.run(
        `INSERT INTO aleta_blok_geser
           (id, sidik_bentuk, bentuk, varian, jumlah_varian, keadaan, blok_terpilih, alasan, diputus_oleh, diputus_at, korpus_id, dibuat_at)
         VALUES (?, ?, ?, ?, ?, 'baru', '', '', '', NULL, ?, ?)`,
        [randomUUID(), g.sidikBentuk, g.bentuk, JSON.stringify(g.varian), g.varian.length, korpusId, sekarang]
      );
    }

    await db.run(
      `UPDATE aleta_korpus_jalan SET keadaan = 'selesai' WHERE id = ?`,
      [korpusId]
    );
  } catch (error) {
    const sebab = error instanceof Error ? error.message : "Pembelajaran terhenti.";
    await db.run(`UPDATE aleta_korpus_jalan SET keadaan = 'gagal', sebab = ? WHERE id = ?`, [sebab, korpusId]);
    return { ...kosong, sebab };
  }

  return {
    ok: true,
    korpusId,
    jumlahBerkas: untukKorpus.length,
    jumlahBlok: korpus.blok.size,
    jumlahGeser: korpus.pergeseran.length,
    jumlahGagalSusun: 0,
    gagalSusun: [],
    sebab: "",
  };
}

export type StatistikKorpus = {
  jumlahBerkas: number;
  jumlahBlok: number;
  jumlahGeser: number;
  geserBelumDiputus: number;
  perJenis: Array<{ jenis: string; jumlah: number }>;
  selMatriks: number;
  pembelajaranTerakhir: {
    id: string;
    keadaan: string;
    sebab: string;
    oleh: string;
    dijalankanAt: string;
  } | null;
};

/** Keadaan korpus. Membaca tabel ALETA saja - tidak menyentuh ABT. */
export async function statistikKorpus(db: AletaDatabase): Promise<StatistikKorpus> {
  const angka = async (sql: string): Promise<number> => {
    const baris = await db.queryOne<Record<string, unknown>>(sql);
    return Number(baris?.jumlah ?? 0) || 0;
  };

  const perJenis = await db.queryAll<Record<string, unknown>>(
    `SELECT jenis, COUNT(*) AS jumlah FROM aleta_blangko_sumber GROUP BY jenis ORDER BY COUNT(*) DESC`
  );
  const sel = await db.queryAll<Record<string, unknown>>(
    `SELECT DISTINCT kunci_dimensi FROM aleta_blangko_sumber`
  );
  const jalan = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM aleta_korpus_jalan ORDER BY dijalankan_at DESC LIMIT 1`
  );

  return {
    jumlahBerkas: await angka(`SELECT COUNT(*) AS jumlah FROM aleta_blangko_sumber`),
    jumlahBlok: await angka(`SELECT COUNT(*) AS jumlah FROM aleta_blok_kalimat`),
    jumlahGeser: await angka(`SELECT COUNT(*) AS jumlah FROM aleta_blok_geser`),
    geserBelumDiputus: await angka(`SELECT COUNT(*) AS jumlah FROM aleta_blok_geser WHERE keadaan = 'baru'`),
    perJenis: perJenis.map((b) => ({ jenis: teks(b.jenis) || "(tak terbaca)", jumlah: Number(b.jumlah ?? 0) || 0 })),
    selMatriks: sel.length,
    pembelajaranTerakhir: jalan
      ? {
          id: teks(jalan.id),
          keadaan: teks(jalan.keadaan),
          sebab: teks(jalan.sebab),
          oleh: teks(jalan.oleh),
          dijalankanAt: teks(jalan.dijalankan_at),
        }
      : null,
  };
}

/** Satu blangko sumber beserta naskahnya yang disusun ulang dari korpus. */
export async function bacaSumber(db: AletaDatabase, jalur: string) {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM aleta_blangko_sumber WHERE jalur = ?`,
    [teks(jalur)]
  );
  if (!baris) return null;

  const urutan = teks(baris.urutan).split(",").filter(Boolean);
  const blok = new Map<string, { teks: string }>();
  for (const sidik of [...new Set(urutan)]) {
    const b = await db.queryOne<Record<string, unknown>>(
      `SELECT teks FROM aleta_blok_kalimat WHERE sidik = ?`,
      [sidik]
    );
    if (b) blok.set(sidik, { teks: teks(b.teks) });
  }
  const hasil = susunUlang(urutan, blok);

  return {
    jalur: teks(baris.jalur),
    folder: teks(baris.folder),
    berkas: teks(baris.berkas),
    jenis: teks(baris.jenis),
    dimensi: JSON.parse(teks(baris.dimensi) || "{}"),
    jumlahAlinea: Number(baris.jumlah_alinea ?? 0) || 0,
    naskah: hasil.alinea,
    utuh: hasil.berhasil,
    hilang: hasil.hilang,
  };
}

/** Pergeseran yang belum diputus - daftar pekerjaan bagi hakim. */
export async function pergeseranBelumDiputus(db: AletaDatabase, batas = 50) {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_blok_geser WHERE keadaan = 'baru' ORDER BY jumlah_varian DESC LIMIT ?`,
    [Math.max(1, Math.min(200, batas))]
  );
  return baris.map((b) => ({
    id: teks(b.id),
    bentuk: teks(b.bentuk),
    jumlahVarian: Number(b.jumlah_varian ?? 0) || 0,
    varian: JSON.parse(teks(b.varian) || "[]") as Array<{ sidik: string; teks: string; jumlahPakai: number }>,
  }));
}

/**
 * Memutuskan satu pergeseran - menetapkan bunyi mana yang berlaku.
 *
 * Hanya mencatat keputusannya; blok lain TIDAK dihapus dan naskah yang sudah
 * ada TIDAK diubah surut. Mengubah naskah lama berarti mengubah dokumen yang
 * mungkin sudah ditandatangani.
 */
export async function putuskanPergeseran(
  db: AletaDatabase,
  masukan: { id: string; blokTerpilih: string; alasan: string; oleh: string }
): Promise<{ ok: boolean; sebab: string }> {
  const id = teks(masukan.id);
  const terpilih = teks(masukan.blokTerpilih);
  const oleh = teks(masukan.oleh);
  if (!id || !terpilih) return { ok: false, sebab: "Pergeseran dan blok terpilih harus disebut." };
  if (!oleh) return { ok: false, sebab: "Keputusan harus menyebut siapa yang mengambilnya." };

  const geser = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_blok_geser WHERE id = ?`, [id]);
  if (!geser) return { ok: false, sebab: "Pergeseran tidak ditemukan." };

  const varian = JSON.parse(teks(geser.varian) || "[]") as Array<{ sidik: string }>;
  if (!varian.some((v) => v.sidik === terpilih)) {
    return { ok: false, sebab: "Blok yang dipilih bukan salah satu varian pergeseran ini." };
  }

  await db.run(
    `UPDATE aleta_blok_geser
        SET keadaan = 'diputus', blok_terpilih = ?, alasan = ?, diputus_oleh = ?, diputus_at = ?
      WHERE id = ?`,
    [terpilih, teks(masukan.alasan), oleh, new Date().toISOString(), id]
  );
  return { ok: true, sebab: "" };
}

/** Apakah korpus siap dipakai. Dipakai tahap berikutnya supaya berhenti jelas. */
export async function korpusSiap(db: AletaDatabase): Promise<{ siap: boolean; jumlah: number; sebab: string }> {
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS jumlah FROM aleta_blangko_sumber`);
  const jumlah = Number(baris?.jumlah ?? 0) || 0;
  if (jumlah === 0) return { siap: false, jumlah, sebab: "Korpus blangko belum pernah dipelajari dari ABT." };
  return { siap: true, jumlah, sebab: "" };
}
