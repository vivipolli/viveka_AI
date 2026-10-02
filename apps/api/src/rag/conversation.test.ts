import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeStreamToken,
  createStreamParseState,
  parseChatResponse,
  resolveSourcesFromIndices,
} from "./citation-parser.js";
import {
  buildPrompt,
  buildRetrievalQuery,
  shouldEnrichRetrieval,
  topicAnchorTexts,
} from "./prompt-builder.js";
import { cosineSimilarity } from "./similarity.js";
import type { ScoredChunk } from "./retriever.js";
import { formatConversationHistory } from "../prompts/system.js";

function unitVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return values.map((value) => value / norm);
}

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

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = unitVector([1, 2, 3]);
    assert.equal(Number(cosineSimilarity(a, a).toFixed(6)), 1);
  });

  it("returns ~0 for orthogonal vectors", () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  });
});

describe("shouldEnrichRetrieval (topic continuity)", () => {
  it("enriches when question is close to prior turn", () => {
    const question = unitVector([0.9, 0.1, 0]);
    const prior = unitVector([1, 0, 0]);
    assert.equal(shouldEnrichRetrieval(question, [prior], 0.7), true);
  });

  it("does not enrich when topic changed", () => {
    const question = unitVector([0, 0, 1]);
    const prior = unitVector([1, 0, 0]);
    assert.equal(shouldEnrichRetrieval(question, [prior], 0.7), false);
  });

  it("does not enrich without anchors", () => {
    assert.equal(shouldEnrichRetrieval(unitVector([1, 0]), [], 0.7), false);
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

  it("topicAnchorTexts uses last user and assistant turns", () => {
    const anchors = topicAnchorTexts(history);
    assert.equal(anchors.length, 2);
    assert.match(anchors[0], /Prakrti/);
    assert.match(anchors[1], /sattva/);
  });

  it("buildRetrievalQuery includes prior turns for follow-ups", () => {
    const query = buildRetrievalQuery("explique melhor o sattva", history);
    assert.match(query, /Prakrti/);
    assert.match(query, /explique melhor o sattva/);
  });

  it("buildPrompt embeds previous conversation in the user message", () => {
    const prompt = buildPrompt(
      "explique melhor o sattva",
      [chunk({ content: "Sattva is the sentient force of Prakrti." })],
      history,
    );

    assert.match(prompt.user, /PREVIOUS CONVERSATION/);
    assert.match(prompt.user, /O que e Prakrti/);
    assert.match(prompt.user, /explique melhor o sattva/);
    assert.equal(prompt.history.length, 2);
    assert.equal(prompt.history[0].role, "user");
    assert.equal(prompt.history[1].role, "assistant");
  });

  it("formatConversationHistory keeps turn order", () => {
    const formatted = formatConversationHistory(history);
    const userIdx = formatted.indexOf("User:");
    const assistantIdx = formatted.indexOf("Assistant:");
    assert.ok(userIdx >= 0 && assistantIdx > userIdx);
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
