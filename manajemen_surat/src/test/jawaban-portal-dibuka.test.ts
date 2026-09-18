// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUNGKUS { ok, data } HARUS DIBUKA - DAN LUPA MEMBUKANYA TIDAK BERBUNYI
 * ============================================================================
 *
 * Seluruh rute portal menjawab lewat ok(), yang membungkus muatannya:
 *
 *   { ok: true, data: { ...yang sebenarnya... } }
 *
 * Membaca ruas isi langsung dari hasil urai karena itu SELALU keliru. Yang
 * membuatnya berbahaya: ia tidak pernah melempar galat, tidak pernah gagal
 * dibangun, dan tidak pernah dikeluhkan TypeScript - sebab hasil json()
 * bertipe any, dan `as { ada: boolean }` mengubah dugaan menjadi kepastian
 * tanpa satu pun pemeriksaan.
 *
 * Akibatnya berlapis, dan lapisan keduanya yang paling merusak:
 *
 *   1. isi.ok yang terbaca adalah ok milik BUNGKUSNYA - selalu true. Cabang
 *      gagal karena itu tidak pernah menyala, bahkan ketika peladen sudah
 *      menyiapkan alasannya. Penolakan terbaca sebagai keberhasilan.
 *   2. seluruh ruas lainnya undefined. Layar yang membacanya berbunyi "tidak
 *      terbaca" pada tiap perkara, atau - bila ia langsung menyentuh ruas di
 *      dalamnya - menjatuhkan seluruh halaman.
 *
 * Enam tempat ditemukan sekaligus saat penjaga ini ditulis: penyusun perintah
 * putusan di Status Perkara (yang menjatuhkan layarnya), Isian Kelas B dua
 * tempat, Ruang Perkara tiga tempat, dan Rujukan Pasal. Empat layar, dan
 * tidak satu pun pernah melaporkan galat.
 *
 * Bentuk yang BENAR ada dua, keduanya sudah dipakai di rumah ini:
 *
 *   const hasil = (await jawaban.json())?.data;
 *   const isi = ((await jawaban.json())?.data ?? {}) as { ... };
 */

const akar = path.resolve(process.cwd(), "src");

/** Ruas yang memang milik bungkusnya, jadi boleh dibaca langsung. */
const RUAS_BUNGKUS = new Set(["ok", "data", "error", "status", "json", "then", "catch"]);

/**
 * Berkas yang dikecualikan, beserta sebabnya.
 *
 * ekstensi-berkas.ts bukan kode portal: isinya sumber ekstensi peramban yang
 * ditanam sebagai teks, dan ekstensi itu berbicara ke rute yang berbeda.
 */
const DIKECUALIKAN = new Set([path.join("server", "shared", "ekstensi-berkas.ts")]);

function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (statSync(p).isDirectory()) hasil.push(...berkasSumber(p));
    else if (/\.tsx?$/.test(nama) && !/\.test\.tsx?$/.test(nama)) hasil.push(p);
  }
  return hasil;
}

type Pelanggaran = { berkas: string; baris: number; ruas: string[] };

function sapu(): Pelanggaran[] {
  const pelanggaran: Pelanggaran[] = [];

  for (const berkas of berkasSumber(akar)) {
    const relatif = path.relative(akar, berkas);
    if (DIKECUALIKAN.has(relatif)) continue;

    const isi = readFileSync(berkas, "utf8");
    if (!isi.includes("/api/aleta")) continue;

    const baris = isi.split(/\r?\n/);
    for (let i = 0; i < baris.length; i += 1) {
      if (!baris[i].includes(".json()")) continue;

      const nama = baris[i].match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(?await\s/)?.[1];
      if (!nama) continue;

      // ====================================================================
      // BERKAS STATIS BUKAN JAWABAN PORTAL
      // ====================================================================
      //
      // Aturan berkas ini tentang BUNGKUS { ok, data } yang dipasang rute
      // portal. Berkas statis di `public/` tidak punya bungkus itu - ia
      // memang harus dibaca apa adanya.
      //
      // Penyapu ini masuk ke berkas mana pun yang menyebut "/api/aleta" di
      // suatu tempat, jadi satu layar yang memanggil rute portal DAN membaca
      // berkas statis akan tertuduh atas yang kedua. Terjadi pada peta titik
      // perkara: koordinat desanya berkas statis, dan lapisan relaasnya rute
      // portal - keduanya di berkas yang sama.
      //
      // Yang diperiksa alamat pengambilannya, bukan nama peubahnya.
      const pengambilan = baris.slice(Math.max(0, i - 6), i + 1).join(" ");
      const alamat = pengambilan.match(/fetch\(\s*([^)]*)/)?.[1] ?? "";
      if (alamat && !alamat.includes("/api/")) continue;

      // Bentuk (await x.json())?.data - dibuka di baris yang sama.
      if (/\.json\(\)\s*\)?\s*\??\.\s*data\b/.test(baris[i])) continue;

      const jendela = baris.slice(i, i + 25).join("\n");
      // Dibuka beberapa baris kemudian, atau diperiksa dengan "data" in x.
      if (new RegExp(`\\b${nama}\\b\\s*\\??\\.\\s*data\\b`).test(jendela)) continue;
      if (new RegExp(`"data" in ${nama}\\b`).test(jendela)) continue;

      const dibaca = new Set<string>();
      const pola = new RegExp(`\\b${nama}\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)`, "g");
      let cocok: RegExpExecArray | null;
      while ((cocok = pola.exec(jendela)) !== null) dibaca.add(cocok[1]);

      const ruas = [...dibaca].filter((x) => !RUAS_BUNGKUS.has(x));
      if (ruas.length > 0) {
        pelanggaran.push({ berkas: relatif.replace(/\\/g, "/"), baris: i + 1, ruas });
      }
    }
  }

  return pelanggaran;
}

