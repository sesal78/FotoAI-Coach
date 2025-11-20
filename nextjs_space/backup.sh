
#!/bin/bash
# Foto AI Agent - Backup Script

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📦 Starting Foto AI Agent backup..."

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed.${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if containers are running
if ! docker compose ps | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  Warning: Containers are not running. Starting them...${NC}"
    docker compose up -d
    sleep 5
fi

# Backup PostgreSQL database
echo "🗄️  Backing up database..."
docker compose exec -T postgres pg_dump -U foto -d foto > "$BACKUP_DIR/foto_db_$TIMESTAMP.sql"
echo -e "${GREEN}✓${NC} Database backed up to $BACKUP_DIR/foto_db_$TIMESTAMP.sql"

# Backup uploaded files
echo "📸 Backing up uploaded photos..."
if [ -d "public/uploads" ]; then
    tar -czf "$BACKUP_DIR/foto_uploads_$TIMESTAMP.tar.gz" -C public uploads
    echo -e "${GREEN}✓${NC} Uploads backed up to $BACKUP_DIR/foto_uploads_$TIMESTAMP.tar.gz"
else
    echo -e "${YELLOW}⚠️  No uploads directory found${NC}"
fi

# Backup environment configuration
echo "⚙️  Backing up configuration..."
if [ -f ".env" ]; then
    # Backup .env but redact sensitive information in the display
    cp .env "$BACKUP_DIR/foto_env_$TIMESTAMP"
    echo -e "${GREEN}✓${NC} Configuration backed up to $BACKUP_DIR/foto_env_$TIMESTAMP"
fi

# Clean up old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "foto_*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
echo -e "${GREEN}✓${NC} Old backups cleaned up"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "📊 Backup summary:"
echo "   - Timestamp: $TIMESTAMP"
echo "   - Location: $BACKUP_DIR"
echo "   - Total size: $BACKUP_SIZE"
echo "   - Retention: $RETENTION_DAYS days"
echo ""
echo "📝 Backup files created:"
ls -lh "$BACKUP_DIR" | grep "$TIMESTAMP" || echo "   (See $BACKUP_DIR directory)"
echo ""
echo "💡 To restore from this backup, run:"
echo "   ./restore.sh $TIMESTAMP"
