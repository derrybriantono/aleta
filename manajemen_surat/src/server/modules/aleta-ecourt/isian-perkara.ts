import { randomUUID } from "node:crypto";

import {
  kelompokUntuk,
  ringkasIsian,
  susunKelompok,
  type ButirIsian,
  type KelompokTerisi,
} from "@/lib/kelompok-isian";
import type { AletaDatabase } from "@/server/db/client";

/**
 * ISIAN PERKARA UNTUK KELAS B (Tahap 3 - Kemandirian Blangko).
 *
 * ============================================================================
 * MELEKAT PADA PERKARA, BUKAN PADA BLANGKO
 * ============================================================================
 *
 * Mas kawin sebuah perkara tetap mas kawin yang sama, baik ia tercetak di BAS,
 * di penetapan, maupun di salinan. Sekali diisi, ia terpakai di seluruh
 * dokumen perkara itu.
 *
 * ============================================================================
 * TIDAK PERNAH DITEBAK, TIDAK PERNAH DIISI SENDIRI
 * ============================================================================
 *
 * Kelas B adalah fakta perkara yang hanya diketahui orang yang menyidangkan.
 * Tidak ada nilai bawaan, tidak ada usulan mesin, dan tidak ada pengisian
 * otomatis dari perkara lain yang mirip. Menebak fakta perkara berarti
 * mengarang isi dokumen yang ditandatangani.
 *
 * Yang boleh dilakukan mesin hanyalah MENGELOMPOKKAN dan MENGURUTKAN, supaya
 * 144 kotak kosong menjadi beberapa kelompok yang dapat dikerjakan.
 */

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

/**
 * Butir isian yang dibutuhkan sebuah blangko, beserta nilai yang sudah ada.
 *
 * `penanda` biasanya seluruh penanda blangko; yang bukan Kelas B disaring di
 * sini, sehingga pemanggilnya tidak perlu tahu kelas apa pun.
 */
export async function butirUntukBlangko(
  db: AletaDatabase,
  perkaraId: string,
  penanda: string[]
): Promise<KelompokTerisi[]> {
  const perkara = teks(perkaraId);
  const daftar = [...new Set(penanda.map(teks).filter(Boolean))];
  const butir: ButirIsian[] = [];

  for (const noVar of daftar) {
    const def = await db.queryOne<Record<string, unknown>>(
      `SELECT no_var, nama, kelas, jumlah_pakai FROM aleta_kamus_variabel WHERE no_var = ? AND kelas = 'B'`,
      [noVar]
    );
    if (!def) continue;

    const tersimpan = await db.queryOne<Record<string, unknown>>(
      `SELECT nilai, diisi_oleh, diubah_at FROM aleta_isian_perkara WHERE perkara_id = ? AND no_var = ?`,
      [perkara, noVar]
    );

    const nama = teks(def.nama);
    butir.push({
      noVar,
      nama,
      kelompok: kelompokUntuk(nama),
      nilai: teks(tersimpan?.nilai),
      diisiOleh: teks(tersimpan?.diisi_oleh),
      diisiAt: teks(tersimpan?.diubah_at),
      jumlahPakai: Number(def.jumlah_pakai ?? 0) || 0,
    });
  }

  return susunKelompok(butir);
}

