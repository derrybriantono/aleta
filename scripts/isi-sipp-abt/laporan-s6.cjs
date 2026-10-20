// Menyusun docs/isi-sipp-abt/DAFTAR-CEK-S6.md dari ukuran sebelum/sesudah pekerjaan agen S6.
//
//   node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SEBELUM.json --tanpa-s6
//   node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SESUDAH.json
//   node scripts/isi-sipp-abt/laporan-s6.cjs
//
// Per jenis dan per kategori blangko (putusan/penetapan, BAS, relaas, PTSP, sita) dihitung banyaknya ISIAN popup (kode unik)
// menurut kelasnya:
//   otomatis   pengisi memberi nilai pasti/cukup (ditulis sendiri bila isian kosong dan saklar "Isi otomatis" menyala)
//   ragu       pengisi memberi saran (kotak samar, lencana "yakin: ragu - periksa", kalimat sumber)
//   manual     tidak mungkin otomatis: lencana "diisi manual" + alasan di ikon keterangan
//   belum      tidak ada pengisi dan tidak ada alasan (celah)
//   dasar      sudah ada pengisi lama yang bergantung berkas e-Court / ekstensi / data ALETA (tidak dapat diukur di laptop)
// Bukti kelas otomatis/ragu/manual = hasil jalan pengisi atas perkara nyata (salinan lokal sipp_donggala) atau, bila jenisnya
// tidak punya perkara nyata, atas perkara contoh (fixture) - ditandai di tabel.
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const dok = (n) => JSON.parse(fs.readFileSync(path.join(akar, "docs", "isi-sipp-abt", n), "utf8"));
const daftar = dok("DAFTAR-CEK.json");
const sebelum = dok("UKURAN-S6-SEBELUM.json").jenis;
const sesudah = dok("UKURAN-S6-SESUDAH.json").jenis;
const iso = new Map(daftar.isian.map((x) => [x.kunci, x]));

/** Keluarga folder S6: nama, pola folder, jenis SIPP pemberi bukti. */
const KELUARGA = [
  { nama: "Harta bersama", pola: /^4a /, jenis: [348] },
  { nama: "Kewarisan", pola: /^4b /, jenis: [364] },
  { nama: "Wasiat", pola: /^4c /, jenis: [365] },
  { nama: "Hibah", pola: /^4d /, jenis: [366] },
  { nama: "Wakaf", pola: /^4e /, jenis: [367] },
  { nama: "Izin poligami", pola: /^5 /, jenis: [341] },
  { nama: "Pembatalan perkawinan", pola: /^5a /, jenis: [344] },
  { nama: "Pencegahan perkawinan", pola: /^5b /, jenis: [342, 343] },
  { nama: "Hak asuh anak (hadhanah) - Lain-Lain 369", pola: /^6a /, jenis: [369, 349] },
  { nama: "Penguasaan anak - Lain-Lain 369", pola: /^6b /, jenis: [369, 349] },
  { nama: "Nafkah anak - Lain-Lain 369", pola: /^6c /, jenis: [369, 350] },
  { nama: "Pengangkatan anak - Lain-Lain 369", pola: /^9a /, jenis: [369, 352] },
  { nama: "Permohonan umum - Lain-Lain 369", pola: /^9b /, jenis: [369] },
  { nama: "Mafqud - Lain-Lain 369", pola: /^9c /, jenis: [369] },
  { nama: "Ekonomi syariah", pola: /^10a? /, jenis: [370] },
];
const LINTAS = [
  { nama: "Relaas (lintas jenis)", pola: /^98 /, kategori: "relaas" },
  { nama: "PTSP (lintas jenis, termasuk mediator)", pola: /^99 /, kategori: "ptsp" },
  { nama: "Sita (lintas jenis)", pola: /^97 /, kategori: "sita" },
];
const SEMUA_JENIS = [341, 342, 343, 344, 348, 364, 365, 366, 367, 369, 370];

