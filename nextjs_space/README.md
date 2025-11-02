
# Foto - AI Photography Coach

A professional AI-powered photography coaching web application featuring personalized itineraries, daily challenges, and expert guidance.

## Features

- 🎯 **Personalized Coaching**: AI coach tailored to your gear and photography style
- 📍 **Location-based Itineraries**: Get photography plans based on your location
- 📸 **Daily Challenges**: Improve your skills with targeted daily photo challenges
- 🎨 **Multiple Photography Styles**: Street, travel, landscape, and storytelling photography
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Animations**: Framer Motion
- **AI Integration**: Abacus.AI ChatLLM

## Getting Started

### Prerequisites

- Node.js 18+ 
- Yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sesal78/foto-photography-coach.git
cd foto-photography-coach
```

2. Install dependencies:
```bash
yarn install
```

3. Run the development server:
```bash
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/                  # Next.js app directory
│   ├── page.tsx         # Home page
│   ├── about/           # About page
│   ├── chat/            # Chat interface with AI coach
│   └── layout.tsx       # Root layout
├── components/          # React components
│   ├── sections/        # Page sections
│   ├── ui/             # UI components (shadcn/ui)
│   ├── navbar.tsx      # Navigation bar
│   └── footer.tsx      # Footer
├── lib/                # Utility functions
└── public/             # Static assets
```

## Deployment

This app is deployed at [myfoto.topues.com](https://myfoto.topues.com)

### Building for Production

```bash
yarn build
yarn start
```

## Photography Gear Supported

- Fujifilm X-T5
- Ricoh GR IIIx
- Nikon FE2
- Pentax ME

## License

Private - All rights reserved

## Author

Built by Seun - Professional Photography Coach

---

For questions or support, visit the [chat page](https://myfoto.topues.com/chat) to connect with Foto AI.
