require('dotenv').config();

const { Client, GatewayIntentBits, REST, ActivityType } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const fs = require('node:fs');
const path = require('node:path');
const welcome = require('./autobroadcasts/welcome');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ],
});

//Bot Startup Sequence
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: `SkyNet`, type: ActivityType.Watching }],
    status: 'online',
  });
});

const commands = new Map();

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const commandPath = path.join(__dirname, 'commands', file);
  const command = require(commandPath);

  commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (!commands.has(commandName)) return;

  try {
    await commands.get(commandName).execute(interaction);
  } catch (error) {
    console.error(`Error executing command "${commandName}":`, error);
  }
});

const rest = new REST({ version: '10' }).setToken(discordToken);

(async () => {
  try {
    const commandData = Array.from(commands.values()).map(command => command.data.toJSON());
    console.log(`Initializing ${commandData.length} application (/) commands.`);

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData },
    );

    console.log(`Successfully deployed application (/) commands.`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();

welcome(client);

client.login(discordToken);