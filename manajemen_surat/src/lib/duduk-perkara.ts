/**
 * DUDUK PERKARA (F2) - dirangkai dari yang tercatat, bukan diketik ulang.
 *
 * ============================================================================
 * DUDUK PERKARA ADALAH RIWAYAT, DAN RIWAYATNYA SUDAH ADA
 * ============================================================================
 *
 * Bagian "duduk perkara" tidak menilai apa pun. Ia menceritakan apa yang
 * terjadi: gugatan didaftarkan tanggal sekian, para pihak dipanggil, sidang
 * pertama begini, mediasi begitu, pembuktian sekian saksi, lalu kesimpulan.
 *
 * Seluruhnya SUDAH tercatat - di jadwal sidang SIPP, di lembar kehadiran
 * ALETA, dan di lembar tanya-jawab BAS. Panitera yang mengetiknya ulang
 * mengerjakan dua kali pekerjaan yang sama, dan dua ketikan atas satu
 * kenyataan pada akhirnya akan berselisih.
 *
 * ============================================================================
 * YANG TIDAK TERCATAT TIDAK DIKARANG
 * ============================================================================
 *
 * Inilah satu-satunya aturan yang membuat bagian ini boleh dipakai. Sidang
 * yang kehadirannya belum diisi TIDAK ditulis "para pihak hadir" - kalimat
 * itu benar pada kebanyakan sidang, dan justru karena hampir selalu benar ia
 * akan lolos pemeriksaan pada perkara yang satu-satunya tergugatnya tidak
 * pernah datang.
 *
 * Sidang seperti itu tetap ditulis, dengan tanggal dan agendanya, lalu
 * ditandai bahwa kehadirannya belum dicatat. Petugas yang membaca tahu persis
 * apa yang harus dilengkapi; petugas yang membaca kalimat karangan tidak tahu
 * ada yang perlu dilengkapi.
 */

import { type Sidang, tanggalIndonesia } from "@/lib/rangkaian-sidang";

export type CatatanSidang = {
  sidangKe: number;
  kehadiranPenggugat: string;
  kehadiranTergugat: string;
  agenda: string;
  hasil: string;
};

export type SaksiDidengar = {
  sidangKe: number;
  nama: string;
  /** Berapa tanya-jawab yang tercatat - nol berarti lembarnya masih kosong. */
  jumlahJawaban: number;
};

export type Alinea = {
  /** Sidang yang diceritakan alinea ini; 0 untuk alinea pembuka. */
  sidangKe: number;
  teks: string;
  /** Terisi bila ada yang belum tercatat, sehingga terlihat sebelum dicetak. */
  kekurangan: string;
};