/** Seluruh isian sebuah perkara sebagai peta - dipakai penyelesai Tahap 2. */
export async function isianPerkara(db: AletaDatabase, perkaraId: string): Promise<Record<string, string>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT no_var, nilai FROM aleta_isian_perkara WHERE perkara_id = ?`,
    [teks(perkaraId)]
  );
  const peta: Record<string, string> = {};
  for (const b of baris) {
    const nilai = teks(b.nilai);
    // Isian kosong TIDAK masuk peta: peta yang memuatnya akan membuat
    // penyelesai menganggapnya sudah dijawab, lalu penandanya lenyap menjadi
    // ruang kosong pada naskah alih-alih tetap terlihat.
    if (nilai) peta[teks(b.no_var)] = nilai;
  }
  return peta;
}

export type HasilSimpan = {
  ok: boolean;
  jumlahDisimpan: number;
  ditolak: Array<{ noVar: string; sebab: string }>;
  sebab: string;
};

/**
 * Menyimpan isian. Hanya variabel Kelas B yang diterima.
 *
 * Menerima nomor variabel apa pun berarti isian tangan dapat menimpa nilai
 * yang seharusnya dibaca dari SIPP - dan sejak itu naskah menyebut nama pihak
 * yang berbeda dari yang tercatat pada perkaranya, tanpa satu pun tanda.
 */
export async function simpanIsian(
  db: AletaDatabase,
  masukan: { perkaraId: string; nilai: Record<string, string>; oleh: string }
): Promise<HasilSimpan> {
  const perkara = teks(masukan.perkaraId);
  const oleh = teks(masukan.oleh);
  const ditolak: Array<{ noVar: string; sebab: string }> = [];

  if (!perkara) return { ok: false, jumlahDisimpan: 0, ditolak, sebab: "Perkara tidak disebut." };
  if (!oleh) return { ok: false, jumlahDisimpan: 0, ditolak, sebab: "Isian harus menyebut siapa yang mengisinya." };

  const sekarang = new Date().toISOString();
  let disimpan = 0;

  for (const [noVarMentah, nilaiMentah] of Object.entries(masukan.nilai ?? {})) {
    const noVar = teks(noVarMentah);
    const nilai = String(nilaiMentah ?? "").trim();
    if (!noVar) continue;

    const def = await db.queryOne<Record<string, unknown>>(
      `SELECT kelas FROM aleta_kamus_variabel WHERE no_var = ?`,
      [noVar]
    );
    if (!def) {
      ditolak.push({ noVar, sebab: "Tidak ada di kamus variabel." });
      continue;
    }
    if (teks(def.kelas) !== "B") {
      ditolak.push({
        noVar,
        sebab: `Kelas ${teks(def.kelas)} - nilainya berasal dari sistem, tidak boleh diisi tangan.`,
      });
      continue;
    }

    const lama = await db.queryOne<Record<string, unknown>>(
      `SELECT id, nilai FROM aleta_isian_perkara WHERE perkara_id = ? AND no_var = ?`,
      [perkara, noVar]
    );
    const nilaiLama = teks(lama?.nilai);
    if (lama && nilaiLama === nilai) continue;

    if (lama) {
      await db.run(
        `UPDATE aleta_isian_perkara SET nilai = ?, diubah_oleh = ?, diubah_at = ? WHERE id = ?`,
        [nilai, oleh, sekarang, teks(lama.id)]
      );
    } else {
      await db.run(
        `INSERT INTO aleta_isian_perkara (id, perkara_id, no_var, nilai, diisi_oleh, diisi_at, diubah_oleh, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), perkara, noVar, nilai, oleh, sekarang, oleh, sekarang]
      );
    }

    // Riwayat ditulis untuk TIAP perubahan, termasuk pengosongan. Yang menjawab
    // "sejak kapan maharnya tertulis begini" adalah riwayatnya.
    await db.run(
      `INSERT INTO aleta_isian_riwayat (id, perkara_id, no_var, nilai_lama, nilai_baru, oleh, pada)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), perkara, noVar, nilaiLama, nilai, oleh, sekarang]
    );
    disimpan += 1;
  }

  return { ok: true, jumlahDisimpan: disimpan, ditolak, sebab: "" };
}

/** Riwayat penyuntingan satu isian, terbaru dahulu. */
export async function riwayatIsian(db: AletaDatabase, perkaraId: string, noVar: string) {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_isian_riwayat WHERE perkara_id = ? AND no_var = ? ORDER BY pada DESC LIMIT 50`,
    [teks(perkaraId), teks(noVar)]
  );
  return baris.map((b) => ({
    nilaiLama: teks(b.nilai_lama),
    nilaiBaru: teks(b.nilai_baru),
    oleh: teks(b.oleh),
    pada: teks(b.pada),
  }));
}

/** Ringkasan kesiapan isian sebuah blangko untuk satu perkara. */
export async function kesiapanIsian(db: AletaDatabase, perkaraId: string, penanda: string[]) {
  const kelompok = await butirUntukBlangko(db, perkaraId, penanda);
  return { kelompok, ringkas: ringkasIsian(kelompok) };
}
