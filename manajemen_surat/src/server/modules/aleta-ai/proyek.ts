import { createHash, randomUUID } from "node:crypto";

import { bacaMenuPemicu, isiPemicuModul, judulModulDari, type LampiranProyek, type ModulProyek, type PemicuMenu } from "@/lib/aleta-ai/proyek";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { simpanTemplatProyek } from "@/server/modules/aleta-ai/templat";
import { bacaDaftarZip } from "@/server/modules/aleta-ai/zip-baca";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - PROYEK V4.5 (unggah ZIP, versi, modul, pemicu)
 * ============================================================================
 *
 * Super Admin mengunggah ZIP proyek (Core Prompt + modul ALETA_NN_*.md + berkas
 * lain). Yang dipakai tahap 1:
 *
 *   *_Core_Prompt.md          system prompt tetap (di-cache)
 *   ALETA_NN_*.md             modul pengetahuan; dikirim menurut pemicu
 *   ALETA_05_Trigger_Menu.md  sumber pemicu (tabel "| Trigger | Output |")
 *
 * Berkas lain (PDF, HTML, RTF, DOCX, skrip py, json, contoh) HANYA dicatat
 * sebagai lampiran proyek untuk tahap 3 - tidak disimpan isinya dan tidak
 * dikirim ke API di tahap 1. Setiap unggahan menjadi versi baru; hanya satu versi
 * aktif, dan unggahan yang isinya sama dengan versi aktif tidak membuat versi baru.
 */

const teks = (n: unknown) => String(n ?? "").trim();

export const BATAS_ZIP_PROYEK = 25 * 1024 * 1024;
const BATAS_MD = 3 * 1024 * 1024;
const BATAS_TOTAL_MD = 10 * 1024 * 1024;
const BATAS_LAMPIRAN_DICATAT = 500;

export type HasilBacaProyek = {
  corePrompt: string;
  coreNama: string;
  modul: ModulProyek[];
  menu: PemicuMenu[];
  lampiran: LampiranProyek[];
  peringatan: string[];
};

function jenisDariNama(nama: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(nama);
  return m ? (m[1] ?? "").toLowerCase() : "";
}

/** Membaca isi ZIP menjadi bagian-bagian proyek. Murni (tanpa basis data) agar mudah diuji. */
export function bacaProyekDariZip(bita: Buffer): HasilBacaProyek {
  const entri = bacaDaftarZip(bita).filter((e) => !e.direktori && !e.nama.startsWith("__MACOSX/"));
  if (!entri.length) throw new ApiError(400, "ZIP kosong.");

  // Satu folder induk bersama dilepas agar ZIP "folder/ALETA_01_x.md" tetap terbaca.
  const awalan = (() => {
    const pertama = entri[0]?.nama.split("/")[0] ?? "";
    return entri.every((e) => e.nama.includes("/") && e.nama.split("/")[0] === pertama) ? `${pertama}/` : "";
  })();
  const relatif = (nama: string) => (awalan && nama.startsWith(awalan) ? nama.slice(awalan.length) : nama);

  const peringatan: string[] = [];
  const lampiran: LampiranProyek[] = [];
  let total = 0;

  let core: { nama: string; isi: string } | null = null;
  const modulMentah = new Map<string, Omit<ModulProyek, "pemicu">>();
  let menu: PemicuMenu[] = [];

  for (const e of entri) {
    const rel = relatif(e.nama);
    const base = rel.split("/").pop() ?? rel;
    const diRoot = !rel.includes("/");
    const adalahMd = /\.md$/i.test(base);

    const core_ = adalahMd && diRoot && /core[_ -]?prompt\.md$/i.test(base);
    const modul_ = adalahMd && diRoot ? /^ALETA_(\d{2})[_ -].+\.md$/i.exec(base) : null;

    if (core_ || modul_) {
      total += e.ukuranAsli;
      if (total > BATAS_TOTAL_MD) throw new ApiError(400, "Isi teks proyek terlalu besar.");
      const isi = e.baca(BATAS_MD).toString("utf8").replace(/^﻿/, "");
      if (core_) {
        if (!core || isi.length > core.isi.length) core = { nama: base, isi };
        continue;
      }
      const kode = `ALETA_${modul_?.[1]}`;
      if (modulMentah.has(kode)) peringatan.push(`Modul ${kode} ada lebih dari satu berkas .md; yang terbesar dipakai.`);
      const ada = modulMentah.get(kode);
      if (!ada || isi.length > ada.isi.length) modulMentah.set(kode, { kode, judul: judulModulDari(isi, base), isi });
      if (kode === "ALETA_05") {
        const hasil = bacaMenuPemicu(isi);
        if (hasil.length) menu = hasil;
      }
      continue;
    }

    if (lampiran.length < BATAS_LAMPIRAN_DICATAT) {
      lampiran.push({ nama: rel.slice(0, 200), ukuran: e.ukuranAsli, jenis: jenisDariNama(base) });
    }
  }

  if (!core) throw new ApiError(400, "ZIP tidak memuat Core Prompt (berkas *_Core_Prompt.md di folder paling atas).");
  if (!core.isi.trim()) throw new ApiError(400, "Core Prompt kosong.");
  if (!modulMentah.size) peringatan.push("ZIP tidak memuat modul ALETA_NN_*.md; hanya Core Prompt yang akan dipakai.");
  if (!menu.length) peringatan.push("Menu pemicu (ALETA_05) tidak terbaca; pemicu modul memakai kata kunci judulnya dan tombol cepat kosong.");
  if (lampiran.length >= BATAS_LAMPIRAN_DICATAT) peringatan.push(`Hanya ${BATAS_LAMPIRAN_DICATAT} lampiran pertama yang dicatat.`);

  const modul = isiPemicuModul([...modulMentah.values()].sort((a, b) => a.kode.localeCompare(b.kode)), menu);
  return { corePrompt: core.isi, coreNama: core.nama, modul, menu, lampiran, peringatan };
}

