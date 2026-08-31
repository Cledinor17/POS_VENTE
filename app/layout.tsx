// import type { Metadata } from "next";
// import "./globals.css";
// import { Plus_Jakarta_Sans } from "next/font/google";

// const plusJakarta = Plus_Jakarta_Sans({
//   subsets: ["latin"],
//   weight: ["400", "600", "700"],
//   variable: "--font-plus-jakarta",
// });

// export const metadata: Metadata = {
//   title: "POS Pro",
//   description: "POS Admin Dashboard",
// };

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="fr" className={plusJakarta.variable}>
//       <body className="bg-slate-50">{children}</body>
//     </html>
//   );
// }
import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import Providers from "./providers";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/locale";

export const metadata: Metadata = { title: "POS Pro" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;

  return (
    <html lang={locale}>
      <body className="app-shell-bg">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
