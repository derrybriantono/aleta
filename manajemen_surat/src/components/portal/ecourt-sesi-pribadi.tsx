"use client";

/**
 * Sesi e-Court SAYA - Integrasi e-Court (perbaikan 1 Okt 2026, E10).
 *
 * Tiap pengguna menyambungkan sesi e-Court AKUNNYA SENDIRI, per peran (Hakim,
 * Panitera, Panitera Pengganti, ...). Sesi inilah yang dipakai untuk
 * verifikasi e-litigasi, TTE salinan putusan, dan unggah salinan putusan.
 * Akun penarik data (admin pengadilan) TERPISAH - diatur di kartu "Akun
 * e-Court" untuk admin, dan tidak pernah dipakai untuk menulis atas nama orang.
 *
 * Sandi diketik di sini, diteruskan sekali ke formulir login e-Court, lalu
 * dibuang. Yang disimpan server hanya cookie sesi tersandi. Sesi habis = masuk
 * lagi dari kartu ini.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type Sesi = {
  peran: string;
  sebutanPeran: string;
  namaAkunEcourt: string;
  tersambungPada: string;
  terakhirDipakai: string;
  diperiksaPada: string;
  keadaan: "tersambung" | "kedaluwarsa" | "terputus";
  kedaluwarsaPada: string;
};

type Jejak = {
  id: string;
  aksi: string;
  peranEcourt: string;
  akunEcourt: string;
  nomorPerkara: string;
  hasil: string;
  alasan: string;
  dibuatPada: string;
};

type Data = {
  tersedia: boolean;
  pesan: string;
  sesi: Sesi[];
  peranTersedia: Array<{ kode: string; sebutan: string }>;
  jejak: Jejak[];
};

const SEBUT_AKSI: Record<string, string> = {
  sambung: "Sambung sesi",
  putus: "Putuskan sesi",
  periksa: "Periksa sesi",
  unduh: "Unduh dari e-Court",
  verifikasi: "Verifikasi dokumen",
  verifikasi_kering: "Periksa dialog verifikasi",
  tte: "TTE salinan putusan",
  unggah_salinan: "Unggah salinan putusan",
};

function waktu(iso: string) {
  if (!iso) return "-";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID");
}

async function baca<T>(r: Response): Promise<T | null> {
  const isi = (await r.json().catch(() => null)) as { data?: T } | null;
  return (isi && (isi.data ?? (isi as unknown as T))) || null;
}

export function EcourtSesiPribadi() {
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [peranLogin, setPeranLogin] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const surelRef = useRef<HTMLInputElement | null>(null);
  const sandiRef = useRef<HTMLInputElement | null>(null);
  const captchaRef = useRef<HTMLInputElement | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-sesi"), { cache: "no-store" });
      if (r.status === 404) {
        setData(null);
        setPesan("Fitur sesi e-Court pribadi belum tersedia di server.");
        return;
      }
      setData(await baca<Data>(r));
    } catch {
      setPesan("ALETA belum dapat dihubungi.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirimAksi = async (badan: Record<string, unknown>) => {
    const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-sesi"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badan),
    });
    return baca<{ ok: boolean; pesan?: string; alasan?: string; captcha?: string; namaAkunEcourt?: string; berlaku?: boolean }>(r);
  };

  const mulai = async (peran: string) => {
    setSibuk(true);
    setPesan("Membuka halaman login e-Court...");
    try {
      const d = await kirimAksi({ aksi: "mulai", peran });
      if (d?.ok) {
        setPeranLogin(peran);
        setCaptcha(d.captcha || "");
        setPesan("Isi surel, sandi, dan kode captcha akun e-Court Anda.");
      } else {
        setPesan(d?.pesan || "Halaman login e-Court belum dapat dibuka.");
      }
    } finally {
      setSibuk(false);
    }
  };

  const kirim = async () => {
    const email = surelRef.current?.value || "";
    const sandi = sandiRef.current?.value || "";
    const kode = captchaRef.current?.value || "";
    // Sandi tidak pernah masuk state; kolomnya dikosongkan begitu terkirim.
    if (sandiRef.current) sandiRef.current.value = "";
    setSibuk(true);
    setPesan("Masuk ke e-Court...");
    try {
      const d = await kirimAksi({ aksi: "kirim", peran: peranLogin, email, sandi, captcha: kode });
      if (d?.ok) {
        setPesan(`Tersambung${d.namaAkunEcourt ? ` sebagai ${d.namaAkunEcourt}` : ""}.`);
        setPeranLogin("");
        setCaptcha("");
        await muat();
      } else {
        setPesan(d?.pesan || "Login e-Court belum berhasil. Mulai lagi dengan captcha baru.");
        setPeranLogin("");
        setCaptcha("");
      }
    } finally {
      setSibuk(false);
    }
  };

  const periksaAtauPutus = async (aksi: "periksa" | "keluar", peran: string) => {
    if (aksi === "keluar" && !window.confirm("Putuskan sesi e-Court ini dari ALETA? Cookie sesinya dihapus dari server.")) return;
    setSibuk(true);
    setPesan(aksi === "periksa" ? "Memeriksa sesi ke e-Court..." : "Memutus sesi...");
    try {
      const d = await kirimAksi({ aksi, peran });
      setPesan(
        aksi === "periksa"
          ? d?.berlaku
            ? `Sesi masih berlaku${d.namaAkunEcourt ? ` (${d.namaAkunEcourt})` : ""}.`
            : d?.pesan || "Sesi sudah habis. Masuk lagi."
          : "Sesi diputus."
      );
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const sesiPer = (kode: string) => data?.sesi.find((s) => s.peran === kode);

  return (
    <Card id="sesi-ecourt-saya">
      <CardHeader>
        <CardTitle>Sesi e-Court saya</CardTitle>
        <CardDescription>
          Sambungkan sesi e-Court akun Anda sendiri, per peran. Sesi ini dipakai untuk verifikasi dokumen e-litigasi
          (Hakim), TTE salinan putusan (Panitera), dan unggah salinan putusan. Akun penarik data milik pengadilan terpisah
          dan tidak pernah dipakai atas nama Anda. Sandi tidak disimpan; yang disimpan server hanya sesi tersandi. Sesi
          habis = masuk lagi di sini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {memuat && !data ? <p className="text-muted-foreground">Memuat...</p> : null}
        {data && !data.tersedia ? <p className="text-amber-700 dark:text-amber-300">{data.pesan}</p> : null}
        {data?.tersedia ? (
          <ul className="space-y-2">
            {data.peranTersedia.map((p) => {
              const s = sesiPer(p.kode);
              return (
                <li key={p.kode} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                  <span className="min-w-36 font-medium">{p.sebutan}</span>
                  {s?.keadaan === "tersambung" ? (
                    <Badge variant="success">Tersambung{s.namaAkunEcourt ? ` - ${s.namaAkunEcourt}` : ""}</Badge>
                  ) : s?.keadaan === "kedaluwarsa" ? (
                    <Badge variant="warning">Sesi habis {waktu(s.kedaluwarsaPada)}</Badge>
                  ) : (
                    <Badge variant="muted">Belum tersambung</Badge>
                  )}
                  {s?.terakhirDipakai ? <span className="text-muted-foreground">dipakai {waktu(s.terakhirDipakai)}</span> : null}
                  <span className="ml-auto flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void mulai(p.kode)}>
                      {s?.keadaan === "tersambung" ? "Masuk ulang" : "Sambungkan"}
                    </Button>
                    {s?.keadaan === "tersambung" ? (
                      <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void periksaAtauPutus("periksa", p.kode)}>
                        Periksa
                      </Button>
                    ) : null}
                    {s ? (
                      <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void periksaAtauPutus("keluar", p.kode)}>
                        Putuskan
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {peranLogin ? (
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <p className="font-medium">
              Masuk e-Court sebagai {data?.peranTersedia.find((p) => p.kode === peranLogin)?.sebutan || peranLogin}
            </p>
            <Input ref={surelRef} type="email" autoComplete="off" placeholder="Surel akun e-Court" />
            <Input ref={sandiRef} type="password" autoComplete="off" name="aleta-ecourt-sandi-sekali" placeholder="Sandi e-Court (tidak disimpan)" />
            {captcha ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={captcha} alt="Kode captcha e-Court" className="h-12 rounded border" />
            ) : null}
            <Input ref={captchaRef} autoComplete="off" placeholder="Kode captcha" />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={sibuk} onClick={() => void kirim()}>
                Masuk
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPeranLogin("");
                  setCaptcha("");
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : null}

        {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}

        {data?.jejak?.length ? (
          <details>
            <summary className="cursor-pointer text-muted-foreground">Riwayat aksi e-Court saya ({data.jejak.length})</summary>
            <ul className="mt-2 space-y-1">
              {data.jejak.map((j) => (
                <li key={j.id} className="text-muted-foreground">
                  {waktu(j.dibuatPada)} · {SEBUT_AKSI[j.aksi] || j.aksi}
                  {j.nomorPerkara ? ` · ${j.nomorPerkara}` : ""}
                  {j.akunEcourt ? ` · ${j.akunEcourt}` : ""} ·{" "}
                  <span className={j.hasil === "berhasil" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
                    {j.hasil}
                  </span>
                  {j.alasan ? ` (${j.alasan.replace(/_/g, " ")})` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Pengaturan pemantau putusan e-Court (E11) - hanya untuk admin. */
