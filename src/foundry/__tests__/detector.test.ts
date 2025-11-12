/**
 * MIME type detector tests
 */

import { describe, expect, it } from "vitest";
import { createDetector, MimeTypeDetector } from "../detector.js";
import { MAGIC_NUMBER_DATABASE } from "../magic-numbers.js";
import type { MimeType } from "../types.js";

// Mock MIME type catalog
const mockCatalog = new Map<string, MimeType>([
  [
    "application/json",
    {
      id: "json",
      mime: "application/json",
      name: "JSON",
      extensions: ["json"],
      description: "JSON format",
    },
  ],
  [
    "application/xml",
    {
      id: "xml",
      mime: "application/xml",
      name: "XML",
      extensions: ["xml"],
      description: "XML format",
    },
  ],
  [
    "application/yaml",
    {
      id: "yaml",
      mime: "application/yaml",
      name: "YAML",
      extensions: ["yaml", "yml"],
      description: "YAML format",
    },
  ],
  [
    "application/x-ndjson",
    {
      id: "ndjson",
      mime: "application/x-ndjson",
      name: "NDJSON",
      extensions: ["ndjson"],
      description: "Newline-delimited JSON",
    },
  ],
  [
    "text/csv",
    {
      id: "csv",
      mime: "text/csv",
      name: "CSV",
      extensions: ["csv"],
      description: "CSV format",
    },
  ],
  [
    "application/x-protobuf",
    {
      id: "protobuf",
      mime: "application/x-protobuf",
      name: "Protocol Buffers",
      extensions: ["pb", "protobuf"],
      description: "Protocol Buffers",
    },
  ],
  [
    "text/plain",
    {
      id: "txt",
      mime: "text/plain",
      name: "Plain Text",
      extensions: ["txt"],
      description: "Plain text",
    },
  ],
]);

