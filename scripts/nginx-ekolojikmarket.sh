#!/usr/bin/env bash
# ekolojikmarket.com.tr — nginx + SSL (sadece market-pos, port 5180)
set -euo pipefail

CONF="/etc/nginx/sites-available/ekolojikmarket.com.tr.conf"
ENABLED="/etc/nginx/sites-enabled/ekolojikmarket.com.tr.conf"

cat > "$CONF" <<'NGINX'
# ekolojikmarket.com.tr — Market POS (port 5180)

server {
    listen 80;
    listen [::]:80;
    server_name ekolojikmarket.com.tr www.ekolojikmarket.com.tr;

    client_max_body_size 32m;
    access_log /var/log/nginx/ekolojikmarket.access.log;
    error_log  /var/log/nginx/ekolojikmarket.error.log;

    location / {
        proxy_pass http://127.0.0.1:5180;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf "$CONF" "$ENABLED"
nginx -t
systemctl reload nginx
echo "✓ Nginx yapılandırıldı"

if dig +short ekolojikmarket.com.tr @8.8.8.8 | grep -q .; then
  certbot --nginx -d ekolojikmarket.com.tr -d www.ekolojikmarket.com.tr \
    --non-interactive --agree-tos --email info@ekolojikmarket.com.tr --redirect
  echo "✓ SSL kuruldu"
else
  echo "DNS henüz yayılmadı — SSL için birkaç saat sonra tekrar çalıştırın:"
  echo "  sudo bash $0"
fi
