/**
 * ============================================================================
 * SARAN BLANGKO UNTUK SEMUA JENIS PERKARA, SEMUA KATEGORI (20 Okt 2026)
 * ============================================================================
 *
 * Temuan hakim di panel Blangko ABT: untuk perkara selain cerai, kotak "Pilih blangko" tidak menandai satu pun blangko sebagai disarankan
 * (contoh 228/Pdt.P/2026/PA.Dgl, itsbat nikah voluntair, sidang ke-2 beragenda Pembuktian: tab Putusan kosong). Sebabnya satu aturan:
 *
 *   - PUTUSAN hanya disarankan bila status putusan sudah tercatat, atau agenda sidang berbunyi putus/musyawarah/pembacaan. Permohonan
 *     voluntair sering diputus pada sidang ke-2 atau ke-3 yang agendanya tertulis "Pembuktian" - jadi kosong sampai putusan diketik.
 *   - RELAAS hanya disarankan bila sidang sudah ditunda atau perkara sudah putus (hasil sidang tercatat). Sidang yang hasilnya belum dicatat
 *     tidak mendapat saran juru sita, dan perkara voluntair (tanpa Termohon) tidak punya cabang sendiri.
 *   - PTSP (penetapan PMH/PPP/PJS/PHS dst.) tidak punya mesin saran sama sekali.
 *   - Jenis yang peta putusannya tak punya baris "dikabulkan" (asal usul anak) tidak pernah mendapat blangko kabul.
 *
 * Berkas ini MELENGKAPI rekomendasiBlangko (rekomendasi-blangko.ts) tanpa mengubah satu pun saran yang sudah ada: hanya kategori yang
 * KOSONG diisi, dan isiannya selalu bertanda perkiraan (keyakinan "perkiraan") dengan kalimat alasan biasa untuk petugas:
 *
 *   putusan  blangko kabul (atau menurut kata pada agenda: cabut / gugur / tolak / tidak dapat diterima / perdamaian) yang lazim untuk
 *            jenis perkara itu bila sidang ini memutus, ditambah varian dan alternatif tolak / tidak dapat diterima / cabut.
 *            Verstek diperkirakan hanya bila Tergugat/Termohon tidak pernah hadir dan sidang sebelumnya dihadiri Penggugat saja.
 *   relaas   panggilan sidang pertama (Penggugat dan Tergugat; voluntair: Pemohon saja, ditambah pengumuman itsbat bila itsbat voluntair),
 *            panggilan sidang lanjutan bagi pihak yang tidak hadir, atau pemberitahuan putusan/penetapan bila agenda memutus.
 *            Pihak diambil dari kehadiran sidang ini, bila belum tercatat dari sidang sebelumnya, bila belum ada juga dari kebiasaan jenisnya.
 *   ptsp     penetapan majelis/PPP/PJS bila petugasnya belum tertunjuk, gabungan PMH-PHS untuk perkara baru, penetapan hari sidang
 *            (biasa, sita, ikrar talak, ikrar lanjutan), penetapan mediator.
 *   bas      tidak diubah (mesin BAS sudah menjangkau semua jenis); satu-satunya perubahan ada di alur-bas-baru.ts: agenda "Pembuktian"
 *            pada sidang ke-2 dst. mengusulkan BAS pemeriksaan saksi, bukan pembacaan penetapan.
 *
 * Murni: tanpa jaringan dan tanpa basis data. Tidak menulis apa pun ke mana pun.
 */
