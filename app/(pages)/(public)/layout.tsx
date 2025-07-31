// layout.tsx

import Header from "@/components/ui/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-[1440px] mx-auto mt-2 relative">{children}</main>
    </div>
  );
}
