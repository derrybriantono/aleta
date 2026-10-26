/**
 * UKUR KETEPATAN PEMBACA BERKAS e-COURT SELAIN GUGATAN (G2, 25 Okt 2026) - dijalankan di LAPTOP atas berkas sungguhan.
 *
 *   npx tsx scripts/ukur-berkas-ecourt-g2.mts <folder-berkas> [--keluar=<berkas.json>]
 *
 * Folder berisi salinan berkas e-Court (PDF/DOCX) yang diunduh sendiri oleh pengembang - BERKAS ASLI TIDAK PERNAH MASUK REPO dan skrip
 * ini TIDAK mencetak isi, nama pihak, nama berkas, atau nomor perkara. Keluarannya hanya ANGKA: berapa berkas, berapa yang rapi, dan
 * alasan tidak rapi yang paling sering (alasan = kalimat baku dari pembaca, bukan kutipan berkas).
 *
 * Penamaan berkas (jenis dan pengunggah tidak dapat ditebak dari isi):
 *
 *     <apa-saja>__<Jenis>__<Pengunggah>__<yyyy-mm-dd>.pdf
 *     contoh: a1__Replik__Penggugat__2026-07-08.pdf     b7__Daftar Bukti__Tergugat__2026-07-08.docx
 *
 * Jenis: Jawaban, Replik, Duplik, Kesimpulan, Daftar Bukti. Pengunggah: Penggugat, Tergugat, Pemohon, Termohon, Turut Tergugat.
 *
 * Yang diukur per jenis:
 *   - Jawaban/Replik/Duplik/Kesimpulan: jenis dikenali, tanya-jawab rapi (ukuran JJ2), dan - hanya pada replik/duplik - berapa yang
 *     tadinya tidak rapi karena tata letak dan kini rapi berkat pembersih G2 (bandingannya: tanpa perapian baris per halaman);
 *   - Daftar Bukti: berapa butir terbaca, berapa daftar rapi untuk ditulis otomatis, dan alasan tidak rapi.
 * Ambang rapi (tanyaJawabEcourtService.AMBANG, buktiEcourtService.AMBANG_BUKTI) disesuaikan dari angka ini SESUDAH diukur, bukan sebelumnya.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { bacaTeksJawaban } from "../src/server/modules/aleta-ecourt/penanda-jawaban";

const req = createRequire(import.meta.url);
const bot = (p: string) => req("../../aleta_bot/" + p);
const J = bot("services/jawabMenjawabEcourtService.js");
const TJ = bot("services/tanyaJawabEcourtService.js");
const B = bot("services/buktiEcourtService.js");

const args = process.argv.slice(2);
const DIR = args.find((a) => !a.startsWith("--")) || "";
const KELUAR = (args.find((a) => a.startsWith("--keluar=")) || "").slice(9);
if (!DIR || !fs.existsSync(DIR)) {
  console.error("Pakai: npx tsx scripts/ukur-berkas-ecourt-g2.mts <folder-berkas> [--keluar=<berkas.json>]");
  process.exit(1);
}

const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };
const KODE_PIHAK: Record<string, string> = { penggugat: "0046", pemohon: "0046", tergugat: "0047", termohon: "0047", "turut tergugat": "0047", "turut termohon": "0047" };
const tanpaOcr = { ocrAda: async () => false, ocrGambar: async () => "", halamanPdf: async () => [] as Buffer[] };

type Hitungan = { berkas: number; terbaca: number; rapi: number; alasan: Record<string, number>; butir: number[] };
const kosong = (): Hitungan => ({ berkas: 0, terbaca: 0, rapi: 0, alasan: {}, butir: [] });
const hasil: Record<string, Hitungan & { bandingTanpaPerapian?: { rapi: number } }> = {};
const jumlah = (h: Hitungan, alasan: string[]) => {
  for (const a of alasan) h.alasan[a] = (h.alasan[a] || 0) + 1;
};

async function main() {
  const berkas = fs.readdirSync(DIR).filter((f) => /\.(pdf|docx)$/i.test(f));
  for (const f of berkas) {
    const bagian = path.basename(f, path.extname(f)).split("__");
    if (bagian.length < 4) continue;
    const jenis = bagian[1]!.trim();
    const pengunggah = bagian[2]!.trim();
    const diunggah = bagian[3]!.trim();
    const h = (hasil[jenis] ||= { ...kosong() });
    h.berkas += 1;
    const t = await bacaTeksJawaban(fs.readFileSync(path.join(DIR, f)), tanpaOcr).catch(() => ({ teks: "", sumber: "" as const, sebab: "gagal" }));
    if (!t.teks) {
      jumlah(h, [`teks tidak terbaca (${t.sebab || "kosong"})`]);
      continue;
    }
    h.terbaca += 1;
    const kodePihak = KODE_PIHAK[pengunggah.toLowerCase()] || "";
    if (/^daftar bukti$/i.test(jenis)) {
      const u = B.uraiDaftarBukti(t.teks, pengunggah);
      h.butir.push(u.butir.length);
      const m = B.susunBukti({ daftar: [{ judul: "Daftar Bukti", teks: t.teks, baca: "teks", pengunggah, penuntutKode: kodePihak }], berkasBukti: [], posita: "", sebutan: SEBUTAN, otomatis: true });
      const pihak = ["P", "T"].map((x) => m.otomatis[x]).filter((x: { rapi: boolean; alasan: string[] }) => x.alasan.length || x.rapi);
      if (!pihak.length) jumlah(h, ["tidak ada butir bukti terbaca"]);
      for (const p of pihak) {
        if (p.rapi) h.rapi += 1;
        else jumlah(h, p.alasan);
      }
      continue;
    }
    const k = J.kenaliJenis({ jenis, judul: jenis, pengunggah, penuntutKode: kodePihak, teks: t.teks });
    const r = TJ.tanyaJawabDariSurat({ teks: t.teks, k, sebutan: SEBUTAN, diunggah, denganKesimpulan: true });
    h.butir.push(r.ukuran?.butir ?? 0);
    if (r.rapi) h.rapi += 1;
    else jumlah(h, r.alasan);
    // Pembanding tata letak (replik/duplik): perapian baris per halaman dimatikan sementara = pembersih sebelum G2.
    if (/^(replik|duplik)$/i.test(jenis)) {
      const banding = (h.bandingTanpaPerapian ||= { rapi: 0 });
      J.aturPerapianBaris(false);
      try {
        const rl = TJ.tanyaJawabDariSurat({ teks: t.teks, k: J.kenaliJenis({ jenis, judul: jenis, pengunggah, penuntutKode: kodePihak, teks: t.teks }), sebutan: SEBUTAN, diunggah });
        if (rl.rapi) banding.rapi += 1;
      } finally {
        J.aturPerapianBaris(true);
      }
    }
  }

  const ringkas = Object.fromEntries(
    Object.entries(hasil).map(([jenis, h]) => {
      const alasan = Object.entries(h.alasan)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      const rata = h.butir.length ? Math.round((h.butir.reduce((a, b) => a + b, 0) / h.butir.length) * 10) / 10 : 0;
      return [jenis, { berkas: h.berkas, terbaca: h.terbaca, rapi: h.rapi, persenRapi: h.terbaca ? Math.round((h.rapi / h.terbaca) * 1000) / 10 : 0, rataButir: rata, bandingTanpaPerapian: h.bandingTanpaPerapian, alasanTeratas: alasan }];
    })
  );
  const teks = JSON.stringify({ ukuran: "G2", folder: "(tidak dicetak)", jenis: ringkas }, null, 2);
  if (KELUAR) fs.writeFileSync(KELUAR, teks, "utf8");
  console.log(teks);
}

void main();
