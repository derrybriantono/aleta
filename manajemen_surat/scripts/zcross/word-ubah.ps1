# Mengubah satu berkas Word (RTF/DOCX/DOC) ke bentuk lain lewat Microsoft Word (COM) - mesin Z cross di laptop.
# pakai: powershell -NoProfile -File word-ubah.ps1 -Masuk <berkas> -Keluar <berkas> -Format pdf|docx|doc|rtf
# Word dijalankan sebagai proses SENDIRI dan hanya proses itu yang ditutup; bila Word yang sedang dipakai orang lain yang dipakai bersama
# (tidak ada proses WINWORD baru), hanya dokumen kita yang ditutup - Word-nya tidak di-Quit.
param([string]$Masuk, [string]$Keluar, [string]$Format)
$ErrorActionPreference = 'Stop'
$kode = @{ pdf = 17; docx = 16; doc = 0; rtf = 6 }
if (-not $kode.ContainsKey($Format)) { Write-Error "Format tidak dikenal: $Format"; exit 2 }
$sebelum = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$w = $null
$d = $null
$punyaku = @()
$galat = $null
try {
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.DisplayAlerts = 0
  $punyaku = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $sebelum -notcontains $_.Id } | ForEach-Object { $_.Id })
  $p = (Resolve-Path -LiteralPath $Masuk).Path
  $d = $w.Documents.Open($p, $false, $true)
  $keluarRef = $Keluar
  $formatRef = [int]$kode[$Format]
  $d.SaveAs([ref]$keluarRef, [ref]$formatRef)
  $d.Close([ref]0)
  $d = $null
} catch {
  $galat = $_.Exception.Message
} finally {
  try { if ($d) { $d.Close([ref]0) } } catch {}
  try { if ($w -and $punyaku.Count -gt 0) { $w.Quit([ref]0) } } catch {}
  try { if ($w) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null } } catch {}
  foreach ($id in $punyaku) {
    $pr = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($pr) {
      [void]$pr.WaitForExit(5000)
      if (-not $pr.HasExited) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    }
  }
}
if ($galat) { Write-Error $galat; exit 1 }
exit 0
