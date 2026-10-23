/**
 * ============================================================================
 * PILIHAN TEMA PORTAL: TERANG, GELAP, ATAU IKUTI SISTEM - SATU SUMBER
 * ============================================================================
 *
 * Yang dilaporkan: tombol tema kadang tidak berubah atau berubah ke
 * kebalikannya, "ikuti sistem" tampil terbalik, dan pindah halaman membuat
 * warna berkedip gelap-terang.
 *
 * SEBAB DI SISI PORTAL (sebelum berkas ini)
 *
 *   1. Pilihan hidup di state React (`theme`) DAN ditulis ke localStorage oleh
 *      efek `persistState` tiap state apa pun berubah. Tab portal lain yang
 *      sedang terbuka (apalagi di latar, dengan sinkronisasi berkala) menulis
 *      `theme` MILIKNYA yang basi ke penyimpanan yang sama - pilihan yang baru
 *      diambil tertimpa diam-diam, dan baru ketahuan di pemuatan berikutnya.
 *   2. Tidak ada pendengar `storage`: tab lain tidak pernah tahu.
 *   3. Skrip awal di layout menerapkan kelas `dark` dari localStorage, lalu
 *      ekstensi "menyamakan" portal dengan chrome.storage yang bisa basi, dan
 *      React menerapkan ulang: tiga penulis kelas `dark`, tiga kemungkinan
 *      hasil, dengan transisi 300 ms di body yang membuat tiap koreksi tampak
 *      sebagai kedip.
 *   4. Tidak ada "ikuti sistem" sama sekali; dua keadaan dipetakan ke dua
 *      keadaan.
 *
 * ATURAN DI SINI
 *
 *   - Tiga pilihan: terang | gelap | sistem. Disimpan di SATU kunci,
 *     `aleta-tema-pilihan`, berbentuk "pilihan|waktu" - kunci yang SAMA yang
 *     dipakai ekstensi di SIPP dan ABT (satu origin), jadi ketiga aplikasi
 *     berbagi satu salinan. Yang lebih baru menang; yang disalin ke tempat lain
 *     disalin APA ADANYA, sehingga penerima mendapati keadaannya sudah sama
 *     dan tidak menulis balik (itulah pemutus ping-pong).
 *   - "Sistem" diuraikan di jendela halaman lewat matchMedia dan dipantau
 *     perubahannya.
 *   - Diterapkan SEBELUM lukis pertama oleh skrip awal (lihat
 *     tema-skrip-awal.ts), tanpa menunggu React. Setelah itu React hanya
 *     MENGIKUTI salinan: tidak ada tulisan atribut berlawanan berturut-turut.
 *   - Setiap pergantian dilakukan dengan transisi dimatikan sesaat.
 *   - Nilai lama dipetakan, tidak dihapus: `portal-terpadu-pa-v2.theme`
 *     (light/dark) menjadi pilihan dengan waktu 0.
 *   - Pilihan HANYA ditulis oleh tindakan pengguna (aturPilihanTema); mengikuti
 *     tab lain atau ekstensi tidak pernah menulis ulang waktunya.
 *
 * Ekstensi (tema-pusat.js) menjembatani salinan ini dengan chrome.storage
 * (popup) lewat atribut `data-aleta-tema-salinan` di <html>: portal menuliskan
 * "pilihan|waktu" di sana, ekstensi mengamatinya.
 */

export type PilihanTema = "terang" | "gelap" | "sistem";
export type TemaTerurai = "terang" | "gelap";
export type ModeTampilan = "light" | "dark" | "system";

export interface KeadaanTema {
  pilihan: PilihanTema;
  waktu: number;
}

export const KUNCI_SALINAN_TEMA = "aleta-tema-pilihan";
export const ATRIBUT_SALINAN_TEMA = "data-aleta-tema-salinan";
export const ATRIBUT_TEMA_TERURAI = "data-aleta-tema";
export const KUNCI_PORTAL_LAMA = "portal-terpadu-pa-v2";
export const KELAS_TANPA_TRANSISI = "aleta-ganti-tema";
export const PERISTIWA_EKSTENSI_TEMA = "aleta-ekstensi-tema";

const DAFTAR_PILIHAN: readonly PilihanTema[] = ["terang", "gelap", "sistem"];
const BAWAAN: KeadaanTema = { pilihan: "gelap", waktu: 0 };

export function apakahPilihanTema(nilai: unknown): nilai is PilihanTema {
  return typeof nilai === "string" && (DAFTAR_PILIHAN as readonly string[]).includes(nilai);
}

/** "gelap|1729700000000" -> keadaan; selain itu null. */
export function uraiSalinanTema(teks: string | null | undefined): KeadaanTema | null {
  const cocok = /^(terang|gelap|sistem)\|(\d{1,15})$/.exec(String(teks ?? ""));
  return cocok ? { pilihan: cocok[1] as PilihanTema, waktu: Number(cocok[2]) } : null;
}

