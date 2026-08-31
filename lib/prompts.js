const STYLE =
  "Vertical 9:16 short-form video, dumpster-glam neon over fluorescent grime, analog camcorder grain, saturated slime-green and tarnished gold, no celebrities, no identifiable real people, original fictional characters and objects only, no logos of real social apps.";

export const SEED_PROMPTS = [
  {
    handle: "@pump4.oracle",
    caption: "the slurpee machine has been whispering tax advice since 2009",
    prompt: `${STYLE} Night gas station interior, buzzing fluorescents, a sweating frozen-drink machine with a tiny glowing mouth, conspiracy-documentary handheld camera, cashier in the far background completely faceless.`,
  },
  {
    handle: "@boxcutter.reviews",
    caption: "unboxing the limited-edition mystery brick (it was a brick)",
    prompt: `${STYLE} Fake luxury unboxing on a stained folding table: gloved hands slice tape on a gold-foiled box and lift out an ordinary red brick as if it were treasure, slow hero lighting, ridiculous product-ad energy.`,
  },
  {
    handle: "@ice.machine.truth",
    caption: "this ice machine is a weather-control node. stay woke (joke)",
    prompt: `${STYLE} Close-up of a beat-up gas-station ice freezer with extra antennas and blinking LEDs taped on, storm clouds reflected in the glass door, mock investigative-news zoom, nobody's face on camera.`,
  },
  {
    handle: "@reststop.union",
    caption: "the vending machines voted. they want dental.",
    prompt: `${STYLE} A row of scuffed vending machines in a rest-stop hallway at 3am, one machine shaking a tiny picket sign, fluorescent flicker, deadpan documentary pan.`,
  },
  {
    handle: "@hotdog.ledger",
    caption: "the roller grill knows your search history",
    prompt: `${STYLE} A rotating convenience-store hot-dog grill, sausages turning like surveillance cameras, a tiny CRT mounted above showing scrolling nonsense search terms, night-shift horror-comedy, no readable personal data.`,
  },
  {
    handle: "@wiper.haul",
    caption: "12-bottle artisan wiper-fluid haul. notes of petroleum.",
    prompt: `${STYLE} Fake shopping-haul video: hands lining up twelve identical blue washer-fluid jugs on a motel bedspread under gold ring lights, parody luxury-unboxing voiceover energy, no brands.`,
  },
  {
    handle: "@qr.portal.guy",
    caption: "receipt QR codes are tiny malls. I live there now.",
    prompt: `${STYLE} Over-the-shoulder shot of a fictional person in a hoodie, face never shown, holding a thermal receipt whose QR code glows and opens a miniature neon indoor mall, handheld camcorder, joke conspiracy.`,
  },
  {
    handle: "@gravel.drops",
    caption: "47-piece content-creator starter gravel. unbox with me.",
    prompt: `${STYLE} Influencer unboxing a glittery pouch that contains only gray gravel, each pebble placed on velvet like jewelry, dumpster-glam lighting, parody product launch.`,
  },
  {
    handle: "@airfresh.ceo",
    caption: "motivational speaker who is a sentient tree air-freshener",
    prompt: `${STYLE} A cardboard pine-tree air freshener hanging from a rear-view mirror, mouth cut into it, giving a ridiculous locker-room pep talk, parking-lot night, neon slime reflections on the dashboard.`,
  },
  {
    handle: "@angry.box",
    caption: "this box contains a smaller, angrier box",
    prompt: `${STYLE} Nested cardboard boxes on a garage floor, each smaller box trembling with cartoon rage when opened, gold confetti falling like a failed jackpot, deadpan unboxing.`,
  },
  {
    handle: "@wifi.sunglasses",
    caption: "limited drop: fluorescent station shades that see Wi-Fi",
    prompt: `${STYLE} Fake product drop of neon gas-station sunglasses on a spinning dumpster lid, Wi-Fi waves visualized as slime-green fog through the lenses, night lot, no real brand marks.`,
  },
  {
    handle: "@freezer.relics",
    caption: "DIY ancient energy drink, found behind the freezer",
    prompt: `${STYLE} A dusty canned drink with fake hieroglyphs pulled from behind a humming convenience-store freezer, golden hour but it's fluorescent, mock archaeology, slime drip on the label.`,
  },
];

export function pickPrompt(index) {
  const seed = SEED_PROMPTS[Math.abs(index) % SEED_PROMPTS.length];
  return { ...seed, seedIndex: Math.abs(index) % SEED_PROMPTS.length };
}
