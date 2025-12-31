# Foto - AI Photography Coach

A personalized photography coaching platform that generates daily challenges, photo tour itineraries, and tracks your photography journey.

## Live Demo

**https://myfoto.topues.com**

## Features

### 📸 AI Photography Challenges
- **Weekend Deep Dive** - 2-4 hour comprehensive exploration
- **Lunch Break** - 30-45 minute quick creative burst
- **After Work** - 1-2 hour golden hour session
- **WFH Micro** - 15-20 minute creative break at home

### 🗺️ Photo Tour Itineraries
- AI-generated walking tours for any location
- Customizable duration (1-2 hours to full day)
- Photo spot recommendations with descriptions
- Gear suggestions based on your equipment

### 📊 Progress Tracking
- Challenge completion stats
- Streak tracking
- Photography journey history

### 💬 AI Chat Coach
- Personalized photography advice
- Gear recommendations
- Technique guidance

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Abacus.AI LLM APIs
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Email**: SendGrid
- **Weather**: OpenWeatherMap API

## Project Structure

```
foto_app/
├── nextjs_space/           # Next.js application
│   ├── app/                # App router pages & API routes
│   ├── components/         # React components
│   ├── lib/                # Utilities (db, email, llm, weather)
│   ├── prisma/             # Database schema
│   └── public/             # Static assets
├── SELF_HOSTING_GUIDE.md   # Self-hosting instructions
├── GITHUB_SETUP_INSTRUCTIONS.md
└── SYSTEM_DOCUMENTATION.md # Technical documentation
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- API keys for: Abacus.AI, SendGrid, OpenWeatherMap

### Installation

```bash
# Clone the repository
git clone https://github.com/topues/foto-photography-coach.git
cd foto-photography-coach

# Install dependencies
cd nextjs_space
yarn install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Set up database
yarn prisma generate
yarn prisma db push
yarn prisma db seed

# Start development server
yarn dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/fotoai
NEXTAUTH_SECRET=your-secret
ABACUSAI_API_KEY=your-abacus-api-key
SENDGRID_API_KEY=your-sendgrid-key
OPENWEATHERMAP_API_KEY=your-weather-key
FROM_EMAIL=your-verified-sender@domain.com
USER_EMAIL=default-user@email.com
```

## Documentation

- [Self-Hosting Guide](SELF_HOSTING_GUIDE.md) - Deploy on your own server
- [System Documentation](SYSTEM_DOCUMENTATION.md) - Technical architecture
- [GitHub Setup](GITHUB_SETUP_INSTRUCTIONS.md) - Repository setup

## License

MIT License
