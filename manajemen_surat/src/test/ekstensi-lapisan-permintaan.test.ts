// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * LAPISAN PERMINTAAN - BATAS WAKTU, PENYATUAN, DAN PERCOBAAN KEDUA
 * ============================================================================
 *
 * Dilaporkan dari layar: hubungan ke portal kadang lambat, kadang tersendat,
 * kadang berakhir "portal tidak menjawab". Yang paling merugikan bukan
 * lambatnya - melainkan panel yang MENGGANTUNG tanpa keterangan, sebab fetch
 * tanpa batas waktu menunggu sampai peramban menyerah sendiri.
 *
 * ============================================================================
 * SATU PAGAR YANG TIDAK BOLEH BOCOR
 * ============================================================================
 *
 * Penyatuan dan percobaan kedua HANYA untuk bacaan. Permintaan yang MENULIS -
 * menetapkan, membongkar, mengesahkan - tidak pernah disatukan dan tidak
 * pernah diulang:
 *
 *   - dua penetapan yang kebetulan beralamat sama bukan satu penetapan;
 *   - permintaan tulis yang diulang sesudah jawabannya hilang di jalan akan
 *     menuliskannya DUA KALI ke dalam berkas perkara yang sungguhan.
 *
 * Berkas ini menjalankan alatAmbil yang SUNGGUHAN atas fetch palsu, dan
 * menghitung berapa kali fetch itu benar-benar dipanggil.
 */

const akar = path.resolve(process.cwd(), "..");
const alat = () => readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8").replace(/\r\n/g, "\n");
const konten = () => readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

type Jawaban = { status: number; tunda?: number; lempar?: string };

/** alatAmbil yang sungguhan, dijalankan atas fetch palsu. */
function buatAlatAmbil(antrean: Jawaban[]) {
  const isi = alat();
  const sumber = [
    potongFungsi(isi, "alatKunciPermintaan"),
    potongFungsi(isi, "alatSekaliAmbil"),
    potongFungsi(isi, "alatCatatKecepatan"),
    potongFungsi(isi, "alatAmbil"),
  ].join("\n\n");

  const panggilan: { alamat: string; cara: string }[] = [];
  let ke = 0;

  const fetchPalsu = (alamat: string, opsi: Record<string, unknown> = {}) => {
    panggilan.push({ alamat, cara: String(opsi.method || "GET").toUpperCase() });
    const rencana = antrean[Math.min(ke, antrean.length - 1)];
    ke += 1;
    return new Promise((selesai, tolak) => {
      const kerja = () => {
        if (rencana.lempar) {
          const galat = new Error(rencana.lempar);
          galat.name = rencana.lempar === "AbortError" ? "AbortError" : "TypeError";
          tolak(galat);
          return;
        }
        selesai({ status: rencana.status, ok: rencana.status < 400, clone: () => ({ ditiru: true, status: rencana.status }) });
      };
      if (rencana.tunda) setTimeout(kerja, rencana.tunda);
      else kerja();
    });
  };

  const buat = new Function(
    "fetch",
    "setTimeout",
    "clearTimeout",
    "AbortController",
    `const ALAT_BATAS_MS = 9000;
     const ALAT_AMBANG_LAMBAT_MS = 2500;
     const ALAT_JEDA_ULANG_MS = 1;
     const alatTerbang = new Map();
     const alatKeadaanPortal = { lambat: false, terakhirMs: 0, gagalBerturut: 0 };
     function alatPesanGagal(galat, status, yangDiminta) { return "gagal:" + (yangDiminta || ""); }
     ${sumber}
     return { alatAmbil, alatKeadaanPortal };`
  ) as (...a: unknown[]) => { alatAmbil: (a: string, o?: unknown, y?: string) => Promise<unknown>; alatKeadaanPortal: Record<string, unknown> };

  const perkakas = buat(fetchPalsu, setTimeout, clearTimeout, AbortController);
  return { ...perkakas, panggilan };
}

