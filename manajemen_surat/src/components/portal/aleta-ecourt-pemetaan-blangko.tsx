"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { KEADAAN_BAS_BAKU, kapanDipakai, normalkanKunci, uraiKunciBas, uraiKunciPutusan } from "@/lib/pemetaan-blangko";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pemetaan blangko - kartu admin Integrasi e-Court (butir 17, kontrak K3).
 *
 * Empat daftar: blangko PUTUSAN per jenis perkara (dan, sejak perbaikan 2 Okt
 * sore butir 3, per STATUS PUTUSAN - baris jenis dapat dibuka per status),
 * blangko RELAAS panggilan per keadaan/pihak, blangko PEMBERITAHUAN PUTUSAN
 * per pihak, dan blangko BERITA ACARA SIDANG (BAS) per jenis x sidang x
 * kehadiran (butir 6). Ekstensi (panel ABT/SIPP, tab Juru Sita, BAS massal)
 * membaca server lebih dulu - paling lama 1 menit sesudah disimpan, tanpa
 * Reload - lalu cadangan lokal peramban bila server tak terjangkau.
 *
 * Kolom "Dipakai saat" (butir 2): kapan ekstensi memakai baris itu, dihitung
 * dengan aturan yang SAMA dengan ekstensi (lib/pemetaan-blangko.ts). Kunci
 * buatan admin yang tidak dikenali tidak dibuang - ditandai.
 *
 * Semua pegawai dapat MEMBACA; hanya Super Admin dan Admin yang MENGUBAH.
 * Mengosongkan nama berkas = kembali ke bawaan / dihapus.
 */

type Jenis = "putusan" | "relaas" | "pbt" | "bas";

type Butir = {
  kunci: string;
  sebutan: string;
  namaBerkas: string;
  catatan: string;
  diubahPada: string | null;
  diubahOleh: string;
  sumber: "admin" | "bawaan";
};

type Jawaban = {
  jenis: Jenis;
  butir: Butir[];
  diubahPada: string | null;
  label: string;
  kunciBaku: { kunci: string; sebutan: string }[];
  saran: { kunci: string; namaBerkas: string; catatan: string }[];
  bolehMengubah: boolean;
  kapan?: Record<string, { dikenal: boolean; dipakai: string }>;
  statusPutusan?: string[];
  statusBerverstek?: string[];
};

type Baris = Butir & { saran?: string; anak?: boolean; induk?: string };

const ALAMAT = "/api/aleta-ecourt/pemetaan-blangko";
const TAB: { jenis: Jenis; label: string }[] = [
  { jenis: "putusan", label: "Putusan" },
  { jenis: "relaas", label: "Relaas panggilan" },
  { jenis: "pbt", label: "Pemberitahuan putusan" },
  { jenis: "bas", label: "Berita acara sidang (BAS)" },
];

const PETUNJUK_TAMBAH: Record<Jenis, string> = {
  putusan: "Jenis perkara lain (atau Jenis|Status)",
  relaas: "Kunci lain (mis. panggilan-kuasa)",
  pbt: "Kunci lain (mis. pbt-kuasa)",
  bas: "Jenis|sidang|kehadiran (mis. Cerai Gugat|2|p-hadir)",
};

