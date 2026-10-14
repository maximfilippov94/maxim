/**
 * Лёгкая разметка в ответах EQUA AI.
 *
 * Модель отвечает markdown-ом, но в переписке не нужен документ — нужна
 * типографика мессенджера. Поддерживаем ровно тот же безопасный минимум,
 * что и веб (`chatFormatAiText` в app.js): жирный текст, заголовки как
 * жирную строку, маркеры списка и нумерацию. Всё остальное остаётся
 * обычным текстом — в чате это честнее, чем наполовину разобранный
 * markdown с торчащими звёздочками.
 */

export interface MdSpan { text: string; bold?: boolean }

/** Строка ответа: набор кусков, часть из которых жирная. */
export type MdLine = MdSpan[];

const BOLD = /\*\*([^*\n][\s\S]*?)\*\*/g;

/** Разобрать строку на обычные и жирные куски. */
function spans(line: string): MdLine {
  const out: MdLine = [];
  let last = 0;
  BOLD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLD.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out.length ? out : [{ text: line }];
}

/**
 * Разобрать ответ целиком. Возвращает строки: каждая — набор кусков.
 * Пустые строки сохраняются, они задают ритм абзацев.
 */
export function mdLite(value: string): MdLine[] {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  return text.split('\n').map(raw => {
    /* Заголовок любого уровня — просто жирная строка: ступеней размеров
       в пузыре сообщения всё равно нет. */
    const head = raw.match(/^#{1,4}\s+(.+)$/);
    if (head) return [{ text: head[1], bold: true }];

    /* Маркеры приводим к одному виду, нумерацию оставляем как есть. */
    const bullet = raw.replace(/^\s*[-•]\s+/, '• ').replace(/^\s*(\d+)[.)]\s+/, '$1. ');
    return spans(bullet);
  });
}
