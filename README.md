# TUMfoolery

A Next.js sports betting prediction platform with AI-powered analysis, wallet integration, and real-time market data from Kalshi and Manifold.

## 🚀 Features

- **AI-Powered Analysis**: Gemini integration for bet analysis and market insights
- **Multi-Platform Markets**: Compare odds from TUMfoolery predictions, Kalshi, and Manifold
- **Crypto Wallet Integration**: Mock wallet connection with betting history tracking
- **User Authentication**: Secure NextAuth.js authentication with bcrypt password hashing
- **Betting History**: Track all bets with AI-powered post-game analysis
- **Real-time Updates**: Live market data and odds updates
- **Data Scraping**: Python scripts for EPL data collection and odds tracking

---

## 📋 Prerequisites

- **Node.js** 20.x or higher
- **Python** 3.8 or higher
- **PostgreSQL** database (local or cloud)

---

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/FamALouiz/TUMfoolery.git
cd TUMfoolery
```

### 2. Web Application Setup

#### Navigate to the web directory

```bash
cd web
```

#### Install dependencies

```bash
npm install
```

#### Configure Environment Variables

Create a `.env` file in the `web/` directory:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/tumfoolery"

# NextAuth Configuration
NEXTAUTH_SECRET="your-super-secret-key-here-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google Gemini AI API
GOOGLE_GEMINI_API_KEY="your-gemini-api-key-here"
```

**Environment Variables Explained:**

- **DATABASE_URL**: PostgreSQL connection string
  - Format: `postgresql://[username]:[password]@[host]:[port]/[database]`
  - Example: `postgresql://postgres:password@localhost:5432/tumfoolery`
- **NEXTAUTH_SECRET**: Secret key for NextAuth.js session encryption
  - Generate with: `openssl rand -base64 32`
  - Keep this secret and never commit to version control
- **NEXTAUTH_URL**: Base URL of your application
  - Development: `http://localhost:3000`
  - Production: Your deployed URL (e.g., `https://yourdomain.com`)
- **GOOGLE_GEMINI_API_KEY**: API key for Google Gemini AI
  - Get your key from: [Google AI Studio](https://aistudio.google.com/app/apikey)
  - Free tier available with rate limits
  - Used for AI bet analysis and chatbot

#### Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Seed the database
npx prisma db seed
```

#### Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

---

## 🗄️ Database Schema

The application uses Prisma ORM with PostgreSQL. Key models:

- **User**: Authentication, profile, wallet information
- **Bet**: Betting history with AI analysis
- **ChatMessage**: AI chatbot conversation history

To view/edit the schema:

```bash
cd web
npx prisma studio
```

---

## 📝 API Keys & External Services

### Required Services:

1. **Google Gemini API**
   - Purpose: AI analysis for bets and chatbot
   - Get key: [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Free tier: Available with rate limits
   - Variable: `GOOGLE_GEMINI_API_KEY`

---

## 🔧 Development Commands

### Web Application

```bash
cd web

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Database operations
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Create new migration
npx prisma migrate reset   # Reset database (dev only)
npx prisma generate        # Regenerate Prisma Client
```

## 🚀 Deployment

### Environment Variables for Production

Ensure these are set in your production environment:

```bash
DATABASE_URL="your-production-database-url"
NEXTAUTH_SECRET="your-production-secret"
NEXTAUTH_URL="https://yourdomain.com"
GOOGLE_GEMINI_API_KEY="your-gemini-api-key"
```

### Build & Deploy

```bash
cd web
npm run build
npm start
```

Or deploy to platforms like:

- Vercel (recommended for Next.js)
- Netlify
- AWS
- DigitalOcean

---

## 📚 Tech Stack

**Frontend & Backend:**

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion (animations)
- NextAuth.js (authentication)
- Prisma ORM

**AI & APIs:**

- Google Gemini 2.5 Flash
- Kalshi API
- Manifold API

**Data Processing:**

- Python 3.8+
- pandas, numpy
- requests
- fastparquet

**Database:**

- PostgreSQL
- Prisma

---

## 🔐 Security Notes

- Never commit `.env` files to version control
- Keep `NEXTAUTH_SECRET` secure and unique
- Rotate API keys regularly
- Use strong passwords for database credentials
- Enable HTTPS in production
- Set appropriate CORS policies

---

## 📖 Project Structure

```
TUMfoolery/
├── web/                      # Next.js application
│   ├── src/
│   │   ├── app/             # App router pages & API routes
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities & configurations
│   │   └── types/           # TypeScript types
│   ├── prisma/              # Database schema & migrations
│   ├── public/              # Static assets
│   └── .env                 # Environment variables (create this)
│
├── scripts/                  # Data scraping scripts
│   └── epl_scrapper/
│       ├── combined_epl_scrapper.py
│       ├── epl_scrapper.py
│       ├── requirements.txt
│       └── .env             # Python env vars (optional)
│
└── data/                     # Generated datasets
    ├── epl_dataset.csv
    └── epl_odds_*.csv
```

---

### Gemini API Rate Limits

- Free tier: 60 requests per minute
- If you hit limits, wait a minute or upgrade to paid tier
- Check quota: [Google Cloud Console](https://console.cloud.google.com/)

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

**Happy Betting! 🎲⚽**
