import { useQuery } from "@tanstack/react-query";
import { myRoleQuery } from "@/lib/queries";

/** UI hint only — the database enforces who may change data. */
export function useIsAdmin() {
  const { data } = useQuery(myRoleQuery);
  return data === "admin";
}
