require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.User
  ],
});

client.once('ready', async () => {
  console.log(`Zalogowana jako ${client.user.tag}!`);
  console.log(`Typ aplikacji: ${client.application.type === 1 ? 'User App' : 'Bot App'}`);

  try {
    const bookmarks = require('./commands/bookmarks');
    await bookmarks.setup(client);
    console.log("Zarejestrowano komendy zakładek");
  } catch (e) {
    console.error("Błąd rejestracji komend:", e);
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('warn', warning => {
  console.warn('Discord client warning:', warning);
});

client.on('ready', () => {
  console.log('Bot jest gotowy do działania!');
});

client.login(process.env.TOKEN);