import { ApiError } from "@/server/shared/errors";

import { BATAS_KONVERSI, kenaliBentukNaskah } from "./konversi-naskah";
import { bacaItemPdf, susunBaris, type Baris } from "./pdf-bubuh-ttd";

/**
 * ============================================================================
 * TEKS PDF PER PARAGRAF UNTUK PEMERIKSA ISI e-Doc (30 Okt 2026, seret-lepas)
 * ============================================================================
 *
 * Pemeriksa sisa blangko (deteksi-sisa-blangko) bekerja atas paragraf. RTF dan DOCX terbaca langsung di peramban; PDF tidak (peramban
 * tidak punya pembaca PDF), jadi ekstensi mengirim PDF ke sini dan menerima teksnya sebagai paragraf. ATURANNYA tetap satu - dijalankan
 * ekstensi dengan deteksi-sisa-blangko.js yang sama dengan jendela e-Doc SIPP. Hanya MEMBACA: tidak ada yang disimpan atau ditulis ke SIPP.
 *
 * PARAGRAF dari LETAK baris (bukan dari tanda baca saja): kalimat yang terbungkus ke baris berikutnya digabung lagi (konteks sebelum
 * titik-titik harus utuh: "bertemu serta berbicara dengan / ......"), tetapi judul, "Nomor ...", baris tabel, dan akhir paragraf (baris
 * yang jelas lebih pendek dari lebar tulisan halaman itu) berdiri sendiri. Dengan begitu "RELAAS PANGGILAN / Nomor 531/..." tidak
 * menempel ke kalimat sesudahnya.
 */

export type ParagrafPdf = { teks: string; merah: Array<[number, number]>; halaman: number; nomor: number };
export type HasilBacaPdf = { ada: boolean; sebab: string; jumlahHalaman: number; halamanKosong: number[]; paragraf: ParagrafPdf[] };

const AKHIR_KALIMAT = /[.;:!?)]\s*$/;
const AWAL_BUTIR = /^\s*(?:\d{1,3}[.)]\s|[-•–]\s|[a-z][.)]\s)/;
/** Baris yang berhenti lebih dari bagian ini dari lebar tulisan sebelum tepi kanan = akhir paragraf. */
const BATAS_PENDEK = 0.22;
/** Sesudah tanda akhir kalimat, selisih sekecil ini dari tepi kanan sudah cukup untuk memulai paragraf baru. */
const BATAS_PENDEK_BERTITIK = 0.06;
const BATAS_CELAH_TEGAK = 1.7;

type BarisPos = Pick<Baris, "halaman" | "y" | "tinggi" | "teks"> & { kiri: number; kanan: number; kataAwal: number };

function posisi(b: Baris): BarisPos | null {
  const teks = b.teks.replace(/\s+/g, " ").trim();
  if (!teks) return null;
  let kiri = Infinity;
  let kanan = -Infinity;
  for (let i = 0; i < b.teks.length; i += 1) {
    if (/\s/.test(b.teks[i])) continue;
    kiri = Math.min(kiri, b.xAwal[i]);
    kanan = Math.max(kanan, b.xAkhir[i]);
  }
  if (!Number.isFinite(kiri) || !Number.isFinite(kanan)) return null;
  // Lebar kata pertama baris: kata yang tak muat di sisa baris sebelumnya (rangkaian titik panjang) memaksa pembungkusan lebih awal.
  let awalKata = -1;
  let akhirKata = -1;
  for (let i = 0; i < b.teks.length; i += 1) {
    if (/\s/.test(b.teks[i])) {
      if (awalKata >= 0) break;
      continue;
    }
    if (awalKata < 0) awalKata = i;
    akhirKata = i;
  }
  const kataAwal = awalKata >= 0 ? b.xAkhir[akhirKata] - b.xAwal[awalKata] : 0;
  return { halaman: b.halaman, y: b.y, tinggi: b.tinggi, teks, kiri, kanan, kataAwal };
}

