const { MessageEmbed } = require('discord.js');

module.exports = (client) => {
  client.on('guildMemberAdd', (member) => {
    const welcomeChannel = member.guild.channels.cache.find((channel) => channel.name === 'welcome');
    
    if (welcomeChannel) {
      const embed = new MessageEmbed()
        .setTitle('A Wild User Has Appeared!')
        .setDescription(`Hello and welcome to ${member.guild.name}! Enjoy your time with us and stay lit!`)
        .setColor('#228B22')
        .setThumbnail(member.user.displayAvatarURL());

      welcomeChannel.send({
        content: `${member}`,
        embeds: [embed]
      });
    }
  });
};