/** Kelompok pengisi lama yang bergantung berkas e-Court / ekstensi / ALETA (tidak terukur di laptop). */
const KELOMPOK_LUAR = new Set(["kuasa-penggugat", "alamat-putusan", "elitigasi", "ktp-teks", "ktp-tanggal", "gugatan-ecourt", "jawab-menjawab-ecourt", "tanya-jawab-jawab-menjawab", "bukti-daftar-ecourt", "surat-keterangan-kua-itsbat", "lampiran-ecourt-ocr", "jawaban-sita-hb-rekonvensi"]);

function kategoriFolder(f) {
  if (/ - BAS$/.test(f) || /^ALUR /.test(f)) return "BAS";
  return "putusan/penetapan";
}

/** Bukti dinamis terbaik untuk kode di kumpulan jenis: "otomatis" | "ragu" | "manual" | "" (tidak ada). */
function bukti(ukuran, jenisList, kode) {
  let terbaik = "";
  let nyata = 0;
  let fixture = 0;
  const urut = { otomatis: 3, ragu: 2, manual: 1, "": 0 };
  for (const j of jenisList) {
    const c = ukuran[String(j)] && ukuran[String(j)].kode[kode];
    if (!c) continue;
    for (const [sumber, hitung] of [["nyata", c.nyata], ["fixture", c.fixture]]) {
      for (const t of ["otomatis", "ragu", "manual"]) {
        if (hitung[t] > 0) {
          if (urut[t] > urut[terbaik]) terbaik = t;
          if (t !== "manual") (sumber === "nyata" ? (nyata += hitung[t]) : (fixture += hitung[t]));
        }
      }
    }
  }
  return { tingkat: terbaik, nyata, fixture };
}

/** Kelas statis dari DAFTAR-CEK (pengisi lama) bila tidak ada bukti dinamis. */
function kelasStatis(kode, jenisList) {
  const x = iso.get(kode);
  if (!x || x.status === "tidak") return "belum";
  const pengisi = x.pengisi || [];
  const luar = pengisi.filter((p) => p.jenis === "kelompok" && KELOMPOK_LUAR.has(p.id));
  if (luar.length) return luar.some((p) => p.tingkat === "otomatis") ? "dasar-otomatis" : "dasar-ragu";
  if (pengisi.some((p) => p.jenis === "tj")) return "dasar-ragu";
  // pengisi modul deteksi/kelompok SIPP: ada sumbernya tetapi tidak dipicu perkara yang diukur
  return pengisi.length ? "ragu-statis" : "belum";
}

/** Pengisi yang ditambah S6 di luar jalur yang dapat diukur lokal (daftar bukti e-Court hibah/wakaf/mafqud). */
const TAMBAHAN_SESUDAH = { 9804: "dasar-ragu", 9805: "dasar-ragu", 9810: "dasar-ragu", 9834: "dasar-ragu", 9835: "dasar-ragu", 9840: "dasar-ragu", 9873: "dasar-ragu" };
/** Sudah "tidak ada sumber" sejak sebelum S6 (dariSipp) untuk semua jenis. */
const MANUAL_LAMA = new Set(["0661", "0663", "0227"]);

/**
 * Urutan: bukti dinamis otomatis > ragu > pengisi lama yang nyata (dasar / modul deteksi) > manual > belum.
 * Entri "manual" hanya cadangan bila tidak ada pengisi yang memberi nilai.
 */
function kelas(ukuran, jenisList, kode, sesudahS6) {
  const b = bukti(ukuran, jenisList, kode);
  if (b.tingkat === "otomatis") return "otomatis";
  if (b.tingkat === "ragu") return "ragu";
  const s = kelasStatis(kode, jenisList);
  const statis = s === "ragu-statis" ? "ragu" : s;
  if (sesudahS6 && TAMBAHAN_SESUDAH[kode] && (statis === "belum" || statis === "ragu")) return TAMBAHAN_SESUDAH[kode];
  if (statis !== "belum") return statis;
  if (b.tingkat === "manual" || MANUAL_LAMA.has(kode)) return "manual";
  return "belum";
}

