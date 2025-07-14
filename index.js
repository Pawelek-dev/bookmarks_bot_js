require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}!`);

  try {
    const bookmarks = require('./commands/bookmarks');
    await bookmarks.setup(client);
    console.log("Zarejestrowano komendy zakładek");
  } catch (e) {
    console.error("Błąd rejestracji komend:", e);
  }
});

client.login(process.env.TOKEN);