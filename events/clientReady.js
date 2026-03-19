const { Events, ActivityType } = require("discord.js");

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`${client.user.username} is online!`);
        client.user.setActivity("Woofers", { type: ActivityType.Listening });
    },
};
