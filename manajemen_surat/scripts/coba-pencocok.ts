/**
 * Menjalankan Pencocok SIPP-ABT-e-Court dari ujung ke ujung atas SALINAN basis data lokal, mencetak jumlah perbedaan
 * per jenis dan waktu satu putaran penuh. HANYA MEMBACA.
 *
 *   ALETA_BOT_DB_HOST=127.0.0.1 ALETA_BOT_DB_SIPP_NAME=sipp_2810 ALETA_BOT_DB5_NAME=aps_badilag_2810 \
 *   ALETA_BOT_INTERNAL_DB_NAME=aleta_bot npx tsx scripts/coba-pencocok.ts 2026-10-28 [hariPutus] [--simpan=berkas.json]
 *
 * Argumen 1 = tanggal acuan (salinan lama: tanggal dump). Nama pihak tidak dicetak ke layar; --simpan menulis temuan
 * lengkap ke berkas (untuk memeriksa contoh secara manual) - taruh di luar repo.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cocokkanPerkara, ringkasTemuan, judulJenis, type FaktaPencocok, type BarisTemuan } from "../src/lib/pencocok-data";

const akarBot = path.resolve(process.cwd(), "..", "aleta_bot");
const require_ = createRequire(path.join(akarBot, "package.json"));

const layanan = require_("./services/pencocokFaktaService.js").layanan();

async function utama() {
  const acuan = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : new Date().toISOString().slice(0, 10);
  const hariPutus = Number(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : 180);
  const simpan = (process.argv.find((a) => a.startsWith("--simpan=")) || "").slice(9);
  const kelompok = Number((process.argv.find((a) => a.startsWith("--kelompok=")) || "").slice(11)) || 100;

  // --satu=ID[,ID]: waktu membuka satu perkara (panel) - fakta satu kelompok kecil + aturan.
  const satu = (process.argv.find((a) => a.startsWith("--satu=")) || "").slice(7);
  if (satu) {
    for (const id of satu.split(",")) {
      const a = Date.now();
      const r = await layanan.fakta({ perkaraId: [id], acuan });
      const b = Date.now();
      const f = Object.values(r.fakta)[0] as FaktaPencocok | undefined;
      const t = f ? cocokkanPerkara({ fakta: f, acuan, terbaca: r.terbaca }) : [];
      console.log(`perkara ${id}: fakta ${b - a} ms, aturan ${Date.now() - b} ms, temuan ${t.map((x) => x.jenis).join(",") || "-"}`);
    }
    process.exit(0);
  }

  const t0 = Date.now();
  const semuaId: number[] = [];
  let setelah = 0;
  for (;;) {
    const h = await layanan.daftarLingkup({ acuan, hariPutus, setelahId: setelah, batas: 500 });
    semuaId.push(...h.perkaraId);
    if (!h.berikut) break;
    setelah = h.berikut;
  }
  const tDaftar = Date.now() - t0;

  const barisSemua: Array<BarisTemuan & { petugas?: string }> = [];
  const gagalSemua: Record<string, number> = {};
  let tBot = 0;
  let tAturan = 0;
  let diperiksa = 0;
  for (let i = 0; i < semuaId.length; i += kelompok) {
    const g = semuaId.slice(i, i + kelompok);
    const a = Date.now();
    const r = await layanan.fakta({ perkaraId: g, acuan });
    tBot += Date.now() - a;
    for (const k of Object.keys(r.gagal || {})) gagalSemua[k] = (gagalSemua[k] || 0) + 1;
    const b = Date.now();
    for (const f of Object.values(r.fakta) as FaktaPencocok[]) {
      diperiksa += 1;
      for (const t of cocokkanPerkara({ fakta: f, acuan, terbaca: r.terbaca })) {
        barisSemua.push({
          perkaraId: f.perkaraId,
          nomorPerkara: f.nomorPerkara,
          jenis: t.jenis,
          tingkat: t.tingkat,
          ringkas: t.ringkas,
          sisi: t.sisi,
          majelis: f.majelis.aktif.join(", "),
          panitera: f.majelis.ppAktif.join(", "),
          diperiksaPada: acuan,
          pertamaTerlihat: acuan,
        });
      }
    }
    tAturan += Date.now() - b;
  }
  const total = Date.now() - t0;

  const ring = ringkasTemuan(barisSemua);
  console.log(`acuan ${acuan}  lingkup ${semuaId.length} perkara (belum putus + putus <= ${hariPutus} hari)  kelompok ${kelompok}`);
  console.log(`waktu: daftar ${tDaftar} ms | fakta (bot) ${tBot} ms | aturan ${tAturan} ms | TOTAL ${total} ms  (diperiksa ${diperiksa})`);
  console.log(`temuan ${ring.jumlah} pada ${ring.perkara} perkara  tinggi=${ring.perTingkat.tinggi} sedang=${ring.perTingkat.sedang} rendah=${ring.perTingkat.rendah}`);
  for (const [j, n] of Object.entries(ring.perJenis).sort((x, y) => y[1] - x[1])) console.log(`  ${j.padEnd(26)} ${String(n).padStart(5)}  ${judulJenis(j)}`);
  if (Object.keys(gagalSemua).length) console.log(`sumber gagal (jumlah kelompok): ${JSON.stringify(gagalSemua)}`);
  if (simpan) {
    writeFileSync(simpan, JSON.stringify(barisSemua, null, 1), "utf8");
    console.log(`temuan lengkap ditulis ke ${simpan}`);
  }
  process.exit(0);
}

void utama();
