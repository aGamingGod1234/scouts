import "./globals.css";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";

export const metadata = {
  title: "scout app",
  description: "Railway + PostgreSQL migration base"
};

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body"
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
