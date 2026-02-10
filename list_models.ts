import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
    const apiKey = process.argv[2];
    if (!apiKey) {
        console.error("API Key missing");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        console.log(`Fetching from: https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.substring(0, 5)}...`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.error) {
            console.error("API ERROR:", JSON.stringify(data.error, null, 2));
            return;
        }
        if (!data.models) {
            console.error("NO MODELS RETURNED:", JSON.stringify(data, null, 2));
            return;
        }
        console.log("AVAILABLE MODELS:");
        const contentModels = data.models.filter((m: any) => m.supportedGenerationMethods.includes("generateContent"));
        console.log(JSON.stringify(contentModels.map((m: any) => m.name.replace('models/', '')), null, 2));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
