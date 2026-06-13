/* Heroicons (24 outline + 20 solid), inlined as React components.
 * Sourced from heroicons.com — same iconset the codebase uses
 * (`@heroicons/react/24/outline` and `@heroicons/react/20/solid`).
 */

const _Icon = (paths, viewBox = "0 0 24 24") => function Icon({ className, "aria-hidden": ariaHidden = "true", ...rest }) {
  return (
    <svg viewBox={viewBox} fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden={ariaHidden} className={className} {...rest}>
      {paths}
    </svg>
  );
};

const _IconSolid = (paths, viewBox = "0 0 20 20") => function Icon({ className, "aria-hidden": ariaHidden = "true", ...rest }) {
  return (
    <svg viewBox={viewBox} fill="currentColor"
         aria-hidden={ariaHidden} className={className} {...rest}>
      {paths}
    </svg>
  );
};

// 24/outline — sidebar nav
const HomeIcon = _Icon(<path d="M2.25 12 12 3l9.75 9M4.5 9.75v10.125A1.125 1.125 0 0 0 5.625 21H9.75v-6h4.5v6h4.125A1.125 1.125 0 0 0 19.5 19.875V9.75" />);
const ClipboardIcon = _Icon(<><path d="M9 2.25h6A1.5 1.5 0 0 1 16.5 3.75v.75H7.5v-.75A1.5 1.5 0 0 1 9 2.25Z" /><path d="M16.5 4.5h2.25A1.5 1.5 0 0 1 20.25 6v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5H7.5" /></>);
const DocSearchIcon = _Icon(<><path d="M19.5 14.25v-2.625A3.375 3.375 0 0 0 16.125 8.25h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25" /><path d="M14.25 2.25H6a1.5 1.5 0 0 0-1.5 1.5v16.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V7.5L14.25 2.25Z" /><circle cx="11.25" cy="14.25" r="2.25" /><path d="m13 16 2 2" /></>);
const BookOpenIcon = _Icon(<path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />);
const SparklesIcon = _Icon(<path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />);
const BoltSlashIcon = _Icon(<path d="m3 3 18 18M11.412 15.655 9.75 21.75 18 10.5h-2.882M16.5 12 10.882 6.382m0 0L13.5 2.25 21 13.5h-1.382" />);
const BanknotesIcon = _Icon(<path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m20.25-6.75V18a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 18M21 8.25v.375c0 .621-.504 1.125-1.125 1.125H19.5m-7.5 6h.008v-.008H12V18Zm-3.75 0h.008v-.008h-.008V18Zm-3.75 0h.008v-.008h-.008V18Z M15.75 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />);
const DocAuditIcon = _Icon(<path d="M19.5 14.25v-2.625A3.375 3.375 0 0 0 16.125 8.25h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25 m6 0H5.625A1.125 1.125 0 0 0 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25 a9 9 0 0 0-9-9Z" />);
const LinkIcon = _Icon(<path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />);
const SignalIcon = _Icon(<path d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12Z" />);

// 16/20 — chrome
const ChevronUpDownIcon = _Icon(<path d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />);
const MoonIcon = _Icon(<path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />);
const SunIcon = _Icon(<path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />);

// 20/solid — content
const ChevronLeftIcon = _IconSolid(<path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />);
const CodeBracketIcon = _IconSolid(<path fillRule="evenodd" d="M14.447 3.026a.75.75 0 0 1 .527.921l-4.5 16.5a.75.75 0 0 1-1.448-.394l4.5-16.5a.75.75 0 0 1 .921-.527ZM16.72 6.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 0 1 0-1.06Zm-9.44 0a.75.75 0 0 1 0 1.06L2.56 12l4.72 4.72a.75.75 0 1 1-1.06 1.06L.97 12.53a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" viewBox="0 0 24 24" />, "0 0 24 24");
const ExternalLinkIcon = _IconSolid(<path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" /> /* + arrow */);
// Single proper external-link icon
const ExternalLinkIconFull = _IconSolid(<><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" /></>);

Object.assign(window, {
  HomeIcon, ClipboardIcon, DocSearchIcon, BookOpenIcon, SparklesIcon,
  BoltSlashIcon, BanknotesIcon, DocAuditIcon, LinkIcon, SignalIcon,
  ChevronUpDownIcon, MoonIcon, SunIcon,
  ChevronLeftIcon, CodeBracketIcon, ExternalLinkIcon: ExternalLinkIconFull
});
