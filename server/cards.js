// The deck: each card is a board with two pairs of opposites. Psychics write their own clues.
//
// Topic sets: the host picks one in the lobby. Each round deals a board and a topic from the set,
// and the psychic's clue has to be one of that topic ("A food", "A film"...). Each set carries
// boards that suit its topics. "Anything goes" has no topics, so any clue will do.

export const CARD_BY_ID = {
  funny: { top: 'Funny', bottom: 'Unfunny', left: 'Ugly', right: 'Cute' },
  pricey: { top: 'Expensive', bottom: 'Cheap', left: 'Gross', right: 'Delicious' },
  scary: { top: 'Scary', bottom: 'Not scary', left: 'Tiny', right: 'Huge' },
  cool: { top: 'Cool', bottom: 'Cringe', left: 'Useless', right: 'Useful' },
  exciting: { top: 'Exciting', bottom: 'Boring', left: 'Easy', right: 'Hard' },
  healthy: { top: 'Healthy', bottom: 'Unhealthy', left: 'Bland', right: 'Tasty' },
  famous: { top: 'Famous', bottom: 'Unknown', left: 'Villain', right: 'Hero' },
  chaos: { top: 'Loud', bottom: 'Quiet', left: 'Calm', right: 'Chaotic' },
  rated: { top: 'Overrated', bottom: 'Underrated', left: 'Old-fashioned', right: 'Modern' },
  romantic: { top: 'Romantic', bottom: 'Unromantic', left: 'Cheap date', right: 'Fancy date' },
  smart: { top: 'Smart', bottom: 'Dumb', left: 'Rude', right: 'Polite' },
  danger: { top: 'Dangerous', bottom: 'Safe', left: 'Boring job', right: 'Dream job' },
  sweet: { top: 'Sweet', bottom: 'Salty', left: 'Breakfast', right: 'Dinner' },
  hopeful: { top: 'Hopeful', bottom: 'Sad', left: 'Ordinary', right: 'Strange' },
  stress: { top: 'Loud', bottom: 'Quiet', left: 'Restful', right: 'Stressful' },
  warm: { top: 'Warm', bottom: 'Cold', left: 'Forgettable', right: 'Unforgettable' },
  priceless: { top: 'Rude', bottom: 'Polite', left: 'Worthless', right: 'Priceless' },
  fast: { top: 'Fast', bottom: 'Slow', left: 'Clumsy', right: 'Graceful' },
  rich: { top: 'Rich', bottom: 'Poor', left: 'Unhappy', right: 'Happy' },
  clean: { top: 'Clean', bottom: 'Dirty', left: 'Indoors', right: 'Outdoors' },
  trendy: { top: 'Trendy', bottom: 'Dated', left: 'For kids', right: 'For adults' },
  real: { top: 'Real', bottom: 'Made up', left: 'Harmless', right: 'Terrifying' },
  smell: { top: 'Good smell', bottom: 'Bad smell', left: 'Natural', right: 'Artificial' },
  gift: { top: 'Good gift', bottom: 'Bad gift', left: 'Practical', right: 'Silly' },
};

const C = CARD_BY_ID;
export const CARDS = Object.values(C);

const SETS = [
  {
    id: 'everyday',
    name: 'Everyday Things',
    blurb: 'Chores, jobs, the stuff in your bag',
    topics: ['A household object', 'A chore', 'Something in your bag', 'A job', 'A place in town', 'A way to spend Sunday', 'A supermarket buy', 'A school subject', 'A piece of clothing', 'A bad habit'],
    cards: [C.exciting, C.cool, C.clean, C.stress, C.gift, C.danger, C.pricey, C.rated, C.trendy, C.rich],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    blurb: 'Snacks, dishes, drinks, desserts',
    topics: ['A food', 'A drink', 'A dessert', 'A snack', 'A breakfast', 'A fast food order', 'A fruit or vegetable', 'A restaurant dish', 'A pizza topping', 'A sauce or spice'],
    cards: [C.healthy, C.pricey, C.sweet, C.smell, C.trendy, C.rated, C.romantic, C.warm],
  },
  {
    id: 'pop',
    name: 'Pop Culture',
    blurb: 'Films, songs, stars, games',
    topics: ['A film', 'A TV show', 'A song', 'A celebrity', 'A video game', 'A cartoon character', 'A singer or band', 'A meme', 'A book', 'A superhero or villain'],
    cards: [C.famous, C.rated, C.funny, C.scary, C.trendy, C.hopeful, C.warm, C.real, C.smart, C.cool],
  },
  {
    id: 'creatures',
    name: 'Creatures & Nature',
    blurb: 'Animals, plants, weather, myths',
    topics: ['An animal', 'A pet', 'A bird', 'A bug', 'A sea creature', 'A plant or flower', 'A mythical creature', 'A kind of weather', 'A dinosaur', 'A farm animal'],
    cards: [C.scary, C.funny, C.fast, C.smart, C.real, C.chaos, C.smell, C.warm],
  },
  {
    id: 'people',
    name: 'People & Places',
    blurb: 'Cities, trips, hobbies, history',
    topics: ['A city or country', 'A holiday spot', 'A historical figure', 'A sport', 'A hobby', 'A kind of party', 'A first date idea', 'A superpower', 'A famous building', 'A way to travel'],
    cards: [C.romantic, C.exciting, C.rich, C.warm, C.danger, C.famous, C.chaos, C.priceless, C.smart, C.hopeful],
  },
];

export const TOPIC_SETS = {
  mixed: { name: 'Grab Bag', blurb: 'A topic from every set', topics: SETS.flatMap((s) => s.topics), cards: CARDS },
  ...Object.fromEntries(SETS.map(({ id, ...set }) => [id, set])),
  open: { name: 'Anything Goes', blurb: 'No topic, any clue will do', topics: null, cards: CARDS },
};
export const DEFAULT_TOPIC_SET = 'mixed';
