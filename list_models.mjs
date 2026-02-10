const apiKey = process.argv[2];
if (!apiKey) {
    console.error("API Key missing");
    process.exit(1);
}

async function listModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("API ERROR:", JSON.stringify(data.error, null, 2));
            process.exit(1);
        }

        console.log("AVAILABLE_MODELS_START");
        const contentModels = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));
        console.log(JSON.stringify(contentModels, null, 2));
        console.log("AVAILABLE_MODELS_END");
    } catch (e) {
        console.error("Fetch Error:", e);
        process.exit(1);
    }
}

listModels();
