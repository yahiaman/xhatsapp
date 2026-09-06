<#
.SYNOPSIS
    Script utilitaire pour la gestion des tunnels SSH et des clés de l'application Xhatsapp.
.DESCRIPTION
    Permet d'ouvrir en 1 clic les tunnels SSH vers les interfaces d'administration
    et de copier les clés d'accès directement dans le presse-papiers sans les exposer à l'écran.
#>

param(
    [string]$ServerIp = "20.19.180.187",
    [string]$KeyPath = "C:\Users\yahia.abdelkhalki\Admin_key.pem",
    [string]$User = "azureuser"
)

function Show-Menu {
    Clear-Host
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "      Xhatsapp 0.6.0 — Console d'Exploitation Rapide      " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " [1] Ouvrir le tunnel TOUT-EN-UN (Console Admin + OpenWA + OmniRoute)" -ForegroundColor Yellow
    Write-Host " [2] Ouvrir le tunnel Console /admin seul (Port 13000 -> 3000)" -ForegroundColor White
    Write-Host " [3] Ouvrir le tunnel OpenWA seul (Port 2785 -> 2785)" -ForegroundColor White
    Write-Host " [4] Ouvrir le tunnel OmniRoute seul (Port 20128 -> 20128)" -ForegroundColor White
    Write-Host ""
    Write-Host " --- Extraction des Clés vers le Presse-Papiers ---" -ForegroundColor Gray
    Write-Host " [5] Copier le jeton Console Admin (XHATSAPP_ADMIN_TOKEN)" -ForegroundColor Green
    Write-Host " [6] Copier la clé maître OpenWA (OPENWA_API_MASTER_KEY)" -ForegroundColor Green
    Write-Host " [7] Copier le mot de passe OmniRoute (OMNIROUTE_INITIAL_PASSWORD)" -ForegroundColor Green
    Write-Host " [8] Copier l'UUID de la session WhatsApp (OPENWA_SESSION_ID)" -ForegroundColor Green
    Write-Host ""
    Write-Host " [Q] Quitter" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Cyan
}

function Copy-Secret([string]$varName, [string]$label) {
    Write-Host "Récupération sécurisée de $label..." -ForegroundColor Gray
    $val = ssh -i $KeyPath "$User@$ServerIp" "sudo sed -n 's/^$varName=//p' /opt/xhatsapp/.env"
    if ($val) {
        $val.Trim() | Set-Clipboard
        Write-Host "✅ $label copié dans le presse-papiers avec succès !" -ForegroundColor Green
        Write-Host "👉 Vous pouvez maintenant faire [Ctrl + V] dans votre navigateur." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Erreur : Impossible de lire $varName sur le serveur." -ForegroundColor Red
    }
    Start-Sleep -Seconds 2
}

do {
    Show-Menu
    $choice = Read-Host "Votre choix"
    switch ($choice) {
        "1" {
            Write-Host "Lancement du tunnel tout-en-un..." -ForegroundColor Cyan
            Write-Host "Accès disponibles dans votre navigateur :" -ForegroundColor Yellow
            Write-Host "  - Console Admin  : http://127.0.0.1:13000/admin" -ForegroundColor White
            Write-Host "  - Tableau OpenWA : http://127.0.0.1:2785" -ForegroundColor White
            Write-Host "  - IA OmniRoute   : http://127.0.0.1:20128/home" -ForegroundColor White
            Write-Host "(Appuyez sur Ctrl+C pour fermer le tunnel)" -ForegroundColor Gray
            ssh -N -i $KeyPath -L 13000:127.0.0.1:3000 -L 2785:127.0.0.1:2785 -L 20128:127.0.0.1:20128 "$User@$ServerIp"
        }
        "2" {
            Write-Host "Lancement du tunnel /admin -> http://127.0.0.1:13000/admin" -ForegroundColor Cyan
            Write-Host "(Appuyez sur Ctrl+C pour fermer le tunnel)" -ForegroundColor Gray
            ssh -N -i $KeyPath -L 13000:127.0.0.1:3000 "$User@$ServerIp"
        }
        "3" {
            Write-Host "Lancement du tunnel OpenWA -> http://127.0.0.1:2785" -ForegroundColor Cyan
            Write-Host "(Appuyez sur Ctrl+C pour fermer le tunnel)" -ForegroundColor Gray
            ssh -N -i $KeyPath -L 2785:127.0.0.1:2785 "$User@$ServerIp"
        }
        "4" {
            Write-Host "Lancement du tunnel OmniRoute -> http://127.0.0.1:20128/home" -ForegroundColor Cyan
            Write-Host "(Appuyez sur Ctrl+C pour fermer le tunnel)" -ForegroundColor Gray
            ssh -N -i $KeyPath -L 20128:127.0.0.1:20128 "$User@$ServerIp"
        }
        "5" { Copy-Secret "XHATSAPP_ADMIN_TOKEN" "Jeton Console Admin" }
        "6" { Copy-Secret "OPENWA_API_MASTER_KEY" "Clé Maître OpenWA" }
        "7" { Copy-Secret "OMNIROUTE_INITIAL_PASSWORD" "Mot de Passe OmniRoute" }
        "8" { Copy-Secret "OPENWA_SESSION_ID" "UUID Session WhatsApp" }
    }
} while ($choice -ne "Q" -and $choice -ne "q")
