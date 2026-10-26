import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { AletaDatabase } from "@/server/db/client";
import {
  adalahSkrip,
  adalahTeks,
  dalamFolderUnggahan,
  ekstensiBerkas,
  mengandungKodePhp,
  periksaIsi,
  type Deteksi,
  type JenisTemuan,
} from "@/server/modules/integritas/aturan";
import { bacaPengaturanIntegritas, urlHalamanSah, type FolderIntegritas, type PengaturanIntegritas } from "@/server/modules/integritas/pengaturan";

/**
 * ============================================================================
 * PEMINDAI INTEGRITAS BERKAS (E6, 25 Okt 2026)
 * ============================================================================
 *
 * FOLDER HANYA DIBACA. Satu-satunya fungsi berkas yang dipakai di sini adalah
 * opendir/lstat/open-baca/createReadStream (tidak ada tulis, ganti nama, hapus,
 * ubah izin, atau pembuatan berkas di folder terdaftar) - dijaga uji yang
 * membandingkan isi folder sebelum dan sesudah pindai. Tautan simbolik tidak
 * diikuti. Isi berkas mencurigakan tidak pernah disimpan: temuan hanya berisi
 * jalur, jenis, aturan, nomor baris, ukuran, dan sha256. Tidak ada yang
 * dihapus otomatis.
 */
export const BATAS_HASH_BYTE = 50 * 1024 * 1024;
export const BATAS_ISI_BYTE = 2 * 1024 * 1024;
export const KEPALA_BYTE = 64 * 1024;
export const BATAS_BERKAS = 300_000;
export const BATAS_KEDALAMAN = 25;
export const BATAS_WAKTU_MS = 20 * 60_000;
export const BATAS_HALAMAN_BYTE = 2 * 1024 * 1024;
export const RETENSI_PINDAI_HARI = 90;

export type JenisPindai = "awal" | "rutin" | "penuh";

export type RingkasPindai = {
  folderId: string;
  jenis: JenisPindai;
  jumlahBerkas: number;
  temuanBaru: number;
  galat: string;
};

type Opsi = { kini?: () => Date; berhentiSetelahMs?: number };

const iso = (d: Date) => d.toISOString();
const jedaUntukLoop = () => new Promise<void>((s) => setImmediate(s));

async function sha256Berkas(jalurFisik: string): Promise<string> {
  const h = crypto.createHash("sha256");
  await new Promise<void>((selesai, gagal) => {
    const s = createReadStream(jalurFisik);
    s.on("data", (d) => h.update(d));
    s.on("error", gagal);
    s.on("end", () => selesai());
  });
  return h.digest("hex");
}

