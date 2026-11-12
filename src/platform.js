// ---------- site lock: a build for one portal only starts on that portal's domains (or localhost for testing) ----------
const SiteLock = (function () {
  const w = window, cfg = (typeof __L !== 'undefined') ? __L : null;
  if (!cfg) return { ok: true };
  const dec = a => a.map(s => s.map((c, i) => String.fromCharCode(c ^ (23 + i))).join(''));
  const keys = dec(cfg.k);
  const hostOk = h => {
    h = String(h || '').toLowerCase();
    if (!h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
    const parts = h.split('.');
    return keys.some(k => { const i = parts.indexOf(k); return i !== -1 && i >= parts.length - 3; });
  };
  const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };
  let ok = location.protocol === 'file:' || hostOk(location.hostname);
  if (!ok) {
    let inFrame = false; try { inFrame = w.top !== w; } catch (e) { inFrame = true; }
    let parent = '';
    try { const ao = location.ancestorOrigins; if (ao && ao.length) parent = hostOf(ao[ao.length - 1]); } catch (e) {}
    if (!parent && document.referrer) parent = hostOf(document.referrer);
    if (inFrame && parent) ok = hostOk(parent);
    else if (inFrame && !parent) ok = !cfg.s;     // no way to tell: strict builds refuse, others allow
  }
  return { ok: ok, name: cfg.n };
})();

