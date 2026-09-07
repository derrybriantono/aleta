"use strict";

/**
 * ============================================================================
 * PENJAGA KERANGKA SEBARAN
 * ============================================================================
 *
 * Bentuk penilaian kedua dibangun karena empat puluh sembilan butir katalog
 * bukan pertanyaan lulus-gagal. Tetapi bentuk kedua membawa bahaya yang tidak
 * dimiliki bentuk pertama: godaan untuk memberinya nilai.
 *
 * Godaan itu nyata dan akan datang. Begitu sebuah sebaran ditampilkan,
 * seseorang akan bertanya "jadi berapa nilainya?" - dan siapa pun yang menjawab
 * akan mengarang, sebab tidak ada yang benar atau salah pada sebaran. Sebaran
 * jenis perkara yang timpang bukan prestasi buruk; ia hanya gambaran perkara
 * yang masuk.
 *
 * Karena itu pemeriksaan terpenting di berkas ini bukan "apakah sebarannya
 * benar", melainkan "apakah kerangkanya masih menolak menghasilkan nilai".
 *
 * ============================================================================
 * DAN SATU BAHAYA LAGI: SEBARAN EJAAN
 * ============================================================================
 *
 * Sebaran atas ruas yang diketik bebas tampak sama meyakinkannya dengan
 * sebaran atas ruas berkode - gambarnya rapi, persentasenya berjumlah seratus.
 * Padahal yang tergambar bukan sebaran hal yang dimaksud, melainkan sebaran
 * EJAAN: "PNS", "P.N.S.", dan "Pegawai Negeri Sipil" menjadi tiga kelompok.
 *
 * Kerangka ini menuntut tiap butir menyatakan di muka apakah ruasnya bebas,
 * dan yang bebas wajib membawa catatan yang menerangkan risikonya.
 */

const fs = require("fs");
const path = require("path");

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

console.log("Kerangka sebaran - bentuk penilaian kedua\n");

const S = require("../services/kerangkaSebaranService");
const B = require("../services/sebaranPerkaraService");

/* --------------------------------------------------------------------------
 * Definisi yang cacat harus ditolak
 * ------------------------------------------------------------------------ */

console.log("== Definisi cacat ditolak ==");

const SAH = {
  kunci: "ujiSebaran",
  judul: "Uji Sebaran",
  keterangan: "Butir contoh untuk menguji kerangka sebaran, panjangnya cukup untuk lolos pemeriksaan.",
  versiRumus: "uji-v1",
  ruasKategori: "jenis",
  ruasBebas: false,
  caraHitung: {
    kelompok: "kelompok contoh untuk pengujian",
    baris: "satu baris adalah satu perkara contoh",
    dikecualikan: "tidak ada yang dikecualikan pada pengujian ini",
    tabelSumber: "tabel contoh untuk pengujian",
    ruasSumber: "ruas contoh untuk pengujian",
  },
  baris: async () => [],
};

function ditolak(ubah, sebutan) {
  const def = { ...SAH, ...ubah };
  const cela = S.celaDefinisi(def);
  cek(`ditolak: ${sebutan}`, cela.length > 0, "justru diterima");
}

cek("definisi yang sah diterima", S.celaDefinisi(SAH).length === 0, S.celaDefinisi(SAH).join("; "));

