# Guide: How to Create a Google Maps API Key

To enable live bus tracking, you need a Google Maps API Key. Follow these steps:

### 1. Go to Google Cloud Console
- Log in to [Google Cloud Console](https://console.cloud.google.com/) with your Google account.

### 2. Create a New Project
- At the top, click on the project dropdown.
- Click **"New Project"**.
- Name it **"Millat ERP Tracking"** and click **Create**.
- Make sure this new project is selected in the dropdown.

### 3. Enable Maps JavaScript API
- In the sidebar, go to **APIs & Services > Library**.
- Search for **"Maps JavaScript API"**.
- Click on it and click **"ENABLE"**.

### 4. Create API Key
- In the sidebar, go to **APIs & Services > Credentials**.
- Click **"+ CREATE CREDENTIALS"** at the top.
- Select **"API key"**.
- A window will pop up with your new API key. **Copy it.**

### 5. Setup for Millat ERP
- Open your Millat ERP Admin Panel.
- Go to **Settings > Global Settings**.
- Look for the **"Google Maps API Key"** box (I am adding this now).
- Paste your key there and it will be saved automatically.

---
**Note:** Google provides a free tier, but you might need to link a billing account (credit/debit card) to activate the key, even if you stay within the free limits.