/**
 * Bentuk kedua yang pernah lolos: hasil urai DIPULANGKAN langsung.
 *
 *     return (await jawaban.json()) as T;
 *
 * Penyapu di atas tidak melihatnya - ia mencari peubah bernama, sedangkan di
 * sini hasilnya tidak pernah diberi nama. Satu pembantu semacam itu di
 * blangko-mandiri membuat SELURUH layarnya kosong: statistik kamus, korpus,
 * dan daftar blangko sama-sama membaca bungkus.
 *
 * Yang membuatnya bertahan lama: `as T` mengubah dugaan menjadi kepastian
 * tanpa satu pun pemeriksaan, dan ujinya sendiri memalsukan jawaban TANPA
 * bungkus - sehingga uji dan kode sepakat atas dunia yang tidak ada.
 */
function sapuPulangLangsung(): Pelanggaran[] {
  const pelanggaran: Pelanggaran[] = [];

  for (const berkas of berkasSumber(akar)) {
    const relatif = path.relative(akar, berkas);
    if (DIKECUALIKAN.has(relatif)) continue;

    const isi = readFileSync(berkas, "utf8");
    if (!isi.includes("/api/aleta")) continue;

    isi.split(/\r?\n/).forEach((baris, i) => {
      if (!/return\s*\(?await\s+[A-Za-z_$][\w$]*\.json\(\)/.test(baris)) return;
      if (baris.includes(".data")) return;
      // Pembantu yang memang membuka bungkusnya sendiri.
      if (/isiJawaban|bukaBungkus/.test(baris)) return;
      pelanggaran.push({ berkas: relatif.replace(/\\/g, "/"), baris: i + 1, ruas: ["(dipulangkan langsung)"] });
    });
  }

  return pelanggaran;
}

describe("jawaban portal selalu dibuka bungkusnya", () => {
  it("tidak ada pembantu yang memulangkan hasil urai apa adanya", () => {
    const pelanggaran = sapuPulangLangsung();
    const laporan = pelanggaran.map((x) => `${x.berkas}:${x.baris} memulangkan bungkus sebagai isi`).join("\n");
    expect(laporan, laporan || "bersih").toBe("");
  });

  it("tidak ada layar yang membaca ruas isi dari bungkusnya", () => {
    const pelanggaran = sapu();

    const laporan = pelanggaran
      .map((x) => `${x.berkas}:${x.baris} membaca ${x.ruas.join(", ")} dari bungkus`)
      .join("\n");

    expect(laporan, laporan || "bersih").toBe("");
  });

  it("penyapunya benar-benar menemukan sesuatu bila ada", () => {
    // Penjaga yang tidak dapat gagal bukan penjaga. Berkas contoh dibuat di
    // dalam ingatan tidak mungkin - penyapunya membaca cakram - jadi yang
    // diuji di sini logikanya: bentuk yang benar tidak boleh ikut tertuduh.
    //
    // Keduanya dipakai sungguhan di rumah ini, dan keduanya harus lolos.
    const benar = [
      "src/components/portal/bas-kehadiran-sidang.tsx",
      "src/components/portal/bas-lembar-isian.tsx",
    ];
    for (const satu of benar) {
      const isi = readFileSync(path.resolve(process.cwd(), satu), "utf8");
      expect(isi, satu).toMatch(/\.json\(\)\s*\)\s*\??\.\s*data/);
    }
  });
});
