export const TIME_ZONE = "America/Santiago";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

export function dayKey(date: Date) {
  return dayFormat.format(date);
}

export function hourOf(date: Date) {
  return Number(hourFormat.format(date));
}

function offsetMs(date: Date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

function localMidnight(y: number, m: number, d: number) {
  const midnightUtc = Date.UTC(y, m - 1, d);
  const guess = midnightUtc - offsetMs(new Date(midnightUtc));
  return new Date(midnightUtc - offsetMs(new Date(guess)));
}

export function startOfDay(date: Date) {
  const [y, m, d] = dayKey(date).split("-").map(Number);
  return localMidnight(y, m, d);
}

export function startOfMonth(date: Date) {
  const [y, m] = dayKey(date).split("-").map(Number);
  return localMidnight(y, m, 1);
}
