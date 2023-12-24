const { SlashCommandBuilder } = require('@discordjs/builders');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageEmbed, ModalBuilder, MessageAttachment, Events, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createticket')
    .setDescription('Open a support ticket'),

  async execute(interaction) {
    try {
      const client = interaction.client;

      if (!interaction.guild) {
        throw new Error('Guild not found.');
      }

      await interaction.guild.fetch();

      let lastTicketNumber = 0;
      const ticketCategoryName = 'Active Tickets';
      const ticketCategory = interaction.guild.channels.cache.find(
        (channel) => channel.name === ticketCategoryName
      );

      console.log('Ticket Category:', ticketCategory);

      if (!ticketCategory) {
        throw new Error(
          `The category "${ticketCategoryName}" does not exist. Please contact an administrator to set up the ticket system.`
        );
      }

      const requiredRoles = ['Staff Team'];
      const missingRoles = requiredRoles.filter(
        (roleName) =>
          !client.guilds.cache
            .get(interaction.guildId)
            .roles.cache.some((role) => role.name === roleName)
      );

      if (missingRoles.length > 0) {
        throw new Error(
          `The following roles are missing: ${missingRoles.join(
            ', '
          )}. Please contact an administrator to set up the required roles.`
        );
      }

      const roleName = 'Staff Team';
      const role = interaction.guild.roles.cache.find((role) => role.name === roleName);

      if (!role) {
        console.error(
          `Role "${roleName}" not found. Available roles:`,
          interaction.guild.roles.cache.map((role) => role.name).join(', ')
        );
        throw new Error(`Role "${roleName}" not found. Please make sure the role exists.`);
      }

      lastTicketNumber++;
      console.log('Calculated Ticket Number:', lastTicketNumber);

      const ticketChannel = await interaction.guild.channels.create({
        name: `Ticket-${lastTicketNumber.toString().padStart(3, '0')}`,
        type: ChannelType.GuildText,
        parent: ticketCategory,
        permissionOverwrites: [
          {
            id: role.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });

      client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;
      
        if (interaction.commandName === 'createticket') {
          // Create the modal
          const modal = new ModalBuilder()
            .setCustomId('supportTicketForm')
            .setTitle('Support Ticket Form');
      
          // Add components to modal
      
          // Create the text input components
          const nameInput = new TextInputBuilder()
            .setCustomId('nameInput')
            .setLabel("What is your character name?")
            .setStyle(TextInputStyle.Short);
      
          const emailInput = new TextInputBuilder()
            .setCustomId('emailInput')
            .setLabel("What is your account email?")
            .setStyle(TextInputStyle.Short);

            const messageInput = new TextInputBuilder()
            .setCustomId('messageInput')
            .setLabel("How can we help you?")
            .setStyle(TextInputStyle.Paragraph);
      
          // An action row only holds one text input,
          // so you need one action row per text input.
          const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
          const secondActionRow = new ActionRowBuilder().addComponents(emailInput);
          const thirdActionRow = new ActionRowBuilder().addComponents(messageInput);
      
          // Add inputs to the modal
          modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
      
          // Show the modal to the user
          await interaction.showModal(modal);
        }
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: (response) => response.user.id === interaction.user.id,
        time: 60000, // 60 seconds timeout
      });
      
      collector.on('collect', async (interaction) => {
        // Access the collected responses
        const { nameInput, emailInput, messageInput } = interaction.values;

  // Create an embed with the collected information
  const ticketEmbed = new MessageEmbed()
    .setTitle('Support Ticket')
    .addField('Character Name', nameInput)
    .addField('Account Email', emailInput)
    .addField('Message', messageInput)
    .setColor('BLUE');

  // Add a close button to the embed
  const closeButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setLabel('Close Ticket')
    .setCustomId('close_ticket');

  const closeActionRow = new ActionRowBuilder().addComponent(closeButton);

  // Send the embed to the ticket channel with the close button
  const ticketMessage = await ticketChannel.send({
    embeds: [ticketEmbed],
    components: [closeActionRow],
  });

        // Stop the collector
        collector.stop();

        // Button collector for close ticket
        const buttonCollector = ticketMessage.createMessageComponentCollector({
          filter: (interaction) => interaction.customId === 'close_ticket',
          time: 15000, // 15 seconds timeout
        });

        // Confirmation message with "Confirm" and "Deny" buttons
      const confirmationMessage = await interaction.reply({
        content: 'Do you really want to close the ticket?',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Success)
              .setLabel('Confirm')
              .setCustomId('confirm_close_ticket'),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('Deny')
              .setCustomId('deny_close_ticket')
          ),
        ],
      });

        buttonCollector.on('collect', async (interaction) => {
          // Delete the confirmation message
          await confirmationMessage.delete();

          // Handle close ticket action
          const closingMessage = await interaction.reply('Closing the ticket...');

          // Create an embed for the closed ticket with a button to request a transcript
          const closedTicketEmbed = new MessageEmbed()
            .setTitle('Ticket Closed')
            .setDescription('The support ticket has been closed.')
            .setColor('GREEN');

          const transcriptButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel('Request Transcript')
            .setCustomId('request_transcript');

          const transcriptActionRow = new ActionRowBuilder().addComponent(transcriptButton);

          // Send the closed ticket embed with the request transcript button
          await ticketChannel.send({
            embeds: [closedTicketEmbed],
            components: [transcriptActionRow],
          });

          // Schedule deletion of the ticket channel after 10 seconds
          setTimeout(async () => {
            await ticketChannel.delete();

            // Send a DM to the user with a text file of the transcript
            const transcriptText = `Transcript of Ticket-${lastTicketNumber}:\n\n${ticketEmbed.author.username}\n${ticketEmbed.createdAt}\n\n${ticketEmbed.content}`;
            const transcriptFile = new MessageAttachment(
              Buffer.from(transcriptText, 'utf-8'),
              `Transcript-Ticket-${lastTicketNumber}.txt`
            );
            await interaction.user.send({
              content: 'Here is the transcript of your support ticket:',
              files: [transcriptFile],
            });

            // Delete the "Closing the ticket..." message after handling the close ticket action
            await closingMessage.delete();
          }, 10000); // 10 seconds
        });

        buttonCollector.on('end', (reason) => {
          if (reason === 'time') {
            // Delete the confirmation message if it times out
            confirmationMessage.delete();
            // Handle timeout
            interaction.followUp('Close ticket timed out.');
          }
        });
      });

      collector.on('end', (reason) => {
        if (reason === 'time') {
          // Delete the confirmation message if it times out
          confirmationMessage.delete();
          interaction.followUp(
            'Ticket creation timed out. Please run the command again.'
          );
        }
      });
    } catch (error) {
      console.error(error);
      interaction.reply({
        content: 'An error occurred while processing the command.',
        ephemeral: true,
      });
    }
  },
};
