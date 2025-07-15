# 🌺 Quick Start Guide

## Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Google Places API key:
   ```env
   GOOGLE_PLACES_API_KEY=your_actual_google_places_api_key_here
   DATABASE_URL=postgresql://username:password@localhost:5432/hawaii_planner
   ```

3. **Run locally** (requires PostgreSQL):
   ```bash
   npm run dev
   ```

## 🚀 Deploy to Railway (Recommended)

**Follow the complete guide in `DEPLOYMENT.md` for step-by-step instructions.**

### Quick Railway Deployment Steps:

1. **Sign up at [Railway](https://railway.app)**

2. **Connect your GitHub repository**

3. **Add PostgreSQL database**:
   - Click "New" → "Database" → "PostgreSQL"

4. **Set environment variables**:
   - `DATABASE_URL`: Copy from Railway PostgreSQL service
   - `GOOGLE_PLACES_API_KEY`: Your Google API key

5. **Deploy and access your app**!

## 🗺️ Google Places API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Places API"
3. Create an API key
4. Add to your `.env` file and Railway environment variables

## Need Help?

- 📖 **Full deployment guide**: See `DEPLOYMENT.md`
- 🐛 **Issues**: Check Railway build logs
- 💡 **Features**: Check `README.md`

**Your Hawaii Itinerary Planner will be live in minutes! 🌺** 