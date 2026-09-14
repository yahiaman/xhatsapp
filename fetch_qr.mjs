import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

try {
  const raw = execSync('ssh -i "C:/Users/yahia.abdelkhalki/Admin_key.pem" azureuser@20.19.180.187 "curl -s -H \\"X-API-Key: owa_k1_1a4e0ea72451a9af5d035ccbe533282fe683fae789813b72332ed2da450848b8\\" http://127.0.0.1:2785/api/sessions/ce6c8b83-558a-4790-ae8c-1cc11a2220f1/qr"', { encoding: 'utf8', timeout: 15000 });
  const data = JSON.parse(raw);
  if (!data.qrCode) {
    console.log('Status:', data.status || 'unknown');
  } else {
    const base64 = data.qrCode.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    writeFileSync('C:/Users/yahia.abdelkhalki/Downloads/Gestion Whatsapp/whatsapp_qr.png', buf);
    writeFileSync('C:/Users/yahia.abdelkhalki/.gemini/antigravity/brain/a117e8a4-fcdd-4a4e-bff8-e94254f64e8d/whatsapp_qr.png', buf);

    const html = '<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n<title>Reconnexion WhatsApp OpenWA</title>\n<meta http-equiv=\"refresh\" content=\"10\">\n<style>\nbody { font-family: system-ui, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 95vh; margin: 0; }\n.card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 420px; }\nh2 { margin-top: 0; color: #128c7e; }\np { color: #555; line-height: 1.5; font-size: 14px; }\nimg { width: 280px; height: 280px; border: 2px solid #25d366; border-radius: 12px; margin: 16px 0; }\n.badge { background: #e7f7ed; color: #176c51; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-block; }\n</style>\n</head>\n<body>\n<div class=\"card\">\n<h2>Reconnexion WhatsApp</h2>\n<div class=\"badge\">Session : entraide-nusuk-hajj</div>\n<p>Ouvrez WhatsApp sur le tlphone administrateur :<br><strong>Menu (ou Rglages) &gt; Appareils connects &gt; Connecter un appareil</strong></p>\n<img src=\"whatsapp_qr.png\" alt=\"QR Code WhatsApp\">\n<p style=\"font-size:12px;color:#888\">Scannez ce QR Code pour reconnecter la session.</p>\n</div>\n</body>\n</html>';
    writeFileSync('C:/Users/yahia.abdelkhalki/Downloads/Gestion Whatsapp/scan_qr.html', html);
    console.log('SUCCESS_QR_SAVED');
  }
} catch (err) {
  console.error('Error fetching QR:', err.message);
}
