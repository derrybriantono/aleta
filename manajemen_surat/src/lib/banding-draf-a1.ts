/**
 * ============================================================================
 * A1 -> P3 (1 Nov 2026) - PEMBANDING DRAF PUTUSAN OTOMATIS DENGAN PUTUSAN AKHIR
 * ============================================================================
 *
 * Satu pembanding untuk dua pemakai:
 *   - ukur A1 (uji draf-putusan-a1-1nov: 10 perkara cerai yang sudah putus) dan
 *   - P3 "pengukur draf vs putusan akhir" (selisih draf A1 dengan putusan yang ditandatangani -> pola koreksi hakim).
 *
 * Tiga ukuran:
 *   amar         tiap butir amar akhir dicari padanannya di amar draf (tumpang kata); sama / mirip / hilang / lebih;
 *   dasar hukum  rujukan pasal (pembaca rujukan rak P1) di pertimbangan akhir vs draf: sama, sama-bertanda (draf menyebutnya
 *                sebagai "belum terverifikasi" - tidak ditulis, diberi tanda), hilang, lebih;
 *   bagian       paragraf pertimbangan akhir digolongkan per topik; topik yang ada di putusan akhir tetapi tidak di draf = hilang.
 *
 * Murni: tanpa basis data. Masukan putusan akhir = teks SIPP (amar_putusan HTML, perkara_pertimbangan_hukum HTML).
 */

import type { DrafPutusanA1, KunciBagianA1 } from "@/lib/draf-putusan-a1";
import { kataIsiA1 } from "@/lib/draf-putusan-a1";
import { temukanRujukan } from "@/lib/rak-peraturan/rujukan";

export type PutusanAkhir = { amarHtml: string; pertimbanganHtml: string; huruf8503?: string };

export type HasilBandingA1 = {
  amar: { akhir: number; draf: number; sama: number; mirip: number; hilang: string[]; lebih: string[] };
  dasar: { akhir: string[]; sama: string[]; samaBertanda: string[]; hilang: string[]; lebih: string[] };
  bagian: { akhir: TopikPertimbangan[]; hilang: TopikPertimbangan[] };
  huruf: { draf: string; akhir: string; sama: boolean };
};

const ENTITAS: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&lt;": "<", "&gt;": ">" };

/** HTML SIPP -> teks polos berbaris (paragraf / butir daftar per baris). */
export function polosHtml(html: string): string {
  return String(html ?? "")
    .replace(/\\n/g, "\n")
    .replace(/<\s*(?:br|\/p|\/li|\/div|\/h\d|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITAS[e.toLowerCase()] ?? " ")
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .join("\n");
}

/** Butir amar dari HTML amar SIPP (<ol><li> atau baris bernomor). */
export function butirAmarAkhir(html: string): string[] {
  return polosHtml(html)
    .split("\n")
    .map((x) => x.replace(/^\s*(?:\d{1,2}|[a-z])\s*[.)]\s*/i, "").trim())
    .filter((x) => x.length > 8 && !/^(?:mengadili|dalam\s+(?:konvensi|rekonvensi|pokok\s+perkara|eksepsi))\s*[:;]?$/i.test(x));
}

function tumpang(a: string, b: string): number {
  const x = kataIsiA1(a);
  const y = kataIsiA1(b);
  if (!x.size || !y.size) return 0;
  let sama = 0;
  for (const k of x) if (y.has(k)) sama += 1;
  return sama / Math.max(x.size, y.size);
}

/** Ambang padanan butir amar (tumpang kata isi terhadap butir yang lebih panjang). */
export const AMBANG_AMAR = { sama: 0.75, mirip: 0.45 };

export type TopikPertimbangan =
  | "pokok"
  | "kehadiran"
  | "damai"
  | "mediasi"
  | "pns"
  | "alasan"
  | "jawaban"
  | "beban"
  | "bukti"
  | "saksi"
  | "kesimpulan"
  | "fakta"
  | "penilaian"
  | "sema"
  | "kaidah"
  | "biaya"
  | "elektronik"
  | "rekonvensi"
  | "akibat-cerai";

/** Topik -> bagian draf yang menjawabnya. */
const BAGIAN_TOPIK: Record<TopikPertimbangan, KunciBagianA1[]> = {
  pokok: ["pokok"],
  kehadiran: ["kehadiran"],
  damai: ["damai"],
  mediasi: ["damai"],
  pns: ["pokok"],
  alasan: ["alasan"],
  jawaban: ["jawaban"],
  beban: ["beban"],
  bukti: ["bukti"],
  saksi: ["saksi"],
  kesimpulan: ["saksi"],
  fakta: ["fakta"],
  penilaian: ["penilaian"],
  sema: ["penilaian"],
  kaidah: [],
  biaya: ["biaya"],
  elektronik: ["elektronik"],
  rekonvensi: [],
  "akibat-cerai": [],
};

