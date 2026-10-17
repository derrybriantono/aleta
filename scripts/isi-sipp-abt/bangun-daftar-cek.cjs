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
const bacaOpsional = (nama) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(akar, "docs", "isi-sipp-abt", nama), "utf8"));
  } catch {
    return null;
  }
};
const beban = bacaOpsional("BEBAN-MANUAL.json") || {};
const ukuranLanjutan = bacaOpsional("UKURAN-LANJUTAN.json");

function kueri(db, sql) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db });
  return new Promise((ok, gagal) => kon.query(sql, (e, r) => (kon.end(), e ? gagal(e) : ok(r))));
}

const { petaFolder } = require("./folder-jenis.cjs");

/** Isian yang oleh ABT sendiri punya cadangan bila dikosongkan: "sipp" (kosong = dari SIPP / OTOMATIS), "bawaan" (teks bawaan), "titik" (titik-titik / coret). */
function jenisCadangan(namaAsli) {
  const n = String(namaAsli || "");
  if (/kosong\s*=\s*(dari\s*)?(data\s*)?sipp|\(otomatis|bila\s*sipp\s*tidak\s*memuat|isian\s*bila\s*sipp|kosong\s*=\s*otomatis/i.test(n)) return "sipp";
  if (/kosong\s*=\s*titik|boleh\s*dikosongkan|^CORET:/i.test(n)) return "titik";
  if (/kosong\s*=|\(bawaan|bawaan:/i.test(n)) return "bawaan";
  return "";
}
const teksBersih = (s) => String(s || "").replace(/\s+/g, " ").trim();
const urutNama = (a, b) => a.localeCompare(b, "id");

function bagianLanjutan(d) {
  const u = d.ukuranLanjutan;
  if (!u) return [];
  const g = u.ground || {};
  const hit = (k) => (u.dihitung[k] ? u.dihitung[k].perkara : 0);
  const baris = [
    "## Dibangun 18 Okt (agen Z1) - isian popup yang datanya ada di SIPP",
    "",
    `Kode: \`aleta_bot/services/abtIsianSippLanjutan.js\`, dipanggil dari \`dariSipp\` (kanal "Isi dari SIPP"); SELECT saja. Diukur atas ${u.perkaraDiperiksa} perkara sipp_donggala sejak 2023 (tanpa menulis apa pun):`,
    "",
    "| nomor | isian | sumber SIPP | perkara kini terisi | tingkat | pembanding isian petugas (ABT lokal) |",
    "| --- | --- | --- | ---: | --- | --- |",
    `| 8705 | Tanggal kesepakatan perdamaian | perkara_mediasi.tgl_kesepakatan_perdamaian (hasil Y1) | ${hit("8705")} | otomatis | belum ada isian petugas (variabel baru 15 Okt) |`,
    `| 8704 | Isi kesepakatan perdamaian | perkara_mediasi.isi_kesepakatan_perdamaian, HTML jadi baris | ${hit("8704")} | otomatis | belum ada isian petugas |`,
    `| 8433 | Alasan pencabutan perkara | hasil mediasi Y2 (berhasil dengan pencabutan) | ${hit("8433")} | otomatis | 41 isian petugas sejak 2023, hanya 4 dari Y2 |`,
    `| 1183 | Tgl. batas waktu ikrar talak | perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan | ${hit("1183")} | usulan ragu | ${g["1183"] ? `${g["1183"].cocokPersis} dari ${g["1183"].adaUsulan} persis sama` : "-"} |`,
    `| 0303 | Tgl. pengumuman itsbat | perkara.tanggal_pendaftaran | ${hit("0303")} | usulan ragu | ${g["0303"] ? `${g["0303"].cocokPersis} dari ${g["0303"].adaUsulan} persis sama (92% dalam 0-1 hari)` : "-"} |`,
    `| 0185 | Tgl. surat kuasa Tergugat | perkara_pengacara pihak 2 | ${hit("0185")} | usulan ragu | ${g["0185"] ? `${g["0185"].cocokPersis} dari ${g["0185"].adaUsulan} persis sama` : "-"} |`,
    "",
    "\"Otomatis\" = tercentang sendiri bila isian blangko kosong; \"usulan ragu\" = ditampilkan tanpa centang dan tidak menimpa isian petugas (aturan yang sama dengan usulan lain).",
    "",
  ];
  return baris;
}

function tulisMd(d) {
  const r = d.ringkasan;
  const sel = (x) => String(x == null ? "" : x).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const nama = (x) => (x.kunci.startsWith("tj:") ? `${sel(x.nama)} [tanya jawab ${x.kunci.slice(3)}]` : sel(x.nama));
  const kodeTampil = (x) => x.kode.join(", ");
  const ket = { ya: "ya", sebagian: "sebagian", tidak: "tidak" };
  const baris = d.isian.map((x, i) => {
    const pengisi = [...new Set(x.pengisi.map((p) => (p.jenis === "abt-bawaan" ? (p.id === "abt-sipp" ? "ABT sendiri dari SIPP bila dikosongkan" : "bawaan ABT bila dikosongkan") : p.jenis === "kelompok" ? p.id : p.jenis === "saksi" ? "susun saksi" : `${p.jenis} ${p.id.replace(/^f23-/, "")}`)))].join("; ");
    const sm = x.status === "ya" ? pengisi : [x.sumberMungkin, pengisi && x.status === "sebagian" ? `(terisi di: ${pengisi})` : ""].filter(Boolean).join(" ");
    return `| ${i + 1} | ${kodeTampil(x)} | ${nama(x)} | ${x.jumlahBlangko} | ${x.diketikPetugas} | ${sel(x.contoh[0] || "").slice(0, 60)} | ${ket[x.status]} | ${sm} | ${sel(x.catatan)} |`;
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
    ...bagianLanjutan(d),
    "## Temuan gerbang tombol (diperiksa 18 Okt)",
    "",
    "Pengisi di bot tidak berguna bila tombolnya tidak muncul di blangko itu. `scripts/isi-sipp-abt/gerbang-tombol.cjs` membaca cermin gerbang langsung dari `ekstensi-sipp/abt.js` dan memeriksa tiap blangko x isian berpengisi posita: untuk jenis utama (cerai, itsbat, dispensasi kawin, ahli waris, perwalian) tombolnya selalu terpicu. Celah yang tersisa kecil: BAS sita insidentil harta bersama/kewarisan (9161-9163), pencegahan perkawinan (1029, tanpa modul jenisnya), dan blangko cerai kumulasi cacat formil ([99b]) yang memang tidak memerlukan fakta.",
    "",
    "## Tabel per isian (urut bobot)",
    "",
    "| # | nomor | nama | jml blangko | diketik petugas (perkara sejak 2023) | contoh blangko | otomatis? | sumber / pengisi | catatan |",
    "| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |",
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
          cadangan: jenisCadangan(i.namaAsli),
          keadaan: i.keadaan,
          pemicu: i.pemicu,
          jumlahBlangko: 0,
          langsung: 0,
          bobotLangsung: 0,
          bobot: 0,
          bobotTertutup: 0,
          bobotLangsungTertutup: 0,
          contoh: [],
          folder: {},
          pengisi: new Map(),
          folderTakTertutup: {},
          tertutupBlangko: 0,
        };
        isian.set(kunci, r);
      }
      if (!r.kode.includes(i.kode)) r.kode.push(i.kode);
      r.jumlahBlangko++;
      if (i.langsung) {
        r.langsung++;
        r.bobotLangsung += bobot;
      }
      r.bobot += bobot;
      r.folder[b.folder] = (r.folder[b.folder] || 0) + 1;
      if (r.contoh.length < 3 && !r.contoh.includes(b.berkas)) r.contoh.push(b.berkas);

      // Pengisi yang berlaku untuk kejadian ini (blangko di folder dengan modul tertentu).
      const pengisi = [];
      const cad = jenisCadangan(i.namaAsli);
      if (cad === "sipp" || cad === "bawaan") pengisi.push({ jenis: "abt-bawaan", id: `abt-${cad}`, tingkat: "otomatis" });
      if (i.jenis === "tj" && TJ_DIDUKUNG.kunci.includes(String(i.tj))) pengisi.push({ jenis: "saksi", id: "tj-saksi", berkas: TJ_DIDUKUNG.berkas, tingkat: "otomatis" });
      for (const k of [i.kode]) {
        for (const g of kunciKelompok.get(k) || []) {
          if (g.untuk === "semua" || pf.modul.some((m) => g.untuk.includes(m))) pengisi.push({ jenis: "kelompok", id: g.id, berkas: g.berkas, tingkat: g.sebagian ? "usulan" : g.tingkat, sebagian: Boolean(g.sebagian) });
        }
        const modulCek = pf.universal ? [...new Set([...reg.get(k) || []].map((e) => e.modul).concat(Object.keys(F23.peta).filter((m) => F23.peta[m].includes(k))))] : pf.modul;
        for (const m of modulCek) {
          if ((F23.peta[m] || []).includes(k)) pengisi.push({ jenis: "f23", id: `f23-${m}`, berkas: F23.berkas, tingkat: "usulan" });
          for (const e of reg.get(k) || []) {
            if (e.modul === m && e.deteksi) pengisi.push({ jenis: "deteksi", id: m, berkas: "aleta_bot/services/deteksi", tingkat: "usulan" });
          }
        }
      }
      if (!pengisi.length && (i.langsung || r.langsung === 0)) r.folderTakTertutup[b.folder] = (r.folderTakTertutup[b.folder] || 0) + 1;
      if (pengisi.length) {
        r.bobotTertutup += bobot;
        r.tertutupBlangko++;
        if (i.langsung) r.bobotLangsungTertutup += bobot;
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
    // Isian yang tertulis langsung di RTF dinilai dari kejadian langsung saja; yang hanya dibaca variabel lain (rantai,
    // sering bersyarat jenis perkara) dinilai dari semua kejadian.
    const dasarBobot = r.langsung > 0 ? r.bobotLangsung : r.bobot;
    const dasarTutup = r.langsung > 0 ? r.bobotLangsungTertutup : r.bobotTertutup;
    let status;
    if (dasarTutup === 0) status = "tidak";
    else if (dasarTutup >= dasarBobot) status = otomatis || ada.some((p) => p.jenis === "deteksi" || p.jenis === "f23") ? "ya" : "sebagian";
    else status = "sebagian";
    if (tanpa) status = "tidak";
    
    const sm = SUMBER_MUNGKIN({ kunci: r.kunci, kode: r.kode, nama: r.nama, namaAsli: r.namaAsli, status, cadangan: r.cadangan, folderTakTertutup: Object.keys(r.folderTakTertutup).sort(urutNama) });
    hasil.push({
      kunci: r.kunci,
      kode: r.kode,
      nama: r.nama,
      namaAsli: r.namaAsli,
      jenis: r.jenis,
      tingkat: r.tingkat,
      wajib: r.wajib,
      cadangan: r.cadangan,
      keadaan: r.keadaan,
      pemicu: r.pemicu,
      diketikPetugas: Math.max(0, ...r.kode.map((k) => (beban[k] || { perkara: 0 }).perkara)),
      jumlahBlangko: r.jumlahBlangko,
      langsung: r.langsung,
      bobotLangsung: r.bobotLangsung,
      bobot: r.bobot,
      cakupanBobot: dasarBobot ? Math.round((dasarTutup / dasarBobot) * 1000) / 1000 : 0,
      contoh: r.contoh,
      folder: Object.keys(r.folder).sort(urutNama),
      status,
      folderTakTertutup: Object.keys(r.folderTakTertutup).sort(urutNama),
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
      opsionalTitik: hasil.filter((x) => x.status === "tidak" && x.cadangan === "titik").length,
      penandaTakDikenal: Object.keys(tak).length,
    },
    penandaTakDikenal: tak,
    ukuranLanjutan: ukuranLanjutan || null,
    blangko: blangkoKeluar,
    isian: hasil,
  };
  const dir = path.join(akar, "docs", "isi-sipp-abt");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "DAFTAR-CEK.json"), JSON.stringify(keluar, null, 1));
  fs.writeFileSync(path.join(dir, "DAFTAR-CEK.md"), tulisMd(keluar));
  console.log(JSON.stringify(keluar.ringkasan));
})();
