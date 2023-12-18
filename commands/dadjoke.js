const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dadjoke')
    .setDescription('Get a random dad joke'),

  async execute(interaction) {
    try {
      const joke = await getDadJoke();
      await interaction.reply(joke);
    } catch (error) {
      console.error(error);

      interaction.reply({
        content: 'An error occurred while fetching a dad joke. Please try again later.',
        ephemeral: true
      });
    }
  },
};
async function getDadJoke() {
  try {
    const response = await fetch('https://icanhazdadjoke.com/', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch a dad joke.');
    }

    const data = await response.json();
    const joke = data.joke;

    return joke;
  } catch (error) {
    throw new Error('Failed to fetch a dad joke.');
  }
}
