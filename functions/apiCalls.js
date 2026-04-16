async function fetchApi(url, apiName) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (response.status === 404 && apiName === "Mojang") {
            const requestedName = url.split('/').pop();
            return {
                success: false,
                error: `Could not find a Minecraft account with the name **${requestedName}**.`,
            };
        }

        if (response.status === 429) {
            const resetTime = response.headers.get("RateLimit-Reset") || "60";
            return {
                success: false,
                error: `Rate-limited by the ${apiName} API. Please try again in **${resetTime} seconds**.`,
            };
        }

        if (!response.ok) {
            return {
                success: false,
                error: `The ${apiName} API returned a bad response (HTTP ${response.status}). It might be down.`,
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
                error: `The ${apiName} API took too long to respond and timed out. Please try again later.`,
            };
        }

        console.error(`Error while fetching ${apiName} API:`, error);
        return {
            success: false,
            error: `An unexpected internal error occurred while connecting to ${apiName} API.`,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = {
    async fetchWynncraft(endpoint) {
        return await fetchApi(`https://api.wynncraft.com/v3${endpoint}`, "Wynncraft");
    },
    async fetchMojang(username) {
        return await fetchApi(`https://api.mojang.com/users/profiles/minecraft/${username}`, "Mojang");
    },
};
