import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { prisma } from '../../core/database/prisma.js';
import { decrypt } from '../../core/auth/encryption.js';
import { AIProviderError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

// Check if an API key is a real key (not a placeholder from .env.example)
function isRealApiKey(key: string | undefined): boolean {
  return !!key && key.length > 30 && !key.includes('your-');
}

// System-level clients (from env vars) - skip placeholder keys
const systemOpenai = isRealApiKey(config.ai.openaiApiKey)
  ? new OpenAI({ apiKey: config.ai.openaiApiKey! })
  : null;

const systemAnthropic = isRealApiKey(config.ai.anthropicApiKey)
  ? new Anthropic({ apiKey: config.ai.anthropicApiKey! })
  : null;

// Cache for per-user clients (userId -> { clients, timestamp })
const clientCache = new Map<string, {
  anthropic: Anthropic | null;
  openai: OpenAI | null;
  defaultProvider: 'anthropic' | 'openai';
  timestamp: number;
}>();

// Short TTL to pick up key changes across processes (API server vs worker)
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

interface AiClients {
  anthropic: Anthropic | null;
  openai: OpenAI | null;
  defaultProvider: 'anthropic' | 'openai';
}

async function getAiClients(userId?: string): Promise<AiClients> {
  if (!userId) {
    return {
      anthropic: systemAnthropic,
      openai: systemOpenai,
      defaultProvider: systemAnthropic ? 'anthropic' : 'openai',
    };
  }

  // Check cache
  const cached = clientCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  // Load user settings and role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true, role: true },
  });

  const settings = (user?.settings || {}) as Record<string, unknown>;
  const defaultProvider = (settings.aiDefaultProvider as 'anthropic' | 'openai') || 'anthropic';
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  let userAnthropic: Anthropic | null = null;
  let userOpenai: OpenAI | null = null;

  // Try user's own keys first, fall back to system for admin users only
  if (settings.anthropicApiKey) {
    try {
      const key = decrypt(settings.anthropicApiKey as string);
      userAnthropic = new Anthropic({ apiKey: key });
    } catch (err) {
      logger.warn({ userId }, 'Failed to decrypt user Anthropic API key');
    }
  }
  if (!userAnthropic && isAdmin) {
    userAnthropic = systemAnthropic;
  }

  if (settings.openaiApiKey) {
    try {
      const key = decrypt(settings.openaiApiKey as string);
      userOpenai = new OpenAI({ apiKey: key });
    } catch (err) {
      logger.warn({ userId }, 'Failed to decrypt user OpenAI API key');
    }
  }
  if (!userOpenai && isAdmin) {
    userOpenai = systemOpenai;
  }

  const result = {
    anthropic: userAnthropic,
    openai: userOpenai,
    defaultProvider,
    timestamp: Date.now(),
  };

  clientCache.set(userId, result);
  return result;
}

// Invalidate cache when user updates settings
export function invalidateAiClientCache(userId: string): void {
  clientCache.delete(userId);
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface ImageAnalysisResult {
  description: string;
  text?: string;
  objects?: string[];
  labels?: string[];
  confidence?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: {
    language?: string;
    prompt?: string;
    userId?: string;
  }
): Promise<TranscriptionResult> {
  const clients = await getAiClients(options?.userId);

  if (!clients.openai) {
    throw new AIProviderError('openai', 'OpenAI API key not configured. Please add your OpenAI API key in Settings → AI Providers.');
  }

  try {
    const file = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

    const response = await clients.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: options?.language,
      prompt: options?.prompt,
      response_format: 'verbose_json',
    });

    return {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'OpenAI transcription failed');
    throw new AIProviderError('openai', (error as Error).message);
  }
}

export async function translateAudio(
  audioBuffer: Buffer,
  options?: {
    prompt?: string;
    userId?: string;
  }
): Promise<TranscriptionResult> {
  const clients = await getAiClients(options?.userId);

  if (!clients.openai) {
    throw new AIProviderError('openai', 'OpenAI API key not configured. Please add your OpenAI API key in Settings → AI Providers.');
  }

  try {
    const file = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

    const response = await clients.openai.audio.translations.create({
      file,
      model: 'whisper-1',
      prompt: options?.prompt,
      response_format: 'verbose_json',
    });

    return {
      text: response.text,
      language: 'en',
      duration: response.duration,
      segments: response.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'OpenAI translation failed');
    throw new AIProviderError('openai', (error as Error).message);
  }
}

