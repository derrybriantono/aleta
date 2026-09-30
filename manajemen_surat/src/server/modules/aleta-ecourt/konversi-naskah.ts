import { postGatewayKonversiNaskah } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * KONVERSI NASKAH - RTF / DOCX / DOC / PDF (kontrak K1, butir 8 dan 11)
 * ============================================================================
 *
 *   POST /api/aleta-ecourt/putusan/konversi-naskah  (multipart: berkas, ke)
 *   -> { berkasBase64, namaBerkas, mime, bentukAsal, peringatan: string[] }
 *
 * Perbaikan 30 September 2026. Putusan otomatis menerima DOCX, DOC, dan PDF -
 * bukan hanya RTF - dan anonimisasinya dibuat dalam BENTUK YANG SAMA dengan
 * edoc putusannya. Anonimisasi ABT hanya mengenal RTF; ekstensi karena itu
 * mengubah naskahnya ke RTF di sini, menganonimkannya di ABT, lalu
 * mengembalikannya ke bentuk asal lewat sini lagi.
 *
 * DUA MESIN, SATU PINTU
 *   RTF/DOC/DOCX -> apa saja : soffice di container bot (abtCetakService
 *                              dokumenKeBentuk - mesin yang sama dengan PDF
 *                              Direktori Putusan).
 *   PDF -> RTF               : EKSTRAKSI TEKS (pdfjs, baca-pdf.ts) menjadi
 *                              RTF berparagraf. soffice membuka PDF dengan
 *                              Draw, dan hasil RTF-nya bingkai gambar, bukan
 *                              naskah. Tata letak (tabel, kolom, kop, tanda
 *                              tangan) DAPAT BERUBAH - selalu disebut di
 *                              peringatan.
 *   PDF -> DOCX/DOC          : ekstraksi teks -> RTF -> soffice.
 *
 * Bentuk dikenali dari KEPALA BERKAS, bukan dari nama. Hanya menghitung - tidak
 * ada yang disimpan dan tidak ada tulisan ke SIPP/ABT, jadi orkestrator
 * ekstensi memasukkannya ke ALETA_COBA_BOLEH.
 */

export const BENTUK_NASKAH = ["rtf", "docx", "doc", "pdf"] as const;
export type BentukNaskah = (typeof BENTUK_NASKAH)[number];

export const BATAS_KONVERSI = 20 * 1024 * 1024;

export const MIME_NASKAH: Record<BentukNaskah, string> = {
  rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pdf: "application/pdf",
};

export const PERINGATAN_EKSTRAKSI_PDF =
  "PDF diubah lewat ekstraksi teks: tata letak (tabel, kolom, kop surat, tanda tangan, gambar) dapat berubah - periksa hasilnya sebelum dipakai.";

export function bentukNaskahSah(nilai: unknown): nilai is BentukNaskah {
  return typeof nilai === "string" && (BENTUK_NASKAH as readonly string[]).includes(nilai);
}

/** Sama dengan kenaliDokumen di bot - dari kepala berkasnya. */
export function kenaliBentukNaskah(bita: Uint8Array): BentukNaskah | "" {
  if (!bita || bita.length < 5) return "";
  const awal = String.fromCharCode(...Array.from(bita.subarray(0, 5)));
  if (awal.startsWith("%PDF-")) return "pdf";
  if (awal.startsWith("{\\rtf")) return "rtf";
  if (bita[0] === 0x50 && bita[1] === 0x4b && bita[2] === 0x03 && bita[3] === 0x04) return "docx";
  if (bita[0] === 0xd0 && bita[1] === 0xcf && bita[2] === 0x11 && bita[3] === 0xe0) return "doc";
  return "";
}

/** Satu karakter teks menjadi RTF: tanda khusus di-escape, di luar ASCII sebagai \uN?. */
function hurufRtf(kode: number, huruf: string) {
  if (huruf === "\\" || huruf === "{" || huruf === "}") return "\\" + huruf;
  if (huruf === "\t") return "\\tab ";
  if (kode < 0x20) return "";
  if (kode < 0x80) return huruf;
  // RTF memakai bilangan bertanda 16 bit untuk \u.
  const n = kode > 0x7fff ? kode - 0x10000 : kode;
  return `\\u${n}?`;
}

function barisRtf(baris: string) {
  let hasil = "";
  for (const huruf of baris) {
    const kode = huruf.codePointAt(0) ?? 0;
    if (kode > 0xffff) {
      // Di luar BMP: dua unit UTF-16, masing-masing \uN?.
      for (const unit of [...huruf].join("").split("")) hasil += hurufRtf(unit.charCodeAt(0), unit);
    } else {
      hasil += hurufRtf(kode, huruf);
    }
  }
  return hasil;
}

