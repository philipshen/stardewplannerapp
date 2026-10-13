/** Picks colors for an item from its name so variants look distinct. */
import { hashStr, hex, RGBA } from './png';

const WORD_COLORS: [RegExp, string][] = [
  [/\biridium\b/i, '#9a5ad6'],
  [/\bgold(en)?\b/i, '#e8b830'],
  [/\bcopper\b/i, '#d07a3a'],
  [/\bsteel\b|\biron\b|\bmetal\b/i, '#9aa4ae'],
  [/\bprismatic\b|\brainbow\b/i, '#e05aa8'],
  [/\bcrystal\b|\bice\b|\bicy\b|\bfrozen\b/i, '#8edcf0'],
  [/\bwinter\b|\bsnow\b/i, '#c8e0f0'],
  [/\bvoid\b|\bshadow\b|\bdark\b|\bmidnight\b|\bnight\b/i, '#4a3a5e'],
  [/\bwizard\b|\bmystic\b|\bmagic\b|\barcane\b/i, '#6a4ab8'],
  [/\bjoja\b/i, '#3a7ad6'],
  [/\bqi\b/i, '#7a4ad6'],
  [/\bjunimo\b/i, '#6ab84a'],
  [/\btropical\b|\bisland\b|\bluau\b|\bjungle\b|\bpalm\b/i, '#3ab89a'],
  [/\bred\b|\bruby\b|\bcherry\b|\bstrawberry\b|\bcrimson\b/i, '#c8383a'],
  [/\bblue\b|\bsapphire\b|\bocean(ic)?\b|\bnautical\b|\bsea\b/i, '#3a72c8'],
  [/\bgreen\b|\bemerald\b|\bjade\b|\bwoodsy\b|\bforest\b/i, '#4a9a3a'],
  [/\byellow\b|\bsun\b|\bbanana\b|\blemon\b/i, '#e8c83a'],
  [/\bpurple\b|\bamethyst\b|\bgrape\b|\bviolet\b/i, '#8a4ab8'],
  [/\bpink\b|\bblossom\b|\brose\b|\bcute\b/i, '#e88aa8'],
  [/\borange\b|\bpumpkin\b|\bapricot\b|\bpeach\b|\bfire\b|\blava\b/i, '#e0782a'],
  [/\bwhite\b|\bmarble\b|\bpearl\b|\bdiamond\b|\bquartz\b/i, '#e8e8f0'],
  [/\bblack\b|\bobsidian\b|\bcoal\b/i, '#3a3440'],
  [/\bbrown\b|\bcountry\b|\brustic\b|\bstump\b|\bburlap\b|\bstraw\b|\bhay\b/i, '#9a6a3a'],
  [/\bmahogany\b/i, '#8a3a2a'],
  [/\bwalnut\b/i, '#6a4426'],
  [/\boak\b/i, '#b07a42'],
  [/\bbirch\b/i, '#e0c89a'],
  [/\bmaple\b/i, '#c0602a'],
  [/\bpine\b/i, '#3a6a3a'],
  [/\bhardwood\b/i, '#7a4a2a'],
  [/\bwood(en)?\b|\bplank\b/i, '#a8743e'],
  [/\bstone\b|\bcobble|\bgravel\b|\bcairn\b/i, '#8a8a90'],
  [/\bbrick\b/i, '#b05a3a'],
  [/\bmodern\b/i, '#7a8a9a'],
  [/\bcandy\b/i, '#f0a0c8'],
  [/\bluxury\b|\belegant\b|\bornate\b|\bking\b|\broyal\b/i, '#b8902a'],
  [/\bgroovy\b|\bfunky\b|\bretro\b/i, '#e86a3a'],
  [/\bmonster\b|\bslime\b/i, '#6ac84a'],
  [/\bbone\b|\bskull\b|\bskeleton\b/i, '#e8dcc0'],
];

