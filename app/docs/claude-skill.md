Here's what has been completed:


extract-metadata.py
: I created a script that scans your transform files and outputs the capabilities as JSON. I ran it and it successfully extracted 99 nodes into 

node-catalog.json
.

recipe-bundle-schema.json
: Created a strict JSON schema that maps exactly to how PicMachinaRecipeBundle and RecipeNode are evaluated in your UI.

claude-recipe-prompt.md
: Generated the Master System Prompt that teaches Claude about the schema, Sidecar variable interpolation, and the logic of your execution engine using multiple Few-Shot examples.

registry.js
: Appended a dumpMetadata() helper method to your registry class, so you can easily run await import('./src/engine/registry.js').then(m => m.registry.dumpMetadata()) directly in your dev console to quickly copy the node dictionary in the future.



How to use this right now:
Open Claude.ai and create a new Project.
In the Project settings, set the Custom Instructions to the complete contents of app/docs/claude-recipe-prompt.md.
Add the app/docs/node-catalog.json and app/docs/recipe-bundle-schema.json files to the project knowledge.
You can now ask that Claude instance: "Let's make a recipe that takes an image, crops it to a square, adds a soft glow, and then puts a title at the bottom saying 'Sunny Days'."

It will respond with a completed JSON payload that you can save as a file and load directly into Pic Machina via the "Import JSON" button in your Library!

Are there any other structural elements you'd like me to add for this?
