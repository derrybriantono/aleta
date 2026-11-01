# RTF -> PDF lewat Word dan nomor halaman tempat salah satu teks cari (dipisah |) pertama kali ditemukan.
# pakai: powershell -File rtf_hal.ps1 "<cari1|cari2>" <rtf1> [<rtf2> ...]  -> "<rtf>.pdf" + baris "HAL <n> <jumlah halaman> <rtf>"
param([string]$Cari, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Berkas)
$w = $null
try {
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.DisplayAlerts = 0
  foreach ($b in $Berkas) {
    $p = (Resolve-Path $b).Path
    $d = $w.Documents.Open($p, $false, $true)
    $hal = 0
    foreach ($c in $Cari.Split('|')) {
      $r = $d.Content
      if ($r.Find.Execute($c)) { $hal = $r.Information(3); break }
    }
    $n = $d.ComputeStatistics(2)
    $d.SaveAs([ref]($p + '.pdf'), [ref]17)
    $d.Close([ref]0)
    Write-Output "HAL $hal $n $p"
  }
} finally {
  if ($w) { $w.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null }
}
