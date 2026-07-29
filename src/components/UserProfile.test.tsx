import { delay, HttpResponse, http } from "msw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserProfile } from "./UserProfile";
import { server } from "../mocks/server";

describe("UserProfile", () => {
  it("renders data returned by the API", async () => {
    render(<UserProfile userId="42" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading user");
    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
    expect(screen.getByText("Test Architect")).toBeVisible();
  });

  it("shows a recoverable error state", async () => {
    server.use(
      http.get("*/api/users/:userId", () =>
        HttpResponse.json({ message: "Service unavailable" }, { status: 503 }),
      ),
    );

    render(<UserProfile userId="42" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load user (503)",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("refreshes data through a user-visible interaction", async () => {
    const user = userEvent.setup();
    let requestCount = 0;

    server.use(
      http.get("*/api/users/:userId", () => {
        requestCount += 1;
        return HttpResponse.json({
          id: "42",
          name: requestCount === 1 ? "Ada Lovelace" : "Grace Hopper",
          role: "Test Architect",
        });
      }),
    );

    render(<UserProfile userId="42" />);
    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByRole("heading", { name: "Grace Hopper" }),
    ).toBeVisible();
    expect(requestCount).toBe(2);
  });

  it("does not render stale data after the user id changes", async () => {
    server.use(
      http.get("*/api/users/:userId", async ({ params }) => {
        if (params.userId === "first") {
          await delay(50);
        }

        return HttpResponse.json({
          id: String(params.userId),
          name: params.userId === "first" ? "First User" : "Second User",
          role: "Test Architect",
        });
      }),
    );

    const { rerender } = render(<UserProfile userId="first" />);
    rerender(<UserProfile userId="second" />);

    expect(
      await screen.findByRole("heading", { name: "Second User" }),
    ).toBeVisible();
    expect(screen.queryByText("First User")).not.toBeInTheDocument();
  });

  it("normalizes non-Error rejections", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("offline");

    render(<UserProfile userId="42" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown error");
  });
});
