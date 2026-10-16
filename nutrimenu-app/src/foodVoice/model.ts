import type { FoodMeal, Food as FoodProduct } from '../api';

export interface VoiceItem {
  source_index?: number;
  name: string;
  phrase: string;
  quantity_text: string | null;
  grams: number | null;
  pieces: number | null;
  weight_source: 'voice' | 'pieces' | null;
  meal: FoodMeal | null;
  ingredient_id: number | null;
  candidates: FoodProduct[];
  related?: boolean;
  warning?: string;
}
export interface VoiceDraft {
  draft_id: string;
  eaten_on: string;
  transcript: string;
  expires_in: number;
  items: VoiceItem[];
}
export interface VoiceCapabilities {
  refinement_available?: boolean;
  speech_available: boolean;
  text_available: boolean;
  max_seconds: number;
  message: string;
}
export const selectedFood = (row: VoiceItem) => row.candidates.find(p => p.id === row.ingredient_id);
export const validGrams = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0 && n <= 5000;
export function pieceGrams(product: FoodProduct, pieces: number | null): number | null {
  const grams = (product.piece_g ?? 0) * (pieces ?? 0);
  return pieces !== null && pieces > 0 && pieces <= 100 && validGrams(grams) ? Math.round(grams * 10) / 10 : null;
}
export function chooseFood(row: VoiceItem, food: FoodProduct): VoiceItem {
  const derive = row.weight_source === 'pieces' || (!row.grams && !!row.pieces);
  const grams = derive ? pieceGrams(food, row.pieces) : row.grams;
  return { ...row, ingredient_id: food.id, candidates: [food, ...row.candidates.filter(p => p.id !== food.id)],
    grams, weight_source: derive ? (grams ? 'pieces' : null) : row.weight_source };
}
export function applyAmount(row: VoiceItem, amount: number, unit: 'g' | 'pc'): VoiceItem | null {
  const food = selectedFood(row);
  if (!food || !Number.isFinite(amount) || amount <= 0) return null;
  const grams = unit === 'pc' ? pieceGrams(food, amount) : amount;
  if (!validGrams(grams)) return null;
  return { ...row, grams, pieces: unit === 'pc' ? amount : null,
    quantity_text: unit === 'pc' ? `${amount} шт.` : null, weight_source: unit === 'pc' ? 'pieces' : 'voice' };
}
export function fillKnownMeal(items: VoiceItem[]): VoiceItem[] {
  const known = [...new Set(items.map(r => r.meal).filter((m): m is FoodMeal => !!m))];
  return known.length === 1 ? items.map(r => ({ ...r, meal: r.meal ?? known[0] })) : items;
}
export const readyToConfirm = (items: VoiceItem[]) => items.length > 0 && items.every(r => !!selectedFood(r) && validGrams(r.grams) && !!r.meal);
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function rowHint(row: VoiceItem): string {
  if (!selectedFood(row)) {
    if (row.related) return 'Выберите похожий вариант';
    if (!row.candidates.length) return 'Точного варианта нет';
    if (/творог|йогурт|молоко/i.test(row.name)) return 'Уточните жирность';
    if (/тунец/i.test(row.name)) return 'В масле или в собственном соку?';
    if (/рис|греч|круп|макарон/i.test(row.name)) return 'Сухой или готовый вес?';
    return 'Выберите вариант';
  }
  if (!validGrams(row.grams)) return 'Укажите количество';
  return `${selectedFood(row)?.match_note === 'Ваш подтверждённый выбор' ? 'Ваш выбор · ' : ''}${Math.round(selectedFood(row)!.kcal * row.grams / 100)} ккал`;
}
