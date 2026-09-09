import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PEMERIKSA KEADAAN POSITA - TIGA GOLONGAN, TIGA CARA MEMPERBAIKI
 * ============================================================================
 *
 * Dipakai dua tempat: skrip pemindai yang melaporkan seluruh perkara, dan
 * panel yang menanyakan yang ragu kepada petugas. Karena itu ia diuji sebagai
 * fungsi - dijalankan, hasilnya diperiksa - bukan dibaca dari teks kodenya.
 *
 * Golongannya:
 *
 *   pecahanPasti   huruf g-z. Penanda butir dalam gugatan tidak pernah
 *                  melewati f, jadi huruf ini hampir pasti pecahan kata.
 *   pecahanRagu    bentuk yang SAMA, hurufnya a-f. Tidak dapat dibedakan dari
 *                  penanda butir tanpa kamus.
 *   tanpaPemisah   tidak ada </p>, <br>, maupun <div>: akan tercetak menempel.
 */
const require_ = createRequire(import.meta.url);
const layanan = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/sippPositaService.js")
) as {
  periksaPosita: (t: string) => {
    kosong: boolean;
    huruf: number;
    pecahanPasti: Array<{ huruf: string; sambungan: string; konteks: string }>;
    pecahanRagu: Array<{ huruf: string; sambungan: string; konteks: string }>;
    tanpaPemisah: boolean;
    perluDirapikan: boolean;
  };
};

const periksa = (t: string) => layanan.periksaPosita(t);

describe("kata terpecah yang hampir pasti - huruf g sampai z", () => {
  it("menemukan pecahan yang benar-benar ada di posita 510", () => {
    // Keduanya apa adanya dari SIPP sesudah versi perapian yang cacat menulis.
    const hasil = periksa(
      "<div>3. Bahwa anak bernama Mikhayla, Usia 5 tahu\n   n. Saat ini ikut Penggugat;</div>\n" +
        "<div>5. Bahwa pisah rumah kurang lebih 6 bula\n   n. Sejak itu tidak terlaksana;</div>"
    );
    expect(hasil.pecahanPasti).toHaveLength(2);
    expect(hasil.pecahanPasti.map((x) => x.huruf)).toEqual(["n", "n"]);
  });

  it("sambungannya menyebut kata yang akan terbentuk - itu pembedanya", () => {
    // Yang dinilai manusia bukan hurufnya melainkan katanya: "tahun" masuk
    // akal sebagai kata, "karenaa" tidak.
    const hasil = periksa("3. Bahwa anak, Usia 5 tahu\n   n. Saat ini ikut Penggugat;");
    expect(hasil.pecahanPasti[0].sambungan.endsWith("tahun")).toBe(true);
  });

  it("penanda butir yang didahului TANDA BACA tidak pernah dianggap pecahan", () => {
    // "mabuk.<br>   b. Setiap" - sebelum pemisahnya ada titik, bukan huruf.
    // Penanda yang didahului tanda baca tidak ambigu sama sekali.
    const hasil = periksa(
      "4. Bahwa karena\n   a. Tergugat mabuk.\n   b. Setiap kali bertengkar Tergugat memukul;"
    );
    expect(hasil.pecahanPasti).toHaveLength(0);
    expect(hasil.pecahanRagu.map((x) => x.huruf)).toEqual(["a"]);
  });
});

describe("yang ragu diserahkan kepada manusia, bukan ditebak", () => {
  it("huruf a-f dikembalikan sebagai ragu, bukan pasti", () => {
    const hasil = periksa("5. Bahwa kewajiban tidak terlaksan\n   a. Sejak itu tidak rukun;");
    expect(hasil.pecahanPasti).toHaveLength(0);
    expect(hasil.pecahanRagu).toHaveLength(1);
    expect(hasil.pecahanRagu[0].sambungan.endsWith("terlaksana")).toBe(true);
  });

  it("konteksnya cukup panjang untuk dinilai tanpa membuka SIPP", () => {
    const hasil = periksa(
      "4. Bahwa sejak Oktober 2025 keadaan rumah tangga mulai tidak harmonis karena\n" +
        "   a. Tergugat sering mabuk-mabukkan bersama teman-teman Tergugat;"
    );
    const konteks = hasil.pecahanRagu[0]?.konteks ?? "";
    expect(konteks).toContain("harmonis karena");
    expect(konteks).toContain("a. Tergugat sering");
  });

  it("penanda butir yang sungguhan pun masuk ragu - dan itu benar", () => {
    // "karena" + "a" = "karenaa", bukan kata. Manusia melihatnya sekejap dan
    // membiarkannya. Yang tidak boleh terjadi: mesin menyambungnya sendiri.
    const hasil = periksa("4. Bahwa disebabkan karena\n   a. Tergugat mabuk;");
    expect(hasil.pecahanRagu).toHaveLength(1);
    expect(hasil.pecahanRagu[0].sambungan.endsWith("karenaa")).toBe(true);
  });
});

