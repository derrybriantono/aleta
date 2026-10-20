import { BATAS, dalamJendela, isoDariMs, jedaAcak, msDariIso, msKeWita, type PilihanJamKerja, type StatusLangkah, hhmmSah } from "@/lib/putusan-terjadwal";
import { type AletaDatabase } from "@/server/db/client";
import { kenaliBentukNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { tautanSippPerkara } from "@/server/modules/aleta-ecourt/sipp-tautan";
import { unggahNaskahPutusan } from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";

import { sha256 } from "./berkas";
import {
  bacaButir,
  bacaPengaturan,
  catatJejak,
  akunSippSama,
  langkahDariBaris,
  pilihanDariBaris,
  sebaris,
  ubahButir,
  type BarisButir,
  type BarisJadwal,
  type PerubahanButir,
} from "./dasar";
import { akhiriBilaSelesai, depsAsli, masihDalamJeda, pulihkanMacet, type DepsPelaksana } from "./pelaksana";
import { type Pelaku } from "./layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * SISI PERAMBAN UNGGAH PUTUSAN TERJADWAL - ISI & SIMPAN PUTUSAN AKHIR (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Formulir Putusan Akhir SIPP hanya dapat diisi dan disimpan dari halamannya
 * sendiri (pilihan yang disaring SIPP, praperiksa, bukti simpan dari SIPP),
 * jadi langkah "isi & simpan" dikerjakan EKSTENSI di peramban petugas yang
 * terbuka - bukan penulis SIPP baru di server. Layanan ini hanya memberi
 * ekstensi giliran, menyiapkan draf dari berkas yang dipasang, dan menerima
 * laporannya:
 *
 *   giliran   butir yang jatuh tempo untuk penjadwal ini, atas akun SIPP yang
 *             SAMA dengan yang sedang masuk di peramban, di dalam jendela kerja
 *             jadwalnya, dan tidak terlalu rapat dengan butir sebelumnya;
 *   klaim     satu butir dipegang satu peramban (masa pegang 10 menit);
 *   draf      berkas dipasang menjadi draf putusan (isi yang sama dengan e-Doc);
 *   lapor     selesai / sudah terisi / tertahan / gagal - dasar kemajuan e-Doc;
 *   lepas     dikembalikan tanpa dikerjakan (akun beda, halaman tak terbuka).
 *
 * Hak: pemilik jadwal sendiri (tidak ada yang menjalankan jadwal orang lain
 * dari peramban), dan akunnya masih berhak unggah putusan.
 */

const MASA_PEGANG_MS = BATAS.masaPegangDetik * 1000;

function jendela(j: BarisJadwal | undefined): PilihanJamKerja {
  return {
    ...(j?.jam_dari && hhmmSah(j.jam_dari) ? { dari: j.jam_dari } : {}),
    ...(j?.jam_sampai && hhmmSah(j.jam_sampai) ? { sampai: j.jam_sampai } : {}),
    malamBoleh: j?.malam_boleh === 1,
  };
}

export type GiliranPeramban =
  | {
      ada: true;
      butir: {
        id: string;
        perkaraId: string;
        nomorPerkara: string;
        akunSipp: string;
        pilihan: ReturnType<typeof pilihanDariBaris>;
        adaBerkas: boolean;
        berkasNama: string;
        langkah: { putusan: boolean; anonim: boolean };
        waktuRencana: string;
      };
      tautan: { alamat: string; alasan: string };
    }
  | { ada: false; menunggu: number; berikutnya: string; berikutnyaWita: string; alasan: string; akunLain?: string[] };

/** Butir milik penjadwal ini yang langkah isinya menunggu - bahan giliran, dihitung per detak ekstensi. */
export async function giliranPeramban(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { akunSipp?: string },
  deps: Pick<DepsPelaksana, "sekarang" | "muatLibur"> & { tautan?: typeof tautanSippPerkara } = depsAsli()
): Promise<GiliranPeramban> {
  const kini = deps.sekarang();
  const iso = kini.toISOString();
  await pulihkanMacet(db, kini);
  const baris = await db.queryAll<BarisButir>(
    `SELECT * FROM aleta_putusan_jadwal_butir
      WHERE pemilik_id = ? AND status = 'menunggu' AND langkah_isi = 1 AND status_isi = 'menunggu'
      ORDER BY waktu_rencana ASC, urut ASC LIMIT 60`,
    [pelaku.actor.id]
  );
  if (baris.length === 0) return { ada: false, menunggu: 0, berikutnya: "", berikutnyaWita: "", alasan: "tidak_ada" };
  const libur = await deps.muatLibur(db);
  const jatuhTempo = baris.filter((b) => b.waktu_rencana <= iso && (b.tunggu_sampai === "" || b.tunggu_sampai <= iso));
  const berikutnya = baris.find((b) => b.waktu_rencana > iso) ?? null;
  const akunLain = new Set<string>();
  let alasan = berikutnya ? "belum_waktunya" : "tidak_ada";
  for (const b of jatuhTempo) {
    if (masukan.akunSipp && !akunSippSama(masukan.akunSipp, b)) {
      akunLain.add(b.akun_sipp);
      alasan = "akun_beda";
      continue;
    }
    const j = await db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [b.jadwal_id]);
    if (!j || j.status === "dibatalkan") continue;
    if (!dalamJendela(kini.getTime(), jendela(j), libur)) {
      alasan = "di_luar_jam_kerja";
      continue;
    }
    if (await masihDalamJeda(db, b.pemilik_id, j.jeda_min, kini)) {
      alasan = "jeda";
      continue;
    }
    const t = await (deps.tautan ?? tautanSippPerkara)({ perkaraId: b.perkara_id, nomor: b.nomor_perkara });
    return {
      ada: true,
      butir: {
        id: b.id,
        perkaraId: b.perkara_id,
        nomorPerkara: b.nomor_perkara,
        akunSipp: b.akun_sipp,
        pilihan: pilihanDariBaris(b),
        adaBerkas: b.berkas_jalur !== "",
        berkasNama: b.berkas_nama,
        langkah: { putusan: b.langkah_putusan === 1, anonim: b.langkah_anonim === 1 },
        waktuRencana: b.waktu_rencana,
      },
      tautan: { alamat: t.alamat, alasan: t.alasan },
    };
  }
  const waktu = berikutnya ? msDariIso(berikutnya.waktu_rencana) : Number.NaN;
  return {
    ada: false,
    menunggu: jatuhTempo.length,
    berikutnya: berikutnya?.waktu_rencana ?? "",
    berikutnyaWita: Number.isFinite(waktu) ? msKeWita(waktu).slice(0, 16) : "",
    alasan,
    ...(akunLain.size ? { akunLain: [...akunLain] } : {}),
  };
}