export type RingkasProyek = {
  id: string;
  versi: number;
  nama: string;
  aktif: boolean;
  jumlahModul: number;
  jumlahPemicu: number;
  jumlahLampiran: number;
  ukuranCore: number;
  sumberNama: string;
  sha: string;
  diunggahOleh: string;
  diunggahAt: string;
};

export type ProyekAktif = {
  id: string;
  versi: number;
  nama: string;
  corePrompt: string;
  modul: ModulProyek[];
  menu: PemicuMenu[];
  lampiran: LampiranProyek[];
  sumberNama: string;
  sha: string;
  diunggahAt: string;
};

type BarisProyek = {
  id: string;
  versi: number | string;
  nama: string;
  core_prompt: string;
  modul_json: string;
  menu_json: string;
  lampiran_json: string;
  sumber_nama: string;
  sumber_sha: string;
  aktif: number | string;
  diunggah_oleh: string;
  diunggah_at: string;
};

function jsonArray<T>(mentah: string): T[] {
  try {
    const j = JSON.parse(mentah) as unknown;
    return Array.isArray(j) ? (j as T[]) : [];
  } catch {
    return [];
  }
}

function ringkasDari(b: BarisProyek): RingkasProyek {
  return {
    id: b.id,
    versi: Number(b.versi),
    nama: b.nama,
    aktif: Number(b.aktif) === 1,
    jumlahModul: jsonArray(b.modul_json).length,
    jumlahPemicu: jsonArray(b.menu_json).length,
    jumlahLampiran: jsonArray(b.lampiran_json).length,
    ukuranCore: b.core_prompt.length,
    sumberNama: b.sumber_nama,
    sha: b.sumber_sha.slice(0, 12),
    diunggahOleh: b.diunggah_oleh,
    diunggahAt: b.diunggah_at,
  };
}

let cacheAktif: ProyekAktif | null = null;