/** Specific known item colors (produce, fish, gems). */
const NAME_COLORS: Record<string, string> = {
  'Giant Cauliflower': '#f0f0e0', 'Giant Melon': '#e86a7a', 'Giant Pumpkin': '#e8842a', 'Giant Powdermelon': '#e8d0f0', 'Giant Qi Fruit': '#5ad0e0',
  'Sweet Pea': '#c86ae0', 'Crocus': '#8a6ae8', 'Spring Seeds': '#8ad05a', 'Summer Seeds': '#e8c03a', 'Fall Seeds': '#d0782a', 'Winter Seeds': '#8ac8e8',
  'Parsnip': '#efe0a0', 'Cauliflower': '#f0f0e0', 'Potato': '#c89a5a', 'Garlic': '#f0ecd8', 'Kale': '#3a8a4a',
  'Rhubarb': '#d04a6a', 'Tulip': '#e04a5a', 'Blue Jazz': '#5a8ae8', 'Carrot': '#f0882a', 'Coffee Bean': '#7a3a2a',
  'Coffee Plant': '#7a3a2a', 'Melon': '#e86a7a', 'Tomato': '#e03a2a', 'Blueberry': '#3a5ad0', 'Hot Pepper': '#e8302a',
  'Radish': '#e04a6a', 'Red Cabbage': '#8a3a8a', 'Starfruit': '#f0d02a', 'Hops': '#9ad04a', 'Poppy': '#e8302a',
  'Summer Spangle': '#e8a82a', 'Summer Squash': '#e8c84a', 'Taro Root': '#a88a7a', 'Corn': '#f0d03a', 'Wheat': '#e0c070',
  'Sunflower': '#f0c02a', 'Eggplant': '#6a3a8a', 'Artichoke': '#6aa04a', 'Amaranth': '#b03a6a', 'Cranberries': '#c0202a',
  'Bok Choy': '#7ac04a', 'Yam': '#c8603a', 'Beet': '#a02a4a', 'Sweet Gem Berry': '#e8483a', 'Fairy Rose': '#e8a0e0',
  'Broccoli': '#3a8a3a', 'Powdermelon': '#e8d0f0', 'Ancient Fruit': '#4a9ab8', 'Cactus Fruit': '#e85a7a',
  'Pineapple': '#f0c83a', 'Qi Fruit': '#5ad0e0', 'Green Bean': '#4ab83a', 'Unmilled Rice': '#d8d0a0', 'Grape': '#7a3aa8',
  'Fiber Plant': '#7aa83a', 'Strawberry': '#e0302a', 'Tea Bush': '#3a8a3a',
  'Emerald': '#2ab86a', 'Aquamarine': '#3ac8c8', 'Ruby': '#e02a3a', 'Amethyst': '#a04ad8', 'Topaz': '#e8a82a',
  'Jade': '#5ab87a', 'Diamond': '#d0f0ff', 'Prismatic Shard': '#e05aa8', 'Frozen Tear': '#a0d8f0', 'Fire Quartz': '#e8582a',
  'Earth Crystal': '#c8a85a', 'Quartz': '#e0e0e8',
  'Pufferfish': '#e8c84a', 'Anchovy': '#7a9ab8', 'Tuna': '#3a5a8a', 'Sardine': '#8aa8c8', 'Bream': '#8a8a6a',
  'Largemouth Bass': '#5a8a3a', 'Smallmouth Bass': '#7a9a4a', 'Rainbow Trout': '#d88aa8', 'Salmon': '#d8705a',
  'Walleye': '#a8a05a', 'Perch': '#c8a83a', 'Carp': '#a89a5a', 'Catfish': '#6a6a5a', 'Pike': '#6a8a4a',
  'Sunfish': '#e8a83a', 'Red Mullet': '#d84a3a', 'Herring': '#9ab0c8', 'Eel': '#5a5a7a', 'Octopus': '#c85a7a',
  'Red Snapper': '#d8483a', 'Squid': '#e0c8d8', 'Sea Cucumber': '#7a5a3a', 'Super Cucumber': '#8a3ab8',
  'Ghostfish': '#d8e0e8', 'Stonefish': '#8a8a8a', 'Ice Pip': '#8ad8f0', 'Lava Eel': '#e8482a', 'Sandfish': '#d8b88a',
  'Scorpion Carp': '#c8a83a', 'Flounder': '#a8906a', 'Midnight Carp': '#3a3a7a', 'Sturgeon': '#7a7a6a',
  'Tiger Trout': '#d8a83a', 'Bullhead': '#6a5a3a', 'Tilapia': '#9a9aa8', 'Chub': '#8a9aa8', 'Dorado': '#e8c02a',
  'Albacore': '#5a7aa8', 'Shad': '#a8b8c8', 'Lingcod': '#5a8a6a', 'Halibut': '#a89a7a', 'Woodskip': '#8a6a3a',
  'Void Salmon': '#6a3a8a', 'Slimejack': '#5ad83a', 'Stingray': '#7a6a8a', 'Lionfish': '#e86a3a', 'Blue Discus': '#3a8ae8',
  'Crimsonfish': '#e0202a', 'Angler': '#c8a02a', 'Legend': '#5a7ad8', 'Glacierfish': '#a8e8f8', 'Mutant Carp': '#5ac83a',
  'Lobster': '#d8402a', 'Crab': '#d8602a', 'Shrimp': '#e8885a', 'Crayfish': '#c8502a', 'Snail': '#a88a5a',
  'Periwinkle': '#8a8ac8', 'Cockle': '#e0c8a0', 'Mussel': '#3a3a5a', 'Clam': '#d8c0a0', 'Oyster': '#b8b0a8',
  'Hay': '#e0c070', 'Wood': '#a8743e', 'Stone': '#8a8a90', 'Clay': '#c8885a', 'Coal': '#3a3440', 'Sap': '#d8a83a',
  'Copper Bar': '#d07a3a', 'Iron Bar': '#a8b0b8', 'Gold Bar': '#e8b830', 'Iridium Bar': '#9a5ad6', 'Radioactive Bar': '#7ae83a',
  'Copper Ore': '#d07a3a', 'Iron Ore': '#a8b0b8', 'Gold Ore': '#e8b830', 'Iridium Ore': '#9a5ad6', 'Radioactive Ore': '#7ae83a',
  'Honey': '#e8b02a', 'Wine': '#8a1a3a', 'Juice': '#e8882a', 'Jelly': '#d84a6a', 'Pickles': '#6aa83a', 'Cheese': '#f0d040',
  'Goat Cheese': '#f0e8c8', 'Beer': '#e8b04a', 'Mead': '#e8c06a', 'Pale Ale': '#e8c87a', 'Coffee': '#5a3a2a',
  'Green Tea': '#7ab84a', 'Truffle Oil': '#c8a83a', 'Oil': '#e8d04a', 'Mayonnaise': '#f0f0c8', 'Cloth': '#e8e0d0',
  'Duck Mayonnaise': '#d8e0a0', 'Void Mayonnaise': '#3a3a5a', 'Caviar': '#2a2a3a', 'Aged Roe': '#c8682a', 'Roe': '#e8882a',
  'Smoked Fish': '#a8603a', 'Dried Fruit': '#c8603a', 'Dried Mushrooms': '#a87a5a', 'Raisins': '#5a2a4a',
  'Keg': '#9a6a3a', 'Preserves Jar': '#c89a5a', 'Cask': '#7a4a2a', 'Cheese Press': '#c8a87a', 'Loom': '#b08a5a',
  'Mayonnaise Machine': '#e8e0d0', 'Oil Maker': '#c8a83a', 'Bee House': '#d8a83a', 'Furnace': '#8a7a7a',
  'Heavy Furnace': '#5a5a6a', 'Crystalarium': '#a8a8b8', 'Recycling Machine': '#5a8a5a', 'Seed Maker': '#a8783a',
  'Charcoal Kiln': '#6a5a4a', 'Lightning Rod': '#c8c8d0', 'Worm Bin': '#8a5a3a', 'Deluxe Worm Bin': '#6a3a5a',
  'Tapper': '#a8743e', 'Heavy Tapper': '#5a6a7a', 'Slime Egg-Press': '#5ac84a', 'Slime Incubator': '#6ac8a8',
  'Ostrich Incubator': '#e8d8b0', 'Geode Crusher': '#8a7a6a', 'Bone Mill': '#e0d8c0', 'Fish Smoker': '#6a4a3a',
  'Dehydrator': '#c8783a', 'Bait Maker': '#7a9a5a', 'Mushroom Log': '#7a5a3a', 'Solar Panel': '#3a5aa8',
  'Mini-Obelisk': '#7a6aa8', 'Farm Computer': '#5a6a7a', 'Mini-Jukebox': '#c84a3a', 'Anvil': '#5a5a6a', 'Mini-Forge': '#d8582a',
  'Statue of Blessings': '#d8c8a0', 'Statue of the Dwarf King': '#8a7a6a', 'Wood Chipper': '#c8a83a', 'Deconstructor': '#a8583a',
  'Coffee Maker': '#3a3a3a', 'Statue of Perfection': '#e8c84a', 'Statue of True Perfection': '#9a5ad6',
  'Statue of Endless Fortune': '#e8b830', 'Auto-Petter': '#5a8ad8', 'Heater': '#c84a2a', 'Workbench': '#a8743e',
  'Telephone': '#7a3a3a', 'Soda Machine': '#c83a3a', 'Hopper': '#8a8a8a', 'Chest': '#a8743e', 'Big Chest': '#a8743e',
  'Stone Chest': '#8a8a90', 'Big Stone Chest': '#8a8a90', 'Junimo Chest': '#6ab84a', 'Mini-Shipping Bin': '#9b6a3a',
  'Auto-Grabber': '#8a8a9a', 'Stone Owl': '#8a8a90', 'Strange Capsule': '#a8c8d8', 'Solid Gold Lewis': '#e8b830',
  'Wicked Statue': '#5a4a6a', 'Seasonal Plant': '#5aa84a', 'Seasonal Decor': '#c8603a', 'Plush Bunny': '#e8d8e0',
  'Garden Pot': '#c8683a', "Tub o' Flowers": '#a8743e', 'Drum Block': '#c84a3a', 'Flute Block': '#c8a83a',
  'Wood Sign': '#a8743e', 'Stone Sign': '#8a8a90', 'Dark Sign': '#4a3a4a', 'Text Sign': '#c8a87a',
  'Globe': '#3a8ad8', 'Small Globe': '#3a8ad8', 'Ceramic Pillar': '#e8e0d0', 'Gold Pillar': '#e8b830',
  'Industrial Pipe': '#7a7a8a', 'Bear Statue': '#7a5a3a', 'Chicken Statue': '#e8e0d0', 'Futan Bear': '#c8a87a',
  'Lg. Futan Bear': '#c8a87a', "Sam's Boombox": '#5a5a6a', 'Gourmand Statue': '#6ab84a', 'Iridium Krobus': '#9a5ad6',
  'Squirrel Figurine': '#c87a3a', 'Wumbus Statue': '#8ad8a8', 'Bobo Statue': '#d8a8c8', 'Sign Of The Vessel': '#5a3a7a',
  'Coat Stand': '#8a5a3a', 'Clothesline': '#e8e0d0', 'Mannequin (Male)': '#e8d0b0', 'Mannequin (Female)': '#e8d0b0',
  'Butterfly Hutch': '#7ab84a', 'Ornamental Hay Bale': '#e0c070', 'Bird House': '#a8743e', 'Doghouse': '#b07a42',
  'Dark Doghouse': '#5a3a2a', 'Cat Tree': '#c8a87a', 'Dark Cat Tree': '#5a4a3a', 'Mini-Fridge': '#e8e8f0',
  'Tilled Soil': '#7a4a2a', 'Watered Soil': '#4a2a1a', 'Grass': '#5aa83a', 'Blue Grass': '#3a8aa8',
};

