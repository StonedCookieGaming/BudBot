const { EmbedBuilder } = require('discord.js'); // Replace MessageEmbed with EmbedBuilder

module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    try {
      const guild = member.guild;
      const welcomeChannel = guild.channels.cache.find((channel) => channel.name === 'welcome');

      if (welcomeChannel) {
        const embed = new EmbedBuilder() // Use EmbedBuilder instead of MessageEmbed
          .setTitle('A Wild User Has Appeared!')
          .setDescription(`Hello and welcome to ${guild.name}! Enjoy your time with us and stay lit!`)
          .setColor('#228B22')
          .setThumbnail(member.user.displayAvatarURL());

        await welcomeChannel.send({
          content: `${member}`,
          embeds: [embed]
        });
      } else {
        console.error('Welcome channel not found.');
      }
    } catch (error) {
      console.error('Error in guildMemberAdd event:', error);
    }
  });

  // Autobroadcast slash command simulation
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'autobroadcast') {
      try {
        // Simulate a new member joining
        const guild = interaction.guild;
        const simulatedMember = await guild.members.fetch(interaction.user.id);

        // Reuse the existing logic for sending the welcome message
        const welcomeChannel = guild.channels.cache.find((channel) => channel.name === 'welcome');

        if (welcomeChannel) {
          const embed = new EmbedBuilder() // Use EmbedBuilder instead of MessageEmbed
            .setTitle('A Wild User Has Appeared!')
            .setDescription(`Hello and welcome to ${guild.name}! Enjoy your time with us and stay lit!`)
            .setColor('#228B22')
            .setThumbnail(simulatedMember.user.displayAvatarURL());

          await welcomeChannel.send({
            content: `${simulatedMember}`,
            embeds: [embed]
          });
        } else {
          console.error('Welcome channel not found.');
        }
      } catch (error) {
        console.error('Error in autobroadcast command:', error);
      }
    }
  });
};