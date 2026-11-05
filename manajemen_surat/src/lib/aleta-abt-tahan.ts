import type { ButirIsian, Susunan } from "@/app/api/aleta-ecourt/blangko-derry/susun";

/**
 * ============================================================================
 * PENAHAN CETAK ALETA ABT (keputusan pemilik 6 Nov 2026) - aturan murni, tanpa jaringan
 * ============================================================================
 *
 * Menggolongkan isian kosong sebuah naskah:
 *   menahan      ketikan atau tanya jawab wajib yang berlaku, termasuk isian di dalam rumus bila tuntutannya aktif dan alasan perceraian (#8503#),
 *                serta isian yang gagal dihitung. Naskah tidak keluar.
 *   perluDilihat rumus atau kolom SIPP yang tidak memulangkan data, seperti nama mediator, dan isian yang keadaannya tidak diketahui di sini
 *                (ghaib, e-Court). Tidak menahan; bila tetap kosong tercetak titik-titik seperti ABT.
 *   catatan      isian pilihan, tambahan, atau yang keadaannya tidak berlaku. Tidak menahan.
 * Rumus yang sengaja kosong (mesin mencatatnya terisi dengan nilai kosong) tidak masuk daftar mana pun: tercetak kosong seperti ABT.
 *
 * Golongan isian menyalin golonganIsianMurni dan keadaanBerlakuMurni di ekstensi-sipp/blangko-derry-isian.js, dijaga uji kesetaraan. Bedanya:
 * data perkara dari daftar perkara panel (ghaib, lewat e-Court) tidak tersedia di sini, jadi hasilnya "tidak diketahui", bukan tebakan.
 */

export type NilaiIsian = { status: string; teks: string };
export type KosongMesin = { noVar: string; nama: string; sebab: string; status: string };
export type ButirTahan = { kode: string; nama: string; sebab: string };
export type HasilTahan = { menahan: ButirTahan[]; perluDilihat: ButirTahan[]; catatan: ButirTahan[] };
export type GolonganTahan = "utama" | "takberlaku" | "tambahan" | "tuntutan" | "lanjutan" | "pilihan" | "taktahu";

const KODE_OPSIONAL = new Set(["9134"]);
/** Pertimbangan alasan perceraian di ABT rusak bila huruf alasannya belum tersimpan, walau isiannya hanya dibaca rumus. */
const KODE_SELALU_MENAHAN = new Set(["8503"]);
const PILIHAN_KEPUTUSAN = ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"];
const JENIS_KETIKAN = new Set(["data_teks", "data_tanggal", "tanya_jawab"]);

const normal = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim().toLowerCase();

function pilihanSah(b: Pick<ButirIsian, "kode" | "pilihan">): string[] {
  return Array.isArray(b.pilihan) && b.pilihan.length ? b.pilihan : /^410[0-5]$/.test(String(b.kode ?? "")) ? PILIHAN_KEPUTUSAN : [];
}

function pilihanTunggal(teks: unknown, pilihan: string[]): string {
  const t = normal(teks);
  if (!t) return "";
  for (const p of pilihan) {
    const n = normal(p);
    if (n && (t === n || t.startsWith(`${n}:`))) return p;
  }
  return "";
}

/** Nilai hanya kerangka atau bawaan ABT: kosong, daftar pilihan bergabung, bawaan itu sendiri, atau memuat "_" dan "..." kerangka. */
export function kerangkaBawaan(b: Pick<ButirIsian, "kode" | "pilihan" | "bawaan" | "saran">, teks: unknown): boolean {
  const t = String(teks ?? "").trim();
  if (!t) return true;
  const n = normal(t);
  if (n === normal(b.bawaan) || n === normal(b.saran)) return true;
  const pil = pilihanSah(b);
  if (pil.length > 1 && pil.map(normal).filter((x) => x && n.includes(x)).length >= 2) return true;
  return /(^|\s)_+(?=$|[\s.,;:)])/.test(t) || /\.{3}|…/.test(t);
}

export type KonteksTahan = {
  nilai: Readonly<Record<string, NilaiIsian | undefined>>;
  susunan: Pick<Susunan, "isian" | "tuntutan">;
  jenisCerai: "cg" | "ct";
};

const terisi = (c: KonteksTahan, kode: string) => {
  const v = c.nilai[kode];
  return Boolean(v && v.status === "terisi" && String(v.teks ?? "").trim());
};
const menyala = (c: KonteksTahan, kode: string) => Boolean(String(c.nilai[kode]?.teks ?? "").trim());

function keputusanDipilih(c: KonteksTahan, pemicu: string): boolean {
  const t = (c.susunan.tuntutan ?? []).find((x) => x.pemicu === pemicu);
  if (!t || !t.keputusan) return false;
  const b = c.susunan.isian.find((x) => x.kode === t.keputusan) ?? { kode: t.keputusan, pilihan: [] as string[] };
  return Boolean(pilihanTunggal(c.nilai[t.keputusan]?.teks, pilihanSah(b)));
}

function terisiTuntutan(c: KonteksTahan, b: ButirIsian): boolean {
  const v = c.nilai[b.kode]?.teks;
  if (kerangkaBawaan(b, v)) return false;
  const pil = pilihanSah(b);
  return pil.length ? Boolean(pilihanTunggal(v, pil)) : c.nilai[b.kode]?.status === "terisi";
}

function tuntutanAktif(c: KonteksTahan, b: ButirIsian): boolean {
  const daftar = Array.isArray(b.tuntutan) ? b.tuntutan : [];
  if (!daftar.length) return true;
  if (terisiTuntutan(c, b)) return true;
  return daftar.some((p) => menyala(c, p) || keputusanDipilih(c, p));
}

