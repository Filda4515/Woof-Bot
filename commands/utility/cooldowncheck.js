const { EmbedBuilder } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    async execute(interaction) {
        try {
            const response = await fetch("https://api.wynncraft.com/v3/guild/prefix/Sort?identifier=uuid");
            if (!response.ok) {
                return interaction.editReply("Failed to fetch data from Wynncraft API.");
            }
            const guildData = await response.json();

            const nowSecs = Math.floor(Date.now() / 1000);
            const SEVEN_DAYS_SECS = 7 * 86400;

            const pendingUsers = [];
            const needsPromotion = [];

            for (const [rank, players] of Object.entries(guildData.members)) {
                if (rank === "total") continue;

                for (const [_, data] of Object.entries(players)) {
                    const username = data.username || "Unknown";
                    const joinedStr = data.joined;
                    if (!joinedStr) continue;

                    const joinDateSecs = Math.floor(new Date(joinedStr).getTime() / 1000);
                    const eligibleDateSecs = joinDateSecs + SEVEN_DAYS_SECS;

                    if (nowSecs < eligibleDateSecs) {
                        pendingUsers.push({ username, eligibleDateSecs });
                    } else if (nowSecs >= eligibleDateSecs && rank === "recruit") {
                        needsPromotion.push({ username, joinDateSecs });
                    }
                }
            }

            pendingUsers.sort((a, b) => a.eligibleDateSecs - b.eligibleDateSecs);
            needsPromotion.sort((a, b) => a.joinDateSecs - b.joinDateSecs);

            let pendingText = "";
            if (pendingUsers.length === 0) {
                pendingText = "Everyone has been in the guild for 7 days or more!\n";
            } else {
                pendingText = pendingUsers
                    .map((u) => {
                        const escapedName = u.username.replace(/_/g, "\\_");
                        return `${escapedName}: <t:${u.eligibleDateSecs}:R>`;
                    })
                    .join("\n");
            }

            let promotionText = "";
            if (needsPromotion.length === 0) {
                promotionText = "No recruits are pending promotion.";
            } else {
                promotionText = needsPromotion
                    .map((u) => {
                        const escapedName = u.username.replace(/_/g, "\\_");
                        return `${escapedName} (Joined <t:${u.joinDateSecs}:R>)`;
                    })
                    .join("\n");
            }

            if (pendingText.length > 1024) pendingText = pendingText.substring(0, 1020) + "...";
            if (promotionText.length > 1024) promotionText = promotionText.substring(0, 1020) + "...";

            const embed = new EmbedBuilder()
                .setTitle(`Cooldown & Promotion Check: ${guildData.name}`)
                .setColor(config.colors.info)
                .addFields(
                    { name: "Members under 7 days", value: pendingText, inline: false },
                    { name: "Recruits with 7+ days", value: promotionText, inline: false },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error executing cooldowncheck:", error);
            await interaction.editReply("An error occurred while checking the cooldowns.");
        }
    },
};
