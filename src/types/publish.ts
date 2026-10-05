export interface PublishTarget {
  type: 'tag' | 'apk' | 'product_phone';
  id: string;
  title: string;
  logo?: string;
  subTabs?: { pageName: string; title: string; isSubtab?: number; subTabRule?: { min?: string; max?: string; antutuScore?: { min?: string; max?: string }; geekBenchSingleScore?: { min?: string; max?: string }; geekBenchMultiScore?: { min?: string; max?: string }; threeDMarkScore?: { min?: string; max?: string } } }[];
  configRows?: unknown[];
  isOwner?: number;
}

// 仅传递已明确设置的发布选项，重新编辑时由服务端读取原始值。
export interface PublishOptions {
  targetType?: PublishTarget['type'] | '';
  targetId?: string;
  subTypeId?: string;
  subData?: string;
  visibleStatus?: 1 | -1;
  largeCover?: boolean;
  htmlArticle?: boolean;
  messageTitle?: string;
  messageCover?: string;
  originalType?: 0 | 1 | 2 | 3;
  extraUrl?: string;
  dyhId?: string;
  mediaUrl?: string;
  mediaInfo?: string;
}
