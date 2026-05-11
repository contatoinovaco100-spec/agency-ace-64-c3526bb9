import { useEffect } from "react";

export interface QuizTheme {
  primary_color: string;
  background_color: string;
  background_image_url: string;
  text_color: string;
  card_background: string;
  button_text_color: string;
  font_family: string;
  heading_weight: number;
  body_weight: number;
  border_radius: number;
  logo_url: string;
  cover_image_url: string;
  show_logo: boolean;
  button_style: "rounded" | "pill" | "square";
  animation: "fade" | "slide" | "none";
}

export const DEFAULT_QUIZ_THEME: QuizTheme = {
  primary_color: "#bff720",
  background_color: "#0a0a0a",
  background_image_url: "",
  text_color: "#ffffff",
  card_background: "#171717",
  button_text_color: "#000000",
  font_family: "Inter",
  heading_weight: 700,
  body_weight: 400,
  border_radius: 12,
  logo_url: "",
  cover_image_url: "",
  show_logo: true,
  button_style: "rounded",
  animation: "fade",
};

export const mergeTheme = (raw: any): QuizTheme => ({
  ...DEFAULT_QUIZ_THEME,
  ...(raw && typeof raw === "object" ? raw : {}),
});

export const GOOGLE_FONTS = [
  "Inter", "Poppins", "Roboto", "Montserrat", "Plus Jakarta Sans",
  "Manrope", "Sora", "Playfair Display", "DM Sans", "Space Grotesk",
  "Open Sans", "Lato", "Nunito", "Raleway", "Work Sans",
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];

/** Inject a Google Font <link> if not already present. */
export function useGoogleFont(family: string, weights: number[] = [400, 700]) {
  useEffect(() => {
    if (!family || family === "Inter") return;

    // Add preconnect for performance
    if (!document.getElementById("gf-preconnect")) {
      const pc1 = document.createElement("link");
      pc1.id = "gf-preconnect";
      pc1.rel = "preconnect";
      pc1.href = "https://fonts.googleapis.com";
      document.head.appendChild(pc1);

      const pc2 = document.createElement("link");
      pc2.rel = "preconnect";
      pc2.href = "https://fonts.gstatic.com";
      pc2.crossOrigin = "anonymous";
      document.head.appendChild(pc2);
    }

    const id = `gf-${family.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, "+")}:wght@${weights.join(";")}&display=swap`;
    document.head.appendChild(link);
  }, [family, weights.join(",")]);
}

export const buttonRadius = (style: QuizTheme["button_style"], base: number) => {
  if (style === "pill") return 9999;
  if (style === "square") return 0;
  return base;
};
