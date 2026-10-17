// Langkah 2 daftar cek: menggabungkan analisa isian (analisa-isian.mts), registri pengisi di kode,
// tabel kurasi, dan frekuensi perkara sipp_donggala menjadi docs/isi-sipp-abt/DAFTAR-CEK.{json,md}.
//
//   cd manajemen_surat && npx tsx ../scripts/isi-sipp-abt/analisa-isian.mts <analisa.json>
//   node scripts/isi-sipp-abt/bangun-daftar-cek.cjs <analisa.json>
//
// Hanya SELECT pada salinan lokal sipp_donggala. Tidak menyentuh SIPP/ABT sungguhan.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { muat } = require("./registri-bot.cjs");
const { KELOMPOK, TJ_DIDUKUNG, F23, TANPA_SUMBER, SUMBER_MUNGKIN } = require("./pengisi-kurasi.cjs");

const analisa = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function kueri(db, sql) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db });
  return new Promise((ok, gagal) => kon.query(sql, (e, r) => (kon.end(), e ? gagal(e) : ok(r))));
}

/** Folder Derry -> modul deteksi yang melayaninya + kunci frekuensi (jenis/alur perkara SIPP). */
function petaFolder(folder) {
  const f = folder.replace(/ - BAS$/, "");
  const r = (modul, freq) => ({ modul, freq });
  if (/^ALUR 11 /.test(f)) return r(["itsbat-nikah"], ["360/16"]);
  if (/^ALUR 12 /.test(f)) return r(["dispensasi-kawin"], ["362/16"]);
  if (/^ALUR 13 /.test(f)) return r(["asal-usul"], ["358/16"]);
  if (/^ALUR \d\d /.test(f) || /CONTRA PERCERAIAN|VERSTEK PERCERAIAN|Kumulasi Cerai Gugat/.test(f)) return r(["cerai"], ["347/15", "346/15"]);
  if (/^1 Perceraian CG/.test(f)) return r(["cerai"], ["347/15"]);
  if (/^1a Perceraian CT/.test(f)) return r(["cerai"], ["346/15"]);
  if (/^1c /.test(f)) return r(["cerai", "itsbat-nikah"], ["360/15"]);
  if (/^1d /.test(f)) return r(["cerai", "hadhanah"], []);
  if (/ITSTBAT|Itsbat Nikah/i.test(f) && /^2a /.test(f)) return r(["itsbat-nikah"], ["360/15"]);
  if (/^2 Itsbat|ITSTBAT|Itsbat Nikah Gugur/i.test(f)) return r(["itsbat-nikah"], ["360/16"]);
  if (/^3 Dispensasi/.test(f)) return r(["dispensasi-kawin"], ["362/16"]);
  if (/^4a /.test(f)) return r(["harta-bersama"], ["348/15"]);
  if (/^4b /.test(f)) return r(["waris"], ["364/15"]);
  if (/^4c /.test(f)) return r(["waris"], ["365/15"]);
  if (/^5 Izin/.test(f)) return r(["izin-poligami"], ["341/15"]);
  if (/^5a /.test(f)) return r([], ["344/15"]);
  if (/^5b /.test(f)) return r([], ["342/16"]);
  if (/^6 Perwalian/.test(f)) return r(["perwalian"], ["354/16"]);
  if (/^6a /.test(f)) return r(["hadhanah"], ["369/15"]);
  if (/^6b /.test(f)) return r(["hadhanah"], ["349/15"]);
  if (/^7 Wali/.test(f)) return r(["wali-adhol"], ["363/16"]);
  if (/^8 Asal|ASAL USUL/.test(f)) return r(["asal-usul"], ["358/16"]);
  if (/^9 Penetapan Ahli Waris/.test(f)) return r(["waris"], ["371/16"]);
  if (/^9a /.test(f)) return r(["pengangkatan-anak", "lain-lain"], ["369/16"]);
  if (/^9b /.test(f)) return r(["lain-lain"], ["369/16"]);
  if (/^10a /.test(f)) return r([], ["370/15"]);
  if (/^10 /.test(f)) return r([], ["370/17"]);
  // Relaas, sita, PTSP dipakai lintas jenis perkara: bobot 1 per blangko, pengisi mana pun dari jenis apa pun dihitung.
  if (/^(98 Relaas|97 Sita|99 PTSP)/.test(f)) return { modul: [], freq: [], universal: true };
  return r([], []);
}

