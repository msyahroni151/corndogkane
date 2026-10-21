"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { UiIcon } from "@/components/ui-icon";

const preferenceKey = "corndog-kane:sidebar-collapsed";
const preferenceEvent = "corndog-kane:sidebar-change";
let memoryPreference = false;
let storageUnavailable = false;
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(preferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferenceEvent, callback);
  };
}
function snapshot() {
  if (storageUnavailable) return memoryPreference;
  try {
    return window.localStorage.getItem(preferenceKey) === "1";
  } catch {
    return memoryPreference;
  }
}
const SidebarContext = createContext({ collapsed: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarContext);

export function SidebarShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  function toggle() {
    memoryPreference = !collapsed;
    try {
      window.localStorage.setItem(preferenceKey, memoryPreference ? "1" : "0");
    } catch {
      storageUnavailable = true;
    }
    window.dispatchEvent(new Event(preferenceEvent));
  }
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <div
        className="workspace min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]"
        data-sidebar-collapsed={collapsed}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  const label = collapsed ? "Perluas sidebar" : "Ciutkan sidebar";
  return (
    <button
      type="button"
      className="sidebar-toggle"
      aria-label={label}
      aria-expanded={!collapsed}
      aria-controls="workspace-sidebar"
      title={label}
      onClick={toggle}
    >
      <UiIcon name="menu" size={21} />
    </button>
  );
}
