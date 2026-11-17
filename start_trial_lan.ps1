# إطلاق تجريبي على الشبكة المحلية — المنفذ 8060
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$py = (Get-Command python -ErrorAction SilentlyContinue)?.Source
if (-not $py) { $py = "python" }

Write-Host "إيقاف أي خادم قديم على 8060..."
Get-NetTCPConnection -LocalPort 8060 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  }
Start-Sleep -Seconds 1

Write-Host "زرع حسابات التجربة من config/trial_launch.json ..."
& $py -c "from Core_Engine.database import init_db; from Core_Engine.access import seed_trial_accounts, load_trial_config; init_db(); c=load_trial_config(); print(seed_trial_accounts(password=c.get('password'), overwrite=bool(c.get('overwrite_passwords'))))"

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = "127.0.0.1" }

try {
  New-NetFirewallRule -DisplayName "School1059 Trial 8060" -Direction Inbound -Protocol TCP -LocalPort 8060 -Action Allow -ErrorAction SilentlyContinue | Out-Null
} catch {}

Write-Host ""
Write-Host "الخادم يعمل على الشبكة:"
Write-Host ("  http://{0}:8060/login.html" -f $ip)
Write-Host "كلمة المرور التجريبية: انظر config/trial_launch.json"
Write-Host ""

& $py -m uvicorn Core_Engine.app:app --host 0.0.0.0 --port 8060
