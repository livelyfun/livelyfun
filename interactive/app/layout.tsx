import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mithlesh Das — Live Developer Profile",
  description: "An interactive 3D developer profile with pointer-reactive visuals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}