/**
 * ============================================================================
 * SELESAIKAN BERKAS (5 Nov 2026, Tahap 6) - mesin langkah yang murni: tanpa SQL, tanpa jaringan, semua kerja nyata disuntikkan
 * ============================================================================
 *
 * Lima pekerjaan menjadi satu tombol:
 *   1. pdf-salinan     PDF salinan bertanda tangan dan cap                     (tidak menulis ke luar)
 *   2. garis-z-nomor   garis Z dan nomor halaman (dibuat bersama langkah 1)    (tidak menulis ke luar)
 *   3. edoc-sipp       unggah ke e-Doc SIPP (PDF BIASA, bukan salinan)         (MENULIS KE SIPP: di balik saklar, bawaan mati)
 *   4. ecourt          unggah ke e-Court (PDF salinan)                         (MENULIS KE e-COURT: di balik saklar, bawaan mati)
 *   5. status-perkara  catatan di Status Perkara                               (hanya tulisan di database ALETA)
 *
 * Aturan keras:
 *   - Langkah yang menulis ke luar TIDAK PERNAH dipanggil bila saklarnya mati; statusnya "dimatikan" dengan alasan, bukan gagal.
 *   - Yang gagal saja yang diulang: langkah yang sudah selesai tidak dijalankan lagi; PDF yang dibutuhkan langkah berikutnya dibuat
 *     ulang di balik layar (tidak mengubah keadaan langkah 1) karena PDF tidak disimpan di mana pun.
 *   - Langkah berikutnya menunggu langkah sebelumnya selesai; satu galat tidak membuat langkah sesudahnya jalan terus (langkah yang
 *     DIMATIKAN tidak menahan langkah sesudahnya).
 *   - Pesan galat dipendekkan dan tidak memuat isi naskah.
 */

export const LANGKAH_SELESAI = [
  { id: "pdf-salinan", judul: "PDF salinan bertanda tangan dan cap", keLuar: false },
  { id: "garis-z-nomor", judul: "Garis Z dan nomor halaman", keLuar: false },
  { id: "edoc-sipp", judul: "Unggah ke e-Doc SIPP", keLuar: true },
  { id: "ecourt", judul: "Unggah ke e-Court", keLuar: true },
  { id: "status-perkara", judul: "Catatan di Status Perkara", keLuar: false },
] as const;

export type IdLangkah = (typeof LANGKAH_SELESAI)[number]["id"];
export type StatusLangkah = "menunggu" | "jalan" | "selesai" | "gagal" | "dimatikan" | "tidak-berlaku";
export type JenisBerkasSelesai = "putusan" | "penetapan" | "bas" | "relaas";

export type KeadaanLangkah = { status: StatusLangkah; pesan: string; percobaan: number; mulai: string; selesai: string };
export type StatusSelesai = "menunggu" | "jalan" | "selesai" | "sebagian" | "gagal";
export type KeadaanSelesai = { langkah: Record<IdLangkah, KeadaanLangkah>; status: StatusSelesai };

export const ID_LANGKAH: readonly IdLangkah[] = LANGKAH_SELESAI.map((l) => l.id);
export const ID_LANGKAH_KE_LUAR: readonly IdLangkah[] = LANGKAH_SELESAI.filter((l) => l.keLuar).map((l) => l.id);
export const judulLangkah = (id: IdLangkah) => LANGKAH_SELESAI.find((l) => l.id === id)!.judul;

const kosong = (): KeadaanLangkah => ({ status: "menunggu", pesan: "", percobaan: 0, mulai: "", selesai: "" });

export function keadaanAwal(): KeadaanSelesai {
  return { langkah: Object.fromEntries(ID_LANGKAH.map((i) => [i, kosong()])) as Record<IdLangkah, KeadaanLangkah>, status: "menunggu" };
}

const STATUS_SAH: readonly StatusLangkah[] = ["menunggu", "jalan", "selesai", "gagal", "dimatikan", "tidak-berlaku"];

/** Membaca keadaan tersimpan (JSON dari database) dengan aman; yang rusak atau kurang dilengkapi dengan "menunggu". */
export function keadaanDariJson(teks: unknown): KeadaanSelesai {
  const k = keadaanAwal();
  try {
    const o = (typeof teks === "string" ? JSON.parse(teks) : teks) as { langkah?: Record<string, Partial<KeadaanLangkah>> } | null;
    for (const id of ID_LANGKAH) {
      const x = o?.langkah?.[id];
      if (!x) continue;
      const st = String(x.status ?? "") as StatusLangkah;
      k.langkah[id] = {
        status: STATUS_SAH.includes(st) ? st : "menunggu",
        pesan: String(x.pesan ?? "").slice(0, 240),
        percobaan: Math.max(0, Math.trunc(Number(x.percobaan) || 0)),
        mulai: String(x.mulai ?? ""),
        selesai: String(x.selesai ?? ""),
      };
    }
  } catch {
    /* keadaan rusak = mulai dari awal */
  }
  k.status = hitungStatus(k);
  return k;
}

