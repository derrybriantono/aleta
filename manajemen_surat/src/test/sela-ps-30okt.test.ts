// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALUR_BAS_BARU } from "@/lib/alur-bas-baru-data";
import { tentukanBasBaru } from "@/lib/alur-bas-baru";
import { FOLDER_MENU_PUTUSAN, PUTUSAN_SELA_UMUM, rekomendasiBasSela, rekomendasiBlangko, rekomendasiPutusanSela } from "@/lib/rekomendasi-blangko";
import { folderTugas } from "@/lib/tugas-blangko";

/**
 * 30 Okt 2026 - paket ABT abt-paket/sela-ps-30okt: putusan sela SEMUA jenis perkara di bab baru "97a Putusan Sela" (menu 151) + BAS sela (menu 152),
 * dan BAS pemeriksaan setempat di folder BAS jenis kebendaan (HB/waris ditimpa, wasiat/hibah/wakaf/ES acara biasa baru). Uji ini menjaga isi paket di
 * repo (tanpa DB): md5, matriks jenis x status lengkap, amar sesuai status (biaya ditangguhkan / biaya putusan akhir prodeo DIPA), rujukan pasal acara
 * hanya lewat variabel ACARA, tanpa nama aplikasi / nama satker, SQL aman MariaDB 5.5, dan saran blangko portal.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/sela-ps-30okt");
const ps = path.join(dir, "paket-satker");
const N = "abt-sela-ps-30okt";
const baca = (b: string) => readFileSync(path.join(ps, b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const tsv = (b: string) => baca(b).split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const RTF = tsv("daftar-rtf.tsv");
const TIMPA = tsv("daftar-timpa.tsv");
const rtfMentah = (folder: string, berkas: string, sub = "rtf") => readFileSync(path.join(ps, sub, folder, berkas)).toString("latin1");
const NOMOR = baca("nomor-variabel.txt").split("\n").filter((l) => /^\d+$/.test(l)).map(Number);
const DIRUJUK = baca("nomor-dirujuk.txt").split("\n").filter((l) => /^\d/.test(l))[0].split(",").map(Number);
/** teks polos kasar RTF: kontrol dan kurung dibuang, kelompok tersembunyi isian asal dibuang */
const polos = (r: string) =>
  r
    .slice(Math.max(0, r.indexOf("\\pard", r.indexOf("\\sectd"))))
    .replace(/\{\\(?:header|footer)[lrf]?\b(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/\{\\\*\\isianasal [^{}]*\}/g, "")
    .replace(/\\'[0-9a-f]{2}/g, "")
    .replace(/\\tab /g, "\t")
    .replace(/\\(?:par|cell|row)\b ?/g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/^[\s\S]*?(?=^(?:PUTUSAN|PENETAPAN|BERITA ACARA SIDANG|SISIPAN PUTUSAN))/m, ""); // kepala/kaki halaman (nomor halaman) sebelum judul dibuang
const F = "derry_briantono/97a Putusan Sela";
const FB = "derry_briantono/97a Putusan Sela - BAS";
const sela = RTF.filter((x) => x[0] === F);
const cari = (pola: RegExp) => {
  const x = sela.find((r) => pola.test(r[1]));
  if (!x) throw new Error(`blangko tidak ada: ${pola}`);
  return polos(rtfMentah(x[0], x[1]));
};

describe("paket putusan sela & pemeriksaan setempat 30 Okt - isi paket", () => {
  it("MD5SUMS.txt cocok dan memuat setiap berkas paket-satker; tidak ada folder cadangan uji di repo", () => {
    const daftar = new Set<string>();
    for (const b of baca("MD5SUMS.txt").trim().split("\n")) {
      const [m, ...n] = b.split(/\s{2}/);
      const nama = n.join("  ");
      daftar.add(nama);
      expect(md5(readFileSync(path.join(ps, nama))), nama).toBe(m);
    }
    const nyata: string[] = [];
    const jalan = (d: string, rel: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === "cadangan" || e.name === "MD5SUMS.txt") continue;
        if (e.isDirectory()) jalan(path.join(d, e.name), `${rel}${e.name}/`);
        else nyata.push(`${rel}${e.name}`);
      }
    };
    jalan(ps, "");
    expect([...daftar].sort()).toEqual(nyata.sort());
    expect(existsSync(path.join(ps, "cadangan"))).toBe(false);
  });

  it("68 blangko baru + 2 ditimpa; md5 daftar cocok; yang ditimpa hanya BAS pemeriksaan setempat HB dan waris dengan md5 dasar pohon server", () => {
    // 33 putusan sela + 9 BAS sela + 6 BAS PS jenis (4c/4d/4e/10a + cerai 1/1a) + 19 BAS mediasi elektronik [1e] + 1 PTSP @ 4a
    expect(RTF).toHaveLength(68);
    for (const [folder, berkas, h] of RTF) expect(md5(readFileSync(path.join(ps, "rtf", folder, berkas))), berkas).toBe(h);
    expect(TIMPA.map((x) => `${x[0]}/${x[1]}`).sort()).toEqual([
      "derry_briantono/4a Harta Bersama - BAS/BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf",
      "derry_briantono/4b Kewarisan - BAS/BAS ALUR 32 Waris - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf",
    ]);
    for (const [folder, berkas, lama, baru] of TIMPA) {
      expect(lama).toBe("2a660b9945072e99b61cdc22f8a7fe91"); // pohon server perkiraan dasar2/dasar3 (tidak disentuh paket 29-30 Okt lain)
      expect(md5(readFileSync(path.join(ps, "timpa", folder, berkas)))).toBe(baru);
    }
    expect(baca("folder-baru.txt")).toContain(F);
    expect(baca("folder-baru.txt")).toContain(FB);
  });

  it("RTF: kurung seimbang, latin1, tanpa nama aplikasi dan nama satker tertulis mati, semua penanda variabel dikenal", () => {
    const dikenal = new Set([...NOMOR, ...DIRUJUK]);
    const semua = [...RTF.map((x) => rtfMentah(x[0], x[1])), ...TIMPA.map((x) => rtfMentah(x[0], x[1], "timpa"))];
    for (const r of semua) {
      let d = 0;
      for (let i = 0; i < r.length; i += 1) {
        if (r[i] === "\\") i += 1;
        else if (r[i] === "{") d += 1;
        else if (r[i] === "}") d -= 1;
      }
      expect(d).toBe(0);
      expect(r.toLowerCase()).not.toContain("aleta");
      expect(r).not.toMatch(/Donggala|Bungku|Morowali|Majene|Banjarbaru/i);
      for (const m of r.matchAll(/#(\d{4,5})#/g)) expect(dikenal.has(Number(m[1])), m[1]).toBe(true);
    }
  });

  it("rujukan pasal hukum acara hanya lewat variabel ACARA 11300-11309 (padanan HIR satu tempat); tanpa HIR di blangko", () => {
    for (const [folder, berkas] of RTF) {
      const t = polos(rtfMentah(folder, berkas));
      if (folder === F && /\[NO\]/.test(berkas)) continue; // putusan akhir: kaki/rincian blangko [99c] dipakai apa adanya
      if (/\[1e\]|@ 4a/.test(berkas)) continue; // mediasi elektronik: blangko mediasi Derry yang ada (Pasal 154 RBg di aslinya) + sisipan
      expect(t, berkas).not.toMatch(/Pasal\s+\d+[^.;#]{0,40}\bRBg\b/);
      expect(t, berkas).not.toMatch(/\bHIR\b/);
    }
    const sql = baca(`${N}-PASANG.sql`);
    expect(sql).toContain("START TRANSACTION;");
    expect(sql).not.toMatch(/REGEXP_REPLACE|\bWITH\s+\w+\s+AS\s*\(|\bOVER\s*\(/i); // MariaDB 5.5 server
  });

  it("SQL: variabel baru 11300-11499 saja, menu 151/152, PRASYARAT/PERIKSA/PULIH bersidik md5; tanpa nama aplikasi", () => {
    expect(NOMOR.length).toBe(102);
    // blok 11600-11619 milik paket sampul: tidak boleh dipakai
    expect(NOMOR.some((n) => n >= 11600 && n <= 11619)).toBe(false);
    expect(NOMOR.every((n) => n >= 11300 && n <= 11499)).toBe(true);
    const pasang = baca(`${N}-PASANG.sql`);
    expect((pasang.match(/INSERT INTO abt_variabel /g) ?? []).length).toBe(NOMOR.length);
    expect((pasang.match(/INSERT INTO abt_menu /g) ?? []).length).toBe(2);
    for (const n of NOMOR) expect(pasang).toContain(`WHERE no_var = ${n});`);
    const pulih = baca(`${N}-PULIH.sql`);
    expect((pulih.match(/DELETE FROM abt_variabel WHERE no_var = \d+ AND MD5/g) ?? []).length).toBe(NOMOR.length);
    expect(pulih).toMatch(/DELETE FROM abt_menu WHERE id = 151 AND MD5/);
    expect(baca(`${N}-PERIKSA.sql`)).toContain("SEMUA COCOK");
    expect(baca("harap.txt").trim().split("\n")).toEqual([`0|0|${DIRUJUK.length}|0|0|2`, `0|${NOMOR.length}|${DIRUJUK.length}|0|2|2`]);
    for (const b of [`${N}-PASANG.sql`, `${N}-PRASYARAT.sql`, `${N}-PULIH.sql`, `${N}-PERIKSA.sql`, "uji-kueri.tsv"]) {
      const isi = baca(b);
      // kata aplikasi hanya boleh di nama variabel? tidak - sama sekali tidak boleh; hex juga diperiksa
      expect(isi.toLowerCase(), b).not.toContain("aleta");
      expect(isi.toLowerCase(), b).not.toContain(Buffer.from("aleta").toString("hex"));
    }
    // variabel paket prodeo yang dirujuk (amar biaya DIPA + rincian) harus ada di server: diperiksa PRASYARAT C
    for (const n of [11122, 11123, 11130, 11140]) expect(DIRUJUK).toContain(n);
    expect(baca(`${N}-PASANG.sql`)).toContain("0x" + Buffer.from("97a Putusan Sela - BAS").toString("hex"));
  });

  it("pulih tidak menghapus permanen: berkas baru dipindah ke arsip pulih, isian dicadangkan sebelum variabel dihapus", () => {
    const br = baca("berkas_rtf.py");
    expect(br).toContain("pulih-arsip");
    expect(br).not.toMatch(/os\.remove\(dst\)/);
    const pu = baca("pulih-satker.sh");
    expect(pu).toMatch(/abt_data_teks-pulih-/);
    expect(pu.indexOf("abt_data_teks-pulih-")).toBeLessThan(pu.indexOf(`${"$"}N-PULIH.sql`));
  });
});

describe("matriks putusan sela jenis x status", () => {
  const MATRIKS: Array<[RegExp, string, "sela" | "akhir" | "penetapan" | "penetapan-periksa" | "sisipan"]> = [
    [/^\[01\] \[Sela Tolak\] Eksepsi Kewenangan Absolut Ditolak/, "Menolak eksepsi", "sela"],
    [/^\[02\] \[NO\] Eksepsi Kewenangan Absolut Dikabulkan/, "Mengabulkan eksepsi", "akhir"],
    [/^\[03\] \[Sela Tolak\] Eksepsi Kewenangan Relatif Ditolak/, "Menolak eksepsi", "sela"],
    [/^\[04\] \[NO\] Eksepsi Kewenangan Relatif Dikabulkan/, "Mengabulkan eksepsi", "akhir"],
    [/^\[05\] \[Sela Kabul\] Tuntutan Provisi Dikabulkan/, "Mengabulkan tuntutan provisi", "sela"],
    [/^\[06\] \[Sela Tolak\] Tuntutan Provisi Ditolak/, "Menolak tuntutan provisi", "sela"],
    [/^\[07\] \[Sela Kabul\] Intervensi Voeging/, "Mengabulkan permohonan intervensi", "sela"],
    [/^\[08\] \[Sela Tolak\] Intervensi Voeging/, "Menolak permohonan intervensi", "sela"],
    [/^\[09\] \[Sela Kabul\] Intervensi Tussenkomst/, "Mengabulkan permohonan intervensi", "sela"],
    [/^\[10\] \[Sela Tolak\] Intervensi Tussenkomst/, "Menolak permohonan intervensi", "sela"],
    [/^\[11\] \[Sela Kabul\] Intervensi Vrijwaring/, "Mengabulkan permohonan intervensi", "sela"],
    [/^\[12\] \[Sela Tolak\] Intervensi Vrijwaring/, "Menolak permohonan intervensi", "sela"],
    [/^\[13\] \[Sela\] Sumpah Pelengkap \(Suppletoir\) - Gugatan/, "Memerintahkan #11339# untuk mengangkat sumpah pelengkap", "sela"],
    [/^\[14\] \[Sela\] Sumpah Pelengkap \(Suppletoir\) - Permohonan/, "Memerintahkan #11339# untuk mengangkat sumpah pelengkap", "penetapan"],
    [/^\[15\] \[Sela\] Pemeriksaan Setempat/, "Memerintahkan dilaksanakan pemeriksaan setempat", "sela"],
    // 30 Okt putaran 2 (jawaban pengguna butir 7-9)
    [/^\[16\] \[NO\] Eksepsi Gugatan Kabur/, "Mengabulkan eksepsi #7037#", "akhir"],
    [/^\[17\] \[Sisipan\] Eksepsi Gugatan Kabur/, "Menolak eksepsi #7037#", "sisipan"],
    [/^\[18\] \[NO\] Eksepsi Keliru Pihak/, "Mengabulkan eksepsi #7037#", "akhir"],
    [/^\[19\] \[Sisipan\] Eksepsi Keliru Pihak/, "Menolak eksepsi #7037#", "sisipan"],
    [/^\[20\] \[NO\] Eksepsi Kurang Pihak/, "Mengabulkan eksepsi #7037#", "akhir"],
    [/^\[21\] \[Sisipan\] Eksepsi Kurang Pihak/, "Menolak eksepsi #7037#", "sisipan"],
    [/^\[22\] \[NO\] Eksepsi Ne Bis In Idem/, "Mengabulkan eksepsi #7037#", "akhir"],
    [/^\[23\] \[Sisipan\] Eksepsi Ne Bis In Idem/, "Menolak eksepsi #7037#", "sisipan"],
    [/^\[24\] \[NO\] Eksepsi Gugatan Prematur/, "Mengabulkan eksepsi #7037#", "akhir"],
    [/^\[25\] \[Sisipan\] Eksepsi Gugatan Prematur/, "Menolak eksepsi #7037#", "sisipan"],
    [/^\[26\] \[Sela\] Gugatan Rekonvensi Tidak Dapat Diterima/, "Menyatakan gugatan rekonvensi #7037# tidak dapat diterima", "sela"],
    [/^\[27\] \[Sela Kabul\] Penggabungan Perkara/, "Mengabulkan permohonan penggabungan perkara", "sela"],
    [/^\[28\] \[Sela Tolak\] Penggabungan Perkara/, "Menolak permohonan penggabungan perkara", "sela"],
    [/^\[29\] \[Sela\] Sumpah Pemutus/, "Memerintahkan #11383# untuk mengangkat sumpah pemutus", "sela"],
    [/^\[30\] \[Sela\] Sumpah Penaksir/, "Memerintahkan #11339# untuk mengangkat sumpah penaksir", "sela"],
    [/^\[31\] \[Sela\] Sumpah Lian/, "Memerintahkan #11392# untuk mengucapkan sumpah li'an", "sela"],
    [/^\[32\] \[Penetapan\] Tergugat Tidak Beriktikad Baik/, "Menghukum #7037# untuk membayar biaya mediasi sejumlah #11398#", "penetapan-periksa"],
    [/^\[33\] \[NO\] Penggugat Tidak Beriktikad Baik/, "Menghukum #7036# untuk membayar biaya mediasi sejumlah #11398#", "akhir"],
  ];
  const TANGGUH = "Menangguhkan pembebanan biaya perkara hingga putusan akhir.";

  it("33 blangko putusan sela (sita tetap di 97 Sita [01]/[02]); tiap sel jenis x status punya tepat satu blangko", () => {
    expect(sela).toHaveLength(33);
    expect(MATRIKS).toHaveLength(33);
    for (const [pola] of MATRIKS) expect(sela.filter((x) => pola.test(x[1])), String(pola)).toHaveLength(1);
  });

  it("amar sesuai status: sela = biaya ditangguhkan (kalimat baku) tanpa rincian; putusan akhir = amar biaya putusan akhir (prodeo DIPA #11122#) dan rincian", () => {
    for (const [pola, amar, jenis] of MATRIKS) {
      const t = cari(pola);
      const mengadili = t.slice(t.lastIndexOf(/penetapan/.test(jenis) ? "MENETAPKAN" : "MENGADILI"));
      expect(mengadili, String(pola)).toContain(amar);
      if (jenis === "akhir") {
        expect(t.split("\n")[0]).toMatch(/^PUTUSAN\s*$/m);
        expect(mengadili).toContain("#11122#.");
        expect(t).toMatch(/#11319#|#11403#/);
        expect(t).toContain("Rincian Biaya Perkara");
        expect(t).not.toContain("Menangguhkan");
        // butir 3: eksepsi/iktikad dikabulkan = gugatan tidak dapat diterima
        expect(mengadili, String(pola)).toContain("Menyatakan #0053# #7036# tidak dapat diterima");
      } else if (jenis === "sisipan") {
        expect(t).toMatch(/^SISIPAN PUTUSAN AKHIR/);
        expect(t).toContain("Dalam Eksepsi");
        expect(t).not.toContain("Menangguhkan");
        expect(t).not.toContain("#8500#");
        continue;
      } else {
        expect(t).toMatch(jenis === "penetapan" ? /^PENETAPAN SELA/ : jenis === "penetapan-periksa" ? /^PENETAPAN\s*$/m : /^PUTUSAN SELA/);
        // butir 2: kalimat baku persis, tanpa rincian biaya
        expect(mengadili).toMatch(jenis === "penetapan" ? /Menangguhkan pembebanan biaya perkara hingga penetapan akhir\.\s*$/m : /Menangguhkan pembebanan biaya perkara hingga putusan akhir\.\s*$/m);
        expect(t).toContain("Pasal 89 ayat (2)");
        expect(t).not.toContain("Rincian Biaya");
        expect(t).not.toContain("#11122#");
        expect(t).toContain(jenis === "penetapan-periksa" ? "#11402#" : "#11311#"); // kaki: kehadiran pada sidang yang dicetak
        // butir 4: pasal putusan sela dikutip lewat variabel ACARA (Pasal 196 ayat (1) RBg = Pasal 185 ayat (1) HIR)
        if (jenis !== "penetapan-periksa") expect(t, String(pola)).toContain("#11370#");
      }
      expect(t).toContain("#8500#"); // tanda tangan majelis/hakim tunggal & PP
      expect(t).toMatch(/#7047#/); // identitas pihak (pihak banyak)
    }
  });

  it("eksepsi kewenangan dikabulkan: gugatan tidak dapat diterima; absolut ditolak: bidang Pasal 49 dan Pasal 50 menurut jenis perkara", () => {
    for (const p of [/^\[02\]/, /^\[04\]/]) expect(cari(p)).toContain("Menyatakan #0053# #7036# tidak dapat diterima (niet ontvankelijke verklaard);");
    const t = cari(/^\[01\]/);
    expect(t).toContain("#11372#");
    expect(t).toContain("#11373#");
    expect(TANGGUH).toBe("Menangguhkan pembebanan biaya perkara hingga putusan akhir.");
    // pemeriksaan setempat: tambah panjar (butir 12)
    expect(cari(/^\[15\]/)).toContain("Memerintahkan #11397# untuk membayar tambahan panjar biaya pemeriksaan setempat sejumlah #11396#");
  });

  it("pihak: gugatan memuat Tergugat, Turut Tergugat; intervensi memuat pemohon intervensi; permohonan tanpa melawan", () => {
    expect(cari(/^\[01\]/)).toContain("#7048##8710##7054#");
    expect(cari(/^\[07\]/)).toContain("#11327#");
    expect(cari(/^\[07\]/)).not.toContain("#7054#");
    expect(cari(/^\[14\]/)).not.toMatch(/\nmelawan\n/);
    expect(cari(/^\[14\]/)).toContain("MENETAPKAN");
  });
});

describe("BAS pemeriksaan setempat per jenis dan BAS sela", () => {
  const PS = [...RTF.filter((x) => / - Sidang PS - |\[PS\]/.test(x[1])), ...TIMPA.map((x) => [x[0], x[1], "timpa"])];
  it("8 folder BAS (HB, waris, wasiat, hibah, wakaf, ES acara biasa, cerai gugat/talak kumulasi HB); isi sama, objek per jenis, tanya-jawab, gambar situasi", () => {
    expect(PS.map((x) => x[0]).sort()).toEqual(
      ["10a Ekonomi Syariah Biasa", "4a Harta Bersama", "4b Kewarisan", "4c Wasiat", "4d Hibah", "4e Wakaf", "1 Perceraian CG", "1a Perceraian CT"].map((f) => `derry_briantono/${f} - BAS`).sort()
    );
    for (const [folder, berkas, sub] of PS) {
      const r = rtfMentah(folder, berkas, sub === "timpa" ? "timpa" : "rtf");
      const t = polos(r);
      expect(t).toMatch(/^\s*BERITA ACARA SIDANG/);
      for (const v of ["#9165#", "#11346#", "#9167#", "#11353#", "#11354#", "#11352#", "#11348#", "#11304#", "#6034#", "#4004#"]) expect(t, `${berkas} ${v}`).toContain(v);
      expect(t).toContain("Gambar situasi atau denah objek sengketa"); // butir 11
      expect(r).toMatch(/\{\\\*\\isianasal #\d{4,5}#/); // isian objek & kesimpulan tampil di borang ABT
    }
    // cerai kumulasi harta bersama: objek dari isian harta bersama
    expect(rtfMentah("derry_briantono/1 Perceraian CG - BAS", PS.find((x) => x[0] === "derry_briantono/1 Perceraian CG - BAS")![1])).toMatch(/\{\\\*\\isianasal #8730#/);
  });

  it("BAS sela: insidentil, pembacaan (amar SIPP #9160#), tiap jenis sumpah tunda putusan / lalu putusan dibacakan, li'an", () => {
    const bas = RTF.filter((x) => x[0] === FB);
    expect(bas).toHaveLength(9);
    const t = (p: RegExp) => polos(rtfMentah(FB, bas.find((x) => p.test(x[1]))![1]));
    expect(t(/\[1\]/)).toContain("#11357#");
    expect(t(/\[2\]/)).toContain("#9160#");
    expect(t(/\[2\]/)).toContain("#11361#");
    for (const [kode, lafal] of [["3", "#11342#"], ["4", "#11387#"], ["5", "#11390#"]]) {
      expect(t(new RegExp(`\\[${kode}\\] `))).toContain(`"${lafal}";`);
      expect(t(new RegExp(`\\[${kode}\\] `))).toContain("#11365#"); // ditunda untuk musyawarah dan pembacaan
      const putus = t(new RegExp(`\\[${kode}a\\]`));
      expect(putus).toContain(`"${lafal}";`);
      for (const v of ["#0067#", "#9403#", "#0065#"]) expect(putus).toContain(v); // skors musyawarah lalu amar SIPP dibacakan
      expect(putus).not.toContain("#0133#");
    }
    const lian = t(/\[6\]/);
    expect(lian).toContain('"Demi Allah, saya bersaksi bahwa #11391#";');
    expect(lian).toContain("Laknat Allah atas diri saya");
    expect(lian).toContain("Murka Allah atas diri saya");
  });

  it("mediasi elektronik PERMA 3/2022: BAS [1e] di setiap folder yang punya BAS mediasi [1] dan penetapan PTSP @ 4a; berkas mediasi lama tidak disentuh", () => {
    const el = RTF.filter((x) => /\[1e\]/.test(x[1]));
    expect(el).toHaveLength(19);
    for (const [folder, berkas] of el) {
      expect(berkas).toBe(PUTUSAN_SELA_UMUM.mediasiElektronik);
      const r = rtfMentah(folder, berkas);
      const t = polos(r);
      expect(t).toContain("Peraturan Mahkamah Agung Nomor 3 Tahun 2022 tentang Mediasi di Pengadilan secara Elektronik");
      expect(t).toContain("untuk menempuh mediasi secara elektronik #11400#;");
      expect(t).toMatch(/7\.\t\s*Berdasarkan Peraturan Mahkamah Agung Nomor 3 Tahun 2022/);
      expect(t).toMatch(/8\.\t\s*Apabila para pihak sudah memahami/);
      expect(r).toMatch(/\{\\\*\\isianasal #11399#\}/);
    }
    const ptsp = RTF.find((x) => x[0] === "derry_briantono/99 PTSP")!;
    expect(ptsp[1]).toBe("@ 4a - Penetapan Penunjukan Mediator - Mediasi Elektronik (PERMA 3 2022).rtf");
    expect(polos(rtfMentah(ptsp[0], ptsp[1]))).toContain("untuk menempuh proses mediasi secara elektronik #11400#;");
    // berkas mediasi biasa tetap: tidak ada di daftar baru maupun timpa
    expect([...RTF, ...TIMPA].some((x) => x[1] === PUTUSAN_SELA_UMUM.mediasiBiasa || x[1] === "@ 4 - Penetapan Penunjukan Mediator.rtf")).toBe(false);
  });

  it("folder baru terbaca sebagai putusan (hakim) dan BAS (panitera); menu portal sama dengan paket", () => {
    expect(folderTugas("97a Putusan Sela")?.jenis).toBe("putusan");
    expect(folderTugas("97a Putusan Sela - BAS")?.jenis).toBe("bas");
    expect(FOLDER_MENU_PUTUSAN[PUTUSAN_SELA_UMUM.menu]).toBe("97a Putusan Sela");
    const pasang = baca(`${N}-PASANG.sql`);
    expect(pasang).toContain("0x" + Buffer.from(PUTUSAN_SELA_UMUM.menu).toString("hex"));
    expect(pasang).toContain("0x" + Buffer.from(PUTUSAN_SELA_UMUM.bas.menu).toString("hex"));
    for (const b of Object.values(PUTUSAN_SELA_UMUM.berkas)) expect(sela.map((x) => x[1]), b).toContain(b);
    const { folder: _f, menu: _m, alias: _a, ...basBerkas } = PUTUSAN_SELA_UMUM.bas;
    expect(Object.keys(basBerkas)).toHaveLength(9);
    for (const b of Object.values(basBerkas)) expect(RTF.filter((x) => x[0] === FB).map((x) => x[1]), b).toContain(b);
    // menu 151 di paket dan di portal sama (nama baru); nama lama tetap dikenali lewat alias
    expect(PUTUSAN_SELA_UMUM.menu).toBe("Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)");
  });

  it("langkah PS ALUR 42/43/47/48 di data portal menunjuk berkas paket", () => {
    for (const [id, folder] of [["alur-42", "4c Wasiat - BAS"], ["alur-43", "10a Ekonomi Syariah Biasa - BAS"], ["alur-47", "4d Hibah - BAS"], ["alur-48", "4e Wakaf - BAS"]]) {
      const a = ALUR_BAS_BARU.find((x) => x.id === id)!;
      const l = a.langkah.find((x) => x.kode === "PS")!;
      expect(a.folder).toBe(`derry_briantono/${folder}`);
      expect(RTF.some((x) => x[0] === a.folder && x[1] === l.berkas), id).toBe(true);
    }
    const h = tentukanBasBaru({ jenisPerkara: "Hibah", nomorPerkara: "3/Pdt.G/2026/PA.Xx", urutanSidang: 9, dihadiriOleh: 1, agenda: "Pemeriksaan setempat" });
    expect(h?.langkah.kode).toBe("PS");
  });
});

describe("saran blangko portal (rekomendasi) untuk putusan sela", () => {
  const dasar = { jenisPerkara: "Harta Bersama", nomorPerkara: "5/Pdt.G/2026/PA.Xx", urutanSidang: 8, dihadiriOleh: 1, alurPerkaraId: 15 };
  const berkasPutusan = (agenda: string, x: Record<string, unknown> = {}) => rekomendasiBlangko({ ...dasar, agenda, ...x }).putusan.map((r) => r.berkas);
  it("sumpah pelengkap: gugatan [13], permohonan [14]; BAS sumpah didahulukan", () => {
    expect(berkasPutusan("Pengucapan sumpah suppletoir")[0]).toBe(PUTUSAN_SELA_UMUM.berkas.sumpahGugatan);
    const p = rekomendasiBlangko({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "42/Pdt.P/2026/PA.Xx", alurPerkaraId: 16, urutanSidang: 1, dihadiriOleh: 1, agenda: "sumpah tambahan" });
    expect(p.putusan[0].berkas).toBe(PUTUSAN_SELA_UMUM.berkas.sumpahPermohonan);
    expect(p.bas[0]).toMatchObject({ berkas: PUTUSAN_SELA_UMUM.bas.sumpah, utama: true });
    expect(p.bas.slice(1).every((x) => !x.utama)).toBe(true);
  });
  it("provisi, intervensi menurut bentuk, eksepsi menurut kewenangan, pemeriksaan setempat; sita tetap 97 Sita", () => {
    expect(berkasPutusan("putusan sela provisi").slice(0, 2)).toEqual([PUTUSAN_SELA_UMUM.berkas.provisiKabul, PUTUSAN_SELA_UMUM.berkas.provisiTolak]);
    expect(berkasPutusan("putusan sela intervensi tussenkomst")[0]).toBe(PUTUSAN_SELA_UMUM.berkas.tussenkomstKabul);
    expect(berkasPutusan("putusan sela intervensi")).toHaveLength(6);
    expect(berkasPutusan("pembacaan putusan sela eksepsi kompetensi relatif")[0]).toBe(PUTUSAN_SELA_UMUM.berkas.relatifTolak);
    const eks = rekomendasiPutusanSela({ ...dasar, jenisPerkara: "Cerai Gugat" }, "putusan sela atas eksepsi kewenangan absolut");
    expect(eks[0].berkas).toBe(PUTUSAN_SELA_UMUM.berkas.absolutTolak);
    expect(eks.some((x) => x.folder === "derry_briantono/1 Perceraian CG" && /\[98e\]/.test(x.berkas))).toBe(true); // blangko lama jenisnya sebagai alternatif
    expect(berkasPutusan("pembacaan putusan sela pemeriksaan setempat")[0]).toBe(PUTUSAN_SELA_UMUM.berkas.setempat);
    expect(berkasPutusan("pembacaan putusan sela sita", { bersita: true })[0]).toMatch(/Sita Dikabulkan/);
    expect(rekomendasiPutusanSela({ ...dasar, sudahPutus: true }, "putusan sela provisi")).toEqual([]);
  });
  it("penanda eksepsi bot pada jenis tanpa blangko sela sendiri jatuh ke bab 97a", () => {
    const r = rekomendasiBlangko({ ...dasar, jenisPerkara: "Hibah", agenda: "musyawarah", putusanSela: true, eksepsiKewenangan: "relatif" });
    expect(r.putusan[0]).toMatchObject({ folder: PUTUSAN_SELA_UMUM.folder, berkas: PUTUSAN_SELA_UMUM.berkas.relatifTolak });
    const lama = rekomendasiBlangko({ ...dasar, jenisPerkara: "Cerai Gugat", agenda: "musyawarah", putusanSela: true, eksepsiKewenangan: "absolut" });
    expect(lama.putusan[0].berkas).toMatch(/^\[98e\] \[Sela\] CG/); // perilaku lama dipertahankan untuk jenis yang punya blangko sela sendiri
  });
  it("BAS sela: pembacaan putusan sela (bukan sita, bukan HB/waris) dan sidang insidentil", () => {
    expect(rekomendasiBasSela({ ...dasar, jenisPerkara: "Cerai Gugat" }, "pembacaan putusan sela")[0].berkas).toBe(PUTUSAN_SELA_UMUM.bas.pembacaan);
    expect(rekomendasiBasSela(dasar, "pembacaan putusan sela")).toEqual([]); // HB punya ALUR 30 I2 sendiri
    expect(rekomendasiBasSela({ ...dasar, jenisPerkara: "Wasiat" }, "sidang insidentil eksepsi")[0].berkas).toBe(PUTUSAN_SELA_UMUM.bas.insidentil);
    expect(rekomendasiBasSela(dasar, "sidang insidentil sita marital")).toEqual([]);
  });
  it("30 Okt putaran 2: sumpah pemutus/penaksir (gugatan), li'an (cerai), iktikad mediasi, rekonvensi, penggabungan, eksepsi lain", () => {
    const b = PUTUSAN_SELA_UMUM.berkas;
    expect(berkasPutusan("putusan sela sumpah pemutus")[0]).toBe(b.pemutus);
    expect(berkasPutusan("sumpah penaksir (aestimatoir)")[0]).toBe(b.penaksir);
    expect(rekomendasiPutusanSela({ ...dasar, jenisPerkara: "Cerai Talak" }, "putusan sela sumpah li'an")[0].berkas).toBe(b.lian);
    expect(rekomendasiPutusanSela(dasar, "putusan sela sumpah li'an")).toEqual([]); // bukan perkara cerai
    const t = rekomendasiPutusanSela(dasar, "laporan mediator: tergugat tidak beriktikad baik");
    expect(t.map((x) => [x.berkas, x.utama])).toEqual([[b.mediasiTergugat, true], [b.mediasiPenggugat, false]]);
    expect(rekomendasiPutusanSela(dasar, "penggugat dinyatakan tidak beriktikad baik")[0].berkas).toBe(b.mediasiPenggugat);
    expect(berkasPutusan("pembacaan putusan sela rekonvensi")[0]).toBe(b.rekonvensi);
    expect(berkasPutusan("putusan sela penggabungan perkara").slice(0, 2)).toEqual([b.gabungKabul, b.gabungTolak]);
    expect(berkasPutusan("musyawarah atas eksepsi obscuur libel").slice(0, 2)).toEqual([b.kaburTolak, b.kaburKabul]);
    expect(berkasPutusan("eksepsi ne bis in idem")[0]).toBe(b.nebisTolak);
    // eksepsi kewenangan tetap ke blangko kewenangan walau ada kata "tidak jelas"
    expect(berkasPutusan("pembacaan putusan sela eksepsi kewenangan absolut tidak jelas")[0]).toBe(b.absolutTolak);
  });
  it("BAS sumpah: tunda putusan atau lalu putusan dibacakan; mediasi elektronik mendahulukan BAS [1e] di folder yang sama", () => {
    const x = PUTUSAN_SELA_UMUM.bas;
    expect(rekomendasiBasSela(dasar, "sumpah pemutus").map((r) => [r.berkas, r.utama])).toEqual([[x.pemutus, true], [x.pemutusPutus, false]]);
    expect(rekomendasiBasSela(dasar, "sumpah penaksir dan putusan").map((r) => [r.berkas, r.utama])).toEqual([[x.penaksirPutus, true], [x.penaksir, false]]);
    expect(rekomendasiBasSela(dasar, "sumpah pelengkap lalu musyawarah")[0].berkas).toBe(x.sumpahPutus);
    expect(rekomendasiBasSela({ ...dasar, jenisPerkara: "Cerai Gugat" }, "sumpah li'an")[0].berkas).toBe(x.lian);
    const m = rekomendasiBlangko({ jenisPerkara: "Cerai Gugat", nomorPerkara: "9/Pdt.G/2026/PA.Xx", urutanSidang: 1, dihadiriOleh: 1, agenda: "Mediasi", keterangan: "para pihak sepakat mediasi secara elektronik" });
    const i = m.bas.findIndex((r) => r.berkas === PUTUSAN_SELA_UMUM.mediasiElektronik);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(m.bas[i + 1]).toMatchObject({ berkas: PUTUSAN_SELA_UMUM.mediasiBiasa, folder: m.bas[i].folder, utama: false });
    const biasa = rekomendasiBlangko({ jenisPerkara: "Cerai Gugat", nomorPerkara: "9/Pdt.G/2026/PA.Xx", urutanSidang: 1, dihadiriOleh: 1, agenda: "Mediasi" });
    expect(biasa.bas.some((r) => r.berkas === PUTUSAN_SELA_UMUM.mediasiElektronik)).toBe(false);
  });
});