const KIND_DEFAULT: Record<string, string> = {
  fish: '#7a9ab8', gem: '#8ac8e8', artifact: '#c8a87a', food: '#e8a85a', artisan: '#d8a85a', forage: '#7ab84a',
  hat: '#8a5a3a', boots: '#7a4a2a', ring: '#e8b830', sword: '#b8c0c8', dagger: '#b8c0c8', club: '#8a6a4a',
  slingshot: '#8a6a4a', tool: '#9aa4ae', trinket: '#d8a8e8', book: '#a83a3a', special: '#e8c84a', stardrop: '#c84ad8',
  animal: '#e8d8c0', loot: '#8a5aa8', misc: '#c8a87a', resource: '#a8743e', bait: '#a8603a', tackle: '#c8c8d0',
  potion: '#d84a6a', bomb: '#3a3a4a', totem: '#a8743e', seed: '#c8a87a', sapling: '#7ab84a', treeseed: '#a87a4a',
  fertilizer: '#a87a4a', produce: '#e8a85a', flower: '#e86a8a', building: '#c9a06a', rug: '#c84a3a',
  painting: '#5a8ad8', chair: '#a8743e', bench: '#a8743e', couch: '#7a5a3a', armchair: '#7a5a3a', table: '#a8743e',
  teatable: '#a8743e', endtable: '#a8743e', bookcase: '#8a5a3a', lamp: '#e8c86a', bed: '#c84a3a', fireplace: '#8a8a90',
  fishtank: '#5ab8e8', tv: '#4a4a5a', houseplant: '#4a9a3a', walldecor: '#a8743e', decor: '#c8a87a', piano: '#3a2a2a',
  catalogue: '#a8743e', chest: '#a8743e', machine: '#9a8a7a', light: '#c8a87a', lamppost: '#5a5a6a', brazier: '#8a8a90',
  torch: '#a8743e', fence: '#a8743e', gate: '#a8743e', floor: '#a8743e', path: '#a8a090', sign: '#a8743e',
  scarecrow: '#c8a85a', rarecrow: '#c8a85a', sprinkler: '#9aa4ae', crabpot: '#a8743e', statue: '#8a8a90',
  shellfish: '#d8602a', bar: '#c8c8d0', ore: '#a8a8b0', geode: '#a89a8a', node: '#8a8a90', backpack: '#8a5a3a',
  rod: '#a8743e', crop: '#5aa83a', fruittree: '#5aa83a', tree: '#4a8a3a', teabush: '#3a8a3a',
};

