import type { AletaDatabase } from "@/server/db/client";

/**
 * TELAAH DRAF PER BAGIAN (H3) - hakim menyaring, bukan menerima seluruhnya.
 *
 * ============================================================================
 * TOMBOL YANG TIDAK MENGUBAH SYARAT ADALAH HIASAN
 * ============================================================================
 *
 * "Terima" dan "tolak" pada tiap alinea tidak berarti apa-apa selama draf yang
 * belum ditelaah tetap dapat ditandatangani. Ia akan dilewati pada hari kedua,
 * dan sesudah itu jejaknya menyebut "ditelaah" untuk naskah yang tidak pernah
 * dibaca - lebih buruk daripada tidak ada tombolnya sama sekali.
 *
 * Maka telaah di sini MENGUBAH SYARAT: selama masih ada butir bertanda
 * 'belum', tandatanganiDraf menolak.
 *
 * ============================================================================
 * JALAN PINTAS ADA, DAN IA MENGAKU DIRINYA JALAN PINTAS
 * ============================================================================
 *
 * Draf berisi empat puluh alinea menuntut empat puluh ketukan. Menolak jalan
 * pintas sama sekali akan membuat alatnya ditinggalkan pada hari yang paling
 * sibuk - dan alat yang ditinggalkan tidak menyaring apa pun.
 *
 * Karena itu terimaSisanya ada. Yang tidak boleh adalah jejaknya berbohong:
 * tiap butir yang diterima lewat jalan itu ditandai `sekaligus`, sehingga
 * "diterima" hasil sekali tekan tidak pernah terbaca sama dengan "diterima"
 * hasil membaca alinea itu sendiri.
 *
 * ============================================================================
 * YANG DITOLAK TIDAK DIHAPUS
 * ============================================================================
 *
 * Penolakan adalah keputusan, dan keputusan adalah bagian dari jejak. Butir
 * yang hilang dari tabel membuat pertanyaan "mengapa alinea ini tidak ada di
 * putusan" tidak dapat dijawab siapa pun - termasuk oleh hakim yang menolaknya
 * sendiri, setahun kemudian.
 */

export type KeadaanTelaah = "belum" | "diterima" | "ditolak";

export type ButirTelaah = {
  id: string;
  butirId: string;
  urutan: number;
  teks: string;
  versi: number;
  alasan: string[];
  keadaan: KeadaanTelaah;
  diputusOleh: string;
  alasanTolak: string;
  diputusAt: string;
  sekaligus: boolean;
};

