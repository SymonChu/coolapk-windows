<template>
  <section class="article-composer" aria-label="发布图文编辑器">
    <input
      ref="coverInputRef"
      class="visually-hidden-input"
      type="file"
      accept="image/*,.heic,.heif"
      :disabled="disabled || isPreparingCover || isPreparingImages"
      aria-label="选择题图文件"
      @change="handleCoverSelected"
    />
    <input
      ref="imageInputRef"
      class="visually-hidden-input"
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      :disabled="disabled || isPreparingCover || isPreparingImages"
      aria-label="选择正文图片文件"
      @change="handleImagesSelected"
    />

    <section class="cover-section" aria-labelledby="article-cover-label">
      <div v-if="modelValue.cover" class="cover-preview">
        <AppImage :src="imageSource(modelValue.cover)" alt="图文题图预览" image-class="article-cover-preview-image" fit="cover" />
        <div class="cover-preview-actions">
          <span class="cover-status"><i class="fas fa-check-circle"></i> 已添加题图</span>
          <div class="cover-action-buttons">
            <button type="button" :disabled="controlsDisabled" @click="openCoverPicker"><i class="fas fa-sync-alt"></i> 更换</button>
            <button type="button" class="remove-btn" :disabled="controlsDisabled" @click="removeCover"><i class="fas fa-trash-alt"></i> 移除</button>
          </div>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="cover-placeholder"
        :disabled="controlsDisabled"
        aria-label="添加题图"
        @click="openCoverPicker"
      >
        <span class="cover-placeholder-icon" aria-hidden="true"><i class="far fa-image"></i></span>
        <span class="cover-placeholder-copy">
          <span class="cover-title-group">
            <strong id="article-cover-label">{{ isPreparingCover ? '正在读取题图…' : '添加题图' }}</strong>
            <span class="optional-badge">可选</span>
          </span>
          <small>添加优质题图可获得更多推荐与赞</small>
        </span>
        <span class="cover-placeholder-plus" aria-hidden="true"><i class="fas fa-plus"></i></span>
      </button>
    </section>

    <section class="title-section" aria-labelledby="article-title-label">
      <input
        id="publish-article-title"
        class="article-title-input"
        type="text"
        :value="modelValue.title"
        placeholder="填写标题..."
        autocomplete="off"
        :disabled="controlsDisabled"
        @input="updateTitle"
      />
    </section>

    <section class="body-section" aria-label="正文内容">
      <div v-if="bodyImageCount" class="body-image-bar">
        <span class="body-image-badge"><i class="far fa-images"></i> 已插入 {{ bodyImageCount }} 张正文图片</span>
      </div>

      <div class="article-block-list" aria-label="正文内容顺序">
        <article
          v-for="(block, index) in modelValue.blocks"
          :key="block.id"
          class="article-block"
          :class="{ 'article-block-image': block.type === 'image' }"
        >
          <template v-if="block.type === 'text'">
            <textarea
              :ref="(element) => setTextAreaRef(block.id, element)"
              class="article-text-block"
              :value="block.text"
              :aria-label="`正文文字段落 ${textBlockNumber(index)}`"
              :placeholder="index === 0 ? '从这里开始输入正文，支持图文混排…' : '继续输入正文…'"
              rows="1"
              :style="{ minHeight: index === 0 && !block.text ? '180px' : '44px' }"
              :disabled="controlsDisabled"
              @focus="rememberSelection(block.id, $event)"
              @click="rememberSelection(block.id, $event)"
              @keyup="rememberSelection(block.id, $event)"
              @mouseup="rememberSelection(block.id, $event)"
              @select="rememberSelection(block.id, $event)"
              @input="updateText(block.id, $event)"
            ></textarea>
          </template>

          <figure v-else-if="block.type === 'image'" class="article-image-block">
            <AppImage
              :src="imageSource(block.image)"
              :alt="`正文图片 ${imageBlockNumber(index)} 预览`"
              image-class="article-image-preview"
              :style="{ height: 'auto', aspectRatio: imageAspectRatio(block.image) }"
              fit="contain"
            />
            <input
              class="article-image-description"
              type="text"
              :value="block.description ?? ''"
              maxlength="60"
              :disabled="controlsDisabled"
              :aria-label="`正文图片 ${imageBlockNumber(index)} 描述`"
              placeholder="图片描述"
              @input="updateImageDescription(block.id, $event)"
            />
            <figcaption>
              <span>
                正文图片 {{ imageBlockNumber(index) }}
                <small v-if="block.image.liveVideo || block.image.liveIdentifier">· Live Photo{{ block.image.liveEnabled ? '' : '（静态）' }}</small>
              </span>
              <div class="block-actions">
                <button
                  type="button"
                  :disabled="controlsDisabled || index === 0"
                  :aria-label="`正文图片 ${imageBlockNumber(index)} 上移`"
                  title="上移"
                  @click="moveBlock(index, -1)"
                ><i class="fas fa-arrow-up" aria-hidden="true"></i></button>
                <button
                  type="button"
                  :disabled="controlsDisabled || index === modelValue.blocks.length - 1"
                  :aria-label="`正文图片 ${imageBlockNumber(index)} 下移`"
                  title="下移"
                  @click="moveBlock(index, 1)"
                ><i class="fas fa-arrow-down" aria-hidden="true"></i></button>
                <button
                  type="button"
                  class="remove-block-button"
                  :disabled="controlsDisabled"
                  :aria-label="`移除正文图片 ${imageBlockNumber(index)}`"
                  title="移除图片"
                  @click="removeBlock(index)"
                ><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
              </div>
            </figcaption>
          </figure>

          <div v-else class="article-preserved-block">
            <span><i class="fas fa-link" aria-hidden="true"></i> 官方内容块（{{ block.model.type }}）</span>
            <small>当前编辑器保留此内容；保存后仍会保留在正文中</small>
            <div class="block-actions">
              <button type="button" :disabled="controlsDisabled || index === 0" :aria-label="`官方内容块 ${block.model.type} 上移`" title="上移" @click="moveBlock(index, -1)"><i class="fas fa-arrow-up" aria-hidden="true"></i></button>
              <button type="button" :disabled="controlsDisabled || index === modelValue.blocks.length - 1" :aria-label="`官方内容块 ${block.model.type} 下移`" title="下移" @click="moveBlock(index, 1)"><i class="fas fa-arrow-down" aria-hidden="true"></i></button>
            </div>
          </div>

        </article>
      </div>

      <p v-if="isPreparingImages" class="image-preparing-tip">正在读取正文图片…</p>
    </section>

    <p v-if="errorMessage" class="composer-error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import AppImage from '../common/AppImage.vue';
