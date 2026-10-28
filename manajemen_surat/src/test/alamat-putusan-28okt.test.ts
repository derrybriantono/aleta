// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28 Okt 2026 - keterangan arah di dalam KURUNG pada alamat pihak ("Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi", perkara 630/Pdt.G/2026/PA.Dgl)
 * hanya untuk juru sita: paket abt-paket/alamat-putusan-28okt membuangnya di PUTUSAN (variabel 7047 7048 8700 8890 9349 9350 dan fungsi identitas/utama), RELAAS tetap utuh.
 * Uji ini tidak memakai DB. Perilaku aturan dijaga dengan TIRUAN TypeScript atas fungsi SQL yang memakai ungkapan reguler YANG DIBACA dari FUNGSI.sql (jadi mengubah daftar kata di SQL
 * langsung mengubah hasil uji). Pembandingan atas data nyata, pasang/pulih bolak-balik dan render php56 ada di PASANG.md paket.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/alamat-putusan-28okt");
const dir27 = path.join(akar, "abt-paket/pihak-urut-ecourt-27okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-alamat-putusan-28okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const ring = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; lama_md5: string; baru_md5: string; diganti: number }[];
  fungsi_ap: Record<string, string>;
  fungsi_diganti: Record<string, { lama_md5: string; baru_md5: string }>;
  harap: string;
  ulang: string;
  tidak_diubah_memanggil_alamat: number[];
};
const ring27 = JSON.parse(readFileSync(path.join(dir27, "hasil/isi-paket.json"), "utf8")) as {
  fungsi_baru: Record<string, string>;
  fungsi_x9: Record<string, { baru_md5: string }>;
};
const NO_UBAH = [7047, 7048, 8700, 8890, 9349, 9350];
const fungsiSql = baca(`${N}-FUNGSI.sql`);

function badan(nama: string): string {
  const m = new RegExp(`CREATE FUNCTION ${nama}\\([\\s\\S]*?\\nBEGIN\\n([\\s\\S]*?)\\nEND\\$\\$`).exec(fungsiSql.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`fungsi ${nama} tidak ada`);
  return `BEGIN\n${m[1]}\nEND`;
}

// ---- tiruan isian_rtf_alamat_arah: ungkapan reguler dibaca dari badan fungsi SQL (urutan: kosong, gaib, awalan dipertahankan, kata petunjuk, awalan penanda tempat)
const reguler = [...badan("isian_rtf_alamat_arah").matchAll(/s REGEXP '([^']*)'/g)].map((m) => new RegExp(m[1]));
function arah(isi: string): 0 | 1 {
  const s = isi.trim().toLowerCase();
  if (reguler.length !== 5) throw new Error("ungkapan reguler berubah");
  if (reguler[0].test(s)) return 1;
  if (reguler[1].test(s)) return 0;
  if (reguler[2].test(s)) return 0;
  if (reguler[3].test(s)) return 1;
  if (reguler[4].test(s)) return 1;
  return 0;
}
// ---- tiruan isian_rtf_alamat_buang_arah (langkah demi langkah seperti fungsi SQL)
function buang(x: string | null): string | null {
  if (x === null) return null;
  if (!x.includes("(")) return x;
  const s = x;
  const n = s.length;
  let o = "";
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c !== "(") {
      o += c;
      i++;
      continue;
    }
    let d = 0;
    let j = i;
    let akhir = -1;
    while (j < n && akhir < 0) {
      if (s[j] === "(") d++;
      else if (s[j] === ")") {
        d--;
        if (d === 0) akhir = j;
      }
      if (akhir < 0) j++;
    }
    if (akhir < 0) {
      o += c;
      i++;
      continue;
    }
    if (arah(s.slice(i + 1, akhir)) === 1) {
      o = o.replace(/ +$/, "");
      if (o.endsWith("(")) o = o.slice(0, -1).replace(/ +$/, "");
      let k = akhir + 1;
      while (k < n && s[k] === " ") k++;
      let c2 = s[k] ?? "";
      if (c2 === "," && (o === "" || o.endsWith(","))) {
        k++;
        while (k < n && s[k] === " ") k++;
        c2 = s[k] ?? "";
      }
      if (o !== "" && c2 !== "" && ![",", ".", ";", ")"].includes(c2)) o += " ";
      i = k;
    } else {
      o += s.slice(i, akhir + 1);
      i = akhir + 1;
    }
  }
  return o;
}