export async function proyekAktif(db: AletaDatabase): Promise<ProyekAktif | null> {
  const b = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek WHERE aktif = 1 ORDER BY versi DESC LIMIT 1`);
  if (!b) {
    cacheAktif = null;
    return null;
  }
  if (cacheAktif?.id === b.id) return cacheAktif;
  cacheAktif = {
    id: b.id,
    versi: Number(b.versi),
    nama: b.nama,
    corePrompt: b.core_prompt,
    modul: jsonArray<ModulProyek>(b.modul_json),
    menu: jsonArray<PemicuMenu>(b.menu_json),
    lampiran: jsonArray<LampiranProyek>(b.lampiran_json),
    sumberNama: b.sumber_nama,
    sha: b.sumber_sha,
    diunggahAt: b.diunggah_at,
  };
  return cacheAktif;
}

export async function daftarVersiProyek(db: AletaDatabase): Promise<RingkasProyek[]> {
  const baris = await db.queryAll<BarisProyek>(`SELECT * FROM aleta_ai_proyek ORDER BY versi DESC LIMIT 100`);
  return baris.map(ringkasDari);
}

export type HasilUnggahProyek = {
  tidakBerubah: boolean;
  proyek: RingkasProyek;
  peringatan: string[];
};

export async function unggahProyek(db: AletaDatabase, olehId: string, masukan: { bita: Buffer; namaBerkas: string }): Promise<HasilUnggahProyek> {
  if (!masukan.bita.length) throw new ApiError(400, "Berkas kosong.");
  if (masukan.bita.length > BATAS_ZIP_PROYEK) throw new ApiError(413, `Ukuran ZIP melampaui ${BATAS_ZIP_PROYEK / 1024 / 1024} MB.`);
  const sha = createHash("sha256").update(masukan.bita).digest("hex");

  const aktif = await db.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek WHERE aktif = 1 ORDER BY versi DESC LIMIT 1`);
  if (aktif && aktif.sumber_sha === sha) return { tidakBerubah: true, proyek: ringkasDari(aktif), peringatan: [] };

  const hasil = bacaProyekDariZip(masukan.bita);
  const id = `aip-${randomUUID()}`;
  const nama = teks(masukan.namaBerkas).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "proyek.zip";

  const baris = await withTransaction(db, async (tx) => {
    const maks = await tx.queryOne<{ versi: number | string | null }>(`SELECT MAX(versi) AS versi FROM aleta_ai_proyek`);
    const versi = Number(maks?.versi ?? 0) + 1;
    await tx.run(`UPDATE aleta_ai_proyek SET aktif = 0 WHERE aktif = 1`);
    await tx.run(
      `INSERT INTO aleta_ai_proyek (id, versi, nama, core_prompt, modul_json, menu_json, lampiran_json, sumber_nama, sumber_sha, aktif, diunggah_oleh, diunggah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        versi,
        "ALETA AI PA V4.5",
        hasil.corePrompt,
        JSON.stringify(hasil.modul),
        JSON.stringify(hasil.menu),
        JSON.stringify(hasil.lampiran),
        nama,
        sha,
        olehId,
        new Date().toISOString(),
      ]
    );
    return (await tx.queryOne<BarisProyek>(`SELECT * FROM aleta_ai_proyek WHERE id = ?`, [id])) as BarisProyek;
  });
  cacheAktif = null;

  // Tahap 3: isi templat (HTML/RTF/DOCX/XLSX) disimpan per versi untuk berkas keluaran tugas.
  const peringatan = [...hasil.peringatan];
  try {
    peringatan.push(...(await simpanTemplatProyek(db, id, masukan.bita)).peringatan);
  } catch {
    peringatan.push("Templat berkas proyek tidak terbaca; berkas tugas memakai susunan bawaan.");
  }

  await catatJejak(db, {
    penggunaId: olehId,
    peranId: "super-admin",
    aksi: "proyek.unggah",
    hasil: "ok",
    ringkas: `Versi ${Number(baris.versi)}: ${hasil.modul.length} modul, ${hasil.menu.length} pemicu, ${hasil.lampiran.length} lampiran`,
  });
  return { tidakBerubah: false, proyek: ringkasDari(baris), peringatan };
}

/**
 * Untuk layar admin. Bentuk: {versi (angka versi aktif), diperbarui, modul:[{nama,versi,...}],
 * riwayat:[versi proyek], aktif, pemicu, lampiran}. `nama` modul = judulnya; `versi` modul = versi proyek aktif.
 */
export async function rincianProyekAdmin(db: AletaDatabase) {
  const aktif = await proyekAktif(db);
  const riwayat = await daftarVersiProyek(db);
  const ringkasAktif = riwayat.find((v) => v.aktif) ?? null;
  return {
    versi: ringkasAktif?.versi ?? 0,
    diperbarui: ringkasAktif?.diunggahAt ?? null,
    aktif: ringkasAktif,
    modul: (aktif?.modul ?? []).map((m) => ({ nama: m.judul, versi: aktif?.versi ?? 0, kode: m.kode, judul: m.judul, ukuran: m.isi.length, pemicu: m.pemicu })),
    riwayat,
    pemicu: (aktif?.menu ?? []).map((p) => ({ kode: p.kode, label: p.label, kelompok: p.grup, modul: p.modul })),
    lampiran: aktif?.lampiran ?? [],
  };
}
