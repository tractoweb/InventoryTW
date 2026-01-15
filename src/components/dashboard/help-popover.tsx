"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Info } from "lucide-react";

type HelpPopoverProps = {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
};

export function HelpPopover({ title, description, href, hrefLabel }: HelpPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label={`Ayuda: ${title}`}
            >
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>¿Qué significa?</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
          {href ? (
            <div className="pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={href}>{hrefLabel ?? "Ver detalles"}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
