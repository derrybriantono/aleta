// @vitest-environment node
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { idEkstensi, kunciPublikDer, naskahUpdatesXml, susunCrx } from "@/server/shared/crx";

/**
 * Bungkus .crx untuk pembaruan otomatis.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Chrome menolak .crx yang tanda tangannya tidak sah, dan penolakannya nyaris
 * tanpa keterangan - "package is invalid" saja. Kalau bentuknya keliru,
 * ketahuannya bukan di sini melainkan di komputer petugas, sesudah kebijakan
 * disebar ke semua mesin.
 *
 * Karena itu yang diuji bukan "menghasilkan berkas", melainkan:
 *
 *   - tanda tangannya benar-benar SAH atas bahan yang tepat: penanda, panjang
 *     data kepala, data kepala, lalu zip - bukan atas zip-nya saja,
 *
 *   - ID ekstensi diturunkan dari kunci dan TIDAK berubah selama kuncinya
 *     sama; ID yang berganti berarti kebijakan di tiap komputer harus disetel
 *     ulang satu per satu,
 *
 *   - zip-nya utuh di dalam .crx, tidak tergeser sebyte pun.
 */
function buatKunci() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }) as string;
}

const ZIP_PALSU = Buffer.from("PK ini pura-pura zip ekstensi", "utf8");

describe("id ekstensi", () => {
  it("selalu 32 huruf a sampai p", () => {
    const id = idEkstensi(buatKunci());
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[a-p]{32}$/);
  });

  it("tetap sama untuk kunci yang sama", () => {
    // Inilah sifat yang membuat pembaruan otomatis mungkin: Chrome mengenali
    // ekstensi dari kuncinya, bukan dari namanya.
    const kunci = buatKunci();
    expect(idEkstensi(kunci)).toBe(idEkstensi(kunci));
  });

  it("berbeda untuk kunci yang berbeda", () => {
    expect(idEkstensi(buatKunci())).not.toBe(idEkstensi(buatKunci()));
  });

  it("diturunkan dari 16 byte pertama sidik kunci publik", () => {
    // Diperiksa terhadap rumusnya sendiri, bukan terhadap keluaran fungsi ini -
    // supaya penyimpangan pemetaan hurufnya tertangkap.
    const kunci = buatKunci();
    const sidik = createHash("sha256").update(kunciPublikDer(kunci)).digest().subarray(0, 16);
    let harap = "";
    for (const byte of sidik) {
      harap += String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 0x0f));
    }
    expect(idEkstensi(kunci)).toBe(harap);
  });
});

describe("bentuk berkas .crx", () => {
  const kunci = buatKunci();
  const crx = susunCrx(ZIP_PALSU, kunci);

  it("diawali penanda Cr24 dan versi 3", () => {
    expect(crx.subarray(0, 4).toString("utf8")).toBe("Cr24");
    expect(crx.readUInt32LE(4)).toBe(3);
  });

  it("zip-nya utuh di belakang kepala", () => {
    const panjangKepala = crx.readUInt32LE(8);
    const zip = crx.subarray(12 + panjangKepala);
    expect(zip.equals(ZIP_PALSU)).toBe(true);
  });

  it("tanda tangannya SAH atas bahan yang tepat", () => {
    const panjangKepala = crx.readUInt32LE(8);
    const kepala = crx.subarray(12, 12 + panjangKepala);
    const zip = crx.subarray(12 + panjangKepala);

    // Membaca kembali kunci publik dan tanda tangan dari kepala. Keduanya ruas
    // panjang-berbatas di dalam AsymmetricKeyProof, yang sendiri berada di
    // dalam ruas 2 CrxFileHeader.
    const publikDer = kunciPublikDer(kunci);
    const posisiPublik = kepala.indexOf(publikDer);
    expect(posisiPublik).toBeGreaterThan(0);

    const sesudahPublik = posisiPublik + publikDer.length;
    // Ruas 2 (tanda tangan): penanda 0x12, lalu panjangnya sebagai varint.
    expect(kepala[sesudahPublik]).toBe(0x12);
    let panjangTanda = 0;
    let geser = 0;
    let i = sesudahPublik + 1;
    for (;;) {
      const byte = kepala[i];
      panjangTanda |= (byte & 0x7f) << geser;
      i += 1;
      if ((byte & 0x80) === 0) break;
      geser += 7;
    }
    const tanda = kepala.subarray(i, i + panjangTanda);

    const crxId = createHash("sha256").update(publikDer).digest().subarray(0, 16);
    const dataKepala = Buffer.concat([Buffer.from([0x0a, crxId.length]), crxId]);
    const panjang = Buffer.alloc(4);
    panjang.writeUInt32LE(dataKepala.length, 0);
    const bahan = Buffer.concat([
      Buffer.from("CRX3 SignedData\0", "utf8"),
      panjang,
      dataKepala,
      zip,
    ]);

    const sah = createVerify("sha256").update(bahan).verify(
      { key: kunci },
      tanda
    );
    expect(sah).toBe(true);
  });

  it("zip yang berbeda menghasilkan tanda tangan yang berbeda", () => {
    // Kalau tidak, tanda tangannya tidak melindungi isinya sama sekali.
    const lain = susunCrx(Buffer.from("isi yang lain", "utf8"), kunci);
    expect(crx.equals(lain)).toBe(false);
  });
});