/**
 * Teks per halaman menjadi RTF: satu baris = satu paragraf, halaman dipisah
 * \page. Huruf Times New Roman 12 - huruf baku naskah putusan satker.
 */
export function teksKeRtf(halaman: string[]): string {
  const isi = halaman
    .map((teks) =>
      String(teks ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((b) => barisRtf(b) + "\\par")
        .join("\n")
    )
    .join("\n\\page\n");
  return "{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\n\\f0\\fs24\n" + isi + "\n}";
}

function namaHasil(namaBerkas: string, ke: BentukNaskah) {
  const dasar = String(namaBerkas || "naskah")
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.(rtf|docx?|pdf)$/i, "")
    .trim()
    .slice(0, 180);
  return `${dasar || "naskah"}.${ke}`;
}

function base64(bita: Uint8Array) {
  return Buffer.from(bita).toString("base64");
}

export type HasilKonversi = {
  berkasBase64: string;
  namaBerkas: string;
  mime: string;
  bentukAsal: BentukNaskah;
  peringatan: string[];
};

type Gerbang = typeof postGatewayKonversiNaskah;

async function lewatBot(gerbang: Gerbang, bita: Uint8Array, ke: BentukNaskah): Promise<Uint8Array> {
  const jawab = await gerbang({ berkasBase64: base64(bita), ke });
  if (!jawab.ok) {
    const status = jawab.status === 413 ? 413 : jawab.status === 422 ? 422 : 503;
    throw new ApiError(status, `Konversi di server gagal: ${jawab.error}`, jawab.kode ? { kode: jawab.kode } : undefined);
  }
  const hasil = Buffer.from(String(jawab.data.berkasBase64 || ""), "base64");
  if (kenaliBentukNaskah(hasil) !== ke) {
    throw new ApiError(502, `Server mengembalikan berkas yang bukan ${ke.toUpperCase()}.`);
  }
  return new Uint8Array(hasil);
}

export async function konversiNaskah(
  masukan: { bita: Uint8Array; namaBerkas: string; ke: unknown },
  deps: { gerbang?: Gerbang } = {}
): Promise<HasilKonversi> {
  const gerbang = deps.gerbang ?? postGatewayKonversiNaskah;
  const ke = String(masukan.ke ?? "").trim().toLowerCase();
  if (!bentukNaskahSah(ke)) {
    throw new ApiError(400, 'ke harus "rtf", "docx", "doc", atau "pdf".');
  }
  const bita = masukan.bita;
  if (!bita || bita.length === 0) throw new ApiError(400, "Berkasnya kosong.");
  if (bita.length > BATAS_KONVERSI) {
    throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_KONVERSI / 1024 / 1024} MB.`);
  }
  const bentukAsal = kenaliBentukNaskah(bita);
  if (!bentukAsal) {
    throw new ApiError(400, "Isinya bukan RTF, DOC, DOCX, maupun PDF - dikenali dari kepala berkasnya, bukan dari namanya.");
  }

  const peringatan: string[] = [];
  let hasil: Uint8Array;

  if (bentukAsal === ke) {
    hasil = bita;
  } else if (bentukAsal === "pdf") {
    const isi = await bacaPdfDariBita(bita, masukan.namaBerkas || "naskah.pdf");
    if (!isi.ada) throw new ApiError(422, `PDF tidak dapat dibaca: ${isi.sebab}`);
    const teks = isi.halaman.map((h) => h.teks);
    if (teks.every((t) => !t.trim())) {
      throw new ApiError(
        422,
        "PDF ini tidak memuat teks (kemungkinan hasil pindaian) - tidak ada yang dapat diubah menjadi naskah."
      );
    }
    peringatan.push(PERINGATAN_EKSTRAKSI_PDF);
    if (isi.halamanKosong.length > 0) {
      peringatan.push(`Halaman tanpa teks (kemungkinan pindaian): ${isi.halamanKosong.join(", ")}.`);
    }
    if (isi.jumlahHalaman > isi.halaman.length) {
      peringatan.push(`Hanya ${isi.halaman.length} dari ${isi.jumlahHalaman} halaman yang dibaca.`);
    }
    const rtf = new TextEncoder().encode(teksKeRtf(teks));
    hasil = ke === "rtf" ? rtf : await lewatBot(gerbang, rtf, ke);
  } else {
    hasil = await lewatBot(gerbang, bita, ke);
  }

  return {
    berkasBase64: base64(hasil),
    namaBerkas: namaHasil(masukan.namaBerkas, ke),
    mime: MIME_NASKAH[ke],
    bentukAsal,
    peringatan,
  };
}
