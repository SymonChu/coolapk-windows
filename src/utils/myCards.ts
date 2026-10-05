export interface MyCard {
  id: string;
  title: string;
  imageUrl: string;
  url: string;
}

type JsonRecord = Record<string, unknown>;

const CHILD_KEYS = ['entities', 'items', 'list', 'cards', 'children', 'rows', 'data'];
const TITLE_KEYS = ['title', 'name', 'label', 'username', 'userName', 'nodeName', 'topicName'];
const URL_KEYS = ['url', 'actionUrl', 'action_url', 'targetUrl', 'target_url', 'webUrl', 'web_url', 'link', 'href', 'jumpUrl', 'jump_url'];
const IMAGE_KEYS = ['pic', 'logo', 'icon', 'image', 'cover', 'avatar', 'userAvatar', 'user_avatar', 'thumb', 'thumbnail'];
const ID_KEYS = ['entityId', 'entity_id', 'id', 'uid', 'userId', 'user_id'];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstString(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (isRecord(value)) {
      const nested = firstString(value, ['url', 'src', 'href', 'value']);
      if (nested) return nested;
    }
  }
  return '';
}

function childRecords(record: JsonRecord): JsonRecord[] {
  const result: JsonRecord[] = [];
  for (const key of CHILD_KEYS) {
    const value = parseJsonValue(record[key]);
    if (Array.isArray(value)) {
      result.push(...value.filter(isRecord));
    } else if (isRecord(value)) {
      result.push(value);
    }
  }
  return result;
}

function walkRecords(value: unknown, visitor: (record: JsonRecord) => void, visited = new Set<JsonRecord>()) {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    for (const item of parsed) walkRecords(item, visitor, visited);
    return;
  }
  if (!isRecord(parsed) || visited.has(parsed)) return;
  visited.add(parsed);
  visitor(parsed);
  for (const child of Object.values(parsed)) walkRecords(child, visitor, visited);
}

function isFrequentGroup(record: JsonRecord): boolean {
  const text = [
    firstString(record, ['title', 'name', 'label']),
    firstString(record, ['subTitle', 'subtitle', 'description']),
  ].join(' ');
  return text.includes('常去');
}

function cardFromRecord(record: JsonRecord, index: number): MyCard | null {
  const title = firstString(record, TITLE_KEYS);
  const url = firstString(record, URL_KEYS);
  const imageUrl = firstString(record, IMAGE_KEYS);
  const rawId = firstString(record, ID_KEYS);
  if (!title && !url && !imageUrl) return null;

  return {
    id: rawId || url || `${title}-${index}`,
    title: title || '未命名卡片',
    imageUrl,
    url,
  };
}

function collectCardRecords(value: unknown, result: JsonRecord[], visited = new Set<JsonRecord>()) {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    for (const item of parsed) collectCardRecords(item, result, visited);
    return;
  }
  if (!isRecord(parsed) || visited.has(parsed)) return;
  visited.add(parsed);

  const children = childRecords(parsed);
  const hasCardFields = Boolean(firstString(parsed, TITLE_KEYS) || firstString(parsed, URL_KEYS) || firstString(parsed, IMAGE_KEYS));
  if (children.length && !firstString(parsed, URL_KEYS) && !firstString(parsed, IMAGE_KEYS)) {
    for (const child of children) collectCardRecords(child, result, visited);
    return;
  }
  if (hasCardFields) result.push(parsed);
}

function uniqueCards(records: JsonRecord[]): MyCard[] {
  const cards: MyCard[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const card = cardFromRecord(record, index);
    if (!card) return;
    const key = `${card.id}|${card.url}|${card.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(card);
  });
  return cards;
}

/** 将账户“我的卡片”接口响应转换为“我的常去”页面可展示的卡片。 */
export function normalizeMyCardsResponse(value: unknown): MyCard[] {
  const groups: JsonRecord[] = [];
  walkRecords(value, (record) => {
    if (isFrequentGroup(record) && childRecords(record).length) groups.push(record);
  });

  const groupRecords: JsonRecord[] = [];
  for (const group of groups) {
    for (const child of childRecords(group)) collectCardRecords(child, groupRecords);
  }
  if (groupRecords.length) return uniqueCards(groupRecords);

  // 兼容接口直接返回卡片数组的旧响应，避免服务端去掉分组标题后侧边栏完全消失。
  const fallbackRecords: JsonRecord[] = [];
  collectCardRecords(value, fallbackRecords);
  return uniqueCards(fallbackRecords);
}
