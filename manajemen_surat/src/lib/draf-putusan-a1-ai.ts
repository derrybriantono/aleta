/**
 * ============================================================================
 * A1 LAPIS 2 (1 Nov 2026) - ALETA Ai MENYEMPURNAKAN DRAF ATURAN (OPSIONAL, SAKLAR ON)
 * ============================================================================
 *
 * Fitur putusan C1-C4 di panel Blangko Derry (lib/aleta-ai/fitur-blangko.ts, jalur pesan/perkiraan ALETA Ai yang sudah ada)
 * mendapat DRAF ATURAN A1 sebagai bahan "MASUKAN PETUGAS": AI menyempurnakan kalimat, tidak menyusun dari nol. Modul ini:
 *
 *   susunMasukanAiA1   draf aturan -> teks masukan: paragraf + tanda, daftar dasar hukum TERVERIFIKASI (satu-satunya yang boleh
 *                      disebut), dalil pihak sebagai kutipan yang wajib dipertahankan, dan nama yang harus disamarkan mesin;
 *   periksaHasilAiA1   hasil AI diperiksa SEBELUM ditampilkan: rujukan pasal di luar rak terverifikasi diberi "[PERLU VERIFIKASI]"
 *                      tepat sesudahnya, pemeriksa kutipan rak (bunyi pasal yang dikutip) dijalankan, kutipan dalil para pihak
 *                      yang berubah ditandai, dan kata "Aleta" dibuang.
 *
 * Hasil AI tetap USULAN; tidak ada jalur yang menulisnya ke SIPP/ABT. Hak sama dengan C1-C4 (hakim/ketua/wakil/Super Admin).
 * Murni: pemeriksa rak disuntik (bawaan di sisi server: bolehDisarankan + periksaNaskah).
 */

import type { DrafPutusanA1 } from "@/lib/draf-putusan-a1";
import { temukanRujukan } from "@/lib/rak-peraturan/rujukan";

export type KodeFiturA1 = "C1" | "C2" | "C3" | "C4";

/** Bagian draf yang menjadi bahan tiap fitur putusan. */
const BAGIAN_FITUR: Record<KodeFiturA1, string[]> = {
  C1: ["alasan", "jawaban", "dalil", "fakta", "penilaian"],
  C2: [],
  C3: ["beban", "bukti", "saksi", "dalil", "fakta"],
  C4: ["jawaban", "dalil", "penilaian"],
};

const BATAS_MASUKAN = 7600;

export type MasukanAiA1 = { masukan: string; samarkan: Array<{ jenis: "NAMA"; nilai: string }> };

/** Draf aturan -> MASUKAN PETUGAS fitur C1-C4 (tanpa nama pihak: sebutan saja; nama dikirim untuk disamarkan mesin). */
export function susunMasukanAiA1(d: DrafPutusanA1, kode: KodeFiturA1, nama: string[] = []): MasukanAiA1 {
  const baris: string[] = [];
  baris.push(`ARAH VARIAN: ${d.arah === "dikabulkan" ? "mengabulkan" : d.arah === "ditolak" ? "menolak" : "tidak dapat diterima"}${d.verstek ? " (verstek)" : ""}. Jangan mengubah arah.`);
  if (d.huruf) baris.push(`HURUF ALASAN: ${d.huruf.split("").join(", ")}.`);
  const dasar = [...new Set(d.dasar.filter((x) => x.terverifikasi).map((x) => x.teks))];
  baris.push(`DASAR HUKUM YANG BOLEH DISEBUT (terverifikasi): ${dasar.length ? dasar.join("; ") : "tidak ada"}. Rujukan lain ditulis dengan [PERLU VERIFIKASI].`);
  const belum = [...new Set(d.dasar.filter((x) => !x.terverifikasi).map((x) => x.teks))];
  if (belum.length) baris.push(`BELUM TERVERIFIKASI (jangan dikutip bunyinya): ${belum.join("; ")}.`);
  if (kode === "C2") {
    baris.push("DRAF AMAR ATURAN:");
    d.amar.butir.forEach((b, i) => baris.push(`${i + 1}. ${b}`));
  } else {
    baris.push("DRAF PERTIMBANGAN ATURAN (sempurnakan kalimatnya, pertahankan urutan, tanda [perlu dilengkapi: ...] dibiarkan):");
    for (const b of d.bagian.filter((x) => !BAGIAN_FITUR[kode].length || BAGIAN_FITUR[kode].includes(x.kunci) || x.kunci === "penilaian")) {
      for (const p of b.paragraf) baris.push([p.teks, ...p.tanda].join(" "));
    }
    const dalil = d.dalil.filter((x) => x.huruf.length || x.pembuktian !== "belum-dinilai").slice(0, 12);
    if (dalil.length) {
      baris.push("DALIL PARA PIHAK (kutip APA ADANYA bila dikutip; status pembuktian dari penilai):");
      for (const x of dalil) baris.push(`- dalil angka ${x.nomor || "?"} (${x.pembuktian.replace(/-/g, " ")}): "${x.teks}"`);
    }
  }
  let masukan = baris.join("\n");
  for (const n of nama.filter((x) => x.trim().length >= 3)) masukan = masukan.split(n).join("[NAMA]");
  if (masukan.length > BATAS_MASUKAN) masukan = `${masukan.slice(0, BATAS_MASUKAN)}\n[... dipotong ...]`;
  return { masukan, samarkan: nama.filter((x) => x.trim().length >= 3).slice(0, 40).map((nilai) => ({ jenis: "NAMA" as const, nilai })) };
}

