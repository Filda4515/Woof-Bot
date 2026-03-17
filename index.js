require("dotenv").config();
const { Client, Collection, Events, GatewayIntentBits, ActivityType, MessageFlags } = require("discord.js");
const config = require("./config.json");
const fs = require("fs");
const path = require("node:path");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.on(Events.ClientReady, async () => {
    console.log(`${client.user.username} is online!`);
    client.user.setActivity("Woofers", { type: ActivityType.Listening });
});

const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to the database!");
    })
    .catch((err) => {
        console.log(err);
    });

const { handleWoofing } = require("./functions/woofing.js");

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.channel.type === "dm") return;
    if (message.channel.id === config.channels.ignLink) return;

    await handleWoofing(message);
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
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
    console.log(`[COMMAND LOG] ${username} ran /${interaction.commandName} { ${params} }`);

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});

client.login(process.env.TOKEN);

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});
