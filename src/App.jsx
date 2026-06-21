import { useEffect, useRef, useState } from "react";

const U = {
  primaryDarker: "#162e51",
  primaryDark: "#1a4480",
  primary: "#005ea2",
  primaryLight: "#73b3e7",
  primaryLighter: "#d9e8f6",
  baseDarkest: "#1b1b1b",
  baseDarker: "#3d4551",
  baseDark: "#565c65",
  base: "#71767a",
  baseLighter: "#dfe1e2",
  white: "#ffffff",
};

const PROFILE_SETTINGS = [
  ["column-resize", "columns", "Column Resize", "Drag header edges to change table widths", "data-profile-column-resize-toggle"],
  ["column-order", "sort", "Column Order", "Drag header handles to reorganize columns", "data-profile-column-reorder-toggle"],
  ["review-queue", "eye-off", "Review Queue", "0 queued in the current workspace filters", "data-profile-review-queue-toggle"],
  ["signal-set", "search", "Signal Set", "Search and source actions stay visible", "data-profile-signal-set-toggle"],
  ["filters", "filter", "Filters", "Filter controls stay visible", "data-profile-filters-toggle"],
  ["table", "columns", "Table", "Saved views and table preferences stay visible", "data-profile-table-toggle"],
];

function Icon({ name }) {
  return <span className="if-icon-slot" data-if-icon={name} aria-hidden="true" />;
}

function ProfileSettingStateBadge({ enabled, enabledLabel = "On" }) {
  return (
    <span className="ci-profile-setting-toggle ci-profile-setting-toggle--on" data-profile-setting-state={enabled ? "on" : "off"}>
      <span className="ci-profile-setting-toggle__track" aria-hidden="true">
        <span className="ci-profile-setting-toggle__knob"></span>
      </span>
      <span className="ci-profile-setting-toggle__label">{enabledLabel}</span>
    </span>
  );
}

function ProfileSettingRow({ setting, icon, label, helper, dataAttr }) {
  return (
    <button
      type="button"
      className="if-account-action ci-profile-setting-action ci-profile-setting-action--on"
      data-profile-setting={setting}
      data-profile-setting-state="on"
      aria-pressed="true"
      title={helper}
      {...{ [dataAttr]: true }}
    >
      <span className="if-account-action__icon if-icon-slot ci-profile-setting-icon" data-if-icon={icon} aria-hidden="true"></span>
      <span className="if-account-action__content ci-profile-setting-copy">
        <strong className="if-account-action__title" data-profile-setting-label={setting}>{label}</strong>
        <span className="if-account-action__meta" data-profile-setting-helper={setting}>{helper}</span>
      </span>
      <ProfileSettingStateBadge enabled />
    </button>
  );
}

function FastDasProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="if-popover if-account-popover ci-profile-menu"
      data-profile-menu
      data-fastdas-profile-menu
      style={{ position: "relative", flex: "0 0 auto", marginLeft: "auto" }}
    >
      <button
        type="button"
        className={`if-account-menu${open ? " is-active" : ""}`}
        data-profile-menu-trigger
        aria-label="Profile menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="workspace-profile-menu"
        title="Profile"
        onClick={() => setOpen(value => !value)}
        style={{
          maxWidth: 220,
          minHeight: 36,
          background: open ? U.primaryLighter : U.white,
          borderColor: open ? U.primaryLight : "rgba(255,255,255,0.42)",
          color: U.baseDarkest,
        }}
      >
        <span className="if-avatar if-profile-avatar" data-profile-avatar aria-hidden="true" style={{ width: 28, height: 28, fontSize: 11 }}>
          FD
        </span>
        <span className="if-account-menu__name if-desktop-only" data-profile-menu-name>
          Profile
        </span>
        <span className="if-icon-slot if-account-menu__chevron" data-if-icon="chevronDown" aria-hidden="true"></span>
      </button>

      {open && (
        <section
          id="workspace-profile-menu"
          className="if-popover__panel if-account-surface ci-profile-menu__surface"
          data-profile-menu-surface
          role="dialog"
          aria-label="Profile controls"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(360px, calc(100vw - 24px))",
            zIndex: 210,
          }}
        >
          <header className="if-account-surface__header">
            <span className="if-account-surface__avatar if-profile-avatar if-profile-avatar--large" aria-hidden="true">
              AB
            </span>
            <span className="if-account-surface__identity">
              <strong data-profile-active-name>Adam Boas</strong>
              <span>Growth operator</span>
              <span>Browser-local profile</span>
            </span>
          </header>
          <div className="if-account-surface__body">
            <section className="if-account-surface__section" aria-label="Active profile">
              <span className="if-account-surface__label">Active Profile</span>
              <div className="if-profile-account-list" data-profile-lead-list>
                <button
                  type="button"
                  className="if-profile-account-option is-active"
                  data-profile-lead-option="adam-boas"
                  aria-pressed="true"
                  title="Use Adam Boas as the active profile"
                >
                  <span className="if-profile-avatar" aria-hidden="true">AB</span>
                  <span className="ci-profile-option-identity" data-profile-option-identity>
                    <strong className="ci-profile-option-name">Adam Boas</strong>
                    <span className="ci-profile-option-meta">Growth operator</span>
                  </span>
                  <span className="if-badge if-badge--info ci-profile-option-status">Active</span>
                </button>
              </div>
            </section>
            <section className="if-account-surface__section" aria-label="Profile source">
              <span className="if-account-surface__label">Identity Source</span>
              <div className="if-account-surface__controls">
                <div className="if-account-surface__control">
                  <span>Provider</span>
                  <strong>Lead record</strong>
                </div>
                <div className="if-account-surface__control">
                  <span>Status</span>
                  <strong>Selected</strong>
                </div>
              </div>
            </section>
            <section className="if-account-surface__section" aria-label="Workspace display">
              <span className="if-account-surface__label">Workspace Display</span>
              {PROFILE_SETTINGS.map(([setting, icon, label, helper, dataAttr]) => (
                <ProfileSettingRow
                  key={setting}
                  setting={setting}
                  icon={icon}
                  label={label}
                  helper={helper}
                  dataAttr={dataAttr}
                />
              ))}
            </section>
            <section className="if-account-surface__section" aria-label="Profile actions">
              <button type="button" className="if-account-action" data-profile-manage-leads title="Open Lead Management">
                <span className="if-account-action__icon if-icon-slot" data-if-icon="users" aria-hidden="true"></span>
                <span className="if-account-action__content">
                  <strong className="if-account-action__title">Manage Leads</strong>
                  <span className="if-account-action__meta">1 Lead available for profile selection</span>
                </span>
              </button>
            </section>
          </div>
          <footer className="if-account-surface__footer">
            <span className="if-text-xs if-text-muted">Growth operator · Browser-local profile</span>
          </footer>
        </section>
      )}
    </div>
  );
}

function HeaderMenuItem({ active, label, description, badge, onSelect }) {
  return (
    <button
      type="button"
      className={`if-btn if-operations-topnav__menu-item${active ? " is-active" : ""}`}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
    >
      <span className="ci-topnav-menu-copy">
        <span className="ci-topnav-menu-label">{label}</span>
        {description ? <span className="ci-topnav-menu-description">{description}</span> : null}
      </span>
      {badge ? <span className="if-status-pill if-status-pill--compact ci-semantic-badge ci-semantic-badge--count ci-topnav-menu-badge">{badge}</span> : null}
    </button>
  );
}

