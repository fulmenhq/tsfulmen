import { describe, expect, it } from "vitest";
import * as similarity from "../index.js";

describe("similarity module integration", () => {
  describe("module exports", () => {
    it("exports all public APIs", () => {
      expect(similarity.VERSION).toBe("2.0.0");
      expect(typeof similarity.distance).toBe("function");
      expect(typeof similarity.score).toBe("function");
      expect(typeof similarity.normalize).toBe("function");
      expect(typeof similarity.casefold).toBe("function");
      expect(typeof similarity.stripAccents).toBe("function");
      expect(typeof similarity.equalsIgnoreCase).toBe("function");
      expect(typeof similarity.suggest).toBe("function");
      expect(typeof similarity.SimilarityError).toBe("function");
    });
  });

  describe("end-to-end workflows", () => {
    it("typo correction workflow", () => {
      const userInput = "docscrib";
      const availableModules = ["docscribe", "crucible", "config", "schema", "logging"];

      const suggestions = similarity.suggest(userInput, availableModules, {
        minScore: 0.7,
        maxSuggestions: 3,
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].value).toBe("docscribe");
      expect(suggestions[0].score).toBeGreaterThan(0.8);
    });

    it("case-insensitive search workflow", () => {
      const query = "TYPESCRIPT";
      const documents = ["TypeScript", "JavaScript", "Python", "Rust"];

      const matches = documents.filter((doc) => similarity.equalsIgnoreCase(query, doc));

      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe("TypeScript");
    });

    it("accent-insensitive comparison workflow", () => {
      const normalized = similarity.normalize("Café München", {
        stripAccents: true,
      });

      expect(normalized).toBe("cafe munchen");
      expect(similarity.equalsIgnoreCase("Café", "cafe", { stripAccents: true })).toBe(true);
    });

    it("CLI command suggestion workflow", () => {
      const typo = "biuld";
      const commands = ["build", "test", "lint", "format", "deploy"];

      const suggestions = similarity.suggest(typo, commands);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].value).toBe("build");
    });

    it("distance-based filtering workflow", () => {
      const reference = "hello";
      const candidates = ["hello", "hallo", "hullo", "world", "goodbye"];

      const closeMatches = candidates.filter((c) => {
        const dist = similarity.distance(reference, c);
        return dist <= 1;
      });

      expect(closeMatches).toContain("hello");
      expect(closeMatches).toContain("hallo");
      expect(closeMatches).toContain("hullo");
      expect(closeMatches).not.toContain("world");
      expect(closeMatches).not.toContain("goodbye");
    });
  });

  describe("cross-function integration", () => {
    it("normalize + score workflow", () => {
      const a = "  HELLO  ";
      const b = "hello";

      const directScore = similarity.score(a, b);
      const normalizedScore = similarity.score(similarity.normalize(a), similarity.normalize(b));

      expect(directScore).toBeLessThan(1.0);
      expect(normalizedScore).toBe(1.0);
    });

    it("stripAccents + distance workflow", () => {
      const a = "café";
      const b = "cafe";

      const withAccents = similarity.distance(a, b);
      const withoutAccents = similarity.distance(
        similarity.stripAccents(a),
        similarity.stripAccents(b),
      );

      expect(withAccents).toBe(1);
      expect(withoutAccents).toBe(0);
    });

    it("normalize + suggest workflow", () => {
      const input = "  DOCSCRIBE  ";
      const candidates = ["docscribe", "crucible", "config"];

      const suggestions = similarity.suggest(input, candidates, {
        normalize: true,
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score).toBe(1.0);
    });
  });

  describe("error handling integration", () => {
    it("SimilarityError is properly typed", () => {
      const error = new similarity.SimilarityError("Test error");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(similarity.SimilarityError);
      expect(error.name).toBe("SimilarityError");
      expect(error.catalog).toBe("similarity");
    });
  });

  describe("real-world use cases", () => {
    it("fuzzy file search", () => {
      const query = "config";
      const files = ["config.ts", "config.json", "package.json", "tsconfig.json", "README.md"];

      const results = similarity.suggest(query, files, { minScore: 0.6 }).map((s) => s.value);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatch(/config/);
    });

    it("spell checker", () => {
      const misspelled = "recieve";
      const dictionary = ["receive", "perceive", "deceive", "believe"];

      const corrections = similarity.suggest(misspelled, dictionary, {
        maxSuggestions: 3,
        minScore: 0.7,
      });

      expect(corrections.length).toBeGreaterThan(0);
      const values = corrections.map((c) => c.value);
      expect(values).toContain("receive");
    });

    it("module name autocomplete", () => {
      const partial = "docscrib";
      const modules = ["docscribe", "document-processor", "docker-utils", "config", "logger"];

      const completions = similarity.suggest(partial, modules, {
        minScore: 0.6,
        maxSuggestions: 5,
      });

      expect(completions.length).toBeGreaterThan(0);
      expect(completions[0].value).toBe("docscribe");
    });
  });
});
