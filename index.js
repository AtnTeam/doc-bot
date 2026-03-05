import 'dotenv/config';
import { Telegraf } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

import { initRAG, rebuildIndex, search, createLLM } from './src/rag.js';
import { logger } from './src/logger.js';
import { createServer } from './src/server/index.js';
import {
  dbUpsertUser,
  dbGetUser,
  dbGetUserAccess,
} from './src/database.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = process.env.PORT || 3100;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}
if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set in .env');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.join(__dirname, 'docs');

// ── RAG ──
console.log('📄 Loading documentation...');
await initRAG(docsDir);

const llm = createLLM(OPENROUTER_API_KEY);

// ── Express admin API ──
const app = createServer(docsDir, async () => {
  console.log('🔄 Rebuilding vector index...');
  await rebuildIndex(docsDir);
  console.log('✅ Vector index rebuilt');
});

app.listen(PORT, () => {
  console.log(`🌐 Admin API running on http://localhost:${PORT}`);
});

// ── Helpers ──

function keepTyping(ctx) {
  ctx.sendChatAction('typing').catch(() => {});
  const interval = setInterval(() => {
    ctx.sendChatAction('typing').catch(() => {});
  }, 4000);
  return () => clearInterval(interval);
}

function formatTime(ms) {
  return ms < 1000 ? `${ms} мс` : `${(ms / 1000).toFixed(1)} сек`;
}

// ── Telegram bot ──
const bot = new Telegraf(BOT_TOKEN);

function ensureUser(ctx) {
  const { id, username, first_name } = ctx.from;
  return dbUpsertUser(id, username || '', first_name || '');
}

bot.start((ctx) => {
  const user = ensureUser(ctx);

  if (!user.isApproved) {
    return ctx.reply(
      '👋 Привет!\n\n' +
        'Твой запрос на доступ получен. Ожидай подтверждения от администратора.\n\n' +
        'После одобрения ты сможешь задавать вопросы по внутренней документации команды.'
    );
  }

  return ctx.reply(
    '👋 Привет! Я ассистент.\n\n' +
      'Задавай вопросы по внутренней документации — я найду ответ.\n\n' +
      '💡 /help — справка'
  );
});

bot.help((ctx) => {
  const user = ensureUser(ctx);
  if (!user.isApproved) {
    return ctx.reply('Твой доступ ещё не подтверждён. Обратись к администратору.');
  }

  return ctx.reply(
    '📖 Как пользоваться ботом:\n\n' +
      'Просто напиши свой вопрос текстом — я найду ответ в документации команды.\n\n' +
      '💡 Примеры вопросов:\n' +
      '• Как проходит онбординг?\n' +
      '• Когда выплаты?\n' +
      '• Какие правила нейминга кампаний?\n\n' +
      '📌 /help — эта справка'
  );
});

bot.command('docs', (ctx) => {
  const user = ensureUser(ctx);
  if (!user.isApproved) {
    return ctx.reply('Твой доступ ещё не подтверждён. Обратись к администратору.');
  }

  const files = dbGetUserAccess(user.telegramId);
  if (files.length === 0) {
    return ctx.reply('Тебе пока не назначены документы. Обратись к администратору.');
  }

  const list = files.map((f, i) => `${i + 1}. ${f}`).join('\n');
  return ctx.reply(`📄 Доступные тебе документы:\n\n${list}`);
});

bot.on('text', async (ctx) => {
  const user = ensureUser(ctx);

  if (!user.isApproved) {
    return ctx.reply(
      '🔒 Твой доступ ещё не подтверждён.\nОбратись к администратору.'
    );
  }

  const allowedFiles = dbGetUserAccess(user.telegramId);
  if (allowedFiles.length === 0) {
    return ctx.reply(
      '📭 Тебе пока не назначены документы для работы.\nОбратись к администратору.'
    );
  }

  const question = ctx.message.text;
  const startTime = Date.now();

  const entry = logger.create({
    userId: ctx.from.id,
    username: ctx.from.username || ctx.from.first_name,
    question,
  });

  const stopTyping = keepTyping(ctx);
  const statusMsg = await ctx.reply('🔍 Ищу в документации...');

  try {
    // RAG search
    const ragStart = Date.now();
    const ragResults = await search(question, 3, allowedFiles);
    const ragTime = Date.now() - ragStart;

    logger.update(entry.id, {
      ragResults,
      timings: { rag: ragTime },
    });

    const context = ragResults
      .map(
        (r, i) =>
          `Фрагмент ${i + 1} (из ${r.filename}, score: ${r.score.toFixed(3)}):\n${r.content}`
      )
      .join('\n\n');

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      '🤖 Генерирую ответ...'
    );

    // Prompt
    const prompt = `
Ты — внутренний ассистент арбитражной команды.
Отвечай КРАТКО, по делу, ДРУЖЕЛЮБНО и на РУССКОМ ЯЗЫКЕ.
Используй ТОЛЬКО информацию из КОНТЕКСТА ниже.
Если ответа в контексте нет — честно скажи: "В документации этого нет".

КОНТЕКСТ:
${context}

ВОПРОС: ${question}

ОТВЕТ:`.trim();

    logger.update(entry.id, { prompt });

    // AI request
    const aiStart = Date.now();
    const response = await llm.invoke([{ role: 'user', content: prompt }]);
    const aiTime = Date.now() - aiStart;

    const answer =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c) => c.text || '').join('\n')
          : 'Не удалось получить ответ от модели.';

    const totalTime = Date.now() - startTime;

    logger.update(entry.id, {
      aiResponse: response.content,
      finalAnswer: answer,
      timings: { rag: ragTime, ai: aiTime, total: totalTime },
      status: 'completed',
    });

    stopTyping();

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      answer
    );
  } catch (err) {
    stopTyping();
    const totalTime = Date.now() - startTime;
    console.error('❌ Error:', err.message);

    const current = logger.getById(entry.id);
    logger.update(entry.id, {
      error: err.message,
      timings: { ...(current?.timings || {}), total: totalTime },
      status: 'error',
    });

    await ctx.telegram
      .editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        '❌ Произошла ошибка при обработке запроса. Попробуй ещё раз через пару минут.'
      )
      .catch(() => {});
  }
});

bot.launch().then(() => console.log('🚀 Bot launched!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
