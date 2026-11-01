/**
 * A2 (1 Nov 2026) - UKUR PENILAI PEMBUKTIAN atas data nyata lokal (salinan SIPP sipp_2810 + ABT aps_badilag_2810, HANYA SELECT).
 *
 * 20 perkara cerai yang sudah putus (10 ditolak + 10 dikabulkan, terbaru dulu, punya keterangan saksi di ABT):
 *   matriks dalil dari posita SIPP (bot matriksDalilService, pembaca yang sama dengan portal) x saksi ABT (sidang terakhir per saksi)
 *   x bukti ABT 1214/9911/1262 -> penilai aturan -> dibandingkan dengan amar sebenarnya.
 * Ramalan aturan per perkara: DAPAT DIKABULKAN bila sedikitnya satu dalil alasan perceraian terbukti / tidak perlu dibuktikan;
 * selain itu BELUM CUKUP (searah dengan ditolak).
 *
 *   NODE_PATH=D:/aleta-dev/wt/w33/aleta_bot/node_modules npx tsx scripts/ukur-penilai-bukti-1nov.mts [--rinci] [--json keluaran.json]
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { nilaiPembuktian, type BuktiMasuk, type SaksiMasuk } from "../src/lib/penilai-bukti";
import { matriksSah } from "../src/lib/matriks-dalil";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const mysql: Apa = req("mysql");
const MD: Apa = req(path.join(AKAR, "aleta_bot/services/matriksDalilService.js"));
const BP: Apa = req(path.join(AKAR, "aleta_bot/services/basPerkara.js"));

const sambung = (db: string) => mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, charset: "latin1_swedish_ci" });
const tanya = (c: Apa, sql: string, p: unknown[] = []): Promise<Apa[]> => new Promise((ok, no) => c.query(sql, p, (e: Error, r: Apa[]) => (e ? no(e) : ok(r))));
const utf = (t: unknown) => {
  const s = String(t == null ? "" : t);
  // Kolom latin1 yang berisi bita UTF-8 (SIPP menyimpan UTF-8 di kolom latin1).
  try {
    const b = Buffer.from(s, "latin1");
    const u = b.toString("utf8");
    return u.includes("\uFFFD") ? s : u;
  } catch {
    return s;
  }
};

async function main() {
  const rinci = process.argv.includes("--rinci");
  const iJson = process.argv.indexOf("--json");
  const sipp = sambung("sipp_2810");
  const abt = sambung("aps_badilag_2810");
  const t0 = Date.now();
  const pilih = async (status: number, n: number) =>
    tanya(
      sipp,
      `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.jenis_perkara_id AS jenis, p.posita, pp.status_putusan_id AS st, pp.putusan_verstek AS verstek
       FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
       WHERE p.jenis_perkara_id IN (346,347) AND pp.status_putusan_id = ? AND LENGTH(p.posita) > 200
         AND p.perkara_id IN (${(await tanya(abt, "SELECT DISTINCT perkara_id AS id FROM abt_keterangan_saksi")).map((r) => Number(r.id)).join(",")})
       ORDER BY pp.tanggal_putusan DESC LIMIT ?`,
      [status, n]
    );
  // Bawaan 10 ditolak + 10 dikabulkan (laporan A2); --tolak N --kabul N untuk sampel lebih besar.
  const angka = (n: string, b: number) => (process.argv.indexOf(n) > 0 ? Number(process.argv[process.argv.indexOf(n) + 1]) || b : b);
  const perkara = [...(await pilih(63, angka("--tolak", 10))), ...(await pilih(62, angka("--kabul", 10)))];
  const hasil: Apa[] = [];
  for (const p of perkara) {
    const sb = p.jenis === 346 ? { P: "Pemohon", T: "Termohon" } : { P: "Penggugat", T: "Tergugat" };
    const m = matriksSah(MD.susunMatriksDalil({ dokumen: [], sebutan: { lawan: sb.P, pelaku: sb.T }, sipp: { posita: utf(p.posita), petitum: "" } }));
    if (!m) continue;
    const meta = new Map((await tanya(sipp, "SELECT id, saksi_pihak_ke AS ke, urutan, keterangan FROM perkara_pihak5 WHERE perkara_id = ?", [p.id])).map((r) => [Number(r.id), r]));
    const jw = await tanya(abt, "SELECT sidang_id, saksi_id, urutan_pertanyaan, pertanyaan, jawaban FROM abt_keterangan_saksi WHERE perkara_id = ? ORDER BY sidang_id, saksi_id, urutan_pertanyaan", [p.id]);
    // Sidang terakhir per saksi (BAS lanjutan menyalin keterangan yang sama).
    const akhir = new Map<number, number>();
    for (const r of jw) akhir.set(Number(r.saksi_id), Math.max(akhir.get(Number(r.saksi_id)) || 0, Number(r.sidang_id)));
    const saksi = new Map<number, SaksiMasuk>();
    for (const r of jw) {
      const sid = Number(r.saksi_id);
      if (Number(r.sidang_id) !== akhir.get(sid)) continue;
      const mt = meta.get(sid) || {};
      const x = saksi.get(sid) || { id: String(sid), pihak: Number(mt.ke) === 2 ? "T" : Number(mt.ke) === 1 ? "P" : "", ke: Number(mt.urutan) || 0, hubungan: utf(mt.keterangan), baris: [] };
      x.baris.push({ tanya: utf(r.pertanyaan), jawab: utf(r.jawaban) });
      saksi.set(sid, x);
    }
    const bkMentah = await tanya(abt, "SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND no_var IN (1214, 9911, 1262)", [p.id]);
    const bukti: BuktiMasuk[] = [];
    for (const b of bkMentah)
      for (const baris of BP.pecahBukti(utf(b.data))) {
        const u = BP.uraiBukti(baris, Number(b.no_var) === 1214 ? "P" : "T");
        if (u) bukti.push({ kode: u.tanda, pihak: u.sisi === "T" ? "T" : "P", jenis: /bukti elektronik|tangkapan layar|screenshot|rekaman/i.test(u.teks) ? "elektronik" : "surat", teks: u.teks });
      }
    const h = nilaiPembuktian(m, [...saksi.values()], bukti, { sebutan: sb, cerai: true });
    // Ramalan dari bahan musyawarah: alasan pokok terbukti DAN (lama pisah tidak disebut ATAU >= 6 bulan).
    const k = h.kesimpulan;
    const kabul = k.alasanTerbukti.length > 0 && !(k.bulanPisah !== null && k.bulanPisah < 6);
    const sebenarnya = p.st === 62 ? "dikabulkan" : "ditolak";
    hasil.push({ nomor: p.nomor, verstek: p.verstek, sebenarnya, ramalan: kabul ? "dapat dikabulkan" : "belum cukup", cocok: (p.st === 62) === kabul, ringkas: h.ringkas, kesimpulan: k, saksi: h.jumlahSaksi, bukti: h.jumlahBukti, dilewati: h.dilewati, ms: h.ms, baris: h.baris });
  }
  sipp.end();
  abt.end();
  const cocok = hasil.filter((x) => x.cocok).length;
  for (const x of hasil) {
    console.log(`${x.cocok ? "COCOK " : "MELESET"} ${x.nomor.padEnd(24)} ${x.sebenarnya.padEnd(10)} -> ${x.ramalan.padEnd(16)} saksi P${x.saksi.P}/T${x.saksi.T} bukti ${x.bukti.surat}+${x.bukti.elektronik}e  ${JSON.stringify(x.ringkas)} pisah=${x.kesimpulan.bulanPisah ?? "-"}bln terbukti=[${x.kesimpulan.alasanTerbukti}] ${x.ms}ms`);
    if (rinci || !x.cocok)
      for (const r of x.baris) console.log(`     ${String(r.nomor || "-").padEnd(5)} ${r.status.padEnd(22)} [${r.topik.join(",")}] ${r.ringkas.slice(0, 90)}\n           ${r.alasan}`);
  }
  console.log(`\nKecocokan: ${cocok}/${hasil.length}  (${Date.now() - t0} ms total)`);
  if (iJson > 0) writeFileSync(process.argv[iJson + 1], JSON.stringify(hasil, null, 1));
}
void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
