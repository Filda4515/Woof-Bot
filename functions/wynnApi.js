async function fetchWynncraft(endpoint) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(`https://api.wynncraft.com/v3${endpoint}`, {
            signal: controller.signal,
        });

        if (response.status === 429) {
            const resetTime = response.headers.get("RateLimit-Reset") || "60";
            return {
                success: false,
                error: `Rate-limited by the Wynncraft API. Please try again in **${resetTime} seconds**.`,
            };
        }

        if (!response.ok) {
            return {
                success: false,
                error: `The Wynncraft API returned a bad response (HTTP ${response.status}). It might be down.`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            data: data,
        };
    } catch (error) {
        if (error.name === "AbortError" || (error.cause && error.cause.code === "UND_ERR_CONNECT_TIMEOUT")) {
            return {
                success: false,
                error: "The Wynncraft API took too long to respond and timed out. Please try again later.",
            };
        }

        console.error("[WynnAPI Fetch Error]:", error);
        return {
            success: false,
            error: "An unexpected internal error occurred while connecting to Wynncraft API.",
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = { fetchWynncraft };
