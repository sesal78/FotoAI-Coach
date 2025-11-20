
# 📸 Foto AI Agent - Personalized Photography Coach

A self-hosted, AI-powered photography coaching platform designed specifically for **Seun's** photography journey.

## 🌟 Features

### 🤖 AI-Powered Coaching
- **Personalized Daily Challenges** - Context-aware photography challenges based on your schedule, location, and weather
- **Intelligent Feedback** - AI-generated feedback on your photo submissions
- **Adaptive Learning** - System learns from your preferences and improves recommendations
- **Multi-Camera Support** - Tailored recommendations for your Fujifilm X-T5, Ricoh GR IIIx, Nikon FE2, and Pentax ME

### 📅 Smart Scheduling
- **Weekend Deep Dives** (Saturday 7 AM) - Substantial 2-4 hour creative projects
- **Lunch Micro Challenges** (Weekdays 11 AM) - Quick 15-25 minute exercises
- **After-Work Sessions** - Evening photography opportunities
- **Work-From-Home Flexibility** - Adapted challenges when working remotely

### 🌤️ Weather Integration
- Real-time weather monitoring
- Photography-optimized weather analysis (scoring system 0-100)
- Automatic alerts for exceptional shooting conditions
- Weather-adapted challenge recommendations

### 📊 Progress Tracking
- Completion streaks and statistics
- Skill progression tracking
- Favorite photography styles analysis
- Weekly progress reports via email

### 📍 Location-Based Features
- Itinerary generation for photo tours
- Location-specific shooting recommendations
- Best time-of-day suggestions
- Weather-aware planning

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 16
- **AI/LLM**: Abacus.AI API
- **Email**: SendGrid
- **Weather**: OpenWeatherMap API
- **Deployment**: Docker Compose, Cloudflare Tunnel

### Components
1. **Next.js Application** - Main web interface and API
2. **PostgreSQL Database** - User data, challenges, progress tracking
3. **Cron Scheduler** - Automated challenge generation and notifications
4. **File Storage** - Local file system for photo uploads

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- Domain name (optional, for Cloudflare Tunnel)

### Deployment

1. **Clone the repository:**
```bash
git clone https://github.com/sesal78/Foto-AI-Agent-DeepAgent.git
cd Foto-AI-Agent-DeepAgent
```

2. **Deploy with Docker:**
```bash
./deploy.sh
```

3. **Access your application:**
   - Local: http://localhost:3000
   - Dashboard: http://localhost:3000/dashboard

4. **Set up Cloudflare Tunnel (optional):**
```bash
./cloudflare-tunnel-setup.sh
```

For detailed instructions, see [SELF_HOSTING_GUIDE.md](SELF_HOSTING_GUIDE.md)

## 📖 Documentation

- **[Self-Hosting Guide](SELF_HOSTING_GUIDE.md)** - Complete deployment guide
- **[Implementation Spec](FOTO_AI_AGENT_IMPLEMENTATION_SPEC.md)** - Technical specification
- **[AI Implementation Prompt](AI_IMPLEMENTATION_PROMPT.md)** - AI Agent development guide
- **[GitHub Setup](GITHUB_SETUP_INSTRUCTIONS.md)** - Version control setup

## 🔑 Your Profile

**Name**: Seun  
**Email**: seun@example.com  
**Skill Level**: Intermediate  
**Interests**: Street, Portrait, Architecture, Film Photography, Urban Exploration  
**Primary Photo Day**: Saturday  
**Work Schedule**: Mon-Fri, 9 AM - 5 PM

**Gear Inventory:**
- 📷 Fujifilm X-T5 (Primary) - APS-C 40.2MP mirrorless
- 📷 Ricoh GR IIIx - Compact with 40mm f/2.8 equivalent
- 📷 Nikon FE2 - Film SLR (1983)
- 📷 Pentax ME - Compact film SLR (1976)

## 📊 API Endpoints

### Challenges
- `GET /api/challenges` - List challenges
- `POST /api/challenges` - Generate new challenge
- `GET /api/challenges/[id]` - Get specific challenge
- `PATCH /api/challenges/[id]` - Update challenge status

### Submissions
- `GET /api/submissions` - List submissions
- `POST /api/submissions` - Submit challenge completion

### Progress
- `GET /api/progress` - Get user progress and statistics

### Itineraries
- `GET /api/itinerary` - List itineraries
- `POST /api/itinerary` - Generate new itinerary

### Scheduled Tasks
- `POST /api/scheduled/daily-challenge` - Generate daily challenges
- `POST /api/scheduled/weather-monitor` - Monitor weather conditions
- `POST /api/scheduled/weekly-report` - Generate weekly report
- `POST /api/scheduled/streak-manager` - Update user streaks

## 🛠️ Maintenance

### Backup
```bash
./backup.sh
```

### Restore
```bash
./restore.sh <timestamp>
```

### Monitor
```bash
./monitor.sh
```

### View Logs
```bash
cd nextjs_space
docker-compose logs -f
```

## ⏰ Scheduled Tasks

The AI Agent runs automated tasks:

- **Saturday 7 AM PST** - Weekend deep dive challenge
- **Weekdays 11 AM PST** - Lunch micro challenge
- **Every 3 hours** - Weather monitoring
- **Sunday 8 PM PST** - Weekly progress report
- **Daily 11 PM PST** - Streak management

## 🔒 Security

- API keys stored securely in environment variables
- Password hashing (bcrypt) for user authentication
- Prisma ORM for SQL injection prevention
- Docker container isolation
- Optional Cloudflare Tunnel for secure external access

## 🤝 Contributing

This is a personal project tailored specifically for Seun's photography journey. However, feel free to fork and adapt it for your own needs!

## 📝 License

MIT License - Feel free to use and modify for your photography coaching needs.

## 🙏 Acknowledgments

- **Abacus.AI** - LLM API for intelligent challenge generation
- **SendGrid** - Email delivery service
- **OpenWeatherMap** - Weather data API
- **Cloudflare** - Secure tunnel service

---

## 📞 Support

For issues or questions:
1. Check the [Self-Hosting Guide](SELF_HOSTING_GUIDE.md)
2. Review logs: `docker-compose logs`
3. Run health check: `curl http://localhost:3000/api/health`
4. Monitor system: `./monitor.sh`

---

**Built with ❤️ for passionate photographers**

Start your photography coaching journey today! 📸
