const { SlashCommandBuilder } = require('@discordjs/builders');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ModalBuilder, MessageAttachment, TextInputBuilder, TextInputStyle, Events } = require('discord.js');
const { ChannelType, PermissionsBitField } = require('discord.js');

let lastTicketNumber = 0;

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

            const ticketCategoryName = 'Active Tickets';
            const ticketCategory = interaction.guild.channels.cache.find(
                (channel) => channel.name === ticketCategoryName
            );

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
                    `Role "${roleName}" not found.`,
                );
            }

            lastTicketNumber++;

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

            const modal = new ModalBuilder()
                .setCustomId('supportTicketForm')
                .setTitle('Support Ticket Form');

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

            const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
            const secondActionRow = new ActionRowBuilder().addComponents(emailInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(messageInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

            await interaction.showModal(modal);

            const handleModalSubmission = async (interaction) => {
                if (!interaction.isModalSubmit()) return;
                if (interaction.customId === 'supportTicketForm') {
                    // Get the data entered by the user
                    const nameInput = interaction.fields.getTextInputValue('nameInput');
                    const emailInput = interaction.fields.getTextInputValue('emailInput');
                    const messageInput = interaction.fields.getTextInputValue('messageInput');
            
                    if (!nameInput || !emailInput || !messageInput) {
                        // Handle missing input values
                        return await interaction.reply({ content: 'Please provide all required information.' });
                    }
            
                    const ticketEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Support Ticket')
                        .addFields({name: 'Character Name', value: nameInput})
                        .addFields({name: 'Account Email', value: emailInput})
                        .addFields({name: 'Issue', value: messageInput})
                        .setTimestamp();

                    const ticketMessage = await ticketChannel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('closeTicket')
                            .setLabel('Close Ticket')
                            .setStyle(ButtonStyle.Danger)
                    )] });

                    const confirmationEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('Are you sure you want to close this ticket?');

                    const confirmationMessage = await ticketChannel.send({ embeds: [confirmationEmbed], components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirmClose')
                            .setLabel('Confirm')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('denyClose')
                            .setLabel('Deny')
                            .setStyle(ButtonStyle.Primary)
                    )] });

                    const filter = (i) => i.customId === 'closeTicket' && i.user.id === interaction.user.id;
                    const collector = ticketMessage.createMessageComponentCollector({ filter, time: 60000 });

                    collector.on('collect', async (i) => {
                        const transcriptConfirmationEmbed = new EmbedBuilder()
                            .setColor('#ffff00')
                            .setDescription('The ticket will be closed in 10 seconds. Do you want a transcript of this conversation?');

                        const transcriptConfirmationMessage = await ticketChannel.send({ embeds: [transcriptConfirmationEmbed], components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('cancelClose')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('transcript')
                                .setLabel('Transcript')
                                .setStyle(ButtonStyle.Success)
                        )] });

                        setTimeout(async () => {
                            // Delete the ticket channel permanently after 10 seconds
                            await ticketChannel.delete();

                            // Handle transcript button click
                            const transcriptButton = transcriptConfirmationMessage.components[0].components.find(component => component.customId === 'transcript');
                            if (transcriptButton && transcriptButton.isButton() && transcriptButton.customId === 'transcript') {
                                // DM the user with the transcript
                                const transcript = '...'; // Create the transcript content
                                const transcriptAttachment = new MessageAttachment(Buffer.from(transcript), 'transcript.txt');
                                await interaction.user.send({ files: [transcriptAttachment] });
                            }

                            // Delete the transcript confirmation message
                            await transcriptConfirmationMessage.delete();
                        }, 10000);
                    });

                    collector.on('end', () => {
                        // Delete the confirmation message after the collector ends
                        confirmationMessage.delete();
                    });
                }
            };

            client.on(Events.InteractionCreate, handleModalSubmission);

        } catch (error) {
            console.error(error);
        }
    },
}