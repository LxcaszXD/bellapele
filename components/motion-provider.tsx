"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const selector = "[data-motion]";

function motionFrom(kind: string) {
  if (kind === "left") return { x: -22, y: 0, scale: 1 };
  if (kind === "right") return { x: 22, y: 0, scale: 1 };
  if (kind === "scale") return { x: 0, y: 12, scale: 0.98 };
  if (kind === "stagger") return { x: 0, y: 9, scale: 1 };
  return { x: 0, y: 22, scale: 1 };
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const triggers = new Map<HTMLElement, ScrollTrigger>();
    const animated = new Set<HTMLElement>();
    let refreshFrame = 0;
    let scanFrame = 0;

    const play = (element: HTMLElement, delay = 0) => {
      if (reduced.matches || !element.isConnected) return;
      triggers.get(element)?.kill();
      triggers.delete(element);
      animated.add(element);

      gsap.fromTo(
        element,
        { autoAlpha: 0, ...motionFrom(element.dataset.motion || "rise") },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.68,
          delay,
          ease: "power3.out",
          clearProps: "opacity,visibility,transform",
          overwrite: "auto",
        },
      );
      element.dataset.motionReady = "true";
    };

    const watch = (element: HTMLElement, delay = 0) => {
      if (
        reduced.matches ||
        element.dataset.motionReady === "true" ||
        triggers.has(element)
      ) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        play(element, delay);
        return;
      }

      const trigger = ScrollTrigger.create({
        trigger: element,
        start: "top 92%",
        once: true,
        onEnter: () => play(element, delay),
      });
      triggers.set(element, trigger);
    };

    const scan = (within: ParentNode) => {
      if (reduced.matches) return;
      const elements: HTMLElement[] = [];
      if (within instanceof HTMLElement && within.matches(selector)) {
        elements.push(within);
      }
      elements.push(...within.querySelectorAll<HTMLElement>(selector));

      const fresh = elements.filter(
        (element) =>
          element.dataset.motionReady !== "true" && !triggers.has(element),
      );
      const staggerGroups = new Map<string, number>();
      fresh.forEach((element) => {
        if (element.dataset.motion !== "stagger") {
          watch(element);
          return;
        }
        const group = element.dataset.motionGroup || "default";
        const index = staggerGroups.get(group) || 0;
        staggerGroups.set(group, index + 1);
        watch(element, index * 0.07);
      });
    };

    const animateMenu = (nav: HTMLElement) => {
      const links = Array.from(nav.querySelectorAll<HTMLElement>("a, button"));
      gsap.fromTo(
        links,
        { autoAlpha: 0, y: -7 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          stagger: 0.035,
          ease: "power2.out",
          clearProps: "all",
          overwrite: true,
        },
      );
    };
    const closeMenu = (nav: HTMLElement) => {
      gsap.to(nav.querySelectorAll<HTMLElement>("a, button"), {
        autoAlpha: 0,
        y: -7,
        duration: 0.12,
        stagger: { each: 0.015, from: "end" },
        ease: "power2.in",
        overwrite: true,
      });
    };

    const observer = new MutationObserver((records) => {
      if (reduced.matches) return;
      records.forEach((record) => {
        if (record.type === "attributes" && record.target instanceof HTMLElement) {
          const nav = record.target;
          if (nav.matches(".bp-nav.open")) animateMenu(nav);
          else if (nav.matches(".bp-nav.closing")) closeMenu(nav);
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
      });
      if (records.some((record) => record.addedNodes.length > 0)) {
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
      }
    });
    observer.observe(scope, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    // The root is a client component around server-rendered page content.
    // Scan after hydration has committed so the first pass sees the real DOM.
    scanFrame = requestAnimationFrame(() => {
      scan(scope);
      ScrollTrigger.refresh();
    });

    const onLayoutChange = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    window.addEventListener("resize", onLayoutChange, { passive: true });
    scope.addEventListener("load", onLayoutChange, true);

    const onReducedMotion = (event: MediaQueryListEvent) => {
      if (event.matches) {
        triggers.forEach((trigger) => trigger.kill());
        triggers.clear();
        animated.forEach((element) => {
          gsap.killTweensOf(element);
          gsap.set(element, { clearProps: "all" });
          delete element.dataset.motionReady;
        });
        animated.clear();
      } else {
        scan(scope);
        ScrollTrigger.refresh();
      }
    };
    reduced.addEventListener("change", onReducedMotion);

    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              "[data-motion-heart], [data-motion-calendar-day]",
            )
          : null;
      if (!target || reduced.matches) return;
      gsap.fromTo(
        target,
        { scale: 0.92 },
        { scale: 1, duration: 0.28, ease: "back.out(2)", overwrite: true },
      );
    };
    scope.addEventListener("click", onClick);

    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", onReducedMotion);
      window.removeEventListener("resize", onLayoutChange);
      scope.removeEventListener("load", onLayoutChange, true);
      scope.removeEventListener("click", onClick);
      cancelAnimationFrame(scanFrame);
      cancelAnimationFrame(refreshFrame);
      triggers.forEach((trigger) => trigger.kill());
      triggers.clear();
      animated.forEach((element) => {
        gsap.killTweensOf(element);
        delete element.dataset.motionReady;
      });
      animated.clear();
    };
  }, []);

  return (
    <div ref={root} className="bp-motion-root">
      {children}
    </div>
  );
}