describe("posita yang akan tercetak menempel", () => {
  it("tanpa satu pun tag, dan ada butir yang menempel", () => {
    expect(periksa("1. Bahwa satu.2. Bahwa dua.").tanpaPemisah).toBe(true);
  });

  it("yang sudah memakai <p> tidak dihitung menempel", () => {
    // 6.269 dari 8.097 posita memakainya, dan itulah yang tercetak rapi.
    expect(periksa("<p>1. Bahwa satu.</p><p>2. Bahwa dua.</p>").tanpaPemisah).toBe(false);
  });

  it("yang memakai <div> pun tidak dihitung menempel", () => {
    // <div> memang dibuang ABT tanpa jejak - tetapi perapian mengubahnya
    // menjadi <br> lebih dulu, jadi ia bukan golongan "tanpa pemisah".
    expect(periksa("<div>1. Bahwa satu.</div><div>2. Bahwa dua.</div>").tanpaPemisah).toBe(false);
  });

  it("satu kalimat utuh tanpa butir tidak dianggap menempel", () => {
    // Posita pendek yang memang satu paragraf tidak perlu pemisah apa pun.
    expect(periksa("Bahwa Penggugat menikah dengan Tergugat pada tahun 2020.").tanpaPemisah).toBe(
      false
    );
  });
});

describe("posita yang sudah rapi tidak dilaporkan apa-apa", () => {
  it("tidak ada temuan sama sekali", () => {
    const hasil = periksa("<p>1. Bahwa satu.</p><p>2. Bahwa dua.</p>");
    expect(hasil.pecahanPasti).toHaveLength(0);
    expect(hasil.pecahanRagu).toHaveLength(0);
    expect(hasil.tanpaPemisah).toBe(false);
    expect(hasil.perluDirapikan).toBe(false);
  });

  it("posita kosong ditandai kosong, bukan rusak", () => {
    const hasil = periksa("   ");
    expect(hasil.kosong).toBe(true);
    expect(hasil.perluDirapikan).toBe(false);
  });
});

describe("skrip pemindainya MEMBACA saja", () => {
  const skrip = () =>
    readFileSync(path.resolve(process.cwd(), "../aleta_bot/scripts/periksa-posita.js"), "utf8");

  it("tidak ada satu pun pernyataan tulis", () => {
    // Pemindai yang dapat menulis adalah pemindai yang suatu hari akan
    // dijalankan seseorang tanpa membaca apa yang dikerjakannya.
    const isi = skrip().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const kata of ["UPDATE ", "DELETE ", "INSERT ", "REPLACE "]) {
      expect(isi.toUpperCase(), `pemindai memuat ${kata}`).not.toContain(kata);
    }
  });

  it("memakai periksaPosita dari layanan, bukan aturan sendiri", () => {
    const isi = skrip();
    expect(isi).toContain('require("../services/sippPositaService")');
    expect(isi).toContain("periksaPosita(satu.posita)");
    // Tidak menulis ulang polanya - itu akan menjadi salinan yang menyimpang.
    expect(isi).not.toContain("[a-z])");
  });

  it("hanya membaca posita yang terisi", () => {
    expect(skrip()).toContain("p.posita IS NOT NULL AND TRIM(p.posita) <> ''");
  });
});