function pemegang(pelaku: Pelaku) {
  return `peramban:${pelaku.actor.id}`;
}

async function butirMilik(db: AletaDatabase, pelaku: Pelaku, id: string): Promise<BarisButir> {
  const b = await bacaButir(db, String(id ?? ""));
  if (!b) throw new ApiError(404, "Perkara dalam jadwal tidak ditemukan.");
  if (b.pemilik_id !== pelaku.actor.id) throw new ApiError(403, "Jadwal ini milik pengguna lain; hanya penjadwalnya yang dapat menjalankan pengisian dari peramban.");
  return b;
}

export async function klaimPeramban(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { id: string; akunSipp?: string },
  deps: Pick<DepsPelaksana, "sekarang" | "muatLibur"> = depsAsli()
): Promise<{ ok: true; masaPegangDetik: number } | { ok: false; alasan: string; sebab: string }> {
  const kini = deps.sekarang();
  const b = await butirMilik(db, pelaku, masukan.id);
  if (b.status !== "menunggu" || b.langkah_isi !== 1 || b.status_isi !== "menunggu") {
    return { ok: false, alasan: "bukan_giliran", sebab: "Perkara ini sedang atau sudah dikerjakan." };
  }
  if (masukan.akunSipp && !akunSippSama(masukan.akunSipp, b)) {
    return { ok: false, alasan: "akun_beda", sebab: `Jadwal ini atas akun SIPP ${b.akun_sipp}; masuk SIPP dengan akun itu.` };
  }
  const j = await db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [b.jadwal_id]);
  if (!j || j.status === "dibatalkan") return { ok: false, alasan: "dibatalkan", sebab: "Jadwal ini sudah dibatalkan." };
  if (b.waktu_rencana > kini.toISOString()) return { ok: false, alasan: "belum_waktunya", sebab: "Belum waktunya." };
  const libur = await deps.muatLibur(db);
  if (!dalamJendela(kini.getTime(), jendela(j), libur)) return { ok: false, alasan: "di_luar_jam_kerja", sebab: "Di luar jam kerja yang dipilih." };
  if (await masihDalamJeda(db, b.pemilik_id, j.jeda_min, kini)) return { ok: false, alasan: "jeda", sebab: "Menunggu jeda dari perkara sebelumnya." };

  const klaim: PerubahanButir = {
    isi: { status: "jalan", catatan: "Dikerjakan ekstensi di peramban Anda…" },
    lain: { klaim_oleh: pemegang(pelaku), klaim_sampai: isoDariMs(kini.getTime() + MASA_PEGANG_MS), mulai_pada: b.mulai_pada || kini.toISOString(), tunggu_sampai: "" },
  };
  const baru = await ubahButir(db, b.id, klaim, { kini, syaratStatus: ["menunggu"] });
  if (!baru) return { ok: false, alasan: "bukan_giliran", sebab: "Perkara ini baru saja diambil pekerjaan lain." };
  await catatJejak(db, {
    jadwalId: b.jadwal_id,
    butirId: b.id,
    nomorPerkara: b.nomor_perkara,
    peristiwa: "diklaim-peramban",
    pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`,
    pelakuId: pelaku.actor.id,
    akunSipp: b.akun_sipp,
    hasil: "",
    ringkas: `${b.nomor_perkara}: pengisian Putusan Akhir dimulai di peramban pada waktunya (jadwal ${b.waktu_rencana})`,
    kini,
  });
  return { ok: true, masaPegangDetik: BATAS.masaPegangDetik };
}

export type DepsDraf = Pick<DepsPelaksana, "sekarang" | "bacaBerkas" | "ubahKeRtf"> & {
  buatDraf?: typeof unggahNaskahPutusan;
};

/** Memasang berkas yang dijadwalkan menjadi draf putusan ALETA (sumber isi formulir). */
export async function siapkanDraf(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { id: string },
  deps: DepsDraf = depsAsli()
): Promise<{ ok: true; versi: number; dariDraf: boolean; bagian: Array<{ judul: string; aksara: number }> } | { ok: false; sebab: string }> {
  const b = await butirMilik(db, pelaku, masukan.id);
  if (b.klaim_oleh !== pemegang(pelaku) || b.status !== "jalan") return { ok: false, sebab: "Butir ini tidak sedang Anda pegang; ambil giliran dulu." };
  const kini = deps.sekarang();
  if (!b.berkas_jalur) {
    const ada = await db.queryOne<{ versi: number }>("SELECT versi FROM aleta_putusan_draf WHERE nomor_perkara = ? AND keadaan <> 'dibatalkan' ORDER BY versi DESC LIMIT 1", [b.nomor_perkara]);
    if (!ada) return { ok: false, sebab: "Belum ada berkas yang dipasang maupun draf putusan ALETA untuk perkara ini." };
    return { ok: true, versi: Number(ada.versi), dariDraf: true, bagian: [] };
  }
  let bita = await deps.bacaBerkas(b.berkas_jalur);
  if (!bita) return { ok: false, sebab: "Berkas putusan tidak ada lagi di penyimpanan; jadwalkan ulang dengan berkas yang diseret lagi." };
  if (b.berkas_sha256 && sha256(bita) !== b.berkas_sha256) return { ok: false, sebab: "Isi berkas berubah sejak diunggah (sidik jari tidak sama); tidak dipakai." };
  if (kenaliBentukNaskah(bita) !== "rtf") {
    const u = await deps.ubahKeRtf(bita, b.berkas_nama || "putusan");
    if (!u.ok) return { ok: false, sebab: `Berkas ${b.berkas_bentuk.toUpperCase()} tidak dapat diubah menjadi RTF (${sebaris(u.sebab, 160)}).` };
    bita = u.bita;
  }
  const h = await (deps.buatDraf ?? unggahNaskahPutusan)(db, pelaku.actor.id, {
    bita,
    namaBerkas: b.berkas_nama || "putusan.rtf",
    perkaraId: b.perkara_id,
    nomorPerkara: b.nomor_perkara,
  });
  if (!h.ok || !h.versi) return { ok: false, sebab: sebaris(h.sebab || "Naskah tidak dapat dijadikan draf putusan.", 400) };
  await catatJejak(db, {
    jadwalId: b.jadwal_id,
    butirId: b.id,
    nomorPerkara: b.nomor_perkara,
    peristiwa: "draf-disiapkan",
    pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`,
    pelakuId: pelaku.actor.id,
    akunSipp: b.akun_sipp,
    hasil: "ok",
    ringkas: `${b.nomor_perkara}: draf versi ${h.versi} dari berkas "${b.berkas_nama}"`,
    kini,
  });
  return { ok: true, versi: Number(h.versi), dariDraf: false, bagian: (h.bagian ?? []).map((x) => ({ judul: x.judul, aksara: x.aksara })) };
}

