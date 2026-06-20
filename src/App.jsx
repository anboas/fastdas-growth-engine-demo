import { useEffect, useRef, useState } from "react";

function Icon({ name }) {
  return <span className="if-icon-slot fg-icon" data-if-icon={name} aria-hidden="true" />;
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
    <div ref={ref} className="if-popover if-account-popover ci-profile-menu fg-profile-menu" data-profile-menu data-fastdas-profile-menu>
      <button
        type="button"
        className={`if-account-menu${open ? " is-active" : ""}`}
        data-profile-menu-trigger
        aria-label="Profile menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="fastdas-profile-menu"
        title="Operator profile"
        onClick={() => setOpen(value => !value)}
      >
        <span className="if-avatar if-profile-avatar" data-profile-avatar aria-hidden="true">AB</span>
        <span className="if-account-menu__name if-desktop-only" data-profile-menu-name>Operator</span>
        <span className="if-icon-slot if-account-menu__chevron" data-if-icon="chevronDown" aria-hidden="true" />
      </button>

      {open ? (
        <section
          id="fastdas-profile-menu"
          className="if-popover__panel if-account-surface ci-profile-menu__surface fg-profile-menu__surface"
          data-profile-menu-surface
          role="dialog"
          aria-label="Operator profile controls"
        >
          <header className="if-account-surface__header">
            <span className="if-account-surface__avatar if-profile-avatar if-profile-avatar--large" aria-hidden="true">AB</span>
            <span className="if-account-surface__identity">
              <strong data-profile-active-name>Adam Boas</strong>
              <span>Growth operator</span>
              <span>OIP baseline workspace</span>
            </span>
          </header>
          <div className="if-account-surface__body">
            <section className="if-account-surface__section" aria-label="Profile source">
              <span className="if-account-surface__label">Identity Source</span>
              <div className="if-account-surface__controls">
                <div className="if-account-surface__control">
                  <span>Provider</span>
                  <strong>Local profile</strong>
                </div>
                <div className="if-account-surface__control">
                  <span>Baseline</span>
                  <strong>OIP shell</strong>
                </div>
              </div>
            </section>
            <section className="if-account-surface__section" aria-label="Workspace display">
              <span className="if-account-surface__label">Workspace Display</span>
              {[
                ["density", "Compact density", "Dense OIP operator chrome"],
                ["theme", "Light theme", "Control Surface light baseline"],
                ["safe", "Safe shell", "No growth-engine demo surfaces mounted"],
              ].map(([id, label, helper]) => (
                <button
                  type="button"
                  className="if-account-action ci-profile-setting-action ci-profile-setting-action--on"
                  data-profile-setting={id}
                  data-profile-setting-state="on"
                  aria-pressed="true"
                  key={id}
                >
                  <span className="if-account-action__icon if-icon-slot" data-if-icon="check" aria-hidden="true" />
                  <span className="if-account-action__content">
                    <strong className="if-account-action__title">{label}</strong>
                    <span className="if-account-action__meta">{helper}</span>
                  </span>
                </button>
              ))}
            </section>
          </div>
          <footer className="if-account-surface__footer">
            <span className="if-text-xs if-text-muted">FastDAS / OIP baseline</span>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <header className="if-product-header if-product-header--masthead if-product-header--compact if-product-header--sticky ci-sticky-header fg-product-header" data-fastdas-shell-header>
      <div className="if-product-header__inner fg-product-header__inner" data-fastdas-header-utilities>
        <button
          type="button"
          className="if-brand if-product-header__brand fg-product-header__brand"
          data-home-link
          aria-label="FastDAS baseline home"
        >
          <div className="if-brand__mark fg-brand__mark">FD</div>
          <div>
            <span className="if-product-header__eyebrow">FastDAS Growth Engine</span>
            <strong className="if-product-header__title" data-active-page-title>OIP Baseline</strong>
          </div>
        </button>

        <nav
          className="if-operations-topnav ci-header-nav fg-operations-topnav"
          data-fastdas-header-route
          aria-label="Baseline shell navigation"
        >
          {["Command Center", "Signal Intake", "Opportunity Workbench"].map(label => (
            <button
              type="button"
              className={`if-operations-topnav__link ci-header-nav__primary-link${label === "Command Center" ? " is-active" : ""}`}
              aria-current={label === "Command Center" ? "page" : undefined}
              data-fastdas-header-surface={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
              key={label}
            >
              {label}
            </button>
          ))}
        </nav>

        <FastDasProfileMenu />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="if-panel if-release-rail fg-footer fg-baseline-footer" data-fastdas-release-rail>
      <div className="if-release-summary fg-footer__brand">
        <span className="fg-footer__mark">FD</span>
        <span>
          <strong>FastDAS Growth Engine</strong>
          <em>OIP baseline shell</em>
        </span>
      </div>
      <div className="if-release-summary if-route-demo-controls fg-footer__status" data-fastdas-footer-status>
        <span className="if-route-status"><strong>State</strong><span>Baseline</span></span>
        <span className="if-route-status"><strong>Chrome</strong><span>Header / Profile / Footer</span></span>
        <span className="if-route-status"><strong>Host</strong><span>Cloudflare Pages</span></span>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div
      className="if-main if-operations-app if-operations-app--wide if-operations-app--sticky-header ci-opportunity-app fg-root fg-baseline-root"
      data-theme="light"
      data-density="compact"
      data-fastdas-demo-app
      data-fastdas-baseline-app
    >
      <Header />
      <main className="if-content if-page if-operations-workspace if-operations-workspace--compact ci-opportunity-content fg-content fg-baseline-content" data-if-operations-workspace>
        <section className="fg-baseline-canvas" data-fastdas-baseline-canvas aria-label="Baseline canvas">
          <Icon name="layout" />
        </section>
      </main>
      <Footer />
    </div>
  );
}