export function susunSalinanTema(keadaan: KeadaanTema): string {
  return `${keadaan.pilihan}|${keadaan.waktu}`;
}

export function resolusiTema(pilihan: PilihanTema, sistemGelap: boolean): TemaTerurai {
  if (pilihan === "sistem") return sistemGelap ? "gelap" : "terang";
  return pilihan === "terang" ? "terang" : "gelap";
}

export function pilihanKeMode(pilihan: PilihanTema): ModeTampilan {
  return pilihan === "terang" ? "light" : pilihan === "sistem" ? "system" : "dark";
}

export function modeKePilihan(mode: ModeTampilan | string): PilihanTema {
  return mode === "light" ? "terang" : mode === "system" ? "sistem" : "gelap";
}

/** Tampilan sistem. Tidak dapat ditanyakan: bawaan produk (gelap). */
export function sistemGelap(): boolean {
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches === true;
    }
  } catch {
    /* jatuh ke bawaan */
  }
  return true;
}

function penyimpananHalaman(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Keadaan tersimpan: salinan baru, lalu nilai lama portal, lalu bawaan.
 * Nilai lama (light/dark) dibaca hanya bila penanda "default gelap" sudah
 * ada - persis perilaku skrip awal sebelumnya - dan dipetakan dengan waktu 0.
 */
export function bacaKeadaanTersimpan(penyimpanan: Pick<Storage, "getItem"> | null = penyimpananHalaman()): KeadaanTema {
  if (!penyimpanan) return { ...BAWAAN };
  try {
    const baru = uraiSalinanTema(penyimpanan.getItem(KUNCI_SALINAN_TEMA));
    if (baru) return baru;
    if (penyimpanan.getItem("aleta:theme-default-dark-v1") === "1") {
      const mentah = penyimpanan.getItem(KUNCI_PORTAL_LAMA) || penyimpanan.getItem("portal-terpadu-pa-v1");
      if (mentah) {
        const lama = JSON.parse(mentah) as { theme?: unknown } | null;
        if (lama && lama.theme === "light") return { pilihan: "terang", waktu: 0 };
        if (lama && lama.theme === "dark") return { pilihan: "gelap", waktu: 0 };
      }
    }
  } catch {
    /* penyimpanan rusak: bawaan */
  }
  return { ...BAWAAN };
}

// ─── Penerapan ke <html> ─────────────────────────────────────────────────────

function pasangAtribut(el: Element, nama: string, nilai: string) {
  if (el.getAttribute(nama) !== nilai) el.setAttribute(nama, nilai);
}

/** Mematikan transisi warna sesaat (dua bingkai) selama `kerjakan` berjalan. */
export function tanpaTransisiSesaat(kerjakan: () => void) {
  if (typeof document === "undefined") {
    kerjakan();
    return;
  }
  const akar = document.documentElement;
  akar.classList.add(KELAS_TANPA_TRANSISI);
  try {
    kerjakan();
  } finally {
    const lepas = () => akar.classList.remove(KELAS_TANPA_TRANSISI);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(lepas));
    } else {
      setTimeout(lepas, 50);
    }
  }
}

/**
 * Menerapkan satu keadaan ke <html>: kelas `dark` (hanya bila berbeda),
 * atribut tema terurai, dan atribut salinan untuk jembatan ekstensi. Tidak
 * menulis apa pun yang sudah benar.
 */
export function terapkanTemaKeAkar(keadaan: KeadaanTema): TemaTerurai {
  const tema = resolusiTema(keadaan.pilihan, sistemGelap());
  if (typeof document === "undefined") return tema;
  const akar = document.documentElement;
  const gelap = tema === "gelap";
  const ubah = () => {
    if (akar.classList.contains("dark") !== gelap) akar.classList.toggle("dark", gelap);
  };
  if (akar.classList.contains("dark") !== gelap) tanpaTransisiSesaat(ubah);
  pasangAtribut(akar, ATRIBUT_TEMA_TERURAI, tema);
  pasangAtribut(akar, ATRIBUT_SALINAN_TEMA, susunSalinanTema(keadaan));
  return tema;
}

// ─── Penyimpanan keadaan (satu per halaman) ─────────────────────────────────

let keadaanSekarang: KeadaanTema = { ...BAWAAN };
const pelanggan = new Set<() => void>();

export function ambilKeadaanTema(): KeadaanTema {
  return keadaanSekarang;
}

export function berlanggananTema(fn: () => void): () => void {
  pelanggan.add(fn);
  return () => {
    pelanggan.delete(fn);
  };
}

