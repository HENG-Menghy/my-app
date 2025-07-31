// user/layout.tsx

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
        <div className="flex mx-auto max-w-[1440px]"> 
           <div> Sidebar </div>
           <main className="flex-1"> {children} </main>
        </div>
    );
}
