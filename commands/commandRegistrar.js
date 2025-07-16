const { 
  ApplicationCommandType, 
  ContextMenuCommandBuilder, 
  SlashCommandBuilder
} = require('discord.js');

class CommandRegistrar {
  static async registerCommands(client) {
    const saveMessageCommand = new ContextMenuCommandBuilder()
      .setName('Save Message')
      .setType(ApplicationCommandType.Message);

    const bookmarksCommand = new SlashCommandBuilder()
      .setName('bookmarks')
      .setDescription('Wyświetl swoje zapisane wiadomości')
      .addIntegerOption(option => 
        option.setName('page')
          .setDescription('Numer strony (domyślnie 1)')
          .setRequired(false));

    const bookmarkCommand = new SlashCommandBuilder()
      .setName('bookmark')
      .setDescription('Wyświetl szczegóły zapisanej wiadomości')
      .addIntegerOption(option => 
        option.setName('id')
          .setDescription('ID zakładki')
          .setRequired(true));

    const deleteCommand = new SlashCommandBuilder()
      .setName('delete_bookmark')
      .setDescription('Usuń zakładkę')
      .addIntegerOption(option => 
        option.setName('id')
          .setDescription('ID zakładki do usunięcia')
          .setRequired(true));

    await client.application.commands.set([
      saveMessageCommand,
      bookmarksCommand,
      bookmarkCommand,
      deleteCommand
    ]);

    console.log('Wszystkie komendy zostały zarejestrowane pomyślnie.');
  }
}

module.exports = CommandRegistrar;