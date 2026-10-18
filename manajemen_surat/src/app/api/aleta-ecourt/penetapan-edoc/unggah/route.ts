import { type NextRequest } from "next/server";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  JENIS_PENETAPAN,
  type JenisPenetapan,
  kalimatEdoc,
  pilihCap,
  unggahEdoc,
} from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { aturUntukBot, jenisPetaSah, kalimatPeringatanPenetapan } from "@/lib/peta-penetapan";
import { petaPenetapanBerlaku } from "@/server/modules/aleta-ecourt/peta-penetapan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Satu berkas manual paling besar 20 MB (sama dengan unggah putusan). */
const BATAS_MANUAL_BYTE = 20 * 1024 * 1024;

type Badan = {
  nomorPerkara: string;
  perkaraId: string;
  jenis: JenisPenetapan[];
  manual: Array<{ jenis: JenisPenetapan; isiBase64: string; ukuran: number }>;
  /** RTF blangko ABT yang dicetak ekstensi (perbaikan 6 Okt, butir 17). */
  abt: Array<{ jenis: JenisPenetapan; isiBase64: string; ukuran: number; berkas: string }>;
  /** Dikirim ekstensi sesudah penetapan TERTULIS (bukan tombol). */
  otomatis: boolean;
  capId: Record<string, string>;
  olehUsername: string;
  passphrase: string;
  nik: string;
  kering: boolean | undefined;
  konfirmasi: boolean;
};

const sahJenis = (x: unknown): x is JenisPenetapan =>
  JENIS_PENETAPAN.includes(String(x).toLowerCase() as JenisPenetapan);
const keJenis = (x: unknown) => String(x).toLowerCase() as JenisPenetapan;
const benar = (x: unknown) => x === true || String(x).toLowerCase() === "true" || String(x) === "1";

/**
 * Membaca badan dalam DUA bentuk yang dipakai panel SIPP (agen S):
 *
 *   JSON (otomatis dari ABT):
 *     { nomorPerkara, jenis: ["PMH",...], sumber: "abt", passphrase, konfirmasi: true }
 *     (+ opsional perkaraId, olehUsername, capId{jenis:id}, nik, kering,
 *        manual: [{jenis, isiBase64}])
 *   FormData (manual):
 *     nomorPerkara, sumber=manual, konfirmasi, passphrase, jenis (berulang),
 *     berkas_<JENIS> (berkas), (+ opsional olehUsername, nik, kering)
 *
 * Kode jenis besar atau kecil sama saja.
 */
