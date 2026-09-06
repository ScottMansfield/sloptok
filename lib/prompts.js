const STYLE =
  "Vertical 9:16 short-form video, dumpster-glam neon over fluorescent grime, analog camcorder grain, saturated slime-green and tarnished gold, no celebrities, no identifiable real people, original fictional characters and objects only, no logos of real social apps.";

export const SEED_PROMPTS = [
  {
    handle: "@lottery.weather",
    caption: "this scratch-off predicted a hailstorm. I used a penny.",
    prompt: `${STYLE} Close-up of a fictional lottery scratch card on a gas-station counter, gold foil peeling to reveal a tiny looping hailstorm animation, penny scratching in slow motion, mock weather-alert overlay, no faces.`,
  },
  {
    handle: "@mop.bucket.live",
    caption: "the mop bucket is hosting a talk show and I am the intern.",
    prompt: `${STYLE} A yellow mop bucket in a fluorescent rest-stop bathroom, suds forming a tiny talk-show set with two miniature chairs, camcorder grain, deadpan late-night energy, nobody's face.`,
  },
  {
    handle: "@self.checkout.morse",
    caption: "self-checkout beeped Morse code. it just wanted a break.",
    prompt: `${STYLE} Empty self-checkout kiosk at 2am, scanner light blinking Morse, a tiny handwritten BREAK TIME sign taped over the barcode window, handheld zoom, no logos of real stores.`,
  },
  {
    handle: "@fog.skincare.haul",
    caption: "fog-machine fluid as a 12-step skincare. poreless parking lot.",
    prompt: `${STYLE} Fake beauty-haul on a motel dresser: unlabeled jugs of theatrical fog fluid arranged like serums under gold ring lights, a cloud of slime-green mist rolling off the table, parody luxury-ad lighting, gloved hands only.`,
  },
  {
    handle: "@bathroom.key.club",
    caption: "the restroom key on a giant paddle is a secret society.",
    prompt: `${STYLE} Night convenience-store counter, a huge wooden restroom-key paddle glowing with tiny gold runes, the door it opens reveals a miniature neon banquet of snacks, mock-secret-society documentary, cashier faceless in the far background.`,
  },
  {
    handle: "@coolant.sommelier",
    caption: "tasting notes: antifreeze, regret, a hint of July.",
    prompt: `${STYLE} Fake wine-tasting setup on a folding table in a garage: unlabeled neon-green jugs swirled in plastic cups like Bordeaux, gold spotlight, ridiculous sommelier energy, nobody drinking, no real brand marks.`,
  },
  {
    handle: "@cone.life.coach",
    caption: "this traffic cone charged me $40 for a pep talk.",
    prompt: `${STYLE} A scuffed orange traffic cone in an empty night parking lot with a tiny mouth cut in the plastic, giving an aggressive locker-room pep talk, slime-green sodium lights, camcorder handheld, no people.`,
  },
  {
    handle: "@receipt.couture",
    caption: "thermal-paper evening wear. limited drop. it fades in sunlight.",
    prompt: `${STYLE} Fake fashion-drop video: a mannequin (no face) draped in long curling thermal-receipt paper on a dumpster runway, gold ring lights, paper slowly fading as a flashlight hits it, parody haute-couture energy.`,
  },
  {
    handle: "@gumball.exchange",
    caption: "the gumball machine is a commodities floor. red is up.",
    prompt: `${STYLE} Close-up of a beat-up gumball machine, colorful balls bouncing like a trading pit, tiny ticker tape of nonsense numbers scrolling on the glass, fluorescent night, mock-finance documentary zoom, no real logos.`,
  },
  {
    handle: "@forbidden.fountain",
    caption: "soda fountain mixed the off-menu flavor. it tasted like 1997.",
    prompt: `${STYLE} A grimy convenience-store soda fountain at night, one unlabeled lever glowing gold, slime-green foam overflowing in slow motion, mock-sacred-ritual lighting, no faces, no real soda brands.`,
  },
  {
    handle: "@propane.gossip",
    caption: "the propane tank has tea and it will not be silenced.",
    prompt: `${STYLE} A backyard propane tank with a tiny glowing mouth, whispering cartoon gossip bubbles of steam, night, dumpster-glam neon on the grill, handheld camcorder, no people, no real brand marks.`,
  },
  {
    handle: "@atm.vestibule.spa",
    caption: "the ATM vestibule is a luxury spa. towels are receipts.",
    prompt: `${STYLE} Tiny fluorescent ATM vestibule restyled as a ridiculous luxury spa: receipt-paper towels, gold slime dripping from a fake fountain, empty lobby at 3am, parody wellness commercial, no readable account data, no faces.`,
  },
  {
    handle: "@deli.slicer.dj",
    caption: "the deli slicer dropped a set. ham on the ones and twos.",
    prompt: `${STYLE} Night deli counter, a meat slicer with tiny turntables instead of a blade plate, imaginary vinyl spinning, slime-green club lighting over fluorescent tile, deadpan music-video energy, nobody's face, no real brands.`,
  },
  {
    handle: "@payphone.seance",
    caption: "this leftover payphone only dials 1994. I asked for the weather.",
    prompt: `${STYLE} A battered outdoor payphone booth at a gas station, receiver glowing, a tiny analog weather report playing as gold static, camcorder grain, night lot, no people, no real carrier logos.`,
  },
  {
    handle: "@plastic.bag.ballet",
    caption: "parking-lot bag ballet. standing ovation from the carts.",
    prompt: `${STYLE} Empty night parking lot, a single plastic grocery bag performing an elegant slow ballet in the wind under slime-green and gold lights, shopping carts lined up like an audience, mock-art-film camera, no logos.`,
  },
  {
    handle: "@lotto.pen.relic",
    caption: "the chained lottery pen is an ancient artifact. do not unclip.",
    prompt: `${STYLE} Extreme close-up of a chewed plastic pen on a metal chain at a convenience counter, fake hieroglyphs scratched into the barrel, gold dust falling when it writes, mock-archaeology zoom, fluorescent night, no faces.`,
  },
  {
    handle: "@motel.ice.oracle",
    caption: "the motel ice machine is casting today's horoscope in cubes.",
    prompt: `${STYLE} Hallway motel ice machine at 2am, cubes tumbling into a bucket arranged like zodiac symbols, slime-green EXIT glow, mock-astrology voiceover energy, no faces, no real motel logos.`,
  },
  {
    handle: "@tire.swing.boardroom",
    caption: "abandoned tire swing holding a quarterly earnings call.",
    prompt: `${STYLE} Night playground, a lone tire swing with a tiny glowing mouth presenting nonsense quarterly charts on a floating CRT, sodium lights, deadpan corporate energy, no people.`,
  },
  {
    handle: "@dryer.sheet.couture",
    caption: "laundromat dryer sheets as haute perfume. notes of lint.",
    prompt: `${STYLE} Fake fragrance launch inside a fluorescent laundromat: unlabeled dryer sheets fanned like perfume blotters under gold ring lights, steam as glamorous mist, gloved hands only, no real brands.`,
  },
  {
    handle: "@bus.stop.therapist",
    caption: "this plastic bench charged me for listening.",
    prompt: `${STYLE} Empty night bus stop, a cracked plastic bench with a tiny mouth, handing out tiny fictional appointment cards, slime-green streetlight, handheld camcorder, no people, no real transit logos.`,
  },
  {
    handle: "@shopping.cart.pilgrimage",
    caption: "one rogue cart completing a sacred lap of the lot.",
    prompt: `${STYLE} Night supermarket parking lot, a single shopping cart rolling a perfect ceremonial circle while others bow slightly, gold confetti from nowhere, mock-pilgrimage documentary, no logos.`,
  },
  {
    handle: "@neon.open.sign",
    caption: "the OPEN sign is unionizing with CLOSED.",
    prompt: `${STYLE} Convenience-store window at night, a flickering neon OPEN sign holding a tiny picket with CLOSED, fluorescent interior blur behind, deadpan labor-doc pan, no readable brand names.`,
  },
  {
    handle: "@ketchup.packet.museum",
    caption: "private tour of my ketchup-packet wing. donation suggested.",
    prompt: `${STYLE} Fake museum gallery in a garage: dozens of unlabeled foil ketchup packets under tiny gold spotlights on velvet, parody docent energy, camcorder grain, no faces, no real brands.`,
  },
  {
    handle: "@carwash.confession",
    caption: "the automatic car wash heard everything. it will not tell.",
    prompt: `${STYLE} Interior of an empty automatic car wash tunnel at night, brushes as looming listeners, slime-green soap foam, gold tunnel lights, mock-confession-booth framing, no people, no real logos.`,
  },
  {
    handle: "@postage.stamp.raid",
    caption: "unboxing a vault of expired postage. prestige mail.",
    prompt: `${STYLE} Fake haul unboxing on a stained desk: glittery pouch spills fictional expired postage stamps arranged like rare cards, gold ring light, parody collector energy, gloved hands, no real postal logos.`,
  },
  {
    handle: "@jersey.barrier.poet",
    caption: "highway barrier dropping spoken-word about brake lights.",
    prompt: `${STYLE} Night roadside concrete jersey barrier with a tiny glowing mouth performing absurd spoken-word, slime-green highway lights streaking past, handheld camcorder, no people, no real road signs with readable brands.`,
  },
  {
    handle: "@vending.refund.cult",
    caption: "the coin return is a shrine. leave three nickels.",
    prompt: `${STYLE} Close-up of a scuffed vending-machine coin return glowing gold, tiny offerings of nickels and candy wrappers, fluorescent rest-stop hall, mock-ritual zoom, no faces, no real logos.`,
  },
  {
    handle: "@parking.boot.spa",
    caption: "wheel boot as a wellness retreat. you are not going anywhere.",
    prompt: `${STYLE} Night curb, a bright wheel boot on a tire styled with tiny spa towels and a slime-green cucumber slice on the clamp, parody wellness ad, no people, no real brand marks.`,
  },
  {
    handle: "@fax.machine.revival",
    caption: "we powered on a fax and it started a newsletter.",
    prompt: `${STYLE} Dusty office corner at night, an old fax machine printing endless curling paper with nonsense headlines, gold desk lamp, slime-green status LEDs, mock-tech-revival documentary, no faces.`,
  },
  {
    handle: "@porta.potty.opera",
    caption: "portable toilet aria at dusk. standing room only (outside).",
    prompt: `${STYLE} Construction-lot dusk, a lone portable toilet with a tiny spotlight and cartoon music notes rising from the vent, dumpster-glam gold and slime-green, mock-opera energy, no people, no logos.`,
  },
  {
    handle: "@coupon.book.gospel",
    caption: "reading the weekly circular like scripture. aisle 7 amen.",
    prompt: `${STYLE} Over-the-shoulder of a hooded fictional person (face never shown) reading a glowing fictional grocery circular on a folding chair in a garage, gold highlighter streaks, parody televangelist framing.`,
  },
  {
    handle: "@manhole.cover.dj",
    caption: "street manhole spinning a set. bass from the sewer.",
    prompt: `${STYLE} Night city street, a manhole cover vibrating like a turntable with slime-green steam pulses, gold sodium lights, deadpan music-video camera, no people, no readable street brands.`,
  },
];

export function pickPrompt(index) {
  const seed = SEED_PROMPTS[Math.abs(index) % SEED_PROMPTS.length];
  return { ...seed, seedIndex: Math.abs(index) % SEED_PROMPTS.length };
}
