import { StoryChapter } from "./types";

export const STORY: StoryChapter[] = [
  {
    id: 1,
    subtitle: "Глава I",
    title: "Рождение Ронина",
    description:
      "Твой клан уничтожен в ночи. Ты один выжил. Без господина, без дома — ты ронин. Путь мести начинается здесь.",
    enemies: [
      { name: "Ато", clan: "kaze", level: 1, title: "Страж деревни" },
    ],
    reward: { xp: 50 },
  },
  {
    id: 2,
    subtitle: "Глава II",
    title: "Цена крови",
    description:
      "Клан Хоно предлагает тебе кров и пищу. Взамен — одна дуэль. Докажи, что ты достоин.",
    enemies: [
      { name: "Кэн", clan: "hono", level: 2, title: "Боец клана Хоно" },
      { name: "Рин", clan: "hono", level: 3, title: "Старший воин" },
    ],
    reward: { xp: 100 },
  },
  {
    id: 3,
    subtitle: "Глава III",
    title: "Предательство в тени",
    description:
      "Клан использовал тебя как инструмент. Ночью в твою комнату проникает ассасин клана Кагэ.",
    enemies: [
      { name: "Шин", clan: "kage", level: 4, title: "Ассасин Кагэ" },
    ],
    reward: { xp: 150 },
  },
  {
    id: 4,
    subtitle: "Глава IV",
    title: "Турнир Теней",
    description:
      "Тайный турнир пяти кланов. Твоё лицо скрыто маской. Никто не знает кто ты. Пробейся к финалу.",
    enemies: [
      { name: "???", clan: "koori", level: 5, title: "Неизвестный боец" },
      { name: "???", clan: "tetsu", level: 5, title: "Неизвестный боец" },
    ],
    reward: { xp: 200 },
  },
  {
    id: 5,
    subtitle: "Глава V",
    title: "Лик врага",
    description:
      "Ты узнал правду: именно господин Тэцу отдал приказ той ночью. Его стражи стоят между вами.",
    enemies: [
      { name: "Горо", clan: "tetsu", level: 6, title: "Командир стражи" },
      { name: "Ичи", clan: "tetsu", level: 7, title: "Правая рука господина" },
    ],
    reward: { xp: 300 },
  },
  {
    id: 6,
    subtitle: "Финал",
    title: "Последний клинок",
    description:
      "Господин Тэцу ждёт тебя в тронном зале. Честь требует крови. Последняя дуэль.",
    enemies: [
      { name: "Лорд Тэцу", clan: "tetsu", level: 10, title: "Повелитель Стали" },
    ],
    reward: { xp: 500 },
  },
];

export function getChapter(id: number): StoryChapter | undefined {
  return STORY.find((c) => c.id === id);
}
