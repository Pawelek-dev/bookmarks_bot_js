const DatabaseManager = require('../database/manager');
const { BookmarksView } = require('../ui/bookmarksView');
const CommandRegistrar = require('./commandRegistrar');
const InteractionRouter = require('../handlers/interactionRouter');

class BookmarksCommandHandler {
  static async setup(client) {
    const dbManager = new DatabaseManager();
    const bookmarksView = new BookmarksView(dbManager);
    const interactionRouter = new InteractionRouter(dbManager, bookmarksView);

    await CommandRegistrar.registerCommands(client);

    client.on('interactionCreate', async interaction => {
      await interactionRouter.handleInteraction(interaction);
    });

    console.log("Moduł zakładek został skonfigurowany pomyślnie");
  }

  static get registerCommands() {
    return CommandRegistrar.registerCommands;
  }
}

module.exports = BookmarksCommandHandler;