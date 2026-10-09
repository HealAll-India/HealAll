"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User, Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import type { UserInfo } from "@/lib/types/api";

import { roleLinks } from "./nav-config";

interface Props {
  user: UserInfo;
  onSignOut: () => void;
}

const LEVEL_LABEL: Record<number, string> = { 1: "Verified", 2: "ID verified" };

/**
 * Account menu (WAI-ARIA menu button): Profile, Cases, role-gated staff
 * tools, Sign out. Arrow keys move between items, Escape closes and
 * returns focus to the trigger, outside clicks and navigation close it.
 */
export function AccountMenu({ user, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const staff = roleLinks(user.roles ?? []);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[i < 0 ? 0 : (i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="topbar__account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={user.name} src={user.avatar_url} size="sm" />
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          ref={panelRef}
          role="menu"
          aria-label="Account"
          className="menu__panel"
          // Any item choice (link or button) closes the menu.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
          }}
        >
          <div className="topbar__menu-head" role="presentation">
            <span className="topbar__menu-name">{user.name}</span>
            <span className="topbar__menu-sub">
              {LEVEL_LABEL[Math.min(user.verification_level, 2)] ?? "Not verified yet"}
            </span>
          </div>
          <div className="menu__sep" role="separator" />
          <Link role="menuitem" href="/profile" className="menu__item">
            <User size={18} aria-hidden="true" /> Profile
          </Link>
          <Link role="menuitem" href="/cases" className="menu__item">
            <Users size={18} aria-hidden="true" /> Cases
          </Link>
          {staff.length > 0 ? <div className="menu__sep" role="separator" /> : null}
          {staff.map(({ href, label, Icon }) => (
            <Link key={href} role="menuitem" href={href} className="menu__item">
              <Icon size={18} aria-hidden="true" /> {label}
            </Link>
          ))}
          <div className="menu__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="menu__item menu__item--danger"
            onClick={onSignOut}
          >
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