import type { PublishArticleBlock, PublishArticleState, PublishImage } from '../../utils/publishArticle';
import { preparePublishImage } from '../../utils/publishMedia';

const props = withDefaults(defineProps<{
  modelValue: PublishArticleState;
  disabled?: boolean;
}>(), { disabled: false });

const emit = defineEmits<{
  (event: 'update:modelValue', value: PublishArticleState): void;
}>();

let nextBlockSequence = 0;

const coverInputRef = ref<HTMLInputElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const textAreaRefs = new Map<string, HTMLTextAreaElement>();
const savedSelections = new Map<string, { start: number; end: number }>();
const activeTextBlockId = ref<string | null>(null);
const errorMessage = ref('');
const isPreparingCover = ref(false);
const isPreparingImages = ref(false);
const pendingImageInsertion = ref<{ blockId: string; start: number; end: number } | null>(null);

const controlsDisabled = computed(() => props.disabled || isPreparingCover.value || isPreparingImages.value);
const bodyImageCount = computed(() => props.modelValue.blocks.filter((block) => block.type === 'image').length);

function makeId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  nextBlockSequence += 1;
  return `${prefix}-${randomId || `${Date.now().toString(36)}-${nextBlockSequence.toString(36)}`}`;
}

function makeTextBlock(text = ''): PublishArticleBlock {
  return { id: makeId('text'), type: 'text', text };
}

function makeImageBlock(image: PublishImage): PublishArticleBlock {
  return { id: makeId('image'), type: 'image', image };
}

