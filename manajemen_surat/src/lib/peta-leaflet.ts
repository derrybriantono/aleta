import { withBasePath } from "@/lib/base-path";

/**
 * ============================================================================
 * LEAFLET DIMUAT DARI PELADEN SENDIRI, BUKAN DARI CDN DAN BUKAN DARI npm
 * ============================================================================
 *
 * Dari peladen sendiri, sebab pengadilan ini bekerja di jaringan yang tidak
 * selalu punya jalan keluar. Pustaka peta yang dipanggil dari CDN akan membuat
 * halaman Peta Perkara gagal total di hari jaringan luar mati - dan gagalnya
 * berupa layar kosong tanpa sebab yang tertulis.
 *
 * Bukan dari npm, sebab ia hanya dipakai satu halaman. Menambahkannya sebagai
 * kebergantungan berarti ia ikut ditimbang pada tiap build, ikut masuk ke
 * berkas bundel, dan ikut menjadi urusan tiap kali `npm ci` dijalankan di
 * peladen. Cara yang sudah dipakai berkas ini sejak lama - pdf.js di
 * `public/vendor/pdfjs` - berlaku sama baiknya di sini.
 *
 * Yang TIDAK dapat dibawa ke dalam peladen adalah UBINAN PETANYA: gambar peta
 * jalan itu berjumlah jutaan dan berasal dari luar. Halaman ini karena itu
 * tetap menuntut peramban petugas punya jalan ke penyedia ubin - dan bila
 * tidak ada, petanya berkata begitu alih-alih diam.
 */

/** Yang dipakai dari Leaflet - sengaja sempit, bukan `any` yang menelan salah ketik. */
export type PetaLeaflet = {
  map: (el: HTMLElement, opsi?: Record<string, unknown>) => PetaObjek;
  tileLayer: (url: string, opsi?: Record<string, unknown>) => PetaLapisan;
  canvas: (opsi?: Record<string, unknown>) => unknown;
  circleMarker: (
    posisi: [number, number],
    opsi?: Record<string, unknown>
  ) => PetaTitik;
  /** Lingkaran berjari-jari METER - dipakai cincin jarak, bukan penanda titik. */
  circle: (posisi: [number, number], opsi?: Record<string, unknown>) => PetaTitik;
  layerGroup: () => PetaKumpulan;
  latLngBounds: (titik: [number, number][]) => PetaBatas;
  control: { attribution: (opsi?: Record<string, unknown>) => PetaLapisan };
};

export type PetaObjek = {
  setView: (posisi: [number, number], zum: number) => PetaObjek;
  fitBounds: (batas: PetaBatas, opsi?: Record<string, unknown>) => PetaObjek;
  remove: () => void;
  invalidateSize: () => void;
  getZoom: () => number;
  on: (peristiwa: string, tangani: () => void) => void;
  off: (peristiwa: string, tangani: () => void) => void;
  /**
   * Panel gambar tersendiri.
   *
   * Dipakai TIRAI pembanding: dua panel terpisah dapat digunting sisi luarnya
   * sendiri-sendiri, sedangkan ubinan dan cincin jarak tinggal di panel bawaan
   * dan karena itu tidak ikut tergunting.
   */
  createPane: (nama: string) => HTMLElement;
  getPane: (nama: string) => HTMLElement | undefined;
};

export type PetaLapisan = { addTo: (peta: PetaObjek) => PetaLapisan };
export type PetaKumpulan = {
  addTo: (peta: PetaObjek) => PetaKumpulan;
  clearLayers: () => void;
  addLayer: (lapis: unknown) => void;
};
export type PetaTitik = {
  addTo: (kumpulan: PetaKumpulan) => PetaTitik;
  bindTooltip: (isi: string, opsi?: Record<string, unknown>) => PetaTitik;
  bindPopup: (isi: string, opsi?: Record<string, unknown>) => PetaTitik;
  setStyle: (gaya: Record<string, unknown>) => PetaTitik;
  on: (peristiwa: string, tangani: () => void) => PetaTitik;
};
export type PetaBatas = { isValid: () => boolean };

declare global {
  interface Window {
    L?: PetaLeaflet;
  }
}

let janji: Promise<PetaLeaflet> | null = null;

/**
 * Memuat Leaflet sekali saja, dan memulangkan janji yang sama pada panggilan
 * berikutnya.
 *
 * Tanpa penyimpanan janji itu, dua komponen yang hidup berbarengan akan
 * menyuntikkan dua <script> yang sama - dan yang kedua menimpa `window.L`
 * tepat ketika yang pertama sedang memakainya.
 */
export function muatLeaflet(): Promise<PetaLeaflet> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet hanya dapat dimuat di peramban."));
  }
  if (window.L) return Promise.resolve(window.L);
  if (janji) return janji;

  janji = new Promise<PetaLeaflet>((selesai, gagal) => {
    const gayaAda = document.querySelector('link[data-aleta-leaflet="1"]');
    if (!gayaAda) {
      const gaya = document.createElement("link");
      gaya.rel = "stylesheet";
      gaya.href = withBasePath("/vendor/leaflet/leaflet.css");
      gaya.setAttribute("data-aleta-leaflet", "1");
      document.head.appendChild(gaya);
    }

    const skrip = document.createElement("script");
    skrip.src = withBasePath("/vendor/leaflet/leaflet.js");
    skrip.async = true;
    skrip.onload = () => {
      if (window.L) selesai(window.L);
      else gagal(new Error("Leaflet termuat tetapi tidak mendaftarkan dirinya."));
    };
    skrip.onerror = () => {
      // Janjinya dilepas supaya percobaan berikutnya benar-benar mencoba lagi -
      // janji yang gagal dan disimpan membuat halaman gagal selamanya sampai
      // dimuat ulang.
      janji = null;
      gagal(new Error("Berkas peta tidak dapat dimuat dari peladen."));
    };
    document.body.appendChild(skrip);
  });

  return janji;
}
