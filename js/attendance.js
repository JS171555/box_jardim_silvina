import { supabase } from "./supabase-client.js";
const ok = ({ data, error }) => { if (error) throw error; return data; };
export const checkIn = () => supabase.rpc("check_in").then(ok);
export const myStats = () => supabase.rpc("my_stats").then(ok);
export const myAttendance = (uid, limit = 60) =>
  supabase.from("attendance").select("attendance_date,status,source,note").eq("user_id", uid)
    .order("attendance_date", { ascending: false }).limit(limit).then(ok);
