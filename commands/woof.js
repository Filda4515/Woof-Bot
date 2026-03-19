const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const UserProfile = require("../schemas/UserProfile.js");
module.exports = {
    data: new SlashCommandBuilder()
        .setName("woof")
        .setDescription("woof settings")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("toggle")
                .setDescription("Turn on/off woofing.")
                .addBooleanOption((option) => option.setName("state").setDescription("woofing state").setRequired(true)),
        ),
    async execute(interaction) {
        let message = "";
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "toggle") {
            const state = interaction.options.getBoolean("state");

            let userProfile = await UserProfile.findOne({ discordId: interaction.user.id });
            if (!userProfile) {
                userProfile = new UserProfile({ discordId: interaction.user.id });
            }

            if (state) {
                userProfile.woofToggle = true;
                message = "I will from now on start woofing at you! You made me very happy!!!";
            } else {
                userProfile.woofToggle = false;
                message = "Ok... I will stop woofing at you, but know that makes me sad :(";
            }
            await userProfile.save();
        }

        await interaction.reply({
            content: message,
            flags: MessageFlags.Ephemeral,
        });
    },
};