const tuntas = (s: StatusLangkah) => s === "selesai" || s === "tidak-berlaku";

export function hitungStatus(k: KeadaanSelesai): StatusSelesai {
  const st = ID_LANGKAH.map((i) => k.langkah[i].status);
  if (st.some((s) => s === "jalan")) return "jalan";
  if (st.every(tuntas)) return "selesai";
  if (st.some((s) => s === "gagal")) return "gagal";
  if (st.some((s) => s === "selesai")) return "sebagian";
  return "menunggu";
}

export type HasilPdfSelesai = {
  pdfBase64: string;
  zcross?: { diubah?: boolean; halamanZ?: number; peringatan?: string[] };
  runut?: { awal?: number; akhir?: number; peringatan?: string[] };
};
export type HasilUnggah = { ok: boolean; pesan: string };

export type DepsSelesai = {
  jenis: JenisBerkasSelesai;
  /** PDF SALINAN (langkah 1, dan yang diunggah ke e-Court). */
  bangunPdf: () => Promise<HasilPdfSelesai>;
  /** PDF BIASA (bukan salinan): yang diunggah ke e-Doc SIPP. Dibuat hanya saat langkah e-Doc benar-benar berjalan. */
  bangunPdfBiasa: () => Promise<HasilPdfSelesai>;
  unggahEdoc: (pdf: HasilPdfSelesai) => Promise<HasilUnggah>;
  unggahEcourt: (pdf: HasilPdfSelesai) => Promise<HasilUnggah>;
  catatStatus: () => Promise<HasilUnggah>;
  /** Saklar tulis ke luar per langkah. Bawaan mati; mati juga bila pembaca saklar sendiri gagal. */
  saklar: (langkah: "edoc-sipp" | "ecourt") => Promise<boolean>;
  /** Dipanggil sesudah tiap perubahan keadaan, supaya yang tersimpan selalu yang terbaru. */
  simpan?: (k: KeadaanSelesai) => Promise<void>;
  kini?: () => string;
};

const pendekkan = (e: unknown) =>
  String((e as { message?: unknown })?.message ?? e ?? "Gagal.")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200) || "Gagal.";

export const PESAN_DIMATIKAN: Record<"edoc-sipp" | "ecourt", string> = {
  "edoc-sipp": "Dimatikan: langkah ini menulis ke SIPP dan saklarnya belum dinyalakan pemilik.",
  ecourt: "Dimatikan: langkah ini menulis ke e-Court dan saklarnya belum dinyalakan pemilik.",
};

/**
 * Menjalankan langkah yang belum tuntas, berurutan. `ulangi` mengosongkan langkah itu lebih dulu (mis. satu langkah yang gagal);
 * tanpa `ulangi`, semua langkah yang belum tuntas dijalankan (yang selesai dilewati).
 */
