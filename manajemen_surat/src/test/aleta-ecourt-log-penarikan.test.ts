// @vitest-environment node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Pembacaan log penarikan e-Court.
 *
 * Rute pemantauan membaca berkas dari disk berdasarkan nama yang dikirim
 * peramban. Itu jalur serangan yang klasik: nama seperti "../../etc/passwd"
 * akan membaca berkas mana pun yang dapat dijangkau proses portal.
 *
 * Yang dijaga di sini:
 *
 *   - hanya nama berpola log penarikan yang dilayani,
 *   - jalur yang keluar dari folder log ditolak, dalam berbagai bentuknya,
 *   - pembacaan lanjutan benar-benar melanjutkan, bukan mengulang dari awal.
 *
 * Berkas di luar folder log SUNGGUHAN dibuat lalu dicoba dibaca - bukan sekadar
 * memeriksa bahwa fungsinya menolak. Penolakan yang benar karena berkasnya
 * kebetulan tidak ada bukan penjagaan.
 */

let folderLog = "";
let folderRahasia = "";
let modul: typeof import("@/server/modules/aleta-ecourt/log-penarikan");

const NAMA_SAH = "ecourt-unduh-20260830-101500.log";

beforeAll(async () => {
  const induk = await fs.mkdtemp(path.join(os.tmpdir(), "aleta-log-"));
  folderLog = path.join(induk, "reports");
  folderRahasia = path.join(induk, "rahasia");
  await fs.mkdir(folderLog, { recursive: true });
  await fs.mkdir(folderRahasia, { recursive: true });

  await fs.writeFile(path.join(folderLog, NAMA_SAH), "baris satu\nbaris dua\n", "utf8");
  await fs.writeFile(path.join(folderLog, "ecourt-tarik-ulang-20260830-090000.log"), "ulang\n", "utf8");
  // Berkas lain di folder yang sama - tidak berpola log penarikan.
  await fs.writeFile(path.join(folderLog, "laporan-bulanan.txt"), "bukan log\n", "utf8");
  // Berkas di LUAR folder log, yang tidak boleh terjangkau lewat nama apa pun.
  await fs.writeFile(path.join(folderRahasia, "kunci.txt"), "RAHASIA", "utf8");

  process.env.ALETA_ECOURT_LOG_DIR = folderLog;
  modul = await import("@/server/modules/aleta-ecourt/log-penarikan");
});

afterAll(async () => {
  delete process.env.ALETA_ECOURT_LOG_DIR;
});

describe("daftar log penarikan", () => {
  it("hanya memuat log penarikan e-Court", async () => {
    const daftar = await modul.daftarLogPenarikan();
    const nama = daftar.map((baris) => baris.nama);

    expect(nama).toContain(NAMA_SAH);
    expect(nama).toContain("ecourt-tarik-ulang-20260830-090000.log");
    // Folder reports memuat berkas lain yang tidak ada urusannya dengan layar ini.
    expect(nama).not.toContain("laporan-bulanan.txt");
  });

  it("membedakan penarikan biasa dari tarik ulang", async () => {
    const daftar = await modul.daftarLogPenarikan();

    expect(daftar.find((b) => b.nama === NAMA_SAH)?.jenis).toBe("unduh");
    expect(
      daftar.find((b) => b.nama === "ecourt-tarik-ulang-20260830-090000.log")?.jenis
    ).toBe("tarik-ulang");
  });
});

describe("penjagaan jalur", () => {
  it("membaca log yang sah", async () => {
    const potongan = await modul.bacaPotonganLog(NAMA_SAH, 0);
    expect(potongan).not.toBeNull();
    expect(potongan?.isi).toContain("baris satu");
  });

  it("menolak berkas di luar folder log", async () => {
    const jalurKeluar = [
      "../rahasia/kunci.txt",
      "../../rahasia/kunci.txt",
      "..\\rahasia\\kunci.txt",
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      path.join(folderRahasia, "kunci.txt"),
    ];

    for (const nama of jalurKeluar) {
      // Sifat yang dijaga: bukan sekadar tidak melempar galat - jawabannya
      // harus null, sehingga tidak ada isi berkas yang pernah keluar.
      await expect(modul.bacaPotonganLog(nama, 0)).resolves.toBeNull();
    }
  });

  it("menolak nama yang tidak berpola log penarikan", async () => {
    await expect(modul.bacaPotonganLog("laporan-bulanan.txt", 0)).resolves.toBeNull();
    await expect(modul.bacaPotonganLog("ecourt-unduh.log", 0)).resolves.toBeNull();
    await expect(modul.bacaPotonganLog("", 0)).resolves.toBeNull();
  });

  it("menolak nama sah yang disisipi jalur", async () => {
    // Nama berkasnya sah, tetapi didahului jalur keluar. Pemeriksaan pola saja
    // meloloskan ini bila polanya tidak dipaku ke awal dan akhir teks.
    await expect(modul.bacaPotonganLog(`../reports/${NAMA_SAH}`, 0)).resolves.toBeNull();
    await expect(modul.bacaPotonganLog(`subfolder/${NAMA_SAH}`, 0)).resolves.toBeNull();
  });
});

describe("pembacaan lanjutan", () => {
  it("melanjutkan dari posisi terakhir, tidak mengulang", async () => {
    const awal = await modul.bacaPotonganLog(NAMA_SAH, 0);
    expect(awal).not.toBeNull();

    // Menambah baris, lalu meminta lanjutan dari posisi akhir sebelumnya.
    await fs.appendFile(path.join(folderLog, NAMA_SAH), "baris tiga\n", "utf8");
    const lanjutan = await modul.bacaPotonganLog(NAMA_SAH, awal!.akhir);

    expect(lanjutan?.isi).toBe("baris tiga\n");
    // Sifat yang dijaga: isi yang sudah dikirim TIDAK dikirim lagi. Kalau
    // terulang, layar pemantauan akan menampilkan baris ganda terus-menerus.
    expect(lanjutan?.isi).not.toContain("baris satu");
  });

  it("mulai negatif membaca potongan terakhir", async () => {
    const potongan = await modul.bacaPotonganLog(NAMA_SAH, -1);
    expect(potongan).not.toBeNull();
    expect(potongan?.isi).toContain("baris satu");
  });

  it("posisi melewati ukuran berkas dibaca ulang dari awal", async () => {
    // Terjadi ketika log diputar atau diganti berkas baru bernama sama.
    const potongan = await modul.bacaPotonganLog(NAMA_SAH, 999999);
    expect(potongan).not.toBeNull();
    expect(potongan?.mulai).toBe(0);
    expect(potongan?.isi).toContain("baris satu");
  });

  it("tidak mengirim apa pun bila belum ada tambahan", async () => {
    const penuh = await modul.bacaPotonganLog(NAMA_SAH, 0);
    const kosong = await modul.bacaPotonganLog(NAMA_SAH, penuh!.ukuran);

    expect(kosong?.isi).toBe("");
  });
});
