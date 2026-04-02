type Mode = "cursed" | "village" | "gamer";
type RequestedMode = Mode | "mixed";

type NamePart = {
  full: string;
  short: string;
};

type ModeParts = {
  prefixes: NamePart[];
  cores: NamePart[];
  suffixes: NamePart[];
};

type GeneratedUsername = {
  mode: Mode;
  full: string;
  short: string;
};

const MODES: Mode[] = ["cursed", "village", "gamer"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const parts: Record<Mode, ModeParts> = {
  cursed: {
    prefixes: [
      { full: "Квантовий", short: "Квант" },
      { full: "Шалений", short: "Шал" },
      { full: "Лютий", short: "Лют" },
      { full: "Пекельний", short: "Пек" },
      { full: "Токсичний", short: "Токс" },
      { full: "Мутний", short: "Мут" },
      { full: "Сирний", short: "Сир" },
      { full: "Сонний", short: "Сон" },
      { full: "Потужний", short: "Потуж" },
      { full: "Ультра", short: "Ульт" },
      { full: "Мега", short: "Мега" },
      { full: "Турбо", short: "Турб" },
    ],
    cores: [
      { full: "Пельмень", short: "Пель" },
      { full: "Буряк", short: "Бур" },
      { full: "Огірок", short: "Огір" },
      { full: "Шкарпетко", short: "Шкарп" },
      { full: "Кефір", short: "Кеф" },
      { full: "Голуб", short: "Гол" },
      { full: "Кабан", short: "Каб" },
      { full: "Хрущ", short: "Хрущ" },
      { full: "Бобер", short: "Бобр" },
      { full: "Карась", short: "Кар" },
      { full: "Вареник", short: "Вар" },
      { full: "Пацюк", short: "Пац" },
    ],
    suffixes: [
      { full: "УМайонезі", short: "Майо" },
      { full: "БезГальм", short: "БГ" },
      { full: "НаМаксималках", short: "Макс" },
      { full: "ІмператорСела", short: "ІмпС" },
      { full: "ПовелительБорщу", short: "Борщ" },
      { full: "ЗПідвалу", short: "Пдвл" },
      { full: "Неадекват", short: "Неад" },
      { full: "Всратогеддон", short: "Всрат" },
      { full: "3000", short: "3000" },
      { full: "БезШансів", short: "БШ" },
      { full: "УПаніці", short: "Панк" },
      { full: "ЗНульовимПінгом", short: "0Пнг" },
    ],
  },

  village: {
    prefixes: [
      { full: "Ґазда", short: "Ґаз" },
      { full: "Вуйко", short: "Вуй" },
      { full: "Пан", short: "Пан" },
      { full: "Файний", short: "Фай" },
      { full: "Гоноровий", short: "Гон" },
      { full: "Лютий", short: "Лют" },
      { full: "Скажений", short: "Скаж" },
      { full: "Поважний", short: "Пов" },
      { full: "Добрий", short: "Добр" },
      { full: "Хитрий", short: "Хит" },
      { full: "Стрийко", short: "Стр" },
      { full: "Газдівський", short: "Газд" },
    ],
    cores: [
      { full: "Буряк", short: "Бур" },
      { full: "Гарбуз", short: "Гарб" },
      { full: "Карась", short: "Кар" },
      { full: "Кабан", short: "Каб" },
      { full: "Вареник", short: "Вар" },
      { full: "Огірок", short: "Огір" },
      { full: "Бобер", short: "Бобр" },
      { full: "Гусак", short: "Гус" },
      { full: "Пацюк", short: "Пац" },
      { full: "Хрущ", short: "Хрущ" },
      { full: "Бараболя", short: "Бара" },
      { full: "Бриндза", short: "Брин" },
      { full: "Банош", short: "Бан" },
      { full: "Лемішка", short: "Лем" },
    ],
    suffixes: [
      { full: "ЗПолонини", short: "Пол" },
      { full: "ЗПлаю", short: "Плай" },
      { full: "ЗПідЛісу", short: "Ліс" },
      { full: "ЗПідҐанку", short: "Ґанк" },
      { full: "ЗБриндзьою", short: "Брнд" },
      { full: "ЗБаношем", short: "Банш" },
      { full: "ЗТрембітою", short: "Трем" },
      { full: "НаФірах", short: "Фіри" },
      { full: "ЗКриниці", short: "Крин" },
      { full: "ГрозаПрисілка", short: "Прис" },
      { full: "ВолодарСтодоли", short: "Стод" },
      { full: "МайстерПлацинди", short: "Плац" },
      { full: "ЗПогреба", short: "Пгрб" },
      { full: "НаГороді", short: "Город" },
      { full: "ЗЧасником", short: "Часн" },
    ],
  },

  gamer: {
    prefixes: [
      { full: "Про", short: "Про" },
      { full: "Топ", short: "Топ" },
      { full: "Кібер", short: "Кібр" },
      { full: "Мега", short: "Мега" },
      { full: "Турбо", short: "Турб" },
      { full: "Нагибатор", short: "Наг" },
      { full: "Легендарний", short: "Лег" },
      { full: "Жорсткий", short: "Жор" },
      { full: "Рейджовий", short: "Рейдж" },
      { full: "Тіньовий", short: "Тінь" },
      { full: "Ультра", short: "Ульт" },
      { full: "Скілловий", short: "Скіл" },
    ],
    cores: [
      { full: "Кабан", short: "Каб" },
      { full: "Карась", short: "Кар" },
      { full: "Огірок", short: "Огір" },
      { full: "Вареник", short: "Вар" },
      { full: "Бобер", short: "Бобр" },
      { full: "Пельмень", short: "Пель" },
      { full: "Буряк", short: "Бур" },
      { full: "Хомяк", short: "Хом" },
      { full: "Шкарпетко", short: "Шкарп" },
      { full: "Гусак", short: "Гус" },
      { full: "Пацюк", short: "Пац" },
      { full: "Кефір", short: "Кеф" },
    ],
    suffixes: [
      { full: "228", short: "228" },
      { full: "1337", short: "1337" },
      { full: "NoScope", short: "NS" },
      { full: "Headshot", short: "HS" },
      { full: "НаРеспі", short: "Респ" },
      { full: "БезПінгу", short: "0Пнг" },
      { full: "Клатчер", short: "Клатч" },
      { full: "МутВсем", short: "Мут" },
      { full: "ТільтМашина", short: "Тільт" },
      { full: "ФармитьЛіс", short: "Фарм" },
      { full: "ЗЛобі", short: "Лобі" },
      { full: "РозноситьКатку", short: "Катк" },
    ],
  },
};

function resolveMode(mode: RequestedMode | string): Mode {
  if (mode === "mixed") {
    return pick(MODES);
  }

  if (MODES.includes(mode as Mode)) {
    return mode as Mode;
  }

  return pick(MODES);
}

export function createFunnyUkrainianUsername(
  mode: RequestedMode | string = "mixed"
): GeneratedUsername {
  const separators = ["", "_"];
  const actualMode = resolveMode(mode);
  const data = parts[actualMode];

  const prefix = pick(data.prefixes);
  const core = pick(data.cores);
  const suffix = pick(data.suffixes);
  const sep = pick(separators);

  return {
    mode: actualMode,
    full: `${prefix.full}${sep}${core.full}${sep}${suffix.full}`,
    short: `${prefix.short}${sep}${core.short}${sep}${suffix.short}`,
  };
}

export function generateFunnyUkrainianUsernames(
  count = 100,
  mode: RequestedMode | string = "mixed"
): GeneratedUsername[] {
  const result = new Map<string, GeneratedUsername>();

  while (result.size < count) {
    const item = createFunnyUkrainianUsername(mode);
    result.set(item.full, item);
  }

  return [...result.values()];
}

// Example usage:
const one = createFunnyUkrainianUsername("village");
console.log(one);

const many = generateFunnyUkrainianUsernames(20, "mixed");
console.log(many);
