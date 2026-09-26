/**
 * Route tests: Evidence routes
 * - POST /api/evidence (upload)
 * - GET /api/evidence/[id]
 * - GET /api/evidence/[id]/download
 */

import { describe, it, expect } from "vitest";
import { POST as evidencePost } from "@/app/api/evidence/route";
import { DELETE as evidenceIdDelete } from "@/app/api/evidence/[id]/route";
import { GET as evidenceDownloadGet } from "@/app/api/evidence/[id]/download/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("POST /api/evidence", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/evidence",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await evidencePost(request);
    await expectJsonError(response, 401);
  });
});

describe("DELETE /api/evidence/[id]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/evidence/evidence-123",
      {
        method: "DELETE",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await evidenceIdDelete(request, { params: Promise.resolve({ id: "evidence-123" }) });
    await expectJsonError(response, 401);
  });
});

describe("GET /api/evidence/[id]/download", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/evidence/evidence-123/download",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await evidenceDownloadGet(request, { params: { id: "evidence-123" } });
    await expectJsonError(response, 401);
  });
});
