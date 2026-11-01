import { KELOMPOK_PUTUSAN } from "@/lib/aleta-ai/rute";
import { LABEL_STATUS, type HasilPenilaian, type StatusPembuktian } from "@/lib/penilai-bukti";
import { saringSaranAi } from "@/lib/rak-peraturan/indeks";

/**
 * ============================================================================
 * A2 (1 Nov 2026) - PENILAI PEMBUKTIAN, LAPIS 2: ALETA Ai (opsional, murni)
 * ============================================================================
 *
 * Penilaian lanjutan atas TABEL ATURAN (lib/penilai-bukti.ts) lewat jalur ALETA Ai panel Blangko Derry yang sudah ada (saklar,
 * saldo, samaran, batas, jejak). Berkas ini hanya:
 *   - DEFINISI fitur "C6" (bentuk sama dengan entri FITUR_BLANGKO di lib/aleta-ai/fitur-blangko.ts, cabang ai-blangko) - didaftarkan
 *     saat cabang digabung (satu baris di FITUR_BLANGKO + satu di FITUR inti ekstensi);
 *   - BAHAN: tabel aturan sebagai teks (tanpa nama saksi; kutipan pendek; disamarkan lagi oleh mesin samaran sebelum keluar);
 *   - PENGURAI jawaban: hanya id dalil yang ada di tabel, hanya 4 status sah, pasal HANYA yang terverifikasi di rak peraturan
 *     (saringSaranAi) - pasal lain dibuang dan dicatat. Hasil = USULAN; tidak pernah menimpa status aturan atau tetapan majelis.
 */

const STATUS_SAH: readonly StatusPembuktian[] = ["terbukti", "belum-terbukti", "bertentangan", "tidak-perlu-dibuktikan"];

export const TUGAS_PENILAIAN_AI = [
  "Anda menilai ulang TABEL PENILAIAN PEMBUKTIAN (bagian TEMUAN PEMERIKSA) yang disusun aturan dari keterangan saksi dan alat bukti, sebagai bahan musyawarah majelis.",
  "Untuk tiap dalil, periksa apakah status aturan sudah tepat menurut hukum pembuktian perdata: keterangan satu saksi tanpa alat bukti lain tidak cukup; dua saksi harus saling bersesuaian; keterangan dari cerita orang lain (de auditu) lemah; akta otentik bukti sempurna; dalil yang diakui tegas tidak perlu dibuktikan.",
  "Perhatikan juga: kesesuaian isi keterangan dengan dalil (bukan sekadar kata yang sama), sumber pengetahuan saksi, keterangan yang saling bertentangan, dan dalil yang belum ditanyakan kepada saksi.",
  "Jangan mengubah dalil yang statusnya sudah tepat. Jangan menentukan arah putusan.",
  'Jawab HANYA dengan satu array JSON tanpa teks lain: [{"id":"<id dalil persis seperti di tabel>","status":"terbukti|belum-terbukti|bertentangan|tidak-perlu-dibuktikan","alasan":"satu atau dua kalimat","pasal":["Pasal 309 RBg"]}]. Masukkan hanya dalil yang statusnya Anda usulkan berubah atau perlu catatan. Array kosong [] bila semua sudah tepat.',
].join("\n");

/** Definisi fitur ALETA Ai (bentuk entri FITUR_BLANGKO). Kelompok putusan: hanya hakim/ketua/wakil/Super Admin. */
export const FITUR_PENILAIAN_AI = {
  kode: "C6",
  judul: "Penilaian pembuktian lanjutan",
  tahap: 2,
  kelompok: KELOMPOK_PUTUSAN,
  kemampuan: "draf-putusan",
  keluaran: "teks",
  butuh: ["perkara", "posita", "teksPihak", "saksi", "temuan", "masukan"],
  wajib: ["temuan"],
  tugas: TUGAS_PENILAIAN_AI,
} as const;

/** Tabel aturan sebagai bahan "temuan" (sama dengan teksUntukAi di panel). */
export function bahanPenilaianAi(h: HasilPenilaian): string {
  return h.baris
    .map((r) => {
      const s = r.saksi.map((x) => `${x.label}${x.sikap === "sebaliknya" ? " (sebaliknya)" : x.langsung ? "" : " (dari cerita)"}: "${x.kutipan}"`).join("; ");
      const b = r.bukti.map((x) => x.label).join(", ");
      return `[${r.id}] Dalil ${r.nomor || "-"}: ${r.ringkas}\n  Status aturan: ${LABEL_STATUS[r.status]} - ${r.alasan}\n  Saksi: ${s || "-"}\n  Bukti: ${b || "-"}`;
    })
    .join("\n");
}

export type UsulanAi = {
  id: string;
  status: StatusPembuktian;
  statusAturan: StatusPembuktian;
  berubah: boolean;
  alasan: string;
  /** Pasal yang terverifikasi di rak peraturan. */
  pasal: string[];
  /** Pasal yang dibuang karena tidak terverifikasi (dicatat, tidak ditampilkan sebagai dasar). */
  pasalDitolak: Array<{ teks: string; sebab: string }>;
};

/** Ambil array JSON pertama dari jawaban model (boleh dibungkus teks/pagar kode). */
function arrayJson(teks: string): unknown[] {
  const s = String(teks || "");
  const a = s.indexOf("[");
  const z = s.lastIndexOf("]");
  if (a < 0 || z <= a) return [];
  try {
    const v = JSON.parse(s.slice(a, z + 1));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Urai jawaban ALETA Ai menjadi usulan yang aman dipakai (lihat kepala berkas). */
export function uraiUsulanAi(jawaban: string, h: HasilPenilaian): UsulanAi[] {
  const per = new Map(h.baris.map((r) => [r.id, r]));
  const hasil: UsulanAi[] = [];
  const sudah = new Set<string>();
  for (const x of arrayJson(jawaban)) {
    const o = (x || {}) as Record<string, unknown>;
    const id = String(o.id || "").trim();
    const r = per.get(id);
    const status = String(o.status || "").trim() as StatusPembuktian;
    if (!r || sudah.has(id) || !STATUS_SAH.includes(status)) continue;
    sudah.add(id);
    const saran = (Array.isArray(o.pasal) ? o.pasal : []).map((p) => String(p || "").slice(0, 200)).filter(Boolean).slice(0, 6);
    const tapis = saran.length ? saringSaranAi(saran) : { boleh: [] as string[], ditolak: [] as Array<{ teks: string; sebab: string }> };
    hasil.push({
      id,
      status,
      statusAturan: r.status,
      berubah: status !== r.status,
      alasan: String(o.alasan || "").replace(/\s+/g, " ").trim().slice(0, 600),
      pasal: tapis.boleh,
      pasalDitolak: tapis.ditolak,
    });
  }
  return hasil;
}
