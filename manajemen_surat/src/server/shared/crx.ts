import { createHash, createSign, createPrivateKey, createPublicKey } from "node:crypto";

/**
 * Membungkus ekstensi menjadi berkas .crx yang ditandatangani.
 *
 * ============================================================================
 * UNTUK APA
 * ============================================================================
 *
 * Ekstensi yang dimuat unpacked TIDAK PERNAH memperbarui dirinya. Supaya
 * Chrome memasang dan memperbaruinya sendiri, ia harus berupa .crx bertanda
 * tangan yang alamat pembaruannya disebut dalam kebijakan Chrome.
 *
 * ============================================================================
 * KUNCI MENENTUKAN JATI DIRI EKSTENSI
 * ============================================================================
 *
 * ID ekstensi diturunkan dari kunci PUBLIK-nya, bukan dari namanya. Karena itu
 * kuncinya harus TETAP: kunci yang berganti berarti ekstensi yang sama sekali
 * lain di mata Chrome, dan kebijakan di tiap komputer harus disetel ulang.
 *
 * Kuncinya rahasia dan TIDAK disimpan di dalam kode. Ia dibaca dari lingkungan
 * server, dan harus dicadangkan di luar server - kehilangannya tidak dapat
 * dipulihkan, hanya dapat diganti dengan pemasangan ulang di semua komputer.
 *
 * ============================================================================
 * BENTUK BERKASNYA (CRX3)
 * ============================================================================
 *
 *   "Cr24"                     empat huruf penanda
 *   uint32                     versi bentuk = 3
 *   uint32                     panjang kepala
 *   kepala                     CrxFileHeader (protobuf)
 *   zip                        isi ekstensinya
 *
 * Yang ditandatangani BUKAN zip-nya saja, melainkan gabungan penanda, panjang
 * data kepala, data kepala, lalu zip - supaya kepala dan isi tidak dapat
 * dipasangkan ulang dari dua berkas yang berbeda.
 */

/** Menyandikan bilangan sebagai varint protobuf. */
function varint(nilai: number): Buffer {
  const keluar: number[] = [];
  let sisa = nilai;
  while (sisa > 0x7f) {
    keluar.push((sisa & 0x7f) | 0x80);
    sisa >>>= 7;
  }
  keluar.push(sisa);
  return Buffer.from(keluar);
}

/** Satu ruas protobuf bertipe panjang-berbatas. */
function ruas(nomor: number, isi: Buffer): Buffer {
  return Buffer.concat([varint((nomor << 3) | 2), varint(isi.length), isi]);
}

/** Kunci publik dalam bentuk DER SPKI, dari kunci rahasia PEM. */
export function kunciPublikDer(kunciRahasiaPem: string): Buffer {
  const publik = createPublicKey(createPrivateKey(kunciRahasiaPem));
  return publik.export({ type: "spki", format: "der" }) as Buffer;
}

/**
 * ID ekstensi menurut Chrome: 32 huruf a-p.
 *
 * Diambil dari 16 byte pertama SHA-256 kunci publik, lalu tiap setengah byte
 * dipetakan ke huruf a sampai p. Bukan heksadesimal - Chrome memakai abjad
 * supaya ID-nya tidak pernah tampak seperti bilangan.
 */
export function idEkstensi(kunciRahasiaPem: string): string {
  const sidik = createHash("sha256").update(kunciPublikDer(kunciRahasiaPem)).digest();
  let id = "";
  for (const byte of sidik.subarray(0, 16)) {
    id += String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 0x0f));
  }
  return id;
}

/** Membungkus zip ekstensi menjadi .crx bertanda tangan. */
export function susunCrx(zip: Buffer, kunciRahasiaPem: string): Buffer {
  const publikDer = kunciPublikDer(kunciRahasiaPem);
  const crxId = createHash("sha256").update(publikDer).digest().subarray(0, 16);

  // SignedData { bytes crx_id = 1; }
  const dataKepala = ruas(1, crxId);

  // Yang ditandatangani: penanda, panjang data kepala, data kepala, lalu zip.
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32LE(dataKepala.length, 0);
  const bahanTanda = Buffer.concat([
    Buffer.from("CRX3 SignedData\0", "utf8"),
    panjang,
    dataKepala,
    zip,
  ]);

  const tanda = createSign("sha256").update(bahanTanda).sign(kunciRahasiaPem);

  // AsymmetricKeyProof { bytes public_key = 1; bytes signature = 2; }
  const bukti = Buffer.concat([ruas(1, publikDer), ruas(2, tanda)]);

  // CrxFileHeader { repeated AsymmetricKeyProof sha256_with_rsa = 2;
  //                 bytes signed_header_data = 10000; }
  const kepala = Buffer.concat([ruas(2, bukti), ruas(10000, dataKepala)]);

  const awalan = Buffer.alloc(12);
  awalan.write("Cr24", 0, "utf8");
  awalan.writeUInt32LE(3, 4);
  awalan.writeUInt32LE(kepala.length, 8);

  return Buffer.concat([awalan, kepala, zip]);
}

/**
 * Naskah updates.xml yang dibaca Chrome saat memeriksa pembaruan.
 *
 * Chrome mengambilnya TANPA membawa kuki pengguna - ia permintaan dari
 * peramban, bukan dari halaman. Karena itu alamatnya harus dapat diambil tanpa
 * sesi portal, dan itu memang disengaja.
 */
export function naskahUpdatesXml({
  id,
  versi,
  alamatCrx,
}: {
  id: string;
  versi: string;
  alamatCrx: string;
}): string {
  const aman = (teks: string) =>
    String(teks).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${aman(id)}'>
    <updatecheck codebase='${aman(alamatCrx)}' version='${aman(versi)}' />
  </app>
</gupdate>
`;
}
