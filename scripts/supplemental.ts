/**
 * Hand-curated catalog data that the `stardew-valley-data` package does not cover
 * (furniture, decor, extra big craftables, building footprints, ground tiles).
 * Names and footprints are game facts; all artwork is generated separately.
 *
 * Format for list entries: "Name|w|h" (w/h default to the group's size).
 */

export type SupplementalGroup = {
  cat: string;
  sub: string;
  kind: string;
  w: number;
  h: number;
  place: 'object' | 'ground' | 'building' | 'wall' | 'water' | null;
  source?: string;
  items: string[];
};

export const FURNITURE: SupplementalGroup[] = [
  {
    cat: 'furniture', sub: 'Chairs', kind: 'chair', w: 1, h: 1, place: 'object',
    items: [
      'Oak Chair', 'Walnut Chair', 'Birch Chair', 'Mahogany Chair', 'Red Diner Chair', 'Blue Diner Chair',
      'Country Chair', 'Breakfast Chair', 'Pink Office Chair', 'Purple Office Chair', 'Green Office Stool',
      'Orange Office Stool', 'Dark Throne', 'Dining Chair (Yellow)', 'Dining Chair (Red)', 'Green Plush Seat',
      'Pink Plush Seat', 'Winter Chair', 'Groovy Chair', 'Cute Chair', 'Stump Seat', 'Metal Chair',
      'Green Stool', 'Blue Stool', 'King Chair', 'Crystal Chair', 'Tropical Chair',
    ],
  },
  {
    cat: 'furniture', sub: 'Benches', kind: 'bench', w: 2, h: 1, place: 'object',
    items: ['Oak Bench', 'Walnut Bench', 'Birch Bench', 'Mahogany Bench', 'Modern Bench'],
  },
  {
    cat: 'furniture', sub: 'Couches', kind: 'couch', w: 3, h: 2, place: 'object',
    items: ['Brown Couch', 'Blue Couch', 'Green Couch', 'Red Couch', 'Yellow Couch', 'Dark Couch', 'Wizard Couch', 'Woodsy Couch'],
  },
  {
    cat: 'furniture', sub: 'Armchairs', kind: 'armchair', w: 2, h: 2, place: 'object',
    items: ['Blue Armchair', 'Red Armchair', 'Green Armchair', 'Yellow Armchair', 'Brown Armchair'],
  },
  {
    cat: 'furniture', sub: 'Dressers', kind: 'dresser', w: 2, h: 1, place: 'object',
    items: ['Birch Dresser', 'Oak Dresser', 'Walnut Dresser', 'Mahogany Dresser'],
  },
  {
    cat: 'furniture', sub: 'Tables', kind: 'table', w: 2, h: 2, place: 'object',
    items: [
      'Oak Table', 'Walnut Table', 'Birch Table', 'Mahogany Table', 'Sun Table', 'Moon Table', 'Modern Table',
      'Pub Table', 'Luxury Table', 'Diviner Table', 'Neolithic Table', 'Puzzle Table', 'Winter Table',
      'Candy Table', 'Luau Table', 'Dark Table',
    ],
  },
  {
    cat: 'furniture', sub: 'Tea & Coffee Tables', kind: 'teatable', w: 2, h: 1, place: 'object',
    items: ['Oak Tea-Table', 'Walnut Tea-Table', 'Birch Tea-Table', 'Mahogany Tea-Table', 'Modern Tea-Table', 'Coffee Table'],
  },
  {
    cat: 'furniture', sub: 'End Tables', kind: 'endtable', w: 1, h: 1, place: 'object',
    items: [
      'Oak End Table', 'Walnut End Table', 'Birch End Table', 'Mahogany End Table', 'Modern End Table',
      'Grandmother End Table', 'Winter End Table', 'Birch Lamp End Table', 'Oak Lamp End Table',
      'Walnut Lamp End Table',
    ],
  },
  {
    cat: 'furniture', sub: 'Bookcases', kind: 'bookcase', w: 2, h: 1, place: 'object',
    items: ['Artist Bookcase', 'Luxury Bookcase', 'Modern Bookcase', 'Dark Bookcase'],
  },
  {
    cat: 'furniture', sub: 'Lamps', kind: 'lamp', w: 1, h: 1, place: 'object',
    items: ['Country Lamp', 'Box Lamp', 'Modern Lamp', 'Classic Lamp', 'Candle Lamp', 'Ornate Lamp', 'J. Cola Light', 'Jungle Torch'],
  },
  {
    cat: 'furniture', sub: 'Beds', kind: 'bed', w: 2, h: 3, place: 'object',
    items: [
      'Bed|2|3', 'Child Bed|2|3', 'Tropical Bed|2|3', 'Midnight Beach Bed|2|3',
      'Double Bed|3|3', 'Fisher Double Bed|3|3', 'Modern Double Bed|3|3', 'Birch Double Bed|3|3',
      'Exotic Double Bed|3|3', 'Wild Double Bed|3|3', 'Tropical Double Bed|3|3', 'Midnight Beach Double Bed|3|3',
      'Deluxe Red Double Bed|3|3', 'Starry Double Bed|3|3', 'Strawberry Double Bed|3|3',
    ],
  },
  {
    cat: 'furniture', sub: 'Fireplaces', kind: 'fireplace', w: 2, h: 1, place: 'object',
    items: ['Stone Fireplace', 'Brick Fireplace', 'Elegant Fireplace', 'Iridium Fireplace', 'Stove Fireplace', 'Monster Fireplace'],
  },
  {
    cat: 'furniture', sub: 'Fish Tanks', kind: 'fishtank', w: 2, h: 1, place: 'object',
    items: ['Small Fish Tank|2|1', 'Large Fish Tank|4|2', 'Aquatic Sanctuary|7|2'],
  },
  {
    cat: 'furniture', sub: 'Televisions', kind: 'tv', w: 2, h: 1, place: 'object',
    items: ['Floor TV', 'Budget TV', 'Plasma TV', 'Tropical TV'],
  },
  {
    cat: 'furniture', sub: 'House Plants', kind: 'houseplant', w: 1, h: 1, place: 'object',
    items: [
      'House Plant', 'Small Plant', 'Table Plant', 'Indoor Palm', 'Long Palm', 'Deluxe Tree', 'Exotic Tree',
      'Bonsai Tree', 'Exotic Palm', 'Tree Column', 'Tree of the Winter Star|2|2',
    ],
  },
  {
    cat: 'furniture', sub: 'Rugs', kind: 'rug', w: 3, h: 2, place: 'ground',
    items: [
      'Red Rug|3|2', 'Burlap Rug|2|2', 'Nautical Rug|3|2', 'Starry Moon Rug|5|3', 'Light Green Rug|3|2',
      'Large Red Rug|4|3', 'Large Green Rug|4|3', 'Large Cottage Rug|4|3', 'Icy Rug|4|3', 'Fruit Salad Rug|3|2',
      'Mystic Rug|3|2', 'Old World Rug|4|3', 'Blossom Rug|6|4', 'Monster Rug|2|2', 'Oceanic Rug|3|2',
      'Modern Rug|5|4', 'Funky Rug|5|4', 'Swirl Rug|3|2', 'Circular Rug|2|2', 'Bamboo Mat|2|1',
    ],
  },
  {
    cat: 'furniture', sub: 'Paintings', kind: 'painting', w: 2, h: 2, place: 'wall',
    items: [
      'Primal Motion', 'Burnt Offering', 'Highway 89', 'Spires', 'Queen of the Gem Sea', 'Vanilla Villa',
      'Land Of Clay', 'Sun #44', 'Wumbus', 'Groovy', "Kitemaster '95", 'Little Tree', 'Physics 101',
      'Pathways', 'The Brave Little Sapling', 'Calico Falls', 'Jade Hills', 'Blueberries', 'Dancing Grass',
      'Boarded Window', 'Monster Danger', "'Volcano' Photo", 'Tropical Fish #173', 'Pickle Jar Beauty',
      'Vista', 'Portrait Of A Mermaid', 'Red Eagle', 'Clouds', '1000 Years From Now', 'Three Trees',
      'The Serpent', 'Solar Kingdom',
    ],
  },
  {
    cat: 'furniture', sub: 'Wall Decor', kind: 'walldecor', w: 1, h: 1, place: 'wall',
    items: [
      'Window|1|2', 'Small Window', 'Ornate Window|1|2', 'Moonlight Jellies Banner|2|2', 'Starport Decal|2|2',
      'Pyramid Decal|2|2', 'Cow Decal|2|2', 'Wall Cactus', 'Palm Wall Ornament', 'Wall Sword|2|1',
      'Decorative Sword|1|2', 'Junimo Plush',
    ],
  },
  {
    cat: 'furniture', sub: 'Decorative', kind: 'decor', w: 1, h: 1, place: 'object',
    items: [
      'Globe', 'Small Globe', 'Ceramic Pillar', 'Gold Pillar', 'Industrial Pipe', 'Bear Statue|2|2',
      'Chicken Statue', 'Futan Bear|2|2', 'Lg. Futan Bear|2|2', "Sam's Boombox", 'Gourmand Statue|2|2',
      'Iridium Krobus|2|2', 'Squirrel Figurine', 'Wumbus Statue|2|2', 'Bobo Statue|2|2',
      'Sloth Skeleton L|2|2', 'Sloth Skeleton M|2|2', 'Sloth Skeleton R|2|2', 'Sign Of The Vessel',
      'Coat Stand', 'Clothesline|3|1', 'Mannequin (Male)', 'Mannequin (Female)', 'Butterfly Hutch|2|2',
      'Ornamental Hay Bale', 'Bird House', 'Doghouse|2|2', 'Dark Doghouse|2|2', 'Cat Tree|2|2',
      'Dark Cat Tree|2|2', 'Stone Cairn', 'Mini-Fridge',
    ],
  },
  {
    cat: 'furniture', sub: 'Instruments', kind: 'piano', w: 3, h: 2, place: 'object',
    items: ['Dark Piano', 'Upright Piano'],
  },
  {
    cat: 'furniture', sub: 'Catalogues', kind: 'catalogue', w: 1, h: 1, place: 'object',
    items: [
      'Catalogue', 'Furniture Catalogue|2|1', 'Joja Furniture Catalogue', 'Wizard Catalogue', 'Junimo Catalogue',
      'Retro Catalogue', 'Trash Catalogue', 'Animal Catalogue',
    ],
  },
];