export function EcourtPantauPutusan() {
  const [k, setK] = useState<Record<string, unknown> | null>(null);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-aksi/pantau"), { cache: "no-store" });
      if (r.status === 404) {
        setPesan("Pemantau putusan belum tersedia di server.");
        return;
      }
      const d = await baca<{ tersedia: boolean; pesan: string; keadaan: Record<string, unknown> | null }>(r);
      setK(d?.keadaan ?? null);
      setPesan(d?.tersedia ? "" : d?.pesan || "");
    } catch {
      setPesan("ALETA belum dapat dihubungi.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const pengaturan = (k?.pengaturan ?? {}) as {
    aktif?: boolean;
    jarakMenit?: number;
    maksPerJam?: number;
    jedaUlangJam?: number;
    rentangHari?: number;
  };

  const simpan = async (ubah: Record<string, unknown>) => {
    const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-aksi/pantau"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ubah),
    });
    const d = await baca<{ tersedia: boolean; pesan: string; keadaan: Record<string, unknown> | null }>(r);
    if (d?.keadaan) setK(d.keadaan);
    setPesan(d?.tersedia ? "Tersimpan." : d?.pesan || "Belum tersimpan.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pemantau putusan e-Court</CardTitle>
        <CardDescription>
          Memeriksa ulang tab Putusan e-Court untuk perkara yang sudah putus tetapi salinannya belum diunggah atau belum
          di-TTE, memakai akun penarik data. Satu perkara per pemeriksaan, berjarak tetap, ada batas per jam, mundur saat
          error, hanya pada jam kerja penjadwal dan ketika tidak ada penarikan lain. Tidak meniru perilaku manusia; tiap
          pemeriksaan tercatat sebagai pekerjaan ALETA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {k ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pengaturan.aktif !== false} onChange={(e) => void simpan({ aktif: e.target.checked })} />
                Aktif
              </label>
              {(
                [
                  ["jarakMenit", "Jarak (menit)"],
                  ["maksPerJam", "Batas per jam"],
                  ["jedaUlangJam", "Periksa ulang perkara sama sesudah (jam)"],
                  ["rentangHari", "Putusan dalam (hari) terakhir"],
                ] as const
              ).map(([kunci, label]) => (
                <label key={kunci} className="flex items-center gap-1">
                  {label}
                  <Input
                    className="h-9 w-20"
                    type="number"
                    defaultValue={String(pengaturan[kunci] ?? "")}
                    onBlur={(e) => void simpan({ [kunci]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <p className="text-muted-foreground">
              Terakhir: {String(k.terakhirNomor || "-")} {k.terakhirPeriksa ? `(${waktu(String(k.terakhirPeriksa))})` : ""} ·
              keadaan: {String(k.terakhirSebab || "-").replace(/_/g, " ")} · gagal beruntun: {String(k.gagalBeruntun ?? 0)} ·
              sejam terakhir: {String(k.pemeriksaanSejamTerakhir ?? 0)}
            </p>
          </>
        ) : null}
        {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}
      </CardContent>
    </Card>
  );
}
