/**
 * ============================================================================
 * CAP KANTOR: FOTO/PINDAIAN -> PNG BERLATAR TRANSPARAN (perbaikan 6 Okt 2026,
 * butir 18 & 20)
 * ============================================================================
 *
 * Cap ditumpuk DI ATAS tanda tangan pada edoc penetapan. Cap yang masih
 * membawa latar kertas (foto/pindaian, JPG, WEBP) akan MENUTUPI tanda
 * tangannya - jadi latarnya harus dibuang lebih dulu.
 *
 * Caranya (tanpa tebakan bentuk cap):
 *
 *   1. WARNA KERTAS dibaca dari tepi gambar (median 3% pinggiran) - bukan
 *      diandaikan putih: foto cap biasanya kertas krem/abu.
 *   2. KEKUATAN TINTA tiap piksel = seberapa jauh ia LEBIH GELAP dari kertas
 *      pada saluran mana pun (tinta ungu cap PA: hijaunya jatuh jauh).
 *      Alfa = kekuatan itu dipetakan lembut antara AMBANG_BAWAH dan
 *      AMBANG_ATAS - tepi huruf tetap halus, bukan bergerigi.
 *   3. WARNA TINTA dipulihkan (dilepas dari campuran kertas) supaya tepi yang
 *      setengah transparan tidak berwarna pucat keputihan.
 *   4. BINTIK debu kecil yang terpisah (komponen < 0,015% luas gambar)
 *      dibuang - foto cap pengguna punya beberapa di luar lingkaran.
 *   5. Dipotong ke kotak tinta + sedikit ruang, diperkecil paling panjang
 *      SISI_MAKS piksel, alfa keseluruhan dikali OPASITAS (tinta cap basah
 *      juga tidak menutup goresan di bawahnya sepenuhnya).
 *
 * sharp dimuat dinamis (pola institution-logo-background.ts).
 */

export const AMBANG_BAWAH = 0.12;
export const AMBANG_ATAS = 0.42;
export const OPASITAS_CAP = 0.9;
export const SISI_MAKS = 900;
const BINTIK_RELATIF = 0.00015;

export type HasilCapTransparan = {
  buffer: Buffer;
  lebar: number;
  tinggi: number;
  latar: [number, number, number];
  bintikDibuang: number;
  /** Pinggiran gambar sudah bening: alfa asli dipakai, latar tidak dihitung. */
  sudahBening: boolean;
};

