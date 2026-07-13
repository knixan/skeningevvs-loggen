import {
  MinaSidorSidebar,
  MinaSidorMobileNav,
} from "@/components/minasidor/mina-sidor-nav";
import { TopBar } from "@/components/minasidor/top-bar";

export default function MinaSidorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex min-w-0 flex-1">
        <MinaSidorSidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>
      <MinaSidorMobileNav />
    </div>
  );
}
