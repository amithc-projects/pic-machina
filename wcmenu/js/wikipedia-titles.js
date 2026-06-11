// Maps countryId_courseType → Wikipedia article title used to fetch dish thumbnail images.
// Source: Wikipedia REST API  https://en.wikipedia.org/api/rest_v1/page/summary/{title}
const WIKIPEDIA_TITLES = {
  // Germany
  germany_starter:       "Lentil soup",
  germany_main:          "Sauerbraten",
  germany_dessert:       "Black Forest gateau",
  // France
  france_starter:        "French onion soup",
  france_main:           "Beef bourguignon",
  france_dessert:        "Crème brûlée",
  // Spain
  spain_starter:         "Gazpacho",
  spain_main:            "Paella",
  spain_dessert:         "Churros",
  // England
  england_starter:       "Prawn cocktail",
  england_main:          "Yorkshire pudding",
  england_dessert:       "Sticky toffee pudding",
  // Portugal
  portugal_starter:      "Caldo verde",
  portugal_main:         "Bacalhau à Brás",
  portugal_dessert:      "Pastel de nata",
  // Netherlands
  netherlands_starter:   "Erwtensoep",
  netherlands_main:      "Stamppot",
  netherlands_dessert:   "Stroopwafel",
  // Italy
  italy_starter:         "Bruschetta",
  italy_main:            "Ossobuco",
  italy_dessert:         "Tiramisu",
  // Belgium
  belgium_starter:       "Moules-frites",
  belgium_main:          "Carbonnade flamande",
  belgium_dessert:       "Belgian waffle",
  // Croatia
  croatia_starter:       "Brudet",
  croatia_main:          "Peka (food)",
  croatia_dessert:       "Krempita",
  // Turkey
  turkey_starter:        "Mercimek çorbası",
  turkey_main:           "Adana kebabı",
  turkey_dessert:        "Baklava",
  // Serbia
  serbia_starter:        "Čorba",
  serbia_main:           "Ćevapi",
  serbia_dessert:        "Krempita",
  // Poland
  poland_starter:        "Żurek",
  poland_main:           "Bigos",
  poland_dessert:        "Makowiec",
  // Austria
  austria_starter:       "Leberknödelsuppe",
  austria_main:          "Wiener Schnitzel",
  austria_dessert:       "Sachertorte",
  // Scotland
  scotland_starter:      "Cock-a-leekie",
  scotland_main:         "Haggis",
  scotland_dessert:      "Cranachan",
  // Denmark
  denmark_starter:       "Fish soup",
  denmark_main:          "Frikadeller",
  denmark_dessert:       "Æbleskiver",
  // Hungary
  hungary_starter:       "Gulyás",
  hungary_main:          "Pörkölt",
  hungary_dessert:       "Dobos torte",
  // Argentina
  argentina_starter:     "Empanada",
  argentina_main:        "Asado",
  argentina_dessert:     "Alfajor",
  // Brazil
  brazil_starter:        "Coxinha",
  brazil_main:           "Feijoada",
  brazil_dessert:        "Brigadeiro",
  // Uruguay
  uruguay_starter:       "Spanish omelette",
  uruguay_main:          "Chivito (sandwich)",
  uruguay_dessert:       "Torta frita",
  // Colombia
  colombia_starter:      "Ajiaco",
  colombia_main:         "Bandeja paisa",
  colombia_dessert:      "Buñuelo",
  // Ecuador
  ecuador_starter:       "Locro",
  ecuador_main:          "Seco de pollo",
  ecuador_dessert:       "Espumilla",
  // Paraguay
  paraguay_starter:      "Sopa paraguaya",
  paraguay_main:         "Chipa guasú",
  paraguay_dessert:      "Kivevé",
  // Venezuela
  venezuela_starter:     "Tequeño",
  venezuela_main:        "Pabellón criollo",
  venezuela_dessert:     "Quesillo (dessert)",
  // Chile
  chile_starter:         "Pan amasado",
  chile_main:            "Cazuela",
  chile_dessert:         "Leche asada",
  // USA
  usa_starter:           "Clam chowder",
  usa_main:              "Spare ribs",
  usa_dessert:           "Apple pie",
  // Canada
  canada_starter:        "Poutine",
  canada_main:           "Atlantic salmon",
  canada_dessert:        "Butter tart",
  // Mexico
  mexico_starter:        "Guacamole",
  mexico_main:           "Mole (sauce)",
  mexico_dessert:        "Tres leches cake",
  // Panama
  panama_starter:        "Ceviche",
  panama_main:           "Sancocho",
  panama_dessert:        "Arroz con leche",
  // Costa Rica
  "costa-rica_starter":  "Gallo pinto",
  "costa-rica_main":     "Casado (food)",
  "costa-rica_dessert":  "Tres leches cake",
  // Jamaica
  jamaica_starter:       "Ackee and saltfish",
  jamaica_main:          "Jerk chicken",
  jamaica_dessert:       "Black cake",
  // Morocco
  morocco_starter:       "Harira",
  morocco_main:          "Tajine",
  morocco_dessert:       "Bastilla",
  // Senegal
  senegal_starter:       "Accara",
  senegal_main:          "Thiéboudienne",
  senegal_dessert:       "Thiakry",
  // Nigeria
  nigeria_starter:       "Nigerian pepper soup",
  nigeria_main:          "Jollof rice",
  nigeria_dessert:       "Puff-puff (food)",
  // Ivory Coast
  "ivory-coast_starter": "Kedjenou",
  "ivory-coast_main":    "Attiéké",
  "ivory-coast_dessert": "Alloco",
  // Egypt
  egypt_starter:         "Ful medames",
  egypt_main:            "Kushari",
  egypt_dessert:         "Om Ali",
  // South Africa
  "south-africa_starter":"Boerewors",
  "south-africa_main":   "Braai",
  "south-africa_dessert":"Melktert",
  // Cameroon
  cameroon_starter:      "Beignet",
  cameroon_main:         "Ndolé",
  cameroon_dessert:      "Beignet",
  // Tunisia
  tunisia_starter:       "Brik",
  tunisia_main:          "Couscous",
  tunisia_dessert:       "Makroudh",
  // Algeria
  algeria_starter:       "Chorba",
  algeria_main:          "Chakhchoukha",
  algeria_dessert:       "Zlabia",
  // Japan
  japan_starter:         "Miso soup",
  japan_main:            "Ramen",
  japan_dessert:         "Mochi",
  // South Korea
  "south-korea_starter": "Pajeon",
  "south-korea_main":    "Bibimbap",
  "south-korea_dessert": "Bingsu",
  // Australia
  australia_starter:     "Barramundi",
  australia_main:        "Roast lamb",
  australia_dessert:     "Lamington",
  // Saudi Arabia
  "saudi-arabia_starter":"Mutabbaq",
  "saudi-arabia_main":   "Kabsa",
  "saudi-arabia_dessert":"Luqaimat",
  // Iran
  iran_starter:          "Ash reshteh",
  iran_main:             "Ghormeh sabzi",
  iran_dessert:          "Sholeh zard",
  // Qatar
  qatar_starter:         "Tharid",
  qatar_main:            "Machboos",
  qatar_dessert:         "Balaleet",
  // Indonesia
  indonesia_starter:     "Gado-gado",
  indonesia_main:        "Rendang",
  indonesia_dessert:     "Cendol",
  // China
  china_starter:         "Hot and sour soup",
  china_main:            "Peking duck",
  china_dessert:         "Tanghulu",
  // New Zealand
  "new-zealand_starter": "Whitebait (food)",
  "new-zealand_main":    "Hāngī",
  "new-zealand_dessert": "Pavlova (food)"
};
