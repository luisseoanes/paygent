import { HttpResponse, http } from 'msw';

import { apiUrl, networkDelay } from '../utils';

// One handlers file per feature: handlers/<feature>.ts exporting <feature>Handlers.
import { asistenteHandlers } from './asistente';
import { celularHandlers } from './celular';
import { mandatesHandlers } from './mandates';
import { offlineHandlers } from './offline';
// HANDLERS:IMPORT

export const handlers = [
  ...celularHandlers,
  ...mandatesHandlers,
  ...offlineHandlers,
  ...asistenteHandlers,
  // HANDLERS:SPREAD
  http.get(apiUrl('/healthcheck'), async () => {
    await networkDelay();
    return HttpResponse.json({ ok: true });
  }),
];
