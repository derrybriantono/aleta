/**
 * Bahan murni untuk tampilan baru Jadwal Sidang dan Jadwal Mediasi (4 Nov 2026).
 *
 * Berkas ini TIDAK menyentuh React, jaringan, SIPP, izin, maupun penulisan:
 * hanya pilihan "Tampilan lama / Tampilan baru", kotak cari berpil, tahap
 * proses sidang, dan hitungan kecil untuk lajur Majelis & putusan. Semua yang
 * MENULIS (tunda, putus, antrian, relaas, hasil mediasi) tetap dikerjakan
 * pemanggil dan hook yang sudah ada.
 */

// ============================================================================
// PILIHAN TAMPILAN LAMA / BARU
// ============================================================================

export type Antarmuka = "baru" | "lama";

export const KUNCI_ANTARMUKA_SIDANG = "aleta.jadwal-sidang.antarmuka";
export const KUNCI_ANTARMUKA_MEDIASI = "aleta.jadwal-mediasi.antarmuka";

/** Bawaan BARU; hanya tulisan "lama" yang mengembalikan tampilan sebelumnya. */
export function bacaAntarmuka(nilai: string | null | undefined): Antarmuka {
  return nilai === "lama" ? "lama" : "baru";
}

/** Dibaca dari peramban; gagal membaca = bawaan (baru). */
export function muatAntarmuka(kunci: string): Antarmuka {
  try {
    return bacaAntarmuka(window.localStorage.getItem(kunci));
  } catch {
    return "baru";
  }
}

/** Disimpan seperti pengaturan tampilan lain: di peramban ini saja; gagal menyimpan tidak mengganggu. */
export function simpanAntarmuka(kunci: string, nilai: Antarmuka): void {
  try {
    window.localStorage.setItem(kunci, nilai);
  } catch {
    /* pilihan tetap berlaku selama halaman terbuka */
  }
}

// ============================================================================
// KOTAK CARI BERPIL
// ============================================================================
//
// Ketik, pilih saran dari data yang sudah termuat (beserta jumlahnya), jadi pil.
// Aturan gabung: nilai berbeda pada MEDAN YANG SAMA = atau; antarmedan = dan.
// Tanpa memilih saran, teks tetap menyaring sebagai teks bebas (urusan pemanggil).

export type Pil = { medan: string; nilai: string };

export type DefMedan<T> = {
  label: string;
  /** Nilai-nilai yang dimiliki baris ini pada medan tersebut. */
  ambil?: (baris: T) => string[];
  /** Tidak ditawarkan sebagai saran (mis. rentang jam yang ditulis panel Saringan). */
  sembunyi?: boolean;
  /** Pengganti `ambil` untuk nilai yang bukan kecocokan persis. */
  uji?: (baris: T, nilai: string) => boolean;
};

export type PetaMedan<T> = Record<string, DefMedan<T>>;

export function cocokPil<T>(baris: T, pil: readonly Pil[], medan: PetaMedan<T>): boolean {
  if (pil.length === 0) return true;
  const perMedan = new Map<string, string[]>();
  for (const p of pil) {
    const daftar = perMedan.get(p.medan);
    if (daftar) daftar.push(p.nilai);
    else perMedan.set(p.medan, [p.nilai]);
  }
  for (const [kunci, nilai] of perMedan) {
    const def = medan[kunci];
    if (!def) continue;
    if (def.uji) {
      if (!nilai.some((v) => def.uji!(baris, v))) return false;
      continue;
    }
    const ada = def.ambil?.(baris) ?? [];
    if (!nilai.some((v) => ada.includes(v))) return false;
  }
  return true;
}

export type NilaiBerjumlah = Array<[string, number]>;
export type IndeksPil = Record<string, NilaiBerjumlah>;

