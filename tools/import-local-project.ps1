<#
.SYNOPSIS
  نسخة احتياطية محلية ثم رفع محتويات School_Governance_System_1059 إلى ahmed1059/ahmed1059

.NOTES
  شغّل من PowerShell على جهازك (Windows).
  المتطلبات: Git مثبت، وصلاحية push على المستودع.
  لا يرفع .env ولا مجلدات النسخ الاحتياطية (انظر .gitignore).
#>

[CmdletBinding()]
param(
  # مجلد المشروع الفعلي على جهازك
  [string]$SourceDir = "D:\School_Governance_System_1059",

  # أين تُحفظ النسخة الاحتياطية المحلية
  [string]$BackupRoot = "D:\_backups",

  # مجلد عمل مؤقت للاستنساخ والرفع
  [string]$WorkDir = "D:\_git_upload_ahmed1059",

  # فرع الرفع
  [string]$Branch = "cursor/import-full-project-b9be",

  # مستودع GitHub
  [string]$RepoUrl = "https://github.com/ahmed1059/ahmed1059.git"
)

$ErrorActionPreference = "Stop"

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "الأمر غير متوفر: $Name — ثبّت Git ثم أعد المحاولة."
  }
}

Assert-Command "git"

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "مجلد المصدر غير موجود: $SourceDir — عدّل -SourceDir إلى المسار الصحيح."
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $BackupRoot "School_Governance_System_1059_backup_$stamp"

Write-Host "==> 1/5 نسخة احتياطية محلية" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
robocopy $SourceDir $backupDir /E /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "فشلت النسخة الاحتياطية عبر robocopy (رمز $LASTEXITCODE)."
}
Write-Host "تم الحفظ في: $backupDir" -ForegroundColor Green

Write-Host "==> 2/5 تجهيز مجلد العمل والاستنساخ" -ForegroundColor Cyan
if (Test-Path -LiteralPath $WorkDir) {
  Remove-Item -LiteralPath $WorkDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
git clone $RepoUrl $WorkDir
Set-Location $WorkDir

# إن وُجدت تغييرات بعيدة على main نجلبها
git fetch origin
git checkout main
git pull origin main

Write-Host "==> 3/5 إنشاء فرع الرفع ونسخ الملفات" -ForegroundColor Cyan
git checkout -B $Branch

# انسخ كل شيء من المصدر مع استثناءات أمان إضافية أثناء النسخ
$excludeDirs = @(
  '.git', '.venv', 'venv', 'env', 'node_modules', '__pycache__',
  '.idea', '.vscode', '_backups', 'logs', 'tmp', 'temp'
)
$excludeFiles = @('.env', '.env.local', '*.pyc')

$robolog = Join-Path $env:TEMP "ahmed1059_robocopy_$stamp.log"
$xd = @()
foreach ($d in $excludeDirs) { $xd += @('/XD', $d) }

robocopy $SourceDir $WorkDir /E /R:1 /W:1 /XF .env .env.local *.pyc /XD .git .venv venv env node_modules __pycache__ .idea .vscode _backups logs tmp temp /LOG:$robolog
if ($LASTEXITCODE -ge 8) {
  throw "فشل نسخ الملفات إلى مجلد العمل (robocopy $LASTEXITCODE). راجع: $robolog"
}

# تأكد من وجود .gitignore في الجذر (من المستودع أو أنشئ حداً أدنى)
if (-not (Test-Path -LiteralPath (Join-Path $WorkDir ".gitignore"))) {
  @"
__pycache__/
.venv/
venv/
.env
.env.*
*.log
_backups/
node_modules/
"@ | Set-Content -Encoding UTF8 (Join-Path $WorkDir ".gitignore")
}

Write-Host "==> 4/5 التحقق السريع قبل الالتزام" -ForegroundColor Cyan
$mustExist = @('server.py')
$missing = @()
foreach ($m in $mustExist) {
  if (-not (Test-Path -LiteralPath (Join-Path $WorkDir $m))) {
    $missing += $m
  }
}
if ($missing.Count -gt 0) {
  Write-Warning ("ملفات متوقعة غير موجودة في الجذر: " + ($missing -join ', '))
  Write-Warning "أكمل الرفع إن كان المسار مختلفاً، أو أوقف التنفيذ (Ctrl+C) وعدّل المصدر."
}

git status --short | Select-Object -First 40
$pending = git status --porcelain
if (-not $pending) {
  Write-Host "لا توجد ملفات جديدة للرفع. تحقق من مسار المصدر." -ForegroundColor Yellow
  exit 0
}

Write-Host "==> 5/5 commit + push" -ForegroundColor Cyan
git add -A
git status --short | Select-Object -First 60

$msg = @"
import: رفع النسخة الكاملة لمنظومة حوكمة المدرسة 1059

نسخة احتياطية محلية أُخذت قبل الرفع.
الفرع جاهز لوحدة التدقيق والتنظيف (Strangler Fig / app-journey).
"@

git commit -m $msg
git push -u origin $Branch

Write-Host ""
Write-Host "اكتمل الرفع." -ForegroundColor Green
Write-Host "النسخة الاحتياطية: $backupDir"
Write-Host "الفرع على GitHub: $Branch"
Write-Host "افتح Pull Request من هذا الفرع إلى main، ثم أخبر المنفذ أن النسخة وصلت لبدء الوحدة الأولى."
Write-Host "سجل robocopy: $robolog"
