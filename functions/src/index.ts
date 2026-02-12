import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

admin.initializeApp();

// User-Agent patterns for social media crawlers / link preview bots
const BOT_AGENTS = [
    "whatsapp",
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "telegrambot",
    "discordbot",
    "pinterest",
    "googlebot",
    "bingbot",
];

function isBot(userAgent: string): boolean {
    const ua = userAgent.toLowerCase();
    return BOT_AGENTS.some((bot) => ua.includes(bot));
}

/**
 * Serves dynamic Open Graph meta tags for social media link previews.
 * When a bot/crawler requests a page like /canopus/register, this function:
 *   1. Extracts the school slug from the URL
 *   2. Fetches the school's data (name, logo) from Firestore
 *   3. Returns HTML with the correct OG tags so WhatsApp/Facebook etc.
 *      show the school-specific logo and name in the link preview
 *
 * For normal users (non-bot), it serves the standard index.html SPA.
 */
export const ogMetaServer = functions.https.onRequest(async (req, res) => {
    const userAgent = req.headers["user-agent"] || "";

    // Only intercept for bots/crawlers
    if (!isBot(userAgent)) {
        // Serve the normal SPA index.html
        const indexPath = path.join(__dirname, "..", "..", "dist", "index.html");
        if (fs.existsSync(indexPath)) {
            res.set("Content-Type", "text/html");
            res.status(200).send(fs.readFileSync(indexPath, "utf8"));
        } else {
            res.status(404).send("Not found");
        }
        return;
    }

    // Extract school slug from URL path
    // e.g. /canopus/register → slug = "canopus"
    const urlPath = req.path || "/";
    const segments = urlPath.split("/").filter(Boolean);

    // Reserved top-level routes that are NOT school slugs
    const reserved = [
        "login", "register", "admin", "dashboard", "settings",
        "students", "teachers", "fees", "attendance", "exams",
        "transport", "library", "communication", "calendar",
        "reports", "accounts", "smghs",
    ];

    let schoolSlug = "";
    if (segments.length > 0 && !reserved.includes(segments[0])) {
        schoolSlug = segments[0];
    }

    // Default OG values
    let ogTitle = "AI School 360 - India's First AI based ERP System";
    let ogDescription = "Complete school management solution powered by AI. Manage admissions, fees, attendance, exams, and more.";
    let ogImage = `https://${req.hostname}/logo.png`;
    let ogUrl = `https://${req.hostname}${urlPath}`;

    // Determine page type from remaining segments
    const pageType = segments.length > 1 ? segments[1] : "";

    if (schoolSlug) {
        try {
            // Fetch school data from Firestore
            let schoolDoc = await admin.firestore()
                .collection("schools")
                .doc(schoolSlug)
                .get();

            // Fallback: try with leading slash (legacy data)
            if (!schoolDoc.exists) {
                schoolDoc = await admin.firestore()
                    .collection("schools")
                    .doc(`/${schoolSlug}`)
                    .get();
            }

            if (schoolDoc.exists) {
                const school = schoolDoc.data()!;
                const schoolName = school.fullName || school.name || schoolSlug;
                const schoolLogo = school.logoUrl || school.logo || "";

                if (schoolLogo) {
                    ogImage = schoolLogo;
                }

                // Customize OG title/description based on page type
                switch (pageType) {
                    case "register":
                        ogTitle = `Register at ${schoolName}`;
                        ogDescription = `Apply for admission at ${schoolName}. Fill out the online registration form now.`;
                        break;
                    case "login":
                        ogTitle = `${schoolName} - Login Portal`;
                        ogDescription = `Access the ${schoolName} portal. Login for parents, teachers, and staff.`;
                        break;
                    default:
                        ogTitle = schoolName;
                        ogDescription = `Welcome to ${schoolName}. Powered by AI School 360.`;
                        break;
                }
            }
        } catch (error) {
            console.error("Error fetching school data for OG tags:", error);
            // Fall back to defaults
        }
    }

    // Serve HTML with dynamic OG meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(ogUrl)}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <title>${escapeHtml(ogTitle)}</title>
  <link rel="icon" type="image/png" href="/logo.png" />
</head>
<body>
  <p>${escapeHtml(ogDescription)}</p>
</body>
</html>`;

    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.status(200).send(html);
});

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
