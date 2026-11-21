"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Visar en bild förstorad. En Dialog från shadcn: stängs med Esc, med
 * stängknappen eller genom att klicka utanför, och håller fokus inne i sig.
 * Öppnas den från jobböversikten (som också är en Dialog) stänger Esc bara
 * bilden – Radix stänger den översta dialogen först.
 */
export function BildVisare({
  url,
  onStang,
}: {
  url: string | null;
  onStang: () => void;
}) {
  return (
    <Dialog open={url != null} onOpenChange={(open) => !open && onStang()}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-5xl items-center justify-center border-0 bg-black/95 p-2 text-white ring-0 sm:max-w-5xl [&_[data-slot=dialog-close]]:bg-black/60 [&_[data-slot=dialog-close]]:text-white">
        <DialogTitle className="sr-only">Förstorad bild</DialogTitle>
        {url && (
          <div className="relative h-full w-full">
            <Image
              src={url}
              alt="Förstorad jobbild"
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