describe("menyambung satu pecahan yang ragu - atas perintah manusia", () => {
  /**
   * Layanan dimuat ulang dengan basis data TIRUAN, sehingga jalur tulisnya
   * benar-benar dijalankan tanpa menyentuh SIPP. Yang diperiksa bukan bentuk
   * kodenya melainkan kueri yang keluar dan nilai yang tersimpan.
   */
  const denganDbTiruan = (positaAwal: string) => {
    const jalur = path.resolve(process.cwd(), "../aleta_bot/services/sippPositaService.js");
    delete require_.cache[jalur];
    const jalurDb = path.resolve(process.cwd(), "../aleta_bot/db_config.js");

    let posita = positaAwal;
    const tersimpan: string[] = [];
    require_.cache[jalurDb] = {
      id: jalurDb,
      filename: jalurDb,
      loaded: true,
      exports: {
        query: (sql: string, params: unknown[], balik: (g: unknown, h?: unknown) => void) => {
          if (/^SELECT/i.test(sql.trim())) return balik(null, [{ posita }]);
          if (/^UPDATE/i.test(sql.trim())) {
            posita = String((params as string[])[0]);
            tersimpan.push(posita);
            return balik(null, { affectedRows: 1 });
          }
          return balik(new Error("kueri tak dikenal"));
        },
      },
    } as unknown as NodeJS.Module;

    const modul = require_(jalur) as {
      sambungPecahanRagu: (
        id: unknown,
        indeks: unknown
      ) => Promise<{ ok: boolean; alasan?: string; disambung?: string; sisa?: number }>;
      periksaPosita: (t: string) => { pecahanRagu: Array<{ sambungan: string }> };
      tanpaRuang: (t: string) => string;
    };
    return { modul, tersimpan, sekarang: () => posita };
  };

  const DUA_TEMUAN =
    "4. Bahwa karena\n   a. Tergugat mabuk.\n" +
    "5. Bahwa kewajiban tidak terlaksan\n   a. Sejak itu tidak rukun;";

  it("menyambung temuan yang DITUNJUK, bukan yang pertama cocok", async () => {
    // Dua temuan berbunyi mirip di satu posita. Mengganti "yang pertama
    // cocok" akan menyambung kata yang salah.
    const { modul, sekarang } = denganDbTiruan(DUA_TEMUAN);
    const hasil = await modul.sambungPecahanRagu(1, 1);
    expect(hasil.ok).toBe(true);
    expect(hasil.disambung).toBe("tidak terlaksana");
    expect(sekarang()).toContain("tidak terlaksana. Sejak itu");
  });

  it("butir a yang SUNGGUHAN tidak tersentuh", async () => {
    const { modul, sekarang } = denganDbTiruan(DUA_TEMUAN);
    await modul.sambungPecahanRagu(1, 1);
    expect(sekarang()).toContain("karena");
    expect(sekarang()).toContain("a. Tergugat mabuk.");
  });

  it("isi positanya tidak berubah satu huruf pun", async () => {
    const { modul, sekarang } = denganDbTiruan(DUA_TEMUAN);
    await modul.sambungPecahanRagu(1, 1);
    expect(modul.tanpaRuang(sekarang())).toBe(modul.tanpaRuang(DUA_TEMUAN));
  });

  it("urutan di luar jangkauan ditolak beserta sebabnya", async () => {
    // Terjadi bila positanya berubah di antara pratinjau dan penekanan
    // tombolnya - dan itu keadaan yang harus disebut, bukan ditebak.
    const { modul, tersimpan } = denganDbTiruan(DUA_TEMUAN);
    const hasil = await modul.sambungPecahanRagu(1, 9);
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toContain("tidak ada lagi");
    expect(tersimpan).toHaveLength(0);
  });

  it("masukan tidak sah ditolak sebelum menyentuh basis data", async () => {
    const { modul, tersimpan } = denganDbTiruan(DUA_TEMUAN);
    expect((await modul.sambungPecahanRagu(1, -1)).alasan).toContain("urutan temuan");
    expect((await modul.sambungPecahanRagu(0, 0)).alasan).toContain("perkara_id");
    expect(tersimpan).toHaveLength(0);
  });

  it("posita tanpa temuan ragu menolak, bukan menulis apa pun", async () => {
    const { modul, tersimpan } = denganDbTiruan("<p>1. Bahwa satu.</p><p>2. Bahwa dua.</p>");
    const hasil = await modul.sambungPecahanRagu(1, 0);
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toContain("Tidak ada lagi pecahan yang ragu");
    expect(tersimpan).toHaveLength(0);
  });
});

describe("panel menanyakan yang ragu, dan menyebut pembedanya", () => {
  const abt = () =>
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");

  it("sambungannya yang ditulis menonjol, bukan hurufnya", () => {
    // Hurufnya tidak menjawab apa pun. Yang menjawab kata yang akan
    // terbentuk: "tahun" utuh berarti pecahan, "karenaa" tidak.
    const isi = abt();
    expect(isi).toContain("function gambarRaguPosita(");
    expect(isi).toContain('buatElemen("strong", "aleta-abt-isi", satu.sambungan)');
  });

  it("ekstensi mengirim URUTAN, bukan teks posita", () => {
    const isi = abt();
    expect(isi).toContain('JSON.stringify({ aksi: "sambung", perkaraId, indeks })');
  });

  it("tombol lain dimatikan sesudah satu disambung - urutannya bergeser", () => {
    // Menyambung satu temuan menggeser urutan temuan lain. Tombol yang
    // tertinggal akan menunjuk temuan yang berbeda dari yang tertulis di
    // sebelahnya - dan menyambung kata yang salah.
    const isi = abt();
    const potong = isi.slice(isi.indexOf("function gambarRaguPosita("));
    expect(potong).toContain("lain.disabled = true;");
    expect(potong).toContain("urutan temuan bergeser sesudah satu disambung");
  });
});
