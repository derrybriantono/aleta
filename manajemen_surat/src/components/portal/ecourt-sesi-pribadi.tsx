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
 *
 * Butir 20 (5 Okt 2026): tiap hakim, panitera, panitera pengganti, dan juru
 * sita BOLEH menyimpan akun e-Court MILIKNYA SENDIRI (surel + sandi, disandi
 * di server bot, tidak pernah dikirim balik ke layar). Dengan akun tersimpan,
 * "Uji masuk" cukup meminta captcha. Admin hanya melihat rekap siapa yang
 * sudah/belum (EcourtRekapAkunPengguna) - tidak dapat mengubah akun orang.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LencanaStatusEcourt } from "@/components/portal/ecourt-status-lencana";
import { tampilanStatus, type StatusAkunEcourt } from "@/lib/ecourt-status-akun";
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
  /** Status dalam model satu sumber (30 Okt 2026) - dihitung bot. */
  status?: StatusAkunEcourt | null;
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

type AkunTersimpan = {
  peran: string;
  email: string;
  adaSandi: boolean;
  diperbaruiPada: string;
  diujiPada: string;
  hasilUji: string;
  /** Diisi Super Admin/Admin untuk Anda (G4, 30 Okt 2026). */
  diisiOleh?: string;
};

type Data = {
  tersedia: boolean;
  pesan: string;
  sesi: Sesi[];
  akun?: AkunTersimpan[];
  akunDidukung?: boolean;
  peranTersedia: Array<{ kode: string; sebutan: string }>;
  jejak: Jejak[];
  /** Riwayat login e-Court lewat WhatsApp - hanya dikirim server kepada Super Admin dan Admin. */
  jejakWa?: Array<{ id: string; sasaran: string; hasil: string; alasan: string; dibuatPada: string }>;
};