export type HasilLaporan = "selesai" | "dilewati" | "tertahan" | "gagal";

export async function laporPeramban(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { id: string; hasil: HasilLaporan; catatan?: string },
  deps: Pick<DepsPelaksana, "sekarang" | "acak"> = depsAsli()
): Promise<{ ok: true; status: string; edocSesudah: string }> {
  const kini = deps.sekarang();
  const b = await butirMilik(db, pelaku, masukan.id);
  if (b.klaim_oleh !== pemegang(pelaku) || b.status !== "jalan") throw new ApiError(409, "Butir ini tidak sedang Anda pegang (masa pegang habis atau sudah dilepas).");
  const hasil: HasilLaporan = (["selesai", "dilewati", "tertahan", "gagal"] as const).includes(masukan.hasil) ? masukan.hasil : "gagal";
  const catatan = sebaris(masukan.catatan, 400) || (hasil === "selesai" ? "Putusan Akhir tersimpan di SIPP." : hasil === "dilewati" ? "Putusan Akhir sudah terisi di SIPP - tidak ditimpa." : "");
  const langkah = langkahDariBaris(b);
  const perubahan: PerubahanButir = { isi: { status: hasil as StatusLangkah, catatan }, lain: { klaim_oleh: "", klaim_sampai: "" } };
  let edocSesudah = "";
  if (hasil === "selesai" || hasil === "dilewati") {
    // e-Doc menyusul 30-150 detik kemudian, seperti petugas yang mengunggah sesudah menyimpan.
    const tunda = isoDariMs(kini.getTime() + jedaAcak(30, 150, deps.acak) * 1000);
    edocSesudah = tunda;
    perubahan.lain = { ...perubahan.lain, edoc_sesudah: tunda };
  } else {
    // Tanpa Putusan Akhir terisi, e-Doc tidak dapat dikerjakan: ditahan, dilanjutkan lewat "Ulangi".
    const sebab = hasil === "tertahan" ? "Menunggu Putusan Akhir terisi (pengisian ditahan)." : "Menunggu Putusan Akhir terisi (pengisian gagal).";
    for (const k of ["putusan", "anonim"] as const) if (langkah[k] === "menunggu") perubahan[k] = { status: "tertahan", catatan: sebab };
  }
  const baru = await ubahButir(db, b.id, perubahan, { kini, syaratStatus: ["jalan"], syaratKlaim: pemegang(pelaku) });
  if (!baru) throw new ApiError(409, "Butir ini baru saja berubah; muat ulang.");
  await catatJejak(db, {
    jadwalId: b.jadwal_id,
    butirId: b.id,
    nomorPerkara: b.nomor_perkara,
    peristiwa: "isi-putusan",
    pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`,
    pelakuId: pelaku.actor.id,
    akunSipp: b.akun_sipp,
    hasil: hasil === "selesai" ? "ok" : hasil === "dilewati" ? "dilewati" : hasil,
    ringkas: `${b.nomor_perkara}: isi & simpan Putusan Akhir - ${hasil}${catatan ? ` (${catatan})` : ""}`,
    rinci: { ip: b.ip },
    kini,
  });
  const pengaturan = await bacaPengaturan(db);
  const akhir = await akhiriBilaSelesai(db, baru, { kini, pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`, pelakuId: pelaku.actor.id, pengaturan });
  return { ok: true, status: akhir.status, edocSesudah };
}

