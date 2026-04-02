const { Events, MessageFlags } = require("discord.js");

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const username = interaction.user.username;
        const params = interaction.options.data
            .map((opt) => {
                if (opt.value !== undefined) return `${opt.name}: ${opt.value}`;

                if (opt.options && opt.options.length > 0) {
                    const subParams = opt.options.map((sub) => `${sub.name}: ${sub.value}`).join(", ");
                    return `${opt.name} { ${subParams} }`;
                }

                return opt.name;
            })
            .join(" | ");
        console.log(`[COMMAND] ${username} ran /${interaction.commandName} { ${params} }`);

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral });
            }
        }
    },
};