/** Big craftables / placeables not present in the dataset's crafting list. */
export const EXTRA_PLACEABLES: SupplementalGroup[] = [
  {
    cat: 'storage', sub: 'Storage', kind: 'chest', w: 1, h: 1, place: 'object',
    items: ['Junimo Chest', 'Mini-Shipping Bin', 'Auto-Grabber'],
  },
  {
    cat: 'machines', sub: 'Machines', kind: 'machine', w: 1, h: 1, place: 'object',
    items: ['Wood Chipper', 'Deconstructor', 'Coffee Maker', 'Statue of Perfection', 'Statue of True Perfection',
      'Statue of Endless Fortune', 'Auto-Petter', 'Heater', 'Workbench|1|1', 'Telephone', 'Soda Machine'],
  },
  {
    cat: 'decor', sub: 'Statues & Oddities', kind: 'statue', w: 1, h: 1, place: 'object',
    items: ['Stone Owl', 'Strange Capsule', 'Solid Gold Lewis', 'Seasonal Plant', 'Seasonal Decor', 'Plush Bunny'],
  },
  {
    cat: 'decor', sub: 'Scarecrows', kind: 'rarecrow', w: 1, h: 1, place: 'object',
    items: ['Rarecrow 1', 'Rarecrow 2', 'Rarecrow 3', 'Rarecrow 4', 'Rarecrow 5', 'Rarecrow 6', 'Rarecrow 7', 'Rarecrow 8'],
  },
];