export type DudukPerkara = {
  alinea: Alinea[];
  teks: string;
  /** Seluruh kekurangan, supaya pemanggil tidak perlu menyaring sendiri. */
  kekurangan: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Kalimat pembuka: gugatan didaftarkan.
 *
 * Tanggal pendaftaran datang dari SIPP dan tidak punya pengganti. Bila kosong,
 * alineanya tetap ditulis dengan tempat tanggalnya ditandai - bukan dilewati,
 * karena alinea pembuka yang hilang membuat seluruh riwayat kehilangan awal.
 */
function alineaPembuka(masukan: {
  nomorPerkara: string;
  tanggalDaftar: string;
  penggugat: string;
  tergugat: string;
  sebutanPenggugat: string;
  sebutanTergugat: string;
}): Alinea {
  const kurang: string[] = [];
  const tanggal = bersih(masukan.tanggalDaftar);
  const penggugat = bersih(masukan.penggugat);
  const tergugat = bersih(masukan.tergugat);
  const nomor = bersih(masukan.nomorPerkara);

  if (!tanggal) kurang.push("tanggal pendaftaran");
  if (!penggugat) kurang.push(`nama ${masukan.sebutanPenggugat}`);
  if (!tergugat) kurang.push(`nama ${masukan.sebutanTergugat}`);

  const teks =
    `Menimbang, bahwa ${masukan.sebutanPenggugat} ${penggugat || "[belum tercatat]"} telah mengajukan ` +
    `${masukan.sebutanPenggugat === "Pemohon" ? "permohonan" : "gugatan"} terhadap ` +
    `${masukan.sebutanTergugat} ${tergugat || "[belum tercatat]"}, yang didaftarkan di kepaniteraan ` +
    `pada tanggal ${tanggal ? tanggalIndonesia(tanggal) : "[belum tercatat]"} ` +
    `dengan Nomor ${nomor || "[belum tercatat]"};`;

  return { sidangKe: 0, teks, kekurangan: kurang.join(", ") };
}

const HADIR_TAK_TERCATAT = "belum dicatat";

function sebutKehadiran(nilai: string, sebutan: string): { kalimat: string; tercatat: boolean } {
  const isi = bersih(nilai).toLowerCase();
  if (!isi) return { kalimat: "", tercatat: false };
  if (isi.startsWith("hadir")) return { kalimat: `${sebutan} hadir`, tercatat: true };
  if (isi.startsWith("tidak")) return { kalimat: `${sebutan} tidak hadir`, tercatat: true };
  // Nilai lain - "hadir kuasa", "hadir melalui e-Court" - dipakai apa adanya.
  return { kalimat: `${sebutan} ${bersih(nilai)}`, tercatat: true };
}

/**
 * Satu alinea untuk satu sidang.
 *
 * Agenda diambil dari catatan ALETA lebih dulu, baru dari jadwal SIPP. Bukan
 * karena SIPP kurang dipercaya, melainkan karena agenda di jadwal adalah
 * RENCANA sedangkan catatan panitera adalah apa yang benar-benar terjadi -
 * dan duduk perkara menceritakan yang terjadi.
 */
function alineaSidang(
  sidang: Sidang,
  catatan: CatatanSidang | undefined,
  saksi: SaksiDidengar[],
  sebutanPenggugat: string,
  sebutanTergugat: string
): Alinea {
  const kurang: string[] = [];
  const tanggal = sidang.tanggal ? tanggalIndonesia(sidang.tanggal) : "";
  if (!tanggal) kurang.push("tanggal sidang");

  const agenda = bersih(catatan?.agenda) || bersih(sidang.agenda);
  if (!agenda) kurang.push("agenda");

  const pg = sebutKehadiran(catatan?.kehadiranPenggugat ?? "", sebutanPenggugat);
  const tg = sebutKehadiran(catatan?.kehadiranTergugat ?? "", sebutanTergugat);
  if (!pg.tercatat || !tg.tercatat) kurang.push("kehadiran para pihak");

  const potongan: string[] = [
    `Menimbang, bahwa pada sidang ke-${sidang.sidangKe} tanggal ${tanggal || "[belum tercatat]"}`,
  ];
  potongan.push(`dengan agenda ${agenda || "[belum tercatat]"}`);

  const hadir = [pg.kalimat, tg.kalimat].filter(Boolean).join(" dan ");
  potongan.push(hadir ? hadir : `kehadiran para pihak ${HADIR_TAK_TERCATAT}`);

  if (saksi.length) {
    const nama = saksi.map((item) => bersih(item.nama) || "[nama belum tercatat]");
    potongan.push(`telah didengar keterangan ${saksi.length} orang saksi, yaitu ${nama.join(", ")}`);
    const kosong = saksi.filter((item) => item.jumlahJawaban === 0).length;
    if (kosong) kurang.push(`${kosong} lembar keterangan saksi masih kosong`);
  }

  const hasil = bersih(catatan?.hasil);
  if (hasil) potongan.push(hasil.replace(/[;.]\s*$/, ""));
  else if (sidang.ditunda) {
    const alasan = bersih(sidang.alasanDitunda);
    potongan.push(alasan ? `sidang ditunda karena ${alasan}` : "sidang ditunda");
  }

  return { sidangKe: sidang.sidangKe, teks: `${potongan.join(", ")};`, kekurangan: kurang.join(", ") };
}

export type MasukanDudukPerkara = {
  nomorPerkara: string;
  tanggalDaftar: string;
  penggugat: string;
  tergugat: string;
  /** "Penggugat"/"Tergugat" pada gugatan, "Pemohon"/"Termohon" pada permohonan. */
  sebutanPenggugat?: string;
  sebutanTergugat?: string;
  rangkaian: Sidang[];
  catatan: CatatanSidang[];
  saksi: SaksiDidengar[];
};

/**
 * Merangkai duduk perkara.
 *
 * Urutannya urutan sidang, bukan urutan baris yang kebetulan terbaca lebih
 * dulu. Perkara yang sidangnya pernah dijadwalkan ulang menyimpan barisnya
 * tidak berurutan di SIPP, dan riwayat yang melompat-lompat akan dibaca
 * sebagai kekeliruan majelis, bukan kekeliruan penyusun.
 */
export function susunDudukPerkara(masukan: MasukanDudukPerkara): DudukPerkara {
  const sebutanPenggugat = bersih(masukan.sebutanPenggugat) || "Penggugat";
  const sebutanTergugat = bersih(masukan.sebutanTergugat) || "Tergugat";

  const petaCatatan = new Map<number, CatatanSidang>();
  for (const item of masukan.catatan ?? []) petaCatatan.set(Number(item.sidangKe), item);

  const petaSaksi = new Map<number, SaksiDidengar[]>();
  for (const item of masukan.saksi ?? []) {
    const kunci = Number(item.sidangKe);
    petaSaksi.set(kunci, [...(petaSaksi.get(kunci) ?? []), item]);
  }

  const alinea: Alinea[] = [
    alineaPembuka({
      nomorPerkara: masukan.nomorPerkara,
      tanggalDaftar: masukan.tanggalDaftar,
      penggugat: masukan.penggugat,
      tergugat: masukan.tergugat,
      sebutanPenggugat,
      sebutanTergugat,
    }),
  ];

  const urut = [...(masukan.rangkaian ?? [])].sort((a, b) => a.sidangKe - b.sidangKe);
  for (const sidang of urut) {
    alinea.push(
      alineaSidang(
        sidang,
        petaCatatan.get(sidang.sidangKe),
        petaSaksi.get(sidang.sidangKe) ?? [],
        sebutanPenggugat,
        sebutanTergugat
      )
    );
  }

  const kekurangan = alinea
    .filter((item) => item.kekurangan)
    .map((item) =>
      item.sidangKe === 0
        ? `Alinea pembuka: ${item.kekurangan}.`
        : `Sidang ke-${item.sidangKe}: ${item.kekurangan}.`
    );

  if (!urut.length) kekurangan.push("Belum ada satu pun sidang tercatat pada perkara ini.");

  return { alinea, teks: alinea.map((item) => item.teks).join("\n\n"), kekurangan };
}
