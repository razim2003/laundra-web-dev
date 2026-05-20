"use client";

import { useEffect } from "react";

export function useLaundraRuntime(pathname: string) {
  useEffect(() => {
    const loaderBar = document.getElementById("loaderBar") as HTMLElement | null;
    const loader = document.getElementById("loader");
    const app = document.getElementById("app");

    const showApp = () => {
      if (loaderBar) loaderBar.style.width = "100%";
      loader?.classList.add("hidden");
      app?.classList.add("visible");
    };

    const onLoad = () => {
      window.setTimeout(showApp, 300);
    };

    const fallbackTimer = window.setTimeout(showApp, 2400);
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);

    let lastScroll = 0;
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      const ind = document.getElementById("scrollIndicator") as HTMLElement | null;
      if (ind) ind.style.width = `${pct}%`;

      const nav = document.getElementById("mainNav");
      if (nav) {
        if (scrollTop > lastScroll && scrollTop > 200) nav.classList.add("hide");
        else nav.classList.remove("hide");
      }
      lastScroll = scrollTop;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", onLoad);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".animate-in, .animate-in-left"));
    if (!nodes.length) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    const app = document.getElementById("app");
    const loader = document.getElementById("loader");
    app?.classList.add("visible");
    loader?.classList.add("hidden");
  }, [pathname]);
}