const POLA_TOPIK: Array<[TopikPertimbangan, RegExp]> = [
  ["pokok", /maksud\s+dan\s+tujuan/i],
  ["pns", /pegawai\s+negeri|PNS|izin\s+atasan|PP\s*10|Nomor\s+10\s+Tahun\s+1983/i],
  ["mediasi", /mediasi|mediator/i],
  ["damai", /menasihati|menasehati|nasihat|nasehat|mendamaikan|merukunkan/i],
  ["kehadiran", /tidak\s+(?:pernah\s+)?hadir|telah\s+hadir|dipanggil\s+secara\s+resmi|verstek/i],
  ["rekonvensi", /rekonvensi/i],
  ["akibat-cerai", /nafkah\s+iddah|mut'?ah|madliyah|madhiyah|hadhanah|hadanah|pemeliharaan\s+anak|nafkah\s+anak/i],
  ["jawaban", /jawaban|replik|duplik|membantah|mengakui/i],
  ["beban", /(?:wajib|berkewajiban|dibebani)\s+(?:untuk\s+)?membuktikan|beban\s+pembuktian|Pasal\s+283/i],
  ["kesimpulan", /kesimpulan/i],
  ["saksi", /saksi/i],
  ["bukti", /bukti\s+(?:surat\s+)?[PT][.\-]?\s*\d|fotokopi|bermeterai|akta\s+autentik/i],
  ["fakta", /fakta\s+hukum|fakta-fakta|ditemukan\s+fakta/i],
  ["sema", /SEMA|Surat\s+Edaran\s+Mahkamah\s+Agung/i],
  ["kaidah", /kaidah|fikih|fiqh|Al-?Qur|hadits|hadis|artinya\s*:/i],
  ["biaya", /biaya\s+perkara/i],
  ["elektronik", /elektronik/i],
  ["alasan", /alasan\s+perceraian|Pasal\s+19\s+huruf|Pasal\s+116\s+huruf/i],
  ["penilaian", /patut\s+dikabulkan|dapat\s+dikabulkan|harus\s+ditolak|patut\s+ditolak|tidak\s+dapat\s+diterima|break\s*down|pecah/i],
];

/** Topik-topik satu naskah pertimbangan (urutan muncul pertama). */
export function topikPertimbangan(polos: string): TopikPertimbangan[] {
  const out: TopikPertimbangan[] = [];
  for (const p of polos.split("\n")) {
    for (const [t, re] of POLA_TOPIK) {
      if (re.test(p)) {
        if (!out.includes(t)) out.push(t);
        break;
      }
    }
  }
  return out;
}

/** Kunci rujukan "KODE|pasal" (ayat/huruf diabaikan: yang dibandingkan pasal yang dirujuk). */
export function kunciRujukan(polos: string): string[] {
  const out = new Set<string>();
  for (const r of temukanRujukan(polos)) {
    if (!r.peraturan || r.penjelasan) continue;
    for (const b of r.butir) out.add(`${r.peraturan}|${b.pasal}`);
  }
  return [...out].sort();
}

function hurufDari(polos: string): string {
  const set = new Set<string>();
  for (const m of polos.matchAll(/Pasal\s+(?:19|116)\s+huruf\s*\(?\s*([a-h])\b/gi)) set.add(m[1].toUpperCase());
  return [...set].sort().join("");
}

export function bandingDrafA1(draf: DrafPutusanA1, akhir: PutusanAkhir): HasilBandingA1 {
  // ── Amar ────────────────────────────────────────────────────────────────
  const amarAkhir = butirAmarAkhir(akhir.amarHtml);
  const amarDraf = draf.amar.butir.map((b) => b.replace(/^\s*\d{1,2}\s*[.)]\s*/, ""));
  const dipakai = new Set<number>();
  let sama = 0;
  let mirip = 0;
  const hilang: string[] = [];
  for (const a of amarAkhir) {
    let terbaik = -1;
    let skor = 0;
    amarDraf.forEach((d, i) => {
      if (dipakai.has(i)) return;
      const s = tumpang(a, d);
      if (s > skor) {
        skor = s;
        terbaik = i;
      }
    });
    if (terbaik >= 0 && skor >= AMBANG_AMAR.mirip) {
      dipakai.add(terbaik);
      if (skor >= AMBANG_AMAR.sama) sama += 1;
      else mirip += 1;
    } else hilang.push(a);
  }
  const lebih = amarDraf.filter((_, i) => !dipakai.has(i));

  // ── Dasar hukum ─────────────────────────────────────────────────────────
  const polosAkhir = polosHtml(akhir.pertimbanganHtml);
  const dasarAkhir = kunciRujukan(polosAkhir);
  const terverifikasi = new Set(kunciRujukan(draf.dasar.filter((d) => d.terverifikasi).map((d) => d.teks).join("\n")));
  const bertanda = new Set(kunciRujukan(draf.dasar.filter((d) => !d.terverifikasi).map((d) => d.teks).join("\n")));
  const dasar = {
    akhir: dasarAkhir,
    sama: dasarAkhir.filter((k) => terverifikasi.has(k)),
    samaBertanda: dasarAkhir.filter((k) => !terverifikasi.has(k) && bertanda.has(k)),
    hilang: dasarAkhir.filter((k) => !terverifikasi.has(k) && !bertanda.has(k)),
    lebih: [...terverifikasi].filter((k) => !dasarAkhir.includes(k)).sort(),
  };

  // ── Bagian ──────────────────────────────────────────────────────────────
  const topik = topikPertimbangan(polosAkhir);
  const adaDi = new Set(draf.bagian.filter((b) => b.paragraf.length).map((b) => b.kunci));
  const bagianHilang = topik.filter((t) => !BAGIAN_TOPIK[t].some((k) => adaDi.has(k)));

  const hurufAkhir = hurufDari(polosAkhir) || String(akhir.huruf8503 ?? "").toUpperCase().replace(/[^A-H]/g, "").split("").sort().join("");
  return {
    amar: { akhir: amarAkhir.length, draf: amarDraf.length, sama, mirip, hilang, lebih },
    dasar,
    bagian: { akhir: topik, hilang: bagianHilang },
    huruf: { draf: draf.huruf, akhir: hurufAkhir, sama: Boolean(hurufAkhir) && hurufAkhir === draf.huruf },
  };
}
