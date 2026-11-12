const CFG = {
  grid: 140, half: 70,
  mix: { rare: 0.08, shiny: 0.02 },
  price: { n: 2, r: 9, s: 28 },
  base: { r: 0.65, v: 2.6 },
  caps: [30, 42, 58, 78, 102, 132, 168, 210, 260, 320, 390, 470],
  costK: 6
};
// extra: how many more levels this upgrade gets for every new planet the player has reached
const UPG = [
  { id: 'radius',  branch: 'vac',  name: 'Широкая насадка',   max: 7, extra: 1, base: 70,   grow: 1.85, icon: 'brush'  },
  { id: 'speed',   branch: 'vac',  name: 'Лёгкие ботинки',    max: 5, extra: 1, base: 90,   grow: 1.9,  icon: 'boot'   },
  { id: 'cap',     branch: 'bag',  name: 'Вместительный рюкзак', max: 8, extra: 1, base: 55, grow: 1.72, icon: 'pack'  },
  { id: 'comp',    branch: 'bag',  name: 'Уплотнитель пыли',  max: 4, extra: 1, base: 320,  grow: 2.0,  icon: 'press', req: { id: 'cap', lvl: 2 } },
  { id: 'tele',    branch: 'bag',  name: 'Телепорт на пункт', max: 1, base: 450,  grow: 1,    icon: 'portal', req: { id: 'cap', lvl: 3 } },
  { id: 'robot',   branch: 'bot',  name: 'Робот-помощник',    max: 3, extra: 1, base: 250,  grow: 2.3,  icon: 'robot'  },
  { id: 'rspeed',  branch: 'bot',  name: 'Двигатели роботов', max: 3, extra: 1, base: 450,  grow: 1.9,  icon: 'bolt',  req: { id: 'robot', lvl: 1 } },
  { id: 'magnet',  branch: 'tech', name: 'Детектор сокровищ', max: 3, base: 100,  grow: 2.0,  icon: 'gem'    },
  { id: 'scanner', branch: 'tech', name: 'Сканер пыли',       max: 1, base: 330,  grow: 1,    icon: 'radar'  }
];
// planets: index 0 is Mars. suit = cost of the suit that lets you fly TO this planet (bought at 80% of the previous one)
const PLANETS = [
  { id: 'mars', name: 'Марс', to: 'на Марс', of: 'Марса', station: 'Красная дюна', seed: 20261108, price: 1, rare: 30, shiny: 22, suit: 0 },
  { id: 'jup',  name: 'Юпитер', to: 'к Юпитеру', of: 'Юпитера', station: 'Большое пятно', seed: 51122, price: 2, rare: 38, shiny: 30, suit: 3360 },
  { id: 'sat',  name: 'Сатурн', to: 'к Сатурну', of: 'Сатурна', station: 'Ледяное кольцо', seed: 77310, price: 3, rare: 44, shiny: 36, suit: 30000 },
  { id: 'nep',  name: 'Нептун', to: 'к Нептуну', of: 'Нептуна', station: 'Тритон', seed: 90417, price: 4, rare: 50, shiny: 42, suit: 70000 }
];
function costOf(u, l) { return Math.max(5, Math.round(u.base * CFG.costK * Math.pow(u.grow, l) / 5) * 5); }
function statsFor(lv, turbo, bonus) {
  const t = turbo ? 1 : 0, b = bonus || {};
  return {
    r: (CFG.base.r + 0.2 * lv.radius) * (1 + 0.25 * t),
    v: (CFG.base.v + 0.45 * lv.speed) * (1 + 0.35 * t),
    cap: CFG.caps[Math.min(lv.cap, CFG.caps.length - 1)],
    priceMult: (1 + 0.12 * lv.comp) * (b.amber ? 1.15 : 1),
    hint: 6 + 3 * lv.magnet,
    robots: lv.robot + (b.ringBot ? 1 : 0),
    robotV: 2.0 + 0.5 * lv.rspeed,
    scanner: lv.scanner > 0,
    tele: lv.tele > 0
  };
}