describe("penyatuan permintaan", () => {
  it("dua pembaca alamat yang sama hanya memanggil portal SEKALI", () => {
    // Halaman SIPP mengubah DOM-nya terus-menerus, dan beberapa bagian panel
    // meminta alamat yang sama dalam hitungan milidetik.
    return (async () => {
      const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 200, tunda: 5 }]);
      const [a, b] = await Promise.all([
        alatAmbil("/aleta/api/x"),
        alatAmbil("/aleta/api/x"),
      ]);
      expect(panggilan).toHaveLength(1);
      // Jawabannya DISALIN - badan Response hanya dapat dibaca sekali.
      expect(a).not.toBe(b);
    })();
  });

  it("alamat yang berbeda tidak ikut disatukan", async () => {
    const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 200, tunda: 5 }]);
    await Promise.all([alatAmbil("/aleta/api/x"), alatAmbil("/aleta/api/y")]);
    expect(panggilan.map((x) => x.alamat)).toEqual(["/aleta/api/x", "/aleta/api/y"]);
  });

  it("PERMINTAAN TULIS TIDAK PERNAH DISATUKAN", async () => {
    // Dua penetapan yang kebetulan beralamat sama bukan satu penetapan.
    const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 200, tunda: 5 }]);
    await Promise.all([
      alatAmbil("/aleta/api/tulis", { method: "POST", body: "{}" }),
      alatAmbil("/aleta/api/tulis", { method: "POST", body: "{}" }),
    ]);
    expect(panggilan).toHaveLength(2);
    expect(panggilan.every((x) => x.cara === "POST")).toBe(true);
  });

  it("kuncinya dilepas sesudah selesai, permintaan berikutnya memanggil lagi", async () => {
    const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 200 }]);
    await alatAmbil("/aleta/api/x");
    await alatAmbil("/aleta/api/x");
    expect(panggilan).toHaveLength(2);
  });
});

describe("percobaan kedua", () => {
  it("bacaan yang gagal jaringan diulang sekali", async () => {
    const { alatAmbil, panggilan } = buatAlatAmbil([
      { status: 0, lempar: "Failed to fetch" },
      { status: 200 },
    ]);
    await alatAmbil("/aleta/api/x");
    expect(panggilan).toHaveLength(2);
  });

  it("bacaan yang dijawab 502 diulang sekali - portal sedang dibangun ulang", async () => {
    const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 502 }, { status: 200 }]);
    const hasil = (await alatAmbil("/aleta/api/x")) as { status: number };
    expect(panggilan).toHaveLength(2);
    expect(hasil.status).toBe(200);
  });

  it("PERMINTAAN TULIS TIDAK PERNAH DIULANG", async () => {
    // Yang diulang sesudah jawabannya hilang di jalan akan menuliskannya dua
    // kali ke dalam berkas perkara yang sungguhan.
    const { alatAmbil, panggilan } = buatAlatAmbil([
      { status: 0, lempar: "Failed to fetch" },
      { status: 200 },
    ]);
    await expect(alatAmbil("/aleta/api/tulis", { method: "POST" })).rejects.toThrow();
    expect(panggilan).toHaveLength(1);
  });

  it("batas waktu yang lewat tidak diulang", async () => {
    // Yang sudah menunggu sembilan detik tidak ditolong dengan menunggu
    // sembilan detik lagi.
    const { alatAmbil, panggilan } = buatAlatAmbil([{ status: 0, lempar: "AbortError" }]);
    await expect(alatAmbil("/aleta/api/x")).rejects.toThrow();
    expect(panggilan).toHaveLength(1);
  });

  it("gagal dua kali berturut tetap melempar kalimat, bukan bunyi mentah", async () => {
    const { alatAmbil } = buatAlatAmbil([
      { status: 0, lempar: "Failed to fetch" },
      { status: 0, lempar: "Failed to fetch" },
    ]);
    await expect(alatAmbil("/aleta/api/x", undefined, "Membaca akun")).rejects.toThrow(
      /gagal:Membaca akun/
    );
  });
});

describe("batas waktu", () => {
  it("tiap percobaan dibatasi, dan jamnya selalu dibersihkan", () => {
    const badan = potongFungsi(alat(), "alatSekaliAmbil");
    expect(badan).toContain("new AbortController()");
    expect(badan).toContain("setTimeout(() => pembatal.abort(), batas)");
    expect(badan).toContain("clearTimeout(jam)");
    // ALAT_BATAS_MS tetap bawaannya. Pemanggil boleh menyebut batasnya
    // sendiri, tetapi yang TIDAK menyebut apa pun tetap dibatasi - batas yang
    // hanya berlaku bila diminta bukan batas.
    expect(badan).toContain("ALAT_BATAS_MS");
  });

  it("batasMs tidak pernah ikut masuk ke fetch", () => {
    // fetch tidak mengenalinya. Meninggalkannya di dalam opsi hanya menaruh
    // medan asing di dalam permintaan, dan medan asing di dalam permintaan
    // adalah hal yang tidak pernah dicari siapa pun ketika suatu hari
    // permintaannya berperilaku aneh.
    const badan = potongFungsi(alat(), "alatSekaliAmbil");
    expect(badan).toContain("const { batasMs, ...sisa } = opsi || {}");
    expect(badan).toContain("fetch(alamat, { ...sisa, signal: pembatal.signal })");
    expect(badan).not.toContain("...(opsi || {})");
  });

  it("batas waktu yang lewat punya kalimatnya sendiri", () => {
    // Dulu ia jatuh ke "lain" dan berbunyi sebagai galat yang tidak dikenali,
    // padahal ia keadaan yang paling sering: portal hidup tetapi terlalu lambat.
    const isi = alat();
    expect(potongFungsi(isi, "alatSebabGagal")).toContain('galat.name === "AbortError"');
    expect(potongFungsi(isi, "alatPesanGagal")).toContain('sebab === "lambat"');
  });
});

