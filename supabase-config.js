// ============================================================
// Lexstore — Supabase connection
// The key below is the public "publishable" key, meant to be embedded in
// client-side code — it can only do what the database's row-level-security
// policies allow (read products, insert orders). It is not a secret.
// ============================================================
(function () {
  var SUPABASE_URL = "https://dzdcofphlxvfryamgczp.supabase.co";
  var SUPABASE_KEY = "sb_publishable_hfc8t01jvp04m9323ULJkw_X60hiO53";

  if (window.supabase && window.supabase.createClient) {
    window.LEXSTORE_SUPABASE = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error("Supabase client library did not load — falling back to static data where possible.");
  }
})();