function Header() {
  const [active, setActive] = useState("opportunities");
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const assetsRef = useRef(null);
  const adminRef = useRef(null);
  const mobileMoreRef = useRef(null);
  const activeTitle = {
    opportunities: "Opportunities",
    timeline: "Timeline",
    analytics: "Analytics",
    library: "Response Library",
    playbooks: "Capture Playbooks",
    leads: "Leads",
    quality: "Data Quality",
  }[active] || "Opportunities";
  const assetsIsActive = ["library", "playbooks"].includes(active);
  const adminIsActive = ["leads", "quality"].includes(active);

  useEffect(() => {
    function handleOutside(event) {
      if (assetsRef.current && !assetsRef.current.contains(event.target)) setAssetsOpen(false);
      if (adminRef.current && !adminRef.current.contains(event.target)) setAdminOpen(false);
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(event.target)) setMobileMoreOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setAssetsOpen(false);
        setAdminOpen(false);
        setMobileMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectSurface(id) {
    setActive(id);
    setAssetsOpen(false);
    setAdminOpen(false);
    setMobileMoreOpen(false);
  }

  function navButton(id, label) {
    const isActive = active === id;
    return (
      <button
        type="button"
        className={`if-operations-topnav__link ci-header-nav__primary-link${isActive ? " is-active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        data-fastdas-header-surface={id}
        onClick={() => selectSurface(id)}
      >
        {label}
      </button>
    );
  }

  return (
    <header
      className="if-product-header if-product-header--masthead if-product-header--compact if-product-header--sticky ci-sticky-header"
      data-fastdas-shell-header
      style={{ background: U.primaryDarker, borderBottom: `3px solid ${U.primary}` }}
    >
      <div className="if-product-header__inner" data-fastdas-header-utilities>
        <button
          type="button"
          className="if-brand if-product-header__brand"
          data-home-link
          aria-label="Go to FastDAS Growth Engine"
          title="Go to FastDAS Growth Engine"
          onClick={() => selectSurface("opportunities")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
            padding: 0,
            margin: 0,
            background: "transparent",
            border: "none",
            color: "inherit",
            font: "inherit",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            className="if-brand__mark"
            style={{
              background: U.primaryDarker,
              border: `1px solid ${U.primary}`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              padding: 0,
              color: U.white,
              fontWeight: 900,
            }}
          >
            FD
          </div>
          <div>
            <div className="if-product-header__eyebrow" style={{ color: U.primaryLight, textTransform: "uppercase", fontWeight: 600 }}>
              FastDAS Growth Engine
            </div>
            <div className="if-product-header__title" data-active-page-title style={{ fontWeight: 900, color: U.white }}>
              {activeTitle}
            </div>
          </div>
        </button>
        <nav className="if-operations-topnav ci-header-nav" data-fastdas-header-route aria-label="FastDAS Growth Engine sections">
          {navButton("opportunities", "Opportunities")}
          {navButton("timeline", "Timeline")}
          {navButton("analytics", "Analytics")}
          <div ref={assetsRef} className="if-operations-topnav__secondary ci-header-nav__desktop-menu">
            <button
              type="button"
              className={`if-operations-topnav__secondary-button ci-header-nav__menu-trigger${assetsIsActive ? " has-active-child" : ""}`}
              aria-haspopup="menu"
              aria-expanded={assetsOpen}
              aria-controls="response-assets-menu"
              data-response-assets-menu-button
              data-nav-group-trigger="response-assets"
              data-nav-group-active-child={assetsIsActive ? active : undefined}
              onClick={() => {
                setAdminOpen(false);
                setMobileMoreOpen(false);
                setAssetsOpen(open => !open);
              }}
            >
              <span className="ci-header-nav__menu-trigger-label">Response Assets</span>
              {assetsIsActive ? <span className="ci-header-nav__menu-trigger-context">{activeTitle}</span> : null}
              <span className="ci-header-nav__menu-trigger-chevron" aria-hidden="true">{assetsOpen ? "▲" : "▼"}</span>
            </button>
            {assetsOpen && (
              <div id="response-assets-menu" className="if-operations-topnav__menu" data-response-assets-menu role="menu" style={{ minWidth: 230 }}>
                <div className="if-operations-topnav__menu-label">Response Assets</div>
                <HeaderMenuItem active={active === "library"} label="Response Library" onSelect={() => selectSurface("library")} />
                <HeaderMenuItem active={active === "playbooks"} label="Capture Playbooks" onSelect={() => selectSurface("playbooks")} />
              </div>
            )}
          </div>
          <span className="if-operations-topnav__divider ci-domain-nav-separator ci-header-nav__desktop-menu" aria-hidden="true">|</span>
          <div ref={adminRef} className="if-operations-topnav__secondary ci-header-nav__desktop-menu">
            <button
              type="button"
              className={`if-operations-topnav__secondary-button ci-header-nav__menu-trigger${adminIsActive ? " has-active-child" : ""}`}
              aria-haspopup="menu"
              aria-expanded={adminOpen}
              aria-controls="secondary-surfaces-menu"
              data-platform-admin-menu-button
              data-nav-group-trigger="platform-admin"
              data-nav-group-active-child={adminIsActive ? active : undefined}
              onClick={() => {
                setAssetsOpen(false);
                setMobileMoreOpen(false);
                setAdminOpen(open => !open);
              }}
            >
              <span className="ci-header-nav__menu-trigger-label">Admin</span>
              {adminIsActive ? <span className="ci-header-nav__menu-trigger-context">{activeTitle}</span> : null}
              <span className="ci-header-nav__menu-trigger-chevron" aria-hidden="true">{adminOpen ? "▲" : "▼"}</span>
            </button>
            {adminOpen && (
              <div id="secondary-surfaces-menu" className="if-operations-topnav__menu" data-platform-admin-menu role="menu" style={{ minWidth: 230 }}>
                <div className="if-operations-topnav__menu-label">Platform Admin</div>
                <HeaderMenuItem active={active === "leads"} label="Leads" onSelect={() => selectSurface("leads")} />
                <HeaderMenuItem active={active === "quality"} label="Data Quality" onSelect={() => selectSurface("quality")} />
              </div>
            )}
          </div>
          <div ref={mobileMoreRef} className="if-operations-topnav__secondary ci-header-nav__mobile-more">
            <button
              type="button"
              className={`if-operations-topnav__secondary-button${assetsIsActive || adminIsActive ? " is-active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={mobileMoreOpen}
              aria-controls="mobile-secondary-surfaces-menu"
              title="Open FastDAS sections"
              data-mobile-more-menu-button
              onClick={() => {
                setAssetsOpen(false);
                setAdminOpen(false);
                setMobileMoreOpen(open => !open);
              }}
            >
              More {mobileMoreOpen ? "▲" : "▼"}
            </button>
            {mobileMoreOpen && (
              <div id="mobile-secondary-surfaces-menu" className="if-operations-topnav__menu ci-header-nav__mobile-menu" data-mobile-more-menu role="menu">
                <div className="if-operations-topnav__menu-label">Primary</div>
                <HeaderMenuItem active={active === "opportunities"} label="Opportunities" onSelect={() => selectSurface("opportunities")} />
                <HeaderMenuItem active={active === "timeline"} label="Timeline" onSelect={() => selectSurface("timeline")} />
                <HeaderMenuItem active={active === "analytics"} label="Analytics" onSelect={() => selectSurface("analytics")} />
                <div className="if-operations-topnav__menu-label">Response Assets</div>
                <HeaderMenuItem active={active === "library"} label="Response Library" onSelect={() => selectSurface("library")} />
                <HeaderMenuItem active={active === "playbooks"} label="Capture Playbooks" onSelect={() => selectSurface("playbooks")} />
                <div className="if-operations-topnav__menu-label">Platform Admin</div>
                <HeaderMenuItem active={active === "leads"} label="Leads" onSelect={() => selectSurface("leads")} />
                <HeaderMenuItem active={active === "quality"} label="Data Quality" onSelect={() => selectSurface("quality")} />
              </div>
            )}
          </div>
        </nav>
        <FastDasProfileMenu />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="if-panel__footer ci-opportunity-footer" data-opportunity-footer data-fastdas-release-rail data-visual-density="dense" aria-label="FastDAS Growth Engine footer">
      <div className="ci-opportunity-footer__lockup" data-footer-lockup>
        <span className="ci-opportunity-footer__monogram" aria-hidden="true">FD</span>
        <div className="ci-opportunity-footer__identity">
          <strong className="ci-opportunity-footer__brand">FastDAS Growth Engine</strong>
          <span className="ci-opportunity-footer__copyright">Copyright 2026 Adam Boas</span>
        </div>
      </div>
      <div className="ci-opportunity-footer__meta" data-footer-release data-fastdas-footer-status aria-label="Release metadata">
        <span>Version v0.1.0</span>
        <span>control-surface-ui</span>
        <span>Browser-local</span>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div
      className="if-main if-operations-app if-operations-app--wide if-operations-app--sticky-header ci-opportunity-app ci-intelligence-platform fg-root fg-baseline-root"
      data-theme="light"
      data-density="compact"
      data-fastdas-demo-app
      data-fastdas-baseline-app
    >
      <Header />
      <div className="if-content if-page if-operations-workspace if-operations-workspace--compact ci-opportunity-content fg-baseline-content" data-if-operations-workspace>
        <section className="fg-baseline-canvas" data-fastdas-baseline-canvas aria-label="Baseline canvas">
          <Icon name="document" />
        </section>
        <Footer />
      </div>
    </div>
  );
}