describe("alamat-putusan - berkas paket utuh", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker dan memuat semua berkas wajib", () => {
    const nama = new Set<string>();
    for (const b of baca("MD5SUMS.txt").trim().split("\n")) {
      const [m, n] = b.split(/\s+/);
      nama.add(n);
      expect(md5(readFileSync(pk(n))), n).toBe(m);
    }
    for (const w of ["FUNGSI", "FUNGSI-LAMA", "FUNGSI-CEK", "PASANG", "PERIKSA", "PRASYARAT", "PULIH", "UJIVAR"]) expect(nama.has(`${N}-${w}.sql`), w).toBe(true);
    for (const w of ["pasang-satker.sh", "pulih-satker.sh", "harap.txt", "nomor-ubah.txt", "perkara-uji.txt"]) expect(nama.has(w), w).toBe(true);
  });

  it("SQL paket ASCII dan tanpa kata aplikasi (tidak boleh masuk ABT)", () => {
    for (const b of ["FUNGSI", "FUNGSI-LAMA", "FUNGSI-CEK", "PRASYARAT", "PASANG", "PERIKSA", "PULIH", "UJIVAR"]) {
      const sql = baca(`${N}-${b}.sql`);
      expect(sql, b).not.toMatch(/[^\x09\x0a\x0d\x20-\x7e]/);
      expect(sql.toLowerCase(), b).not.toContain("aleta");
    }
  });

  it("md5 fungsi baru di isi-paket.json sama dengan badan fungsi di FUNGSI.sql (dan hanya 3 fungsi AP, semuanya berkomentar AP:)", () => {
    for (const f of ["isian_rtf_alamat_arah", "isian_rtf_alamat_buang_arah", "isian_rtf_alamat_putusan"]) {
      expect(md5(badan(f)), f).toBe(ring.fungsi_ap[f]);
      expect(fungsiSql).toMatch(new RegExp(`CREATE FUNCTION ${f}\\([^]*?COMMENT 'AP:`));
    }
    expect(Object.keys(ring.fungsi_ap).length).toBe(3);
  });
});