export async function analyzeImageWithOpenAI(
  imageBuffer: Buffer,
  prompt: string,
  options?: {
    maxTokens?: number;
    userId?: string;
  }
): Promise<ImageAnalysisResult> {
  const clients = await getAiClients(options?.userId);

  if (!clients.openai) {
    throw new AIProviderError('openai', 'OpenAI API key not configured. Please add your OpenAI API key in Settings → AI Providers.');
  }

  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await clients.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: options?.maxTokens || 1024,
    });

    const text = response.choices[0]?.message?.content || '';

    return {
      description: text,
    };
  } catch (error) {
    logger.error({ error }, 'OpenAI image analysis failed');
    throw new AIProviderError('openai', (error as Error).message);
  }
}

export async function analyzeImageWithAnthropic(
  imageBuffer: Buffer,
  prompt: string,
  options?: {
    maxTokens?: number;
    userId?: string;
    mimeType?: string;
  }
): Promise<ImageAnalysisResult> {
  const clients = await getAiClients(options?.userId);

  if (!clients.anthropic) {
    throw new AIProviderError('anthropic', 'Anthropic API key not configured. Please add your Anthropic API key in Settings → AI Providers.');
  }

  try {
    const base64Image = imageBuffer.toString('base64');
    const mediaType = (options?.mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const response = await clients.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: options?.maxTokens || 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    return {
      description: text,
    };
  } catch (error) {
    logger.error({ error }, 'Anthropic image analysis failed');
    throw new AIProviderError('anthropic', (error as Error).message);
  }
}

export async function extractTextFromImage(
  imageBuffer: Buffer,
  options?: { provider?: 'openai' | 'anthropic'; userId?: string; mimeType?: string }
): Promise<string> {
  const prompt = `You are an OCR engine. Your task is to extract ALL text exactly as it appears in this image.

Rules:
- Output ONLY the raw text found in the image, nothing else
- Preserve the original formatting, line breaks, and structure
- Do NOT add descriptions, commentary, or explanations about the image
- Do NOT add labels like "Title:", "Header:", etc. unless they appear in the image
- If text appears in columns, preserve the column layout
- If text appears in tables, preserve the table structure using spacing
- If no text is found at all, output exactly: No text found in image.`;

  const clients = await getAiClients(options?.userId);
  const provider = options?.provider || clients.defaultProvider;

  if (provider === 'anthropic' && clients.anthropic) {
    const result = await analyzeImageWithAnthropic(imageBuffer, prompt, {
      userId: options?.userId,
      mimeType: options?.mimeType,
      maxTokens: 4096,
    });
    return result.description;
  }

  if (clients.openai) {
    const result = await analyzeImageWithOpenAI(imageBuffer, prompt, {
      userId: options?.userId,
      maxTokens: 4096,
    });
    return result.description;
  }

  throw new AIProviderError('none', 'No AI provider configured. Please add an API key in Settings → AI Providers.');
}

export async function describeImage(
  imageBuffer: Buffer,
  options?: {
    provider?: 'openai' | 'anthropic';
    detail?: 'brief' | 'detailed';
    userId?: string;
    mimeType?: string;
  }
): Promise<string> {
  const detail = options?.detail || 'detailed';
  const prompt =
    detail === 'brief'
      ? 'Describe this image in 1-2 sentences.'
      : 'Provide a detailed description of this image, including the main subjects, setting, colors, mood, and any notable details.';

  const clients = await getAiClients(options?.userId);
  const provider = options?.provider || clients.defaultProvider;

  if (provider === 'anthropic' && clients.anthropic) {
    const result = await analyzeImageWithAnthropic(imageBuffer, prompt, {
      userId: options?.userId,
      mimeType: options?.mimeType,
    });
    return result.description;
  }

  if (clients.openai) {
    const result = await analyzeImageWithOpenAI(imageBuffer, prompt, { userId: options?.userId });
    return result.description;
  }

  throw new AIProviderError('none', 'No AI provider configured. Please add an API key in Settings → AI Providers.');
}

export function isOpenAIConfigured(): boolean {
  return systemOpenai !== null;
}

export function isAnthropicConfigured(): boolean {
  return systemAnthropic !== null;
}
