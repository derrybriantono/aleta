# Daftar nomor halaman PDF/RTF tempat kata tertentu muncul (Word). pakai: halaman_kata.ps1 <kata> <rtf1> [<rtf2> ...]
param([string]$Kata, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Berkas)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($b in $Berkas) {
    $p = (Resolve-Path $b).Path
    $d = $w.Documents.Open($p, $false, $true)
    $hal = @()
    $r = $d.Content
    $r.Find.ClearFormatting()
    $ketemu = $r.Find.Execute($Kata)
    $n = 0
    while ($ketemu -and $n -lt 400) {
      $hal += $r.Information(3)
      $r.Collapse(0)
      $ketemu = $r.Find.Execute($Kata)
      $n++
    }
    $u = ($hal | Sort-Object -Unique) -join ','
    Write-Output ("{0}: {1}" -f (Split-Path $p -Leaf), $u)
    $d.Close([ref]0)
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
