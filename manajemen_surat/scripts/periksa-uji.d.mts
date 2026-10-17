/** Deklarasi tipe untuk periksa-uji.mjs - supaya ujinya dapat diperiksa tsc. */
export type Triase = {
  berkasGagal: string[];
  habisWaktu: string[];
  salahHasil: string[];
  ringkas: string;
};

export function lingkunganUji(env?: NodeJS.ProcessEnv, cwd?: string): NodeJS.ProcessEnv;
export function bersihkanKeluaran(teks: unknown): string;
export function triaseKeluaran(teks: unknown): Triase;
export function utama(argv: string[]): Promise<number>;
