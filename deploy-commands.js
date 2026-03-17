const { REST, Routes } = require('discord.js');
const ENV = require("./ENV.json");
const config = require("./config.json");
const fs = require('node:fs');
const path = require('node:path');

const commands = [];

// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(ENV.token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// await rest
		// 	.delete(Routes.applicationGuildCommand(clientId, guildId, "1478092589079986268"))
		// 	.then(() => console.log('Successfully deleted guild command'))
		// 	.catch(console.error);

		const data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.smolGuildId), { body: commands });
        // const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
		

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();