function waktuSingkat(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function barisKosong(kunci: string, sebutan: string, tambahan: Partial<Baris> = {}): Baris {
  return { kunci, sebutan, namaBerkas: "", catatan: "", diubahPada: null, diubahOleh: "", sumber: "bawaan", ...tambahan };
}

/** Grup baris: putusan per jenis (status di bawahnya), BAS per jenis, relaas/PBT satu grup. */
function grupDari(jenis: Jenis, kunci: string): string {
  if (jenis === "putusan") return uraiKunciPutusan(kunci).jenis.toLowerCase();
  if (jenis === "bas") return uraiKunciBas(kunci).jenis.toLowerCase();
  return "";
}

export function AletaEcourtPemetaanBlangko() {
  const [jenis, setJenis] = useState<Jenis>("putusan");
  const [data, setData] = useState<Jawaban | null>(null);
  const [draf, setDraf] = useState<Record<string, { namaBerkas: string; catatan: string }>>({});
  const [kunciBaru, setKunciBaru] = useState("");
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({});
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");

  const muat = useCallback(async (j: Jenis) => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(`${ALAMAT}?jenis=${j}`), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca pemetaan blangko."));
      const d = (isi?.data ?? null) as Jawaban | null;
      setData(d);
      setDraf({});
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca pemetaan blangko.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(jenis), 0);
    return () => window.clearTimeout(timer);
  }, [muat, jenis]);

  /**
   * Baris layar: butir server + kunci baku yang belum ada + saran + draf.
   * Putusan: tiap jenis membawa baris status (anak) - kosong = ikut jenis.
   * BAS: tiap jenis membawa keadaan baku (anak).
   */
  const baris = useMemo(() => {
    if (!data) return [] as Baris[];
    const peta = new Map<string, Baris>();
    for (const b of data.butir) peta.set(b.kunci.toLowerCase(), { ...b });
    for (const k of data.kunciBaku) {
      if (!peta.has(k.kunci.toLowerCase())) peta.set(k.kunci.toLowerCase(), barisKosong(k.kunci, k.sebutan));
    }
    for (const k of Object.keys(draf)) {
      if (!peta.has(k.toLowerCase())) peta.set(k.toLowerCase(), barisKosong(k, k));
    }
    if (jenis === "putusan") {
      // Baris status di bawah tiap jenis (butir 3). Kunci "Jenis|Status[|verstek]".
      const daftarStatus = data.statusPutusan ?? [];
      const berverstek = new Set(data.statusBerverstek ?? []);
      for (const b of [...peta.values()]) {
        const u = uraiKunciPutusan(b.kunci);
        if (u.status) continue;
        for (const status of daftarStatus) {
          const varian = berverstek.has(status) ? [false, true] : [false];
          for (const verstek of varian) {
            const kunci = `${u.jenis}|${status}${verstek ? "|verstek" : ""}`;
            if (!peta.has(kunci.toLowerCase())) {
              peta.set(kunci.toLowerCase(), barisKosong(kunci, `${status}${verstek ? " (verstek)" : ""}`));
            }
          }
        }
      }
    }
    for (const s of data.saran) {
      const b = peta.get(s.kunci.toLowerCase());
      if (b && !b.namaBerkas) b.saran = s.namaBerkas;
    }
    const semua = [...peta.values()];
    if (jenis === "relaas" || jenis === "pbt") return semua;

    // Kelompokkan: induk (jenis saja / judul grup BAS) lalu anaknya.
    const hasil: Baris[] = [];
    const grup = new Map<string, Baris[]>();
    const urutGrup: string[] = [];
    for (const b of semua) {
      const g = grupDari(jenis, b.kunci);
      if (!grup.has(g)) {
        grup.set(g, []);
        urutGrup.push(g);
      }
      grup.get(g)!.push(b);
    }
    const urutKeadaan = (k: string) => {
      if (jenis === "bas") {
        const u = uraiKunciBas(k);
        const i = KEADAAN_BAS_BAKU.findIndex((x) => x.kunci === `${u.sidang}|${u.kehadiran}`);
        return i < 0 ? 999 : i;
      }
      const u = uraiKunciPutusan(k);
      const i = (data.statusPutusan ?? []).indexOf(u.status);
      return (i < 0 ? 999 : i) * 2 + (u.verstek ? 1 : 0);
    };
    for (const g of urutGrup) {
      const anggota = grup.get(g)!;
      if (jenis === "putusan") {
        const induk = anggota.find((b) => !uraiKunciPutusan(b.kunci).status);
        const anak = anggota.filter((b) => b !== induk).sort((a, b) => urutKeadaan(a.kunci) - urutKeadaan(b.kunci));
        // Status buatan admin tanpa baris jenisnya tetap punya induk untuk dibuka.
        const jenisNama = uraiKunciPutusan(anggota[0].kunci).jenis;
        hasil.push(induk ?? barisKosong(jenisNama, jenisNama));
        for (const a of anak) hasil.push({ ...a, anak: true, induk: g });
      } else {
        const judul = uraiKunciBas(anggota[0].kunci).jenis;
        hasil.push(barisKosong(`grup:${g}`, judul === "*" ? "Semua jenis perkara" : judul, { induk: "judul" }));
        for (const a of anggota.sort((x, y) => urutKeadaan(x.kunci) - urutKeadaan(y.kunci))) {
          // "Cerai Gugat - Sidang pertama - ..." -> "Sidang pertama - ..." di bawah judul grupnya.
          const sebutan = a.sebutan.startsWith(`${judul} - `) ? a.sebutan.slice(judul.length + 3) : a.sebutan;
          hasil.push({ ...a, sebutan, anak: true, induk: g });
        }
      }
    }
    return hasil;
  }, [data, draf, jenis]);

  const boleh = Boolean(data?.bolehMengubah);
  const adaPerubahan = Object.keys(draf).length > 0;

  const simpan = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      const butir = Object.entries(draf).map(([kunci, v]) => ({ kunci, namaBerkas: v.namaBerkas, catatan: v.catatan }));
      const jawaban = await fetch(apiPath(ALAMAT), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jenis, butir }),
      });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan pemetaan blangko."));
      setData(isi?.data ?? null);
      setDraf({});
      setKabar(`${butir.length} butir disimpan. Ekstensi memakainya paling lama 1 menit lagi, tanpa Reload.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan pemetaan blangko.");
    } finally {
      setSibuk(false);
    }
  }, [draf, jenis]);

  // 9 Okt 2026: mengubah CATATAN baris bawaan membawa nama berkas bawaannya
  // (yang tampak di kotaknya). Dulu draf mulai dari nama kosong, sehingga nama
  // menghilang dan Simpan mengirim perintah hapus - catatannya tidak tersimpan.
  const ubah = (kunci: string, bidang: "namaBerkas" | "catatan", nilai: string, asal: Butir) =>
    setDraf((lama) => ({
      ...lama,
      [kunci]: {
        namaBerkas:
          lama[kunci]?.namaBerkas ?? (asal.sumber === "admin" || bidang === "catatan" ? asal.namaBerkas : ""),
        catatan: lama[kunci]?.catatan ?? asal.catatan,
        [bidang]: nilai,
      },
    }));

  /** Jumlah anak grup yang diatur / dalam draf - ditulis di tombol buka. */
  const jumlahDiatur = (g: string) =>
    baris.filter((b) => b.anak && b.induk === g && (b.sumber === "admin" || (draf[b.kunci]?.namaBerkas ?? "").trim())).length;

  const tampak = (b: Baris) => !b.anak || Boolean(terbuka[`${jenis}:${b.induk}`]);

  return (
    <Card id="pemetaan-blangko" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Pemetaan blangko
          <Badge variant="muted">putusan · relaas · pemberitahuan putusan · BAS</Badge>
        </CardTitle>
        <CardDescription>
          Nama berkas blangko ABT yang dipakai ekstensi untuk tiap jenis perkara dan status putusan (putusan), tiap
          panggilan sidang (relaas), tiap pemberitahuan putusan per pihak, dan tiap berita acara sidang (BAS). Berlaku
          untuk semua peramban paling lama 1 menit sesudah disimpan, tanpa Reload ekstensi; peramban tanpa sambungan ke
          server memakai cadangan lokalnya. Mengosongkan nama berkas mengembalikan barisnya ke bawaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Jenis pemetaan">
          {TAB.map((t) => (
            <Button
              key={t.jenis}
              size="sm"
              role="tab"
              aria-selected={jenis === t.jenis}
              variant={jenis === t.jenis ? "default" : "outline"}
              onClick={() => setJenis(t.jenis)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {galat ? <p className="text-sm text-rose-600 dark:text-rose-400">{galat}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}
        {!boleh && data ? (
          <p className="text-xs text-muted-foreground">Hanya Super Admin dan Admin yang dapat mengubah pemetaan ini.</p>
        ) : null}
        {data && jenis === "putusan" ? (
          <p className="text-xs text-muted-foreground">
            Buka “Per status putusan” pada satu jenis untuk blangko khusus per status (daftar status dari SIPP). Status
            yang kosong memakai blangko jenisnya.
          </p>
        ) : null}
        {data && jenis === "bas" ? (
          <p className="text-xs text-muted-foreground">
            Untuk panitera sidang / panitera / panitera pengganti. Baris kosong: BAS massal memakai usulan otomatisnya
            (set blangko yang cocok dengan kehadiran di SIPP). Saran diambil dari katalog blangko BAS yang dibaca BAS
            massal.
          </p>
        ) : null}

        {data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1">
                    {jenis === "putusan" ? "Jenis perkara / status" : jenis === "bas" ? "Jenis / sidang / kehadiran" : "Keadaan / pihak"}
                  </th>
                  <th className="px-2 py-1">Nama berkas blangko ABT</th>
                  <th className="px-2 py-1">Catatan</th>
                  <th className="px-2 py-1">Asal</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => {
                  if (b.induk === "judul") {
                    const g = b.kunci.slice("grup:".length);
                    const buka = Boolean(terbuka[`${jenis}:${g}`]);
                    const n = jumlahDiatur(g);
                    return (
                      <tr key={b.kunci} className="border-t border-border">
                        <td className="px-2 py-1.5" colSpan={4}>
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            aria-expanded={buka}
                            onClick={() => setTerbuka((l) => ({ ...l, [`${jenis}:${g}`]: !buka }))}
                          >
                            {buka ? "▾" : "▸"} {b.sebutan}
                          </button>
                          <span className="ml-2 text-xs text-muted-foreground">{n ? `${n} diatur` : "otomatis"}</span>
                        </td>
                      </tr>
                    );
                  }
                  if (!tampak(b)) return null;
                  const d = draf[b.kunci];
                  const nama = d ? d.namaBerkas : b.namaBerkas;
                  const kapan = data.kapan?.[b.kunci] ?? kapanDipakai(jenis, normalkanKunci(jenis, b.kunci));
                  const g = grupDari(jenis, b.kunci);
                  const indukPutusan = jenis === "putusan" && !b.anak;
                  return (
                    <tr key={b.kunci} className="border-t border-border align-top" data-kunci={b.kunci}>
                      <td className={`px-2 py-1.5 ${b.anak ? "pl-6" : ""}`}>
                        <div className="font-medium">{b.sebutan}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{b.kunci}</div>
                        <div
                          className={`text-[11px] ${kapan.dikenal ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}
                          data-dipakai={kapan.dikenal ? "ya" : "tidak-dikenali"}
                        >
                          Dipakai saat: {kapan.dipakai}
                        </div>
                        {indukPutusan ? (
                          <button
                            type="button"
                            className="mt-0.5 text-[11px] text-primary underline"
                            aria-expanded={Boolean(terbuka[`${jenis}:${g}`])}
                            onClick={() => setTerbuka((l) => ({ ...l, [`${jenis}:${g}`]: !l[`${jenis}:${g}`] }))}
                          >
                            {terbuka[`${jenis}:${g}`] ? "Tutup status putusan" : "Per status putusan"}
                            {jumlahDiatur(g) ? ` (${jumlahDiatur(g)} diatur)` : ""}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={nama}
                          disabled={!boleh || sibuk}
                          placeholder={
                            b.saran
                              ? `saran: ${b.saran}`
                              : b.anak && jenis === "putusan"
                                ? "kosong = blangko jenisnya"
                                : jenis === "bas"
                                  ? "kosong = usulan otomatis BAS massal"
                                  : "nama berkas .rtf di ABT"
                          }
                          aria-label={`Nama berkas blangko ${b.sebutan}`}
                          onChange={(e) => ubah(b.kunci, "namaBerkas", e.target.value, b)}
                        />
                        {b.saran && boleh && !nama ? (
                          <button
                            type="button"
                            className="mt-0.5 text-[11px] text-primary underline"
                            onClick={() => ubah(b.kunci, "namaBerkas", b.saran!, b)}
                          >
                            {jenis === "bas" ? "Pakai saran dari katalog BAS" : "Pakai saran bawaan ekstensi"}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={d ? d.catatan : b.catatan}
                          disabled={!boleh || sibuk}
                          aria-label={`Catatan ${b.sebutan}`}
                          onChange={(e) => ubah(b.kunci, "catatan", e.target.value, b)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {b.sumber === "admin" ? (
                          <span title={`${b.diubahOleh} · ${waktuSingkat(b.diubahPada)}`}>
                            <Badge variant="success">diatur</Badge>
                          </span>
                        ) : b.namaBerkas ? (
                          <Badge variant="muted">bawaan</Badge>
                        ) : b.anak ? (
                          <Badge variant="outline">{jenis === "bas" ? "otomatis" : "ikut jenis"}</Badge>
                        ) : (
                          <Badge variant="outline">belum</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {boleh ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              value={kunciBaru}
              placeholder={PETUNJUK_TAMBAH[jenis]}
              aria-label="Tambah baris pemetaan"
              onChange={(e) => setKunciBaru(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!kunciBaru.trim()}
              onClick={() => {
                const k = kunciBaru.trim();
                setDraf((lama) => ({ ...lama, [k]: lama[k] ?? { namaBerkas: "", catatan: "" } }));
                // Baris baru di dalam grup tertutup langsung tampak.
                const g = grupDari(jenis, normalkanKunci(jenis, k));
                if (jenis !== "relaas" && jenis !== "pbt") setTerbuka((l) => ({ ...l, [`${jenis}:${g}`]: true }));
                setKunciBaru("");
              }}
            >
              Tambah baris
            </Button>
            <Button size="sm" disabled={!adaPerubahan || sibuk} onClick={() => void simpan()}>
              {sibuk ? "Menyimpan..." : "Simpan pemetaan"}
            </Button>
            {adaPerubahan ? (
              <Button size="sm" variant="ghost" disabled={sibuk} onClick={() => setDraf({})}>
                Batalkan perubahan
              </Button>
            ) : null}
          </div>
        ) : null}
        {data?.diubahPada ? (
          <p className="text-xs text-muted-foreground">Terakhir diubah {waktuSingkat(data.diubahPada)}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
