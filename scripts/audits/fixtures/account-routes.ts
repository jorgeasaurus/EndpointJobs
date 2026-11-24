// The account write routes plus the stub session they share once bundled together.
export { PUT as putPreferences } from "@/app/api/account/preferences/route";
export { POST as postView } from "@/app/api/account/views/route";
export { setSignedIn, writes } from "./stubs/account-route-session";
