import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeStreamToken,
  createStreamParseState,
  parseChatResponse,
  resolveSourcesFromIndices,
} from "./citation-parser.js";
import { buildPrompt } from "./prompt-builder.js";
import {
  formatHistoryForResolver,
  parseResolverOutput,
} from "./query-resolver.js";
import type { ScoredChunk } from "./retriever.js";
import { formatConversationHistory } from "../prompts/system.js";

function chunk(partial: Partial<ScoredChunk> & { content: string }): ScoredChunk {
  return {
    id: partial.id ?? "c1",
    documentId: partial.documentId ?? "d1",
    content: partial.content,
    title: partial.title ?? "Book",
    author: partial.author ?? null,
    chapter: partial.chapter ?? null,
    page: partial.page ?? null,
    year: partial.year ?? null,
    type: partial.type ?? "pdf",
    vectorScore: partial.vectorScore ?? 1,
    textScore: partial.textScore ?? 1,
    finalScore: partial.finalScore ?? 1,
  };
}

describe("parseResolverOutput", () => {
  it("rewrites follow-up into a standalone search query", () => {
    const resolved = parseResolverOutput(
      '{"continuesPrevious":true,"searchQuery":"Quais sao os 16 Pontos de Ananda Marga?"}',
      "Quais sao eles?",
    );
    assert.equal(resolved.continuesPrevious, true);
    assert.match(resolved.searchQuery, /16 Pontos/);
  });

  it("keeps a new-topic question unchanged", () => {
    const resolved = parseResolverOutput(
      '{"continuesPrevious":false,"searchQuery":"O que e PROUT?"}',
      "O que e PROUT?",
    );
    assert.equal(resolved.continuesPrevious, false);
    assert.equal(resolved.searchQuery, "O que e PROUT?");
  });

  it("falls back to the original question when JSON is invalid", () => {
    const resolved = parseResolverOutput("not json", "Quais sao eles?");
    assert.equal(resolved.continuesPrevious, false);
    assert.equal(resolved.searchQuery, "Quais sao eles?");
  });
});

describe("formatHistoryForResolver", () => {
  it("keeps user turns intact and truncates long assistant turns", () => {
    const longAnswer = "A".repeat(500);
    const formatted = formatHistoryForResolver(
      [
        { role: "user", content: "quais sao os 16 pontos?" },
        { role: "assistant", content: longAnswer },
        { role: "user", content: "os principais para mulheres" },
      ],
      8,
    );

    assert.match(formatted, /quais sao os 16 pontos\?/);
    assert.match(formatted, /os principais para mulheres/);
    assert.ok(!formatted.includes(longAnswer));
    assert.match(formatted, /…/);
  });
});

describe("conversation history helpers", () => {
  const history = [
    { role: "user" as const, content: "O que e Prakrti?" },
    {
      role: "assistant" as const,
      content: "Prakrti e o principio operativo com sattva, rajah e tamah.",
    },
  ];

  it("buildPrompt puts PREVIOUS before QUESTION before CONTEXT", () => {
    const prompt = buildPrompt(
      "Quais aspectos de Prakrti explicam melhor o sattva?",
      [chunk({ content: "Sattva is the sentient force of Prakrti." })],
      history,
    );

    const previousIdx = prompt.user.indexOf("PREVIOUS CONVERSATION");
    const questionIdx = prompt.user.indexOf("QUESTION");
    const contextIdx = prompt.user.indexOf("CONTEXT");

    assert.ok(previousIdx >= 0);
    assert.ok(questionIdx > previousIdx);
    assert.ok(contextIdx > questionIdx);
    assert.match(prompt.user, /O que e Prakrti/);
    assert.match(prompt.user, /sattva/);
    assert.match(prompt.user, /not found|something else|different subject/i);
    assert.equal(prompt.history.length, 2);
  });

  it("formatConversationHistory keeps turn order", () => {
    const formatted = formatConversationHistory(history);
    const userIdx = formatted.indexOf("User:");
    const assistantIdx = formatted.indexOf("Assistant:");
    assert.ok(userIdx >= 0 && assistantIdx > userIdx);
  });

  it("buildPrompt without history has no PREVIOUS section", () => {
    const prompt = buildPrompt("O que e Prakrti?", [
      chunk({ content: "Prakrti is the operative principle." }),
    ]);
    assert.equal(prompt.user.includes("PREVIOUS CONVERSATION"), false);
    assert.match(prompt.user, /CONTEXT:/);
    assert.match(prompt.user, /QUESTION:/);
  });
});

describe("citation streaming parser", () => {
  it("hides CITATION_JSON from visible tokens and parses sources", () => {
    const state = createStreamParseState();
    const raw =
      "Resposta completa sobre o tema.\n\nCITATION_JSON:{\"usedSources\":[1],\"readingSuggestion\":\"Leia o livro X.\"}";

    let visible = "";
    for (const token of raw.match(/.{1,7}/g) ?? []) {
      const part = consumeStreamToken(state, token);
      if (part) visible += part;
    }

    assert.equal(visible.includes("CITATION_JSON"), false);
    assert.match(visible, /Resposta completa/);

    const parsed = parseChatResponse(state.buffer);
    assert.deepEqual(parsed.usedSourceIndices, [1]);
    assert.match(parsed.readingSuggestion ?? "", /livro X/);
    assert.equal(parsed.answer.includes("CITATION_JSON"), false);
  });

  it("also hides CITATION_JSON when the leading newline is missing", () => {
    const state = createStreamParseState();
    const raw =
      "Resposta sem linha em branco.CITATION_JSON:{\"usedSources\":[2]}";

    let visible = "";
    for (const token of raw.match(/.{1,5}/g) ?? []) {
      const part = consumeStreamToken(state, token);
      if (part) visible += part;
    }

    assert.equal(visible.includes("CITATION_JSON"), false);
    const parsed = parseChatResponse(state.buffer);
    assert.deepEqual(parsed.usedSourceIndices, [2]);
    assert.match(parsed.answer, /Resposta sem linha/);
  });

  it("resolves source indices against retrieved chunks", () => {
    const chunks = [
      chunk({
        documentId: "book-1",
        title: "Ananda Sutram",
        type: "pdf",
        content: "Sattva is the sentient principle.",
        finalScore: 0.9,
      }),
      chunk({
        documentId: "story-1",
        title: "A story",
        type: "story",
        content: "Baba smiled.",
        finalScore: 0.2,
      }),
    ];

    const sources = resolveSourcesFromIndices([1], chunks);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].title, "Ananda Sutram");
    assert.equal(sources[0].type, "pdf");
  });
});

describe("LLM message assembly with history", () => {
  it("places system, history turns, then current RAG user message", () => {
    const prompt = buildPrompt(
      "continue",
      [chunk({ content: "context text" })],
      [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
      ],
    );

    const messages = [
      { role: "system", content: prompt.system },
      ...prompt.history,
      { role: "user", content: prompt.user },
    ];

    assert.equal(messages[0].role, "system");
    assert.equal(messages[1].role, "user");
    assert.equal(messages[1].content, "first question");
    assert.equal(messages[2].role, "assistant");
    assert.equal(messages[3].role, "user");
    assert.match(messages[3].content, /PREVIOUS CONVERSATION/);
    assert.match(messages[3].content, /CONTEXT/);
    assert.match(messages[3].content, /continue/);
  });
});
