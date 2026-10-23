import api from './axios';

export interface RagResponse {
  answer: string;
  sources: { articleId: number; title: string; relevance: number }[];
  chunksUsed: number;
}

export interface SearchResult {
  articleId: number;
  articleTitle: string;
  chunkText: string;
  similarity: number;
}

export async function askQuestion(question: string): Promise<RagResponse> {
  const res = await api.post('/ai/ask', { question });
  return res.data.data;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  message: string,
  agentId?: string | null,
  history?: ChatTurn[]
): Promise<string> {
  const res = await api.post('/ai/chat', { message, agentId: agentId || undefined, history });
  return res.data.data.reply;
}

export async function semanticSearch(query: string, topK = 5): Promise<SearchResult[]> {
  const res = await api.post('/ai/search', { query, topK });
  return res.data.data;
}

export async function explainIssue(issueId: number): Promise<unknown> {
  const res = await api.post(`/ai/analyze/${issueId}`);
  return res.data.data;
}

export async function getRecommendation(issueId: number): Promise<unknown> {
  const res = await api.get(`/ai/recommendation/issue/${issueId}`);
  return res.data.data;
}
