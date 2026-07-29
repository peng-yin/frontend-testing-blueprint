import { definePreview } from "@storybook/react-vite";
import addonMsw from "msw-storybook-addon";
import "../src/styles.css";

export default definePreview({
  addons: [addonMsw()],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "error",
    },
  },
});
