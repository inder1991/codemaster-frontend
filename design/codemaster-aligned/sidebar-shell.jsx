/* SidebarShell — adopted-by-copy from
 * frontend/src/components/ui/application-shells/SidebarShell.tsx.
 *
 * Locked invariants (DESIGN.md):
 *   - Active nav item: bg.muted rounded pill, NO accent fill.
 *   - User card + theme toggle pinned to sidebar bottom.
 *   - Org switcher chip pinned to sidebar top.
 *   - Skip-to-content is the first focusable element.
 */

const NAVIGATION = [
  { name: "Dashboard",            href: "/dashboard",          icon: window.HomeIcon },
  { name: "Your activity",        href: "/your-reviews",       icon: window.ClipboardIcon },
  { name: "Reviews",              href: "/reviews",            icon: window.DocSearchIcon },
  { name: "Knowledge",            href: "/knowledge",          icon: window.BookOpenIcon },
  { name: "Knowledge proposals",  href: "/knowledge/proposals", icon: window.SparklesIcon },
  { name: "Kill switches",        href: "/kill-switches",      icon: window.BoltSlashIcon },
  { name: "Cost caps",            href: "/cost-caps",          icon: window.BanknotesIcon },
  { name: "Audit log",            href: "/audit-log",          icon: window.DocAuditIcon },
  { name: "Integrations",         href: "/integrations",       icon: window.LinkIcon },
  { name: "Status",               href: "/status",             icon: window.SignalIcon }
];

function MarbleAvatar({ name, size = 28 }) {
  // Standin for boring-avatars `marble` variant. Deterministic
  // hash → 3 OKLCH stops, blended on a small SVG. Keeps the
  // "no initials-on-circle" invariant from DESIGN.md.
  const hash = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h;
  }, [name]);
  const hue1 = hash % 360;
  const hue2 = (hash >> 8) % 360;
  const hue3 = (hash >> 16) % 360;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true"
         style={{ borderRadius: 999, overflow: "hidden" }}>
      <defs>
        <radialGradient id={`m1-${hash}`} cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor={`oklch(78% 0.13 ${hue1})`} />
          <stop offset="100%" stopColor={`oklch(58% 0.14 ${hue2})`} />
        </radialGradient>
        <radialGradient id={`m2-${hash}`} cx="80%" cy="70%" r="60%">
          <stop offset="0%"   stopColor={`oklch(70% 0.12 ${hue3})`} stopOpacity="0.85" />
          <stop offset="100%" stopColor={`oklch(70% 0.12 ${hue3})`} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" fill={`url(#m1-${hash})`} />
      <ellipse cx="22" cy="20" rx="18" ry="14" fill={`url(#m2-${hash})`} />
    </svg>
  );
}

function BrandMark({ size = 28, fontSize = 14 }) {
  return (
    <span aria-hidden="true"
          className="inline-flex items-center justify-center rounded-md c-bg-accent-solid c-text-on-solid t-body-strong"
          style={{ width: size, height: size, fontSize }}>
      c
    </span>
  );
}

function OrgSwitcher({ orgName }) {
  return (
    <button type="button"
            aria-label={`Switch organisation. Current: ${orgName}`}
            className="mt-3 flex w-full items-center gap-x-2 px-2.5 py-1.5 rounded-md border c-border-default c-bg-surface c-hover-bg dur-fast">
      <span aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-md c-bg-muted c-text-muted t-caption font-semibold uppercase">
        {orgName.charAt(0)}
      </span>
      <span className="flex-1 truncate text-left t-meta c-text-primary">{orgName}</span>
      <window.ChevronUpDownIcon className="size-4 shrink-0 c-text-faint" />
    </button>
  );
}

function NavItem({ item, current }) {
  const Icon = item.icon;
  return (
    <li>
      <a href={item.href}
         aria-current={current ? "page" : undefined}
         onClick={(e) => e.preventDefault()}
         className={
           "group flex items-center gap-x-3 px-3 py-2 t-meta rounded-md dur-fast " +
           (current
             ? "c-bg-muted c-text-primary"
             : "c-text-muted c-hover-text-primary c-hover-bg")
         }>
        <Icon className={"size-5 shrink-0 " + (current ? "c-text-primary" : "c-text-faint")} />
        {item.name}
      </a>
    </li>
  );
}

function UserCard({ user, theme, onToggleTheme }) {
  const ThemeIcon = theme === "dark" ? window.SunIcon : window.MoonIcon;
  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <div className="p-3 border-t c-border-default">
      <div className="flex items-center gap-x-2">
        <button type="button"
                className="flex flex-1 items-center gap-x-2.5 px-2 py-1.5 rounded-md c-hover-bg dur-fast">
          <span className="sr-only">Open user menu</span>
          <MarbleAvatar name={user.id} size={28} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate t-meta c-text-primary">{user.name}</span>
            <span className="block truncate t-caption c-text-faint">{user.role}</span>
          </span>
        </button>
        <button type="button"
                onClick={onToggleTheme}
                aria-label={themeLabel}
                title={themeLabel}
                className="shrink-0 p-2 rounded-md c-text-muted c-hover-text-primary c-hover-bg dur-fast">
          <ThemeIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}

function SidebarBody({ user, orgName, currentHref, theme, onToggleTheme }) {
  return (
    <div className="flex grow flex-col overflow-y-auto c-bg-elevated border-r c-border-default">
      {/* Brand + org switcher at the top */}
      <div className="px-4 pt-5 pb-4 border-b c-border-default">
        <div className="flex items-center gap-x-2.5">
          <BrandMark />
          <span className="t-body-strong c-text-primary">codemaster</span>
        </div>
        <OrgSwitcher orgName={orgName} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4" aria-label="Primary">
        <ul className="space-y-1">
          {NAVIGATION.map((item) => (
            <NavItem key={item.name} item={item} current={item.href === currentHref} />
          ))}
        </ul>
      </nav>

      {/* User card + theme toggle at bottom */}
      <UserCard user={user} theme={theme} onToggleTheme={onToggleTheme} />
    </div>
  );
}

function SidebarShell({ user, orgName = "acme", currentHref, children }) {
  // Theme value is read off <html class="dark"> so the chrome stays in
  // sync with the Tweaks panel's theme control.
  const [theme, setTheme] = React.useState(
    () => document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    // Also persist via the host so the Tweaks panel stays in lockstep.
    const next = document.documentElement.classList.contains("dark") ? "dark" : "light";
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { theme: next } }, "*");
  };

  return (
    <>
      <a href="#main-content"
         className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 rounded-md c-bg-elevated c-text-primary c-accent-ring t-body-strong">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarBody user={user} orgName={orgName} currentHref={currentHref}
                     theme={theme} onToggleTheme={toggleTheme} />
      </div>

      {/* Mobile chrome — top bar with hamburger only (no off-canvas in this mock) */}
      <div className="lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:hidden border-b c-border-default c-bg-surface">
          <button type="button" aria-label="Open sidebar"
                  className="-m-2.5 p-2.5 c-text-muted c-hover-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="t-body-strong c-text-primary">codemaster</span>
        </div>

        <main id="main-content" tabIndex={-1} className="py-10">
          <div className="px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

Object.assign(window, { SidebarShell, MarbleAvatar });
