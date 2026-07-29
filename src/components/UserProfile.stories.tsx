import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, HttpResponse, http } from "msw";
import { expect, userEvent } from "storybook/test";
import { UserProfile } from "./UserProfile";

const meta = {
  title: "Example/UserProfile",
  component: UserProfile,
  args: {
    userId: "42",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof UserProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get("*/api/users/:userId", () =>
        HttpResponse.json({
          id: "42",
          name: "Ada Lovelace",
          role: "Test Architect",
        }),
      ),
    );
  },
  async play({ canvas }) {
    await expect(
      canvas.findByRole("heading", { name: "Ada Lovelace" }),
    ).resolves.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(
      canvas.findByRole("heading", { name: "Ada Lovelace" }),
    ).resolves.toBeVisible();
  },
};

export const Error: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get("*/api/users/:userId", () =>
        HttpResponse.json({ message: "Unavailable" }, { status: 503 }),
      ),
    );
  },
  async play({ canvas }) {
    await expect(canvas.findByRole("alert")).resolves.toHaveTextContent(
      "Unable to load user (503)",
    );
  },
};

export const Loading: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get("*/api/users/:userId", async () => {
        await delay("infinite");
      }),
    );
  },
  async play({ canvas }) {
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading user");
  },
};