export async function jalankanSelesai(awal: KeadaanSelesai, deps: DepsSelesai, opsi: { ulangi?: readonly IdLangkah[] } = {}): Promise<KeadaanSelesai> {
  const kini = deps.kini ?? (() => new Date().toISOString());
  const k: KeadaanSelesai = JSON.parse(JSON.stringify(awal));
  for (const id of opsi.ulangi ?? []) {
    k.langkah[id] = { ...kosong(), percobaan: k.langkah[id].percobaan };
  }
  const catat = async () => {
    k.status = hitungStatus(k);
    if (deps.simpan) await deps.simpan(JSON.parse(JSON.stringify(k)));
  };

  let pdf: HasilPdfSelesai | null = null;
  const ambilPdf = async () => (pdf ??= await deps.bangunPdf());
  let pdfBiasa: HasilPdfSelesai | null = null;
  const ambilPdfBiasa = async () => (pdfBiasa ??= await deps.bangunPdfBiasa());

  const mulai = async (id: IdLangkah) => {
    const l = k.langkah[id];
    k.langkah[id] = { ...l, status: "jalan", pesan: "", percobaan: l.percobaan + 1, mulai: kini(), selesai: "" };
    await catat();
  };
  const tutup = async (id: IdLangkah, status: StatusLangkah, pesan: string) => {
    k.langkah[id] = { ...k.langkah[id], status, pesan: pesan.slice(0, 240), selesai: kini() };
    await catat();
  };
  const tunggu = async (id: IdLangkah, pesan: string) => {
    k.langkah[id] = { ...k.langkah[id], status: "menunggu", pesan, mulai: "", selesai: "" };
    await catat();
  };
  const status = (id: IdLangkah) => k.langkah[id].status;

  // 1. PDF salinan
  if (!tuntas(status("pdf-salinan"))) {
    await mulai("pdf-salinan");
    try {
      const h = await ambilPdf();
      if (!h.pdfBase64) throw new Error("PDF belum dapat dibuat.");
      await tutup("pdf-salinan", "selesai", "PDF salinan siap.");
    } catch (e) {
      await tutup("pdf-salinan", "gagal", pendekkan(e));
    }
  }

  // 2. Garis Z dan nomor halaman (hasilnya datang bersama PDF; bila PDF tidak ada, menunggu)
  if (!tuntas(status("garis-z-nomor"))) {
    if (!tuntas(status("pdf-salinan"))) await tunggu("garis-z-nomor", "Menunggu PDF salinan.");
    else {
      await mulai("garis-z-nomor");
      try {
        const h = await ambilPdf();
        const peringatan = [...(h.zcross?.peringatan ?? []), ...(h.runut?.peringatan ?? [])].filter(Boolean);
        if (peringatan.length) await tutup("garis-z-nomor", "gagal", `Perlu dilihat: ${peringatan.join(" ")}`);
        else if (deps.jenis === "bas" && h.zcross?.diubah) {
          await tutup("garis-z-nomor", "selesai", `Garis Z dipasang${h.zcross.halamanZ ? ` di halaman ${h.zcross.halamanZ}` : ""} dan nomor halaman disesuaikan.`);
        } else await tutup("garis-z-nomor", "tidak-berlaku", "Blangko ini tidak memakai garis Z.");
      } catch (e) {
        await tutup("garis-z-nomor", "gagal", pendekkan(e));
      }
    }
  }

  // 3 dan 4. Menulis ke luar: hanya bila saklar menyala, hanya untuk putusan (satu-satunya jenis yang punya jalur unggah),
  // dan hanya sesudah langkah 1-2 tuntas.
  const keLuar = async (id: "edoc-sipp" | "ecourt", unggah: (p: HasilPdfSelesai) => Promise<HasilUnggah>, ambil: () => Promise<HasilPdfSelesai>) => {
    if (tuntas(status(id))) return;
    if (!tuntas(status("pdf-salinan")) || !tuntas(status("garis-z-nomor"))) return tunggu(id, "Menunggu PDF salinan dan garis Z selesai.");
    // Berurutan seperti pekerjaan petugas: e-Court menunggu bila e-Doc SIPP gagal (yang dimatikan tidak menahan).
    if (id === "ecourt" && status("edoc-sipp") === "gagal") return tunggu(id, "Menunggu e-Doc SIPP selesai.");
    if (deps.jenis !== "putusan") return tutup(id, "dimatikan", "Belum ada jalur unggah untuk jenis berkas ini.");
    let menyala = false;
    try {
      menyala = (await deps.saklar(id)) === true;
    } catch {
      menyala = false;
    }
    if (!menyala) return tutup(id, "dimatikan", PESAN_DIMATIKAN[id]);
    await mulai(id);
    try {
      const h = await ambil();
      const r = await unggah(h);
      await tutup(id, r.ok ? "selesai" : "gagal", r.pesan || (r.ok ? "Terunggah." : "Ditolak."));
    } catch (e) {
      await tutup(id, "gagal", pendekkan(e));
    }
  };
  // e-Doc SIPP memakai PDF biasa; e-Court menerima Dokumen Salinan Putusan, yaitu PDF salinan.
  await keLuar("edoc-sipp", deps.unggahEdoc, ambilPdfBiasa);
  await keLuar("ecourt", deps.unggahEcourt, ambilPdf);

  // 5. Catatan: hanya sesudah semua langkah sebelumnya tuntas
  if (!tuntas(status("status-perkara"))) {
    const semuaTuntas = (["pdf-salinan", "garis-z-nomor", "edoc-sipp", "ecourt"] as const).every((i) => tuntas(status(i)));
    if (!semuaTuntas) await tunggu("status-perkara", "Menunggu langkah sebelumnya selesai.");
    else {
      await mulai("status-perkara");
      try {
        const r = await deps.catatStatus();
        await tutup("status-perkara", r.ok ? "selesai" : "gagal", r.pesan);
      } catch (e) {
        await tutup("status-perkara", "gagal", pendekkan(e));
      }
    }
  }
  await catat();
  return k;
}