async function bacaBadan(request: NextRequest): Promise<Badan> {
  const jenisKonten = String(request.headers.get("content-type") ?? "");
  if (jenisKonten.includes("multipart/form-data")) {
    const f = await request.formData();
    const ambil = (k: string) => String(f.get(k) ?? "");
    const jenisManual = [...new Set(f.getAll("jenis").map(keJenis))].filter(sahJenis);
    const manual: Badan["manual"] = [];
    for (const j of JENIS_PENETAPAN) {
      const berkas = f.get(`berkas_${j.toUpperCase()}`) ?? f.get(`berkas_${j}`);
      if (!(berkas instanceof File) || berkas.size === 0) continue;
      if (jenisManual.length && !jenisManual.includes(j)) continue;
      manual.push({
        jenis: j,
        // 18 Okt 2026 (butir 18): grup RTF tersembunyi {*isianasal ...} tidak ikut ke SIPP.
        isiBase64: Buffer.from(buangGrupTersembunyiRtf(new Uint8Array(await berkas.arrayBuffer()))).toString("base64"),
        ukuran: berkas.size,
      });
    }
    const keringMentah = f.get("kering");
    return {
      nomorPerkara: ambil("nomorPerkara"),
      perkaraId: ambil("perkaraId"),
      // FormData = unggahan manual; jenis yang disebut TANPA berkas tidak
      // diambil dari ABT diam-diam.
      jenis: ambil("sumber") === "abt" ? jenisManual : [],
      manual,
      abt: [],
      otomatis: false,
      capId: {},
      olehUsername: ambil("olehUsername"),
      passphrase: ambil("passphrase"),
      nik: ambil("nik"),
      kering: keringMentah === null ? undefined : benar(keringMentah),
      konfirmasi: benar(f.get("konfirmasi")),
    };
  }
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const manual: Badan["manual"] = [];
  for (const m of Array.isArray(b.manual) ? (b.manual as Array<Record<string, unknown>>) : []) {
    const isi = String(m?.isiBase64 ?? "");
    if (!sahJenis(m?.jenis) || !isi) continue;
    manual.push({ jenis: keJenis(m.jenis), isiBase64: isi, ukuran: Math.floor((isi.length * 3) / 4) });
  }
  const abt: Badan["abt"] = [];
  for (const m of Array.isArray(b.abt) ? (b.abt as Array<Record<string, unknown>>) : []) {
    const isi = String(m?.isiBase64 ?? "");
    if (!sahJenis(m?.jenis) || !isi) continue;
    abt.push({
      jenis: keJenis(m.jenis),
      isiBase64: isi,
      ukuran: Math.floor((isi.length * 3) / 4),
      berkas: String(m?.berkas ?? "").slice(0, 160),
    });
  }
  const passphrase = typeof b.passphrase === "string" ? b.passphrase : "";
  b.passphrase = "";
  return {
    nomorPerkara: String(b.nomorPerkara ?? ""),
    perkaraId: String(b.perkaraId ?? ""),
    jenis: [...new Set((Array.isArray(b.jenis) ? b.jenis : []).map(keJenis))].filter(sahJenis),
    manual,
    abt,
    otomatis: b.otomatis === true,
    capId: b.capId && typeof b.capId === "object" ? (b.capId as Record<string, string>) : {},
    olehUsername: String(b.olehUsername ?? ""),
    passphrase,
    nik: String(b.nik ?? ""),
    kering: typeof b.kering === "boolean" ? b.kering : undefined,
    konfirmasi: b.konfirmasi === true,
  };
}

