const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageActionRowComponent, MessageInputInteractionResponse } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket.'),
    async execute(interaction) {
        // Check if the "Active Tickets" category exists
        const activeTicketsCategory = interaction.guild.channels.cache.find(channel => channel.type === 'GUILD_CATEGORY' && channel.name === 'Active Tickets');

        if (!activeTicketsCategory) {
            return interaction.reply({ content: 'Error: The "Active Tickets" category does not exist.', ephemeral: true });
        }

        // Check if the "Staff Team" role exists
        const staffRole = interaction.guild.roles.cache.find(role => role.name === 'Staff Team');
        if (!staffRole) {
            return interaction.reply({ content: 'Error: The "Staff Team" role does not exist.', ephemeral: true });
        }

        // Check if the user already has a ticket channel
        const existingTicketChannel = interaction.guild.channels.cache.find(channel => {
            if (channel.type === 'GUILD_TEXT' && channel.name.startsWith(`ticket-${interaction.user.id}`)) {
                return channel;
            }
        });

        if (existingTicketChannel) {
            return interaction.reply({ content: 'You already have an open ticket.', ephemeral: true });
        }

        // Create a ticket channel inside the "Active Tickets" category
        const ticketChannel = await interaction.guild.channels.create(`ticket-${interaction.user.id}`, {
            type: 'GUILD_TEXT',
            parent: activeTicketsCategory,
            permissionOverwrites: [
                {
                    id: interaction.user.id,
                    allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.READ_MESSAGE_HISTORY],
                },
                {
                    id: staffRole.id,
                    allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.READ_MESSAGE_HISTORY],
                },
                {
                    id: interaction.guild.roles.everyone,
                    deny: [Permissions.FLAGS.VIEW_CHANNEL],
                },
            ],
        });

        // Send a modal form with text boxes
        const row = new MessageActionRow()
            .addComponents(
                new MessageInputApplicationCommandOption()
                    .setCustomId('username')
                    .setLabel('Username')
                    .setType('STRING'),
                new MessageInputApplicationCommandOption()
                    .setCustomId('email')
                    .setLabel('Email')
                    .setType('STRING'),
                new MessageSelectMenu()
                    .setCustomId('reason')
                    .setPlaceholder('Select a reason')
                    .addOptions([
                        { label: 'General Support Inquiry', value: 'support' },
                        { label: 'Report a Player', value: 'report_player' },
                        { label: 'Report Stuck Character', value: 'report_stuck_character' },
                        { label: 'Something Else', value: 'something_else' },
                new MessageInputApplicationCommandOption()
                    .setCustomId('comment')
                    .setLabel('Comment')
                    .setType('STRING'),
                    ]),
            );

        const embed = new MessageEmbed()
            .setTitle('Ticket Information')
            .setDescription('Please provide the following information:')
            .addField('Username', 'Waiting for input...', true)
            .addField('Email', 'Waiting for input...', true)
            .addField('Reason for Contact', 'Select from the dropdown menu below.')
            .addField('Comment', 'Waiting for input...', true);

        const message = await ticketChannel.send({ embeds: [embed], components: [row] });

        // Handle closing the ticket
        const closeFilter = i => i.customId === 'close' && i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter: closeFilter, time: 60000 });

        collector.on('collect', async i => {
            const confirmEmbed = new MessageEmbed()
                .setDescription('Are you sure you want to close the ticket?')
                .setColor('ORANGE');

            const confirmRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('confirm')
                        .setLabel('Yes')
                        .setStyle('DANGER'),
                    new MessageButton()
                        .setCustomId('cancel')
                        .setLabel('No')
                        .setStyle('SUCCESS'),
                );

            const confirmationMessage = await i.update({ embeds: [confirmEmbed], components: [confirmRow] });

            const confirmationFilter = c => (c.customId === 'confirm' || c.customId === 'cancel') && c.user.id === interaction.user.id;
            const confirmationCollector = confirmationMessage.createMessageComponentCollector({ filter: confirmationFilter, time: 30000 });

            confirmationCollector.on('collect', async c => {
                if (c.customId === 'confirm') {
                    const closingEmbed = new MessageEmbed()
                        .setDescription('Closing ticket in 5 seconds...')
                        .setColor('RED');
                    await confirmationMessage.edit({ embeds: [closingEmbed], components: [] });

                    // Generate transcript
                    const transcript = `Username: ${embed.fields[0].value}\nEmail: ${embed.fields[1].value}\nComment: ${embed.fields[2].value}`;
                    fs.writeFileSync(`transcript-${interaction.user.id}.txt`, transcript);

                    // Send transcript via DM
                    const user = await interaction.client.users.fetch(interaction.user.id);
                    await user.send({ files: [`transcript-${interaction.user.id}.txt`] });

                    // Delete the ticket channel
                    await ticketChannel.delete();

                } else if (c.customId === 'cancel') {
                    await confirmationMessage.delete();
                }
            });

            confirmationCollector.on('end', async () => {
                if (!confirmationMessage.deleted) await confirmationMessage.delete();
            });
        });