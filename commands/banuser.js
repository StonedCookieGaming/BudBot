const { ButtonStyle, ButtonBuilder, ActionRowBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const banCommand = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a specified user from the server')
  .addUserOption(option => option.setName('target').setDescription('The user to ban').setRequired(true));

module.exports = {
  data: banCommand,
  async execute(interaction) {
    const member = interaction.member;
    if (member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      const targetUser = interaction.options.getUser('target');

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirmBan')
        .setLabel('Confirm Ban')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder()
        .addComponents(confirmButton, cancelButton);

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ban Confirmation')
        .setDescription(`Are you sure you want to ban ${targetUser.tag}?`)
        .setTimestamp();

      await interaction.reply({
        ephemeral: true,
        embeds: [embed],
        components: [row],
      });

      const filter = i => i.customId === 'confirmBan' || i.customId === 'cancel';
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

      collector.on('collect', async i => {
        if (i.customId === 'confirmBan') {
          const banningMember = interaction.member;

          try {
            await interaction.guild.members.ban(targetUser);

            const bannedPlayersChannelName = 'banned-players';
            const bannedPlayersChannel = interaction.guild.channels.cache.find(channel => channel.name === bannedPlayersChannelName);

            if (bannedPlayersChannel && bannedPlayersChannel.isText()) {
              const banLogEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('User Banned')
                .addField('Banned User', targetUser.tag)
                .addField('Banning Admin', banningMember.user.tag)
                .setTimestamp();

              await bannedPlayersChannel.send({ embeds: [banLogEmbed] });
            }

            await interaction.deleteReply();
            await interaction.followUp({ content: `${targetUser.tag} has been banned.`, ephemeral: true });
          } catch (error) {
            console.error(error);
            await interaction.followUp({ content: 'An error occurred while banning the user. Please try again.', ephemeral: true });
          }
        } else if (i.customId === 'cancel') {
          await interaction.followUp({ content: 'Ban canceled.', ephemeral: true });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp({ content: 'You took too long to respond. Ban canceled.', ephemeral: true });
        }
      });
    } else {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  },
};
