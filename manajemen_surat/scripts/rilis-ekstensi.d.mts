/** Deklarasi tipe untuk rilis-ekstensi.mjs - supaya ujinya dapat diperiksa tsc. */
export type HasilPeriksaVersi = {
  ok: boolean;
  pesan: string[];
  samaDenganTertanam: boolean;
};

export function bacaVersiManifest(isiManifest: unknown): string;
export function bacaVersiTertanam(isiTertanam: unknown): string;
export function bacaVersiCatatanTeratas(isiCatatan: unknown): string;
export function periksaVersi(masukan: { manifest: string; tertanam: string; catatan: string }): HasilPeriksaVersi;
export function utama(argv: string[]): Promise<number>;
