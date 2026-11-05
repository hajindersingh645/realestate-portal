import { CONTENT_BLOCK_KEYS, type ContentBlockKey } from '@hanu/contracts';
import { Type } from 'typebox';

export const ContentBlockLink = Type.Object({
  label: Type.String({ minLength: 1, maxLength: 60 }),
  // Site-relative or https only: shown as a link next to a consent tick box. `//host` is another site.
  url: Type.String({ minLength: 1, maxLength: 300, pattern: '^(/(?!/)|https://)' }),
});

export const ContentBlockView = Type.Object({
  id: Type.String({ format: 'uuid' }),
  key: Type.String(),
  locale: Type.String(),
  version: Type.Integer(),
  body: Type.String(),
  links: Type.Array(ContentBlockLink),
  createdAt: Type.String(),
});

export const ContentBlockList = Type.Object({ data: Type.Array(ContentBlockView) });

export const ContentBlockParams = Type.Object({
  key: Type.Unsafe<ContentBlockKey>(Type.String({ enum: [...CONTENT_BLOCK_KEYS] })),
});

export const PublishContentBlockBody = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 4000 }),
    links: Type.Array(ContentBlockLink, { maxItems: 5 }),
  },
  { additionalProperties: false },
);

/** What `/reference` exposes: the current text only. */
export const NoticeView = Type.Object({
  id: Type.String({ format: 'uuid' }),
  version: Type.Integer(),
  body: Type.String(),
  links: Type.Array(ContentBlockLink),
});