/** Ground "paint" layers that are not items in the game but are needed for planning. */
export const GROUND_TILES = [
  { name: 'Tilled Soil', kind: 'tilled', desc: 'Hoed dirt. Crops are planted on tilled soil.' },
  { name: 'Watered Soil', kind: 'watered', desc: 'Watered tilled soil, useful for marking sprinkler coverage.' },
  { name: 'Grass', kind: 'grassplant', desc: 'Grass planted from Grass Starter. Animals eat it.' },
  { name: 'Blue Grass', kind: 'bluegrass', desc: 'Grass planted from Blue Grass Starter.' },
];

/** Building footprints in tiles (w x h) and extra visual height above the footprint. */
import { EXTRA_BUILDINGS } from './supplemental-extra';

export const BUILDING_SIZES: Record<string, { w: number; h: number; tall: number; roof: string; wall: string }> = {
  ...EXTRA_BUILDINGS,
  'Coop': { w: 6, h: 3, tall: 3, roof: '#b4472b', wall: '#c98d4c' },
  'Big Coop': { w: 6, h: 3, tall: 3, roof: '#8b3a2a', wall: '#d9a35f' },
  'Deluxe Coop': { w: 6, h: 3, tall: 3, roof: '#5d3a7a', wall: '#e1b673' },
  'Barn': { w: 7, h: 4, tall: 3, roof: '#a83226', wall: '#c4472f' },
  'Big Barn': { w: 7, h: 4, tall: 3, roof: '#7d2a22', wall: '#b93a2b' },
  'Deluxe Barn': { w: 7, h: 4, tall: 3, roof: '#4b3a7a', wall: '#a8442e' },
  'Well': { w: 3, h: 3, tall: 1, roof: '#8a5a32', wall: '#9aa0a6' },
  'Silo': { w: 3, h: 3, tall: 4, roof: '#8f9aa3', wall: '#c8763d' },
  'Mill': { w: 4, h: 2, tall: 4, roof: '#7a4a2a', wall: '#d2b07a' },
  'Shed': { w: 7, h: 3, tall: 3, roof: '#6b4a32', wall: '#b88a55' },
  'Big Shed': { w: 7, h: 3, tall: 3, roof: '#4e5f73', wall: '#c09460' },
  'Fish Pond': { w: 5, h: 5, tall: 0, roof: '#3d8ad6', wall: '#8e8e8e' },
  'Stable': { w: 4, h: 2, tall: 3, roof: '#3e6b3a', wall: '#a8783f' },
  'Slime Hutch': { w: 7, h: 4, tall: 3, roof: '#5a7a8a', wall: '#7c8c96' },
  'Cabin': { w: 5, h: 3, tall: 3, roof: '#7a3f2a', wall: '#a4784a' },
  'Pet Bowl': { w: 2, h: 2, tall: 0, roof: '#8aa0b8', wall: '#b0c4d8' },
  'Shipping Bin': { w: 2, h: 1, tall: 1, roof: '#6b4422', wall: '#9b6a3a' },
  'Junimo Hut': { w: 3, h: 2, tall: 2, roof: '#4b7a2e', wall: '#8b6a3a' },
  'Earth Obelisk': { w: 3, h: 2, tall: 4, roof: '#4f8a3a', wall: '#6e6a62' },
  'Water Obelisk': { w: 3, h: 2, tall: 4, roof: '#3a7ad6', wall: '#6e6a62' },
  'Desert Obelisk': { w: 3, h: 2, tall: 4, roof: '#d6a23a', wall: '#6e6a62' },
  'Island Obelisk': { w: 3, h: 2, tall: 4, roof: '#d65a8a', wall: '#6e6a62' },
  'Gold Clock': { w: 3, h: 2, tall: 3, roof: '#e8b830', wall: '#c99a20' },
  'Greenhouse': { w: 7, h: 6, tall: 3, roof: '#7fc8d8', wall: '#8a6a45' },
  'Farmhouse': { w: 9, h: 3, tall: 4, roof: '#9a3a2a', wall: '#c9a06a' },
};

/** Ranges for coverage overlays. */
export const RANGES: Record<string, string> = {
  'Sprinkler': 'spr1',
  'Quality Sprinkler': 'spr2',
  'Iridium Sprinkler': 'spr3',
  'Sprinkler (P)': 'spr2',
  'Quality Sprinkler (P)': 'spr3',
  'Iridium Sprinkler (P)': 'spr4',
  'Scarecrow': 'scare8',
  'Deluxe Scarecrow': 'scare16',
  'Rarecrow 1': 'scare8', 'Rarecrow 2': 'scare8', 'Rarecrow 3': 'scare8', 'Rarecrow 4': 'scare8',
  'Rarecrow 5': 'scare8', 'Rarecrow 6': 'scare8', 'Rarecrow 7': 'scare8', 'Rarecrow 8': 'scare8',
  'Junimo Hut': 'junimo',
  'Bee House': 'bee',
  'Mushroom Log': 'log',
};

/** Farmhouse is not a buildable building but appears on every farm. */
export const FARMHOUSE = {
  name: 'Farmhouse',
  desc: 'Your home. Upgrades are purchased from Robin.',
};
