Hooks.on("renderActorDirectory", (app, html, data) => {
    const button = $(`<button class="character-diff-button"><i class="fas fa-not-equal"></i> Diff Sheets</button>`);
    button.on('click', () => {
        // Open your custom diff application
        new CharacterDiffApp().render(true);
    });
    html.find(".directory-header").prepend(button);
});