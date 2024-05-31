const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket.'),
    async execute(interaction) {
        try {
            const categories = await interaction.guild.channels.fetch()
                .then(channels => channels.filter(channel => channel.type === ChannelType.GuildCategory))
                .catch(error => {
                    console.error('Error fetching channels:', error);
                    return null;
                });

            if (!categories) {
                return interaction.reply({ content: 'Error: Unable to fetch categories.', ephemeral: true });
            }

            console.log('Listing all categories:');
            categories.forEach(channel => {
                console.log(`Category: ${channel.name} (ID: ${channel.id})`);
            });

            const activeTicketsCategory = categories.find(channel => channel.name.trim() === 'Active Tickets');

            if (!activeTicketsCategory) {
                return interaction.reply({ content: 'Error: The "Active Tickets" category does not exist.', ephemeral: true });
            }

            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel])) {
                return interaction.reply({ content: 'Error: The bot does not have the necessary permissions to manage channels.', ephemeral: true });
            }

            const staffRole = interaction.guild.roles.cache.find(role => role.name === 'Staff Team');
            if (!staffRole) {
                return interaction.reply({ content: 'Error: The "Staff Team" role does not exist.', ephemeral: true });
            }

            const existingTicketChannel = interaction.guild.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.name.startsWith(`ticket-${interaction.user.id}`));
            if (existingTicketChannel) {
                return interaction.reply({ content: 'You already have an open ticket.', ephemeral: true });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.id}`,
                type: ChannelType.GuildText,
                parent: activeTicketsCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: staffRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                ],
            });

            const modal = new ModalBuilder()
                .setCustomId('ticketModal')
                .setTitle('Ticket Information')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('username')
                            .setLabel('Username')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('email')
                            .setLabel('Email')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('reason')
                            .setLabel('Reason for Contact')
                            .setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('comment')
                            .setLabel('Comment')
                            .setStyle(TextInputStyle.Paragraph)
                    )
                );

            await interaction.showModal(modal);

            const filter = (i) => i.customId === 'ticketModal' && i.user.id === interaction.user.id;
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 });

            const username = modalInteraction.fields.getTextInputValue('username');
            const email = modalInteraction.fields.getTextInputValue('email');
            const reason = modalInteraction.fields.getTextInputValue('reason');
            const comment = modalInteraction.fields.getTextInputValue('comment');

            const embed = new EmbedBuilder()
                .setTitle('Ticket Information')
                .addFields(
                    { name: 'Username', value: username },
                    { name: 'Email', value: email },
                    { name: 'Reason for Contact', value: reason },
                    { name: 'Comment', value: comment }
                );

            const closeButton = new ButtonBuilder()
                .setCustomId('close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const closeRow = new ActionRowBuilder().addComponents(closeButton);

            await ticketChannel.send({ embeds: [embed], components: [closeRow] });

            await modalInteraction.reply({ content: `Ticket created successfully. You can view your ticket here: ${ticketChannel}`, ephemeral: true });

            const closeFilter = i => i.customId === 'close' && i.user.id === interaction.user.id;
            const collector = ticketChannel.createMessageComponentCollector({ filter: closeFilter, time: 86400000 });

            collector.on('collect', async i => {
                const confirmEmbed = new EmbedBuilder()
                    .setDescription('Are you sure you want to close the ticket?')
                    .setColor('#FFA500');  // Use hex color for orange

                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm')
                            .setLabel('Yes')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setLabel('No')
                            .setStyle(ButtonStyle.Success)
                    );

                const confirmationMessage = await i.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });

                const confirmationFilter = c => (c.customId === 'confirm' || c.customId === 'cancel') && c.user.id === interaction.user.id;
                const confirmationCollector = ticketChannel.createMessageComponentCollector({ filter: confirmationFilter, time: 30000 });

                confirmationCollector.on('collect', async c => {
                    if (c.customId === 'confirm') {
                        const closingEmbed = new EmbedBuilder()
                            .setDescription('Closing ticket in 5 seconds...')
                            .setColor('#FF0000');  // Use hex color for red
                        await confirmationMessage.edit({ embeds: [closingEmbed], components: [] });

                        const abortButton = new ButtonBuilder()
                            .setCustomId('abort')
                            .setLabel('Abort')
                            .setStyle(ButtonStyle.Secondary);
                        
                        const transcriptButton = new ButtonBuilder()
                            .setCustomId('transcript')
                            .setLabel('Request Transcript')
                            .setStyle(ButtonStyle.Primary);

                        const closingRow = new ActionRowBuilder().addComponents(abortButton, transcriptButton);

                        const closingMsg = await ticketChannel.send({ embeds: [closingEmbed], components: [closingRow] });

                        let closingTimeout = setTimeout(async () => {
                            const messages = await ticketChannel.messages.fetch();
                            const transcript = messages.map(m => `${m.author.tag}: ${m.content}`).join('\n');
                            fs.writeFileSync(`transcript-${interaction.user.id}.txt`, transcript);

                            const user = await interaction.client.users.fetch(interaction.user.id);
                            await user.send({ files: [`transcript-${interaction.user.id}.txt`] });

                            const ticketLogsChannel = interaction.guild.channels.cache.find(channel => channel.name === 'ticket-logs' && channel.type === ChannelType.GuildText);
                            if (ticketLogsChannel) {
                                await ticketLogsChannel.send({ files: [`transcript-${interaction.user.id}.txt`] });
                            }

                            await ticketChannel.delete();
                        }, 5000);

                        const abortCollector = ticketChannel.createMessageComponentCollector({ filter: i => i.customId === 'abort' && i.user.id === interaction.user.id, time: 5000 });
                        const transcriptCollector = ticketChannel.createMessageComponentCollector({ filter: i => i.customId === 'transcript' && i.user.id === interaction.user.id, time: 5000 });

                        abortCollector.on('collect', async () => {
                            clearTimeout(closingTimeout);
                            await closingMsg.edit({ content: 'Ticket closing aborted.', components: [] });
                        });

                        transcriptCollector.on('collect', async () => {
                            const messages = await ticketChannel.messages.fetch();
                            const transcript = messages.map(m => `${m.author.tag}: ${m.content}`).join('\n');
                            fs.writeFileSync(`transcript-${interaction.user.id}.txt`, transcript);

                            const user = await interaction.client.users.fetch(interaction.user.id);
                            await user.send({ files: [`transcript-${interaction.user.id}.txt`] });

                            await closingMsg.edit({ content: 'Transcript sent to your DM.', components: [] });
                        });

                    } else if (c.customId === 'cancel') {
                        await confirmationMessage.edit({ content: 'Ticket closing cancelled.', components: [] });
                    }
                });

                confirmationCollector.on('end', async collected => {
                    if (!collected.size) {
                        await confirmationMessage.edit({ content: 'Ticket closing timed out.', components: [] });
                    }
                });
            });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while creating the ticket.', ephemeral: true });
        }
    },
};