import { perluasAliasMenu } from "@/lib/alias-menu-derry";
import { kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";
import {
  blangkoAmplopPendamping,
  blangkoPengumumanItsbat,
  blangkoRelaas,
  FOLDER_PTSP_NAMA,
  JENIS_PENCEGAHAN_PERKAWINAN,
  type BlangkoRelaas,
  type KeadaanRelaas,
} from "@/lib/pohon-blangko";
import {
  dariRelaas,
  FOLDER_MENU_PUTUSAN,
  MENU_JENIS_TANPA_MENU,
  PETA_PUTUSAN_BAWAAN,
  pilihPutusanBawaan,
  rekomendasiBlangko,
  rekomendasiPutusan,
  teksDasarSidang,
  type HasilRekomendasi,
  type MasukanRekomendasi,
  type Rekomendasi,
} from "@/lib/rekomendasi-blangko";

const AKAR = "derry_briantono";
type Sisi = "pertama" | "kedua";

// ---------------------------------------------------------------------------
// Keadaan perkara
// ---------------------------------------------------------------------------

/** Permohonan (voluntair, tanpa Termohon): nomor Pdt.P, atau alur SIPP 16. */
export function perkaraVoluntair(m: Pick<MasukanRekomendasi, "nomorPerkara" | "alurPerkaraId">): boolean {
  if (/\/Pdt\.P\//i.test(String(m.nomorPerkara ?? ""))) return true;
  if (/\/Pdt\.G(?:\.S)?\//i.test(String(m.nomorPerkara ?? ""))) return false;
  return Number(m.alurPerkaraId) === 16;
}

/** Sebutan pihak menurut jenis perkara dan sisinya. */
export function sebutanPihak(m: Pick<MasukanRekomendasi, "jenisPerkara" | "nomorPerkara" | "alurPerkaraId">, sisi: Sisi): string {
  if (perkaraVoluntair(m)) return "Pemohon";
  const cerai = kunciJenisPerkara(m.jenisPerkara) === "cerai talak";
  if (sisi === "pertama") return cerai ? "Pemohon" : "Penggugat";
  return cerai ? "Termohon" : "Tergugat";
}

/** Sisi yang TIDAK hadir menurut sandi dihadiri_oleh (1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada); null = tidak diketahui. */
export function sisiTidakHadir(sandi: unknown, voluntair: boolean): Sisi[] | null {
  if (sandi === null || sandi === undefined || sandi === "") return null;
  const n = Number(sandi);
  if (!Number.isFinite(n)) return null;
  if (voluntair) {
    // Permohonan hanya punya Pemohon: 1 dan 2 berarti Pemohon hadir; 3 dan 4 berarti Pemohon tidak hadir.
    if (n === 1 || n === 2) return [];
    if (n === 3 || n === 4) return ["pertama"];
    return null;
  }
  if (n === 1) return [];
  if (n === 2) return ["kedua"];
  if (n === 3) return ["pertama"];
  if (n === 4) return ["pertama", "kedua"];
  return null;
}

const RX_AGENDA_PUTUS = /putus|musyawarah|pembacaan\s+(?:putusan|penetapan)|ikrar\s+putus|pengucapan/i;

/** Status akhir yang disebut agenda/keterangan sidang (kata biasa); null = tidak disebut. */
export function statusDariTeks(teks: string): string | null {
  const t = String(teks ?? "");
  if (/cabut/i.test(t)) return "Dicabut";
  if (/gugur/i.test(t)) return "Digugurkan";
  if (/tidak\s+dapat\s+diterima|niet\s+ontvankelijk/i.test(t) || /\bNO\b/.test(t)) return "Tidak Dapat Diterima";
  if (/\bditolak\b|\btolak\b/i.test(t)) return "Ditolak";
  if (/perdamaian|akta\s+damai|\bdamai\b/i.test(t)) return "Perdamaian";
  return null;
}

const KATA_STATUS: Record<string, string> = {
  dikabulkan: "dikabulkan",
  ditolak: "ditolak",
  "tidak dapat diterima": "tidak dapat diterima",
  dicabut: "dicabut",
  digugurkan: "digugurkan",
  perdamaian: "diakhiri dengan perdamaian",
};

// ---------------------------------------------------------------------------
// PUTUSAN / PENETAPAN
// ---------------------------------------------------------------------------

/** Cadangan dari peta bawaan bila jenis itu tak punya baris polos untuk status (mis. asal usul anak dikabulkan): baris pertama jenis+status. */
function cadanganDariPeta(m: MasukanRekomendasi, status: string): Rekomendasi[] {
  const j = kunciJenisPerkara(m.jenisPerkara);
  const s = kunciStatusPutusan(status);
  if (!j || !s) return [];
  const kunci = Object.keys(PETA_PUTUSAN_BAWAAN).find((k) => k.startsWith(`${j}|${s}|`) && !k.includes("+"));
  if (!kunci) return [];
  const baris = PETA_PUTUSAN_BAWAAN[kunci];
  const menu = baris.blangko || MENU_JENIS_TANPA_MENU[j] || "";
  const folderMenu = FOLDER_MENU_PUTUSAN[menu];
  if (!folderMenu) return [];
  return [
    {
      jenis: "putusan",
      folder: `${AKAR}/${folderMenu}`,
      berkas: `${baris.berkas.replace(/\.rtf$/i, "")}.rtf`,
      menu,
      alias: perluasAliasMenu(baris.blangkoLain ?? []),
      label: baris.berkas,
      alasan: `Putusan ${s}.`,
      utama: true,
      perkiraan: true,
    },
  ];
}

/** Keadaan lazim bagi perkara berkumulasi (cerai + itsbat / hak asuh) per status, bila keadaan sebenarnya belum diketahui. */
const KEADAAN_KUMULASI: Record<string, string> = {
  dikabulkan: "kontradiktoir",
  ditolak: "itsbat-kabul-cerai-ditolak",
  "tidak dapat diterima": "sema-1-2022",
};

function bacaStatus(m: MasukanRekomendasi, teks: string, status: string): Rekomendasi[] {
  const hasil = rekomendasiPutusan({ ...m, sudahPutus: false, statusPutusan: status }, teks);
  const s = kunciStatusPutusan(status);
  // Cerai berkumulasi: baris petanya selalu memakai keadaan; tanpa keadaan jatuh ke blangko cerai biasa (folder yang keliru).
  if (m.kumulasi && KEADAAN_KUMULASI[s] && !/kumulasi/i.test(hasil[0]?.menu ?? "")) {
    const p = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, m.jenisPerkara, status, m.verstekPutusan === true, m.kumulasi, [KEADAAN_KUMULASI[s]]);
    const menu = p?.baris.blangko || "";
    if (p && p.tingkat.startsWith("kumulasi") && FOLDER_MENU_PUTUSAN[menu]) {
      return [
        {
          jenis: "putusan",
          folder: `${AKAR}/${FOLDER_MENU_PUTUSAN[menu]}`,
          berkas: `${p.baris.berkas.replace(/\.rtf$/i, "")}.rtf`,
          menu,
          alias: perluasAliasMenu(p.baris.blangkoLain ?? []),
          label: p.baris.berkas,
          alasan: `Putusan ${s} (${p.kunci.split("|")[2]?.replace(/-/g, " ") ?? "kumulasi"}).`,
          utama: true,
          perkiraan: true,
        },
      ];
    }
  }
  return hasil.length ? hasil : cadanganDariPeta(m, status);
}

/**
 * Saran putusan/penetapan untuk sidang yang belum memutus dan agendanya bukan putusan. Kosong hanya bila jenis perkara tak punya blangko
 * putusan sama sekali (mis. penolakan perkawinan) atau sidang ini sidang ikrar talak (diatur penetapan ikrar).
 */
export function saranPutusanCadangan(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const j = kunciJenisPerkara(m.jenisPerkara);
  if (!j) return [];
  if (m.sidangIkrarTalak === true && j === "cerai talak") return [];
  // Perkara yang sudah putus punya status sendiri; jenis yang tak punya blangkonya tidak diberi tebakan "dikabulkan".
  if (m.sudahPutus === true) return [];
  const n = Number(m.urutanSidang) || 1;
  const voluntair = perkaraVoluntair(m);
  // Verstek hanya diperkirakan dari keadaan nyata: Tergugat/Termohon belum pernah hadir dan sidang (ini / sebelumnya) hanya dihadiri pihak pertama.
  const hanyaPertamaHadir = m.dihadiriOleh === 2 || ((m.dihadiriOleh === null || m.dihadiriOleh === undefined) && m.hadirSebelumnya === 2);
  const verstek = m.verstekPutusan === true || (!voluntair && n >= 2 && m.tergugatPernahHadir !== true && hanyaPertamaHadir);
  const dasar: MasukanRekomendasi = { ...m, verstekPutusan: verstek };
  let statusUtama = statusDariTeks(teks) ?? "Dikabulkan";
  let utama = bacaStatus(dasar, teks, statusUtama);
  const kabul = bacaStatus(dasar, teks, "Dikabulkan");
  // Status yang disebut agenda tetapi jenis itu tak punya blangkonya (jatuh ke blangko kabul): jangan mengaku sebagai status itu.
  if (utama[0] && kabul[0] && statusUtama !== "Dikabulkan" && utama[0].berkas === kabul[0].berkas && utama[0].folder === kabul[0].folder) {
    statusUtama = "Dikabulkan";
    utama = kabul;
  }
  if (!utama.length) return [];
  const agenda = String(m.agenda ?? "").trim();
  const awal = `Sidang ke-${n}${agenda ? ` (${agenda})` : ""} belum tercatat putus`;
  const kata = KATA_STATUS[kunciStatusPutusan(statusUtama)] ?? "dikabulkan";
  const penutupVerstek = verstek ? "; Tergugat/Termohon belum pernah hadir sehingga diperkirakan verstek" : "";
  const hasil: Rekomendasi[] = [];
  const lihat = new Set<string>();
  const tambah = (r: Rekomendasi, alasan: string, penting: boolean) => {
    const kunci = `${r.folder}|${r.berkas}`;
    if (lihat.has(kunci)) return;
    lihat.add(kunci);
    hasil.push({ ...r, alasan, utama: penting, perkiraan: true, keyakinan: "perkiraan" });
  };
  utama.forEach((r, i) => {
    if (i === 0) tambah(r, `${awal}; bila diputus pada sidang ini, blangko inilah yang lazim untuk perkara yang ${kata}${penutupVerstek}.`, true);
  });
  // Satu varian pertama (mis. kondisi anak, jumlah saksi) tepat di bawah blangko utama, lalu alternatif status lain, lalu sisa varian.
  const varian = utama.slice(1);
  if (varian[0]) tambah(varian[0], "Varian pada keadaan yang sama.", false);
  const lain: Array<[string, string]> = [
    ["Ditolak", "Alternatif bila perkara ini ditolak."],
    ["Tidak Dapat Diterima", "Alternatif bila perkara ini dinyatakan tidak dapat diterima."],
    ["Dicabut", "Alternatif bila perkara ini dicabut."],
  ];
  for (const [status, alasan] of lain) {
    if (kunciStatusPutusan(status) === kunciStatusPutusan(statusUtama)) continue;
    const r = bacaStatus(dasar, teks, status)[0];
    // Status tanpa baris peta jatuh ke blangko jenis (kabul); itu bukan alternatif tolak/NO/cabut.
    if (!r || (r.berkas === utama[0].berkas && r.folder === utama[0].folder)) continue;
    tambah(r, alasan, false);
  }
  for (const r of varian.slice(1)) tambah(r, "Varian pada keadaan yang sama.", false);
  return hasil;
}

// ---------------------------------------------------------------------------
// RELAAS
// ---------------------------------------------------------------------------

function sisiRelaasBiasa(m: MasukanRekomendasi, n: number, voluntair: boolean): { sisi: Sisi[]; dari: "ini" | "sebelumnya" | "kebiasaan" | "awal" } {
  const ini = sisiTidakHadir(m.dihadiriOleh, voluntair);
  if (ini) return { sisi: ini, dari: "ini" };
  if (n >= 2) {
    const sebelumnya = sisiTidakHadir(m.hadirSebelumnya, voluntair);
    if (sebelumnya) return { sisi: sebelumnya, dari: "sebelumnya" };
  }
  if (n <= 1) return { sisi: voluntair ? ["pertama"] : ["pertama", "kedua"], dari: "awal" };
  return { sisi: voluntair ? ["pertama"] : ["kedua"], dari: "kebiasaan" };
}

/** Saran relaas untuk sidang yang hasilnya belum tercatat sebagai tunda/putus. [] hanya bila jenis tak punya blangko relaas yang cocok. */
export function saranRelaasCadangan(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const n = Number(m.urutanSidang) || 1;
  const voluntair = perkaraVoluntair(m);
  const j = kunciJenisPerkara(m.jenisPerkara);
  const opsi = {
    lewatEcourt: m.lewatEcourt === true,
    verstek: m.verstekPutusan === true,
    jenisPerkaraId: m.jenisPerkaraId ?? (/pencegahan\s+perkawinan/i.test(String(m.jenisPerkara ?? "")) ? JENIS_PENCEGAHAN_PERKAWINAN : null),
  };
  const agendaPutus = RX_AGENDA_PUTUS.test(teks);
  const belumTercatat = m.dihadiriOleh === null || m.dihadiriOleh === undefined;
  const { sisi, dari } = sisiRelaasBiasa(m, n, voluntair);
  // Kehadiran sidang INI sudah tercatat lengkap (semua pihak hadir): tidak ada yang dipanggil atau diberi tahu - keputusan lama dipertahankan.
  if (dari === "ini" && sisi.length === 0 && !(m.sidangIkrarTalak === true && j === "cerai talak")) return [];
  const hasil: Rekomendasi[] = [];
  const tambah = (b: BlangkoRelaas | null, alasan: string, utama: boolean, perkiraan: boolean) => {
    if (!b || hasil.some((x) => x.berkas === b.berkas)) return;
    hasil.push({ ...dariRelaas(b, alasan, utama), perkiraan, keyakinan: perkiraan ? "perkiraan" : utama ? "pasti" : "cukup" });
  };
  const asalHadir =
    dari === "ini"
      ? "yang tidak hadir pada sidang ini"
      : dari === "sebelumnya"
        ? "yang tidak hadir pada sidang sebelumnya (kehadiran sidang ini belum tercatat)"
        : "(kehadiran belum tercatat)";

  // Sidang ikrar talak yang belum tercatat ditunda: panggilan sidang ikrar bagi kedua pihak.
  if (m.sidangIkrarTalak === true && j === "cerai talak") {
    for (const s of ["pertama", "kedua"] as Sisi[]) {
      tambah(blangkoRelaas("ikrar-talak", s, opsi), "Panggilan sidang ikrar talak bila ikrar ditunda.", hasil.length === 0, true);
      tambah(blangkoAmplopPendamping("ikrar-talak", s, opsi), "Amplop pendamping panggilan ikrar.", false, true);
    }
    return hasil;
  }

  const keadaanUtama: KeadaanRelaas = agendaPutus ? "pemberitahuan-putusan" : n <= 1 && belumTercatat ? "sidang-pertama" : "sidang-ditunda";
  const sisiPakai: Sisi[] = sisi.length ? sisi : voluntair ? ["pertama"] : ["kedua"];
  const semuaHadir = sisi.length === 0; // kehadiran tercatat lengkap: relaas hanya berlaku bila sidang ternyata ditunda / ada yang perlu diberi tahu
  const perkiraanUtama = dari !== "ini" || semuaHadir;

  const kalimatUtama = (s: Sisi): string => {
    const p = sebutanPihak(m, s);
    if (keadaanUtama === "sidang-pertama") return `Panggilan sidang pertama kepada ${p}.`;
    if (keadaanUtama === "pemberitahuan-putusan") {
      return semuaHadir ? `Pemberitahuan isi putusan atau penetapan kepada ${p}, hanya bila tidak hadir saat dibacakan.` : `Pemberitahuan isi putusan atau penetapan kepada ${p} ${asalHadir}.`;
    }
    if (semuaHadir) return `Panggilan sidang lanjutan kepada ${p}, hanya bila sidang ini ditunda (semua pihak hadir pada sidang sebelumnya).`;
    return `Panggilan sidang lanjutan kepada ${p} ${asalHadir}.`;
  };

  for (const s of sisiPakai) {
    tambah(blangkoRelaas(keadaanUtama, s, opsi), kalimatUtama(s), true, perkiraanUtama);
    tambah(blangkoAmplopPendamping(keadaanUtama, s, opsi), `Amplop pendamping untuk ${sebutanPihak(m, s)}.`, false, perkiraanUtama);
  }
  // Itsbat nikah voluntair: pengumuman dicetak bersama panggilan sidang pertama (setelah panggilannya).
  if (keadaanUtama === "sidang-pertama" && voluntair && j === "itsbat nikah") {
    tambah(
      blangkoPengumumanItsbat(m.jumlahPemohon),
      `Pengumuman permohonan itsbat nikah (${Number(m.jumlahPemohon) === 1 ? "satu Pemohon" : "suami dan istri sebagai Pemohon"}), dicetak bersama panggilan sidang pertama.`,
      false,
      Number(m.jumlahPemohon) !== 1 && Number(m.jumlahPemohon) !== 2
    );
  }
  const adaUtama = hasil.some((x) => x.utama);
  if (!adaUtama && hasil[0]) hasil[0] = { ...hasil[0], utama: true };

  // Alternatif keadaan lain bagi pihak yang sama: sidang ditunda <-> pemberitahuan putusan.
  const keadaanLain: KeadaanRelaas | null = keadaanUtama === "sidang-pertama" ? null : keadaanUtama === "sidang-ditunda" ? "pemberitahuan-putusan" : "sidang-ditunda";
  if (keadaanLain) {
    for (const s of sisiPakai) {
      tambah(
        blangkoRelaas(keadaanLain, s, opsi),
        keadaanLain === "pemberitahuan-putusan" ? `Alternatif bila ${sebutanPihak(m, s)} tidak hadir saat putusan atau penetapan dibacakan.` : `Alternatif bila sidang ditunda dan ${sebutanPihak(m, s)} perlu dipanggil lagi.`,
        false,
        true
      );
    }
  }
  // Cerai talak yang sudah putus kabul: panggilan sidang ikrar talak menyusul.
  if (j === "cerai talak" && m.sudahPutus === true && kunciStatusPutusan(m.statusPutusan) === "dikabulkan") {
    for (const s of ["pertama", "kedua"] as Sisi[]) tambah(blangkoRelaas("ikrar-talak", s, opsi), "Panggilan sidang ikrar talak setelah putusan dikabulkan.", false, true);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// PTSP
// ---------------------------------------------------------------------------

const MENU_PTSP = "Form Pelayanan Terpadu Satu Pintu (PTSP)";
const ALIAS_PTSP = ["Form PTSP", "PTSP"];
const PTSP = {
  gabungan: "@ 0 - PMH - PHS.rtf",
  pmh: "@ 1 - PMH.rtf",
  phs: "@ 2 - PHS.rtf",
  phsSitaKabul: "@ 2a - PHS - Sita Dikabulkan.rtf",
  phsSitaTolak: "@ 2b - PHS - Sita Ditolak.rtf",
  ppp: "@ 0a - PPP.rtf",
  pjs: "@ 0b - PJS.rtf",
  ikrarPmhPhs: "@ 3 - PMH - PHS Ikrar Talak.rtf",
  ikrarPhs: "@ 3a - PHS Ikrar Talak.rtf",
  ikrarPhsLanjutan: "@ 3b - PHS Ikrar Talak Lanjutan.rtf",
  mediator: "@ 4 - Penetapan Penunjukan Mediator.rtf",
} as const;

const LABEL_PTSP: Record<string, string> = {
  [PTSP.gabungan]: "Penetapan majelis hakim dan hari sidang (gabungan)",
  [PTSP.pmh]: "Penetapan majelis hakim",
  [PTSP.phs]: "Penetapan hari sidang",
  [PTSP.phsSitaKabul]: "Penetapan hari sidang - sita dikabulkan",
  [PTSP.phsSitaTolak]: "Penetapan hari sidang - sita ditolak",
  [PTSP.ppp]: "Penunjukan panitera pengganti",
  [PTSP.pjs]: "Penunjukan juru sita",
  [PTSP.ikrarPmhPhs]: "Penetapan majelis dan hari sidang ikrar talak",
  [PTSP.ikrarPhs]: "Penetapan hari sidang ikrar talak",
  [PTSP.ikrarPhsLanjutan]: "Penetapan hari sidang ikrar talak lanjutan",
  [PTSP.mediator]: "Penetapan penunjukan mediator",
};

/** Saran blangko PTSP (penetapan) menurut keadaan perkara dan sidang. Selalu ada isinya: penetapan hari sidang adalah kebutuhan hampir tiap sidang. */
export function saranPtsp(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const n = Number(m.urutanSidang) || 1;
  const j = kunciJenisPerkara(m.jenisPerkara);
  const belumTercatat = m.dihadiriOleh === null || m.dihadiriOleh === undefined;
  const baru = n <= 1 && belumTercatat && m.ditunda !== true && m.sudahPutus !== true;
  const hasil: Rekomendasi[] = [];
  const tambah = (berkas: string, alasan: string, utama: boolean, perkiraan: boolean) => {
    if (hasil.some((x) => x.berkas === berkas)) return;
    hasil.push({
      jenis: "ptsp",
      folder: `${AKAR}/${FOLDER_PTSP_NAMA}`,
      berkas,
      menu: MENU_PTSP,
      alias: perluasAliasMenu(ALIAS_PTSP),
      label: LABEL_PTSP[berkas] ?? berkas.replace(/\.rtf$/i, ""),
      alasan,
      utama,
      perkiraan,
      keyakinan: perkiraan ? "perkiraan" : utama ? "pasti" : "cukup",
    });
  };

  if (m.sidangIkrarTalak === true && j === "cerai talak") {
    const lanjutan = m.ditunda === true || /lanjut|tunda|ditunda/i.test(teks);
    tambah(lanjutan ? PTSP.ikrarPhsLanjutan : PTSP.ikrarPhs, lanjutan ? "Sidang ikrar talak ditunda: penetapan hari sidang ikrar lanjutan." : "Sidang ikrar talak: penetapan hari sidang ikrar.", true, !lanjutan && m.ditunda !== true);
    tambah(lanjutan ? PTSP.ikrarPhs : PTSP.ikrarPhsLanjutan, "Varian penetapan hari sidang ikrar talak.", false, true);
    tambah(PTSP.ikrarPmhPhs, "Penetapan majelis dan hari sidang ikrar talak bila majelis berganti.", false, true);
    return hasil;
  }
  if (/mediasi/i.test(teks) && !/laporan|berhasil|gagal/i.test(teks)) {
    tambah(PTSP.mediator, "Sidang beragenda mediasi: penetapan penunjukan mediator.", true, false);
    tambah(PTSP.phs, "Penetapan hari sidang berikutnya sesudah mediasi.", false, true);
    return hasil;
  }

  const butuh: Array<[string, string]> = [];
  if (m.majelisAda === false) butuh.push([PTSP.pmh, "Majelis hakim perkara ini belum tertunjuk."]);
  if (m.paniteraAda === false) butuh.push([PTSP.ppp, "Panitera pengganti perkara ini belum tertunjuk."]);
  if (m.jurusitaAda === false) butuh.push([PTSP.pjs, "Juru sita perkara ini belum tertunjuk."]);
  butuh.forEach(([berkas, alasan], i) => tambah(berkas, alasan, i === 0, false));
  if (!butuh.length && baru) tambah(PTSP.gabungan, "Perkara baru menuju sidang pertama: penetapan majelis hakim dan hari sidang.", true, true);
  const phsPasti = m.ditunda === true;
  tambah(
    PTSP.phs,
    phsPasti ? `Sidang ke-${n} ditunda: penetapan hari sidang berikutnya.` : `Penetapan hari sidang untuk sidang lanjutan perkara ini bila sidang ke-${n} ditunda.`,
    !hasil.length,
    !phsPasti
  );
  if (m.bersita === true) {
    tambah(PTSP.phsSitaKabul, "Perkara bersita: penetapan hari sidang bila sita dikabulkan.", false, true);
    tambah(PTSP.phsSitaTolak, "Perkara bersita: penetapan hari sidang bila sita ditolak.", false, true);
  }
  tambah(PTSP.pmh, "Penetapan majelis hakim bila majelis berganti.", false, true);
  tambah(PTSP.ppp, "Penunjukan panitera pengganti bila berganti.", false, true);
  tambah(PTSP.pjs, "Penunjukan juru sita bila berganti.", false, true);
  if (!hasil.some((x) => x.berkas === PTSP.gabungan)) tambah(PTSP.gabungan, "Penetapan majelis hakim dan hari sidang sekaligus.", false, true);
  return hasil;
}

// ---------------------------------------------------------------------------
// Gabungan
// ---------------------------------------------------------------------------

const tanda = (r: Rekomendasi): Rekomendasi => (r.keyakinan ? r : { ...r, keyakinan: r.perkiraan ? "perkiraan" : r.utama ? "pasti" : "cukup" });

/**
 * rekomendasiBlangko + pelengkap: kategori yang kosong diisi saran perkiraan, PTSP ditambahkan, dan tiap saran diberi tingkat keyakinan.
 * Saran yang sudah ada tidak diubah isinya (hanya diberi `keyakinan`).
 */
export function saranBlangkoLengkap(m: MasukanRekomendasi): HasilRekomendasi {
  const dasar = rekomendasiBlangko(m);
  const { teks } = teksDasarSidang(m);
  const hasil: HasilRekomendasi = { ...dasar, ptsp: [] };
  if (!String(m.jenisPerkara ?? "").trim()) return hasil;
  const bantu: MasukanRekomendasi = { ...m };
  try {
    hasil.putusan = dasar.putusan.length ? dasar.putusan : saranPutusanCadangan(bantu, teks);
  } catch {
    hasil.putusan = dasar.putusan;
  }
  try {
    hasil.relaas = dasar.relaas.length ? dasar.relaas : saranRelaasCadangan(bantu, teks);
  } catch {
    hasil.relaas = dasar.relaas;
  }
  try {
    hasil.ptsp = saranPtsp(bantu, teks);
  } catch {
    hasil.ptsp = [];
  }
  hasil.bas = hasil.bas.map(tanda);
  hasil.putusan = hasil.putusan.map(tanda);
  hasil.relaas = hasil.relaas.map(tanda);
  return hasil;
}