function emitState(patch: Partial<PublishArticleState>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch });
}

function imageSource(image: PublishImage): string {
  return image.preview || image.url || '';
}

function imageAspectRatio(image: PublishImage): string {
  const source = image.url || image.preview;
  const dimensions = source.match(/@(\d+)x(\d+)(?:\.[^/?#]+)?(?:[?#]|$)/i);
  if (!dimensions) return '4 / 3';
  const width = Number(dimensions[1]);
  const height = Number(dimensions[2]);
  return width > 0 && height > 0 ? `${width} / ${height}` : '4 / 3';
}

function openCoverPicker(): void {
  if (controlsDisabled.value) return;
  coverInputRef.value?.click();
}

function captureActiveSelection(): { blockId: string; start: number; end: number } | null {
  const activeId = activeTextBlockId.value;
  if (!activeId) return null;
  const block = props.modelValue.blocks.find((entry): entry is Extract<PublishArticleBlock, { type: 'text' }> => entry.id === activeId && entry.type === 'text');
  if (!block) return null;
  const textarea = textAreaRefs.get(activeId);
  const saved = savedSelections.get(activeId);
  const start = textarea?.selectionStart ?? saved?.start ?? block.text.length;
  const end = textarea?.selectionEnd ?? saved?.end ?? start;
  return { blockId: activeId, start, end };
}

function openImagePicker(): void {
  if (controlsDisabled.value) return;
  // 先保存最近活跃段落与光标，再打开原生文件选择器；父级也可通过 expose 调用此方法。
  pendingImageInsertion.value = captureActiveSelection();
  imageInputRef.value?.click();
}

async function handleCoverSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || props.disabled) return;

  errorMessage.value = '';
  isPreparingCover.value = true;
  try {
    const cover = await preparePublishImage(file);
    if (cover.liveEnabled && !cover.liveVideo) cover.liveEnabled = false;
    if (!props.disabled) emitState({ cover });
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '读取题图失败，请重新选择图片');
  } finally {
    isPreparingCover.value = false;
  }
}

async function handleImagesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (!files.length || props.disabled) return;

  errorMessage.value = '';
  const insertion = pendingImageInsertion.value;
  pendingImageInsertion.value = null;
  isPreparingImages.value = true;
  const prepared: PublishImage[] = [];
  try {
    for (const file of files) {
      try {
        // 顺序解析以保留选择顺序；preparePublishImage 会保留 file、预览、URL 与 Live Photo 字段。
        const image = await preparePublishImage(file);
        if (image.liveEnabled && !image.liveVideo) image.liveEnabled = false;
        prepared.push(image);
      } catch (error) {
        errorMessage.value = getErrorMessage(error, '有图片读取失败，其他图片仍会保留');
      }
    }
    if (prepared.length && !props.disabled) insertPreparedImages(prepared, insertion);
  } finally {
    isPreparingImages.value = false;
  }
}

function insertPreparedImages(images: PublishImage[], insertion: { blockId: string; start: number; end: number } | null): void {
  const blocks = [...props.modelValue.blocks];
  const insertionIndex = insertion ? blocks.findIndex((block) => block.id === insertion.blockId && block.type === 'text') : -1;
  const imageBlocks = images.map(makeImageBlock);

  if (insertionIndex >= 0) {
    const current = blocks[insertionIndex] as Extract<PublishArticleBlock, { type: 'text' }>;
    const start = clamp(insertion?.start ?? current.text.length, 0, current.text.length);
    const end = clamp(insertion?.end ?? start, start, current.text.length);
    const before = current.text.slice(0, start);
    const after = current.text.slice(end);
    const followingText = makeTextBlock(after);
    const replacement: PublishArticleBlock[] = [];
    if (before) replacement.push({ ...current, text: before });
    replacement.push(...imageBlocks, followingText);
    blocks.splice(insertionIndex, 1, ...replacement);
    emitState({ blocks });
    activeTextBlockId.value = followingText.id;
    savedSelections.set(followingText.id, { start: 0, end: 0 });
    void focusTextBlock(followingText.id, 0);
    return;
  }

  const followingText = makeTextBlock();
  blocks.push(...imageBlocks, followingText);
  emitState({ blocks });
  activeTextBlockId.value = followingText.id;
  savedSelections.set(followingText.id, { start: 0, end: 0 });
  void focusTextBlock(followingText.id, 0);
}