const KELAS = ["otomatis", "ragu", "manual", "belum", "dasar-otomatis", "dasar-ragu"];
function hitung(kodeList, ukuran, jenisList, sesudahS6) {
  const h = Object.fromEntries(KELAS.map((k) => [k, 0]));
  for (const k of kodeList) h[kelas(ukuran, jenisList, k, sesudahS6)] += 1;
  return h;
}
const baris = (nama, n, a, b) =>
  `| ${nama} | ${n} | ${KELAS.map((k) => `${a[k]} → ${b[k]}`).join(" | ")} |`;
const KEPALA = `| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`;

function isianUntuk(pola, kategoriFilter) {
  const kumpul = new Set();
  const perKategori = { "putusan/penetapan": new Set(), BAS: new Set(), relaas: new Set(), ptsp: new Set(), sita: new Set() };
  for (const b of daftar.blangko) {
    if (!pola.test(b.folder)) continue;
    const kat = /^98 /.test(b.folder) ? "relaas" : /^99 /.test(b.folder) ? "ptsp" : /^97 /.test(b.folder) ? "sita" : kategoriFolder(b.folder);
    if (kategoriFilter && kat !== kategoriFilter) continue;
    for (const k of b.isian) {
      kumpul.add(k);
      perKategori[kat].add(k);
    }
  }
  return { semua: [...kumpul], perKategori };
}

