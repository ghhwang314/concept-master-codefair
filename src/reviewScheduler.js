import { createEmptyCard, fsrs, Rating } from "./vendor/ts-fsrs/index.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MVP_INTERVAL_DAYS = 7;
const scheduler = fsrs({
  enable_short_term: false,
  enable_fuzz: false,
});

export function scheduleReviewWithFsrs({
  isCorrect,
  priorSuccessStreak = 0,
  now = new Date(),
} = {}) {
  const nowDate = new Date(now);
  if (!isCorrect) {
    return {
      nextReviewAt: formatDate(nowDate),
      rawNextReviewAt: formatDate(nowDate),
      intervalDays: 0,
      schedulerSource: "immediate_retry",
      rating: "Again",
    };
  }

  let card = createEmptyCard(nowDate);
  let reviewDate = nowDate;

  for (let index = 0; index < priorSuccessStreak; index += 1) {
    const simulated = scheduler.repeat(card, reviewDate)[Rating.Good];
    card = simulated.card;
    reviewDate = new Date(simulated.card.due);
  }

  const next = scheduler.repeat(card, reviewDate)[Rating.Good];
  const rawDue = new Date(next.card.due);
  const cappedDue = capDueDate(rawDue, nowDate);

  return {
    nextReviewAt: formatDate(cappedDue),
    rawNextReviewAt: formatDate(rawDue),
    intervalDays: daysBetween(nowDate, cappedDue),
    schedulerSource: "ts-fsrs",
    rating: "Good",
  };
}

export function formatDate(date) {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capDueDate(rawDue, nowDate) {
  const maxDue = new Date(nowDate.getTime() + MAX_MVP_INTERVAL_DAYS * DAY_MS);
  return rawDue > maxDue ? maxDue : rawDue;
}

function daysBetween(start, end) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS));
}
