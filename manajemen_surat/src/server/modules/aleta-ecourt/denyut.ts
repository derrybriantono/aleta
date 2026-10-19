/**
 * Denyut widget - satu permintaan untuk beberapa bacaan berkala (performa muat
 * 19 Okt 2026, K2).
 *
 * Widget ALETA di halaman SIPP, ABT, dan portal sebelumnya meminta sendiri-
 * sendiri: sumber daya tiap 5 detik, kehadiran sidang tiap menit, checklist
 * tiap 5 menit - masing-masing satu sambungan ke server yang sama dengan SIPP
 * dan ABT. Kini satu GET /api/aleta-ecourt/denyut?bagian=... membawa bagian
 * yang sedang jatuh tempo.
 *
 * ============================================================================
 * ISI TIAP BAGIAN = JAWABAN RUTE LAMANYA, APA ADANYA
 * ============================================================================
 *
 * Tiap bagian dijawab oleh pengendali GET rute lamanya sendiri (dipanggil di
 * dalam proses, dengan kuki yang sama) - kewenangan, singgahan singkat, dan
 * bentuk jawabannya tidak dapat berselisih dengan rute lama, sebab memang
 * kodenya yang sama. Rute lama tetap hidup untuk ekstensi versi lama.
 *
 * Tiap bagian gagal sendiri-sendiri: { status, isi } per bagian, dengan status
 * HTTP rute lamanya (401/403/5xx). Hanya membaca.
 */

export const BAGIAN_DENYUT = ["sumberDaya", "kehadiran", "checklist", "disidang"] as const;
export type BagianDenyut = (typeof BAGIAN_DENYUT)[number];

/** Jalur rute lama tiap bagian (relatif terhadap /api/aleta-ecourt). */
export const JALUR_BAGIAN: Record<BagianDenyut, string> = {
  sumberDaya: "/api/aleta-ecourt/sumber-daya",
  kehadiran: "/api/aleta-ecourt/antrian/kehadiran-saya",
  checklist: "/api/aleta-ecourt/checklist",
  disidang: "/api/aleta-ecourt/sidang/disidang",
};

/** "sumberDaya,kehadiran" -> daftar bagian dikenal, tanpa ganda, urutan baku. */
export function bacaBagianDenyut(teks: string | null | undefined): BagianDenyut[] {
  const diminta = new Set(
    String(teks || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
  return BAGIAN_DENYUT.filter((b) => diminta.has(b));
}

export type JawabanBagian = { status: number; isi: unknown };

/** Membaca satu Response rute lama menjadi { status, isi } - tidak pernah melempar. */
export async function bacaJawabanBagian(jawaban: Response): Promise<JawabanBagian> {
  let isi: unknown = null;
  try {
    isi = await jawaban.json();
  } catch {
    isi = { ok: false, error: { message: "Jawaban bagian bukan JSON." } };
  }
  return { status: jawaban.status, isi };
}