export type PemeriksaAiA1 = {
  /** Satu rujukan pasal: boleh disebut (terverifikasi di rak)? */
  boleh(teksRujukan: string): { boleh: boolean; sebab: string };
  /** Pemeriksa kutipan rak atas naskah utuh (bunyi pasal yang dikutip). */
  periksaNaskah?(teks: string): Array<{ jenis: string; rujukan: string; pesan: string; pasti: boolean }>;
};

export type HasilPeriksaAiA1 = {
  teks: string;
  pasalDitandai: Array<{ rujukan: string; sebab: string }>;
  temuanKutipan: Array<{ rujukan: string; pesan: string }>;
  kutipanBerubah: Array<{ nomor: string; dalil: string }>;
};

const PENANDA = "[PERLU VERIFIKASI]";

function normal(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .replace(/[‘’“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hasil AI -> diperiksa: pasal di luar rak terverifikasi ditandai, kutipan rak diperiksa, kutipan dalil yang berubah dicatat. */
export function periksaHasilAiA1(hasil: string, d: DrafPutusanA1, periksa: PemeriksaAiA1): HasilPeriksaAiA1 {
  let t = String(hasil ?? "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\baleta(?:\s+ai)?\b/gi, "")
    .replace(/[ \t]{2,}/g, " ");
  const pasalDitandai: HasilPeriksaAiA1["pasalDitandai"] = [];
  // Dari belakang supaya posisi tidak bergeser saat penanda disisipkan.
  const rujukan = temukanRujukan(t).filter((r) => r.peraturan || /pasal/i.test(r.teks));
  for (const r of [...rujukan].sort((a, b) => b.akhir - a.akhir)) {
    const v = r.peraturan && !r.penjelasan ? periksa.boleh(r.teks) : { boleh: false, sebab: r.penjelasan ? "penjelasan pasal tidak diperiksa rak" : "peraturan tidak dikenali" };
    if (v.boleh) continue;
    if (t.slice(r.akhir, r.akhir + PENANDA.length + 2).includes(PENANDA)) continue;
    t = `${t.slice(0, r.akhir)} ${PENANDA}${t.slice(r.akhir)}`;
    pasalDitandai.unshift({ rujukan: r.teks.slice(0, 160), sebab: v.sebab });
  }
  const temuanKutipan = (periksa.periksaNaskah ? periksa.periksaNaskah(t) : []).filter((x) => x.pasti).map((x) => ({ rujukan: x.rujukan, pesan: x.pesan }));
  // Kutipan dalil: bila AI menulis tanda petik berisi awal dalil tetapi isinya tidak sama persis -> ditandai.
  const kutipanBerubah: HasilPeriksaAiA1["kutipanBerubah"] = [];
  const kutip = [...t.matchAll(/["“]([^"”]{25,})["”]/g)].map((m) => m[1]);
  for (const x of d.dalil) {
    const awal = normal(x.teks).slice(0, 30);
    if (awal.length < 20) continue;
    for (const k of kutip) {
      const nk = normal(k);
      if (nk.includes(awal.slice(0, 20)) && !normal(x.teks).includes(nk.replace(/\.\.\.|…/g, "").slice(0, Math.min(nk.length, 200)))) {
        kutipanBerubah.push({ nomor: x.nomor, dalil: x.teks.slice(0, 160) });
        break;
      }
    }
  }
  return { teks: t.trim(), pasalDitandai, temuanKutipan, kutipanBerubah };
}
