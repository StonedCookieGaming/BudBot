const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const shutdownCommand = new SlashCommandBuilder()
  .setName('shutdown')
  .setDescription('Shutdown the bot');

module.exports = {
  data: shutdownCommand,
  async execute(interaction) {
    if (interaction.member.roles.cache.some(role => role.name === 'The Godfather')) {
      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success);

      const denyButton = new ButtonBuilder()
        .setCustomId('deny')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder()
        .addComponents(confirmButton, denyButton);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Confirmation')
        .setDescription('Are you sure you want to shut down the bot?')
        .setTimestamp();

      await interaction.reply({
        ephemeral: true,
        embeds: [embed],
        components: [row],
      });

      const filter = i => i.customId === 'confirm' || i.customId === 'deny';
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

      collector.on('collect', async i => {
        collector.stop();

        if (i.customId === 'confirm') {
          await interaction.followUp({ content: 'Shutting down...', ephemeral: true });
          process.exit();
        } else if (i.customId === 'deny') {
          await interaction.followUp({ content: 'Shutdown canceled.', ephemeral: true });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp({ content: 'You took too long to respond. Shutdown canceled.', ephemeral: true });
        }
        interaction.deleteReply();
      });
    } else {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  },
};
