/**
 * Extra placeables added for parity with the web planner's item list.
 * Names and footprints are game facts; all artwork is generated separately.
 */
import type { SupplementalGroup } from './supplemental';

export const EXTRA_FURNITURE: SupplementalGroup[] = [
  {
    cat: 'furniture', sub: 'Paintings', kind: 'painting', w: 1, h: 1, place: 'wall',
    items: ["A Night On Eco-Hill|2|2", "Abstract|2|2", "Binary|1|2", "Blue City|1|2", "Boat|2|2", "Checkers|1|2", "Community Center|4|2", "Frozen Dreams|2|2", "Hut|1|2", "It Howls In The Rain|1|2", "Jade Hills Extended|4|2", "Journey Of The Prairie King: The Motion Picture|1|2", "Little Buddies|3|2", "Mysterium|1|2", "Natural Wonders: Exploring Our Vibrant World|1|2", "Runes|1|2", "Squid Kid|2|3", "Stardrop|2|2", "Starship|3|2", "Sun #45|1|2", "The Miracle At Coldstar Ranch|1|2", "The Muzzamaroo|2|2", "The Zuzu City Express|1|2", "UFO|2|2", "VGA Paradise|2|2", "Void Swirls|2|2", "Wizard's Tower|2|2", "Abigail Portrait|2|2", "Alex Portrait|2|2", "Art Photo|1|2", "Art Photo 2|1|2", "Bulletin Board|3|2", "Calendar|1|2", "Colorful Set|1|2", "Elliott Portrait|2|2", "Emily Portrait|2|2", "Foliage Print|2|2", "Haley Portrait|2|2", "Harvey Portrait|2|2", "J Sign|2|2", "J. Painting|1|2", "Joja Cola Painting|2|2", "Joja HQ Painting|2|2", "Leah Portrait|2|2", "Little Photos|1|2", "Manager of the Year|2|2", "Maru Portrait|2|2", "My First Painting|2|2", "Needlepoint Flower|1|2", "Penny Portrait|2|2", "Periodic Table|2|2", "Pig Painting|3|2", "Sam Portrait|2|2", "Sebastian Portrait|2|2", "Shane Portrait|2|2", "Skull Poster|1|2", "Sun Dunes|2|2", "World Map|2|2"],
  },
  {
    cat: 'furniture', sub: 'Decorative', kind: 'decor', w: 1, h: 1, place: 'object',
    items: ["Aluminum Can|1|1", "Amethyst Crystal Ball|1|1", "Aquamarine Crystal Ball|1|1", "Blue Book|1|1", "Blue Bottle|1|1", "Blue Sleeping Junimo|1|1", "Book Pile|2|1", "Book Stack|1|1", "Brown Book|1|1", "Buried Tire|1|1", "Calico Statue|1|1", "Cash Register|1|1", "Cauldron|2|1", "Crystal Ball|1|1", "Decorative Barrel|1|1", "Decorative Bowl|1|1", "Decorative Door|2|3", "Decorative Hatch|1|1", "Decorative Joja Door|2|3", "Decorative Junimo Door|2|3", "Decorative Retro Door|2|3", "Decorative Trash Can|1|1", "Decorative Wizard Door|2|3", "Dusty Skull|2|2", "Elegant Vase|1|1", "Elixir Bundle|1|1", "Emerald Crystal Ball|1|1", "Exotic Palace|3|3", "Fallen Blue Book|1|1", "Fallen Brown Book|1|1", "Fallen Green Book|1|1", "Fallen Purple Book|1|1", "Fallen Red Book|1|1", "Fallen Yellow Book|1|1", "Floor Divider L|1|1", "Floor Divider R|1|1", "Food Pet Bowl|1|1", "Futan Rabbit|1|1", "Gray Sleeping Junimo|1|1", "Green Book|1|1", "Green Bottle|1|1", "Green Serpent Statue|1|1", "Green Sleeping Junimo|1|1", "Joja Cola Cans|1|1", "Joja Crate|1|1", "Joja Shopping Cart|2|1", "Junimo Bag|1|1", "Junimo Bundle|1|1", "Junimo Pot|1|1", "Large Book Pile|2|1", "Large Book Stack|1|1", "Large Joja Crate|2|1", "Large Junimo Hut|4|2", "Leah's Sculpture|1|1", "Messy Shirt|1|1", "Messy Shorts|1|1", "Model Ship|1|1", "Obsidian Vase|1|1", "Orange Sleeping Junimo|1|1", "Plastic Bag|1|1", "Purple Book|1|1", "Purple Serpent Statue|1|1", "Purple Sleeping Junimo|1|1", "Red Book|1|1", "Red Sleeping Junimo|1|1", "Ruby Crystal Ball|1|1", "Singing Stone|1|1", "Six-Pack Rings|1|1", "Skeleton|1|1", "Small Book Pile|2|1", "Small Book Stack|1|1", "Small Crystal|1|1", "Small Junimo Hut|3|1", "Small Junimo Plush|1|1", "Small Junimo Pot|1|1", "Spilled Beverage|1|1", "Stacked Joja Boxes|1|1", "Standing Geode|1|1", "Stone Slab|2|1", "Tire|1|1", "Topaz Crystal Ball|1|1", "Totem Pole|1|1", "Two Elixirs|1|1", "Water Pet Bowl|1|1", "Wrapper|1|1", "Yellow Book|1|1", "Yellow Sleeping Junimo|1|1"],
  },
  {
    cat: 'furniture', sub: 'Wall Decor', kind: 'walldecor', w: 1, h: 1, place: 'wall',
    items: ["Anchor|1|2", "Basic Window|1|2", "Carved Window|1|2", "Ceiling Flags|1|1", "Ceiling Leaves|1|1", "Chicken Decal|3|2", "Cloud Decal|2|2", "Clouds Banner|1|3", "Dark Leafy Wall Panel|1|3", "Decorative Axe|1|3", "Decorative Oak Ladder|1|3", "Decorative Pitchfork|1|3", "Decorative Shovel|1|3", "Decorative Walnut Ladder|1|3", "Desert Flags|4|1", "Glyph|1|1", "Hanging Shield|1|1", "Icy Banner|1|3", "Indoor Hanging Basket|1|2", "J. Light|1|2", "Joja Cola Ornament|1|2", "Jungle Decal|1|3", "Junimo Plaque|1|1", "Junimo Star|1|2", "Junimo Wall Plaque|1|2", "L. Light String|2|1", "Leafy Wall Panel|1|3", "Lifesaver|1|2", "Light Leafy Wall Panel|1|3", "Light Switch|1|2", "Log Panel|1|3", "Metal Window|1|2", "Miner's Crest|2|2", "Model Planes|2|3", "Monster Danglers|2|1", "Mounted Trout|3|2", "Night Sky Decal #1|1|2", "Night Sky Decal #2|1|2", "Night Sky Decal #3|1|2", "Outlet|1|3", "Pastel Banner|1|3", "Pierre's Sign|2|2", "Pirate Flag|2|2", "Porthole|1|2", "Retro Banner|1|3", "S. Wall Flower|1|3", "Sam's Skateboard|1|3", "Small Wall Pumpkin|1|2", "Strawberry Decal|2|2", "Triangle Window|1|2", "Wall Basket|2|2", "Wall Clock|1|2", "Wall Flower|1|3", "Wall Palm|1|3", "Wall Pumpkin|1|2", "Wall Sconce|1|2", "Wallflower Pal|2|2", "Winter Banner|1|3", "Winter Tree Decal|1|2", "Witch's Broom|1|3", "Wood Panel|1|3"],
  },
  {
    cat: 'furniture', sub: 'Chairs', kind: 'chair', w: 1, h: 1, place: 'object',
    items: ["Black Cushion|1|1", "Blue Cushion|1|1", "Brown Cushion|1|1", "Dark Junimo Cushion|1|1", "Dark Retro Cushion|1|1", "Dark Wizard Cushion|1|1", "Desert Chair|1|1", "Dining Chair|1|1", "Gray Joja Cushion|1|1", "Green Cushion|1|1", "Joja Chair|1|1", "Joja Cushion|1|1", "Joja Stool|1|1", "Junimo Chair|1|1", "Junimo Cushion|1|1", "Junimo Stool|1|1", "Plastic Lawn Chair|1|1", "Red Cushion|1|1", "Retro Chair|1|1", "Retro Cushion|1|1", "Retro Stool|1|1", "Wizard Chair|1|1", "Wizard Cushion|1|1", "Wizard Stool|1|1", "Yellow Cushion|1|1"],
  },
  {
    cat: 'furniture', sub: 'Beds', kind: 'bed', w: 1, h: 1, place: 'object',
    items: ["Blue Pinstripe Bed|2|3", "Blue Pinstripe Double Bed|3|3", "Pirate Double Bed|3|3"],
  },
  {
    cat: 'furniture', sub: 'Rugs', kind: 'rug', w: 1, h: 1, place: 'ground',
    items: ["Bone Rug|3|2", "Circular Junimo Rug|3|3", "Dark Rug|3|2", "Desert Rug|4|3", "Green Cottage Rug|3|2", "Joja Rug|3|2", "Junimo Mat|3|2", "Junimo Rug|4|3", "Large Joja Rug|5|3", "Large Retro Rug|4|3", "Patchwork Rug|3|2", "Pirate Rug|3|2", "Red Cottage Rug|3|2", "Retro Mat|2|1", "Retro Rug|3|2", "Retro Square Rug|2|2", "Rune Rug|2|2", "Sandy Rug|3|3", "Small Joja Rug|2|1", "Small Junimo Mat|2|1", "Snowy Rug|3|2", "Square Joja Rug|2|2", "Square Junimo Rug|2|2", "Stone Flooring|4|4", "Woodcut Rug|2|2"],
  },
  {
    cat: 'furniture', sub: 'Tables', kind: 'table', w: 1, h: 1, place: 'object',
    items: ["Bountiful Dining Table|5|2", "Desert Table|2|2", "Elixir Table|2|1", "Festive Dining Table|5|2", "Joja Table|2|2", "Junimo Table|2|2", "Long Elixir Table|2|2", "Mahogany Dining Table|5|2", "Modern Dining Table|5|2", "Radio Desk|2|1", "Retro Table|2|2", "Spirits Table|3|1", "Wine Table|3|1", "Winter Dining Table|5|2", "Wizard Table|2|2"],
  },
  {
    cat: 'furniture', sub: 'Bookcases', kind: 'bookcase', w: 1, h: 1, place: 'object',
    items: ["Brochure Cabinet|3|1", "China Cabinet|3|1", "Elixir Shelf|2|1", "Gray Joja Bookcase|2|1", "Joja Bookcase|2|1", "Joja Cola Fridge|2|1", "Joja Vault|2|1", "Junimo Bookcase|2|1", "Large Wizard Bookcase|3|1", "Retro Bookcase|2|1", "Retro Cabinet|2|1", "Short Bookcase|2|1", "Short Wizard Bookcase|2|1", "Small Elixir Shelf|2|1", "Small Stacked Elixir Shelf|2|2", "Small Wizard Bookcase|1|1", "Stacked Elixir Shelf|2|2", "Wizard Bookcase|2|1", "Wizard Bookshelf|2|2", "Wizard Study|3|1"],
  },
  {
    cat: 'furniture', sub: 'Electronics', kind: 'tv', w: 1, h: 1, place: 'object',
    items: ["Broken Television|2|1", "Retro Radio|1|1", "Retro TV|2|1"],
  },
  {
    cat: 'furniture', sub: 'Fish Tanks', kind: 'fishtank', w: 1, h: 1, place: 'object',
    items: ["Community Fish Tank|6|1", "Deluxe Fish Tank|5|1", "Jungle Tank|4|1", "Modern Fish Tank|2|1"],
  },
  {
    cat: 'furniture', sub: 'Plants', kind: 'houseplant', w: 1, h: 1, place: 'object',
    items: ["Corn Plant|1|1", "Curly Tree|2|1", "Dried Sunflowers|1|1", "Fancy House Plant|2|1", "Junimo Flower|1|1", "Junimo Plant|2|1", "Junimo Tree|3|1", "Long Cactus|1|1", "Manicured Pine|1|1", "Plastic Plant|1|1", "Plastic Sapling|1|1", "Potted Red Mushroom|1|1", "Retro Flower|1|1", "Retro Plant|1|1", "S. Pine|1|1", "Swamp Plant|1|1", "Tall House Plant|1|1", "Topiary Tree|1|1"],
  },
  {
    cat: 'furniture', sub: 'Lamps', kind: 'lamp', w: 1, h: 1, place: 'object',
    items: ["Decorative Lantern|1|1", "Joja Lamp|1|1", "Junimo Lamp|1|1", "Plain Torch|1|1", "Retro Lamp|1|1", "Stump Torch|1|1", "Wizard Lamp|1|1"],
  },
  {
    cat: 'furniture', sub: 'End Tables', kind: 'endtable', w: 1, h: 1, place: 'object',
    items: ["Desert End Table|1|1", "Gray Joja End Table|1|1", "Joja End Table|1|1", "Junimo End Table|1|1", "Mahogany Lamp End Table|1|1", "Plastic Lawn End Table|1|1", "Retro End Table|1|1", "Wizard End Table|1|1"],
  },
  {
    cat: 'furniture', sub: 'Fireplaces', kind: 'fireplace', w: 1, h: 1, place: 'object',
    items: ["Desert Fireplace|2|1", "Joja Fireplace|2|1", "Junimo Fireplace|2|1", "Retro Fireplace|2|1", "Wizard Fireplace|2|1"],
  },
  {
    cat: 'furniture', sub: 'Tea & Coffee Tables', kind: 'teatable', w: 1, h: 1, place: 'object',
    items: ["Gray Joja Coffee Table|2|1", "Joja Coffee Table|2|1", "Joja Cola Tea Table|2|2", "Junimo Tea Table|2|2", "Retro Tea Table|2|2", "Wizard Tea Table|2|2"],
  },
  {
    cat: 'furniture', sub: 'Dressers', kind: 'dresser', w: 1, h: 1, place: 'object',
    items: ["Gray Joja Dresser|2|1", "Joja Dresser|2|1", "Junimo Dresser|2|1", "Retro Dresser|2|1", "Wizard Dresser|2|1"],
  },
  {
    cat: 'furniture', sub: 'Couches', kind: 'couch', w: 1, h: 1, place: 'object',
    items: ["Joja Couch|4|1", "Junimo Couch|3|1", "Large Brown Couch|4|1", "Moldy Couch|3|1", "Retro Couch|3|1"],
  },
];

