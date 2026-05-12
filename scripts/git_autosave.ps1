Set-Location "C:\Users\User\songbook-app"

$status = git status --porcelain 2>$null
if (-not $status) { exit 0 }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git add src scripts index.html vite.config.js package.json 2>$null
$staged = git diff --cached --name-only 2>$null
if (-not $staged) { exit 0 }

git commit -m "auto-save: $timestamp" 2>&1 | Out-Null
git push origin main 2>&1 | Out-Null
