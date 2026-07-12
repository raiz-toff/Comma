import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge doesn't know our custom font-size keys (tailwind.config.js),
// so by default it treats `text-heading-l` and `text-content-muted` as the
// same "text color" group and drops one. Registering the semantic type ramp
// as font-size classes lets a color class coexist with a variant's size class.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading-xl",
            "heading-l",
            "heading-m",
            "heading-s",
            "label-l",
            "label-m",
            "label-xs",
            "paragraph-l",
            "paragraph-m",
            "paragraph-s",
            "2xs",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
