import Link from "next/link";

export function QuickLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <div className="button-row">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="button button-secondary">
          {link.label}
        </Link>
      ))}
    </div>
  );
}