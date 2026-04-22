#!/bin/bash
# Deploy script for WhatsApp service on Fly.io

echo "🚀 Deploying WhatsApp Service to Fly.io..."

# Install fly CLI if not installed
if ! command -v fly &> /dev/null; then
    echo "Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="$HOME/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

# Login (will open browser)
echo "Please login to Fly.io:"
fly auth login

# Navigate to service directory
cd whatsapp-service-standalone

# Create the app (if not exists)
echo "Creating app..."
fly app create inova-whatsapp --org personal || echo "App may already exist"

# Create volume for session persistence
echo "Creating volume..."
fly volume create whatsapp_data --size 1 --region gru || echo "Volume may already exist"

# Set secrets
echo "Setting environment variables..."
fly secrets set SUPABASE_URL="https://cdzzewovtxotkghzeafr.supabase.co"
fly secrets set SUPABASE_KEY="your-supabase-key-here"

# Deploy
echo "Deploying..."
fly deploy

echo "✅ Done! Your WhatsApp service will be available at:"
echo "   https://inova-whatsapp.fly.dev"
echo ""
echo "To check status:"
echo "   fly status"
echo ""
echo "To view logs:"
echo "   fly logs"
