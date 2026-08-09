// Real product photos, sourced from LoremFlickr (free, Creative Commons, keyword-based).
// Each entry has a "lock" id so the same produce type always gets the same photo
// (not a new random one on every reload).
//
// If a photo fails to load (network hiccup, service rate limit on stage), the
// ProduceImage component below automatically falls back to the emoji - the UI
// never shows a broken image icon.

const PRODUCE_IMAGE_URLS = {
  tomato: "https://loremflickr.com/400/300/tomato,vegetable?lock=101",
  banana: "https://loremflickr.com/400/300/banana,fruit?lock=102",
  mango: "https://loremflickr.com/400/300/mango,fruit?lock=103",
  apple: "https://loremflickr.com/400/300/apple,fruit?lock=104",
  potato: "https://loremflickr.com/400/300/potato,vegetable?lock=105",
  onion: "https://loremflickr.com/400/300/onion,vegetable?lock=106",
  spinach: "https://loremflickr.com/400/300/spinach,vegetable?lock=107",
  cauliflower: "https://loremflickr.com/400/300/cauliflower,vegetable?lock=108",
  grapes: "https://loremflickr.com/400/300/grapes,fruit?lock=109",
  papaya: "https://loremflickr.com/400/300/papaya,fruit?lock=110",
};

const PRODUCE_EMOJI = {
  tomato: "🍅",
  banana: "🍌",
  mango: "🥭",
  apple: "🍎",
  potato: "🥔",
  onion: "🧅",
  spinach: "🥬",
  cauliflower: "🥦",
  grapes: "🍇",
  papaya: "🍈",
};

export function produceImageUrl(produceType) {
  return PRODUCE_IMAGE_URLS[produceType?.toLowerCase()] || null;
}

export function produceEmoji(produceType) {
  return PRODUCE_EMOJI[produceType?.toLowerCase()] || "🥕";
}
