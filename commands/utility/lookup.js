const { EmbedBuilder } = require("discord.js");
const config = require("../../config.json");
const LinkedUser = require("../../schemas/LinkedUser.js");

module.exports = {
    async execute(interaction) {
        const targetIgn = interaction.options.getString("ign").trim();

        try {
            const linkedData = await LinkedUser.findOne({
                ign: new RegExp(`^${targetIgn}$`, "i"),
            });

            if (!linkedData) {
                return await interaction.editReply(
                    `No Discord user is currently linked to a Minecraft account **${targetIgn}** in the database.`,
                );
            }

            const embed = new EmbedBuilder()
                .setTitle("Account Lookup")
                .setColor(config.colors.info)
                .setDescription(`The Minecraft account **${linkedData.ign}** is linked to the Discord user <@${linkedData.discordId}>.`)
                .setThumbnail(`https://mc-heads.net/avatar/${linkedData.uuid}/100`);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error fetching lookup data:", error);
            await interaction.editReply("An error occurred while looking up this Minecraft account.");
        }
    },
};
