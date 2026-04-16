const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("utility")
        .setDescription("Utility commands")
        .addSubcommand((subcommand) => subcommand.setName("checkroles").setDescription("Checks discord roles"))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("link")
                .setDescription("Link a Discord user to a Minecraft IGN")
                .addUserOption((option) => option.setName("user").setDescription("Discord user to link").setRequired(true))
                .addStringOption((option) => option.setName("ign").setDescription("Minecraft IGN").setRequired(true)),
        )
        .addSubcommand((subcommand) =>
            subcommand.setName("cooldowncheck").setDescription("Check members under the 7-day cooldown and who needs recruiter promotion"),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("whois")
                .setDescription("Check the linked Minecraft account of a Discord user")
                .addUserOption((option) => option.setName("user").setDescription("Discord user to look up").setRequired(true)),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("lookup")
                .setDescription("Check the Discord user linked to a Minecraft account")
                .addStringOption((option) => option.setName("ign").setDescription("Minecraft IGN to look up").setRequired(true)),
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        const subcommandPath = path.join(__dirname, "./utility", `${subcommand}.js`);
        if (fs.existsSync(subcommandPath)) {
            try {
                const subcommandFile = require(subcommandPath);
                await subcommandFile.execute(interaction);
            } catch (error) {
                console.error(`Error in /utility ${subcommand}:`, error);

                let failMsg = "An unexpected internal error occurred while running the command.";

                if (error.name === "GatewayRateLimitError") {
                    let waitTime = error.data?.retry_after ? Math.ceil(error.data.retry_after) : 60;

                    failMsg = `Rate-limited by Discord. Please try again in **${waitTime} seconds**.`;
                }

                await interaction.editReply(failMsg);
            }
        } else {
            await interaction.editReply(`The subcommand \`${subcommand}\` is not implemented yet!`);
        }
    },
};
