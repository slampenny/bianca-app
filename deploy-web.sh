#!/bin/bash

# Web Frontend Deployment Script
echo "🚀 Deploying MyPhoneFriend Web Frontend..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the bianca-app-frontend directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the web version
echo "🔨 Building web version..."
npm run build:web

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo "🎉 Deployment completed!"
echo "📱 Your web app should be available at: https://app.myphonefriend.com"
echo "📋 Don't forget to:"
echo "   1. Configure your custom domain in Vercel dashboard"
echo "   2. Update DNS records to point to Vercel"
echo "   3. Test the privacy policy and terms links" 