/**
 * KOMENTAR HAKIM ATAS BAS - aturan murni yang dipakai server, layar, dan uji.
 *
 * ============================================================================
 * KOMENTAR TIDAK PERNAH MENAHAN APA PUN
 * ============================================================================
 *
 * Keputusan pengguna 29 September 2026: TANPA acc hakim. Hakim membaca alur
 * BAS dan keterangan saksi, lalu menunjuk bagian yang salah. Panitera tetap
 * mengerjakan BAS tanpa menunggu siapa pun - "selesai" hanya berarti komentar
 * itu sudah ditanggapi, bukan izin untuk melanjutkan.
 *
 * (Portal masih punya acc lembar BAS lama di bas-acc.ts; itu langkah lain
 * yang tidak disentuh di sini dan tidak dibaca oleh komentar.)
 *
 * ============================================================================
 * KUNCI BAGIAN - STABIL, DAN TIDAK BERTABRAKAN ANTARSUMBER
 * ============================================================================
 *
 *   saksi-<p|t><ke>:<urutan>   keterangan saksi di ABT (abt_keterangan_saksi)
 *                              yang letaknya DIKETAHUI (letakSaksiAbt): pihak dan
 *                              urutan saksi dalam pihaknya - bentuk yang
 *                              dicocokkan panel ABT ekstensi dengan kolom
 *                              penyuntingnya ("Saksi 1 T" = saksi-t1).
 *   saksi-<ke>:<urutan>        letaknya TIDAK diketahui (saksi ke-3 dst. tanpa
 *                              pihak dari jembatan): <ke> = urutan saksi di ABT.
 *                              Panel ABT tidak menempelkannya ke kolom mana pun -
 *                              menebak pihak berarti komentar atas saksi Tergugat
 *                              tampil di bawah saksi Penggugat.
 *   lembar-<P|T><ke>:<urutan>  tanya-jawab di lembar BAS ALETA (alat bantu tulis
 *                              BAS). Awalan berbeda karena lembar ALETA dan
 *                              rekaman ABT untuk saksi yang sama dapat hidup
 *                              berdampingan - satu kunci untuk keduanya berarti
 *                              komentar atas yang satu tampil di bawah yang lain.
 *   alasan:<huruf>             alasan perceraian huruf a..k.
 *   umum                       tidak menunjuk bagian tertentu.
 *
 * Kunci lain tetap diterima selama bentuknya aman (huruf, angka, : _ - .),
 * sebab kontraknya "kunci bebas yang stabil" - ekstensi boleh menambah jenis.
 */

export const BATAS_KUTIPAN = 500;
export const BATAS_ISI_KOMENTAR = 2000;

const POLA_BAGIAN = /^[A-Za-z0-9][A-Za-z0-9:_\-.]{0,79}$/;

export function bagianSah(nilai: unknown): nilai is string {
  return typeof nilai === "string" && POLA_BAGIAN.test(nilai.trim());
}

export function kunciSaksiAbt(
  saksiKe: number,
  urutan: number,
  letak?: { pihak: "P" | "T"; ke: number } | null
): string {
  if (letak) return `saksi-${letak.pihak.toLowerCase()}${letak.ke}:${urutan}`;
  return `saksi-${saksiKe}:${urutan}`;
}

export function kunciLembar(pihak: "P" | "T", ke: number, urutan: number): string {
  return `lembar-${pihak}${ke}:${urutan}`;
}

export function kunciAlasan(huruf: string): string {
  return `alasan:${String(huruf).trim().toLowerCase()}`;
}

/** Huruf alasan perceraian yang dapat dikomentari - sama dengan kontrak (a..k). */
export const HURUF_ALASAN = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] as const;

/**
 * Nomor perkara dalam bentuk kunci.
 *
 * Spasi dirapatkan dan titik di ujung dibuang: arsip SIPP menulis nomor
 * berekor titik ("214/Pdt.G/2026/PA.Dgl."), dan dua bentuk itu harus menunjuk
 * komentar yang sama. Huruf besar-kecil DIBIARKAN - nomor SIPP selalu ditulis
 * sama, dan menurunkannya membuat nomor tampil berbeda dari yang diketik orang.
 */
export function normalkanNomorPerkara(nilai: unknown): string {
  return String(nilai ?? "")
    .replace(/\s+/g, "")
    .replace(/\.+$/, "")
    .trim();
}

/** Sebutan bagian untuk dibaca orang - "Saksi ke-1, pertanyaan 3". */
export function sebutanBagian(bagian: string): string {
  const b = String(bagian || "").trim();
  if (b === "umum") return "Umum";
  let m = /^saksi-([pt])(\d+):(\d+)$/.exec(b);
  if (m) return `${m[1] === "t" ? "Saksi Tergugat" : "Saksi"} ke-${m[2]} (ABT), pertanyaan ${m[3]}`;
  m = /^saksi-(\d+):(\d+)$/.exec(b);
  if (m) return `Saksi ke-${m[1]} (ABT), pertanyaan ${m[2]}`;
  m = /^saksi-(\d+)$/.exec(b);
  if (m) return `Saksi ke-${m[1]} (ABT)`;
  m = /^lembar-([PT])(\d+):(\d+)$/.exec(b);
  if (m) return `${m[1] === "T" ? "Saksi Tergugat" : "Saksi"} ke-${m[2]} (lembar ALETA), pertanyaan ${m[3]}`;
  m = /^alasan:([a-k])$/.exec(b);
  if (m) return `Alasan perceraian huruf ${m[1]}`;
  return b;
}