const SEBUT_UJI: Record<string, string> = {
  berhasil: "uji masuk berhasil",
  ditolak: "ditolak e-Court - periksa surel/sandi",
  gagal: "uji masuk gagal",
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
  login_wa: "Login e-Court lewat WhatsApp",
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
  /** Surel akun tersimpan yang dipakai login ini; kosong = surel+sandi diketik. */
  const [loginTersimpan, setLoginTersimpan] = useState("");
  const [simpanSaatMasuk, setSimpanSaatMasuk] = useState(false);
  /** Dibuka dari menu "E-Court" di bilah atas SIPP (?dari=menu): menyebut perlunya akun sendiri dan jalan pulang. */
  const [dariMenu, setDariMenu] = useState(false);
  /** Peran yang formulir "Akun e-Court saya"-nya sedang terbuka. */
  const [peranAkun, setPeranAkun] = useState("");
  const surelRef = useRef<HTMLInputElement | null>(null);
  const sandiRef = useRef<HTMLInputElement | null>(null);
  const captchaRef = useRef<HTMLInputElement | null>(null);
  const akunSurelRef = useRef<HTMLInputElement | null>(null);
  const akunSandiRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setDariMenu(new URLSearchParams(window.location.search).get("dari") === "menu");
      } catch {
        setDariMenu(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const kirimAksi = async (badan: Record<string, unknown>) => {
    const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-sesi"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badan),
    });
    return baca<{
      ok: boolean;
      pesan?: string;
      alasan?: string;
      captcha?: string;
      namaAkunEcourt?: string;
      berlaku?: boolean;
      akunTersimpan?: string;
      akunDisimpan?: boolean;
    }>(r);
  };

  /** pakaiTersimpan: "Uji masuk" dengan akun tersimpan - cukup captcha. */
  const mulai = async (peran: string, pakaiTersimpan = false) => {
    setSibuk(true);
    setPesan("Membuka halaman login e-Court...");
    try {
      const d = await kirimAksi({ aksi: "mulai", peran });
      if (d?.ok) {
        setPeranLogin(peran);
        setCaptcha(d.captcha || "");
        setSimpanSaatMasuk(false);
        const tersimpan = pakaiTersimpan ? d.akunTersimpan || "" : "";
        setLoginTersimpan(tersimpan);
        setPesan(
          tersimpan
            ? `Masuk dengan akun tersimpan ${tersimpan} - cukup ketik kode captcha.`
            : pakaiTersimpan
              ? "Akun tersimpan untuk peran ini tidak ditemukan. Isi surel, sandi, dan kode captcha."
              : "Isi surel, sandi, dan kode captcha akun e-Court Anda."
        );
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
      const d = await kirimAksi(
        loginTersimpan
          ? { aksi: "kirim", peran: peranLogin, captcha: kode, pakaiTersimpan: true }
          : { aksi: "kirim", peran: peranLogin, email, sandi, captcha: kode, simpanAkun: simpanSaatMasuk }
      );
      if (d?.ok) {
        setPesan(
          `Tersambung${d.namaAkunEcourt ? ` sebagai ${d.namaAkunEcourt}` : ""}.${d.akunDisimpan ? " Akun e-Court disimpan untuk masuk berikutnya." : ""}`
        );
      } else {
        setPesan(d?.pesan || "Login e-Court belum berhasil. Mulai lagi dengan captcha baru.");
      }
      setPeranLogin("");
      setCaptcha("");
      setLoginTersimpan("");
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const simpanAkun = async () => {
    const email = akunSurelRef.current?.value || "";
    const sandi = akunSandiRef.current?.value || "";
    // Sandi tidak pernah masuk state; kolomnya dikosongkan begitu terkirim.
    if (akunSandiRef.current) akunSandiRef.current.value = "";
    setSibuk(true);
    setPesan("Menyimpan akun e-Court...");
    try {
      const d = await kirimAksi({ aksi: "simpan-akun", peran: peranAkun, email, sandi });
      setPesan(
        d?.ok
          ? dariMenu
            ? "Akun e-Court tersimpan. Kembali ke SIPP lalu klik menu E-Court - e-Court terbuka di tab baru dengan surel Anda sudah terisi. Tekan Uji masuk bila ingin memastikan e-Court menerimanya."
            : "Akun e-Court tersimpan. Tekan Uji masuk untuk memastikan e-Court menerimanya."
          : d?.pesan || "Akun belum tersimpan."
      );
      if (d?.ok) setPeranAkun("");
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const hapusAkun = async (peran: string) => {
    if (!window.confirm("Hapus akun e-Court tersimpan untuk peran ini? Sesi yang sedang tersambung tidak ikut diputus.")) return;
    setSibuk(true);
    try {
      const d = await kirimAksi({ aksi: "hapus-akun", peran });
      setPesan(d?.pesan || (d?.ok ? "Akun dihapus." : "Akun belum terhapus."));
      await muat();
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
  const akunPer = (kode: string) => data?.akun?.find((a) => a.peran === kode && a.adaSandi);

  return (
    <Card id="sesi-ecourt-saya">
      <CardHeader>
        <CardTitle>Sesi e-Court saya</CardTitle>
        <CardDescription>
          Sambungkan sesi e-Court akun Anda sendiri, per peran. Sesi ini dipakai untuk verifikasi dokumen e-litigasi
          (Hakim), TTE salinan putusan (Panitera), dan unggah salinan putusan (Hakim, Panitera Pengganti, Panitera, Juru
          Sita) - dari ALETA maupun dari panel ALETA di SIPP, selalu atas nama akun ALETA yang sedang masuk. Akun penarik
          data milik pengadilan terpisah dan tidak pernah dipakai atas nama Anda. Anda dapat menyimpan akun e-Court milik
          Anda sendiri (Akun e-Court saya) supaya masuk ulang cukup dengan captcha; sandinya disandi di server dan tidak
          pernah ditampilkan lagi. Tanpa akun tersimpan, sandi tidak disimpan - yang disimpan hanya sesi tersandi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {dariMenu ? (
          <p className="rounded-md bg-muted/40 p-3" data-dari-menu-ecourt="">
            Menu E-Court di SIPP memerlukan akun e-Court Anda. Pilih peran Anda di bawah, tekan Simpan akun, lalu isi surel dan sandi
            sesuai akun e-Court Anda sendiri - akun itulah yang menentukan peran Anda di e-Court. Sandi disandi di server dan tidak
            pernah ditampilkan lagi; captcha tetap Anda ketik sendiri saat masuk.
          </p>
        ) : null}
        {memuat && !data ? <p className="text-muted-foreground">Memuat...</p> : null}
        {data && !data.tersedia ? <p className="text-amber-700 dark:text-amber-300">{data.pesan}</p> : null}
        {data?.tersedia ? (
          <ul className="space-y-2">
            {data.peranTersedia.map((p) => {
              const s = sesiPer(p.kode);
              const a = akunPer(p.kode);
              return (
                <li key={p.kode} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                  <span className="min-w-36 font-medium">{p.sebutan}</span>
                  {s?.status ? (
                    <>
                      {/* Model satu sumber: "Tersambung" hanya bila TERBUKTI baru-baru
                          ini; cookie lama tanpa bukti = "Sedang memeriksa". */}
                      <LencanaStatusEcourt t={tampilanStatus(s.status)} />
                      {s.namaAkunEcourt ? <span className="text-muted-foreground">{s.namaAkunEcourt}</span> : null}
                    </>
                  ) : s?.keadaan === "tersambung" ? (
                    <Badge variant="success">Tersambung{s.namaAkunEcourt ? ` - ${s.namaAkunEcourt}` : ""}</Badge>
                  ) : s?.keadaan === "kedaluwarsa" ? (
                    <Badge variant="warning">Sesi habis {waktu(s.kedaluwarsaPada)}</Badge>
                  ) : (
                    <Badge variant="muted">Belum tersambung</Badge>
                  )}
                  {s?.terakhirDipakai ? <span className="text-muted-foreground">dipakai {waktu(s.terakhirDipakai)}</span> : null}
                  {a ? (
                    <span className="text-muted-foreground" data-akun-ecourt-tersimpan={p.kode}>
                      akun tersimpan: {a.email}
                      {a.hasilUji ? ` (${SEBUT_UJI[a.hasilUji] || a.hasilUji} ${waktu(a.diujiPada)})` : " (belum diuji)"}
                      {a.diisiOleh ? `, diisi oleh ${a.diisiOleh}` : ""}
                    </span>
                  ) : null}
                  <span className="ml-auto flex flex-wrap gap-2">
                    {a ? (
                      <Button type="button" size="sm" disabled={sibuk} onClick={() => void mulai(p.kode, true)}>
                        {/* Sesi habis + akun tersimpan: cukup captcha. */}
                        {s?.status?.keadaan === "perlu_masuk" || s?.keadaan === "kedaluwarsa" ? "Masuk lagi" : "Uji masuk"}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void mulai(p.kode)}>
                      {s?.keadaan === "tersambung" ? "Masuk ulang" : "Sambungkan"}
                    </Button>
                    {data.akunDidukung ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={sibuk}
                        onClick={() => setPeranAkun(peranAkun === p.kode ? "" : p.kode)}
                      >
                        {a ? "Ubah akun" : "Simpan akun"}
                      </Button>
                    ) : null}
                    {a ? (
                      <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void hapusAkun(p.kode)}>
                        Hapus akun
                      </Button>
                    ) : null}
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

        {data?.tersedia && data.akunDidukung === false ? (
          <p className="text-muted-foreground">
            Menyimpan akun e-Court per pengguna belum didukung ALETA Bot di server ini (bot perlu diperbarui).
          </p>
        ) : null}

        {peranAkun ? (
          <div className="space-y-2 rounded-md bg-muted/40 p-3" data-akun-ecourt-saya={peranAkun}>
            <p className="font-medium">
              Akun e-Court saya - {data?.peranTersedia.find((p) => p.kode === peranAkun)?.sebutan || peranAkun}
            </p>
            <p className="text-muted-foreground">
              Surel dan sandi akun e-Court MILIK ANDA SENDIRI. Disandi di server ALETA Bot, tidak pernah ditampilkan lagi,
              dan hanya dipakai untuk masuk e-Court atas nama Anda ketika Anda menekan Uji masuk. Captcha tetap Anda ketik
              sendiri. Kosongkan sandi bila hanya ingin menyimpan ulang surel yang sama.
            </p>
            <Input
              key={`surel-${peranAkun}`}
              ref={akunSurelRef}
              type="email"
              autoComplete="off"
              defaultValue={data?.akun?.find((a) => a.peran === peranAkun)?.email || ""}
              placeholder="Surel akun e-Court"
            />
            <Input
              ref={akunSandiRef}
              type="password"
              autoComplete="new-password"
              name="aleta-ecourt-akun-sandi"
              placeholder={akunPer(peranAkun) ? "Sandi e-Court (kosongkan bila tidak berubah)" : "Sandi e-Court"}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={sibuk} onClick={() => void simpanAkun()}>
                Simpan akun
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPeranAkun("")}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}

        {peranLogin ? (
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <p className="font-medium">
              Masuk e-Court sebagai {data?.peranTersedia.find((p) => p.kode === peranLogin)?.sebutan || peranLogin}
              {loginTersimpan ? ` - akun tersimpan ${loginTersimpan}` : ""}
            </p>
            {loginTersimpan ? null : (
              <>
                <Input ref={surelRef} type="email" autoComplete="off" placeholder="Surel akun e-Court" />
                <Input
                  ref={sandiRef}
                  type="password"
                  autoComplete="off"
                  name="aleta-ecourt-sandi-sekali"
                  placeholder={simpanSaatMasuk ? "Sandi e-Court (disimpan tersandi bila login berhasil)" : "Sandi e-Court (tidak disimpan)"}
                />
                {data?.akunDidukung ? (
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" checked={simpanSaatMasuk} onChange={(e) => setSimpanSaatMasuk(e.target.checked)} />
                    Simpan akun ini sebagai akun e-Court saya (hanya bila e-Court menerima login)
                  </label>
                ) : null}
              </>
            )}
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
                  setLoginTersimpan("");
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

        {data?.jejakWa ? (
          <details data-riwayat-login-wa="">
            <summary className="cursor-pointer text-muted-foreground">
              Riwayat login e-Court lewat WhatsApp - khusus Super Admin dan Admin ({data.jejakWa.length})
            </summary>
            {data.jejakWa.length ? (
              <ul className="mt-2 space-y-1">
                {data.jejakWa.map((j) => (
                  <li key={j.id} className="text-muted-foreground">
                    {waktu(j.dibuatPada)} · {j.sasaran} ·{" "}
                    <span className={j.hasil === "berhasil" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
                      {j.hasil}
                    </span>
                    {j.alasan ? ` (${j.alasan.replace(/_/g, " ")})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">Belum ada login atau captcha e-Court lewat WhatsApp yang tercatat.</p>
            )}
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

type BarisRekap = {
  penggunaId: string;
  nama: string;
  jabatan: string;
  peranDiharapkan: string[];
  akun: Array<{
    peran: string;
    email: string;
    adaSandi: boolean;
    diperbaruiPada: string;
    hasilUji: string;
    diujiPada: string;
    sesi: string;
    namaAkunEcourt: string;
  }>;
  keadaan: "sudah" | "sebagian" | "belum";
};

const SEBUT_PERAN: Record<string, string> = {
  hakim: "Hakim",
  panitera: "Panitera",
  "panitera-pengganti": "Panitera Pengganti",
  "juru-sita": "Juru Sita",
  lainnya: "Lainnya",
};

/**
 * Rekap akun e-Court per pengguna (butir 20) - hanya admin, hanya MEMBACA.
 * Siapa yang sudah/belum menyimpan akun e-Court miliknya; tanpa sandi, dan
 * tanpa tombol mengubah akun orang lain.
 */
export function EcourtRekapAkunPengguna() {
  const [isi, setIsi] = useState<{
    tersedia: boolean;
    pesan: string;
    baris: BarisRekap[];
    ringkas?: { sudah: number; sebagian: number; belum: number };
  } | null>(null);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-sesi/rekap"), { cache: "no-store" });
      if (r.status === 404) {
        setPesan("Rekap akun e-Court per pengguna belum tersedia di server.");
        return;
      }
      if (r.status === 403) {
        setPesan("Hanya Super Admin dan Admin yang dapat melihat rekap ini.");
        return;
      }
      const d = await baca<NonNullable<typeof isi>>(r);
      setIsi(d);
      setPesan(d?.tersedia ? "" : d?.pesan || "");
    } catch {
      setPesan("ALETA belum dapat dihubungi.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  return (
    <Card id="rekap-akun-ecourt-pengguna">
      <CardHeader>
        <CardTitle>Akun e-Court per pengguna</CardTitle>
        <CardDescription>
          Hakim, panitera, panitera pengganti, dan juru sita menyimpan akun e-Court MILIKNYA SENDIRI di Integrasi e-Court
          &gt; Sesi e-Court saya. Tindakan e-Court (verifikasi, TTE, unggah salinan putusan) selalu memakai akun pengguna
          yang sedang masuk ALETA; yang belum menyimpan akun dihentikan dengan petunjuk mengisinya - tidak pernah dialihkan
          ke akun orang lain atau akun penarik data. Daftar ini hanya untuk melihat; sandi tidak pernah ditampilkan, dan
          akun seseorang hanya dapat diubah pemiliknya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isi?.ringkas ? (
          <p className="text-muted-foreground">
            Sudah: {isi.ringkas.sudah} · Sebagian: {isi.ringkas.sebagian} · Belum: {isi.ringkas.belum}
          </p>
        ) : null}
        {isi?.baris?.length ? (
          <ul className="space-y-1">
            {isi.baris.map((b) => (
              <li key={b.penggunaId} className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                <span className="min-w-40 font-medium">{b.nama}</span>
                <Badge variant={b.keadaan === "sudah" ? "success" : b.keadaan === "sebagian" ? "warning" : "muted"}>
                  {b.keadaan === "sudah" ? "Sudah" : b.keadaan === "sebagian" ? "Sebagian" : "Belum"}
                </Badge>
                {b.akun.map((a) => (
                  <span key={a.peran} className="text-muted-foreground">
                    {SEBUT_PERAN[a.peran] || a.peran}:{" "}
                    {a.adaSandi ? `${a.email}${a.hasilUji ? ` (${SEBUT_UJI[a.hasilUji] || a.hasilUji})` : " (belum diuji)"}` : "belum diisi"}
                    {a.sesi === "tersambung" ? " · sesi tersambung" : a.sesi === "kedaluwarsa" ? " · sesi habis" : ""}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        ) : isi?.tersedia ? (
          <p className="text-muted-foreground">Belum ada pengguna berjabatan hakim, panitera, panitera pengganti, atau juru sita.</p>
        ) : null}
        {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}
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