/** Baris-baris (berurutan atas ke bawah, per halaman) -> paragraf. Murni. */
export function paragrafDariBarisPos(baris: Baris[]): Array<{ teks: string; halaman: number }> {
  const hasil: Array<{ teks: string; halaman: number }> = [];
  const per = new Map<number, BarisPos[]>();
  for (const b of baris) {
    const p = posisi(b);
    if (!p) continue;
    const d = per.get(p.halaman) ?? [];
    d.push(p);
    per.set(p.halaman, d);
  }
  let sekarang: { teks: string; halaman: number } | null = null;
  const tutup = () => {
    if (sekarang && sekarang.teks.trim()) hasil.push({ teks: sekarang.teks.trim(), halaman: sekarang.halaman });
    sekarang = null;
  };
  for (const halaman of Array.from(per.keys()).sort((a, b) => a - b)) {
    const daftar = per.get(halaman)!;
    const kiri = Math.min(...daftar.map((b) => b.kiri));
    const kanan = Math.max(...daftar.map((b) => b.kanan));
    const lebar = Math.max(1, kanan - kiri);
    daftar.forEach((b, i) => {
      const prev = i > 0 ? daftar[i - 1] : null;
      if (sekarang) {
        let putus = false;
        if (prev) {
          const kurang = (kanan - prev.kanan) / lebar;
          const celah = prev.y - b.y;
          const bertitik = AKHIR_KALIMAT.test(prev.teks);
          // Baris pendek = akhir paragraf, KECUALI kata pertama baris berikutnya memang tak muat di sisanya (pembungkusan biasa).
          const takMuat = !bertitik && prev.kanan + 0.3 * prev.tinggi + b.kataAwal > kanan + 0.01 * lebar;
          if (kurang > BATAS_PENDEK && !takMuat) putus = true;
          else if (bertitik && kurang > BATAS_PENDEK_BERTITIK) putus = true;
          else if (celah > BATAS_CELAH_TEGAK * Math.max(prev.tinggi, b.tinggi, 8)) putus = true;
          else if (bertitik && b.kiri - kiri > 0.025 * lebar) putus = true; // awal paragraf menjorok
        } else if (AKHIR_KALIMAT.test(sekarang.teks)) {
          putus = true; // halaman baru: lanjut hanya bila kalimat sebelumnya belum selesai
        }
        if (AWAL_BUTIR.test(b.teks)) putus = true;
        if (putus) tutup();
      }
      sekarang = sekarang ? { teks: `${sekarang.teks} ${b.teks}`, halaman: sekarang.halaman } : { teks: b.teks, halaman };
    });
  }
  tutup();
  return hasil;
}

export async function bacaPdfEdoc(bita: Uint8Array, namaBerkas: string): Promise<HasilBacaPdf> {
  void namaBerkas;
  if (!bita || bita.length === 0) throw new ApiError(400, "Berkasnya kosong.");
  if (bita.length > BATAS_KONVERSI) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_KONVERSI / 1024 / 1024} MB.`);
  if (kenaliBentukNaskah(bita) !== "pdf") throw new ApiError(400, "Berkas ini bukan PDF.");
  try {
    const { halaman, item } = await bacaItemPdf(bita);
    const baris = susunBaris(item);
    const ada = new Set(baris.map((b) => b.halaman));
    const halamanKosong = halaman.map((_h, i) => i + 1).filter((n) => !ada.has(n));
    const paragraf: ParagrafPdf[] = paragrafDariBarisPos(baris).map((p, i) => ({ teks: p.teks, merah: [], halaman: p.halaman, nomor: i + 1 }));
    return { ada: true, sebab: "", jumlahHalaman: halaman.length, halamanKosong, paragraf };
  } catch (galat) {
    return { ada: false, sebab: galat instanceof Error ? galat.message : "PDF tidak dapat diurai.", jumlahHalaman: 0, halamanKosong: [], paragraf: [] };
  }
}
