/**
 * ============================================================================
 * NAMA MENU BLANGKO DERRY DI ABT: LENGKAP, BUKAN SINGKATAN (19 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: kelompok "CG - BAS" di kotak "Pilih blangko" ekstensi harus bernama "Cerai Gugat - BAS" seperti
 * "Cerai Talak - BAS", dan semua nama menu Derry lain yang memakai sebutan ringkas ("Diska/DK", "HB", "Waris", "PAW/P3HP", ...)
 * ditulis lengkap. Yang berganti HANYA abt_menu.nama_alias (tulisan di bilah kiri ABT) lewat paket ABT
 * `abt-nama-menu-lengkap-derry`; folder di disk dan abt_menu.nama/direktori/hak TIDAK berganti.
 *
 * ABT yang belum dipasangi paket itu masih menyebut nama lama, dan paket ABT lama yang dipasang ulang menulis nama lama lagi, jadi
 * portal dan ekstensi menerima KEDUANYA. Sumber kebenaran pasangan ada di sini; cermin di ekstensi
 * (panel-alat.js ALAT_ALIAS_MENU_DERRY_AWALAN) dijaga src/test/nama-menu-lengkap-19okt.test.ts agar identik.
 */

/** [awalan lama, awalan lengkap] untuk pasangan menu "<awalan> - Putusan" dan "<awalan> - BAS". */
export const AWALAN_ALIAS_MENU_DERRY: ReadonlyArray<readonly [string, string]> = [
  ["CG", "Cerai Gugat"],
  ["CT", "Cerai Talak"],
  ["Cerai Kumulasi Itsbat", "Cerai Kumulasi Itsbat Nikah"],
  ["Itsbat", "Itsbat Nikah"],
  ["Diska/DK", "Dispensasi Kawin"],
  ["PAW/P3HP", "Penetapan Ahli Waris/Pertolongan Pembagian Harta Peninggalan"],
  ["HB", "Harta Bersama"],
  ["Waris", "Kewarisan"],
  ["IN Kontensius", "Itsbat Nikah Kontensius"],
  ["Poligami", "Izin Poligami"],
  ["CG Kumulasi Hak Asuh", "Cerai Gugat Kumulasi Hak Asuh Anak"],
  ["Hak Asuh", "Hak Asuh Anak (Hadhanah)"],
  ["Pembatalan Nikah", "Pembatalan Perkawinan"],
  ["Pencegahan Nikah", "Pencegahan Perkawinan"],
  ["ES Acara Biasa", "Ekonomi Syariah Acara Biasa"],
];

/** Alias menu Derry lama -> alias lengkap (tulisan persis seperti di abt_menu.nama_alias). */
export const ALIAS_MENU_DERRY_LAMA_KE_BARU: Readonly<Record<string, string>> = (() => {
  const peta: Record<string, string> = {};
  for (const [lama, baru] of AWALAN_ALIAS_MENU_DERRY) {
    for (const jenis of ["Putusan", "BAS"]) peta[`${lama} - ${jenis}`] = `${baru} - ${jenis}`;
  }
  peta["Relaas dan PBT"] = "Relaas dan Pemberitahuan Putusan";
  peta["Form PTSP"] = "Form Pelayanan Terpadu Satu Pintu (PTSP)";
  return peta;
})();

const rapi = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Alias lengkap untuk satu alias (lama atau lengkap); alias lain dipulangkan apa adanya. */
export function aliasMenuLengkap(alias: string): string {
  const r = rapi(alias);
  const sama = Object.keys(ALIAS_MENU_DERRY_LAMA_KE_BARU).find((k) => k.toLowerCase() === r.toLowerCase());
  return sama ? ALIAS_MENU_DERRY_LAMA_KE_BARU[sama] : r;
}

/**
 * Daftar alias yang diterima untuk satu menu: tiap alias beserta pasangannya (alias lama + alias lengkap), tanpa ganda.
 * Dipakai di rekomendasi blangko supaya ekstensi mengenali kelompok pada ABT sebelum maupun sesudah paket nama lengkap.
 */
export function perluasAliasMenu(daftar: readonly string[]): string[] {
  const hasil: string[] = [];
  const lihat = new Set<string>();
  const tambah = (x: string) => {
    const k = rapi(x).toLowerCase();
    if (!k || lihat.has(k)) return;
    lihat.add(k);
    hasil.push(rapi(x));
  };
  for (const a of daftar) {
    tambah(a);
    const lengkap = aliasMenuLengkap(a);
    tambah(lengkap);
    // pasangan lama dari alias lengkap (bila daftar sudah memuat yang lengkap saja)
    for (const [lama, baru] of Object.entries(ALIAS_MENU_DERRY_LAMA_KE_BARU)) if (baru.toLowerCase() === lengkap.toLowerCase()) tambah(lama);
  }
  return hasil;
}