ditolak({ kunci: "" }, "kunci kosong");
ditolak({ judul: "" }, "judul kosong");
ditolak({ keterangan: "" }, "keterangan kosong");
ditolak({ versiRumus: "" }, "versiRumus kosong");
ditolak({ baris: null }, "tanpa baris()");
ditolak({ ruasKategori: "" }, "tanpa ruasKategori");
ditolak({ ruasBebas: undefined }, "ruasBebas tidak dinyatakan");
ditolak({ ruasBebas: "ya" }, "ruasBebas bukan boolean");
ditolak({ ruasBebas: true }, "ruas bebas tanpa catatanBebas");
ditolak({ ruasBebas: true, catatanBebas: "pendek" }, "catatanBebas terlalu pendek");
ditolak({ catatanBebas: "ruas ini berkode tetapi membawa catatan bebas yang panjang sekali" }, "ruas berkode membawa catatanBebas");
ditolak({ caraHitung: null }, "tanpa caraHitung");
ditolak({ caraHitung: { ...SAH.caraHitung, kelompok: "" } }, "caraHitung.kelompok kosong");
ditolak({ caraHitung: { ...SAH.caraHitung, tabelSumber: "abc" } }, "caraHitung.tabelSumber terlalu pendek");

// Inilah pemeriksaan yang paling menentukan pada berkas ini.
["memenuhi", "ambangNilai", "nilai", "lantaiNilai"].forEach((k) => {
  ditolak({ [k]: 1 }, `butir sebaran membawa "${k}" - jalan menuju nilai`);
});

/* --------------------------------------------------------------------------
 * Kategori: yang mana yang dihitung terisi
 * ------------------------------------------------------------------------ */

console.log("== Kategori kosong bukan kategori ==");

["", "  ", "-", "--", ".", "0", "000", "_", "/", null, undefined].forEach((v) => {
  cek(`"${String(v)}" bukan kategori`, S.berkategori(v) === false);
});
["Cerai Gugat", "0 Tahun", "A", "Banawa"].forEach((v) => {
  cek(`"${v}" adalah kategori`, S.berkategori(v) === true);
});

/* --------------------------------------------------------------------------
 * Perhitungan sebaran
 * ------------------------------------------------------------------------ */

console.log("== Sebaran dihitung dari barisnya sendiri ==");

function pasang(kunci, baris, tambahan = {}) {
  S.lupakanSemua();
  S.daftarkan({ ...SAH, kunci, ...tambahan, baris: async () => baris });
}

