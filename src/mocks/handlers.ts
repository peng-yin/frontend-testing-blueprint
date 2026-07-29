import { HttpResponse, http } from "msw";

export const handlers = [
  http.get("*/api/users/:userId", ({ params }) =>
    HttpResponse.json({
      id: String(params.userId),
      name: "Ada Lovelace",
      role: "Test Architect",
    }),
  ),
];
