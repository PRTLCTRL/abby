# Abby Dashboard

A web dashboard for viewing and analyzing conversations with Abby, your AI baby coach.

## Features

- **Overview Statistics**: See total conversations, talk time, discussion topics, and sentiment analysis
- **Conversation History**: Browse all past conversations with full summaries, topics, concerns, and action items
- **Activity Logs**: View detailed activity logs filtered by category (feeding, sleep, diaper, etc.)
- **Interactive Charts**: Visualize conversation topics and sentiments with pie charts
- **Real-time Data**: Automatically fetches latest data from Abby server

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Abby server running (default: http://localhost:3002)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your Abby server URL (if different from default):
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build for production:

```bash
npm run build
npm start
```

## Usage

1. **Enter Phone Number**: On the first screen, enter your phone number (the one you use to call Abby)
2. **View Dashboard**: Explore your conversation stats, history, and activity logs
3. **Filter Activities**: Click category buttons to filter activity logs by type
4. **Switch Phone Number**: Click "Change Number" in the header to view data for a different number

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Formatting**: date-fns

## API Endpoints

The dashboard connects to these Abby server endpoints:

- `GET /api/conversations/:phoneNumber` - Fetch all conversations
- `GET /api/logs/:phoneNumber` - Fetch activity logs
- `GET /api/stats/:phoneNumber` - Fetch statistics and analytics

## Project Structure

```
dashboard/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main dashboard page
│   └── globals.css        # Global styles
├── components/
│   ├── PhoneNumberInput.tsx   # Phone number entry screen
│   ├── StatsOverview.tsx      # Statistics and charts
│   ├── ConversationList.tsx   # Conversation history
│   └── ActivityLogs.tsx       # Activity timeline
├── public/                # Static assets
└── package.json
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project to Vercel
3. Set environment variable: `NEXT_PUBLIC_API_URL=<your-abby-server-url>`
4. Deploy

## License

MIT
