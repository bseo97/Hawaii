# 🚀 Railway Deployment Guide - Hawaii Itinerary Planner

This guide will walk you through deploying your Hawaii Itinerary Planner to Railway with PostgreSQL database and Google Places API integration.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Google Cloud Account**: For Google Places API key
3. **Git Repository**: Your code should be in a Git repository (GitHub recommended)

## Step 1: Prepare Your Environment Variables

### 1.1 Get Your Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Places API
   - Places API (New)
   - Maps JavaScript API (optional, for enhanced features)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key (keep it secure!)
6. **Important**: Restrict your API key:
   - Go to API restrictions and select "Places API"
   - For production, add your Railway domain to HTTP referrers

### 1.2 Create Your Local .env File

```bash
# Create .env file in your project root
cp .env.example .env
```

Edit `.env` with your values:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/hawaii_planner
GOOGLE_PLACES_API_KEY=your_actual_google_places_api_key_here
PORT=3000
```

## Step 2: Deploy to Railway

### 2.1 Connect Your Repository

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Select your repository
5. Railway will automatically detect it's a Node.js project

### 2.2 Initial Deployment

1. Railway will start building your app automatically
2. The build will initially fail because we haven't set up the database yet
3. That's expected! We'll fix it in the next steps

## Step 3: Set Up PostgreSQL Database

### 3.1 Add PostgreSQL Service

1. In your Railway project dashboard, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will create a PostgreSQL instance
4. Wait for it to deploy (usually 1-2 minutes)

### 3.2 Get Database Connection Details

1. Click on your PostgreSQL service
2. Go to the **"Connect"** tab
3. Copy the **PostgreSQL Connection URL**
4. It will look like: `postgresql://postgres:password@host:port/database`

## Step 4: Configure Environment Variables

### 4.1 Set Environment Variables in Railway

1. Go to your app service (not the database)
2. Click on the **"Variables"** tab
3. Add these environment variables:

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `DATABASE_URL` | Your PostgreSQL connection URL | Copy from database service |
| `GOOGLE_PLACES_API_KEY` | Your Google API key | From Step 1.1 |
| `NODE_ENV` | `production` | Optional, for production optimizations |

### 4.2 Add Variables One by One

Click **"New Variable"** for each:

1. **DATABASE_URL**:
   - Variable: `DATABASE_URL`
   - Value: `postgresql://postgres:password@host:port/database` (your actual URL)

2. **GOOGLE_PLACES_API_KEY**:
   - Variable: `GOOGLE_PLACES_API_KEY` 
   - Value: Your actual API key

3. **NODE_ENV** (optional):
   - Variable: `NODE_ENV`
   - Value: `production`

## Step 5: Deploy and Test

### 5.1 Trigger Redeploy

1. After adding environment variables, click **"Deploy"** or **"Redeploy"**
2. Wait for the deployment to complete
3. Check the build logs for any errors

### 5.2 Verify Database Tables

Your app will automatically create the required database tables on first run:
- `trips`
- `days` 
- `activities`

### 5.3 Access Your Deployed App

1. Go to the **"Settings"** tab in your app service
2. Find the **"Domains"** section
3. Your app will be available at: `https://your-app-name.up.railway.app`

## Step 6: Domain Configuration (Optional)

### 6.1 Custom Domain

1. In Railway, go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Enter your domain name
4. Update your DNS records as instructed

### 6.2 Update Google API Key Restrictions

1. Go back to Google Cloud Console
2. Edit your API key restrictions
3. Add your Railway domain to allowed referrers:
   - `https://your-app-name.up.railway.app/*`
   - `https://your-custom-domain.com/*` (if using custom domain)

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check DATABASE_URL is correctly formatted
   - Ensure PostgreSQL service is running
   - Verify the connection string from Railway dashboard

2. **Google Places API Not Working**:
   - Verify API key is correct
   - Check API is enabled in Google Cloud Console
   - Ensure API key has proper restrictions

3. **Build Failures**:
   - Check build logs in Railway dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

4. **Port Issues**:
   - Railway automatically sets PORT environment variable
   - Your app already listens on `process.env.PORT || 3000`

### Useful Railway Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy from command line
railway up

# View logs
railway logs

# Open your deployed app
railway open
```

## Environment Variables Summary

Here's what Railway should show in your Variables tab:

```
DATABASE_URL=postgresql://postgres:password@host:port/database
GOOGLE_PLACES_API_KEY=ya29.your_actual_api_key_here
NODE_ENV=production
PORT=3000 (automatically set by Railway)
```

## Security Best Practices

1. **Never commit .env to git** - it's already in .gitignore
2. **Restrict your Google API key** to your domain only
3. **Use Railway's built-in environment variables** for sensitive data
4. **Enable Railway's automatic HTTPS** (enabled by default)

## Next Steps

1. Test all functionality:
   - Adding/removing days
   - Adding activities with location search
   - Real-time collaboration
   - CSV export functionality

2. Monitor your app:
   - Check Railway dashboard for metrics
   - Monitor database usage
   - Watch for any error logs

3. Scale if needed:
   - Railway automatically scales based on usage
   - Monitor your Google Places API quota

---

## Support

If you encounter any issues:

1. Check Railway's build and runtime logs
2. Verify all environment variables are set correctly
3. Test your Google API key in Google Cloud Console
4. Check the Railway documentation at [docs.railway.app](https://docs.railway.app)

**Your Hawaii Itinerary Planner should now be live on Railway! 🌺** 