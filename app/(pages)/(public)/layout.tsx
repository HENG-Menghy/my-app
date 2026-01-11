// layout.tsx

import Header from "@/components/ui/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative">
      <Header />
      <main className="max-w-[1440px] mx-auto mt-4 px-4 lg:px-8">{children}</main>
    </div>
  );
}
