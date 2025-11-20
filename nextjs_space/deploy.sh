
#!/bin/bash
# Foto AI Agent - Deployment Script for Self-Hosting

set -e

echo "🚀 Deploying Foto AI Agent..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Created .env file. Please edit it with your configuration:${NC}"
        echo ""
        echo "   Required configuration:"
        echo "   - Database password (POSTGRES_PASSWORD)"
        echo "   - NextAuth secret (NEXTAUTH_SECRET)"
        echo "   - API keys (ABACUSAI_API_KEY, SENDGRID_API_KEY, OPENWEATHERMAP_API_KEY)"
        echo "   - Your email (USER_EMAIL)"
        echo ""
        echo -e "${YELLOW}Run this script again after updating .env${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found. Please ensure you're in the project root directory.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Environment configured"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down

# Build and start containers
echo "🏗️  Building Docker images..."
docker compose build

echo "🚀 Starting services..."
docker compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "📊 Running database migrations..."
docker compose exec -T app npx prisma generate
docker compose exec -T app npx prisma migrate deploy || docker compose exec -T app npx prisma db push

# Seed database
echo "🌱 Seeding database..."
docker compose exec -T app yarn prisma db seed || echo "Database already seeded or seed script not configured"

# Check health
echo "🏥 Checking application health..."
sleep 5

if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Foto AI Agent is running successfully!${NC}"
    echo ""
    echo "📋 Services Status:"
    docker compose ps
    echo ""
    echo "🌐 Access your application:"
    echo "   - Home: http://localhost:3000"
    echo "   - Dashboard: http://localhost:3000/dashboard"
    echo "   - Chat: http://localhost:3000/chat"
    echo ""
    echo "📖 Useful commands:"
    echo "   - View logs: docker compose logs -f"
    echo "   - Stop services: docker compose down"
    echo "   - Restart services: docker compose restart"
    echo "   - View database: docker compose exec postgres psql -U foto -d foto"
    echo ""
    echo "💾 Backup: ./backup.sh"
    echo "🔄 Restore: ./restore.sh <timestamp>"
else
    echo -e "${RED}❌ Health check failed. Please check logs with: docker compose logs${NC}"
    exit 1
fi
