import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "control-surface-ui/css";
import App from "./App.jsx";
import "./styles.css";

const ICON_ALIASES = {
  "bar-chart": "analytics",
  "check-circle": "check",
  "chevron-down": "chevronDown",
  "external-link": "open",
  "radio-tower": "source",
  "shield-check": "shield",
  "user-check": "users",
};

let controlSurfaceApiPromise = null;

function loadControlSurfaceApi() {
  controlSurfaceApiPromise ||= import("control-surface-ui");
  return controlSurfaceApiPromise;
}

function normalizeIconName(name) {
  const raw = String(name || "").trim();
  return ICON_ALIASES[raw] || raw;
}

function iconSlotsFor(root = document) {
  const slots = [];
  if (root?.nodeType === Node.ELEMENT_NODE && root.matches?.("[data-if-icon]")) {
    slots.push(root);
  }
  if (root?.querySelectorAll) {
    slots.push(...root.querySelectorAll("[data-if-icon]"));
  }
  return slots;
}

async function hydrateAppIcons(root = document) {
  const { hydrateIcons } = await loadControlSurfaceApi();
  const slots = iconSlotsFor(root);
  slots.forEach(slot => {
    const iconName = normalizeIconName(slot.dataset.ifIcon);
    if (iconName !== slot.dataset.ifIcon) slot.dataset.ifIcon = iconName;
    if (slot.dataset.fgIconRendered !== iconName || !slot.querySelector("svg.if-icon")) {
      delete slot.dataset.ifIconHydrated;
      slot.replaceChildren();
    }
  });
  hydrateIcons(root);
  slots.forEach(slot => {
    if (slot.querySelector("svg.if-icon")) slot.dataset.fgIconRendered = slot.dataset.ifIcon;
  });
}

function ControlSurfaceApp() {
  useEffect(() => {
    let disposed = false;
    let stopIconWatcher = () => {};
    let destroyApp = () => {};

    loadControlSurfaceApi().then(({ destroy, init, setTheme }) => {
      if (disposed) return;
      init(document);
      setTheme("light");
      destroyApp = () => destroy(document);
      const observer = new MutationObserver(() => hydrateAppIcons(document));
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-if-icon"],
      });
      hydrateAppIcons(document);
      stopIconWatcher = () => observer.disconnect();
    });

    return () => {
      disposed = true;
      stopIconWatcher();
      destroyApp();
    };
  }, []);

  return (
    <div className="if-shell fg-root" data-theme="light" data-density="compact">
      <App />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ControlSurfaceApp />
  </StrictMode>,
);