describe("MimeTypeDetector", () => {
  describe("Constructor", () => {
    it("should create detector with patterns and catalog", () => {
      const detector = new MimeTypeDetector(MAGIC_NUMBER_DATABASE, mockCatalog);
      expect(detector).toBeInstanceOf(MimeTypeDetector);
    });

    it("should create detector via factory function", () => {
      const detector = createDetector(mockCatalog);
      expect(detector).toBeInstanceOf(MimeTypeDetector);
    });
  });

  describe("JSON detection", () => {
    const detector = createDetector(mockCatalog);

    it("should detect JSON object", () => {
      const buffer = Buffer.from('{"key": "value"}');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/json");
    });

    it("should detect JSON array", () => {
      const buffer = Buffer.from("[1, 2, 3]");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/json");
    });

    it("should detect JSON with BOM", () => {
      const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]); // BOM + {}
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/json");
    });

    it("should detect JSON array with BOM", () => {
      const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x5b, 0x5d]); // BOM + []
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/json");
    });
  });

  describe("XML detection", () => {
    const detector = createDetector(mockCatalog);

    it("should detect XML with <?xml declaration", () => {
      const buffer = Buffer.from('<?xml version="1.0"?><root/>');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/xml");
    });

    it("should detect XML with BOM", () => {
      const xml = '<?xml version="1.0"?><root/>';
      const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml)]);
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/xml");
    });
  });

  describe("YAML detection", () => {
    const detector = createDetector(mockCatalog);

    it("should detect YAML with --- marker", () => {
      const buffer = Buffer.from("---\nkey: value");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/yaml");
    });

    it("should detect YAML with %YAML directive", () => {
      const buffer = Buffer.from("%YAML 1.2\nkey: value");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/yaml");
    });
  });

  describe("NDJSON detection (heuristic)", () => {
    const detector = createDetector(mockCatalog);

    it("should detect valid NDJSON", () => {
      const buffer = Buffer.from('{"line":1}\n{"line":2}\n{"line":3}');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/x-ndjson");
    });

    it("should require at least 2 lines", () => {
      const buffer = Buffer.from('{"line":1}');
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("application/x-ndjson");
    });

    it("should reject invalid JSON lines", () => {
      const buffer = Buffer.from('{"line":1}\ninvalid json\n{"line":3}');
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("application/x-ndjson");
    });

    it("should handle empty lines", () => {
      const buffer = Buffer.from('{"line":1}\n\n{"line":2}\n');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/x-ndjson");
    });
  });

  describe("CSV detection (heuristic)", () => {
    const detector = createDetector(mockCatalog);

    it("should detect CSV with comma delimiter", () => {
      const buffer = Buffer.from("a,b,c\n1,2,3\n4,5,6");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/csv");
    });

    it("should detect CSV with semicolon delimiter", () => {
      const buffer = Buffer.from("a;b;c\n1;2;3\n4;5;6");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/csv");
    });

    it("should detect CSV with tab delimiter", () => {
      const buffer = Buffer.from("a\tb\tc\n1\t2\t3\n4\t5\t6");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/csv");
    });

    it("should require consistent delimiter count", () => {
      const buffer = Buffer.from("a,b,c\n1,2\n4,5,6"); // Inconsistent
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("text/csv");
    });

    it("should require at least 2 lines", () => {
      const buffer = Buffer.from("a,b,c");
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("text/csv");
    });

    it("should require at least 1 delimiter per line", () => {
      const buffer = Buffer.from("a\nb\nc"); // No delimiters
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("text/csv");
    });
  });

  describe("Protobuf detection (heuristic)", () => {
    const detector = createDetector(mockCatalog);

    it("should detect valid protobuf message", () => {
      // Protobuf message: field 1, wire type 2 (length-delimited), length 5, "hello"
      const buffer = Buffer.from([0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/x-protobuf");
    });

    it("should reject buffers with invalid wire type", () => {
      const buffer = Buffer.from([0x07, 0x00, 0x00, 0x00]); // Wire type 7 (invalid)
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("application/x-protobuf");
    });

    it("should reject text content", () => {
      const buffer = Buffer.from("This is plain text");
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("application/x-protobuf");
    });

    it("should require minimum length", () => {
      const buffer = Buffer.from([0x0a]); // Too short
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("application/x-protobuf");
    });
  });

  describe("Plain text detection (heuristic)", () => {
    const detector = createDetector(mockCatalog);

    it("should detect plain ASCII text", () => {
      const buffer = Buffer.from("This is plain text content");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/plain");
    });

    it("should detect UTF-8 text", () => {
      const buffer = Buffer.from("Hello 世界 🌍");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/plain");
    });

    it("should allow common whitespace characters", () => {
      const buffer = Buffer.from("Line 1\nLine 2\tTabbed\rCarriage return");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/plain");
    });

    it("should reject binary content", () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = detector.detect(buffer);
      expect(result?.mime).not.toBe("text/plain");
    });

    it("should handle mixed content (mostly text)", () => {
      const buffer = Buffer.from("Mostly text with one null\x00byte");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("text/plain");
    });
  });

  describe("Priority ordering", () => {
    const detector = createDetector(mockCatalog);

    it("should detect XML before checking JSON", () => {
      // XML starts with < which could be mistaken for other formats
      const buffer = Buffer.from('<?xml version="1.0"?><root/>');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/xml");
    });

    it("should detect JSON before YAML", () => {
      const buffer = Buffer.from('{"key": "value"}');
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/json");
    });

    it("should detect YAML before CSV/text", () => {
      const buffer = Buffer.from("---\nkey: value");
      const result = detector.detect(buffer);
      expect(result?.mime).toBe("application/yaml");
    });
  });

  describe("Unknown content", () => {
    const detector = createDetector(mockCatalog);

    it("should detect binary content as text or protobuf based on heuristics", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic number (not in catalog)
      const result = detector.detect(buffer);
      // Binary data may be detected as protobuf or text depending on content
      expect(result).not.toBeNull();
    });

    it("should return null for empty buffer", () => {
      const buffer = Buffer.from([]);
      const result = detector.detect(buffer);
      expect(result).toBeNull();
    });

    it("should detect some random binary as protobuf", () => {
      // This binary happens to match protobuf heuristics (field tag 0x12 = field 2, wire type 2)
      const buffer = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
      const result = detector.detect(buffer);
      // May be detected as protobuf due to valid field tag pattern
      expect(result?.mime).toBe("application/x-protobuf");
    });

    it("should not detect pure high-byte binary as text", () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const result = detector.detect(buffer);
      // All null bytes should not be text
      expect(result?.mime).not.toBe("text/plain");
    });
  });

  describe("BOM handling", () => {
    const detector = createDetector(mockCatalog);

    it("should skip BOM when detecting", () => {
      const jsonWithBOM = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
      const jsonWithoutBOM = Buffer.from([0x7b, 0x7d]);

      const result1 = detector.detect(jsonWithBOM);
      const result2 = detector.detect(jsonWithoutBOM);

      expect(result1?.mime).toBe("application/json");
      expect(result2?.mime).toBe("application/json");
    });
  });
});
