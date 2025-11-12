/**
 * HTTP Status catalog tests
 */

import { describe, expect, it } from "vitest";
import {
  clearHttpStatusCache,
  getHttpStatus,
  getStatusReason,
  isClientError,
  isInformational,
  isRedirection,
  isServerError,
  isSuccess,
  listHttpStatuses,
} from "../http-statuses.js";

describe("HTTP Status Catalog", () => {
  describe("getHttpStatus", () => {
    it("should return status by code", async () => {
      const status = await getHttpStatus(200);
      expect(status).toBeDefined();
      expect(status?.value).toBe(200);
      expect(status?.reason).toBe("OK");
      expect(status?.group).toBe("success");
    });

    it("should return null for unknown status code", async () => {
      const status = await getHttpStatus(999);
      expect(status).toBeNull();
    });

    it("should return frozen immutable object", async () => {
      const status = await getHttpStatus(404);
      expect(Object.isFrozen(status)).toBe(true);
    });

    it("should return defensive copy (not same reference)", async () => {
      const status1 = await getHttpStatus(200);
      const status2 = await getHttpStatus(200);
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe("isInformational", () => {
    it("should identify 1xx codes", () => {
      expect(isInformational(100)).toBe(true);
      expect(isInformational(101)).toBe(true);
      expect(isInformational(199)).toBe(true);
    });

    it("should reject non-1xx codes", () => {
      expect(isInformational(99)).toBe(false);
      expect(isInformational(200)).toBe(false);
      expect(isInformational(404)).toBe(false);
    });
  });

  describe("isSuccess", () => {
    it("should identify 2xx codes", () => {
      expect(isSuccess(200)).toBe(true);
      expect(isSuccess(201)).toBe(true);
      expect(isSuccess(204)).toBe(true);
      expect(isSuccess(299)).toBe(true);
    });

    it("should reject non-2xx codes", () => {
      expect(isSuccess(199)).toBe(false);
      expect(isSuccess(300)).toBe(false);
      expect(isSuccess(404)).toBe(false);
    });
  });

  describe("isRedirection", () => {
    it("should identify 3xx codes", () => {
      expect(isRedirection(300)).toBe(true);
      expect(isRedirection(301)).toBe(true);
      expect(isRedirection(302)).toBe(true);
      expect(isRedirection(399)).toBe(true);
    });

    it("should reject non-3xx codes", () => {
      expect(isRedirection(299)).toBe(false);
      expect(isRedirection(400)).toBe(false);
    });
  });

  describe("isClientError", () => {
    it("should identify 4xx codes", () => {
      expect(isClientError(400)).toBe(true);
      expect(isClientError(404)).toBe(true);
      expect(isClientError(418)).toBe(true);
      expect(isClientError(499)).toBe(true);
    });

    it("should reject non-4xx codes", () => {
      expect(isClientError(399)).toBe(false);
      expect(isClientError(500)).toBe(false);
    });
  });

  describe("isServerError", () => {
    it("should identify 5xx codes", () => {
      expect(isServerError(500)).toBe(true);
      expect(isServerError(502)).toBe(true);
      expect(isServerError(503)).toBe(true);
      expect(isServerError(599)).toBe(true);
    });

    it("should reject non-5xx codes", () => {
      expect(isServerError(499)).toBe(false);
      expect(isServerError(600)).toBe(false);
    });
  });

  describe("listHttpStatuses", () => {
    it("should return all status codes", async () => {
      const statuses = await listHttpStatuses();
      expect(statuses.length).toBeGreaterThan(50);
      expect(statuses.every((s) => s.value && s.reason && s.group)).toBe(true);
    });

    it("should return frozen immutable array", async () => {
      const statuses = await listHttpStatuses();
      expect(statuses.every((s) => Object.isFrozen(s))).toBe(true);
    });

    it("should include all groups", async () => {
      const statuses = await listHttpStatuses();
      const groups = new Set(statuses.map((s) => s.group));
      expect(groups.has("informational")).toBe(true);
      expect(groups.has("success")).toBe(true);
      expect(groups.has("redirect")).toBe(true);
      expect(groups.has("client-error")).toBe(true);
      expect(groups.has("server-error")).toBe(true);
    });
  });

  describe("getStatusReason", () => {
    it("should return reason phrase", async () => {
      expect(await getStatusReason(200)).toBe("OK");
      expect(await getStatusReason(404)).toBe("Not Found");
      expect(await getStatusReason(500)).toBe("Internal Server Error");
    });

    it("should return null for unknown code", async () => {
      expect(await getStatusReason(999)).toBeNull();
    });
  });

  describe("clearHttpStatusCache", () => {
    it("should clear cache and reload", async () => {
      const status1 = await getHttpStatus(200);
      clearHttpStatusCache();
      const status2 = await getHttpStatus(200);

      expect(status1).toEqual(status2);
      expect(status1).not.toBe(status2);
    });
  });

  describe("Common Status Codes", () => {
    it("should have 200 OK", async () => {
      const status = await getHttpStatus(200);
      expect(status?.reason).toBe("OK");
      expect(status?.group).toBe("success");
    });

    it("should have 404 Not Found", async () => {
      const status = await getHttpStatus(404);
      expect(status?.reason).toBe("Not Found");
      expect(status?.group).toBe("client-error");
    });

    it("should have 500 Internal Server Error", async () => {
      const status = await getHttpStatus(500);
      expect(status?.reason).toBe("Internal Server Error");
      expect(status?.group).toBe("server-error");
    });

    it("should have 418 I'm a teapot", async () => {
      const status = await getHttpStatus(418);
      expect(status?.reason).toBe("I'm a teapot");
      expect(status?.group).toBe("client-error");
    });

    it("should have 301 Moved Permanently", async () => {
      const status = await getHttpStatus(301);
      expect(status?.reason).toBe("Moved Permanently");
      expect(status?.group).toBe("redirect");
    });
  });
});
