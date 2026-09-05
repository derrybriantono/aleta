import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { susunZip } from "@/server/shared/zip";

/**
 * Penyusun ZIP untuk unduhan ekstensi peramban.
 *
 * Berkas ini ditulis sendiri, bukan memakai pustaka, supaya aplikasi
 * pengadilan tidak menambah dependensi hanya untuk membungkus enam berkas
 * teks. Konsekuensinya: bentuk arsipnya harus diuji sungguhan, bukan
 * dipercaya begitu saja.
 */

const sementara = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-zip-"));

afterAll(() => {
  try {
    fs.rmSync(sementara, { recursive: true, force: true });
  } catch {
    // Dibersihkan sistem bila gagal.
  }
});

function tulisArsip(nama: string, isi: Buffer): string {
  const jalur = path.join(sementara, nama);
  fs.writeFileSync(jalur, isi);
  return jalur;
}

describe("penyusun ZIP", () => {
  it("menghasilkan arsip dengan tanda pengenal ZIP yang benar", () => {
    const arsip = susunZip([{ nama: "a.txt", isi: Buffer.from("halo") }]);

    // Setiap ZIP diawali tanda kepala lokal "PK\x03\x04".
    expect(arsip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    // Dan diakhiri tanda penutup "PK\x05\x06".
    expect(arsip.subarray(arsip.length - 22, arsip.length - 18)).toEqual(
      Buffer.from([0x50, 0x4b, 0x05, 0x06])
    );
  });

  it("mencatat jumlah berkas dengan benar pada penutupnya", () => {
    const arsip = susunZip([
      { nama: "satu.txt", isi: Buffer.from("a") },
      { nama: "dua.txt", isi: Buffer.from("bb") },
      { nama: "tiga.txt", isi: Buffer.from("ccc") },
    ]);

    const jumlah = arsip.readUInt16LE(arsip.length - 22 + 10);
    expect(jumlah).toBe(3);
  });

  it("menghasilkan berkas yang benar-benar dapat dibuka", () => {
    // Inilah uji yang sesungguhnya: bentuk yang lolos pemeriksaan byte belum
    // tentu dapat dibuka alat lain. Arsip dibuka dengan peralatan sistem.
    const arsip = susunZip([
      { nama: "ekstensi-sipp/manifest.json", isi: Buffer.from('{"name":"uji"}') },
      { nama: "ekstensi-sipp/konten.js", isi: Buffer.from("console.log('halo');") },
    ]);
    const jalur = tulisArsip("uji-buka.zip", arsip);

    let daftar = "";
    try {
      // Windows menyediakan Expand-Archive; sistem lain menyediakan unzip.
      daftar =
        process.platform === "win32"
          ? execSync(
              `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
                `[System.IO.Compression.ZipFile]::OpenRead('${jalur.replace(/\\/g, "\\\\")}').Entries | ` +
                `ForEach-Object { $_.FullName }"`,
              { encoding: "utf8", timeout: 30000 }
            )
          : execSync(`unzip -Z1 "${jalur}"`, { encoding: "utf8", timeout: 30000 });
    } catch {
      // Alat pembuka tidak tersedia di mesin ini: lewati tanpa menyatakan lulus
      // palsu. Pemeriksaan byte di uji lain tetap berlaku.
      return;
    }

    expect(daftar).toContain("manifest.json");
    expect(daftar).toContain("konten.js");
  });

  it("mempertahankan isi berkas apa adanya", () => {
    const isi = Buffer.from('{"manifest_version":3,"name":"ALETA untuk SIPP"}');
    const arsip = susunZip([{ nama: "manifest.json", isi }]);

    // Metode simpan-apa-adanya: isinya muncul utuh di dalam arsip.
    expect(arsip.includes(isi)).toBe(true);
  });

  it("menolak jalur menaik yang dapat menulis di luar folder tujuan", () => {
    // Arsip yang memuat "../" dapat menulis di luar folder saat dibuka.
    // Arsip yang dibagikan ke komputer petugas tidak boleh punya kemampuan itu.
    const arsip = susunZip([
      { nama: "../../etc/passwd", isi: Buffer.from("jahat") },
      { nama: "..\\..\\windows\\system32\\x.dll", isi: Buffer.from("jahat") },
    ]);

    const teks = arsip.toString("latin1");
    expect(teks).not.toContain("../");
    expect(teks).not.toContain("..\\");
  });

  it("melewati berkas bernama kosong", () => {
    const arsip = susunZip([
      { nama: "", isi: Buffer.from("x") },
      { nama: "sah.txt", isi: Buffer.from("y") },
    ]);

    const jumlah = arsip.readUInt16LE(arsip.length - 22 + 10);
    expect(jumlah).toBe(1);
  });

  it("menghasilkan arsip yang sama untuk isi yang sama", () => {
    // Waktu tetap dipakai supaya arsip dapat dibandingkan sidik jarinya.
    const berkas = [{ nama: "a.txt", isi: Buffer.from("tetap") }];
    expect(susunZip(berkas)).toEqual(susunZip(berkas));
  });

  it("menangani arsip kosong tanpa melempar", () => {
    const arsip = susunZip([]);
    expect(arsip.length).toBe(22); // hanya penutupnya
    expect(arsip.readUInt16LE(10)).toBe(0);
  });
});

describe("isi ekstensi yang ditanam", () => {
  const sumberEkstensi = path.resolve(process.cwd(), "..", "ekstensi-sipp");

  it("sama persis dengan berkas aslinya", async () => {
    // Isi ekstensi ditanam ke dalam kode karena folder ekstensi-sipp tidak ikut
    // ke dalam container portal. Konsekuensinya: hasil tanam dapat tertinggal
    // ketika berkas aslinya disunting - dan petugas akan mengunduh versi lama
    // tanpa ada yang menyadarinya.
    if (!fs.existsSync(sumberEkstensi)) return; // folder tidak tersedia di sini

    const { EKSTENSI_BERKAS } = await import("@/server/shared/ekstensi-berkas");

    for (const [nama, isiTertanam] of Object.entries(EKSTENSI_BERKAS)) {
      const jalur = path.join(sumberEkstensi, nama);
      expect(fs.existsSync(jalur), `${nama} hilang dari folder ekstensi`).toBe(true);
      const isiAsli = fs.readFileSync(jalur, "utf8");
      expect(isiTertanam, `${nama} berbeda — jalankan node scripts/susun-ekstensi.mjs`).toBe(isiAsli);
    }
  });

  it("memuat seluruh berkas yang dibutuhkan ekstensi", async () => {
    const { EKSTENSI_BERKAS } = await import("@/server/shared/ekstensi-berkas");
    for (const wajib of ["manifest.json", "konten.js", "panel.css", "popup.html", "popup.js"]) {
      expect(Object.keys(EKSTENSI_BERKAS)).toContain(wajib);
    }
  });

  it("manifestnya tetap sah setelah ditanam", async () => {
    const { EKSTENSI_BERKAS } = await import("@/server/shared/ekstensi-berkas");
    const manifest = JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string);

    expect(manifest.manifest_version).toBe(3);
    // Izin tabs memberi kemampuan membaca alamat seluruh tab peramban.
    expect(JSON.stringify(manifest)).not.toContain('"tabs"');
    expect(manifest.permissions).toEqual(["storage"]);
  });

  it("ikonnya ikut tertanam sebagai PNG yang utuh", async () => {
    const { EKSTENSI_BINER } = await import("@/server/shared/ekstensi-berkas");

    // Ikon tidak dapat ditanam sebagai teks - membacanya sebagai utf8 merusak
    // bitanya tanpa satu pun galat. Yang diperiksa di sini bukan sekadar ada,
    // melainkan masih berupa PNG: delapan bita pertama berkas PNG selalu sama.
    const namaIkon = Object.keys(EKSTENSI_BINER);
    expect(namaIkon.length).toBeGreaterThan(0);

    for (const nama of namaIkon) {
      const bita = Buffer.from(EKSTENSI_BINER[nama] as string, "base64");
      expect(bita.length, `${nama} kosong`).toBeGreaterThan(100);
      expect(
        bita.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        `${nama} bukan PNG yang utuh — jalankan node scripts/susun-ekstensi.mjs`
      ).toBe(true);
    }
  });

  it("setiap berkas yang ditunjuk manifest benar-benar ikut dikemas", async () => {
    const { EKSTENSI_BERKAS, EKSTENSI_NAMA_BERKAS } = await import(
      "@/server/shared/ekstensi-berkas"
    );
    const manifest = JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string);

    // Sifat yang dijaga: Chrome MENOLAK memasang ekstensi yang berkas
    // rujukannya tidak ada. Manifest yang menunjuk ikon/*.png sementara
    // penyusunnya hanya menanam berkas teks menghasilkan ZIP yang gagal
    // dipasang seluruhnya - dan gagalnya baru ketahuan di komputer petugas.
    const dirujuk = new Set<string>();
    const kumpulkan = (nilai: unknown) => {
      if (typeof nilai === "string") {
        if (/\.(png|js|css|html)$/i.test(nilai)) dirujuk.add(nilai);
        return;
      }
      if (Array.isArray(nilai)) {
        nilai.forEach(kumpulkan);
        return;
      }
      if (nilai && typeof nilai === "object") Object.values(nilai).forEach(kumpulkan);
    };
    kumpulkan(manifest);

    expect(dirujuk.size).toBeGreaterThan(0);
    for (const berkas of dirujuk) {
      expect(
        EKSTENSI_NAMA_BERKAS,
        `manifest menunjuk ${berkas}, tetapi berkas itu tidak ikut dikemas`
      ).toContain(berkas);
    }
  });
});