/** true berlaku, false tidak berlaku, null tidak diketahui karena butuh data perkara yang tidak ada di sini. */
export function keadaanBerlaku(b: ButirIsian, c: KonteksTahan): boolean | null {
  const k = b.keadaan || "";
  if (b.pemicu && menyala(c, b.pemicu)) return true;
  if (b.pemicu) return false;
  if (!k) return true;
  if (k === "ghaib" || k === "ecourt") return terisi(c, b.kode) ? true : null;
  if (k === "insidentil") return Boolean(b.langsung) || terisi(c, b.kode);
  if (k === "kuasaP" || k === "kuasaT" || k === "prodeo" || k === "alasanC" || k === "alasanH") return terisi(c, b.kode);
  return true;
}

export function golonganIsian(b: ButirIsian, c: KonteksTahan): GolonganTahan {
  if (!b.wajib) return "pilihan";
  const opsional = b.opsional === true || KODE_OPSIONAL.has(String(b.kode));
  const tidakLangsung = b.langsung === false && b.jenis !== "tj";
  const dikenal = (p: string) => (c.susunan.tuntutan ?? []).some((t) => t.pemicu === p) && c.nilai[p] !== undefined;
  const bertuntutan = Array.isArray(b.tuntutan) && b.tuntutan.length > 0;
  if (b.langsung === true && b.jenis !== "tj" && bertuntutan && b.tuntutan!.some(dikenal) && !tuntutanAktif(c, b)) return "tuntutan";
  if (tidakLangsung && bertuntutan) {
    if (!tuntutanAktif(c, b)) return "tuntutan";
    if (Array.isArray(b.cadangan) && b.cadangan.includes(c.jenisCerai) && !terisi(c, b.kode)) return "lanjutan";
    const k = keadaanBerlaku({ ...b, pemicu: "" }, c);
    return k === null ? "taktahu" : k ? "utama" : "takberlaku";
  }
  if (tidakLangsung) return "lanjutan";
  if (opsional) return b.jenis !== "tj" && !b.khusus ? "tambahan" : "pilihan";
  const k = keadaanBerlaku(b, c);
  return k === null ? "taktahu" : k ? "utama" : "takberlaku";
}

const SEBAB = {
  isi: "Belum diisi.",
  rumus: "Datanya belum ada di SIPP atau ABT.",
  taktahu: "Keadaan perkara perlu dipastikan petugas.",
  bukan: "Tidak berlaku atau tidak wajib untuk perkara ini.",
  galat: "Belum dapat dihitung.",
};

export type MasukanTahan = {
  susunan: Pick<Susunan, "isian" | "tuntutan">;
  nilai: Readonly<Record<string, NilaiIsian | undefined>>;
  kosong: readonly KosongMesin[];
  jenisCerai: "cg" | "ct";
  /** Jenis data katalog per kode, untuk ketikan yang tidak terbaca sebagai penanda blangko. */
  jenisKatalog?: (kode: string) => string;
};

/** Menggolongkan isian kosong. Tiap kode muncul sekali, pada golongan terkuat. */
export function nilaiTahan(m: MasukanTahan): HasilTahan {
  const c: KonteksTahan = { nilai: m.nilai, susunan: m.susunan, jenisCerai: m.jenisCerai };
  const butir = new Map(m.susunan.isian.map((b) => [b.kode, b]));
  const hasil: HasilTahan = { menahan: [], perluDilihat: [], catatan: [] };
  const sudah = new Set<string>();
  const masuk = (ke: keyof HasilTahan, kode: string, nama: string, sebab: string) => {
    if (sudah.has(kode)) return;
    sudah.add(kode);
    hasil[ke].push({ kode, nama: nama || `Isian ${kode}`, sebab });
  };
  const golongkan = (b: ButirIsian) => {
    const g = golonganIsian(b, c);
    if (g === "taktahu") masuk("perluDilihat", b.kode, b.nama, SEBAB.taktahu);
    else if (g === "utama" && b.tingkat !== "tambahan") masuk("menahan", b.kode, b.nama, SEBAB.isi);
    else masuk("catatan", b.kode, b.nama, SEBAB.bukan);
  };
  for (const k of m.kosong) {
    if (k.status === "galat" || k.status === "takada") {
      masuk("menahan", k.noVar, k.nama, SEBAB.galat);
      continue;
    }
    const b = butir.get(k.noVar);
    if (KODE_SELALU_MENAHAN.has(k.noVar)) masuk("menahan", k.noVar, b?.nama ?? k.nama, SEBAB.isi);
    else if (b) golongkan(b);
    else if (JENIS_KETIKAN.has(m.jenisKatalog?.(k.noVar) ?? "")) masuk("menahan", k.noVar, k.nama, SEBAB.isi);
    else masuk("perluDilihat", k.noVar, k.nama, SEBAB.rumus);
  }
  // Ketikan yang hanya dibaca rumus: mesin tidak menyebutnya, karena rumus luarnya tetap menghasilkan teks.
  for (const b of m.susunan.isian) {
    if (b.langsung || b.jenis === "tj" || !b.wajib) continue;
    const bertuntutan = Array.isArray(b.tuntutan) && b.tuntutan.length > 0;
    const kosong = bertuntutan || pilihanSah(b).length ? kerangkaBawaan(b, m.nilai[b.kode]?.teks) : !terisi(c, b.kode);
    if (!kosong) continue;
    if (KODE_SELALU_MENAHAN.has(b.kode)) masuk("menahan", b.kode, b.nama, SEBAB.isi);
    else if (golonganIsian(b, c) === "utama" && b.tingkat !== "tambahan") masuk("menahan", b.kode, b.nama, SEBAB.isi);
  }
  return hasil;
}
