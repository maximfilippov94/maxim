/**
 * Нормы КБЖУ по данным человека.
 *
 * Считает приложение, а не сервер: при регистрации сервер зовёт свой
 * `estimateTargets`, но маршрут анкеты (`/client/onboarding`) нормы не
 * трогает вовсе — он записывает ровно то, что прислали. Значит правка
 * роста, веса, цели или активности обязана принести новые нормы с
 * собой, иначе человек поправит рост, а считаться всё будет по старому.
 *
 * Формула та же, что в вебе: цифры в двух продуктах должны совпадать.
 * Жила она внутри экрана анкеты — вынесена сюда, когда понадобилась
 * второму месту.
 */
import { readSex } from './api';

export interface Targets {
  target_kcal: number;
  target_protein: number;
  target_fat: number;
  target_carbs: number;
}

export function targets(sex: string, age: number, h: number, w: number,
                        activity: string, goal: string): Targets {
  let kcal = 10 * w + 6.25 * h - 5 * age + (readSex(sex) === 'm' ? 5 : -161);
  kcal *= ({ low: 1.3, medium: 1.5, high: 1.7 } as Record<string, number>)[activity] ?? 1.5;
  if (goal === 'Снижение веса') kcal *= 0.85;
  else if (goal === 'Набор мышечной массы') kcal *= 1.1;
  kcal = Math.max(1000, Math.round(kcal / 10) * 10);
  const protein = Math.round((goal === 'Набор мышечной массы' ? 2 : 1.8) * w);
  const fat = Math.round(0.9 * w);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { target_kcal: kcal, target_protein: protein, target_fat: fat, target_carbs: carbs };
}
