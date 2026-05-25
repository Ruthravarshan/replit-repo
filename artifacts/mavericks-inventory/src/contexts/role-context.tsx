import { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "executive" | "manager" | "admin";

export interface RoleUser {
  role: UserRole;
  name: string;
  title: string;
  avatar: string;
}

export const ROLE_USERS: RoleUser[] = [
  { role: "admin", name: "System Admin", title: "Command Center", avatar: "SA" },
  { role: "executive", name: "Priya Sharma", title: "Executive (Maker)", avatar: "PS" },
  { role: "manager", name: "Rahul Mehta", title: "Manager (Checker)", avatar: "RM" },
];

interface RoleContextValue {
  currentUser: RoleUser;
  setRole: (role: UserRole) => void;
  canMake: boolean;
  canCheck: boolean;
  canAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem("mavericks_role") as UserRole) || "admin";
  });

  const setRole = (r: UserRole) => {
    localStorage.setItem("mavericks_role", r);
    setRoleState(r);
  };

  const currentUser = ROLE_USERS.find((u) => u.role === role)!;

  return (
    <RoleContext.Provider value={{
      currentUser,
      setRole,
      canMake: role === "executive" || role === "admin",
      canCheck: role === "manager" || role === "admin",
      canAdmin: role === "admin",
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
