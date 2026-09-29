<#
  caspar-janela.ps1 — fotografa as janelas do CasparCG (consumer `screen`)

  O que a janela MOSTRA: o canal composto sobre preto, depois do scaling da
  janela, como o monitor vai ver. Para o quadro exato do canal, em 1920x1080 e
  com alfa, use `PRINT <canal>` pelo AMCP (grava um PNG no media-path) — ver
  references/casparcg.md §11. Os dois se complementam: o PRINT prova o que o
  Caspar renderizou; esta foto prova o que chegou na tela.

  Uso (PowerShell 5.1):
    powershell -NoProfile -File caspar-janela.ps1 -Saida C:\caminho\pasta
    powershell -NoProfile -File caspar-janela.ps1 -Saida . -Filtro TESTE

  Pegadinhas já pisadas:
    · o Chromium de cada camada HTML é um SUBPROCESSO também chamado
      casparcg.exe — pegar "o primeiro casparcg" pega um sem janela. Aqui vale
      o processo que tem MainWindowTitle.
    · CopyFromScreen fotografa o que está NA TELA: janela coberta por outra sai
      coberta. Por isso o título (e a posição) sai no relatório — confira.
#>
param(
  [string]$Saida = ".",
  [string]$Filtro = ""
)

Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class CasparJanela {
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<IntPtr> DoProcesso(uint pid) {
    var l = new List<IntPtr>();
    EnumWindows((h, x) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) l.Add(h); return true; }, IntPtr.Zero);
    return l;
  }
}
"@
Add-Type -AssemblyName System.Drawing

$proc = Get-Process casparcg -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
if (-not $proc) { Write-Error "CasparCG não está rodando (nenhum casparcg.exe com janela)."; exit 1 }

$dir = (Resolve-Path -LiteralPath $Saida).Path
$n = 0
foreach ($h in [CasparJanela]::DoProcesso([uint32]$proc.Id)) {
  $sb = New-Object System.Text.StringBuilder 256
  [void][CasparJanela]::GetWindowText($h, $sb, 256)
  $titulo = $sb.ToString()
  if (-not $titulo -or ($Filtro -and $titulo -notmatch [regex]::Escape($Filtro))) { continue }
  $r = New-Object CasparJanela+RECT
  [void][CasparJanela]::GetWindowRect($h, [ref]$r)
  $w = $r.R - $r.L; $hh = $r.B - $r.T
  if ($w -lt 50 -or $hh -lt 50) { continue }
  $bmp = New-Object System.Drawing.Bitmap $w, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  <# PrintWindow com PW_RENDERFULLCONTENT (2) pede o conteúdo à própria janela,
     então funciona com ela COBERTA por outra — CopyFromScreen não: ele
     fotografa a tela, e na primeira tentativa trouxe o VS Code e um player de
     vídeo que estavam por cima. CopyFromScreen fica só como reserva. #>
  $hdc = $g.GetHdc()
  $ok = [CasparJanela]::PrintWindow($h, $hdc, 2)
  $g.ReleaseHdc($hdc)
  $metodo = "PrintWindow"
  if (-not $ok) { $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size); $metodo = "CopyFromScreen (a janela precisa estar NA FRENTE)" }
  $arq = Join-Path $dir ("caspar_" + ($titulo -replace '[^\w]+', '_').Trim('_') + ".png")
  $bmp.Save($arq, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  "{0}  {1}x{2} em ({3},{4})  [{5}]  ->  {6}" -f $titulo, $w, $hh, $r.L, $r.T, $metodo, $arq
  $n++
}
if ($n -eq 0) { Write-Error "Nenhuma janela capturada (filtro: '$Filtro'). Verificação vazia é falha."; exit 1 }
