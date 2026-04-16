const { EmbedBuilder } = require("discord.js");
const { fetchMojang } = require("../../functions/apiCalls.js");
const config = require("../../config.json");
const LinkedUser = require("../../schemas/LinkedUser.js");

module.exports = {
    async execute(interaction) {
        const targetUser = interaction.options.getUser("user");
        const inputIgn = interaction.options.getString("ign").trim();

        const result = await fetchMojang(inputIgn);
        if (!result.success) {
            return await interaction.editReply(result.error);
        }

        const mojangData = result.data;
        const realIgn = mojangData.name;
        const rawUuid = mojangData.id;

        const uuid = `${rawUuid.slice(0, 8)}-${rawUuid.slice(8, 12)}-${rawUuid.slice(12, 16)}-${rawUuid.slice(16, 20)}-${rawUuid.slice(20)}`;

        await LinkedUser.findOneAndUpdate(
            { discordId: targetUser.id },
            { ign: realIgn, uuid: uuid },
            { upsert: true, returnDocument: "after" },
        );

        const embed = new EmbedBuilder()
            .setTitle("Account Linked")
            .setColor(config.colors.success)
            .setDescription(`Successfully linked <@${targetUser.id}> to Minecraft account **${realIgn}**.`)
            .setThumbnail(`https://mc-heads.net/avatar/${uuid}/100`);

        await interaction.editReply({ embeds: [embed] });
    },
};
