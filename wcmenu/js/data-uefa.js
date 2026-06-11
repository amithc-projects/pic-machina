const COUNTRIES_UEFA = [
  {
    id: "germany", name: "Germany", flag: "🇩🇪", confederation: "UEFA",
    intro: "German cuisine is hearty and comforting — slow-braised meats, warming soups, and legendary cakes.",
    menu: {
      starter: {
        name: "Linsensuppe (Lentil Soup)",
        description: "A smoky, warming lentil soup with root vegetables and frankfurter sausage.",
        servings: 4, prepTime: "15 min", cookTime: "45 min",
        ingredients: [
          {amount:"300g", item:"green or brown lentils, rinsed"},
          {amount:"2", item:"frankfurter sausages, sliced"},
          {amount:"2", item:"carrots, diced"},
          {amount:"2", item:"celery stalks, diced"},
          {amount:"1", item:"large onion, diced"},
          {amount:"2 cloves", item:"garlic, minced"},
          {amount:"1.2 L", item:"vegetable stock"},
          {amount:"2 tbsp", item:"white wine vinegar"},
          {amount:"1 tsp", item:"marjoram"},
          {amount:"2 tbsp", item:"olive oil"},
          {amount:"to taste", item:"salt and black pepper"}
        ],
        instructions: [
          "Heat olive oil in a large pot over medium heat. Sauté onion, carrots and celery for 5 minutes until softened.",
          "Add garlic and marjoram, cook 1 minute until fragrant.",
          "Add lentils and stock. Bring to a boil, then reduce heat and simmer 30 minutes until lentils are tender.",
          "Stir in sliced frankfurters and simmer 5 more minutes.",
          "Add white wine vinegar, season with salt and pepper.",
          "Serve hot with crusty bread."
        ],
        youtube: { search: "German Linsensuppe lentil soup recipe", url: "https://www.youtube.com/results?search_query=German+Linsensuppe+lentil+soup+recipe" }
      },
      main: {
        name: "Sauerbraten with Red Cabbage & Potato Dumplings",
        description: "Germany's iconic pot roast — beef marinated in vinegar and spices for days, braised until tender.",
        servings: 6, prepTime: "30 min + 3 days marinating", cookTime: "3 hrs",
        ingredients: [
          {amount:"1.5 kg", item:"beef rump or chuck roast"},
          {amount:"500 ml", item:"red wine vinegar"},
          {amount:"500 ml", item:"water"},
          {amount:"2", item:"onions, sliced"},
          {amount:"10", item:"black peppercorns"},
          {amount:"4", item:"bay leaves"},
          {amount:"6", item:"cloves"},
          {amount:"2 tbsp", item:"sugar"},
          {amount:"100g", item:"gingersnap cookies, crushed"},
          {amount:"3 tbsp", item:"vegetable oil"},
          {amount:"500g", item:"red cabbage, shredded"},
          {amount:"1 kg", item:"floury potatoes (for dumplings)"},
          {amount:"1 egg", item:"plus extra flour for dumplings"}
        ],
        instructions: [
          "Combine vinegar, water, onions, peppercorns, bay leaves, cloves and sugar in a bowl. Submerge beef, cover and refrigerate 3 days, turning daily.",
          "Remove beef, pat dry. Strain and reserve marinade.",
          "Heat oil in a Dutch oven, brown beef on all sides over high heat. Add reserved marinade, bring to a boil.",
          "Reduce heat, cover and braise for 2.5–3 hours until very tender.",
          "Stir crushed gingersnaps into the braising liquid to thicken the gravy. Simmer 10 minutes.",
          "For red cabbage: simmer shredded cabbage with butter, apple, cloves and a splash of vinegar for 40 minutes.",
          "For dumplings: boil then rice potatoes. Mix with flour, egg and salt, form balls and simmer in salted water 15 minutes.",
          "Slice beef, serve with gravy, red cabbage and dumplings."
        ],
        youtube: { search: "authentic Sauerbraten recipe German pot roast", url: "https://www.youtube.com/results?search_query=authentic+Sauerbraten+recipe+German+pot+roast" }
      },
      dessert: {
        name: "Schwarzwälder Kirschtorte (Black Forest Cake)",
        description: "Layers of chocolate sponge, Kirsch-soaked cherries and whipped cream — a German classic.",
        servings: 10, prepTime: "45 min", cookTime: "35 min",
        ingredients: [
          {amount:"200g", item:"dark chocolate (70%)"},
          {amount:"6", item:"eggs"},
          {amount:"200g", item:"caster sugar"},
          {amount:"100g", item:"plain flour"},
          {amount:"50g", item:"cocoa powder"},
          {amount:"600 ml", item:"double cream"},
          {amount:"400g", item:"morello cherries (drained, juice reserved)"},
          {amount:"4 tbsp", item:"Kirsch (cherry schnapps)"},
          {amount:"50g", item:"dark chocolate shavings"}
        ],
        instructions: [
          "Preheat oven to 180°C. Whisk eggs and sugar for 8 minutes until pale and thick.",
          "Fold in sifted flour and cocoa powder gently. Pour into two greased 22 cm tins and bake 25 minutes.",
          "Cool completely. Drizzle each sponge with Kirsch mixed with cherry juice.",
          "Whip cream to stiff peaks. Fold half the cherries into one third of the cream.",
          "Place one sponge on a board, spread with the cherry cream, top with the second sponge.",
          "Cover the whole cake with remaining whipped cream. Press chocolate shavings onto the sides.",
          "Decorate top with whole cherries and extra chocolate shavings. Chill 2 hours before serving."
        ],
        youtube: { search: "Black Forest Cake Schwarzwälder Kirschtorte recipe", url: "https://www.youtube.com/results?search_query=Black+Forest+Cake+Schwarzwälder+Kirschtorte+recipe" }
      }
    }
  },
  {
    id: "france", name: "France", flag: "🇫🇷", confederation: "UEFA",
    intro: "French cuisine is the foundation of modern cooking — refined technique, rich sauces and iconic bistro classics.",
    menu: {
      starter: {
        name: "Soupe à l'Oignon (French Onion Soup)",
        description: "Slowly caramelised onions in beef broth, topped with a crouton and melted Gruyère.",
        servings: 4, prepTime: "10 min", cookTime: "1 hr",
        ingredients: [
          {amount:"1 kg", item:"white onions, thinly sliced"},
          {amount:"60g", item:"unsalted butter"},
          {amount:"1 tbsp", item:"olive oil"},
          {amount:"1 tsp", item:"sugar"},
          {amount:"3 cloves", item:"garlic, minced"},
          {amount:"150 ml", item:"dry white wine"},
          {amount:"1.2 L", item:"good beef stock"},
          {amount:"4 slices", item:"baguette, toasted"},
          {amount:"150g", item:"Gruyère, grated"},
          {amount:"2", item:"bay leaves"},
          {amount:"1 tsp", item:"fresh thyme"}
        ],
        instructions: [
          "Melt butter with oil in a heavy pot over low heat. Add onions, bay leaves and thyme.",
          "Cook on low for 40 minutes, stirring every 5 minutes, until deep golden-brown and caramelised. Add sugar halfway through.",
          "Add garlic, cook 1 minute. Pour in wine and bubble for 3 minutes.",
          "Add beef stock, season and simmer 20 minutes.",
          "Ladle into oven-safe bowls. Place a baguette slice on top, pile with Gruyère.",
          "Grill under a broiler until cheese is bubbling and golden. Serve immediately."
        ],
        youtube: { search: "classic French onion soup recipe Julia Child", url: "https://www.youtube.com/results?search_query=classic+French+onion+soup+recipe" }
      },
      main: {
        name: "Boeuf Bourguignon",
        description: "Beef slowly braised in Burgundy wine with mushrooms, pearl onions and lardons.",
        servings: 6, prepTime: "30 min", cookTime: "3 hrs",
        ingredients: [
          {amount:"1.5 kg", item:"beef chuck, cut into 5 cm cubes"},
          {amount:"750 ml", item:"Burgundy or Pinot Noir wine"},
          {amount:"200g", item:"lardons or smoked bacon"},
          {amount:"250g", item:"button mushrooms, quartered"},
          {amount:"200g", item:"pearl onions, peeled"},
          {amount:"3", item:"carrots, sliced"},
          {amount:"4 cloves", item:"garlic, minced"},
          {amount:"2 tbsp", item:"tomato paste"},
          {amount:"500 ml", item:"beef stock"},
          {amount:"3 tbsp", item:"plain flour"},
          {amount:"bouquet garni", item:"(bay, thyme, parsley)"},
          {amount:"3 tbsp", item:"butter"}
        ],
        instructions: [
          "Marinate beef in wine overnight if possible. Pat beef dry, reserving wine.",
          "Fry lardons in a Dutch oven. Remove, brown beef in batches in the fat. Set aside.",
          "Cook carrots, garlic and pearl onions 5 minutes. Stir in flour and tomato paste.",
          "Return beef and lardons. Pour in reserved wine and stock. Add bouquet garni.",
          "Bring to a boil, cover and braise in 160°C oven for 2.5 hours.",
          "Sauté mushrooms in butter until golden. Add to pot for final 30 minutes.",
          "Remove bouquet garni. Skim excess fat. Adjust seasoning and serve with mashed potato."
        ],
        youtube: { search: "Boeuf Bourguignon authentic French recipe", url: "https://www.youtube.com/results?search_query=Boeuf+Bourguignon+authentic+French+recipe" }
      },
      dessert: {
        name: "Crème Brûlée",
        description: "Silky vanilla custard beneath a crisp, caramelised sugar crust.",
        servings: 6, prepTime: "15 min", cookTime: "45 min + 4 hrs chilling",
        ingredients: [
          {amount:"500 ml", item:"double cream"},
          {amount:"1", item:"vanilla pod, split and scraped"},
          {amount:"6", item:"egg yolks"},
          {amount:"100g", item:"caster sugar"},
          {amount:"6 tbsp", item:"demerara sugar (for brûlée)"}
        ],
        instructions: [
          "Preheat oven to 150°C. Heat cream with vanilla pod and seeds until just simmering. Remove pod.",
          "Whisk egg yolks and caster sugar until pale. Pour warm cream over slowly, whisking constantly.",
          "Strain into a jug. Pour into 6 ramekins set in a baking tray. Fill tray with boiling water to halfway.",
          "Bake 35–40 minutes until just set with a slight wobble. Cool, then refrigerate at least 4 hours.",
          "Sprinkle 1 tbsp demerara sugar evenly over each. Use a blowtorch to caramelise until amber and crackly.",
          "Serve immediately."
        ],
        youtube: { search: "perfect Crème Brûlée recipe French classic", url: "https://www.youtube.com/results?search_query=perfect+Creme+Brulee+recipe" }
      }
    }
  },
  {
    id: "spain", name: "Spain", flag: "🇪🇸", confederation: "UEFA",
    intro: "Spanish food celebrates bold flavours, fresh produce and the joy of sharing — from cold gazpacho to slow-cooked rice.",
    menu: {
      starter: {
        name: "Gazpacho Andaluz",
        description: "Ice-cold blended tomato soup with peppers, cucumber and a drizzle of olive oil.",
        servings: 4, prepTime: "20 min + 2 hrs chilling", cookTime: "0 min",
        ingredients: [
          {amount:"1 kg", item:"ripe tomatoes, roughly chopped"},
          {amount:"1", item:"red pepper, deseeded"},
          {amount:"½", item:"cucumber, peeled"},
          {amount:"2 cloves", item:"garlic"},
          {amount:"50g", item:"stale white bread, crusts removed"},
          {amount:"4 tbsp", item:"extra-virgin olive oil"},
          {amount:"2 tbsp", item:"sherry vinegar"},
          {amount:"to taste", item:"salt"},
          {amount:"to garnish", item:"diced cucumber, croutons, olive oil"}
        ],
        instructions: [
          "Soak bread in cold water for 5 minutes, then squeeze out excess.",
          "Blend tomatoes, pepper, cucumber, garlic and soaked bread until completely smooth.",
          "With blender running, slowly drizzle in olive oil to emulsify.",
          "Add sherry vinegar and salt to taste. Blend again.",
          "Pass through a fine sieve for a very smooth result. Chill at least 2 hours.",
          "Serve in chilled bowls, garnished with diced cucumber, croutons and a drizzle of olive oil."
        ],
        youtube: { search: "authentic gazpacho recipe Spain Andalucia", url: "https://www.youtube.com/results?search_query=authentic+gazpacho+recipe+Spain" }
      },
      main: {
        name: "Paella Valenciana",
        description: "Spain's most famous dish — saffron rice with chicken, rabbit and green beans.",
        servings: 6, prepTime: "20 min", cookTime: "45 min",
        ingredients: [
          {amount:"500g", item:"paella rice (Bomba or Calasparra)"},
          {amount:"400g", item:"chicken thighs, bone-in, cut into pieces"},
          {amount:"300g", item:"rabbit, cut into pieces"},
          {amount:"200g", item:"green beans, trimmed"},
          {amount:"200g", item:"large butter beans (garrofó)"},
          {amount:"400g", item:"crushed tomatoes"},
          {amount:"1.5 L", item:"hot chicken stock"},
          {amount:"1 tsp", item:"sweet smoked paprika"},
          {amount:"generous pinch", item:"saffron threads, soaked in hot water"},
          {amount:"4 tbsp", item:"olive oil"},
          {amount:"4 cloves", item:"garlic, minced"},
          {amount:"to taste", item:"salt"}
        ],
        instructions: [
          "Heat olive oil in a large paella pan. Season and brown chicken and rabbit all over. Push to sides.",
          "Fry green beans in the centre for 3 minutes. Add garlic and paprika, stir briefly.",
          "Add crushed tomatoes and cook down 5 minutes until thick.",
          "Spread rice evenly across the pan. Pour in hot stock and saffron water. Do not stir again.",
          "Cook on high heat 10 minutes, then reduce to medium-low for 10 minutes.",
          "Raise heat for the final 2 minutes to create socarrat (crispy bottom). Listen for a gentle crackle.",
          "Remove from heat, cover with foil and rest 5 minutes. Serve with lemon wedges."
        ],
        youtube: { search: "authentic Paella Valenciana recipe Spain", url: "https://www.youtube.com/results?search_query=authentic+Paella+Valenciana+recipe" }
      },
      dessert: {
        name: "Churros con Chocolate",
        description: "Golden fried dough sticks served with thick hot chocolate for dipping.",
        servings: 4, prepTime: "10 min", cookTime: "20 min",
        ingredients: [
          {amount:"250g", item:"plain flour"},
          {amount:"300 ml", item:"boiling water"},
          {amount:"½ tsp", item:"salt"},
          {amount:"oil", item:"for deep frying"},
          {amount:"cinnamon sugar", item:"for dusting"},
          {amount:"200g", item:"dark chocolate, chopped"},
          {amount:"300 ml", item:"full-fat milk"},
          {amount:"2 tsp", item:"cornflour"},
          {amount:"2 tbsp", item:"sugar"}
        ],
        instructions: [
          "Mix flour, salt and boiling water to a smooth dough. Rest 5 minutes.",
          "Heat oil to 180°C. Fill a piping bag with a star nozzle with the dough.",
          "Pipe 15 cm lengths into the oil, snipping with scissors. Fry 3 minutes per side until golden.",
          "Drain on paper towels. Dust generously with cinnamon sugar.",
          "For chocolate: whisk cornflour into cold milk, add chocolate and sugar, heat and stir until thick.",
          "Serve churros immediately with hot chocolate sauce."
        ],
        youtube: { search: "churros con chocolate recipe Spanish", url: "https://www.youtube.com/results?search_query=churros+con+chocolate+recipe+Spanish" }
      }
    }
  },
  {
    id: "england", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA",
    intro: "English cuisine balances pub classics with Sunday roast traditions and indulgent steamed puddings.",
    menu: {
      starter: {
        name: "Prawn Cocktail",
        description: "Chilled North Atlantic prawns in Marie Rose sauce on crisp lettuce — the classic British starter.",
        servings: 4, prepTime: "15 min", cookTime: "0 min",
        ingredients: [
          {amount:"400g", item:"cooked peeled prawns"},
          {amount:"4 tbsp", item:"mayonnaise"},
          {amount:"2 tbsp", item:"tomato ketchup"},
          {amount:"1 tsp", item:"Worcestershire sauce"},
          {amount:"few drops", item:"Tabasco sauce"},
          {amount:"1 tsp", item:"lemon juice"},
          {amount:"1", item:"iceberg lettuce, shredded"},
          {amount:"1", item:"avocado, sliced"},
          {amount:"to garnish", item:"paprika, lemon wedges, brown bread"}
        ],
        instructions: [
          "Mix mayonnaise, ketchup, Worcestershire sauce, Tabasco and lemon juice to make Marie Rose sauce.",
          "Fold most of the prawns into the sauce, reserving a few for garnish.",
          "Arrange shredded lettuce and avocado slices in cocktail glasses or bowls.",
          "Spoon prawn mixture on top.",
          "Garnish with reserved prawns, a sprinkle of paprika and lemon wedge.",
          "Serve with buttered brown bread and extra lemon."
        ],
        youtube: { search: "prawn cocktail recipe classic British starter", url: "https://www.youtube.com/results?search_query=prawn+cocktail+recipe+classic+British" }
      },
      main: {
        name: "Roast Beef with Yorkshire Pudding & Gravy",
        description: "A proper Sunday roast — sirloin beef with crispy Yorkshires, roast potatoes and rich gravy.",
        servings: 6, prepTime: "30 min", cookTime: "1.5 hrs",
        ingredients: [
          {amount:"1.5 kg", item:"beef sirloin or rib-eye joint"},
          {amount:"2 tbsp", item:"English mustard"},
          {amount:"1 kg", item:"floury potatoes, peeled and parboiled"},
          {amount:"140g", item:"plain flour"},
          {amount:"4", item:"eggs"},
          {amount:"200 ml", item:"whole milk"},
          {amount:"4 tbsp", item:"goose fat or lard"},
          {amount:"500 ml", item:"beef stock"},
          {amount:"150 ml", item:"red wine"},
          {amount:"2 tbsp", item:"plain flour (for gravy)"},
          {amount:"to taste", item:"salt, pepper, horseradish sauce to serve"}
        ],
        instructions: [
          "Preheat oven to 220°C. Rub beef with mustard, salt and pepper. Roast 20 minutes, then reduce to 180°C.",
          "Roast 15 min per 500g for medium-rare. Rest 20 minutes before carving.",
          "Par-boil potatoes 10 minutes, drain and roughen edges. Toss in goose fat, roast 45 minutes until crisp.",
          "For Yorkshires: whisk flour, eggs and milk to smooth batter. Rest 30 minutes.",
          "Heat fat in a muffin tin in the oven until smoking. Pour batter in quickly. Bake 20–25 minutes — do not open the door.",
          "For gravy: pour off excess fat from beef tin. Stir flour into drippings, cook 2 minutes. Add wine and stock, scraping up the bits. Simmer and strain.",
          "Carve beef, serve with Yorkshires, roast potatoes, gravy and horseradish sauce."
        ],
        youtube: { search: "perfect roast beef Yorkshire pudding Sunday roast recipe", url: "https://www.youtube.com/results?search_query=perfect+roast+beef+Yorkshire+pudding+Sunday+roast" }
      },
      dessert: {
        name: "Sticky Toffee Pudding",
        description: "A dense steamed date sponge drenched in warm toffee sauce — Britain's most beloved dessert.",
        servings: 8, prepTime: "20 min", cookTime: "35 min",
        ingredients: [
          {amount:"175g", item:"Medjool dates, pitted and chopped"},
          {amount:"175 ml", item:"boiling water"},
          {amount:"1 tsp", item:"bicarbonate of soda"},
          {amount:"75g", item:"butter"},
          {amount:"175g", item:"dark muscovado sugar"},
          {amount:"3", item:"eggs"},
          {amount:"175g", item:"self-raising flour"},
          {amount:"200g", item:"light brown sugar (toffee sauce)"},
          {amount:"200 ml", item:"double cream (toffee sauce)"},
          {amount:"100g", item:"butter (toffee sauce)"}
        ],
        instructions: [
          "Preheat oven to 180°C. Pour boiling water over dates, add bicarbonate of soda, leave 10 minutes.",
          "Cream butter and sugar until fluffy. Beat in eggs one at a time.",
          "Fold in flour, then stir in date mixture.",
          "Pour into a greased 20×30cm tin and bake 30–35 minutes until firm.",
          "Make toffee sauce: melt butter and brown sugar together, add cream, simmer 3 minutes.",
          "Poke holes in the warm pudding. Pour half the sauce over. Return to oven 5 minutes.",
          "Serve warm with remaining sauce poured over and a scoop of vanilla ice cream."
        ],
        youtube: { search: "sticky toffee pudding recipe best British dessert", url: "https://www.youtube.com/results?search_query=sticky+toffee+pudding+recipe+British" }
      }
    }
  },
  {
    id: "portugal", name: "Portugal", flag: "🇵🇹", confederation: "UEFA",
    intro: "Portuguese cuisine is built on salt cod, seafood, olive oil and a love of custard pastries.",
    menu: {
      starter: {
        name: "Caldo Verde",
        description: "Portugal's national soup — silky potato broth with ribbons of kale and slices of chouriço.",
        servings: 4, prepTime: "15 min", cookTime: "30 min",
        ingredients: [
          {amount:"4", item:"large floury potatoes, peeled and chopped"},
          {amount:"1", item:"onion, diced"},
          {amount:"3 cloves", item:"garlic, sliced"},
          {amount:"1.2 L", item:"water or light stock"},
          {amount:"200g", item:"curly kale or cavolo nero, very finely sliced"},
          {amount:"150g", item:"chouriço, sliced into rounds"},
          {amount:"3 tbsp", item:"olive oil"},
          {amount:"to taste", item:"salt and pepper"}
        ],
        instructions: [
          "Sweat onion and garlic in olive oil 5 minutes. Add potatoes and cover with water or stock.",
          "Season with salt, bring to a boil and cook 20 minutes until potatoes are very soft.",
          "Blend (or mash) until silky smooth. Adjust thickness with more water if needed.",
          "Return to heat, bring to a simmer. Add finely shredded kale and cook 4 minutes.",
          "Meanwhile, fry chouriço slices in a dry pan until lightly crisped.",
          "Ladle soup into bowls, top with chouriço slices and a drizzle of olive oil."
        ],
        youtube: { search: "Caldo Verde Portuguese soup recipe authentic", url: "https://www.youtube.com/results?search_query=Caldo+Verde+Portuguese+soup+recipe" }
      },
      main: {
        name: "Bacalhau à Brás",
        description: "Shredded salt cod scrambled with matchstick potatoes, eggs and olives — a Portuguese icon.",
        servings: 4, prepTime: "20 min + soaking overnight", cookTime: "25 min",
        ingredients: [
          {amount:"400g", item:"dried salt cod (bacalhau), soaked 48 hrs, water changed 3×"},
          {amount:"300g", item:"thin straw potatoes (chips/shoestring)"},
          {amount:"2", item:"large onions, thinly sliced"},
          {amount:"3 cloves", item:"garlic, sliced"},
          {amount:"6", item:"eggs, lightly beaten"},
          {amount:"80g", item:"black olives"},
          {amount:"4 tbsp", item:"olive oil"},
          {amount:"large bunch", item:"fresh parsley, chopped"},
          {amount:"to taste", item:"white pepper"}
        ],
        instructions: [
          "Simmer soaked cod in water 15 minutes. Flake into small pieces, removing all bones and skin.",
          "Fry straw potatoes in olive oil until golden. Drain and set aside.",
          "In a large frying pan, cook onions in olive oil over medium heat until golden, about 12 minutes.",
          "Add garlic and cod, cook 3 minutes, stirring.",
          "Add potatoes, pour in beaten eggs. Stir gently over low heat until eggs are just set but still creamy.",
          "Season with white pepper. Garnish with olives and parsley. Serve immediately."
        ],
        youtube: { search: "Bacalhau à Brás recipe Portuguese cod recipe", url: "https://www.youtube.com/results?search_query=Bacalhau+a+Bras+recipe+Portuguese" }
      },
      dessert: {
        name: "Pastéis de Nata (Custard Tarts)",
        description: "Crisp flaky pastry filled with creamy egg custard, scorched on top — the soul of Lisbon.",
        servings: 12, prepTime: "30 min", cookTime: "20 min",
        ingredients: [
          {amount:"320g", item:"ready-rolled puff pastry"},
          {amount:"250 ml", item:"whole milk"},
          {amount:"200g", item:"caster sugar"},
          {amount:"100 ml", item:"water"},
          {amount:"6", item:"egg yolks"},
          {amount:"30g", item:"plain flour"},
          {amount:"30g", item:"cornflour"},
          {amount:"1", item:"cinnamon stick"},
          {amount:"1", item:"strip lemon zest"},
          {amount:"to serve", item:"cinnamon and icing sugar"}
        ],
        instructions: [
          "Preheat oven to its highest setting (240–250°C). Grease a 12-hole muffin tin.",
          "Boil sugar and water with cinnamon and lemon zest 3 minutes. Cool slightly, remove spices.",
          "Whisk flour, cornflour and milk until smooth. Heat gently, stirring, until thickened.",
          "Remove from heat. Whisk in syrup, then egg yolks. Strain through a sieve.",
          "Cut pastry into rounds, press into muffin holes, forming a cup shape.",
          "Fill three-quarters full with custard. Bake 15–18 minutes until custard is scorched in patches.",
          "Cool briefly, dust with cinnamon and icing sugar. Eat warm."
        ],
        youtube: { search: "Pastéis de Nata recipe Portuguese custard tarts", url: "https://www.youtube.com/results?search_query=Pasteis+de+Nata+recipe+Portuguese+custard+tarts" }
      }
    }
  },
  {
    id: "netherlands", name: "Netherlands", flag: "🇳🇱", confederation: "UEFA",
    intro: "Dutch cooking is honest and filling — split-pea soups, potato-based mashes and buttery stroopwafels.",
    menu: {
      starter: {
        name: "Erwtensoep (Split Pea Soup)",
        description: "The ultimate Dutch winter soup — thick, smoky and filling, served with rye bread and rookworst.",
        servings: 6, prepTime: "15 min", cookTime: "1.5 hrs",
        ingredients: [
          {amount:"500g", item:"green split peas, rinsed"},
          {amount:"1", item:"smoked ham hock"},
          {amount:"2 L", item:"water"},
          {amount:"3", item:"celery stalks with leaves, chopped"},
          {amount:"2", item:"leeks, sliced"},
          {amount:"2", item:"medium potatoes, diced"},
          {amount:"2", item:"carrots, diced"},
          {amount:"1", item:"celeriac (200g), diced"},
          {amount:"1", item:"rookworst (smoked sausage), sliced"},
          {amount:"to taste", item:"salt and pepper"},
          {amount:"to serve", item:"rye bread with butter"}
        ],
        instructions: [
          "Place split peas, ham hock and water in a large pot. Bring to a boil, skim foam, then simmer 1 hour.",
          "Remove ham hock, shred the meat. Discard bone.",
          "Add all vegetables to the pot, simmer 30 more minutes until very soft.",
          "Blend about a third of the soup to give it a thick, creamy consistency.",
          "Return shredded ham and sliced rookworst to the pot. Simmer 5 minutes.",
          "Season generously. Serve very thick (it should set overnight) with buttered rye bread."
        ],
        youtube: { search: "Erwtensoep Dutch split pea soup recipe", url: "https://www.youtube.com/results?search_query=Erwtensoep+Dutch+split+pea+soup+recipe" }
      },
      main: {
        name: "Stamppot Boerenkool met Rookworst",
        description: "Mashed potato and curly kale with smoked sausage — Dutch soul food at its finest.",
        servings: 4, prepTime: "10 min", cookTime: "30 min",
        ingredients: [
          {amount:"1 kg", item:"floury potatoes, peeled and cubed"},
          {amount:"500g", item:"curly kale, tough stems removed, chopped"},
          {amount:"2", item:"rookworst (Dutch smoked sausage)"},
          {amount:"100 ml", item:"warm whole milk"},
          {amount:"50g", item:"butter"},
          {amount:"100g", item:"bacon lardons"},
          {amount:"to taste", item:"salt, pepper and nutmeg"},
          {amount:"to serve", item:"mustard"}
        ],
        instructions: [
          "Boil potatoes in salted water 20 minutes. Add kale on top for last 10 minutes.",
          "Meanwhile, heat rookworst in simmering water 10 minutes.",
          "Fry lardons until crispy.",
          "Drain potatoes and kale thoroughly. Mash together with warm milk and butter.",
          "Season with salt, pepper and freshly grated nutmeg.",
          "Serve stamppot in deep plates with rookworst alongside and crispy bacon on top. Pass mustard at the table."
        ],
        youtube: { search: "Stamppot Boerenkool Dutch recipe traditional", url: "https://www.youtube.com/results?search_query=Stamppot+Boerenkool+Dutch+recipe" }
      },
      dessert: {
        name: "Stroopwafel Ice Cream Sandwiches",
        description: "Caramel-filled Dutch waffle cookies pressed around vanilla ice cream — simple and heavenly.",
        servings: 4, prepTime: "15 min", cookTime: "10 min",
        ingredients: [
          {amount:"8", item:"store-bought stroopwafels"},
          {amount:"500 ml", item:"good vanilla ice cream"},
          {amount:"100g", item:"dark chocolate, melted (optional)"},
          {amount:"50g", item:"toasted flaked almonds (optional)"}
        ],
        instructions: [
          "Soften ice cream at room temperature for 5 minutes until scoopable but not melted.",
          "Place a generous scoop of ice cream on a stroopwafel.",
          "Press a second stroopwafel on top gently to form a sandwich.",
          "Optionally dip edges in melted chocolate and roll in flaked almonds.",
          "Serve immediately or wrap and freeze up to 1 hour.",
          "For the real Dutch experience, first warm the stroopwafel over a cup of hot coffee — the caramel centre melts beautifully."
        ],
        youtube: { search: "homemade stroopwafels recipe Dutch caramel waffle", url: "https://www.youtube.com/results?search_query=homemade+stroopwafels+recipe+Dutch" }
      }
    }
  },
  {
    id: "italy", name: "Italy", flag: "🇮🇹", confederation: "UEFA",
    intro: "Italian cooking turns a handful of perfect ingredients into unforgettable dishes — from rustic Roman pasta to delicate Milanese classics.",
    menu: {
      starter: {
        name: "Bruschetta al Pomodoro",
        description: "Toasted bread rubbed with garlic, topped with marinated ripe tomatoes and fresh basil.",
        servings: 4, prepTime: "15 min", cookTime: "5 min",
        ingredients: [
          {amount:"8 slices", item:"sourdough or ciabatta"},
          {amount:"500g", item:"ripe vine tomatoes, finely chopped"},
          {amount:"2 cloves", item:"garlic (1 minced, 1 halved)"},
          {amount:"handful", item:"fresh basil leaves, torn"},
          {amount:"4 tbsp", item:"extra-virgin olive oil"},
          {amount:"1 tbsp", item:"balsamic glaze"},
          {amount:"to taste", item:"flaked sea salt and black pepper"}
        ],
        instructions: [
          "Mix chopped tomatoes with minced garlic, basil, 2 tbsp olive oil, salt and pepper. Rest 10 minutes.",
          "Grill or toast bread slices until golden and charred on both sides.",
          "Immediately rub each slice with the halved garlic clove.",
          "Drizzle with remaining olive oil.",
          "Spoon tomato mixture generously on top.",
          "Finish with balsamic glaze and extra basil. Serve immediately."
        ],
        youtube: { search: "bruschetta al pomodoro authentic Italian recipe", url: "https://www.youtube.com/results?search_query=bruschetta+al+pomodoro+authentic+Italian+recipe" }
      },
      main: {
        name: "Ossobuco alla Milanese with Saffron Risotto",
        description: "Braised cross-cut veal shanks in white wine with a bright gremolata, alongside creamy saffron risotto.",
        servings: 4, prepTime: "25 min", cookTime: "2 hrs",
        ingredients: [
          {amount:"4", item:"veal ossobuco shanks (3 cm thick)"},
          {amount:"plain flour", item:"for dusting"},
          {amount:"1", item:"onion, finely diced"},
          {amount:"2", item:"carrots, diced"},
          {amount:"2", item:"celery stalks, diced"},
          {amount:"200 ml", item:"dry white wine"},
          {amount:"400g", item:"crushed tomatoes"},
          {amount:"500 ml", item:"beef or veal stock"},
          {amount:"300g", item:"risotto rice (Arborio)"},
          {amount:"1 L", item:"warm chicken stock"},
          {amount:"pinch", item:"saffron threads"},
          {amount:"80g", item:"Parmesan, grated"},
          {amount:"60g", item:"butter"},
          {amount:"gremolata", item:"(1 lemon zest, 1 garlic clove, parsley, minced together)"}
        ],
        instructions: [
          "Dust veal shanks in flour, season well. Brown in butter in a deep casserole, both sides. Remove.",
          "Sauté onion, carrot and celery in same pan 8 minutes. Add wine, reduce by half.",
          "Add tomatoes and stock. Return shanks, bring to a simmer, cover and braise 1.5 hours until meat pulls from bone.",
          "For risotto: soften 1 onion in butter. Toast rice 2 minutes. Add wine.",
          "Add warm saffron-infused stock ladle by ladle, stirring constantly, 18–20 minutes.",
          "Finish with butter and Parmesan. Season.",
          "Place risotto in shallow bowls, top with an ossobuco shank, spoon over braising sauce, scatter gremolata."
        ],
        youtube: { search: "Ossobuco alla Milanese recipe authentic Italian", url: "https://www.youtube.com/results?search_query=Ossobuco+alla+Milanese+recipe+authentic" }
      },
      dessert: {
        name: "Tiramisù",
        description: "Coffee-soaked ladyfingers layered with mascarpone cream and dusted with cocoa — Italy's most beloved dessert.",
        servings: 8, prepTime: "30 min + 4 hrs chilling", cookTime: "0 min",
        ingredients: [
          {amount:"500g", item:"mascarpone"},
          {amount:"6", item:"eggs, separated"},
          {amount:"150g", item:"caster sugar"},
          {amount:"300 ml", item:"strong espresso, cooled"},
          {amount:"3 tbsp", item:"Marsala wine or dark rum"},
          {amount:"300g", item:"Savoiardi (ladyfinger) biscuits"},
          {amount:"3 tbsp", item:"good cocoa powder"}
        ],
        instructions: [
          "Whisk egg yolks and sugar until pale and thick, about 5 minutes.",
          "Beat in mascarpone until smooth.",
          "In a separate bowl, whisk egg whites to stiff peaks. Fold into mascarpone mixture in two additions.",
          "Mix coffee and Marsala in a shallow dish. Quickly dip each ladyfinger (1 second per side) and layer in a 25×30 cm dish.",
          "Spread half the mascarpone mixture. Repeat with another layer of dipped biscuits.",
          "Cover with remaining cream. Sieve cocoa generously over the top.",
          "Refrigerate at least 4 hours (overnight is better). Serve cold."
        ],
        youtube: { search: "classic tiramisu recipe authentic Italian", url: "https://www.youtube.com/results?search_query=classic+tiramisu+recipe+authentic+Italian" }
      }
    }
  },
  {
    id: "belgium", name: "Belgium", flag: "🇧🇪", confederation: "UEFA",
    intro: "Belgium punches above its weight in world cuisine — famous for mussels, beer-braised stews, fries and waffles.",
    menu: {
      starter: {
        name: "Moules-Frites",
        description: "Steamed mussels in white wine, shallots and cream with crispy Belgian frites.",
        servings: 2, prepTime: "20 min", cookTime: "15 min",
        ingredients: [
          {amount:"2 kg", item:"fresh mussels, cleaned and debearded"},
          {amount:"4", item:"shallots, finely sliced"},
          {amount:"3 cloves", item:"garlic, minced"},
          {amount:"200 ml", item:"dry white wine"},
          {amount:"100 ml", item:"double cream"},
          {amount:"50g", item:"butter"},
          {amount:"large handful", item:"flat-leaf parsley, chopped"},
          {amount:"for frites", item:"500g Maris Piper potatoes, cut into thick sticks"},
          {amount:"oil", item:"for deep frying"}
        ],
        instructions: [
          "Cut potatoes, par-fry at 150°C for 7 minutes. Drain and cool. (This is the Belgian double-fry secret.)",
          "In a very large pot, melt butter over high heat. Add shallots and garlic, cook 2 minutes.",
          "Add white wine, bring to a boil, then add all mussels at once. Cover tightly.",
          "Cook 4–5 minutes, shaking occasionally, until all shells open. Discard any closed mussels.",
          "Stir in cream and half the parsley.",
          "While mussels cook, fry chips a second time at 180°C for 3–4 minutes until golden and crisp.",
          "Serve mussels in a deep bowl with frites alongside. Garnish with remaining parsley."
        ],
        youtube: { search: "Moules Frites Belgian recipe classic", url: "https://www.youtube.com/results?search_query=Moules+Frites+Belgian+recipe+classic" }
      },
      main: {
        name: "Carbonnade Flamande (Flemish Beef Beer Stew)",
        description: "Belgian beef braised slowly in dark ale with onions, mustard and a touch of brown sugar.",
        servings: 6, prepTime: "20 min", cookTime: "2.5 hrs",
        ingredients: [
          {amount:"1.5 kg", item:"beef chuck, cut into thick slices"},
          {amount:"4", item:"large onions, sliced"},
          {amount:"500 ml", item:"Belgian dark ale (Dubbel or similar)"},
          {amount:"250 ml", item:"beef stock"},
          {amount:"2 tbsp", item:"Dijon mustard"},
          {amount:"2 tbsp", item:"brown sugar"},
          {amount:"3", item:"bay leaves"},
          {amount:"4", item:"fresh thyme sprigs"},
          {amount:"2 slices", item:"thick bread spread with mustard"},
          {amount:"3 tbsp", item:"butter"},
          {amount:"to taste", item:"salt and pepper"}
        ],
        instructions: [
          "Season beef, brown in batches in butter in a Dutch oven. Set aside.",
          "Cook onions in the same pot over low heat 20 minutes until golden.",
          "Return beef. Add ale, stock, bay, thyme and sugar.",
          "Place mustard-spread bread slices on top — they will dissolve into the sauce as a thickener.",
          "Cover and cook in a 160°C oven for 2–2.5 hours until beef is very tender.",
          "Discard bay and thyme. Season and adjust thickness — add stock if too thick.",
          "Serve with thick-cut frites or crusty bread."
        ],
        youtube: { search: "Carbonnade Flamande Belgian beef beer stew recipe", url: "https://www.youtube.com/results?search_query=Carbonnade+Flamande+Belgian+beef+stew+recipe" }
      },
      dessert: {
        name: "Belgian Liège Waffles",
        description: "Yeast-leavened waffles studded with pearl sugar that caramelises into crispy amber pockets.",
        servings: 8, prepTime: "20 min + 1 hr proving", cookTime: "20 min",
        ingredients: [
          {amount:"500g", item:"plain flour"},
          {amount:"7g", item:"instant yeast"},
          {amount:"250g", item:"unsalted butter, softened"},
          {amount:"2", item:"eggs"},
          {amount:"100 ml", item:"warm milk"},
          {amount:"1 tsp", item:"vanilla extract"},
          {amount:"1 tsp", item:"salt"},
          {amount:"200g", item:"Belgian pearl sugar (or crushed sugar cubes)"}
        ],
        instructions: [
          "Combine flour, yeast, salt, eggs, milk and vanilla. Knead 5 minutes.",
          "Add softened butter a little at a time, kneading until smooth and elastic.",
          "Cover and prove 1 hour at room temperature.",
          "Knock back dough and fold in pearl sugar.",
          "Divide into 8 portions. Cook in a waffle iron preheated and lightly greased.",
          "Cook 3–4 minutes until golden. The pearl sugar will caramelise and create a crispy crust.",
          "Serve immediately — optionally with whipped cream or fresh strawberries."
        ],
        youtube: { search: "Belgian Liège waffles pearl sugar authentic recipe", url: "https://www.youtube.com/results?search_query=Belgian+Liege+waffles+pearl+sugar+recipe" }
      }
    }
  },
  {
    id: "croatia", name: "Croatia", flag: "🇭🇷", confederation: "UEFA",
    intro: "Croatian cuisine blends Adriatic seafood with Balkan grilling traditions and Austrian-influenced pastries.",
    menu: {
      starter: {
        name: "Brudet (Dalmatian Fish Stew)",
        description: "A rustic Adriatic fisherman's stew with mixed fish in a rich tomato and wine broth.",
        servings: 4, prepTime: "20 min", cookTime: "40 min",
        ingredients: [
          {amount:"1 kg", item:"mixed fish fillets (sea bass, bream, monkfish), cut in pieces"},
          {amount:"400g", item:"crushed tomatoes"},
          {amount:"200 ml", item:"dry white wine"},
          {amount:"3", item:"onions, thinly sliced"},
          {amount:"4 cloves", item:"garlic, sliced"},
          {amount:"4 tbsp", item:"olive oil"},
          {amount:"1 tsp", item:"red chilli flakes"},
          {amount:"handful", item:"flat-leaf parsley"},
          {amount:"to serve", item:"polenta or bread"}
        ],
        instructions: [
          "Cook onions in olive oil over low heat for 15 minutes until golden.",
          "Add garlic and chilli flakes, cook 2 minutes.",
          "Add wine, let it reduce by half. Add crushed tomatoes and 200 ml water.",
          "Simmer the sauce 15 minutes until rich.",
          "Add fish pieces. Do not stir — just shake the pan gently to submerge.",
          "Cook 12–15 minutes until fish is just cooked through. Scatter parsley.",
          "Serve in deep bowls with grilled polenta or crusty bread."
        ],
        youtube: { search: "Brudet Dalmatian fish stew recipe Croatian", url: "https://www.youtube.com/results?search_query=Brudet+Dalmatian+fish+stew+Croatian+recipe" }
      },
      main: {
        name: "Peka (Lamb Under the Bell)",
        description: "Lamb and vegetables slowly roasted under a heavy iron bell covered in embers — Croatia's most ceremonial dish.",
        servings: 6, prepTime: "30 min", cookTime: "3 hrs",
        ingredients: [
          {amount:"1.5 kg", item:"bone-in lamb shoulder, cut in large pieces"},
          {amount:"800g", item:"potatoes, quartered"},
          {amount:"3", item:"carrots, chunked"},
          {amount:"2", item:"red peppers, chunked"},
          {amount:"1", item:"head of garlic, halved"},
          {amount:"2", item:"onions, wedged"},
          {amount:"200 ml", item:"white wine"},
          {amount:"4 tbsp", item:"olive oil"},
          {amount:"2 sprigs", item:"rosemary"},
          {amount:"to taste", item:"salt, pepper, sweet paprika"}
        ],
        instructions: [
          "Preheat oven to 200°C (or prepare wood embers if using a traditional peka).",
          "Toss all vegetables with olive oil, wine, garlic, rosemary, salt and paprika in a large metal dish.",
          "Nestle lamb pieces on top. Drizzle with more olive oil and season.",
          "Cover tightly with foil (or a peka bell). Roast at 200°C for 1 hour.",
          "Remove cover, stir vegetables gently, return uncovered for another 45–60 minutes.",
          "Lamb should be falling off the bone and vegetables caramelised.",
          "Serve straight from the dish with crusty bread to mop up the juices."
        ],
        youtube: { search: "Peka lamb Croatian recipe traditional", url: "https://www.youtube.com/results?search_query=Peka+lamb+Croatian+traditional+recipe" }
      },
      dessert: {
        name: "Kremšnita (Croatian Custard Slice)",
        description: "Two layers of puff pastry sandwiching a thick vanilla-egg custard cream — a Croatian café staple.",
        servings: 12, prepTime: "30 min + 4 hrs setting", cookTime: "30 min",
        ingredients: [
          {amount:"500g", item:"ready-rolled puff pastry (2 sheets)"},
          {amount:"1 L", item:"whole milk"},
          {amount:"8", item:"egg yolks"},
          {amount:"200g", item:"caster sugar"},
          {amount:"80g", item:"cornflour"},
          {amount:"1 tsp", item:"vanilla extract"},
          {amount:"300 ml", item:"double cream, whipped to stiff peaks"},
          {amount:"icing sugar", item:"for dusting"}
        ],
        instructions: [
          "Bake each puff pastry sheet at 200°C for 15 minutes until golden. Cool flat.",
          "Whisk egg yolks, sugar and cornflour until pale.",
          "Heat milk until just simmering. Slowly pour over egg mixture, whisking. Return to pan.",
          "Cook over medium heat, stirring constantly, until very thick. Add vanilla. Cool completely.",
          "Fold whipped cream into the cooled custard.",
          "Place one pastry sheet in a deep 30×20 cm tin. Spread the custard cream evenly. Top with second sheet.",
          "Refrigerate 4 hours until set. Dust with icing sugar and cut into squares with a sharp wet knife."
        ],
        youtube: { search: "Kremšnita Croatian custard slice recipe", url: "https://www.youtube.com/results?search_query=Kremsnita+Croatian+custard+slice+recipe" }
      }
    }
  },
  {
    id: "turkey", name: "Turkey", flag: "🇹🇷", confederation: "UEFA",
    intro: "Turkish cuisine is one of the world's great culinary traditions — grilled meats, fragrant spiced soups and the iconic baklava.",
    menu: {
      starter: {
        name: "Mercimek Çorbası (Red Lentil Soup)",
        description: "Silky red lentil soup seasoned with cumin and paprika, finished with sizzling paprika butter.",
        servings: 4, prepTime: "10 min", cookTime: "30 min",
        ingredients: [
          {amount:"300g", item:"red lentils, rinsed"},
          {amount:"1", item:"large onion, diced"},
          {amount:"2", item:"carrots, diced"},
          {amount:"2 cloves", item:"garlic, minced"},
          {amount:"1.2 L", item:"chicken or vegetable stock"},
          {amount:"2 tsp", item:"ground cumin"},
          {amount:"1 tsp", item:"sweet paprika"},
          {amount:"½ tsp", item:"dried mint"},
          {amount:"3 tbsp", item:"olive oil"},
          {amount:"lemon wedges", item:"to serve"},
          {amount:"2 tbsp", item:"butter + 1 tsp paprika (for drizzle)"}
        ],
        instructions: [
          "Sauté onion and carrots in olive oil 8 minutes. Add garlic, cumin and paprika, cook 1 minute.",
          "Add lentils and stock. Bring to a boil, skim, then simmer 25 minutes until lentils collapse.",
          "Blend until completely smooth. Add water if too thick.",
          "Season with salt. Return to gentle heat.",
          "Melt butter in a small pan until foaming. Add paprika, stir 30 seconds.",
          "Ladle soup into bowls, drizzle with paprika butter, scatter dried mint, serve with lemon."
        ],
        youtube: { search: "Mercimek Çorbası Turkish red lentil soup recipe", url: "https://www.youtube.com/results?search_query=Mercimek+Corbasi+Turkish+lentil+soup" }
      },
      main: {
        name: "Adana Kebabı",
        description: "Hand-minced spiced lamb kebabs on flat skewers, chargrilled and served with flatbread and sumac onions.",
        servings: 4, prepTime: "20 min + 1 hr chilling", cookTime: "15 min",
        ingredients: [
          {amount:"800g", item:"lamb mince (20% fat)"},
          {amount:"100g", item:"lamb tail fat or suet, finely chopped"},
          {amount:"2", item:"long red chillies, finely chopped"},
          {amount:"1 tsp", item:"dried chilli flakes"},
          {amount:"1 tsp", item:"ground cumin"},
          {amount:"1 tsp", item:"sweet paprika"},
          {amount:"2 tsp", item:"salt"},
          {amount:"2", item:"red onions (1 for kebab, 1 sliced with sumac for serving)"},
          {amount:"handful", item:"flat-leaf parsley"},
          {amount:"4", item:"flatbreads or pide, to serve"},
          {amount:"1 tbsp", item:"sumac"}
        ],
        instructions: [
          "Mix lamb mince, fat, chillies, spices, salt and grated onion by hand until a cohesive, sticky paste forms.",
          "Refrigerate 1 hour. This is essential for the kebab to hold on the skewer.",
          "Divide into 8 portions. With wet hands, mould each along a wide flat metal skewer.",
          "Grill over hot charcoal (or a hot griddle pan) 4–5 minutes per side until charred and cooked through.",
          "Meanwhile, toss sliced red onion with sumac, parsley and a pinch of salt.",
          "Slide kebabs off skewers onto warm flatbread. Top with sumac onions, tomatoes and green chillies.",
          "Serve with ayran (yogurt drink) or plain yogurt."
        ],
        youtube: { search: "Adana Kebab recipe authentic Turkish charcoal", url: "https://www.youtube.com/results?search_query=Adana+Kebab+recipe+authentic+Turkish" }
      },
      dessert: {
        name: "Baklava",
        description: "Layers of crisp filo pastry filled with pistachios and drenched in orange-scented syrup.",
        servings: 24, prepTime: "40 min", cookTime: "45 min",
        ingredients: [
          {amount:"400g", item:"filo pastry sheets"},
          {amount:"200g", item:"unsalted butter, melted"},
          {amount:"400g", item:"unsalted pistachios, finely chopped"},
          {amount:"400g", item:"sugar"},
          {amount:"300 ml", item:"water"},
          {amount:"1 tbsp", item:"lemon juice"},
          {amount:"1 tbsp", item:"orange blossom water"},
          {amount:"½ tsp", item:"ground cinnamon"}
        ],
        instructions: [
          "Make syrup: boil sugar, water and lemon juice 10 minutes. Add orange blossom water. Cool completely.",
          "Preheat oven to 170°C. Butter a 25×35 cm baking dish.",
          "Layer 10 filo sheets, brushing each with melted butter.",
          "Spread half the pistachios mixed with cinnamon. Layer 5 more buttered filo sheets.",
          "Spread remaining pistachios. Layer remaining filo, each buttered.",
          "Cut into diamonds before baking. Pour any remaining butter over top.",
          "Bake 40–45 minutes until deeply golden. Pour cold syrup over hot baklava. Rest 4 hours minimum."
        ],
        youtube: { search: "Turkish baklava recipe pistachio authentic", url: "https://www.youtube.com/results?search_query=Turkish+baklava+recipe+pistachio+authentic" }
      }
    }
  },
  {
    id: "serbia", name: "Serbia", flag: "🇷🇸", confederation: "UEFA",
    intro: "Serbian cuisine is bold and meaty — chargrilled minced meat, rich stews and cream-laden pastries.",
    menu: {
      starter: {
        name: "Čorba od Povrća (Serbian Vegetable Soup)",
        description: "A hearty, paprika-spiced broth packed with seasonal vegetables and vermicelli.",
        servings: 4, prepTime: "15 min", cookTime: "35 min",
        ingredients: [
          {amount:"2", item:"carrots, diced"},
          {amount:"2", item:"parsnips, diced"},
          {amount:"2", item:"potatoes, diced"},
          {amount:"1", item:"large onion, diced"},
          {amount:"3 cloves", item:"garlic, sliced"},
          {amount:"100g", item:"vermicelli or fine noodles"},
          {amount:"1.5 L", item:"vegetable stock"},
          {amount:"2 tsp", item:"sweet paprika"},
          {amount:"3 tbsp", item:"sunflower oil"},
          {amount:"handful", item:"fresh parsley"},
          {amount:"to taste", item:"salt and pepper"}
        ],
        instructions: [
          "Sauté onion in oil 5 minutes. Add garlic and paprika, stir 1 minute.",
          "Add carrots, parsnips and potatoes. Pour in stock.",
          "Bring to a boil, reduce heat and simmer 20 minutes until vegetables are tender.",
          "Add vermicelli and cook 5 more minutes.",
          "Season with salt and pepper. Stir in fresh parsley.",
          "Serve hot with crusty bread."
        ],
        youtube: { search: "Serbian vegetable soup chorba recipe", url: "https://www.youtube.com/results?search_query=Serbian+vegetable+soup+chorba+recipe" }
      },
      main: {
        name: "Ćevapčići with Ajvar & Lepinja",
        description: "Skinless grilled sausages made from mixed minced meats, served in flatbread with roasted pepper relish.",
        servings: 4, prepTime: "20 min + 1 hr resting", cookTime: "15 min",
        ingredients: [
          {amount:"500g", item:"beef mince"},
          {amount:"300g", item:"pork mince"},
          {amount:"3 cloves", item:"garlic, finely minced"},
          {amount:"1 tsp", item:"baking soda"},
          {amount:"1 tsp", item:"salt"},
          {amount:"1 tsp", item:"black pepper"},
          {amount:"1 tsp", item:"sweet paprika"},
          {amount:"4", item:"lepinja or pita breads"},
          {amount:"4 tbsp", item:"ajvar (roasted pepper relish, from jar)"},
          {amount:"1", item:"white onion, finely diced"},
          {amount:"200g", item:"kaymak or sour cream"}
        ],
        instructions: [
          "Mix beef and pork mince with garlic, baking soda, salt, pepper and paprika.",
          "Knead vigorously for 5 minutes until the mixture becomes sticky.",
          "Refrigerate 1 hour (or overnight — texture improves greatly).",
          "Shape into small cylinders, about 8 cm long and 2 cm thick.",
          "Grill on a hot grill or griddle pan 3–4 minutes per side until cooked through and charred.",
          "Warm lepinja breads on the grill. Spread with ajvar.",
          "Fill breads with ćevapčići, raw onion and a spoonful of kaymak."
        ],
        youtube: { search: "Ćevapčići recipe authentic Balkan grilled sausages", url: "https://www.youtube.com/results?search_query=Cevapcici+recipe+authentic+Balkan" }
      },
      dessert: {
        name: "Krempita (Serbian Custard Cake)",
        description: "Flaky pastry filled with a thick vanilla custard cream — Serbia's answer to the mille-feuille.",
        servings: 12, prepTime: "20 min + 4 hrs setting", cookTime: "20 min",
        ingredients: [
          {amount:"500g", item:"puff pastry (2 sheets)"},
          {amount:"1 L", item:"whole milk"},
          {amount:"6", item:"egg yolks"},
          {amount:"160g", item:"caster sugar"},
          {amount:"80g", item:"cornflour"},
          {amount:"1 tsp", item:"vanilla extract"},
          {amount:"200 ml", item:"double cream, whipped"},
          {amount:"icing sugar", item:"for dusting"}
        ],
        instructions: [
          "Bake puff pastry sheets at 200°C until golden and crisp. Cool completely.",
          "Whisk yolks, sugar and cornflour together.",
          "Heat milk until simmering. Pour slowly into egg mixture, whisking constantly.",
          "Return to pot, cook stirring until very thick. Add vanilla. Cool completely.",
          "Fold whipped cream into cooled custard.",
          "Line a deep tin with one pastry sheet. Spread custard evenly. Top with second sheet.",
          "Chill 4 hours. Dust with icing sugar, cut into squares."
        ],
        youtube: { search: "Krempita recipe Serbian custard cake", url: "https://www.youtube.com/results?search_query=Krempita+recipe+Serbian+custard+cake" }
      }
    }
  },
  {
    id: "poland", name: "Poland", flag: "🇵🇱", confederation: "UEFA",
    intro: "Polish food is rich, warming and deeply satisfying — sour rye soups, hearty hunter's stews and festive poppy seed rolls.",
    menu: {
      starter: {
        name: "Żurek (Sour Rye Soup)",
        description: "Fermented rye flour soup with hard-boiled eggs, white sausage and smoky bacon.",
        servings: 4, prepTime: "5 min (if using starter)", cookTime: "30 min",
        ingredients: [
          {amount:"500 ml", item:"żurek starter (fermented rye flour, from Polish deli or homemade)"},
          {amount:"1 L", item:"chicken stock"},
          {amount:"200g", item:"biała kiełbasa (white sausage), sliced"},
          {amount:"100g", item:"smoked bacon lardons"},
          {amount:"4", item:"hard-boiled eggs, halved"},
          {amount:"3 cloves", item:"garlic, minced"},
          {amount:"1 tsp", item:"marjoram"},
          {amount:"150 ml", item:"sour cream"},
          {amount:"to taste", item:"salt and white pepper"},
          {amount:"to serve", item:"rye bread or bread bowl"}
        ],
        instructions: [
          "Fry bacon lardons until crispy. Add garlic, cook 1 minute.",
          "Pour in stock and bring to a boil. Add sausage slices and marjoram.",
          "Gradually whisk in żurek starter, tasting as you go (it is sour — add to taste).",
          "Simmer 10 minutes. Remove from heat and whisk in sour cream.",
          "Season with salt and pepper.",
          "Serve in bowls or bread bowls with halved hard-boiled eggs on top."
        ],
        youtube: { search: "Żurek recipe Polish sour rye soup authentic", url: "https://www.youtube.com/results?search_query=Zurek+recipe+Polish+sour+rye+soup" }
      },
      main: {
        name: "Bigos (Hunter's Stew)",
        description: "Poland's national dish — sauerkraut and fresh cabbage slow-cooked with multiple meats and mushrooms.",
        servings: 8, prepTime: "30 min", cookTime: "3 hrs",
        ingredients: [
          {amount:"500g", item:"sauerkraut, drained"},
          {amount:"500g", item:"fresh white cabbage, shredded"},
          {amount:"300g", item:"kielbasa sausage, chunked"},
          {amount:"300g", item:"pork shoulder, cubed"},
          {amount:"200g", item:"smoked bacon, diced"},
          {amount:"30g", item:"dried porcini mushrooms, soaked in warm water"},
          {amount:"400g", item:"crushed tomatoes"},
          {amount:"200 ml", item:"dry red wine"},
          {amount:"2", item:"onions, diced"},
          {amount:"3", item:"bay leaves"},
          {amount:"10", item:"black peppercorns"},
          {amount:"4", item:"allspice berries"},
          {amount:"1 tsp", item:"caraway seeds"}
        ],
        instructions: [
          "Brown bacon in a large heavy pot. Brown pork in batches. Set both aside.",
          "Sauté onion until soft. Add mushrooms (with strained soaking liquid) and cook 5 minutes.",
          "Add sauerkraut and fresh cabbage. Pour in wine, tomatoes and mushroom liquid.",
          "Add all meats, bay, peppercorns and allspice.",
          "Simmer covered on very low heat for 2.5 hours, stirring occasionally.",
          "Add kielbasa for the last 30 minutes.",
          "Bigos improves over days — reheat and serve with rye bread. Excellent with a shot of chilled vodka."
        ],
        youtube: { search: "Bigos recipe Polish hunters stew authentic", url: "https://www.youtube.com/results?search_query=Bigos+recipe+Polish+hunters+stew" }
      },
      dessert: {
        name: "Makowiec (Poppy Seed Roll)",
        description: "A yeasted dough rolled around a dense filling of poppy seeds, honey, raisins and orange peel.",
        servings: 12, prepTime: "40 min + 2 hrs proving", cookTime: "40 min",
        ingredients: [
          {amount:"500g", item:"plain flour"},
          {amount:"7g", item:"instant yeast"},
          {amount:"200 ml", item:"warm milk"},
          {amount:"80g", item:"butter, softened"},
          {amount:"2", item:"eggs"},
          {amount:"80g", item:"sugar"},
          {amount:"400g", item:"blue poppy seeds"},
          {amount:"150g", item:"honey"},
          {amount:"100g", item:"raisins"},
          {amount:"zest", item:"of 1 orange"},
          {amount:"50g", item:"walnuts, chopped"},
          {amount:"icing sugar", item:"for dusting"}
        ],
        instructions: [
          "Make dough: combine flour, yeast, salt, sugar, eggs, milk and butter. Knead 10 minutes until smooth. Prove 1 hour.",
          "Grind poppy seeds in a blender or food processor until fine.",
          "Mix ground poppy seeds with honey, raisins, orange zest and walnuts in a pan. Heat gently 5 minutes, stirring. Cool.",
          "Roll dough into a 30×40 cm rectangle. Spread filling evenly, leaving a 2 cm border.",
          "Roll tightly from the long side. Pinch seams. Prove on a lined baking sheet 45 minutes.",
          "Bake at 180°C for 35–40 minutes until golden. Cool completely.",
          "Dust with icing sugar, slice and serve."
        ],
        youtube: { search: "Makowiec Polish poppy seed roll recipe Christmas", url: "https://www.youtube.com/results?search_query=Makowiec+Polish+poppy+seed+roll+recipe" }
      }
    }
  },
  {
    id: "austria", name: "Austria", flag: "🇦🇹", confederation: "UEFA",
    intro: "Austrian cuisine blends Viennese refinement with Alpine heartiness — from delicate soups to crispy schnitzel and the legendary Sachertorte.",
    menu: {
      starter: {
        name: "Leberknödelsuppe (Liver Dumpling Soup)",
        description: "Clear golden beef broth with rich, herby liver dumplings — a Viennese classic.",
        servings: 4, prepTime: "25 min", cookTime: "15 min",
        ingredients: [
          {amount:"300g", item:"chicken or calf liver, finely minced"},
          {amount:"100g", item:"stale white bread, soaked in milk and squeezed"},
          {amount:"1", item:"egg"},
          {amount:"1", item:"small onion, grated"},
          {amount:"2 tbsp", item:"plain flour"},
          {amount:"1 tbsp", item:"marjoram"},
          {amount:"1 tbsp", item:"flat-leaf parsley, chopped"},
          {amount:"1.5 L", item:"good beef consommé or clear stock"},
          {amount:"to taste", item:"salt, pepper, nutmeg"}
        ],
        instructions: [
          "Mix liver, bread, egg, onion, flour, marjoram and parsley until combined.",
          "Season well with salt, pepper and nutmeg.",
          "Refrigerate 20 minutes to firm up.",
          "Bring stock to a gentle simmer.",
          "Form mixture into 8 dumplings with wet hands. Simmer in stock 12 minutes until cooked through.",
          "Serve in warmed bowls with broth, garnished with parsley."
        ],
        youtube: { search: "Leberknödelsuppe Austrian liver dumpling soup recipe", url: "https://www.youtube.com/results?search_query=Leberknödelsuppe+Austrian+liver+dumpling+soup" }
      },
      main: {
        name: "Wiener Schnitzel",
        description: "Veal pounded paper-thin, breaded and fried in clarified butter until it ripples and puffs.",
        servings: 4, prepTime: "20 min", cookTime: "15 min",
        ingredients: [
          {amount:"4", item:"veal escalopes (150g each)"},
          {amount:"plain flour", item:"for dusting"},
          {amount:"3", item:"eggs, beaten"},
          {amount:"200g", item:"fresh white breadcrumbs"},
          {amount:"150g", item:"clarified butter (Butterschmalz)"},
          {amount:"1", item:"lemon, for squeezing"},
          {amount:"to serve", item:"potato salad, lingonberry jam, lemon wedges, parsley"}
        ],
        instructions: [
          "Pound veal escalopes between cling film to 3–4 mm thickness.",
          "Season flour. Set up a three-stage breading station: flour, beaten egg, breadcrumbs.",
          "Coat each schnitzel lightly in flour, then egg, then breadcrumbs. Do not press the crumbs — they should be loose.",
          "Heat clarified butter to 170°C in a wide pan — there should be enough to almost float the schnitzel.",
          "Fry each schnitzel 2–3 minutes per side, tilting and spooning butter over as it cooks so the crumb puffs up.",
          "Drain on paper towels. Serve immediately with a squeeze of lemon, potato salad and a side of lingonberry jam."
        ],
        youtube: { search: "Wiener Schnitzel authentic recipe veal Austrian", url: "https://www.youtube.com/results?search_query=Wiener+Schnitzel+authentic+recipe+Austrian" }
      },
      dessert: {
        name: "Sachertorte",
        description: "Vienna's legendary dense chocolate cake with apricot jam glaze beneath a mirror-smooth chocolate icing.",
        servings: 12, prepTime: "40 min", cookTime: "1 hr",
        ingredients: [
          {amount:"200g", item:"dark chocolate (70%), melted"},
          {amount:"150g", item:"unsalted butter, softened"},
          {amount:"150g", item:"caster sugar"},
          {amount:"8", item:"eggs, separated"},
          {amount:"150g", item:"plain flour"},
          {amount:"250g", item:"apricot jam, warmed and strained"},
          {amount:"200g", item:"dark chocolate (for icing)"},
          {amount:"200 ml", item:"double cream"}
        ],
        instructions: [
          "Preheat oven to 170°C. Beat butter and 100g sugar until pale. Beat in melted chocolate.",
          "Add egg yolks one at a time. Fold in flour.",
          "Whisk egg whites with remaining 50g sugar to stiff peaks. Fold into batter in three additions.",
          "Bake in a greased, floured 23 cm tin for 55–60 minutes. Cool completely.",
          "Split cake in half. Brush both cut surfaces generously with warm apricot jam. Reassemble.",
          "Coat outside of cake with remaining jam. Let set 30 minutes.",
          "Melt chocolate with cream, pour over cake and smooth with a palette knife. Set before serving with whipped cream."
        ],
        youtube: { search: "Sachertorte recipe authentic Viennese chocolate cake", url: "https://www.youtube.com/results?search_query=Sachertorte+recipe+authentic+Vienna" }
      }
    }
  },
  {
    id: "scotland", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA",
    intro: "Scottish cuisine draws on wild Highland landscapes — game, oats, whisky and foraged berries.",
    menu: {
      starter: {
        name: "Cock-a-Leekie Soup",
        description: "A gentle chicken and leek broth with prunes — Scotland's oldest documented soup.",
        servings: 4, prepTime: "15 min", cookTime: "1 hr",
        ingredients: [
          {amount:"4", item:"chicken thighs, bone-in"},
          {amount:"4", item:"large leeks, sliced (white and pale green)"},
          {amount:"8", item:"prunes, pitted"},
          {amount:"1.5 L", item:"chicken stock"},
          {amount:"1", item:"bay leaf"},
          {amount:"4", item:"black peppercorns"},
          {amount:"handful", item:"flat-leaf parsley"},
          {amount:"to taste", item:"salt and pepper"}
        ],
        instructions: [
          "Place chicken, stock, bay and peppercorns in a large pot. Bring to a boil, skim well.",
          "Add half the leeks. Simmer 45 minutes until chicken is very tender.",
          "Remove chicken, shred meat and discard bones and skin.",
          "Add remaining leeks and prunes to the broth. Simmer 10 minutes.",
          "Return shredded chicken to the pot. Season well.",
          "Serve in deep bowls, scattered with parsley."
        ],
        youtube: { search: "Cock-a-Leekie soup recipe traditional Scottish", url: "https://www.youtube.com/results?search_query=Cock-a-Leekie+soup+recipe+traditional+Scottish" }
      },
      main: {
        name: "Haggis, Neeps & Tatties",
        description: "Scotland's national dish — spiced offal pudding with buttered swede and mashed potato, served with whisky cream sauce.",
        servings: 4, prepTime: "15 min", cookTime: "2.5 hrs",
        ingredients: [
          {amount:"1", item:"haggis (450g, from butcher or good supermarket)"},
          {amount:"600g", item:"swede (neeps), peeled and diced"},
          {amount:"600g", item:"floury potatoes (tatties), peeled and diced"},
          {amount:"50g", item:"butter"},
          {amount:"100 ml", item:"double cream"},
          {amount:"2 tbsp", item:"Scotch whisky"},
          {amount:"1", item:"shallot, finely diced"},
          {amount:"100 ml", item:"chicken stock"},
          {amount:"to taste", item:"salt, pepper, nutmeg"}
        ],
        instructions: [
          "Wrap haggis in foil. Simmer in a pan of water for 2 hours.",
          "Boil swede until very tender, mash with butter and a little cream. Season with salt, pepper and nutmeg.",
          "Boil potatoes until tender, mash with remaining butter and cream. Season.",
          "For whisky sauce: sweat shallot in butter. Add whisky, ignite (optional). Add stock and cream, simmer until sauce consistency.",
          "Remove haggis from foil and casing. Serve generous spoonfuls on the plate.",
          "Arrange swede and potato alongside. Drizzle with whisky cream sauce."
        ],
        youtube: { search: "haggis neeps tatties recipe Burns Night Scotland", url: "https://www.youtube.com/results?search_query=haggis+neeps+tatties+recipe+Burns+Night" }
      },
      dessert: {
        name: "Cranachan",
        description: "A no-cook Scottish dessert of whipped cream, oats, raspberries and malt whisky — incredibly simple and good.",
        servings: 4, prepTime: "15 min + 30 min soaking", cookTime: "5 min",
        ingredients: [
          {amount:"75g", item:"pinhead oatmeal"},
          {amount:"400 ml", item:"double cream"},
          {amount:"3 tbsp", item:"runny honey"},
          {amount:"3 tbsp", item:"Scotch whisky"},
          {amount:"300g", item:"fresh raspberries"},
          {amount:"1 tbsp", item:"icing sugar"}
        ],
        instructions: [
          "Toast oatmeal in a dry frying pan until golden and nutty-smelling. Cool.",
          "Whip cream to soft peaks. Stir in 2 tbsp honey and the whisky.",
          "Fold in most of the toasted oats.",
          "Crush half the raspberries with icing sugar to make a rough coulis.",
          "Layer cream mixture, fresh raspberries and crushed raspberry coulis in glasses.",
          "Top with remaining oats and a drizzle of honey. Serve immediately."
        ],
        youtube: { search: "Cranachan recipe traditional Scottish dessert whisky", url: "https://www.youtube.com/results?search_query=Cranachan+recipe+traditional+Scottish+dessert" }
      }
    }
  },
  {
    id: "denmark", name: "Denmark", flag: "🇩🇰", confederation: "UEFA",
    intro: "Danish cuisine is defined by smørrebrød open sandwiches, smoky fish soups and beloved æbleskiver pancake balls.",
    menu: {
      starter: {
        name: "Fiskesuppe (Danish Fish Soup)",
        description: "A creamy, dill-scented fish and shellfish soup with root vegetables.",
        servings: 4, prepTime: "20 min", cookTime: "30 min",
        ingredients: [
          {amount:"400g", item:"mixed white fish fillets (cod, hake), cut in chunks"},
          {amount:"200g", item:"raw prawns, peeled"},
          {amount:"2", item:"carrots, diced small"},
          {amount:"2", item:"celery stalks, diced"},
          {amount:"1", item:"leek, sliced"},
          {amount:"800 ml", item:"fish stock"},
          {amount:"200 ml", item:"double cream"},
          {amount:"100 ml", item:"dry white wine"},
          {amount:"large bunch", item:"fresh dill, chopped"},
          {amount:"2 tbsp", item:"butter"},
          {amount:"to taste", item:"salt, white pepper, lemon juice"}
        ],
        instructions: [
          "Soften carrots, celery and leek in butter 8 minutes.",
          "Add wine, reduce 2 minutes. Add fish stock and simmer 15 minutes.",
          "Add fish chunks, simmer 5 minutes. Add prawns, cook 3 more minutes.",
          "Pour in cream, stir gently. Heat through but do not boil.",
          "Season with salt, white pepper and a squeeze of lemon.",
          "Serve in deep bowls with plenty of dill and crusty bread."
        ],
        youtube: { search: "Danish fish soup fiskesuppe recipe Scandinavian", url: "https://www.youtube.com/results?search_query=Danish+fish+soup+fiskesuppe+recipe" }
      },
      main: {
        name: "Frikadeller with Creamed Potatoes & Pickled Cucumber",
        description: "Pan-fried Danish pork meatballs with silky potato purée and refreshing pickled cucumber salad.",
        servings: 4, prepTime: "20 min", cookTime: "25 min",
        ingredients: [
          {amount:"500g", item:"pork mince"},
          {amount:"1", item:"onion, grated"},
          {amount:"1", item:"egg"},
          {amount:"3 tbsp", item:"plain flour"},
          {amount:"100 ml", item:"sparkling water"},
          {amount:"1 tsp", item:"salt"},
          {amount:"½ tsp", item:"allspice"},
          {amount:"butter", item:"for frying"},
          {amount:"1 kg", item:"potatoes, peeled"},
          {amount:"100 ml", item:"warm cream"},
          {amount:"50g", item:"butter (for potato)"},
          {amount:"1", item:"cucumber, thinly sliced"},
          {amount:"3 tbsp", item:"white wine vinegar"},
          {amount:"2 tbsp", item:"sugar"}
        ],
        instructions: [
          "Mix pork mince, onion, egg, flour, sparkling water, salt and allspice. Beat well until the texture is sticky.",
          "Shape into oval patties with a wet spoon — the batter is quite soft.",
          "Fry in butter over medium heat, 5–6 minutes per side until golden and cooked through.",
          "Boil potatoes, drain, mash with warm cream and butter until very smooth. Season.",
          "For pickled cucumber: dissolve vinegar and sugar, pour over cucumber slices. Rest 15 minutes.",
          "Serve frikadeller with creamed potato and pickled cucumber alongside."
        ],
        youtube: { search: "Frikadeller recipe Danish meatballs traditional", url: "https://www.youtube.com/results?search_query=Frikadeller+recipe+Danish+meatballs" }
      },
      dessert: {
        name: "Æbleskiver (Danish Pancake Balls)",
        description: "Puffy, spherical pancakes cooked in a special cast-iron pan, served with jam and icing sugar.",
        servings: 24, prepTime: "15 min", cookTime: "20 min",
        ingredients: [
          {amount:"250g", item:"plain flour"},
          {amount:"2 tsp", item:"baking powder"},
          {amount:"½ tsp", item:"bicarbonate of soda"},
          {amount:"2 tbsp", item:"sugar"},
          {amount:"½ tsp", item:"salt"},
          {amount:"½ tsp", item:"cardamom"},
          {amount:"3", item:"eggs, separated"},
          {amount:"300 ml", item:"buttermilk"},
          {amount:"30g", item:"butter, melted"},
          {amount:"to serve", item:"strawberry jam and icing sugar"}
        ],
        instructions: [
          "Whisk flour, baking powder, bicarb, sugar, salt and cardamom.",
          "Mix egg yolks, buttermilk and melted butter. Combine with dry ingredients.",
          "Whisk egg whites to stiff peaks. Fold into batter.",
          "Heat an æbleskiver pan (or small muffin tins). Brush each hole with butter.",
          "Half-fill each hole with batter. When edges start to set, use a skewer to rotate 90°. Cook further, then rotate again to form a complete sphere.",
          "Remove when golden all over. Serve hot dusted with icing sugar, with jam for dipping."
        ],
        youtube: { search: "Æbleskiver recipe Danish pancake balls traditional", url: "https://www.youtube.com/results?search_query=Ableskiver+recipe+Danish+pancake+balls" }
      }
    }
  },
  {
    id: "hungary", name: "Hungary", flag: "🇭🇺", confederation: "UEFA",
    intro: "Hungarian cuisine is defined by paprika — rich goulash soups, paprika-stewed meats and the extraordinary Dobos torte.",
    menu: {
      starter: {
        name: "Gulyásleves (Hungarian Goulash Soup)",
        description: "The original goulash — a paprika-rich beef and potato soup, hearty enough to be a meal.",
        servings: 6, prepTime: "20 min", cookTime: "1.5 hrs",
        ingredients: [
          {amount:"600g", item:"beef chuck, cut into 1.5 cm cubes"},
          {amount:"3", item:"onions, diced"},
          {amount:"3", item:"potatoes, diced"},
          {amount:"3 tbsp", item:"sweet Hungarian paprika"},
          {amount:"1 tsp", item:"hot paprika"},
          {amount:"1 tsp", item:"caraway seeds"},
          {amount:"1", item:"red pepper, diced"},
          {amount:"3 cloves", item:"garlic, sliced"},
          {amount:"400g", item:"crushed tomatoes"},
          {amount:"1.5 L", item:"beef stock"},
          {amount:"3 tbsp", item:"lard or sunflower oil"},
          {amount:"to serve", item:"sour cream and crusty bread"}
        ],
        instructions: [
          "Heat lard in a heavy pot. Brown beef in batches. Set aside.",
          "Fry onions in the same pot 10 minutes until golden.",
          "Remove pot from heat. Add both paprikas and caraway seeds — this is crucial: paprika burns if added over heat.",
          "Return to heat. Add garlic, beef, peppers and tomatoes. Stir.",
          "Pour in stock. Bring to a boil, then simmer 1 hour until beef is nearly tender.",
          "Add potatoes, cook 20 more minutes.",
          "Season and serve with a dollop of sour cream and fresh bread."
        ],
        youtube: { search: "authentic Hungarian goulash soup gulyás recipe", url: "https://www.youtube.com/results?search_query=authentic+Hungarian+goulash+soup+gulyas+recipe" }
      },
      main: {
        name: "Pörkölt (Beef Paprika Stew) with Nokedli",
        description: "Tender beef stewed in a deeply paprika-scented sauce, served with Hungarian egg noodle dumplings.",
        servings: 4, prepTime: "20 min", cookTime: "2 hrs",
        ingredients: [
          {amount:"1 kg", item:"beef chuck, cubed"},
          {amount:"3", item:"onions, finely diced"},
          {amount:"3 tbsp", item:"sweet paprika"},
          {amount:"1 tsp", item:"hot paprika"},
          {amount:"2", item:"tomatoes, diced"},
          {amount:"2", item:"green peppers, diced"},
          {amount:"100 ml", item:"dry red wine"},
          {amount:"200 ml", item:"beef stock"},
          {amount:"3 tbsp", item:"lard or sunflower oil"},
          {amount:"300g", item:"plain flour (nokedli)"},
          {amount:"3", item:"eggs (nokedli)"},
          {amount:"200 ml", item:"water (nokedli)"},
          {amount:"to serve", item:"sour cream and pickled peppers"}
        ],
        instructions: [
          "Fry onions in lard until golden. Off heat, add both paprikas and stir.",
          "Add beef, tomatoes and green peppers. Return to medium heat.",
          "Add wine and stock. Bring to a boil, cover and simmer 1.5–2 hours.",
          "Sauce should be thick and glossy — add water if needed. Season.",
          "For nokedli: mix flour, eggs, water and salt to a soft, wet batter.",
          "Press through a colander with large holes into boiling salted water. Cook 2 minutes, drain.",
          "Serve pörkölt over nokedli with a generous spoonful of sour cream."
        ],
        youtube: { search: "Pörkölt Hungarian beef stew nokedli recipe", url: "https://www.youtube.com/results?search_query=Porkölt+Hungarian+beef+stew+nokedli+recipe" }
      },
      dessert: {
        name: "Dobos Torte",
        description: "Six thin sponge layers with chocolate buttercream and a hard caramel top — Budapest's most elegant cake.",
        servings: 12, prepTime: "1 hr", cookTime: "30 min",
        ingredients: [
          {amount:"6", item:"eggs, separated"},
          {amount:"150g", item:"caster sugar"},
          {amount:"150g", item:"plain flour"},
          {amount:"200g", item:"dark chocolate, melted"},
          {amount:"300g", item:"unsalted butter, softened"},
          {amount:"150g", item:"icing sugar"},
          {amount:"3", item:"egg yolks (for buttercream)"},
          {amount:"150g", item:"caster sugar (for caramel)"},
          {amount:"2 tbsp", item:"water (for caramel)"}
        ],
        instructions: [
          "Preheat oven to 190°C. Whisk egg yolks and caster sugar until pale. Fold in flour, then stiff egg whites.",
          "Spread thinly across 6 lined 22 cm baking circles. Bake each 8 minutes until golden. Cool.",
          "Chocolate buttercream: beat butter and icing sugar, add melted chocolate and egg yolks. Beat until smooth.",
          "Layer sponges with buttercream. Coat sides and top with remaining buttercream.",
          "Reserve the best sponge layer for the top. Make caramel: boil sugar and water until amber.",
          "Pour caramel over the reserved sponge on an oiled surface. Before it sets, mark into 12 wedges with an oiled knife.",
          "Arrange caramel wedges angled up on top of the cake. Refrigerate 2 hours before serving."
        ],
        youtube: { search: "Dobos Torte recipe Hungarian caramel layer cake", url: "https://www.youtube.com/results?search_query=Dobos+Torte+recipe+Hungarian+caramel+cake" }
      }
    }
  }
];
