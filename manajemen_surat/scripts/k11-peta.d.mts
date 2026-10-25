/** Deklarasi tipe untuk k11-peta.mjs - supaya ujinya dapat diperiksa tsc. */
export type PernyataanTingkatAtas = { jenis: string; nama: string[]; teks: string; direktif: boolean };
export type InfoBerkas = { byte: number; sidik: string; nama?: string[]; ekspor?: string[]; jumlahPernyataan?: number; pernyataan?: string[] };
export type KelompokManifest = { i: number; matches: string[]; run_at: string; world: string; js: string[]; css: string[] };
export type PetaFitur = { versi: string; permissions: string[]; kelompok: KelompokManifest[]; berkas: Record<string, InfoBerkas> };

export function pernyataanTingkatAtas(sumber: string): PernyataanTingkatAtas[];
export function namaEkspor(sumber: string): string[];
export function bangunPeta(dirEkstensi: string, opsi?: { tambahan?: string[]; sidikPernyataan?: string[] }): PetaFitur;
