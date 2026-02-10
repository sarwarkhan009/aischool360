#!/bin/bash

# AI School 360 - Notification Setup Script
# This script helps you set up push notifications quickly

echo "🚀 AI School 360 - Notification Setup"
echo "======================================"
echo ""

# Check if notification sound exists
if [ ! -f "public/notification.mp3" ]; then
    echo "⚠️  WARNING: notification.mp3 not found in public/ folder"
    echo ""
    echo "Please download a notification sound and place it in public/notification.mp3"
    echo ""
    echo "Free notification sounds:"
    echo "  - https://notificationsounds.com/"
    echo "  - https://mixkit.co/free-sound-effects/notification/"
    echo ""
    read -p "Press Enter to continue after adding the sound file..."
fi

# Check VAPID key
echo "📝 Checking VAPID Key configuration..."
echo ""

if grep -q "YOUR_VAPID_KEY_HERE" src/lib/notifications.ts; then
    echo "❌ VAPID Key not configured!"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to https://console.firebase.google.com/"
    echo "2. Select project: ai-school360"
    echo "3. Settings ⚙️  > Project settings > Cloud Messaging"
    echo "4. Scroll to 'Web Push certificates'"
    echo "5. Click 'Generate key pair'"
    echo "6. Copy the key"
    echo "7. Update src/lib/notifications.ts with your key"
    echo ""
    read -p "Enter your VAPID key (or press Enter to skip): " vapid_key
    
    if [ ! -z "$vapid_key" ]; then
        # Update VAPID key in notifications.ts
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/YOUR_VAPID_KEY_HERE/$vapid_key/" src/lib/notifications.ts
        else
            # Linux
            sed -i "s/YOUR_VAPID_KEY_HERE/$vapid_key/" src/lib/notifications.ts
        fi
        echo "✅ VAPID key updated successfully!"
    fi
else
    echo "✅ VAPID Key is configured"
fi

echo ""
echo "🎉 Setup check complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Open parent dashboard and allow notifications"
echo "3. Test by posting a notice or homework from admin/teacher"
echo ""
echo "📖 For detailed documentation, see:"
echo "   - NOTIFICATIONS_SETUP.md (English)"
echo "   - NOTIFICATIONS_SETUP_HINDI.md (हिंदी)"
echo ""
