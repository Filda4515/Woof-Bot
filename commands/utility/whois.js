const { EmbedBuilder } = require("discord.js");
const config = require("../../config.json");
const LinkedUser = require("../../schemas/LinkedUser.js");

module.exports = {
    async execute(interaction) {
        const targetUser = interaction.options.getUser("user");

        const linkedData = await LinkedUser.findOne({ discordId: targetUser.id });

        if (!linkedData) {
            return await interaction.editReply(`<@${targetUser.id}> is not currently linked to a Minecraft account in the database.`);
        }

        const embed = new EmbedBuilder()
            .setTitle("Account Lookup")
            .setColor(config.colors.info)
            .setDescription(`<@${targetUser.id}> is linked to the Minecraft account **${linkedData.ign}**.`)
            .setThumbnail(`https://mc-heads.net/avatar/${linkedData.uuid}/100`);

        await interaction.editReply({ embeds: [embed] });
    },
};
