import { randomUUID } from "node:crypto";

import { gabungkanPdf } from "@/lib/gabung-pdf";
import {
  BATAS_BITA_BUTIR,
  BATAS_BITA_PEKERJAAN,
  BATAS_BITA_PERIKSA,
  BATAS_BUTIR,
  BATAS_PEKERJAAN_AKTIF,
  BATAS_TEMUAN_DIKIRIM,
  MASA_HASIL_MS,
  MASA_KUMPUL_MS,
  formatPekerjaanSah,
  namaBerkasAman,
  namaUnik,
  rtfBermula,
  type FormatPekerjaan,
} from "@/lib/berkas-pekerjaan";
import { periksaRtf, ringkasJenis, type Temuan } from "@/lib/deteksi-sisa-blangko";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayAbtPdf } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bacaKinerja } from "@/server/modules/aleta-ecourt/kinerja-ekstensi";
import { ApiError } from "@/server/shared/errors";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * PEKERJAAN BERKAS DI SERVER (K14, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Cetak massal Blangko Derry: peramban mengambil naskah RTF dari ABT (sesinya sendiri), mengirimnya satu per satu ke
 * sini, lalu menyuruh server bekerja. Server memeriksa sisa blangko tiap naskah, mengubah ke PDF lewat bot bila
 * diminta, menggabung / membungkus ZIP, dan menyimpan hasil jadi yang diunduh peramban. Peramban boleh ditutup
 * selagi server bekerja; hasil menunggu pemiliknya.
 *
 * ATURAN
 *   - Hanya bekerja bila Super Admin menyalakan saklar kinerja.berkasDiServer (mati bawaan: { tersedia: false }).
 *   - Semua milik pemanggil: pekerjaan orang lain tidak terlihat dan tidak terunduh (dijawab 404).
 *   - DATA: isi naskah memuat nama, alamat, dan NIK. Pekerjaan hidup HANYA di memori proses ini, paling lama
 *     MASA_HASIL_MS sesudah terakhir berubah (belum dimulai: MASA_KUMPUL_MS); tidak pernah ke disk atau basis data.
 *     Mulai ulang server melupakan semuanya - peramban lalu memakai jalur lama.
 *   - Tidak menulis apa pun ke SIPP atau ABT.
 */

export type StatusPekerjaan = "mengumpulkan" | "jalan" | "selesai" | "gagal";

type Butir = {
  nama: string;
  rtf: Buffer;
  temuan: Temuan[] | null;
  jumlahTemuan: number;
  ringkasTemuan: Array<{ jenis: string; label: string; jumlah: number }>;
  pdf: Uint8Array | null;
  galat: string;
};

export type Pekerjaan = {
  id: string;
  penggunaId: string;
  format: FormatPekerjaan;
  nama: string;
  status: StatusPekerjaan;
  butir: Butir[];
  bitaTotal: number;
  hasil: { nama: string; tipe: string; bita: Buffer; ringkasan: string } | null;
  galat: string;
  dibuat: number;
  diubah: number;
};

export type DepsPekerjaan = {
  konversiPdf: (rtf: Buffer) => Promise<{ ok: true; pdf: Uint8Array } | { ok: false; sebab: string }>;
  gabungPdf: (daftar: Uint8Array[]) => Promise<{ pdf: Uint8Array; halaman: number; gagal: number[] }>;
  sekarang: () => number;
};

export const depsAsli: DepsPekerjaan = {
  konversiPdf: async (rtf) => {
    const h = await getGatewayAbtPdf(rtf.toString("base64"));
    if (!h.ok) return { ok: false, sebab: h.error || "ALETA Bot belum dapat dihubungi." };
    const b64 = h.data?.pdfBase64 ?? "";
    if (!b64) return { ok: false, sebab: "Bot tidak mengirim PDF." };
    return { ok: true, pdf: new Uint8Array(Buffer.from(b64, "base64")) };
  },
  gabungPdf: gabungkanPdf,
  sekarang: () => Date.now(),
};

const kunciToko = "__aletaBerkasPekerjaan";
function toko(): Map<string, Pekerjaan> {
  const g = globalThis as unknown as Record<string, Map<string, Pekerjaan> | undefined>;
  return (g[kunciToko] ??= new Map());
}

export async function saklarBerkasNyala(db: AletaDatabase) {
  return (await bacaKinerja(db)).berkasDiServer === true;
}

/** Melupakan pekerjaan yang kedaluwarsa. Dipanggil di tiap pintu masuk. */
export function sapuPekerjaan(sekarang: number) {
  for (const [id, p] of toko()) {
    const umur = sekarang - p.diubah;
    if (umur > (p.status === "mengumpulkan" ? MASA_KUMPUL_MS : MASA_HASIL_MS)) toko().delete(id);
  }
}

function milik(penggunaId: string, id: unknown): Pekerjaan {
  const p = typeof id === "string" ? toko().get(id) : undefined;
  if (!p || p.penggunaId !== penggunaId) throw new ApiError(404, "Pekerjaan tidak ditemukan atau sudah kedaluwarsa.");
  return p;
}

export type RingkasPekerjaan = {
  id: string;
  format: FormatPekerjaan;
  nama: string;
  status: StatusPekerjaan;
  jumlahButir: number;
  selesaiButir: number;
  galat: string;
  ringkasan: string;
  dibuat: number;
  diubah: number;
  kedaluwarsa: number;
  hasil: { nama: string; tipe: string; ukuran: number } | null;
  /** Naskah yang masih berisi sisa blangko / perbaikan (diperiksa server). */
  perluDicek: Array<{ nama: string; jumlah: number; jenis: Array<{ jenis: string; label: string; jumlah: number }>; contoh: Array<{ label: string; cocok: string; sebelum: string; sesudah: string; halaman: number }> }>;
  gagal: Array<{ nama: string; sebab: string }>;
};

function ringkas(p: Pekerjaan): RingkasPekerjaan {
  return {
    id: p.id,
    format: p.format,
    nama: p.nama,
    status: p.status,
    jumlahButir: p.butir.length,
    selesaiButir: p.butir.filter((b) => b.temuan !== null || b.galat).length,
    galat: p.galat,
    ringkasan: p.hasil?.ringkasan ?? "",
    dibuat: p.dibuat,
    diubah: p.diubah,
    kedaluwarsa: p.diubah + (p.status === "mengumpulkan" ? MASA_KUMPUL_MS : MASA_HASIL_MS),
    hasil: p.hasil ? { nama: p.hasil.nama, tipe: p.hasil.tipe, ukuran: p.hasil.bita.length } : null,
    perluDicek: p.butir
      .filter((b) => b.jumlahTemuan > 0)
      .map((b) => ({
        nama: b.nama,
        jumlah: b.jumlahTemuan,
        jenis: b.ringkasTemuan,
        contoh: (b.temuan ?? []).slice(0, 3).map((t) => ({ label: t.label, cocok: t.cocok, sebelum: t.sebelum, sesudah: t.sesudah, halaman: t.halaman })),
      })),
    gagal: p.butir.filter((b) => b.galat).map((b) => ({ nama: b.nama, sebab: b.galat })),
  };
}

export async function buatPekerjaan(db: AletaDatabase, penggunaId: string, masukan: { format?: unknown; nama?: unknown }, deps: DepsPekerjaan = depsAsli) {
  if (!(await saklarBerkasNyala(db))) return { tersedia: false as const, alasan: "saklar-mati" as const };
  if (!formatPekerjaanSah(masukan.format)) throw new ApiError(400, 'Format harus "rtf" atau "pdf".');
  sapuPekerjaan(deps.sekarang());
  const aktif = [...toko().values()].filter((p) => p.penggunaId === penggunaId && (p.status === "mengumpulkan" || p.status === "jalan")).length;
  if (aktif >= BATAS_PEKERJAAN_AKTIF) throw new ApiError(429, `Masih ada ${aktif} pekerjaan berkas yang belum selesai; tunggu atau hapus dahulu.`);
  const sekarang = deps.sekarang();
  const p: Pekerjaan = {
    id: `bk-${randomUUID()}`,
    penggunaId,
    format: masukan.format,
    nama: namaBerkasAman(masukan.nama, "Cetak massal"),
    status: "mengumpulkan",
    butir: [],
    bitaTotal: 0,
    hasil: null,
    galat: "",
    dibuat: sekarang,
    diubah: sekarang,
  };
  toko().set(p.id, p);
  return {
    tersedia: true as const,
    id: p.id,
    batas: { butir: BATAS_BUTIR, bitaButir: BATAS_BITA_BUTIR, bitaTotal: BATAS_BITA_PEKERJAAN, masaMenit: Math.round(MASA_HASIL_MS / 60000) },
  };
}

export function tambahButir(penggunaId: string, id: unknown, masukan: { nama?: unknown; rtfBase64?: unknown }, sekarang = Date.now()) {
  const p = milik(penggunaId, id);
  if (p.status !== "mengumpulkan") throw new ApiError(409, "Pekerjaan sudah dimulai; naskah tidak dapat ditambah.");
  if (p.butir.length >= BATAS_BUTIR) throw new ApiError(400, `Paling banyak ${BATAS_BUTIR} naskah sekali jalan.`);
  const b64 = typeof masukan.rtfBase64 === "string" ? masukan.rtfBase64 : "";
  if (!b64) throw new ApiError(400, "Naskah RTF tidak terkirim.");
  const rtf = Buffer.from(b64, "base64");
  if (!rtf.length || !rtfBermula(rtf)) throw new ApiError(400, "Naskah bukan RTF yang sah.");
  if (rtf.length > BATAS_BITA_BUTIR) throw new ApiError(413, "Naskah terlalu besar.");
  if (p.bitaTotal + rtf.length > BATAS_BITA_PEKERJAAN) throw new ApiError(413, "Jumlah naskah terlalu besar untuk satu pekerjaan.");
  p.bitaTotal += rtf.length;
  p.butir.push({ nama: namaBerkasAman(masukan.nama, `naskah-${p.butir.length + 1}.rtf`), rtf, temuan: null, jumlahTemuan: 0, ringkasTemuan: [], pdf: null, galat: "" });
  p.diubah = sekarang;
  return { jumlahButir: p.butir.length };
}

/** Mulai bekerja (asinkron). Pulang segera; keadaan dibaca lewat statusPekerjaan. */
export function mulaiPekerjaan(penggunaId: string, id: unknown, deps: DepsPekerjaan = depsAsli) {
  const p = milik(penggunaId, id);
  if (p.status !== "mengumpulkan") throw new ApiError(409, "Pekerjaan sudah dimulai.");
  if (!p.butir.length) throw new ApiError(400, "Belum ada naskah yang dikirim.");
  p.status = "jalan";
  p.diubah = deps.sekarang();
  const kerja = jalankanPekerjaan(p, deps);
  void kerja.catch(() => undefined);
  return { ...ringkas(p), selesai: kerja };
}

/** Isi pekerjaan. Tidak pernah melempar: kegagalan jadi status "gagal" dengan sebab. Diekspor untuk uji. */
export async function jalankanPekerjaan(p: Pekerjaan, deps: DepsPekerjaan = depsAsli): Promise<void> {
  try {
    for (const b of p.butir) {
      try {
        const h = periksaRtf(new TextDecoder("windows-1252").decode(b.rtf));
        b.temuan = h.temuan;
        b.jumlahTemuan = h.temuan.length;
        b.ringkasTemuan = ringkasJenis(h.temuan).map((r) => ({ jenis: r.jenis, label: r.label, jumlah: r.jumlah }));
        if (b.temuan.length > BATAS_TEMUAN_DIKIRIM) b.temuan = b.temuan.slice(0, BATAS_TEMUAN_DIKIRIM);
      } catch {
        b.temuan = [];
      }
      if (p.format === "pdf") {
        const k = await deps.konversiPdf(b.rtf).catch((e: unknown) => ({ ok: false as const, sebab: e instanceof Error ? e.message : "konversi gagal" }));
        if (k.ok) b.pdf = k.pdf;
        else b.galat = k.sebab;
      }
      p.diubah = deps.sekarang();
    }
    const berhasil = p.butir.filter((b) => (p.format === "pdf" ? b.pdf : true));
    if (!berhasil.length) {
      p.status = "gagal";
      p.galat = p.butir.find((b) => b.galat)?.galat || "Tidak ada naskah yang dapat diproses.";
      p.diubah = deps.sekarang();
      return;
    }
    const perluDicek = p.butir.filter((b) => b.jumlahTemuan > 0).length;
    const gagal = p.butir.filter((b) => b.galat).length;
    const tambahan = `${perluDicek ? ` ${perluDicek} naskah masih berisi sisa blangko/perbaikan (lihat daftar).` : ""}${gagal ? ` ${gagal} gagal diproses.` : ""}`;
    if (p.format === "pdf") {
      const gab = await deps.gabungPdf(berhasil.map((b) => b.pdf as Uint8Array));
      const gagalGabung = gab.gagal.map((i) => berhasil[i]).filter(Boolean);
      for (const b of gagalGabung) b.galat = "PDF rusak, tidak dapat digabung.";
      p.hasil = {
        nama: `${p.nama}.pdf`,
        tipe: "application/pdf",
        bita: Buffer.from(gab.pdf),
        ringkasan: `${berhasil.length - gagalGabung.length} naskah digabung menjadi satu PDF (${gab.halaman} halaman).${tambahan}`,
      };
    } else {
      const dipakai = new Set<string>();
      const zip = susunZip(
        berhasil.map((b) => ({ nama: namaUnik(/\.rtf$/i.test(b.nama) ? b.nama : `${b.nama}.rtf`, dipakai), isi: b.rtf }))
      );
      p.hasil = { nama: `${p.nama}.zip`, tipe: "application/zip", bita: zip, ringkasan: `${berhasil.length} naskah RTF dalam satu ZIP.${tambahan}` };
    }
    // Naskah mentah tidak dipegang lebih lama dari perlu: setelah hasil jadi hanya hasil yang tinggal.
    for (const b of p.butir) {
      b.rtf = Buffer.alloc(0);
      b.pdf = null;
    }
    p.status = "selesai";
    p.diubah = deps.sekarang();
  } catch (galat) {
    p.status = "gagal";
    p.galat = galat instanceof Error ? galat.message : "Pekerjaan gagal.";
    p.diubah = deps.sekarang();
  }
}

export function statusPekerjaan(penggunaId: string, id: unknown, sekarang = Date.now()): RingkasPekerjaan {
  sapuPekerjaan(sekarang);
  return ringkas(milik(penggunaId, id));
}

export function daftarPekerjaan(penggunaId: string, sekarang = Date.now()): RingkasPekerjaan[] {
  sapuPekerjaan(sekarang);
  return [...toko().values()]
    .filter((p) => p.penggunaId === penggunaId)
    .sort((a, b) => b.diubah - a.diubah)
    .map(ringkas);
}

export function ambilHasil(penggunaId: string, id: unknown, sekarang = Date.now()) {
  sapuPekerjaan(sekarang);
  const p = milik(penggunaId, id);
  if (p.status !== "selesai" || !p.hasil) throw new ApiError(409, "Hasil belum siap.");
  return p.hasil;
}

export function hapusPekerjaan(penggunaId: string, id: unknown) {
  const p = milik(penggunaId, id);
  toko().delete(p.id);
  return { dihapus: true };
}

/** Hanya untuk uji. */
export function kosongkanPekerjaanUntukUji() {
  toko().clear();
}

/**
 * Pemeriksa sisa blangko SATU naskah RTF (K14). Hasilnya berbentuk sama dengan periksaBita() di ekstensi
 * ({ dibaca, hasil: { temuan, jumlahParagraf, jumlahHalaman, terpotong } }) supaya ekstensi dapat memakainya
 * di tempat pemeriksa lokal. Hanya RTF; bentuk lain dijawab dibaca:false dan ekstensi memeriksa sendiri.
 */
export async function periksaSisaRtf(db: AletaDatabase, masukan: { rtfBase64?: unknown }) {
  if (!(await saklarBerkasNyala(db))) return { tersedia: false as const, alasan: "saklar-mati" as const };
  const b64 = typeof masukan.rtfBase64 === "string" ? masukan.rtfBase64 : "";
  if (!b64) throw new ApiError(400, "Naskah RTF tidak terkirim.");
  const rtf = Buffer.from(b64, "base64");
  if (!rtf.length || rtf.length > BATAS_BITA_PERIKSA) throw new ApiError(413, "Naskah kosong atau terlalu besar.");
  if (!rtfBermula(rtf)) return { tersedia: true as const, dibaca: false as const, hasil: null };
  return { tersedia: true as const, dibaca: true as const, hasil: periksaRtf(new TextDecoder("windows-1252").decode(rtf)) };
}