/** Satu putaran atas data: berapa baris punya tiap nilai di tiap medan. Dibuat sekali per muatan data, bukan per ketikan. */
export function buatIndeksPil<T>(data: readonly T[], medan: PetaMedan<T>): IndeksPil {
  const indeks: IndeksPil = {};
  for (const [kunci, def] of Object.entries(medan)) {
    if (!def.ambil) continue;
    const hitung = new Map<string, number>();
    for (const baris of data) {
      for (const v of new Set(def.ambil(baris))) {
        const teks = String(v ?? "").trim();
        if (!teks) continue;
        hitung.set(teks, (hitung.get(teks) ?? 0) + 1);
      }
    }
    indeks[kunci] = [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"));
  }
  return indeks;
}

export type Saran = {
  /** Nama medan, atau "tag" untuk tag keadaan berangka. */
  medan: string;
  nilai: string;
  jumlah: number;
  /** Tulisan yang ditampilkan bila beda dari nilai (tag). */
  teks?: string;
};

export type TagSaran = { kunci: string; label: string; jumlah: number; nyala: boolean };

export const BATAS_SARAN = 10;

/**
 * Saran untuk teks yang diketik.
 *
 * - "medan:isi" membatasi ke satu medan (kunci atau labelnya, tanpa peduli besar-kecil).
 * - Teks kosong menawarkan beberapa ciri dan tag yang menyala belum dipilih.
 * - Nilai yang sudah menjadi pil tidak ditawarkan lagi.
 */
export function saranCari<T>(
  teks: string,
  medan: PetaMedan<T>,
  indeks: IndeksPil,
  pil: readonly Pil[],
  tag: readonly TagSaran[],
  opsi: { medanAwal?: string; batasAwalTag?: number } = {}
): Saran[] {
  const q = teks.trim().toLowerCase();
  const sudah = (m: string, v: string) => pil.some((p) => p.medan === m && p.nilai === v);
  const hasil: Saran[] = [];
  if (!q) {
    const awal = opsi.medanAwal ?? "ciri";
    for (const [v, n] of (indeks[awal] ?? []).slice(0, 6)) {
      if (!sudah(awal, v)) hasil.push({ medan: awal, nilai: v, jumlah: n });
    }
    for (const t of tag.filter((x) => x.jumlah > 0 && !x.nyala).slice(0, opsi.batasAwalTag ?? 2)) {
      hasil.push({ medan: "tag", nilai: t.kunci, teks: t.label, jumlah: t.jumlah });
    }
    return hasil;
  }
  const m0 = /^([a-z]+):(.*)$/.exec(q);
  const kunciMedan = m0
    ? Object.keys(medan).find((k) => k.toLowerCase() === m0[1] || medan[k].label.toLowerCase() === m0[1])
    : undefined;
  const isi = kunciMedan ? (m0 as RegExpExecArray)[2].trim() : q;
  const kena = (v: string) => {
    const t = v.toLowerCase();
    return isi.split(/\s+/).every((tok) => t.includes(tok));
  };
  for (const kunci of Object.keys(medan)) {
    if (medan[kunci].sembunyi || (kunciMedan && kunci !== kunciMedan)) continue;
    for (const [v, n] of indeks[kunci] ?? []) {
      if (kena(v) && !sudah(kunci, v)) hasil.push({ medan: kunci, nilai: v, jumlah: n });
    }
  }
  if (!kunciMedan) {
    for (const t of tag) if (t.jumlah > 0 && !t.nyala && kena(t.label)) hasil.push({ medan: "tag", nilai: t.kunci, teks: t.label, jumlah: t.jumlah });
  }
  return hasil.slice(0, BATAS_SARAN);
}

/** Menambah pil; pil yang sama tidak ditambah dua kali. */
export function tambahPil(pil: readonly Pil[], baru: Pil): Pil[] {
  return pil.some((p) => p.medan === baru.medan && p.nilai === baru.nilai) ? [...pil] : [...pil, baru];
}

export function lepasPil(pil: readonly Pil[], indeks: number): Pil[] {
  return pil.filter((_, i) => i !== indeks);
}

/** Memasang/melepas pil dari panel Saringan (tekan lagi = lepas). */
export function alihPil(pil: readonly Pil[], p: Pil): Pil[] {
  return pil.some((x) => x.medan === p.medan && x.nilai === p.nilai)
    ? pil.filter((x) => !(x.medan === p.medan && x.nilai === p.nilai))
    : [...pil, p];
}

/** Rentang jam dari panel Saringan ditulis sebagai satu pil "08:00–16:00"; yang lama pada medan itu diganti. */
export function pasangRentangJam(pil: readonly Pil[], dari: string, sampai: string): Pil[] {
  const tanpa = pil.filter((p) => p.medan !== "jamRentang");
  if (!/^\d{2}:\d{2}$/.test(dari) || !/^\d{2}:\d{2}$/.test(sampai)) return tanpa;
  const [a, b] = dari <= sampai ? [dari, sampai] : [sampai, dari];
  return [...tanpa, { medan: "jamRentang", nilai: `${a}–${b}` }];
}

export function jamDalamRentang(jam: string | null | undefined, rentang: string): boolean {
  const [a, b] = rentang.split("–");
  const j = (jam ?? "").slice(0, 5);
  if (!j || !a || !b) return false;
  return j >= a && j <= b;
}

// ============================================================================
// TAHAP PROSES SIDANG (titik-titik di lajur Agenda)
// ============================================================================

export const TAHAP_GUGATAN = ["Pemeriksaan", "Mediasi", "Jawab-menjawab", "Pembuktian", "Putusan"] as const;
export const TAHAP_IKRAR = [...TAHAP_GUGATAN, "Ikrar"] as const;
export const TAHAP_MOHON = ["Pemeriksaan", "Pembuktian", "Penetapan"] as const;

export type LangkahTahap = { daftar: readonly string[]; ke: number; nama: string };

/**
 * Tahap proses menurut tulisan agenda di SIPP. SIPP tidak menyimpan "tahap"
 * tersendiri, jadi ini tebakan terbaik dari kata kunci agenda - dan karena itu
 * hanya penanda, tidak pernah dipakai untuk memutus apa pun.
 */
export function tahapDariAgenda(
  agenda: string | null | undefined,
  opsi: { permohonan?: boolean; ikrar?: boolean } = {}
): LangkahTahap {
  const a = (agenda ?? "").toLowerCase();
  const daftar: readonly string[] = opsi.permohonan ? TAHAP_MOHON : opsi.ikrar ? TAHAP_IKRAR : TAHAP_GUGATAN;
  let nama: string;
  if (opsi.ikrar && /ikrar/.test(a)) nama = "Ikrar";
  else if (/putus|musyawarah|penetapan|pembacaan/.test(a) && !/pembacaan (gugat|permohonan)/.test(a)) nama = opsi.permohonan ? "Penetapan" : "Putusan";
  else if (/mediasi/.test(a)) nama = "Mediasi";
  else if (/jawab|replik|duplik|tanggap|eksepsi|konvensi/.test(a)) nama = "Jawab-menjawab";
  else if (/bukti|saksi|kesimpulan|setempat|ahli/.test(a)) nama = "Pembuktian";
  else nama = "Pemeriksaan";
  let ke = daftar.indexOf(nama);
  if (ke < 0) ke = nama === "Pembuktian" ? daftar.indexOf("Pembuktian") : 0;
  return { daftar, ke: Math.max(0, ke), nama: daftar[Math.max(0, ke)] };
}

// ============================================================================
// SIDANG BERIKUTNYA, TINDAK LANJUT PUTUSAN
// ============================================================================

export type CatatanCc = { tanggal: string; agenda: string };

/** Rencana Court Calendar terdekat yang jatuh SESUDAH hari ini (bukan hari ini). */
export function rencanaCcBerikut(cc: readonly CatatanCc[] | undefined | null, hariIniIso: string): CatatanCc | null {
  const depan = (cc ?? [])
    .filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.tanggal) && c.tanggal.slice(0, 10) > hariIniIso)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return depan[0] ?? null;
}