/** Craftables, debris and gates the base dataset does not list. */
export const EXTRA_GROUPS: SupplementalGroup[] = [
  {
    cat: 'farming', sub: 'Sprinklers', kind: 'sprinkler', w: 1, h: 1, place: 'object', source: 'Sprinkler with a Pressure Nozzle attached',
    items: ['Sprinkler (P)', 'Quality Sprinkler (P)', 'Iridium Sprinkler (P)'],
  },
  {
    cat: 'machines', sub: 'Machines', kind: 'machine', w: 1, h: 1, place: 'object',
    items: ['Feed Hopper', 'Incubator', 'Sewing Machine', 'Mushroom Box'],
  },
  {
    cat: 'decor', sub: 'Statues & Oddities', kind: 'statue', w: 1, h: 1, place: 'object',
    items: ['Stone Frog', 'Stone Junimo', 'Stone Parrot', 'Obelisk', 'Empty Capsule', 'Stardew Hero Trophy', 'Skeleton Model',
      'Suit Of Armor', 'Lawn Flamingo', 'Grave Stone', 'Item Pedestal', 'Slime Ball', 'Teddy Timer'],
  },
  {
    cat: 'decor', sub: 'Decor', kind: 'decor', w: 1, h: 1, place: 'object',
    items: ['Ancient Stool', 'Ancient Table', 'Barrel', 'Crate', 'Basic Log', 'Log Section', 'Big Green Cane', 'Big Red Cane',
      'Green Canes', 'Red Canes', 'Mixed Cane', 'Bongo', 'Bookcase', 'Boulder|2|2', 'Camera', 'Cursed P.K. Arcade System',
      'Junimo Kart Arcade System', 'Prairie King Arcade System', 'Dead Tree', 'Decorative Pitcher', 'Decorative Spears',
      'Door', 'Locked Door', 'Fancy Table', 'Grandfather Clock', 'Ritual Mask', 'Table Piece L', 'Table Piece R', 'Wood Chair'],
  },
  {
    cat: 'lighting', sub: 'Lighting', kind: 'brazier', w: 1, h: 1, place: 'object',
    items: ['Bonfire', 'Tall Torch'],
  },
  {
    cat: 'fences', sub: 'Gates', kind: 'gate', w: 1, h: 1, place: 'object',
    items: ['Wood Gate', 'Stone Gate', 'Iron Gate', 'Hardwood Gate'],
  },
  {
    cat: 'nature', sub: 'Large Debris', kind: 'debris', w: 2, h: 2, place: 'object',
    items: ['Large Rock', 'Large Stump', 'Large Log', 'Meteorite'],
  },
  {
    cat: 'nature', sub: 'Small Debris', kind: 'debris', w: 1, h: 1, place: 'object',
    items: ['Stone Debris', 'Twig', 'Weeds', 'Truffle'],
  },
];

