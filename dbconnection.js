const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jmggcavecybtzhvvyseb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZ2djYXZlY3lidHpodnZ5c2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1NDEwMjEsImV4cCI6MjA0MjExNzAyMX0.X8u43LP8NjBNC8e0mw07eOhQiGXnCI4QjbkTQ7Nyk6s'; // Paste the copied anon_key here

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = supabase
