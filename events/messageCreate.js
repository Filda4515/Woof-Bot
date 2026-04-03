const { Events } = require("discord.js");
const config = require("../config.json");
const UserProfile = require("../schemas/UserProfile.js");
const { handleWoofing } = require("../functions/woofing.js");
const { handleExperimentals } = require("../functions/experimentals.js");

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) {
        if (message.author.bot || message.channel.type === "dm") return;
        if (message.channel.id === config.channels.ignLink) return;

        let userProfile = null;
        try {
            userProfile = await UserProfile.findOne({ discordId: message.author.id });
            if (!userProfile) {
                userProfile = new UserProfile({ discordId: message.author.id });
                await userProfile.save();
            }
        } catch (error) {
            console.error(`Database fetch error for ${message.author.tag}:`, error);
            return;
        }

        let noWoof = false;
        try {
            noWoof = await handleExperimentals(message, userProfile);
        } catch (error) {
            console.error(`Error in experimental mechanic for user ${message.author.tag}:`, error);
        }

        if (noWoof) return;

        try {
            await handleWoofing(message, userProfile);
        } catch (error) {
            console.error(`Error in woofing mechanic for user ${message.author.tag}:`, error);
        }
    },
};