function removeCover(): void {
  if (controlsDisabled.value) return;
  emitState({ cover: null });
}

function updateTitle(event: Event): void {
  emitState({ title: (event.target as HTMLInputElement).value });
}

function textBlockNumber(blockIndex: number): number {
  return props.modelValue.blocks.slice(0, blockIndex + 1).filter((block) => block.type === 'text').length;
}

function imageBlockNumber(blockIndex: number): number {
  return props.modelValue.blocks.slice(0, blockIndex + 1).filter((block) => block.type === 'image').length;
}

function autoGrow(textarea: HTMLTextAreaElement, minHeight = 44): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
}

function setTextAreaRef(id: string, element: unknown): void {
  if (element instanceof HTMLTextAreaElement) {
    textAreaRefs.set(id, element);
    const firstBlock = props.modelValue.blocks[0];
    autoGrow(element, firstBlock?.id === id && firstBlock.type === 'text' && !firstBlock.text ? 180 : 44);
  } else {
    textAreaRefs.delete(id);
  }
}

function rememberSelection(id: string, event: Event): void {
  const textarea = event.currentTarget as HTMLTextAreaElement;
  if (!textarea) return;
  activeTextBlockId.value = id;
  savedSelections.set(id, { start: textarea.selectionStart, end: textarea.selectionEnd });
}

function updateText(id: string, event: Event): void {
  const textarea = event.target as HTMLTextAreaElement;
  autoGrow(textarea);
  const index = props.modelValue.blocks.findIndex((block) => block.id === id && block.type === 'text');
  if (index < 0) return;
  rememberSelection(id, event);
  const blocks = [...props.modelValue.blocks];
  const block = blocks[index] as Extract<PublishArticleBlock, { type: 'text' }>;
  blocks[index] = { ...block, text: textarea.value };
  emitState({ blocks });
}

function updateImageDescription(id: string, event: Event): void {
  const input = event.target as HTMLInputElement;
  const index = props.modelValue.blocks.findIndex((block) => block.id === id && block.type === 'image');
  if (index < 0) return;
  const blocks = [...props.modelValue.blocks];
  const block = blocks[index] as Extract<PublishArticleBlock, { type: 'image' }>;
  blocks[index] = { ...block, description: input.value };
  emitState({ blocks });
}

function removeBlock(index: number): void {
  if (controlsDisabled.value || index < 0 || index >= props.modelValue.blocks.length) return;
  const blocks = [...props.modelValue.blocks];
  const [removed] = blocks.splice(index, 1);
  if (removed?.type === 'text') {
    textAreaRefs.delete(removed.id);
    savedSelections.delete(removed.id);
    if (activeTextBlockId.value === removed.id) activeTextBlockId.value = null;
  }
  emitState({ blocks });
}

function moveBlock(index: number, offset: number): void {
  if (controlsDisabled.value) return;
  const target = index + offset;
  if (index < 0 || target < 0 || target >= props.modelValue.blocks.length) return;
  const blocks = [...props.modelValue.blocks];
  blocks.splice(target, 0, blocks.splice(index, 1)[0]);
  emitState({ blocks });
}