describe("panel tidak menunggu portal yang berat", () => {
  it("didahului dari simpanan sesudah jeda pendek", () => {
    const isi = konten();
    expect(isi).toContain("const JEDA_PENDAHULU_MS = 400;");
    expect(potongFungsi(isi, "segarkan")).toContain(
      "void gambarDariSimpanan(nomor, { menyegarkan: true });"
    );
  });

  it("pendahulunya dibatalkan begitu jawabannya tiba", () => {
    // Portal yang cepat tidak pernah melihat pendahulu ini sama sekali.
    expect(potongFungsi(konten(), "segarkan")).toContain("clearTimeout(pendahulu);");
  });

  it("panggilan konteks pun diberi batas waktu", () => {
    // Selama ia menggantung, sedangAmbil tertahan - dan tidak ada penyegaran
    // berikutnya yang boleh berjalan sama sekali.
    const isi = konten();
    expect(isi).toContain("const BATAS_KONTEKS_MS = 12000;");
    expect(potongFungsi(isi, "segarkan")).toContain("pembatal.abort(), BATAS_KONTEKS_MS");
  });

  it("pendahulu tidak menyalakan penjadwal percobaan ulang", () => {
    // Jawabannya sedang dalam perjalanan - menjadwalkan percobaan kedua di
    // atasnya hanya menambah panggilan.
    expect(potongFungsi(konten(), "gambarDariSimpanan")).toContain(
      "if (opsi.menyegarkan !== true) mulaiMencobaLagi(nomor);"
    );
  });

  it("pitanya berbeda nada dari pita luring", () => {
    // Yang satu berkata ALETA mati, yang lain ALETA sedang menjawab.
    const badan = potongFungsi(konten(), "pitaLuring");
    expect(badan).toContain("Menyegarkan dari ALETA");
    expect(badan).toContain("ALETA tidak terjangkau");
    const gaya = readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");
    expect(gaya).toContain(".aleta-pita-luring-segar");
  });
});

describe("tab yang tidak dilihat tidak memanggil portal", () => {
  it("penyegaran ditunda selagi tersembunyi", () => {
    const badan = potongFungsi(konten(), "segarkan");
    expect(badan).toContain('document.visibilityState === "hidden"');
    expect(badan).toContain("tertundaKarenaTersembunyi = true;");
  });

  it("dan dikerjakan begitu perhatiannya kembali", () => {
    // Tanpa ini, tab yang dibuka di latar belakang tetap kosong sampai
    // halamannya berubah sendiri - pada halaman perkara yang diam, selamanya.
    const isi = konten();
    expect(isi).toContain('document.addEventListener("visibilitychange"');
    expect(isi).toContain("if (!tertundaKarenaTersembunyi) return;");
  });
});

describe("penunggu masuk mundur jaraknya sendiri", () => {
  it("jaraknya melar sampai batas, tidak tetap lima detik", () => {
    // Pada layar yang ditinggal semalam, jarak tetap lima detik berarti tujuh
    // ribu panggilan untuk satu pertanyaan yang jawabannya tidak berubah.
    const isi = konten();
    expect(isi).toContain("const JEDA_TUNGGU_MAKS = 30000;");
    expect(potongFungsi(isi, "mulaiMenungguMasuk")).toContain(
      "Math.min(Math.round(jedaTungguSekarang * 1.6), JEDA_TUNGGU_MAKS)"
    );
  });

  it("dan dikembalikan ke jarak semula ketika berhenti", () => {
    expect(potongFungsi(konten(), "berhentiMenungguMasuk")).toContain(
      "jedaTungguSekarang = JEDA_TUNGGU_MASUK;"
    );
  });
});
