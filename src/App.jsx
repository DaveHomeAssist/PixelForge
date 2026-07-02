import { useEffect, useMemo, useState } from "react";
import "./AppPages.css";
import PixelForge from "./PixelForge.jsx";
import LauncherPage from "./pages/LauncherPage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import BrandPage from "./pages/BrandPage.jsx";
import { getRouteFromLocation, navigateToRoute, ROUTES } from "./routes.js";

export default function App() {
  const [route, setRoute] = useState(() => getRouteFromLocation(window.location));
  const navigate = useMemo(() => (nextRoute) => navigateToRoute(nextRoute), []);

  useEffect(() => {
    const syncRoute = () => setRoute(getRouteFromLocation(window.location));
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("pixelforge:navigate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("pixelforge:navigate", syncRoute);
    };
  }, []);

  if (route === ROUTES.editor) return <PixelForge />;
  if (route === ROUTES.guide) return <GuidePage navigate={navigate} />;
  if (route === ROUTES.onboarding) return <OnboardingPage navigate={navigate} />;
  if (route === ROUTES.brand) return <BrandPage navigate={navigate} />;
  return <LauncherPage navigate={navigate} initialView={route === ROUTES.templates ? "templates" : "home"} />;
}
