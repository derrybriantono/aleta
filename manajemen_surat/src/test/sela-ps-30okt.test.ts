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
    .replace(/^[\s\S]*?(?=^(?:PUTUSAN|PENETAPAN|BERITA ACARA SIDANG))/m, ""); // kepala/kaki halaman (nomor halaman) sebelum judul dibuang
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

  it("22 blangko baru + 2 ditimpa; md5 daftar cocok; yang ditimpa hanya BAS pemeriksaan setempat HB dan waris dengan md5 dasar pohon server", () => {
    expect(RTF).toHaveLength(22);
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
      if (folder === F && /\[0[24]\]/.test(berkas)) continue; // putusan akhir: kaki/rincian blangko [99c] dipakai apa adanya
      expect(t, berkas).not.toMatch(/Pasal\s+\d+[^.;#]{0,40}\bRBg\b/);
      expect(t, berkas).not.toMatch(/\bHIR\b/);
    }
    const sql = baca(`${N}-PASANG.sql`);
    expect(sql).toContain("START TRANSACTION;");
    expect(sql).not.toMatch(/REGEXP_REPLACE|\bWITH\s+\w+\s+AS\s*\(|\bOVER\s*\(/i); // MariaDB 5.5 server
  });

  it("SQL: variabel baru 11300-11499 saja, menu 151/152, PRASYARAT/PERIKSA/PULIH bersidik md5; tanpa nama aplikasi", () => {
    expect(NOMOR.length).toBe(70);
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
  const MATRIKS: Array<[RegExp, string, "sela" | "akhir" | "penetapan"]> = [
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
  ];

  it("15 blangko putusan sela (sita tetap di 97 Sita [01]/[02]); tiap sel jenis x status punya tepat satu blangko", () => {
    expect(sela).toHaveLength(15);
    for (const [pola] of MATRIKS) expect(sela.filter((x) => pola.test(x[1])), String(pola)).toHaveLength(1);
  });

  it("amar sesuai status: sela = biaya ditangguhkan tanpa rincian; putusan akhir = amar biaya putusan akhir (prodeo DIPA #11122#) dan rincian", () => {
    for (const [pola, amar, jenis] of MATRIKS) {
      const t = cari(pola);
      const mengadili = t.slice(t.lastIndexOf(jenis === "penetapan" ? "MENETAPKAN" : "MENGADILI"));
      expect(mengadili, String(pola)).toContain(amar);
      if (jenis === "akhir") {
        expect(t.split("\n")[0]).toMatch(/^PUTUSAN\s*$/m);
        expect(mengadili).toContain("#11122#.");
        expect(t).toContain("#11319#");
        expect(t).toContain("Rincian Biaya Perkara");
        expect(t).not.toContain("Menangguhkan biaya");
      } else {
        expect(t).toMatch(jenis === "penetapan" ? /^PENETAPAN SELA/ : /^PUTUSAN SELA/);
        expect(mengadili).toMatch(/Menangguhkan biaya perkara sampai dengan (putusan|penetapan) akhir\.\s*$/m);
        expect(t).toContain("Pasal 89 ayat (2)");
        expect(t).not.toContain("Rincian Biaya");
        expect(t).not.toContain("#11122#");
        expect(t).toContain("#11311#"); // kaki sela: kehadiran pada sidang yang dicetak
      }
      expect(t).toContain("#8500#"); // tanda tangan majelis/hakim tunggal & PP
      expect(t).toMatch(/#7047#/); // identitas pihak (pihak banyak)
    }
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
  const PS = [...RTF.filter((x) => / - Sidang PS - /.test(x[1])), ...TIMPA.map((x) => [x[0], x[1], "timpa"])];
  it("6 folder BAS jenis kebendaan (HB, waris, wasiat, hibah, wakaf, ES acara biasa); isi sama, objek per jenis, tanya-jawab para pihak", () => {
    expect(PS.map((x) => x[0]).sort()).toEqual(
      ["10a Ekonomi Syariah Biasa", "4a Harta Bersama", "4b Kewarisan", "4c Wasiat", "4d Hibah", "4e Wakaf"].map((f) => `derry_briantono/${f} - BAS`).sort()
    );
    for (const [folder, berkas, sub] of PS) {
      const r = rtfMentah(folder, berkas, sub === "timpa" ? "timpa" : "rtf");
      const t = polos(r);
      expect(t).toMatch(/^\s*BERITA ACARA SIDANG/);
      for (const v of ["#9165#", "#11346#", "#9167#", "#11353#", "#11354#", "#11352#", "#11348#", "#11304#", "#6034#", "#4004#"]) expect(t, `${berkas} ${v}`).toContain(v);
      expect(r).toMatch(/\{\\\*\\isianasal #\d{4,5}#/); // isian objek & kesimpulan tampil di borang ABT
    }
  });

  it("BAS sela: insidentil, pembacaan (amar SIPP #9160#), sumpah (lafal #11342#)", () => {
    const bas = RTF.filter((x) => x[0] === FB);
    expect(bas).toHaveLength(3);
    const t = (p: RegExp) => polos(rtfMentah(FB, bas.find((x) => p.test(x[1]))![1]));
    expect(t(/\[1\]/)).toContain("#11357#");
    expect(t(/\[2\]/)).toContain("#9160#");
    expect(t(/\[2\]/)).toContain("#11361#");
    expect(t(/\[3\]/)).toContain('"#11342#";');
  });

  it("folder baru terbaca sebagai putusan (hakim) dan BAS (panitera); menu portal sama dengan paket", () => {
    expect(folderTugas("97a Putusan Sela")?.jenis).toBe("putusan");
    expect(folderTugas("97a Putusan Sela - BAS")?.jenis).toBe("bas");
    expect(FOLDER_MENU_PUTUSAN[PUTUSAN_SELA_UMUM.menu]).toBe("97a Putusan Sela");
    const pasang = baca(`${N}-PASANG.sql`);
    expect(pasang).toContain("0x" + Buffer.from(PUTUSAN_SELA_UMUM.menu).toString("hex"));
    expect(pasang).toContain("0x" + Buffer.from(PUTUSAN_SELA_UMUM.bas.menu).toString("hex"));
    for (const b of Object.values(PUTUSAN_SELA_UMUM.berkas)) expect(sela.map((x) => x[1]), b).toContain(b);
    for (const b of [PUTUSAN_SELA_UMUM.bas.insidentil, PUTUSAN_SELA_UMUM.bas.pembacaan, PUTUSAN_SELA_UMUM.bas.sumpah]) expect(RTF.map((x) => x[1])).toContain(b);
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
});