export type RingkasTelaah = {
  jumlah: number;
  belum: number;
  diterima: number;
  ditolak: number;
  /** Diterima lewat jalan pintas - dipisah supaya jejaknya jujur. */
  diterimaSekaligus: number;
  selesai: boolean;
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function uraikanJson(nilai: unknown): string[] {
  try {
    const hasil = JSON.parse(bersih(nilai) || "[]");
    return Array.isArray(hasil) ? hasil.map(bersih).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function bentuk(baris: Record<string, unknown>): ButirTelaah {
  return {
    id: bersih(baris.id),
    butirId: bersih(baris.butir_id),
    urutan: Number(baris.urutan ?? 0),
    teks: bersih(baris.teks_saat_itu),
    versi: Number(baris.versi_butir ?? 0),
    alasan: uraikanJson(baris.alasan),
    keadaan: (bersih(baris.keadaan) || "belum") as KeadaanTelaah,
    diputusOleh: bersih(baris.diputus_oleh),
    alasanTolak: bersih(baris.alasan_tolak),
    diputusAt: bersih(baris.diputus_at),
    sekaligus: Number(baris.sekaligus ?? 0) === 1,
  };
}

export async function butirTelaah(db: AletaDatabase, drafId: string): Promise<ButirTelaah[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_butir WHERE draf_id = ? ORDER BY urutan ASC`,
    [bersih(drafId)]
  );
  return baris.map(bentuk);
}

/**
 * Ringkasan telaah.
 *
 * `selesai` menuntut jumlah > 0. Draf tanpa satu pun butir bukan draf yang
 * "sudah selesai ditelaah" - ia draf yang pertimbangannya kosong, dan
 * membacanya sebagai selesai akan meloloskannya ke tanda tangan.
 */
export function ringkasTelaah(butir: ButirTelaah[]): RingkasTelaah {
  const belum = butir.filter((item) => item.keadaan === "belum").length;
  const diterima = butir.filter((item) => item.keadaan === "diterima");
  return {
    jumlah: butir.length,
    belum,
    diterima: diterima.length,
    ditolak: butir.filter((item) => item.keadaan === "ditolak").length,
    diterimaSekaligus: diterima.filter((item) => item.sekaligus).length,
    selesai: butir.length > 0 && belum === 0,
  };
}

/**
 * Menelaah satu butir.
 *
 * Menolak WAJIB beralasan. Penolakan tanpa alasan tidak dapat dibaca ulang -
 * dan yang paling sering membacanya adalah hakim itu sendiri, saat perkara
 * serupa datang berikutnya.
 *
 * Draf yang sudah ditandatangani tidak dapat ditelaah lagi: mengubah butirnya
 * berarti mengubah naskah yang sudah bertanda tangan.
 */
export async function telaahButir(
  db: AletaDatabase,
  masukan: { drafId: string; barisId: string; keadaan: "diterima" | "ditolak"; oleh: string; alasan?: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const drafId = bersih(masukan.drafId);
  const barisId = bersih(masukan.barisId);
  const oleh = bersih(masukan.oleh);

  if (!oleh) return { ok: false, sebab: "Sebutkan siapa yang menelaah." };
  if (masukan.keadaan === "ditolak" && !bersih(masukan.alasan)) {
    return { ok: false, sebab: "Penolakan wajib beralasan." };
  }

  const terkunci = await drafTerkunci(db, drafId);
  if (terkunci) return { ok: false, sebab: terkunci };

  const hasil = await db.run(
    `UPDATE aleta_putusan_draf_butir
        SET keadaan = ?, diputus_oleh = ?, alasan_tolak = ?, diputus_at = ?, sekaligus = 0
      WHERE id = ? AND draf_id = ?`,
    [
      masukan.keadaan,
      oleh,
      masukan.keadaan === "ditolak" ? bersih(masukan.alasan) : "",
      new Date().toISOString(),
      barisId,
      drafId,
    ]
  );
  return hasil.changes ? { ok: true } : { ok: false, sebab: "Butir tidak ditemukan pada draf ini." };
}

/**
 * Menerima seluruh butir yang belum ditelaah, sekaligus.
 *
 * Ditandai `sekaligus` supaya jejaknya tidak pernah mengaku telaah alinea demi
 * alinea untuk keputusan yang diambil sekali tekan. Yang sudah ditelaah satu
 * per satu TIDAK disentuh - menimpanya akan menghapus penolakan yang sengaja
 * diberikan hakim beberapa saat sebelumnya.
 */
export async function terimaSisanya(
  db: AletaDatabase,
  masukan: { drafId: string; oleh: string }
): Promise<{ ok: boolean; jumlah: number; sebab?: string }> {
  const drafId = bersih(masukan.drafId);
  const oleh = bersih(masukan.oleh);
  if (!oleh) return { ok: false, jumlah: 0, sebab: "Sebutkan siapa yang menerima." };

  const terkunci = await drafTerkunci(db, drafId);
  if (terkunci) return { ok: false, jumlah: 0, sebab: terkunci };

  const hasil = await db.run(
    `UPDATE aleta_putusan_draf_butir
        SET keadaan = 'diterima', diputus_oleh = ?, diputus_at = ?, sekaligus = 1
      WHERE draf_id = ? AND keadaan = 'belum'`,
    [oleh, new Date().toISOString(), drafId]
  );
  return { ok: true, jumlah: hasil.changes };
}

async function drafTerkunci(db: AletaDatabase, drafId: string): Promise<string> {
  const draf = await db.queryOne<Record<string, unknown>>(
    `SELECT keadaan FROM aleta_putusan_draf WHERE id = ?`,
    [bersih(drafId)]
  );
  if (!draf) return "Draf tidak ditemukan.";
  const keadaan = bersih(draf.keadaan);
  if (keadaan === "ditandatangani") return "Draf ini sudah ditandatangani dan tidak dapat ditelaah lagi.";
  if (keadaan === "dibatalkan") return "Draf ini sudah dibatalkan.";
  return "";
}

/**
 * Naskah pertimbangan sesudah telaah - hanya yang diterima.
 *
 * Dipisah dari naskah hasil perakitan, bukan menggantikannya. Naskah awal
 * adalah apa yang DIUSULKAN mesin; naskah ini adalah apa yang DISETUJUI hakim.
 * Menyimpan keduanya membuat perbedaannya dapat dibaca - dan perbedaan itulah
 * yang membuktikan hakim benar-benar menyaring.
 */
export function naskahDiterima(butir: ButirTelaah[]): string {
  return butir
    .filter((item) => item.keadaan === "diterima")
    .sort((a, b) => a.urutan - b.urutan)
    .map((item) => item.teks.trim())
    .filter(Boolean)
    .join("\n\n");
}
