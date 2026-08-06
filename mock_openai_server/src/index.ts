import express from 'express';
import multer from 'multer';
import { GENERATED_COVER } from './data';
import { processMessages } from './chatHandler';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));

// Middleware to log access details
app.use((req, res, next) => {
  if (req.url !== '/health' && req.url !== '/reset') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Add route to reset state for tests
app.post('/reset', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Vision chat completion extracting item data from the submitted photos
app.post('/chat/completions', (req, res) => {
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
app.post('/images/edits', upload.any(), (req, res) => {
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
