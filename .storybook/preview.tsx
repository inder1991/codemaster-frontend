import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: "centered",
  },
  globalTypes: {
    theme: {
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        items: ["light", "dark"],
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle(
          "dark",
          ctx.globals.theme === "dark",
        );
      }
      return Story();
    },
  ],
};

export default preview;