export async function lepasPeramban(
  db: AletaDatabase,
  pelaku: Pelaku,
  masukan: { id: string; tundaDetik?: number; sebab?: string; hitung?: boolean },
  deps: Pick<DepsPelaksana, "sekarang"> = depsAsli()
): Promise<{ ok: true }> {
  const kini = deps.sekarang();
  const b = await butirMilik(db, pelaku, masukan.id);
  if (b.klaim_oleh !== pemegang(pelaku) || b.status !== "jalan") return { ok: true };
  const tunda = Math.min(Math.max(Math.round(Number(masukan.tundaDetik) || 120), 30), 3600);
  const percobaan = b.percobaan + (masukan.hitung ? 1 : 0);
  const lewat = percobaan >= BATAS.percobaanMaks;
  const sebab = sebaris(masukan.sebab, 300) || "Dikembalikan tanpa dikerjakan.";
  await ubahButir(
    db,
    b.id,
    {
      isi: { status: lewat ? "gagal" : "menunggu", catatan: lewat ? `Gagal setelah ${percobaan} percobaan: ${sebab}` : sebab },
      lain: { klaim_oleh: "", klaim_sampai: "", percobaan, tunggu_sampai: isoDariMs(kini.getTime() + tunda * 1000) },
    },
    { kini, syaratStatus: ["jalan"], syaratKlaim: pemegang(pelaku) }
  );
  await catatJejak(db, {
    jadwalId: b.jadwal_id,
    butirId: b.id,
    nomorPerkara: b.nomor_perkara,
    peristiwa: "dilepas-peramban",
    pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`,
    pelakuId: pelaku.actor.id,
    akunSipp: b.akun_sipp,
    hasil: "tertahan",
    ringkas: `${b.nomor_perkara}: ${sebab}`,
    kini,
  });
  if (lewat) {
    const baru = await bacaButir(db, b.id);
    if (baru) await akhiriBilaSelesai(db, baru, { kini, pelaku: `peramban: ${sebaris(pelaku.actor.name, 120)}`, pelakuId: pelaku.actor.id, pengaturan: await bacaPengaturan(db) });
  }
  return { ok: true };
}
