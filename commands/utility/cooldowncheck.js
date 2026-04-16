const { EmbedBuilder } = require("discord.js");
const { fetchWynncraft } = require("../../functions/apiCalls.js");
const config = require("../../config.json");

module.exports = {
    async execute(interaction) {
        const result = await fetchWynncraft("/guild/prefix/Sort?identifier=uuid");
        if (!result.success) {
            return await interaction.editReply(result.error);
        }
        const guildData = await result.data;

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
            let itemsShown = 0;
            for (const u of pendingUsers) {
                const escapedName = u.username.replace(/_/g, "\\_");
                const line = `${escapedName}: <t:${u.eligibleDateSecs}:R>`;

                if (pendingText.length + line.length + 50 > 1024) {
                    break;
                }
                pendingText += line + "\n";
                itemsShown++;
            }

            if (pendingUsers.length > itemsShown) {
                pendingText += `*...and ${pendingUsers.length - itemsShown} more.*`;
            }
        }

        let promotionText = "";
        if (needsPromotion.length === 0) {
            promotionText = "No recruits are pending promotion.";
        } else {
            let itemsShown = 0;
            for (const u of needsPromotion) {
                const escapedName = u.username.replace(/_/g, "\\_");
                const line = `${escapedName} (Joined <t:${u.joinDateSecs}:R>)`;

                if (promotionText.length + line.length + 50 > 1024) {
                    break;
                }
                promotionText += line + "\n";
                itemsShown++;
            }

            if (needsPromotion.length > itemsShown) {
                promotionText += `*...and ${needsPromotion.length - itemsShown} more.*`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`Cooldown & Promotion Check: ${guildData.name}`)
            .setColor(config.colors.info)
            .addFields(
                { name: "Members under 7 days", value: pendingText, inline: false },
                { name: "Recruits with 7+ days", value: promotionText, inline: false },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