/** Crops that are not in the base dataset's crop list. */
export const EXTRA_CROPS: { name: string; kind: string; sub: string; w: number; seasons: string[]; d: string }[] = [
  { name: 'Giant Cauliflower', kind: 'giantcrop', sub: 'Giant Crops', w: 3, seasons: ['spring'], d: 'A 3×3 giant crop. Grows when nine Cauliflower plants mature together.' },
  { name: 'Giant Melon', kind: 'giantcrop', sub: 'Giant Crops', w: 3, seasons: ['summer'], d: 'A 3×3 giant crop. Grows when nine Melon plants mature together.' },
  { name: 'Giant Pumpkin', kind: 'giantcrop', sub: 'Giant Crops', w: 3, seasons: ['fall'], d: 'A 3×3 giant crop. Grows when nine Pumpkin plants mature together.' },
  { name: 'Giant Powdermelon', kind: 'giantcrop', sub: 'Giant Crops', w: 3, seasons: ['winter'], d: 'A 3×3 giant crop. Grows when nine Powdermelon plants mature together.' },
  { name: 'Giant Qi Fruit', kind: 'giantcrop', sub: 'Giant Crops', w: 3, seasons: ['spring', 'summer', 'fall', 'winter'], d: 'A 3×3 giant crop. Grows when nine Qi Fruit plants mature together.' },
  { name: 'Spring Seeds', kind: 'crop', sub: 'Wild Seeds', w: 1, seasons: ['spring'], d: 'Wild seeds. Grow into a random spring forage item in 7 days.' },
  { name: 'Summer Seeds', kind: 'crop', sub: 'Wild Seeds', w: 1, seasons: ['summer'], d: 'Wild seeds. Grow into a random summer forage item in 7 days.' },
  { name: 'Fall Seeds', kind: 'crop', sub: 'Wild Seeds', w: 1, seasons: ['fall'], d: 'Wild seeds. Grow into a random fall forage item in 7 days.' },
  { name: 'Winter Seeds', kind: 'crop', sub: 'Wild Seeds', w: 1, seasons: ['winter'], d: 'Wild seeds. Grow into a random winter forage item in 7 days.' },
  { name: 'Sweet Pea', kind: 'crop', sub: 'Flowers', w: 1, seasons: ['summer'], d: 'A summer wild flower. Bees can use it for honey.' },
  { name: 'Crocus', kind: 'crop', sub: 'Flowers', w: 1, seasons: ['winter'], d: 'A winter wild flower.' },
];

