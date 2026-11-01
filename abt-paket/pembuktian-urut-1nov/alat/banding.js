// Banding kueri lama (paket tanggal-agenda-31okt) vs baru (paket pembuktian-urut-1nov) atas perkara nyata salinan SIPP, DAN
// kecocokan kueri baru dengan kembarannya di bot (aleta_bot/services/tahapPembuktianService.js mulaiTahap) bila Court Calendar
// tidak memuat agenda pembuktian itu. Baris PERTAMA tiap kueri (yang dipakai ABT).
// pakai: node banding.js <basis SIPP> <tanggal daftar mulai> [keluaran.json]   (NODE_PATH = node_modules bot yang memuat mysql)
const mysql = require("mysql");
const fs = require("fs");
const path = require("path");
const T = require(path.join(__dirname, "../../../aleta_bot/services/tahapPembuktianService.js"));
const [db, mulai, keluar] = process.argv.slice(2);
const baris = fs.readFileSync(path.join(__dirname, "../hasil/kueri-lama-baru.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
const c = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, dateStrings: true });
const q = (s, a) => new Promise((ok, no) => c.query(s, a, (e, r) => (e ? no(e) : ok(r))));
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const hari = (t) => (t ? HARI[new Date(`${t}T00:00:00Z`).getUTCDay()] : "");
const PIHAK = { 2111: "P", 7119: "P", 2112: "T", 7121: "T" };
const CC = { P: "(rencana_agenda LIKE '%pembuktian penggugat%' OR rencana_agenda LIKE '%pembuktian pemohon%')", T: "(rencana_agenda LIKE '%pembuktian tergugat%' OR rencana_agenda LIKE '%pembuktian termohon%')" };
(async () => {
  const pk = await q(`SELECT perkara_id id, nomor_perkara no FROM perkara WHERE tanggal_pendaftaran >= ?`, [mulai]);
  const js = await q(`SELECT j.id, j.perkara_id pid, j.tanggal_sidang tg, j.agenda a, j.alasan_ditunda d, j.keterangan k FROM perkara_jadwal_sidang j
    JOIN perkara p ON p.perkara_id = j.perkara_id WHERE p.tanggal_pendaftaran >= ? ORDER BY j.perkara_id, j.tanggal_sidang, j.id`, [mulai]);
  const per = new Map();
  for (const x of js) (per.get(x.pid) || per.set(x.pid, []).get(x.pid)).push({ sidangId: x.id, tanggalSidang: x.tg, agenda: x.a, alasanDitunda: x.d, keterangan: x.k });
  const hasil = {};
  for (const [no, lama, baru] of baris) {
    const L = lama.split("\\n").join("\n").replace(/;\s*$/, ""), B = baru.split("\\n").join("\n").replace(/;\s*$/, "");
    const h = (hasil[no] = { n: 0, samaTerisi: 0, samaKosong: 0, baruTerisi: 0, hilang: 0, berubahTerisi: 0, galat: 0, cocokBot: 0, bedaBot: 0, contoh: [], bedaBotContoh: [] });
    for (const p of pk) {
      h.n++;
      try {
        const a = await q(L.split("#perkara_id#").join(p.id)), b = await q(B.split("#perkara_id#").join(p.id));
        const fa = a.length ? String(a[0].data) : "(tanpa baris)";
        const fb = b.length ? String(b[0].data) : "(tanpa baris)";
        if (fa === fb) fa === "" ? h.samaKosong++ : h.samaTerisi++;
        else if (fa === "") { h.baruTerisi++; h.contoh.push(["BARU", p.no, fb]); }
        else if (fb === "") { h.hilang++; h.contoh.push(["HILANG", p.no, fa]); }
        else { h.berubahTerisi++; h.contoh.push(["BERUBAH", p.no, fa, fb]); }
        // Kembaran bot: hanya bila Court Calendar tidak memuat agenda itu (cabang Court Calendar dijalankan lebih dulu, tidak diubah).
        const pihak = PIHAK[no];
        const cc = await q(`SELECT COUNT(*) n FROM perkara_court_calendar WHERE perkara_id = ? AND ${CC[pihak]}`, [p.id]);
        if (!cc[0].n) {
          const t = T.mulaiTahap(per.get(p.id) || [], { gugatan: /Pdt\.G/i.test(p.no) })[pihak] || "";
          const harap = /^(7119|7121)$/.test(no) ? hari(t) : t;
          if (harap === fb) h.cocokBot++;
          else { h.bedaBot++; if (h.bedaBotContoh.length < 10) h.bedaBotContoh.push([p.no, fb, harap]); }
        }
      } catch (e) { h.galat++; if (h.galat < 3) console.error(no, p.id, e.message); }
    }
    console.log(no, JSON.stringify({ ...h, contoh: h.contoh.length, bedaBotContoh: h.bedaBotContoh }));
  }
  c.end();
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
