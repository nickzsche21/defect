import type { Metadata } from "next";
import "./globals.css";

const title = "DEFECT — take your context to any model";
const description =
  "Drop in your Claude or ChatGPT export. DEFECT reads it in your browser and compiles the things you keep re-explaining into custom instructions for any other model. Nothing is uploaded.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
