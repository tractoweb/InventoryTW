"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeSvg(props: {
  value: string;
  className?: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
  /** Width in dots for each bar (smaller = more estrecho). */
  barWidth?: number;
}) {
  const { value, className, height = 44, width, displayValue = false, barWidth = 1 } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous rendering
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!value) return;

    try {
      JsBarcode(svg, value, {
        format: "CODE128",
        height,
        width: Math.max(1, Math.trunc(Number(barWidth) || 1)),
        margin: 0,
        displayValue,
        textMargin: 2,
        fontSize: 12,
      });
    } catch {
      // If JsBarcode rejects the input, keep the cell usable.
      try {
        const padding = 2;
        const fontSize = 12;
        const y = Math.max(fontSize, Math.floor((height as number) / 2));

        svg.setAttribute("viewBox", `0 0 200 ${height}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(padding));
        rect.setAttribute("y", String(padding));
        rect.setAttribute("width", String(200 - padding * 2));
        rect.setAttribute("height", String((height as number) - padding * 2));
        rect.setAttribute("fill", "white");
        rect.setAttribute("stroke", "black");
        rect.setAttribute("stroke-width", "1");
        svg.appendChild(rect);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", "100");
        label.setAttribute("y", String(y));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-family", "monospace");
        label.setAttribute("font-size", String(fontSize));
        label.textContent = value;
        svg.appendChild(label);
      } catch {
        // silent
      }
    }
  }, [value, height, displayValue]);

  return (
    <svg
      ref={svgRef}
      className={className}
      style={width ? { width } : undefined}
      role="img"
      aria-label={value ? `Código de barras: ${value}` : "Código de barras"}
    />
  );
}