function median(xs: number[]): number {
  if (!xs.length) return 255;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Inti murni atas piksel RGBA (diuji tanpa sharp). Mengubah `data` di
 * tempat dan memulangkan kotak tinta + latar + jumlah bintik dibuang.
 */
export function olahPikselCap(data: Uint8Array | Buffer, lebar: number, tinggi: number) {
  const n = lebar * tinggi;
  // 1. Warna kertas dari pinggiran.
  const pita = Math.max(1, Math.round(Math.min(lebar, tinggi) * 0.03));
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  let pinggirSemua = 0;
  let pinggirBening = 0;
  const langkah = Math.max(1, Math.floor((lebar + tinggi) / 400));
  for (let y = 0; y < tinggi; y += langkah) {
    for (let x = 0; x < lebar; x += langkah) {
      if (x >= pita && x < lebar - pita && y >= pita && y < tinggi - pita) continue;
      const o = (y * lebar + x) * 4;
      pinggirSemua += 1;
      if (data[o + 3] < 32) pinggirBening += 1;
      if (data[o + 3] < 128) continue;
      r.push(data[o]);
      g.push(data[o + 1]);
      b.push(data[o + 2]);
    }
  }
  // Gambar yang pinggirannya SUDAH bening (PNG/WEBP cap yang latarnya sudah
  // dibuang, seperti cap dari pengguna 6 Okt) tidak dihitung ulang dari
  // "kertas" - pinggiran opaknya justru tinta. Alfanya dipakai apa adanya;
  // yang dikerjakan hanya buang bintik, potong, perkecil.
  const sudahBening = pinggirSemua > 0 && pinggirBening / pinggirSemua >= 0.5;
  const latar: [number, number, number] = sudahBening ? [255, 255, 255] : [median(r), median(g), median(b)];

  // 2-3. Alfa dari kekuatan tinta, warna tinta dipulihkan.
  const alfa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const asliA = data[o + 3] / 255;
    if (sudahBening) {
      alfa[i] = asliA;
      continue;
    }
    let kuat = 0;
    for (let c = 0; c < 3; c++) {
      const kertas = Math.max(1, latar[c]);
      kuat = Math.max(kuat, (kertas - data[o + c]) / kertas);
    }
    const a = Math.min(1, Math.max(0, (kuat - AMBANG_BAWAH) / (AMBANG_ATAS - AMBANG_BAWAH))) * asliA;
    alfa[i] = a;
    if (a > 0) {
      const bagi = Math.max(a, 0.35);
      for (let c = 0; c < 3; c++) {
        const v = latar[c] - (latar[c] - data[o + c]) / bagi;
        data[o + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }

  // 4. Bintik kecil terpisah dibuang (komponen 8-tetangga atas alfa > 0,3).
  const label = new Int32Array(n).fill(-1);
  const batasBintik = Math.max(12, Math.round(n * BINTIK_RELATIF));
  const tumpukan = new Int32Array(n);
  let bintikDibuang = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] !== -1 || alfa[i] <= 0.3) continue;
    let atas = 0;
    tumpukan[atas++] = i;
    label[i] = i;
    const anggota: number[] = [];
    while (atas > 0) {
      const p = tumpukan[--atas];
      anggota.push(p);
      const px = p % lebar;
      const py = (p - px) / lebar;
      for (let dy = -1; dy <= 1; dy++) {
        const qy = py + dy;
        if (qy < 0 || qy >= tinggi) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const qx = px + dx;
          if ((dx === 0 && dy === 0) || qx < 0 || qx >= lebar) continue;
          const q = qy * lebar + qx;
          if (label[q] === -1 && alfa[q] > 0.3) {
            label[q] = i;
            tumpukan[atas++] = q;
          }
        }
      }
    }
    if (anggota.length < batasBintik) {
      bintikDibuang += 1;
      for (const p of anggota) alfa[p] = 0;
    }
  }

  // Sisa samar di sekitar bintik yang dibuang / di kertas: dinolkan.
  let kiri = lebar;
  let kanan = -1;
  let puncak = tinggi;
  let dasar = -1;
  for (let i = 0; i < n; i++) {
    let a = alfa[i];
    if (a < 0.06) a = 0;
    // Piksel lemah yang tidak bertetangga dengan komponen yang dipertahankan.
    if (a > 0 && a <= 0.3) {
      const px = i % lebar;
      const py = (i - px) / lebar;
      let dekat = false;
      for (let dy = -2; dy <= 2 && !dekat; dy++) {
        for (let dx = -2; dx <= 2 && !dekat; dx++) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= lebar || qy >= tinggi) continue;
          if (alfa[qy * lebar + qx] > 0.3) dekat = true;
        }
      }
      if (!dekat) a = 0;
    }
    data[i * 4 + 3] = Math.round(a * OPASITAS_CAP * 255);
    if (a > 0) {
      const px = i % lebar;
      const py = (i - px) / lebar;
      if (px < kiri) kiri = px;
      if (px > kanan) kanan = px;
      if (py < puncak) puncak = py;
      if (py > dasar) dasar = py;
    }
  }
  const kotak = kanan < 0 ? null : { kiri, atas: puncak, lebar: kanan - kiri + 1, tinggi: dasar - puncak + 1 };
  return { latar, bintikDibuang, kotak, sudahBening };
}

/**
 * PNG/JPG/WEBP apa pun -> PNG cap berlatar transparan. Melempar bila tidak
 * ada tinta sama sekali (gambar kosong / bukan cap).
 */
export async function capBerlatarTransparan(masukan: Buffer): Promise<HasilCapTransparan> {
  const sharp = (await import("sharp")).default;
  // Diperkecil dulu supaya sapuan komponen tetap ringan (foto cap 12 MP).
  const awal = await sharp(masukan)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: lebar, height: tinggi } = awal.info;
  const data = Buffer.from(awal.data);
  const hasil = olahPikselCap(data, lebar, tinggi);
  if (!hasil.kotak) throw new Error("gambar_cap_tanpa_tinta");
  const pinggir = Math.round(Math.max(hasil.kotak.lebar, hasil.kotak.tinggi) * 0.02);
  const kiri = Math.max(0, hasil.kotak.kiri - pinggir);
  const atas = Math.max(0, hasil.kotak.atas - pinggir);
  const lebarPotong = Math.min(lebar - kiri, hasil.kotak.lebar + 2 * pinggir);
  const tinggiPotong = Math.min(tinggi - atas, hasil.kotak.tinggi + 2 * pinggir);
  const keluar = await sharp(data, { raw: { width: lebar, height: tinggi, channels: 4 } })
    .extract({ left: kiri, top: atas, width: lebarPotong, height: tinggiPotong })
    .resize({ width: SISI_MAKS, height: SISI_MAKS, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: keluar.data,
    lebar: keluar.info.width,
    tinggi: keluar.info.height,
    latar: hasil.latar,
    bintikDibuang: hasil.bintikDibuang,
    sudahBening: hasil.sudahBening,
  };
}
