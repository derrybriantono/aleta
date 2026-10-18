// Tahap 1 daftar cek: menyusun isian tangan (popup) tiap blangko Derry.
// Dijalankan dari manajemen_surat/:  npx tsx ../scripts/isi-sipp-abt/analisa-isian.mts <keluaran.json>
// Sumber: pohon server 17 Okt (fixture), RTF terbaru dari paket/arsip lokal, katalog ABT lokal (aps_badilag_i18).
// Tidak menulis ke SIPP/ABT; hanya SELECT pada salinan lokal.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const akar = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(akar, "aleta_bot", "package.json"));
const mysql = req("mysql");
const { satukanPenandaTerpecah } = req(path.join(akar, "aleta_bot", "services", "abtMesinVariabel.js"));
const { indeksRtf } = await import(pathToFileURL(path.join(akar, "scripts", "isi-sipp-abt", "indeks-rtf.mjs")).href);
const { susunIsian, rujukan } = await import(pathToFileURL(path.join(process.cwd(), "src/app/api/aleta-ecourt/blangko-derry/susun.ts")).href);

const KELUAR = process.argv[2];
const SKEMA_KATALOG = process.env.SKEMA_KATALOG || "aps_badilag_i18"; // 18 Okt: skema scratch aps_badilag_pm55 = i18 + variabel paket I19-I23

function kueri(db: string, sql: string): Promise<any[]> {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, charset: "latin1", typeCast: (f: any) => f.string() });
  return new Promise((ok, gagal) => kon.query(sql, (e: any, r: any) => { kon.end(); e ? gagal(e) : ok(r); }));
}

const fx = JSON.parse(fs.readFileSync("src/test/fixtures/blangko-derry-server-17okt.json", "utf8"));
const rtf = indeksRtf();
const baris = await kueri(SKEMA_KATALOG, "SELECT no_var, nama, data_type, sql_query, default_data FROM abt_variabel");
const katalog = new Map<string, any>();
for (const b of baris) {
  const kode = String(b.no_var).replace(/^0+(?=\d{4})/, (m: string) => m); // no_var zerofill 4 digit
  katalog.set(kode, { kode, nama: String(b.nama ?? ""), jenis: String(b.data_type ?? ""), sql: String(b.sql_query ?? ""), bawaan: String(b.default_data ?? "") });
}

const hasil: any[] = [];
for (const jalur of fx.berkas as string[]) {
  const sumber = rtf.get(jalur);
  const mentah = fs.readFileSync(sumber.p, "latin1");
  const teks = satukanPenandaTerpecah(mentah).rtf as string;
  const penanda = [...new Set([...teks.matchAll(/#(\d{3,5})#/g)].map((m) => m[1]))];
  const s = susunIsian(penanda, katalog);
  // Penutup rantai (semua variabel yang tampil di halaman ABT blangko ini): penanda RTF + rujukan berantai.
  const tutup = new Set<string>();
  const tumpuk = [...penanda];
  while (tumpuk.length) {
    const k = tumpuk.shift() as string;
    if (tutup.has(k)) continue;
    tutup.add(k);
    const d = katalog.get(k);
    if (d) for (const r of rujukan(d)) if (!tutup.has(r)) tumpuk.push(r);
  }
  const m = jalur.match(/^derry_briantono\/([^/]+)\/([^/]+)$/);
  hasil.push({
    jalur,
    folder: m?.[1] ?? "",
    berkas: m?.[2] ?? "",
    sumberRtf: sumber.p,
    penanda,
    tutup: [...tutup].filter((k) => katalog.has(k)),
    isian: s.isian.map((i: any) => ({ kode: i.kode, nama: i.nama, namaAsli: i.namaAsli, jenis: i.jenis, wajib: i.wajib, tingkat: i.tingkat, pemicu: i.pemicu, keadaan: i.keadaan, langsung: i.langsung, bawaan: i.bawaan.slice(0, 120), tj: i.tj ? i.tj.kunci : "" })),
    otomatis: s.otomatis.map((o: any) => ({ kode: o.kode, jenis: o.jenis })),
    takDikenal: s.takDikenal,
  });
}
fs.writeFileSync(KELUAR, JSON.stringify({ skemaKatalog: SKEMA_KATALOG, jumlahKatalog: katalog.size, blangko: hasil }, null, 1));
console.log("blangko", hasil.length, "katalog", katalog.size);
