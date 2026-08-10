import express from 'express';
import multer from 'multer';
import { GENERATED_COVER } from './data';
import { processMessages } from './chatHandler';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));

/**
 * Forced failure for the next `count` provider calls, so tests can drive
 * the rate limit backoff without a real provider.
 */
type FailWith = {
  status: number;
  count: number;
  retryAfter?: number;
};

type MockConfig = {
  delayMs: number;
  failWith?: FailWith;
};

const NO_CONFIG: MockConfig = { delayMs: 0 };

let config: MockConfig = NO_CONFIG;

const wait = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

// Consumes one forced failure, counting the shared budget down across both
// endpoints so "the next N calls fail" spans a whole import.
const takeForcedFailure = (): FailWith | undefined => {
  const failure = config.failWith;

  if (!failure || failure.count <= 0) {
    return undefined;
  }

  config = { ...config, failWith: { ...failure, count: failure.count - 1 } };

  return failure;
};

const sendForcedFailure = (res: express.Response, failure: FailWith): void => {
  if (failure.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(failure.retryAfter));
  }

  res.status(failure.status).json({
    error: { message: `Injected ${failure.status} failure` },
  });
};

// Middleware to log access details
app.use((req, res, next) => {
  if (req.url !== '/health' && req.url !== '/reset') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Resets state between tests, optionally arming latency or failures for
// the test that follows.
app.post('/reset', (req, res) => {
  config = {
    delayMs: req.body?.delayMs ?? 0,
    failWith: req.body?.failWith,
  };
  res.status(200).json({ status: 'ok' });
});

// Vision chat completion extracting item data from the submitted photos
app.post('/chat/completions', async (req, res) => {
  await wait(config.delayMs);

  const failure = takeForcedFailure();

  if (failure) {
    sendForcedFailure(res, failure);
    return;
  }

  try {
    const result = processMessages(req.body.messages);
    res.status(200).json(result);
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Invalid request format',
      },
    });
  }
});

// Image edit returning the "cleaned" cover thumbnail
app.post('/images/edits', upload.any(), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  console.log(
    'Received image edit request with prompt:',
    req.body.prompt,
    'model:',
    req.body.model,
    'files:',
    files?.map((file) => file.fieldname),
    'fields:',
    Object.keys(req.body)
  );

  await wait(config.delayMs);

  const failure = takeForcedFailure();

  if (failure) {
    sendForcedFailure(res, failure);
    return;
  }

  // The OpenAI Java SDK may send the image part without a filename, in
  // which case multer surfaces it as a body field instead of a file.
  const hasImage =
    files?.some((file) => file.fieldname.startsWith('image')) ||
    Object.keys(req.body).some((field) => field.startsWith('image'));

  if (!hasImage) {
    res.status(400).json({ error: { message: 'No image submitted' } });
    return;
  }

  res.status(200).json({
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: GENERATED_COVER }],
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3070;
app.listen(PORT, () => {
  console.log(`Mock OpenAI server is running on port ${PORT}`);
});
