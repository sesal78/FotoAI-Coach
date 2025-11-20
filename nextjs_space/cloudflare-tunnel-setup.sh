
#!/bin/bash
# Foto AI Agent - Cloudflare Tunnel Setup Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "☁️  Cloudflare Tunnel Setup for Foto AI Agent"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}📥 Installing cloudflared...${NC}"
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
        sudo mv cloudflared /usr/local/bin/
        sudo chmod +x /usr/local/bin/cloudflared
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    else
        echo -e "${RED}❌ Unsupported OS. Please install cloudflared manually:${NC}"
        echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} cloudflared installed"
fi

# Authenticate with Cloudflare
echo ""
echo -e "${YELLOW}🔐 Please authenticate with your Cloudflare account${NC}"
echo "A browser window will open. Follow the instructions to authenticate."
read -p "Press Enter to continue..."

cloudflared tunnel login

# Create tunnel
TUNNEL_NAME="foto-ai-agent"
echo ""
echo "🔧 Creating tunnel: $TUNNEL_NAME"

if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo -e "${YELLOW}⚠️  Tunnel '$TUNNEL_NAME' already exists${NC}"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo -e "${GREEN}✓${NC} Tunnel created with ID: $TUNNEL_ID"
fi

# Get domain name
echo ""
echo "🌐 Enter your domain name (e.g., myfoto.topues.com):"
read DOMAIN_NAME

# Route DNS
echo "📡 Routing DNS..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN_NAME"

# Create config file
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.yml" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN_NAME
    service: http://localhost:3000
  - service: http_status:404
EOF

echo -e "${GREEN}✓${NC} Configuration created at $CONFIG_DIR/config.yml"

# Create systemd service (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    echo "🔧 Creating systemd service..."
    
    sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable cloudflared
    sudo systemctl start cloudflared
    
    echo -e "${GREEN}✓${NC} Cloudflare Tunnel service installed and started"
fi

echo ""
echo -e "${GREEN}✅ Cloudflare Tunnel setup complete!${NC}"
echo ""
echo "📋 Summary:"
echo "   - Tunnel Name: $TUNNEL_NAME"
echo "   - Tunnel ID: $TUNNEL_ID"
echo "   - Domain: $DOMAIN_NAME"
echo "   - Config: $CONFIG_DIR/config.yml"
echo ""
echo "🚀 Your Foto AI Agent is now accessible at:"
echo "   https://$DOMAIN_NAME"
echo ""
echo "📝 Useful commands:"
echo "   - View tunnel status: cloudflared tunnel info $TUNNEL_NAME"
echo "   - View logs: sudo journalctl -u cloudflared -f"
echo "   - Stop tunnel: sudo systemctl stop cloudflared"
echo "   - Start tunnel: sudo systemctl start cloudflared"