const keluar = [];
const J = (s) => keluar.push(s);
J("# Daftar cek isian otomatis jenis agen S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pembatalan/pencegahan, hak asuh/nafkah anak, Lain-Lain, ekonomi syariah)");
J("");
J(`Dibangun ${new Date().toISOString().slice(0, 10)} oleh \`scripts/isi-sipp-abt/laporan-s6.cjs\` dari \`UKURAN-S6-SEBELUM.json\` dan \`UKURAN-S6-SESUDAH.json\` (hasil \`ukur-s6.cjs\`). DAFTAR-CEK.json/.md (status 19 Okt) tidak diubah.`);
J("");
J("## Cara membaca");
J("");
J("- **Isian** = isian popup \"Perlu diisi\" (data_teks, data_tanggal, tanya_jawab) yang dipakai blangko Derry bagian itu (kode unik).");
J("- Angka dalam tabel: **sebelum → sesudah** pekerjaan S6.");
J("- **otomatis** = pengisi memberi nilai pasti/cukup (ditulis sendiri hanya bila isian kosong dan saklar \"Isi otomatis\" menyala; tidak pernah menimpa isian petugas). **ragu** = saran (kotak samar, tombol Tab) dengan lencana \"yakin: ragu - periksa\", \"dari posita gugatan\" dan kalimat sumber. **manual** = tidak mungkin otomatis; lencana \"diisi manual\" dan alasan di ikon keterangan (ada yang `opsional` + `labelPengguna`). **belum** = celah: tidak ada pengisi dan tidak ada alasan. **dasar** = sudah ada pengisi lama yang membaca berkas e-Court, kuasa, KTP, bukti atau data ALETA - tidak dapat diukur ulang di laptop (data e-Court tidak ada di salinan lokal), dihitung apa adanya dari DAFTAR-CEK.json.");
J("- **Kelas diukur**, bukan diklaim: otomatis/ragu/manual berarti pengisi BENAR-BENAR memberi hasil itu atas sekurang-kurangnya satu perkara nyata di salinan lokal SIPP (sipp_donggala, semua tahun) atau, bila jenis itu tidak punya perkara nyata (hibah, wakaf, mafqud), atas perkara contoh realistis (`scripts/isi-sipp-abt/fixture-s6.cjs`, ditandai).");
J("");
J("## Sambungan, pembagian dengan agen lain, dan batas");
J("");
J("- **Titik sambung (sempit)**: satu blok bertanda `S6 20 Okt` di akhir `dariSipp` (`aleta_bot/services/abtUsulanService.js`) memanggil `aleta_bot/services/isiOtomatisJenisS6.js`. `dariSipp` (sumber \"sipp\") SELALU diminta Blangko Derry untuk SEMUA kategori (putusan/penetapan, BAS tiap sidang, relaas, PTSP, sita), jadi satu sambungan menjangkau semuanya. Perkara di luar jenis S6 dijawab kosong sesudah SATU pembacaan kecil.");
J("- **Berkas baru**: `aleta_bot/services/deteksi/isiS6.js` (pembaca posita/petitum murni), `aleta_bot/services/isiOtomatisJenisS6.js` (data terstruktur SIPP + tabel isian manual), `manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s6.ts` (salinan portal tabel manual/opsional; dua baris di `route.ts`), skrip ukur `scripts/isi-sipp-abt/{ukur-s6,laporan-s6,bangun-petunjuk-s6,fixture-s6}.cjs`.");
J("- **Bentuk data manual/opsional**: pengisi mengirim usulan `keyakinan: \"tidak_ada_sumber\"` + `catatan` (alasan, bahasa petugas) dan, di sisi portal, `manual`/`alasanManual`/`opsional`/`labelPengguna` pada isian susunan blangko (`petunjuk-s6.ts`) - bentuk yang sama dengan agen S3 (`isian-metadata.ts`) dan S5 (`petunjuk-s5.ts`). Lencana \"diisi manual\" di kartu adalah milik tampilan bersama (agen S3 `infoManual`, agen S5 `kepingKet`); pengisi otomatis yang menemukan nilai selalu menang.");
J("- **Tumpang tindih yang disengaja**: beberapa kode (0663, 8433, 8706, 8712-8714, 9134) juga ada di tabel S3/S5; isinya konsisten (manual bila tak ada sumber). 8706 (dasar putusnya perkawinan) kini dapat TERISI dari perkara cerai terdahulu pasangan yang sama di SIPP (cukup bila akta cerainya sudah terbit), sehingga bagi harta bersama/hak asuh ia bukan lagi manual.");
J("- **Relaas bantuan panggilan** (1154 nomor surat, 1232 tanggal, 5230 ongkos): datanya ada di tabel delegasi keluar SIPP; pengisinya dikerjakan agen S3 (semua jenis) dan TIDAK diduplikasi di sini - di tabel relaas di bawah ketiganya masih \"belum\" sampai cabang S3 digabung. Begitu pula 1081 (PHS baru ikrar talak) milik S3.");
J("- **Daftar bukti e-Court** hibah/wakaf/mafqud (9804/9805/9810/9834/9835/9840/9873): `buktiEcourtService.js` kini mengisi juga kode-kode itu dari daftar bukti P.n/T.n di e-Court (ragu); daftar kode di ekstensi (`isi-sipp-bersama.js`, `abt.js`) dan cermin portal (`isi-sipp-format.ts`) disamakan. Bergantung berkas e-Court, jadi tidak terukur di laptop.");
J("- **Keyakinan**: pasti/cukup hanya untuk salinan eksplisit atau data terstruktur SIPP (rekonvensi, perkara cerai terdahulu + akta cerai, akad bernomor dan bertanggal, akta ikrar wakaf/hibah, duplikat akta nikah, kesepakatan damai Y1). Semua bacaan bebas dari posita/petitum \"ragu\": belum ada isian petugas untuk jenis-jenis ini sebagai pembanding (gerbang terukur >= 95% dan n >= 10 tidak dapat dipenuhi), jadi hanya menjadi saran dengan kalimat sumber.");
J("- **Batas**: jumlah perkara nyata sangat kecil (lihat tabel), sehingga \"terukur\" berarti pengisi BENAR-BENAR menghasilkan nilai atas perkara itu, bukan bahwa nilainya sudah dibandingkan dengan ketikan petugas. Hibah dan wakaf diukur atas fixture; ketepatannya baru dapat dinilai begitu perkara pertama muncul.");
J("");
J("## Perkara nyata per jenis (salinan lokal)");
J("");
J("| jenis SIPP | perkara nyata | perkara contoh (fixture) |\n| --- | ---: | ---: |");
for (const j of SEMUA_JENIS) {
  const e = sesudah[String(j)];
  if (!e) continue;
  J(`| ${j} ${e.nama} | ${e.nyata} | ${e.fixture} |`);
}
J("");
J("Jumlah perkara nyata sangat kecil kecuali kewarisan (23), Lain-Lain (19), harta bersama (13) dan poligami (12): urutan prioritas pekerjaan mengikuti jumlah itu, lalu keluasan blangko. Hibah (366) dan wakaf (367) tidak punya satu pun perkara di SIPP PA Donggala; pengisinya diuji atas perkara contoh.");
J("");

