# Longevity Dashboard

A personal longevity dashboard that connects to the Whoop API to display health metrics and trends.

## Features

- OAuth authentication with Whoop
- Real-time health metrics display:
  - HRV (Heart Rate Variability)
  - Sleep (hours + quality)
  - Recovery score
  - Strain
- Today's metrics overview
- 30-day trend charts

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualizations

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Whoop OAuth credentials:
     ```
     WHOOP_CLIENT_ID=your_client_id_here
     WHOOP_CLIENT_SECRET=your_client_secret_here
     NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/callback
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Whoop OAuth Setup

To get your Whoop OAuth credentials:

1. Go to [Whoop Developer Portal](https://developer.whoop.com/)
2. Create a new application
3. Set the redirect URI to: `http://localhost:3000/callback`
4. Copy your Client ID and Client Secret to `.env.local`

## Project Structure

```
├── app/
│   ├── api/
│   │   └── whoop/
│   │       └── route.ts          # API route for Whoop data
│   ├── callback/
│   │   └── route.ts              # OAuth callback handler
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard home
│   └── globals.css               # Global styles
├── components/
│   ├── Dashboard.tsx             # Main dashboard component
│   ├── MetricCard.tsx            # Metric display card
│   └── TrendChart.tsx            # Chart component
├── lib/
│   └── whoop.ts                  # Whoop API client functions
└── package.json
```

## API Endpoints

- `GET /api/whoop?type=recovery&start=YYYY-MM-DD&end=YYYY-MM-DD` - Fetch recovery data
- `GET /api/whoop?type=sleep&start=YYYY-MM-DD&end=YYYY-MM-DD` - Fetch sleep data
- `GET /api/whoop?type=workout&start=YYYY-MM-DD&end=YYYY-MM-DD` - Fetch workout data
- `GET /api/whoop?type=profile` - Fetch user profile

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
