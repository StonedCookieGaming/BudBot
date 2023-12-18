const { google } = require('googleapis');
const { MessageEmbed, Client } = require('discord.js');
const WebSocket = require('ws');
require('dotenv').config();

const client = new Client();
client.login(process.env.DISCORD_TOKEN);

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const getLatestVideo = async () => {
  const response = await youtube.search.list({
    part: 'snippet',
    channelId: process.env.YOUTUBE_CHANNEL_ID,
    maxResults: 1,
    order: 'date',
    type: 'video',
  });

  return response.data.items[0];
};

const sendEmbeddedMessage = async (channel, video) => {
  const embed = new MessageEmbed()
    .setTitle(video.snippet.title)
    .setURL(`https://www.youtube.com/watch?v=${video.id.videoId}`)
    .setDescription(video.snippet.description)
    .setColor('#FF0000')
    .setThumbnail(video.snippet.thumbnails.default.url)
    .addField('Published At', new Date(video.snippet.publishedAt).toUTCString());

  channel.send({
    content: `@everyone`,
    embeds: [embed],
  });
};

// Parse the service account key from the environment variable
const serviceAccountKey = require('./config/servicekey.json');

const ws = new WebSocket('wss://pubsub.googleapis.com/v1/projects/budbot-408503/subscriptions/videoupload', {
  headers: {
    Authorization: `Bearer ${await getAccessToken(serviceAccountKey)}`,
  },
});

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'LISTEN',
    data: {
      topics: [`youtube.video.${process.env.YOUTUBE_CHANNEL_ID}`],
      auth_token: process.env.YOUTUBE_API_KEY,
    },
  }));
});

ws.on('message', async (data) => {
  const message = JSON.parse(data);

  if (message.type === 'MESSAGE') {
    try {
      const latestVideo = await getLatestVideo();
      
      const targetChannelName = 'youtube-uploads';
      const targetChannel = client.channels.cache.find(channel => channel.name === targetChannelName);

      if (targetChannel) {
        await sendEmbeddedMessage(targetChannel, latestVideo);
      } else {
        console.error(`Error: Discord channel with name "${targetChannelName}" not found.`);
      }
    } catch (error) {
      console.error('Error fetching or sending the latest video:', error.message);
    }
  }
});

async function getAccessToken(serviceAccountKey) {
  try {
    // Use google-auth-library to obtain an access token
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const response = await client.getAccessToken();
    return response.token;
  } catch (error) {
    console.error('Error obtaining access token:', error.message);
    throw error;
  }
}