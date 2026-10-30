import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { DEFAULT_INSTITUTION_LOGO_PATH } from "@/lib/institution-logo";
import { LOGO_KOP_TINGGI_TWIP, grupGambarPngRtf } from "@/lib/logo-rtf";
import { monokromTajam } from "@/lib/logo-monokrom";
import type { AletaDatabase } from "@/server/db/client";
import { bacaLogoAleta } from "@/server/modules/pengaturan-abt/identitas-satker";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { cleanInstitutionLogoWhiteCanvas } from "@/server/shared/institution-logo-background";
import { findStoredInstitutionLogoFile } from "@/server/shared/institution-logo-storage";

/**
 * Logo kop satker aktif untuk RTF Derry (sampul, lampiran, daftar isi, ceklist) - MONOKROM TAJAM (30 Okt 2026).
 *
 * Sumber, berurutan: (1) logo kop di Identitas satker ABT (aleta_identitas_satker), (2) logo instansi yang DIUNGGAH di pengaturan portal
 * (bukan logo bawaan portal). Tanpa keduanya: "" = logo yang sudah tertanam di blangko ABT dipakai apa adanya (paket sampul-rapi-30okt
 * menanam logo monokrom satker yang sama, agar cetak langsung dari ABT pun berlogo).
 * Logo diubah satu bit (hitam pekat / putih) dengan cara cap (lib/logo-monokrom.ts) dari sumber resolusi penuh, diperkecil Lanczos ke
 * LEBAR_PX (lebih dari 600 dpi pada ukuran tampil ±1,7 cm) sebelum diambang - tidak kabur. Gagal membaca = "" (tidak pernah menggagalkan cetak).
 */

const LEBAR_PX = 640;
const singgahan = new Map<string, string>();

async function bacaBitaInstansi(logoUrl: string): Promise<Buffer | null> {
  const url = String(logoUrl || "").trim();
  if (!url || url === DEFAULT_INSTITUTION_LOGO_PATH || /mahkamah-agung-logo\.png/i.test(url)) return null;
  const data = url.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([a-z0-9+/=]+)$/i);
  if (data) return Buffer.from(data[1], "base64");
  const dalam = url.match(/\/api\/public\/institution\/logo\/([^?#/]+)/);
  if (dalam) {
    const berkas = await findStoredInstitutionLogoFile(decodeURIComponent(dalam[1]));
    const mentah = await readFile(berkas.absolutePath);
    return (await cleanInstitutionLogoWhiteCanvas(mentah, berkas.contentType)).buffer;
  }
  return null;
}

/** PNG satu bit (palet dua warna) dari bita logo; { png, lebar, tinggi, cara } atau null. */
export async function logoMonokrom(bita: Buffer): Promise<{ png: Buffer; lebar: number; tinggi: number; cara: "garis" | "otsu" } | null> {
  try {
    const sharp = (await import("sharp")).default;
    let dasar = sharp(bita).ensureAlpha();
    try {
      // potong tepi transparan/polos agar logo memenuhi kotaknya
      const potong = await dasar.clone().trim({ threshold: 10 }).png().toBuffer();
      dasar = sharp(potong).ensureAlpha();
    } catch {
      /* gambar polos: tanpa potong */
    }
    const { data, info } = await dasar.resize({ width: LEBAR_PX, kernel: "lanczos3", withoutEnlargement: false }).raw().toBuffer({ resolveWithObject: true });
    const mono = monokromTajam({ data: new Uint8Array(data.buffer, data.byteOffset, data.length), lebar: info.width, tinggi: info.height });
    const png = await sharp(Buffer.from(mono.data), { raw: { width: info.width, height: info.height, channels: 1 } }).png({ palette: true, colors: 2, compressionLevel: 9 }).toBuffer();
    return { png, lebar: info.width, tinggi: info.height, cara: mono.cara };
  } catch {
    return null;
  }
}

/** Grup gambar RTF logo satker aktif; "" = pakai logo yang tertanam di blangko. */
export async function bacaLogoKopRtf(db: AletaDatabase): Promise<string> {
  let bita: Buffer | null = null;
  let kunci = "";
  try {
    const aleta = await bacaLogoAleta(db);
    if (aleta && aleta.isi.length) {
      bita = aleta.isi;
      kunci = `satker:${createHash("md5").update(aleta.isi).digest("hex")}`;
    }
  } catch {
    bita = null;
  }
  if (!bita) {
    try {
      const url = String((await getInstitutionIdentityFromDb(db)).logoUrl ?? "");
      bita = await bacaBitaInstansi(url);
      kunci = bita ? `instansi:${createHash("md5").update(bita).digest("hex")}` : "";
    } catch {
      bita = null;
    }
  }
  if (!bita) return "";
  const ada = singgahan.get(kunci);
  if (ada !== undefined) return ada;
  const mono = await logoMonokrom(bita);
  const hasil = mono ? grupGambarPngRtf(mono.png, mono.lebar, mono.tinggi, LOGO_KOP_TINGGI_TWIP) : "";
  if (hasil) {
    if (singgahan.size > 8) singgahan.clear();
    singgahan.set(kunci, hasil);
  }
  return hasil;
}
