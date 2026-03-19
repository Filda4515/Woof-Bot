const { Events } = require("discord.js");
const { handleWoofing } = require("../functions/woofing.js");
const config = require("../config.json");

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) {
        if (message.author.bot || message.channel.type === "dm") return;
        if (message.channel.id === config.channels.ignLink) return;

        try {
            await handleWoofing(message);
        } catch (error) {
            console.error(`Error in woofing mechanic for user ${message.author.tag}:`, error);
        }
    },
};
