import { supabase } from "./supabase-client.js";
const ok = ({ data, error }) => { if (error) throw error; return data; };
const COLS = "id,title,cover_path,starts_at,location,status,rescheduled,xp_reward";
export const listEvents = () => supabase.from("events").select(COLS).neq("status", "draft").order("starts_at", { ascending: false }).limit(60).then(ok);
export const upcoming = (n) => supabase.from("events").select(COLS).eq("status", "published").gte("starts_at", new Date().toISOString()).order("starts_at").limit(n).then(ok);
export const getEvent = (id) => supabase.from("events").select("*").eq("id", id).maybeSingle().then(ok);
export const myRegistration = (id, uid) => supabase.from("event_registrations").select("status").eq("event_id", id).eq("user_id", uid).maybeSingle().then(ok);
export const myParticipation = (id, uid) => supabase.from("event_participations").select("validated_at").eq("event_id", id).eq("user_id", uid).maybeSingle().then(ok);
export const setRegistration = (id, status) => supabase.rpc("set_event_registration", { p_event: id, p_status: status }).then(ok);
