
#!/bin/bash
# Foto AI Agent - Restore Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Usage: ./restore.sh <backup_timestamp>${NC}"
    echo ""
    echo "Available backups:"
    ls -1 backups/ | grep "foto_db_" | sed 's/foto_db_/  /' | sed 's/.sql//'
    exit 1
fi

TIMESTAMP=$1
BACKUP_DIR="./backups"

echo "🔄 Restoring Foto AI Agent from backup: $TIMESTAMP"

# Navigate to nextjs_space
cd nextjs_space

# Check if backup files exist
if [ ! -f "$BACKUP_DIR/foto_db_$TIMESTAMP.sql" ]; then
    echo -e "${RED}❌ Database backup not found: $BACKUP_DIR/foto_db_$TIMESTAMP.sql${NC}"
    exit 1
fi

# Confirm restoration
echo -e "${YELLOW}⚠️  WARNING: This will replace all current data!${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restoration cancelled"
    exit 0
fi

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down

# Start only database
echo "🚀 Starting database..."
docker-compose up -d postgres
sleep 5

# Restore database
echo "📊 Restoring database..."
docker-compose exec -T postgres psql -U foto -d postgres -c "DROP DATABASE IF EXISTS foto;"
docker-compose exec -T postgres psql -U foto -d postgres -c "CREATE DATABASE foto;"
cat "$BACKUP_DIR/foto_db_$TIMESTAMP.sql" | docker-compose exec -T postgres psql -U foto -d foto
echo -e "${GREEN}✓${NC} Database restored"

# Restore uploads if available
if [ -f "$BACKUP_DIR/foto_uploads_$TIMESTAMP.tar.gz" ]; then
    echo "📸 Restoring uploads..."
    rm -rf public/uploads
    tar -xzf "$BACKUP_DIR/foto_uploads_$TIMESTAMP.tar.gz" -C public
    echo -e "${GREEN}✓${NC} Uploads restored"
fi

# Restore environment if available
if [ -f "$BACKUP_DIR/foto_env_$TIMESTAMP" ]; then
    echo "⚙️  Restoring configuration..."
    cp "$BACKUP_DIR/foto_env_$TIMESTAMP" .env
    echo -e "${GREEN}✓${NC} Configuration restored"
fi

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

echo ""
echo -e "${GREEN}✅ Restore completed successfully!${NC}"
echo "🌐 Access your application at http://localhost:3000"
