const { SlashCommandBuilder } = require('@discordjs/builders');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('openticket')
    .setDescription('Open a support ticket'),

  async execute(interaction) {
    try {
      const guild = interaction.guild;

      const ticketCategoryName = 'Active Tickets';
      const ticketCategory = guild.channels.cache.find(
        (channel) => channel.name === ticketCategoryName && channel.type === 'GUILD_CATEGORY'
      );

      if (!ticketCategory) {
        throw new Error(
          `The category "${ticketCategoryName}" does not exist. Please contact an administrator to set up the ticket system.`
        );
      }

      const requiredRoles = ['Staff Team'];
      const missingRoles = requiredRoles.filter(
        (roleName) => !guild.roles.cache.some((role) => role.name === roleName)
      );

      if (missingRoles.length > 0) {
        throw new Error(
          `The following roles are missing: ${missingRoles.join(
            ', '
          )}. Please contact an administrator to set up the required roles.`
        );
      }

      const ticketNumber = ticketCategory.children.size + 1;
      const ticketChannel = await guild.channels.create(`Ticket-${ticketNumber}`, {
        type: 'GUILD_TEXT',
        parent: ticketCategory,
        permissionOverwrites: [
          {
            id: guild.roles.cache.find((role) => role.name === 'Staff Team').id,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          {
            id: interaction.user.id,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
        ],
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('submit')
          .setLabel('Submit')
          .setStyle(ButtonStyle.PRIMARY),
        new ButtonBuilder()
          .setCustomId('close')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.DANGER)
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('requestType')
        .setPlaceholder('Select a request type')
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel('General Inquiry')
            .setValue('general_inquiry'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Report a Player')
            .setValue('report_player'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Report a Bug')
            .setValue('report_bug'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Make a Suggestion')
            .setValue('make_suggestion'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Something Else')
            .setValue('something_else'),
        ]);

      const embed = new EmbedBuilder()
        .setTitle('Support Ticket Form')
        .addField('Character Name', 'Enter your character name')
        .addField('Account Email', 'Enter your account email')
        .addField('Request Type', 'Choose a request type from the dropdown')
        .addField('Message', 'Enter your message here') // Add this line for the message field
        .setColor('BLUE');

      const formMessage = await ticketChannel.send({
        embeds: [embed],
        components: [row, selectMenu],
      });

      const collector = formMessage.createMessageComponentCollector({ time: 60000 });

      let countdown;
      let countdownMessage;

      collector.on('collect', async (i) => {
        if (i.customId === 'submit') {
          const characterName = formMessage.embeds[0].fields.find((field) => field.name === 'Character Name').value;
          const accountEmail = formMessage.embeds[0].fields.find((field) => field.name === 'Account Email').value;
          const requestType = i.values[0];
          const message = formMessage.embeds[0].fields.find((field) => field.name === 'Message').value; // Retrieve the message content

          formMessage.delete();

          const notificationEmbed = new EmbedBuilder()
            .setTitle(`New Ticket - #${ticketNumber}`)
            .setDescription(`A new support ticket has been opened by ${interaction.user.tag}`)
            .addField('Character Name', characterName)
            .addField('Account Email', accountEmail)
            .addField('Request Type', requestType)
            .addField('Message', message) // Add the message to the notification embed
            .setColor('GREEN');

          const notificationMessage = await ticketChannel.send({
            embeds: [notificationEmbed],
            components: [row],
          });
          notificationMessage.pin();

          // Send the transcript as a downloadable text file to the requester's DM
          const transcript = await generateTranscript(ticketChannel);
          const transcriptBuffer = Buffer.from(transcript, 'utf-8');
          interaction.user.send({ content: `Transcript for Ticket #${ticketNumber}:`, files: [{ name: `Transcript-Ticket-${ticketNumber}.txt`, attachment: transcriptBuffer }] });
        } else if (i.customId === 'close') {
          countdownMessage = await ticketChannel.send(`This ticket will be closed in 5 seconds. Request a transcript below.`);

          const countdownRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('transcript')
              .setLabel('Request Transcript')
              .setStyle(ButtonStyle.SECONDARY)
          );
          countdownMessage.edit({ components: [countdownRow] });

          countdown = setTimeout(async () => {
            await ticketChannel.send(`Ticket-${ticketNumber} has been closed.`).then(() => ticketChannel.delete());
          }, 5000);
        } else if (i.customId === 'transcript') {
          const transcript = await generateTranscript(ticketChannel);
          interaction.user.send(`Transcript for Ticket #${ticketNumber}:\n${transcript}`);
        }
      });

      collector.on('end', () => {
        clearTimeout(countdown);

        if (countdownMessage) {
          countdownMessage.delete();
        }
      });

      const successMessage = `Success! Your ticket has been created in ${ticketChannel}.`;
      interaction.reply({ content: successMessage, ephemeral: true });
    } catch (error) {
      console.error(error);
      interaction.reply({
        content: `There was an issue creating your ticket. Please try again later. Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });

  const transcript = messages.map((message) => `${message.author.tag}: ${message.content}`).join('\n');
  return transcript;
}