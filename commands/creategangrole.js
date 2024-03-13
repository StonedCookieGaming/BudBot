const { SlashCommandBuilder } = require('@discordjs/builders');

const newgangCommand = new SlashCommandBuilder()
  .setName('newgang')
  .setDescription('Create a new gang')
  .addStringOption(option =>
    option
      .setName('gangname')
      .setDescription('Name of the new gang')
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('color')
      .setDescription('Color for the new gang role (in hex format, e.g., #FF0000)'),
  );

module.exports = {
  data: newgangCommand,
  async execute(interaction) {
    const guild = interaction.guild;
    const gangName = interaction.options.getString('gangname');
    const color = interaction.options.getString('color');

    // Create Gang Leader role if not exists
    let gangLeaderRole = guild.roles.cache.find(role => role.name === 'Gang Leader');

    if (!gangLeaderRole) {
      gangLeaderRole = await guild.roles.create({
        name: 'Gang Leader',
        permissions: [],
      });
    }

    // Create new gang role with specified color or default to white
    const newGangRole = await guild.roles.create({
      name: gangName,
      permissions: [],
      color: color || 'WHITE', // Default to white if color is not provided
    });

    // Move the new role above the Gang Leader role
    await newGangRole.setPosition(gangLeaderRole.position);

    // Assign roles to the user
    await interaction.member.roles.add([newGangRole.id, gangLeaderRole.id]);

    // Send a confirmation message
    await interaction.reply({ content: `New gang "${gangName}" created successfully!`, ephemeral: true });
  },
};
