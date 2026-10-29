import { supabase } from "./supabase-client.js";
const ok = ({ data, error }) => { if (error) throw error; return data; };
export const getWorkout = (date) => supabase.rpc("get_workout_for_me", { p_date: date }).then(ok);
export const listWeek = (from, to) =>
  supabase.from("workouts").select("workout_date,title,workout_categories(name)").eq("status", "published")
    .gte("workout_date", from).lte("workout_date", to).order("workout_date").then(ok);
export const nextWorkout = (after) =>
  supabase.from("workouts").select("workout_date,title").eq("status", "published").gt("workout_date", after)
    .order("workout_date").limit(1).then(ok);
export const getSession = (workoutId, uid) =>
  supabase.from("workout_sessions").select("*, workout_results(*)").eq("workout_id", workoutId).eq("user_id", uid).maybeSingle().then(ok);
export const startSession = (id) => supabase.rpc("start_workout_session", { p_workout_id: id }).then(ok);
export const finishSession = (id, result) => supabase.rpc("finish_workout_session", { p_session_id: id, p_result: result }).then(ok);
export const mySessions = (uid, limit = 10) =>
  supabase.from("workout_sessions").select("finished_at,workouts(title,workout_date),workout_results(time_seconds,rounds,reps,load_kg)")
    .eq("user_id", uid).eq("status", "completed").order("finished_at", { ascending: false }).limit(limit).then(ok);
