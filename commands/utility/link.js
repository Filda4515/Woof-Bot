const { EmbedBuilder } = require("discord.js");
const config = require("../../config.json");
const LinkedUser = require("../../schemas/LinkedUser.js");

module.exports = {
    async execute(interaction) {
        const targetUser = interaction.options.getUser("user");
        const inputIgn = interaction.options.getString("ign").trim();

        try {
            const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${inputIgn}`);

            if (mojangResponse.status === 404) {
                return await interaction.editReply(`Could not find a Minecraft account with the name **${inputIgn}**.`);
            }
            if (!mojangResponse.ok) {
                return await interaction.editReply("Failed to contact the Mojang API. Please try again later.");
            }

            const mojangData = await mojangResponse.json();
            const realIgn = mojangData.name;
            const rawUuid = mojangData.id;

            const uuid = `${rawUuid.slice(0, 8)}-${rawUuid.slice(8, 12)}-${rawUuid.slice(12, 16)}-${rawUuid.slice(16, 20)}-${rawUuid.slice(20)}`;

            await LinkedUser.findOneAndUpdate({ discordId: targetUser.id }, { ign: realIgn, uuid: uuid }, { upsert: true, new: true });

            const embed = new EmbedBuilder()
                .setTitle("Account Linked")
                .setColor(config.colors.success)
                .setDescription(`Successfully linked <@${targetUser.id}> to Minecraft account **${realIgn}**.`)
                .setThumbnail(`https://mc-heads.net/avatar/${uuid}/100`);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error linking user:", error);
            await interaction.editReply("There was an internal error trying to link this user.");
        }
    },
};