// ---------- platform layer: portal SDKs (Yandex, CrazyGames, Poki, GameDistribution), language, cloud saves ----------
const Plat = (function () {
  const w = window;
  const P = { id: w.__PLATFORM__ || 'none', lang: 'en', rewardedOK: false, interOK: false, extPause: false, adDue: false, lastAd: Date.now(), _g: null, _t: 0, _pend: null };
  const l0 = (navigator.language || 'en').toLowerCase();
  P.lang = /^(ru|uk|be|kk|uz|hy|az|ky|tg|tk)/.test(l0) ? 'ru' : 'en';
  const LS = 'dustronaut-save-v1';
  const sleep = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const noop = () => {};
  let ads = null, cloud = null, gp = noop, ready = noop;

  function setLangFrom(code) { if (!code) return; code = String(code).toLowerCase(); P.lang = /^(ru|uk|be|kk|uz|hy|az|ky|tg|tk)/.test(code) ? 'ru' : 'en'; }

  async function bootYandex() {
    const sdk = await sleep(w.YaGames.init(), 4500);
    if (!sdk) return;
    try { setLangFrom(sdk.environment.i18n.lang); } catch (e) {}
    try { sdk.on('game_api_pause', () => { P.extPause = true; }); sdk.on('game_api_resume', () => { P.extPause = false; }); } catch (e) {}
    ready = () => { try { sdk.features.LoadingAPI && sdk.features.LoadingAPI.ready(); } catch (e) {} };
    gp = on => { try { const g = sdk.features.GameplayAPI; if (g) on ? g.start() : g.stop(); } catch (e) {} };
    ads = {
      inter: () => new Promise(res => {
        const done = () => { P.extPause = false; res(); };
        try { sdk.adv.showFullscreenAdv({ callbacks: { onOpen: () => { P.extPause = true; }, onClose: done, onError: done, onOffline: done } }); } catch (e) { done(); }
      }),
      reward: () => new Promise(res => {
        let ok = false; const done = () => { P.extPause = false; res(ok); };
        try { sdk.adv.showRewardedVideo({ callbacks: { onOpen: () => { P.extPause = true; }, onRewarded: () => { ok = true; }, onClose: done, onError: done } }); } catch (e) { done(); }
      })
    };
    P.interOK = P.rewardedOK = true;
    const pl = await sleep(sdk.getPlayer({ scopes: false }).catch(() => null), 3500);
    if (pl) cloud = {
      get: async () => { const d = await pl.getData(['save']); return d && d.save ? d.save : null; },
      set: s => pl.setData({ save: s }).catch(noop)
    };
  }

  async function bootCrazy() {
    const SDK = w.CrazyGames && w.CrazyGames.SDK;
    if (!SDK) return;
    await sleep(SDK.init(), 4500);
    try { setLangFrom(SDK.user.systemInfo.locale); } catch (e) {}
    gp = on => { try { on ? SDK.game.gameplayStart() : SDK.game.gameplayStop(); } catch (e) {} };
    const req = type => new Promise(res => {
      let ok = false; const done = () => { P.extPause = false; res(ok); };
      try { SDK.ad.requestAd(type, { adStarted: () => { P.extPause = true; }, adFinished: () => { ok = true; done(); }, adError: () => { ok = false; done(); } }); } catch (e) { done(); }
    });
    ads = { inter: () => req('midgame'), reward: () => req('rewarded') };
    P.interOK = P.rewardedOK = true;
    cloud = { get: async () => SDK.data.getItem('save'), set: s => { try { SDK.data.setItem('save', s); } catch (e) {} } };
  }

  async function bootPoki() {
    const S = w.PokiSDK;
    if (!S) return;
    try { await sleep(S.init(), 4500); } catch (e) { /* ad blocker: still let people play */ }
    ready = () => { try { S.gameLoadingFinished(); } catch (e) {} };
    gp = on => { try { on ? S.gameplayStart() : S.gameplayStop(); } catch (e) {} };
    ads = {
      inter: async () => { try { await S.commercialBreak(() => { P.extPause = true; }); } catch (e) {} P.extPause = false; },
      reward: async () => { let ok = false; try { ok = await S.rewardedBreak(() => { P.extPause = true; }); } catch (e) {} P.extPause = false; return !!ok; }
    };
    P.interOK = P.rewardedOK = true;
  }

  function bootGD() {
    // options are set in index.html (GD_OPTIONS); events pause the game around ads
    ads = {
      inter: async () => { try { P.extPause = true; if (w.gdsdk && w.gdsdk.showAd) await w.gdsdk.showAd(); } catch (e) {} P.extPause = false; },
      reward: async () => false
    };
    P.interOK = true;
  }

  P.boot = async function () {
    if (!SiteLock.ok) {
      const ru = P.lang === 'ru';
      const show = () => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:#0d0b22;color:#f6f1ff;font:16px system-ui,sans-serif;text-align:center;padding:20px';
        d.innerHTML = '<div><h1 style="color:#ff8f5a;margin:0 0 10px;font-size:40px">Dustronaut</h1><p>' + (ru ? 'Эта копия игры запущена на чужом сайте.<br>Играй в официальную версию на ' : 'This copy of the game is running on an unauthorized site.<br>Play the official version on ') + SiteLock.name + '.</p><p><a style="color:#38dccb" href="https://lostmarq.itch.io/dustronaut" target="_blank" rel="noopener">lostmarq.itch.io/dustronaut</a></p></div>';
        document.body.appendChild(d);
      };
      if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
      return new Promise(() => {});      // the game never starts
    }
    try {
      if (P.id === 'yandex' && w.YaGames) await bootYandex();
      else if (P.id === 'crazygames' && w.CrazyGames) await bootCrazy();
      else if (P.id === 'poki') await bootPoki();
      else if (P.id === 'gamedistribution') bootGD();
      if (cloud) {
        const raw = await sleep(cloud.get(), 3500);
        if (raw) {
          let c = null, l = null;
          try { c = JSON.parse(raw); } catch (e) {}
          try { l = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
          if (c && (!l || (c.lastSeen || 0) > (l.lastSeen || 0))) { try { localStorage.setItem(LS, raw); } catch (e) {} }
        }
      }
    } catch (e) { /* the game must start even if an SDK fails */ }
    P.cloud = cloud;
    document.documentElement.lang = P.lang;
  };
  P.ready = () => ready();
  P.gameplay = on => { if (P._g === on) return; P._g = on; gp(on); };
  P.interstitial = () => ads ? ads.inter() : Promise.resolve();
  P.rewarded = () => ads ? ads.reward() : Promise.resolve(false);
  P.maybeMid = async function () {
    if (!P.interOK || !P.adDue || Date.now() - P.lastAd < 150000) return;
    P.adDue = false; P.extPause = true;
    try { await P.interstitial(); } catch (e) {}
    P.extPause = false; P.lastAd = Date.now();
  };
  P.syncCloud = function (s) {
    if (!cloud) return;
    P._pend = s;
    if (!P._t) P._t = setTimeout(() => { P._t = 0; P.flushCloud(); }, 20000);
  };
  P.flushCloud = function () { if (cloud && P._pend) { const s = P._pend; P._pend = null; try { cloud.set(s); } catch (e) {} } };
  return P;
})();

