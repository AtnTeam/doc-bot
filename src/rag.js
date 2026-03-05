import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import { ChatOpenAI } from '@langchain/openai';

class SimpleEmbeddings {
  async embedDocuments(texts) {
    return texts.map((t) => this._hash(t));
  }

  async embedQuery(text) {
    return this._hash(text);
  }

  _hash(text) {
    const vec = new Array(32).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 32] += text.charCodeAt(i);
    }
    const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}

const embeddings = new SimpleEmbeddings();
let vectorStore = null;

function loadMarkdownDocs(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Docs directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  const docs = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      docs.push(...loadMarkdownDocs(fullPath));
    } else if (file.endsWith('.md') || file.endsWith('.txt')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      docs.push(
        new Document({
          pageContent: content,
          metadata: { source: fullPath, filename: file },
        })
      );
    }
  }

  return docs;
}

export async function initRAG(docsDir) {
  const rawDocs = loadMarkdownDocs(docsDir);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const splitDocs = await splitter.splitDocuments(rawDocs);
  vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

  console.log(
    `✅ RAG initialized: ${rawDocs.length} docs, ${splitDocs.length} chunks`
  );
  return { docCount: rawDocs.length, chunkCount: splitDocs.length };
}

export async function rebuildIndex(docsDir) {
  return initRAG(docsDir);
}

export async function search(query, k = 3, allowedFilenames = null) {
  if (!vectorStore) throw new Error('RAG not initialized');

  const searchK = allowedFilenames ? k * 5 : k;
  const results = await vectorStore.similaritySearchWithScore(query, searchK);

  let mapped = results.map(([doc, score]) => ({
    content: doc.pageContent,
    source: doc.metadata.source,
    filename: doc.metadata.filename,
    score,
  }));

  if (allowedFilenames) {
    mapped = mapped.filter((r) => allowedFilenames.includes(r.filename));
  }

  return mapped.slice(0, k);
}

export function createLLM(apiKey) {
  return new ChatOpenAI({
    apiKey,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://your-domain-or-project',
        'X-Title': 'Arbitrage Team Telegram Bot',
      },
    },
    model: 'openrouter/free',
    temperature: 0.2,
    maxTokens: 512,
  });
}
