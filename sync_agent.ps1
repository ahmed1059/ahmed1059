param([string]$Action = "status")
$ProjectPath = "C:\Users\Toshiba\Desktop\School_Governance_System_1059"
Set-Location $ProjectPath

function Check-Health {
    Write-Host "`n[1/3] Checking Port 8060..." -ForegroundColor Cyan
    $port = Get-NetTCPConnection -LocalPort 8060 -ErrorAction SilentlyContinue
    if ($port) { Write-Host "[OK] Port 8060 is listening." -ForegroundColor Green }
    else { Write-Host "[WARN] Port 8060 is NOT running!" -ForegroundColor Red }

    Write-Host "`n[2/3] Checking polish.css..." -ForegroundColor Cyan
    $p = Join-Path -Path $ProjectPath -ChildPath "Print_Canvas\css\polish.css"
    if (Test-Path $p) { Write-Host "[DANGER] polish.css found!" -ForegroundColor Red }
    else { Write-Host "[CLEAN] polish.css is removed." -ForegroundColor Green }

    Write-Host "`n[3/3] Checking Log File..." -ForegroundColor Cyan
    $docsPath = Join-Path -Path$ProjectPath -ChildPath "docs"
    $files = Get-ChildItem -Path$docsPath -Filter "*.md" -ErrorAction SilentlyContinue
    if ($files) { Write-Host "[OK] Log markdown files found." -ForegroundColor Green }
    else { Write-Host "[WARN] No log files found in docs." -ForegroundColor Yellow }
}

function Prep-Prompt {
    $pState = (Get-NetTCPConnection -LocalPort 8060 -ErrorAction SilentlyContinue).State
    $pCss = Test-Path (Join-Path -Path$ProjectPath -ChildPath "Print_Canvas\css\polish.css")
    $txt = "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`nPort: $pState`npolish.css: $pCss"
    $bridgePath = Join-Path -Path$ProjectPath -ChildPath "docs\bridge_context.txt"
    Set-Content -Path $bridgePath -Value$txt -Encoding ASCII
    Write-Host "[OK] bridge_context.txt written." -ForegroundColor Green
}

if ($Action -eq "prep") { Prep-Prompt } else { Check-Health }