/** Tanggal tundaan dan tanggal CC berbeda: kedua-duanya terisi dan tidak sama. */
export function tanggalTundaBedaCc(tundaIso: string | null | undefined, cc: CatatanCc | null): boolean {
  const t = (tundaIso ?? "").slice(0, 10);
  return Boolean(t && cc && cc.tanggal.slice(0, 10) !== t);
}

export function geserIso(iso: string, hari: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

export type PerkiraanBht = { iso: string; sumber: "sipp" | "perkiraan" };

/**
 * BHT. Tanggal dari SIPP selalu dipakai bila ada. Tanpa itu, perkiraan hanya
 * dibuat untuk putusan kontradiktoir (semua pihak hadir, bukan verstek):
 * tanggal putusan + 14 hari. Verstek menunggu pemberitahuan putusan yang
 * tanggalnya tidak ada di data jadwal, jadi TIDAK ditebak (null).
 */
export function perkiraanBht(p: {
  tanggalBht?: string | null;
  tanggalPutusan?: string | null;
  verstek?: boolean;
  dihadiriOleh?: number | null;
}): PerkiraanBht | null {
  // SIPP menulis tanggal kosong sebagai "0000-00-00": itu bukan tanggal.
  const sah = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x) && !x.startsWith("0000");
  const sipp = (p.tanggalBht ?? "").slice(0, 10);
  if (sah(sipp)) return { iso: sipp, sumber: "sipp" };
  const putus = (p.tanggalPutusan ?? "").slice(0, 10);
  if (!sah(putus)) return null;
  if (p.verstek || p.dihadiriOleh !== 1) return null;
  return { iso: geserIso(putus, 14), sumber: "perkiraan" };
}

