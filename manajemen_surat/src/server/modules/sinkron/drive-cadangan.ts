import path from "node:path";

import { daftarBundel, direktoriBundel, type ManifestBundel } from "@/server/modules/sinkron/cadangan-db";
import {
  GalatDrive,
  KlienDrive,
  sumberTokenAkunLayanan,
  sumberTokenOAuth,
} from "@/server/modules/sinkron/drive";
import { bacaPengaturan, rahasiaDrive, tulisPengaturan, type PengaturanSinkron } from "@/server/modules/sinkron/pengaturan";
import { bacaJson, tulisJson } from "@/server/modules/sinkron/penyimpanan";

/** Nama folder yang dibuat ALETA sendiri bila admin tidak menyebut folder induk. */
export const NAMA_FOLDER_INDUK = "ALETA Sinkron";
export const NAMA_FOLDER_CADANGAN = "Cadangan basis data";
export const NAMA_FOLDER_BERKAS = "Berkas perkara";

export function buatKlienDrive(p: PengaturanSinkron, fetchImpl: typeof fetch = fetch) {
  const r = rahasiaDrive(p);
  const token =
    p.drive.metode === "akun-layanan"
      ? sumberTokenAkunLayanan(r.akunLayananJson, fetchImpl)
      : sumberTokenOAuth({ clientId: p.drive.oauth.clientId, clientSecret: r.clientSecret, refreshToken: r.refreshToken }, fetchImpl);
  return new KlienDrive(token, fetchImpl);
}

/**
 * Folder induk sinkron di Drive.
 *
 * Diisi admin -> dipakai apa adanya (wajib untuk akun layanan: Shared Drive).
 * Kosong (OAuth) -> "ALETA Sinkron" di My Drive akun itu dibuat SEKALI, lalu
 * id-nya disimpan supaya jalan berikutnya tidak membuat folder kedua.
 */
export async function folderInduk(klien: KlienDrive, p: PengaturanSinkron) {
  if (p.drive.folderIndukId) {
    const f = await klien.ambil(p.drive.folderIndukId).catch((galat) => {
      throw new GalatDrive(
        `Folder tujuan Drive (${p.drive.folderIndukId}) tidak dapat dibuka: ${(galat as Error).message}. ` +
          (p.drive.metode === "akun-layanan"
            ? "Tambahkan email akun layanan sebagai anggota Shared Drive / editor folder itu."
            : "Dengan cara OAuth (drive.file) ALETA hanya dapat membuka folder yang dibuatnya sendiri - kosongkan isian folder agar ALETA membuatnya."),
        404
      );
    });
    if (f.trashed) throw new GalatDrive("Folder tujuan Drive ada di Sampah.", 404);
    return f.id;
  }
  if (p.drive.metode === "akun-layanan") {
    throw new GalatDrive("Akun layanan membutuhkan ID folder tujuan di Shared Drive (akun layanan tidak punya My Drive sendiri).", 400);
  }
  if (p.drive.folderDibuatId) {
    const f = await klien.ambil(p.drive.folderDibuatId).catch(() => null);
    if (f && !f.trashed) return f.id;
  }
  const id = await klien.buatFolder(NAMA_FOLDER_INDUK, "root");
  const terbaru = await bacaPengaturan();
  terbaru.drive.folderDibuatId = id;
  await tulisPengaturan(terbaru);
  return id;
}

/** "20260930-020000" -> "2026-09-30 02.00.00" - nama folder yang dibaca orang. */
export function namaFolderBundel(bundel: string) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(bundel);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}.${m[5]}.${m[6]}` : bundel;
}

type CatatanDriveBundel = { folderId: string; berkas: Record<string, string>; selesai: string };

/**
 * Mengunggah bundel cadangan TERBARU ke "<induk>/Cadangan basis data/<tanggal>".
 *
 * DITOLAK bila arsipnya tidak tersandi: basis data SIPP memuat identitas,
 * alamat, dan perkara para pihak. Di server, arsip tanpa sandi tetap di
 * jaringan kantor; di Drive, ia berada di luar kendali satker.
 */
export async function unggahCadanganKeDrive(
  klien: KlienDrive,
  p: PengaturanSinkron,
  pilihan: { sinyal?: AbortSignal; lapor?: (t: string) => void } = {}
) {
  const semua = await daftarBundel();
  const bundel: ManifestBundel | undefined = semua.find((b) => b.berkas.length > 0);
  if (!bundel) throw new Error("Belum ada cadangan basis data di server untuk diunggah. Jalankan cadangan lebih dulu.");
  if (!bundel.tersandi || bundel.berkas.some((b) => !b.tersandi)) {
    throw new Error(
      "Arsip basis data TIDAK tersandi, jadi tidak diunggah ke Google Drive. Isi kata sandi arsip di layar Sinkron & cadangan, lalu jalankan cadangan lagi."
    );
  }
  const dir = direktoriBundel(bundel.bundel);
  const jalurCatatan = path.join(dir, "DRIVE.json");
  const catatan = await bacaJson<CatatanDriveBundel>(jalurCatatan, { folderId: "", berkas: {}, selesai: "" });

  const induk = await folderInduk(klien, p);
  const akarCadangan = await klien.pastikanFolder(NAMA_FOLDER_CADANGAN, induk);
  if (!catatan.folderId) {
    catatan.folderId = await klien.pastikanFolder(namaFolderBundel(bundel.bundel), akarCadangan);
    await tulisJson(jalurCatatan, catatan);
  }
  let terunggah = 0;
  let byte = 0;
  for (const b of [...bundel.berkas.map((x) => x.nama), "MANIFEST.json"]) {
    if (pilihan.sinyal?.aborted) throw new Error("Dihentikan admin.");
    if (catatan.berkas[b]) continue;
    pilihan.lapor?.(`Mengunggah ${b}`);
    catatan.berkas[b] = await klien.unggahBerkas(b, catatan.folderId, path.join(dir, b));
    await tulisJson(jalurCatatan, catatan);
    terunggah += 1;
    byte += bundel.berkas.find((x) => x.nama === b)?.byte ?? 0;
  }
  catatan.selesai = catatan.selesai || new Date().toISOString();
  await tulisJson(jalurCatatan, catatan);

  // Retensi di Drive: folder bundel tertua dipindah ke Sampah (dapat dipulihkan 30 hari).
  const folder = (await klien.daftarAnak(akarCadangan, true))
    .filter((f) => /^\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  const dibuang: string[] = [];
  for (const f of folder.slice(Math.max(1, p.drive.cadangan.simpan))) {
    await klien.buang(f.id);
    dibuang.push(f.name);
  }
  return { bundel: bundel.bundel, terunggah, byte, dibuang };
}
