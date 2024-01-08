// Adjust this import based on the location of your autobroadcast module
const autobroadcast = require('../autobroadcasts/welcome.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autobroadcast')
    .setDescription('Trigger the autobroadcast functionality'),

  async execute(interaction) {
    // Check if the user has the "Developer" role
    if (interaction.member.roles.cache.some(role => role.name === 'Developer')) {
      // Simulate guildMemberAdd by passing the member to autobroadcast function
      const simulatedMember = {
        guild: interaction.guild,
        user: interaction.user,
      };

      autobroadcast(interaction.client, simulatedMember);
      await interaction.reply({ content: 'Autobroadcast triggered successfully!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  },
};