// ---------- English translation: the game is written in Russian; for other languages the DOM is translated on the fly ----------
(function () {
  if (typeof document === 'undefined') return;
  const RU = [
    ['Игровое поле станции', 'Station play field'], [' · станция «Красная дюна»', ' · "Red Dune" station'], ['80%: можно лететь дальше', '80%: you can fly on'],
    ['Звук', 'Sound'], ['Настройки', 'Settings'], ['Выносливость', 'Stamina'], ['Рюкзак', 'Backpack'], ['Бег', 'Run'], ['Сдать пыль', 'Deliver dust'], ['Улучшения', 'Upgrades'], ['Закрыть', 'Close'],
    ['Скафандр для Юпитера', 'Jupiter suit'], ['Станция на орбите газового гиганта', 'A station orbiting the gas giant'], ['Сообщение', 'Message'],
    ['Спокойная уборка космоса. Собирай пыль, сдавай её на пункт сбора, покупай технику и лети к новым планетам.', 'Calm space cleaning. Collect dust, hand it in at the drop-off point, buy gear and fly to new planets.'],
    ['Зажми', 'Hold'], [' и води мышью или пальцем: астронавт идёт и убирает.', ' and drag with the mouse or your finger: the astronaut walks and cleans.'],
    ['Клавиши', 'Keys'], [' WASD или стрелки работают так же.', ' WASD or the arrow keys work the same way.'],
    [' (на телефоне кнопка «Бег») даёт рывок, но быстро утомляет.', ' (on a phone use the "Run" button) gives a burst of speed but tires you quickly.'],
    ['Светящийся круг', 'Glowing circle'], [' у будки: там пыль меняют на монеты.', ' by the booth: dust is exchanged for coins there.'],
    ['Играть', 'Play'], ['Продолжить', 'Continue'],
    ['Не удалось загрузить 3D-движок. Проверь интернет и обнови страницу.', 'Could not load the 3D engine. Check your connection and reload.'],
    ['Браузер не смог запустить 3D (WebGL). Попробуй другой браузер или обнови страницу.', "Your browser couldn't start 3D (WebGL). Try another browser or reload the page."],
    ['Старый болт с Земли', 'Old Bolt from Earth'], ['Кристалл Марса', 'Mars Crystal'], ['Золотая шестерёнка', 'Golden Gear'], ['Осколок метеорита', 'Meteorite Shard'],
    ['Янтарные полосы', 'Amber Stripes'], ['Шторм', 'Storm'], ['Ночной вихрь', 'Night Swirl'],
    ['Пылесос', 'Vacuum'], ['Роботы', 'Robots'], ['Техника', 'Gear'], ['Скафандры', 'Suits'], ['Скафандр', 'Suit'],
    ['Широкая насадка', 'Wide Nozzle'], ['Лёгкие ботинки', 'Light Boots'], ['Вместительный рюкзак', 'Roomy Backpack'], ['Уплотнитель пыли', 'Dust Compressor'], ['Телепорт на пункт', 'Drop-off Teleport'],
    ['Робот-помощник', 'Helper Robot'], ['Двигатели роботов', 'Robot Engines'], ['Детектор сокровищ', 'Treasure Detector'], ['Сканер пыли', 'Dust Scanner'],
    ['Найдено: ', 'Found: '], [' монет и турбо на ', ' coins and turbo for '], [' монет', ' coins'], ['Не хватает монет на скафандр', 'Not enough coins for the suit'], ['Не хватает монет', 'Not enough coins'], [': уровень ', ': level '],
    ['Скафандр готов!', 'Suit ready!'], ['Теперь астронавт выдержит Юпитер. Хочешь лететь сейчас или дочистить Марс?', 'The astronaut can now survive Jupiter. Fly now, or finish cleaning Mars first?'],
    ['К Юпитеру', 'To Jupiter'], ['Остаться', 'Stay'],
    ['Зажми и води по станции: собери 20 единиц пыли', 'Hold and drag around the station: collect 20 units of dust'],
    ['Встань в светящийся круг у пункта сбора и сдай пыль', 'Stand in the glowing circle at the drop-off point and hand in your dust'],
    ['Открой «Улучшения» и купи любое', 'Open "Upgrades" and buy any one'], ['Найди сокровище: блеск виден слева от старта', 'Find a treasure: you can see a glint to the left of the start'],
    ['Задание выполнено! +', 'Task complete! +'], ['Задание ', 'Task '], ['Цель', 'Goal'], ['Готово', 'Done'],
    ['Очисти станцию на 25%', 'Clean the station to 25%'], ['Очисти станцию на 50%', 'Clean the station to 50%'], ['Очисти станцию на 100% и получи приз', 'Clean the station to 100% and get a prize'],
    ['Дойди до 80%: откроется скафандр для Юпитера', 'Reach 80%: the Jupiter suit unlocks'], ['Накопи на скафандр для Юпитера: ', 'Save up for the Jupiter suit: '],
    ['Станция чиста. Следующая остановка: Юпитер', 'The station is clean. Next stop: Jupiter'], ['Очищено ', 'Cleaned '],
    ['Чистюля Марса', 'Mars Sparkler'], ['Станция сияет. Достижение получено.', 'The station sparkles. Achievement unlocked.'], ['Приз:', 'Prize:'],
    [' золотая насадка пылесоса. Она уже на астронавте.', ' the golden vacuum nozzle. It is already on the astronaut.'], ['Отлично', 'Great'],
    ['Станция чиста на 80%', 'Station 80% clean'], ['Скафандр уже есть, можно лететь к Юпитеру.', 'You already have the suit, you can fly to Jupiter.'],
    ['Можно лететь дальше. Для Юпитера нужен новый скафандр.', 'You can move on. Jupiter needs a new suit.'], ['К скафандру', 'To the suit'], ['Убирать дальше', 'Keep cleaning'],
    ['Рюкзак полон: неси пыль к пункту сбора', 'Backpack full: take the dust to the drop-off point'], ['Почти полон', 'Almost full'], ['Отдышка', 'Catching breath'], ['Турбо ', 'Turbo '],
    ['Радиус ', 'Radius '], ['Скорость роботов ', 'Robot speed '], ['Скорость ', 'Speed '], [' м/с', ' m/s'], ['Вместимость ', 'Capacity '], ['Цена пыли ×', 'Dust price ×'], ['Роботов: ', 'Robots: '], ['Блеск сокровищ с ', 'Treasure glint from '],
    ['Сдавать пыль в любой точке станции', 'Deliver dust from anywhere on the station'], ['Подсвечивает пыль на станции, особенно в конце', 'Highlights dust on the station, especially near the end'],
    ['Куплен. Выбранный дизайн: ', 'Owned. Chosen design: '], ['Открывается на 80% очистки', 'Unlocks at 80% cleaned'], ['Откроется на 80% очистки', 'Unlocks at 80% cleaned'], ['Откроется на 80%', 'Unlocks at 80%'],
    ['Лететь к Юпитеру', 'Fly to Jupiter'], ['Выбрать дизайн · ', 'Choose design · '], ['Максимум', 'Max'], ['Нужно: ', 'Requires: '], [' ур. ', ' lv. '], ['Купить · ', 'Buy · '], ['Монет: ', 'Coins: '],
    ['На Юпитере давление и холод. Этот скафандр держит их и хорошо смотрится на фоне полосатой планеты.', 'Jupiter has crushing pressure and cold. This suit handles both and looks great against the striped planet.'],
    ['Включён', 'On'], ['Выключен', 'Off'], ['Музыка', 'Music'], ['Включена', 'On'], ['Выключена', 'Off'], ['Графика', 'Graphics'], ['Лёгкая', 'Light'], ['Красивая', 'Pretty'],
    ['Если на телефоне игра тормозит, выбери «Лёгкая».', 'If the game lags on your phone, choose "Light".'], ['Начать заново', 'Start over'], ['Точно сбросить', 'Really reset'], ['Сбросить прогресс', 'Reset progress'],
    ['Орбитальная станция уже ждёт, но этот этап ещё в разработке. Пока дочисти Марс до 100%, чтобы получить приз.', 'The orbital station is waiting, but this stage is still in development. For now, finish cleaning Mars to 100% to earn the prize.'],
    ['Вернуться на Марс', 'Back to Mars'], ['Юпитера', 'Jupiter'], ['Юпитеру', 'Jupiter'], ['Юпитер', 'Jupiter'], ['Марса', 'Mars'], ['Марс', 'Mars'],
    ['Игра начата заново', 'New game started'], ['С возвращением! Бонус: +', 'Welcome back! Bonus: +'], ['Зажми и води по станции, чтобы убирать пыль', 'Hold and drag around the station to clean dust'],
    ['Хватает монет на скафандр для Юпитера', 'You have enough coins for the Jupiter suit'], ['Выдохся: пока иди шагом', 'Out of breath: walk for now'],
    ['Ролик: турбо ', 'Watch an ad: turbo '], ['Турбо за ролик! ', 'Ad turbo! '],
    ['Карта планет', 'Planet map'], ['Достижения', 'Achievements'], ['Достижение: ', 'Achievement: '],
    ['Улучшения общие для всех станций. Можно вернуться и дочистить любую.', 'Upgrades are shared by all stations. You can come back and finish any of them.'],
    ['Спокойная уборка космоса. Очисти четыре станции: Марс, Юпитер, Сатурн и Нептун. Собирай пыль, покупай технику и лети дальше.', 'Calm space cleaning. Clean four stations: Mars, Jupiter, Saturn and Neptune. Collect dust, buy gear and fly on.'],
    ['на Марс', 'to Mars'], ['к Юпитеру', 'to Jupiter'], ['к Сатурну', 'to Saturn'], ['к Нептуну', 'to Neptune'],
    ['Сатурна', 'Saturn'], ['Сатурну', 'Saturn'], ['Сатурн', 'Saturn'], ['Нептуна', 'Neptune'], ['Нептуну', 'Neptune'], ['Нептун', 'Neptune'],
    [' · станция «Большое пятно»', ' · "Great Spot" station'], [' · станция «Ледяное кольцо»', ' · "Ice Ring" station'], [' · станция «Тритон»', ' · "Triton" station'],
    ['Станция «Красная дюна»', '"Red Dune" station'], ['Станция «Большое пятно»', '"Great Spot" station'], ['Станция «Ледяное кольцо»', '"Ice Ring" station'], ['Станция «Тритон»', '"Triton" station'],
    ['Теперь можно лететь ', 'Now you can fly '], ['. Новые улучшения откроются там. ', '. New upgrades unlock there. '],
    ['Можно и остаться: станции ', 'Or stay: the station on '], [' осталось ', ' has '], ['% до 100%, за это будет приз.', '% to go until 100%, and there is a prize for it.'],
    ['Остаться и дочистить', 'Stay and finish'], ['Улететь', 'Fly away'], ['Позже', 'Later'],
    ['Дойди до 80%: откроется скафандр для полёта ', 'Reach 80%: unlocks the suit to fly '], ['Накопи на скафандр для полёта ', 'Save up for the suit to fly '],
    ['Хватает монет на скафандр для полёта ', 'You have enough coins for the suit to fly '],
    ['Станция чиста. Следующая остановка: ', 'The station is clean. Next stop: '], ['Вся Солнечная система сияет!', 'The whole Solar System sparkles!'],
    ['Нептун чист. Загляни на карту: где-то ещё осталась пыль', 'Neptune is clean. Check the map: there is still dust somewhere'],
    [': станция сияет. Достижение получено.', ': the station sparkles. Achievement unlocked.'],
    ['Все четыре станции чисты. Ты прошёл Dustronaut!', 'All four stations are clean. You beat Dustronaut!'],
    ['Укротитель бури', 'Storm Tamer'], ['Властелин колец', 'Lord of the Rings'], ['Хозяин Нептуна', 'Master of Neptune'],
    ['янтарный компрессор: вся пыль дороже на 15%.', 'the amber compressor: all dust is worth 15% more.'],
    ['золотой робот: ещё один помощник сверх лимита.', 'a golden robot: one more helper beyond the limit.'],
    ['корона Нептуна на шлеме. Солнечная система гордится тобой.', 'the Neptune crown on your helmet. The Solar System is proud of you.'],
    ['Это последняя станция. Дочисти её до 100%, чтобы получить корону Нептуна.', 'This is the last station. Clean it to 100% to earn the Neptune crown.'],
    ['Скафандр уже есть, можно лететь ', 'You already have the suit, you can fly '], ['Можно лететь дальше. Для полёта ', 'You can move on. To fly '], [' нужен новый скафандр.', ' you need a new suit.'],
    ['Лететь ', 'Fly '], ['Лететь', 'Fly'], ['Больше уровней на новой планете', 'More levels on a new planet'], ['Куплен. Дизайн: ', 'Owned. Design: '], ['Ты здесь', 'You are here'],
    ['Можно купить и выбрать дизайн', 'Available: pick a design'], ['Откроется на 80% станции ', 'Unlocks at 80% on '], ['Закрыто', 'Locked'], ['Скафандр: ', 'Suit: '],
    ['Нужен скафандр · ', 'Suit needed · '], ['% · цена пыли ×', '% · dust price ×'], ['Получено ', 'Unlocked '],
    ['Добро пожаловать: ', 'Welcome to '], ['! Цена пыли здесь ×', '! Dust price here ×'], ['В «Улучшениях» открылись новые уровни', 'New levels are open in "Upgrades"'],
    ['Песочное кольцо', 'Sand Ring'], ['Ледяной', 'Icy'], ['Закат', 'Sunset'], ['Глубина', 'Deep Blue'], ['Аметист', 'Amethyst'], ['Полярный', 'Polar'],
    ['У колец Сатурна летают ледяные осколки. Скафандр с усиленным шлемом и подогревом.', "Ice shards fly around Saturn's rings. This suit has a reinforced helmet and heating."],
    ['На Тритоне минус 235 градусов и ледяные гейзеры. Самый тёплый скафандр в магазине.', 'Triton is minus 235 degrees with icy geysers. The warmest suit in the shop.'],
    ['Янтарная капля', 'Amber Drop'], ['Кусочек бури', 'Storm Shard'], ['Старый зонд', 'Old Probe'], ['Красный кристалл', 'Red Crystal'],
    ['Ледяная жемчужина', 'Ice Pearl'], ['Обломок кольца', 'Ring Fragment'], ['Компас Кассини', "Cassini's Compass"], ['Звёздная соль', 'Star Salt'],
    ['Синий алмаз', 'Blue Diamond'], ['Капсула гейзера', 'Geyser Capsule'], ['Перо кометы', 'Comet Feather'], ['Сердце Тритона', 'Heart of Triton'],
    ['Пылесос в деле', 'Vacuum at Work'], ['Гроза пыли', 'Dust Buster'], ['Космический дворник', 'Space Janitor'], ['Золотоискатель', 'Gold Digger'],
    ['Под завязку', 'Packed Full'], ['Командная работа', 'Teamwork'], ['Солнечная система сияет', 'The Solar System Shines'],
    ['Собери 1 000 единиц пыли', 'Collect 1,000 units of dust'], ['Собери 10 000 единиц пыли', 'Collect 10,000 units of dust'], ['Собери 50 000 единиц пыли', 'Collect 50,000 units of dust'],
    ['Собери 300 золотых пылинок', 'Collect 300 golden specks'], ['Сдай полный рюкзак 20 раз', 'Hand in a full backpack 20 times'], ['Роботы убрали 5 000 единиц пыли', 'Robots cleaned 5,000 units of dust'],
    ['Очисти Марс на 100%', 'Clean Mars to 100%'], ['Очисти Юпитер на 100%', 'Clean Jupiter to 100%'], ['Очисти Сатурн на 100%', 'Clean Saturn to 100%'], ['Очисти Нептун на 100%', 'Clean Neptune to 100%'],
    ['Очисти все четыре станции на 100%', 'Clean all four stations to 100%']
  ];
  const T = RU.slice().sort((a, b) => b[0].length - a[0].length);
  const CYR = /[А-Яа-яЁё]/;
  function tr(s) {
    if (!CYR.test(s)) return s;
    for (const p of T) if (s.indexOf(p[0]) >= 0) s = s.split(p[0]).join(p[1]);
    s = s.replace(/[«»]/g, '"').replace(/(\d) из (\d)/g, '$1 of $2').replace(/(\d) с(?![А-Яа-яЁё])/g, '$1 s').replace(/(\d) м(?![А-Яа-яЁё\/])/g, '$1 m');
    return s;
  }
  Plat.tr = tr;
  function walk(n) {
    if (n.nodeType === 3) { const v = n.nodeValue; if (CYR.test(v)) { const t = tr(v); if (t !== v) n.nodeValue = t; } return; }
    if (n.nodeType !== 1) return;
    for (const a of ['aria-label', 'title']) { const v = n.getAttribute && n.getAttribute(a); if (v && CYR.test(v)) n.setAttribute(a, tr(v)); }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  Plat.installI18n = function () {
    if (Plat.lang !== 'en' || Plat._i18n) return;
    Plat._i18n = true;
    const root = document.body;
    walk(root);
    new MutationObserver(recs => {
      for (const r of recs) {
        if (r.type === 'characterData') walk(r.target);
        else if (r.type === 'attributes') walk(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
  };
})();
