import { readFile } from "node:fs/promises";
import path from "node:path";

import { grupGambarPngRtf } from "@/lib/logo-rtf";
import type { AletaDatabase } from "@/server/db/client";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { cleanInstitutionLogoWhiteCanvas } from "@/server/shared/institution-logo-background";
import { findStoredInstitutionLogoFile } from "@/server/shared/institution-logo-storage";

/**
 * Logo kop satker aktif untuk RTF Derry (sampul, daftar isi, ceklist): logo dari identitas instansi (unggahan satker, data URL, atau logo bawaan portal),
 * diubah menjadi PNG skala abu-abu (monokrom) berlatar putih, tinggi tetap. Gagal membaca = tanpa logo (kop tetap benar), tidak pernah menggagalkan cetak.
 */

const TINGGI_PX = 220;
const TINGGI_TWIP = 960;
const JALUR_LOGO_BAWAAN = path.join(process.cwd(), "public", "mahkamah-agung-logo.png");
const singgahan = new Map<string, string>();

async function bacaBita(logoUrl: string): Promise<Buffer | null> {
  const url = String(logoUrl || "").trim();
  const data = url.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([a-z0-9+/=]+)$/i);
  if (data) return Buffer.from(data[1], "base64");
  const dalam = url.match(/\/api\/public\/institution\/logo\/([^?#/]+)/);
  if (dalam) {
    const berkas = await findStoredInstitutionLogoFile(decodeURIComponent(dalam[1]));
    const mentah = await readFile(berkas.absolutePath);
    return (await cleanInstitutionLogoWhiteCanvas(mentah, berkas.contentType)).buffer;
  }
  return readFile(JALUR_LOGO_BAWAAN);
}

/** PNG skala abu-abu dari bita logo; { png, lebar, tinggi } atau null. */
export async function logoMonokrom(bita: Buffer): Promise<{ png: Buffer; lebar: number; tinggi: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const gambar = sharp(bita).flatten({ background: "#ffffff" }).resize({ height: TINGGI_PX, withoutEnlargement: false }).greyscale().png({ palette: false, compressionLevel: 9 });
    const { data, info } = await gambar.toBuffer({ resolveWithObject: true });
    return { png: data, lebar: info.width, tinggi: info.height };
  } catch {
    return null;
  }
}

/** Grup gambar RTF logo satker aktif ("" bila tidak ada). */
export async function bacaLogoKopRtf(db: AletaDatabase): Promise<string> {
  let logoUrl = "";
  try {
    logoUrl = String((await getInstitutionIdentityFromDb(db)).logoUrl ?? "");
  } catch {
    logoUrl = "";
  }
  const kunci = logoUrl || "(bawaan)";
  const ada = singgahan.get(kunci);
  if (ada !== undefined) return ada;
  let hasil = "";
  try {
    const bita = await bacaBita(logoUrl);
    const mono = bita ? await logoMonokrom(bita) : null;
    if (mono) hasil = grupGambarPngRtf(mono.png, mono.lebar, mono.tinggi, TINGGI_TWIP);
  } catch {
    hasil = "";
  }
  if (hasil) {
    if (singgahan.size > 8) singgahan.clear();
    singgahan.set(kunci, hasil);
  }
  return hasil;
}
