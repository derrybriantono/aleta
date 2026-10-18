import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 18 Okt 2026 (1.205.7): panel "Isi dari SIPP & input ke ABT" dan teks tampil lain tidak lagi menyebut isian
 * dengan kode variabel telanjang ("Sunting (0222, 5227, 0246, ...)") atau penanda #nnnn#. Petugas membaca NAMA isian
 * (diambil dari baris variabel halaman ABT) atau "N isian"; kodenya hanya boleh ada di atribut title.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (berkas: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", berkas), "utf8").replace(/\r\n/g, "\n");
const abt = baca("abt.js");
const panelAlat = baca("panel-alat.js");
const derryIsian = baca("blangko-derry-isian.js");

type Apa = any;

function blok(mulai: string, selesai: string): string {
  const a = abt.indexOf(mulai);
  expect(a).toBeGreaterThan(-1);
  const b = abt.indexOf(selesai, a);
  expect(b).toBeGreaterThan(a);
  return abt.slice(a, b);
}

function pasangNama(baris: Array<[string, string]>): Apa {
  const peta = new Map<string, { kode: string; nama: string; nilai: string }>();
  for (const [kode, nama] of baris) peta.set(kode, { kode, nama, nilai: "" });
  const f = new Function(
    "barisVariabel",
    `${blok("/* === NAMA-ISIAN === */", "/* === AKHIR NAMA-ISIAN === */")}\nreturn { namaIsian, sebutIsian, isianBernama, namaIsianDaftar, gagalTampil };`
  );
  return { peta, ...f(() => peta) };
}

describe("nama isian untuk teks tampil", () => {
  const baris: Array<[string, string]> = [
    ["0222", "Awal Konflik"],
    ["5227", "Alasan Perceraian"],
    ["0246", "Tanggal Pisah Rumah"],
    ["9999", "Variabel 9999"],
  ];

  it("nama diambil dari baris variabel halaman ABT, bukan kodenya", () => {
    const a = pasangNama(baris);
    expect(a.namaIsian("0222")).toBe("Awal Konflik");
    expect(a.sebutIsian("5227")).toBe('"Alasan Perceraian"');
    expect(a.isianBernama("0246")).toBe('Isian "Tanggal Pisah Rumah"');
  });

  it("daftar kode menjadi daftar nama; kodenya hanya dikembalikan terpisah untuk title", () => {
    const a = pasangNama(baris);
    const r = a.namaIsianDaftar(["0222", "5227", "0246"]);
    expect(r.teks).toBe("Awal Konflik, Alasan Perceraian, Tanggal Pisah Rumah");
    expect(r.teks).not.toMatch(/\d{4}/);
    expect(r.kode).toBe("0222, 5227, 0246");
  });

  it("tanpa nama: 'N isian'; nama memuat angka empat digit tidak dipakai", () => {
    const a = pasangNama(baris);
    const r = a.namaIsianDaftar(["0222", "7777", "9999"]);
    expect(r.teks).toBe("Awal Konflik, 2 isian lain");
    expect(a.namaIsianDaftar(["7777"]).teks).toBe("satu isian");
    expect(a.namaIsianDaftar(["7777", "7778", "7779"]).teks).toBe("3 isian");
    expect(a.namaIsianDaftar(["9999"]).teks).toBe("satu isian");
    expect(a.isianBernama("7777")).toBe("Isian ini");
  });

  it("nama cadangan dipakai bila barisnya tidak ada di halaman (8503, 5227, 4020)", () => {
    const a = pasangNama([]);
    expect(a.namaIsian("8503")).toBe("huruf alasan perceraian");
    expect(a.namaIsianDaftar(["4020", "5227"]).teks).toBe("kalimat dasar alasan perceraian, alasan perceraian");
  });

  it("daftar panjang dipotong enam nama, sisanya 'N isian lain'", () => {
    const b: Array<[string, string]> = Array.from({ length: 9 }, (_, i) => [`10${String(i).padStart(2, "0")}`, `Isian ${String.fromCharCode(65 + i)}`]);
    const a = pasangNama(b);
    const r = a.namaIsianDaftar(b.map(([k]) => k));
    expect(r.teks).toBe("Isian A, Isian B, Isian C, Isian D, Isian E, Isian F, 3 isian lain");
  });

  it("pesan gagal 'kode: sebab' dari penulis ABT tampil dengan nama isian", () => {
    const a = pasangNama(baris);
    expect(a.gagalTampil("5227: ABT menolak menyimpan.")).toBe("Alasan Perceraian: ABT menolak menyimpan.");
    expect(a.gagalTampil("7777: ABT menolak.")).toBe("Satu isian: ABT menolak.");
    expect(a.gagalTampil("Input terhenti: putus")).toBe("Input terhenti: putus");
  });
});

describe("kabar isian bawaan ABT (kabarPositaLain) tanpa kode dan tanpa #nnnn#", () => {
  it("menyebut nama isian, bukan '5197 dari kueri #10101#'", () => {
    const a = abt.indexOf("function kabarPositaLain");
    const potong = abt.slice(a, abt.indexOf("\n}\n", a) + 3);
    const f = new Function(
      "barisVariabel",
      `${blok("/* === NAMA-ISIAN === */", "/* === AKHIR NAMA-ISIAN === */")}\n${potong}\nreturn kabarPositaLain;`
    );
    const peta = new Map([
      ["5197", { nama: "Pekerjaan Penggugat", nilai: "" }],
      ["5198", { nama: "Pekerjaan Tergugat", nilai: "" }],
    ]);
    const kabar = f(() => peta)({ bawaanAbt: [{ kode: "5197", acuan: "10101" }, { kode: "5198", acuan: "10102" }], belumSiap: [] }, peta);
    expect(kabar).toContain("periksa sebelum menyimpan: Pekerjaan Penggugat, Pekerjaan Tergugat.");
    expect(kabar).not.toMatch(/\d{4}|#/);
  });
});

describe("teks tampil di abt.js, panel-alat.js, blangko-derry-isian.js tidak memuat kode telanjang", () => {
  // Penampil: isi literal string yang memuat angka empat digit (bukan tahun) di antara kata-kata.
  const KODE = /\b(?!(?:19|20)\d\d\b)\d{4}\b/;
  const KALIMAT = /[A-Za-z]{3,} [A-Za-z]{2,}/;
  function literal(sumber: string): Array<{ baris: number; isi: string }> {
    const hasil: Array<{ baris: number; isi: string }> = [];
    sumber.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const m of ln.matchAll(/(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
        if (KODE.test(m[0]) && KALIMAT.test(m[0])) hasil.push({ baris: i + 1, isi: m[0] });
      }
    });
    return hasil;
  }
  // Yang sah: nama kelas CSS, atribut data, dan teks title (kode boleh di sini).
  const SAH = [/aleta-t6-8503-/, /data-peringatan=/, /Jenis perkara menurut SIPP \(variabel 0048/, /isian huruf alasan \(8503\)\./, /ke ABT \(variabel 8503\)/, /huruf alasan \(8503\)\."$/,/ms\b|detik/,
    // AUDIT-GALAT 18 Okt (benturan gabungan integrasi-1205-8): nama berkas blangko ABT
    // apa adanya ("[03b] [Tolak] DK - ... Isian 9771)") - harus persis sama dengan ABT agar cocok.
    /^"\[\d{2,3}[a-z]?\] \[[A-Za-z]+\] /,
    // kunci internal peta agenda jawab-menjawab (blangko-derry-isian TJ_JAWAB_MENJAWAB), bukan teks tampil.
    /^"(?:jawaban|replik|duplik) lisan 004[67]"$/];

  for (const [nama, sumber] of [
    ["abt.js", abt],
    ["panel-alat.js", panelAlat],
    ["blangko-derry-isian.js", derryIsian],
  ] as const) {
    it(`${nama}: tidak ada literal teks yang memuat kode empat digit di luar title/kelas`, () => {
      const sisa = literal(sumber).filter((x) => !SAH.some((p) => p.test(x.isi)));
      expect(sisa.map((x) => `${x.baris}: ${x.isi.slice(0, 120)}`)).toEqual([]);
    });

    it(`${nama}: tidak ada penanda #nnnn# di teks tampil`, () => {
      const sisa: string[] = [];
      sumber.split("\n").forEach((ln, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
        // komentar akhir baris dan pola (regex) tidak dihitung; yang dicari hanya literal string.
        for (const m of ln.matchAll(/(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
          if (/#\d{4}#/.test(m[0]) && !/\/.*#\\d\{4\}#/.test(m[0]) && !/title|Buka pengaturan variabel/.test(ln)) sisa.push(`${i + 1}: ${m[0].slice(0, 100)}`);
        }
      });
      expect(sisa).toEqual([]);
    });
  }

  it("ringkasan 'Isi dari SIPP' tidak lagi menyusun daftar isian dari kode (Sunting (kode...))", () => {
    expect(abt).not.toMatch(/Sunting \(\$\{wajib\.map\(\(u\) => u\.kode\)\.join/);
    expect(abt).toContain("isi lewat Sunting (${namaIsianDaftar(wajib.map((u) => u.kode)).teks})");
    expect(abt).not.toMatch(/tidak terdeteksi \(\$\{tidakAda\.join/);
    expect(abt).not.toMatch(/sudah sama di blangko \(\$\{sama\.join/);
  });

  it("daftar kode yang diganti nama tetap tersedia di title lipatan 'Tidak ditampilkan'", () => {
    expect(abt).toContain("tidakTampil.title = `Kode isian: ${kodeTitle.join(\"; \")}`");
  });
});