export function baseColor(name: string, kind: string): RGBA {
  if (NAME_COLORS[name]) return hex(NAME_COLORS[name]);
  // Strip tier prefixes for lookups like "Gold Bar".
  for (const [re, c] of WORD_COLORS) if (re.test(name)) return hex(c);
  const def = KIND_DEFAULT[kind];
  if (def) {
    // Vary hue slightly per name so lists aren't monotone.
    const h = hashStr(name);
    const base = hex(def);
    const j = ((h % 41) - 20) / 255;
    return [clamp(base[0] + j * 120), clamp(base[1] + ((h >> 8) % 31 - 15)), clamp(base[2] + ((h >> 16) % 31 - 15)), 255];
  }
  return hueColor(hashStr(name) % 360, 0.55, 0.55);
}

/** Secondary/accent color for items (e.g., upholstery, painting scenes). */
export function accentColor(name: string): RGBA {
  return hueColor((hashStr(name + '#') % 360), 0.6, 0.58);
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function hueColor(h: number, s: number, l: number): RGBA {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [clamp((r + m) * 255), clamp((g + m) * 255), clamp((b + m) * 255), 255];
}

export function woodColor(name: string): RGBA {
  if (/mahogany/i.test(name)) return hex('#8a3a2a');
  if (/walnut/i.test(name)) return hex('#6a4426');
  if (/birch/i.test(name)) return hex('#e0c89a');
  if (/oak/i.test(name)) return hex('#b07a42');
  if (/dark|midnight/i.test(name)) return hex('#4a3438');
  if (/modern/i.test(name)) return hex('#8a8a96');
  if (/winter|icy/i.test(name)) return hex('#c8d8e8');
  if (/luxury|king|ornate|elegant/i.test(name)) return hex('#b8902a');
  if (/candy/i.test(name)) return hex('#f0a0c8');
  return hex('#a8743e');
}
