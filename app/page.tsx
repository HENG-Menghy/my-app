import Header from "@/app/components/ui/header";

export default function Home() {
  return (
    <div className="h-screen">
      <div className="w-full fixed top-0">
        <Header />
      </div>
      <div className="w-full mt-24">
        <h1> Home </h1>
      </div>
    </div>
  );
}
