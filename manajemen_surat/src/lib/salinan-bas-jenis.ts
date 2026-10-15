/**
 * ============================================================================
 * SALINAN BAS DI FOLDER BAS PASANGAN - petunjuk untuk tombol "Buka di ABT" (F3, 14 Okt 2026; disesuaikan K3 15 Okt 2026)
 * ============================================================================
 *
 * K3 15 Okt: keputusan "satu folder" diganti susunan berpasangan - salinan BAS berada di folder "<folder putusan> - BAS"
 * (mis. "1 Perceraian CG - BAS", menu "Cerai Gugat - BAS" / alias "CG - BAS"); folder putusan tidak lagi memuat BAS.
 * Isi tabel di bawah sudah memakai folder & menu BAS itu. Teks selanjutnya menggambarkan asal-usul paket A3 (14 Okt).
 *
 * Paket ABT abt-susunan-satu-folder (keputusan pengguna 14 Okt: "putusan dan BAS satu folder per jenis") menyalin 233
 * BAS ke folder jenis dan menyembunyikan menu ALUR 960-972, 945, 946. Token ABT berkas ALUR tidak lagi dapat dipanen
 * dari halaman ABT; yang tampil di ABT adalah SALINANNYA di menu "Putusan <jenis>". Hak ABT per jenis: folder CG
 * ditolak ABT bagi perkara CT - karena itu salinan yang dikirim ke ekstensi HANYA yang foldernya cocok dengan jenis
 * perkara barisnya, beserta nama menu (kunci kelompok di ABT). Jenis tidak terbaca = tidak ada petunjuk (tidak menebak).
 *
 * Tiga jalur sumber, semuanya berujung pada tabel yang sama (salinan-bas-jenis-data.ts):
 *   1. berkas ALUR / kumulasi / itsbat gugur-cabut langsung (folder yang dibaca katalog BAS massal sekarang);
 *   2. berkas folder lama "- BAS VERSTEK PERCERAIAN -" dst. -> padanan ALUR (PADANAN_BAS_ARSIP) -> salinannya;
 *   3. berkas yang sudah berupa salinan ("BAS ALUR nn ...") di folder jenis: dirinya sendiri.
 */
import { PADANAN_BAS_ARSIP } from "@/lib/alur-bas";
import { AKAR_SALINAN_BAS, MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";

export type SalinanBas = {
  /** Jalur relatif _blangko_abt, mis. "derry_briantono/1 Perceraian CG - BAS". */
  folder: string;
  /** Nama berkas salinan (dengan .rtf), mis. "BAS ALUR 04 [2] BAS 2 P & T Hadir - ....rtf". */
  berkas: string;
  /** abt_menu.nama folder BAS itu ("Cerai Gugat - BAS") - nama kelompok di ABT. */
  menu: string;
  /** abt_menu.nama_alias ("CG - BAS"). */
  alias: string;
};

/** Awalan nama berkas salinan menurut folder sumbernya; null bila folder itu bukan sumber salinan. */
export function awalanSalinanBas(folderSumber: string): string | null {
  const f = String(folderSumber || "").trim();
  const m = f.match(/^ALUR\s+(\d+)\b/i);
  if (m) return `BAS ALUR ${m[1]} `;
  if (f === "BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)") return "BAS KUMULASI ";
  if (f === "BAS Itsbat Nikah Gugur dan Cabut") return "BAS IN GUGUR CABUT ";
  return null;
}

function tanpaAkar(folder: string): string {
  const f = String(folder || "").trim().replace(/\\/g, "/");
  return f.startsWith(`${AKAR_SALINAN_BAS}/`) ? f.slice(AKAR_SALINAN_BAS.length + 1) : f;
}

const denganRtf = (b: string) => (/\.rtf$/i.test(b) ? b : `${b}.rtf`);

/** Semua salinan satu berkas sumber, TANPA penyaringan jenis perkara (dipakai uji dan penyaring di bawah). */
export function semuaSalinanBas(folder: string, berkas: string): SalinanBas[] {
  const f = tanpaAkar(folder);
  const b = denganRtf(String(berkas || "").trim());
  const sumber: Array<[string, string]> = [[f, b]];
  // Folder lama (menu BAS 951-955 tersembunyi) -> padanan ALUR -> salinan.
  for (const p of PADANAN_BAS_ARSIP[`${AKAR_SALINAN_BAS}/${f}/${b}`] ?? []) sumber.push([tanpaAkar(p.folder), denganRtf(p.berkas)]);
  const hasil: SalinanBas[] = [];
  const lihat = new Set<string>();
  for (const [fs, bs] of sumber) {
    const tujuan = SALINAN_BAS_JENIS[fs]?.[bs];
    const awalan = awalanSalinanBas(fs);
    if (!tujuan || !awalan) continue;
    for (const ft of tujuan) {
      const menu = MENU_FOLDER_JENIS[ft];
      if (!menu) continue;
      const kunci = `${ft}/${awalan}${bs}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      hasil.push({ folder: `${AKAR_SALINAN_BAS}/${ft}`, berkas: `${awalan}${bs}`, menu: menu.nama, alias: menu.alias });
    }
  }
  return hasil;
}

/** Folder jenis ini melayani jenis perkara itu? Dicocokkan dengan kata kunci jenis perkara dari NAMA folder (tugas-blangko). */
export function folderJenisCocok(folderJenis: string, jenisPerkara: string): boolean {
  const j = String(jenisPerkara || "").toLowerCase();
  if (!j.trim()) return false;
  return jenisPerkaraDariFolder(tanpaAkar(folderJenis)).untuk.some((kata) => j.includes(kata));
}

/**
 * Salinan BAS di folder jenis yang SESUAI jenis perkara - [] bila jenis tidak terbaca atau tak satu pun folder jenis
 * yang cocok (ekstensi lalu memakai jalur lama; tidak menebak folder CG untuk perkara CT).
 */
export function salinanBasJenis(folder: string, berkas: string, jenisPerkara: string): SalinanBas[] {
  return semuaSalinanBas(folder, berkas).filter((s) => folderJenisCocok(s.folder, jenisPerkara));
}
