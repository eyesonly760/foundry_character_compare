Hooks.once("ready", () => {
  Hooks.on("renderActorDirectory", (app, html, data) => {
    const button = $(`<button class="character-diff-button"><i class="fas fa-not-equal"></i> Diff Sheets</button>`);

    button.on('click', () => {
      new CharacterDiffApp().render(true);
    });

    html.find(".directory-header").prepend(button);
  });
});

/**
 * A custom Application to display and compare two character sheets (Actors).
 */
class CharacterDiffApp extends Application {
    constructor(options = {}) {
        super(options);
        // Initialize IDs for the two actors being compared
        this.actor1Id = null;
        this.actor2Id = null;
    }

    /**
     * Define the default options for this Application.
     * @returns {object} Default options for the application.
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "character-diff-app", // Unique ID for the application window
            title: "Character Sheet Diff Tool", // Title of the application window
            template: "modules/foundry_character_compare/templates/diff-viewer.html", // Path to the HTML template
            width: 900, // Default width of the window
            height: 600, // Default height of the window
            resizable: true, // Allow the window to be resized
            classes: ["character-diff-tool", "foundry-vtt-theme"] // Custom CSS classes for styling
        });
    }

    /**
     * Provide data to the Handlebars template.
     * @returns {object} Data object for the template.
     */
    getData() {
        // Get all actors that the current user has ownership over (or can see)
        const actors = game.actors.filter(a => a.hasOwner || a.permission >= CONST.ENTITY_PERMISSIONS.OBSERVER);

        // Retrieve the selected actors if their IDs are set
        const actor1 = game.actors.get(this.actor1Id);
        const actor2 = game.actors.get(this.actor2Id);

        // Calculate differences only if both actors are selected
        const differences = (actor1 && actor2) ? this.calculateDifferences(actor1, actor2) : [];

        return {
            actors: actors.sort((a, b) => a.name.localeCompare(b.name)), // Sort actors alphabetically
            actor1: actor1,
            actor2: actor2,
            differences: differences
        };
    }

    /**
     * Activate event listeners for elements within the application's HTML.
     * @param {jQuery} html The rendered HTML of the application.
     */
    activateListeners(html) {
        super.activateListeners(html); // Call the parent method

        // Listener for the first actor selection dropdown
        html.find('#actor1-select').change(event => {
            this.actor1Id = event.target.value; // Update the selected actor's ID
            this.render(true); // Re-render the application to display changes
        });

        // Listener for the second actor selection dropdown
        html.find('#actor2-select').change(event => {
            this.actor2Id = event.target.value; // Update the selected actor's ID
            this.render(true); // Re-render the application to display changes
        });

        // Optional: Add listeners for applying changes here if you implement that functionality
        // html.find('.apply-change-button').click(this._onApplyChange.bind(this));
    }

    /**
     * Calculates the differences between two actor data objects.
     * NOTE: This is a very simplistic deep comparison. For production,
     * consider using a dedicated deep-diff library (e.g., jsondiffpatch, deep-object-diff)
     * or Foundry's internal `foundry.utils.diffObject`.
     *
     * @param {Actor} actor1 The first actor to compare.
     * @param {Actor} actor2 The second actor to compare.
     * @returns {Array<object>} An array of difference objects.
     */
    calculateDifferences(actor1, actor2) {
        if (!actor1 || !actor2) {
            return [];
        }

        // Clone the actor data to avoid modifying the original objects and for a clean comparison
        // We'll compare the full data object, including `_id`, `name`, `data`, `items`, `effects`, etc.
        const data1 = deepClone(actor1);
        const data2 = deepClone(actor2);

        const differences = [];

        // Use Foundry's internal diff utility for a more robust comparison
        // The `diffObject` function compares two objects and returns an object
        // where keys are paths to differing values, and values are the new value.
        // It's designed to create an `update` object for `entity.update()`.
        const diff1to2 = foundry.utils.diffObject(data1, data2);
        const diff2to1 = foundry.utils.diffObject(data2, data1);

        // Process diff1to2 (changes from actor1's perspective to become actor2)
        for (const keyPath in diff1to2) {
            const value2 = getProperty(data2, keyPath);
            const value1 = getProperty(data1, keyPath);

            // Determine if it's a value change or an addition
            if (getProperty(data1, keyPath) !== undefined) {
                // Value exists in data1, so it's a change
                differences.push({
                    key: keyPath,
                    status: 'changed',
                    value1: value1,
                    value2: value2
                });
            } else {
                // Value does not exist in data1, so it's an addition in data2
                differences.push({
                    key: keyPath,
                    status: 'added',
                    value1: undefined,
                    value2: value2
                });
            }
        }

        // Process diff2to1 for removals (values present in data1 but not in data2)
        // We need to be careful not to double count "changed" items
        for (const keyPath in diff2to1) {
            // If this keyPath was already identified as 'changed' or 'added' from diff1to2, skip it
            if (differences.some(d => d.key === keyPath)) {
                continue;
            }

            const value1 = getProperty(data1, keyPath);
            const value2 = getProperty(data2, keyPath);

            if (getProperty(data2, keyPath) === undefined) {
                // Value exists in data1 but not data2, so it's a removal in data2's perspective
                differences.push({
                    key: keyPath,
                    status: 'removed',
                    value1: value1,
                    value2: undefined
                });
            }
            // If it's a 'changed' value from the perspective of diff2to1, it should have been caught by diff1to2 already.
        }

        // Sort differences by keyPath for consistent display
        return differences.sort((a, b) => a.key.localeCompare(b.key));
    }


    /**
     * Helper function to get a property from an object using a dot-notation path.
     * This is a simplified version of Foundry's `getProperty`.
     * @param {object} obj The object to query.
     * @param {string} path The dot-notation path.
     * @returns {*} The value at the given path, or undefined.
     */
    _getProperty(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}


// Optional: Register a custom Handlebars helper to pretty-print JSON in the template
// This is useful for displaying complex objects in a readable format.
Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context, null, 2);
});

// Optional: Register an equality helper for Handlebars if not already present (e.g., from `_equals` in Foundry)
if (typeof Handlebars.helpers.eq === "undefined") {
    Handlebars.registerHelper('eq', function (arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
}