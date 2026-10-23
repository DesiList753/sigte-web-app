import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Condensed, Roboto_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const roboto = Roboto({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--font-roboto" });
const robotoCondensed = Roboto_Condensed({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-roboto-condensed" });
const robotoMono = Roboto_Mono({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "S.I.G.T.E",
  description: "Sistema Inteligente de Gestión de Tránsito y Estacionamiento",
};

export const viewport: Viewport = {
  themeColor: "#004B85",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${roboto.variable} ${robotoCondensed.variable} ${robotoMono.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