export const EXTRA_TREES = ['Green Rain Tree 1', 'Green Rain Tree 2', 'Green Rain Tree 3'];

/** Building variants: name, footprint source building, colors. */
export const EXTRA_BUILDINGS: Record<string, { w: number; h: number; tall: number; roof: string; wall: string; sub: string; d: string }> = {
  'Farmhouse (Upgrade 1)': { w: 9, h: 3, tall: 4, roof: '#8a3426', wall: '#d2aa72', sub: 'Farm', d: 'Farmhouse after the first upgrade (adds a kitchen).' },
  'Farmhouse (Upgrade 2)': { w: 9, h: 3, tall: 5, roof: '#7a2e22', wall: '#dab47c', sub: 'Farm', d: 'Farmhouse after the second upgrade (adds a second floor).' },
  'Greenhouse (Ruined)': { w: 7, h: 6, tall: 3, roof: '#8a9a94', wall: '#6a5a45', sub: 'Farm', d: 'The greenhouse before it is repaired.' },
  'Stone Cabin': { w: 5, h: 3, tall: 3, roof: '#5a6a7a', wall: '#9a9aa0', sub: 'Cabins', d: 'Multiplayer cabin, stone style.' },
  'Stone Cabin 2': { w: 5, h: 3, tall: 3, roof: '#4a5a6a', wall: '#a4a4aa', sub: 'Cabins', d: 'Stone cabin after the first upgrade.' },
  'Stone Cabin 3': { w: 5, h: 3, tall: 4, roof: '#3e4e5e', wall: '#aeaeb4', sub: 'Cabins', d: 'Stone cabin after the second upgrade.' },
  'Plank Cabin': { w: 5, h: 3, tall: 3, roof: '#3e6b3a', wall: '#c9a06a', sub: 'Cabins', d: 'Multiplayer cabin, plank style.' },
  'Plank Cabin 2': { w: 5, h: 3, tall: 3, roof: '#356032', wall: '#d2aa72', sub: 'Cabins', d: 'Plank cabin after the first upgrade.' },
  'Plank Cabin 3': { w: 5, h: 3, tall: 4, roof: '#2c552a', wall: '#dab47c', sub: 'Cabins', d: 'Plank cabin after the second upgrade.' },
  'Log Cabin': { w: 5, h: 3, tall: 3, roof: '#7a3f2a', wall: '#8a5a32', sub: 'Cabins', d: 'Multiplayer cabin, log style.' },
  'Log Cabin 2': { w: 5, h: 3, tall: 3, roof: '#6e3826', wall: '#94643a', sub: 'Cabins', d: 'Log cabin after the first upgrade.' },
  'Log Cabin 3': { w: 5, h: 3, tall: 4, roof: '#623222', wall: '#9e6e42', sub: 'Cabins', d: 'Log cabin after the second upgrade.' },
  'Hay Pet Bowl': { w: 2, h: 2, tall: 0, roof: '#e0c070', wall: '#c8a050', sub: 'Farm', d: 'Pet bowl, hay style.' },
  'Stone Pet Bowl': { w: 2, h: 2, tall: 0, roof: '#9aa0a6', wall: '#7a8086', sub: 'Farm', d: 'Pet bowl, stone style.' },
};
