import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";

// Variable names differ from DESIGN.md's sample (--font-sans etc.) to avoid a
// circular var() reference with the Tailwind @theme tokens; globals.css maps
// --font-inter → --font-sans and so on.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