describe("alamat-putusan - hanya putusan berubah, relaas tetap", () => {
  it("tepat enam variabel diubah, bukan relaas / alamat langsung / eksekusi", () => {
    expect(ring.ubah.map((u) => u.no)).toEqual(NO_UBAH);
    expect(baca("nomor-ubah.txt").trim()).toBe(NO_UBAH.join(","));
    // yang memanggil isian_rtf_alamat langsung dan TIDAK diubah: alamat langsung blangko (3517-3519, 10126), eksekusi (3943 3944), relaas (7108 7109 9230 9231 9292 9293)
    expect(ring.tidak_diubah_memanggil_alamat).toEqual([3517, 3518, 3519, 3943, 3944, 7108, 7109, 9230, 9231, 9292, 9293, 10126]);
    const pasang = baca(`${N}-PASANG.sql`);
    const diubah = [...pasang.matchAll(/UPDATE abt_variabel SET sql_query=0x[0-9a-f]+, modified='[^']*' WHERE \(no_var=(\d+) /g)].map((m) => Number(m[1]));
    expect(diubah).toEqual(NO_UBAH);
    for (const tidak of ring.tidak_diubah_memanggil_alamat) expect(diubah).not.toContain(tidak);
  });

  it("PEMBALIKAN: kueri baru dibalik (isian_rtf_alamat_putusan -> isian_rtf_alamat) memberi md5 kueri LAMA persis; satu-satunya perubahan adalah pembungkusnya", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    for (const m of pasang.matchAll(/UPDATE abt_variabel SET sql_query=0x([0-9a-f]+), modified='[^']*' WHERE \(no_var=(\d+) /g)) {
      const baruQ = Buffer.from(m[1], "hex").toString("latin1");
      const no = Number(m[2]);
      const u = ring.ubah.find((x) => x.no === no)!;
      expect(md5(Buffer.from(baruQ, "latin1")), `baru ${no}`).toBe(u.baru_md5);
      expect(baruQ.match(/aps_badilag\.isian_rtf_alamat_putusan\(/g)?.length, no).toBe(u.diganti);
      expect(baruQ).not.toMatch(/aps_badilag\.isian_rtf_alamat\(/);
      const balik = baruQ.replace(/aps_badilag\.isian_rtf_alamat_putusan\(/g, "aps_badilag.isian_rtf_alamat(");
      expect(md5(Buffer.from(balik, "latin1")), `lama ${no}`).toBe(u.lama_md5);
    }
  });

  it("fungsi identitas dan utama (paket 27 Okt) hanya berganti pembungkus alamat; dibalik = md5 paket 27 Okt persis; LAMA.sql = paket 27 Okt", () => {
    const lama27: Record<string, string> = {
      isian_rtf_pihak_identitas: ring27.fungsi_baru.isian_rtf_pihak_identitas,
      isian_rtf_pihak_utama: ring27.fungsi_x9.isian_rtf_pihak_utama.baru_md5,
    };
    const sumber27 = readFileSync(path.join(dir27, "paket-satker/abt-pihak-urut-ecourt-27okt-FUNGSI.sql"), "utf8").replace(/\r\n/g, "\n");
    const lamaSql = baca(`${N}-FUNGSI-LAMA.sql`).replace(/\r\n/g, "\n");
    for (const f of Object.keys(lama27)) {
      const b = badan(f);
      expect(md5(b), f).toBe(ring.fungsi_diganti[f].baru_md5);
      expect(b.match(/isian_rtf_alamat_putusan\(/g)?.length, f).toBe(2);
      expect(md5(b.replace(/isian_rtf_alamat_putusan\(/g, "isian_rtf_alamat(")), f).toBe(lama27[f]);
      expect(ring.fungsi_diganti[f].lama_md5).toBe(lama27[f]);
      const mm = new RegExp(`CREATE FUNCTION ${f}\\([\\s\\S]*?\\nBEGIN\\n([\\s\\S]*?)\\nEND\\$\\$`).exec(lamaSql)!;
      expect(md5(`BEGIN\n${mm[1]}\nEND`), `LAMA ${f}`).toBe(lama27[f]);
      expect(sumber27).toContain(mm[1]);
    }
  });

  it("PRASYARAT: harap/ulang, isi lama paket 27 Okt, isian_rtf_alamat persis, G menghitung baris yang bukan lama bukan baru", () => {
    expect(ring.harap).toBe("2|0|6|0|0|1|0");
    expect(ring.ulang).toBe("0|2|0|6|3|1|0");
    expect(baca("harap.txt")).toBe(`${ring.harap}\n${ring.ulang}\n`);
    const sql = baca(`${N}-PRASYARAT.sql`);
    for (const u of ring.ubah) {
      expect(sql).toContain(u.lama_md5);
      expect(sql).toContain(u.baru_md5);
    }
    for (const f of Object.keys(ring.fungsi_diganti)) {
      expect(sql).toContain(ring.fungsi_diganti[f].lama_md5);
      expect(sql).toContain(ring.fungsi_diganti[f].baru_md5);
    }
    for (const h of Object.values(ring.fungsi_ap)) expect(sql).toContain(h);
    expect(sql).toContain("dfb14adb3ed8e29efaea5e2e03c6983b");
  });

  it("PERIKSA menjaga relaas, memakai contoh 630, dan berakhir SEMUA COCOK; PULIH hanya bila isi masih BARU", () => {
    const pr = baca(`${N}-PERIKSA.sql`);
    expect(pr).toContain("SEMUA COCOK");
    expect(pr).toContain("Jalan Poros Palu-Bangga, Desa Poi");
    expect(pr).toContain("(3517,3518,3519,3943,3944,7108,7109,9230,9231,9292,9293,10126)");
    expect(baca(`${N}-PULIH.sql`)).toMatch(/JOIN pu_lama l ON l\.no_var=a\.no_var/);
    const sh = baca("pasang-satker.sh");
    expect(sh.indexOf("PRASYARAT")).toBeLessThan(sh.indexOf("mysqldump"));
    expect(sh.indexOf("mysqldump")).toBeLessThan(sh.indexOf("-FUNGSI.sql"));
    expect(sh.indexOf("-FUNGSI.sql")).toBeLessThan(sh.indexOf("-PASANG.sql"));
    expect(sh.indexOf("-PASANG.sql")).toBeLessThan(sh.indexOf("-PERIKSA.sql"));
    expect(baca("pulih-satker.sh")).toContain("-FUNGSI-LAMA.sql");
  });
});

describe("alamat-putusan - aturan buang kurung (tiruan atas ungkapan reguler SQL)", () => {
  it("perkara 630: keterangan arah dibuang, tanda baca sesudahnya benar", () => {
    const a = "Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi, Kecamatan Dolo Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah";
    expect(buang(a)).toBe("Jalan Poros Palu-Bangga, Desa Poi, Kecamatan Dolo Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah");
  });

  it("spasi dan koma di sekitar kurung dirapikan: spasi sebelum koma, tanpa koma, di awal, di ujung, bersebelahan koma", () => {
    expect(buang("Jalan Mantilayo No. 103 (samping PAUD X) , Mamboro, Palu")).toBe("Jalan Mantilayo No. 103, Mamboro, Palu");
    expect(buang("Dusun I ( rumah di perbatasan Desa A - Desa B) Desa B, Kecamatan C")).toBe("Dusun I Desa B, Kecamatan C");
    expect(buang("(rumah bapak X) Desa Y, Kecamatan Z")).toBe("Desa Y, Kecamatan Z");
    expect(buang("(Lorong Pasar), RT 002 RW 001, Desa M")).toBe("RT 002 RW 001, Desa M");
    expect(buang("Desa Oti (rumah depan kantor Desa Oti)")).toBe("Desa Oti");
    expect(buang("Dusun III, (rumah samping toko), Desa Lero")).toBe("Dusun III, Desa Lero");
    expect(buang("Desa P  (depan SD ) Kecamatan Q")).toBe("Desa P Kecamatan Q");
    expect(buang("Jalan R (sekitar mesjid) (belakang kios), Desa S")).toBe("Jalan R, Desa S");
  });

  it("kurung bertingkat dibuang utuh; kurung tak berpasangan dibiarkan", () => {
    expect(buang("Jalan T (Lorong Depan Mesjid Al (rumah Cat Putih)), Desa U")).toBe("Jalan T, Desa U");
    expect(buang("Jalan Poros Palu-Mamuju (Lapas, Kelurahan Ganti")).toBe("Jalan Poros Palu-Mamuju (Lapas, Kelurahan Ganti");
    expect(buang("Desa V ((rumah pertama dalam lorong), Kecamatan W")).toBe("Desa V, Kecamatan W");
  });

  it("bagian alamat dan keterangan status DIPERTAHANKAN: GAIB, RT/RW, dusun, jalan, kompleks, riwayat", () => {
    for (const a of [
      "Desa Labean Kecamatan Balaesang Kabupaten Donggala (GAIB)",
      "Desa Loru (RT/RW 03/03), Kec. Sigi Biromaru",
      "Desa Wombo (dusun III), Kecamatan Tanantovea",
      "Desa Sibalaya Utara (Jalan Poros Palu-Kulawi) Kec. Tanambulava",
      "Jalan X (BTN Permata Biru), Kelurahan Y",
      "Jalan Poros Palu Bangga RT/RW:001/001, Desa Pewunu, (dahulu), sekarang Jl. Kadondong",
      "Jalan Malontara, RT004/RW007 (sesuai dengan surat tanda bukti pendataan penduduk non-permanen)",
      "Jalan Dewi Sartika (Lapas Kelas IIA), Petobo",
    ]) {
      expect(buang(a), a).toBe(a);
    }
  });

  it("alamat tanpa kurung tidak berubah sama sekali (termasuk spasi ganda, koma dan NULL)", () => {
    for (const a of ["", "Desa  Watatu ,Kecamatan Banawa  Selatan,,Kabupaten Donggala", "Jalan A, Desa B, Kecamatan C", "Desa A)"]) expect(buang(a)).toBe(a);
    expect(buang(null)).toBeNull();
  });

  it("klasifikasi isi kurung: petunjuk arah dan penanda tempat dibuang; GAIB, RT/RW, wilayah, jalan, kompleks, riwayat dipertahankan; kosong dibuang", () => {
    for (const i of ["rumah sesudah Jembatan", "depan Mesjid Al-Furqan", "Samping SD 2", "sekitar lapangan bola", "Lorong Pramuka", "Kios Dinda Disti", "perbatasan Desa A-B", "dibelakang bala desa", "di rumahnya Bapak X", " ", "cat warna biru", "100 meter dari kantor"])
      expect(arah(i), i).toBe(1);
    for (const i of ["GAIB", "gaib", "RT/RW 003/001", "RT.RW.005.004", "Dusun III", "Desa Tua", "Jl. Pogampe", "Jalan Poros Palu-Kulawi", "Gang Hikma", "BTN Sakinah", "Huntara", "Perumahan Nelayan", "Lapas Palu", "dahulu", "sesuai surat", "Blok C No 5"])
      expect(arah(i), i).toBe(0);
  });
});