describe("updates.xml", () => {
  it("memuat id, versi, dan alamat unduhannya", () => {
    const xml = naskahUpdatesXml({
      id: "abcdefghijklmnopabcdefghijklmnop",
      versi: "1.62.0",
      alamatCrx: "http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/paket.crx",
    });
    expect(xml).toContain("appid='abcdefghijklmnopabcdefghijklmnop'");
    expect(xml).toContain("version='1.62.0'");
    expect(xml).toContain("codebase='http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/paket.crx'");
    expect(xml).toContain("protocol='2.0'");
  });

  it("menyamarkan tanda kutip dan kurung sudut pada alamat", () => {
    // Alamatnya datang dari pengaturan, dan pengaturan dapat salah ketik.
    // XML yang rusak membuat Chrome berhenti memeriksa pembaruan tanpa suara.
    const xml = naskahUpdatesXml({
      id: "a",
      versi: "1",
      alamatCrx: "http://x/?a=1&b=2\"><script>",
    });
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("<script>");
  });
});

describe("jati diri ZIP dan .crx", () => {
  /**
   * Yang dijaga: folder yang dimuat unpacked dan paket yang dipasang kebijakan
   * harus berjati diri SAMA. Bila tidak, satu komputer memuat dua salinan dan
   * panelnya muncul dobel di halaman SIPP - dan itu tampak seperti kerusakan,
   * bukan seperti salah pasang.
   */
  const kunci = buatKunci();

  async function bacaManifest(awalan: string) {
    const semula = process.env.ALETA_EKSTENSI_CRX_KEY;
    process.env.ALETA_EKSTENSI_CRX_KEY = kunci;
    try {
      const { berkasEkstensi } = await import("@/server/shared/ekstensi-paket");
      const berkas = berkasEkstensi(awalan).find(
        (b) => b.nama === (awalan ? `${awalan}/manifest.json` : "manifest.json")
      );
      return JSON.parse(String(berkas?.isi.toString("utf8") || "{}"));
    } finally {
      if (semula === undefined) delete process.env.ALETA_EKSTENSI_CRX_KEY;
      else process.env.ALETA_EKSTENSI_CRX_KEY = semula;
    }
  }

  it("manifest membawa kunci publik dari kunci penanda tangan", async () => {
    const manifest = await bacaManifest("");
    expect(manifest.key).toBe(kunciPublikDer(kunci).toString("base64"));
  });

  it("kedua bentuk memberi ID yang sama dengan paketnya", async () => {
    const akar = await bacaManifest("");
    const berawalan = await bacaManifest("ekstensi-sipp");
    expect(akar.key).toBe(berawalan.key);

    // Diturunkan ulang dari kunci di manifest, persis seperti yang dilakukan
    // Chrome - bukan sekadar dibandingkan dengan keluaran fungsi yang sama.
    const sidik = createHash("sha256").update(Buffer.from(akar.key, "base64")).digest();
    let id = "";
    for (const byte of sidik.subarray(0, 16)) {
      id += String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 0x0f));
    }
    expect(id).toBe(idEkstensi(kunci));
  });

  it("tetap menyajikan manifest utuh bila kunci belum disetel", async () => {
    const semula = process.env.ALETA_EKSTENSI_CRX_KEY;
    delete process.env.ALETA_EKSTENSI_CRX_KEY;
    try {
      const { berkasEkstensi, versiEkstensi } = await import("@/server/shared/ekstensi-paket");
      const berkas = berkasEkstensi("").find((b) => b.nama === "manifest.json");
      const manifest = JSON.parse(String(berkas?.isi.toString("utf8") || "{}"));
      expect(manifest.key).toBeUndefined();
      expect(manifest.version).toBe(versiEkstensi());
    } finally {
      if (semula !== undefined) process.env.ALETA_EKSTENSI_CRX_KEY = semula;
    }
  });
});

describe("membaca kunci dari lingkungan", () => {
  /**
   * Berkas .env tidak dapat menyimpan baris baru, jadi kuncinya ditulis di sana
   * dengan "\\n" harfiah. Pengubahannya kembali menjadi baris baru sudah pernah
   * rusak sekali - sebuah tanda miring hilang saat berkasnya ditulis ulang, dan
   * seluruh pembaruan otomatis berhenti dengan keterangan
   * "DECODER routines::unsupported" yang tidak menyebut sebabnya.
   *
   * Diuji lewat perilakunya - kunci yang terbaca harus menghasilkan ID yang
   * sama dengan kunci aslinya - bukan lewat bentuk naskahnya.
   */
  async function idDariLingkungan(nilai: string): Promise<string> {
    const semula = process.env.ALETA_EKSTENSI_CRX_KEY;
    process.env.ALETA_EKSTENSI_CRX_KEY = nilai;
    try {
      const { kunciCrx } = await import("@/server/shared/ekstensi-paket");
      return idEkstensi(kunciCrx());
    } finally {
      if (semula === undefined) delete process.env.ALETA_EKSTENSI_CRX_KEY;
      else process.env.ALETA_EKSTENSI_CRX_KEY = semula;
    }
  }

  it("menerima kunci yang baris barunya ditulis harfiah", async () => {
    const kunci = buatKunci();
    const sebaris = kunci.replace(/\n/g, "\\n");
    expect(sebaris).not.toContain("\n");
    expect(await idDariLingkungan(sebaris)).toBe(idEkstensi(kunci));
  });

  it("menerima kunci yang baris barunya utuh", async () => {
    const kunci = buatKunci();
    expect(await idDariLingkungan(kunci)).toBe(idEkstensi(kunci));
  });
});