async function bacaAwal(jalurFisik: string, byte: number): Promise<Buffer> {
  const fh = await fs.open(jalurFisik, "r");
  try {
    const buf = Buffer.alloc(byte);
    const { bytesRead } = await fh.read(buf, 0, byte, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

// ---------------------------------------------------------------------------
// Penyimpanan temuan
// ---------------------------------------------------------------------------

type BarisTemuan = {
  id: string;
  folder_id: string;
  jalur: string;
  jenis: string;
  aturan: string;
  baris: number | string;
  sha256: string;
  ukuran: number | string;
  pertama_at: string;
  terakhir_at: string;
  status: string;
  ditangani_oleh: string;
  ditangani_at: string;
  diperingatkan_at: string;
};

/** Mencatat satu temuan. Mengembalikan true bila ini temuan BARU (atau dibuka kembali karena isinya berubah). */
async function catatTemuan(
  db: AletaDatabase,
  m: { folderId: string; jalur: string; jenis: JenisTemuan; aturan: string; baris: number; sha256: string; ukuran: number; kini: Date }
): Promise<boolean> {
  const ada = await db.queryOne<BarisTemuan>("SELECT * FROM aleta_integritas_temuan WHERE folder_id = ? AND jalur = ? AND jenis = ? AND aturan = ?", [m.folderId, m.jalur, m.jenis, m.aturan]);
  const t = iso(m.kini);
  if (!ada) {
    await db.run(
      `INSERT INTO aleta_integritas_temuan (id, folder_id, jalur, jenis, aturan, baris, sha256, ukuran, pertama_at, terakhir_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru')`,
      [crypto.randomUUID(), m.folderId, m.jalur, m.jenis, m.aturan, m.baris, m.sha256, m.ukuran, t, t]
    );
    return true;
  }
  // Isi berubah sesudah ditangani/ditandai aman: dibuka kembali. Isi sama: hanya waktu terakhir.
  const berubah = Boolean(m.sha256) && ada.sha256 !== m.sha256 && ada.status !== "baru";
  if (berubah) {
    await db.run(
      `UPDATE aleta_integritas_temuan SET baris = ?, sha256 = ?, ukuran = ?, terakhir_at = ?, status = 'baru', ditangani_oleh = '', ditangani_at = '', diperingatkan_at = '' WHERE id = ?`,
      [m.baris, m.sha256, m.ukuran, t, ada.id]
    );
    return true;
  }
  await db.run("UPDATE aleta_integritas_temuan SET baris = ?, sha256 = ?, ukuran = ?, terakhir_at = ? WHERE id = ?", [m.baris, m.sha256 || ada.sha256, m.ukuran, t, ada.id]);
  return false;
}

async function jalurAman(db: AletaDatabase, folderId: string): Promise<Set<string>> {
  const baris = await db.queryAll<{ jalur: string; sha256: string }>("SELECT jalur, sha256 FROM aleta_integritas_aman WHERE folder_id = ?", [folderId]);
  return new Set(baris.map((b) => `${b.jalur}\u0000${b.sha256}`));
}

// ---------------------------------------------------------------------------
// Pindai satu folder
// ---------------------------------------------------------------------------

type BarisDasar = { jalur: string; sha256: string; ukuran: number | string; diubah_at: string };

export async function pindaiFolder(
  db: AletaDatabase,
  folder: FolderIntegritas,
  pengaturan: Pick<PengaturanIntegritas, "lewati">,
  jenisDiminta: JenisPindai | "otomatis" = "otomatis",
  opsi: Opsi = {}
): Promise<RingkasPindai> {
  const kini = opsi.kini ?? (() => new Date());
  const mulai = kini();
  const batasMs = opsi.berhentiSetelahMs ?? BATAS_WAKTU_MS;
  const akar = path.normalize(folder.jalur);
  const lewati = new Set(pengaturan.lewati.map((s) => s.toLowerCase()));

  const baseline = new Map<string, BarisDasar>();
  for (const b of await db.queryAll<BarisDasar>("SELECT jalur, sha256, ukuran, diubah_at FROM aleta_integritas_berkas WHERE folder_id = ?", [folder.id])) baseline.set(b.jalur, b);
  const jenis: JenisPindai = jenisDiminta === "otomatis" ? (baseline.size === 0 ? "awal" : "rutin") : jenisDiminta === "rutin" && baseline.size === 0 ? "awal" : jenisDiminta;
  const aman = await jalurAman(db, folder.id);
  const idPindai = crypto.randomUUID();
  await db.run("INSERT INTO aleta_integritas_pindai (id, folder_id, jenis, mulai_at) VALUES (?, ?, ?, ?)", [idPindai, folder.id, jenis, iso(mulai)]);

  const terlihat = new Set<string>();
  let jumlah = 0;
  let baru = 0;
  let galat = "";
  let terpotong = false;

  const catat = async (jalur: string, jenisT: JenisTemuan, d: Pick<Deteksi, "aturan" | "baris">, sha: string, ukuran: number) => {
    if (sha && aman.has(`${jalur}\u0000${sha}`)) return;
    if (await catatTemuan(db, { folderId: folder.id, jalur, jenis: jenisT, aturan: d.aturan, baris: d.baris, sha256: sha, ukuran, kini: kini() })) baru += 1;
  };

  const proses = async (rel: string, fisik: string, ukuran: number, diubahIso: string): Promise<string> => {
    terlihat.add(rel);
    const awal = baseline.get(rel);
    const adaBaseline = Boolean(awal);
    const berubahMeta = !awal || Number(awal.ukuran) !== ukuran || awal.diubah_at !== diubahIso;
    const perluHash = jenis === "penuh" || berubahMeta;
    let sha = awal?.sha256 ?? "";
    if (perluHash && ukuran <= BATAS_HASH_BYTE) sha = await sha256Berkas(fisik);
    const skrip = adalahSkrip(rel);
    const berubahIsi = !awal || awal.sha256 !== sha;

    if (skrip && dalamFolderUnggahan(rel, folder.unggahan)) await catat(rel, "php-di-unggahan", { aturan: "unggahan", baris: 0 }, sha, ukuran);
    if (skrip && jenis !== "awal") {
      if (!adaBaseline) await catat(rel, "php-baru", { aturan: "baru", baris: 0 }, sha, ukuran);
      else if (berubahIsi) await catat(rel, "php-berubah", { aturan: "berubah", baris: 0 }, sha, ukuran);
    }

    // Isi diperiksa untuk berkas baru/berubah, dan untuk semua berkas pada pindai awal/penuh.
    const periksaSekarang = jenis !== "rutin" || berubahIsi || berubahMeta;
    if (!periksaSekarang) return sha;
    const teks = adalahTeks(rel);
    if (teks && ukuran <= BATAS_ISI_BYTE) {
      const isi = (await fs.readFile(fisik)).toString("latin1");
      for (const d of periksaIsi(isi, { skrip, htaccess: ekstensiBerkas(rel) === ".htaccess" })) await catat(rel, d.jenis, d, sha, ukuran);
    } else if (!skrip && dalamFolderUnggahan(rel, folder.unggahan) && ukuran > 0) {
      const kepala = (await bacaAwal(fisik, KEPALA_BYTE)).toString("latin1");
      if (mengandungKodePhp(kepala)) await catat(rel, "php-di-gambar", { aturan: "kode-php", baris: 1 }, sha, ukuran);
    }
    return sha;
  };

  const perubahanBaseline: Array<{ jalur: string; sha: string; ukuran: number; diubah: string }> = [];

  const jelajah = async (dirFisik: string, dirRel: string, dalam: number) => {
    if (dalam > BATAS_KEDALAMAN || terpotong) return;
    let dir;
    try {
      dir = await fs.opendir(dirFisik);
    } catch (e) {
      galat ||= `tidak dapat membuka ${dirRel || "/"}: ${(e as NodeJS.ErrnoException).code ?? "galat"}`;
      return;
    }
    for await (const e of dir) {
      if (terpotong) return;
      if (e.isSymbolicLink()) continue;
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
      const fisik = path.join(dirFisik, e.name);
      if (e.isDirectory()) {
        if (lewati.has(e.name.toLowerCase())) continue;
        // Di Windows, "junction" dilaporkan sebagai folder biasa oleh opendir; lstat membongkarnya. Tidak pernah diikuti.
        try {
          if ((await fs.lstat(fisik)).isSymbolicLink()) continue;
        } catch {
          continue;
        }
        await jelajah(fisik, rel, dalam + 1);
        continue;
      }
      if (!e.isFile()) continue;
      if (jumlah >= BATAS_BERKAS) {
        terpotong = true;
        galat ||= `lebih dari ${BATAS_BERKAS} berkas; pemindaian dihentikan`;
        return;
      }
      if (kini().getTime() - mulai.getTime() > batasMs) {
        terpotong = true;
        galat ||= "melewati batas waktu pemindaian; sisa berkas dipindai pada putaran berikutnya";
        return;
      }
      jumlah += 1;
      if (jumlah % 200 === 0) await jedaUntukLoop();
      try {
        const st = await fs.lstat(fisik);
        const diubahIso = iso(new Date(Math.floor(st.mtimeMs)));
        const sha = await proses(rel, fisik, st.size, diubahIso);
        perubahanBaseline.push({ jalur: rel, sha, ukuran: st.size, diubah: diubahIso });
      } catch (err) {
        galat ||= `tidak dapat membaca ${rel}: ${(err as NodeJS.ErrnoException).code ?? "galat"}`;
      }
    }
  };

  try {
    const st = await fs.stat(akar);
    if (!st.isDirectory()) throw new Error("bukan folder");
    await jelajah(akar, "", 0);
  } catch (e) {
    galat = galat || `folder tidak terbaca: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`;
  }

  // Baseline ditulis ulang dari hasil pindai (hanya bila folder terbaca).
  if (jumlah > 0) {
    await simpanBaseline(db, folder.id, baseline, perubahanBaseline, kini());
    if (!terpotong) await bersihkanHilang(db, folder.id, terlihat, baseline, kini());
  }

  const selesai = kini();
  await db.run("UPDATE aleta_integritas_pindai SET selesai_at = ?, jumlah_berkas = ?, temuan_baru = ?, galat = ? WHERE id = ?", [iso(selesai), jumlah, baru, galat.slice(0, 300), idPindai]);
  await db.run("DELETE FROM aleta_integritas_pindai WHERE mulai_at < ?", [iso(new Date(selesai.getTime() - RETENSI_PINDAI_HARI * 86_400_000))]);
  return { folderId: folder.id, jenis, jumlahBerkas: jumlah, temuanBaru: baru, galat };
}

/** Menulis baris baseline hanya untuk berkas baru atau yang ukuran/waktu ubah/sha-nya berbeda. */
async function simpanBaseline(
  db: AletaDatabase,
  folderId: string,
  lama: Map<string, BarisDasar>,
  daftar: Array<{ jalur: string; sha: string; ukuran: number; diubah: string }>,
  kini: Date
) {
  let n = 0;
  for (const d of daftar) {
    const l = lama.get(d.jalur);
    if (l && Number(l.ukuran) === d.ukuran && l.diubah_at === d.diubah && l.sha256 === d.sha) continue;
    await db.run(
      `INSERT INTO aleta_integritas_berkas (folder_id, jalur, sha256, ukuran, diubah_at, dilihat_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (folder_id, jalur) DO UPDATE SET sha256 = excluded.sha256, ukuran = excluded.ukuran, diubah_at = excluded.diubah_at, dilihat_at = excluded.dilihat_at`,
      [folderId, d.jalur, d.sha, d.ukuran, d.diubah, iso(kini)]
    );
    n += 1;
    if (n % 500 === 0) await jedaUntukLoop();
  }
}

async function bersihkanHilang(db: AletaDatabase, folderId: string, terlihat: Set<string>, baseline: Map<string, BarisDasar>, kini: Date) {
  for (const jalur of baseline.keys()) {
    if (terlihat.has(jalur)) continue;
    await db.run("DELETE FROM aleta_integritas_berkas WHERE folder_id = ? AND jalur = ?", [folderId, jalur]);
  }
  // Temuan atas berkas yang sudah tidak ada: ditutup oleh sistem (berkasnya hilang, bukan dihapus ALETA).
  const terbuka = await db.queryAll<{ id: string; jalur: string }>("SELECT id, jalur FROM aleta_integritas_temuan WHERE folder_id = ? AND status = 'baru'", [folderId]);
  for (const t of terbuka) {
    if (!terlihat.has(t.jalur)) {
      await db.run("UPDATE aleta_integritas_temuan SET status = 'ditangani', ditangani_oleh = 'sistem (berkas sudah tidak ada di folder)', ditangani_at = ? WHERE id = ?", [iso(kini), t.id]);
    }
  }
}