function umumkan() {
  for (const fn of Array.from(pelanggan)) {
    try {
      fn();
    } catch {
      /* satu pelanggan yang gagal tidak mematikan yang lain */
    }
  }
}

function adopsi(baru: KeadaanTema): boolean {
  if (baru.pilihan === keadaanSekarang.pilihan && baru.waktu === keadaanSekarang.waktu) return false;
  keadaanSekarang = { pilihan: baru.pilihan, waktu: baru.waktu };
  return true;
}

/**
 * Mengikuti salinan di localStorage: ditulis tab lain atau ekstensi, atau
 * dibaca pertama kali. TIDAK menulis penyimpanan. Mengembalikan true bila
 * keadaannya berubah.
 */
export function selaraskanDariSalinan(): boolean {
  const tersimpan = bacaKeadaanTersimpan();
  const berubah = adopsi(tersimpan);
  terapkanTemaKeAkar(keadaanSekarang);
  if (berubah) umumkan();
  return berubah;
}

/** Pilihan diambil pengguna. Pilihan yang sama dengan yang berlaku diabaikan. */
export function aturPilihanTema(pilihan: PilihanTema) {
  if (!apakahPilihanTema(pilihan) || pilihan === keadaanSekarang.pilihan) return;
  const baru: KeadaanTema = { pilihan, waktu: Math.max(Date.now(), keadaanSekarang.waktu + 1) };
  keadaanSekarang = baru;
  const penyimpanan = penyimpananHalaman();
  if (penyimpanan) {
    try {
      penyimpanan.setItem(KUNCI_SALINAN_TEMA, susunSalinanTema(baru));
    } catch {
      /* temanya tetap berlaku di halaman ini */
    }
  }
  terapkanTemaKeAkar(baru);
  umumkan();
}

/**
 * Memasang pendengar sepanjang umur provider: peristiwa storage (tab lain),
 * perubahan tampilan sistem, dan permintaan ekstensi. Mengembalikan pembersih.
 */
export function mulaiTemaPortal(): () => void {
  if (typeof window === "undefined") return () => undefined;
  // Pemasangan awal (hidrasi) tanpa transisi: bila skrip awal tidak sempat
  // berjalan atau salinan berubah di antaranya, koreksinya tidak tampak
  // sebagai kedip 300 ms.
  tanpaTransisiSesaat(() => {
    selaraskanDariSalinan();
  });

  const saatStorage = (peristiwa: StorageEvent) => {
    if (peristiwa.key === KUNCI_SALINAN_TEMA) selaraskanDariSalinan();
  };
  window.addEventListener("storage", saatStorage);

  // Ekstensi menulis salinan (yang lebih baru: dari popup atau tab SIPP/ABT)
  // lalu memberi tahu lewat peristiwa ini. Salinan itulah kebenarannya;
  // detail hanya dibaca bila ekstensi LAMA mengirim satu kata saja.
  const saatEkstensi = (peristiwa: Event) => {
    const rinci = (peristiwa as CustomEvent<{ pilihan?: unknown; tema?: unknown }>).detail;
    const adaPilihan = rinci && typeof rinci === "object" && apakahPilihanTema((rinci as { pilihan?: unknown }).pilihan);
    if (!adaPilihan && rinci && typeof rinci === "object") {
      const lama = String((rinci as { tema?: unknown }).tema ?? "");
      if (lama === "gelap" || lama === "terang") {
        aturPilihanTema(lama);
        return;
      }
    }
    selaraskanDariSalinan();
  };
  window.addEventListener(PERISTIWA_EKSTENSI_TEMA, saatEkstensi);

  let pemantau: MediaQueryList | null = null;
  const saatSistemBerganti = () => {
    if (keadaanSekarang.pilihan === "sistem") {
      terapkanTemaKeAkar(keadaanSekarang);
      umumkan();
    }
  };
  try {
    if (typeof window.matchMedia === "function") {
      pemantau = window.matchMedia("(prefers-color-scheme: dark)");
      if (typeof pemantau.addEventListener === "function") pemantau.addEventListener("change", saatSistemBerganti);
      else if (typeof pemantau.addListener === "function") pemantau.addListener(saatSistemBerganti);
    }
  } catch {
    pemantau = null;
  }

  return () => {
    window.removeEventListener("storage", saatStorage);
    window.removeEventListener(PERISTIWA_EKSTENSI_TEMA, saatEkstensi);
    if (pemantau) {
      if (typeof pemantau.removeEventListener === "function") pemantau.removeEventListener("change", saatSistemBerganti);
      else if (typeof pemantau.removeListener === "function") pemantau.removeListener(saatSistemBerganti);
    }
  };
}

/** Hanya untuk uji: mengembalikan penyimpanan modul ke awal. */
export function setelUlangTemaUntukUji() {
  keadaanSekarang = { ...BAWAAN };
  pelanggan.clear();
}