const teksBersih = (s) => String(s || "").replace(/\s+/g, " ").trim();
const urutNama = (a, b) => a.localeCompare(b, "id");

function tulisMd(d) {
  const r = d.ringkasan;
  const sel = (x) => String(x == null ? "" : x).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const nama = (x) => (x.kunci.startsWith("tj:") ? `${sel(x.nama)} [tanya jawab ${x.kunci.slice(3)}]` : sel(x.nama));
  const kodeTampil = (x) => x.kode.join(", ");
  const ket = { ya: "ya", sebagian: "sebagian", tidak: "tidak" };
  const baris = d.isian.map((x, i) => {
    const pengisi = [...new Set(x.pengisi.map((p) => (p.jenis === "abt-bawaan" ? "ABT sendiri (kosong = dari SIPP)" : p.jenis === "kelompok" ? p.id : p.jenis === "saksi" ? "susun saksi" : `${p.jenis} ${p.id.replace(/^f23-/, "")}`)))].join("; ");
    const sm = x.status === "ya" ? pengisi : [x.sumberMungkin, pengisi && x.status === "sebagian" ? `(terisi di: ${pengisi})` : ""].filter(Boolean).join(" ");
    return `| ${i + 1} | ${kodeTampil(x)} | ${nama(x)} | ${x.jumlahBlangko} | ${sel(x.contoh[0] || "").slice(0, 60)} | ${ket[x.status]} | ${sm} | ${sel(x.catatan)} |`;
  });
  return [
    "# Daftar cek isian popup blangko Derry (Isi dari SIPP & input ke ABT)",
    "",
    `Dibangun ${d.dibuat} oleh \`scripts/isi-sipp-abt/bangun-daftar-cek.cjs\` (data diukur, bukan ditebak). Berkas mesin: \`DAFTAR-CEK.json\` (dipakai uji penjaga).`,
    "",
    "## Ringkasan",
    "",
    `- Blangko Derry aktif di pohon server: **${r.blangko}** (${r.blangkoTanpaIsian} tanpa isian popup).`,
    `- Isian popup (data_teks / data_tanggal / tanya_jawab, kata ABT "isian tangan"): **${r.isianUnik}** unik.`,
    `- Sudah otomatis (ya): **${r.ya}** - sebagian: **${r.sebagian}** - belum (tidak): **${r.tidak}**, di antaranya **${r.tanpaSumber}** memang tanpa sumber data (penilaian hakim / tidak tercatat).`,
    `- Penanda yang dirujuk rantai variabel tetapi tidak ada di katalog ABT lokal: ${r.penandaTakDikenal} (lihat bawah).`,
    "",
    "## Sumber dan cara membaca",
    "",
    `- Pohon blangko: ${d.sumber.pohonServer}.`,
    `- Isi RTF: ${d.sumber.isiRtf}. Katalog variabel: ${d.sumber.katalogVariabel}. Frekuensi: ${d.sumber.frekuensi}.`,
    "- \"Isian popup\" = hasil \`susunIsian\` (blangko-derry/susun.ts): penanda RTF + rantai variabel bertipe data_teks, data_tanggal, tanya_jawab. Penanda data_sql/data_sipp/terbilang dihitung ABT sendiri.",
    "- Urutan = bobot: jumlah blangko pemakai x jumlah perkara jenis folder itu sejak 2023 (relaas/sita/PTSP bobot 1 per blangko karena lintas jenis).",
    "- **ya** = ada pengisi yang menghasilkan nilai untuk SEMUA jenis perkara pemakai blangko itu; **sebagian** = hanya sebagian jenis/blangko; **tidak** = belum ada pengisi.",
    "- Pengisi diperiksa uji penjaga (`isi-sipp-abt-daftar-cek.test.ts`): kode harus benar-benar ada di berkas pengisinya.",
    "",
    "## Tabel per isian (urut bobot)",
    "",
    "| # | nomor | nama | jml blangko | contoh blangko | otomatis? | sumber / pengisi | catatan |",
    "| ---: | --- | --- | ---: | --- | --- | --- | --- |",
    ...baris,
    "",
    "## Penanda tak dikenal (bukan isian popup)",
    "",
    Object.entries(d.penandaTakDikenal)
      .map(([k, n]) => `${k}(${n})`)
      .join(", "),
    "",
  ].join("\n");
}

