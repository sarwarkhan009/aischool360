# Google Maps API Pricing & Free Limits (2025-2026)

Google Maps Platform uses a **pay-as-you-go** pricing model. However, they provide a significant "Free Tier" that covers most small-to-medium school ERP usage.

> [!IMPORTANT]
> **Key Change (March 1, 2025):** Google is transitioning from a flat $200 monthly credit to **Product-Specific Free Limits**. Instead of one shared credit, you now get a fixed number of free requests for each specific tool (SKU).

## 1. Free Usage Limits (Monthly)
Most features used in Millat ERP fall under the **Essentials** or **Pro** categories.

| API / Feature | Free Requests per Month | Category |
| :--- | :--- | :--- |
| **Dynamic Maps (JS API)** | **10,000 Loads** | Essentials |
| **Static Maps** | **10,000 Requests** | Essentials |
| **Geocoding (Address to Lat/Lng)** | **5,000 Requests** | Pro |
| **Places Nearby Search** | **5,000 Requests** | Pro |
| **Directions API** | **5,000 Requests** | Pro |

### What this means for Millat ERP:
*   **Live Tracking Map:** Every time an Admin or Parent opens the live map, it counts as **1 Map Load**. 
*   If your school has 10 active bus tracking sessions per day, that's ~300 loads/month—well within the **10,000 free** limit.
*   **Embed API:** Basic embedded maps remain **Unlimited Free**.

## 2. Pricing Beyond Free Tier
If you exceed these limits, you are billed per 1,000 additional requests.

*   **Dynamic Maps:** ~$7.00 per 1,000 loads.
*   **Geocoding / Directions:** ~$5.00 per 1,000 requests.

## 3. How to Prevent Unexpected Charges
To ensure you never pay a single rupee, you should set **Daily Quotas** in your Google Cloud Console.

### Steps to Set Limits:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Navigate to **APIs & Services > Dashboard**.
3.  Click on **"Maps JavaScript API"**.
4.  Go to the **Quotas** tab.
5.  Set the **"Map loads per day"** to a safe number (e.g., **300**).
    *   *Calculation: 10,000 free / 30 days ≈ 333 per day.*

## 4. Best Practices for Millat ERP
*   **Avoid Refreshing:** Don't keep the Map page open and refresh it repeatedly, as each refresh is a new "Load".
*   **Close when Done:** Encourage Admins to close the Live Map tab when it's not actively being monitored.
*   **Billing Alerts:** Set up a "Billing Alert" in Google Cloud for $1. This will email you if you ever spend even a cent.

---
*Last Updated: January 2026*
