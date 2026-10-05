import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPublishDraft, loadPublishDraft, savePublishDraft } from '../publishDrafts';
import { saveFullPublishDraft, listFullPublishDrafts, restoreFullPublishDraft, deleteFullPublishDraft, type PublishDraftState } from '../publishDrafts';

describe('publishDrafts', () => {
  beforeEach(async () => {
    await clearPublishDraft('100');
    await clearPublishDraft('200');
  });

  it('按账号保存和读取动态草稿', async () => {
    await savePublishDraft('100', '动态草稿');
    await savePublishDraft('200', '另一个账号的草稿');
    expect(await loadPublishDraft('100')).toBe('动态草稿');
    expect(await loadPublishDraft('200')).toBe('另一个账号的草稿');
  });

  it('空内容会清除动态草稿', async () => {
    await savePublishDraft('100', '待清除');
    await savePublishDraft('100', '   ');
    expect(await loadPublishDraft('100')).toBe('');
  });
});

describe('多篇完整草稿', () => {
  const state: PublishDraftState = { text: '图文草稿', images: [], target: { id: '7', type: 'product_phone', title: '产品', subTabs: [{ pageName: '1', title: '续航' }] }, productOptions: { subTypeId: '1', subData: '8.5' }, visibleStatus: -1, largeCover: true, extraOptions: { originalType: 2, dyhId: '9', extraUrl: '/goods/detail?id=8' }, attachmentTitle: '商品' };
  it('多篇保存与删除互不覆盖，不混用账号', async () => {
    await saveFullPublishDraft('full-1', 'first', state);
    await saveFullPublishDraft('full-1', 'second', { ...state, text: '第二篇' });
    expect(await listFullPublishDrafts('full-1')).toHaveLength(2);
    expect(await listFullPublishDrafts('full-2')).toEqual([]);
    await deleteFullPublishDraft('full-1', 'first');
    expect((await listFullPublishDrafts('full-1')).map((draft) => draft.id)).toEqual(['second']);
  });
  it('恢复媒体原始字节、实况开关和全部发布选项', async () => {
    const image = new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 });
    const video = new File(['video-bytes'], 'live.mp4', { type: 'video/mp4', lastModified: 2 });
    await saveFullPublishDraft('media-1', 'media', { ...state, images: [{ file: image, preview: '封面', liveVideo: video, liveEnabled: true }] });
    const restored = restoreFullPublishDraft((await listFullPublishDrafts('media-1'))[0]);
    expect(restored.target).toEqual(state.target);
    expect(restored.productOptions).toEqual(state.productOptions);
    expect(restored.visibleStatus).toBe(-1);
    expect(restored.extraOptions).toEqual(state.extraOptions);
    expect(restored.images[0].file?.name).toBe('photo.jpg');
    expect(restored.images[0].file?.size).toBe(image.size);
    expect(restored.images[0].liveVideo?.size).toBe(video.size);
    expect(restored.images[0].liveEnabled).toBe(true);
  });
  it('迁移旧版文字草稿并在删除后不复活', async () => {
    await savePublishDraft('legacy-1', '旧版正文');
    const migrated = await listFullPublishDrafts('legacy-1');
    expect(migrated[0].state.text).toBe('旧版正文');
    expect(await loadPublishDraft('legacy-1')).toBe('');
    await deleteFullPublishDraft('legacy-1', migrated[0].id);
    expect(await listFullPublishDrafts('legacy-1')).toEqual([]);
  });
  it('普通视频草稿保留原文件、封面与上传结果，恢复后重新生成预览地址', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:restored');
    const file = new File(['original-video'], 'clip.mov', { type: 'video/quicktime' }), cover = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' });
    await saveFullPublishDraft('video-draft', 'video', { ...state, video: { file, cover, preview: 'blob:expired', coverPreview: '封面', duration: 1234, mediaUrl: 'https://video.example/clip.mov', mediaInfo: '媒体信息' } });
    const stored = (await listFullPublishDrafts('video-draft'))[0];
    expect(stored.state.video).not.toHaveProperty('preview');
    const restored = restoreFullPublishDraft(stored);
    expect(restored.video?.file.name).toBe('clip.mov'); expect(restored.video?.file.size).toBe(file.size); expect(restored.video?.preview).toBe('blob:restored'); expect(restored.video?.duration).toBe(1234); expect(restored.video?.mediaUrl).toBe('https://video.example/clip.mov');
    createUrl.mockRestore();
  });

});