const ringkasanTotal = { sebelum: Object.fromEntries(KELAS.map((k) => [k, 0])), sesudah: Object.fromEntries(KELAS.map((k) => [k, 0])), n: 0 };
const ringkasanKategori = {};
const tambahRingkasan = (kategori, n, a, b) => {
  const r = (ringkasanKategori[kategori] = ringkasanKategori[kategori] || { n: 0, a: Object.fromEntries(KELAS.map((k) => [k, 0])), b: Object.fromEntries(KELAS.map((k) => [k, 0])) });
  r.n += n;
  for (const k of KELAS) {
    r.a[k] += a[k];
    r.b[k] += b[k];
  }
};

J("## Per jenis dan kategori blangko");
J("");
for (const kel of KELUARGA) {
  const { perKategori } = isianUntuk(kel.pola);
  J(`### ${kel.nama}`);
  J("");
  J(KEPALA);
  for (const kat of ["putusan/penetapan", "BAS"]) {
    const kode = [...perKategori[kat]];
    if (!kode.length) continue;
    const a = hitung(kode, sebelum, kel.jenis, false);
    const b = hitung(kode, sesudah, kel.jenis, true);
    J(baris(kat === "BAS" ? "BAS (tiap sidang)" : "Putusan/penetapan", kode.length, a, b));
    tambahRingkasan(kat, kode.length, a, b);
  }
  J("");
  // rincian isian yang berubah
  const semuaKode = new Set([...perKategori["putusan/penetapan"], ...perKategori.BAS]);
  const berubah = [];
  for (const k of [...semuaKode].sort()) {
    const a = kelas(sebelum, kel.jenis, k, false);
    const b = kelas(sesudah, kel.jenis, k, true);
    if (a !== b) {
      const bt = bukti(sesudah, kel.jenis, k);
      berubah.push(`${k} ${(iso.get(k) || {}).nama || "?"}: ${a} → ${b}${b === "otomatis" || b === "ragu" ? ` (${bt.nyata ? `${bt.nyata} perkara nyata` : ""}${bt.nyata && bt.fixture ? ", " : ""}${bt.fixture ? `${bt.fixture} contoh` : ""})` : ""}`);
    }
  }
  if (berubah.length) {
    J("Isian yang berubah kelasnya:");
    J("");
    for (const x of berubah.slice(0, 80)) J(`- ${x}`);
    J("");
  }
  const sisaBelum = [...semuaKode].filter((k) => kelas(sesudah, kel.jenis, k, true) === "belum").sort();
  if (sisaBelum.length) {
    J(`Masih belum (celah): ${sisaBelum.map((k) => `${k} ${((iso.get(k) || {}).nama || "?").slice(0, 40)}`).join("; ")}.`);
    J("");
  }
}

J("### Lintas jenis: relaas, PTSP (mediator, PMH/PPP/PJS/PHS) dan sita");
J("");
J("Folder 97/98/99 dipakai semua jenis; bukti diambil dari gabungan semua perkara S6.");
J("");
J(KEPALA);
for (const l of LINTAS) {
  const { semua } = isianUntuk(l.pola);
  const a = hitung(semua, sebelum, SEMUA_JENIS, false);
  const b = hitung(semua, sesudah, SEMUA_JENIS, true);
  J(baris(l.nama, semua.length, a, b));
  tambahRingkasan(l.kategori, semua.length, a, b);
}
J("");

J("## Ringkasan per kategori (gabungan semua jenis S6)");
J("");
J(KEPALA);
for (const [kat, r] of Object.entries(ringkasanKategori)) J(baris(kat === "BAS" ? "BAS (tiap sidang)" : kat === "putusan/penetapan" ? "Putusan/penetapan" : { relaas: "Relaas", ptsp: "PTSP (termasuk mediator)", sita: "Sita" }[kat] || kat, r.n, r.a, r.b));
J("");
J("(Jumlah per kategori menjumlah isian per keluarga blangko; satu isian yang dipakai beberapa jenis dihitung per jenis.)");
J("");