(async () => {
  const baris = await kueri(
    "sipp_donggala",
    "SELECT jenis_perkara_id j, alur_perkara_id a, COUNT(*) c FROM perkara WHERE tanggal_pendaftaran >= '2023-01-01' GROUP BY 1,2"
  );
  const frek = {};
  let totalPerkara = 0;
  for (const b of baris) {
    frek[`${b.j}/${b.a}`] = b.c;
    totalPerkara += b.c;
  }
  const bobotFolder = (freqKunci) => Math.max(1, freqKunci.reduce((n, k) => n + (frek[k] || 0), 0));

  const reg = muat(akar).peta;
  const kunciKelompok = new Map(); // kode -> kelompok[]
  for (const g of KELOMPOK) for (const k of g.kode) (kunciKelompok.get(k) || kunciKelompok.set(k, []).get(k)).push(g);

  const isian = new Map();
  const blangkoKeluar = [];
  for (const b of analisa.blangko) {
    const pf = petaFolder(b.folder);
    const bobot = pf.universal ? 1 : bobotFolder(pf.freq);
    const kunciBlangko = [];
    for (const i of b.isian) {
      const kunci = i.jenis === "tj" ? `tj:${i.tj}` : i.kode;
      kunciBlangko.push(kunci);
      let r = isian.get(kunci);
      if (!r) {
        r = {
          kunci,
          kode: [],
          nama: i.nama,
          namaAsli: teksBersih(i.namaAsli),
          jenis: i.jenis,
          tingkat: i.tingkat,
          wajib: i.wajib,
          keadaan: i.keadaan,
          pemicu: i.pemicu,
          jumlahBlangko: 0,
          bobot: 0,
          bobotTertutup: 0,
          contoh: [],
          folder: {},
          pengisi: new Map(),
          tertutupBlangko: 0,
        };
        isian.set(kunci, r);
      }
      if (!r.kode.includes(i.kode)) r.kode.push(i.kode);
      r.jumlahBlangko++;
      r.bobot += bobot;
      r.folder[b.folder] = (r.folder[b.folder] || 0) + 1;
      if (r.contoh.length < 3 && !r.contoh.includes(b.berkas)) r.contoh.push(b.berkas);

      // Pengisi yang berlaku untuk kejadian ini (blangko di folder dengan modul tertentu).
      const pengisi = [];
      if (!i.wajib && /kosong\s*=\s*dari\s*sipp|\(otomatis/i.test(i.namaAsli)) pengisi.push({ jenis: "abt-bawaan", id: "abt-bawaan", tingkat: "otomatis" });
      if (i.jenis === "tj" && TJ_DIDUKUNG.kunci.includes(String(i.tj))) pengisi.push({ jenis: "saksi", id: "tj-saksi", berkas: TJ_DIDUKUNG.berkas, tingkat: "otomatis" });
      for (const k of [i.kode]) {
        for (const g of kunciKelompok.get(k) || []) {
          if (g.untuk === "semua" || pf.modul.some((m) => g.untuk.includes(m))) pengisi.push({ jenis: "kelompok", id: g.id, berkas: g.berkas, tingkat: g.tingkat });
        }
        const modulCek = pf.universal ? [...new Set([...reg.get(k) || []].map((e) => e.modul).concat(Object.keys(F23.peta).filter((m) => F23.peta[m].includes(k))))] : pf.modul;
        for (const m of modulCek) {
          if ((F23.peta[m] || []).includes(k)) pengisi.push({ jenis: "f23", id: `f23-${m}`, berkas: F23.berkas, tingkat: "usulan" });
          for (const e of reg.get(k) || []) {
            if (e.modul === m && e.deteksi) pengisi.push({ jenis: "deteksi", id: m, berkas: "aleta_bot/services/deteksi", tingkat: "usulan" });
          }
        }
      }
      if (pengisi.length) {
        r.bobotTertutup += bobot;
        r.tertutupBlangko++;
      }
      for (const p of pengisi) r.pengisi.set(`${p.jenis}|${p.id}`, p);
    }
    blangkoKeluar.push({ jalur: b.jalur, folder: b.folder, modul: pf.modul, universal: Boolean(pf.universal), bobot, isian: kunciBlangko, takDikenal: b.takDikenal });
  }

  const hasil = [];
  for (const r of isian.values()) {
    const tanpa = r.kode.map((k) => TANPA_SUMBER[k]).find(Boolean);
    const ada = [...r.pengisi.values()];
    const otomatis = ada.some((p) => p.tingkat === "otomatis");
    let status;
    if (r.bobotTertutup === 0) status = "tidak";
    else if (r.bobotTertutup >= r.bobot) status = otomatis || ada.some((p) => p.jenis === "deteksi" || p.jenis === "f23") ? "ya" : "sebagian";
    else status = "sebagian";
    if (tanpa) status = "tidak";
    
    const sm = SUMBER_MUNGKIN({ kode: r.kode, nama: r.nama, namaAsli: r.namaAsli, status });
    hasil.push({
      kunci: r.kunci,
      kode: r.kode,
      nama: r.nama,
      namaAsli: r.namaAsli,
      jenis: r.jenis,
      tingkat: r.tingkat,
      wajib: r.wajib,
      keadaan: r.keadaan,
      pemicu: r.pemicu,
      jumlahBlangko: r.jumlahBlangko,
      bobot: r.bobot,
      cakupanBobot: r.bobot ? Math.round((r.bobotTertutup / r.bobot) * 1000) / 1000 : 0,
      contoh: r.contoh,
      folder: Object.keys(r.folder).sort(urutNama),
      status,
      pengisi: ada.map((p) => ({ jenis: p.jenis, id: p.id, berkas: p.berkas || "", tingkat: p.tingkat })),
      sumberMungkin: tanpa ? tanpa.sumberMungkin : sm.sumberMungkin,
      catatan: tanpa ? tanpa.catatan : sm.catatan,
    });
  }
  hasil.sort((a, b) => b.bobot - a.bobot || b.jumlahBlangko - a.jumlahBlangko || a.kunci.localeCompare(b.kunci));

  const hitung = (s) => hasil.filter((x) => x.status === s).length;
  const tak = {};
  for (const b of analisa.blangko) for (const t of b.takDikenal) tak[t] = (tak[t] || 0) + 1;
  const keluar = {
    dibuat: new Date().toLocaleDateString("sv-SE"),
    sumber: {
      pohonServer: "manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json (kunci berkas)",
      isiRtf: "RTF terbaru dari arsip lokal (paket batch-14okt-sore, server-asal, XAMPP)",
      katalogVariabel: `${analisa.skemaKatalog} (${analisa.jumlahKatalog} variabel)`,
      frekuensi: `sipp_donggala perkara terdaftar sejak 2023-01-01 (${totalPerkara} perkara)`,
      frekuensiPerJenis: frek,
    },
    ringkasan: {
      blangko: analisa.blangko.length,
      blangkoTanpaIsian: analisa.blangko.filter((b) => !b.isian.length).length,
      isianUnik: hasil.length,
      ya: hitung("ya"),
      sebagian: hitung("sebagian"),
      tidak: hitung("tidak"),
      tanpaSumber: hasil.filter((x) => x.status === "tidak" && /^(tidak ada)/i.test(x.sumberMungkin)).length,
      penandaTakDikenal: Object.keys(tak).length,
    },
    penandaTakDikenal: tak,
    blangko: blangkoKeluar,
    isian: hasil,
  };
  const dir = path.join(akar, "docs", "isi-sipp-abt");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "DAFTAR-CEK.json"), JSON.stringify(keluar, null, 1));
  fs.writeFileSync(path.join(dir, "DAFTAR-CEK.md"), tulisMd(keluar));
  console.log(JSON.stringify(keluar.ringkasan));
})();