function insertTextAtCaret(text: string): void {
  if (!text || controlsDisabled.value) return;
  const blocks = [...props.modelValue.blocks];
  const selected = captureActiveSelection();
  let targetIndex = selected ? blocks.findIndex((block) => block.id === selected.blockId && block.type === 'text') : -1;
  if (targetIndex < 0) targetIndex = findLastTextBlockIndex(blocks);

  if (targetIndex < 0) {
    const created = makeTextBlock(text);
    blocks.push(created);
    emitState({ blocks });
    activeTextBlockId.value = created.id;
    savedSelections.set(created.id, { start: text.length, end: text.length });
    void focusTextBlock(created.id, text.length);
    return;
  }

  const block = blocks[targetIndex] as Extract<PublishArticleBlock, { type: 'text' }>;
  const start = clamp(selected?.start ?? block.text.length, 0, block.text.length);
  const end = clamp(selected?.end ?? start, start, block.text.length);
  const nextText = `${block.text.slice(0, start)}${text}${block.text.slice(end)}`;
  const caret = start + text.length;
  blocks[targetIndex] = { ...block, text: nextText };
  emitState({ blocks });
  activeTextBlockId.value = block.id;
  savedSelections.set(block.id, { start: caret, end: caret });
  void focusTextBlock(block.id, caret);
}

async function focusTextBlock(id: string, caret: number): Promise<void> {
  await nextTick();
  const textarea = textAreaRefs.get(id);
  if (!textarea) return;
  autoGrow(textarea);
  textarea.focus();
  const position = clamp(caret, 0, textarea.value.length);
  textarea.setSelectionRange(position, position);
  savedSelections.set(id, { start: position, end: position });
}

function findLastTextBlockIndex(blocks: PublishArticleBlock[]): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].type === 'text') return index;
  }
  return -1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isPreparing(): boolean {
  return isPreparingCover.value || isPreparingImages.value;
}

defineExpose({ openImagePicker, insertTextAtCaret, isPreparing });
</script>

