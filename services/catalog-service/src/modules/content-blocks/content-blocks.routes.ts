import { actorOf, ErrorBody, type App, type Orm, type ServiceConfig } from '@hanu/service-kit';
import {
  ContentBlockList,
  ContentBlockParams,
  ContentBlockView,
  PublishContentBlockBody,
} from './content-blocks.schemas.js';
import { listContentBlocks, publishContentBlock } from './content-blocks.service.js';

const PERMISSION = 'admin.settings.manage';

export function registerContentBlockRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; platform: ServiceConfig['platform'] },
): void {
  app.get(
    '/admin/content-blocks',
    {
      config: { permission: PERMISSION },
      schema: { response: { 200: ContentBlockList, 401: ErrorBody, 403: ErrorBody } },
    },
    async () => ({ data: await listContentBlocks(deps.orm.em.fork(), deps.platform.locale) }),
  );

  app.post(
    '/admin/content-blocks/:key',
    {
      config: { permission: PERMISSION },
      schema: {
        params: ContentBlockParams,
        body: PublishContentBlockBody,
        response: {
          201: ContentBlockView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const view = await publishContentBlock(
        deps.orm.em.fork(),
        actorOf(request, deps.serviceName),
        { key: request.params.key, locale: deps.platform.locale, ...request.body },
      );
      return await reply.status(201).send(view);
    },
  );
}