(async () => {
  // ---- gambaran biasa ----
  const biasa = [
    ...Array.from({ length: 40 }, () => ({ kategori: "Cerai Gugat" })),
    ...Array.from({ length: 25 }, () => ({ kategori: "Cerai Talak" })),
    ...Array.from({ length: 5 }, () => ({ kategori: "" })),
  ];
  pasang("uji1", biasa);
  const h1 = await S.jalankan("uji1", "bulanan", "2026-01-31", { banyak: 1 });
  const u1 = h1.satuan[0];

  cek("bentuknya dinyatakan sebaran", h1.bentuk === "sebaran");
  cek("jumlah baris benar", u1.jumlahBaris === 70, String(u1.jumlahBaris));
  cek("yang terkategori benar", u1.terkategori === 65, String(u1.terkategori));
  cek("yang tidak terkategori benar", u1.takTerkategori === 5, String(u1.takTerkategori));
  cek("cakupan dihitung", u1.cakupanPersen === 92.9, String(u1.cakupanPersen));
  cek("kelompok terurut dari terbesar", u1.kelompok[0].nama === "Cerai Gugat");
  cek("bagian dihitung atas yang terkategori", u1.kelompok[0].bagian === 61.5, String(u1.kelompok[0].bagian));

  // Jumlah bagian seluruh kelompok harus mendekati seratus persen.
  const totalBagian = u1.kelompok.reduce((s, k) => s + k.bagian, 0);
  cek("jumlah bagian mendekati seratus", Math.abs(totalBagian - 100) < 0.5, String(totalBagian));

  // ---- tidak pernah ada nilai ----
  cek("nilai selalu null", u1.nilai === null, String(u1.nilai));
  cek("dan sebabnya disebutkan pada tiap satuan", String(u1.sebabTanpaNilai).length > 40);
  cek(
    "jawaban tidak memuat ruas nilai lain",
    !Object.prototype.hasOwnProperty.call(u1, "terpenuhi") &&
      !Object.prototype.hasOwnProperty.call(u1, "penyebut") &&
      !Object.prototype.hasOwnProperty.call(u1, "cukup"),
    Object.keys(u1).join(", ")
  );

  // ---- terlalu sedikit untuk menyimpulkan ----
  pasang("uji2", Array.from({ length: 12 }, () => ({ kategori: "Cerai Gugat" })));
  const u2 = (await S.jalankan("uji2", "bulanan", "2026-01-31", { banyak: 1 })).satuan[0];
  cek("baris sedikit ditandai belum cukup menyimpulkan", u2.cukupMenyimpulkan === false);
  cek(
    "dan peringatannya menyebut jumlahnya",
    u2.peringatan.some((p) => /12 baris/.test(p)),
    u2.peringatan.join(" | ")
  );
  // Tetapi gambarnya TETAP ditampilkan - menyembunyikannya menghilangkan
  // satu-satunya data yang ada.
  cek("gambarnya tetap ditampilkan", u2.kelompok.length === 1 && u2.kelompok[0].jumlah === 12);

  // ---- cakupan rendah ----
  pasang("uji3", [
    ...Array.from({ length: 20 }, () => ({ kategori: "Banawa" })),
    ...Array.from({ length: 60 }, () => ({ kategori: "" })),
  ]);
  const u3 = (await S.jalankan("uji3", "bulanan", "2026-01-31", { banyak: 1 })).satuan[0];
  cek("cakupan rendah dihitung", u3.cakupanPersen === 25, String(u3.cakupanPersen));
  cek(
    "cakupan rendah diperingatkan",
    u3.peringatan.some((p) => /Cakupan/.test(p)),
    u3.peringatan.join(" | ")
  );
  cek(
    "dan peringatannya melarang membacanya sebagai gambaran seluruhnya",
    u3.peringatan.some((p) => /seluruh perkara/.test(p))
  );

  // ---- ruas bebas dengan banyak ejaan ----
  pasang(
    "uji4",
    Array.from({ length: 60 }, (_, i) => ({ kategori: `Tulisan ${i}` })),
    {
      ruasBebas: true,
      catatanBebas:
        "Ruas ini diketik bebas di SIPP sehingga sebarannya menggambarkan ejaan, bukan hal yang dimaksud.",
    }
  );
  const u4 = (await S.jalankan("uji4", "bulanan", "2026-01-31", { banyak: 1 })).satuan[0];
  cek(
    "ruas bebas dengan banyak tulisan diperingatkan",
    u4.peringatan.some((p) => /sebaran EJAAN/.test(p)),
    u4.peringatan.join(" | ")
  );

  // Ruas BERKODE dengan banyak kelompok TIDAK diperingatkan begitu - banyak
  // jenis perkara adalah kenyataan, bukan kekacauan ejaan.
  pasang("uji5", Array.from({ length: 60 }, (_, i) => ({ kategori: `Jenis ${i}` })));
  const u5 = (await S.jalankan("uji5", "bulanan", "2026-01-31", { banyak: 1 })).satuan[0];
  cek(
    "ruas berkode dengan banyak kelompok tidak diperingatkan sebagai ejaan",
    !u5.peringatan.some((p) => /EJAAN/.test(p)),
    u5.peringatan.join(" | ")
  );

  // ---- kosong dan aneh ----
  pasang("uji6", []);
  const u6 = (await S.jalankan("uji6", "bulanan", "2026-01-31", { banyak: 1 })).satuan[0];
  cek("baris kosong tidak meledak", u6.jumlahBaris === 0 && u6.kelompok.length === 0);
  cek("cakupan kosong dijawab null, bukan nol", u6.cakupanPersen === null, String(u6.cakupanPersen));
  cek("terbesar kosong dijawab null", u6.terbesar === null);

  // ---- baris tanpa ruas kategori harus MELEDAK ----
  S.lupakanSemua();
  S.daftarkan({ ...SAH, kunci: "uji7", baris: async () => [{ nomorPerkara: "1/Pdt.G" }] });
  let meledak = false;
  try {
    await S.jalankan("uji7", "bulanan", "2026-01-31", { banyak: 1 });
  } catch (_) {
    meledak = true;
  }
  cek("baris tanpa ruas kategori menggagalkan penghitungan", meledak);

  cek("butir karangan dijawab tidak dikenali", (await S.jalankan("tidakAda", "bulanan", "2026-01-31")).ok === false);

  /* ------------------------------------------------------------ butirnya */

  console.log("== Empat butir Bab 9 ==");

  S.lupakanSemua();
  B.daftarkanSemua();
  const daftar = S.daftar();
  cek("empat butir terdaftar", daftar.length === 4, String(daftar.length));
  cek(
    "tiap butir menyatakan ruas kategorinya",
    daftar.every((d) => d.ruasKategori && d.ruasKategori.length > 3)
  );
  cek(
    "butir berruas bebas membawa catatannya",
    daftar.filter((d) => d.ruasBebas).every((d) => d.catatanBebas.length >= 40),
    daftar.filter((d) => d.ruasBebas).map((d) => d.kunci).join(", ")
  );
  cek(
    "ada butir berruas bebas yang sengaja dibangun",
    daftar.some((d) => d.ruasBebas),
    "tidak ada - padahal ST09 seharusnya berruas bebas"
  );

  const KATA_TULIS = /\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|DROP|ALTER|CREATE|GRANT|LOAD|RENAME|CALL)\b/i;
  B.seluruhKueri().forEach((q) => {
    const kata = q.sql.trim().split(/\s+/)[0].toUpperCase();
    cek(`${q.kode}: diawali SELECT`, kata === "SELECT", `diawali ${kata}`);
    cek(`${q.kode}: tanpa kata kerja tulis`, !KATA_TULIS.test(q.sql));
    cek(`${q.kode}: dua penanda parameter`, (q.sql.match(/\?/g) || []).length === 2);
    cek(`${q.kode}: berbatas LIMIT`, /\bLIMIT\s+\d+/i.test(q.sql));
  });

  // Nama yang dipakai harus sudah terbukti pada kueri lain.
  const FOLDER = path.resolve(__dirname, "..", "services");
  const tabelTerbukti = new Set();
  const ruasTerbukti = new Set();
  fs.readdirSync(FOLDER)
    .filter((f) => f.endsWith(".js") && f !== "sebaranPerkaraService.js")
    .forEach((f) => {
      const isi = fs.readFileSync(path.join(FOLDER, f), "utf8");
      for (const m of isi.matchAll(/\b(?:FROM|JOIN)\s+`?([a-z_][a-z0-9_]*)`?/gi)) {
        const t = m[1].toLowerCase();
        if (t !== "dual" && t !== "select") tabelTerbukti.add(t);
      }
      for (const m of isi.matchAll(/\b[a-z]{1,3}\.([a-z_][a-z0-9_]*)\b/g)) ruasTerbukti.add(m[1].toLowerCase());
    });
  const pakai = B.namaSippDipakai();
  cek(
    "tiap tabel pernah dipakai kueri lain",
    pakai.tabel.every((t) => tabelTerbukti.has(t)),
    pakai.tabel.filter((t) => !tabelTerbukti.has(t)).join(", ")
  );
  cek(
    "tiap ruas pernah dipakai kueri lain",
    pakai.ruas.every((r) => ruasTerbukti.has(r)),
    pakai.ruas.filter((r) => !ruasTerbukti.has(r)).join(", ")
  );

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((e) => {
  console.log("  GAGAL  penjaga sendiri meledak - " + String(e && e.message ? e.message : e));
  console.log(`\nHasil: ${lulus} lulus, ${gagal + 1} gagal`);
  process.exit(1);
});
