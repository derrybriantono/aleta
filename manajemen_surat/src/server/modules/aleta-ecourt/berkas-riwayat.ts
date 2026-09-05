import { createHash, randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import type { BerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";

/**
 * RIWAYAT BERKAS PERKARA - keadaan pada tiap tanggal, bukan hanya yang terakhir.
 *
 * ============================================================================
 * PERTANYAAN YANG DIJAWABNYA
 * ============================================================================
 *
 * "Apa yang tercatat waktu itu?"
 *
 * BAS yang ditandatangani 1 September menyebut dua saksi. Bulan depan SIPP
 * memuat empat. Tanpa riwayat, tidak ada cara membuktikan BAS itu benar pada
 * saat ditandatangani - dan yang tampak adalah BAS yang keliru.
 *
 * ============================================================================
 * HANYA PERUBAHAN YANG DISIMPAN
 * ============================================================================
 *
 * Sidik ringkasan dihitung tiap perakitan; bila sama dengan yang terakhir,
 * tidak ada baris baru. Tanpa penjagaan itu tabelnya tumbuh secepat PEMAKAIAN,
 * bukan secepat perubahan - dan riwayat yang penuh salinan yang sama tidak
 * dapat dibaca.
 *
 * ============================================================================
 * RINGKASAN, BUKAN SALINAN
 * ============================================================================
 *
 * Isi lengkap berkas dapat mencapai puluhan ribu huruf karena memuat naskah
 * pertimbangan hukum. Yang disimpan jumlah tiap bagian, tahapan, dan selisih -
 * cukup menjawab "apa yang tercatat waktu itu" tanpa menjadi salinan kedua
 * dari SIPP.
 */

export type RingkasanBerkas = {
  nomorPerkara: string;
  tahapan: string;
  jumlah: Record<string, number>;
  ada: Record<string, boolean>;
  selisih: string[];
};

export type BarisRiwayat = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  sidik: string;
  ringkasan: RingkasanBerkas;
  halangan: string[];
  dirakitAt: string;
  dicatatOleh: string;
};

function jumlahDari(nilai: unknown): number {
  if (Array.isArray(nilai)) return nilai.length;
  return nilai ? 1 : 0;
}

/**
 * Ringkasan yang disidik dan disimpan.
 *
 * SENGAJA tidak memuat waktu pengambilan. Bila waktu ikut disidik, tiap
 * perakitan menghasilkan sidik baru dan penjagaan "hanya perubahan yang
 * disimpan" menjadi tidak berarti sama sekali.
 */
export function ringkasBerkas(berkas: BerkasPerkara): RingkasanBerkas {
  const identitas = (berkas.identitas.nilai ?? {}) as Record<string, unknown>;

  return {
    nomorPerkara: berkas.nomorPerkara,
    tahapan: String(identitas.tahapan ?? ""),
    jumlah: {
      paraPihak: jumlahDari(berkas.paraPihak.nilai),
      majelis: jumlahDari(berkas.majelis.nilai),
      panitera: jumlahDari(berkas.panitera.nilai),
      jurusita: jumlahDari(berkas.jurusita.nilai),
      riwayatSidang: jumlahDari(berkas.riwayatSidang.nilai),
      saksiTercatat: jumlahDari(berkas.saksiTercatat.nilai),
      saksiDiperiksa: Number((berkas.pemeriksaanSaksi.nilai as { jumlahSaksi?: number } | null)?.jumlahSaksi ?? 0),
    },
    ada: {
      identitas: berkas.identitas.ada,
      putusan: berkas.putusan.ada,
      pertimbangan: berkas.pertimbangan.ada,
      pemeriksaanSaksi: berkas.pemeriksaanSaksi.ada,
    },
    selisih: berkas.selisih.map((item) => item.hal),
  };
}

export function sidikRingkasan(ringkasan: RingkasanBerkas): string {
  return createHash("sha256").update(JSON.stringify(ringkasan)).digest("hex").slice(0, 32);
}

function bacaRingkasan(teks: unknown): RingkasanBerkas {
  try {
    const isi = JSON.parse(String(teks ?? "{}")) as Partial<RingkasanBerkas>;
    return {
      nomorPerkara: String(isi.nomorPerkara ?? ""),
      tahapan: String(isi.tahapan ?? ""),
      jumlah: (isi.jumlah ?? {}) as Record<string, number>,
      ada: (isi.ada ?? {}) as Record<string, boolean>,
      selisih: Array.isArray(isi.selisih) ? isi.selisih : [],
    };
  } catch {
    // Ringkasan yang rusak dikembalikan kosong, bukan dilempar. Satu baris
    // riwayat yang rusak tidak boleh menghalangi pembacaan sisanya.
    return { nomorPerkara: "", tahapan: "", jumlah: {}, ada: {}, selisih: [] };
  }
}

/**
 * Mencatat keadaan berkas bila berbeda dari yang terakhir.
 *
 * Mengembalikan baris yang baru ditulis, atau null bila tidak ada perubahan.
 * Kegagalan pencatatan TIDAK dilempar: riwayat adalah catatan pendamping, dan
 * halaman perkara tidak boleh mati karena catatannya gagal ditulis.
 */
export async function catatRiwayat(
  db: AletaDatabase,
  berkas: BerkasPerkara,
  dicatatOleh = ""
): Promise<BarisRiwayat | null> {
  const perkaraId = String(berkas.perkaraId || "").trim();
  if (!perkaraId || !berkas.ok) return null;

  try {
    const ringkasan = ringkasBerkas(berkas);
    const sidik = sidikRingkasan(ringkasan);

    const terakhir = await db.queryOne<Record<string, unknown>>(
      `SELECT sidik FROM aleta_berkas_riwayat WHERE perkara_id = ? ORDER BY dirakit_at DESC LIMIT 1`,
      [perkaraId]
    );
    if (terakhir && String(terakhir.sidik) === sidik) return null;

    const baris: BarisRiwayat = {
      id: randomUUID(),
      perkaraId,
      nomorPerkara: berkas.nomorPerkara,
      sidik,
      ringkasan,
      halangan: berkas.halangan,
      dirakitAt: berkas.dirakitPada,
      dicatatOleh,
    };

    await db.run(
      `INSERT INTO aleta_berkas_riwayat
         (id, perkara_id, nomor_perkara, sidik, ringkasan, halangan, dirakit_at, dicatat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        baris.id,
        baris.perkaraId,
        baris.nomorPerkara,
        baris.sidik,
        JSON.stringify(ringkasan),
        berkas.halangan.join(" | "),
        baris.dirakitAt,
        dicatatOleh,
      ]
    );

    return baris;
  } catch {
    return null;
  }
}

/** Riwayat satu perkara, terbaru lebih dulu. */
export async function riwayatPerkara(db: AletaDatabase, perkaraId: string, batas = 50): Promise<BarisRiwayat[]> {
  const id = String(perkaraId || "").trim();
  if (!id) return [];

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_berkas_riwayat WHERE perkara_id = ? ORDER BY dirakit_at DESC LIMIT ${Math.min(Math.max(batas, 1), 200)}`,
    [id]
  );

  return baris.map((item) => ({
    id: String(item.id ?? ""),
    perkaraId: String(item.perkara_id ?? ""),
    nomorPerkara: String(item.nomor_perkara ?? ""),
    sidik: String(item.sidik ?? ""),
    ringkasan: bacaRingkasan(item.ringkasan),
    halangan: String(item.halangan ?? "").split(" | ").filter(Boolean),
    dirakitAt: String(item.dirakit_at ?? ""),
    dicatatOleh: String(item.dicatat_oleh ?? ""),
  }));
}

export type Perubahan = {
  hal: string;
  dari: string;
  menjadi: string;
};

/**
 * Apa yang berubah antara dua keadaan.
 *
 * Disusun untuk dibaca petugas, bukan untuk dibaca mesin: yang disebut hanya
 * yang benar-benar berbeda, dengan nama bagian dalam bahasa sehari-hari.
 * Menampilkan seluruh medan beserta yang tidak berubah menjadikan perubahan
 * yang sesungguhnya tenggelam.
 */
const NAMA_BAGIAN: Record<string, string> = {
  paraPihak: "Para pihak",
  majelis: "Majelis",
  panitera: "Panitera pengganti",
  jurusita: "Jurusita",
  riwayatSidang: "Sidang tercatat",
  saksiTercatat: "Saksi tercatat",
  saksiDiperiksa: "Saksi diperiksa",
  identitas: "Identitas perkara",
  putusan: "Putusan",
  pertimbangan: "Pertimbangan hukum",
  pemeriksaanSaksi: "Pemeriksaan saksi",
};

export function bandingkanRiwayat(lama: RingkasanBerkas, baru: RingkasanBerkas): Perubahan[] {
  const hasil: Perubahan[] = [];

  if (lama.tahapan !== baru.tahapan) {
    hasil.push({ hal: "Tahapan", dari: lama.tahapan || "belum ada", menjadi: baru.tahapan || "belum ada" });
  }

  for (const kunci of new Set([...Object.keys(lama.jumlah), ...Object.keys(baru.jumlah)])) {
    const dari = Number(lama.jumlah[kunci] ?? 0);
    const menjadi = Number(baru.jumlah[kunci] ?? 0);
    if (dari !== menjadi) {
      hasil.push({ hal: NAMA_BAGIAN[kunci] ?? kunci, dari: String(dari), menjadi: String(menjadi) });
    }
  }

  for (const kunci of new Set([...Object.keys(lama.ada), ...Object.keys(baru.ada)])) {
    const dari = Boolean(lama.ada[kunci]);
    const menjadi = Boolean(baru.ada[kunci]);
    if (dari !== menjadi) {
      hasil.push({
        hal: NAMA_BAGIAN[kunci] ?? kunci,
        dari: dari ? "ada" : "belum ada",
        menjadi: menjadi ? "ada" : "belum ada",
      });
    }
  }

  const selisihLama = new Set(lama.selisih);
  const selisihBaru = new Set(baru.selisih);
  for (const hal of selisihBaru) {
    if (!selisihLama.has(hal)) hasil.push({ hal: `Selisih: ${hal}`, dari: "tidak ada", menjadi: "muncul" });
  }
  for (const hal of selisihLama) {
    if (!selisihBaru.has(hal)) hasil.push({ hal: `Selisih: ${hal}`, dari: "ada", menjadi: "hilang" });
  }

  return hasil;
}