// ============================================================================
// SEGMEN TUNDA | PUTUS (pita bawah kartu)
// ============================================================================

export type KeadaanSegmen = {
  tampil: boolean;
  bisa: boolean;
  tundaNyala: boolean;
  putusNyala: boolean;
  labelTunda: string;
  labelPutus: string;
};

/**
 * Apa yang tertulis di segmen Tunda | Putus. Yang terisi disorot dan memuat
 * ringkasan hasilnya; yang kosong tetap berupa tombol bila pengguna boleh
 * mencatat. `bisa` = tombolnya boleh ditekan (belum selesai dicatat otomatis
 * seperti ikrar yang sudah dilaksanakan).
 */
export function keadaanSegmen(p: {
  boleh: boolean;
  sidangSelesai: boolean;
  ditunda: boolean;
  sampaiPendek: string;
  putus: boolean;
  amar: string;
  ikrar: boolean;
  ikrarSelesai: boolean;
}): KeadaanSegmen {
  const bisa = p.boleh && !p.sidangSelesai && !p.ikrarSelesai;
  const tundaNyala = p.ditunda;
  const putusNyala = p.ikrar ? p.ikrarSelesai : p.putus;
  const labelTunda = tundaNyala ? `Ditunda${p.sampaiPendek ? " " + p.sampaiPendek : ""}` : p.ikrar ? "Tunda ikrar" : "Tunda";
  const labelPutus = putusNyala ? (p.ikrar ? "Ikrar dilaksanakan" : `Putus${p.amar ? " · " + p.amar : ""}`) : p.ikrar ? "Ikrar dilaksanakan" : "Putus";
  return { tampil: bisa || tundaNyala || putusNyala, bisa, tundaNyala, putusNyala, labelTunda, labelPutus };
}

/** Merah "Catat hasil sidang:" bila sidangnya selesai tetapi hasilnya belum tercatat. */
export function perluCatatHasil(p: { selesai: boolean; ditunda: boolean; putus: boolean; ikrarSelesai: boolean }): boolean {
  return p.selesai && !p.ditunda && !p.putus && !p.ikrarSelesai;
}

/**
 * Memecah teks majelis ("Nama A, S.H., M.H., Nama B, S.Ag.") menjadi satu
 * entri per hakim. SIPP/bot menyambung nama dengan ", " dan gelar juga memakai
 * koma, jadi potongan yang hanya berupa gelar (S.H., M.H., Lc ...) dilekatkan
 * kembali ke nama sebelumnya. Urutan = urutan SIPP (ketua lebih dulu).
 */
export function pisahNamaHakim(nama: string | null | undefined): string[] {
  const gelar = /^(?:[A-Za-z]{1,3}\.[A-Za-z.]*|Lc\.?|MA|MH|SH|MM)$/;
  const hasil: string[] = [];
  for (const potong of (nama ?? "").split(/,\s+/).map((x) => x.trim()).filter(Boolean)) {
    if (hasil.length > 0 && gelar.test(potong)) hasil[hasil.length - 1] += ", " + potong;
    else hasil.push(potong);
  }
  return hasil;
}

// ============================================================================
// TANGGAL PENDEK
// ============================================================================

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-11-10" -> "10 Nov"; tanggal yang tidak sah dikembalikan apa adanya. */
export function tanggalPendekId(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  return `${Number(m[3])} ${BULAN_PENDEK[Number(m[2]) - 1] ?? m[2]}`;
}

/** "2026-11-10" -> "10 Nov 2026". */
export function tanggalPendekTahunId(iso: string | null | undefined): string {
  const m = /^(\d{4})-/.exec(String(iso ?? ""));
  return m ? `${tanggalPendekId(iso)} ${m[1]}` : String(iso ?? "");
}

/** Jumlah simpanan saringan dibatasi supaya peramban tidak membengkak. */
export const BATAS_SARINGAN_TERSIMPAN = 12;

export type SaringanTersimpan = { nama: string; pil: Pil[] };

export function bacaSaringanTersimpan(mentah: string | null | undefined): SaringanTersimpan[] {
  try {
    const data = JSON.parse(String(mentah ?? "[]")) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter((x): x is SaringanTersimpan => Boolean(x) && typeof x.nama === "string" && Array.isArray(x.pil))
      .map((x) => ({
        nama: x.nama.slice(0, 40),
        pil: x.pil.filter((p) => p && typeof p.medan === "string" && typeof p.nilai === "string"),
      }))
      .slice(0, BATAS_SARINGAN_TERSIMPAN);
  } catch {
    return [];
  }
}
