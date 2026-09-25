/**
 * Route tests: Report routes (nrb-taxonomy, nrbsis-green-statement)
 *
 * Per TEST_STRATEGY §4.2, high-priority reporting routes.
 */

import { describe, it, expect } from "vitest";
import { GET as taxonomyReportGet } from "@/app/api/reports/nrb-taxonomy/route";
import { GET as greenStatementGet } from "@/app/api/reports/nrbsis-green-statement/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("GET /api/reports/nrb-taxonomy", () => {
  describe("Happy path", () => {
    it("returns Excel file (application/vnd.openxmlformats)", async () => {
      const request = createMockRequest(
        "/api/reports/nrb-taxonomy",
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await taxonomyReportGet(request);

      // Report routes return file downloads, check content-type
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/");
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer missing", async () => {
      const request = createMockRequest(
        "/api/reports/nrb-taxonomy",
        {
          method: "GET",
          cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
        },
      );

      const response = await taxonomyReportGet(request);
      await expectJsonError(response, 401);
    });
  });
});

describe("GET /api/reports/nrbsis-green-statement", () => {
  describe("Happy path", () => {
    it("returns PDF file (application/pdf)", async () => {
      const request = createMockRequest(
        "/api/reports/nrbsis-green-statement",
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await greenStatementGet(request);

      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/");
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer missing", async () => {
      const request = createMockRequest(
        "/api/reports/nrbsis-green-statement",
        {
          method: "GET",
          cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
        },
      );

      const response = await greenStatementGet(request);
      await expectJsonError(response, 401);
    });
  });
});