J("## Terukur atas perkara nyata (salinan lokal sipp_donggala)");
J("");
J("Untuk jenis yang punya perkara nyata: berapa perkara yang mendapat nilai per kode (otomatis = pasti/cukup; ragu = saran). Hanya kode yang BERUBAH dibanding sebelum S6.");
J("");
for (const j of SEMUA_JENIS) {
  const a = sebelum[String(j)];
  const b = sesudah[String(j)];
  if (!b || !b.nyata) continue;
  const baru = [];
  for (const [kode, c] of Object.entries(b.kode)) {
    if (kode.startsWith("_")) continue;
    const lama = (a && a.kode[kode]) || { nyata: { otomatis: 0, ragu: 0, manual: 0 } };
    const sama = c.nyata.otomatis === lama.nyata.otomatis && c.nyata.ragu === lama.nyata.ragu && c.nyata.manual === lama.nyata.manual;
    if (sama || (c.nyata.otomatis + c.nyata.ragu === 0)) continue;
    baru.push(`${kode} ${(iso.get(kode) || {}).nama ? iso.get(kode).nama.slice(0, 42) : ""}: otomatis ${lama.nyata.otomatis}→${c.nyata.otomatis}, ragu ${lama.nyata.ragu}→${c.nyata.ragu} dari ${b.nyata}`);
  }
  J(`### ${j} ${b.nama} (${b.nyata} perkara nyata)`);
  J("");
  if (baru.length) for (const x of baru.sort()) J(`- ${x}`);
  else J("- (tidak ada kode yang terisi lebih banyak atas perkara nyata; perubahan terbatas pada isian yang memang manual atau contoh)");
  J("");
}

J("## Isian yang memang manual (alasan dan opsional)");
J("");
J("Daftar lengkap di kode: `aleta_bot/services/isiOtomatisJenisS6.js` (`MANUAL`). Ringkas per sebab:");
J("");
const S6 = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS6.js"));
const kelompok = { "penilaian/pertimbangan hakim": [], "fakta/keterangan di persidangan": [], "surat/izin yang tidak tercatat terstruktur di SIPP": [], "opsional (boleh kosong)": [], "bacaan utama berkas e-Court": [] };
for (const [kode, m] of Object.entries(S6.MANUAL)) {
  const a = m.alasan;
  const nama = (iso.get(kode) || {}).nama || kode;
  const t = `${kode} ${nama.slice(0, 50)}`;
  if (m.opsional) kelompok["opsional (boleh kosong)"].push(t);
  else if (/e-Court/i.test(a)) kelompok["bacaan utama berkas e-Court"].push(t);
  else if (/penilaian|pertimbangan|diputus|alasan hakim/i.test(a)) kelompok["penilaian/pertimbangan hakim"].push(t);
  else if (/sidang|persidangan|pemeriksaan setempat|diketik|dicatat panitera|lokasi/i.test(a)) kelompok["fakta/keterangan di persidangan"].push(t);
  else kelompok["surat/izin yang tidak tercatat terstruktur di SIPP"].push(t);
}
for (const [sebab, isi] of Object.entries(kelompok)) {
  if (!isi.length) continue;
  J(`- **${sebab}** (${isi.length}): ${isi.join("; ")}.`);
}
J("");
J("## Menjalankan ulang");
J("");
J("```");
J("node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SEBELUM.json --tanpa-s6");
J("node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SESUDAH.json");
J("node scripts/isi-sipp-abt/laporan-s6.cjs");
J("```");
J("");
J("Butuh MySQL lokal berisi `sipp_donggala` (XAMPP D:). Hanya SELECT.");

fs.writeFileSync(path.join(akar, "docs", "isi-sipp-abt", "DAFTAR-CEK-S6.md"), keluar.join("\n") + "\n");
console.log("ditulis docs/isi-sipp-abt/DAFTAR-CEK-S6.md", keluar.length, "baris");