<style scoped>
.article-composer {
  --composer-accent: var(--brand-primary, #08a05c);
  --composer-border: var(--border-light, #e8e9ed);
  --composer-muted: var(--text-tertiary, #858991);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 4px 0 10px;
  color: var(--text-primary, #25272b);
  background: transparent;
}

.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.composer-heading,
.section-heading,
.body-heading,
.cover-preview-actions,
.article-image-block figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cover-section,
.title-section,
.body-section {
  min-width: 0;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 1px dashed var(--border-light, #e2e4e8);
  border-radius: var(--radius-sm, 10px);
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.cover-placeholder:hover:not(:disabled) {
  border-color: var(--composer-accent);
  background: var(--brand-soft, rgba(47, 160, 111, 0.05));
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(47, 160, 111, 0.08);
}

.cover-placeholder:active:not(:disabled) {
  transform: scale(0.99);
}

.cover-placeholder-icon {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--composer-accent);
  background: color-mix(in srgb, var(--composer-accent) 12%, transparent);
  border-radius: 8px;
  font-size: 14px;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cover-placeholder:hover:not(:disabled) .cover-placeholder-icon {
  transform: scale(1.12);
}

.cover-placeholder-copy {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.cover-title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cover-title-group strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.optional-badge {
  padding: 1px 6px;
  color: var(--composer-muted);
  background: var(--background-secondary, #f0f2f5);
  border-radius: 12px;
  font-size: 11px;
}

.cover-placeholder-copy small {
  color: var(--composer-muted);
  font-size: 12px;
}

.cover-placeholder-plus {
  display: grid;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  place-items: center;
  color: var(--composer-accent);
  font-size: 13px;
  transition: transform 0.22s ease;
}

.cover-placeholder:hover:not(:disabled) .cover-placeholder-plus {
  transform: scale(1.15) rotate(90deg);
}

.cover-preview {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-light, #e8e9ed);
  border-radius: 10px;
  background: var(--surface, #fafafa);
  transition: box-shadow 0.2s ease;
}

.cover-preview:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.cover-preview > :deep(.article-cover-preview-image) {
  display: block;
  width: 100%;
  height: 150px;
  max-height: 150px;
  object-fit: cover;
}

.cover-preview-actions {
  min-height: 40px;
  padding: 6px 12px;
  background: var(--surface, #fff);
  border-top: 1px solid var(--border-light, #e8e9ed);
  font-size: 12px;
  color: var(--composer-muted);
}

.cover-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--composer-accent);
  font-weight: 500;
}

.cover-action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cover-action-buttons button,
.block-actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 10px;
  color: var(--text-secondary);
  background: var(--background, #fff);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.cover-action-buttons button:hover:not(:disabled),
.block-actions button:hover:not(:disabled) {
  color: var(--composer-accent);
  border-color: var(--composer-accent);
  background: var(--brand-soft);
  transform: translateY(-1px);
}

.cover-action-buttons button.remove-btn:hover:not(:disabled),
.block-actions .remove-block-button:hover:not(:disabled) {
  color: var(--danger, #ef4444);
  border-color: var(--danger, #ef4444);
  background: rgba(239, 68, 68, 0.08);
}

.article-title-input {
  display: block;
  width: 100%;
  min-height: 46px;
  padding: 10px 2px;
  color: var(--text-primary);
  background: transparent;
  border: 0;
  border-bottom: 1.5px solid var(--border-light, #e8e9ed);
  border-radius: 0;
  font: inherit;
  font-size: 20px;
  font-weight: 600;
  transition: border-color 0.22s ease;
}

.article-title-input:focus {
  outline: none;
  border-bottom-color: var(--composer-accent);
}

.article-title-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
}

.body-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.body-image-bar {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.body-image-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 500;
}

.article-block-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.article-block {
  min-width: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.article-block:focus-within {
  border: none;
  box-shadow: none;
}

.article-text-block {
  display: block;
  width: 100%;
  min-height: 44px;
  resize: none;
  overflow-y: hidden;
  padding: 8px 2px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 15px;
  line-height: 1.8;
  box-shadow: none;
}

.article-text-block:focus {
  outline: none;
  border: none;
  box-shadow: none;
}

.article-text-block::placeholder {
  color: var(--text-tertiary);
  font-size: 14px;
}

.article-image-block {
  overflow: hidden;
  margin: 0;
  background: var(--background-primary, #fff);
  border: 1px solid var(--composer-border);
  border-radius: 9px;
}

.article-image-block > :deep(.article-image-preview) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 520px;
  aspect-ratio: 4 / 3;
  background: #111;
}

.article-image-description {
  display: block;
  width: 100%;
  min-height: 36px;
  margin-top: 8px;
  padding: 6px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
}

.article-image-description::placeholder {
  color: var(--text-tertiary);
}

.article-image-description:focus {
  outline: 0;
  box-shadow: inset 0 -1px var(--composer-accent);
}

.article-image-block figcaption {
  min-height: 48px;
  padding: 6px 10px 6px 12px;
  color: var(--composer-muted);
  font-size: 12px;
}

.article-image-block figcaption small {
  color: var(--composer-accent);
}

.article-preserved-block {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 16px;
  border: 1px dashed var(--composer-border);
  border-radius: 10px;
  background: var(--surface, #fff);
  color: var(--composer-muted);
}

.article-preserved-block > span { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.article-preserved-block > small { flex: 1; color: var(--composer-muted); }
.article-preserved-block .block-actions { margin-left: auto; }

.block-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.block-actions button {
  display: grid;
  min-width: 34px;
  min-height: 34px;
  padding: 5px;
  place-items: center;
}

.block-actions .remove-block-button {
  color: var(--danger-color, #d54848);
}

.image-preparing-tip { margin: 0; color: var(--composer-muted); font-size: 12px; }

.composer-error {
  margin: -8px 0 0;
  color: var(--danger-color, #c43d3d);
  font-size: 13px;
  line-height: 1.5;
}

button:disabled,
input:disabled,
textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .article-composer {
    gap: 12px;
    padding: 10px 16px;
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .composer-heading-note {
    display: none;
  }

  .cover-placeholder {
    min-height: 42px;
    padding: 6px 12px;
  }

  .cover-preview > :deep(.article-cover-preview-image) {
    height: 150px;
    max-height: 240px;
  }

  .cover-preview-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .cover-preview-actions > div {
    width: 100%;
  }

  .cover-preview-actions button {
    flex: 1;
  }

  .article-title-input {
    font-size: 18px;
    min-height: 40px;
  }

  .article-block {
    padding: 0;
  }

  .article-text-block {
    min-height: 44px;
    font-size: 15px;
  }

  .article-image-block > :deep(.article-image-preview) {
    max-height: 360px;
  }

}
</style>