/**
 * UNGGAH EDOC PENETAPAN (butir 17, K6) - lihat bacaBadan untuk bentuknya.
 *
 * KERING: bila `kering` tidak disebut, permintaan yang membawa
 * konfirmasi:true MENULIS, tanpa konfirmasi hanya kering (rencana). kering:false
 * tanpa konfirmasi ditolak sebelum bot dipanggil.
 *
 * Identitas pengguna ALETA dari SESI, tidak pernah dari badan. Akun SIPP yang
 * tercatat = olehUsername (bila dikirim panel) atau akun SIPP yang namanya sama
 * dengan pengguna ALETA yang login (dicocokkan bot ke sys_users).
 *
 * Passphrase diteruskan sekali, tidak disimpan/dicatat, dan disapu dari
 * jawaban. Jejak jujur: audit_logs (siapa + IP + lewat ALETA) di sini, dan
 * aleta_bot_jejak_penetapan di bot. Di SIPP tidak ada tanda ALETA.
 *
 * Jawaban: { ok, kering, alasan, pesan, berkas:[{jenis, ok, sebab}], hasil:[...] }.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let passphrase = "";
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "penunjukan");
    const badan = await bacaBadan(request);
    passphrase = badan.passphrase;
    badan.passphrase = "";
    const sapu = (t: unknown) => (passphrase ? String(t ?? "").split(passphrase).join("***") : String(t ?? ""));
    const tolak = (alasan: string, pesan = kalimatEdoc(alasan)) =>
      ok({ ok: false, alasan, pesan, sebab: pesan, berkas: [] });

    const nomorPerkara = badan.nomorPerkara.trim().slice(0, 120);
    const perkaraId = badan.perkaraId.trim().slice(0, 20);
    if (!nomorPerkara && !perkaraId) return tolak("nomor_kosong", "Nomor perkara belum disebut.");
    const kering = badan.kering === undefined ? !badan.konfirmasi : badan.kering;
    if (!kering && !badan.konfirmasi) return tolak("konfirmasi_belum_diberikan");

    const besar = [...badan.manual, ...badan.abt].find((m) => m.ukuran > BATAS_MANUAL_BYTE);
    if (besar) return tolak("berkas_terlalu_besar", `Berkas ${besar.jenis.toUpperCase()} melampaui 20 MB.`);

    // ========================================================================
    // PETA PENETAPAN (butir 19-20): pengaturan ttd/cap per jenis, dan
    // penjaga UNGGAH OTOMATIS - kiriman otomatis yang MENULIS hanya untuk
    // jenis yang dinyalakan admin (aktif + otomatisUnggah). Jenis lain
    // dibuang dari kiriman beserta sebabnya, tidak ditulis diam-diam.
    // ========================================================================
    const peta = new Map((await petaPenetapanBerlaku(db)).map((b) => [b.jenis, b]));
    const ditolakOtomatis: Array<{ jenis: JenisPenetapan; alasan: string }> = [];
    if (badan.otomatis && !kering) {
      badan.abt = badan.abt.filter((x) => {
        const a = jenisPetaSah(x.jenis) ? peta.get(x.jenis) : undefined;
        const boleh = Boolean(a && a.aktif && a.otomatisUnggah);
        if (!boleh) ditolakOtomatis.push({ jenis: x.jenis, alasan: "otomatis_unggah_mati" });
        return boleh;
      });
      // Kiriman otomatis hanya membawa RTF ABT; jenis/manual tidak ikut.
      badan.jenis = [];
      badan.manual = [];
      if (!badan.abt.length) {
        const pesan = kalimatEdoc("otomatis_unggah_mati");
        return ok({
          ok: false,
          alasan: "otomatis_unggah_mati",
          pesan,
          sebab: pesan,
          berkas: ditolakOtomatis.map((x) => ({ jenis: x.jenis.toUpperCase(), ok: false, sebab: pesan })),
        });
      }
    }
    if (!badan.jenis.length && !badan.manual.length && !badan.abt.length) return tolak("tidak_ada_jenis_dipilih");

    const semuaJenis = new Set<JenisPenetapan>([...badan.jenis, ...badan.manual.map((m) => m.jenis), ...badan.abt.map((m) => m.jenis)]);
    const atur: Partial<Record<JenisPenetapan, Record<string, unknown>>> = {};
    // Cap per jenis - dari tabel cap portal (0056), HANYA bila peta jenis itu
    // memakai cap. Cap pilihan peta (capId) didahulukan, lalu pilihan badan,
    // lalu cap aktif terbaru sesuai peruntukan. Tanpa cap: bot menyusun
    // dokumen tanpa cap dan menyebutnya (peringatan cap_belum_ada).
    const cap: Partial<Record<JenisPenetapan, { id: string; nama: string; jenis: string; isiBase64: string }>> = {};
    for (const j of semuaJenis) {
      const a = peta.get(j);
      if (a) atur[j] = aturUntukBot(a);
      if (a && !a.pakaiCap) continue;
      const c = await pilihCap(db, j, (a && a.capId) || badan.capId?.[j] || badan.capId?.[j.toUpperCase()] || null);
      if (c) cap[j] = { id: c.id, nama: c.nama, jenis: c.jenisBerkas, isiBase64: c.isi.toString("base64") };
    }

    const ip = alamatIpPeramban(request);
    const olehUsername = badan.olehUsername.trim().slice(0, 60);
    const hasil = await unggahEdoc({
      nomorPerkara,
      perkaraId,
      jenis: badan.jenis,
      manual: badan.manual.map(({ jenis, isiBase64 }) => ({ jenis, isiBase64 })),
      abt: badan.abt.map(({ jenis, isiBase64, berkas }) => ({ jenis, isiBase64, berkas })),
      atur,
      otomatis: badan.otomatis,
      cap,
      penggunaId: actor.id,
      operator: actor.name,
      olehUsername,
      ip,
      ...(passphrase ? { passphrase, nik: badan.nik.trim().slice(0, 32) } : {}),
      kering,
    });
    const data = hasil.ok ? hasil.data : { ok: false, alasan: hasil.alasan };
    const daftarHasil = [
      ...("hasil" in data && Array.isArray(data.hasil) ? data.hasil : []).map((h) => {
        const pesan = sapu(kalimatEdoc(h.alasan));
        const peringatanTeks = (Array.isArray(h.peringatan) ? h.peringatan : []).map((p) => kalimatPeringatanPenetapan(String(p.kode), p.nama));
        return { ...h, alasan: sapu(h.alasan), pesan, sebab: pesan, peringatanTeks };
      }),
      ...ditolakOtomatis.map((x) => ({
        jenis: x.jenis,
        sumber: "abt",
        ok: false,
        alasan: x.alasan,
        pesan: kalimatEdoc(x.alasan),
        sebab: kalimatEdoc(x.alasan),
        peringatanTeks: [] as string[],
      })),
    ];
    const jawaban = {
      ok: Boolean(data.ok),
      kering,
      alasan: sapu(data.alasan),
      pesan: sapu(kalimatEdoc(data.alasan)),
      sebab: sapu(kalimatEdoc(data.alasan)),
      belumTersedia: !hasil.ok && Boolean(hasil.tidakAda),
      sebagian: Boolean("sebagian" in data && data.sebagian),
      perkara: "perkara" in data ? data.perkara : undefined,
      tte: "tte" in data ? data.tte : undefined,
      hasil: daftarHasil,
      // Bentuk yang dibaca panel SIPP (s2BacaHasilEdoc).
      berkas: daftarHasil.map((h) => ({
        jenis: String(h.jenis).toUpperCase(),
        ok: Boolean(h.ok),
        sebab: h.ok ? "" : h.sebab,
        peringatan: h.peringatanTeks,
        tandaTangan: "tandaTangan" in h && h.tandaTangan ? h.tandaTangan.namaPejabat : "",
      })),
    };

    // Jejak jujur portal: siapa + IP + lewat ALETA. TANPA passphrase.
    if (!kering) {
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "PENETAPAN_EDOC_UNGGAH",
        entityType: "perkara",
        entityId: nomorPerkara || perkaraId || "-",
        payload: {
          lewat: "ALETA",
          alamatIp: ip,
          akunSipp: olehUsername || "(dicocokkan dari nama pengguna)",
          otomatis: badan.otomatis,
          hasil: daftarHasil.map((h) => ({
            jenis: h.jenis,
            sumber: h.sumber,
            ok: h.ok,
            alasan: h.alasan,
            tte: "tte" in h ? Boolean(h.tte) : false,
            tandaTangan: "tandaTangan" in h && h.tandaTangan ? h.tandaTangan.namaPejabat : "",
            cap: "cap" in h && h.cap ? h.cap.nama || h.cap.id : "",
            peringatan: (("peringatan" in h && Array.isArray(h.peringatan) ? h.peringatan : []) as Array<{ kode: string }>).map((p) => p.kode),
          })),
          ok: jawaban.ok,
          alasan: jawaban.alasan,
        },
      }).catch(() => undefined);
    }
    passphrase = "";
    // Bot lama (rute belum ada) = 404, supaya panel menyebut "belum tersedia di server".
    return ok(jawaban, jawaban.belumTersedia ? { status: 404 } : undefined);
  } catch (error) {
    passphrase = "";
    // Galat asli sengaja tidak diteruskan: badan permintaan dapat memuat passphrase.
    return handleAdminRouteError(
      error instanceof ApiError ? error : new Error("Permintaan unggah edoc penetapan gagal diproses."),
      request,
      { db, actorUserId, action: "PENETAPAN_EDOC_UNGGAH_FAILED", feature: "aleta_ecourt", entityId: "penetapan-edoc-unggah" }
    );
  }
}
