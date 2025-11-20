
#!/bin/bash
# Foto AI Agent - Monitoring Script

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📊 Foto AI Agent - System Monitor"
echo "=================================="
echo ""

# Check if containers are running
echo -e "${BLUE}🐳 Docker Containers:${NC}"
docker compose ps
echo ""

# Health check
echo -e "${BLUE}🏥 Health Check:${NC}"
HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓ Application is healthy${NC}"
    echo "$HEALTH" | jq '.'
else
    echo -e "${RED}✗ Application is unhealthy${NC}"
    echo "$HEALTH"
fi
echo ""

# Resource usage
echo -e "${BLUE}💻 Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""

# Disk usage
echo -e "${BLUE}💾 Disk Usage:${NC}"
df -h | grep -E "Filesystem|/$"
echo ""
echo "Docker volumes:"
docker system df
echo ""

# Recent logs (last 10 lines from app)
echo -e "${BLUE}📝 Recent Application Logs:${NC}"
docker compose logs --tail=10 app
echo ""

# Database status
echo -e "${BLUE}🗄️  Database Status:${NC}"
if docker compose exec -T postgres pg_isready -U foto > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is ready${NC}"
    
    # Get database size
    DB_SIZE=$(docker compose exec -T postgres psql -U foto -d foto -t -c "SELECT pg_size_pretty(pg_database_size('foto'));")
    echo "Database size: $DB_SIZE"
    
    # Get table counts
    echo ""
    echo "Table record counts:"
    docker compose exec -T postgres psql -U foto -d foto -t -c "
    SELECT 
        'Users: ' || COUNT(*) FROM \"User\"
    UNION ALL
    SELECT 
        'Challenges: ' || COUNT(*) FROM \"DailyChallenge\"
    UNION ALL
    SELECT 
        'Submissions: ' || COUNT(*) FROM \"ChallengeSubmission\"
    UNION ALL
    SELECT 
        'Itineraries: ' || COUNT(*) FROM \"Itinerary\";
    "
else
    echo -e "${RED}✗ Database is not ready${NC}"
fi
echo ""

# Backup status
echo -e "${BLUE}💾 Backup Status:${NC}"
if [ -d "./backups" ]; then
    BACKUP_COUNT=$(ls -1 ./backups/foto_db_*.sql 2>/dev/null | wc -l)
    echo "Total backups: $BACKUP_COUNT"
    
    if [ $BACKUP_COUNT -gt 0 ]; then
        LATEST_BACKUP=$(ls -t ./backups/foto_db_*.sql 2>/dev/null | head -1)
        BACKUP_DATE=$(stat -c %y "$LATEST_BACKUP" 2>/dev/null | cut -d' ' -f1)
        echo "Latest backup: $(basename $LATEST_BACKUP) ($BACKUP_DATE)"
    fi
else
    echo -e "${YELLOW}⚠️  No backups directory found${NC}"
fi
echo ""

# Cron job status
echo -e "${BLUE}⏰ Cron Job Status:${NC}"
docker compose logs scheduler --tail=20 | grep -E "challenge|weather|report|streak" | tail -5
echo ""

# Network connectivity
echo -e "${BLUE}🌐 Network Status:${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health | grep -q "200"; then
    echo -e "${GREEN}✓ Application is accessible${NC}"
else
    echo -e "${RED}✗ Application is not accessible${NC}"
fi

# Check external services
echo ""
echo "External API connectivity:"
if curl -s -o /dev/null -w "%{http_code}" https://api.openweathermap.org | grep -q "401\|200"; then
    echo -e "${GREEN}✓ OpenWeatherMap API reachable${NC}"
else
    echo -e "${RED}✗ OpenWeatherMap API unreachable${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" https://api.sendgrid.com | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ SendGrid API reachable${NC}"
else
    echo -e "${RED}✗ SendGrid API unreachable${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" https://apps.abacus.ai | grep -q "200"; then
    echo -e "${GREEN}✓ Abacus.AI API reachable${NC}"
else
    echo -e "${RED}✗ Abacus.AI API unreachable${NC}"
fi

echo ""
echo "=================================="
echo "Monitoring complete!"
echo ""
echo "Run './monitor.sh' anytime to check system status"
